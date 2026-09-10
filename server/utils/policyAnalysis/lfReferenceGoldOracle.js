const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const LF_REFERENCE_GOLD_ORACLE_SCHEMA_VERSION = 1;
const LF_REFERENCE_GOLD_ORACLE_CONTRACT_ID = "LF_COUNTERPART_GOLD_ORACLE_V1";
const LF_REFERENCE_BENCHMARK_CANDIDATES_CONTRACT_ID =
  "LF_COUNTERPART_BENCHMARK_CANDIDATES_V1";
const LF_REFERENCE_BENCHMARK_MANIFEST_CONTRACT_ID =
  "LF_REFERENCE_DISCOVERY_BENCHMARK_V1";
const LF_REFERENCE_ABSENCE_COMPLETENESS_CONTRACT_ID =
  "LF_COUNTERPART_ABSENCE_COMPLETENESS_V1";
const REQUIRED_ABSENCE_CHANNELS = Object.freeze([
  "CURRENT",
  "DINGHY",
  "LEXICAL_BM25",
  "STRUCTURAL",
  "UNION",
]);
const APPROVAL_STATUSES = new Set(["DRAFT", "APPROVED"]);
const REVIEW_STATUSES = new Set([
  "UNREVIEWED",
  "SINGLE_REVIEWED",
  "DOUBLE_REVIEWED",
  "ADJUDICATED",
  "APPROVED",
]);
const REFERENCE_VALIDITIES = new Set(["UNREVIEWED", "VALID", "INDETERMINATE"]);
const ROW_TRUTHS = new Set([
  "UNREVIEWED",
  "FULL_COUNTERPART",
  "PARTIAL_COUNTERPART",
  "CONTRADICTED",
  "ABSENT_CERTIFIED",
  "INDETERMINATE",
]);
const COMPONENT_TRUTHS = new Set([
  "UNREVIEWED",
  "DIRECT_SUPPORT",
  "NARROWER_SUPPORT",
  "CONTRADICTION",
  "RELATED_ONLY",
  "ABSENT_CERTIFIED",
  "INDETERMINATE",
]);
const COVERAGE_EFFECTS = new Set([
  "UNREVIEWED",
  "INCLUDED",
  "LIMITED",
  "EXCLUDED",
  "CONDITIONAL",
  "OPTIONAL",
  "DEFINED",
  "UNKNOWN",
  "NOT_APPLICABLE",
]);
const SUBSTANTIVE_EFFECTS = new Set([
  "INCLUDED",
  "LIMITED",
  "EXCLUDED",
  "CONDITIONAL",
  "OPTIONAL",
  "DEFINED",
]);
const SCOPE_RELATIONS = new Set([
  "UNREVIEWED",
  "SAME_OR_BROADER",
  "NARROWER",
  "DIFFERENT",
  "NOT_APPLICABLE",
  "UNCLEAR",
]);
const EVIDENCE_COMPONENT_TRUTHS = new Set([
  "DIRECT_SUPPORT",
  "NARROWER_SUPPORT",
  "CONTRADICTION",
]);
const FULL_COUNTERPART_POLICIES = new Set([
  "SAME_OR_BROADER_REQUIRED",
  "NARROWER_ACCEPTED",
]);

function oracleError(code, detail = "") {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  return error;
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

function sha256(value) {
  return crypto
    .createHash("sha256")
    .update(Buffer.isBuffer(value) ? value : String(value))
    .digest("hex");
}

const validSha256 = (value) => /^[a-f0-9]{64}$/u.test(value || "");
const validCommitSha = (value) => /^[a-f0-9]{40}$/u.test(value || "");

function requiredString(value, code) {
  if (typeof value !== "string" || !value.trim()) throw oracleError(code);
  return value.trim();
}

function uniqueStrings(values, code) {
  if (
    !Array.isArray(values) ||
    values.some((value) => typeof value !== "string" || !value.trim()) ||
    new Set(values).size !== values.length
  )
    throw oracleError(code);
  return values;
}

function readRegularJson(file, code, fsImpl = fs) {
  if (!path.isAbsolute(file) || !fsImpl.existsSync(file))
    throw oracleError(`${code}_MISSING`, file);
  const stat = fsImpl.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink())
    throw oracleError(`${code}_NOT_REGULAR`, file);
  const bytes = fsImpl.readFileSync(file);
  try {
    return { file, bytes, sha256: sha256(bytes), value: JSON.parse(bytes) };
  } catch {
    throw oracleError(`${code}_JSON_INVALID`, file);
  }
}

const samePath = (left, right) => path.resolve(left) === path.resolve(right);
const documentDirectoryName = (document) =>
  `B-${String(document.position + 1).padStart(2, "0")}-${document.uuid}`;
const findArtifactHash = (manifest, filename) =>
  manifest?.artifacts?.find((artifact) => artifact.filename === filename)
    ?.sha256;

function loadLfReferenceGoldOracleInputs({
  runRoot,
  benchmarkCandidatesFile,
  fsImpl = fs,
}) {
  const root = path.resolve(runRoot);
  if (
    !path.isAbsolute(runRoot) ||
    !fsImpl.existsSync(root) ||
    !fsImpl.lstatSync(root).isDirectory() ||
    fsImpl.lstatSync(root).isSymbolicLink()
  )
    throw oracleError("LF_GOLD_ORACLE_RUN_ROOT_INVALID", root);
  const files = {
    input: path.join(root, "input-manifest.private.json"),
    runContract: path.join(root, "run-contract.private.json"),
    comparison: path.join(root, "result", "comparison.private.json"),
    resultArtifacts: path.join(
      root,
      "result",
      "artifact-set-manifest.private.json"
    ),
    semanticManifest: path.join(
      root,
      "reference-template",
      "semantic-requirement-manifest.private.json"
    ),
    templateArtifacts: path.join(
      root,
      "reference-template",
      "artifact-set-manifest.private.json"
    ),
  };
  const reads = Object.fromEntries(
    Object.entries(files).map(([key, file]) => [
      key,
      readRegularJson(file, `LF_GOLD_ORACLE_${key.toUpperCase()}`, fsImpl),
    ])
  );
  const candidatesRead = readRegularJson(
    path.resolve(benchmarkCandidatesFile),
    "LF_GOLD_ORACLE_BENCHMARK_CANDIDATES",
    fsImpl
  );
  const benchmarkManifestRead = readRegularJson(
    path.join(path.dirname(candidatesRead.file), "manifest.private.json"),
    "LF_GOLD_ORACLE_BENCHMARK_MANIFEST",
    fsImpl
  );
  const benchmark = candidatesRead.value;
  const benchmarkManifest = benchmarkManifestRead.value;
  if (
    benchmark?.contractId !== LF_REFERENCE_BENCHMARK_CANDIDATES_CONTRACT_ID ||
    !path.isAbsolute(benchmark?.source?.inventoryPath || "") ||
    !validSha256(benchmark?.source?.inventorySha256) ||
    benchmarkManifest?.contractId !==
      LF_REFERENCE_BENCHMARK_MANIFEST_CONTRACT_ID ||
    benchmarkManifest?.status !== benchmark?.status ||
    !samePath(
      benchmarkManifest?.source?.candidatesPath || "",
      candidatesRead.file
    ) ||
    benchmarkManifest?.source?.candidatesSha256 !== candidatesRead.sha256 ||
    !samePath(
      benchmarkManifest?.source?.inventoryPath || "",
      benchmark?.source?.inventoryPath || ""
    ) ||
    benchmarkManifest?.source?.inventorySha256 !==
      benchmark?.source?.inventorySha256
  )
    throw oracleError("LF_GOLD_ORACLE_BENCHMARK_CHAIN_INVALID");
  const inventoryRead = readRegularJson(
    path.resolve(benchmark.source.inventoryPath),
    "LF_GOLD_ORACLE_INVENTORY",
    fsImpl
  );
  if (inventoryRead.sha256 !== benchmark.source.inventorySha256)
    throw oracleError("LF_GOLD_ORACLE_INVENTORY_HASH_MISMATCH");
  const inventory = inventoryRead.value;

  for (const [key, read] of Object.entries(reads)) {
    const bound = inventory?.sourceBindings?.files?.[key];
    if (
      !bound ||
      !samePath(bound.path, read.file) ||
      bound.sha256 !== read.sha256
    )
      throw oracleError("LF_GOLD_ORACLE_INVENTORY_SOURCE_MISMATCH", key);
  }
  const input = reads.input.value;
  const runContract = reads.runContract.value;
  const result = reads.comparison.value;
  const semanticManifest = reads.semanticManifest.value;
  const { manifestDigestSha256: _resultDigest, ...resultDigestBasis } =
    reads.resultArtifacts.value || {};
  const { manifestSha256: _semanticDigest, ...semanticDigestBasis } =
    semanticManifest || {};
  const computedResultManifestDigest = sha256(
    Buffer.from(JSON.stringify(resultDigestBasis), "utf8")
  );
  const computedSemanticContractHash = sha256(
    `${semanticManifest?.contractId}\u0000${canonicalJson(semanticDigestBasis)}`
  );
  if (
    findArtifactHash(reads.resultArtifacts.value, "comparison.private.json") !==
      reads.comparison.sha256 ||
    reads.templateArtifacts.value?.files?.[
      "semantic-requirement-manifest.private.json"
    ] !== reads.semanticManifest.sha256 ||
    reads.templateArtifacts.value?.semanticRequirementManifestSha256 !==
      semanticManifest.manifestSha256 ||
    result?.template?.semanticRequirementManifestSha256 !==
      semanticManifest.manifestSha256 ||
    reads.resultArtifacts.value?.manifestDigestSha256 !==
      computedResultManifestDigest ||
    semanticManifest.manifestSha256 !== computedSemanticContractHash
  )
    throw oracleError("LF_GOLD_ORACLE_ARTIFACT_HASH_CHAIN_INVALID");
  if (
    !validCommitSha(runContract?.releaseId) ||
    !validCommitSha(benchmarkManifest?.implementation?.releaseId) ||
    inventory?.sourceBindings?.runReleaseId !== runContract.releaseId ||
    result?.runSignature !== inventory?.sourceBindings?.runSignature ||
    result.runSignature !== benchmark?.source?.runSignature ||
    result.runSignature !== benchmark?.runSignature ||
    result.runSignature !== benchmarkManifest?.source?.runSignature ||
    reads.comparison.sha256 !== benchmark?.sourceResultSha256 ||
    reads.semanticManifest.sha256 !== benchmark?.sourceSemanticManifestSha256 ||
    inventoryRead.sha256 !== benchmark?.sourceInventorySha256 ||
    semanticManifest.manifestSha256 !==
      inventory?.sourceBindings?.semanticRequirementManifestSha256 ||
    semanticManifest.manifestSha256 !==
      benchmark?.source?.semanticRequirementManifestSha256 ||
    semanticManifest.manifestSha256 !==
      benchmarkManifest?.source?.semanticRequirementManifestSha256
  )
    throw oracleError("LF_GOLD_ORACLE_IDENTITY_CHAIN_INVALID");
  if (
    input?.sessionUuid !== result?.sessionUuid ||
    input?.comparisonMode !== result?.comparisonMode ||
    runContract?.comparisonMode !== result?.comparisonMode
  )
    throw oracleError("LF_GOLD_ORACLE_RUN_CONTRACT_MISMATCH");
  if (
    !Array.isArray(input.documents) ||
    !Array.isArray(runContract.documents) ||
    !Array.isArray(result.documents) ||
    input.documents.length !== runContract.documents.length ||
    input.documents.length !== result.documents.length
  )
    throw oracleError("LF_GOLD_ORACLE_DOCUMENT_IDENTITY_MISMATCH");
  for (const document of input.documents) {
    const runDocument = runContract.documents.find(
      ({ uuid }) => uuid === document.uuid
    );
    const resultDocument = result.documents.find(
      ({ uuid }) => uuid === document.uuid
    );
    if (
      !runDocument ||
      !resultDocument ||
      runDocument.sha256 !== document.sha256 ||
      resultDocument.sha256 !== document.sha256 ||
      runDocument.side !== document.side ||
      resultDocument.side !== document.side
    )
      throw oracleError(
        "LF_GOLD_ORACLE_DOCUMENT_IDENTITY_MISMATCH",
        document.uuid
      );
  }

  const bInputs = (input.documents || [])
    .filter(({ side }) => side === "B")
    .sort((left, right) => left.position - right.position);
  const documentArtifactReads = new Map();
  for (const document of bInputs) {
    const documentRead = readRegularJson(
      path.join(
        root,
        "documents",
        documentDirectoryName(document),
        "document.private.json"
      ),
      "LF_GOLD_ORACLE_DOCUMENT_ARTIFACT",
      fsImpl
    );
    if (
      documentRead.value?.fingerprint !== document.sha256 ||
      documentRead.value?.document?.sourceDocumentId !== document.sha256 ||
      !Array.isArray(documentRead.value?.document?.pageMap) ||
      typeof documentRead.value?.document?.pageContent !== "string"
    )
      throw oracleError(
        "LF_GOLD_ORACLE_DOCUMENT_ARTIFACT_INVALID",
        document.uuid
      );
    documentArtifactReads.set(document.uuid, {
      artifact: documentRead.value,
      artifactBytes: documentRead.bytes,
      artifactSha256: documentRead.sha256,
      pageMapSha256: sha256(canonicalJson(documentRead.value.document.pageMap)),
    });
  }
  return {
    input,
    runContract,
    result,
    semanticManifest,
    benchmark,
    benchmarkManifest,
    inventory,
    hashes: {
      inputSha256: reads.input.sha256,
      runContractSha256: reads.runContract.sha256,
      resultSha256: reads.comparison.sha256,
      resultArtifactManifestSha256: reads.resultArtifacts.sha256,
      semanticManifestSha256: reads.semanticManifest.sha256,
      templateArtifactManifestSha256: reads.templateArtifacts.sha256,
      inventorySha256: inventoryRead.sha256,
      benchmarkSha256: candidatesRead.sha256,
      benchmarkManifestSha256: benchmarkManifestRead.sha256,
    },
    documentArtifactsByUuid: documentArtifactReads,
  };
}

function baselineCustomerSearchStatus(row) {
  const contributors = (row?.packageB?.contributors || []).filter(
    ({ documentUuid, source }) =>
      typeof documentUuid === "string" &&
      documentUuid.trim() &&
      typeof source === "string" &&
      source.trim()
  );
  return contributors.length > 0 &&
    typeof row?.packageB?.documentedContent === "string" &&
    row.packageB.documentedContent.trim() &&
    typeof row?.packageB?.source === "string" &&
    row.packageB.source.trim()
    ? "GEFUNDEN"
    : "NICHT_GEFUNDEN";
}

function normalizeCandidateRange(candidate) {
  const source = candidate?.source || candidate || {};
  const exactQuote = source.exactQuote ?? source.exactText ?? null;
  if (exactQuote === null) return null;
  return {
    documentUuid: source.documentUuid || candidate.documentUuid || null,
    documentFingerprint:
      source.documentFingerprint ||
      source.documentSha256 ||
      candidate.documentFingerprint ||
      candidate.documentSha256 ||
      null,
    physicalPageNumber: source.physicalPageNumber ?? source.pageNumber ?? null,
    documentStart: source.documentStart ?? null,
    documentEnd: source.documentEnd ?? null,
    exactQuote,
    exactQuoteSha256: source.exactQuoteSha256 || sha256(exactQuote),
  };
}

function normalizeBenchmarkCandidates(benchmark) {
  if (
    !benchmark ||
    benchmark.contractId !== LF_REFERENCE_BENCHMARK_CANDIDATES_CONTRACT_ID ||
    benchmark.schemaVersion !== 1 ||
    benchmark.artifactKind !== "LF_COUNTERPART_BENCHMARK_CANDIDATES" ||
    !new Set(["EMBEDDING_NOT_RUN", "CHANNELS_COMPLETE_REVIEW_REQUIRED"]).has(
      benchmark.status
    ) ||
    benchmark.shadowOnly !== true ||
    benchmark.primaryMutationAllowed !== false ||
    benchmark.qwenExecuted !== false ||
    benchmark.candidateKind !== "NAVIGATION_EXACT_ORIGINAL_SPAN" ||
    !Array.isArray(benchmark.candidates)
  )
    throw oracleError("LF_GOLD_ORACLE_BENCHMARK_CONTRACT_INVALID");
  const ids = new Set();
  return benchmark.candidates.map((candidate) => {
    const candidateId = requiredString(
      candidate.candidateId,
      "LF_GOLD_ORACLE_BENCHMARK_CANDIDATE_ID_REQUIRED"
    );
    if (ids.has(candidateId))
      throw oracleError(
        "LF_GOLD_ORACLE_BENCHMARK_CANDIDATE_DUPLICATE",
        candidateId
      );
    ids.add(candidateId);
    if (
      candidate.candidateKind !== "NAVIGATION_EXACT_ORIGINAL_SPAN" ||
      candidate.navigationOnly !== true ||
      candidate.semanticDecision !== null ||
      candidate.channel !== "UNION" ||
      !Number.isInteger(candidate.rank) ||
      candidate.rank < 1 ||
      (candidate.score !== null && !Number.isFinite(candidate.score))
    )
      throw oracleError(
        "LF_GOLD_ORACLE_BENCHMARK_CANDIDATE_CONTRACT_INVALID",
        candidateId
      );
    const range = normalizeCandidateRange(candidate);
    if (!range)
      throw oracleError(
        "LF_GOLD_ORACLE_BENCHMARK_CANDIDATE_RANGE_REQUIRED",
        candidateId
      );
    return {
      candidateId,
      analysisRowId: requiredString(
        candidate.analysisRowId,
        "LF_GOLD_ORACLE_BENCHMARK_ROW_REQUIRED"
      ),
      requirementId: requiredString(
        candidate.requirementId,
        "LF_GOLD_ORACLE_BENCHMARK_REQUIREMENT_REQUIRED"
      ),
      componentId:
        candidate.componentId == null
          ? null
          : requiredString(
              candidate.componentId,
              "LF_GOLD_ORACLE_BENCHMARK_COMPONENT_INVALID"
            ),
      channels: [
        requiredString(
          candidate.channel,
          "LF_GOLD_ORACLE_BENCHMARK_CHANNEL_REQUIRED"
        ),
      ],
      rank: candidate.rank,
      score: candidate.score,
      candidateKind: candidate.candidateKind,
      navigationOnly: true,
      semanticDecision: null,
      range,
      channelProvenance: candidate.channelProvenance || null,
    };
  });
}

const unreviewedReview = () => ({
  status: "UNREVIEWED",
  reviewerIds: [],
  adjudicatorId: null,
  reviewedAt: null,
  note: null,
});
const fullCounterpartPolicy = (component) =>
  component.fullCounterpartPolicy === "NARROWER_ACCEPTED"
    ? "NARROWER_ACCEPTED"
    : "SAME_OR_BROADER_REQUIRED";

function unreviewedComponent(component, candidates) {
  return {
    componentId: component.id,
    label: component.label,
    factRole: component.factRole,
    componentContractSha256: sha256(canonicalJson(component)),
    fullCounterpartPolicy: fullCounterpartPolicy(component),
    truth: "UNREVIEWED",
    coverageEffect: "UNREVIEWED",
    scopeRelation: "UNREVIEWED",
    normalizedValues: [],
    acceptedSourceRanges: [],
    knownAdversarialSourceRanges: [],
    absenceCertification: null,
    benchmarkCandidateIds: candidates.map(({ candidateId }) => candidateId),
    review: unreviewedReview(),
  };
}

function buildLfReferenceGoldOracleSkeleton({
  oracleId,
  input,
  runContract,
  result,
  semanticManifest,
  benchmark,
  benchmarkManifest,
  inventory,
  hashes,
  documentArtifactsByUuid,
  createdAt = new Date().toISOString(),
}) {
  requiredString(oracleId, "LF_GOLD_ORACLE_ID_REQUIRED");
  const hashKeys = [
    "inputSha256",
    "runContractSha256",
    "resultSha256",
    "resultArtifactManifestSha256",
    "semanticManifestSha256",
    "templateArtifactManifestSha256",
    "inventorySha256",
    "benchmarkSha256",
    "benchmarkManifestSha256",
  ];
  if (hashKeys.some((key) => !validSha256(hashes?.[key])))
    throw oracleError("LF_GOLD_ORACLE_SOURCE_HASH_INVALID");
  if (
    !validCommitSha(runContract?.releaseId) ||
    !validCommitSha(benchmarkManifest?.implementation?.releaseId) ||
    result?.comparisonMode !== "LF_IMMO_REFERENCE_A_TO_B_V1" ||
    result?.contractId !== "LF_DYNAMIC_REFERENCE_A_TO_B_RESULT_V1" ||
    input?.sessionUuid !== result.sessionUuid ||
    !validSha256(result.runSignature) ||
    inventory?.sourceBindings?.runReleaseId !== runContract.releaseId ||
    inventory?.sourceBindings?.runSignature !== result.runSignature ||
    benchmark?.source?.runSignature !== result.runSignature ||
    benchmarkManifest?.source?.runSignature !== result.runSignature ||
    benchmark?.sourceResultSha256 !== hashes.resultSha256 ||
    benchmark?.sourceSemanticManifestSha256 !== hashes.semanticManifestSha256 ||
    benchmark?.sourceInventorySha256 !== hashes.inventorySha256 ||
    benchmarkManifest?.source?.inventorySha256 !== hashes.inventorySha256 ||
    benchmarkManifest?.source?.candidatesSha256 !== hashes.benchmarkSha256 ||
    !Array.isArray(result.categories) ||
    !Array.isArray(result.documents) ||
    result.documents.filter(({ side }) => side === "A").length !== 1 ||
    result.documents.filter(({ side }) => side === "B").length < 1
  )
    throw oracleError("LF_GOLD_ORACLE_RESULT_CONTRACT_INVALID");
  if (
    !Array.isArray(semanticManifest?.requirements) ||
    semanticManifest.requirements.length !== 283 ||
    !validSha256(semanticManifest.manifestSha256) ||
    result.template?.semanticRequirementManifestSha256 !==
      semanticManifest.manifestSha256
  )
    throw oracleError("LF_GOLD_ORACLE_MANIFEST_REQUIREMENTS_INVALID");

  const resultRows = result.categories.flatMap(({ categoryView, rows }) =>
    (rows || []).map((row) => ({ ...row, categoryView }))
  );
  if (
    resultRows.length !== 283 ||
    new Set(resultRows.map(({ analysisRowId }) => analysisRowId)).size !==
      283 ||
    new Set(resultRows.map(({ sourceOrder }) => sourceOrder)).size !== 283
  )
    throw oracleError("LF_GOLD_ORACLE_RESULT_ROWS_INVALID");
  const requirementById = new Map(
    semanticManifest.requirements.map((requirement) => [
      requirement.requirementId,
      requirement,
    ])
  );
  if (requirementById.size !== 283)
    throw oracleError("LF_GOLD_ORACLE_MANIFEST_REQUIREMENTS_INVALID");
  const candidates = normalizeBenchmarkCandidates(benchmark);
  const resultRowById = new Map(
    resultRows.map((row) => [row.analysisRowId, row])
  );
  for (const candidate of candidates) {
    const row = resultRowById.get(candidate.analysisRowId);
    const requirement = requirementById.get(candidate.requirementId);
    if (!row || row.categoryId !== candidate.requirementId || !requirement)
      throw oracleError(
        "LF_GOLD_ORACLE_BENCHMARK_TARGET_INVALID",
        candidate.candidateId
      );
    if (
      candidate.componentId &&
      !requirement.components.some(({ id }) => id === candidate.componentId)
    )
      throw oracleError(
        "LF_GOLD_ORACLE_BENCHMARK_COMPONENT_INVALID",
        candidate.candidateId
      );
  }

  const rows = [...resultRows]
    .sort((left, right) => left.sourceOrder - right.sourceOrder)
    .map((row) => {
      const requirement = requirementById.get(row.categoryId);
      if (
        !requirement ||
        requirement.sourceOrder !== row.sourceOrder ||
        !Array.isArray(requirement.components) ||
        !requirement.components.length
      )
        throw oracleError(
          "LF_GOLD_ORACLE_ROW_REQUIREMENT_MISMATCH",
          row.analysisRowId
        );
      const rowCandidates = candidates.filter(
        ({ analysisRowId }) => analysisRowId === row.analysisRowId
      );
      return {
        analysisRowId: row.analysisRowId,
        requirementId: row.categoryId,
        sourceOrder: row.sourceOrder,
        categoryView: row.categoryView,
        categoryName: row.categoryName,
        subcategoryId: row.subcategoryId,
        subcategoryName: row.subcategoryName,
        semanticRequirementSha256: sha256(canonicalJson(requirement)),
        baselineRowSha256: sha256(canonicalJson(row)),
        baseline: {
          privateOutcome: row.outcome,
          customerSearchStatus: baselineCustomerSearchStatus(row),
        },
        referenceValidity: "UNREVIEWED",
        rowTruth: "UNREVIEWED",
        benchmarkCandidateIds: rowCandidates.map(
          ({ candidateId }) => candidateId
        ),
        components: requirement.components.map((component) =>
          unreviewedComponent(
            component,
            rowCandidates.filter(
              ({ componentId }) =>
                componentId === null || componentId === component.id
            )
          )
        ),
        review: unreviewedReview(),
      };
    });
  const componentCount = rows.reduce(
    (sum, row) => sum + row.components.length,
    0
  );
  if (componentCount !== 631)
    throw oracleError(
      "LF_GOLD_ORACLE_COMPONENT_COUNT_INVALID",
      String(componentCount)
    );
  const documents = result.documents.map((document) => {
    const artifact =
      document.side === "B"
        ? documentArtifactsByUuid?.get(document.uuid)
        : null;
    if (document.side === "B" && !artifact)
      throw oracleError(
        "LF_GOLD_ORACLE_DOCUMENT_ARTIFACT_MISSING",
        document.uuid
      );
    return {
      uuid: document.uuid,
      side: document.side,
      role: document.role,
      documentStatus: document.documentStatus,
      originalName: document.originalName,
      fingerprint: document.sha256,
      artifactSha256: artifact?.artifactSha256 || null,
      pageMapSha256: artifact?.pageMapSha256 || null,
    };
  });
  const oracle = {
    schemaVersion: LF_REFERENCE_GOLD_ORACLE_SCHEMA_VERSION,
    contractId: LF_REFERENCE_GOLD_ORACLE_CONTRACT_ID,
    oracleId,
    createdAt,
    approval: {
      status: "DRAFT",
      reviewerIds: [],
      adjudicatorId: null,
      approvedAt: null,
    },
    split: "KNOWN_DEVELOPMENT_FIXTURE",
    authority: "HUMAN_EXPERT_GOLD_REQUIRED",
    bindings: {
      runReleaseCommitSha: runContract.releaseId,
      benchmarkImplementationCommitSha:
        benchmarkManifest.implementation.releaseId,
      benchmarkStatus: benchmark.status,
      sessionUuid: result.sessionUuid,
      runSignature: result.runSignature,
      semanticOracleId: semanticManifest.semanticOracleId,
      semanticManifestContractSha256: semanticManifest.manifestSha256,
      ...hashes,
    },
    documents,
    summary: {
      rowCount: rows.length,
      componentCount,
      benchmarkCandidateCount: candidates.length,
      unreviewedRowCount: rows.length,
      unreviewedComponentCount: componentCount,
    },
    benchmarkCandidates: candidates,
    rows,
  };
  return validateLfReferenceGoldOracle(oracle, { documentArtifactsByUuid });
}

function validateReview(review, approved, code) {
  if (
    !review ||
    !REVIEW_STATUSES.has(review.status) ||
    !Array.isArray(review.reviewerIds) ||
    new Set(review.reviewerIds).size !== review.reviewerIds.length
  )
    throw oracleError(code);
  if (
    approved &&
    (review.status !== "APPROVED" ||
      review.reviewerIds.length < 2 ||
      typeof review.reviewedAt !== "string" ||
      !review.reviewedAt)
  )
    throw oracleError(code);
}

const normalizeArtifactEntry = (entry) =>
  entry?.artifact
    ? entry
    : {
        artifact: entry,
        artifactBytes: null,
        artifactSha256: null,
        pageMapSha256: null,
      };

function validateDocumentArtifacts(oracle, documentArtifactsByUuid, approved) {
  if (!documentArtifactsByUuid) {
    if (approved)
      throw oracleError("LF_GOLD_ORACLE_DOCUMENT_ARTIFACTS_REQUIRED");
    return new Map();
  }
  const byUuid =
    documentArtifactsByUuid instanceof Map
      ? documentArtifactsByUuid
      : new Map(Object.entries(documentArtifactsByUuid));
  const expected = oracle.documents.filter(({ side }) => side === "B");
  if (approved && byUuid.size !== expected.length)
    throw oracleError("LF_GOLD_ORACLE_DOCUMENT_ARTIFACT_PARTITION_INVALID");
  for (const document of expected) {
    const entry = normalizeArtifactEntry(byUuid.get(document.uuid));
    const source = entry.artifact?.document;
    let bytesValue = null;
    try {
      bytesValue = entry.artifactBytes
        ? JSON.parse(Buffer.from(entry.artifactBytes).toString("utf8"))
        : null;
    } catch {
      throw oracleError(
        "LF_GOLD_ORACLE_DOCUMENT_ARTIFACT_INVALID",
        document.uuid
      );
    }
    const pageMapSha256 = Array.isArray(source?.pageMap)
      ? sha256(canonicalJson(source.pageMap))
      : null;
    if (
      !entry.artifact ||
      entry.artifact.fingerprint !== document.fingerprint ||
      source?.sourceDocumentId !== document.fingerprint ||
      typeof source?.pageContent !== "string" ||
      !Array.isArray(source?.pageMap) ||
      canonicalJson(bytesValue) !== canonicalJson(entry.artifact) ||
      sha256(entry.artifactBytes || "") !== document.artifactSha256 ||
      entry.artifactSha256 !== document.artifactSha256 ||
      pageMapSha256 !== document.pageMapSha256 ||
      (entry.pageMapSha256 && entry.pageMapSha256 !== pageMapSha256)
    )
      throw oracleError(
        "LF_GOLD_ORACLE_DOCUMENT_ARTIFACT_INVALID",
        document.uuid
      );
  }
  return byUuid;
}

function validateEvidenceRange(
  range,
  bDocumentsByUuid,
  documentArtifactsByUuid
) {
  const boundDocument = bDocumentsByUuid.get(range?.documentUuid);
  if (
    !range ||
    !boundDocument ||
    boundDocument.fingerprint !== range.documentFingerprint ||
    !Number.isInteger(range.physicalPageNumber) ||
    range.physicalPageNumber < 1 ||
    !Number.isInteger(range.documentStart) ||
    range.documentStart < 0 ||
    !Number.isInteger(range.documentEnd) ||
    range.documentEnd <= range.documentStart ||
    typeof range.exactQuote !== "string" ||
    !range.exactQuote ||
    !validSha256(range.exactQuoteSha256) ||
    sha256(range.exactQuote) !== range.exactQuoteSha256
  )
    throw oracleError("LF_GOLD_ORACLE_EVIDENCE_RANGE_INVALID");
  if (!documentArtifactsByUuid.size) return;
  const source = normalizeArtifactEntry(
    documentArtifactsByUuid.get(range.documentUuid)
  ).artifact?.document;
  const page = source?.pageMap?.find(
    ({ pageNumber }) => pageNumber === range.physicalPageNumber
  );
  if (
    !page ||
    range.documentStart < page.start ||
    range.documentEnd > page.end ||
    source.pageContent.slice(range.documentStart, range.documentEnd) !==
      range.exactQuote
  )
    throw oracleError("LF_GOLD_ORACLE_EVIDENCE_SOURCE_MISMATCH");
}

function validateAbsenceCertification(certification, bDocuments) {
  const reviewed = certification?.reviewedDocuments;
  const reviewedByUuid = new Map(
    Array.isArray(reviewed)
      ? reviewed.map((document) => [document.uuid, document])
      : []
  );
  if (
    certification?.schemaVersion !== 1 ||
    certification?.contractId !==
      LF_REFERENCE_ABSENCE_COMPLETENESS_CONTRACT_ID ||
    certification?.status !== "CERTIFIED_ABSENT" ||
    typeof certification?.completedAt !== "string" ||
    !certification.completedAt ||
    !Array.isArray(certification.reviewerIds) ||
    new Set(certification.reviewerIds).size !==
      certification.reviewerIds.length ||
    certification.reviewerIds.length < 2 ||
    canonicalJson([...(certification.requiredChannels || [])].sort()) !==
      canonicalJson(REQUIRED_ABSENCE_CHANNELS) ||
    !Array.isArray(reviewed) ||
    reviewedByUuid.size !== bDocuments.length ||
    reviewed.length !== bDocuments.length
  )
    throw oracleError("LF_GOLD_ORACLE_ABSENCE_CERTIFICATION_INVALID");
  for (const document of bDocuments) {
    const actual = reviewedByUuid.get(document.uuid);
    if (
      !actual ||
      actual.fingerprint !== document.fingerprint ||
      actual.artifactSha256 !== document.artifactSha256 ||
      actual.pageMapSha256 !== document.pageMapSha256
    )
      throw oracleError("LF_GOLD_ORACLE_ABSENCE_CERTIFICATION_INVALID");
  }
}

function validateTruthEffectScope(component) {
  const accepted = component.acceptedSourceRanges.length;
  const adversarial = component.knownAdversarialSourceRanges.length;
  const valid =
    (component.truth === "UNREVIEWED" &&
      component.coverageEffect === "UNREVIEWED" &&
      component.scopeRelation === "UNREVIEWED" &&
      !accepted &&
      !adversarial &&
      component.absenceCertification === null) ||
    (component.truth === "DIRECT_SUPPORT" &&
      SUBSTANTIVE_EFFECTS.has(component.coverageEffect) &&
      component.scopeRelation === "SAME_OR_BROADER" &&
      accepted > 0 &&
      component.absenceCertification === null) ||
    (component.truth === "NARROWER_SUPPORT" &&
      SUBSTANTIVE_EFFECTS.has(component.coverageEffect) &&
      component.scopeRelation === "NARROWER" &&
      accepted > 0 &&
      component.absenceCertification === null) ||
    (component.truth === "CONTRADICTION" &&
      SUBSTANTIVE_EFFECTS.has(component.coverageEffect) &&
      new Set(["SAME_OR_BROADER", "NARROWER"]).has(component.scopeRelation) &&
      accepted > 0 &&
      component.absenceCertification === null) ||
    (component.truth === "RELATED_ONLY" &&
      new Set(["UNKNOWN", "NOT_APPLICABLE"]).has(component.coverageEffect) &&
      new Set(["DIFFERENT", "NOT_APPLICABLE"]).has(component.scopeRelation) &&
      !accepted &&
      adversarial > 0 &&
      component.absenceCertification === null) ||
    (component.truth === "ABSENT_CERTIFIED" &&
      component.coverageEffect === "NOT_APPLICABLE" &&
      component.scopeRelation === "NOT_APPLICABLE" &&
      !accepted &&
      !adversarial &&
      component.absenceCertification !== null) ||
    (component.truth === "INDETERMINATE" &&
      component.coverageEffect === "UNKNOWN" &&
      component.scopeRelation === "UNCLEAR" &&
      !accepted &&
      component.absenceCertification === null);
  if (!valid) throw oracleError("LF_GOLD_ORACLE_TRUTH_EFFECT_SCOPE_INVALID");
}

const componentCountsAsFull = (component) =>
  component.truth === "DIRECT_SUPPORT" ||
  (component.truth === "NARROWER_SUPPORT" &&
    component.fullCounterpartPolicy === "NARROWER_ACCEPTED");

function validateLfReferenceGoldOracle(
  oracle,
  { documentArtifactsByUuid = null, requireApproved = false } = {}
) {
  if (
    oracle?.schemaVersion !== LF_REFERENCE_GOLD_ORACLE_SCHEMA_VERSION ||
    oracle?.contractId !== LF_REFERENCE_GOLD_ORACLE_CONTRACT_ID ||
    !APPROVAL_STATUSES.has(oracle?.approval?.status) ||
    !Array.isArray(oracle?.documents) ||
    !Array.isArray(oracle?.rows) ||
    !Array.isArray(oracle?.benchmarkCandidates)
  )
    throw oracleError("LF_GOLD_ORACLE_CONTRACT_INVALID");
  const hashBindings = [
    "runSignature",
    "resultSha256",
    "resultArtifactManifestSha256",
    "semanticManifestSha256",
    "templateArtifactManifestSha256",
    "semanticManifestContractSha256",
    "inventorySha256",
    "benchmarkSha256",
    "benchmarkManifestSha256",
    "inputSha256",
    "runContractSha256",
  ];
  if (
    !validCommitSha(oracle.bindings?.runReleaseCommitSha) ||
    !validCommitSha(oracle.bindings?.benchmarkImplementationCommitSha) ||
    hashBindings.some((key) => !validSha256(oracle.bindings?.[key])) ||
    typeof oracle.bindings?.sessionUuid !== "string" ||
    !oracle.bindings.sessionUuid ||
    !new Set(["EMBEDDING_NOT_RUN", "CHANNELS_COMPLETE_REVIEW_REQUIRED"]).has(
      oracle.bindings?.benchmarkStatus
    ) ||
    typeof oracle.bindings?.semanticOracleId !== "string" ||
    !oracle.bindings.semanticOracleId
  )
    throw oracleError("LF_GOLD_ORACLE_BINDINGS_INVALID");
  const approved = oracle.approval.status === "APPROVED";
  if (requireApproved && !approved)
    throw oracleError("LF_GOLD_ORACLE_NOT_APPROVED");
  uniqueStrings(
    oracle.approval.reviewerIds,
    "LF_GOLD_ORACLE_APPROVAL_REVIEWERS_INVALID"
  );
  if (
    approved &&
    (oracle.approval.reviewerIds.length < 2 ||
      typeof oracle.approval.adjudicatorId !== "string" ||
      !oracle.approval.adjudicatorId ||
      typeof oracle.approval.approvedAt !== "string" ||
      !oracle.approval.approvedAt)
  )
    throw oracleError("LF_GOLD_ORACLE_APPROVAL_INVALID");

  const documentIds = new Set();
  const bDocumentsByUuid = new Map();
  for (const document of oracle.documents) {
    if (
      documentIds.has(document.uuid) ||
      typeof document.uuid !== "string" ||
      !validSha256(document.fingerprint) ||
      !new Set(["A", "B"]).has(document.side) ||
      (document.side === "B" &&
        (!validSha256(document.artifactSha256) ||
          !validSha256(document.pageMapSha256)))
    )
      throw oracleError("LF_GOLD_ORACLE_DOCUMENTS_INVALID");
    documentIds.add(document.uuid);
    if (document.side === "B") bDocumentsByUuid.set(document.uuid, document);
  }
  if (
    oracle.documents.filter(({ side }) => side === "A").length !== 1 ||
    !bDocumentsByUuid.size
  )
    throw oracleError("LF_GOLD_ORACLE_DOCUMENTS_INVALID");
  const artifactMap = validateDocumentArtifacts(
    oracle,
    documentArtifactsByUuid,
    approved
  );

  const candidateIds = new Set();
  const candidateById = new Map();
  for (const candidate of oracle.benchmarkCandidates) {
    if (
      candidateIds.has(candidate.candidateId) ||
      typeof candidate.analysisRowId !== "string" ||
      typeof candidate.requirementId !== "string" ||
      !Array.isArray(candidate.channels) ||
      candidate.channels.length !== 1
    )
      throw oracleError("LF_GOLD_ORACLE_BENCHMARK_CANDIDATES_INVALID");
    candidateIds.add(candidate.candidateId);
    candidateById.set(candidate.candidateId, candidate);
    validateEvidenceRange(candidate.range, bDocumentsByUuid, artifactMap);
  }
  if (
    oracle.rows.length !== 283 ||
    new Set(oracle.rows.map(({ analysisRowId }) => analysisRowId)).size !==
      283 ||
    new Set(oracle.rows.map(({ sourceOrder }) => sourceOrder)).size !== 283
  )
    throw oracleError("LF_GOLD_ORACLE_ROWS_INVALID");
  let componentCount = 0;
  let unreviewedRowCount = 0;
  let unreviewedComponentCount = 0;
  const bDocuments = [...bDocumentsByUuid.values()];
  for (const row of oracle.rows) {
    if (
      !REFERENCE_VALIDITIES.has(row.referenceValidity) ||
      !ROW_TRUTHS.has(row.rowTruth) ||
      !Array.isArray(row.components) ||
      !row.components.length ||
      new Set(row.components.map(({ componentId }) => componentId)).size !==
        row.components.length ||
      row.benchmarkCandidateIds.some((candidateId) => {
        const candidate = candidateById.get(candidateId);
        return !candidate || candidate.analysisRowId !== row.analysisRowId;
      })
    )
      throw oracleError("LF_GOLD_ORACLE_ROW_INVALID", row.analysisRowId);
    validateReview(row.review, approved, "LF_GOLD_ORACLE_ROW_REVIEW_INVALID");
    if (
      approved &&
      (row.referenceValidity === "UNREVIEWED" || row.rowTruth === "UNREVIEWED")
    )
      throw oracleError("LF_GOLD_ORACLE_ROW_LABELS_INCOMPLETE");
    if (row.rowTruth === "UNREVIEWED") unreviewedRowCount += 1;
    for (const component of row.components) {
      componentCount += 1;
      if (
        !COMPONENT_TRUTHS.has(component.truth) ||
        !COVERAGE_EFFECTS.has(component.coverageEffect) ||
        !SCOPE_RELATIONS.has(component.scopeRelation) ||
        !FULL_COUNTERPART_POLICIES.has(component.fullCounterpartPolicy) ||
        !Array.isArray(component.normalizedValues) ||
        !Array.isArray(component.acceptedSourceRanges) ||
        !Array.isArray(component.knownAdversarialSourceRanges) ||
        component.benchmarkCandidateIds.some((candidateId) => {
          const candidate = candidateById.get(candidateId);
          return (
            !candidate ||
            candidate.analysisRowId !== row.analysisRowId ||
            (candidate.componentId !== null &&
              candidate.componentId !== component.componentId)
          );
        })
      )
        throw oracleError(
          "LF_GOLD_ORACLE_COMPONENT_INVALID",
          `${row.analysisRowId}:${component.componentId}`
        );
      validateReview(
        component.review,
        approved,
        "LF_GOLD_ORACLE_COMPONENT_REVIEW_INVALID"
      );
      for (const range of [
        ...component.acceptedSourceRanges,
        ...component.knownAdversarialSourceRanges,
      ])
        validateEvidenceRange(range, bDocumentsByUuid, artifactMap);
      validateTruthEffectScope(component);
      if (component.truth === "ABSENT_CERTIFIED")
        if (
          oracle.bindings.benchmarkStatus !==
          "CHANNELS_COMPLETE_REVIEW_REQUIRED"
        )
          throw oracleError("LF_GOLD_ORACLE_ABSENCE_CHANNELS_INCOMPLETE");
      if (component.truth === "ABSENT_CERTIFIED")
        validateAbsenceCertification(
          component.absenceCertification,
          bDocuments
        );
      if (
        approved &&
        (component.truth === "UNREVIEWED" ||
          component.coverageEffect === "UNREVIEWED" ||
          component.scopeRelation === "UNREVIEWED")
      )
        throw oracleError("LF_GOLD_ORACLE_COMPONENT_LABELS_INCOMPLETE");
      if (component.truth === "UNREVIEWED") unreviewedComponentCount += 1;
    }
    if (approved) {
      const truths = row.components.map(({ truth }) => truth);
      const hasSupport = truths.some((truth) =>
        new Set(["DIRECT_SUPPORT", "NARROWER_SUPPORT"]).has(truth)
      );
      const allFull = row.components.every(componentCountsAsFull);
      const rowTruthConsistent =
        (row.referenceValidity === "INDETERMINATE" &&
          row.rowTruth === "INDETERMINATE") ||
        (row.referenceValidity === "VALID" &&
          ((row.rowTruth === "FULL_COUNTERPART" && allFull) ||
            (row.rowTruth === "PARTIAL_COUNTERPART" &&
              hasSupport &&
              !allFull &&
              !truths.includes("CONTRADICTION")) ||
            (row.rowTruth === "CONTRADICTED" &&
              truths.includes("CONTRADICTION")) ||
            (row.rowTruth === "ABSENT_CERTIFIED" &&
              truths.every((truth) => truth === "ABSENT_CERTIFIED")) ||
            (row.rowTruth === "INDETERMINATE" &&
              !hasSupport &&
              !truths.includes("CONTRADICTION") &&
              !truths.every((truth) => truth === "ABSENT_CERTIFIED"))));
      if (!rowTruthConsistent)
        throw oracleError(
          "LF_GOLD_ORACLE_ROW_TRUTH_INCONSISTENT",
          row.analysisRowId
        );
    }
  }
  if (
    componentCount !== 631 ||
    oracle.summary?.rowCount !== 283 ||
    oracle.summary?.componentCount !== componentCount ||
    oracle.summary?.benchmarkCandidateCount !==
      oracle.benchmarkCandidates.length ||
    oracle.summary?.unreviewedRowCount !== unreviewedRowCount ||
    oracle.summary?.unreviewedComponentCount !== unreviewedComponentCount
  )
    throw oracleError("LF_GOLD_ORACLE_SUMMARY_INVALID");
  return oracle;
}

const rangeMatches = (predicted, expected) =>
  predicted.documentUuid === expected.documentUuid &&
  predicted.documentFingerprint === expected.documentFingerprint &&
  predicted.physicalPageNumber === expected.physicalPageNumber &&
  predicted.documentStart >= expected.documentStart &&
  predicted.documentEnd <= expected.documentEnd;
const ratio = (numerator, denominator) =>
  denominator > 0 ? numerator / denominator : null;
const countsBy = (values) =>
  Object.fromEntries(
    [...new Set(values)]
      .sort()
      .map((value) => [value, values.filter((item) => item === value).length])
  );

function calculateLfReferenceGoldOracleMetrics({
  oracle,
  predictions,
  documentArtifactsByUuid = null,
}) {
  validateLfReferenceGoldOracle(oracle, { documentArtifactsByUuid });
  const reasons = [];
  if (oracle.approval.status !== "APPROVED")
    reasons.push("ORACLE_NOT_APPROVED");
  if (
    oracle.summary.unreviewedRowCount ||
    oracle.summary.unreviewedComponentCount
  )
    reasons.push("ORACLE_LABELS_INCOMPLETE");
  if (reasons.length)
    return {
      status: "NOT_EVALUABLE",
      reasons,
      coverage: {
        rowCount: oracle.summary.rowCount,
        componentCount: oracle.summary.componentCount,
        unreviewedRowCount: oracle.summary.unreviewedRowCount,
        unreviewedComponentCount: oracle.summary.unreviewedComponentCount,
      },
      qualityMetrics: null,
    };
  validateLfReferenceGoldOracle(oracle, {
    documentArtifactsByUuid,
    requireApproved: true,
  });
  if (!Array.isArray(predictions?.rows))
    throw oracleError("LF_GOLD_ORACLE_PREDICTIONS_INVALID");
  const predictionByRow = new Map(
    predictions.rows.map((row) => [row.analysisRowId, row])
  );
  if (
    predictionByRow.size !== oracle.rows.length ||
    predictions.rows.length !== oracle.rows.length
  )
    throw oracleError("LF_GOLD_ORACLE_PREDICTION_PARTITION_INVALID");
  const bDocumentsByUuid = new Map(
    oracle.documents
      .filter(({ side }) => side === "B")
      .map((doc) => [doc.uuid, doc])
  );
  const artifactMap =
    documentArtifactsByUuid instanceof Map
      ? documentArtifactsByUuid
      : new Map(Object.entries(documentArtifactsByUuid));
  const counts = {
    exactRowCount: 0,
    exactComponentCount: 0,
    evidenceTruePositive: 0,
    evidenceFalsePositive: 0,
    evidenceFalseNegative: 0,
    evidenceTrueNegative: 0,
    selectedRangeCount: 0,
    selectedAcceptedRangeCount: 0,
    acceptedRangeCount: 0,
    recoveredAcceptedRangeCount: 0,
  };
  let effectCorrect = 0;
  let scopeCorrect = 0;
  let valueCorrect = 0;
  let comparableSemanticComponents = 0;
  const predictedRowTruths = [];
  const predictedComponentTruths = [];
  for (const goldRow of oracle.rows) {
    const predictedRow = predictionByRow.get(goldRow.analysisRowId);
    if (
      !predictedRow ||
      !ROW_TRUTHS.has(predictedRow.rowTruth) ||
      predictedRow.rowTruth === "UNREVIEWED" ||
      !Array.isArray(predictedRow.components)
    )
      throw oracleError("LF_GOLD_ORACLE_PREDICTION_ROW_INVALID");
    if (predictedRow.rowTruth === goldRow.rowTruth) counts.exactRowCount += 1;
    predictedRowTruths.push(predictedRow.rowTruth);
    const predictedByComponent = new Map(
      predictedRow.components.map((component) => [
        component.componentId,
        component,
      ])
    );
    if (
      predictedByComponent.size !== goldRow.components.length ||
      predictedRow.components.length !== goldRow.components.length
    )
      throw oracleError(
        "LF_GOLD_ORACLE_PREDICTION_COMPONENT_PARTITION_INVALID"
      );
    for (const goldComponent of goldRow.components) {
      const predicted = predictedByComponent.get(goldComponent.componentId);
      if (
        !predicted ||
        !COMPONENT_TRUTHS.has(predicted.truth) ||
        predicted.truth === "UNREVIEWED" ||
        !COVERAGE_EFFECTS.has(predicted.coverageEffect) ||
        !SCOPE_RELATIONS.has(predicted.scopeRelation) ||
        !Array.isArray(predicted.selectedSourceRanges) ||
        !Array.isArray(predicted.normalizedValues)
      )
        throw oracleError("LF_GOLD_ORACLE_PREDICTION_COMPONENT_INVALID");
      for (const range of predicted.selectedSourceRanges)
        validateEvidenceRange(range, bDocumentsByUuid, artifactMap);
      if (predicted.truth === goldComponent.truth)
        counts.exactComponentCount += 1;
      predictedComponentTruths.push(predicted.truth);
      const goldRelevant = EVIDENCE_COMPONENT_TRUTHS.has(goldComponent.truth);
      const predictedRelevant = EVIDENCE_COMPONENT_TRUTHS.has(predicted.truth);
      if (goldRelevant && predictedRelevant) counts.evidenceTruePositive += 1;
      else if (!goldRelevant && predictedRelevant)
        counts.evidenceFalsePositive += 1;
      else if (goldRelevant) counts.evidenceFalseNegative += 1;
      else counts.evidenceTrueNegative += 1;
      counts.selectedRangeCount += predicted.selectedSourceRanges.length;
      counts.selectedAcceptedRangeCount +=
        predicted.selectedSourceRanges.filter((selected) =>
          goldComponent.acceptedSourceRanges.some((expected) =>
            rangeMatches(selected, expected)
          )
        ).length;
      counts.acceptedRangeCount += goldComponent.acceptedSourceRanges.length;
      counts.recoveredAcceptedRangeCount +=
        goldComponent.acceptedSourceRanges.filter((expected) =>
          predicted.selectedSourceRanges.some((selected) =>
            rangeMatches(selected, expected)
          )
        ).length;
      if (goldRelevant) {
        comparableSemanticComponents += 1;
        if (predicted.coverageEffect === goldComponent.coverageEffect)
          effectCorrect += 1;
        if (predicted.scopeRelation === goldComponent.scopeRelation)
          scopeCorrect += 1;
        if (
          canonicalJson(predicted.normalizedValues) ===
          canonicalJson(goldComponent.normalizedValues)
        )
          valueCorrect += 1;
      }
    }
  }
  return {
    status: "EVALUATED",
    reasons: [],
    coverage: {
      rowCount: oracle.rows.length,
      componentCount: oracle.summary.componentCount,
      predictionRowCount: predictions.rows.length,
    },
    qualityMetrics: {
      truthCounts: {
        oracleRows: countsBy(oracle.rows.map(({ rowTruth }) => rowTruth)),
        predictedRows: countsBy(predictedRowTruths),
        oracleComponents: countsBy(
          oracle.rows.flatMap(({ components }) =>
            components.map(({ truth }) => truth)
          )
        ),
        predictedComponents: countsBy(predictedComponentTruths),
      },
      exactRowAccuracy: ratio(counts.exactRowCount, oracle.rows.length),
      exactComponentAccuracy: ratio(
        counts.exactComponentCount,
        oracle.summary.componentCount
      ),
      componentEvidenceRecall: ratio(
        counts.evidenceTruePositive,
        counts.evidenceTruePositive + counts.evidenceFalseNegative
      ),
      componentEvidencePrecision: ratio(
        counts.evidenceTruePositive,
        counts.evidenceTruePositive + counts.evidenceFalsePositive
      ),
      componentEvidenceFalsePositiveRate: ratio(
        counts.evidenceFalsePositive,
        counts.evidenceFalsePositive + counts.evidenceTrueNegative
      ),
      selectedEvidencePrecision: ratio(
        counts.selectedAcceptedRangeCount,
        counts.selectedRangeCount
      ),
      acceptedEvidenceRecall: ratio(
        counts.recoveredAcceptedRangeCount,
        counts.acceptedRangeCount
      ),
      coverageEffectAccuracy: ratio(
        effectCorrect,
        comparableSemanticComponents
      ),
      scopeRelationAccuracy: ratio(scopeCorrect, comparableSemanticComponents),
      normalizedValueAccuracy: ratio(
        valueCorrect,
        comparableSemanticComponents
      ),
      counts,
    },
  };
}

module.exports = {
  COMPONENT_TRUTHS,
  COVERAGE_EFFECTS,
  LF_REFERENCE_ABSENCE_COMPLETENESS_CONTRACT_ID,
  LF_REFERENCE_BENCHMARK_CANDIDATES_CONTRACT_ID,
  LF_REFERENCE_GOLD_ORACLE_CONTRACT_ID,
  LF_REFERENCE_GOLD_ORACLE_SCHEMA_VERSION,
  REQUIRED_ABSENCE_CHANNELS,
  ROW_TRUTHS,
  SCOPE_RELATIONS,
  buildLfReferenceGoldOracleSkeleton,
  calculateLfReferenceGoldOracleMetrics,
  canonicalJson,
  loadLfReferenceGoldOracleInputs,
  sha256,
  validateLfReferenceGoldOracle,
};

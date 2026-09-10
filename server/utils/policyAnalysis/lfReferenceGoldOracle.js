const crypto = require("crypto");

const LF_REFERENCE_GOLD_ORACLE_SCHEMA_VERSION = 1;
const LF_REFERENCE_GOLD_ORACLE_CONTRACT_ID = "LF_COUNTERPART_GOLD_ORACLE_V1";
const LF_REFERENCE_BENCHMARK_CANDIDATES_CONTRACT_ID =
  "LF_COUNTERPART_BENCHMARK_CANDIDATES_V1";

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
  return crypto.createHash("sha256").update(value).digest("hex");
}

function validSha256(value) {
  return /^[a-f0-9]{64}$/u.test(value || "");
}

function requiredString(value, code) {
  if (typeof value !== "string" || value.trim().length === 0)
    throw oracleError(code);
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
  const exactQuoteSha256 = source.exactQuoteSha256 || sha256(exactQuote);
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
    exactQuoteSha256,
  };
}

function normalizeBenchmarkCandidates(benchmark) {
  if (
    !benchmark ||
    benchmark.contractId !== LF_REFERENCE_BENCHMARK_CANDIDATES_CONTRACT_ID ||
    benchmark.schemaVersion !== 1 ||
    benchmark.artifactKind !== "LF_COUNTERPART_BENCHMARK_CANDIDATES" ||
    benchmark.status !== "SEARCH_COMPLETE_REVIEW_REQUIRED" ||
    benchmark.shadowOnly !== true ||
    benchmark.primaryMutationAllowed !== false ||
    benchmark.qwenExecuted !== false ||
    benchmark.candidateKind !== "NAVIGATION_EXACT_ORIGINAL_SPAN"
  )
    throw oracleError("LF_GOLD_ORACLE_BENCHMARK_CONTRACT_INVALID");
  const candidates = benchmark.candidates;
  if (!Array.isArray(candidates))
    throw oracleError("LF_GOLD_ORACLE_BENCHMARK_CANDIDATES_INVALID");
  const candidateIds = new Set();
  return candidates.map((candidate) => {
    const candidateId = requiredString(
      candidate.candidateId || candidate.id,
      "LF_GOLD_ORACLE_BENCHMARK_CANDIDATE_ID_REQUIRED"
    );
    if (candidateIds.has(candidateId))
      throw oracleError(
        "LF_GOLD_ORACLE_BENCHMARK_CANDIDATE_DUPLICATE",
        candidateId
      );
    candidateIds.add(candidateId);
    if (
      candidate.candidateKind !== "NAVIGATION_EXACT_ORIGINAL_SPAN" ||
      candidate.navigationOnly !== true ||
      candidate.semanticDecision !== null ||
      !Number.isInteger(candidate.rank) ||
      candidate.rank < 1 ||
      (candidate.score !== null && !Number.isFinite(candidate.score))
    )
      throw oracleError(
        "LF_GOLD_ORACLE_BENCHMARK_CANDIDATE_CONTRACT_INVALID",
        candidateId
      );
    const analysisRowId = requiredString(
      candidate.analysisRowId || candidate.caseId,
      "LF_GOLD_ORACLE_BENCHMARK_ROW_REQUIRED"
    );
    const requirementId = requiredString(
      candidate.requirementId || candidate.publicRowId,
      "LF_GOLD_ORACLE_BENCHMARK_REQUIREMENT_REQUIRED"
    );
    const componentId =
      candidate.componentId === null || candidate.componentId === undefined
        ? null
        : requiredString(
            candidate.componentId,
            "LF_GOLD_ORACLE_BENCHMARK_COMPONENT_INVALID"
          );
    const rawChannels = Array.isArray(candidate.channels)
      ? candidate.channels
      : Array.isArray(candidate.channelTraces)
        ? candidate.channelTraces.map(({ channel }) => channel)
        : [
            candidate.channel ||
              candidate.trace?.channel ||
              candidate.discoveryMethod ||
              "UNSPECIFIED",
          ];
    const channels = [
      ...new Set(
        rawChannels.map((channel) =>
          requiredString(channel, "LF_GOLD_ORACLE_BENCHMARK_CHANNEL_REQUIRED")
        )
      ),
    ].sort();
    const range = normalizeCandidateRange(candidate);
    if (!range)
      throw oracleError(
        "LF_GOLD_ORACLE_BENCHMARK_CANDIDATE_RANGE_REQUIRED",
        candidateId
      );
    return {
      candidateId,
      analysisRowId,
      requirementId,
      componentId,
      channels,
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

function unreviewedReview() {
  return {
    status: "UNREVIEWED",
    reviewerIds: [],
    adjudicatorId: null,
    reviewedAt: null,
    note: null,
  };
}

function unreviewedComponent(component, candidates) {
  return {
    componentId: component.id,
    label: component.label,
    factRole: component.factRole,
    componentContractSha256: sha256(canonicalJson(component)),
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
  sourceCommit,
  result,
  resultSha256,
  semanticManifest,
  semanticManifestSha256,
  benchmark,
  benchmarkSha256,
  createdAt = new Date().toISOString(),
}) {
  requiredString(oracleId, "LF_GOLD_ORACLE_ID_REQUIRED");
  if (!/^[a-f0-9]{40}$/u.test(sourceCommit || ""))
    throw oracleError("LF_GOLD_ORACLE_SOURCE_COMMIT_INVALID");
  for (const [label, value] of Object.entries({
    resultSha256,
    semanticManifestSha256,
    benchmarkSha256,
  }))
    if (!validSha256(value))
      throw oracleError(`LF_GOLD_ORACLE_${label.toUpperCase()}_INVALID`);
  if (
    result?.comparisonMode !== "LF_IMMO_REFERENCE_A_TO_B_V1" ||
    result?.contractId !== "LF_DYNAMIC_REFERENCE_A_TO_B_RESULT_V1" ||
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
    result?.template?.semanticRequirementManifestSha256 !==
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
        requirement.components.length === 0
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
      sourceCommit,
      sessionUuid: result.sessionUuid,
      runSignature: result.runSignature,
      resultSha256,
      semanticManifestSha256,
      semanticManifestContractSha256: semanticManifest.manifestSha256,
      semanticOracleId: semanticManifest.semanticOracleId,
      benchmarkSha256,
    },
    documents: result.documents.map(
      ({
        uuid,
        side,
        role,
        documentStatus,
        originalName,
        sha256: fingerprint,
      }) => ({
        uuid,
        side,
        role,
        documentStatus,
        originalName,
        fingerprint,
      })
    ),
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
  return validateLfReferenceGoldOracle(oracle);
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

function validateEvidenceRange(
  range,
  bDocumentsByFingerprint,
  documentArtifacts
) {
  if (
    !range ||
    typeof range.documentUuid !== "string" ||
    !range.documentUuid ||
    bDocumentsByFingerprint.get(range.documentFingerprint)?.uuid !==
      range.documentUuid ||
    !Number.isInteger(range.physicalPageNumber) ||
    range.physicalPageNumber < 1 ||
    !Number.isInteger(range.documentStart) ||
    range.documentStart < 0 ||
    !Number.isInteger(range.documentEnd) ||
    range.documentEnd <= range.documentStart ||
    typeof range.exactQuote !== "string" ||
    range.exactQuote.length === 0 ||
    !validSha256(range.exactQuoteSha256) ||
    sha256(range.exactQuote) !== range.exactQuoteSha256
  )
    throw oracleError("LF_GOLD_ORACLE_EVIDENCE_RANGE_INVALID");
  if (!documentArtifacts) return;
  const artifact =
    documentArtifacts instanceof Map
      ? documentArtifacts.get(range.documentFingerprint)
      : documentArtifacts[range.documentFingerprint];
  const document = artifact?.document || artifact;
  const page = document?.pageMap?.find(
    ({ pageNumber }) => pageNumber === range.physicalPageNumber
  );
  if (
    !document ||
    typeof document.pageContent !== "string" ||
    !page ||
    range.documentStart < page.start ||
    range.documentEnd > page.end ||
    document.pageContent.slice(range.documentStart, range.documentEnd) !==
      range.exactQuote
  )
    throw oracleError("LF_GOLD_ORACLE_EVIDENCE_SOURCE_MISMATCH");
}

function validateAbsenceCertification(certification, bFingerprints) {
  if (
    !certification ||
    certification.status !== "CERTIFIED_ABSENT" ||
    typeof certification.protocolId !== "string" ||
    !certification.protocolId ||
    typeof certification.completedAt !== "string" ||
    !certification.completedAt ||
    !Array.isArray(certification.reviewerIds) ||
    new Set(certification.reviewerIds).size !==
      certification.reviewerIds.length ||
    certification.reviewerIds.length < 2 ||
    !Array.isArray(certification.reviewedDocumentFingerprints) ||
    new Set(certification.reviewedDocumentFingerprints).size !==
      certification.reviewedDocumentFingerprints.length ||
    certification.reviewedDocumentFingerprints.length !== bFingerprints.size ||
    certification.reviewedDocumentFingerprints.some(
      (fingerprint) => !bFingerprints.has(fingerprint)
    )
  )
    throw oracleError("LF_GOLD_ORACLE_ABSENCE_CERTIFICATION_INVALID");
}

function validateLfReferenceGoldOracle(
  oracle,
  { documentArtifactsByFingerprint = null, requireApproved = false } = {}
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
  if (
    !/^[a-f0-9]{40}$/u.test(oracle.bindings?.sourceCommit || "") ||
    !validSha256(oracle.bindings?.runSignature) ||
    !validSha256(oracle.bindings?.resultSha256) ||
    !validSha256(oracle.bindings?.semanticManifestSha256) ||
    !validSha256(oracle.bindings?.semanticManifestContractSha256) ||
    !validSha256(oracle.bindings?.benchmarkSha256) ||
    typeof oracle.bindings?.sessionUuid !== "string" ||
    !oracle.bindings.sessionUuid ||
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
  const fingerprints = new Set();
  const bFingerprints = new Set();
  const bDocumentsByFingerprint = new Map();
  for (const document of oracle.documents) {
    if (
      documentIds.has(document.uuid) ||
      fingerprints.has(document.fingerprint) ||
      !validSha256(document.fingerprint) ||
      !new Set(["A", "B"]).has(document.side)
    )
      throw oracleError("LF_GOLD_ORACLE_DOCUMENTS_INVALID");
    documentIds.add(document.uuid);
    fingerprints.add(document.fingerprint);
    if (document.side === "B") {
      bFingerprints.add(document.fingerprint);
      bDocumentsByFingerprint.set(document.fingerprint, document);
    }
  }
  if (
    oracle.documents.filter(({ side }) => side === "A").length !== 1 ||
    bFingerprints.size < 1
  )
    throw oracleError("LF_GOLD_ORACLE_DOCUMENTS_INVALID");

  const candidateIds = new Set();
  const candidateById = new Map();
  for (const candidate of oracle.benchmarkCandidates) {
    if (
      candidateIds.has(candidate.candidateId) ||
      typeof candidate.analysisRowId !== "string" ||
      typeof candidate.requirementId !== "string" ||
      !Array.isArray(candidate.channels) ||
      candidate.channels.length === 0 ||
      candidate.channels.some(
        (channel) => typeof channel !== "string" || !channel
      )
    )
      throw oracleError("LF_GOLD_ORACLE_BENCHMARK_CANDIDATES_INVALID");
    candidateIds.add(candidate.candidateId);
    candidateById.set(candidate.candidateId, candidate);
    if (candidate.range)
      validateEvidenceRange(
        candidate.range,
        bDocumentsByFingerprint,
        documentArtifactsByFingerprint
      );
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
  for (const row of oracle.rows) {
    if (
      !REFERENCE_VALIDITIES.has(row.referenceValidity) ||
      !ROW_TRUTHS.has(row.rowTruth) ||
      !Array.isArray(row.components) ||
      row.components.length === 0 ||
      new Set(row.components.map(({ componentId }) => componentId)).size !==
        row.components.length ||
      row.benchmarkCandidateIds.some(
        (candidateId) =>
          !candidateIds.has(candidateId) ||
          candidateById.get(candidateId).analysisRowId !== row.analysisRowId
      )
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
        validateEvidenceRange(
          range,
          bDocumentsByFingerprint,
          documentArtifactsByFingerprint
        );
      if (
        EVIDENCE_COMPONENT_TRUTHS.has(component.truth) &&
        component.acceptedSourceRanges.length === 0
      )
        throw oracleError("LF_GOLD_ORACLE_COMPONENT_EVIDENCE_REQUIRED");
      if (
        component.truth === "RELATED_ONLY" &&
        component.knownAdversarialSourceRanges.length === 0
      )
        throw oracleError("LF_GOLD_ORACLE_COMPONENT_ADVERSARIAL_REQUIRED");
      if (component.truth === "ABSENT_CERTIFIED")
        validateAbsenceCertification(
          component.absenceCertification,
          bFingerprints
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
      const rowTruthConsistent =
        (row.referenceValidity === "INDETERMINATE" &&
          row.rowTruth === "INDETERMINATE") ||
        (row.referenceValidity === "VALID" &&
          ((row.rowTruth === "FULL_COUNTERPART" &&
            truths.every((truth) =>
              new Set(["DIRECT_SUPPORT", "NARROWER_SUPPORT"]).has(truth)
            )) ||
            (row.rowTruth === "PARTIAL_COUNTERPART" &&
              hasSupport &&
              !truths.every((truth) =>
                new Set(["DIRECT_SUPPORT", "NARROWER_SUPPORT"]).has(truth)
              ) &&
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

function rangeMatches(predicted, expected) {
  return (
    predicted.documentFingerprint === expected.documentFingerprint &&
    predicted.physicalPageNumber === expected.physicalPageNumber &&
    predicted.documentStart >= expected.documentStart &&
    predicted.documentEnd <= expected.documentEnd
  );
}

function ratio(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : null;
}

function countsBy(values) {
  return Object.fromEntries(
    [...new Set(values)]
      .sort()
      .map((value) => [value, values.filter((item) => item === value).length])
  );
}

function calculateLfReferenceGoldOracleMetrics({ oracle, predictions }) {
  validateLfReferenceGoldOracle(oracle);
  const incompleteReasons = [];
  if (oracle.approval.status !== "APPROVED")
    incompleteReasons.push("ORACLE_NOT_APPROVED");
  if (
    oracle.summary.unreviewedRowCount !== 0 ||
    oracle.summary.unreviewedComponentCount !== 0
  )
    incompleteReasons.push("ORACLE_LABELS_INCOMPLETE");
  if (incompleteReasons.length)
    return {
      status: "NOT_EVALUABLE",
      reasons: incompleteReasons,
      coverage: {
        rowCount: oracle.summary.rowCount,
        componentCount: oracle.summary.componentCount,
        unreviewedRowCount: oracle.summary.unreviewedRowCount,
        unreviewedComponentCount: oracle.summary.unreviewedComponentCount,
      },
      qualityMetrics: null,
    };

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

  let exactRowCount = 0;
  let exactComponentCount = 0;
  let evidenceTruePositive = 0;
  let evidenceFalsePositive = 0;
  let evidenceFalseNegative = 0;
  let evidenceTrueNegative = 0;
  let selectedRangeCount = 0;
  let selectedAcceptedRangeCount = 0;
  let acceptedRangeCount = 0;
  let recoveredAcceptedRangeCount = 0;
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
    if (predictedRow.rowTruth === goldRow.rowTruth) exactRowCount += 1;
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
        !Array.isArray(predicted.selectedSourceRanges) ||
        !Array.isArray(predicted.normalizedValues)
      )
        throw oracleError("LF_GOLD_ORACLE_PREDICTION_COMPONENT_INVALID");
      if (predicted.truth === goldComponent.truth) exactComponentCount += 1;
      predictedComponentTruths.push(predicted.truth);
      const goldRelevant = EVIDENCE_COMPONENT_TRUTHS.has(goldComponent.truth);
      const predictedRelevant = EVIDENCE_COMPONENT_TRUTHS.has(predicted.truth);
      if (goldRelevant && predictedRelevant) evidenceTruePositive += 1;
      else if (!goldRelevant && predictedRelevant) evidenceFalsePositive += 1;
      else if (goldRelevant && !predictedRelevant) evidenceFalseNegative += 1;
      else evidenceTrueNegative += 1;

      selectedRangeCount += predicted.selectedSourceRanges.length;
      selectedAcceptedRangeCount += predicted.selectedSourceRanges.filter(
        (selected) =>
          goldComponent.acceptedSourceRanges.some((expected) =>
            rangeMatches(selected, expected)
          )
      ).length;
      acceptedRangeCount += goldComponent.acceptedSourceRanges.length;
      recoveredAcceptedRangeCount += goldComponent.acceptedSourceRanges.filter(
        (expected) =>
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
      exactRowAccuracy: ratio(exactRowCount, oracle.rows.length),
      exactComponentAccuracy: ratio(
        exactComponentCount,
        oracle.summary.componentCount
      ),
      componentEvidenceRecall: ratio(
        evidenceTruePositive,
        evidenceTruePositive + evidenceFalseNegative
      ),
      componentEvidencePrecision: ratio(
        evidenceTruePositive,
        evidenceTruePositive + evidenceFalsePositive
      ),
      componentEvidenceFalsePositiveRate: ratio(
        evidenceFalsePositive,
        evidenceFalsePositive + evidenceTrueNegative
      ),
      selectedEvidencePrecision: ratio(
        selectedAcceptedRangeCount,
        selectedRangeCount
      ),
      acceptedEvidenceRecall: ratio(
        recoveredAcceptedRangeCount,
        acceptedRangeCount
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
      counts: {
        exactRowCount,
        exactComponentCount,
        evidenceTruePositive,
        evidenceFalsePositive,
        evidenceFalseNegative,
        evidenceTrueNegative,
        selectedRangeCount,
        selectedAcceptedRangeCount,
        acceptedRangeCount,
        recoveredAcceptedRangeCount,
      },
    },
  };
}

module.exports = {
  COMPONENT_TRUTHS,
  COVERAGE_EFFECTS,
  LF_REFERENCE_BENCHMARK_CANDIDATES_CONTRACT_ID,
  LF_REFERENCE_GOLD_ORACLE_CONTRACT_ID,
  LF_REFERENCE_GOLD_ORACLE_SCHEMA_VERSION,
  ROW_TRUTHS,
  SCOPE_RELATIONS,
  buildLfReferenceGoldOracleSkeleton,
  calculateLfReferenceGoldOracleMetrics,
  canonicalJson,
  sha256,
  validateLfReferenceGoldOracle,
};

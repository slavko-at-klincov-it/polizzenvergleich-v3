const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const HYBRID_SHADOW_CONTRACT_SCHEMA_VERSION = 1;
const HYBRID_SHADOW_ARTIFACT_SCHEMA_VERSION = 1;
const HYBRID_SHADOW_MODE = "SHADOW_ONLY";

function shadowError(code, detail = "") {
  const error = new Error(detail ? `${code}: ${detail}` : code);
  error.code = code;
  return error;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function exactKeys(value, expectedKeys, code) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw shadowError(code);
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  )
    throw shadowError(code, actual.join(","));
}

function requiredString(value, code) {
  if (typeof value !== "string" || value.trim().length === 0)
    throw shadowError(code);
  return value.trim();
}

function requiredInteger(value, minimum, maximum, code) {
  if (!Number.isInteger(value) || value < minimum || value > maximum)
    throw shadowError(code, String(value));
  return value;
}

function validateBaseUrl(value) {
  const text = requiredString(value, "HYBRID_SHADOW_BASE_URL_REQUIRED");
  let parsed;
  try {
    parsed = new URL(text);
  } catch {
    throw shadowError("HYBRID_SHADOW_BASE_URL_INVALID", text);
  }
  const loopback = new Set(["127.0.0.1", "localhost", "::1"]).has(
    parsed.hostname
  );
  if (
    parsed.protocol !== "https:" &&
    !(parsed.protocol === "http:" && loopback)
  )
    throw shadowError("HYBRID_SHADOW_BASE_URL_INSECURE", text);
  if (parsed.username || parsed.password || parsed.search || parsed.hash)
    throw shadowError("HYBRID_SHADOW_BASE_URL_CREDENTIALS_FORBIDDEN");
  return text.replace(/\/+$/u, "");
}

function validateHybridShadowContract(rawContract) {
  exactKeys(
    rawContract,
    [
      "schemaVersion",
      "contractId",
      "enabled",
      "mode",
      "failurePolicy",
      "provider",
      "retrieval",
    ],
    "HYBRID_SHADOW_CONTRACT_KEYS_INVALID"
  );
  if (rawContract.schemaVersion !== HYBRID_SHADOW_CONTRACT_SCHEMA_VERSION)
    throw shadowError(
      "HYBRID_SHADOW_CONTRACT_SCHEMA_INVALID",
      String(rawContract.schemaVersion)
    );
  if (typeof rawContract.enabled !== "boolean")
    throw shadowError("HYBRID_SHADOW_ENABLED_INVALID");
  if (rawContract.mode !== HYBRID_SHADOW_MODE)
    throw shadowError("HYBRID_SHADOW_MODE_INVALID", String(rawContract.mode));
  if (rawContract.failurePolicy !== "FAIL_SHADOW_RUN")
    throw shadowError(
      "HYBRID_SHADOW_FAILURE_POLICY_INVALID",
      String(rawContract.failurePolicy)
    );

  exactKeys(
    rawContract.provider,
    [
      "kind",
      "baseUrl",
      "model",
      "dimensions",
      "apiKeyEnv",
      "requestTimeoutMs",
      "modelArtifactPath",
      "modelArtifactSha256",
      "runtimeRevision",
      "runtimeArtifactPath",
      "runtimeArtifactSha256",
      "inputNormalization",
    ],
    "HYBRID_SHADOW_PROVIDER_KEYS_INVALID"
  );
  if (rawContract.provider.kind !== "OPENAI_COMPATIBLE_EMBEDDINGS")
    throw shadowError(
      "HYBRID_SHADOW_PROVIDER_KIND_INVALID",
      String(rawContract.provider.kind)
    );
  if (
    rawContract.provider.apiKeyEnv !== null &&
    !/^[A-Z][A-Z0-9_]*$/u.test(rawContract.provider.apiKeyEnv || "")
  )
    throw shadowError("HYBRID_SHADOW_API_KEY_ENV_INVALID");
  if (!/^[a-f0-9]{64}$/u.test(rawContract.provider.modelArtifactSha256 || ""))
    throw shadowError("HYBRID_SHADOW_MODEL_ARTIFACT_SHA256_INVALID");
  if (!path.isAbsolute(rawContract.provider.modelArtifactPath || ""))
    throw shadowError("HYBRID_SHADOW_MODEL_ARTIFACT_PATH_INVALID");
  if (!path.isAbsolute(rawContract.provider.runtimeArtifactPath || ""))
    throw shadowError("HYBRID_SHADOW_RUNTIME_ARTIFACT_PATH_INVALID");
  if (!/^[a-f0-9]{64}$/u.test(rawContract.provider.runtimeArtifactSha256 || ""))
    throw shadowError("HYBRID_SHADOW_RUNTIME_ARTIFACT_SHA256_INVALID");
  if (
    !new Set(["NONE_V1", "NFKC_WHITESPACE_V1"]).has(
      rawContract.provider.inputNormalization
    )
  )
    throw shadowError("HYBRID_SHADOW_INPUT_NORMALIZATION_INVALID");

  exactKeys(
    rawContract.retrieval,
    ["chunkSize", "chunkOverlap", "topK", "batchSize", "minimumScore"],
    "HYBRID_SHADOW_RETRIEVAL_KEYS_INVALID"
  );
  const chunkSize = requiredInteger(
    rawContract.retrieval.chunkSize,
    500,
    6000,
    "HYBRID_SHADOW_CHUNK_SIZE_INVALID"
  );
  const chunkOverlap = requiredInteger(
    rawContract.retrieval.chunkOverlap,
    0,
    1000,
    "HYBRID_SHADOW_CHUNK_OVERLAP_INVALID"
  );
  if (chunkOverlap >= chunkSize)
    throw shadowError("HYBRID_SHADOW_CHUNK_OVERLAP_INVALID");
  if (
    !Number.isFinite(rawContract.retrieval.minimumScore) ||
    rawContract.retrieval.minimumScore < -1 ||
    rawContract.retrieval.minimumScore > 1
  )
    throw shadowError("HYBRID_SHADOW_MINIMUM_SCORE_INVALID");

  return {
    schemaVersion: HYBRID_SHADOW_CONTRACT_SCHEMA_VERSION,
    contractId: requiredString(
      rawContract.contractId,
      "HYBRID_SHADOW_CONTRACT_ID_REQUIRED"
    ),
    enabled: rawContract.enabled,
    mode: HYBRID_SHADOW_MODE,
    failurePolicy: "FAIL_SHADOW_RUN",
    provider: {
      kind: "OPENAI_COMPATIBLE_EMBEDDINGS",
      baseUrl: validateBaseUrl(rawContract.provider.baseUrl),
      model: requiredString(
        rawContract.provider.model,
        "HYBRID_SHADOW_MODEL_REQUIRED"
      ),
      dimensions: requiredInteger(
        rawContract.provider.dimensions,
        1,
        65536,
        "HYBRID_SHADOW_DIMENSIONS_INVALID"
      ),
      apiKeyEnv: rawContract.provider.apiKeyEnv,
      requestTimeoutMs: requiredInteger(
        rawContract.provider.requestTimeoutMs,
        1000,
        120000,
        "HYBRID_SHADOW_TIMEOUT_INVALID"
      ),
      modelArtifactPath: rawContract.provider.modelArtifactPath,
      modelArtifactSha256: rawContract.provider.modelArtifactSha256,
      runtimeRevision: requiredString(
        rawContract.provider.runtimeRevision,
        "HYBRID_SHADOW_RUNTIME_REVISION_REQUIRED"
      ),
      runtimeArtifactPath: rawContract.provider.runtimeArtifactPath,
      runtimeArtifactSha256: rawContract.provider.runtimeArtifactSha256,
      inputNormalization: rawContract.provider.inputNormalization,
    },
    retrieval: {
      chunkSize,
      chunkOverlap,
      topK: requiredInteger(
        rawContract.retrieval.topK,
        1,
        3,
        "HYBRID_SHADOW_TOP_K_INVALID"
      ),
      batchSize: requiredInteger(
        rawContract.retrieval.batchSize,
        1,
        128,
        "HYBRID_SHADOW_BATCH_SIZE_INVALID"
      ),
      minimumScore: rawContract.retrieval.minimumScore,
    },
  };
}

/**
 * The absence of a contract path is the only implicit state: disabled. An
 * endpoint or model is never inferred from process environment variables.
 */
function loadHybridShadowContract(contractFile = null) {
  if (!contractFile)
    return {
      contract: null,
      identity: {
        schemaVersion: HYBRID_SHADOW_CONTRACT_SCHEMA_VERSION,
        contractId: "hybrid-shadow-disabled-v1",
        enabled: false,
        mode: HYBRID_SHADOW_MODE,
        contractSha256: null,
        provider: null,
        retrieval: null,
      },
    };
  if (!path.isAbsolute(contractFile))
    throw shadowError("HYBRID_SHADOW_CONTRACT_PATH_NOT_ABSOLUTE", contractFile);
  if (!fs.existsSync(contractFile))
    throw shadowError("HYBRID_SHADOW_CONTRACT_FILE_MISSING", contractFile);
  const bytes = fs.readFileSync(contractFile);
  let rawContract;
  try {
    rawContract = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw shadowError("HYBRID_SHADOW_CONTRACT_JSON_INVALID", error.message);
  }
  const contract = validateHybridShadowContract(rawContract);
  return {
    contract,
    identity: {
      schemaVersion: contract.schemaVersion,
      contractId: contract.contractId,
      enabled: contract.enabled,
      mode: contract.mode,
      contractSha256: sha256(bytes),
      provider: {
        kind: contract.provider.kind,
        baseUrl: contract.provider.baseUrl,
        model: contract.provider.model,
        dimensions: contract.provider.dimensions,
        modelArtifactPath: contract.provider.modelArtifactPath,
        modelArtifactSha256: contract.provider.modelArtifactSha256,
        runtimeRevision: contract.provider.runtimeRevision,
        runtimeArtifactPath: contract.provider.runtimeArtifactPath,
        runtimeArtifactSha256: contract.provider.runtimeArtifactSha256,
        inputNormalization: contract.provider.inputNormalization,
      },
      retrieval: contract.retrieval,
    },
  };
}

function zeroPrimaryComponents(worksheet) {
  if (
    worksheet?.candidateOnly !== true ||
    !Array.isArray(worksheet.requirements)
  )
    throw shadowError("HYBRID_SHADOW_WORKSHEET_INVALID");
  const eligible = [];
  for (const requirement of worksheet.requirements) {
    if (!Array.isArray(requirement.components))
      throw shadowError("HYBRID_SHADOW_WORKSHEET_INVALID", requirement.id);
    for (const component of requirement.components) {
      const occurrences = component.occurrences;
      if (!Array.isArray(occurrences))
        throw shadowError(
          "HYBRID_SHADOW_COMPONENT_OCCURRENCES_INVALID",
          `${requirement.id}:${component.id}`
        );
      const count = component.occurrenceCount;
      if (!Number.isInteger(count) || count < 0)
        throw shadowError(
          "HYBRID_SHADOW_PRIMARY_COUNT_INVALID",
          `${requirement.id}:${component.id}`
        );
      if (count !== occurrences.length)
        throw shadowError(
          "HYBRID_SHADOW_PRIMARY_COUNT_MISMATCH",
          `${requirement.id}:${component.id}`
        );
      if (count === 0 && component.terminalState !== "NO_CONTROLLED_CANDIDATE")
        throw shadowError(
          "HYBRID_SHADOW_PRIMARY_TERMINAL_STATE_INVALID",
          `${requirement.id}:${component.id}`
        );
      if (
        count > 0 &&
        component.terminalState !== "CONTROLLED_CANDIDATES_FOUND"
      )
        throw shadowError(
          "HYBRID_SHADOW_PRIMARY_TERMINAL_STATE_INVALID",
          `${requirement.id}:${component.id}`
        );
      if (count === 0) eligible.push({ requirement, component });
    }
  }
  return eligible;
}

function allowedZeroPrimaryComponents({ worksheet, allowedTargets }) {
  const eligible = zeroPrimaryComponents(worksheet);
  if (allowedTargets === null || allowedTargets === undefined) return eligible;
  if (!Array.isArray(allowedTargets))
    throw shadowError("HYBRID_SHADOW_ALLOWED_TARGETS_INVALID");
  const eligibleByKey = new Map(
    eligible.map(({ requirement, component }) => [
      `${requirement.id}:${component.id}`,
      { requirement, component },
    ])
  );
  const seen = new Set();
  return allowedTargets.map((allowedTarget) => {
    const requirementId = requiredString(
      allowedTarget?.requirementId,
      "HYBRID_SHADOW_ALLOWED_REQUIREMENT_REQUIRED"
    );
    const componentId = requiredString(
      allowedTarget?.componentId,
      "HYBRID_SHADOW_ALLOWED_COMPONENT_REQUIRED"
    );
    const key = `${requirementId}:${componentId}`;
    if (seen.has(key))
      throw shadowError("HYBRID_SHADOW_ALLOWED_TARGET_DUPLICATE", key);
    seen.add(key);
    const eligibleTarget = eligibleByKey.get(key);
    if (!eligibleTarget)
      throw shadowError("HYBRID_SHADOW_ALLOWED_TARGET_NOT_PRIMARY_NULL", key);
    return { ...eligibleTarget, pilotCase: allowedTarget };
  });
}

function buildHybridShadowTargets({ worksheet, contract, allowedTargets }) {
  if (!contract?.enabled)
    throw shadowError("HYBRID_SHADOW_CONTRACT_NOT_ENABLED");
  return allowedZeroPrimaryComponents({ worksheet, allowedTargets }).map(
    ({ requirement, component, pilotCase }) => {
      const aliases = Array.isArray(component.aliases) ? component.aliases : [];
      const concepts = (component.conceptSearches || []).flatMap((search) => [
        search.label,
        ...(search.requiredGroups || []).flatMap(
          ({ prefixes }) => prefixes || []
        ),
      ]);
      const terms = [
        ...new Set([
          requirement.label,
          component.label,
          ...aliases,
          ...concepts,
        ]),
      ]
        .filter((value) => typeof value === "string" && value.trim())
        .map((value) => value.trim());
      return {
        id: `hybrid-shadow-target:${requirement.id}:${component.id}`,
        requirementId: requirement.id,
        componentId: component.id,
        pilotCaseId: pilotCase?.caseId || null,
        query: terms.join("; ").slice(0, 4000),
        semanticContract:
          `Nur explizite Vertragsaussagen zu ${requirement.label} / ${component.label}. ` +
          "Rolle, versichertes Objekt, Sparte, Geltungsbereich, Bedingung und Begrenzung müssen aus dem exakten Quelltext geprüft werden. Ähnliche Begriffe allein genügen nicht.",
        topK: contract.retrieval.topK,
      };
    }
  );
}

function verifyRankedChunk({ document, chunk }) {
  if (
    !Number.isInteger(chunk.pageNumber) ||
    !Number.isInteger(chunk.physicalPageNumber) ||
    !Number.isInteger(chunk.pageStart) ||
    !Number.isInteger(chunk.pageEnd) ||
    !Number.isInteger(chunk.documentStart) ||
    !Number.isInteger(chunk.documentEnd) ||
    typeof chunk.text !== "string" ||
    chunk.text.length === 0
  )
    throw shadowError("HYBRID_SHADOW_CHUNK_LOCATION_INVALID", chunk.id);
  const page = document?.pageMap?.find(
    (candidate) => candidate.pageNumber === chunk.pageNumber
  );
  if (
    !page ||
    chunk.physicalPageNumber !== chunk.pageNumber ||
    chunk.pageStart < 0 ||
    chunk.pageEnd <= chunk.pageStart ||
    page.start + chunk.pageStart !== chunk.documentStart ||
    page.start + chunk.pageEnd !== chunk.documentEnd ||
    chunk.documentStart < page.start ||
    chunk.documentEnd > page.end ||
    document.pageContent.slice(chunk.documentStart, chunk.documentEnd) !==
      chunk.text
  )
    throw shadowError("HYBRID_SHADOW_EXACT_SOURCE_MISMATCH", chunk.id);
  if (!Number.isFinite(chunk.score) || chunk.score < -1 || chunk.score > 1)
    throw shadowError("HYBRID_SHADOW_SCORE_INVALID", chunk.id);
  return page;
}

function exactSourceSpansFromNavigationChunk({
  document,
  navigationChunk,
  maximumCharacters = 1200,
}) {
  if (!Number.isInteger(maximumCharacters) || maximumCharacters < 200)
    throw shadowError("HYBRID_SHADOW_EXACT_SPAN_LIMIT_INVALID");
  verifyRankedChunk({ document, chunk: navigationChunk });
  const source = navigationChunk.text;
  const rawRanges = [];
  for (const match of source.matchAll(/[^\r\n]+/gu)) {
    let start = match.index;
    let end = start + match[0].length;
    while (start < end && /\s/u.test(source[start])) start += 1;
    while (end > start && /\s/u.test(source[end - 1])) end -= 1;
    if (end > start) rawRanges.push({ start, end });
  }
  const splitRanges = [];
  for (const range of rawRanges) {
    let cursor = range.start;
    while (cursor < range.end) {
      let end = Math.min(range.end, cursor + maximumCharacters);
      if (end < range.end) {
        const window = source.slice(cursor, end);
        const preferred = Math.max(
          window.lastIndexOf(". "),
          window.lastIndexOf("; "),
          window.lastIndexOf(": "),
          window.lastIndexOf(" ")
        );
        if (preferred >= Math.floor(maximumCharacters * 0.6))
          end = cursor + preferred + 1;
      }
      while (end > cursor && /\s/u.test(source[end - 1])) end -= 1;
      if (end > cursor) splitRanges.push({ start: cursor, end });
      cursor = end;
      while (cursor < range.end && /\s/u.test(source[cursor])) cursor += 1;
    }
  }
  return splitRanges.map(({ start, end }) => {
    const pageStart = navigationChunk.pageStart + start;
    const pageEnd = navigationChunk.pageStart + end;
    const documentStart = navigationChunk.documentStart + start;
    const documentEnd = navigationChunk.documentStart + end;
    const text = document.pageContent.slice(documentStart, documentEnd);
    if (text !== source.slice(start, end))
      throw shadowError(
        "HYBRID_SHADOW_EXACT_SOURCE_MISMATCH",
        navigationChunk.id
      );
    return {
      id: `hybrid-exact-span:${sha256(
        [
          document.sourceDocumentId || document.id,
          navigationChunk.pageNumber,
          documentStart,
          documentEnd,
        ].join(":")
      )}`,
      navigationChunkId: navigationChunk.id,
      navigationScore: navigationChunk.score,
      pageNumber: navigationChunk.pageNumber,
      physicalPageNumber: navigationChunk.physicalPageNumber,
      pageStart,
      pageEnd,
      documentStart,
      documentEnd,
      text,
    };
  });
}

function buildHybridShadowWorksheet({
  primaryWorksheet,
  document,
  rankedTargets,
  contractIdentity,
  primaryWorksheetSha256,
  documentArtifactSha256,
  allowedTargets,
  pilotIdentity = null,
}) {
  if (
    !/^[a-f0-9]{64}$/u.test(primaryWorksheetSha256 || "") ||
    !/^[a-f0-9]{64}$/u.test(documentArtifactSha256 || "")
  )
    throw shadowError("HYBRID_SHADOW_INPUT_SHA256_INVALID");
  const eligibleByKey = new Map(
    allowedZeroPrimaryComponents({
      worksheet: primaryWorksheet,
      allowedTargets,
    }).map(
      ({ requirement, component }) => [
        `${requirement.id}:${component.id}`,
        { requirement, component },
      ]
    )
  );
  const rankingByKey = new Map();
  for (const ranking of rankedTargets) {
    const key = `${ranking.requirementId}:${ranking.componentId}`;
    if (!eligibleByKey.has(key) || rankingByKey.has(key))
      throw shadowError("HYBRID_SHADOW_RANKING_TARGET_INVALID", key);
    rankingByKey.set(key, ranking);
  }
  if (rankingByKey.size !== eligibleByKey.size)
    throw shadowError("HYBRID_SHADOW_RANKING_TARGET_COUNT_MISMATCH");

  const requirements = [];
  for (const primaryRequirement of primaryWorksheet.requirements) {
    const components = [];
    for (const primaryComponent of primaryRequirement.components) {
      const key = `${primaryRequirement.id}:${primaryComponent.id}`;
      if (!eligibleByKey.has(key)) continue;
      const ranking = rankingByKey.get(key);
      if (!Array.isArray(ranking.spans))
        throw shadowError("HYBRID_SHADOW_EXACT_SPANS_REQUIRED", key);
      const acceptedSpans = ranking.spans.filter(
        (span) => span.score >= contractIdentity.retrieval.minimumScore
      );
      const occurrences = acceptedSpans.map((span) => {
        const page = verifyRankedChunk({ document, chunk: span });
        const digest = sha256(
          [
            contractIdentity.contractSha256,
            primaryWorksheet.document.fingerprint,
            primaryRequirement.id,
            primaryComponent.id,
            span.pageNumber,
            span.documentStart,
            span.documentEnd,
          ].join(":")
        );
        return {
          candidateId: `candidate:hybrid-shadow:${digest}`,
          matchedAlias: "SEMANTIC_RETRIEVAL",
          discoveryMethod: "HYBRID_EXACT_SPAN_SEMANTIC",
          hybridSemanticContract: ranking.semanticContract,
          pageNumber: span.pageNumber,
          physicalPageNumber: span.physicalPageNumber,
          printedPageLabel: page.printedPageLabel || null,
          pageScopeHints: [],
          sectionScopeHint: null,
          coverageGovernorHint: null,
          variantScopeHint: null,
          fieldGovernorHint: null,
          pageStart: span.pageStart,
          pageEnd: span.pageEnd,
          documentStart: span.documentStart,
          documentEnd: span.documentEnd,
          exactText: span.text,
          context: {
            unitType: "HYBRID_EXACT_SPAN",
            pageStart: span.pageStart,
            pageEnd: span.pageEnd,
            documentStart: span.documentStart,
            documentEnd: span.documentEnd,
            text: span.text,
          },
          scopeLead: {
            pageStart: span.pageStart,
            pageEnd: span.pageStart,
            documentStart: span.documentStart,
            documentEnd: span.documentStart,
            text: "",
          },
          retrieval: {
            contractId: contractIdentity.contractId,
            navigationChunkId: span.navigationChunkId,
            exactSpanId: span.id,
            navigationScore: span.navigationScore,
            exactSpanScore: span.score,
          },
        };
      });
      components.push({
        ...primaryComponent,
        terminalState:
          occurrences.length > 0
            ? "CONTROLLED_CANDIDATES_FOUND"
            : "NO_CONTROLLED_CANDIDATE",
        occurrenceCount: occurrences.length,
        occurrences,
      });
    }
    if (components.length)
      requirements.push({
        ...primaryRequirement,
        componentCount: components.length,
        components,
      });
  }
  const allComponents = requirements.flatMap(({ components }) => components);
  return {
    schemaVersion: primaryWorksheet.schemaVersion,
    candidateOnly: true,
    catalog: {
      ...primaryWorksheet.catalog,
      id: `${primaryWorksheet.catalog.id}:hybrid-shadow:${contractIdentity.contractId}`,
    },
    document: { ...primaryWorksheet.document },
    summary: {
      requirementCount: requirements.length,
      componentCount: allComponents.length,
      componentsWithCandidates: allComponents.filter(
        ({ occurrenceCount }) => occurrenceCount > 0
      ).length,
      componentsWithoutCandidates: allComponents.filter(
        ({ occurrenceCount }) => occurrenceCount === 0
      ).length,
      occurrenceCount: allComponents.reduce(
        (sum, component) => sum + component.occurrenceCount,
        0
      ),
    },
    bindingGroups: [],
    requirements,
    shadowSearch: {
      schemaVersion: HYBRID_SHADOW_ARTIFACT_SCHEMA_VERSION,
      mode: HYBRID_SHADOW_MODE,
      shadowOnly: true,
      primaryWorksheetSha256,
      documentArtifactSha256,
      contract: contractIdentity,
      ...(pilotIdentity ? { pilot: pilotIdentity } : {}),
    },
  };
}

function calculateHybridShadowMetrics(review) {
  if (
    review?.artifactKind !== "HYBRID_SHADOW_RECALL_FPR_REVIEW" ||
    review?.shadowOnly !== true ||
    !Array.isArray(review.targetReviews) ||
    !Array.isArray(review.candidates)
  )
    throw shadowError("HYBRID_SHADOW_REVIEW_INVALID");
  if (
    review.targetReviews.some(
      ({ labels }) =>
        !labels ||
        [labels.groundTruth, labels.primaryRecall, labels.confusionClass].some(
          (value) => !value || value === "UNREVIEWED"
        )
    ) ||
    review.candidates.some(
      ({ reviewLabels }) =>
        !reviewLabels?.relevance || reviewLabels.relevance === "UNREVIEWED"
    )
  )
    throw shadowError("HYBRID_SHADOW_REVIEW_LABELS_INCOMPLETE");
  const validCandidateLabels = new Set(["TRUE_POSITIVE", "FALSE_POSITIVE"]);
  const validTargetCombinations = new Set([
    "RELEVANT_EVIDENCE_EXISTS:PRIMARY_MISS:TRUE_POSITIVE",
    "RELEVANT_EVIDENCE_EXISTS:PRIMARY_MISS:FALSE_NEGATIVE",
    "NO_RELEVANT_EVIDENCE_EXISTS:PRIMARY_CORRECT_NULL:FALSE_POSITIVE",
    "NO_RELEVANT_EVIDENCE_EXISTS:PRIMARY_CORRECT_NULL:TRUE_NEGATIVE",
  ]);
  if (
    review.candidates.some(
      ({ reviewLabels }) => !validCandidateLabels.has(reviewLabels.relevance)
    ) ||
    review.targetReviews.some(
      ({ labels }) =>
        !validTargetCombinations.has(
          `${labels.groundTruth}:${labels.primaryRecall}:${labels.confusionClass}`
        )
    )
  )
    throw shadowError("HYBRID_SHADOW_REVIEW_LABEL_COMBINATION_INVALID");
  const targetByKey = new Map();
  for (const target of review.targetReviews) {
    const key = `${target.requirementId}:${target.componentId}`;
    if (
      targetByKey.has(key) ||
      target.primaryCandidateCount !== 0 ||
      !Number.isInteger(target.shadowCandidateCount) ||
      target.shadowCandidateCount < 0 ||
      !Number.isInteger(target.shadowSelectedCandidateCount) ||
      target.shadowSelectedCandidateCount < 0 ||
      target.shadowSelectedCandidateCount > target.shadowCandidateCount
    )
      throw shadowError("HYBRID_SHADOW_REVIEW_TARGET_INVALID", key);
    targetByKey.set(key, target);
  }
  const candidatesByKey = new Map(
    [...targetByKey.keys()].map((key) => [key, []])
  );
  const candidateIds = new Set();
  for (const candidate of review.candidates) {
    const key = `${candidate.requirementId}:${candidate.componentId}`;
    if (
      !targetByKey.has(key) ||
      typeof candidate.candidateId !== "string" ||
      typeof candidate.evidence?.selected !== "boolean" ||
      candidateIds.has(candidate.candidateId)
    )
      throw shadowError("HYBRID_SHADOW_REVIEW_CANDIDATE_INVALID", key);
    candidateIds.add(candidate.candidateId);
    candidatesByKey.get(key).push(candidate);
  }
  for (const [key, target] of targetByKey) {
    const candidates = candidatesByKey.get(key);
    if (candidates.length !== target.shadowCandidateCount)
      throw shadowError("HYBRID_SHADOW_REVIEW_CANDIDATE_COUNT_MISMATCH", key);
    const selectedCandidates = candidates.filter(
      ({ evidence }) => evidence.selected
    );
    if (selectedCandidates.length !== target.shadowSelectedCandidateCount)
      throw shadowError("HYBRID_SHADOW_REVIEW_SELECTED_COUNT_MISMATCH", key);
    const relevant = target.labels.groundTruth === "RELEVANT_EVIDENCE_EXISTS";
    const hasSelectedTruePositive = selectedCandidates.some(
      ({ reviewLabels }) => reviewLabels.relevance === "TRUE_POSITIVE"
    );
    const expectedPrimaryRecall = relevant
      ? "PRIMARY_MISS"
      : "PRIMARY_CORRECT_NULL";
    const expectedConfusionClass = relevant
      ? hasSelectedTruePositive
        ? "TRUE_POSITIVE"
        : "FALSE_NEGATIVE"
      : selectedCandidates.length > 0
        ? "FALSE_POSITIVE"
        : "TRUE_NEGATIVE";
    if (
      (!relevant &&
        candidates.some(
          ({ reviewLabels }) => reviewLabels.relevance === "TRUE_POSITIVE"
        )) ||
      target.labels.primaryRecall !== expectedPrimaryRecall ||
      target.labels.confusionClass !== expectedConfusionClass
    )
      throw shadowError("HYBRID_SHADOW_REVIEW_LABEL_TARGET_MISMATCH", key);
  }

  const candidateCount = (label) =>
    review.candidates.filter(
      ({ reviewLabels, evidence }) =>
        evidence.selected && reviewLabels.relevance === label
    ).length;
  const targetCount = (label) =>
    review.targetReviews.filter(({ labels }) => labels.confusionClass === label)
      .length;
  const truePositiveCandidateCount = candidateCount("TRUE_POSITIVE");
  const falsePositiveCandidateCount = candidateCount("FALSE_POSITIVE");
  const truePositiveTargetCount = targetCount("TRUE_POSITIVE");
  const falsePositiveTargetCount = targetCount("FALSE_POSITIVE");
  const trueNegativeTargetCount = targetCount("TRUE_NEGATIVE");
  const falseNegativeTargetCount = targetCount("FALSE_NEGATIVE");
  const precisionDenominator =
    truePositiveCandidateCount + falsePositiveCandidateCount;
  const recallDenominator = truePositiveTargetCount + falseNegativeTargetCount;
  const falsePositiveDenominator =
    falsePositiveTargetCount + trueNegativeTargetCount;
  return {
    reviewedCandidateCount: review.candidates.length,
    reviewedSelectedCandidateCount:
      truePositiveCandidateCount + falsePositiveCandidateCount,
    truePositiveCandidateCount,
    falsePositiveCandidateCount,
    reviewedTargetCount: review.targetReviews.length,
    truePositiveTargetCount,
    falsePositiveTargetCount,
    trueNegativeTargetCount,
    falseNegativeTargetCount,
    recoveredPrimaryMissCount: review.targetReviews.filter(
      ({ labels }) =>
        labels.primaryRecall === "PRIMARY_MISS" &&
        labels.confusionClass === "TRUE_POSITIVE"
    ).length,
    reviewedCandidatePrecision:
      precisionDenominator > 0
        ? truePositiveCandidateCount / precisionDenominator
        : null,
    shadowRecall:
      recallDenominator > 0
        ? truePositiveTargetCount / recallDenominator
        : null,
    falsePositiveRate:
      falsePositiveDenominator > 0
        ? falsePositiveTargetCount / falsePositiveDenominator
        : null,
  };
}

module.exports = {
  HYBRID_SHADOW_ARTIFACT_SCHEMA_VERSION,
  HYBRID_SHADOW_CONTRACT_SCHEMA_VERSION,
  HYBRID_SHADOW_MODE,
  buildHybridShadowTargets,
  buildHybridShadowWorksheet,
  calculateHybridShadowMetrics,
  exactSourceSpansFromNavigationChunk,
  loadHybridShadowContract,
  validateHybridShadowContract,
  verifyRankedChunk,
  zeroPrimaryComponents,
};

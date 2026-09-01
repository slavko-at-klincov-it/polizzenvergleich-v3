const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  CATEGORY_ORDER,
} = require("../policyComparison/productContract");

const HYBRID_SHADOW_PILOT_SCHEMA_VERSION = 1;
const MINIMUM_PILOT_CASES = 10;
const MAXIMUM_PILOT_CASES = 20;
const CONTROL_CLASSES = new Set(["POSITIVE", "ADVERSARIAL", "TRUE_NULL"]);
const GROUND_TRUTH_VALUES = new Set([
  "RELEVANT_EVIDENCE_EXISTS",
  "NO_RELEVANT_EVIDENCE_EXISTS",
]);
const CANDIDATE_DISPOSITIONS = new Set([
  "SUFFICIENT",
  "RELEVANT_NARROW",
  "RELATED_NOT_SUFFICIENT",
  "WRONG_ROLE_OR_SCOPE",
  "IRRELEVANT",
]);
const DOWNSTREAM_EXPECTATIONS = new Set([
  "MUST_SELECT",
  "MUST_REJECT",
  "MUST_RETURN_NO_SELECTED_CANDIDATE",
]);

function pilotError(code, detail = "") {
  const error = new Error(detail ? `${code}: ${detail}` : code);
  error.code = code;
  return error;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function exactKeys(value, expectedKeys, code) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw pilotError(code);
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  )
    throw pilotError(code, actual.join(","));
}

function requiredString(value, code) {
  if (typeof value !== "string" || value.trim().length === 0)
    throw pilotError(code);
  return value.trim();
}

function validateSha256(value, code) {
  if (!/^[a-f0-9]{64}$/u.test(value || "")) throw pilotError(code);
  return value;
}

function validateSourceRanges(value, code, caseId) {
  if (!Array.isArray(value)) throw pilotError(code, caseId);
  return value.map((range, rangeIndex) => {
    exactKeys(
      range,
      [
        "physicalPageNumber",
        "documentStart",
        "documentEnd",
        "exactQuoteSha256",
      ],
      "HYBRID_SHADOW_PILOT_SOURCE_RANGE_KEYS_INVALID"
    );
    if (
      !Number.isInteger(range.physicalPageNumber) ||
      range.physicalPageNumber < 1 ||
      !Number.isInteger(range.documentStart) ||
      range.documentStart < 0 ||
      !Number.isInteger(range.documentEnd) ||
      range.documentEnd <= range.documentStart
    )
      throw pilotError(
        "HYBRID_SHADOW_PILOT_SOURCE_RANGE_INVALID",
        `${caseId}:${rangeIndex}`
      );
    return {
      physicalPageNumber: range.physicalPageNumber,
      documentStart: range.documentStart,
      documentEnd: range.documentEnd,
      exactQuoteSha256: validateSha256(
        range.exactQuoteSha256,
        "HYBRID_SHADOW_PILOT_SOURCE_RANGE_SHA256_INVALID"
      ),
    };
  });
}

function sourceLocationMatchesRange(source, range) {
  return (
    source.physicalPageNumber === range.physicalPageNumber &&
    source.documentStart >= range.documentStart &&
    source.documentEnd <= range.documentEnd
  );
}

function validateHybridShadowPilot(rawPilot) {
  exactKeys(
    rawPilot,
    [
      "schemaVersion",
      "pilotId",
      "approvalStatus",
      "oracleVersion",
      "reviewerId",
      "documents",
    ],
    "HYBRID_SHADOW_PILOT_KEYS_INVALID"
  );
  if (rawPilot.schemaVersion !== HYBRID_SHADOW_PILOT_SCHEMA_VERSION)
    throw pilotError(
      "HYBRID_SHADOW_PILOT_SCHEMA_INVALID",
      String(rawPilot.schemaVersion)
    );
  if (!new Set(["DRAFT", "APPROVED"]).has(rawPilot.approvalStatus))
    throw pilotError("HYBRID_SHADOW_PILOT_APPROVAL_STATUS_INVALID");
  if (!Array.isArray(rawPilot.documents) || rawPilot.documents.length === 0)
    throw pilotError("HYBRID_SHADOW_PILOT_DOCUMENTS_INVALID");

  const caseIds = new Set();
  const documentFingerprints = new Set();
  const primaryOutputs = new Set();
  const documents = rawPilot.documents.map((document, documentIndex) => {
    exactKeys(
      document,
      [
        "primaryOutput",
        "primaryReleaseId",
        "documentFingerprint",
        "documentArtifactSha256",
        "cases",
      ],
      "HYBRID_SHADOW_PILOT_DOCUMENT_KEYS_INVALID"
    );
    const primaryOutput = requiredString(
      document.primaryOutput,
      "HYBRID_SHADOW_PILOT_PRIMARY_OUTPUT_REQUIRED"
    );
    if (!path.isAbsolute(primaryOutput))
      throw pilotError(
        "HYBRID_SHADOW_PILOT_PRIMARY_OUTPUT_NOT_ABSOLUTE",
        primaryOutput
      );
    const documentFingerprint = validateSha256(
      document.documentFingerprint,
      "HYBRID_SHADOW_PILOT_DOCUMENT_FINGERPRINT_INVALID"
    );
    const documentArtifactSha256 = validateSha256(
      document.documentArtifactSha256,
      "HYBRID_SHADOW_PILOT_DOCUMENT_ARTIFACT_SHA256_INVALID"
    );
    const primaryReleaseId = requiredString(
      document.primaryReleaseId,
      "HYBRID_SHADOW_PILOT_PRIMARY_RELEASE_ID_REQUIRED"
    );
    if (
      documentFingerprints.has(documentFingerprint) ||
      primaryOutputs.has(path.resolve(primaryOutput))
    )
      throw pilotError(
        "HYBRID_SHADOW_PILOT_DOCUMENT_DUPLICATE",
        String(documentIndex)
      );
    documentFingerprints.add(documentFingerprint);
    primaryOutputs.add(path.resolve(primaryOutput));
    if (!Array.isArray(document.cases) || document.cases.length === 0)
      throw pilotError(
        "HYBRID_SHADOW_PILOT_CASES_INVALID",
        documentFingerprint
      );
    const targetKeys = new Set();
    const cases = document.cases.map((pilotCase, caseIndex) => {
      exactKeys(
        pilotCase,
        [
          "caseId",
          "categoryView",
          "requirementId",
          "componentId",
          "primaryWorksheetSha256",
          "controlClass",
          "groundTruth",
          "expectedCandidateDisposition",
          "downstreamExpectation",
          "acceptedSourceRanges",
          "knownAdversarialSourceRanges",
          "note",
        ],
        "HYBRID_SHADOW_PILOT_CASE_KEYS_INVALID"
      );
      const caseId = requiredString(
        pilotCase.caseId,
        "HYBRID_SHADOW_PILOT_CASE_ID_REQUIRED"
      );
      if (caseIds.has(caseId))
        throw pilotError("HYBRID_SHADOW_PILOT_CASE_ID_DUPLICATE", caseId);
      caseIds.add(caseId);
      const categoryView = requiredString(
        pilotCase.categoryView,
        "HYBRID_SHADOW_PILOT_CATEGORY_REQUIRED"
      );
      if (!CATEGORY_ORDER.includes(categoryView))
        throw pilotError(
          "HYBRID_SHADOW_PILOT_CATEGORY_INVALID",
          categoryView
        );
      const requirementId = requiredString(
        pilotCase.requirementId,
        "HYBRID_SHADOW_PILOT_REQUIREMENT_REQUIRED"
      );
      const componentId = requiredString(
        pilotCase.componentId,
        "HYBRID_SHADOW_PILOT_COMPONENT_REQUIRED"
      );
      const primaryWorksheetSha256 = validateSha256(
        pilotCase.primaryWorksheetSha256,
        "HYBRID_SHADOW_PILOT_WORKSHEET_SHA256_INVALID"
      );
      const targetKey = `${categoryView}:${requirementId}:${componentId}`;
      if (targetKeys.has(targetKey))
        throw pilotError("HYBRID_SHADOW_PILOT_TARGET_DUPLICATE", targetKey);
      targetKeys.add(targetKey);
      if (!CONTROL_CLASSES.has(pilotCase.controlClass))
        throw pilotError(
          "HYBRID_SHADOW_PILOT_CONTROL_CLASS_INVALID",
          caseId
        );
      if (!GROUND_TRUTH_VALUES.has(pilotCase.groundTruth))
        throw pilotError(
          "HYBRID_SHADOW_PILOT_GROUND_TRUTH_INVALID",
          caseId
        );
      if (
        !CANDIDATE_DISPOSITIONS.has(
          pilotCase.expectedCandidateDisposition
        )
      )
        throw pilotError(
          "HYBRID_SHADOW_PILOT_DISPOSITION_INVALID",
          caseId
        );
      if (!DOWNSTREAM_EXPECTATIONS.has(pilotCase.downstreamExpectation))
        throw pilotError(
          "HYBRID_SHADOW_PILOT_DOWNSTREAM_EXPECTATION_INVALID",
          caseId
        );
      const acceptedSourceRanges = validateSourceRanges(
        pilotCase.acceptedSourceRanges,
        "HYBRID_SHADOW_PILOT_ORACLE_RANGES_INVALID",
        caseId
      );
      const knownAdversarialSourceRanges = validateSourceRanges(
        pilotCase.knownAdversarialSourceRanges,
        "HYBRID_SHADOW_PILOT_ADVERSARIAL_RANGES_INVALID",
        caseId
      );
      const positive = pilotCase.controlClass === "POSITIVE";
      const adversarial = pilotCase.controlClass === "ADVERSARIAL";
      const trueNull = pilotCase.controlClass === "TRUE_NULL";
      if (
        positive !==
          (pilotCase.groundTruth === "RELEVANT_EVIDENCE_EXISTS") ||
        (positive && acceptedSourceRanges.length === 0) ||
        (!positive && acceptedSourceRanges.length !== 0) ||
        (positive && knownAdversarialSourceRanges.length !== 0) ||
        (adversarial && knownAdversarialSourceRanges.length === 0) ||
        (trueNull && knownAdversarialSourceRanges.length !== 0) ||
        (positive &&
          !new Set(["SUFFICIENT", "RELEVANT_NARROW"]).has(
            pilotCase.expectedCandidateDisposition
          )) ||
        (adversarial &&
          !new Set([
            "RELATED_NOT_SUFFICIENT",
            "WRONG_ROLE_OR_SCOPE",
          ]).has(pilotCase.expectedCandidateDisposition)) ||
        (trueNull && pilotCase.expectedCandidateDisposition !== "IRRELEVANT") ||
        (positive && pilotCase.downstreamExpectation !== "MUST_SELECT") ||
        (adversarial && pilotCase.downstreamExpectation !== "MUST_REJECT") ||
        (trueNull &&
          pilotCase.downstreamExpectation !==
            "MUST_RETURN_NO_SELECTED_CANDIDATE")
      )
        throw pilotError(
          "HYBRID_SHADOW_PILOT_ORACLE_CONTRACT_INVALID",
          caseId
        );
      return {
        caseId,
        categoryView,
        requirementId,
        componentId,
        primaryWorksheetSha256,
        controlClass: pilotCase.controlClass,
        groundTruth: pilotCase.groundTruth,
        expectedCandidateDisposition: pilotCase.expectedCandidateDisposition,
        downstreamExpectation: pilotCase.downstreamExpectation,
        acceptedSourceRanges,
        knownAdversarialSourceRanges,
        note:
          pilotCase.note === null
            ? null
            : requiredString(
                pilotCase.note,
                "HYBRID_SHADOW_PILOT_NOTE_INVALID"
              ),
        documentFingerprint,
        primaryOutput: path.resolve(primaryOutput),
        caseIndex,
      };
    });
    return {
      primaryOutput: path.resolve(primaryOutput),
      primaryReleaseId,
      documentFingerprint,
      documentArtifactSha256,
      cases,
    };
  });
  const caseCount = documents.reduce(
    (sum, document) => sum + document.cases.length,
    0
  );
  if (caseCount < MINIMUM_PILOT_CASES || caseCount > MAXIMUM_PILOT_CASES)
    throw pilotError(
      "HYBRID_SHADOW_PILOT_CASE_COUNT_INVALID",
      String(caseCount)
    );
  if (
    !documents.some((document) =>
      document.cases.some(({ controlClass }) => controlClass === "POSITIVE")
    ) ||
    !documents.some((document) =>
      document.cases.some(
        ({ controlClass }) => controlClass === "ADVERSARIAL"
      )
    ) ||
    !documents.some((document) =>
      document.cases.some(({ controlClass }) => controlClass === "TRUE_NULL")
    )
  )
    throw pilotError("HYBRID_SHADOW_PILOT_CONTROL_BALANCE_REQUIRED");

  return {
    schemaVersion: HYBRID_SHADOW_PILOT_SCHEMA_VERSION,
    pilotId: requiredString(
      rawPilot.pilotId,
      "HYBRID_SHADOW_PILOT_ID_REQUIRED"
    ),
    approvalStatus: rawPilot.approvalStatus,
    oracleVersion: requiredString(
      rawPilot.oracleVersion,
      "HYBRID_SHADOW_PILOT_ORACLE_VERSION_REQUIRED"
    ),
    reviewerId: requiredString(
      rawPilot.reviewerId,
      "HYBRID_SHADOW_PILOT_REVIEWER_REQUIRED"
    ),
    documents,
    caseCount,
  };
}

function loadHybridShadowPilot(pilotFile) {
  if (!path.isAbsolute(pilotFile || ""))
    throw pilotError("HYBRID_SHADOW_PILOT_PATH_NOT_ABSOLUTE");
  if (!fs.existsSync(pilotFile))
    throw pilotError("HYBRID_SHADOW_PILOT_FILE_MISSING", pilotFile);
  const bytes = fs.readFileSync(pilotFile);
  let rawPilot;
  try {
    rawPilot = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw pilotError("HYBRID_SHADOW_PILOT_JSON_INVALID", error.message);
  }
  const pilot = validateHybridShadowPilot(rawPilot);
  return {
    pilot,
    identity: {
      schemaVersion: pilot.schemaVersion,
      pilotId: pilot.pilotId,
      approvalStatus: pilot.approvalStatus,
      oracleVersion: pilot.oracleVersion,
      reviewerId: pilot.reviewerId,
      caseCount: pilot.caseCount,
      pilotSha256: sha256(bytes),
    },
  };
}

function pilotCasesForWorksheet({ pilotDocument, worksheet }) {
  if (
    worksheet?.document?.fingerprint !== pilotDocument.documentFingerprint
  )
    throw pilotError("HYBRID_SHADOW_PILOT_WORKSHEET_DOCUMENT_MISMATCH");
  const categoryView = worksheet?.catalog?.categoryView;
  if (!CATEGORY_ORDER.includes(categoryView))
    throw pilotError("HYBRID_SHADOW_PILOT_WORKSHEET_CATEGORY_INVALID");
  return pilotDocument.cases.filter(
    (pilotCase) => pilotCase.categoryView === categoryView
  );
}

function calculateHybridShadowPilotRetrievalMetrics({ pilot, searchReports }) {
  if (!Array.isArray(searchReports))
    throw pilotError("HYBRID_SHADOW_PILOT_SEARCH_REPORTS_INVALID");
  const rankingByCaseId = new Map();
  for (const report of searchReports) {
    if (
      report?.artifactKind !== "HYBRID_SHADOW_PILOT_SEARCH_REPORT" ||
      report.shadowOnly !== true ||
      !Array.isArray(report.exactSpanRankings)
    )
      throw pilotError("HYBRID_SHADOW_PILOT_SEARCH_REPORT_INVALID");
    for (const ranking of report.exactSpanRankings) {
      if (!ranking.caseId || rankingByCaseId.has(ranking.caseId))
        throw pilotError(
          "HYBRID_SHADOW_PILOT_SEARCH_RANKING_DUPLICATE",
          String(ranking.caseId)
        );
      rankingByCaseId.set(ranking.caseId, ranking);
    }
  }
  const cases = pilot.documents.flatMap((document) => document.cases);
  if (
    rankingByCaseId.size !== cases.length ||
    cases.some(({ caseId }) => !rankingByCaseId.has(caseId))
  )
    throw pilotError("HYBRID_SHADOW_PILOT_SEARCH_RANKINGS_INCOMPLETE");

  const caseResults = cases.map((pilotCase) => {
    const ranking = rankingByCaseId.get(pilotCase.caseId);
    const rankedSpans = ranking.spans;
    const rankedAcceptedSpans = ranking.spans.filter(
      ({ accepted }) => accepted
    );
    const matchesAny = (span, ranges) =>
      ranges.some((range) => sourceLocationMatchesRange(span, range));
    return {
      caseId: pilotCase.caseId,
      controlClass: pilotCase.controlClass,
      groundTruth: pilotCase.groundTruth,
      acceptedRetrievalCount: rankedAcceptedSpans.length,
      rawRecallAt1:
        pilotCase.controlClass === "POSITIVE"
          ? rankedSpans
              .slice(0, 1)
              .some((span) =>
                matchesAny(span, pilotCase.acceptedSourceRanges)
              )
          : null,
      rawRecallAt3:
        pilotCase.controlClass === "POSITIVE"
          ? rankedSpans
              .slice(0, 3)
              .some((span) =>
                matchesAny(span, pilotCase.acceptedSourceRanges)
              )
          : null,
      recallAt1:
        pilotCase.controlClass === "POSITIVE"
          ? rankedAcceptedSpans
              .slice(0, 1)
              .some((span) =>
                matchesAny(span, pilotCase.acceptedSourceRanges)
              )
          : null,
      recallAt3:
        pilotCase.controlClass === "POSITIVE"
          ? rankedAcceptedSpans
              .slice(0, 3)
              .some((span) =>
                matchesAny(span, pilotCase.acceptedSourceRanges)
              )
          : null,
      adversarialFalsePositive:
        pilotCase.controlClass === "TRUE_NULL"
          ? rankedAcceptedSpans.length > 0
          : null,
      knownAdversarialRetrievedAt3:
        pilotCase.controlClass === "ADVERSARIAL"
          ? rankedAcceptedSpans
              .slice(0, 3)
              .some((span) =>
                matchesAny(span, pilotCase.knownAdversarialSourceRanges)
              )
          : null,
    };
  });
  const positives = caseResults.filter(
    ({ controlClass }) => controlClass === "POSITIVE"
  );
  const adversarial = caseResults.filter(
    ({ controlClass }) => controlClass === "ADVERSARIAL"
  );
  const trueNull = caseResults.filter(
    ({ controlClass }) => controlClass === "TRUE_NULL"
  );
  return {
    caseCount: caseResults.length,
    positiveCaseCount: positives.length,
    adversarialCaseCount: adversarial.length,
    trueNullCaseCount: trueNull.length,
    recallAt1:
      positives.filter(({ recallAt1 }) => recallAt1).length / positives.length,
    recallAt3:
      positives.filter(({ recallAt3 }) => recallAt3).length / positives.length,
    retrievalFalsePositiveRate:
      trueNull.filter(({ adversarialFalsePositive }) =>
        Boolean(adversarialFalsePositive)
      ).length / trueNull.length,
    rawRecallAt1:
      positives.filter(({ rawRecallAt1 }) => rawRecallAt1).length /
      positives.length,
    rawRecallAt3:
      positives.filter(({ rawRecallAt3 }) => rawRecallAt3).length /
      positives.length,
    knownAdversarialRetrievalAt3:
      adversarial.filter(({ knownAdversarialRetrievedAt3 }) =>
        Boolean(knownAdversarialRetrievedAt3)
      ).length / adversarial.length,
    caseResults,
  };
}

module.exports = {
  HYBRID_SHADOW_PILOT_SCHEMA_VERSION,
  MAXIMUM_PILOT_CASES,
  MINIMUM_PILOT_CASES,
  calculateHybridShadowPilotRetrievalMetrics,
  loadHybridShadowPilot,
  pilotCasesForWorksheet,
  sourceLocationMatchesRange,
  validateHybridShadowPilot,
};

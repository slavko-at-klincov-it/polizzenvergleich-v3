const crypto = require("crypto");
const {
  A_DRIVEN_BINARY_RESULT_CONTRACT_ID,
  A_DRIVEN_REQUIREMENT_BINARY_RESULT_CONTRACT_ID,
} = require("./aDrivenBinaryReferenceResult");
const {
  A_DYNAMIC_MANIFEST_CONTRACT_ID,
  validateADrivenSemanticManifest,
} = require("./aDrivenSemanticManifest");
const { stableStringify } = require("./aDrivenSourceUnitPlan");

// QA-only comparison of a dynamic A-driven run with the frozen known LF 1+9
// fixture. Gold can measure regressions, but it can neither create production
// rows nor change the dynamic manifest.
const A_DRIVEN_GOLD_REGRESSION_CONTRACT_ID =
  "LF_A_DRIVEN_GOLD_283_REGRESSION_V2";
const GOLD_CONTRACT_ID = "LF_1PLUS9_GOLD_283_V1";
const GOLD_STATUS = "FROZEN_SOURCE_BOUND_GOLD_FOR_KNOWN_LF_1PLUS9_283_ROWS";

const LEGACY_ROLE_TO_DYNAMIC_TYPES = Object.freeze({
  INSURED_OBJECT: Object.freeze(["OBJECT"]),
  PERIL: Object.freeze(["PERIL_OR_CAUSE"]),
  DAMAGE: Object.freeze(["DAMAGE_OR_EFFECT"]),
  BENEFIT: Object.freeze(["COVERAGE_EFFECT", "FACT_ROLE"]),
  EXCLUSION: Object.freeze(["COVERAGE_EFFECT"]),
  COST: Object.freeze(["FACT_ROLE", "VALUE_AND_UNIT"]),
  LIMIT: Object.freeze(["VALUE_AND_UNIT", "LIMIT_BASIS"]),
  DEDUCTIBLE: Object.freeze(["DEDUCTIBLE", "VALUE_AND_UNIT"]),
  CONDITION: Object.freeze(["CONDITION", "SCOPE", "TEMPORAL_VALIDITY"]),
  DEFINITION: Object.freeze(["FACT_ROLE"]),
  DOCUMENT_STATUS: Object.freeze([
    "DOCUMENT_ROLE",
    "PRECEDENCE_OR_REPLACEMENT",
  ]),
});

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function regressionError(code, detail) {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  return error;
}

function normalizedText(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim()
    .toLocaleLowerCase("de-AT");
}

function validSha(value) {
  return /^[a-f0-9]{64}$/u.test(String(value || ""));
}

function normalizedFileIdentity(value) {
  const basename = String(value || "")
    .split(/[\\/]/u)
    .at(-1)
    .replace(/\.[^.]+$/u, "");
  return normalizedText(basename).replace(/[^\p{L}\p{N}]+/gu, "");
}

function locationContainsPage(location, page) {
  return (
    Number.isInteger(page) &&
    page > 0 &&
    new RegExp(`(?:^|\\D)${page}(?:\\D|$)`, "u").test(String(location || ""))
  );
}

function goldRows(gold, expectedGoldSha256) {
  if (
    gold?.contractId !== GOLD_CONTRACT_ID ||
    gold.status !== GOLD_STATUS ||
    gold.goldAuthority !== true ||
    gold.qaOnly !== true ||
    gold.productionRule !== false ||
    gold.releaseApproval !== false ||
    gold.generalizationProof !== false ||
    !validSha(gold.goldSha256) ||
    gold.goldSha256 !== expectedGoldSha256 ||
    !Array.isArray(gold.rows) ||
    gold.rows.length === 0 ||
    gold.summary?.rows !== gold.rows.length ||
    new Set(gold.rows.map(({ requirementId }) => requirementId)).size !==
      gold.rows.length
  )
    throw regressionError("LF_A_DRIVEN_GOLD_INPUT_INVALID");
  return gold.rows;
}

function rowBlockIds(row) {
  return [
    ...new Set(
      (row.referenceA?.sourceSpans || []).flatMap(
        ({ blockIds = [] }) => blockIds
      )
    ),
  ];
}

function overlaps(left, right) {
  const rightSet = right instanceof Set ? right : new Set(right);
  return left.some((value) => rightSet.has(value));
}

function dynamicRequirementIndex(manifest) {
  return manifest.requirements.map((requirement) => ({
    requirement,
    blockIds: new Set(requirement.sourceBlockIds || []),
  }));
}

function componentCandidates(goldComponent, candidateRequirements, goldBlocks) {
  const compatibleTypes =
    LEGACY_ROLE_TO_DYNAMIC_TYPES[goldComponent.factRole] || [];
  return candidateRequirements.flatMap(({ requirement }) =>
    requirement.components
      .filter(({ type }) => compatibleTypes.includes(type))
      .map((component) => ({
        dynamicRequirementId: requirement.requirementId,
        dynamicComponentId: component.componentId,
        dynamicComponentType: component.type,
        directSourceBlockOverlap: overlaps(
          component.sourceBlockIds || [],
          goldBlocks
        ),
      }))
  );
}

function buildCrosswalk(manifest, rows) {
  const dynamic = dynamicRequirementIndex(manifest);
  const dynamicOwners = new Map(
    manifest.requirements.map(({ requirementId }) => [requirementId, []])
  );
  const candidateRecords = rows.map((row) => {
    const goldBlocks = new Set(rowBlockIds(row));
    const candidateRequirements = dynamic.filter(({ blockIds }) =>
      overlaps([...blockIds], goldBlocks)
    );
    for (const { requirement } of candidateRequirements)
      dynamicOwners.get(requirement.requirementId).push(row.requirementId);
    const components = row.components.map((component) => {
      const candidates = componentCandidates(
        component,
        candidateRequirements,
        goldBlocks
      );
      return {
        legacyComponentId: component.componentId,
        legacyFactRole: component.factRole,
        compatibleDynamicCandidates: candidates,
        roleCovered: candidates.length > 0,
        directSourceRoleCovered: candidates.some(
          ({ directSourceBlockOverlap }) => directSourceBlockOverlap
        ),
      };
    });
    return {
      analysisRowId: row.analysisRowId,
      legacyRequirementId: row.requirementId,
      sourceBlockIds: [...goldBlocks],
      dynamicRequirementIds: candidateRequirements.map(
        ({ requirement }) => requirement.requirementId
      ),
      sourceCovered: candidateRequirements.length > 0,
      relationShape:
        candidateRequirements.length === 0
          ? "MISSING"
          : candidateRequirements.length === 1
            ? "ONE_TO_ONE_CANDIDATE"
            : "SPLIT_CANDIDATE",
      components,
    };
  });
  const ownerCounts = new Map(
    [...dynamicOwners.entries()].map(([requirementId, owners]) => [
      requirementId,
      new Set(owners).size,
    ])
  );
  const records = candidateRecords.map((record) => {
    const sharedDynamicRequirementIds = record.dynamicRequirementIds.filter(
      (requirementId) => (ownerCounts.get(requirementId) || 0) > 1
    );
    const measurementEligible =
      record.dynamicRequirementIds.length === 1 &&
      sharedDynamicRequirementIds.length === 0;
    return {
      ...record,
      sharedDynamicRequirementIds,
      measurementEligibility: measurementEligible
        ? "UNIQUE_SOURCE_MAPPING"
        : record.dynamicRequirementIds.length === 0
          ? "NO_DYNAMIC_REQUIREMENT"
          : record.dynamicRequirementIds.length > 1
            ? "SPLIT_OR_SHARED_SOURCE_CONTEXT"
            : "MERGED_OR_SHARED_SOURCE_CONTEXT",
      measurementEligible,
    };
  });
  const extraDynamicRequirementIds = [...dynamicOwners.entries()]
    .filter(([, owners]) => owners.length === 0)
    .map(([requirementId]) => requirementId);
  const mergedDynamicRequirementIds = [...dynamicOwners.entries()]
    .filter(([, owners]) => new Set(owners).size > 1)
    .map(([requirementId]) => requirementId);
  const components = records.flatMap((record) => record.components);
  return {
    records,
    summary: {
      legacyRequirements: records.length,
      legacyRequirementsSourceCovered: records.filter(
        ({ sourceCovered }) => sourceCovered
      ).length,
      legacyRequirementsMissing: records.filter(
        ({ sourceCovered }) => !sourceCovered
      ).length,
      oneToOneCandidates: records.filter(
        ({ relationShape }) => relationShape === "ONE_TO_ONE_CANDIDATE"
      ).length,
      splitCandidates: records.filter(
        ({ relationShape }) => relationShape === "SPLIT_CANDIDATE"
      ).length,
      measurementEligibleRequirements: records.filter(
        ({ measurementEligible }) => measurementEligible
      ).length,
      ambiguousMeasurementRequirements: records.filter(
        ({ measurementEligible }) => !measurementEligible
      ).length,
      legacyComponents: components.length,
      legacyComponentsRoleCovered: components.filter(
        ({ roleCovered }) => roleCovered
      ).length,
      legacyComponentsDirectSourceRoleCovered: components.filter(
        ({ directSourceRoleCovered }) => directSourceRoleCovered
      ).length,
      legacyComponentsRoleMissing: components.filter(
        ({ roleCovered }) => !roleCovered
      ).length,
      dynamicRequirements: manifest.requirements.length,
      dynamicComponents: manifest.summary.semanticComponents,
      extraDynamicRequirements: extraDynamicRequirementIds.length,
      mergedDynamicRequirements: mergedDynamicRequirementIds.length,
    },
    extraDynamicRequirementIds,
    mergedDynamicRequirementIds,
  };
}

function validateBinaryResult(result, manifest) {
  if (result === undefined || result === null) return null;
  const supportedContractIds = new Set([
    A_DRIVEN_BINARY_RESULT_CONTRACT_ID,
    A_DRIVEN_REQUIREMENT_BINARY_RESULT_CONTRACT_ID,
  ]);
  if (
    !supportedContractIds.has(result.contractId) ||
    result.dynamicManifestSha256 !== manifest.manifestSha256 ||
    !Array.isArray(result.rows) ||
    result.rows.length !== manifest.requirements.length ||
    !validSha(result.resultSha256)
  )
    throw regressionError("LF_A_DRIVEN_GOLD_RESULT_INVALID");
  const { resultSha256, ...payload } = result;
  if (
    resultSha256 !==
    sha256(`${result.contractId}\u0000${stableStringify(payload)}`)
  )
    throw regressionError("LF_A_DRIVEN_GOLD_RESULT_DIGEST_INVALID");
  return new Map(result.rows.map((row) => [row.requirementId, row]));
}

function evidenceSpans(resultRows, requirementIds) {
  return requirementIds.flatMap((requirementId) => {
    const row = resultRows.get(requirementId);
    return (row?.bEvidence || []).flatMap((evidence) => {
      if (Array.isArray(evidence.sourceSpans))
        return evidence.sourceSpans.map((span) => ({
          requirementId,
          ...span,
        }));
      return evidence.documentUuid && evidence.exactText
        ? [{ requirementId, ...evidence }]
        : [];
    });
  });
}

function sourceBinding(goldSource, spans) {
  const exact = String(goldSource?.exactText || "");
  const exactHash = goldSource?.exactTextSha256;
  if (!exact || !validSha(exactHash) || sha256(exact) !== exactHash)
    return {
      status: "GOLD_SOURCE_INVALID",
      dynamicEvidence: [],
      sameFileEvidence: [],
      sameFileAndPageEvidence: [],
    };
  const normalized = normalizedText(exact);
  const matches = spans.filter((span) => {
    const candidate = String(span.exactText || "");
    if (!candidate) return false;
    if (span.exactTextSha256 === exactHash || sha256(candidate) === exactHash)
      return true;
    const normalizedCandidate = normalizedText(candidate);
    return (
      normalized.length >= 24 &&
      (normalizedCandidate.includes(normalized) ||
        normalized.includes(normalizedCandidate))
    );
  });
  const goldFileIdentity = normalizedFileIdentity(goldSource.file);
  const sameFile = goldFileIdentity
    ? spans.filter(
        (span) => normalizedFileIdentity(span.originalName) === goldFileIdentity
      )
    : [];
  const sameFileAndPage = sameFile.filter((span) =>
    locationContainsPage(goldSource.location, span.physicalPageNumber)
  );
  const metadataEvidence = (entries) =>
    entries.map(
      ({
        requirementId,
        documentUuid,
        physicalPageNumber,
        exactTextSha256,
      }) => ({
        requirementId,
        documentUuid,
        physicalPageNumber,
        exactTextSha256,
      })
    );
  return {
    status: matches.length ? "BOUND" : "NOT_BOUND",
    dynamicEvidence: metadataEvidence(matches),
    sameFileEvidence: metadataEvidence(sameFile),
    sameFileAndPageEvidence: metadataEvidence(sameFileAndPage),
  };
}

function buildResultRegression(rows, crosswalk, resultRows) {
  if (!resultRows) return null;
  const crosswalkById = new Map(
    crosswalk.records.map((record) => [record.legacyRequirementId, record])
  );
  const records = rows.map((row) => {
    const mapping = crosswalkById.get(row.requirementId);
    if (!mapping.measurementEligible)
      return {
        legacyRequirementId: row.requirementId,
        dynamicRequirementIds: mapping.dynamicRequirementIds,
        measurementEligibility: mapping.measurementEligibility,
        predictionResolved: false,
        predictedCustomerFound: null,
        goldCustomerFound: row.goldDecision?.customerFound === true,
        binaryMatch: null,
        goldOutcome: row.goldDecision?.outcome || null,
        sourceBindings: [],
      };
    const mappedRows = mapping.dynamicRequirementIds
      .map((requirementId) => resultRows.get(requirementId))
      .filter(Boolean);
    const predictedCustomerFound = mappedRows.some(
      ({ customerStatus }) => customerStatus === "FOUND"
    );
    const predictionResolved =
      mappedRows.length === mapping.dynamicRequirementIds.length &&
      mappedRows.every(({ customerStatus }) =>
        ["FOUND", "NOT_FOUND"].includes(customerStatus)
      );
    const spans = evidenceSpans(resultRows, mapping.dynamicRequirementIds);
    const sourceBindings = (row.goldDecision?.sources || []).map((source) => ({
      referenceId: source.referenceId,
      exactTextSha256: source.exactTextSha256,
      ...sourceBinding(source, spans),
    }));
    const goldCustomerFound = row.goldDecision?.customerFound === true;
    return {
      legacyRequirementId: row.requirementId,
      dynamicRequirementIds: mapping.dynamicRequirementIds,
      measurementEligibility: mapping.measurementEligibility,
      predictionResolved,
      predictedCustomerFound: predictionResolved
        ? predictedCustomerFound
        : null,
      goldCustomerFound,
      binaryMatch:
        predictionResolved && predictedCustomerFound === goldCustomerFound,
      goldOutcome: row.goldDecision?.outcome || null,
      sourceBindings,
    };
  });
  return {
    records,
    summary: {
      rows: records.length,
      measurementEligibleRows: records.filter(
        ({ measurementEligibility }) =>
          measurementEligibility === "UNIQUE_SOURCE_MAPPING"
      ).length,
      ambiguousCrosswalkRows: records.filter(
        ({ measurementEligibility }) =>
          measurementEligibility !== "UNIQUE_SOURCE_MAPPING"
      ).length,
      resolved: records.filter(({ predictionResolved }) => predictionResolved)
        .length,
      binaryMatches: records.filter(({ binaryMatch }) => binaryMatch).length,
      binaryMismatches: records.filter(
        ({ predictionResolved, binaryMatch }) =>
          predictionResolved && !binaryMatch
      ).length,
      unresolved: records.filter(
        ({ predictionResolved }) => !predictionResolved
      ).length,
      falsePositives: records.filter(
        ({ predictedCustomerFound, goldCustomerFound }) =>
          predictedCustomerFound === true && !goldCustomerFound
      ).length,
      falseNegatives: records.filter(
        ({ predictedCustomerFound, goldCustomerFound }) =>
          predictedCustomerFound === false && goldCustomerFound
      ).length,
      goldSources: records.reduce(
        (sum, { sourceBindings }) => sum + sourceBindings.length,
        0
      ),
      boundGoldSources: records.reduce(
        (sum, { sourceBindings }) =>
          sum +
          sourceBindings.filter(({ status }) => status === "BOUND").length,
        0
      ),
      sameFileGoldSources: records.reduce(
        (sum, { sourceBindings }) =>
          sum +
          sourceBindings.filter(
            ({ sameFileEvidence }) => sameFileEvidence.length > 0
          ).length,
        0
      ),
      sameFileAndPageGoldSources: records.reduce(
        (sum, { sourceBindings }) =>
          sum +
          sourceBindings.filter(
            ({ sameFileAndPageEvidence }) => sameFileAndPageEvidence.length > 0
          ).length,
        0
      ),
    },
  };
}

function buildADrivenGoldRegression({
  manifest,
  gold,
  expectedGoldSha256,
  result,
} = {}) {
  validateADrivenSemanticManifest(manifest);
  if (manifest.contractId !== A_DYNAMIC_MANIFEST_CONTRACT_ID)
    throw regressionError("LF_A_DRIVEN_GOLD_MANIFEST_INVALID");
  const rows = goldRows(gold, expectedGoldSha256);
  const crosswalk = buildCrosswalk(manifest, rows);
  const resultRows = validateBinaryResult(result, manifest);
  const resultRegression = buildResultRegression(rows, crosswalk, resultRows);
  const payload = {
    schemaVersion: 2,
    contractId: A_DRIVEN_GOLD_REGRESSION_CONTRACT_ID,
    qaOnly: true,
    productionRule: false,
    generalizationProof: false,
    goldContractId: gold.contractId,
    goldSha256: gold.goldSha256,
    dynamicManifestSha256: manifest.manifestSha256,
    dynamicResultSha256: result?.resultSha256 || null,
    crosswalk,
    resultRegression,
    proofLimit:
      "Regression gegen das bekannte LF-1+9-Gold. Nur eine bijektive SourceBlock-Zuordnung ist ohne weitere semantische Adjudikation ergebnismessbar; geteilte oder gesplittete Blockkontexte bleiben diagnostisch. Gold ist keine Produktionszeilenquelle, fachliche Adjudikation oder Generalisierungsbehauptung.",
  };
  return {
    ...payload,
    regressionSha256: sha256(
      `${A_DRIVEN_GOLD_REGRESSION_CONTRACT_ID}\u0000${stableStringify(payload)}`
    ),
  };
}

module.exports = {
  A_DRIVEN_GOLD_REGRESSION_CONTRACT_ID,
  GOLD_CONTRACT_ID,
  LEGACY_ROLE_TO_DYNAMIC_TYPES,
  buildADrivenGoldRegression,
};

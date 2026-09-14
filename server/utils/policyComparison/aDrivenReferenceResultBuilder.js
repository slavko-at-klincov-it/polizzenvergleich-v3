const { sha256 } = require("../policyAnalysis/runIdentity");
const { stableStringify } = require("../policyAnalysis/aDrivenSourceUnitPlan");
const {
  validateADrivenSemanticManifest,
} = require("../policyAnalysis/aDrivenSemanticManifest");
const {
  A_DRIVEN_REQUIREMENT_BINARY_RESULT_CONTRACT_ID,
  validateADrivenRequirementBinaryReferenceResult,
} = require("../policyAnalysis/aDrivenBinaryReferenceResult");
const { POLICY_COMPARISON_MODE } = require("./modes");
const {
  LF_CUSTOMER_PRESENTATION_CONTRACT_ID,
} = require("./referenceCustomerPresentation");
const { LF_A_DRIVEN_REFERENCE_PROFILE } = require("./aDrivenReferenceProfile");

const A_DRIVEN_REFERENCE_PRODUCT_RESULT_CONTRACT_ID =
  "LF_A_DRIVEN_REFERENCE_A_TO_B_RESULT_V1";

function resultError(code, detail) {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  return error;
}

function oneLine(value) {
  return String(value || "")
    .replace(/\s+/gu, " ")
    .trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizedDocuments(documents, manifest) {
  if (!Array.isArray(documents) || documents.length < 2)
    throw resultError("LF_A_DRIVEN_PRODUCT_DOCUMENTS_INVALID");
  const normalized = documents.map((document) => ({
    uuid: document.uuid,
    side: document.side,
    position: document.position,
    role: document.role || "OTHER",
    documentStatus: document.documentStatus || "ACTIVE",
    originalName: document.originalName || `${document.side}-Dokument`,
    sha256: document.sha256,
  }));
  if (
    normalized.some(
      ({ uuid, side, position, sha256: documentSha256 }) =>
        typeof uuid !== "string" ||
        !["A", "B"].includes(side) ||
        !Number.isInteger(position) ||
        !/^[a-f0-9]{64}$/u.test(String(documentSha256 || ""))
    ) ||
    new Set(normalized.map(({ uuid }) => uuid)).size !== normalized.length ||
    normalized.filter(({ side }) => side === "A").length !==
      manifest.documents.length ||
    normalized.filter(({ side }) => side === "B").length === 0
  )
    throw resultError("LF_A_DRIVEN_PRODUCT_DOCUMENTS_INVALID");
  const byId = new Map(normalized.map((document) => [document.uuid, document]));
  if (
    manifest.documents.some((document) => {
      const candidate = byId.get(document.documentUuid);
      return (
        !candidate ||
        candidate.side !== "A" ||
        candidate.position !== document.documentPosition ||
        candidate.sha256 !== document.documentSha256
      );
    })
  )
    throw resultError("LF_A_DRIVEN_PRODUCT_A_IDENTITY_MISMATCH");
  return normalized;
}

function evidenceLabel(evidence, documentsById) {
  const document = documentsById.get(evidence.documentUuid);
  if (!document)
    throw resultError(
      "LF_A_DRIVEN_PRODUCT_EVIDENCE_DOCUMENT_UNKNOWN",
      evidence.documentUuid
    );
  const page = Number(evidence.physicalPageNumber);
  if (!Number.isInteger(page) || page < 1 || !oneLine(evidence.exactText))
    throw resultError("LF_A_DRIVEN_PRODUCT_EVIDENCE_INVALID");
  return `${document.originalName} · Seite ${page}`;
}

function displayAValues(values) {
  return unique(
    (values || []).map(({ label, rawValue, unit, qualifier }) =>
      oneLine(
        rawValue
          ? `${label}: ${rawValue}${unit ? ` ${unit}` : ""}${
              qualifier ? ` (${qualifier})` : ""
            }`
          : label
      )
    )
  ).join("\n");
}

function displayDifferences(row) {
  const componentDifferences = (row.componentFindings || [])
    .filter(({ outcome }) => outcome !== "MATCH")
    .map(
      ({ componentLabel, componentType, outcome }) =>
        `${componentLabel || componentType}: ${outcome}`
    );
  const unmodeled = (row.unmodeledDifferences || []).map(
    ({ dimension, description }) => `${dimension}: ${description}`
  );
  return unique([...componentDifferences, ...unmodeled]).join("\n");
}

function categoryIdentity(path, index) {
  const label = oneLine(path[0]) || "Referenzprodukt A";
  return {
    categoryView: `AR${String(index + 1).padStart(2, "0")}`,
    categoryName: label,
    categoryKey: sha256(`LF_REFERENCE_A_DRIVEN_V2\u0000${label}`),
  };
}

function rowCategoryLabel(row) {
  return oneLine(row?.aCategoryPath?.[0]) || "Referenzprodukt A";
}

function productRow(row, documentsById) {
  const aEvidence = row.aSourceSpans || [];
  const bEvidence = row.bCounterparts || [];
  const found = row.customerStatus === "FOUND";
  if (
    aEvidence.length === 0 ||
    !["FOUND", "NOT_FOUND"].includes(row.customerStatus) ||
    found !== bEvidence.length > 0
  )
    throw resultError("LF_A_DRIVEN_PRODUCT_ROW_INVALID", row.requirementId);
  const aSources = unique(
    aEvidence.map((evidence) => evidenceLabel(evidence, documentsById))
  );
  const bSources = unique(
    bEvidence.map((evidence) => evidenceLabel(evidence, documentsById))
  );
  const bContent = unique(
    bEvidence.map(({ exactText }) => oneLine(exactText))
  ).join("\n");
  return {
    categoryId: row.requirementId,
    analysisRowId: row.rowId,
    categoryName: row.requirementLabel,
    subcategoryName: row.aCategoryPath.slice(1).join(" › "),
    sourceOrder: [...row.sourceOrder],
    packageA: {
      documentedContent: oneLine(row.aOriginalContent),
      coverage: "Im Referenzprodukt A enthalten",
      coverageAmount: displayAValues(row.aValues),
      source: aSources.join("\n"),
      documentUuids: unique(aEvidence.map(({ documentUuid }) => documentUuid)),
    },
    packageB: {
      documentedContent: bContent,
      coverage: found ? "Fachliches Gegenstück vorhanden" : "Nicht gefunden",
      coverageAmount: displayDifferences(row),
      source: bSources.join("\n"),
      contributors: bEvidence.map((evidence) => ({
        documentUuid: evidence.documentUuid,
        source: evidenceLabel(evidence, documentsById),
        exactText: evidence.exactText,
        physicalPageNumber: evidence.physicalPageNumber,
      })),
    },
    outcome: row.counterpartOutcome,
    pointDecision: {
      outcome: row.counterpartOutcome,
      reason: row.reviewHint,
      rationale: row.decisionRationale,
    },
  };
}

function buildADrivenReferenceProductResult({
  binaryResult,
  manifest,
  lineageInputs,
  documents,
  metadata = {},
} = {}) {
  validateADrivenSemanticManifest(manifest);
  validateADrivenRequirementBinaryReferenceResult(binaryResult, lineageInputs);
  if (
    binaryResult.contractId !==
      A_DRIVEN_REQUIREMENT_BINARY_RESULT_CONTRACT_ID ||
    binaryResult.runContractId !== LF_A_DRIVEN_REFERENCE_PROFILE.id ||
    binaryResult.dynamicManifestSha256 !== manifest.manifestSha256 ||
    binaryResult.summary?.unresolved !== 0 ||
    binaryResult.summary?.binaryCustomerStatus !== true ||
    binaryResult.summary?.sideBOnlyRows !== 0
  )
    throw resultError("LF_A_DRIVEN_PRODUCT_INPUT_INVALID");
  const normalized = normalizedDocuments(documents, manifest);
  const documentsById = new Map(
    normalized.map((document) => [document.uuid, document])
  );
  const categoryPaths = unique(binaryResult.rows.map(rowCategoryLabel));
  const categories = categoryPaths.map((path, index) => {
    const identity = categoryIdentity([path], index);
    return {
      ...identity,
      rows: binaryResult.rows
        .filter((row) => rowCategoryLabel(row) === path)
        .map((row) => productRow(row, documentsById)),
    };
  });
  const rowCount = categories.reduce(
    (sum, category) => sum + category.rows.length,
    0
  );
  if (rowCount !== binaryResult.rows.length)
    throw resultError("LF_A_DRIVEN_PRODUCT_ROW_COVERAGE_INVALID");
  const payload = {
    schemaVersion: 1,
    contractId: A_DRIVEN_REFERENCE_PRODUCT_RESULT_CONTRACT_ID,
    customerPresentationContractId: LF_CUSTOMER_PRESENTATION_CONTRACT_ID,
    status: "LF_A_DRIVEN_REFERENCE_PRODUCT_RESULT_MATERIALIZED",
    comparisonMode: POLICY_COMPARISON_MODE.LF_REFERENCE_A_TO_B,
    ...metadata,
    productProfile: LF_A_DRIVEN_REFERENCE_PROFILE,
    template: {
      runContractId: manifest.runContractId,
      dynamicManifestSha256: manifest.manifestSha256,
      sourceBlocks: manifest.summary.sourceBlocks,
      semanticRequirements: manifest.summary.semanticRequirements,
      semanticComponents: manifest.summary.semanticComponents,
      decisionEligibleRequirements: binaryResult.summary.rows,
      incompleteSearchRequirements: 0,
      reviewRequiredBlocks: manifest.summary.reviewRequiredBlocks,
      sourceDocuments: manifest.summary.documents,
    },
    sourceResult: {
      contractId: binaryResult.contractId,
      resultSha256: binaryResult.resultSha256,
      finalRequirementDecisionSha256:
        binaryResult.finalRequirementDecisionSha256,
    },
    documents: normalized,
    categories,
    totals: {
      rows: rowCount,
      categories: categories.length,
      referenceRowsAnalyzed: rowCount,
      sideBOnlyRows: 0,
      found: binaryResult.summary.found,
      notFound: binaryResult.summary.notFound,
      unresolved: 0,
      outcomes: binaryResult.summary.outcomeCounts,
    },
    proofLimit:
      "Das Referenzpaket A bestimmt dynamisch alle sichtbaren Zeilen. Das Ergebnis gilt für den hashgebundenen extrahierten A/B-Korpus dieses Laufs; Gold-283 ist nur Regression und kein Produktionsschema oder Generalisierungsnachweis.",
  };
  return {
    ...payload,
    resultSha256: sha256(
      `${A_DRIVEN_REFERENCE_PRODUCT_RESULT_CONTRACT_ID}\u0000${stableStringify(
        payload
      )}`
    ),
  };
}

function validateADrivenReferenceProductResult(result, inputs) {
  const rebuilt = buildADrivenReferenceProductResult(inputs);
  if (
    result?.contractId !== A_DRIVEN_REFERENCE_PRODUCT_RESULT_CONTRACT_ID ||
    stableStringify(result) !== stableStringify(rebuilt)
  )
    throw resultError("LF_A_DRIVEN_PRODUCT_RESULT_INVALID");
  return result;
}

module.exports = {
  A_DRIVEN_REFERENCE_PRODUCT_RESULT_CONTRACT_ID,
  buildADrivenReferenceProductResult,
  validateADrivenReferenceProductResult,
};

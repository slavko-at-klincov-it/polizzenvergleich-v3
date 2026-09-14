const fs = require("fs");
const path = require("path");
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
  presentReferenceCustomerResult,
} = require("./referenceCustomerPresentation");
const {
  A_DRIVEN_REFERENCE_PRODUCT_RESULT_CONTRACT_ID,
  A_DRIVEN_REFERENCE_PRODUCT_RESULT_SCHEMA_VERSION,
  LF_A_DRIVEN_REFERENCE_PROFILE,
} = require("./aDrivenReferenceProfile");
const { publishComparisonArtifactSet } = require("./artifactSetPublisher");
const {
  validateADrivenRequirementReviewWorkbook,
  writeADrivenRequirementReviewWorkbook,
} = require("../policyAnalysis/aDrivenRequirementReviewWorkbook");

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
    schemaVersion: A_DRIVEN_REFERENCE_PRODUCT_RESULT_SCHEMA_VERSION,
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

function allProductRows(result) {
  return (result.categories || []).flatMap(({ categoryView, rows }) =>
    (rows || []).map((row) => ({ categoryView, row }))
  );
}

function validateADrivenReferenceProductResultEnvelope(result) {
  if (
    result?.schemaVersion !==
      A_DRIVEN_REFERENCE_PRODUCT_RESULT_SCHEMA_VERSION ||
    result?.contractId !== A_DRIVEN_REFERENCE_PRODUCT_RESULT_CONTRACT_ID ||
    result?.customerPresentationContractId !==
      LF_CUSTOMER_PRESENTATION_CONTRACT_ID ||
    result?.status !== "LF_A_DRIVEN_REFERENCE_PRODUCT_RESULT_MATERIALIZED" ||
    result?.comparisonMode !== POLICY_COMPARISON_MODE.LF_REFERENCE_A_TO_B ||
    stableStringify(result?.productProfile) !==
      stableStringify(LF_A_DRIVEN_REFERENCE_PROFILE) ||
    result?.template?.runContractId !== LF_A_DRIVEN_REFERENCE_PROFILE.id ||
    !/^[a-f0-9]{64}$/u.test(
      String(result?.template?.dynamicManifestSha256 || "")
    ) ||
    !/^[a-f0-9]{64}$/u.test(
      String(result?.sourceResult?.resultSha256 || "")
    ) ||
    !/^[a-f0-9]{64}$/u.test(
      String(result?.sourceResult?.finalRequirementDecisionSha256 || "")
    ) ||
    !/^[a-f0-9]{64}$/u.test(String(result?.resultSha256 || "")) ||
    !Array.isArray(result?.documents) ||
    !Array.isArray(result?.categories)
  )
    throw resultError("LF_A_DRIVEN_PRODUCT_RESULT_ENVELOPE_INVALID");
  const { resultSha256, ...payload } = result;
  if (
    resultSha256 !==
    sha256(
      `${A_DRIVEN_REFERENCE_PRODUCT_RESULT_CONTRACT_ID}\u0000${stableStringify(
        payload
      )}`
    )
  )
    throw resultError("LF_A_DRIVEN_PRODUCT_RESULT_DIGEST_INVALID");
  const documentIds = result.documents.map(({ uuid }) => uuid);
  const sideA = result.documents.filter(({ side }) => side === "A");
  const sideB = result.documents.filter(({ side }) => side === "B");
  const rows = allProductRows(result);
  const rowKeys = rows.map(
    ({ categoryView, row }) => `${categoryView}:${row.categoryId}`
  );
  if (
    sideA.length < 1 ||
    sideB.length < 1 ||
    new Set(documentIds).size !== documentIds.length ||
    new Set(rowKeys).size !== rowKeys.length ||
    rows.length !== result.totals?.rows ||
    rows.length !== result.totals?.referenceRowsAnalyzed ||
    result.categories.length !== result.totals?.categories ||
    result.totals?.sideBOnlyRows !== 0 ||
    result.totals?.unresolved !== 0 ||
    result.template?.semanticRequirements !== rows.length ||
    result.template?.incompleteSearchRequirements !== 0
  )
    throw resultError("LF_A_DRIVEN_PRODUCT_RESULT_ROWS_INVALID");
  const documentIdSet = new Set(documentIds);
  const observedFound = rows.filter(
    ({ row }) => row.packageB?.contributors?.length > 0
  ).length;
  if (
    observedFound !== result.totals.found ||
    rows.length - observedFound !== result.totals.notFound ||
    rows.some(({ row }) => {
      const contributors = row.packageB?.contributors || [];
      const found = contributors.length > 0;
      return (
        !oneLine(row.packageA?.documentedContent) ||
        !oneLine(row.packageA?.source) ||
        !Array.isArray(row.packageA?.documentUuids) ||
        row.packageA.documentUuids.length === 0 ||
        row.packageA.documentUuids.some(
          (uuid) => !sideA.some((document) => document.uuid === uuid)
        ) ||
        contributors.some(
          ({ documentUuid, source, exactText, physicalPageNumber }) =>
            !documentIdSet.has(documentUuid) ||
            !sideB.some((document) => document.uuid === documentUuid) ||
            !oneLine(source) ||
            !oneLine(exactText) ||
            !Number.isInteger(physicalPageNumber) ||
            physicalPageNumber < 1
        ) ||
        found !== Boolean(oneLine(row.packageB?.documentedContent)) ||
        found !== Boolean(oneLine(row.packageB?.source))
      );
    })
  )
    throw resultError("LF_A_DRIVEN_PRODUCT_RESULT_EVIDENCE_INVALID");
  return result;
}

function validateADrivenReferenceProductResult(result, inputs) {
  validateADrivenReferenceProductResultEnvelope(result);
  const rebuilt = buildADrivenReferenceProductResult(inputs);
  if (
    result?.contractId !== A_DRIVEN_REFERENCE_PRODUCT_RESULT_CONTRACT_ID ||
    stableStringify(result) !== stableStringify(rebuilt)
  )
    throw resultError("LF_A_DRIVEN_PRODUCT_RESULT_INVALID");
  return result;
}

function customerSafeADrivenReferenceReadView(result) {
  validateADrivenReferenceProductResultEnvelope(result);
  return JSON.parse(JSON.stringify(result));
}

function productMarkdown(result) {
  validateADrivenReferenceProductResultEnvelope(result);
  const lines = [
    "# LF-Referenzvergleich A nach B",
    "",
    `Dynamische A-Zeilen: ${result.totals.rows}; gefunden: ${result.totals.found}; nicht gefunden: ${result.totals.notFound}; B-only-Zeilen: 0.`,
    "",
    result.proofLimit,
    "",
  ];
  for (const category of result.categories) {
    lines.push(`## ${category.categoryView} · ${category.categoryName}`, "");
    for (const row of category.rows)
      lines.push(
        `- ${row.categoryId} · ${row.categoryName}: ${
          row.packageB.contributors.length ? "GEFUNDEN" : "NICHT GEFUNDEN"
        }`
      );
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

async function writeADrivenReferenceProductArtifacts({
  binaryResult,
  manifest,
  lineageInputs,
  documents,
  metadata,
  outputDirectory,
} = {}) {
  const inputs = {
    binaryResult,
    manifest,
    lineageInputs,
    documents,
    metadata,
  };
  const result = buildADrivenReferenceProductResult(inputs);
  const markdown = productMarkdown(result);
  const published = await publishComparisonArtifactSet({
    outputDirectory,
    writeArtifacts: async (stagingDirectory) => {
      fs.writeFileSync(
        path.join(stagingDirectory, "comparison.private.json"),
        `${JSON.stringify(result, null, 2)}\n`,
        { encoding: "utf8", mode: 0o600 }
      );
      fs.writeFileSync(
        path.join(stagingDirectory, "comparison.md"),
        markdown,
        { encoding: "utf8", mode: 0o600 }
      );
      await writeADrivenRequirementReviewWorkbook(
        binaryResult,
        path.join(stagingDirectory, "polizzenvergleich.xlsx")
      );
    },
    validateArtifacts: async ({ files }) => {
      const persisted = JSON.parse(
        fs.readFileSync(files["comparison.private.json"], "utf8")
      );
      validateADrivenReferenceProductResult(persisted, inputs);
      presentReferenceCustomerResult(persisted);
      if (
        fs.readFileSync(files["comparison.md"], "utf8") !==
        productMarkdown(persisted)
      )
        throw resultError("LF_A_DRIVEN_PRODUCT_MARKDOWN_ROUNDTRIP_INVALID");
      await validateADrivenRequirementReviewWorkbook(
        binaryResult,
        files["polizzenvergleich.xlsx"]
      );
    },
  });
  return {
    result,
    jsonFile: published.files["comparison.private.json"],
    markdownFile: published.files["comparison.md"],
    workbookFile: published.files["polizzenvergleich.xlsx"],
    artifactSetManifest: published.manifest,
    artifactSetManifestFile: published.manifestFile,
  };
}

module.exports = {
  A_DRIVEN_REFERENCE_PRODUCT_RESULT_CONTRACT_ID,
  buildADrivenReferenceProductResult,
  customerSafeADrivenReferenceReadView,
  productMarkdown,
  validateADrivenReferenceProductResult,
  validateADrivenReferenceProductResultEnvelope,
  writeADrivenReferenceProductArtifacts,
};

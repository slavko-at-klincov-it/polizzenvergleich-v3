const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const { POLICY_COMPARISON_MODE } = require("./modes");
const { LF_DYNAMIC_REFERENCE_PROFILE } = require("./lfDynamicReferenceProfile");
const {
  COUNTERPART_REVIEW_STATUS,
  REFERENCE_OUTCOME,
  aggregateCounterpart,
  deriveTotals,
  readEvidenceBundle,
  readRows,
  referenceDecision,
} = require("./referenceResultBuilder");
const { publishComparisonArtifactSet } = require("./artifactSetPublisher");
const {
  LF_CUSTOMER_PRESENTATION_CONTRACT_ID,
  referenceCustomerSearchHint,
  referenceCustomerSearchStatusLabel,
} = require("./referenceCustomerPresentation");

const DYNAMIC_REFERENCE_RESULT_SCHEMA_VERSION = 3;
const DYNAMIC_REFERENCE_RESULT_CONTRACT_ID =
  "LF_DYNAMIC_REFERENCE_A_TO_B_RESULT_V1";
const SHEET_NAME = "LF Vorlage A nach B";
const HEADERS = [
  "LF_Kategorie",
  "LF_Unterkategorie",
  "LF_Zeilen-ID",
  "LF_Prüfpunkt",
  "A_Vertragsinhalt",
  "A_Werte",
  "A_Quelle",
  "B_Gegenstück",
  "B_Deckung",
  "B_Werte",
  "B_Quelle",
  "KI_Fundstatus",
  "KI_Prüfhinweis",
  "Fachliche Bewertung (manuell)",
];
function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function displayValue(value) {
  const details = [];
  if (value.basis?.label) details.push(`Basis: ${value.basis.label}`);
  if (value.formula) details.push(`Formel: ${value.formula}`);
  if (value.type === "PERCENT")
    details.push(
      value.calculatedAmount === null
        ? "Betrag: ungeklärt"
        : `Betrag: ${value.calculatedAmount} ${value.currency || ""}`.trim()
    );
  if (value.roundingRule) details.push(`Rundung: ${value.roundingRule}`);
  return details.length > 0
    ? `${value.rawValue} (${details.join("; ")})`
    : value.rawValue;
}

function referenceSide(requirement, sourceDocument) {
  const sourceSpans = [
    ...new Map(
      requirement.sourceSpans.map((span) => [span.spanId, span])
    ).values(),
  ];
  const values = unique(requirement.values.map(displayValue));
  const review = requirement.decisionEligibility !== "ELIGIBLE";
  return {
    categoryId: requirement.requirementId,
    stage: "A_SOURCE_TEMPLATE",
    categoryName: requirement.displayLabel,
    documentedContent: sourceSpans
      .map(({ exactText }) => exactText.replace(/\s+/gu, " ").trim())
      .join("\n"),
    coverage: review ? "Nicht feststellbar" : "Im LF-Dokument enthalten",
    coverageAmount:
      values.length > 0 ? values.join(" · ") : "Nicht feststellbar",
    source: sourceSpans
      .map(
        ({ physicalPageNumber, exactText }) =>
          `Seite ${physicalPageNumber}: ${exactText.replace(/\s+/gu, " ").trim()}`
      )
      .join("\n"),
    reviewStatus: review ? "UNGEKLÄRT" : "BELEGT",
    documentUuid: sourceDocument.uuid,
    documentName: sourceDocument.originalName,
    atomizationStatus: requirement.atomizationStatus,
    searchPlanStatus: requirement.searchPlanStatus,
    values: requirement.values,
  };
}

function incompleteSearchCounterpart(counterpart) {
  if (
    counterpart.reviewStatus !== COUNTERPART_REVIEW_STATUS.CONTROLLED_NOT_FOUND
  )
    return counterpart;
  return {
    ...counterpart,
    documentedContent:
      "Fundlage bei unvollständigem Suchplan nicht entscheidbar",
    source: "kein entscheidungsfähiger Nullfund",
    reviewStatus: COUNTERPART_REVIEW_STATUS.UNCLEAR,
  };
}

function buildDynamicReferenceComparisonResult({
  sourceDocument,
  sideBDocumentRuns,
  manifest,
  contracts,
  metadata = {},
}) {
  if (!sourceDocument || sideBDocumentRuns.length === 0)
    throw new Error("LF_DYNAMIC_REFERENCE_DOCUMENT_SET_INVALID");
  const byCategoryId = new Map(
    contracts.map((contract) => [contract.sourceCategoryId, contract])
  );
  const categories = manifest.categories.map((category) => {
    const contract = byCategoryId.get(category.id);
    if (!contract)
      throw new Error(`LF_DYNAMIC_REFERENCE_CONTRACT_MISSING:${category.id}`);
    const catalogBySourceId = new Map(
      contract.catalog.requirements.map((requirement) => [
        requirement.sourceReferenceId,
        requirement,
      ])
    );
    const rows = category.subcategories.flatMap((subcategory) =>
      subcategory.requirementIds.map((requirementId) => {
        const semantic = manifest.requirements.find(
          ({ requirementId: id }) => id === requirementId
        );
        const requirement = catalogBySourceId.get(requirementId);
        if (!semantic || !requirement)
          throw new Error(`LF_DYNAMIC_REFERENCE_ROW_MISSING:${requirementId}`);
        const counterpartEntries = sideBDocumentRuns.map((run) => {
          const row = readRows(run, contract.categoryView).find(
            ({ categoryId }) => categoryId === requirement.id
          );
          if (!row)
            throw new Error(
              `LF_DYNAMIC_REFERENCE_B_ROW_MISSING:${run.document.uuid}:${requirement.id}`
            );
          return {
            document: run.document,
            row,
            ...readEvidenceBundle(run, contract.categoryView, requirement.id),
          };
        });
        let counterpart = aggregateCounterpart(counterpartEntries, requirement);
        if (semantic.searchPlanStatus !== "CERTIFIED_COMPLETE")
          counterpart = incompleteSearchCounterpart(counterpart);
        const packageA = referenceSide(semantic, sourceDocument);
        const pointDecision = referenceDecision(packageA, counterpart);
        return {
          categoryId: requirementId,
          analysisRowId: requirement.id,
          stage: packageA.stage,
          categoryName: semantic.displayLabel,
          subcategoryId: semantic.subcategoryId,
          subcategoryName: semantic.subcategoryLabel,
          sourceOrder: semantic.sourceOrder,
          packageA,
          packageB: counterpart,
          outcome: pointDecision.outcome,
          pointDecision,
        };
      })
    );
    return {
      categoryView: category.id,
      categoryName: category.label,
      subcategories: category.subcategories,
      rows,
    };
  });
  const documents = [
    sourceDocument,
    ...sideBDocumentRuns.map(({ document }) => document),
  ].map(({ uuid, side, role, documentStatus, originalName, sha256 }) => ({
    uuid,
    side,
    role,
    documentStatus,
    originalName,
    sha256,
  }));
  const result = {
    schemaVersion: DYNAMIC_REFERENCE_RESULT_SCHEMA_VERSION,
    contractId: DYNAMIC_REFERENCE_RESULT_CONTRACT_ID,
    customerPresentationContractId: LF_CUSTOMER_PRESENTATION_CONTRACT_ID,
    status: "LF_DYNAMIC_REFERENCE_COMPARISON_RESULT_MATERIALIZED",
    comparisonMode: POLICY_COMPARISON_MODE.LF_REFERENCE_A_TO_B,
    generatedAt: new Date().toISOString(),
    ...metadata,
    productProfile: LF_DYNAMIC_REFERENCE_PROFILE,
    template: {
      sourceBlockLedgerSha256: manifest.source.sourceBlockLedgerSha256,
      semanticRequirementManifestSha256: manifest.manifestSha256,
      sourceBlocks: manifest.summary.sourceBlocks,
      semanticRequirements: manifest.summary.semanticRequirements,
      decisionEligibleRequirements:
        manifest.summary.decisionEligibleRequirements,
      incompleteSearchRequirements:
        manifest.summary.incompleteSearchRequirements,
      reviewRequiredBlocks: manifest.summary.reviewRequiredBlocks,
      sharedValueGovernors: manifest.sharedValueGovernors.length,
      sharedSemanticGovernors: manifest.sharedSemanticGovernors.length,
    },
    documents,
    categories,
    totals: deriveTotals(categories),
    proofLimit: `Gerichteter, quellgebundener LF-IMMO-Vergleich. Seite A bestimmt ${manifest.summary.semanticRequirements} fachliche Zeilen, Kategorien, Unterkategorien und Reihenfolge; Inhalte nur in B erzeugen keine Zeile. Unvollständige B-Suchverträge dürfen keinen kontrollierten Nullfund erzeugen. Das Ergebnis ist kein semantischer Holdout- oder 99-Prozent-Nachweis.`,
  };
  validateDynamicReferenceComparison(result, { manifest });
  return result;
}

function validateDynamicReferenceComparison(result, { manifest } = {}) {
  if (
    result?.schemaVersion !== DYNAMIC_REFERENCE_RESULT_SCHEMA_VERSION ||
    result?.contractId !== DYNAMIC_REFERENCE_RESULT_CONTRACT_ID ||
    result?.comparisonMode !== POLICY_COMPARISON_MODE.LF_REFERENCE_A_TO_B ||
    JSON.stringify(result?.productProfile) !==
      JSON.stringify(LF_DYNAMIC_REFERENCE_PROFILE)
  )
    throw new Error("LF_DYNAMIC_REFERENCE_RESULT_CONTRACT_INVALID");
  if (
    result.customerPresentationContractId !== undefined &&
    result.customerPresentationContractId !==
      LF_CUSTOMER_PRESENTATION_CONTRACT_ID
  )
    throw new Error("LF_DYNAMIC_REFERENCE_RESULT_PRESENTATION_INVALID");
  const rows = (result.categories || []).flatMap(({ rows }) => rows || []);
  const sideA = (result.documents || []).filter(({ side }) => side === "A");
  const sideB = (result.documents || []).filter(({ side }) => side === "B");
  if (
    !manifest ||
    sideA.length !== 1 ||
    sideB.length === 0 ||
    result.template?.semanticRequirementManifestSha256 !==
      manifest.manifestSha256 ||
    result.template?.sourceBlockLedgerSha256 !==
      manifest.source.sourceBlockLedgerSha256 ||
    result.template?.sourceBlocks !== manifest.summary.sourceBlocks ||
    result.template?.semanticRequirements !==
      manifest.summary.semanticRequirements ||
    result.template?.decisionEligibleRequirements !==
      manifest.summary.decisionEligibleRequirements ||
    result.template?.incompleteSearchRequirements !==
      manifest.summary.incompleteSearchRequirements ||
    result.template?.reviewRequiredBlocks !==
      manifest.summary.reviewRequiredBlocks ||
    result.template?.sharedValueGovernors !==
      manifest.sharedValueGovernors.length ||
    result.template?.sharedSemanticGovernors !==
      manifest.sharedSemanticGovernors.length ||
    rows.length !== manifest.requirements.length ||
    rows.some(
      (row, index) =>
        row.categoryId !== manifest.requirements[index].requirementId ||
        row.sourceOrder !== index ||
        row.packageA?.documentUuid !==
          result.documents.find(({ side }) => side === "A")?.uuid ||
        row.packageB?.contributors?.some(
          ({ documentUuid }) =>
            !result.documents.some(
              (document) =>
                document.side === "B" && document.uuid === documentUuid
            )
        )
    ) ||
    new Set(rows.map(({ categoryId }) => categoryId)).size !== rows.length
  )
    throw new Error("LF_DYNAMIC_REFERENCE_RESULT_ROWS_INVALID");
  if (
    rows.some(
      (row) =>
        !Object.values(REFERENCE_OUTCOME).includes(row.outcome) ||
        row.pointDecision?.outcome !== row.outcome ||
        (row.packageA.searchPlanStatus !== "CERTIFIED_COMPLETE" &&
          row.outcome === REFERENCE_OUTCOME.NOT_FOUND)
    )
  )
    throw new Error("LF_DYNAMIC_REFERENCE_RESULT_DECISION_INVALID");
  if (
    JSON.stringify(deriveTotals(result.categories)) !==
    JSON.stringify(result.totals)
  )
    throw new Error("LF_DYNAMIC_REFERENCE_RESULT_TOTALS_INVALID");
  return result;
}

function customerSafeDynamicReferenceReadView(result, manifest) {
  validateDynamicReferenceComparison(result, { manifest });
  return JSON.parse(JSON.stringify(result));
}

function markdownResult(result) {
  const lines = [
    "# LF-IMMO-Vorlage A → B",
    "",
    `Fachliche A-Zeilen: ${result.totals.referenceRowsAnalyzed}; B-only-Zeilen: 0.`,
    "",
    result.proofLimit,
    "",
  ];
  for (const category of result.categories) {
    lines.push(`## ${category.categoryView} · ${category.categoryName}`, "");
    for (const subcategory of category.subcategories) {
      lines.push(`### ${subcategory.label}`, "");
      for (const row of category.rows.filter(
        ({ subcategoryId }) => subcategoryId === subcategory.id
      ))
        lines.push(
          `- ${row.categoryId} · ${row.categoryName}: ${row.pointDecision.outcome}`
        );
      lines.push("");
    }
  }
  return `${lines.join("\n")}\n`;
}

function workbookValues(category, row) {
  return [
    category.categoryName,
    row.subcategoryName,
    row.categoryId,
    row.categoryName,
    row.packageA.documentedContent,
    row.packageA.coverageAmount,
    row.packageA.source,
    row.packageB.documentedContent,
    row.packageB.coverage,
    row.packageB.coverageAmount,
    row.packageB.source,
    referenceCustomerSearchStatusLabel(row),
    referenceCustomerSearchHint(row),
    "",
  ];
}

function persistedWorkbookValues(sheet, rowNumber) {
  return HEADERS.map(
    (_header, index) => sheet.getCell(rowNumber, index + 1).value ?? ""
  );
}

async function writeWorkbook(result, file) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Polizzenvergleich V3";
  const sheet = workbook.addWorksheet(SHEET_NAME);
  sheet.columns = HEADERS.map((header, index) => ({
    header,
    key: `column${index + 1}`,
    width: [22, 28, 16, 45, 55, 32, 50, 50, 20, 26, 50, 38, 50, 38][index],
  }));
  for (const category of result.categories)
    for (const row of category.rows)
      sheet.addRow(workbookValues(category, row));
  sheet.views = [{ state: "frozen", xSplit: 4, ySplit: 1, zoomScale: 80 }];
  sheet.autoFilter = `A1:N${sheet.rowCount}`;
  sheet.eachRow((row, number) =>
    row.eachCell((cell) => {
      cell.font = {
        name: "Aptos Narrow",
        size: number === 1 ? 10 : 9,
        bold: number === 1,
        color: number === 1 ? { argb: "FFFFFFFF" } : { argb: "FF1F2937" },
      };
      if (number === 1)
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF1F4E78" },
        };
      cell.alignment = { vertical: "top", wrapText: true };
    })
  );
  sheet.getRow(1).height = 34;
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    sheet.getRow(rowNumber).height = 66;
    sheet.getCell(rowNumber, HEADERS.length).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFF2CC" },
    };
  }
  await workbook.xlsx.writeFile(file);
  fs.chmodSync(file, 0o600);
}

async function writeDynamicReferenceComparisonArtifacts({
  sourceDocument,
  sideBDocumentRuns,
  manifest,
  contracts,
  outputDirectory,
  metadata,
}) {
  const result = buildDynamicReferenceComparisonResult({
    sourceDocument,
    sideBDocumentRuns,
    manifest,
    contracts,
    metadata,
  });
  const published = await publishComparisonArtifactSet({
    outputDirectory,
    writeArtifacts: async (stagingDirectory) => {
      fs.writeFileSync(
        path.join(stagingDirectory, "comparison.private.json"),
        JSON.stringify(result, null, 2),
        { encoding: "utf8", mode: 0o600 }
      );
      fs.writeFileSync(
        path.join(stagingDirectory, "comparison.md"),
        markdownResult(result),
        { encoding: "utf8", mode: 0o600 }
      );
      await writeWorkbook(
        result,
        path.join(stagingDirectory, "polizzenvergleich.xlsx")
      );
    },
    validateArtifacts: async ({ files }) => {
      const persisted = JSON.parse(
        fs.readFileSync(files["comparison.private.json"], "utf8")
      );
      validateDynamicReferenceComparison(persisted, { manifest });
      if (JSON.stringify(persisted) !== JSON.stringify(result))
        throw new Error("LF_DYNAMIC_REFERENCE_JSON_ROUNDTRIP_MISMATCH");
      if (
        fs.readFileSync(files["comparison.md"], "utf8") !==
        markdownResult(result)
      )
        throw new Error("LF_DYNAMIC_REFERENCE_MARKDOWN_ROUNDTRIP_MISMATCH");
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(files["polizzenvergleich.xlsx"]);
      const sheet = workbook.getWorksheet(SHEET_NAME);
      if (!sheet || sheet.rowCount !== result.totals.rows + 1)
        throw new Error("LF_DYNAMIC_REFERENCE_WORKBOOK_ROUNDTRIP_MISMATCH");
      if (
        JSON.stringify(persistedWorkbookValues(sheet, 1)) !==
        JSON.stringify(HEADERS)
      )
        throw new Error("LF_DYNAMIC_REFERENCE_WORKBOOK_HEADER_MISMATCH");
      const expectedRows = result.categories.flatMap((category) =>
        category.rows.map((row) => workbookValues(category, row))
      );
      if (
        expectedRows.some(
          (expectedRow, index) =>
            JSON.stringify(persistedWorkbookValues(sheet, index + 2)) !==
            JSON.stringify(expectedRow)
        )
      )
        throw new Error("LF_DYNAMIC_REFERENCE_WORKBOOK_CONTENT_MISMATCH");
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
  DYNAMIC_REFERENCE_RESULT_CONTRACT_ID,
  HEADERS,
  buildDynamicReferenceComparisonResult,
  customerSafeDynamicReferenceReadView,
  validateDynamicReferenceComparison,
  workbookValues,
  writeWorkbook,
  writeDynamicReferenceComparisonArtifacts,
};

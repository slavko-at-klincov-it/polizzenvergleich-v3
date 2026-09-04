const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const { POLICY_COMPARISON_MODE } = require("./modes");
const {
  LF_REFERENCE_PROFILE,
  categoryCatalogs,
} = require("./lfReferenceProfile");

const REFERENCE_RESULT_SCHEMA_VERSION = 2;
const REFERENCE_RESULT_CONTRACT_ID = "LF_REFERENCE_A_TO_B_RESULT_V2";
const REFERENCE_OUTCOME = Object.freeze({
  FOUND: "GEGENSTUECK_GEFUNDEN",
  PARTIAL: "TEILWEISES_GEGENSTUECK",
  NOT_FOUND: "KEIN_GEGENSTUECK_NACH_KONTROLLIERTER_SUCHE",
  REFERENCE_UNCLEAR: "REFERENZZEILE_UNKLAR",
  UNCLEAR: "GEGENSTUECK_UNKLAR",
});
const COUNTERPART_REVIEW_STATUS = Object.freeze({
  CONTROLLED_NOT_FOUND: "KEIN_BELEG_NACH_KONTROLLIERTER_SUCHE",
  UNCLEAR: "UNGEKLÄRT",
});

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function readRows(documentRun, categoryView) {
  const file = path.join(
    documentRun.outputDirectory,
    categoryView,
    "result",
    "rows.private.json"
  );
  if (!fs.existsSync(file))
    throw new Error(
      `REFERENCE_CATEGORY_RESULT_MISSING:${documentRun.document.uuid}:${categoryView}`
    );
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function readJson(file, errorCode) {
  if (!fs.existsSync(file)) throw new Error(errorCode);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function readEvidenceBundle(documentRun, categoryView, requirementId) {
  const effectsRoot = path.join(
    documentRun.outputDirectory,
    categoryView,
    "effects"
  );
  const resultRoot = path.join(
    documentRun.outputDirectory,
    categoryView,
    "result"
  );
  const errorContext = `${documentRun.document.uuid}:${categoryView}`;
  const materialized = readJson(
    path.join(effectsRoot, "materialized.private.json"),
    `REFERENCE_EVIDENCE_RESULT_MISSING:${errorContext}`
  );
  const selectedSources = readJson(
    path.join(effectsRoot, "selected-sources.private.json"),
    `REFERENCE_SELECTED_SOURCES_MISSING:${errorContext}`
  );
  const requestedFields = readJson(
    path.join(resultRoot, "requested-fields.private.json"),
    `REFERENCE_REQUESTED_FIELDS_MISSING:${errorContext}`
  );
  return {
    judgements: (materialized.judgements || []).filter(
      (judgement) => judgement.requirementId === requirementId
    ),
    selectedSources: (selectedSources || []).filter(
      (source) => source.requirementId === requirementId
    ),
    requestedFields: (requestedFields.requirements || []).find(
      (result) => result.requirementId === requirementId
    ),
  };
}

function sourceWithDocument(document, source) {
  return `${document.originalName}: ${source}`;
}

function componentAcceptsEffect(component, coverageEffect) {
  if (component.factRole === "EXCLUSION") return coverageEffect === "EXCLUDED";
  if (["LIMIT", "DEDUCTIBLE", "CONDITION"].includes(component.factRole))
    return ["DEFINED", "CONDITIONAL"].includes(coverageEffect);
  return coverageEffect === "INCLUDED";
}

function componentRequestedFields(component) {
  if (Array.isArray(component.requestedFields))
    return component.requestedFields;
  if (component.factRole === "LIMIT") return ["limit"];
  if (component.factRole === "DEDUCTIBLE") return ["deductible"];
  return [];
}

function selectedSourcesValid(entry, judgement) {
  const candidateIds = judgement.selectedCandidateIds || [];
  return (
    candidateIds.length > 0 &&
    candidateIds.every((candidateId) =>
      entry.selectedSources.some(
        (source) =>
          source.candidateId === candidateId &&
          source.requirementId === judgement.requirementId &&
          source.componentId === judgement.componentId &&
          Number.isInteger(source.physicalPageNumber) &&
          source.physicalPageNumber > 0 &&
          String(source.exactText || "").trim().length > 0
      )
    )
  );
}

function normalizedText(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim();
}

function sourceBindsFact(source, fact) {
  if (source.candidateId === fact.source?.candidateId) return true;
  if (
    source.physicalPageNumber !== fact.source?.physicalPageNumber ||
    !Number.isInteger(source.contextDocumentStart) ||
    !Number.isInteger(fact.source?.documentStart) ||
    !Number.isInteger(fact.source?.documentEnd)
  )
    return false;
  const context = normalizedText(source.contextText);
  const exactText = normalizedText(fact.source?.exactText);
  return (
    exactText.length > 0 &&
    context.includes(exactText) &&
    fact.source.documentStart >= source.contextDocumentStart &&
    fact.source.documentEnd <=
      source.contextDocumentStart + String(source.contextText || "").length
  );
}

function requestedFieldsValid(entry, component, judgement) {
  const requestedFields = componentRequestedFields(component);
  if (requestedFields.length === 0) return true;
  const result = entry.requestedFields;
  if (result?.requestedFieldStatus !== "COMPLETE") return false;
  return requestedFields.every((fieldName) => {
    const field = (result.fields || []).find(
      (candidate) => candidate.field === fieldName
    );
    const componentSources = entry.selectedSources.filter(
      (source) =>
        source.componentId === component.id &&
        judgement.selectedCandidateIds.includes(source.candidateId)
    );
    const componentFacts = (field?.facts || []).filter((fact) =>
      componentSources.some((source) => sourceBindsFact(source, fact))
    );
    return (
      field?.status === "FOUND" &&
      componentFacts.length > 0 &&
      componentFacts.every(
        (fact) =>
          Number.isInteger(fact.source?.physicalPageNumber) &&
          fact.source.physicalPageNumber > 0 &&
          String(fact.source?.exactText || "").trim().length > 0
      )
    );
  });
}

function scopeValid(requirement, component, judgement) {
  if (judgement.selectedScopePicture !== "NARROW_ONLY")
    return judgement.selectedScopePicture !== "UNKNOWN";
  if (
    ![
      "MATCHING_SCOPE_DEFINITIVE_SUFFICIENT",
      "MATCHING_SCOPE_INCLUDED_SUFFICIENT",
    ].includes(requirement.scopePolicy)
  )
    return false;
  const scopeKeys = judgement.comparisonScopeKeys || [];
  if (scopeKeys.length === 0) return false;
  if (requirement.scopePolicy === "MATCHING_SCOPE_DEFINITIVE_SUFFICIENT")
    return ["INCLUDED", "EXCLUDED", "DEFINED", "CONDITIONAL"].includes(
      judgement.coverageEffect
    );
  return ["LIMIT", "DEDUCTIBLE", "CONDITION"].includes(component.factRole)
    ? ["DEFINED", "CONDITIONAL"].includes(judgement.coverageEffect)
    : judgement.coverageEffect === "INCLUDED";
}

function decisionReadyEvidence(entry, requirement, component, judgement) {
  return (
    entry.row.reviewStatus !== "UNGEKLÄRT" &&
    judgement.evidencePresence === "FOUND" &&
    judgement.conflictState === "NONE" &&
    (judgement.unresolvedCandidateIds || []).length === 0 &&
    selectedSourcesValid(entry, judgement) &&
    requestedFieldsValid(entry, component, judgement) &&
    scopeValid(requirement, component, judgement)
  );
}

function selectedComponentEvidence(entries, requirement, component) {
  return entries.flatMap((entry) =>
    entry.judgements
      .filter(
        (judgement) =>
          judgement.componentId === component.id &&
          judgement.coverageEffect !== "UNKNOWN" &&
          decisionReadyEvidence(entry, requirement, component, judgement)
      )
      .map((judgement) => ({ document: entry.document, judgement }))
  );
}

function componentEvidenceConflicts(component, selectedEvidence) {
  const effects = new Set(
    selectedEvidence
      .filter(({ judgement }) => judgement.conflictState === "NONE")
      .map(({ judgement }) => judgement.coverageEffect)
  );
  if (!effects.has("EXCLUDED")) return false;
  if (component.factRole === "EXCLUSION") return effects.has("INCLUDED");
  return [...effects].some((effect) =>
    componentAcceptsEffect(component, effect)
  );
}

function packageEvidenceState(entries) {
  const judgements = entries.flatMap(({ judgements }) => judgements);
  if (
    judgements.some(
      ({ conflictState }) => conflictState && conflictState !== "NONE"
    )
  )
    return "CONFLICTING";
  if (
    judgements.some(
      ({ coverageEffect, evidencePresence, unresolvedCandidateIds = [] }) =>
        unresolvedCandidateIds.length > 0 ||
        (evidencePresence === "FOUND" && coverageEffect === "UNKNOWN")
    )
  )
    return "UNRESOLVED";
  return "CLEAR";
}

function controlledNotFound(entries, requirement) {
  return entries.every(({ judgements }) =>
    requirement.components.every((component) => {
      const componentJudgements = judgements.filter(
        (judgement) => judgement.componentId === component.id
      );
      if (componentJudgements.length !== 1) return false;
      const [judgement] = componentJudgements;
      return (
        judgement.evidencePresence === "NOT_FOUND" &&
        judgement.coverageEffect === "UNKNOWN" &&
        judgement.conflictState === "NONE" &&
        (judgement.selectedCandidateIds || []).length === 0 &&
        (judgement.unresolvedCandidateIds || []).length === 0
      );
    })
  );
}

function aggregateCounterpart(entries, requirement) {
  const matched = entries.filter(({ row }) => row.reviewStatus !== "UNGEKLÄRT");
  if (matched.length === 0) {
    const searchCompleteWithoutEvidence = controlledNotFound(
      entries,
      requirement
    );
    return {
      documentedContent: searchCompleteWithoutEvidence
        ? "kein Gegenstück nach kontrollierter Suche gefunden"
        : "Fundlage nicht eindeutig auflösbar",
      coverage: "Nicht feststellbar",
      coverageAmount: "Nicht feststellbar",
      source: searchCompleteWithoutEvidence
        ? "keine belegte Fundstelle gefunden"
        : "keine entscheidungsreife Fundstelle",
      reviewStatus: searchCompleteWithoutEvidence
        ? COUNTERPART_REVIEW_STATUS.CONTROLLED_NOT_FOUND
        : COUNTERPART_REVIEW_STATUS.UNCLEAR,
      contributors: [],
    };
  }
  const coverage = unique(matched.map(({ row }) => row.coverage));
  const amounts = unique(
    matched
      .map(({ row }) => row.coverageAmount)
      .filter((value) => value !== "Nicht feststellbar")
  );
  const selectedEvidence = new Map(
    requirement.components.map((component) => [
      component.id,
      selectedComponentEvidence(entries, requirement, component),
    ])
  );
  const foundComponents = new Set(
    requirement.components
      .filter((component) =>
        selectedEvidence
          .get(component.id)
          .some(
            ({ judgement }) =>
              judgement.conflictState === "NONE" &&
              componentAcceptsEffect(component, judgement.coverageEffect)
          )
      )
      .map(({ id }) => id)
  );
  const packageComponentComplete = requirement.components.every(({ id }) =>
    foundComponents.has(id)
  );
  const packageEvidenceConflicting = requirement.components.some(
    (component) => {
      const componentEvidence = selectedEvidence.get(component.id);
      return (
        componentEvidence.some(
          ({ judgement }) => judgement.conflictState !== "NONE"
        ) || componentEvidenceConflicts(component, componentEvidence)
      );
    }
  );
  const evidenceState = packageEvidenceState(entries);
  return {
    documentedContent: matched
      .map(
        ({ document, row }) =>
          `${document.originalName}: ${row.documentedContent}`
      )
      .join("\n"),
    coverage:
      coverage.length === 1
        ? coverage[0]
        : coverage.every((value) => value !== "Nicht feststellbar")
          ? "Gemischt"
          : "Nicht feststellbar",
    coverageAmount:
      amounts.length === 0 ? "Nicht feststellbar" : amounts.join(" · "),
    source: matched
      .map(({ document, row }) => sourceWithDocument(document, row.source))
      .join("\n"),
    reviewStatus:
      packageEvidenceConflicting || evidenceState === "CONFLICTING"
        ? "WIDERSPRÜCHLICH"
        : evidenceState === "UNRESOLVED"
          ? COUNTERPART_REVIEW_STATUS.UNCLEAR
          : packageComponentComplete
            ? "BELEGT"
            : "TEILBELEGT",
    contributors: matched.map(({ document, row }) => ({
      documentUuid: document.uuid,
      documentName: document.originalName,
      documentStatus: document.documentStatus,
      reviewStatus: row.reviewStatus,
      source: row.source,
    })),
  };
}

function referenceDecision(reference, counterpart) {
  if (reference.reviewStatus !== "BELEGT")
    return {
      outcome: REFERENCE_OUTCOME.REFERENCE_UNCLEAR,
      reasonCode: "REFERENCE_ROW_NOT_FULLY_EVIDENCED",
      reason:
        "Die LF-IMMO-Referenzzeile ist nicht vollständig belegt; daraus wird kein belastbares Gegenstück abgeleitet.",
      reviewRequired: true,
      ruleId: "REFERENCE_A_ELIGIBILITY_V2",
    };
  if (counterpart.reviewStatus === "BELEGT")
    return {
      outcome: REFERENCE_OUTCOME.FOUND,
      reasonCode: "ALL_REFERENCE_COMPONENTS_EVIDENCED_IN_B",
      reason:
        "Für alle verpflichtenden Komponenten der LF-IMMO-Zeile liegt im Paket B ein belegtes Gegenstück vor.",
      reviewRequired: false,
      ruleId: "REFERENCE_COMPONENT_COMPLETENESS_V2",
    };
  if (counterpart.reviewStatus === "TEILBELEGT")
    return {
      outcome: REFERENCE_OUTCOME.PARTIAL,
      reasonCode: "ONLY_PART_OF_REFERENCE_COMPONENTS_EVIDENCED_IN_B",
      reason:
        "Im Paket B ist nur ein Teil der verpflichtenden LF-IMMO-Komponenten belegt.",
      reviewRequired: true,
      ruleId: "REFERENCE_COMPONENT_COMPLETENESS_V2",
    };
  if (
    counterpart.reviewStatus === COUNTERPART_REVIEW_STATUS.CONTROLLED_NOT_FOUND
  )
    return {
      outcome: REFERENCE_OUTCOME.NOT_FOUND,
      reasonCode: "CONTROLLED_SEARCH_COMPLETE_WITHOUT_B_EVIDENCE",
      reason:
        "Die kontrollierte Suche über alle zugeordneten B-Dokumente fand für diese LF-IMMO-Zeile keinen belastbaren Beleg. Das ist kein ausdrücklicher Ausschluss.",
      reviewRequired: false,
      ruleId: "REFERENCE_CONTROLLED_ZERO_RESULT_V2",
    };
  return {
    outcome: REFERENCE_OUTCOME.UNCLEAR,
    reasonCode: "COUNTERPART_EVIDENCE_CONFLICTING_OR_UNRESOLVED",
    reason:
      "Die Fundlage im Paket B ist widersprüchlich oder nicht eindeutig auflösbar.",
    reviewRequired: true,
    ruleId: "REFERENCE_FAIL_CLOSED_V2",
  };
}

function deriveTotals(categories) {
  const rows = categories.flatMap(({ rows }) => rows);
  const outcomes = Object.fromEntries(
    Object.values(REFERENCE_OUTCOME).map((outcome) => [outcome, 0])
  );
  for (const row of rows) outcomes[row.pointDecision.outcome] += 1;
  return {
    rows: rows.length,
    categories: categories.length,
    referenceRowsAnalyzed: rows.length,
    sideBOnlyRows: 0,
    customerReviewRequired: rows.filter(
      ({ pointDecision }) => pointDecision.reviewRequired
    ).length,
    outcomes,
  };
}

function buildReferenceComparisonResult(documentRuns, metadata = {}) {
  const sideA = documentRuns.filter(({ document }) => document.side === "A");
  const sideB = documentRuns.filter(({ document }) => document.side === "B");
  if (sideA.length !== 1)
    throw new Error("REFERENCE_COMPARISON_EXACTLY_ONE_A_REQUIRED");
  if (sideB.length === 0)
    throw new Error("REFERENCE_COMPARISON_SIDE_B_REQUIRED");
  const categories = categoryCatalogs().map((definition) => {
    const referenceRows = readRows(sideA[0], definition.categoryView);
    if (referenceRows.length !== definition.catalog.requirements.length)
      throw new Error(
        `REFERENCE_ROW_COUNT_INVALID:${definition.categoryView}:${referenceRows.length}/${definition.catalog.requirements.length}`
      );
    const rows = definition.catalog.requirements.map((requirement, index) => {
      const reference = referenceRows[index];
      if (reference?.categoryId !== requirement.id)
        throw new Error(
          `REFERENCE_ROW_ORDER_INVALID:${definition.categoryView}:${requirement.id}`
        );
      const counterpartEntries = sideB.map((run) => {
        const row = readRows(run, definition.categoryView).find(
          (candidate) => candidate.categoryId === requirement.id
        );
        if (!row)
          throw new Error(
            `REFERENCE_B_ROW_MISSING:${run.document.uuid}:${requirement.id}`
          );
        return {
          document: run.document,
          row,
          ...readEvidenceBundle(run, definition.categoryView, requirement.id),
        };
      });
      const counterpart = aggregateCounterpart(counterpartEntries, requirement);
      const pointDecision = referenceDecision(reference, counterpart);
      return {
        categoryId: requirement.sourceReferenceId,
        analysisRowId: requirement.id,
        stage: reference.stage,
        categoryName: reference.categoryName,
        packageA: {
          ...reference,
          documentUuid: sideA[0].document.uuid,
          documentName: sideA[0].document.originalName,
        },
        packageB: counterpart,
        outcome: pointDecision.outcome,
        pointDecision,
      };
    });
    return {
      categoryView: definition.sourceCategoryId,
      categoryName: definition.label,
      rows,
    };
  });
  const result = {
    schemaVersion: REFERENCE_RESULT_SCHEMA_VERSION,
    contractId: REFERENCE_RESULT_CONTRACT_ID,
    status: "REFERENCE_COMPARISON_RESULT_MATERIALIZED",
    comparisonMode: POLICY_COMPARISON_MODE.LF_REFERENCE_A_TO_B,
    generatedAt: new Date().toISOString(),
    ...metadata,
    productProfile: LF_REFERENCE_PROFILE,
    documents: documentRuns.map(({ document }) => ({
      uuid: document.uuid,
      side: document.side,
      role: document.role,
      documentStatus: document.documentStatus,
      originalName: document.originalName,
      sha256: document.sha256,
    })),
    categories,
    totals: deriveTotals(categories),
    proofLimit:
      "Gerichteter LF-IMMO-Referenzvergleich mit 10 Kategorien und 35 versionierten Referenzzeilen. Es werden ausschließlich Gegenstücke zu belegten A-Zeilen gesucht; Inhalte nur in B erzeugen keine Zeile. Ein kontrollierter Nullfund ist kein ausdrücklicher Ausschluss. Der 35-Zeilen-Katalog ist noch keine fachlich vollständige Inventarisierung des gesamten LF-IMMO-Produkts.",
  };
  validateReferenceComparison(result);
  return result;
}

function validateReferenceComparison(result) {
  if (
    result?.schemaVersion !== REFERENCE_RESULT_SCHEMA_VERSION ||
    result?.contractId !== REFERENCE_RESULT_CONTRACT_ID ||
    result?.comparisonMode !== POLICY_COMPARISON_MODE.LF_REFERENCE_A_TO_B ||
    JSON.stringify(result?.productProfile) !==
      JSON.stringify(LF_REFERENCE_PROFILE)
  )
    throw new Error("REFERENCE_RESULT_CONTRACT_INVALID");
  const sideA = (result.documents || []).filter(({ side }) => side === "A");
  const sideB = (result.documents || []).filter(({ side }) => side === "B");
  if (sideA.length !== 1 || sideB.length === 0)
    throw new Error("REFERENCE_RESULT_DOCUMENT_SET_INVALID");
  const expected = categoryCatalogs();
  if (
    !Array.isArray(result.categories) ||
    result.categories.length !== expected.length
  )
    throw new Error("REFERENCE_RESULT_CATEGORY_COUNT_INVALID");
  const rows = result.categories.flatMap(({ rows }) => rows || []);
  const expectedIds = expected.flatMap(({ catalog }) =>
    catalog.requirements.map(({ sourceReferenceId }) => sourceReferenceId)
  );
  if (
    rows.length !== LF_REFERENCE_PROFILE.rowCount ||
    rows.some((row, index) => row.categoryId !== expectedIds[index]) ||
    new Set(rows.map(({ categoryId }) => categoryId)).size !== rows.length
  )
    throw new Error("REFERENCE_RESULT_ROW_SET_INVALID");
  if (
    rows.some(
      (row) =>
        !Object.values(REFERENCE_OUTCOME).includes(
          row.pointDecision?.outcome
        ) ||
        row.outcome !== row.pointDecision?.outcome ||
        row.packageA?.documentUuid !== sideA[0].uuid ||
        !Array.isArray(row.packageB?.contributors) ||
        row.packageB.contributors.some(
          ({ documentUuid }) =>
            !result.documents.some(
              (document) =>
                document.uuid === documentUuid && document.side === "B"
            )
        )
    )
  )
    throw new Error("REFERENCE_RESULT_ROW_INVALID");
  const derived = deriveTotals(result.categories);
  if (JSON.stringify(derived) !== JSON.stringify(result.totals))
    throw new Error("REFERENCE_RESULT_TOTALS_INVALID");
  return result;
}

function customerSafeReferenceReadView(result) {
  validateReferenceComparison(result);
  return JSON.parse(JSON.stringify(result));
}

function markdownResult(result) {
  const lines = [
    "# LF-IMMO-Referenzvergleich A → B",
    "",
    `Analysierte LF-Zeilen: ${result.totals.referenceRowsAnalyzed}; B-only-Zeilen: 0.`,
    "",
    result.proofLimit,
    "",
  ];
  for (const category of result.categories) {
    lines.push(
      `## ${category.categoryView} · ${category.categoryName}`,
      "",
      "| LF-Zeile | Referenzinhalt A | Gegenstück B | Ergebnis |",
      "|---|---|---|---|"
    );
    for (const row of category.rows)
      lines.push(
        `| ${row.categoryId} | ${row.packageA.documentedContent.replace(/\|/gu, "\\|")} | ${row.packageB.documentedContent.replace(/\|/gu, "\\|")} | ${row.pointDecision.outcome} |`
      );
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

async function writeWorkbook(result, outputFile) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Polizzenvergleich V3";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("LF Referenz A nach B");
  sheet.views = [{ state: "frozen", ySplit: 1, zoomScale: 80 }];
  sheet.columns = [
    { header: "LF_Kategorie", key: "category", width: 14 },
    { header: "LF_Zeilen-ID", key: "id", width: 16 },
    { header: "LF_Prüfpunkt", key: "name", width: 48 },
    { header: "A_Vertragsinhalt", key: "aContent", width: 45 },
    { header: "A_Deckung", key: "aCoverage", width: 18 },
    { header: "A_Quelle", key: "aSource", width: 42 },
    { header: "B_Gegenstück", key: "bContent", width: 48 },
    { header: "B_Deckung", key: "bCoverage", width: 18 },
    { header: "B_Quelle", key: "bSource", width: 45 },
    { header: "Gegenstückstatus", key: "outcome", width: 38 },
    { header: "Begründung", key: "reason", width: 48 },
  ];
  for (const category of result.categories)
    for (const row of category.rows)
      sheet.addRow({
        category: category.categoryView,
        id: row.categoryId,
        name: row.categoryName,
        aContent: row.packageA.documentedContent,
        aCoverage: row.packageA.coverage,
        aSource: row.packageA.source,
        bContent: row.packageB.documentedContent,
        bCoverage: row.packageB.coverage,
        bSource: row.packageB.source,
        outcome: row.pointDecision.outcome,
        reason: row.pointDecision.reason,
      });
  sheet.autoFilter = `A1:K${sheet.rowCount}`;
  sheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.font = { name: "Aptos Narrow", size: 11, bold: rowNumber === 1 };
      cell.alignment = { vertical: "top", wrapText: true };
    });
    if (rowNumber > 1) row.height = 72;
  });
  await workbook.xlsx.writeFile(outputFile);
  fs.chmodSync(outputFile, 0o600);
}

async function writeReferenceComparisonArtifacts({
  documentRuns,
  outputDirectory,
  metadata,
}) {
  fs.mkdirSync(outputDirectory, { recursive: true, mode: 0o700 });
  const result = buildReferenceComparisonResult(documentRuns, metadata);
  const jsonFile = path.join(outputDirectory, "comparison.private.json");
  const markdownFile = path.join(outputDirectory, "comparison.md");
  const workbookFile = path.join(outputDirectory, "polizzenvergleich.xlsx");
  fs.writeFileSync(jsonFile, JSON.stringify(result, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.writeFileSync(markdownFile, markdownResult(result), {
    encoding: "utf8",
    mode: 0o600,
  });
  await writeWorkbook(result, workbookFile);
  return { result, jsonFile, markdownFile, workbookFile };
}

module.exports = {
  REFERENCE_OUTCOME,
  REFERENCE_RESULT_CONTRACT_ID,
  buildReferenceComparisonResult,
  customerSafeReferenceReadView,
  validateReferenceComparison,
  writeReferenceComparisonArtifacts,
};

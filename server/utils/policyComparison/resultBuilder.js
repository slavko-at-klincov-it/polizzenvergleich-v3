const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const {
  applyHeaderStyle,
  applyZebraStriping,
  freezePanes,
} = require("../agents/aibitat/plugins/create-files/xlsx/utils");
const { POINT_OUTCOME, decidePoint } = require("./pointDecision");

const CATEGORY_ORDER = Object.freeze([
  "VS",
  "FE",
  "LW",
  "ST",
  "EL",
  "HP",
  "VB",
  "WE",
]);
const MISSING_EVIDENCE = "keine belegte Fundstelle gefunden";
const NOT_DETERMINABLE = "Nicht feststellbar";

function normalized(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim()
    .toLocaleLowerCase("de-AT");
}

function isEvidenceRow(row) {
  return !(
    normalized(row?.documentedContent) === normalized(MISSING_EVIDENCE) &&
    normalized(row?.source) === normalized(MISSING_EVIDENCE)
  );
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function decimalParts(value) {
  const compact = String(value || "")
    .replace(/[\s\u00a0]/gu, "")
    .trim();
  if (!/^\d[\d.,]*$/u.test(compact)) return null;
  const lastComma = compact.lastIndexOf(",");
  const lastDot = compact.lastIndexOf(".");
  let decimalSeparator = null;
  if (lastComma >= 0 && lastDot >= 0)
    decimalSeparator = lastComma > lastDot ? "," : ".";
  else if (lastComma >= 0 && compact.length - lastComma - 1 <= 2)
    decimalSeparator = ",";
  else if (lastDot >= 0 && compact.length - lastDot - 1 <= 2)
    decimalSeparator = ".";
  const parts = decimalSeparator
    ? compact.split(decimalSeparator)
    : [compact, ""];
  const integerDigits = parts[0].replace(/[.,]/gu, "");
  const decimalDigits = String(parts[1] || "").replace(/[.,]/gu, "");
  if (!integerDigits || integerDigits.length > 30 || decimalDigits.length > 2)
    return null;
  return {
    integer: BigInt(integerDigits),
    fraction: BigInt(decimalDigits.padEnd(2, "0") || "0"),
  };
}

function singleCurrencyAmount(value) {
  const text = String(value || "");
  const matches = [
    ...text.matchAll(/(?:EUR|\u20ac)\s*([0-9][0-9.,\s\u00a0]*)/giu),
    ...text.matchAll(/([0-9][0-9.,\s\u00a0]*)\s*(?:EUR|\u20ac)/giu),
  ];
  const amounts = unique(
    matches
      .map((match) => decimalParts(match[1]))
      .filter(Boolean)
      .map(({ integer, fraction }) => `${integer * 100n + fraction}`)
  );
  return amounts.length === 1 ? BigInt(amounts[0]) : null;
}

function singlePercentage(value) {
  const percentages = unique(
    [...String(value || "").matchAll(/([0-9]+(?:[.,][0-9]{1,2})?)\s*%/gu)]
      .map((match) => decimalParts(match[1]))
      .filter(Boolean)
      .map(({ integer, fraction }) => `${integer * 100n + fraction}`)
  );
  return percentages.length === 1 ? BigInt(percentages[0]) : null;
}

function nativeAmountKey(value) {
  const currency = singleCurrencyAmount(value);
  if (currency !== null) return `EUR:${currency}`;
  const percentage = singlePercentage(value);
  if (percentage !== null) return `PERCENT:${percentage}`;
  return `TEXT:${normalized(value)}`;
}

function clauseCodes(fact) {
  return unique(
    [
      ...`${fact.documentedContent || ""}\n${fact.source || ""}`.matchAll(
        /\b\d{2}[A-Z]{2}\d{4}\b/gu
      ),
    ].map(([code]) => code)
  );
}

function sharedClauseCodes(facts) {
  const sets = facts.map((fact) => new Set(clauseCodes(fact)));
  if (sets.length === 0) return [];
  return [...sets[0]].filter((code) =>
    sets.slice(1).every((set) => set.has(code))
  );
}

function amountQualifier(fact) {
  const text = `${fact.coverageAmount || ""}\n${fact.source || ""}`;
  const qualifiers = [];
  if (/\b(?:Jahresh[oö]chst|pro\s+Jahr|je\s+Versicherungsjahr)\b/iu.test(text))
    qualifiers.push("ANNUAL");
  if (/\b(?:je|pro)\s+(?:Schadenfall|Ereignis)\b/iu.test(text))
    qualifiers.push("EVENT");
  if (/\bauf\s+[,„“"']*Erstes\s+Risiko\b/iu.test(text))
    qualifiers.push("FIRST_RISK");
  return qualifiers.sort().join("+") || "GENERAL";
}

function newBuildingValueBases(referenceEntries) {
  return unique(
    (referenceEntries || [])
      .filter(({ row }) => isEvidenceRow(row))
      .filter(({ row }) => row.reviewStatus === "BELEGT")
      .filter(({ row }) => row.categoryId === "VS-01")
      .filter(({ row }) =>
        /\b(?:NBW|Neubauwert|Wohngeb[aä]ude\s+zum\s+Neuwert)\b/iu.test(
          `${row.documentedContent || ""}\n${row.source || ""}`
        )
      )
      .map(({ row }) => singleCurrencyAmount(row.coverageAmount))
      .filter((value) => value !== null)
      .map(String)
  ).map(BigInt);
}

function canonicalAmountKeys(facts, referenceEntries) {
  const commonClauseCodes = sharedClauseCodes(
    facts.filter(
      ({ coverageAmount }) =>
        normalized(coverageAmount) !== normalized(NOT_DETERMINABLE)
    )
  );
  const commonClauseKey = commonClauseCodes.join(",");
  const values = facts
    .filter(
      ({ coverageAmount }) =>
        normalized(coverageAmount) !== normalized(NOT_DETERMINABLE)
    )
    .map((fact) => ({
      fact,
      nativeKey: nativeAmountKey(fact.coverageAmount),
    }));
  const preserveClauseQualifier =
    values.length > 0 &&
    values.every(({ fact }) => amountQualifier(fact) !== "GENERAL");
  const canonicalQualifier = (fact) =>
    preserveClauseQualifier ? amountQualifier(fact) : "GENERAL";
  const bases = newBuildingValueBases(referenceEntries);
  const currencyTargets = [
    ...new Map(
      values
        .filter(({ nativeKey }) => nativeKey.startsWith("EUR:"))
        .map(({ fact, nativeKey }) => {
          const amount = nativeKey.slice(4);
          const qualifier = canonicalQualifier(fact);
          return [
            `${amount}:${qualifier}`,
            { amount: BigInt(amount), qualifier },
          ];
        })
    ).values(),
  ];

  return values.map(({ fact, nativeKey }) => {
    if (!nativeKey.startsWith("PERCENT:"))
      return commonClauseKey
        ? `CLAUSE:${commonClauseKey}:${nativeKey}:QUALIFIER:${canonicalQualifier(fact)}`
        : `${nativeKey}:QUALIFIER:${amountQualifier(fact)}`;
    if (
      !commonClauseKey ||
      !/\b(?:des\s+NBW|vom\s+NBW|des\s+Neubauwerts?)\b/iu.test(
        `${fact.documentedContent || ""}\n${fact.source || ""}`
      )
    )
      return commonClauseKey
        ? `CLAUSE:${commonClauseKey}:${nativeKey}:QUALIFIER:${canonicalQualifier(fact)}`
        : `${nativeKey}:QUALIFIER:${amountQualifier(fact)}`;
    const percentageHundredths = BigInt(nativeKey.slice("PERCENT:".length));
    const matchingTargets = unique(
      bases
        .flatMap((base) =>
          currencyTargets.filter(({ amount }) => {
            const numerator = base * percentageHundredths;
            const rounded = (numerator + 5_000n) / 10_000n;
            return rounded === amount;
          })
        )
        .map(({ amount, qualifier }) => `${amount}:${qualifier}`)
    );
    return matchingTargets.length === 1
      ? `CLAUSE:${commonClauseKey}:EUR:${matchingTargets[0].replace(":", ":QUALIFIER:")}`
      : `CLAUSE:${commonClauseKey}:${nativeKey}:QUALIFIER:${canonicalQualifier(fact)}`;
  });
}

function roleLabel(role) {
  return (
    {
      MAIN_POLICY: "Hauptpolizze",
      SUPPLEMENT: "Zusatzvertrag",
      ENDORSEMENT: "Nachtrag / Änderung",
      TERMS: "Bedingungen",
      OTHER: "Sonstiges",
    }[role] || role
  );
}

function summarizePackage(entries, { referenceEntries = entries } = {}) {
  const evidenceEntries = entries.filter(({ row }) => isEvidenceRow(row));
  if (evidenceEntries.length === 0)
    return {
      evidenceFound: false,
      documentedContent: MISSING_EVIDENCE,
      coverage: NOT_DETERMINABLE,
      coverageAmount: NOT_DETERMINABLE,
      source: MISSING_EVIDENCE,
      reviewStatus: "UNGEKLÄRT",
      facts: [],
    };

  const facts = evidenceEntries.map(({ document, row }) => ({
    documentUuid: document.uuid,
    documentName: document.originalName,
    role: document.role,
    documentStatus: document.documentStatus,
    documentedContent: row.documentedContent,
    coverage: row.coverage,
    coverageAmount: row.coverageAmount,
    source: row.source,
    reviewStatus: row.reviewStatus,
  }));
  const coverageValues = unique(
    facts
      .map(({ coverage }) => coverage)
      .filter((value) => normalized(value) !== normalized(NOT_DETERMINABLE))
  );
  const amountValues = unique(
    facts
      .map(({ coverageAmount }) => coverageAmount)
      .filter((value) => normalized(value) !== normalized(NOT_DETERMINABLE))
  );
  const amountKeys = unique(canonicalAmountKeys(facts, referenceEntries));
  const unresolvedPrecedence =
    coverageValues.length > 1 || amountKeys.length > 1;
  const reviewStatus = facts.some(
    ({ reviewStatus: status }) => status === "WIDERSPRÜCHLICH"
  )
    ? "WIDERSPRÜCHLICH"
    : unresolvedPrecedence
      ? "RANGFOLGE_PRÜFEN"
      : facts.every(({ reviewStatus: status }) => status === "BELEGT")
        ? "BELEGT"
        : "TEILBELEGT";

  return {
    evidenceFound: true,
    documentedContent: facts
      .map(
        (fact) =>
          `[${fact.documentName} · ${roleLabel(fact.role)}] ${fact.documentedContent}`
      )
      .join("\n"),
    coverage:
      coverageValues.length === 0
        ? NOT_DETERMINABLE
        : coverageValues.length === 1
          ? coverageValues[0]
          : "Mehrere dokumentbezogene Werte – Rangfolge prüfen",
    coverageAmount:
      amountKeys.length === 0
        ? NOT_DETERMINABLE
        : amountKeys.length === 1
          ? amountValues.reduce(
              (selected, candidate) =>
                candidate.length > selected.length ? candidate : selected,
              amountValues[0]
            )
          : "Mehrere dokumentbezogene Werte – Rangfolge prüfen",
    source: facts
      .map(
        (fact) =>
          `[${fact.documentName} · ${roleLabel(fact.role)}] ${fact.source}`
      )
      .join("\n"),
    reviewStatus,
    facts,
  };
}

function comparable(packageSummary) {
  return packageSummary.facts
    .map((fact) => ({
      documentedContent: normalized(fact.documentedContent),
      coverage: normalized(fact.coverage),
      coverageAmount: normalized(fact.coverageAmount),
      documentStatus: fact.documentStatus,
    }))
    .sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right), "de-AT")
    );
}

function comparePackages(packageA, packageB) {
  if (!packageA.evidenceFound && !packageB.evidenceFound)
    return {
      outcome: "BEIDSEITIG_KEIN_BELEG",
      difference:
        "Beidseitig keine belegte Fundstelle; daraus folgt keine Deckungsaussage.",
    };
  if (packageA.evidenceFound && !packageB.evidenceFound)
    return {
      outcome: "NUR_A_BELEGT",
      difference:
        "Nur Paket A enthält belegten Inhalt. Ein automatischer Vorteilsschluss ist nicht zulässig.",
    };
  if (!packageA.evidenceFound && packageB.evidenceFound)
    return {
      outcome: "NUR_B_BELEGT",
      difference:
        "Nur Paket B enthält belegten Inhalt. Ein automatischer Vorteilsschluss ist nicht zulässig.",
    };
  if (
    JSON.stringify(comparable(packageA)) ===
    JSON.stringify(comparable(packageB))
  )
    return {
      outcome: "INHALTLICH_GLEICH",
      difference:
        "Die belegten dokumentbezogenen Werte sind in beiden Paketen gleich.",
    };
  return {
    outcome: "UNTERSCHIED_FACHLICH_PRÜFEN",
    difference:
      "Die belegten Inhalte unterscheiden sich. Vorteil, Rangfolge und Vertragswirkung sind fachlich zu prüfen.",
  };
}

function readJsonIfPresent(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function materializeAtomicFacts({
  document,
  worksheet,
  materializedEvidence,
  requestedFields,
  targets,
}) {
  if (!worksheet || !materializedEvidence || !requestedFields || !targets)
    return [];
  const requirements = new Map(
    (worksheet.requirements || []).map((requirement) => [
      requirement.id,
      requirement,
    ])
  );
  const fieldResults = new Map(
    (requestedFields.requirements || []).map((requirement) => [
      requirement.requirementId,
      requirement,
    ])
  );
  const targetsById = new Map(
    (targets || []).map((target) => [target.targetId, target])
  );
  return (materializedEvidence.judgements || []).map((judgement) => {
    const requirement = requirements.get(judgement.requirementId);
    const component = requirement?.components?.find(
      ({ id }) => id === judgement.componentId
    );
    const fieldResult = fieldResults.get(judgement.requirementId) || {
      requestedFieldStatus: "NOT_EVALUATED",
      fields: [],
    };
    const selectedCandidateIds = judgement.selectedCandidateIds || [];
    const selectedSet = new Set(selectedCandidateIds);
    const fields = (fieldResult.fields || []).map((field) => {
      const facts = (field.facts || []).filter((fact) =>
        selectedSet.has(fact.source?.candidateId)
      );
      return {
        field: field.field,
        status: facts.length > 0 ? field.status : "NOT_FOUND",
        facts,
      };
    });
    const target = targetsById.get(judgement.targetId);
    const sources = (target?.candidates || [])
      .filter(({ candidateId }) => selectedSet.has(candidateId))
      .map(
        ({ candidateId, physicalPageNumber, printedPageLabel, exactText }) => ({
          candidateId,
          physicalPageNumber,
          printedPageLabel,
          exactText,
        })
      );
    return {
      requirementId: judgement.requirementId,
      componentId: judgement.componentId,
      componentLabel: component?.label || judgement.componentId,
      factRole: component?.factRole || target?.factRole || "UNKNOWN",
      documentUuids: [document.uuid],
      documentRole: document.role,
      documentStatus: document.documentStatus,
      evidencePresence: judgement.evidencePresence,
      coverageEffect: judgement.coverageEffect,
      conflictState: judgement.conflictState,
      selectedScopePicture: judgement.selectedScopePicture,
      documentApplicability: judgement.documentApplicability,
      selectedCandidateIds,
      unresolvedCandidateIds: judgement.unresolvedCandidateIds || [],
      requestedFieldStatus: fieldResult.requestedFieldStatus,
      fields,
      sources,
    };
  });
}

function readDocumentAnalysis(documentRun) {
  const categories = {};
  const atomicFacts = {};
  for (const categoryView of CATEGORY_ORDER) {
    const categoryDirectory = path.join(
      documentRun.outputDirectory,
      categoryView
    );
    const file = path.join(categoryDirectory, "result", "rows.private.json");
    if (!fs.existsSync(file))
      throw new Error(
        `COMPARISON_CATEGORY_RESULT_MISSING:${documentRun.document.uuid}:${categoryView}`
      );
    categories[categoryView] = JSON.parse(fs.readFileSync(file, "utf8"));
    atomicFacts[categoryView] = materializeAtomicFacts({
      document: documentRun.document,
      worksheet: readJsonIfPresent(
        path.join(categoryDirectory, "worksheet.private.json")
      ),
      materializedEvidence: readJsonIfPresent(
        path.join(categoryDirectory, "effects", "materialized.private.json")
      ),
      requestedFields: readJsonIfPresent(
        path.join(categoryDirectory, "result", "requested-fields.private.json")
      ),
      targets: readJsonIfPresent(
        path.join(categoryDirectory, "effects", "targets.private.json")
      ),
    });
  }
  return { categories, atomicFacts };
}

function buildComparisonResult(documentRuns, metadata = {}) {
  const loadedRuns = documentRuns.map((run) => ({
    ...run,
    ...readDocumentAnalysis(run),
  }));
  const packageEntries = Object.fromEntries(
    ["A", "B"].map((side) => [
      side,
      loadedRuns
        .filter(({ document }) => document.side === side)
        .flatMap(({ document, categories }) =>
          CATEGORY_ORDER.flatMap((categoryView) =>
            categories[categoryView].map((row) => ({ document, row }))
          )
        ),
    ])
  );
  const categories = CATEGORY_ORDER.map((categoryView) => {
    const byDocument = loadedRuns.map((run) => ({
      document: run.document,
      rows: run.categories[categoryView],
    }));
    const rowIds =
      byDocument[0]?.rows.map(({ categoryId }) => categoryId) || [];
    const rows = rowIds.map((categoryId) => {
      const entries = byDocument.map(({ document, rows: documentRows }) => {
        const row = documentRows.find(
          (candidate) => candidate.categoryId === categoryId
        );
        if (!row)
          throw new Error(
            `COMPARISON_ROW_MISSING:${document.uuid}:${categoryId}`
          );
        return { document, row };
      });
      const first = entries[0].row;
      const packageA = summarizePackage(
        entries.filter(({ document }) => document.side === "A"),
        { referenceEntries: packageEntries.A }
      );
      const packageB = summarizePackage(
        entries.filter(({ document }) => document.side === "B"),
        { referenceEntries: packageEntries.B }
      );
      const comparison = comparePackages(packageA, packageB);
      const pointDecision = decidePoint({
        categoryId,
        packageA,
        packageB,
        atomsA: loadedRuns
          .filter(({ document }) => document.side === "A")
          .flatMap(({ atomicFacts }) => atomicFacts[categoryView] || []),
        atomsB: loadedRuns
          .filter(({ document }) => document.side === "B")
          .flatMap(({ atomicFacts }) => atomicFacts[categoryView] || []),
      });
      return {
        categoryId,
        stage: first.stage,
        categoryName: first.categoryName,
        packageA,
        packageB,
        ...comparison,
        pointDecision,
      };
    });
    return { categoryView, rows };
  });
  return {
    schemaVersion: 2,
    status: "TECHNICAL_RESULT_REVIEW_REQUIRED",
    generatedAt: new Date().toISOString(),
    ...metadata,
    documents: loadedRuns.map(({ document }) => ({
      uuid: document.uuid,
      side: document.side,
      role: document.role,
      documentStatus: document.documentStatus,
      originalName: document.originalName,
      sha256: document.sha256,
    })),
    categories,
    totals: {
      rows: categories.reduce((sum, category) => sum + category.rows.length, 0),
      reviewRequired: categories.reduce(
        (sum, category) =>
          sum +
          category.rows.filter(
            ({ outcome }) =>
              !["INHALTLICH_GLEICH", "BEIDSEITIG_KEIN_BELEG"].includes(outcome)
          ).length,
        0
      ),
      pointDecisions: Object.fromEntries(
        Object.values(POINT_OUTCOME).map((outcome) => [
          outcome,
          categories.reduce(
            (sum, category) =>
              sum +
              category.rows.filter(
                ({ pointDecision }) => pointDecision.outcome === outcome
              ).length,
            0
          ),
        ])
      ),
      pointDecisionReviewRequired: categories.reduce(
        (sum, category) =>
          sum +
          category.rows.filter(
            ({ pointDecision }) => pointDecision.reviewRequired
          ).length,
        0
      ),
    },
    proofLimit:
      "Punktweise, regelgebundene Vergleichsentscheidung. Es gibt keinen Gesamtsieger; Dokumentrang, Ersatzwirkung und unvollständige Fakten bleiben sichtbar prüfpflichtig.",
  };
}

function markdownResult(result) {
  const lines = [
    "# Polizzenvergleich A/B",
    "",
    `Status: ${result.status}`,
    "",
    `Zeilen: ${result.totals.rows}; fachlich zu prüfende Unterschiede: ${result.totals.reviewRequired}.`,
    "",
    result.proofLimit,
    "",
  ];
  for (const category of result.categories) {
    lines.push(
      `## ${category.categoryView}`,
      "",
      "| Kategorie-ID | Kategorie | Paket A | A-Prüfstatus | A-Quellen | Paket B | B-Prüfstatus | B-Quellen | Punktentscheidung | Begründung | Technischer Prüfhinweis |",
      "|---|---|---|---|---|---|---|---|---|---|---|"
    );
    for (const row of category.rows) {
      const cells = [
        row.categoryId,
        row.categoryName,
        row.packageA.documentedContent,
        row.packageA.reviewStatus,
        row.packageA.source,
        row.packageB.documentedContent,
        row.packageB.reviewStatus,
        row.packageB.source,
        row.pointDecision.outcome,
        row.pointDecision.reason,
        row.difference,
      ].map((value) =>
        String(value || "")
          .replace(/\r?\n/gu, "<br>")
          .replace(/\|/gu, "\\|")
      );
      lines.push(`| ${cells.join(" | ")} |`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

async function writeWorkbook(result, outputFile) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Polizzenvergleich V3";
  workbook.created = new Date();
  for (const category of result.categories) {
    const sheet = workbook.addWorksheet(category.categoryView);
    sheet.columns = [
      { header: "Kategorie-ID", key: "categoryId", width: 15 },
      { header: "Stufe", key: "stage", width: 12 },
      { header: "Kategorie-Name", key: "categoryName", width: 35 },
      { header: "Paket A – Vertragsinhalt", key: "aContent", width: 70 },
      { header: "A – Deckung", key: "aCoverage", width: 24 },
      { header: "A – Deckungssumme", key: "aAmount", width: 24 },
      { header: "A – Quellen", key: "aSource", width: 55 },
      { header: "A – Prüfstatus", key: "aReview", width: 20 },
      { header: "Paket B – Vertragsinhalt", key: "bContent", width: 70 },
      { header: "B – Deckung", key: "bCoverage", width: 24 },
      { header: "B – Deckungssumme", key: "bAmount", width: 24 },
      { header: "B – Quellen", key: "bSource", width: 55 },
      { header: "B – Prüfstatus", key: "bReview", width: 20 },
      { header: "Unterschied / Prüfhinweis", key: "difference", width: 60 },
      { header: "Vergleichsstatus", key: "outcome", width: 30 },
      { header: "Punktentscheidung", key: "pointDecision", width: 24 },
      {
        header: "Entscheidungsbegründung",
        key: "pointDecisionReason",
        width: 65,
      },
      { header: "Entscheidungsregel", key: "pointDecisionRule", width: 38 },
    ];
    for (const row of category.rows) {
      sheet.addRow({
        categoryId: row.categoryId,
        stage: row.stage,
        categoryName: row.categoryName,
        aContent: row.packageA.documentedContent,
        aCoverage: row.packageA.coverage,
        aAmount: row.packageA.coverageAmount,
        aSource: row.packageA.source,
        aReview: row.packageA.reviewStatus,
        bContent: row.packageB.documentedContent,
        bCoverage: row.packageB.coverage,
        bAmount: row.packageB.coverageAmount,
        bSource: row.packageB.source,
        bReview: row.packageB.reviewStatus,
        difference: row.difference,
        outcome: row.outcome,
        pointDecision: row.pointDecision.outcome,
        pointDecisionReason: row.pointDecision.reason,
        pointDecisionRule: row.pointDecision.ruleId,
      });
    }
    applyHeaderStyle(sheet, { fill: "FF1E3A5F", fontColor: "FFFFFFFF" });
    applyZebraStriping(sheet, "FFF3F6FA");
    freezePanes(sheet, 1, 3);
    sheet.autoFilter = { from: "A1", to: "R1" };
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      row.alignment = { vertical: "top", wrapText: true };
    });
  }
  await workbook.xlsx.writeFile(outputFile);
  fs.chmodSync(outputFile, 0o600);
}

async function writeComparisonArtifacts({
  documentRuns,
  outputDirectory,
  metadata,
}) {
  fs.mkdirSync(outputDirectory, { recursive: true, mode: 0o700 });
  const result = buildComparisonResult(documentRuns, metadata);
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
  CATEGORY_ORDER,
  buildComparisonResult,
  comparePackages,
  summarizePackage,
  writeComparisonArtifacts,
};

const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const {
  applyHeaderStyle,
  applyZebraStriping,
  freezePanes,
} = require("../agents/aibitat/plugins/create-files/xlsx/utils");

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

function summarizePackage(entries) {
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
  const unresolvedPrecedence =
    coverageValues.length > 1 || amountValues.length > 1;
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
      amountValues.length === 0
        ? NOT_DETERMINABLE
        : amountValues.length === 1
          ? amountValues[0]
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

function readDocumentRows(documentRun) {
  const categories = {};
  for (const categoryView of CATEGORY_ORDER) {
    const file = path.join(
      documentRun.outputDirectory,
      categoryView,
      "result",
      "rows.private.json"
    );
    if (!fs.existsSync(file))
      throw new Error(
        `COMPARISON_CATEGORY_RESULT_MISSING:${documentRun.document.uuid}:${categoryView}`
      );
    categories[categoryView] = JSON.parse(fs.readFileSync(file, "utf8"));
  }
  return categories;
}

function buildComparisonResult(documentRuns, metadata = {}) {
  const loadedRuns = documentRuns.map((run) => ({
    ...run,
    categories: readDocumentRows(run),
  }));
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
        entries.filter(({ document }) => document.side === "A")
      );
      const packageB = summarizePackage(
        entries.filter(({ document }) => document.side === "B")
      );
      const comparison = comparePackages(packageA, packageB);
      return {
        categoryId,
        stage: first.stage,
        categoryName: first.categoryName,
        packageA,
        packageB,
        ...comparison,
      };
    });
    return { categoryView, rows };
  });
  return {
    schemaVersion: 1,
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
    },
    proofLimit:
      "Technisches Vergleichsergebnis. Dokumentrang, Ersatzwirkung und fachlicher Vorteil bleiben prüfpflichtig, soweit sie nicht ausdrücklich belegt sind.",
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
      "| Kategorie-ID | Kategorie | Paket A | Paket B | Unterschied / Prüfhinweis |",
      "|---|---|---|---|---|"
    );
    for (const row of category.rows) {
      const cells = [
        row.categoryId,
        row.categoryName,
        row.packageA.documentedContent,
        row.packageB.documentedContent,
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
      });
    }
    applyHeaderStyle(sheet, { fill: "FF1E3A5F", fontColor: "FFFFFFFF" });
    applyZebraStriping(sheet, "FFF3F6FA");
    freezePanes(sheet, 1, 3);
    sheet.autoFilter = { from: "A1", to: "O1" };
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

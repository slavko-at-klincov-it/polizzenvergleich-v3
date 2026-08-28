#!/usr/bin/env node

process.umask(0o077);

const fs = require("fs");
const path = require("path");

function fail(message) {
  console.error(`[all-category-summary] ${message}`);
  process.exit(1);
}

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value) fail(`Ungültiges Argument: ${key}`);
    values[key.slice(2)] = value;
  }
  return values;
}

function writePrivate(file, value) {
  fs.writeFileSync(
    file,
    typeof value === "string" ? value : JSON.stringify(value, null, 2),
    { encoding: "utf8", mode: 0o600 }
  );
  fs.chmodSync(file, 0o600);
}

function run() {
  const args = parseArguments(process.argv.slice(2));
  const allowed = new Set(["root", "documentKey", "model", "documentStatus"]);
  const unknown = Object.keys(args).filter((key) => !allowed.has(key));
  if (unknown.length) fail(`Unbekannte Argumente: ${unknown.join(",")}`);
  if (!args.root) fail("--root ist erforderlich");
  const root = path.resolve(args.root);
  const categoryViews = ["VS", "FE", "LW", "ST", "EL", "HP", "VB", "WE"];
  const categories = categoryViews.map((categoryView) => {
    const reportFile = path.join(root, categoryView, "result", "report.json");
    const rowsFile = path.join(
      root,
      categoryView,
      "result",
      "rows.private.json"
    );
    if (!fs.existsSync(reportFile) || !fs.existsSync(rowsFile))
      fail(`${categoryView}: Ergebnis fehlt`);
    const report = JSON.parse(fs.readFileSync(reportFile, "utf8"));
    const rows = JSON.parse(fs.readFileSync(rowsFile, "utf8"));
    const reviewStatuses = rows.reduce((counts, row) => {
      counts[row.reviewStatus] = (counts[row.reviewStatus] || 0) + 1;
      return counts;
    }, {});
    return {
      categoryView,
      status: report.status,
      rowCount: report.rowCount,
      expectedRowCount: report.expectedRowCount,
      candidates: report.evidence?.candidateCount || 0,
      selectedSources: report.evidence?.selectedSourceCount || 0,
      reviewStatuses,
      qualityGate: report.qualityGate,
    };
  });
  const technicalPass = categories.every(
    ({ status }) => status === "TECHNICAL_PASS_REVIEW_REQUIRED"
  );
  const report = {
    schemaVersion: 1,
    status: technicalPass ? "TECHNICAL_PASS_REVIEW_REQUIRED" : "REVISE",
    documentKey: args.documentKey || "POLICY",
    model: args.model || null,
    documentStatus: args.documentStatus || null,
    categories,
    totals: categories.reduce(
      (total, category) => ({
        rows: total.rows + category.rowCount,
        expectedRows: total.expectedRows + category.expectedRowCount,
        candidates: total.candidates + category.candidates,
        selectedSources: total.selectedSources + category.selectedSources,
      }),
      { rows: 0, expectedRows: 0, candidates: 0, selectedSources: 0 }
    ),
    qualityGate: {
      pass: false,
      status: "REVIEW_REQUIRED",
      reason: "CATEGORY_ORACLES_PENDING",
    },
  };
  const lines = [
    "# Vollständiger Kategorienlauf",
    "",
    `Status: ${report.status}`,
    "",
    "| Kategorie | Zeilen | Kandidaten | gewählte Quellen | Prüfstatus |",
    "|---|---:|---:|---:|---|",
    ...categories.map(
      (category) =>
        `| ${category.categoryView} | ${category.rowCount}/${category.expectedRowCount} | ${category.candidates} | ${category.selectedSources} | ${category.status} |`
    ),
    "",
    `Gesamt: ${report.totals.rows}/${report.totals.expectedRows} Tabellenzeilen.`,
    "",
    "Die technische Vollständigkeit ist geprüft. Die fachliche Freigabe bleibt bis zur Kategorie-Oracle-Abnahme REVIEW_REQUIRED.",
    "",
  ];
  writePrivate(path.join(root, "report.json"), report);
  writePrivate(path.join(root, "summary.md"), lines.join("\n"));
  console.log(
    `[all-category-summary] ${report.status}: ${report.totals.rows}/${report.totals.expectedRows} Zeilen`
  );
  if (!technicalPass) process.exitCode = 2;
}

run();

const crypto = require("crypto");

const COLUMNS = [
  "Deckungsposition",
  "Leistungsversprechen",
  "Versicherungssumme / Sublimit",
  "Zeitliche Begrenzung",
  "Selbstbehalt",
  "Voraussetzungen und Einschränkungen",
  "Zusatzbaustein prämienpflichtig?",
  "Quelle",
];

const SECTION_BY_TYPE = {
  insured_object: "1. Versicherte Sachen",
  definition: "1. Versicherte Sachen",
  coverage: "2. Sparten und Deckungsinhalte",
  limit: "2. Sparten und Deckungsinhalte",
  deductible: "2. Sparten und Deckungsinhalte",
  exclusion: "2. Sparten und Deckungsinhalte",
  condition: "2. Sparten und Deckungsinhalte",
  obligation: "2. Sparten und Deckungsinhalte",
  duration: "2. Sparten und Deckungsinhalte",
  premium_addon: "3. Erweiterungen, Sonderklauseln und Zusatzbausteine",
  other_contract_fact: "3. Erweiterungen, Sonderklauseln und Zusatzbausteine",
};

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function scalar(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number")
    return String(value).replace(/\B(?=(\d{3})+(?!\d))/gu, ".");
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(scalar).filter(Boolean).join(", ");
  if (typeof value === "object")
    return Object.entries(value)
      .map(([key, item]) => `${key}: ${scalar(item)}`)
      .join(", ");
  return String(value);
}

function escapeCell(value) {
  return String(value ?? "")
    .replace(/\|/gu, "\\|")
    .replace(/\r?\n/gu, " ")
    .trim();
}

function sourceCell(document, fact) {
  const page =
    fact.pageNumber == null ? "" : `, physische PDF-Seite ${fact.pageNumber}`;
  const position =
    fact.evidenceStart == null
      ? ""
      : `, Zeichen ${fact.evidenceStart}–${fact.evidenceEnd}`;
  return `${document.originalFilename}${page}${position}`;
}

function rowFor(document, fact) {
  const amount = scalar(fact.value);
  const conditions = Array.isArray(fact.conditions)
    ? fact.conditions.filter(Boolean).join("; ")
    : scalar(fact.conditions);
  const rowId = sha256(`${document.id}\u0000${fact.factKey}`);
  const factRef = `${document.id}:${fact.factKey}`;
  return {
    rowId,
    factKeys: [factRef],
    documentId: document.id,
    slot: document.slot,
    pageNumber: fact.pageNumber,
    evidenceStart: fact.evidenceStart,
    section:
      SECTION_BY_TYPE[fact.factType] ||
      "3. Erweiterungen, Sonderklauseln und Zusatzbausteine",
    cells: {
      Deckungsposition: fact.label,
      Leistungsversprechen: fact.claimText || fact.evidenceText,
      "Versicherungssumme / Sublimit":
        fact.factType === "limit"
          ? [amount, fact.unit].filter(Boolean).join(" ") || fact.evidenceText
          : "keine Summenangabe im Text",
      "Zeitliche Begrenzung":
        fact.factType === "duration"
          ? [amount, fact.unit].filter(Boolean).join(" ") || fact.evidenceText
          : "keine",
      Selbstbehalt:
        fact.factType === "deductible"
          ? [amount, fact.unit].filter(Boolean).join(" ") || fact.evidenceText
          : "im Dokument nicht gefunden",
      "Voraussetzungen und Einschränkungen":
        conditions ||
        (["condition", "exclusion", "obligation"].includes(fact.factType)
          ? fact.claimText || fact.evidenceText
          : "im Dokument nicht gefunden"),
      "Zusatzbaustein prämienpflichtig?": "nicht erkennbar",
      Quelle: sourceCell(document, fact),
    },
  };
}

function assertCoverage(plan) {
  const expected = plan.expectedFactKeys;
  const accounted = plan.rows.flatMap((row) => row.factKeys);
  const expectedSet = new Set(expected);
  const accountedSet = new Set(accounted);
  const duplicates = accounted.filter(
    (key, index) => accounted.indexOf(key) !== index
  );
  const missing = expected.filter((key) => !accountedSet.has(key));
  const unknown = accounted.filter((key) => !expectedSet.has(key));
  if (missing.length || unknown.length || duplicates.length)
    throw new Error(
      `Fact table coverage mismatch: ${missing.length} missing, ${unknown.length} unknown, ${duplicates.length} duplicate.`
    );
  return true;
}

const ComparisonFactTable = {
  columns: COLUMNS,
  isCompleteAnalysisRequest(query = "") {
    const normalized = String(query).toLocaleLowerCase("de-AT");
    return (
      /\b(?:vollständig\w*|vollstaendig\w*)\b/u.test(normalized) &&
      /\b(?:alle|keine position auslassen|gliederung|tabelle|deckungsinhalte|bestandsaufnahme)\b/u.test(
        normalized
      )
    );
  },
  plan(inventories = []) {
    const rows = inventories
      .flatMap(({ document, manifest }) =>
        (manifest.items || []).map((fact) => rowFor(document, fact))
      )
      .sort(
        (left, right) =>
          String(left.slot).localeCompare(String(right.slot), "de") ||
          Number(left.pageNumber ?? Number.MAX_SAFE_INTEGER) -
            Number(right.pageNumber ?? Number.MAX_SAFE_INTEGER) ||
          Number(left.evidenceStart ?? Number.MAX_SAFE_INTEGER) -
            Number(right.evidenceStart ?? Number.MAX_SAFE_INTEGER) ||
          left.rowId.localeCompare(right.rowId)
      );
    const plan = {
      columns: [...COLUMNS],
      expectedFactKeys: inventories.flatMap(({ manifest }) =>
        (manifest.items || []).map(
          (item) => `${manifest.comparisonDocumentId}:${item.factKey}`
        )
      ),
      rows,
    };
    assertCoverage(plan);
    return plan;
  },
  assertCoverage,
  render(plan) {
    assertCoverage(plan);
    if (plan.rows.length === 0)
      return "Im vollständig verarbeiteten Dokument wurde kein belegter Vertragsfakt gefunden.";
    const sections = new Map();
    for (const row of plan.rows) {
      if (!sections.has(row.section)) sections.set(row.section, []);
      sections.get(row.section).push(row);
    }
    const output = [];
    for (const [section, rows] of sections) {
      output.push(`## ${section}`);
      output.push(`| ${plan.columns.join(" | ")} |`);
      output.push(`| ${plan.columns.map(() => "---").join(" | ")} |`);
      for (const row of rows)
        output.push(
          `| ${plan.columns.map((column) => escapeCell(row.cells[column])).join(" | ")} |`
        );
      output.push("");
    }
    return output.join("\n").trim();
  },
};

module.exports = { ComparisonFactTable, COLUMNS, SECTION_BY_TYPE };

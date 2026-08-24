const { ComparisonClauseBlockIndex } = require("./ComparisonClauseBlockIndex");
const {
  ComparisonClauseEmbeddingIndex,
} = require("./ComparisonClauseEmbeddingIndex");
const { ComparisonFactTable } = require("./ComparisonFactTable");

const DEDUCTIBLE_TERMS = Object.freeze([
  "Selbstbehalt",
  "Selbstbehalte",
  "Selbstbehalts",
  "Selbstbehaltsregelung",
  "Selbstbeteiligung",
  "Selbstbeteiligungen",
  "Franchise",
  "Franchisen",
  "Eigenanteil",
  "Eigenanteile",
  "selbst zu tragen",
]);

const DEDUCTIBLE_QUERY =
  /\b(?:selbstbehalt(?:e|en|s)?|selbstbeteiligung(?:en)?|franchise(?:n)?|eigenanteil(?:e|en|s)?|selbst\s+zu\s+tragen)\b/iu;

function clean(value = "") {
  return String(value).replace(/\s+/gu, " ").trim();
}

function sameHeading(left, right) {
  const leftPath = (left.headingPath || []).map(clean).filter(Boolean);
  const rightPath = (right.headingPath || []).map(clean).filter(Boolean);
  if (!leftPath.length || !rightPath.length) return false;
  return leftPath.join("\u0000") === rightPath.join("\u0000");
}

function valueLabel(value) {
  if (!value) return null;
  if (value.kind === "money" && Number.isFinite(Number(value.amount)))
    return `${new Intl.NumberFormat("de-AT", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(Number(value.amount))} EUR`;
  if (value.kind === "percentage" && Number.isFinite(Number(value.percent)))
    return `${new Intl.NumberFormat("de-AT", {
      maximumFractionDigits: 2,
    }).format(Number(value.percent))} %`;
  return clean(value.text || value.amount || value.percent || "") || null;
}

function signalValue(signal) {
  if (signal.kind === "money") {
    const amount = Number(signal.normalizedValue);
    return Number.isFinite(amount)
      ? valueLabel({ kind: "money", amount })
      : clean(signal.evidenceText);
  }
  if (signal.kind === "percentage") {
    const percent = Number(
      String(signal.normalizedValue).replace("%", "").replace(",", ".")
    );
    return Number.isFinite(percent)
      ? valueLabel({ kind: "percentage", percent })
      : clean(signal.evidenceText);
  }
  return null;
}

function compatibleTableNeighbor(center, candidate) {
  if (!candidate || center.pageNumber !== candidate.pageNumber) return false;
  if (Math.abs(center.ordinal - candidate.ordinal) > 1) return false;
  if (sameHeading(center, candidate)) return true;
  return (
    center.structureKind === "table_row" &&
    candidate.structureKind === "table_row"
  );
}

function rowValues({ facts, unit, units }) {
  const values = facts.map((fact) => valueLabel(fact.value)).filter(Boolean);
  if (values.length) return [...new Set(values)];
  const sameBlock = (unit.riskSignals || [])
    .filter((signal) => ["money", "percentage"].includes(signal.kind))
    .map(signalValue)
    .filter(Boolean);
  if (sameBlock.length) return [...new Set(sameBlock)];
  const adjacent = units
    .filter((candidate) => compatibleTableNeighbor(unit, candidate))
    .flatMap((candidate) => candidate.riskSignals || [])
    .filter((signal) => ["money", "percentage"].includes(signal.kind))
    .map(signalValue)
    .filter(Boolean);
  return [...new Set(adjacent)];
}

function explicitConditionPhrases(text = "") {
  const matches = clean(text).match(
    /\b(?:für|bei|sofern|wenn|falls|nur\s+ohne|nur\s+wenn|je\s+schadenfall)\b[^.;]{0,180}/giu
  );
  return [...new Set((matches || []).map(clean).filter(Boolean))];
}

function rowConditions({ unit, units, evidenceText }) {
  const local = (unit.riskSignals || [])
    .filter((signal) =>
      ["condition", "exclusion", "obligation"].includes(signal.kind)
    )
    .map((signal) => clean(signal.evidenceText))
    .filter(Boolean);
  if (local.length) return [...new Set(local)];
  const adjacent = units
    .filter((candidate) => compatibleTableNeighbor(unit, candidate))
    .flatMap((candidate) => candidate.riskSignals || [])
    .filter((signal) =>
      ["condition", "exclusion", "obligation"].includes(signal.kind)
    )
    .map((signal) => clean(signal.evidenceText))
    .filter(Boolean);
  if (adjacent.length) return [...new Set(adjacent)];
  return explicitConditionPhrases(evidenceText);
}

function rowsForLedger({ ledger, candidateBlockIds }) {
  const units = ledger.units || [];
  const rows = [];
  for (const unit of units) {
    if (!candidateBlockIds.has(Number(unit.id))) continue;
    const result = ledger.deterministicResults.get(unit.blockKey);
    const facts = (result?.facts || []).filter(
      (fact) => fact.factType === "deductible"
    );
    if (!facts.length) continue;
    const groups = new Map();
    for (const fact of facts) {
      const key = `${fact.evidenceStart}:${fact.evidenceEnd}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(fact);
    }
    for (const groupedFacts of groups.values()) {
      const primary = groupedFacts[0];
      rows.push({
        key: `${ledger.analysisRunId}:${unit.blockKey}:${primary.evidenceStart}:${primary.evidenceEnd}`,
        document: ledger.comparisonDocument,
        heading:
          (unit.headingPath || []).map(clean).filter(Boolean).join(" › ") ||
          "nicht eindeutig zugeordnet",
        values: rowValues({ facts: groupedFacts, unit, units }),
        conditions: rowConditions({
          unit,
          units,
          evidenceText: primary.evidenceText,
        }),
        pageNumber: unit.pageNumber,
        evidenceText: clean(primary.evidenceText),
        evidenceStart: primary.evidenceStart,
      });
    }
  }
  return [...new Map(rows.map((row) => [row.key, row])).values()].sort(
    (left, right) =>
      String(left.document.slot).localeCompare(String(right.document.slot)) ||
      (left.pageNumber ?? Number.MAX_SAFE_INTEGER) -
        (right.pageNumber ?? Number.MAX_SAFE_INTEGER) ||
      left.evidenceStart - right.evidenceStart
  );
}

function escapeCell(value = "") {
  return clean(value).replace(/\|/gu, "\\|").replace(/\n/gu, " ");
}

function render({ documents, rows }) {
  const lines = ["## Selbstbehalte"];
  for (const document of documents) {
    const documentRows = rows.filter((row) => row.document.id === document.id);
    lines.push(
      "",
      `### Dokument ${document.slot}: ${document.originalFilename}`
    );
    if (!documentRows.length) {
      lines.push(
        "",
        "Keine belegte Selbstbehalt-Fundstelle über die vollständige exakte Begriffssuche und die semantische Ergänzung gefunden. Das ist kein Beweis, dass kein Selbstbehalt vereinbart ist."
      );
      continue;
    }
    lines.push(
      "",
      "| Deckungsposition / Bereich | Betrag | Bedingung / Einschränkung | Physische PDF-Seite | Beleg |",
      "|---|---:|---|---:|---|"
    );
    for (const row of documentRows)
      lines.push(
        `| ${escapeCell(row.heading)} | ${escapeCell(
          row.values.join(", ") || "keine Betragsangabe im Beleg"
        )} | ${escapeCell(
          row.conditions.join("; ") || "keine besondere Bedingung im Beleg"
        )} | ${row.pageNumber == null ? "nicht verfügbar" : row.pageNumber} | ${escapeCell(row.evidenceText)} |`
      );
  }
  return lines.join("\n");
}

const ComparisonDeductibleRetriever = {
  terms: DEDUCTIBLE_TERMS,

  matches(query = "") {
    return (
      DEDUCTIBLE_QUERY.test(String(query)) &&
      !ComparisonFactTable.isCompleteAnalysisRequest(query)
    );
  },

  async retrieve({ documents, inventoryService }) {
    const ledgers =
      await inventoryService.ensureDeterministicLedgerForDocuments({
        documents,
        includeEmbeddings: true,
      });
    const allRows = [];
    const semanticQuery =
      "vertraglicher Selbstbehalt Selbstbeteiligung Franchise Eigenanteil vom Versicherungsnehmer selbst zu tragen";
    for (const ledger of ledgers) {
      const lexical = await ComparisonClauseBlockIndex.searchAllRun({
        analysisRunId: ledger.analysisRunId,
        terms: DEDUCTIBLE_TERMS,
        expandAliases: true,
      });
      const semantic = await ComparisonClauseEmbeddingIndex.semanticLinks({
        analysisRunId: ledger.analysisRunId,
        text: semanticQuery,
        topN: 100,
        similarityThreshold: 0.45,
      });
      const candidateBlockIds = new Set(
        lexical.map((hit) => Number(hit.blockId)).filter(Number.isFinite)
      );
      for (const hit of semantic) {
        const metadata = hit?.metadata || hit;
        const blockId = Number(metadata.blockId);
        if (!Number.isFinite(blockId)) continue;
        const unit = ledger.units.find((candidate) => candidate.id === blockId);
        const deterministic = unit
          ? ledger.deterministicResults.get(unit.blockKey)
          : null;
        if (
          (deterministic?.facts || []).some(
            (fact) => fact.factType === "deductible"
          )
        )
          candidateBlockIds.add(blockId);
      }
      allRows.push(...rowsForLedger({ ledger, candidateBlockIds }));
    }
    const rows = [...new Map(allRows.map((row) => [row.key, row])).values()];
    return {
      rows,
      deterministicTextResponse: render({ documents, rows }),
      sources: rows.map((row) => ({
        title: row.document.originalFilename,
        documentSlot: row.document.slot,
        pageNumber: row.pageNumber,
        text: row.evidenceText,
        retrieval: "clause-ledger-exhaustive",
      })),
      coverage: {
        documents: documents.length,
        matchedRows: rows.length,
        modelCalls: 0,
      },
    };
  },
};

module.exports = {
  ComparisonDeductibleRetriever,
  DEDUCTIBLE_TERMS,
};

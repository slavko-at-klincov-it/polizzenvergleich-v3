const DEFAULT_COLUMNS = [
  { key: "coveragePosition", label: "Deckungsposition", role: "label" },
  {
    key: "performancePromise",
    label: "Leistungsversprechen",
    role: "coverage",
  },
  {
    key: "limit",
    label: "Versicherungssumme / Sublimit",
    role: "limit",
  },
  { key: "duration", label: "Zeitliche Begrenzung", role: "duration" },
  { key: "deductible", label: "Selbstbehalt", role: "deductible" },
  {
    key: "restriction",
    label: "Voraussetzungen und Einschränkungen",
    role: "restriction",
  },
  {
    key: "premium",
    label: "Zusatzbaustein prämienpflichtig?",
    role: "premium",
  },
  { key: "source", label: "Quelle", role: "source" },
];

const DEFAULT_SECTIONS = [
  { key: "1", label: "Versicherte Sachen", order: 0, level: 1 },
  {
    key: "2",
    label: "Sparten und Deckungsinhalte",
    order: 1,
    level: 1,
  },
  {
    key: "3",
    label: "Erweiterungen, Sonderklauseln und Zusatzbausteine",
    order: 2,
    level: 1,
  },
];

function normalize(value = "") {
  return String(value)
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/ß/gu, "ss")
    .toLocaleLowerCase("de-AT")
    .replace(/[^a-z0-9]+/gu, " ")
    .trim();
}

function columnRole(label) {
  const value = normalize(label);
  if (/deckungsposition|position|thema/u.test(value)) return "label";
  if (/leistungsversprechen|leistung|deckung(?:sinhalt)?/u.test(value))
    return "coverage";
  if (
    /versicherungssumme|sublimit|hochstentschadigung|deckungsgrenze/u.test(
      value
    )
  )
    return "limit";
  if (/zeit|frist|dauer/u.test(value)) return "duration";
  if (/selbstbehalt|selbstbeteiligung|franchise/u.test(value))
    return "deductible";
  if (
    /voraussetzung|einschrankung|ausschluss|obliegenheit|bedingung/u.test(value)
  )
    return "restriction";
  if (/pramienpflicht|zusatzbaustein/u.test(value)) return "premium";
  if (/quelle|fundstelle|beleg/u.test(value)) return "source";
  return "unknown";
}

function uniqueColumnKey(role, label, index, seen) {
  const base =
    role === "unknown"
      ? normalize(label).replace(/\s+/gu, "_") || `unknown_${index + 1}`
      : role;
  const count = seen.get(base) || 0;
  seen.set(base, count + 1);
  return count === 0 ? base : `${base}_${count + 1}`;
}

function promptColumns(prompt) {
  const tableStart = prompt.search(/\bTABELLE\b/iu);
  if (tableStart < 0) return null;
  const tail = prompt.slice(tableStart);
  const rulesStart = tail.search(/\bSPALTENREGELN\b/iu);
  const table = rulesStart < 0 ? tail : tail.slice(0, rulesStart);
  const firstPipe = table.indexOf("|");
  const lastPipe = table.lastIndexOf("|");
  if (firstPipe < 0 || lastPipe <= firstPipe) return null;
  const labels = table
    .slice(firstPipe + 1, lastPipe)
    .split("|")
    .map((value) => value.replace(/\s+/gu, " ").trim())
    .filter((value) => value && !/^:?-{3,}:?$/u.test(value));
  if (labels.length < 2) return null;
  const roles = labels.map(columnRole);
  if (roles.filter((role) => role !== "unknown").length < 2) return null;
  const seen = new Map();
  return labels.map((label, index) => {
    const role = roles[index];
    return {
      key: uniqueColumnKey(role, label, index, seen),
      label,
      role,
      order: index,
    };
  });
}

function promptSections(prompt) {
  const tableStart = prompt.search(/\bTABELLE\b/iu);
  const scope = tableStart < 0 ? prompt : prompt.slice(0, tableStart);
  const result = [];
  for (const line of scope.split(/\r?\n/gu)) {
    const match = line.match(/^\s*(\d+(?:\.\d+)*)\.?\s+(.+?)\s*$/u);
    if (!match) continue;
    const key = match[1];
    const label = match[2].replace(/\s+/gu, " ").trim();
    if (!label || result.some((section) => section.key === key)) continue;
    result.push({
      key,
      label,
      order: result.length,
      level: key.split(".").length,
    });
  }
  return result.length ? result : DEFAULT_SECTIONS.map((item) => ({ ...item }));
}

function isCompleteAnalysisRequest(userPrompt = "") {
  const normalized = normalize(userPrompt);
  const scopeIntent =
    /\b(?:alle|samtliche|keine position auslassen|jede weitere|vollstandige aufstellung|vollstandig analysiere)\b/u.test(
      normalized
    ) ||
    (/\bvollstandig\w*\b/u.test(normalized) &&
      /\b(?:deckungsinhalte|bestandsaufnahme|dokument|produkt|polizze|police)\b/u.test(
        normalized
      ));
  const outputIntent =
    /\b(?:analysiere|aufstellung|tabelle|gliederung|bestandsaufnahme|erstelle)\b/u.test(
      normalized
    );
  return scopeIntent && outputIntent;
}

const PromptOutputContractParser = {
  version: 1,
  parse({ userPrompt = "" } = {}) {
    const columns = promptColumns(String(userPrompt));
    return {
      version: 1,
      outputKind: "table",
      sections: promptSections(String(userPrompt)),
      columns:
        columns || DEFAULT_COLUMNS.map((item, order) => ({ ...item, order })),
      constraints: {
        noSummary: /keine zusammenfassung/iu.test(String(userPrompt)),
        noEvaluation: /keine bewertung/iu.test(String(userPrompt)),
        preserveSectionOrder: true,
        includeAdditionalSections: true,
      },
    };
  },
  isCompleteAnalysisRequest,
};

module.exports = {
  PromptOutputContractParser,
  DEFAULT_COLUMNS,
  DEFAULT_SECTIONS,
  columnRole,
};

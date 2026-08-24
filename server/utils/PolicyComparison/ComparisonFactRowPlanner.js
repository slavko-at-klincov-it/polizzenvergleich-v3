const crypto = require("crypto");

const INSURED_FACT_TYPES = new Set(["insured_object", "definition"]);
const COVERAGE_FACT_TYPES = new Set([
  "coverage",
  "insured_object",
  "definition",
  "premium_addon",
  "other_contract_fact",
]);
const RESTRICTION_FACT_TYPES = new Set([
  "condition",
  "exclusion",
  "obligation",
]);

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function normalize(value = "") {
  return String(value)
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/ß/gu, "ss")
    .toLocaleLowerCase("de-AT")
    .replace(/[^a-z0-9]+/gu, " ")
    .trim();
}

function scalar(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number")
    return new Intl.NumberFormat("de-AT", {
      maximumFractionDigits: 6,
    }).format(value);
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(scalar).filter(Boolean).join(", ");
  if (typeof value === "object") {
    if (value.kind === "money" && value.amount != null)
      return `${scalar(value.amount)} ${value.currency || "EUR"}`;
    if (value.kind === "percentage" && value.percent != null)
      return `${scalar(value.percent)} %`;
    if (value.kind === "duration" && value.text) return value.text;
    if (Array.isArray(value.values))
      return value.values.map(scalar).filter(Boolean).join("; ");
    if (value.evidenceText) return value.evidenceText;
    return Object.entries(value)
      .map(([key, item]) => `${key}: ${scalar(item)}`)
      .join(", ");
  }
  return String(value);
}

function unique(values = []) {
  const seen = new Set();
  return values.filter((value) => {
    const key = normalize(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function factText(fact) {
  return fact.claimText || fact.evidenceText || fact.label;
}

function variantFor(fact) {
  const source = [
    ...(fact.sourceContext?.headingPath || []),
    fact.label,
    fact.claimText,
    fact.evidenceText,
  ].join(" ");
  const variant = source.match(/\b(?:variante|deckung)\s*([a-d])\b/iu);
  if (variant)
    return {
      key: `variant-${variant[1].toLocaleLowerCase("de-AT")}`,
      label: `Variante ${variant[1].toLocaleUpperCase("de-AT")}`,
    };
  if (/\bpremiumschutz\b/iu.test(source))
    return { key: "premiumschutz", label: "Premiumschutz" };
  if (/\bgrunddeckung\b/iu.test(source))
    return { key: "grunddeckung", label: "Grunddeckung" };
  if (/\bzusatzbaustein\b/iu.test(source))
    return { key: "zusatzbaustein", label: "Zusatzbaustein" };
  return { key: "general", label: null };
}

function subjectFor(fact) {
  return normalize(fact.facetKey || fact.label || fact.evidenceText);
}

function groupKey(document, fact, variant) {
  const block =
    fact.sourceContext?.blockKey || fact.unitKey || `fact:${fact.factKey}`;
  return [document.id, variant.key, subjectFor(fact), block].join("\u0000");
}

function factRef(document, manifest, fact) {
  return `${manifest.analysisRunId == null ? "legacy" : manifest.analysisRunId}:${document.id}:${fact.factKey}`;
}

function evidenceSources(document, fact) {
  const evidences =
    Array.isArray(fact.evidences) && fact.evidences.length
      ? fact.evidences
      : [
          {
            pageNumber: fact.pageNumber,
            sourceStart: fact.evidenceStart,
            sourceEnd: fact.evidenceEnd,
            evidenceText: fact.evidenceText,
          },
        ];
  return evidences.map((evidence) => {
    const sourceContext = evidence.sourceContext || fact.sourceContext;
    return {
      title: document.originalFilename,
      documentId: document.id,
      slot: document.slot,
      pageNumber: evidence.pageNumber ?? null,
      sourceStart: evidence.sourceStart ?? null,
      sourceEnd: evidence.sourceEnd ?? null,
      printedPageLabel: sourceContext?.printedPageLabel || null,
      headingPath: sourceContext?.headingPath || [],
      evidenceText: evidence.evidenceText,
    };
  });
}

function sourceLabel(source) {
  const details = [];
  if (source.pageNumber != null)
    details.push(`physische PDF-Seite ${source.pageNumber}`);
  else if (source.printedPageLabel)
    details.push(`gedruckte Bezeichnung ${source.printedPageLabel}`);
  if (source.sourceStart != null)
    details.push(`Zeichen ${source.sourceStart}–${source.sourceEnd}`);
  const heading = source.headingPath.filter(Boolean).join(" › ");
  if (heading) details.push(heading);
  return [source.title, ...details].join(", ");
}

function joinedFacts(facts, types, { prefix = false } = {}) {
  return unique(
    facts
      .filter((fact) => types.has(fact.factType))
      .map((fact) => {
        const text = factText(fact);
        if (!prefix) return text;
        const role = {
          condition: "Voraussetzung",
          exclusion: "Ausschluss",
          obligation: "Obliegenheit",
        }[fact.factType];
        return `${role}: ${text}`;
      })
  ).join("; ");
}

function valueFacts(facts, type) {
  return unique(
    facts
      .filter((fact) => fact.factType === type)
      .map((fact) =>
        [scalar(fact.value), factText(fact)].filter(Boolean).join(" – ")
      )
      .filter(Boolean)
  ).join("; ");
}

function premiumCell(facts) {
  const premiumFacts = facts.filter(
    (fact) => fact.factType === "premium_addon"
  );
  if (!premiumFacts.length) return "nicht erkennbar";
  const source = premiumFacts.map(factText).join(" ");
  if (
    /\b(?:pramienfrei|ohne zusatzpramie|kostenlos)\b/iu.test(normalize(source))
  )
    return "nein";
  if (
    /\b(?:pramienpflichtig|gegen zusatzpramie|mehrpramie)\b/iu.test(
      normalize(source)
    )
  )
    return "ja";
  return "nicht erkennbar";
}

function sectionFor(facts, outputContract) {
  const sections = outputContract.sections;
  const searchable = normalize(
    facts
      .flatMap((fact) => [
        fact.label,
        fact.claimText,
        fact.evidenceText,
        ...(fact.sourceContext?.headingPath || []),
      ])
      .join(" ")
  );
  const direct = [...sections]
    .sort((left, right) => right.level - left.level || left.order - right.order)
    .find((section) => {
      const terms = normalize(section.label)
        .split(/\s+/gu)
        .filter(
          (term) =>
            term.length >= 5 &&
            !["sowie", "weitere", "eigener", "abschnitt"].includes(term)
        );
      return (
        terms.length > 0 && terms.some((term) => searchable.includes(term))
      );
    });
  if (direct) return direct;
  const factTypes = new Set(facts.map((fact) => fact.factType));
  const prefix = [...factTypes].some((type) => INSURED_FACT_TYPES.has(type))
    ? "1"
    : [...factTypes].some(
          (type) => type === "premium_addon" || type === "other_contract_fact"
        )
      ? "3"
      : "2";
  return (
    sections.find((section) => section.key === prefix) ||
    sections.find((section) => section.key.startsWith(`${prefix}.`)) ||
    null
  );
}

function canonicalCells(facts, variant, sources) {
  const label = unique(facts.map((fact) => fact.label)).join(" / ");
  const coverage = joinedFacts(facts, COVERAGE_FACT_TYPES);
  const restriction = joinedFacts(facts, RESTRICTION_FACT_TYPES, {
    prefix: true,
  });
  const variantRestriction = variant.label
    ? `Gültigkeitsbereich: ${variant.label}`
    : null;
  return {
    label: variant.label ? `${label} – ${variant.label}` : label,
    coverage: coverage || unique(facts.map(factText)).join("; "),
    limit:
      valueFacts(facts, "limit") ||
      "keine Summenangabe in dieser Belegposition",
    duration: valueFacts(facts, "duration") || "keine",
    deductible:
      valueFacts(facts, "deductible") || "keine Angabe in dieser Belegposition",
    restriction:
      [variantRestriction, restriction].filter(Boolean).join("; ") ||
      "keine belegte Einschränkung in dieser Belegposition",
    premium: premiumCell(facts),
    source: unique(sources.map(sourceLabel)).join("; "),
  };
}

function plannedCells(outputContract, canonical) {
  return Object.fromEntries(
    outputContract.columns.map((column) => [
      column.key,
      canonical[column.role] || "nicht aus belegten Fakten ableitbar",
    ])
  );
}

function plannedCellFactRefs(outputContract, facts, refs) {
  const refsFor = (predicate) =>
    refs.filter((_ref, index) => predicate(facts[index]));
  const byRole = {
    label: [...refs],
    coverage: refsFor((fact) => COVERAGE_FACT_TYPES.has(fact.factType)),
    limit: refsFor((fact) => fact.factType === "limit"),
    duration: refsFor((fact) => fact.factType === "duration"),
    deductible: refsFor((fact) => fact.factType === "deductible"),
    restriction: refsFor((fact) => RESTRICTION_FACT_TYPES.has(fact.factType)),
    premium: refsFor((fact) => fact.factType === "premium_addon"),
    source: [...refs],
    unknown: [],
  };
  return Object.fromEntries(
    outputContract.columns.map((column) => [
      column.key,
      [...(byRole[column.role] || [])],
    ])
  );
}

function assertCoverage(plan) {
  const expected = plan.expectedFactRefs;
  const accounted = plan.documents.flatMap((document) =>
    document.sections.flatMap((section) =>
      section.rows.flatMap((row) => row.factRefs)
    )
  );
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

const ComparisonFactRowPlanner = {
  version: 1,
  plan({ inventories = [], outputContract }) {
    if (!outputContract?.columns?.length || !outputContract?.sections?.length)
      throw new Error("A valid output contract is required.");
    const expectedFactRefs = [];
    const documents = inventories.map(({ document, manifest }) => {
      const groups = new Map();
      for (const fact of manifest.items || []) {
        const ref = factRef(document, manifest, fact);
        expectedFactRefs.push(ref);
        const variant = variantFor(fact);
        const key = groupKey(document, fact, variant);
        if (!groups.has(key)) groups.set(key, { facts: [], refs: [], variant });
        groups.get(key).facts.push(fact);
        groups.get(key).refs.push(ref);
      }
      const sectionRows = new Map(
        outputContract.sections.map((section) => [section.key, []])
      );
      for (const group of groups.values()) {
        const sources = group.facts
          .flatMap((fact) => evidenceSources(document, fact))
          .sort(
            (left, right) =>
              Number(left.pageNumber ?? Number.MAX_SAFE_INTEGER) -
                Number(right.pageNumber ?? Number.MAX_SAFE_INTEGER) ||
              Number(left.sourceStart ?? Number.MAX_SAFE_INTEGER) -
                Number(right.sourceStart ?? Number.MAX_SAFE_INTEGER)
          );
        const section = sectionFor(group.facts, outputContract) || {
          key: "additional",
          label: "Weitere dokumentierte Vertragsinhalte",
          order: Number.MAX_SAFE_INTEGER,
          level: 1,
        };
        if (!sectionRows.has(section.key)) sectionRows.set(section.key, []);
        const canonical = canonicalCells(group.facts, group.variant, sources);
        const factRefs = [...group.refs].sort();
        sectionRows.get(section.key).push({
          rowId: sha256(
            [
              manifest.analysisRunId ?? "legacy",
              document.id,
              ComparisonFactRowPlanner.version,
              ...factRefs,
            ].join("\u0000")
          ),
          clauseGroupKey: sha256(
            groupKey(document, group.facts[0], group.variant)
          ),
          factRefs,
          documentId: document.id,
          slot: document.slot,
          variant: group.variant,
          sources,
          cells: plannedCells(outputContract, canonical),
          cellFactRefs: plannedCellFactRefs(
            outputContract,
            group.facts,
            group.refs
          ),
        });
      }
      const sections = [
        ...outputContract.sections,
        ...(!sectionRows.has("additional")
          ? []
          : [
              {
                key: "additional",
                label: "Weitere dokumentierte Vertragsinhalte",
                order: Number.MAX_SAFE_INTEGER,
                level: 1,
              },
            ]),
      ].map((section) => ({
        ...section,
        rows: (sectionRows.get(section.key) || []).sort((left, right) => {
          const leftSource = left.sources[0] || {};
          const rightSource = right.sources[0] || {};
          return (
            Number(leftSource.pageNumber ?? Number.MAX_SAFE_INTEGER) -
              Number(rightSource.pageNumber ?? Number.MAX_SAFE_INTEGER) ||
            Number(leftSource.sourceStart ?? Number.MAX_SAFE_INTEGER) -
              Number(rightSource.sourceStart ?? Number.MAX_SAFE_INTEGER) ||
            left.rowId.localeCompare(right.rowId)
          );
        }),
      }));
      return {
        documentId: document.id,
        slot: document.slot,
        title: document.originalFilename,
        analysisRunId: manifest.analysisRunId ?? null,
        sections,
      };
    });
    const plan = { version: 1, outputContract, expectedFactRefs, documents };
    assertCoverage(plan);
    return plan;
  },
  assertCoverage,
};

module.exports = { ComparisonFactRowPlanner };

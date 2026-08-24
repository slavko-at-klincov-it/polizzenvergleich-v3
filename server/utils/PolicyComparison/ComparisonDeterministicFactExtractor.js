const crypto = require("crypto");
const { ComparisonFactRiskSignals } = require("./ComparisonFactRiskSignals");

const FACT_RULE_VERSION = 1;

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function evidenceWindow(block, signal) {
  const local = signal.sourceStart - block.sourceStart;
  const priorText = block.text.slice(0, Math.max(0, local));
  const priorBoundaries = [
    priorText.lastIndexOf("\n"),
    priorText.lastIndexOf(". "),
    priorText.lastIndexOf("; "),
  ];
  const before = Math.max(...priorBoundaries);
  const restStart = local + signal.evidenceText.length;
  const rest = block.text.slice(restStart);
  const futureBoundaries = [
    rest.indexOf("\n"),
    rest.indexOf(". "),
    rest.indexOf("; "),
  ]
    .filter((index) => index >= 0)
    .sort((left, right) => left - right);
  const after = futureBoundaries.length
    ? restStart + futureBoundaries[0] + 1
    : block.text.length;
  const localStart = before < 0 ? 0 : before + 1;
  const localEnd = after;
  const raw = block.text.slice(localStart, localEnd);
  const leading = raw.length - raw.trimStart().length;
  const trailing = raw.length - raw.trimEnd().length;
  return {
    text: raw.slice(leading, raw.length - trailing),
    sourceStart: block.sourceStart + localStart + leading,
    sourceEnd: block.sourceStart + localEnd - trailing,
  };
}

function topicFor(block, evidenceText) {
  const heading = Array.isArray(block.headingPath)
    ? block.headingPath.filter(Boolean).at(-1)
    : null;
  if (heading) return String(heading).slice(0, 160);
  return String(evidenceText)
    .replace(/\s+/gu, " ")
    .trim()
    .split(/\s+/u)
    .slice(0, 10)
    .join(" ")
    .slice(0, 160);
}

function structuredValue(signal) {
  if (signal.kind === "money")
    return {
      kind: "money",
      amount: Number(signal.normalizedValue),
      currency: "EUR",
    };
  if (signal.kind === "percentage")
    return {
      kind: "percentage",
      percent: Number(
        signal.normalizedValue.replace("%", "").replace(",", ".")
      ),
    };
  if (signal.kind === "duration")
    return { kind: "duration", text: signal.evidenceText };
  return null;
}

function factFor(block, signal, factType, window) {
  const evidenceStart = window.sourceStart;
  const evidenceEnd = evidenceStart + window.text.length;
  return {
    factKey: sha256(
      [
        FACT_RULE_VERSION,
        factType,
        block.pageNumber ?? "document",
        evidenceStart,
        evidenceEnd,
        signal.kind,
        signal.normalizedValue,
      ].join("\u0000")
    ),
    unitKey: block.blockKey || block.unitKey,
    factType,
    facetKey: null,
    label: topicFor(block, window.text),
    aliases: [],
    claimText: window.text,
    polarity: factType === "exclusion" ? "excluded" : null,
    value: structuredValue(signal),
    unit: null,
    conditions: [],
    pageNumber: block.pageNumber,
    evidenceText: window.text,
    evidenceStart,
    evidenceEnd,
    sourceMethod: "deterministic-rule",
    confidence: 1,
  };
}

function uniqueFacts(facts) {
  return [...new Map(facts.map((fact) => [fact.factKey, fact])).values()];
}

function intervalDistance(left, right) {
  if (left.sourceEnd < right.sourceStart)
    return right.sourceStart - left.sourceEnd;
  if (right.sourceEnd < left.sourceStart)
    return left.sourceStart - right.sourceEnd;
  return 0;
}

function nearestValueRole(block, valueSignal, roleSignals) {
  const valueWindow = evidenceWindow(block, valueSignal);
  const candidates = roleSignals
    .map(({ signal, factType }) => ({
      signal,
      factType,
      window: evidenceWindow(block, signal),
    }))
    .filter(
      (candidate) => candidate.window.sourceStart === valueWindow.sourceStart
    )
    .sort(
      (left, right) =>
        intervalDistance(left.signal, valueSignal) -
          intervalDistance(right.signal, valueSignal) ||
        left.signal.sourceStart - right.signal.sourceStart
    );
  return candidates[0]?.factType || null;
}

function technicalNonContentReason(block) {
  const value = String(block.text || "").trim();
  if (!value) return "empty_canonical_block";
  if (
    /^(?:seite\s+)?\d+\s*(?:\/|von)\s*\d+$/iu.test(value) ||
    /^[-–—_=•·.\s]+$/u.test(value)
  )
    return "technical_page_marker";
  return null;
}

function contentSegments(block) {
  const result = [];
  const pattern = /[^\n.;]+(?:[.;]|\n|$)/gu;
  let match;
  while ((match = pattern.exec(block.text))) {
    const leading = match[0].length - match[0].trimStart().length;
    const trailing = match[0].length - match[0].trimEnd().length;
    const start = block.sourceStart + match.index + leading;
    const end = block.sourceStart + match.index + match[0].length - trailing;
    if (
      end > start &&
      block.text
        .slice(start - block.sourceStart, end - block.sourceStart)
        .trim()
    )
      result.push({ start, end });
    if (match[0].length === 0) pattern.lastIndex += 1;
  }
  return result;
}

const ComparisonDeterministicFactExtractor = {
  version: FACT_RULE_VERSION,
  extract(block, positionedSignals = null) {
    const signals =
      positionedSignals ||
      ComparisonFactRiskSignals.detect(block.text, {
        sourceStart: block.sourceStart,
      });
    const technicalReason = technicalNonContentReason(block);
    if (technicalReason)
      return {
        facts: [],
        signals,
        terminalStatus: "technical_non_content",
        reasonCode: technicalReason,
        requiresReview: false,
        ambiguityReasons: [],
      };

    const facts = [];
    const byKind = new Map();
    for (const signal of signals) {
      if (!byKind.has(signal.kind)) byKind.set(signal.kind, []);
      byKind.get(signal.kind).push(signal);
    }
    const roleSignals = [
      ["deductible", "deductible"],
      ["exclusion", "exclusion"],
      ["obligation", "obligation"],
      ["condition", "condition"],
      ["coverage", "coverage"],
      ["insured_object", "insured_object"],
    ];
    for (const [kind, factType] of roleSignals) {
      for (const signal of byKind.get(kind) || []) {
        const window = evidenceWindow(block, signal);
        facts.push(factFor(block, signal, factType, window));
      }
    }
    const valueRoles = [
      ...(byKind.get("limit") || []).map((signal) => ({
        signal,
        factType: "limit",
      })),
      ...(byKind.get("deductible") || []).map((signal) => ({
        signal,
        factType: "deductible",
      })),
    ];
    for (const signal of [
      ...(byKind.get("money") || []),
      ...(byKind.get("percentage") || []),
    ]) {
      const factType = nearestValueRole(block, signal, valueRoles);
      if (factType)
        facts.push(
          factFor(block, signal, factType, evidenceWindow(block, signal))
        );
    }
    for (const signal of byKind.get("duration") || []) {
      facts.push(
        factFor(block, signal, "duration", evidenceWindow(block, signal))
      );
    }

    const ambiguityReasons = [];
    const content = String(block.text).trim();
    if (facts.length === 0)
      ambiguityReasons.push("unclassified_contract_content");
    if (
      facts.length > 0 &&
      contentSegments(block).some(
        (segment) =>
          !facts.some(
            (fact) =>
              fact.evidenceStart < segment.end &&
              fact.evidenceEnd > segment.start
          )
      )
    )
      ambiguityReasons.push("partially_unclassified_contract_content");
    if (
      block.layoutQuality === "text_only" &&
      (block.structureKind === "table_row" ||
        ((byKind.get("variant") || []).length > 0 &&
          (byKind.get("money") || []).length +
            (byKind.get("percentage") || []).length >
            1))
    )
      ambiguityReasons.push("layout_dependent_value_assignment");
    if (
      (byKind.get("coverage") || []).length &&
      (byKind.get("exclusion") || []).length
    )
      ambiguityReasons.push("mixed_coverage_and_exclusion");
    if (
      content.length > 0 &&
      block.structureKind === "heading" &&
      facts.length === 0
    )
      ambiguityReasons.push("content_heading_requires_context");

    const resultFacts = uniqueFacts(facts);
    return {
      facts: resultFacts,
      signals,
      terminalStatus:
        ambiguityReasons.length === 0
          ? "deterministic_facts"
          : "ambiguous_pending",
      reasonCode: ambiguityReasons[0] || null,
      requiresReview: ambiguityReasons.length > 0,
      ambiguityReasons: [...new Set(ambiguityReasons)],
    };
  },
};

module.exports = {
  ComparisonDeterministicFactExtractor,
  FACT_RULE_VERSION,
};

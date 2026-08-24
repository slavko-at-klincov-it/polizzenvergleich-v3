const crypto = require("crypto");
const { jsonrepair } = require("jsonrepair");
const { PolicyInferenceQueue } = require("./PolicyInferenceQueue");
const { ComparisonFactRiskSignals } = require("./ComparisonFactRiskSignals");

const MAX_CANDIDATES_PER_CALL = 8;
const MAX_TOTAL_CANDIDATES = 16;
const MAX_OUTPUT_TOKENS = 512;

const SYSTEM_PROMPT = `
Du prüfst wenige bereits semantisch vorausgewählte Vertragsblöcke. Entscheide
nur, ob der Block einen vom Versicherungsnehmer zu tragenden Selbstbehalt,
Eigenanteil oder eine Franchise regelt. Prämien, Versicherungssummen,
Deckungslimits und allgemein nicht ersetzte Kosten sind keine Selbstbehalte.

Antworte ausschließlich als JSON:
{"candidates":[{"key":"c1","deductible":true,"evidenceText":"wortgetreues kurzes Zitat"}]}

Regeln:
- Gib jeden Eingabe-key genau einmal zurück.
- deductible=false braucht evidenceText=null.
- deductible=true braucht ein zusammenhängendes wortgetreues Zitat aus text.
- Erfinde keine Beträge, Bedingungen oder Seiten.
`.trim();

function parseJson(value = "") {
  const text = String(value).replace(/^\s*<think>[\s\S]*?<\/think>\s*/u, "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("Resolver JSON is incomplete.");
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return JSON.parse(jsonrepair(text.slice(start, end + 1)));
  }
}

function exactOffset(unit, evidenceText) {
  const evidence = String(evidenceText || "").trim();
  if (!evidence || evidence.length > 480) return null;
  const first = unit.text.indexOf(evidence);
  if (first < 0 || unit.text.indexOf(evidence, first + 1) >= 0) return null;
  return {
    evidence,
    evidenceStart: unit.sourceStart + first,
    evidenceEnd: unit.sourceStart + first + evidence.length,
  };
}

function valueFromEvidence(evidence) {
  const values = ComparisonFactRiskSignals.detect(evidence)
    .filter((signal) => ["money", "percentage"].includes(signal.kind))
    .map((signal) => {
      if (signal.kind === "money")
        return {
          kind: "money",
          amount: Number(signal.normalizedValue),
          currency: "EUR",
        };
      return {
        kind: "percentage",
        percent: Number(
          String(signal.normalizedValue).replace("%", "").replace(",", ".")
        ),
      };
    })
    .filter((value) =>
      Number.isFinite(value.kind === "money" ? value.amount : value.percent)
    );
  return values.length === 1 ? values[0] : null;
}

function factFor(unit, evidence) {
  const heading = (unit.headingPath || []).filter(Boolean).at(-1);
  return {
    factKey: crypto
      .createHash("sha256")
      .update(
        [
          "deductible-semantic",
          unit.pageNumber ?? "document",
          evidence.evidenceStart,
          evidence.evidenceEnd,
          evidence.evidence,
        ].join("\u0000")
      )
      .digest("hex"),
    unitKey: unit.blockKey,
    factType: "deductible",
    label: String(heading || evidence.evidence).slice(0, 160),
    claimText: evidence.evidence,
    value: valueFromEvidence(evidence.evidence),
    conditions: [],
    pageNumber: unit.pageNumber,
    evidenceText: evidence.evidence,
    evidenceStart: evidence.evidenceStart,
    evidenceEnd: evidence.evidenceEnd,
    sourceMethod: "bounded-semantic-deductible-review",
    confidence: 1,
  };
}

async function completion(Connector, messages, batchSize) {
  if (typeof Connector?.getPolicyInventoryCompletion === "function")
    return PolicyInferenceQueue.runOperation({
      metricContext: {
        kind: "comparison_deductible_candidate_review",
        batchSize,
      },
      operation: () =>
        Connector.getPolicyInventoryCompletion(messages, {
          temperature: 0,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
        }),
    });
  return PolicyInferenceQueue.run({
    Connector,
    messages,
    retries: 0,
    completionOptions: { temperature: 0, max_tokens: MAX_OUTPUT_TOKENS },
    metricContext: { kind: "comparison_deductible_candidate_review" },
  });
}

const ComparisonDeductibleCandidateResolver = {
  maxCandidatesPerCall: MAX_CANDIDATES_PER_CALL,
  maxTotalCandidates: MAX_TOTAL_CANDIDATES,

  async resolve({ candidates = [], Connector }) {
    const units = candidates.slice(0, MAX_TOTAL_CANDIDATES);
    const overflow = Math.max(0, candidates.length - units.length);
    if (!units.length)
      return { factsByBlock: new Map(), modelCalls: 0, unresolved: 0 };
    if (
      typeof Connector?.getChatCompletion !== "function" &&
      typeof Connector?.getPolicyInventoryCompletion !== "function"
    )
      return {
        factsByBlock: new Map(),
        modelCalls: 0,
        unresolved: units.length + overflow,
      };
    const factsByBlock = new Map();
    let modelCalls = 0;
    let unresolved = overflow;
    const errors = [];
    for (
      let offset = 0;
      offset < units.length;
      offset += MAX_CANDIDATES_PER_CALL
    ) {
      const batch = units.slice(offset, offset + MAX_CANDIDATES_PER_CALL);
      const keyed = batch.map((unit, index) => ({
        key: `c${offset + index + 1}`,
        unit,
      }));
      modelCalls += 1;
      try {
        const response = await completion(
          Connector,
          [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: JSON.stringify({
                candidates: keyed.map(({ key, unit }) => ({
                  key,
                  physicalPage: unit.pageNumber,
                  headingPath: unit.headingPath || [],
                  text: unit.text,
                })),
              }),
            },
          ],
          keyed.length
        );
        const parsed = parseJson(response?.textResponse);
        if (!Array.isArray(parsed?.candidates))
          throw new Error("Resolver response has no candidates array.");
        const inputByKey = new Map(
          keyed.map((entry) => [entry.key, entry.unit])
        );
        const seen = new Set();
        const settled = new Set();
        for (const receipt of parsed.candidates) {
          const key = String(receipt?.key || "");
          const unit = inputByKey.get(key);
          if (!unit || seen.has(key)) continue;
          seen.add(key);
          if (receipt.deductible !== true) {
            settled.add(key);
            continue;
          }
          const evidence = exactOffset(unit, receipt.evidenceText);
          if (!evidence) continue;
          factsByBlock.set(unit.id, [factFor(unit, evidence)]);
          settled.add(key);
        }
        unresolved += batch.length - settled.size;
      } catch (error) {
        unresolved += batch.length;
        errors.push(error.message);
      }
    }
    return {
      factsByBlock,
      modelCalls,
      unresolved,
      error: errors.length ? errors.join("; ") : null,
    };
  },
};

module.exports = {
  ComparisonDeductibleCandidateResolver,
  MAX_CANDIDATES_PER_CALL,
  MAX_TOTAL_CANDIDATES,
};

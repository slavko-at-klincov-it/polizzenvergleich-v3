const VERIFIED_FSL_MULTI_INSURANCE_HEADING =
  "VERIFIED_FEUER_STURM_LEITUNGSWASSER_COMBINATION";
const SOURCE_BOUND_MULTILINE_COMBINED_INSURANCE_HEADING_V1 =
  "SOURCE_BOUND_MULTILINE_COMBINED_INSURANCE_HEADING_V1";

const FSL_SCOPE_KEYS = Object.freeze([
  "FEUER_INSURANCE",
  "LEITUNGSWASSER_INSURANCE",
  "STURM_INSURANCE",
]);
const FSLH_SCOPE_KEYS = Object.freeze([
  "FEUER_INSURANCE",
  "HAFTPFLICHT_INSURANCE",
  "LEITUNGSWASSER_INSURANCE",
  "STURM_INSURANCE",
]);

function canonicalScopeKeys(scopeKeys) {
  return [...new Set(scopeKeys || [])].sort();
}

function sameKeys(left, right) {
  return JSON.stringify(canonicalScopeKeys(left)) === JSON.stringify(right);
}

function branchMatches(body, pattern) {
  return [...body.matchAll(pattern)];
}

/**
 * Certifies only the two known coordinated building-insurance headings. The
 * lexical remainder must consist solely of coordination punctuation, so an
 * unknown branch can never be silently discarded from a recognised subset.
 * Role: validate/decide. Side effects: none.
 */
function certifiedCombinedInsuranceHeading(value) {
  const text = String(value || "").normalize("NFKC");
  const heading = text.match(
    /^(?:\s*\d{1,3}\.\s+)?Versicherungsumfang\s+([\s\S]+)$/iu
  );
  if (!heading) return null;

  let body = heading[1].replace(/[\r\n\t]+/gu, " ").replace(/\s+/gu, " ");
  const definitions = [
    [
      "HAFTPFLICHT_INSURANCE",
      /\b(?:Geb[aä]ude\s*-\s*und\s*)?Grundst[uü]ckshaftpflicht(?=\s*versicherung\b|\s*[-,]|\s*$)/giu,
    ],
    ["FEUER_INSURANCE", /\bFeuer(?=\s*versicherung\b|\s*[-,]|\s*$)/giu],
    ["STURM_INSURANCE", /\bSturm(?=\s*versicherung\b|\s*[-,]|\s*$)/giu],
    [
      "LEITUNGSWASSER_INSURANCE",
      /\bLeitungswasser(?=\s*versicherung\b|\s*[-,]|\s*$)/giu,
    ],
  ];
  const scopeKeys = [];
  for (const [scopeKey, pattern] of definitions) {
    const matches = branchMatches(body, pattern);
    if (matches.length > 1) return null;
    if (matches.length === 1) {
      scopeKeys.push(scopeKey);
      body = body.replace(pattern, " ");
    }
  }
  body = body
    .replace(/\bversicherung\b/giu, " ")
    .replace(/\bund\b/giu, " ")
    .replace(/[\s,;:/()\-–—]+/gu, "")
    .trim();
  if (body) return null;

  const canonical = canonicalScopeKeys(scopeKeys);
  if (sameKeys(canonical, FSL_SCOPE_KEYS))
    return {
      scopeKeys: canonical,
      scopeResolution: VERIFIED_FSL_MULTI_INSURANCE_HEADING,
    };
  if (sameKeys(canonical, FSLH_SCOPE_KEYS))
    return {
      scopeKeys: canonical,
      scopeResolution: SOURCE_BOUND_MULTILINE_COMBINED_INSURANCE_HEADING_V1,
    };
  return null;
}

function validCertifiedCombinedInsuranceHeading({
  text,
  scopeKey,
  scopeKeys,
  scopeResolution,
}) {
  if (scopeKey !== null && scopeKey !== undefined) return false;
  const certified = certifiedCombinedInsuranceHeading(text);
  return Boolean(
    certified &&
      certified.scopeResolution === scopeResolution &&
      sameKeys(scopeKeys, certified.scopeKeys) &&
      Array.isArray(scopeKeys) &&
      new Set(scopeKeys).size === scopeKeys.length
  );
}

module.exports = {
  FSLH_SCOPE_KEYS,
  FSL_SCOPE_KEYS,
  SOURCE_BOUND_MULTILINE_COMBINED_INSURANCE_HEADING_V1,
  VERIFIED_FSL_MULTI_INSURANCE_HEADING,
  certifiedCombinedInsuranceHeading,
  validCertifiedCombinedInsuranceHeading,
};

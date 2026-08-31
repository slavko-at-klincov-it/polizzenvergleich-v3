const HEADING_NUMBER_PREFIX = String.raw`(?:\d{1,3}(?:\.\d{1,3})*\.?\s+)?`;
const HEADING_SUBJECT = String.raw`(?:Kosten|Sch[aä]den|Gefahren)(?:\s+(?:und|oder)\s+(?:Kosten|Sch[aä]den|Gefahren))*`;
const HEADING_REFERENCE = String.raw`(?:\s+(?:gem(?:[aä]ß|[aä]ss|aess)|nach)\s+(?:Art(?:ikel)?\.?|\u00a7)\s*\d+(?:\.\d+)*(?:\s*(?:Abs\.?|Absatz)\s*\d+[a-z]?)?)?`;

const SEMANTIC_POSITIVE_COVERAGE_HEADING = new RegExp(
  String.raw`^[\t ]*${HEADING_NUMBER_PREFIX}Versicherte\s+${HEADING_SUBJECT}${HEADING_REFERENCE}[\t ]*:?[\t ]*$`,
  "gimu"
);
const SEMANTIC_NEGATIVE_COVERAGE_HEADING = new RegExp(
  String.raw`^[\t ]*${HEADING_NUMBER_PREFIX}Nicht\s+versicherte\s+${HEADING_SUBJECT}${HEADING_REFERENCE}[\t ]*:?[\t ]*$`,
  "gimu"
);

/**
 * Recognises only a complete semantic coverage heading. A sentence that merely
 * mentions insured or uninsured costs, damage or perils must not become a
 * section governor. Side effects: none. Role: decide.
 */
function semanticCoverageHeadingPolarity(value) {
  const text = String(value || "");
  const positive = new RegExp(
    SEMANTIC_POSITIVE_COVERAGE_HEADING.source,
    SEMANTIC_POSITIVE_COVERAGE_HEADING.flags.replace("g", "")
  );
  if (positive.test(text)) return "POSITIVE";
  const negative = new RegExp(
    SEMANTIC_NEGATIVE_COVERAGE_HEADING.source,
    SEMANTIC_NEGATIVE_COVERAGE_HEADING.flags.replace("g", "")
  );
  return negative.test(text) ? "NEGATIVE" : null;
}

module.exports = {
  SEMANTIC_NEGATIVE_COVERAGE_HEADING,
  SEMANTIC_POSITIVE_COVERAGE_HEADING,
  semanticCoverageHeadingPolarity,
};

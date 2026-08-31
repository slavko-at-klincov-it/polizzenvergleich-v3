const { POINT_OUTCOME } = require("./pointDecision");

const UNCLEAR_REASON_TEXT = Object.freeze({
  MISSING_BOTH:
    "In beiden Polizzen fehlt ein belastbar belegter Inhalt. Daraus lässt sich weder Deckung noch Ausschluss ableiten.",
  MISSING_ONE_SIDE:
    "Nur eine Polizze enthält einen belastbar belegten Inhalt. Ohne vollständig geprüften Negativbefund ist daraus kein Vorteil ableitbar.",
  PACKAGE_REVIEW_STATUS_BLOCKS_DECISION:
    "Mindestens ein Prüfstatus lässt noch keine sichere Bewertung zu.",
  ATOMIC_EVIDENCE_UNAVAILABLE:
    "Die für eine sichere Bewertung erforderlichen Einzelfakten liegen für diesen Lauf noch nicht vollständig vor.",
  ATOMIC_EVIDENCE_MISSING_BOTH:
    "Mindestens ein erforderlicher Einzelfakt ist in beiden Polizzen nicht belegt.",
  ATOMIC_EVIDENCE_MISSING_ONE_SIDE:
    "Mindestens ein erforderlicher Einzelfakt ist nicht für beide Polizzen belegt.",
  ATOMIC_DOCUMENT_RANK_UNRESOLVED:
    "Mehrere unterschiedliche Dokumentangaben betreffen denselben Punkt; Vorrang oder Ersetzung ist noch nicht geklärt.",
  ATOMIC_EVIDENCE_INCOMPLETE:
    "Mindestens ein erforderlicher Einzelfakt ist unvollständig, widersprüchlich oder nicht eindeutig mit einer Quelle belegt.",
  NO_APPROVED_RULE_FOR_ALL_DIMENSIONS:
    "Nicht alle belegten Unterschiede können mit einer freigegebenen Vergleichsregel sicher bewertet werden.",
  MIXED_DIMENSION_WINNERS:
    "Einzelne Teilaspekte sprechen für unterschiedliche Polizzen; daraus folgt kein einheitlicher Vorteil.",
});
const APPROVED_RULE_IDS = new Set([
  "ATOMIC_COMPARABILITY_GATE_V1",
  "ATOMIC_COVERAGE_EQUALITY_V1",
  "COMPLETE_SEARCH_ABSENCE_BOTH_V1",
  "FAIL_CLOSED_CONDITIONAL_SOURCE_V1",
  "FAIL_CLOSED_V1",
  "HIGHER_COVERAGE_LIMIT_V1",
  "INCLUDED_OVER_ASSUMED_NOT_INCLUDED_V1",
  "INCLUDED_OVER_EXCLUDED_V1",
  "LOWER_DEDUCTIBLE_V1",
  "QUALIFIED_ABSENCE_DOCUMENTATION_DIFFERENCE_V1",
  "TYPED_VALUE_EQUALITY_V1",
]);

function approvedRule(value) {
  const rules = String(value || "").split("+");
  return rules.length > 0 && rules.every((rule) => APPROVED_RULE_IDS.has(rule));
}

function customerLanguage(value) {
  return String(value || "")
    .replace(/\bPaket ([AB])\b/gu, "Polizze $1")
    .replace(/\batomare(?:n|r|m|s)? Fakten?\b/giu, "Einzelfakten")
    .replace(/\batomare(?:n|r|m|s)? Komponenten?\b/giu, "Teilpunkte")
    .replace(/\bScope\b/gu, "Deckungsumfang")
    .replace(/\bBetragsqualifier\b/gu, "Bezugsart des Betrags")
    .replace(/\bWerttyp\b/gu, "Art des Werts")
    .replace(/\bVergleichsdimensionen\b/gu, "Vergleichsmerkmalen")
    .replace(/\brangaufgelöste\b/gu, "eindeutig eingeordnete")
    .replace(
      /\s*Die ausgewiesene Regel bewertet diesen vollständig belegten Vergleichspunkt zugunsten von [AB]\.\s*$/u,
      ""
    )
    .replace(/\s+/gu, " ")
    .trim();
}

function withoutPrefix(value, prefix) {
  const text = customerLanguage(value);
  return text.startsWith(prefix) ? text.slice(prefix.length).trim() : text;
}

function customerResultText(row) {
  const decision = row?.pointDecision;
  const validOutcome = Object.values(POINT_OUTCOME).includes(decision?.outcome);
  const expectedReviewRequired = decision?.outcome === POINT_OUTCOME.UNCLEAR;
  const invalidDecision =
    !validOutcome ||
    decision?.reviewRequired !== expectedReviewRequired ||
    !approvedRule(decision?.ruleId) ||
    (decision?.outcome !== POINT_OUTCOME.NO_DOCUMENTED_ADVANTAGE &&
      !String(decision?.reason || "").trim());
  if (invalidDecision)
    return "Kein klarer Vorteil: ungeklärt – Die gespeicherte Punktentscheidung ist unvollständig und muss geprüft werden.";

  if (decision.outcome === POINT_OUTCOME.ADVANTAGE_A)
    return `Vorteil Polizze A: ${withoutPrefix(
      decision.reason,
      "Vorteil Polizze A:"
    )}`;
  if (decision.outcome === POINT_OUTCOME.ADVANTAGE_B)
    return `Vorteil Polizze B: ${withoutPrefix(
      decision.reason,
      "Vorteil Polizze B:"
    )}`;
  if (decision.outcome === POINT_OUTCOME.EQUIVALENT)
    return `Kein klarer Vorteil: gleichwertig – ${withoutPrefix(
      decision.reason,
      "Gleichwertig:"
    )}`;
  if (decision.outcome === POINT_OUTCOME.NOT_COMPARABLE)
    return `Kein klarer Vorteil: nicht vergleichbar – ${withoutPrefix(
      decision.reason,
      "Nicht direkt vergleichbar:"
    )}`;
  if (decision.outcome === POINT_OUTCOME.DOCUMENTATION_DIFFERENCE)
    return `Kein klarer Vorteil: Dokumentationsunterschied – ${withoutPrefix(
      decision.reason,
      "Dokumentationsunterschied:"
    )}`;
  if (decision.outcome === POINT_OUTCOME.NO_DOCUMENTED_ADVANTAGE)
    return "Kein klarer Vorteil: ungeklärt – In beiden vollständig geprüften bereitgestellten Polizzen wurde keine entsprechende Regelung gefunden. Dies belegt weder Gleichheit noch einen ausdrücklichen Ausschluss.";

  return `Kein klarer Vorteil: ungeklärt – ${
    UNCLEAR_REASON_TEXT[decision.reasonCode] ||
    customerLanguage(decision.reason) ||
    "Für diesen Vergleichspunkt fehlt eine sichere Bewertungsgrundlage."
  }`;
}

module.exports = { customerResultText };

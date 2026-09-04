const {
  ANY_COMPONENT_IDENTITY_GATE_RULE_ID,
  POINT_OUTCOME,
} = require("./pointDecision");
const {
  AUTOMATIC_INDEX_ADJUSTMENT_PRESENCE_EQUALITY_RULE_ID,
} = require("./automaticIndexAdjustmentComparisonContract");
const {
  VS25_AUTHORITY_LIMIT_PORTFOLIO_RULE_ID,
} = require("./vs25AuthorityReconstructionLimitPortfolioContract");
const {
  STORM_DEFINITION_THRESHOLD_EQUALITY_RULE_ID,
} = require("./stormDefinitionThresholdContract");

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
  COMPARISON_SCOPE_PROVENANCE_INCOMPLETE:
    "Für mindestens einen engeren Deckungsbeleg fehlt die eindeutige Zuordnung des Vergleichsumfangs. Ein nur einseitig belegter Umfang ist noch kein gesicherter fachlicher Unterschied.",
  OBJECT_SCOPE_PROVENANCE_INCOMPLETE:
    "Für mindestens eine Polizze fehlt die eindeutige Zuordnung des versicherten Objektumfangs.",
  NO_APPROVED_RULE_FOR_ALL_DIMENSIONS:
    "Nicht alle belegten Unterschiede können mit einer freigegebenen Vergleichsregel sicher bewertet werden.",
  MIXED_DIMENSION_WINNERS:
    "Einzelne Teilaspekte sprechen für unterschiedliche Polizzen; daraus folgt kein einheitlicher Vorteil.",
});
const PACKAGE_REVIEW_AUDIT_CONTRACTS = new Map([
  [1, "PACKAGE_REVIEW_BLOCKERS_V1"],
  [2, "PACKAGE_REVIEW_BLOCKERS_V2"],
]);
const PACKAGE_REVIEW_HINTS = Object.freeze({
  MISSING_REQUIRED_COMPONENT:
    "Mindestens ein erforderlicher Teilpunkt ist nicht vollständig belegt.",
  UNKNOWN_COVERAGE_EFFECT:
    "Die Vertragswirkung eines Teilpunkts ist noch nicht eindeutig bestimmbar.",
  COVERAGE_EFFECT_NOT_DECISIVE:
    "Die Vertragswirkung eines Teilpunkts ist noch nicht eindeutig bestimmbar.",
  FIELD_INCOMPLETE:
    "Angeforderte Werte, Limits oder sonstige Angaben sind noch nicht vollständig gebunden.",
  SCOPE_INCOMPLETE:
    "Eine Fundstelle gilt nur für einen engeren oder noch nicht eindeutig abgegrenzten Deckungsumfang.",
  SOURCE_BINDING_INCOMPLETE:
    "Eine mögliche Fundstelle ist noch nicht eindeutig als Beleg bestätigt.",
  UNRESOLVED_CANDIDATE:
    "Eine mögliche Fundstelle ist noch nicht eindeutig als Beleg bestätigt.",
  MULTIPLE_ATOMS_SAME_COMPONENT:
    "Mehrere Dokumentangaben zum selben Teilpunkt sind noch nicht eindeutig eingeordnet.",
  UNRESOLVED_DOCUMENT_PRECEDENCE:
    "Mehrere Dokumentangaben zum selben Teilpunkt sind noch nicht eindeutig eingeordnet.",
  CONFLICTING_COVERAGE:
    "Mehrere Dokumentangaben zum selben Teilpunkt sind noch nicht eindeutig eingeordnet.",
  DOCUMENT_STATUS_APPLICABILITY_MISMATCH:
    "Dokumentstatus und Geltungsart eines Teilpunkts passen noch nicht eindeutig zusammen.",
  UNCLASSIFIED_DOCUMENT_REVIEW_BLOCKER:
    "Der offene Prüfgrund konnte technisch noch nicht genauer eingeordnet werden.",
});
const CUSTOMER_RESULT_RULE_OUTCOME_CONTRACT_ID =
  "CUSTOMER_RESULT_RULE_OUTCOME_V1";
const A_OR_B = Object.freeze([
  POINT_OUTCOME.ADVANTAGE_A,
  POINT_OUTCOME.ADVANTAGE_B,
]);
const A_OR_B_OR_EQUAL = Object.freeze([
  ...A_OR_B,
  POINT_OUTCOME.EQUIVALENT,
]);
const CUSTOMER_RESULT_RULE_OUTCOME_CONTRACT = Object.freeze({
  schemaVersion: 1,
  contractId: CUSTOMER_RESULT_RULE_OUTCOME_CONTRACT_ID,
  rules: Object.freeze({
    [ANY_COMPONENT_IDENTITY_GATE_RULE_ID]: Object.freeze([
      POINT_OUTCOME.NOT_COMPARABLE,
    ]),
    [AUTOMATIC_INDEX_ADJUSTMENT_PRESENCE_EQUALITY_RULE_ID]: Object.freeze([
      POINT_OUTCOME.EQUIVALENT,
    ]),
    ATOMIC_COMPARABILITY_GATE_V1: Object.freeze([
      POINT_OUTCOME.NOT_COMPARABLE,
    ]),
    ATOMIC_COVERAGE_EQUALITY_V1: Object.freeze([
      POINT_OUTCOME.EQUIVALENT,
    ]),
    ANY_COMPONENT_IDENTITY_GATE_V1: Object.freeze([
      POINT_OUTCOME.NOT_COMPARABLE,
    ]),
    COMPLETE_SEARCH_ABSENCE_BOTH_V1: Object.freeze([
      POINT_OUTCOME.NO_DOCUMENTED_ADVANTAGE,
    ]),
    EQUAL_COMPLETE_CONTROLLED_ABSENCE_BOTH_V1: Object.freeze([
      POINT_OUTCOME.EQUIVALENT,
    ]),
    FAIL_CLOSED_COMPARISON_SCOPE_PROVENANCE_V1: Object.freeze([
      POINT_OUTCOME.UNCLEAR,
    ]),
    FAIL_CLOSED_CONDITIONAL_SOURCE_V1: Object.freeze([
      POINT_OUTCOME.UNCLEAR,
    ]),
    FAIL_CLOSED_OBJECT_SCOPE_IDENTITY_V1: Object.freeze([
      POINT_OUTCOME.UNCLEAR,
    ]),
    FAIL_CLOSED_V1: Object.freeze([POINT_OUTCOME.UNCLEAR]),
    FE_A01_FIRE_DEFINITION_SCOPE_COMPARISON_V1: A_OR_B_OR_EQUAL,
    FE_C07_HIGHER_UNCONDITIONED_PERCENT_LIMIT_V1: A_OR_B,
    FE_C02_BROADER_MEMBERSHIP_CONDITION_SCOPE_V1: A_OR_B,
    HIGHER_COVERAGE_LIMIT_V1: A_OR_B,
    INCLUDED_OVER_ASSUMED_NOT_INCLUDED_V1: A_OR_B,
    INCLUDED_OVER_QUALIFIED_ABSENCE_V1: A_OR_B,
    INCLUDED_OVER_EXCLUDED_V1: A_OR_B,
    LOWER_DEDUCTIBLE_V1: A_OR_B,
    LW20_QUALIFIED_ABSENCE_UNOVERRIDDEN_DEFAULT_EXCLUSION_EQUALITY_V1:
      Object.freeze([POINT_OUTCOME.EQUIVALENT]),
    EQUAL_DIRECTED_OBJECT_FAMILY_COVERAGE_V1: Object.freeze([
      POINT_OUTCOME.EQUIVALENT,
    ]),
    QUALIFIED_ABSENCE_DOCUMENTATION_DIFFERENCE_V1: Object.freeze([
      POINT_OUTCOME.DOCUMENTATION_DIFFERENCE,
    ]),
    QUALIFIED_ABSENCE_DOCUMENTATION_DIFFERENCE_V2: Object.freeze([
      POINT_OUTCOME.DOCUMENTATION_DIFFERENCE,
    ]),
    SOLE_SCOPE_REVIEW_BLOCKER_TO_ATOMIC_NONCOMPARABLE_V1: Object.freeze([
      POINT_OUTCOME.NOT_COMPARABLE,
    ]),
    SOURCE_BOUND_OBJECT_SCOPE_IDENTITY_GATE_V1: Object.freeze([
      POINT_OUTCOME.NOT_COMPARABLE,
    ]),
    TYPED_VALUE_EQUALITY_V1: Object.freeze([POINT_OUTCOME.EQUIVALENT]),
    VS08_EQUAL_PACKAGE_CONDITION_CONSENSUS_V1: Object.freeze([
      POINT_OUTCOME.EQUIVALENT,
    ]),
    VS15_EQUAL_CONTROLLED_NAMED_OUTBUILDING_QUALIFIER_ABSENCE_BOTH_V1:
      Object.freeze([POINT_OUTCOME.EQUIVALENT]),
    VS21_INCOMPATIBLE_LIMIT_VALUE_TYPES_V1: Object.freeze([
      POINT_OUTCOME.NOT_COMPARABLE,
    ]),
    VS22_HAZARDOUS_WASTE_PORTFOLIO_ADVANTAGE_V1: A_OR_B,
    VS24_EQUIVALENT_GLASS_LOSS_SCAFFOLDING_COST_WITHOUT_LOCAL_LIMIT_V1:
      Object.freeze([POINT_OUTCOME.EQUIVALENT]),
    [VS25_AUTHORITY_LIMIT_PORTFOLIO_RULE_ID]: A_OR_B_OR_EQUAL,
    [STORM_DEFINITION_THRESHOLD_EQUALITY_RULE_ID]: Object.freeze([
      POINT_OUTCOME.EQUIVALENT,
    ]),
  }),
});
const APPROVED_RULE_OUTCOMES = new Map(
  Object.entries(CUSTOMER_RESULT_RULE_OUTCOME_CONTRACT.rules).map(
    ([ruleId, outcomes]) => [ruleId, new Set(outcomes)]
  )
);

function approvedRule(value, outcome) {
  const rules = String(value || "").split("+");
  return (
    rules.length > 0 &&
    rules.every(
      (rule) =>
        APPROVED_RULE_OUTCOMES.has(rule) &&
        APPROVED_RULE_OUTCOMES.get(rule).has(outcome)
    )
  );
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

function packageReviewCustomerExplanation(pointDecision) {
  if (pointDecision?.reasonCode !== "PACKAGE_REVIEW_STATUS_BLOCKS_DECISION")
    return null;
  const audit = pointDecision?.packageReviewAudit;
  if (
    !PACKAGE_REVIEW_AUDIT_CONTRACTS.has(audit?.schemaVersion) ||
    audit?.contractId !==
      PACKAGE_REVIEW_AUDIT_CONTRACTS.get(audit?.schemaVersion) ||
    !Array.isArray(audit.blockers) ||
    audit.blockers.length === 0
  )
    return null;

  const bySide = new Map([
    ["A", new Set()],
    ["B", new Set()],
  ]);
  for (const blocker of audit.blockers) {
    const hint = PACKAGE_REVIEW_HINTS[blocker?.code];
    if (!hint || !bySide.has(blocker?.side)) return null;
    bySide.get(blocker.side).add(hint);
  }
  const sideTexts = [...bySide.entries()]
    .filter(([, hints]) => hints.size > 0)
    .map(([side, hints]) => `Polizze ${side}: ${[...hints].join(" ")}`);
  if (sideTexts.length === 0) return null;
  return `${sideTexts.join(" ")} Mehrere Hinweise innerhalb derselben Vergleichszeile werden nicht zusätzlich gezählt.`;
}

function customerResultText(row) {
  const decision = row?.pointDecision;
  const validOutcome = Object.values(POINT_OUTCOME).includes(decision?.outcome);
  const expectedReviewRequired = decision?.outcome === POINT_OUTCOME.UNCLEAR;
  const invalidDecision =
    !validOutcome ||
    decision?.reviewRequired !== expectedReviewRequired ||
    !approvedRule(decision?.ruleId, decision?.outcome) ||
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
    return "Kein klarer Vorteil: In beiden Polizzen wurde nach vollständiger kontrollierter Suche keine passende Vertragsregelung gefunden. Dies belegt weder Gleichheit noch einen ausdrücklichen Ausschluss.";

  const packageReviewExplanation = packageReviewCustomerExplanation(decision);
  return `Kein klarer Vorteil: ungeklärt – ${
    packageReviewExplanation ||
    UNCLEAR_REASON_TEXT[decision.reasonCode] ||
    customerLanguage(decision.reason) ||
    "Für diesen Vergleichspunkt fehlt eine sichere Bewertungsgrundlage."
  }`;
}

module.exports = {
  CUSTOMER_RESULT_RULE_OUTCOME_CONTRACT,
  CUSTOMER_RESULT_RULE_OUTCOME_CONTRACT_ID,
  customerResultText,
  packageReviewCustomerExplanation,
};

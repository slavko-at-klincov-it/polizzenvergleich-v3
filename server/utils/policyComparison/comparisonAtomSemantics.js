const STRONG_COVERAGE_CONDITION_MARKER =
  /\b(?:außer|ausgenommen|so\s+ferne|sofern|soweit|vorausgesetzt|vorbehaltlich|unter\s+der\s+Bedingung|es\s+sei\s+denn)\b/iu;
const CONDITIONAL_COVERAGE_WHEN =
  /(?:\b(?:versichert|mitversichert|gedeckt|eingeschlossen|ausgeschlossen)\b|\b(?:Versicherungsschutz|Deckung|Entschädigung|Leistung)\b).{0,160}\b(?:wenn|falls)\b|\b(?:nur\s+(?:dann\s+)?wenn|falls)\b.{0,160}(?:\b(?:versichert|mitversichert|gedeckt|eingeschlossen|ausgeschlossen)\b|\b(?:Versicherungsschutz|Deckung|Entschädigung|Leistung)\b)/isu;
const WAITING_PERIOD_CONDITION_MARKER =
  /\b(?:karenz(?:frist|zeit)?|warte(?:frist|zeit))\b/iu;
const NEGATED_WAITING_PERIOD_MARKER =
  /(?:\b(?:ohne|keine?|keinerlei)\s+(?:eine?\s+)?(?:karenz(?:frist|zeit)?|warte(?:frist|zeit))\b|\b(?:karenz(?:frist|zeit)?|warte(?:frist|zeit))\b[^.!?;:]{0,32}\b(?:entfällt|besteht\s+nicht|gilt\s+nicht|ist\s+nicht\s+vorgesehen)\b)/iu;
const OPTIONAL_WORD_MARKER = /(?<!\p{L})optional\p{L}*(?!\p{L})/iu;
const NEGATED_OPTIONAL_WORD_MARKER =
  /\bnicht(?:\s+\p{L}+){0,2}\s+optional\p{L}*(?!\p{L})/iu;
const ELECTIVE_WORD_MARKER = /(?<!\p{L})wahlweise(?!\p{L})/iu;
const NEGATED_ELECTIVE_WORD_MARKER =
  /\bnicht(?:\s+\p{L}+){0,2}\s+wahlweise(?!\p{L})/iu;
const ADDITIONAL_PREMIUM_MARKER =
  /\bgegen\s+(?:eine?\s+)?(?:mehrprämie|mehrbeitrag|prämienzuschlag|beitragszuschlag)\b/iu;
const ON_REQUEST_MARKER = /\bauf\s+(?:ausdrücklichen\s+)?wunsch\b/iu;
const NEGATED_ON_REQUEST_MARKER =
  /\bnicht\s+auf\s+(?:ausdrücklichen\s+)?wunsch\b/iu;
const MAY_BE_INCLUDED_MARKER =
  /\bkann\b[^.!?;:]{0,96}\b(?:eingeschlossen|mitversichert|vereinbart)\s+werden\b/iu;
const NEGATED_MAY_BE_INCLUDED_MARKER =
  /\bkann\b[^.!?;:]{0,48}\bnicht\b[^.!?;:]{0,48}\b(?:eingeschlossen|mitversichert|vereinbart)\s+werden\b/iu;
const SEPARATE_AGREEMENT_MARKER =
  /\bnur\s+(?:bei|nach)\s+(?:gesonderter|besonderer|ausdrücklicher)\s+vereinbarung\b/iu;

const INTENDED_OPERATION_MARKER =
  /(?:(?<!\p{L})bestimmungsgemäß\p{L}*(?!\p{L})[^.!?;:]{0,96}(?<!\p{L})(?:(?:auslös|betätig|betrieb|aktivier)\p{L}*|löst|lösen)(?!\p{L})|(?<!\p{L})(?:(?:auslös|betätig|betrieb|aktivier)\p{L}*|löst|lösen)(?!\p{L})[^.!?;:]{0,96}(?<!\p{L})bestimmungsgemäß\p{L}*(?!\p{L}))/iu;
const UNINTENDED_EVENT_MARKER =
  /(?:(?<!\p{L})bestimmungswidrig\p{L}*(?!\p{L})[^.!?;:]{0,96}(?<!\p{L})(?:(?:austret|auslös|betätig|betrieb|aktivier|freisetz)\p{L}*|tritt)(?!\p{L})|(?<!\p{L})(?:(?:austret|auslös|betätig|betrieb|aktivier|freisetz)\p{L}*|tritt)(?!\p{L})[^.!?;:]{0,96}(?<!\p{L})bestimmungswidrig\p{L}*(?!\p{L}))/iu;
const NEGATED_INTENDED_OPERATION_MARKER =
  /(?:\bnicht\s+bestimmungsgemäß\p{L}*(?!\p{L})|(?<!\p{L})bestimmungsgemäß\p{L}*\s+nicht\s+(?:aus|ein|an)\b)/iu;
const NEGATED_UNINTENDED_EVENT_MARKER =
  /(?:\bnicht\s+bestimmungswidrig\p{L}*(?!\p{L})|(?<!\p{L})bestimmungswidrig\p{L}*\s+nicht\s+(?:aus|ein|an|frei)\b)/iu;

function boundSourceTexts(atom) {
  return [
    ...(atom?.sources || []).flatMap(({ exactText, conditionCheckText }) => [
      exactText,
      conditionCheckText,
    ]),
    ...(atom?.fields || []).flatMap(({ facts }) =>
      (facts || []).flatMap(({ source }) => [
        source?.exactText,
        source?.conditionCheckText,
      ])
    ),
  ].filter((text) => String(text || "").trim().length > 0);
}

function boundSourceUnits(atom) {
  return [
    ...(atom?.sources || []).map(
      ({ exactText, conditionCheckText }) =>
        `${exactText || ""}\n${conditionCheckText || ""}`
    ),
    ...(atom?.fields || []).flatMap(({ facts }) =>
      (facts || []).map(
        ({ source }) =>
          `${source?.exactText || ""}\n${source?.conditionCheckText || ""}`
      )
    ),
  ].filter((text) => String(text || "").trim().length > 0);
}

function hasConditionalCoverageSource(atom) {
  return boundSourceUnits(atom).some(
    (text) =>
      STRONG_COVERAGE_CONDITION_MARKER.test(text) ||
      CONDITIONAL_COVERAGE_WHEN.test(text) ||
      (WAITING_PERIOD_CONDITION_MARKER.test(text) &&
        !NEGATED_WAITING_PERIOD_MARKER.test(text))
  );
}

function hasOptionalCoverageSource(atom) {
  return boundSourceUnits(atom).some(
    (text) =>
      (OPTIONAL_WORD_MARKER.test(text) &&
        !NEGATED_OPTIONAL_WORD_MARKER.test(text)) ||
      (ELECTIVE_WORD_MARKER.test(text) &&
        !NEGATED_ELECTIVE_WORD_MARKER.test(text)) ||
      ADDITIONAL_PREMIUM_MARKER.test(text) ||
      (ON_REQUEST_MARKER.test(text) && !NEGATED_ON_REQUEST_MARKER.test(text)) ||
      (MAY_BE_INCLUDED_MARKER.test(text) &&
        !NEGATED_MAY_BE_INCLUDED_MARKER.test(text)) ||
      SEPARATE_AGREEMENT_MARKER.test(text)
  );
}

function hasConditionalOrOptionalCoverageSource(atom) {
  return hasConditionalCoverageSource(atom) || hasOptionalCoverageSource(atom);
}

function operationalEventMode(atom) {
  const texts = boundSourceTexts(atom);
  const intended = texts.some(
    (text) =>
      INTENDED_OPERATION_MARKER.test(text) &&
      !NEGATED_INTENDED_OPERATION_MARKER.test(text)
  );
  const unintended = texts.some(
    (text) =>
      UNINTENDED_EVENT_MARKER.test(text) &&
      !NEGATED_UNINTENDED_EVENT_MARKER.test(text)
  );
  if (intended && unintended) return "MIXED_OPERATION_MODES";
  if (intended) return "INTENDED_OPERATION";
  if (unintended) return "UNINTENDED_EVENT";
  return "UNSPECIFIED";
}

module.exports = {
  hasConditionalCoverageSource,
  hasConditionalOrOptionalCoverageSource,
  hasOptionalCoverageSource,
  operationalEventMode,
};

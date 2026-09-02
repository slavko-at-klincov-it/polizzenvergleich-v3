const crypto = require("crypto");

const FE_C07_CONDITION_ABSENCE_AUDIT_SCHEMA_VERSION = 1;
const FE_C07_CONDITION_ABSENCE_AUDIT_CONTRACT_ID =
  "FE_C07_LOCAL_GOVERNING_CLAUSE_NO_ADDITIONAL_CONDITION_V1";
const FE_C07_CONDITION_ABSENCE_ASSERTION =
  "NO_ADDITIONAL_CONDITION_IN_GOVERNING_CLAUSE";
const FE_C07_COMPONENT_ID = "sauna_or_infrared_cabin_in_common_room";
const ALLOWED_BINDINGS = new Set(["DIRECT", "NARROW_SCOPE"]);
const LOCAL_POSITIVE = /Mitversichert\s+sind\s+Gemeinschaftseinrichtungen/giu;
const SCOPED_OBJECT =
  /(?:Gemeinschaftsr[aä]um(?:e|en)?[\s\S]{0,100}?(?:Saun\p{L}*|Infrarotkabin\p{L}*)|(?:Saun\p{L}*|Infrarotkabin\p{L}*)[\s\S]{0,100}?Gemeinschaftsr[aä]um(?:e|en)?)/iu;
const QUALIFIED_LIMIT =
  /bis\s+zu\s+jeweils\s+\d{1,3}(?:[.,]\d+)?\s*%\s+der\s+Geb[aä]udeversicherungs-?\s*summe\s+auf\s+[,„“"']*Erstes\s+Risiko/giu;
const ALLOWED_OTHER_OBJECT_EXCLUSION =
  /\(\s*ausgenommen\s+Beleuchtungskörper(?:\s+im\s+Freien)?\s*\)/giu;
const RESTRICTIVE_OR_REFERENCED_CLAUSE =
  /(?:\b(?:wenn|falls|sofern|soweit|vorausgesetzt|vorbehaltlich|Voraussetzung(?:en)?|Bedingung(?:en)?|laut)\b|(?<!\p{L})gem[aä]ß(?!\p{L})|nach\s+Ma[ßs]gabe|nur\s+(?:dann\s+)?(?:wenn|falls|sofern|soweit|insoweit|bei)|unter\s+der\s+(?:Voraussetzung|Bedingung)|gegen\s+(?:eine?\s+)?(?:Mehrpr[aä]mie|Mehrbeitrag|Pr[aä]mienzuschlag)|\b(?:optional|wahlweise)\b|\bkann\b[\s\S]{0,100}\b(?:mitversichert|eingeschlossen)\s+werden\b|\b(?:nicht\s+(?:mit)?versichert|ausgeschlossen|ausgenommen)\b)/iu;

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function exactSourceUnit(occurrence) {
  const context = occurrence?.context;
  const text = context?.text;
  const documentStart = Number(context?.documentStart);
  const documentEnd = Number(context?.documentEnd);
  const occurrenceStart = Number(occurrence?.documentStart);
  const occurrenceEnd = Number(occurrence?.documentEnd);
  const occurrenceExactText = String(occurrence?.exactText || "");
  if (
    context?.unitType !== "PARAGRAPH" ||
    typeof text !== "string" ||
    !Number.isInteger(documentStart) ||
    !Number.isInteger(documentEnd) ||
    documentStart < 0 ||
    documentEnd !== documentStart + text.length ||
    !Number.isInteger(occurrenceStart) ||
    !Number.isInteger(occurrenceEnd) ||
    occurrenceStart < documentStart ||
    occurrenceEnd > documentEnd ||
    occurrenceEnd !== occurrenceStart + occurrenceExactText.length ||
    text.slice(
      occurrenceStart - documentStart,
      occurrenceEnd - documentStart
    ) !== occurrenceExactText ||
    !SCOPED_OBJECT.test(occurrenceExactText)
  )
    return null;
  return {
    text,
    documentStart,
    documentEnd,
    occurrenceStart,
    occurrenceEnd,
    occurrenceExactText,
  };
}

function certifiedLocalClause(unit) {
  const positives = [...unit.text.matchAll(LOCAL_POSITIVE)];
  const limits = [...unit.text.matchAll(QUALIFIED_LIMIT)];
  if (
    positives.length !== 1 ||
    limits.length !== 1 ||
    !SCOPED_OBJECT.test(unit.text)
  )
    return false;
  const withoutAllowedOtherObjectExclusion = unit.text.replace(
    ALLOWED_OTHER_OBJECT_EXCLUSION,
    ""
  );
  return !RESTRICTIVE_OR_REFERENCED_CLAUSE.test(
    withoutAllowedOtherObjectExclusion
  );
}

/**
 * Certifies only a complete paragraph-local FE-C07 clause whose affirmative
 * coverage, qualified limit and scoped object are all present and whose full
 * governing paragraph contains no additional condition or reference. The
 * narrow allow-list removes only the known exclusion for a different object.
 * Role: boundary. Side effects: none.
 */
function buildFeC07ConditionAbsenceAudit({ occurrence, binding }) {
  if (!ALLOWED_BINDINGS.has(binding)) return null;
  const unit = exactSourceUnit(occurrence);
  if (!unit || !certifiedLocalClause(unit)) return null;
  const physicalPageNumber = Number(
    occurrence?.physicalPageNumber || occurrence?.pageNumber
  );
  const candidateId = String(occurrence?.candidateId || "");
  if (
    !candidateId.startsWith("candidate:") ||
    !Number.isInteger(physicalPageNumber) ||
    physicalPageNumber < 1
  )
    return null;
  return Object.freeze({
    schemaVersion: FE_C07_CONDITION_ABSENCE_AUDIT_SCHEMA_VERSION,
    contractId: FE_C07_CONDITION_ABSENCE_AUDIT_CONTRACT_ID,
    assertion: FE_C07_CONDITION_ABSENCE_ASSERTION,
    requirementId: "FE-C07",
    componentId: FE_C07_COMPONENT_ID,
    binding,
    source: Object.freeze({
      candidateId,
      physicalPageNumber,
      documentStart: unit.documentStart,
      documentEnd: unit.documentEnd,
      exactText: unit.text,
      exactTextSha256: sha256(unit.text),
      occurrenceDocumentStart: unit.occurrenceStart,
      occurrenceDocumentEnd: unit.occurrenceEnd,
      occurrenceExactText: unit.occurrenceExactText,
    }),
  });
}

function validFeC07ConditionAbsenceAudit(audit) {
  const source = audit?.source;
  if (
    audit?.schemaVersion !== FE_C07_CONDITION_ABSENCE_AUDIT_SCHEMA_VERSION ||
    audit?.contractId !== FE_C07_CONDITION_ABSENCE_AUDIT_CONTRACT_ID ||
    audit?.assertion !== FE_C07_CONDITION_ABSENCE_ASSERTION ||
    audit?.requirementId !== "FE-C07" ||
    audit?.componentId !== FE_C07_COMPONENT_ID ||
    !ALLOWED_BINDINGS.has(audit?.binding) ||
    !String(source?.candidateId || "").startsWith("candidate:") ||
    !Number.isInteger(source?.physicalPageNumber) ||
    source.physicalPageNumber < 1 ||
    typeof source?.exactText !== "string" ||
    !Number.isInteger(source?.documentStart) ||
    !Number.isInteger(source?.documentEnd) ||
    source.documentStart < 0 ||
    source.documentEnd !== source.documentStart + source.exactText.length ||
    source.exactTextSha256 !== sha256(source.exactText) ||
    !Number.isInteger(source?.occurrenceDocumentStart) ||
    !Number.isInteger(source?.occurrenceDocumentEnd) ||
    source.occurrenceDocumentStart < source.documentStart ||
    source.occurrenceDocumentEnd > source.documentEnd ||
    source.occurrenceDocumentEnd !==
      source.occurrenceDocumentStart +
        String(source?.occurrenceExactText || "").length ||
    source.exactText.slice(
      source.occurrenceDocumentStart - source.documentStart,
      source.occurrenceDocumentEnd - source.documentStart
    ) !== source.occurrenceExactText
  )
    return false;
  return certifiedLocalClause({ text: source.exactText });
}

module.exports = {
  FE_C07_COMPONENT_ID,
  FE_C07_CONDITION_ABSENCE_ASSERTION,
  FE_C07_CONDITION_ABSENCE_AUDIT_CONTRACT_ID,
  FE_C07_CONDITION_ABSENCE_AUDIT_SCHEMA_VERSION,
  buildFeC07ConditionAbsenceAudit,
  validFeC07ConditionAbsenceAudit,
};

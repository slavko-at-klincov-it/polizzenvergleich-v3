const {
  hasConditionalOrOptionalCoverageSource,
} = require("./comparisonAtomSemantics");

const AUTOMATIC_INDEX_ADJUSTMENT_PRESENCE_EQUALITY_RULE_ID =
  "AUTOMATIC_INDEX_ADJUSTMENT_PRESENCE_EQUALITY_V1";

function normalized(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim()
    .toLocaleLowerCase("de-AT");
}

function emptyStrings(value) {
  return Array.isArray(value) && value.length === 0;
}

function exactVs10Shape(atom) {
  const declared = atom?.declaredComponents;
  return Boolean(
    atom?.requirementId === "VS-10" &&
      atom?.componentId === "automatic_index_adjustment" &&
      atom?.factRole === "CONDITION" &&
      atom?.coverageEffect === "INCLUDED" &&
      atom?.componentSatisfactionPolicy === "ALL" &&
      atom?.scopePolicy === "GENERAL_REQUIRED" &&
      atom?.selectedScopePicture === "GENERAL" &&
      atom?.requestedFieldStatus === "NOT_REQUIRED" &&
      emptyStrings(atom?.requestedFields) &&
      emptyStrings(atom?.optionalFields) &&
      Array.isArray(declared) &&
      declared.length === 1 &&
      declared[0]?.id === "automatic_index_adjustment" &&
      declared[0]?.factRole === "CONDITION" &&
      String(atom?.requirementContractDigest || "").length > 0
  );
}

function inactiveOrNonAutomatic(text) {
  return /(?:\bkeine?\s+(?:automatische\s+)?(?:aufwertung|wertanpassung|indexanpassung)\b|\b(?:aufwertung|wertanpassung|indexanpassung)\b.{0,120}\b(?:entf[aä]llt|aufgehoben|ausgesetzt|widerrufen|findet\s+nicht\s+statt)\b|\b(?:erh[öo]ht|vermindert|angepasst|aufgewertet|indexiert)\b.{0,48}\bnicht\b|\b(?:kann|wahlweise)\b.{0,120}\b(?:angepasst|aufgewertet|indexiert)\b|\b(?:auf\s+antrag|nach\s+zustimmung|gegen\s+(?:eine\s+)?mehrpr[aä]mie|sofern.{0,80}\bvereinbart|gesonderte\s+vereinbarung)\b|\b(?:einmalig|manuell|neubewertung|neufestsetzung|sch[aä]tzgutachten)\b|\b(?:historisch|fr[üu]her|vormalig)\b)/u.test(
    text
  );
}

function activeIndexAdjustmentSource(source) {
  const text = normalized(source?.conditionCheckText || source?.exactText);
  if (
    !text ||
    !/\b(?:geb[aä]ude)?versicherungssumme(?:n)?\b/u.test(text) ||
    !/\b(?:baukosten|wert|preis)?index\p{L}*\b/u.test(text) ||
    inactiveOrNonAutomatic(text)
  )
    return false;

  return /(?:\baufwertung\s+der\s+geb[aä]udeversicherungssummen\b.{0,100}\berfolgt\s+nach\b.{0,100}\b(?:baukosten|wert|preis)?index\p{L}*\b|\bversicherungssumme\b.{0,48}\berh[öo]ht\s+oder\s+vermindert\s+sich\s+j[aä]hrlich\b|\b(?:geb[aä]ude)?versicherungssumme(?:n)?\b.{0,120}\b(?:automatisch|j[aä]hrlich)\b.{0,80}\b(?:angepasst|aufgewertet|indexiert|erh[öo]ht|vermindert)\b|\b(?:automatisch|j[aä]hrlich)\b.{0,80}\b(?:geb[aä]ude)?versicherungssumme(?:n)?\b.{0,80}\b(?:angepasst|aufgewertet|indexiert|erh[öo]ht|vermindert)\b)/u.test(
    text
  );
}

function contributors(atom) {
  return Array.isArray(atom?.comparisonContributors)
    ? atom.comparisonContributors
    : [atom];
}

function emptyFieldContract(atom) {
  if (Array.isArray(atom?.comparisonContributors))
    return (
      Array.isArray(atom.comparisonFieldFacts) &&
      atom.comparisonFieldFacts.length === 0 &&
      atom.comparisonContributors.every(
        (contributor) =>
          contributor?.requestedFieldStatus === "NOT_REQUIRED" &&
          emptyStrings(contributor?.requestedFields) &&
          emptyStrings(contributor?.optionalFields) &&
          emptyStrings(contributor?.fields)
      )
    );
  return emptyStrings(atom?.fields);
}

function automaticIndexAdjustmentSignature(atom) {
  if (
    !exactVs10Shape(atom) ||
    !emptyFieldContract(atom) ||
    hasConditionalOrOptionalCoverageSource(atom)
  )
    return null;

  const parts = contributors(atom);
  if (
    parts.length === 0 ||
    parts.some(
      (part) =>
        part?.requirementId !== "VS-10" ||
        part?.componentId !== "automatic_index_adjustment" ||
        part?.factRole !== "CONDITION" ||
        part?.coverageEffect !== "INCLUDED" ||
        part?.selectedScopePicture !== "GENERAL" ||
        part?.scopePolicy !== "GENERAL_REQUIRED" ||
        part?.requestedFieldStatus !== "NOT_REQUIRED" ||
        !emptyStrings(part?.requestedFields) ||
        !emptyStrings(part?.optionalFields) ||
        !emptyStrings(part?.fields) ||
        hasConditionalOrOptionalCoverageSource(part) ||
        !Array.isArray(part?.sources) ||
        part.sources.length === 0 ||
        part.sources.some((source) => !activeIndexAdjustmentSource(source))
    )
  )
    return null;

  return "ACTIVE_INDEX_ADJUSTMENT_OF_BUILDING_SUM:PRESENT";
}

/**
 * Certifies equality only for the presence of an active, source-bound VS-10
 * index adjustment. Index type, timing, direction and calculation remain
 * outside this fieldless comparison contract. Role: compare. Side effects: none.
 */
function compareAutomaticIndexAdjustmentPresence(left, right) {
  const leftSignature = automaticIndexAdjustmentSignature(left);
  const rightSignature = automaticIndexAdjustmentSignature(right);
  if (!leftSignature || leftSignature !== rightSignature) return null;
  return {
    equivalent: true,
    ruleId: AUTOMATIC_INDEX_ADJUSTMENT_PRESENCE_EQUALITY_RULE_ID,
  };
}

module.exports = {
  AUTOMATIC_INDEX_ADJUSTMENT_PRESENCE_EQUALITY_RULE_ID,
  compareAutomaticIndexAdjustmentPresence,
};

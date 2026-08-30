const POINT_OUTCOME = Object.freeze({
  ADVANTAGE_A: "VORTEIL_A",
  ADVANTAGE_B: "VORTEIL_B",
  EQUIVALENT: "GLEICHWERTIG",
  NOT_COMPARABLE: "NICHT_VERGLEICHBAR",
  UNCLEAR: "UNKLAR",
});

const COVERAGE_ROLES = new Set([
  "BENEFIT",
  "DAMAGE",
  "INSURED_OBJECT",
  "PERIL",
]);

const DECISIVE_COVERAGE_EFFECTS = new Set(["INCLUDED", "EXCLUDED"]);

function normalized(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim()
    .toLocaleLowerCase("de-AT");
}

function decimalHundredths(value) {
  const compact = String(value || "")
    .replace(/[^0-9.,]/gu, "")
    .trim();
  if (!/^\d[\d.,]*$/u.test(compact)) return null;
  const lastComma = compact.lastIndexOf(",");
  const lastDot = compact.lastIndexOf(".");
  let separator = null;
  if (lastComma >= 0 && lastDot >= 0)
    separator = lastComma > lastDot ? "," : ".";
  else if (lastComma >= 0 && compact.length - lastComma - 1 <= 2)
    separator = ",";
  else if (lastDot >= 0 && compact.length - lastDot - 1 <= 2) separator = ".";
  const [integerPart, decimalPart = ""] = separator
    ? compact.split(separator)
    : [compact, ""];
  const integerDigits = integerPart.replace(/[.,]/gu, "");
  const decimalDigits = decimalPart.replace(/[.,]/gu, "");
  if (!integerDigits || decimalDigits.length > 2) return null;
  return BigInt(integerDigits) * 100n + BigInt(decimalDigits.padEnd(2, "0"));
}

function canonicalFieldFact(fact) {
  const valueType = String(fact?.valueType || "UNKNOWN");
  const numeric = ["MONEY", "PERCENT"].includes(valueType)
    ? decimalHundredths(fact?.normalizedValue || fact?.rawValue)
    : null;
  return {
    value:
      numeric === null
        ? normalized(fact?.normalizedValue || fact?.rawValue)
        : numeric.toString(),
    displayValue: String(fact?.normalizedValue || fact?.rawValue || ""),
    valueType,
    unit: String(fact?.unit || ""),
    limitKind: String(fact?.limitKind || ""),
    qualifier: normalized(fact?.qualifier),
    variantScopeKey: String(fact?.variantScope?.key || ""),
    componentScopeKey: String(fact?.componentScope?.key || ""),
  };
}

function fieldSignature(fields) {
  return (fields || [])
    .flatMap(({ field, facts }) =>
      (facts || []).map((fact) => ({
        field,
        ...canonicalFieldFact(fact),
      }))
    )
    .sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right), "de-AT")
    );
}

function atomSignature(atom) {
  return JSON.stringify({
    componentId: atom.componentId,
    factRole: atom.factRole,
    coverageEffect: atom.coverageEffect,
    selectedScopePicture: atom.selectedScopePicture,
    documentApplicability: atom.documentApplicability,
    requestedFieldStatus: atom.requestedFieldStatus,
    fields: fieldSignature(atom.fields),
  });
}

function uniqueAtoms(atoms) {
  const unique = new Map();
  for (const atom of atoms) {
    const key = atomSignature(atom);
    if (!unique.has(key)) unique.set(key, atom);
  }
  return [...unique.values()];
}

function validSource(atom) {
  return (
    Array.isArray(atom.selectedCandidateIds) &&
    atom.selectedCandidateIds.length > 0 &&
    atom.selectedCandidateIds.every((candidateId) =>
      atom.sources?.some(
        (source) =>
          source.candidateId === candidateId &&
          Number.isInteger(source.physicalPageNumber) &&
          source.physicalPageNumber > 0 &&
          String(source.exactText || "").trim().length > 0
      )
    )
  );
}

function completeAtom(atom) {
  if (atom.evidencePresence !== "FOUND") return false;
  if (atom.conflictState !== "NONE") return false;
  if ((atom.unresolvedCandidateIds || []).length > 0) return false;
  if (!validSource(atom)) return false;
  if (!["COMPLETE", "NOT_REQUIRED"].includes(atom.requestedFieldStatus))
    return false;
  if (atom.requestedFieldStatus === "COMPLETE") {
    if (!Array.isArray(atom.fields) || atom.fields.length === 0) return false;
    if (
      atom.fields.some(
        ({ status, facts }) =>
          status !== "FOUND" ||
          (facts || []).length === 0 ||
          facts.some(
            ({ source }) =>
              !atom.selectedCandidateIds.includes(source?.candidateId) ||
              !Number.isInteger(source?.physicalPageNumber) ||
              source.physicalPageNumber < 1 ||
              String(source?.exactText || "").trim().length === 0
          )
      )
    )
      return false;
  }
  return true;
}

function comparisonKey(atom) {
  return JSON.stringify({
    componentId: atom.componentId,
    factRole: atom.factRole,
    selectedScopePicture: atom.selectedScopePicture,
    documentApplicability: atom.documentApplicability,
    fields: fieldSignature(atom.fields).map(
      ({
        field,
        valueType,
        unit,
        limitKind,
        qualifier,
        variantScopeKey,
        componentScopeKey,
      }) => ({
        field,
        valueType,
        unit,
        limitKind,
        qualifier,
        variantScopeKey,
        componentScopeKey,
      })
    ),
  });
}

function auditSide(atom) {
  return {
    coverageEffect: atom.coverageEffect,
    values: fieldSignature(atom.fields).map(({ field, displayValue }) => ({
      field,
      value: displayValue,
    })),
    documentUuids: [...new Set(atom.documentUuids || [])].sort(),
    sources: (atom.sources || []).map(
      ({ candidateId, physicalPageNumber, exactText }) => ({
        candidateId,
        physicalPageNumber,
        exactText,
      })
    ),
  };
}

function unclear(reasonCode, reason, dimensions = []) {
  return {
    schemaVersion: 1,
    outcome: POINT_OUTCOME.UNCLEAR,
    reasonCode,
    reason,
    reviewRequired: true,
    ruleId: "FAIL_CLOSED_V1",
    dimensions,
  };
}

function compareNumericFields(left, right, factRole) {
  const a = fieldSignature(left.fields);
  const b = fieldSignature(right.fields);
  if (a.length !== 1 || b.length !== 1) return null;
  if (
    JSON.stringify({ ...a[0], value: undefined, displayValue: undefined }) !==
    JSON.stringify({ ...b[0], value: undefined, displayValue: undefined })
  )
    return null;
  if (!["MONEY", "PERCENT"].includes(a[0].valueType)) return null;
  if (!/^\d+$/u.test(a[0].value) || !/^\d+$/u.test(b[0].value)) return null;
  const av = BigInt(a[0].value);
  const bv = BigInt(b[0].value);
  if (av === bv)
    return {
      outcome: POINT_OUTCOME.EQUIVALENT,
      ruleId: "TYPED_VALUE_EQUALITY_V1",
    };
  if (factRole === "LIMIT")
    return {
      outcome: av > bv ? POINT_OUTCOME.ADVANTAGE_A : POINT_OUTCOME.ADVANTAGE_B,
      ruleId: "HIGHER_COVERAGE_LIMIT_V1",
    };
  if (factRole === "DEDUCTIBLE")
    return {
      outcome: av < bv ? POINT_OUTCOME.ADVANTAGE_A : POINT_OUTCOME.ADVANTAGE_B,
      ruleId: "LOWER_DEDUCTIBLE_V1",
    };
  return null;
}

function compareDimension(left, right) {
  const dimension = {
    categoryId: left.requirementId,
    componentId: left.componentId,
    componentLabel: left.componentLabel,
    factRole: left.factRole,
    a: auditSide(left),
    b: auditSide(right),
  };
  if (comparisonKey(left) !== comparisonKey(right))
    return {
      outcome: POINT_OUTCOME.NOT_COMPARABLE,
      reasonCode: "COMPARABILITY_KEY_DIFFERS",
      ruleId: "ATOMIC_COMPARABILITY_GATE_V1",
      dimension,
    };

  const effects = new Set([left.coverageEffect, right.coverageEffect]);
  if (
    COVERAGE_ROLES.has(left.factRole) &&
    [...effects].every((effect) => DECISIVE_COVERAGE_EFFECTS.has(effect))
  ) {
    if (left.coverageEffect === right.coverageEffect)
      return {
        outcome: POINT_OUTCOME.EQUIVALENT,
        reasonCode:
          left.coverageEffect === "EXCLUDED"
            ? "EQUIVALENT_EXCLUSION"
            : "EQUIVALENT_INCLUSION",
        ruleId: "ATOMIC_COVERAGE_EQUALITY_V1",
        dimension,
      };
    return {
      outcome:
        left.coverageEffect === "INCLUDED"
          ? POINT_OUTCOME.ADVANTAGE_A
          : POINT_OUTCOME.ADVANTAGE_B,
      reasonCode: "INCLUDED_OVER_EXCLUDED",
      ruleId: "INCLUDED_OVER_EXCLUDED_V1",
      dimension,
    };
  }

  if (left.coverageEffect === right.coverageEffect) {
    const numeric = compareNumericFields(left, right, left.factRole);
    if (numeric)
      return {
        ...numeric,
        reasonCode:
          numeric.outcome === POINT_OUTCOME.EQUIVALENT
            ? "EQUIVALENT_TYPED_VALUE"
            : numeric.ruleId === "LOWER_DEDUCTIBLE_V1"
              ? "LOWER_DEDUCTIBLE"
              : "HIGHER_COVERAGE_LIMIT",
        dimension,
      };
  }

  return {
    outcome: POINT_OUTCOME.UNCLEAR,
    reasonCode: "NO_APPROVED_SEMANTIC_RULE",
    ruleId: "FAIL_CLOSED_V1",
    dimension,
  };
}

function componentGroups(atoms, categoryId) {
  const groups = new Map();
  for (const atom of atoms || []) {
    if (atom.requirementId !== categoryId) continue;
    if (!groups.has(atom.componentId)) groups.set(atom.componentId, []);
    groups.get(atom.componentId).push(atom);
  }
  return groups;
}

function reasonFor(outcome, dimensions) {
  const labels = dimensions
    .map(({ componentLabel, componentId }) => componentLabel || componentId)
    .join(", ");
  if (outcome === POINT_OUTCOME.ADVANTAGE_A)
    return `Vorteil Paket A bei ${labels}: Die vollständig belegten atomaren Fakten erfüllen die ausgewiesene Bewertungsregel zugunsten von A.`;
  if (outcome === POINT_OUTCOME.ADVANTAGE_B)
    return `Vorteil Paket B bei ${labels}: Die vollständig belegten atomaren Fakten erfüllen die ausgewiesene Bewertungsregel zugunsten von B.`;
  if (outcome === POINT_OUTCOME.EQUIVALENT)
    return `Gleichwertig bei ${labels}: Die vollständig belegten atomaren Fakten stimmen in allen freigegebenen Vergleichsdimensionen überein.`;
  if (outcome === POINT_OUTCOME.NOT_COMPARABLE)
    return "Nicht direkt vergleichbar: Geltung, Scope, Variante, Werttyp, Einheit oder Betragsqualifier unterscheiden sich.";
  return "Unklar: Für diesen Vergleichspunkt fehlt eine vollständige, rangaufgelöste oder ausdrücklich freigegebene Bewertungsgrundlage.";
}

function decidePoint({ categoryId, packageA, packageB, atomsA, atomsB }) {
  if (!packageA?.evidenceFound && !packageB?.evidenceFound)
    return unclear(
      "MISSING_BOTH",
      "Unklar: In beiden Paketen fehlt ein belegter Inhalt. Fehlender Beleg ist keine Deckungsaussage."
    );
  if (!packageA?.evidenceFound || !packageB?.evidenceFound)
    return unclear(
      "MISSING_ONE_SIDE",
      "Unklar: Nur ein Paket enthält belegten Inhalt. Fehlender Beleg bedeutet weder Ausschluss noch Nachteil."
    );
  if (packageA.reviewStatus !== "BELEGT" || packageB.reviewStatus !== "BELEGT")
    return unclear(
      "PACKAGE_REVIEW_STATUS_BLOCKS_DECISION",
      `Unklar: Die Paket-Prüfstati (${packageA.reviewStatus} / ${packageB.reviewStatus}) erlauben keinen sicheren Vorteilsschluss.`
    );

  const groupsA = componentGroups(atomsA, categoryId);
  const groupsB = componentGroups(atomsB, categoryId);
  const componentIds = [
    ...new Set([...groupsA.keys(), ...groupsB.keys()]),
  ].sort();
  if (componentIds.length === 0)
    return unclear(
      "ATOMIC_EVIDENCE_UNAVAILABLE",
      "Unklar: Für diesen gespeicherten Lauf ist noch keine atomare Vergleichsevidenz verfügbar."
    );

  const dimensions = [];
  for (const componentId of componentIds) {
    const foundA = uniqueAtoms(
      (groupsA.get(componentId) || []).filter(
        ({ evidencePresence }) => evidencePresence === "FOUND"
      )
    );
    const foundB = uniqueAtoms(
      (groupsB.get(componentId) || []).filter(
        ({ evidencePresence }) => evidencePresence === "FOUND"
      )
    );
    if (foundA.length === 0 || foundB.length === 0)
      return unclear(
        foundA.length === 0 && foundB.length === 0
          ? "ATOMIC_EVIDENCE_MISSING_BOTH"
          : "ATOMIC_EVIDENCE_MISSING_ONE_SIDE",
        "Unklar: Mindestens eine erforderliche atomare Komponente ist nicht beidseitig belegt. Fehlender Beleg ist kein Nachteil.",
        dimensions
      );
    if (foundA.length !== 1 || foundB.length !== 1)
      return unclear(
        "ATOMIC_DOCUMENT_RANK_UNRESOLVED",
        "Unklar: Mehrere unterschiedliche Dokumentfakten betreffen dieselbe Komponente; Rang oder Ersetzung ist nicht belegt.",
        dimensions
      );
    if (!completeAtom(foundA[0]) || !completeAtom(foundB[0]))
      return unclear(
        "ATOMIC_EVIDENCE_INCOMPLETE",
        "Unklar: Mindestens ein atomarer Fakt ist unvollständig, konfliktbehaftet oder nicht mit einer gültigen Quelle gebunden.",
        dimensions
      );
    dimensions.push(compareDimension(foundA[0], foundB[0]));
  }

  if (dimensions.some(({ outcome }) => outcome === POINT_OUTCOME.UNCLEAR))
    return unclear(
      "NO_APPROVED_RULE_FOR_ALL_DIMENSIONS",
      reasonFor(
        POINT_OUTCOME.UNCLEAR,
        dimensions.map(({ dimension }) => dimension)
      ),
      dimensions.map(({ dimension }) => dimension)
    );
  if (
    dimensions.some(({ outcome }) => outcome === POINT_OUTCOME.NOT_COMPARABLE)
  )
    return {
      schemaVersion: 1,
      outcome: POINT_OUTCOME.NOT_COMPARABLE,
      reasonCode: "COMPARABILITY_GATE_FAILED",
      reason: reasonFor(
        POINT_OUTCOME.NOT_COMPARABLE,
        dimensions.map(({ dimension }) => dimension)
      ),
      reviewRequired: false,
      ruleId: "ATOMIC_COMPARABILITY_GATE_V1",
      dimensions: dimensions.map(({ dimension }) => dimension),
    };

  const winners = new Set(
    dimensions
      .map(({ outcome }) => outcome)
      .filter((outcome) =>
        [POINT_OUTCOME.ADVANTAGE_A, POINT_OUTCOME.ADVANTAGE_B].includes(outcome)
      )
  );
  if (winners.size > 1)
    return unclear(
      "MIXED_DIMENSION_WINNERS",
      "Unklar: Einzelne atomare Komponenten begünstigen unterschiedliche Pakete; daraus folgt kein einheitlicher Punktvorteil.",
      dimensions.map(({ dimension }) => dimension)
    );
  const outcome =
    winners.size === 1 ? [...winners][0] : POINT_OUTCOME.EQUIVALENT;
  const decisive = dimensions.filter(({ outcome: value }) => value === outcome);
  return {
    schemaVersion: 1,
    outcome,
    reasonCode:
      outcome === POINT_OUTCOME.EQUIVALENT
        ? "ALL_ATOMIC_DIMENSIONS_EQUIVALENT"
        : "ALL_DECISIVE_DIMENSIONS_FAVOR_ONE_SIDE",
    reason: reasonFor(
      outcome,
      decisive.map(({ dimension }) => dimension)
    ),
    reviewRequired: false,
    ruleId: [...new Set(decisive.map(({ ruleId }) => ruleId))].sort().join("+"),
    dimensions: dimensions.map(({ dimension }) => dimension),
  };
}

module.exports = {
  POINT_OUTCOME,
  decidePoint,
};

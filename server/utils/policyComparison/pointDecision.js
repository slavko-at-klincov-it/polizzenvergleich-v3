const POINT_OUTCOME = Object.freeze({
  ADVANTAGE_A: "VORTEIL_A",
  ADVANTAGE_B: "VORTEIL_B",
  DOCUMENTATION_DIFFERENCE: "DOKUMENTATIONSUNTERSCHIED",
  EQUIVALENT: "GLEICHWERTIG",
  NO_DOCUMENTED_ADVANTAGE: "KEIN_DOKUMENTIERTER_VORTEIL",
  NOT_COMPARABLE: "NICHT_VERGLEICHBAR",
  UNCLEAR: "UNKLAR",
});

const SEARCH_DISPOSITION = Object.freeze({
  RELEVANT_FOUND: "RELEVANT_FOUND",
  CONTROLLED_NOT_FOUND: "NO_MATCH_AFTER_COMPLETE_CONTROLLED_SEARCH",
  VERIFIED_NOT_FOUND: "NOT_FOUND_AFTER_COMPLETE_SEARCH",
  INCOMPLETE: "SEARCH_INCOMPLETE",
});

const COVERAGE_ROLES = new Set([
  "BENEFIT",
  "DAMAGE",
  "INSURED_OBJECT",
  "PERIL",
]);

const DECISIVE_COVERAGE_EFFECTS = new Set(["INCLUDED", "EXCLUDED"]);
const STRONG_COVERAGE_CONDITION_MARKER =
  /\b(?:außer|ausgenommen|so\s+ferne|sofern|soweit|vorausgesetzt|vorbehaltlich|unter\s+der\s+Bedingung|es\s+sei\s+denn)\b/iu;
const CONDITIONAL_COVERAGE_WHEN =
  /(?:\b(?:versichert|mitversichert|gedeckt|eingeschlossen|ausgeschlossen)\b|\b(?:Versicherungsschutz|Deckung|Entschädigung|Leistung)\b).{0,160}\b(?:wenn|falls)\b|\b(?:nur\s+(?:dann\s+)?wenn|falls)\b.{0,160}(?:\b(?:versichert|mitversichert|gedeckt|eingeschlossen|ausgeschlossen)\b|\b(?:Versicherungsschutz|Deckung|Entschädigung|Leistung)\b)/isu;

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
    componentScopeKey: String(
      fact?.componentScope?.key || fact?.componentScope?.id || ""
    ),
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

function hasConditionalCoverageSource(atom) {
  return (atom.sources || []).some(({ exactText, conditionCheckText }) => {
    const text = `${exactText || ""}\n${conditionCheckText || ""}`;
    return (
      STRONG_COVERAGE_CONDITION_MARKER.test(text) ||
      CONDITIONAL_COVERAGE_WHEN.test(text)
    );
  });
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
    documentApplicability: atom.documentApplicability,
    selectedScopePicture: atom.selectedScopePicture,
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
    schemaVersion: 3,
    outcome: POINT_OUTCOME.UNCLEAR,
    reasonCode,
    reason,
    reviewRequired: true,
    ruleId: "FAIL_CLOSED_V1",
    dimensions,
  };
}

function qualifiedAbsence(packageSummary) {
  return [
    SEARCH_DISPOSITION.CONTROLLED_NOT_FOUND,
    SEARCH_DISPOSITION.VERIFIED_NOT_FOUND,
  ].includes(packageSummary?.searchDisposition);
}

function assumedNotIncluded(packageSummary) {
  return (
    qualifiedAbsence(packageSummary) &&
    packageSummary?.comparisonTreatment === "ASSUMED_NOT_INCLUDED_V1"
  );
}

function includedAtomsForAbsenceRule(atoms, categoryId) {
  const found = uniqueAtoms(
    (atoms || []).filter(
      (atom) =>
        atom.requirementId === categoryId && atom.evidencePresence === "FOUND"
    )
  );
  if (found.length === 0) return null;
  if (
    found.some(
      (atom) =>
        !COVERAGE_ROLES.has(atom.factRole) ||
        atom.coverageEffect !== "INCLUDED" ||
        atom.documentApplicability !== "ACTIVE" ||
        !completeAtom(atom) ||
        hasConditionalCoverageSource(atom)
    )
  )
    return null;
  const counts = new Map();
  for (const atom of found)
    counts.set(atom.componentId, (counts.get(atom.componentId) || 0) + 1);
  if ([...counts.values()].some((count) => count !== 1)) return null;
  return found;
}

function decideAgainstVerifiedAbsence({
  categoryId,
  evidencedPackage,
  absentPackage,
  evidencedAtoms,
  evidencedSide,
}) {
  if (evidencedPackage?.reviewStatus !== "BELEGT") return null;
  const found = includedAtomsForAbsenceRule(evidencedAtoms, categoryId);
  if (!found) return null;
  const labels = [...new Set(found.map((atom) => atom.componentLabel))].join(
    ", "
  );
  const absentSide = evidencedSide === "A" ? "B" : "A";
  return {
    schemaVersion: 3,
    outcome:
      evidencedSide === "A"
        ? POINT_OUTCOME.ADVANTAGE_A
        : POINT_OUTCOME.ADVANTAGE_B,
    reasonCode: "EXPLICIT_INCLUDED_OVER_VERIFIED_ABSENCE",
    reason: `Vorteil Paket ${evidencedSide}: ${labels || categoryId} ${found.length === 1 ? "ist" : "sind"} in Paket ${evidencedSide} ausdrücklich eingeschlossen. Im vollständig geprüften bereitgestellten Paket ${absentSide} wurde nach dem ausgewiesenen versionierten Volltext-, Begriffs- und Definitionssuchvertrag keine entsprechende Regelung gefunden; der Schutz wird deshalb für diesen Vergleich als nicht enthalten gewertet. Ein ausdrücklicher Ausschluss in Paket ${absentSide} ist damit nicht belegt.`,
    reviewRequired: false,
    ruleId: "INCLUDED_OVER_ASSUMED_NOT_INCLUDED_V1",
    comparisonTreatment: "ASSUMED_NOT_INCLUDED_V1",
    dimensions: [
      ...found.map((atom) => ({
        categoryId,
        componentId: atom.componentId,
        componentLabel: atom.componentLabel,
        factRole: atom.factRole,
        [evidencedSide.toLocaleLowerCase("en-US")]: auditSide(atom),
      })),
      {
        categoryId,
        side: absentSide,
        searchDisposition: absentPackage.searchDisposition,
        searchAudit: absentPackage.searchAudit,
      },
    ],
  };
}

function documentationDifference({ evidencedSide, absentPackage }) {
  const absentSide = evidencedSide === "A" ? "B" : "A";
  return {
    schemaVersion: 3,
    outcome: POINT_OUTCOME.DOCUMENTATION_DIFFERENCE,
    reasonCode: "QUALIFIED_SEARCH_DOCUMENTATION_DIFFERENCE",
    reason: `Dokumentationsunterschied: Polizze ${evidencedSide} enthält zu diesem Punkt belegten Inhalt. Im vollständigen kontrollierten Suchlauf des bereitgestellten Pakets ${absentSide} wurde mit dem ausgewiesenen Suchplan keine entsprechende Fundstelle ermittelt. Daraus folgt ohne eine gesondert freigegebene Fachregel weder ein Vor- oder Nachteil noch ein ausdrücklicher Ausschluss.`,
    reviewRequired: false,
    ruleId: "QUALIFIED_ABSENCE_DOCUMENTATION_DIFFERENCE_V1",
    comparisonTreatment: "DOCUMENTATION_ONLY_V1",
    dimensions: [
      {
        side: absentSide,
        searchDisposition: absentPackage.searchDisposition,
        searchAudit: absentPackage.searchAudit,
      },
    ],
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

  if (
    COVERAGE_ROLES.has(left.factRole) &&
    (hasConditionalCoverageSource(left) || hasConditionalCoverageSource(right))
  )
    return {
      outcome: POINT_OUTCOME.UNCLEAR,
      reasonCode: "CONDITIONAL_OR_EXCEPTION_SCOPE",
      ruleId: "FAIL_CLOSED_CONDITIONAL_SOURCE_V1",
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

function requirementContract({ atoms, packageSummary, categoryId }) {
  const relevant = (atoms || []).filter(
    (atom) => atom.requirementId === categoryId
  );
  const contracts = relevant.map((atom) => ({
    digest: atom.requirementContractDigest,
    componentSatisfactionPolicy: atom.componentSatisfactionPolicy,
    components: atom.declaredComponents,
  }));
  if (contracts.length === 0) {
    const persisted =
      packageSummary?.requirementContract ||
      packageSummary?.searchAudit?.requirementContract;
    if (persisted) contracts.push(persisted);
  }
  if (contracts.length === 0) return null;
  const signatures = new Set(contracts.map((contract) => JSON.stringify(contract)));
  if (signatures.size !== 1) return null;
  const [contract] = contracts;
  if (
    !/^[a-f0-9]{64}$/u.test(String(contract?.digest || "")) ||
    !["ALL", "ANY"].includes(contract?.componentSatisfactionPolicy) ||
    !Array.isArray(contract?.components) ||
    contract.components.length === 0 ||
    contract.components.some(
      ({ id, factRole }) => !String(id || "").trim() || !String(factRole || "").trim()
    )
  )
    return null;
  return contract;
}

function foundComponentIds(groups) {
  return [...groups.entries()]
    .filter(([, atoms]) =>
      (atoms || []).some(({ evidencePresence }) => evidencePresence === "FOUND")
    )
    .map(([componentId]) => componentId)
    .sort();
}

function effectLabel(effect) {
  return (
    {
      INCLUDED: "eingeschlossen",
      EXCLUDED: "ausdrücklich ausgeschlossen",
      DEFINED: "geregelt",
      CONDITIONAL: "bedingt",
      UNKNOWN: "ungeklärt",
    }[effect] || effect
  );
}

function displayedValues(side) {
  return (side.values || []).map(({ value }) => value).join(", ");
}

function comparisonContext(side) {
  return `${side.documentApplicability || "Geltung unklar"} / ${side.selectedScopePicture || "Scope unklar"}`;
}

function dimensionReason(dimension) {
  const label = dimension.componentLabel || dimension.componentId;
  const aValues = displayedValues(dimension.a);
  const bValues = displayedValues(dimension.b);
  const aContext = comparisonContext(dimension.a);
  const bContext = comparisonContext(dimension.b);
  const context =
    aContext === bContext ? "" : ` (A ${aContext}; B ${bContext})`;
  if (aValues || bValues)
    return `${label}: A ${aValues || effectLabel(dimension.a.coverageEffect)}, B ${bValues || effectLabel(dimension.b.coverageEffect)}${context}`;
  return `${label}: A ${effectLabel(dimension.a.coverageEffect)}, B ${effectLabel(dimension.b.coverageEffect)}${context}`;
}

function reasonFor(outcome, dimensions) {
  const details = dimensions.map(dimensionReason).join("; ");
  if (outcome === POINT_OUTCOME.ADVANTAGE_A)
    return `Vorteil Paket A: ${details}. Die ausgewiesene Regel bewertet diesen vollständig belegten Vergleichspunkt zugunsten von A.`;
  if (outcome === POINT_OUTCOME.ADVANTAGE_B)
    return `Vorteil Paket B: ${details}. Die ausgewiesene Regel bewertet diesen vollständig belegten Vergleichspunkt zugunsten von B.`;
  if (outcome === POINT_OUTCOME.EQUIVALENT)
    return `Gleichwertig: ${details}. Die vollständig belegten atomaren Fakten stimmen in allen freigegebenen Vergleichsdimensionen überein.`;
  if (outcome === POINT_OUTCOME.NOT_COMPARABLE)
    return `Nicht direkt vergleichbar: ${details}. Geltung, Scope, Variante, Werttyp, Einheit oder Betragsqualifier unterscheiden sich.`;
  return "Unklar: Für diesen Vergleichspunkt fehlt eine vollständige, rangaufgelöste oder ausdrücklich freigegebene Bewertungsgrundlage.";
}

function decidePoint({ categoryId, packageA, packageB, atomsA, atomsB }) {
  const contractA = requirementContract({
    atoms: atomsA,
    packageSummary: packageA,
    categoryId,
  });
  const contractB = requirementContract({
    atoms: atomsB,
    packageSummary: packageB,
    categoryId,
  });
  if (!contractA || !contractB)
    return unclear(
      "REQUIREMENT_CONTRACT_UNAVAILABLE",
      "Unklar: Der versionierte Komponenten- und Suchvertrag ist nicht auf beiden Seiten vollständig auditierbar."
    );
  if (JSON.stringify(contractA) !== JSON.stringify(contractB))
    return unclear(
      "REQUIREMENT_CONTRACT_MISMATCH",
      "Unklar: Die beiden Pakete wurden nicht mit demselben versionierten Komponenten- und Suchvertrag ausgewertet."
    );

  const absentA = qualifiedAbsence(packageA);
  const absentB = qualifiedAbsence(packageB);
  const assumedAbsentA = assumedNotIncluded(packageA);
  const assumedAbsentB = assumedNotIncluded(packageB);
  if (absentA && absentB)
    return {
      schemaVersion: 3,
      outcome: POINT_OUTCOME.NO_DOCUMENTED_ADVANTAGE,
      reasonCode: "VERIFIED_ABSENCE_BOTH",
      reason:
        "Kein dokumentierter Vorteil: In beiden vollständig geprüften bereitgestellten Paketen wurde nach dem ausgewiesenen versionierten Suchvertrag keine entsprechende Regelung gefunden. Dies ist weder ein Nachweis ausdrücklicher Gleichheit noch eines ausdrücklichen Ausschlusses.",
      reviewRequired: false,
      ruleId: "COMPLETE_SEARCH_ABSENCE_BOTH_V1",
      comparisonTreatment:
        assumedAbsentA && assumedAbsentB
          ? "ASSUMED_NOT_INCLUDED_V1"
          : "DOCUMENTATION_ONLY_V1",
      dimensions: [],
    };
  if (assumedAbsentA && packageB?.evidenceFound) {
    const decision = decideAgainstVerifiedAbsence({
      categoryId,
      evidencedPackage: packageB,
      absentPackage: packageA,
      evidencedAtoms: atomsB,
      evidencedSide: "B",
    });
    if (decision) return decision;
  }
  if (assumedAbsentB && packageA?.evidenceFound) {
    const decision = decideAgainstVerifiedAbsence({
      categoryId,
      evidencedPackage: packageA,
      absentPackage: packageB,
      evidencedAtoms: atomsA,
      evidencedSide: "A",
    });
    if (decision) return decision;
  }
  if (absentA && packageB?.evidenceFound)
    return documentationDifference({
      evidencedSide: "B",
      absentPackage: packageA,
    });
  if (absentB && packageA?.evidenceFound)
    return documentationDifference({
      evidencedSide: "A",
      absentPackage: packageB,
    });
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
  const componentPolicy = contractA.componentSatisfactionPolicy;

  const allComponentIds = [
    ...new Set([...groupsA.keys(), ...groupsB.keys()]),
  ].sort();
  let componentIds = allComponentIds;
  if (componentPolicy === "ANY") {
    const unsafeFound = [...(atomsA || []), ...(atomsB || [])].filter(
      (atom) =>
        atom.requirementId === categoryId &&
        atom.evidencePresence === "FOUND" &&
        (!completeAtom(atom) || hasConditionalCoverageSource(atom))
    );
    if (unsafeFound.length > 0)
      return unclear(
        "ANY_COMPONENT_EVIDENCE_INCOMPLETE",
        "Unklar: Mindestens eine gefundene Alternative ist unvollständig, konfliktbehaftet, bedingt oder nicht eindeutig quellengebunden."
      );
    const foundIdsA = foundComponentIds(groupsA);
    const foundIdsB = foundComponentIds(groupsB);
    if (foundIdsA.length === 0 || foundIdsB.length === 0)
      return unclear(
        "ANY_COMPONENT_EVIDENCE_MISSING",
        "Unklar: Die alternativ erfüllbare Zeile enthält nicht in beiden Paketen mindestens eine vollständig belegte Komponente."
      );
    if (JSON.stringify(foundIdsA) !== JSON.stringify(foundIdsB))
      return {
        schemaVersion: 3,
        outcome: POINT_OUTCOME.NOT_COMPARABLE,
        reasonCode: "ANY_ALTERNATIVE_SCOPE_DIFFERS",
        reason:
          "Nicht direkt vergleichbar: Die alternativ erfüllbare Zeile ist in den beiden Paketen durch unterschiedliche Komponenten belegt. Diese Alternativen dürfen nicht stillschweigend gleichgesetzt werden.",
        reviewRequired: false,
        ruleId: "ANY_COMPONENT_IDENTITY_GATE_V1",
        dimensions: [],
      };
    componentIds = foundIdsA;
  }
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

  if (
    dimensions.some(
      ({ reasonCode }) => reasonCode === "CONDITIONAL_OR_EXCEPTION_SCOPE"
    )
  )
    return {
      ...unclear(
        "CONDITIONAL_OR_EXCEPTION_SCOPE",
        "Unklar: Mindestens ein gebundener Beleg enthält eine Bedingung oder Ausnahme. Ohne aufgelösten Bedingungsscope darf daraus weder ein Vorteil noch Gleichwertigkeit abgeleitet werden.",
        dimensions.map(({ dimension }) => dimension)
      ),
      ruleId: "FAIL_CLOSED_CONDITIONAL_SOURCE_V1",
    };
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
      schemaVersion: 3,
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
    schemaVersion: 3,
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
  SEARCH_DISPOSITION,
  decidePoint,
};

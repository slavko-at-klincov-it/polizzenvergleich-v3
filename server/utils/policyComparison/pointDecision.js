const {
  BLOCKER_CODE,
  PACKAGE_REVIEW_AUDIT_CONTRACT_ID,
  PACKAGE_REVIEW_AUDIT_SCHEMA_VERSION,
  SIGNAL_CODE,
  derivePackageReviewAudit,
} = require("./packageReviewAudit");
const {
  buildPackageActivatedObjectMembershipAudit,
} = require("../policyAnalysis/packageActivatedObjectMembershipAuditContract");
const {
  hasConditionalOrOptionalCoverageSource,
  operationalEventMode,
} = require("./comparisonAtomSemantics");
const {
  PACKAGE_MEMBER,
  atomEventMode,
  atomHasConditionalOrOptionalSource,
  canonicalComparisonAtoms,
  comparisonAtomComplete,
  comparisonFieldSignature,
} = require("./comparisonAtomCanonicalization");
const {
  BILATERAL_ABSENCE_REASON_CODE,
  BILATERAL_ABSENCE_RULE_ID,
  BILATERAL_ABSENCE_TREATMENT,
  buildBilateralAbsenceAudit,
} = require("./bilateralAbsenceContract");
const {
  UNILATERAL_COVERAGE_REASON_CODE,
  UNILATERAL_COVERAGE_RULE_ID,
  UNILATERAL_COVERAGE_TREATMENT,
  UNILATERAL_DOCUMENTATION_REASON_CODE,
  UNILATERAL_DOCUMENTATION_RULE_ID,
  buildUnilateralCoverageAbsenceAudit,
} = require("./unilateralCoverageAbsenceContract");
const {
  buildLw20AbsenceDefaultExclusionEqualityAudit,
  lw20AbsenceDefaultExclusionEqualityDecision,
} = require("./lw20AbsenceDefaultExclusionEqualityContract");
const {
  compareStormDefinitionThreshold,
} = require("./stormDefinitionThresholdContract");
const {
  compareAutomaticIndexAdjustmentPresence,
} = require("./automaticIndexAdjustmentComparisonContract");
const { compareFeC07LimitDominance } = require("./feC07LimitDominanceContract");
const { compareFireDefinition } = require("./fireDefinitionComparisonContract");
const {
  buildVs15QualifierAbsenceAudit,
  vs15QualifierAbsenceDecision,
} = require("./vs15NamedOutbuildingQualifierAbsenceContract");
const {
  buildVs08ConditionConsensusAudit,
  vs08ConditionConsensusDecision,
} = require("./vs08UnderinsuranceConditionConsensusContract");
const {
  buildObjectFamilyCoverageAudit,
  objectFamilyCoverageDecision,
} = require("./objectFamilyComparisonContract");
const {
  buildVs21CostLimitPortfolioAudit,
  vs21CostLimitPortfolioDecision,
} = require("./vs21CostLimitPortfolioComparisonContract");
const {
  buildVs22HazardousWastePortfolioAudit,
  vs22HazardousWastePortfolioDecision,
} = require("./vs22HazardousWastePortfolioComparisonContract");
const {
  buildVs24ScaffoldingCostEqualityAudit,
  vs24ScaffoldingCostEqualityDecision,
} = require("./vs24ScaffoldingCostEqualityContract");
const {
  buildVs25AuthorityLimitPortfolioAudit,
  vs25AuthorityLimitPortfolioDecision,
} = require("./vs25AuthorityReconstructionLimitPortfolioContract");
const {
  buildMembershipConditionScopeComparisonAudit,
  membershipConditionScopeComparisonDecision,
} = require("./membershipConditionScopeComparisonContract");
const {
  OBJECT_SCOPE_IDENTITY,
  OBJECT_SCOPE_IDENTITY_COMPARISON_RULE_ID,
  compareObjectScopeIdentity,
} = require("./objectScopeIdentityComparisonContract");

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
const SOLE_SCOPE_REVIEW_RULE_ID =
  "SOLE_SCOPE_REVIEW_BLOCKER_TO_ATOMIC_NONCOMPARABLE_V1";

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

function comparisonScopeKeys(atom) {
  return [...new Set((atom?.comparisonScopeKeys || []).filter(Boolean))].sort();
}

function asymmetricMissingNarrowScopeProof(left, right) {
  const leftKeys = comparisonScopeKeys(left);
  const rightKeys = comparisonScopeKeys(right);
  return (
    (left?.selectedScopePicture === "NARROW_ONLY" &&
      leftKeys.length === 0 &&
      rightKeys.length > 0) ||
    (right?.selectedScopePicture === "NARROW_ONLY" &&
      rightKeys.length === 0 &&
      leftKeys.length > 0)
  );
}

function atomSignature(atom) {
  return JSON.stringify({
    componentId: atom.componentId,
    factRole: atom.factRole,
    coverageEffect: atom.coverageEffect,
    selectedScopePicture: atom.selectedScopePicture,
    comparisonScopeKeys: comparisonScopeKeys(atom),
    documentApplicability: atom.documentApplicability,
    operationalEventMode: operationalEventMode(atom),
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
    comparisonScopeKeys: comparisonScopeKeys(atom),
    documentApplicability: atom.documentApplicability,
    operationalEventMode: operationalEventMode(atom),
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

function canonicalComparisonKey(atom) {
  return JSON.stringify({
    componentId: atom.componentId,
    factRole: atom.factRole,
    selectedScopePicture: atom.selectedScopePicture,
    comparisonScopeKeys: comparisonScopeKeys(atom),
    scopePolicy: atom.scopePolicy,
    comparisonApplicability: atom.comparisonApplicability,
    operationalEventMode: atomEventMode(atom),
    fields: comparisonFieldSignature(atom).map(
      ({
        field,
        fieldStatus,
        valueType,
        unit,
        limitKind,
        qualifier,
        variantScopeKey,
        componentScopeKey,
      }) => ({
        field,
        fieldStatus,
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
    comparisonScopeKeys: comparisonScopeKeys(atom),
    operationalEventMode: operationalEventMode(atom),
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

function canonicalAuditSide(atom) {
  return {
    coverageEffect: atom.coverageEffect,
    comparisonApplicability: atom.comparisonApplicability,
    documentApplicability: atom.comparisonApplicability,
    selectedScopePicture: atom.selectedScopePicture,
    comparisonScopeKeys: comparisonScopeKeys(atom),
    scopePolicy: atom.scopePolicy,
    operationalEventMode: atomEventMode(atom),
    values: comparisonFieldSignature(atom).map(({ field, displayValue }) => ({
      field,
      value: displayValue,
    })),
    documentUuids: [...new Set(atom.documentUuids || [])].sort(),
    sources: (atom.sources || []).map(
      ({ candidateId, physicalPageNumber, exactText, conditionCheckText }) => ({
        candidateId,
        physicalPageNumber,
        exactText,
        ...(conditionCheckText ? { conditionCheckText } : {}),
      })
    ),
    contributors: atom.comparisonContributors,
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

function documentationDifference({
  evidencedSide,
  absentPackage,
  unilateralCoverageAbsenceAudit,
}) {
  const absentSide = evidencedSide === "A" ? "B" : "A";
  return {
    schemaVersion: unilateralCoverageAbsenceAudit ? 5 : 3,
    outcome: POINT_OUTCOME.DOCUMENTATION_DIFFERENCE,
    reasonCode: unilateralCoverageAbsenceAudit
      ? UNILATERAL_DOCUMENTATION_REASON_CODE
      : "QUALIFIED_SEARCH_DOCUMENTATION_DIFFERENCE",
    reason: `Dokumentationsunterschied: Polizze ${evidencedSide} enthält zu diesem Punkt belegten Inhalt. Im vollständigen kontrollierten Suchlauf des bereitgestellten Pakets ${absentSide} wurde mit dem ausgewiesenen Suchplan keine entsprechende Fundstelle ermittelt. Daraus folgt ohne eine gesondert freigegebene Fachregel weder ein Vor- oder Nachteil noch ein ausdrücklicher Ausschluss.`,
    reviewRequired: false,
    ruleId: unilateralCoverageAbsenceAudit
      ? UNILATERAL_DOCUMENTATION_RULE_ID
      : "QUALIFIED_ABSENCE_DOCUMENTATION_DIFFERENCE_V1",
    comparisonTreatment: "DOCUMENTATION_ONLY_V1",
    ...(unilateralCoverageAbsenceAudit
      ? { unilateralCoverageAbsenceAudit }
      : {}),
    dimensions: [
      {
        side: absentSide,
        searchDisposition: absentPackage.searchDisposition,
        searchAudit: absentPackage.searchAudit,
      },
    ],
  };
}

function decideQualifiedCoverageOverAbsence({
  categoryId,
  packageA,
  packageB,
  unilateralCoverageAbsenceAudit,
}) {
  const evidencedSide = unilateralCoverageAbsenceAudit.evidencedSide;
  const absentSide = unilateralCoverageAbsenceAudit.absentSide;
  const absentPackage = absentSide === "A" ? packageA : packageB;
  if (!unilateralCoverageAbsenceAudit.eligible)
    return documentationDifference({
      evidencedSide,
      absentPackage,
      unilateralCoverageAbsenceAudit,
    });
  const components =
    unilateralCoverageAbsenceAudit.evidenced.canonicalComponents;
  const labels = components.map(
    ({ componentLabel, componentId }) => componentLabel || componentId
  );
  const subject =
    labels.length === 1
      ? labels[0]
      : `Die Teilpunkte ${labels.map((label) => `„${label}“`).join(" und ")}`;
  const narrowScope = components.some(
    ({ selectedScopePicture }) => selectedScopePicture === "NARROW_ONLY"
  );
  const inclusionScope = narrowScope
    ? " für den im Beleg ausgewiesenen engeren Deckungsumfang"
    : "";
  const allocationScope = narrowScope
    ? "Für genau diesen engeren Deckungsumfang"
    : "Für diesen Vergleich";
  return {
    schemaVersion: 5,
    outcome:
      evidencedSide === "A"
        ? POINT_OUTCOME.ADVANTAGE_A
        : POINT_OUTCOME.ADVANTAGE_B,
    reasonCode: UNILATERAL_COVERAGE_REASON_CODE,
    reason: `Vorteil Polizze ${evidencedSide}: ${subject || categoryId} ${components.length === 1 ? "ist" : "sind"}${inclusionScope} in Polizze ${evidencedSide} vollständig belegt und eingeschlossen. Im vollständigen kontrollierten Suchlauf der bereitgestellten Polizze ${absentSide} wurde unter demselben versionierten Komponenten- und Suchvertrag keine entsprechende Regelung gefunden. ${allocationScope} wird der dokumentierte Schutz deshalb Polizze ${evidencedSide} zugerechnet. Ein ausdrücklicher Ausschluss in Polizze ${absentSide} ist damit nicht belegt.`,
    reviewRequired: false,
    ruleId: UNILATERAL_COVERAGE_RULE_ID,
    comparisonTreatment: UNILATERAL_COVERAGE_TREATMENT,
    unilateralCoverageAbsenceAudit,
    dimensions: [
      ...unilateralCoverageAbsenceAudit.evidenced.canonicalComponents.map(
        (component) => ({
          categoryId,
          componentId: component.componentId,
          componentLabel: component.componentLabel,
          factRole: component.factRole,
          coverageEffect: component.coverageEffect,
          selectedScopePicture: component.selectedScopePicture,
          scopePolicy: component.scopePolicy,
          documentUuids: component.documentUuids,
        })
      ),
      {
        categoryId,
        side: absentSide,
        searchDisposition: absentPackage.searchDisposition,
        searchAudit: absentPackage.searchAudit,
      },
    ],
  };
}

function compareNumericFields(left, right, factRole, canonical = false) {
  const a = canonical
    ? comparisonFieldSignature(left)
    : fieldSignature(left.fields);
  const b = canonical
    ? comparisonFieldSignature(right)
    : fieldSignature(right.fields);
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

function coverageFieldComparisonRole(left, right, canonical) {
  const a = canonical
    ? comparisonFieldSignature(left)
    : fieldSignature(left.fields);
  const b = canonical
    ? comparisonFieldSignature(right)
    : fieldSignature(right.fields);
  if (a.length !== 1 || b.length !== 1 || a[0].field !== b[0].field)
    return null;
  if (["limit", "limits", "amount"].includes(a[0].field)) return "LIMIT";
  if (a[0].field === "deductible") return "DEDUCTIBLE";
  return null;
}

function comparisonDimension(left, right, { canonical = false } = {}) {
  return {
    categoryId: left.requirementId,
    componentId: left.componentId,
    componentLabel: left.componentLabel,
    factRole: left.factRole,
    a: canonical ? canonicalAuditSide(left) : auditSide(left),
    b: canonical ? canonicalAuditSide(right) : auditSide(right),
  };
}

function compareDimension(left, right, { canonical = false } = {}) {
  const dimension = comparisonDimension(left, right, { canonical });
  const keyFor = canonical ? canonicalComparisonKey : comparisonKey;
  if (asymmetricMissingNarrowScopeProof(left, right))
    return {
      outcome: POINT_OUTCOME.UNCLEAR,
      reasonCode: "COMPARISON_SCOPE_PROVENANCE_INCOMPLETE",
      ruleId: "FAIL_CLOSED_COMPARISON_SCOPE_PROVENANCE_V1",
      dimension,
    };
  const objectScopeIdentityOptIn = Boolean(
    left?.objectScopeIdentityComparisonContract ||
      right?.objectScopeIdentityComparisonContract
  );
  if (
    objectScopeIdentityOptIn &&
    ((canonical
      ? atomHasConditionalOrOptionalSource(left)
      : hasConditionalOrOptionalCoverageSource(left)) ||
      (canonical
        ? atomHasConditionalOrOptionalSource(right)
        : hasConditionalOrOptionalCoverageSource(right)))
  )
    return {
      outcome: POINT_OUTCOME.UNCLEAR,
      reasonCode: "CONDITIONAL_OR_EXCEPTION_SCOPE",
      ruleId: "FAIL_CLOSED_CONDITIONAL_SOURCE_V1",
      dimension,
    };
  const objectScopeIdentity = compareObjectScopeIdentity(left, right);
  if (objectScopeIdentity?.identity === OBJECT_SCOPE_IDENTITY.INCOMPLETE)
    return {
      outcome: POINT_OUTCOME.UNCLEAR,
      reasonCode: "OBJECT_SCOPE_PROVENANCE_INCOMPLETE",
      ruleId: "FAIL_CLOSED_OBJECT_SCOPE_IDENTITY_V1",
      dimension: {
        ...dimension,
        ...(objectScopeIdentity.audit
          ? { comparisonAudit: objectScopeIdentity.audit }
          : {}),
      },
    };
  if (objectScopeIdentity?.identity === OBJECT_SCOPE_IDENTITY.DIFFERENT)
    return {
      outcome: POINT_OUTCOME.NOT_COMPARABLE,
      reasonCode: "OBJECT_SCOPE_KEYS_DIFFER",
      ruleId: OBJECT_SCOPE_IDENTITY_COMPARISON_RULE_ID,
      dimension: {
        ...dimension,
        comparisonAudit: objectScopeIdentity.audit,
      },
    };
  if (keyFor(left) !== keyFor(right))
    return {
      outcome: POINT_OUTCOME.NOT_COMPARABLE,
      reasonCode: "COMPARABILITY_KEY_DIFFERS",
      ruleId: "ATOMIC_COMPARABILITY_GATE_V1",
      dimension,
    };

  if (
    (canonical || COVERAGE_ROLES.has(left.factRole)) &&
    ((canonical
      ? atomHasConditionalOrOptionalSource(left)
      : hasConditionalOrOptionalCoverageSource(left)) ||
      (canonical
        ? atomHasConditionalOrOptionalSource(right)
        : hasConditionalOrOptionalCoverageSource(right)))
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
    if (left.coverageEffect === right.coverageEffect) {
      const leftFields = canonical
        ? comparisonFieldSignature(left)
        : fieldSignature(left.fields);
      const rightFields = canonical
        ? comparisonFieldSignature(right)
        : fieldSignature(right.fields);
      if (JSON.stringify(leftFields) !== JSON.stringify(rightFields)) {
        const fieldRole = coverageFieldComparisonRole(left, right, canonical);
        const numeric = fieldRole
          ? compareNumericFields(left, right, fieldRole, canonical)
          : null;
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
        return {
          outcome: POINT_OUTCOME.UNCLEAR,
          reasonCode: "COVERAGE_FIELDS_DIFFER",
          ruleId: "FAIL_CLOSED_COVERAGE_FIELD_DIFFERENCE_V1",
          dimension,
        };
      }
      return {
        outcome: POINT_OUTCOME.EQUIVALENT,
        reasonCode:
          left.coverageEffect === "EXCLUDED"
            ? "EQUIVALENT_EXCLUSION"
            : "EQUIVALENT_INCLUSION",
        ruleId: "ATOMIC_COVERAGE_EQUALITY_V1",
        dimension,
      };
    }
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
    const automaticIndexAdjustment = compareAutomaticIndexAdjustmentPresence(
      left,
      right
    );
    if (automaticIndexAdjustment)
      return {
        outcome: POINT_OUTCOME.EQUIVALENT,
        reasonCode: "EQUIVALENT_AUTOMATIC_INDEX_ADJUSTMENT_PRESENCE",
        ruleId: automaticIndexAdjustment.ruleId,
        dimension,
      };
    const stormDefinition = compareStormDefinitionThreshold(left, right);
    if (stormDefinition)
      return {
        outcome: POINT_OUTCOME.EQUIVALENT,
        reasonCode: "EQUIVALENT_STORM_DEFINITION_THRESHOLD",
        ruleId: stormDefinition.ruleId,
        dimension,
      };
    const fireDefinition = compareFireDefinition(left, right);
    if (fireDefinition)
      return {
        outcome: fireDefinition.equivalent
          ? POINT_OUTCOME.EQUIVALENT
          : fireDefinition.winnerSide === "A"
            ? POINT_OUTCOME.ADVANTAGE_A
            : POINT_OUTCOME.ADVANTAGE_B,
        reasonCode: fireDefinition.equivalent
          ? "EQUIVALENT_FIRE_DEFINITION_SCOPE"
          : "BROADER_FIRE_DEFINITION_SCOPE",
        ruleId: fireDefinition.ruleId,
        dimension: {
          ...dimension,
          comparisonAudit: fireDefinition.audit,
        },
      };
    const numeric = compareNumericFields(left, right, left.factRole, canonical);
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
    ...(atom.componentFamilyContract
      ? { componentFamilyContract: atom.componentFamilyContract }
      : {}),
    components: atom.declaredComponents,
  }));
  if (contracts.length === 0) {
    const persisted =
      packageSummary?.requirementContract ||
      packageSummary?.searchAudit?.requirementContract;
    if (persisted) contracts.push(persisted);
  }
  if (contracts.length === 0) return null;
  const signatures = new Set(
    contracts.map((contract) => JSON.stringify(contract))
  );
  if (signatures.size !== 1) return null;
  const [contract] = contracts;
  if (
    !/^[a-f0-9]{64}$/u.test(String(contract?.digest || "")) ||
    !["ALL", "ANY"].includes(contract?.componentSatisfactionPolicy) ||
    !Array.isArray(contract?.components) ||
    contract.components.length === 0 ||
    contract.components.some(
      ({ id, factRole }) =>
        !String(id || "").trim() || !String(factRole || "").trim()
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
  const eventModeLabel =
    {
      INTENDED_OPERATION: "bestimmungsgemäßer Betrieb oder Auslösung",
      UNINTENDED_EVENT: "bestimmungswidriges Ereignis",
      MIXED_OPERATION_MODES: "mehrere Ereignisvarianten",
    }[side.operationalEventMode] || "";
  const eventMode = eventModeLabel ? ` / ${eventModeLabel}` : "";
  const applicability =
    side.comparisonApplicability === PACKAGE_MEMBER
      ? "Paketmitglied"
      : side.documentApplicability || "Geltung unklar";
  return `${applicability} / ${side.selectedScopePicture || "Scope unklar"}${eventMode}`;
}

function dimensionReason(dimension) {
  const label = dimension.componentLabel || dimension.componentId;
  const aValues = displayedValues(dimension.a);
  const bValues = displayedValues(dimension.b);
  const aContext = comparisonContext(dimension.a);
  const bContext = comparisonContext(dimension.b);
  const feC07Audit = dimension.comparisonAudit;
  if (
    feC07Audit?.contractId ===
    "FE_C07_HIGHER_UNCONDITIONED_PERCENT_LIMIT_AUDIT_V1"
  ) {
    const winner = feC07Audit.winnerSide;
    const loser = winner === "A" ? "B" : "A";
    return `${label}: ${winner} ${feC07Audit.higherValue}, ${loser} ${feC07Audit.lowerValue}; die höhere Seite ist durch eine vollständig geprüfte lokale Klausel ohne zusätzliche Bedingung belegt`;
  }
  if (
    feC07Audit?.contractId ===
    "FE_A01_FIRE_DEFINITION_SCOPE_COMPARISON_AUDIT_V1"
  ) {
    const labels = {
      SPREAD_ONLY: "Brand bei bestimmungswidriger Ausbreitung",
      ARISE_OR_SPREAD:
        "Brand bei bestimmungswidrigem Entstehen oder bestimmungswidriger Ausbreitung",
    };
    return `${label}: A ${labels[feC07Audit.definitionA]}, B ${labels[feC07Audit.definitionB]}`;
  }
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

function cleanNotFoundAtom(atom) {
  const fields = atom.fields || [];
  const requestedFields = atom.requestedFields || [];
  const canonicalRequestedFields = [
    ...new Set(requestedFields.map((field) => String(field || "").trim())),
  ].sort();
  const canonicalObservedFields = [
    ...new Set(fields.map(({ field }) => String(field || "").trim())),
  ].sort();
  const validRequestedFieldNames =
    canonicalRequestedFields.length === requestedFields.length &&
    canonicalRequestedFields.every(Boolean);
  const requestedFieldsClean =
    (atom.requestedFieldStatus === "NOT_FOUND" &&
      fields.length > 0 &&
      validRequestedFieldNames &&
      JSON.stringify(canonicalObservedFields) ===
        JSON.stringify(canonicalRequestedFields) &&
      canonicalObservedFields.length === fields.length &&
      fields.every(
        ({ field, status, facts }) =>
          String(field || "").trim().length > 0 &&
          status === "NOT_FOUND" &&
          Array.isArray(facts) &&
          facts.length === 0
      )) ||
    (atom.requestedFieldStatus === "NOT_REQUIRED" &&
      requestedFields.length === 0 &&
      fields.length === 0);
  return (
    atom.evidencePresence === "NOT_FOUND" &&
    atom.coverageEffect === "UNKNOWN" &&
    atom.conflictState === "NONE" &&
    atom.selectedScopePicture === "UNKNOWN" &&
    atom.documentApplicability === "UNKNOWN" &&
    (atom.selectedCandidateIds || []).length === 0 &&
    (atom.unresolvedCandidateIds || []).length === 0 &&
    (atom.sources || []).length === 0 &&
    requestedFieldsClean
  );
}

function completeRequestedFieldContract(atom) {
  const requestedFields = atom.requestedFields || [];
  const fields = atom.fields || [];
  if (atom.requestedFieldStatus === "NOT_REQUIRED")
    return requestedFields.length === 0 && fields.length === 0;
  if (atom.requestedFieldStatus !== "COMPLETE") return false;
  const canonicalRequestedFields = [
    ...new Set(requestedFields.map((field) => String(field || "").trim())),
  ].sort();
  const canonicalObservedFields = [
    ...new Set(fields.map(({ field }) => String(field || "").trim())),
  ].sort();
  return (
    canonicalRequestedFields.length > 0 &&
    canonicalRequestedFields.length === requestedFields.length &&
    canonicalRequestedFields.every(Boolean) &&
    canonicalObservedFields.length === fields.length &&
    JSON.stringify(canonicalObservedFields) ===
      JSON.stringify(canonicalRequestedFields) &&
    fields.every(
      ({ status, facts }) =>
        status === "FOUND" && Array.isArray(facts) && facts.length > 0
    )
  );
}

function soleContributingFactMatchesAtom(packageSummary, atom) {
  const facts = packageSummary?.facts || [];
  const documentUuids = [...new Set(atom.documentUuids || [])].sort();
  return (
    facts.length === 1 &&
    documentUuids.length === 1 &&
    facts[0]?.documentUuid === documentUuids[0] &&
    facts[0]?.reviewStatus === packageSummary.reviewStatus
  );
}

function auditEntryMatchesAtom(entry, { code, side, categoryId, atom }) {
  return (
    entry?.code === code &&
    entry?.side === side &&
    entry?.level === "COMPONENT" &&
    entry?.requirementId === categoryId &&
    entry?.componentId === atom.componentId &&
    entry?.factRole === atom.factRole &&
    JSON.stringify(entry?.documentUuids) ===
      JSON.stringify([...new Set(atom.documentUuids || [])].sort()) &&
    entry?.observed?.selectedScopePicture === atom.selectedScopePicture &&
    entry?.observed?.scopePolicy === atom.scopePolicy &&
    (entry?.observed?.unresolvedCandidateIds || []).length === 0
  );
}

function decideSoleScopeReviewBlockerAsNonComparable({
  categoryId,
  packageA,
  packageB,
  atomsA,
  atomsB,
  contract,
  packageReviewAudit,
}) {
  if (
    packageA?.evidenceFound !== true ||
    packageB?.evidenceFound !== true ||
    packageA?.searchDisposition !== SEARCH_DISPOSITION.RELEVANT_FOUND ||
    packageB?.searchDisposition !== SEARCH_DISPOSITION.RELEVANT_FOUND ||
    ![null, undefined, ""].includes(packageA?.comparisonTreatment) ||
    ![null, undefined, ""].includes(packageB?.comparisonTreatment) ||
    ![
      [packageA?.reviewStatus, packageB?.reviewStatus],
      [packageB?.reviewStatus, packageA?.reviewStatus],
    ].some(
      ([completeStatus, partialStatus]) =>
        completeStatus === "BELEGT" && partialStatus === "TEILBELEGT"
    ) ||
    contract?.componentSatisfactionPolicy !== "ALL" ||
    contract.components?.length !== 1
  )
    return null;

  const [{ id: componentId, factRole }] = contract.components;
  const relevantA = (atomsA || []).filter(
    (atom) => atom.requirementId === categoryId
  );
  const relevantB = (atomsB || []).filter(
    (atom) => atom.requirementId === categoryId
  );
  if (
    relevantA.length === 0 ||
    relevantB.length === 0 ||
    [...relevantA, ...relevantB].some(
      (atom) =>
        atom.componentId !== componentId ||
        atom.factRole !== factRole ||
        atom.requirementContractDigest !== contract.digest ||
        atom.conflictState !== "NONE" ||
        (atom.unresolvedCandidateIds || []).length > 0
    )
  )
    return null;

  const foundA = relevantA.filter(
    ({ evidencePresence }) => evidencePresence === "FOUND"
  );
  const foundB = relevantB.filter(
    ({ evidencePresence }) => evidencePresence === "FOUND"
  );
  if (
    foundA.length !== 1 ||
    foundB.length !== 1 ||
    relevantA.some((atom) => atom !== foundA[0] && !cleanNotFoundAtom(atom)) ||
    relevantB.some((atom) => atom !== foundB[0] && !cleanNotFoundAtom(atom))
  )
    return null;

  const [left] = foundA;
  const [right] = foundB;
  if (
    !completeAtom(left) ||
    !completeAtom(right) ||
    !completeRequestedFieldContract(left) ||
    !completeRequestedFieldContract(right) ||
    left.scopePolicy !== "GENERAL_REQUIRED" ||
    right.scopePolicy !== "GENERAL_REQUIRED" ||
    new Set([left.selectedScopePicture, right.selectedScopePicture]).size !==
      2 ||
    ![left.selectedScopePicture, right.selectedScopePicture].every((scope) =>
      ["GENERAL", "NARROW_ONLY"].includes(scope)
    ) ||
    left.coverageEffect !== right.coverageEffect ||
    left.documentApplicability !== right.documentApplicability ||
    !["ACTIVE", "CONDITIONAL"].includes(left.documentApplicability) ||
    !soleContributingFactMatchesAtom(packageA, left) ||
    !soleContributingFactMatchesAtom(packageB, right)
  )
    return null;

  const narrowSide = left.selectedScopePicture === "NARROW_ONLY" ? "A" : "B";
  const generalSide = narrowSide === "A" ? "B" : "A";
  const narrowAtom = narrowSide === "A" ? left : right;
  if (
    packageReviewAudit?.schemaVersion !== PACKAGE_REVIEW_AUDIT_SCHEMA_VERSION ||
    packageReviewAudit?.contractId !== PACKAGE_REVIEW_AUDIT_CONTRACT_ID ||
    packageReviewAudit?.blockers?.length !== 1 ||
    !auditEntryMatchesAtom(packageReviewAudit.blockers[0], {
      code: BLOCKER_CODE.SCOPE_INCOMPLETE,
      side: narrowSide,
      categoryId,
      atom: narrowAtom,
    })
  )
    return null;

  const expectedSignals =
    narrowAtom.documentApplicability === "CONDITIONAL" ? 1 : 0;
  if (
    packageReviewAudit?.signals?.length !== expectedSignals ||
    (expectedSignals === 1 &&
      !auditEntryMatchesAtom(packageReviewAudit.signals[0], {
        code: SIGNAL_CODE.CONDITIONAL_APPLICABILITY,
        side: narrowSide,
        categoryId,
        atom: narrowAtom,
      }))
  )
    return null;

  const comparison = compareDimension(left, right);
  if (
    comparison.outcome !== POINT_OUTCOME.NOT_COMPARABLE ||
    comparison.reasonCode !== "COMPARABILITY_KEY_DIFFERS"
  )
    return null;

  return {
    schemaVersion: 3,
    outcome: POINT_OUTCOME.NOT_COMPARABLE,
    reasonCode: "COMPARABILITY_GATE_FAILED",
    reason: `Nicht direkt vergleichbar: ${comparison.dimension.componentLabel || componentId} ist in Polizze ${generalSide} für einen allgemeinen Deckungsumfang und in Polizze ${narrowSide} nur für einen engeren Deckungsumfang belegt. Angaben aus diesen unterschiedlichen Geltungsbereichen dürfen weder gleichgesetzt noch zu einem Vorteil gereiht werden.`,
    reviewRequired: false,
    ruleId: SOLE_SCOPE_REVIEW_RULE_ID,
    dimensions: [comparison.dimension],
  };
}

function decidePoint({
  categoryId,
  packageA,
  packageB,
  atomsA,
  atomsB,
  referenceAtomsA = atomsA,
  referenceAtomsB = atomsB,
  expectedDocumentsA,
  expectedDocumentsB,
}) {
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
  const bilateralAbsenceAudit = buildBilateralAbsenceAudit({
    categoryId,
    packageA,
    packageB,
    atomsA,
    atomsB,
    requirementContractA: contractA,
    requirementContractB: contractB,
  });
  if (bilateralAbsenceAudit)
    return {
      schemaVersion: 4,
      outcome: POINT_OUTCOME.EQUIVALENT,
      reasonCode: BILATERAL_ABSENCE_REASON_CODE,
      reason:
        "Gleichwertig: In beiden vollständig kontrolliert geprüften bereitgestellten Polizzen wurde für diesen Vergleichspunkt unter demselben versionierten Komponenten- und Suchvertrag keine passende Vertragsregelung gefunden. Beide Polizzen besitzen damit dieselbe dokumentierte Fundlage. Dies behauptet weder einen ausdrücklichen Ausschluss noch eine inhaltlich identische Deckung.",
      reviewRequired: false,
      ruleId: BILATERAL_ABSENCE_RULE_ID,
      comparisonTreatment: BILATERAL_ABSENCE_TREATMENT,
      bilateralAbsenceAudit,
      dimensions: [],
    };
  const lw20AbsenceDefaultExclusionEqualityAudit =
    buildLw20AbsenceDefaultExclusionEqualityAudit({
      categoryId,
      packageA,
      packageB,
      atomsA,
      atomsB,
      requirementContractA: contractA,
      requirementContractB: contractB,
    });
  if (lw20AbsenceDefaultExclusionEqualityAudit)
    return lw20AbsenceDefaultExclusionEqualityDecision(
      lw20AbsenceDefaultExclusionEqualityAudit
    );
  const unilateralCoverageAbsenceAudit = buildUnilateralCoverageAbsenceAudit({
    categoryId,
    packageA,
    packageB,
    atomsA,
    atomsB,
    requirementContractA: contractA,
    requirementContractB: contractB,
  });
  if (unilateralCoverageAbsenceAudit)
    return decideQualifiedCoverageOverAbsence({
      categoryId,
      packageA,
      packageB,
      unilateralCoverageAbsenceAudit,
    });
  if (
    (absentA && packageB?.evidenceFound) ||
    (absentB && packageA?.evidenceFound)
  )
    return unclear(
      "QUALIFIED_DIRECTIONAL_AUDIT_INCOMPLETE",
      "Unklar: Der einseitige Fund und der kontrollierte Negativbefund konnten nicht gemeinsam unter dem gehärteten Richtungsvertrag rekonstruiert werden."
    );
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
  const objectFamilyCoverageAudit = buildObjectFamilyCoverageAudit({
    categoryId,
    atomsA,
    atomsB,
    requirementContractA: contractA,
    requirementContractB: contractB,
  });
  if (objectFamilyCoverageAudit)
    return objectFamilyCoverageDecision(objectFamilyCoverageAudit);
  const vs21CostLimitPortfolioAudit = buildVs21CostLimitPortfolioAudit({
    categoryId,
    packageA,
    packageB,
    atomsA,
    atomsB,
    requirementContractA: contractA,
    requirementContractB: contractB,
  });
  if (vs21CostLimitPortfolioAudit)
    return vs21CostLimitPortfolioDecision(vs21CostLimitPortfolioAudit);
  const vs22HazardousWastePortfolioAudit =
    buildVs22HazardousWastePortfolioAudit({
      categoryId,
      packageA,
      packageB,
      atomsA,
      atomsB,
      requirementContractA: contractA,
      requirementContractB: contractB,
      expectedDocumentsA,
      expectedDocumentsB,
    });
  if (vs22HazardousWastePortfolioAudit)
    return vs22HazardousWastePortfolioDecision(
      vs22HazardousWastePortfolioAudit
    );
  const vs24ScaffoldingCostEqualityAudit =
    buildVs24ScaffoldingCostEqualityAudit({
      categoryId,
      packageA,
      packageB,
      atomsA,
      atomsB,
      requirementContractA: contractA,
      requirementContractB: contractB,
      expectedDocumentsA,
      expectedDocumentsB,
    });
  if (vs24ScaffoldingCostEqualityAudit)
    return vs24ScaffoldingCostEqualityDecision(
      vs24ScaffoldingCostEqualityAudit
    );
  const vs25AuthorityLimitPortfolioAudit =
    buildVs25AuthorityLimitPortfolioAudit({
      categoryId,
      packageA,
      packageB,
      atomsA,
      atomsB,
      referenceAtomsA,
      referenceAtomsB,
      requirementContractA: contractA,
      requirementContractB: contractB,
      expectedDocumentsA,
      expectedDocumentsB,
    });
  if (vs25AuthorityLimitPortfolioAudit)
    return vs25AuthorityLimitPortfolioDecision(
      vs25AuthorityLimitPortfolioAudit
    );
  const membershipConditionScopeComparisonAudit =
    buildMembershipConditionScopeComparisonAudit({
      categoryId,
      packageA,
      packageB,
      atomsA,
      atomsB,
      contract: atomsA?.find((atom) => atom?.requirementId === categoryId)
        ?.membershipConditionScopeComparisonContract,
      expectedDocumentsA,
      expectedDocumentsB,
    });
  if (membershipConditionScopeComparisonAudit)
    return membershipConditionScopeComparisonDecision(
      membershipConditionScopeComparisonAudit
    );
  if (
    packageA.reviewStatus !== "BELEGT" ||
    packageB.reviewStatus !== "BELEGT"
  ) {
    const packageReviewAudit = derivePackageReviewAudit({
      categoryId,
      packageA,
      packageB,
      atomsA,
      atomsB,
    });
    const packageActivatedObjectMembershipAudit = {
      A: buildPackageActivatedObjectMembershipAudit({
        categoryId,
        atoms: atomsA,
      }),
      B: buildPackageActivatedObjectMembershipAudit({
        categoryId,
        atoms: atomsB,
      }),
    };
    const vs15QualifierAbsenceAudit = buildVs15QualifierAbsenceAudit({
      categoryId,
      packageA,
      packageB,
      atomsA,
      atomsB,
      requirementContractA: contractA,
      requirementContractB: contractB,
      expectedDocumentsA,
      expectedDocumentsB,
    });
    if (vs15QualifierAbsenceAudit)
      return vs15QualifierAbsenceDecision(vs15QualifierAbsenceAudit);
    const scopeDecision = decideSoleScopeReviewBlockerAsNonComparable({
      categoryId,
      packageA,
      packageB,
      atomsA,
      atomsB,
      contract: contractA,
      packageReviewAudit,
    });
    if (scopeDecision) return scopeDecision;
    return {
      ...unclear(
        "PACKAGE_REVIEW_STATUS_BLOCKS_DECISION",
        `Unklar: Die Paket-Prüfstati (${packageA.reviewStatus} / ${packageB.reviewStatus}) erlauben keinen sicheren Vorteilsschluss.`
      ),
      packageReviewAudit,
      ...(packageActivatedObjectMembershipAudit.A ||
      packageActivatedObjectMembershipAudit.B
        ? { packageActivatedObjectMembershipAudit }
        : {}),
    };
  }

  const vs08ConditionConsensusAudit = buildVs08ConditionConsensusAudit({
    categoryId,
    packageA,
    packageB,
    atomsA,
    atomsB,
    requirementContractA: contractA,
    requirementContractB: contractB,
    expectedDocumentsA,
    expectedDocumentsB,
  });
  if (vs08ConditionConsensusAudit)
    return vs08ConditionConsensusDecision(vs08ConditionConsensusAudit);

  const groupsA = componentGroups(atomsA, categoryId);
  const groupsB = componentGroups(atomsB, categoryId);
  const componentPolicy = contractA.componentSatisfactionPolicy;

  const allComponentIds = [
    ...new Set([...groupsA.keys(), ...groupsB.keys()]),
  ].sort();
  let componentIds = allComponentIds;
  if (componentPolicy === "ANY") {
    const incompleteFound = [...(atomsA || []), ...(atomsB || [])].filter(
      (atom) =>
        atom.requirementId === categoryId &&
        atom.evidencePresence === "FOUND" &&
        !completeAtom(atom)
    );
    if (incompleteFound.length > 0)
      return unclear(
        "ANY_COMPONENT_EVIDENCE_INCOMPLETE",
        "Unklar: Mindestens eine gefundene Alternative ist unvollständig, konfliktbehaftet oder nicht eindeutig quellengebunden."
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
        ruleId: "ANY_COMPONENT_IDENTITY_GATE_V2_COMPLETE_FOUND_PRECEDENCE",
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
    const rawFoundA = (groupsA.get(componentId) || []).filter(
      ({ evidencePresence }) => evidencePresence === "FOUND"
    );
    const rawFoundB = (groupsB.get(componentId) || []).filter(
      ({ evidencePresence }) => evidencePresence === "FOUND"
    );
    const canonical = [...rawFoundA, ...rawFoundB].some(
      ({ documentStatus, documentApplicability }) =>
        documentStatus !== "ACTIVE" || documentApplicability !== "ACTIVE"
    );
    const foundA = canonical
      ? canonicalComparisonAtoms(rawFoundA)
      : uniqueAtoms(rawFoundA);
    const foundB = canonical
      ? canonicalComparisonAtoms(rawFoundB)
      : uniqueAtoms(rawFoundB);
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
    const completeFor = canonical ? comparisonAtomComplete : completeAtom;
    const feC07LimitDominance = compareFeC07LimitDominance(
      foundA[0],
      foundB[0]
    );
    if (
      !feC07LimitDominance &&
      (!completeFor(foundA[0]) || !completeFor(foundB[0]))
    )
      return unclear(
        "ATOMIC_EVIDENCE_INCOMPLETE",
        "Unklar: Mindestens ein atomarer Fakt ist unvollständig, konfliktbehaftet oder nicht mit einer gültigen Quelle gebunden.",
        dimensions
      );
    if (feC07LimitDominance) {
      dimensions.push({
        outcome:
          feC07LimitDominance.winnerSide === "A"
            ? POINT_OUTCOME.ADVANTAGE_A
            : POINT_OUTCOME.ADVANTAGE_B,
        reasonCode: "HIGHER_COVERAGE_LIMIT",
        ruleId: feC07LimitDominance.ruleId,
        dimension: {
          ...comparisonDimension(foundA[0], foundB[0], { canonical }),
          comparisonAudit: feC07LimitDominance.audit,
        },
      });
      continue;
    }
    dimensions.push(compareDimension(foundA[0], foundB[0], { canonical }));
  }

  if (
    dimensions.some(
      ({ reasonCode }) => reasonCode === "CONDITIONAL_OR_EXCEPTION_SCOPE"
    )
  )
    return {
      ...unclear(
        "CONDITIONAL_OR_EXCEPTION_SCOPE",
        "Unklar: Mindestens ein gebundener Beleg enthält eine Bedingung, Ausnahme oder Optionalität. Ohne aufgelösten Geltungsscope darf daraus weder ein Vorteil noch Gleichwertigkeit abgeleitet werden.",
        dimensions.map(({ dimension }) => dimension)
      ),
      ruleId: "FAIL_CLOSED_CONDITIONAL_SOURCE_V1",
    };
  if (
    dimensions.some(
      ({ reasonCode }) =>
        reasonCode === "COMPARISON_SCOPE_PROVENANCE_INCOMPLETE"
    )
  )
    return {
      ...unclear(
        "COMPARISON_SCOPE_PROVENANCE_INCOMPLETE",
        "Unklar: Für mindestens einen engeren Deckungsbeleg fehlt der source-gebundene Vergleichsscope. Ein nur einseitig belegter Scope-Schlüssel ist kein gesicherter fachlicher Unterschied.",
        dimensions.map(({ dimension }) => dimension)
      ),
      ruleId: "FAIL_CLOSED_COMPARISON_SCOPE_PROVENANCE_V1",
    };
  if (
    dimensions.some(
      ({ reasonCode }) => reasonCode === "OBJECT_SCOPE_PROVENANCE_INCOMPLETE"
    )
  )
    return {
      ...unclear(
        "OBJECT_SCOPE_PROVENANCE_INCOMPLETE",
        "Unklar: Für mindestens eine Seite fehlt genau ein vollständiger, source-gebundener Objektgeltungsbeleg.",
        dimensions.map(({ dimension }) => dimension)
      ),
      ruleId: "FAIL_CLOSED_OBJECT_SCOPE_IDENTITY_V1",
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
    return dimensions.some(
      ({ reasonCode }) => reasonCode === "OBJECT_SCOPE_KEYS_DIFFER"
    )
      ? {
          schemaVersion: 3,
          outcome: POINT_OUTCOME.NOT_COMPARABLE,
          reasonCode: "OBJECT_SCOPE_KEYS_DIFFER",
          reason:
            "Nicht direkt vergleichbar: Die vollständig belegten Objektgeltungsbereiche unterscheiden sich.",
          reviewRequired: false,
          ruleId: OBJECT_SCOPE_IDENTITY_COMPARISON_RULE_ID,
          dimensions: dimensions.map(({ dimension }) => dimension),
        }
      : {
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
  decideQualifiedCoverageOverAbsence,
  decidePoint,
};

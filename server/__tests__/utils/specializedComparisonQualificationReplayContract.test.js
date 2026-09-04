const crypto = require("crypto");
const {
  buildSpecializedComparisonQualificationReplay,
  buildSpecializedPointDecisionFromQualificationReplay,
  validateSpecializedComparisonQualificationReplay,
} = require("../../utils/policyComparison/specializedComparisonQualificationReplayContract");
const { decidePoint } = require("../../utils/policyComparison/pointDecision");
const {
  customerSafeComparisonReadView,
  deriveCustomerMetrics,
  validateCustomerComparison,
} = require("../../utils/policyComparison/customerMetricContract");
const {
  FE_A01_REQUIREMENT_CONTRACT_DIGEST,
  FE_C07_REQUIREMENT_CONTRACT_DIGEST,
  PRODUCT_PROFILE,
} = require("../../utils/policyComparison/productContract");
const {
  CUSTOMER_RESULT_RULE_OUTCOME_CONTRACT,
} = require("../../utils/policyComparison/customerResultRuleOutcomeContract");
const {
  buildFeC07ConditionAbsenceAudit,
} = require("../../utils/policyAnalysis/feC07ConditionAbsenceAudit");

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableValue(value[key])])
  );
}

function sha256(value) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(stableValue(value)))
    .digest("hex");
}

function sha256Text(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function document(side, key, overrides = {}) {
  return {
    uuid: `document-${key}`,
    side,
    role: "TERMS",
    documentStatus: "FRAMEWORK_TERMS",
    sha256: sha256Text(`document-${key}`),
    ...overrides,
  };
}

function source({ documentValue, requirementId, componentId, exactText, text }) {
  const physicalPageNumber = 2;
  const documentStart = 1_000 + text.indexOf(exactText);
  const documentEnd = documentStart + exactText.length;
  const identity = [
    documentValue.sha256,
    requirementId,
    componentId,
    physicalPageNumber,
    documentStart,
    documentEnd,
  ].join(":");
  return {
    candidateId: `candidate:${sha256Text(identity)}`,
    candidateBinding: "DIRECT",
    physicalPageNumber,
    candidateIdentityPageNumber: physicalPageNumber,
    documentFingerprint: documentValue.sha256,
    documentStart,
    documentEnd,
    exactText,
    exactTextSha256: sha256Text(exactText),
    conditionCheckDocumentStart: 1_000,
    conditionCheckDocumentEnd: 1_000 + text.length,
    conditionCheckText: text,
    conditionCheckTextSha256: sha256Text(text),
  };
}

function requirementContract(digest, componentId, factRole) {
  return {
    digest,
    componentSatisfactionPolicy: "ALL",
    components: [{ id: componentId, factRole }],
  };
}

function packageSummary(contract) {
  return {
    reviewStatus: "BELEGT",
    evidenceFound: true,
    requirementContract: contract,
    facts: [],
  };
}

function commonAtom({
  documentValue,
  requirementId,
  componentId,
  componentLabel,
  factRole,
  requirementContractDigest,
  sourceValue,
  fields = [],
  requestedFieldStatus = "NOT_REQUIRED",
  requestedFields = [],
  optionalFields = [],
  coverageEffect,
}) {
  return {
    requirementId,
    componentId,
    componentLabel,
    factRole,
    documentUuids: [documentValue.uuid],
    documentRole: documentValue.role,
    documentStatus: documentValue.documentStatus,
    evidencePresence: "FOUND",
    coverageEffect,
    conflictState: "NONE",
    selectedScopePicture: "GENERAL",
    scopePolicy: "GENERAL_REQUIRED",
    documentApplicability: "CONDITIONAL",
    selectedCandidateIds: [sourceValue.candidateId],
    unresolvedCandidateIds: [],
    requestedFieldStatus,
    requestedFields,
    optionalFields,
    componentSatisfactionPolicy: "ALL",
    requirementContractDigest,
    declaredComponents: [{ id: componentId, factRole }],
    fields,
    sources: [sourceValue],
  };
}

function fireFixture({ swap = false } = {}) {
  const componentId = "fire_definition";
  const factRole = "DEFINITION";
  const documents = {
    spread: document(swap ? "B" : "A", "fire-spread"),
    broad: document(swap ? "A" : "B", "fire-broad"),
  };
  const clauses = {
    spread:
      "Brand ist ein Feuer, das sich bestimmungswidrig ausbreitet; Schäden durch Kaminbrand sind mitversichert.",
    broad:
      "Brand ist ein Feuer, das bestimmungswidrig entsteht und/oder sich bestimmungswidrig ausbreitet (Schadenfeuer).",
  };
  const atoms = Object.fromEntries(
    Object.entries(clauses).map(([key, text]) => {
      const sourceValue = source({
        documentValue: documents[key],
        requirementId: "FE-A01",
        componentId,
        exactText: "Brand ist ein Feuer",
        text,
      });
      return [
        key,
        commonAtom({
          documentValue: documents[key],
          requirementId: "FE-A01",
          componentId,
          componentLabel: "Branddefinition",
          factRole,
          requirementContractDigest: FE_A01_REQUIREMENT_CONTRACT_DIGEST,
          sourceValue,
          coverageEffect: "DEFINED",
        }),
      ];
    })
  );
  const contract = requirementContract(
    FE_A01_REQUIREMENT_CONTRACT_DIGEST,
    componentId,
    factRole
  );
  const input = swap
    ? {
        atomsA: [atoms.broad],
        atomsB: [atoms.spread],
        expectedDocumentsA: [documents.broad],
        expectedDocumentsB: [documents.spread],
      }
    : {
        atomsA: [atoms.spread],
        atomsB: [atoms.broad],
        expectedDocumentsA: [documents.spread],
        expectedDocumentsB: [documents.broad],
      };
  return {
    categoryView: "FE",
    categoryId: "FE-A01",
    packageA: packageSummary(contract),
    packageB: packageSummary(contract),
    ...input,
  };
}

const FE_C07_RESTRICTION =
  "der Versicherungsnehmer und/oder Gebäudeeigentümer für den eingetretenen Schaden ersatzpflichtig ist und das Gebäude gegen die angeführte Gefahr versichert ist";

function feC07Atom(documentValue, percent, conditionMode, suffix = "") {
  const requirementId = "FE-C07";
  const componentId = "sauna_or_infrared_cabin_in_common_room";
  const clause =
    conditionMode === "ABSENT"
      ? `AW03 Gemeinschaftseinrichtungen Mitversichert sind Gemeinschaftseinrichtungen bis zu jeweils ${percent}% der Gebäudeversicherungssumme auf Erstes Risiko. Das sind Gemeinschaftsräume wie Saunen und Fitnessräume.${suffix}`
      : `Mitversichert sind bis zu jeweils ${percent}% der Gebäudeversicherungssumme auf Erstes Risiko, wenn ${FE_C07_RESTRICTION}: Gemeinschaftsräume wie Saunen.`;
  const exactText = "Gemeinschaftsräume wie Saunen";
  const sourceValue = source({
    documentValue,
    requirementId,
    componentId,
    exactText,
    text: clause,
  });
  const limitText = `${percent}%`;
  const limitStart = 1_000 + clause.indexOf(limitText);
  const limitFact = {
    binding: "DIRECT",
    normalizedValue: `${percent} %`,
    rawValue: limitText,
    valueType: "PERCENT",
    unit: "%",
    limitKind: "CAPPED",
    qualifier:
      "jeweils; auf Erstes Risiko; Bezugsgröße Gebäudeversicherungssumme",
    source: {
      candidateId: sourceValue.candidateId,
      physicalPageNumber: 2,
      documentFingerprint: documentValue.sha256,
      documentStart: limitStart,
      documentEnd: limitStart + limitText.length,
      exactText: limitText,
      exactTextSha256: sha256Text(limitText),
    },
  };
  const fields = [
    { field: "limit", status: "FOUND", facts: [limitFact] },
  ];
  if (conditionMode === "ABSENT") {
    const absenceAudit = buildFeC07ConditionAbsenceAudit({
      binding: "DIRECT",
      occurrence: {
        candidateId: sourceValue.candidateId,
        physicalPageNumber: 2,
        exactText,
        documentStart: sourceValue.documentStart,
        documentEnd: sourceValue.documentEnd,
        context: {
          unitType: "PARAGRAPH",
          text: clause,
          documentStart: 1_000,
          documentEnd: 1_000 + clause.length,
        },
      },
    });
    fields.push({
      field: "condition",
      status: "NOT_FOUND",
      facts: [],
      absenceAudit: {
        ...absenceAudit,
        source: {
          ...absenceAudit.source,
          documentFingerprint: documentValue.sha256,
        },
      },
    });
  } else {
    const conditionStart = 1_000 + clause.indexOf(FE_C07_RESTRICTION);
    fields.push({
      field: "condition",
      status: "FOUND",
      facts: [
        {
          binding: "DIRECT",
          normalizedValue: FE_C07_RESTRICTION,
          rawValue: FE_C07_RESTRICTION,
          valueType: "TEXT",
          unit: null,
          source: {
            candidateId: sourceValue.candidateId,
            physicalPageNumber: 2,
            documentFingerprint: documentValue.sha256,
            documentStart: conditionStart,
            documentEnd: conditionStart + FE_C07_RESTRICTION.length,
            exactText: FE_C07_RESTRICTION,
            exactTextSha256: sha256Text(FE_C07_RESTRICTION),
          },
        },
      ],
    });
  }
  return commonAtom({
    documentValue,
    requirementId,
    componentId,
    componentLabel: "Sauna oder Infrarotkabine im Gemeinschaftsraum",
    factRole: "INSURED_OBJECT",
    requirementContractDigest: FE_C07_REQUIREMENT_CONTRACT_DIGEST,
    sourceValue,
    fields,
    requestedFieldStatus: "COMPLETE",
    requestedFields: ["limit"],
    optionalFields: ["condition"],
    coverageEffect: "INCLUDED",
  });
}

function feC07Fixture({ swap = false, higherPercent = 10, suffix = "" } = {}) {
  const lowerDocument = document(swap ? "B" : "A", "sauna-lower");
  const higherDocument = document(swap ? "A" : "B", "sauna-higher", {
    role: "SUPPLEMENT",
  });
  const lowerAtom = feC07Atom(lowerDocument, 5, "RESTRICTED");
  const higherAtom = feC07Atom(
    higherDocument,
    higherPercent,
    "ABSENT",
    suffix
  );
  const contract = requirementContract(
    FE_C07_REQUIREMENT_CONTRACT_DIGEST,
    "sauna_or_infrared_cabin_in_common_room",
    "INSURED_OBJECT"
  );
  const input = swap
    ? {
        atomsA: [higherAtom],
        atomsB: [lowerAtom],
        expectedDocumentsA: [higherDocument],
        expectedDocumentsB: [lowerDocument],
      }
    : {
        atomsA: [lowerAtom],
        atomsB: [higherAtom],
        expectedDocumentsA: [lowerDocument],
        expectedDocumentsB: [higherDocument],
      };
  return {
    categoryView: "FE",
    categoryId: "FE-C07",
    packageA: packageSummary(contract),
    packageB: packageSummary(contract),
    ...input,
  };
}

function resultFor(input) {
  const pointDecision = decidePoint(input);
  const specializedComparisonQualificationReplay =
    buildSpecializedComparisonQualificationReplay(input);
  const categories = [
    {
      categoryView: input.categoryView,
      rows: [
        {
          categoryId: input.categoryId,
          outcome: "UNTERSCHIED_FACHLICH_PRÜFEN",
          packageA: input.packageA,
          packageB: input.packageB,
          pointDecision,
          specializedComparisonQualificationReplay,
        },
      ],
    },
  ];
  return {
    schemaVersion: 15,
    status: "COMPARISON_RESULT_MATERIALIZED",
    productProfile: PRODUCT_PROFILE,
    customerResultRuleOutcomeContract: {
      schemaVersion: CUSTOMER_RESULT_RULE_OUTCOME_CONTRACT.schemaVersion,
      contractId: CUSTOMER_RESULT_RULE_OUTCOME_CONTRACT.contractId,
    },
    documents: [...input.expectedDocumentsA, ...input.expectedDocumentsB],
    categories,
    totals: deriveCustomerMetrics(categories),
  };
}

function rehashReplay(replay) {
  replay.projectedAtomDigestsSha256 = {
    A: sha256(replay.projectedAtomsBySide.A),
    B: sha256(replay.projectedAtomsBySide.B),
  };
  const { replayDigestSha256: _discarded, ...body } = replay;
  replay.replayDigestSha256 = sha256(body);
}

describe.each([
  ["FE-A01", fireFixture, "VORTEIL_B", "VORTEIL_A"],
  ["FE-C07", feC07Fixture, "VORTEIL_B", "VORTEIL_A"],
])(
  "%s source-bound specialized qualification replay",
  (categoryId, fixture, normalOutcome, swappedOutcome) => {
    test("reconstructs the decision and remains side-neutral under A/B swap", () => {
      const normal = fixture();
      const normalReplay = buildSpecializedComparisonQualificationReplay(normal);
      expect(normalReplay).not.toHaveProperty("winnerSide");
      expect(normalReplay).not.toHaveProperty("outcome");
      expect(
        validateSpecializedComparisonQualificationReplay(normalReplay, normal)
      ).toBe(true);
      expect(
        buildSpecializedPointDecisionFromQualificationReplay({
          replay: normalReplay,
          ...normal,
        })
      ).toEqual(decidePoint(normal));
      expect(decidePoint(normal)).toMatchObject({ outcome: normalOutcome });

      const swapped = fixture({ swap: true });
      const swappedReplay =
        buildSpecializedComparisonQualificationReplay(swapped);
      expect(
        buildSpecializedPointDecisionFromQualificationReplay({
          replay: swappedReplay,
          ...swapped,
        })
      ).toEqual(decidePoint(swapped));
      expect(decidePoint(swapped)).toMatchObject({ outcome: swappedOutcome });
    });

    test("validates customer omission and strips the private replay", () => {
      const result = resultFor(fixture());
      expect(validateCustomerComparison(result)).toMatchObject({
        customerReviewRequired: 0,
      });
      expect(
        customerSafeComparisonReadView(result).categories[0].rows[0]
      ).not.toHaveProperty("specializedComparisonQualificationReplay");

      const omitted = JSON.parse(JSON.stringify(result));
      omitted.categories[0].rows[0].pointDecision = {
        schemaVersion: 3,
        outcome: "UNKLAR",
        reasonCode: "NO_APPROVED_RULE_FOR_ALL_DIMENSIONS",
        reason: "Unklar: Spezialentscheidung ausgelassen.",
        reviewRequired: true,
        ruleId: "FAIL_CLOSED_V1",
        dimensions: [],
      };
      omitted.totals = deriveCustomerMetrics(omitted.categories);
      expect(() => validateCustomerComparison(omitted)).toThrow(
        `COMPARISON_${categoryId.replace("-", "_")}_DECISION_OMISSION`
      );
    });

    test("rejects missing, orphaned and source/contract tampering", () => {
      const result = resultFor(fixture());
      const missing = JSON.parse(JSON.stringify(result));
      delete missing.categories[0].rows[0]
        .specializedComparisonQualificationReplay;
      expect(() => validateCustomerComparison(missing)).toThrow(
        `COMPARISON_${categoryId.replace("-", "_")}_QUALIFICATION_REPLAY_REQUIRED`
      );

      const orphaned = JSON.parse(JSON.stringify(result));
      orphaned.categories[0].rows[0].categoryId = "FE-A02";
      expect(() => validateCustomerComparison(orphaned)).toThrow(
        "COMPARISON_SPECIALIZED_QUALIFICATION_REPLAY_ORPHANED"
      );

      const sourceTamper = JSON.parse(JSON.stringify(result));
      sourceTamper.categories[0].rows[0].specializedComparisonQualificationReplay.projectedAtomsBySide.A[0].sources[0].documentFingerprint =
        "f".repeat(64);
      rehashReplay(
        sourceTamper.categories[0].rows[0]
          .specializedComparisonQualificationReplay
      );
      expect(() => validateCustomerComparison(sourceTamper)).toThrow(
        `COMPARISON_${categoryId.replace("-", "_")}_QUALIFICATION_REPLAY_INVALID`
      );

      const digestTamper = JSON.parse(JSON.stringify(result));
      digestTamper.categories[0].rows[0].specializedComparisonQualificationReplay.projectedAtomsBySide.A[0].requirementContractDigest =
        "e".repeat(64);
      rehashReplay(
        digestTamper.categories[0].rows[0]
          .specializedComparisonQualificationReplay
      );
      expect(() => validateCustomerComparison(digestTamper)).toThrow(
        `COMPARISON_${categoryId.replace("-", "_")}_QUALIFICATION_REPLAY_INVALID`
      );
    });
  }
);

describe("specialized replay adversarial semantics", () => {
  test("does not qualify FE-A01 AND wording or adverse context", () => {
    for (const text of [
      "Brand ist ein Feuer, das bestimmungswidrig entsteht und sich bestimmungswidrig ausbreitet.",
      "Brand ist ein Feuer, das bestimmungswidrig entsteht und/oder sich bestimmungswidrig ausbreitet, ist aber optional.",
    ]) {
      const input = fireFixture();
      const atom = input.atomsB[0];
      atom.sources[0].conditionCheckText = text;
      atom.sources[0].conditionCheckDocumentEnd =
        atom.sources[0].conditionCheckDocumentStart + text.length;
      atom.sources[0].conditionCheckTextSha256 = sha256Text(text);
      const replay = buildSpecializedComparisonQualificationReplay(input);
      const decision = buildSpecializedPointDecisionFromQualificationReplay({
        replay,
        ...input,
      });
      expect(decision.ruleId).not.toContain(
        "FE_A01_FIRE_DEFINITION_SCOPE_COMPARISON_V1"
      );
      expect(decision.outcome).not.toMatch(/^VORTEIL_/u);
    }
  });

  test("does not qualify FE-C07 equality or a conditioned higher clause", () => {
    const equal = feC07Fixture({ higherPercent: 5 });
    const equalReplay = buildSpecializedComparisonQualificationReplay(equal);
    expect(
      buildSpecializedPointDecisionFromQualificationReplay({
        replay: equalReplay,
        ...equal,
      }).ruleId
    ).not.toContain("FE_C07_HIGHER_UNCONDITIONED_PERCENT_LIMIT_V1");

    const conditioned = feC07Fixture();
    const conditionField = conditioned.atomsB[0].fields.find(
      ({ field }) => field === "condition"
    );
    conditionField.absenceAudit.source.exactText +=
      " Die Mitversicherung gilt nur, wenn der Gebäudeeigentümer haftet.";
    conditionField.absenceAudit.source.documentEnd =
      conditionField.absenceAudit.source.documentStart +
      conditionField.absenceAudit.source.exactText.length;
    conditionField.absenceAudit.source.exactTextSha256 = sha256Text(
      conditionField.absenceAudit.source.exactText
    );
    const conditionedReplay =
      buildSpecializedComparisonQualificationReplay(conditioned);
    expect(
      buildSpecializedPointDecisionFromQualificationReplay({
        replay: conditionedReplay,
        ...conditioned,
      }).ruleId
    ).not.toContain("FE_C07_HIGHER_UNCONDITIONED_PERCENT_LIMIT_V1");
  });

  test("rejects coherent point-decision audit tampering", () => {
    const result = resultFor(feC07Fixture());
    result.categories[0].rows[0].pointDecision.dimensions[0].comparisonAudit.higherValue =
      "20 %";
    expect(() => validateCustomerComparison(result)).toThrow(
      "COMPARISON_FE_C07_DECISION_OMISSION"
    );
  });
});

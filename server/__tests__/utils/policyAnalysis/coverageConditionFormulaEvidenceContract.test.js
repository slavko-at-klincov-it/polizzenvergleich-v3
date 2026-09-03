const crypto = require("crypto");
const {
  SOURCE_BOUND_COVERAGE_CONDITION_FORMULA_CONTRACT_ID,
  buildSourceBoundCoverageConditionFormulaProof,
  validateCoverageConditionFormulaContract,
  validSourceBoundCoverageConditionFormulaProof,
} = require("../../../utils/policyAnalysis/coverageConditionFormulaEvidenceContract");

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function predicate(
  predicateKey,
  actorBinding,
  requiredGroups,
  actorCombination = null,
  forbiddenAliases = ["keinesfalls erfüllt"]
) {
  return {
    kind: "PREDICATE",
    predicateKey,
    actorBinding,
    actorCombination,
    forbiddenAliases,
    requiredGroups,
  };
}

function operator(operatorKey, operatorAliases, left, right) {
  return {
    kind: "OPERATOR",
    operator: operatorKey,
    operatorAliases,
    operands: [left, right],
  };
}

function contract() {
  return {
    contractId: SOURCE_BOUND_COVERAGE_CONDITION_FORMULA_CONTRACT_ID,
    formulaKey: "GLOBAL_OBJECT_ELIGIBILITY_FOR_SELECTED_SECTION_V1",
    sourcePolicy: "GLOBAL_GOVERNOR_BEFORE_TARGETS_V1",
    targetScopePolicy: "GENERAL_DIRECT_TARGET_V1",
    targetCoverageGovernorAliases: [
      "Versichert sind",
      "Als versichert gelten",
    ],
    governorRequiredGroups: [
      ["Versicherungsschutz", "Deckungsschutz"],
      [
        "Leistungsinformation",
        "nachstehende Leistungen",
        "nachstehenden Leistungen",
      ],
      ["Voraussetzung", "Voraussetzungen"],
    ],
    formula: operator(
      "AND",
      ["und"],
      predicate("SECTION_INSURED", null, [
        ["Sparten", "Versicherungssparten"],
        ["versichert werden", "vereinbart sind", "sind vereinbart"],
      ], null, ["nicht versichert", "nicht vereinbart"]),
      operator(
        "OR",
        ["und / oder", "oder"],
        predicate(
          "OBJECT_OWNED_BY_POLICYHOLDER_OR_BUILDING_OWNER",
          "POLICYHOLDER_OR_BUILDING_OWNER",
          [
            ["versicherten Sachen", "versicherte Sachen"],
            ["Eigentum"],
            ["Versicherungsnehmers", "Versicherungsnehmer"],
            ["Gebäudeeigentümers", "Gebäudeeigentümer"],
            ["befinden", "stehen"],
          ],
          {
            operator: "OR",
            operatorAliases: ["und / oder", "oder"],
            leftGroupIndex: 2,
            rightGroupIndex: 3,
          },
          ["nicht im Eigentum", "kein Eigentum"]
        ),
        predicate(
          "ANAPHORIC_CONTRACTUAL_REPLACEMENT_OR_REINSTATEMENT_OBLIGATION",
          "ANAPHORIC_TO_PRECEDING_OWNER_GROUP",
          [
            ["dieser"],
            ["vertraglich"],
            [
              "Wiederbeschaffung / Wiederherstellung",
              "Wiederbeschaffung oder Wiederherstellung",
            ],
            ["aufzukommen hat", "aufkommen muss"],
          ],
          null,
          ["nicht aufzukommen", "keine Verpflichtung"]
        )
      )
    ),
  };
}

const GOVERNOR =
  "Versicherungsschutz gemäß der nachstehend angeführten Leistungsinformation besteht unter der\n" +
  "Voraussetzung, dass diese Sparten versichert werden und die versicherten Sachen sich im\n" +
  "Eigentum des Versicherungsnehmers und / oder Gebäudeeigentümers befinden und / oder dieser\n" +
  "vertraglich für die Wiederbeschaffung / Wiederherstellung aufzukommen hat.";
const TARGET_ONE = "- Solar- und Fotovoltaikanlagen am Gebäude;";
const TARGET_TWO = "- Sat- und Antennenanlagen, Solar- und Fotovoltaikanlagen;";

function fixture({
  governor = GOVERNOR,
  prefix = "Deckungskonzept\n\n",
  targetBlocks = [
    { governor: "Versichert sind", exactText: TARGET_ONE },
    { governor: "Versichert sind", exactText: TARGET_TWO },
  ],
} = {}) {
  const targetPage = targetBlocks
    .map(({ governor: targetGovernor, exactText }) =>
      `${targetGovernor}\n${exactText}`
    )
    .join("\n\n");
  const pages = [`${prefix}${governor}`, targetPage];
  let pageContent = "";
  const pageMap = pages.map((text, index) => {
    const start = pageContent.length;
    pageContent += text;
    const end = pageContent.length;
    if (index < pages.length - 1) pageContent += "\n";
    return { pageNumber: index + 1, start, end };
  });
  const fingerprint = sha256(pageContent);
  const targetCandidates = targetBlocks.map((block, index) => {
    const blockStart = pageContent.indexOf(`${block.governor}\n${block.exactText}`);
    const governorDocumentStart = blockStart;
    const governorDocumentEnd = governorDocumentStart + block.governor.length;
    const documentStart = pageContent.indexOf(block.exactText, governorDocumentEnd);
    const pageStart = pageMap[1].start;
    return {
      candidateId: `candidate:fe-c02:${index + 1}`,
      physicalPageNumber: 2,
      documentStart,
      documentEnd: documentStart + block.exactText.length,
      exactText: block.exactText,
      coverageGovernorHint: {
        physicalPageNumber: 2,
        pageStart: governorDocumentStart - pageStart,
        pageEnd: governorDocumentEnd - pageStart,
        text: block.governor,
      },
    };
  });
  return {
    documentArtifact: {
      schemaVersion: 1,
      fingerprint,
      document: {
        sourceDocumentId: fingerprint,
        pageContent,
        pageMap,
        pdfExtraction: {
          schemaVersion: 1,
          complete: true,
          totalPages: 2,
          processedPages: 2,
          pagesWithText: 2,
        },
      },
    },
    targetCandidates,
  };
}

describe("source-bound coverage-condition formula evidence", () => {
  test("binds the global A formula, logical operators and all supplied targets", () => {
    const value = fixture();
    const proof = buildSourceBoundCoverageConditionFormulaProof({
      contract: contract(),
      ...value,
    });

    expect(proof).toMatchObject({
      schemaVersion: 1,
      contractId: SOURCE_BOUND_COVERAGE_CONDITION_FORMULA_CONTRACT_ID,
      documentFingerprint: value.documentArtifact.fingerprint,
      formulaKey: "GLOBAL_OBJECT_ELIGIBILITY_FOR_SELECTED_SECTION_V1",
      sourcePolicy: "GLOBAL_GOVERNOR_BEFORE_TARGETS_V1",
      targetScopePolicy: "GENERAL_DIRECT_TARGET_V1",
      satisfaction: "NOT_EVALUATED",
      readyForDecision: false,
      governorSpan: { exactText: GOVERNOR },
      formula: {
        kind: "OPERATOR",
        operator: "AND",
        operatorSpan: { exactText: "und" },
        operands: [
          { kind: "PREDICATE", predicateKey: "SECTION_INSURED" },
          {
            kind: "OPERATOR",
            operator: "OR",
            operatorSpan: { exactText: "und / oder" },
            operands: [
              {
                predicateKey:
                  "OBJECT_OWNED_BY_POLICYHOLDER_OR_BUILDING_OWNER",
                actorBinding: "POLICYHOLDER_OR_BUILDING_OWNER",
                actorCombination: {
                  operator: "OR",
                  operatorSpan: { exactText: "und / oder" },
                },
              },
              {
                predicateKey:
                  "ANAPHORIC_CONTRACTUAL_REPLACEMENT_OR_REINSTATEMENT_OBLIGATION",
                actorBinding: "ANAPHORIC_TO_PRECEDING_OWNER_GROUP",
              },
            ],
          },
        ],
      },
      targets: [
        {
          candidateId: "candidate:fe-c02:1",
          exactText: TARGET_ONE,
          coverageGovernorSpan: { exactText: "Versichert sind" },
        },
        {
          candidateId: "candidate:fe-c02:2",
          exactText: TARGET_TWO,
          coverageGovernorSpan: { exactText: "Versichert sind" },
        },
      ],
    });
    expect(proof.proofDigest).toMatch(/^[a-f0-9]{64}$/u);
    expect(proof).not.toHaveProperty("coverageEffect");
  });

  test("supports catalogued wording variants rather than one customer phrase", () => {
    const variant =
      "Deckungsschutz für die nachstehenden Leistungen besteht unter folgenden Voraussetzungen: " +
      "Die Versicherungssparten sind vereinbart und versicherte Sachen stehen im Eigentum des " +
      "Versicherungsnehmer und/oder Gebäudeeigentümer oder dieser vertraglich für die " +
      "Wiederbeschaffung oder Wiederherstellung aufkommen muss.";
    const value = fixture({ governor: variant });
    expect(
      buildSourceBoundCoverageConditionFormulaProof({
        contract: contract(),
        ...value,
      })
    ).toMatchObject({
      governorSpan: { exactText: variant },
      satisfaction: "NOT_EVALUATED",
      readyForDecision: false,
    });
  });

  test("binds only source-proven general targets and excludes a narrower peril target", () => {
    const value = fixture({
      targetBlocks: [
        { governor: "Versichert sind", exactText: TARGET_ONE },
        {
          governor: "Zusätzlich versichert sind Schäden durch",
          exactText: TARGET_TWO,
        },
      ],
    });
    const proof = buildSourceBoundCoverageConditionFormulaProof({
      contract: contract(),
      ...value,
    });
    expect(proof.targets).toHaveLength(1);
    expect(proof.targets[0]).toMatchObject({
      candidateId: "candidate:fe-c02:1",
      exactText: TARGET_ONE,
      coverageGovernorSpan: { exactText: "Versichert sind" },
    });

    const narrowOnly = fixture({
      targetBlocks: [
        {
          governor: "Zusätzlich versichert sind Schäden durch",
          exactText: TARGET_TWO,
        },
      ],
    });
    expect(
      buildSourceBoundCoverageConditionFormulaProof({
        contract: contract(),
        ...narrowOnly,
      })
    ).toBeNull();
  });

  test("rejects a conjunctive owner group presented as the catalogued alternative", () => {
    const value = fixture({
      governor: GOVERNOR.replace(
        "Versicherungsnehmers und / oder Gebäudeeigentümers",
        "Versicherungsnehmers und Gebäudeeigentümers"
      ),
    });
    expect(
      buildSourceBoundCoverageConditionFormulaProof({
        contract: contract(),
        ...value,
      })
    ).toBeNull();
  });

  test("rejects locally negated prerequisite predicates", () => {
    const value = fixture({
      governor: GOVERNOR.replace(
        "diese Sparten versichert werden",
        "diese Sparten nicht versichert werden"
      ),
    });
    expect(
      buildSourceBoundCoverageConditionFormulaProof({
        contract: contract(),
        ...value,
      })
    ).toBeNull();
  });

  test.each([
    [
      "missing governor",
      () => fixture({ governor: "Allgemeine unverbindliche Einleitung." }),
    ],
    [
      "wrong predicate order",
      () =>
        fixture({
          governor:
            "Versicherungsschutz gemäß Leistungsinformation besteht unter der Voraussetzung, " +
            "dass diese Sparten versichert werden und dieser vertraglich für die " +
            "Wiederbeschaffung / Wiederherstellung aufzukommen hat und / oder die versicherten " +
            "Sachen sich im Eigentum des Versicherungsnehmers und / oder Gebäudeeigentümers befinden.",
        }),
    ],
    [
      "two complete governors",
      () => fixture({ prefix: `${GOVERNOR}\n\n` }),
    ],
  ])("fails closed for %s", (_label, createValue) => {
    expect(
      buildSourceBoundCoverageConditionFormulaProof({
        contract: contract(),
        ...createValue(),
      })
    ).toBeNull();
  });

  test("fails closed when any target precedes the governor", () => {
    const value = fixture();
    const target = value.targetCandidates[0];
    const governorStart = value.documentArtifact.document.pageContent.indexOf(
      GOVERNOR
    );
    const earlyText = "Deckungskonzept";
    value.targetCandidates = [
      {
        ...target,
        physicalPageNumber: 1,
        documentStart: 0,
        documentEnd: earlyText.length,
        exactText: earlyText,
      },
    ];
    expect(governorStart).toBeGreaterThan(0);
    expect(
      buildSourceBoundCoverageConditionFormulaProof({
        contract: contract(),
        ...value,
      })
    ).toBeNull();
  });

  test("rejects target and persisted-proof span manipulation", () => {
    const value = fixture();
    const proof = buildSourceBoundCoverageConditionFormulaProof({
      contract: contract(),
      ...value,
    });
    expect(
      validSourceBoundCoverageConditionFormulaProof({
        contract: contract(),
        proof,
        ...value,
      })
    ).toBe(true);

    const changedTarget = JSON.parse(JSON.stringify(value.targetCandidates));
    changedTarget[0].exactText = changedTarget[0].exactText.replace(
      "Solar",
      "Wind"
    );
    expect(
      buildSourceBoundCoverageConditionFormulaProof({
        contract: contract(),
        documentArtifact: value.documentArtifact,
        targetCandidates: changedTarget,
      })
    ).toBeNull();

    const changedGovernorHint = JSON.parse(
      JSON.stringify(value.targetCandidates)
    );
    changedGovernorHint[0].coverageGovernorHint.text = "Als versichert gelten";
    expect(
      buildSourceBoundCoverageConditionFormulaProof({
        contract: contract(),
        documentArtifact: value.documentArtifact,
        targetCandidates: changedGovernorHint,
      })
    ).toBeNull();

    const changedProof = JSON.parse(JSON.stringify(proof));
    changedProof.formula.operands[1].operator = "AND";
    expect(
      validSourceBoundCoverageConditionFormulaProof({
        contract: contract(),
        proof: changedProof,
        ...value,
      })
    ).toBe(false);
  });

  test("rejects incomplete artifacts and unsafe formula contracts", () => {
    const value = fixture();
    value.documentArtifact.document.pdfExtraction.processedPages = 1;
    expect(
      buildSourceBoundCoverageConditionFormulaProof({
        contract: contract(),
        ...value,
      })
    ).toBeNull();

    const unsafe = contract();
    unsafe.formula.operands[1].operands[1].actorBinding = null;
    expect(() => validateCoverageConditionFormulaContract(unsafe)).not.toThrow();
    unsafe.formula.operands[1].operands[1].actorBinding =
      "anaphoric free text";
    expect(() => validateCoverageConditionFormulaContract(unsafe)).toThrow(
      "COVERAGE_CONDITION_FORMULA_ACTOR_BINDING_INVALID"
    );
  });
});

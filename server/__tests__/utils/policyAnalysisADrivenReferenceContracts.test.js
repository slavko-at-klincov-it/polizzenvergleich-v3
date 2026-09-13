const {
  buildADrivenSourceUnitPlan,
  stableStringify,
} = require("../../utils/policyAnalysis/aDrivenSourceUnitPlan");
const {
  A_DYNAMIC_MANIFEST_CONTRACT_ID,
  A_SEMANTIC_SIGNAL_CONTRACT_ID,
  A_SEMANTIC_SIGNAL_CONTRACT_ID_V1,
  A_SEMANTIC_SIGNAL_CONTRACT_ID_V2,
  buildADrivenSemanticManifest,
  materializeSharedSignalComponents,
  requirementRoleEvidenceDiagnostics,
} = require("../../utils/policyAnalysis/aDrivenSemanticManifest");
const {
  buildADrivenClassificationBatches,
} = require("../../utils/policyAnalysis/aDrivenClassificationContract");
const {
  buildLegacyOracleCrosswalkDraft,
  validateLegacyOracleCrosswalk,
} = require("../../utils/policyAnalysis/aDrivenLegacyOracleCrosswalk");
const {
  compactReferenceCandidates,
} = require("../../utils/policyAnalysis/referenceCandidateCompactor");
const {
  validateCounterpartDecisions,
} = require("../../utils/policyAnalysis/referenceCounterpartDecisionContract");
const {
  A_DRIVEN_COUNTERPART_RETRIEVAL_CONTRACT_ID,
  A_DRIVEN_COUNTERPART_SEARCH_EXECUTION_CONTRACT_ID,
  REQUIRED_SEARCH_CHANNELS,
  buildADrivenCounterpartSearchPlan,
  materializeADrivenCounterpartSearchExecution,
} = require("../../utils/policyAnalysis/aDrivenCounterpartSearchPlan");
const {
  buildADrivenBinaryReferenceResult,
} = require("../../utils/policyAnalysis/aDrivenBinaryReferenceResult");
const {
  assessADrivenManifestAtomicityRisks,
  buildADrivenAStatusAudit,
  compareADrivenManifestAtomicity,
} = require("../../utils/policyAnalysis/aDrivenAStatusAudit");
const {
  attachTopLevelRequirementFragments,
  batchResultFile,
  deriveClassificationEvidencePlan,
  listSegmentRepairSkeletons,
  normalizeStandaloneListGovernorRequirements,
  normalizeUnambiguousComponentTypes,
  parseJsonArray,
  prompt: classificationPrompt,
  processClassificationBatches,
  requestCompletionWithTimeout,
  runBatch,
  validateBatchResponses,
} = require("../../scripts/qa/runADrivenReferenceClassification.cjs");
const {
  prompt: counterpartDecisionPrompt,
  processCounterpartDecisionBatches,
  runBatch: runCounterpartDecisionBatch,
} = require("../../scripts/qa/runADrivenReferenceCounterpartDecisions.cjs");
const {
  buildADrivenCounterpartDecisionPlan,
} = require("../../utils/policyAnalysis/aDrivenCounterpartDecisionPlan");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

describe("A-driven classification evidence recovery", () => {
  test("binds the model to minimal typed component labels instead of whole-clause labels", () => {
    const messages = classificationPrompt({
      batchId: "batch",
      expectedUnitIds: ["unit"],
      units: [],
    });
    const systemText = messages
      .filter(({ role }) => role === "system")
      .map(({ content }) => content)
      .join("\n");

    expect(systemText).toContain(
      "der kürzeste zusammenhängende wörtliche Quellteil"
    );
    expect(systemText).toContain(
      "nicht automatisch den vollständigen Listenpunkt"
    );
    expect(systemText).toContain(
      "Koordinierte Aufzählungen desselben Typs werden in einzelne Komponenten zerlegt"
    );
    expect(systemText).toContain(
      "verwende UNRESOLVED statt eines überbreiten Sammellabels"
    );
    expect(systemText).toContain(
      "Produkt- und Tarifkonfigurationen sind keine versicherten Sachobjekte"
    );
    expect(systemText).toContain(
      "in den jeweils beantragten/vereinbarten Sparten"
    );
    expect(systemText).toContain(
      "die bessere, günstigere oder weitergehende Deckung/Regelung/Leistung"
    );
    expect(systemText).toContain(
      "Eigentümer, Mieter oder Pächter und Handlungen wie Wiederbeschaffung/Wiederherstellung"
    );
  });

  test("recovers only adjacent, source-bound list governors without changing ownership", () => {
    const source = (documentUuid, blocks) => ({
      documentUuid,
      blockIds: blocks.map(({ blockId }) => blockId),
      blocks,
      combinedText: blocks.map(({ exactText }) => exactText).join("\n"),
    });
    const block = (blockId, exactText) => ({ blockId, exactText });
    const plan = {
      units: [
        {
          unitId: "embedded-governor",
          unitKind: "CLAUSE",
          source: source("doc", [
            block("effect", "Zusätzlich sind mitversichert bis 5 %"),
            block("bullet", "•"),
            block("dangling", "im Zusammenhang mit einem versuchten"),
          ]),
        },
        {
          unitId: "page-furniture",
          unitKind: "METADATA",
          source: source("doc", [block("page", "Seite 2")]),
        },
        {
          unitId: "continued-item",
          unitKind: "CLAUSE",
          source: source("doc", [block("item", "Einbruchdiebstahl.")]),
        },
        {
          unitId: "operative-heading",
          unitKind: "HEADING",
          structurePath: ["Nicht versichert sind:"],
          source: source("doc", [
            block("exclusion-effect", "Nicht versichert sind:"),
          ]),
        },
        {
          unitId: "excluded-one",
          unitKind: "CLAUSE",
          structurePath: ["Nicht versichert sind:"],
          source: source("doc", [block("excluded-one-block", "Schäden A")]),
        },
        {
          unitId: "excluded-two",
          unitKind: "CLAUSE",
          structurePath: ["Nicht versichert sind:"],
          governingContext: {
            relationType: "GOVERNS_FOLLOWING_LIST",
            unitIds: ["local-governor"],
            blockIds: ["local-effect"],
            blocks: [block("local-effect", "unter dieser Voraussetzung")],
          },
          source: source("doc", [block("excluded-two-block", "Schäden B")]),
        },
        {
          unitId: "list-governor",
          unitKind: "CLAUSE",
          source: source("doc", [
            block("list-effect", "Im Rahmen der Deckung sind mitversichert"),
            block("list-limit", "maximal EUR 10.000 auf Erstes Risiko"),
          ]),
        },
        {
          unitId: "governed-list",
          unitKind: "LIST",
          source: source("doc", [block("list-item", "• Gartenanlagen")]),
        },
        {
          unitId: "quantified-list-item",
          unitKind: "LIST",
          source: source("doc", [
            block("glass-size", "• Einzelscheibengröße von 10m²."),
          ]),
        },
        {
          unitId: "anaphoric-list-item",
          unitKind: "LIST",
          source: source("doc", [
            block("anaphora", "• Fenster gelten bis zu dieser Größe."),
          ]),
        },
        {
          unitId: "closed-sentence",
          unitKind: "CLAUSE",
          source: source("other-doc", [
            block("closed", "Diese Sachen sind versichert."),
          ]),
        },
        {
          unitId: "unrelated-list",
          unitKind: "LIST",
          source: source("other-doc", [block("other-item", "• Fahrzeuge")]),
        },
        {
          unitId: "unsupported-anaphora",
          unitKind: "LIST",
          source: source("other-doc", [
            block("unsupported-reference", "• Fenster bis zu dieser Größe"),
          ]),
        },
      ],
    };

    const recovered = deriveClassificationEvidencePlan(plan);
    const byId = new Map(recovered.units.map((unit) => [unit.unitId, unit]));

    expect(byId.get("continued-item").governingContext).toMatchObject({
      relationType: "RECOVERS_EMBEDDED_LIST_GOVERNOR",
      unitIds: ["embedded-governor"],
      blockIds: ["effect"],
    });
    expect(byId.get("governed-list").governingContext).toMatchObject({
      relationType: "RECOVERS_ADJACENT_LIST_GOVERNOR",
      unitIds: ["list-governor"],
      blockIds: ["list-effect", "list-limit"],
    });
    expect(byId.get("anaphoric-list-item").governingContext).toMatchObject({
      relationType: "RECOVERS_ADJACENT_ANAPHORIC_CONTEXT",
      unitIds: ["quantified-list-item"],
      blockIds: ["glass-size"],
    });
    expect(byId.get("excluded-one").governingContext).toMatchObject({
      relationType: "RECOVERS_OPERATIVE_HEADING_GOVERNOR",
      unitIds: ["operative-heading"],
      blockIds: ["exclusion-effect"],
    });
    expect(byId.get("excluded-two").governingContext).toMatchObject({
      relationType: "AUGMENTS_WITH_OPERATIVE_HEADING_GOVERNOR",
      unitIds: ["operative-heading", "local-governor"],
      blockIds: ["exclusion-effect", "local-effect"],
    });
    expect(byId.get("unrelated-list").governingContext).toBeUndefined();
    expect(byId.get("unsupported-anaphora").governingContext).toBeUndefined();
    expect(
      plan.units.find(({ unitId }) => unitId === "excluded-two")
        .governingContext
    ).toMatchObject({
      relationType: "GOVERNS_FOLLOWING_LIST",
      unitIds: ["local-governor"],
      blockIds: ["local-effect"],
    });
    expect(
      plan.units.find(({ unitId }) => unitId === "continued-item")
        .governingContext
    ).toBeUndefined();
    expect(recovered.classificationEvidenceContext.recoveredContexts).toBe(5);
  });

  test("carries a list governor across a bounded same-term definition bridge", () => {
    const source = (combinedText, blockId) => ({
      documentUuid: "doc",
      blockIds: [blockId],
      blocks: [{ blockId, exactText: combinedText }],
      combinedText,
    });
    const plan = {
      units: [
        {
          unitId: "governor",
          unitKind: "CLAUSE",
          source: source("Versichert sind Schäden durch", "governor-block"),
        },
        {
          unitId: "explosion",
          unitKind: "LIST",
          source: source("• Explosion", "explosion-block"),
        },
        {
          unitId: "explosion-definition",
          unitKind: "CLAUSE",
          source: source(
            "Eine Explosion gilt auch dann als Explosion, wenn der Behälter nicht zerreißt;",
            "definition-block"
          ),
        },
        {
          unitId: "resumed-list",
          unitKind: "LIST",
          source: source("• Sprengstoffexplosion", "resumed-block"),
        },
        {
          unitId: "unrelated-clause",
          unitKind: "CLAUSE",
          source: source("Der Vertrag endet heute.", "unrelated-block"),
        },
        {
          unitId: "unrelated-list",
          unitKind: "LIST",
          source: source("• Gartenmöbel", "unrelated-list-block"),
        },
      ],
    };

    const recovered = deriveClassificationEvidencePlan(plan);
    const byId = new Map(recovered.units.map((unit) => [unit.unitId, unit]));

    expect(byId.get("explosion").governingContext).toMatchObject({
      relationType: "RECOVERS_ADJACENT_LIST_GOVERNOR",
      unitIds: ["governor"],
      blockIds: ["governor-block"],
    });
    expect(byId.get("resumed-list").governingContext).toMatchObject({
      relationType: "RECOVERS_INTERRUPTED_LIST_GOVERNOR",
      unitIds: ["governor"],
      blockIds: ["governor-block"],
    });
    expect(byId.get("unrelated-list").governingContext).toBeUndefined();
    expect(recovered.classificationEvidenceContext).toEqual({
      contractId: "LF_A_CLASSIFICATION_EVIDENCE_CONTEXT_V2",
      recoveredContexts: 2,
    });
  });
});

function digest(contractId, payload) {
  return crypto
    .createHash("sha256")
    .update(`${contractId}\u0000${stableStringify(payload)}`)
    .digest("hex");
}

function retrievalArtifact(plan, packageResults) {
  const payload = {
    schemaVersion: 2,
    contractId: A_DRIVEN_COUNTERPART_RETRIEVAL_CONTRACT_ID,
    searchPlanSha256: plan.planSha256,
    retrievalPolicy: plan.retrievalPolicy,
    packageResults,
    summary: {},
  };
  return {
    ...payload,
    retrievalSha256: digest(
      A_DRIVEN_COUNTERPART_RETRIEVAL_CONTRACT_ID,
      payload
    ),
  };
}

function searchExecutionArtifact(packages) {
  const payload = {
    schemaVersion: 2,
    contractId: A_DRIVEN_COUNTERPART_SEARCH_EXECUTION_CONTRACT_ID,
    searchPlanSha256: "1".repeat(64),
    counterpartRetrievalSha256: "2".repeat(64),
    packages,
    summary: {},
  };
  return {
    ...payload,
    executionSha256: digest(
      A_DRIVEN_COUNTERPART_SEARCH_EXECUTION_CONTRACT_ID,
      payload
    ),
  };
}

function semanticChecks(componentId, dimensions) {
  return dimensions.map((dimension, index) => ({
    checkId: `check-${componentId}-${index}`,
    role: index === 0 ? "TARGET" : "CONTEXT",
    componentId: index === 0 ? componentId : `${componentId}-context-${index}`,
    dimension,
    label: `${dimension}-${index}`,
  }));
}

function decisionChecks(item, outcome, candidateIds = []) {
  return item.semanticChecks.map(({ checkId, dimension }) => ({
    checkId,
    dimension,
    outcome,
    candidateIds: outcome === "NOT_ESTABLISHED" ? [] : candidateIds,
  }));
}

function artifact(pages, fingerprintCharacter) {
  const chunks = [];
  const pageMap = [];
  for (const [index, page] of pages.entries()) {
    const marker = `[DOCUMENT_PAGE ${index + 1}]\n`;
    chunks.push(marker);
    const start = chunks.join("").length;
    chunks.push(page);
    pageMap.push({ pageNumber: index + 1, start, end: start + page.length });
    if (index < pages.length - 1) chunks.push("\n\n");
  }
  const fingerprint = fingerprintCharacter.repeat(64);
  return {
    schemaVersion: 1,
    fingerprint,
    document: {
      sourceDocumentId: fingerprint,
      pageContent: chunks.join(""),
      pageMap,
      pdfExtraction: {
        schemaVersion: 1,
        complete: true,
        totalPages: pages.length,
        processedPages: pages.length,
        pagesWithText: pages.length,
      },
    },
  };
}

function document(uuid, position, artifactValue) {
  return {
    document: {
      uuid,
      position,
      sha256: artifactValue.fingerprint,
      role: position === 0 ? "MAIN_POLICY" : "SUPPLEMENT",
      documentStatus: "ACTIVE",
    },
    artifact: artifactValue,
  };
}

function validResponse(unit) {
  if (unit.unitKind === "HEADING")
    return {
      unitId: unit.unitId,
      primaryClass: "STRUCTURE",
      semanticClasses: ["STRUCTURE"],
      requirements: [],
    };
  const firstBlock = unit.source.blocks[0];
  const deductibleEvidence = unit.source.blocks.find(({ exactText }) =>
    /\b(?:selbstbehalt|eigenbehalt)\b/iu.test(exactText)
  );
  if (deductibleEvidence) {
    const deductibleLabel = deductibleEvidence.exactText.match(
      /\b(?:selbstbehalt|eigenbehalt)\b/iu
    )[0];
    const rawValue = deductibleEvidence.exactText.match(
      /(?:EUR|Euro|€)\s*([0-9lI]+(?:[.,][0-9lI]+)?)/iu
    )?.[1];
    return {
      unitId: unit.unitId,
      primaryClass: "DEDUCTIBLE",
      semanticClasses: ["DEDUCTIBLE"],
      requirements: [
        {
          displayLabel: firstBlock.exactText,
          components: [
            {
              type: "DEDUCTIBLE",
              label: deductibleLabel,
              sourceBlockIds: [deductibleEvidence.blockId],
              ...(rawValue ? { rawValue } : {}),
            },
          ],
        },
      ],
    };
  }
  const coverageEvidence = unit.source.blocks
    .map((block) => ({
      block,
      match: block.exactText.match(
        /\b(?:ausgeschlossen|(?:mit)?versichert|nicht\s+(?:mit)?versichert|(?:nicht\s+)?ersetz(?:t|en))\b/iu
      ),
    }))
    .find(({ match }) => match);
  if (!coverageEvidence)
    return {
      unitId: unit.unitId,
      primaryClass: "INSURED_OBJECT",
      semanticClasses: ["INSURED_OBJECT"],
      requirements: [
        {
          displayLabel: firstBlock.exactText,
          components: unit.source.blocks.map((block) => ({
            type: "OBJECT",
            label: block.exactText,
            sourceBlockIds: [block.blockId],
          })),
        },
      ],
    };
  return {
    unitId: unit.unitId,
    primaryClass: "OPERATIVE_COVERAGE_STATEMENT",
    semanticClasses: ["OPERATIVE_COVERAGE_STATEMENT", "INSURED_OBJECT"],
    requirements: [
      {
        displayLabel: firstBlock.exactText,
        components: [
          ...unit.source.blocks.map((block) => ({
            type: "OBJECT",
            label: block.exactText,
            sourceBlockIds: [block.blockId],
          })),
          {
            type: "COVERAGE_EFFECT",
            label: coverageEvidence.match[0],
            coverageEffect: "INCLUDED",
            sourceBlockIds: [coverageEvidence.block.blockId],
          },
        ],
      },
    ],
  };
}

function searchEligibleManifest() {
  const source = artifact(
    ["Seite 1\nDECKUNG\nVersichert sind Gebäude und Nebengebäude.\n"],
    "8"
  );
  const plan = buildADrivenSourceUnitPlan({
    documents: [document("source", 0, source)],
  });
  const responses = plan.units
    .filter(
      ({ initialDisposition }) =>
        initialDisposition === "PENDING_CLASSIFICATION"
    )
    .map(validResponse);
  return buildADrivenSemanticManifest({ plan, responses });
}

describe("requirement-local semantic evidence completeness", () => {
  const evidenceUnit = (...blocks) => ({
    unitId: "signal-unit",
    source: {
      blocks: blocks.map(([blockId, exactText]) => ({ blockId, exactText })),
    },
  });
  const requirement = (sourceBlockIds, components) => ({
    sourceBlockIds,
    components,
  });
  const component = (type, blockId, extra = {}) => ({
    type,
    label: extra.label || "Beleg",
    sourceBlockIds: [blockId],
    ...extra,
  });

  test.each([
    {
      text: "Gebäude, sofern sie ständig bewohnt sind",
      signalId: "EXPLICIT_CONDITION",
      components: [component("OBJECT", "b1")],
    },
    {
      text: "Selbstbehalt EUR 350 je Schadenfall",
      signalId: "EXPLICIT_DEDUCTIBLE",
      components: [component("VALUE_AND_UNIT", "b1", { rawValue: "350" })],
    },
    {
      text: "exklusive deren Inhalt",
      signalId: "EXPLICIT_EXCLUSION",
      components: [
        component("COVERAGE_EFFECT", "b1", {
          coverageEffect: "INCLUDED",
        }),
      ],
    },
    {
      text: "maximal 5 % der Gebäudeversicherungssumme",
      signalId: "EXPLICIT_QUANTIFIED_VALUE",
      components: [component("LIMIT_BASIS", "b1")],
    },
    {
      text: "5 % der Gebäudeversicherungssumme",
      signalId: "EXPLICIT_LIMIT_BASIS",
      components: [component("VALUE_AND_UNIT", "b1", { rawValue: "5" })],
    },
    {
      text: "Mehrkosten infolge behördlicher Auflagen",
      signalId: "EXPLICIT_COST_ROLE",
      components: [component("OBJECT", "b1")],
    },
  ])(
    "rejects missing $signalId evidence in its own requirement",
    ({ text, signalId, components }) => {
      const diagnostics = requirementRoleEvidenceDiagnostics(
        evidenceUnit(["b1", text]),
        [requirement(["b1"], components)]
      );

      expect(diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "REQUIREMENT_ROLE_EVIDENCE_UNMAPPED",
            requirementIndex: 0,
            signalId,
          }),
        ])
      );
    }
  );

  test("does not borrow a compatible role from a sibling requirement", () => {
    const diagnostics = requirementRoleEvidenceDiagnostics(
      evidenceUnit(
        ["condition", "sofern die Anlage gewartet wird"],
        ["sibling", "Wartungsnachweis"]
      ),
      [
        requirement(["condition"], [component("OBJECT", "condition")]),
        requirement(
          ["sibling"],
          [component("CONDITION", "sibling", { label: "Wartungsnachweis" })]
        ),
      ]
    );

    expect(diagnostics).toEqual([
      expect.objectContaining({
        requirementIndex: 0,
        signalId: "EXPLICIT_CONDITION",
      }),
    ]);
  });

  test("ignores a signal that only spills into the same physical source block", () => {
    const unit = evidenceUnit([
      "shared-line",
      "Blitzschlag – soweit Eigentum besteht – bis 1 %",
    ]);
    const diagnostics = requirementRoleEvidenceDiagnostics(unit, [
      {
        ...requirement(
          ["shared-line"],
          [
            component("PERIL_OR_CAUSE", "shared-line", {
              label: "Blitzschlag",
            }),
          ]
        ),
        displayLabel: "Blitzschlag",
      },
    ]);

    expect(diagnostics).toEqual([]);
  });

  test("keeps a governing-context signal mandatory for every dependent requirement", () => {
    const unit = {
      ...evidenceUnit(["item", "Nebengebäude"]),
      governingContext: {
        blockIds: ["governor"],
        blocks: [
          {
            blockId: "governor",
            exactText: "Mitversichert, wenn das Gebäude betroffen ist",
          },
        ],
      },
    };
    const diagnostics = requirementRoleEvidenceDiagnostics(unit, [
      {
        ...requirement(
          ["governor", "item"],
          [component("OBJECT", "item", { label: "Nebengebäude" })]
        ),
        displayLabel: "Nebengebäude",
      },
    ]);

    expect(diagnostics).toEqual([
      expect.objectContaining({
        signalId: "EXPLICIT_CONDITION",
        matchedEvidence: [expect.objectContaining({ blockId: "governor" })],
      }),
    ]);
  });

  test("materializes a unique source-bound governor role into a sibling requirement", () => {
    const unit = evidenceUnit(
      ["governor", "Mitversichert, wenn das Gebäude betroffen ist"],
      ["item-one", "Nebengebäude"],
      ["item-two", "Garagen"]
    );
    const condition = component("CONDITION", "governor", {
      label: "wenn das Gebäude betroffen ist",
    });
    const result = materializeSharedSignalComponents(unit, [
      requirement(
        ["governor", "item-one"],
        [component("OBJECT", "item-one"), condition]
      ),
      requirement(["governor", "item-two"], [component("OBJECT", "item-two")]),
    ]);

    expect(result.requirements[1].components).toContainEqual(condition);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: "SHARED_SIGNAL_COMPONENT_MATERIALIZED",
        requirementIndex: 1,
        sourceRequirementIndex: 0,
        signalId: "EXPLICIT_CONDITION",
      }),
    ]);
    expect(
      requirementRoleEvidenceDiagnostics(unit, result.requirements)
    ).toEqual([]);
  });

  test("materializes an outer exclusion governor without treating its local exception as another exclusion", () => {
    const unit = {
      ...evidenceUnit(
        ["item-one", "Schäden durch Verschleiß;"],
        [
          "item-two",
          "Schäden an angeschlossenen Armaturen - ausgenommen durch Frost;",
        ]
      ),
      governingContext: {
        blockIds: ["governor"],
        blocks: [
          {
            blockId: "governor",
            exactText: "Nicht versichert sind",
          },
        ],
      },
    };
    const exclusion = component("COVERAGE_EFFECT", "governor", {
      label: "Nicht versichert sind",
      coverageEffect: "EXCLUDED",
    });
    const result = materializeSharedSignalComponents(unit, [
      requirement(["item-one"], [component("OBJECT", "item-one"), exclusion]),
      requirement(["item-two"], [component("OBJECT", "item-two")]),
    ]);

    expect(result.requirements[1].components).toContainEqual(exclusion);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "SHARED_SIGNAL_COMPONENT_MATERIALIZED",
          requirementIndex: 1,
          sourceRequirementIndex: 0,
          signalId: "EXPLICIT_EXCLUSION",
        }),
      ])
    );
    expect(
      requirementRoleEvidenceDiagnostics(unit, result.requirements)
    ).toEqual([]);
  });

  test("materializes an explicit local condition from a uniquely typed source component", () => {
    const unit = evidenceUnit([
      "scope-one",
      "auf Erstes Risiko, sofern kein zusätzlicher Betrag vereinbart wurde",
    ]);
    const result = materializeSharedSignalComponents(unit, [
      {
        ...requirement(
          ["scope-one"],
          [
            component("SCOPE", "scope-one", {
              label:
                "auf Erstes Risiko, sofern kein zusätzlicher Betrag vereinbart wurde",
            }),
          ]
        ),
        displayLabel:
          "auf Erstes Risiko, sofern kein zusätzlicher Betrag vereinbart wurde",
      },
    ]);

    expect(result.requirements[0].components).toContainEqual({
      type: "CONDITION",
      label: "sofern kein zusätzlicher Betrag vereinbart wurde",
      sourceBlockIds: ["scope-one"],
    });
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: "LOCAL_SIGNAL_COMPONENT_MATERIALIZED",
        requirementIndex: 0,
        sourceRequirementIndex: 0,
        signalId: "EXPLICIT_CONDITION",
      }),
    ]);
    expect(
      requirementRoleEvidenceDiagnostics(unit, result.requirements)
    ).toEqual([]);
  });

  test("materializes a modal prerequisite as a condition", () => {
    const source =
      "Problemstoffe müssen am Versicherungsort im Zusammenhang mit einem ersatzpflichtigen Schaden anfallen.";
    const unit = evidenceUnit(["condition", source]);
    const result = materializeSharedSignalComponents(unit, [
      {
        ...requirement(
          ["condition"],
          [component("OBJECT", "condition", { label: source })]
        ),
        displayLabel: source,
      },
    ]);

    expect(result.requirements[0].components).toContainEqual({
      type: "CONDITION",
      label:
        "müssen am Versicherungsort im Zusammenhang mit einem ersatzpflichtigen Schaden anfallen.",
      sourceBlockIds: ["condition"],
    });
    expect(
      requirementRoleEvidenceDiagnostics(unit, result.requirements)
    ).toEqual([]);
  });

  test.each([
    "Der Versicherungsnehmer ist berechtigt, eine Vertragsänderung zu verlangen.",
    "Die Versicherungsnehmerin kann nach einem versicherten Schaden unverzüglich mit der Reparatur beginnen.",
    "Verzichtet der Versicherer auf seinen Regressanspruch, bleibt der Mieter geschützt.",
    "Unbeabsichtigte Meldefehler beeinträchtigen die Leistungspflicht nicht.",
    "Ein Verstoß des Handwerkers schränkt dies nicht die Leistung des Versicherers ein.",
    "Der Versicherungsnehmer ist berechtigt, den Vertrag auf die neuen Bedingungen abzuändern und eine niedrigere Prämie zu verlangen.",
    "So ist der Versicherungsnehmer berechtigt, den Vertrag auf neue Bedingungen abzuändern.",
    "Es verzichtet der Versicherer für die Dauer von ca. 3 Jahren auf den Einwand der Unterversicherung.",
    "Eine erste Teilzahlung nach Anzeige des Schadens verlangt werden kann.",
    "Eine Akontierung ohne Präjudiz wird bei ausreichenden Sicherheiten vorgenommen.",
    "Der Wiederaufbau innerhalb Österreichs kann auch an anderer Stelle erfolgen.",
    "Bleibt gleichwohl die Verpflichtung des Versicherers zur Leistung bestehen.",
    "Die Versicherungssumme vermindert sich nicht um den Betrag der Entschädigung.",
    "Für jeden Versicherungsfall die volle Versicherungssumme zur Verfügung steht.",
    "Bei einer Verlegung am selben Grundstück gilt dies nicht als anzeigepflichtig.",
    "Es erfolgt auf Verlangen des Versicherungsnehmers eine Freigabe der übrigen Sparten.",
    "Eine vom Versicherer gewährte vorläufige Deckung gilt bis zum Einlangen der Polizze.",
  ])("materializes a source-bound contractual benefit: %s", (source) => {
    const unit = evidenceUnit(["benefit", source]);
    const result = materializeSharedSignalComponents(unit, [
      {
        ...requirement(
          ["benefit"],
          [component("OBJECT", "benefit", { label: source })]
        ),
        displayLabel: source,
      },
    ]);

    expect(result.requirements[0].components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "FACT_ROLE",
          sourceBlockIds: ["benefit"],
        }),
      ])
    );
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        signalContractId: A_SEMANTIC_SIGNAL_CONTRACT_ID,
        signalId: "EXPLICIT_CONTRACTUAL_BENEFIT",
      }),
    ]);
    expect(
      requirementRoleEvidenceDiagnostics(unit, result.requirements)
    ).toEqual([]);
  });

  test("materializes a contractual benefit across its exact source-block range", () => {
    const blocks = [
      [
        "benefit-lead",
        "Ergänzend zu § 11a VersVG gilt vereinbart, dass der Versicherer auf Verlangen des",
      ],
      [
        "benefit-body",
        "Versicherungsnehmers eine Abschrift eines auf Grund eines Schadensfalles erstellten Gutachtens zur",
      ],
      ["benefit-tail", "Verfügung stellt."],
    ];
    const sourceBlockIds = blocks.map(([blockId]) => blockId);
    const source = blocks.map(([, exactText]) => exactText).join("\n");
    const unit = evidenceUnit(...blocks);
    const result = materializeSharedSignalComponents(unit, [
      {
        ...requirement(sourceBlockIds, [
          ...blocks.map(([blockId, label]) =>
            component("OBJECT", blockId, { label })
          ),
          {
            type: "CONDITION",
            label: source.replace(
              "der Versicherer auf Verlangen",
              "der\nVersicherer auf Verlangen"
            ),
            sourceBlockIds,
          },
          {
            type: "FACT_ROLE",
            label: "auf Verlangen des\nVersicherungsnehmers",
            sourceBlockIds: sourceBlockIds.slice(0, 2),
          },
        ]),
        displayLabel: source,
      },
    ]);

    expect(result.requirements[0].components).toContainEqual({
      type: "FACT_ROLE",
      label:
        "der Versicherer auf Verlangen des\nVersicherungsnehmers eine Abschrift eines auf Grund eines Schadensfalles erstellten Gutachtens zur\nVerfügung stellt",
      sourceBlockIds,
    });
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "LOCAL_SIGNAL_COMPONENT_MATERIALIZED",
          signalId: "EXPLICIT_CONTRACTUAL_BENEFIT",
          sourceBlockIds,
        }),
      ])
    );
    expect(
      requirementRoleEvidenceDiagnostics(unit, result.requirements)
    ).toEqual([]);
  });

  test.each([
    {
      blocks: [
        [
          "benefit-value-lead",
          "Der Versicherungsnehmer kann nach einem versicherten Schadensfall bis voraussichtlich EUR 8.000,-",
        ],
        [
          "benefit-value-tail",
          "unverzüglich mit den Aufräumungs- und Reparaturarbeiten beginnen.",
        ],
      ],
      expectedLabel:
        "Der Versicherungsnehmer kann nach einem versicherten Schadensfall bis voraussichtlich EUR 8.000,-\nunverzüglich mit den Aufräumungs- und Reparaturarbeiten beginnen",
    },
    {
      blocks: [
        [
          "benefit-hyphen-lead",
          "Im Falle des Verkaufs verzichtet der Versicherer auf die etwaige Dauerrabatt-",
        ],
        [
          "benefit-hyphen-tail",
          "Rückforderung, soweit die Voraussetzungen erfüllt sind.",
        ],
      ],
      expectedLabel:
        "verzichtet der Versicherer auf die etwaige Dauerrabatt-\nRückforderung, soweit die Voraussetzungen erfüllt sind",
    },
  ])(
    "prefers the complete benefit across numeric punctuation and block continuation",
    ({ blocks, expectedLabel }) => {
      const sourceBlockIds = blocks.map(([blockId]) => blockId);
      const source = blocks.map(([, exactText]) => exactText).join("\n");
      const unit = evidenceUnit(...blocks);
      const result = materializeSharedSignalComponents(unit, [
        {
          ...requirement(
            sourceBlockIds,
            blocks.map(([blockId, label]) =>
              component("OBJECT", blockId, { label })
            )
          ),
          displayLabel: source,
        },
      ]);

      const benefitRoles = result.requirements[0].components.filter(
        ({ type }) => type === "FACT_ROLE"
      );
      expect(benefitRoles).toEqual([
        {
          type: "FACT_ROLE",
          label: expectedLabel,
          sourceBlockIds,
        },
      ]);
      expect(
        requirementRoleEvidenceDiagnostics(unit, result.requirements)
      ).toEqual([]);
    }
  );

  test("uses authoritative benefit evidence when model roles duplicate the same clause", () => {
    const source =
      "Nach Anzeige des Schadens eine erste Teilzahlung verlangt werden kann.";
    const unit = evidenceUnit(["benefit-duplicate-role", source]);
    const result = materializeSharedSignalComponents(unit, [
      {
        ...requirement(
          ["benefit-duplicate-role"],
          [
            component("OBJECT", "benefit-duplicate-role", { label: source }),
            component("CONDITION", "benefit-duplicate-role", {
              label: source,
            }),
          ]
        ),
        displayLabel: source,
      },
    ]);

    expect(result.requirements[0].components).toContainEqual({
      type: "FACT_ROLE",
      label: "erste Teilzahlung verlangt werden kann",
      sourceBlockIds: ["benefit-duplicate-role"],
    });
    expect(
      requirementRoleEvidenceDiagnostics(unit, result.requirements)
    ).toEqual([]);
  });

  test.each([
    "Der Versicherer ist berechtigt, den Vertrag zu kündigen.",
    "Der Versicherungsnehmer kann die Prämie nicht zurückfordern.",
    "Der Versicherungsnehmer muss die Gefahr unverzüglich anzeigen.",
    "Die Versicherungssumme vermindert sich nach dem Schaden.",
    "Eine vorläufige Deckung gilt nicht als erteilt.",
    "Eine Freigabe erfolgt nicht auf Verlangen des Versicherungsnehmers.",
  ])("does not invent a contractual benefit for: %s", (source) => {
    const unit = evidenceUnit(["not-benefit", source]);
    const input = [
      {
        ...requirement(
          ["not-benefit"],
          [component("OBJECT", "not-benefit", { label: source })]
        ),
        displayLabel: source,
      },
    ];
    const result = materializeSharedSignalComponents(unit, input);

    expect(
      result.requirements[0].components.some(({ type }) => type === "FACT_ROLE")
    ).toBe(false);
    expect(
      result.diagnostics.some(
        ({ signalId }) => signalId === "EXPLICIT_CONTRACTUAL_BENEFIT"
      )
    ).toBe(false);
  });

  test("keeps the frozen V1 signal contract free of V2 benefit materialization", () => {
    const source =
      "Der Versicherungsnehmer ist berechtigt, eine angemessene Teilzahlung zu verlangen.";
    const unit = evidenceUnit(["benefit-v1", source]);
    const result = materializeSharedSignalComponents(
      unit,
      [
        {
          ...requirement(
            ["benefit-v1"],
            [component("OBJECT", "benefit-v1", { label: source })]
          ),
          displayLabel: source,
        },
      ],
      { semanticSignalContractId: A_SEMANTIC_SIGNAL_CONTRACT_ID_V1 }
    );

    expect(result.diagnostics).toEqual([]);
    expect(result.requirements[0].components).toHaveLength(1);
  });

  test("materializes a split condition from an exact requirement display label", () => {
    const unit = evidenceUnit(
      ["peril", "Feuer und Sturm, auch wenn in der Sparte"],
      ["tail", "keine Position Sondermüll versichert ist."]
    );
    const result = materializeSharedSignalComponents(unit, [
      {
        ...requirement(
          ["peril", "tail"],
          [
            component("PERIL_OR_CAUSE", "peril", {
              label: "Feuer und Sturm",
            }),
            component("FACT_ROLE", "tail", {
              label: "keine Position Sondermüll versichert ist.",
            }),
          ]
        ),
        displayLabel:
          "Feuer und Sturm, auch wenn in der Sparte\nkeine Position Sondermüll versichert ist.",
      },
    ]);

    expect(result.requirements[0].components).toContainEqual({
      type: "CONDITION",
      label: "wenn in der Sparte\nkeine Position Sondermüll versichert ist.",
      sourceBlockIds: ["peril", "tail"],
    });
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: "LOCAL_SIGNAL_COMPONENT_MATERIALIZED",
        signalId: "EXPLICIT_CONDITION",
      }),
    ]);
  });

  test.each([
    {
      source: "Der Rohrersatz beträgt bis zu 10m Länge.",
      signalId: "EXPLICIT_QUANTIFIED_VALUE",
      type: "VALUE_AND_UNIT",
      rawValue: "10",
      unit: "m",
    },
    {
      source: "Die Einzelscheibengröße beträgt maximal 10m².",
      signalId: "EXPLICIT_QUANTIFIED_VALUE",
      type: "VALUE_AND_UNIT",
      rawValue: "10",
      unit: "m²",
    },
    {
      source: "Versichert ist eine Glasfläche von 10m².",
      signalId: "EXPLICIT_QUANTIFIED_VALUE",
      type: "VALUE_AND_UNIT",
      rawValue: "10",
      unit: "m²",
    },
    {
      source: "Der Schaden darf bis voraussichtlich EUR 8.000 betragen.",
      signalId: "EXPLICIT_QUANTIFIED_VALUE",
      type: "VALUE_AND_UNIT",
      rawValue: "8.000",
      unit: "EUR",
    },
    {
      source:
        "Die Kosten werden auf die Pauschalversicherungssumme angerechnet.",
      signalId: "EXPLICIT_NON_NUMERIC_LIMIT",
      type: "LIMIT_BASIS",
    },
    {
      source:
        "Versichert sind Schäden durch Gewalthandlungen bei einer Kundgebung.",
      signalId: "EXPLICIT_PERIL_OR_CAUSE",
      type: "PERIL_OR_CAUSE",
    },
    {
      source:
        "Unter Behandlung sind alle Maßnahmen zu verstehen, die gefährlichen Abfall beseitigen.",
      signalId: "EXPLICIT_DEFINITION",
      type: "FACT_ROLE",
    },
    {
      source:
        "Eine Geschäftsverbindung gilt nur dann als gegeben, wenn sie dauerhaft besteht.",
      signalId: "EXPLICIT_DEFINITION",
      type: "FACT_ROLE",
    },
    {
      source:
        "Nebengebäude sind privat oder betrieblich genutzte Gebäude und Anbauten, die fest verankert sind.",
      signalId: "EXPLICIT_COPULAR_DEFINITION",
      type: "FACT_ROLE",
    },
    {
      source:
        "Beschädigung von Gebäuden und Einfriedungen durch unbekannte Fahrzeuge.",
      signalId: "EXPLICIT_PERIL_OR_CAUSE",
      type: "PERIL_OR_CAUSE",
    },
    {
      source: "- Bruch- und Verstopfungsschäden an Außenleitungen.",
      signalId: "EXPLICIT_PERIL_OR_CAUSE",
      type: "PERIL_OR_CAUSE",
    },
    {
      source: "Versichert ist eine höchstens sechsmonatige Zwischenlagerung.",
      signalId: "EXPLICIT_NON_NUMERIC_LIMIT",
      type: "LIMIT_BASIS",
    },
    {
      source: "Der Mietverlust ist bis zu sechs Monaten gedeckt.",
      signalId: "EXPLICIT_NON_NUMERIC_LIMIT",
      type: "LIMIT_BASIS",
    },
    {
      source:
        "Der Schaden wird bis zu den in der Polizze angegebenen Versicherungssummen ersetzt.",
      signalId: "EXPLICIT_NON_NUMERIC_LIMIT",
      type: "LIMIT_BASIS",
    },
    {
      source:
        "In jedem Schadenfall wird der entschädigungspflichtige Betrag um 25% gekürzt.",
      signalId: "EXPLICIT_DEDUCTIBLE",
      type: "DEDUCTIBLE",
    },
  ])(
    "materializes the general $signalId wording '$source'",
    ({ source, signalId, type, rawValue, unit }) => {
      const result = materializeSharedSignalComponents(
        evidenceUnit(["limit", source]),
        [
          {
            ...requirement(
              ["limit"],
              [component("OBJECT", "limit", { label: source })]
            ),
            displayLabel: source,
          },
        ]
      );

      expect(result.requirements[0].components).toContainEqual({
        type,
        label: expect.any(String),
        sourceBlockIds: ["limit"],
        ...(rawValue ? { rawValue } : {}),
        ...(unit ? { unit } : {}),
      });
      expect(result.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "LOCAL_SIGNAL_COMPONENT_MATERIALIZED",
            signalId,
          }),
        ])
      );
      expect(
        requirementRoleEvidenceDiagnostics(
          evidenceUnit(["limit", source]),
          result.requirements
        )
      ).toEqual([]);
    }
  );

  test.each([
    "Gebäude sind versichert.",
    "Gebäude sind samt Anlagen mitversichert.",
    "Versichert sind Gebäude einschließlich ihrer Fundamente und Anlagen.",
    "Zusätzlich sind im Rahmen der Feuer-, Sturm-, Leitungswasser-, Gebäude- und Grundstückshaftpflichtversicherung bis zur Höhe der Gebäudeversicherungssumme mitversichert:",
    "Schäden an Personen (eine außereheliche Gemeinschaft ist in ihrer Auswirkung der ehelichen gleichgestellt) sind ausgeschlossen.",
  ])(
    "does not turn the coverage statement '%s' into a definition",
    (source) => {
      const result = materializeSharedSignalComponents(
        evidenceUnit(["coverage", source]),
        [
          {
            ...requirement(
              ["coverage"],
              [component("OBJECT", "coverage", { label: source })]
            ),
            displayLabel: source,
          },
        ]
      );

      expect(result.requirements[0].components).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ type: "FACT_ROLE" })])
      );
    }
  );

  test.each([
    {
      blocks: [
        ["damage", "Beschädigung von Gebäuden und Einfriedungen"],
        ["cause", "durch unbekannte Fahrzeuge."],
      ],
      expectedType: "PERIL_OR_CAUSE",
      expectedLabel: "unbekannte Fahrzeuge",
      expectedSourceBlockIds: ["cause"],
      signalId: "EXPLICIT_PERIL_OR_CAUSE",
    },
    {
      blocks: [
        ["event", "Der Versicherungsfall gilt mit der"],
        [
          "finding",
          "ersten Feststellung der Gesundheitsschädigung durch einen Arzt als eingetreten.",
        ],
      ],
      expectedType: "FACT_ROLE",
      expectedLabel:
        "gilt mit der\nersten Feststellung der Gesundheitsschädigung durch einen Arzt als eingetreten",
      expectedSourceBlockIds: ["event", "finding"],
      signalId: "EXPLICIT_DEFINITION",
    },
    {
      blocks: [
        [
          "definition-subject",
          "Nebengebäude sind privat oder betrieblich genutzte",
        ],
        ["definition-body", "Gebäude und Anbauten, die fest verankert sind."],
      ],
      expectedType: "FACT_ROLE",
      expectedLabel:
        "Nebengebäude sind privat oder betrieblich genutzte\nGebäude und Anbauten, die fest verankert sind",
      expectedSourceBlockIds: ["definition-subject", "definition-body"],
      signalId: "EXPLICIT_COPULAR_DEFINITION",
    },
  ])(
    "materializes $signalId when its exact relation spans component labels",
    ({
      blocks,
      expectedType,
      expectedLabel,
      expectedSourceBlockIds,
      signalId,
    }) => {
      const sourceBlockIds = blocks.map(([blockId]) => blockId);
      const result = materializeSharedSignalComponents(
        evidenceUnit(...blocks),
        [
          {
            ...requirement(
              sourceBlockIds,
              blocks.map(([blockId, label]) =>
                component("OBJECT", blockId, { label })
              )
            ),
            displayLabel: blocks[0][1],
          },
        ]
      );

      expect(result.requirements[0].components).toContainEqual({
        type: expectedType,
        label: expectedLabel,
        sourceBlockIds: expectedSourceBlockIds,
      });
      expect(result.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "LOCAL_SIGNAL_COMPONENT_MATERIALIZED",
            signalId,
          }),
        ])
      );
      expect(
        requirementRoleEvidenceDiagnostics(
          evidenceUnit(...blocks),
          result.requirements
        )
      ).toEqual([]);
    }
  );

  test("does not infer a limit or deductible from unrelated counts and reductions", () => {
    const diagnostics = requirementRoleEvidenceDiagnostics(
      evidenceUnit(
        ["count", "Es stehen maximal drei Facharbeiter bereit."],
        ["increase", "Der Betrag wird um 25% erhöht."],
        ["period", "Im Geschäftsjahr wird der Betrag um 25% gekürzt."],
        ["governor-only", "Versichert sind Schäden durch  "]
      ),
      [
        requirement(["count"], [component("OBJECT", "count")]),
        requirement(["increase"], [component("OBJECT", "increase")]),
        requirement(["period"], [component("OBJECT", "period")]),
        requirement(
          ["governor-only"],
          [component("COVERAGE_EFFECT", "governor-only")]
        ),
      ]
    );

    expect(diagnostics).toEqual([]);
  });

  test.each([
    {
      blocks: [
        ["lead", "Rohrbruch außerhalb des Grundstücks (max."],
        ["value", "10m)."],
      ],
      type: "VALUE_AND_UNIT",
      rawValue: "10",
      unit: "m",
      expectedSourceBlockIds: ["value"],
    },
    {
      blocks: [
        ["lead", "Entschädigung bis zur Höhe der jeweils"],
        ["basis", "vereinbarten Versicherungssumme."],
      ],
      type: "LIMIT_BASIS",
    },
  ])(
    "materializes a $type whose literal is split across adjacent source blocks",
    ({ blocks, type, rawValue, unit, expectedSourceBlockIds }) => {
      const source = blocks.map(([, exactText]) => exactText).join("\n");
      const sourceBlockIds = blocks.map(([blockId]) => blockId);
      const result = materializeSharedSignalComponents(
        evidenceUnit(...blocks),
        [
          {
            ...requirement(sourceBlockIds, [
              component("OBJECT", sourceBlockIds[0], { label: source }),
            ]),
            displayLabel: source,
          },
        ]
      );

      expect(result.requirements[0].components).toContainEqual({
        type,
        label: expect.any(String),
        sourceBlockIds: expectedSourceBlockIds || sourceBlockIds,
        ...(rawValue ? { rawValue } : {}),
        ...(unit ? { unit } : {}),
      });
      expect(
        requirementRoleEvidenceDiagnostics(
          evidenceUnit(...blocks),
          result.requirements
        )
      ).toEqual([]);
    }
  );

  test("accepts value and basis components split across one combined limit signal", () => {
    const unit = evidenceUnit(
      ["value", "Entschädigung bis 1% der"],
      ["basis", "Gebäudeversicherungssumme."]
    );
    const diagnostics = requirementRoleEvidenceDiagnostics(unit, [
      {
        ...requirement(
          ["value", "basis"],
          [
            component("VALUE_AND_UNIT", "value", {
              label: "bis 1%",
              rawValue: "1",
              unit: "%",
            }),
            component("LIMIT_BASIS", "basis", {
              label: "Gebäudeversicherungssumme",
            }),
          ]
        ),
        displayLabel: "Entschädigung bis 1% der Gebäudeversicherungssumme.",
      },
    ]);

    expect(diagnostics).toEqual([]);
  });

  test("materializes an explicit value from a source-bound anaphoric context", () => {
    const unit = {
      ...evidenceUnit(["anaphora", "Fenster gelten bis zu dieser Größe."]),
      governingContext: {
        blockIds: ["antecedent"],
        blocks: [
          {
            blockId: "antecedent",
            exactText: "Einzelscheibengröße von 10m².",
          },
        ],
      },
    };
    const result = materializeSharedSignalComponents(unit, [
      {
        ...requirement(
          ["anaphora"],
          [
            component("OBJECT", "anaphora", {
              label: "Fenster gelten bis zu dieser Größe.",
            }),
          ]
        ),
        displayLabel: "Fenster gelten bis zu dieser Größe.",
      },
    ]);

    expect(result.requirements[0].components).toContainEqual({
      type: "VALUE_AND_UNIT",
      label: "10m²",
      sourceBlockIds: ["antecedent"],
      rawValue: "10",
      unit: "m²",
    });
    expect(
      requirementRoleEvidenceDiagnostics(unit, result.requirements)
    ).toEqual([]);
  });

  test("materializes a local peril from a generic damages-through governor", () => {
    const unit = {
      ...evidenceUnit(
        ["sibling", "- Lawinen und Lawinenluftdruck;"],
        ["item", "- Hochwasser und Überschwemmung;"]
      ),
      governingContext: {
        blockIds: ["governor"],
        blocks: [
          {
            blockId: "governor",
            exactText: "Versichert sind insbesondere Schäden durch",
          },
        ],
      },
    };
    const result = materializeSharedSignalComponents(unit, [
      {
        ...requirement(
          ["item"],
          [
            component("COVERAGE_EFFECT", "governor", {
              label: "Versichert sind",
              coverageEffect: "INCLUDED",
            }),
            component("OBJECT", "item", {
              label: "- Hochwasser und Überschwemmung;",
            }),
          ]
        ),
        displayLabel: "- Hochwasser und Überschwemmung;",
      },
    ]);

    expect(result.requirements[0].components).toContainEqual({
      type: "PERIL_OR_CAUSE",
      label: "- Hochwasser und Überschwemmung",
      sourceBlockIds: ["item"],
    });
    expect(
      requirementRoleEvidenceDiagnostics(unit, result.requirements)
    ).toEqual([]);
  });

  test("accepts complete signals and ignores ordinary wording", () => {
    const diagnostics = requirementRoleEvidenceDiagnostics(
      evidenceUnit(
        [
          "complete",
          "Gebäude sind versichert, sofern sie bewohnt sind, maximal 5 % der Gebäudeversicherungssumme, ausgenommen Inhalt; Selbstbehalt EUR 350",
        ],
        ["plain", "Gebäude sind versichert."]
      ),
      [
        requirement(
          ["complete"],
          [
            component("OBJECT", "complete"),
            component("CONDITION", "complete"),
            component("VALUE_AND_UNIT", "complete", { rawValue: "5" }),
            component("LIMIT_BASIS", "complete"),
            component("DEDUCTIBLE", "complete"),
            component("COVERAGE_EFFECT", "complete", {
              label: "ausgenommen",
              coverageEffect: "EXCLUDED",
            }),
          ]
        ),
        requirement(["plain"], [component("OBJECT", "plain")]),
      ]
    );

    expect(diagnostics).toEqual([]);
  });

  test("ignores cost-saving wording and non-coverage references that are not local exclusions", () => {
    const diagnostics = requirementRoleEvidenceDiagnostics(
      evidenceUnit(
        ["cost", "die Wahl einer kosten- oder zeitsparenden Arbeitsweise"],
        [
          "liability",
          "Die Haftung für eine leicht fahrlässige Pflichtverletzung wird ausgeschlossen.",
        ],
        [
          "fallback",
          "Mehrkosten sind versichert, soweit sie in einer anderen Deckung keine Deckung finden.",
        ]
      ),
      [
        requirement(["cost"], [component("OBJECT", "cost")]),
        requirement(["liability"], [component("CONDITION", "liability")]),
        requirement(
          ["fallback"],
          [
            component("CONDITION", "fallback"),
            component("FACT_ROLE", "fallback", { label: "Mehrkosten" }),
          ]
        ),
      ]
    );

    expect(diagnostics).toEqual([]);
  });

  test("materializes a source-bound condition carried by the same requirement", () => {
    const source = artifact(
      ["Seite 1\nGebäude, sofern sie ständig bewohnt sind.\n"],
      "6"
    );
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const unit = plan.units.find(
      ({ initialDisposition, source: unitSource }) =>
        initialDisposition === "PENDING_CLASSIFICATION" &&
        unitSource.combinedText.includes("sofern")
    );
    const responses = plan.units
      .filter(
        ({ initialDisposition }) =>
          initialDisposition === "PENDING_CLASSIFICATION"
      )
      .map(validResponse);
    const manifest = buildADrivenSemanticManifest({
      plan,
      responses,
      semanticSignalContractId: A_SEMANTIC_SIGNAL_CONTRACT_ID,
    });

    expect(
      manifest.unitTerminals.find(({ unitId }) => unitId === unit.unitId)
        .terminalDisposition
    ).toBe("OPERATIVE_MAPPED");
    expect(
      manifest.requirements
        .find(({ sourceUnitIds }) => sourceUnitIds.includes(unit.unitId))
        .components.some(
          ({ type, label }) =>
            type === "CONDITION" && label === "sofern sie ständig bewohnt sind."
        )
    ).toBe(true);
  });
});

describe("LF_REFERENCE_A_DRIVEN_V2 source and semantic contracts", () => {
  test("attaches only unambiguous top-level requirement fragments to one unit", () => {
    const owner = {
      unitId: "unit-one",
      primaryClass: "INSURED_OBJECT",
      semanticClasses: ["INSURED_OBJECT"],
      requirements: [{ displayLabel: "Objekt A", components: [{}] }],
    };
    const fragment = { displayLabel: "Objekt B", components: [{}] };

    expect(
      attachTopLevelRequirementFragments([owner, fragment], ["unit-one"])
    ).toEqual({
      responses: [
        {
          ...owner,
          requirements: [...owner.requirements, fragment],
        },
      ],
      envelopeRepair: {
        applied: true,
        strategy: "ATTACH_UNAMBIGUOUS_TOP_LEVEL_REQUIREMENT_FRAGMENTS",
        unitId: "unit-one",
        attachedRequirements: 1,
      },
    });
    expect(
      attachTopLevelRequirementFragments(
        [owner, { ...fragment, unitId: "unknown" }],
        ["unit-one"]
      ).envelopeRepair
    ).toBeNull();
    expect(
      attachTopLevelRequirementFragments(
        [owner, fragment],
        ["unit-one", "unit-two"]
      ).envelopeRepair
    ).toBeNull();
  });

  test("materializes repair skeletons for both split and merged list segments", () => {
    const batch = {
      units: [
        {
          unitId: "unit-one",
          logicalSourceSegments: ["one", "two", "three"].map((segmentId) => ({
            segmentId,
            combinedText: `Text ${segmentId}`,
            blockIds: [`block-${segmentId}`],
          })),
        },
      ],
    };

    expect(
      listSegmentRepairSkeletons(batch, [
        {
          code: "LIST_CONTINUATION_SEGMENT_SPLIT",
          unitId: "unit-one",
          segmentId: "three",
        },
        {
          code: "LIST_SOURCE_SEGMENTS_MERGED",
          unitId: "unit-one",
          segmentIds: ["one", "two"],
        },
      ])
    ).toEqual([
      {
        unitId: "unit-one",
        segmentId: "one",
        exactDisplayLabel: "Text one",
        requiredBlockIds: ["block-one"],
      },
      {
        unitId: "unit-one",
        segmentId: "two",
        exactDisplayLabel: "Text two",
        requiredBlockIds: ["block-two"],
      },
      {
        unitId: "unit-one",
        segmentId: "three",
        exactDisplayLabel: "Text three",
        requiredBlockIds: ["block-three"],
      },
    ]);
  });

  test("repairs repeated owner closures around top-level requirement fragments", () => {
    const malformed =
      '[{"unitId":"unit-one","primaryClass":"INSURED_OBJECT","semanticClasses":["INSURED_OBJECT"],"requirements":[{"displayLabel":"A","components":[{}]}]},{"displayLabel":"B","components":[{}]}},{"displayLabel":"C","components":[{}]}]}]';

    const parsed = parseJsonArray(malformed);

    expect(parsed.syntaxRepair).toMatchObject({
      applied: true,
      strategy: "PREMATURE_REQUIREMENTS_ARRAY_CLOSE_AND_REPEATED_OWNER_CLOSE",
    });
    expect(parsed.responses).toHaveLength(1);
    expect(
      parsed.responses[0].requirements.map(({ displayLabel }) => displayLabel)
    ).toEqual(["A", "B", "C"]);
  });

  test("moves an owned shared list governor into its subordinate item requirement", () => {
    const unit = {
      unitId: "unit-one",
      source: {
        blocks: [
          { blockId: "governor", structuralKind: "LIST_GOVERNOR" },
          { blockId: "item", structuralKind: "LIST_ITEM" },
        ],
      },
      logicalSourceSegments: [
        { segmentId: "one", blockIds: ["governor"] },
        { segmentId: "two", blockIds: ["item"] },
      ],
    };
    const governorComponent = {
      type: "VALUE_AND_UNIT",
      label: "5 %",
      rawValue: "5",
      sourceBlockIds: ["governor"],
    };
    const response = {
      unitId: unit.unitId,
      requirements: [
        { displayLabel: "5 %", components: [governorComponent] },
        {
          displayLabel: "Nebengebäude",
          components: [
            { type: "OBJECT", label: "Nebengebäude", sourceBlockIds: ["item"] },
          ],
        },
      ],
    };

    const normalized = normalizeStandaloneListGovernorRequirements(
      [response],
      [unit]
    );

    expect(normalized.responses[0].requirements).toHaveLength(1);
    expect(normalized.responses[0].requirements[0].components).toContainEqual(
      governorComponent
    );
    expect(normalized.repairs).toEqual([
      expect.objectContaining({
        unitId: "unit-one",
        action: "MATERIALIZE_SHARED_LIST_GOVERNOR_COMPONENTS",
        sourceRequirementIndex: 0,
        targetRequirementIndexes: [1],
        governorBlockIds: ["governor"],
      }),
    ]);
  });

  test("separates a pure quantified list limit from the insured object it governs", () => {
    const limit =
      '• bis zu jeweils 5% der Gebäudeversicherungssumme auf ,,Erstes Risiko"';
    const object = "- Nebengebäude";
    const unit = {
      unitId: "quantified-limit-governor",
      unitKind: "LIST",
      source: {
        blockIds: ["limit", "object"],
        combinedText: [limit, object].join("\n"),
        blocks: [
          {
            blockId: "limit",
            structuralKind: "LIST_GOVERNOR",
            exactText: limit,
          },
          {
            blockId: "object",
            structuralKind: "LIST_ITEM",
            exactText: object,
          },
        ],
      },
      logicalSourceSegments: [
        { segmentId: "limit", blockIds: ["limit"] },
        { segmentId: "object", blockIds: ["object"] },
      ],
    };
    const normalized = normalizeUnambiguousComponentTypes(
      [
        {
          unitId: unit.unitId,
          primaryClass: "INSURED_OBJECT",
          semanticClasses: ["INSURED_OBJECT"],
          requirements: [
            {
              displayLabel: unit.source.combinedText,
              components: [
                {
                  type: "OBJECT",
                  label: limit,
                  sourceBlockIds: ["limit"],
                },
                {
                  type: "OBJECT",
                  label: "Nebengebäude",
                  sourceBlockIds: ["object"],
                },
              ],
            },
          ],
        },
      ],
      [unit]
    );

    expect(normalized.responses[0]).toMatchObject({
      primaryClass: "INSURED_OBJECT",
      semanticClasses: ["INSURED_OBJECT", "LIMIT"],
    });
    expect(normalized.responses[0].requirements[0].components).toEqual([
      {
        type: "VALUE_AND_UNIT",
        label: "bis zu jeweils 5%",
        rawValue: "5",
        unit: "%",
        sourceBlockIds: ["limit"],
      },
      {
        type: "LIMIT_BASIS",
        label: 'der Gebäudeversicherungssumme auf ,,Erstes Risiko"',
        sourceBlockIds: ["limit"],
      },
      {
        type: "OBJECT",
        label: "Nebengebäude",
        sourceBlockIds: ["object"],
      },
    ]);
    expect(normalized.componentRepairs).toContainEqual({
      unitId: unit.unitId,
      requirementIndex: 0,
      componentIndex: 0,
      action: "NORMALIZE_PURE_QUANTIFIED_LIMIT_OBJECT",
      fromType: "OBJECT",
      toTypes: ["VALUE_AND_UNIT", "LIMIT_BASIS"],
    });
  });

  test("turns a standalone pure quantified limit out of an object terminal", () => {
    const source = "Höchstens 10 % der Versicherungssumme.";
    const unit = {
      unitId: "standalone-quantified-limit",
      unitKind: "CLAUSE",
      source: {
        blockIds: ["limit"],
        combinedText: source,
        blocks: [{ blockId: "limit", exactText: source }],
      },
      logicalSourceSegments: [],
    };
    const normalized = normalizeUnambiguousComponentTypes(
      [
        {
          unitId: unit.unitId,
          primaryClass: "INSURED_OBJECT",
          semanticClasses: ["INSURED_OBJECT"],
          requirements: [
            {
              displayLabel: source,
              components: [
                { type: "OBJECT", label: source, sourceBlockIds: ["limit"] },
              ],
            },
          ],
        },
      ],
      [unit]
    );

    expect(normalized.responses[0]).toMatchObject({
      primaryClass: "LIMIT",
      semanticClasses: ["LIMIT"],
    });
    expect(
      normalized.responses[0].requirements[0].components.map(({ type }) => type)
    ).toEqual(["VALUE_AND_UNIT", "LIMIT_BASIS"]);
  });

  test.each([
    "Nebengebäude mit einer Fläche von höchstens 50 % der Gesamtfläche",
    "bis zu 100 m² große Nebengebäude",
    "bis zu 10 % der Versicherungssumme, wenn der Schaden gemeldet wird",
  ])(
    "does not reinterpret a mixed or conditional object label: %s",
    (label) => {
      const unit = {
        unitId: "mixed-object-limit",
        source: {
          blockIds: ["block"],
          combinedText: label,
          blocks: [{ blockId: "block", exactText: label }],
        },
      };
      const response = {
        unitId: unit.unitId,
        primaryClass: "INSURED_OBJECT",
        semanticClasses: ["INSURED_OBJECT"],
        requirements: [
          {
            displayLabel: label,
            components: [{ type: "OBJECT", label, sourceBlockIds: ["block"] }],
          },
        ],
      };

      expect(normalizeUnambiguousComponentTypes([response], [unit])).toEqual({
        responses: [response],
        componentRepairs: [],
      });
    }
  );

  test("keeps a predicate-free insurance branch title out of insured objects", () => {
    const source = "Grundstückshaftpflichtversicherung";
    const unit = {
      unitId: "insurance-branch-heading",
      unitKind: "CLAUSE",
      source: {
        blockIds: ["heading"],
        combinedText: source,
        blocks: [
          {
            blockId: "heading",
            structuralKind: "BODY_LINE",
            exactText: source,
          },
        ],
      },
    };
    const normalized = normalizeUnambiguousComponentTypes(
      [
        {
          unitId: unit.unitId,
          primaryClass: "INSURED_OBJECT",
          semanticClasses: ["INSURED_OBJECT"],
          requirements: [
            {
              displayLabel: source,
              components: [
                { type: "OBJECT", label: source, sourceBlockIds: ["heading"] },
              ],
            },
          ],
        },
      ],
      [unit]
    );

    expect(normalized.responses[0]).toEqual({
      unitId: unit.unitId,
      primaryClass: "STRUCTURE",
      semanticClasses: ["STRUCTURE"],
      requirements: [],
    });
    expect(normalized.componentRepairs).toContainEqual({
      unitId: unit.unitId,
      action: "NORMALIZE_INSURANCE_BRANCH_HEADING_TO_STRUCTURE",
    });
  });

  test("does not hide a predicated insurance-branch statement as structure", () => {
    const source = "Die Grundstückshaftpflichtversicherung ist mitversichert.";
    const unit = {
      unitId: "insurance-branch-statement",
      unitKind: "CLAUSE",
      source: {
        blockIds: ["statement"],
        combinedText: source,
        blocks: [{ blockId: "statement", exactText: source }],
      },
    };
    const response = {
      unitId: unit.unitId,
      primaryClass: "OPERATIVE_COVERAGE_STATEMENT",
      semanticClasses: ["OPERATIVE_COVERAGE_STATEMENT"],
      requirements: [
        {
          displayLabel: source,
          components: [
            {
              type: "COVERAGE_EFFECT",
              label: "mitversichert",
              coverageEffect: "INCLUDED",
              sourceBlockIds: ["statement"],
            },
          ],
        },
      ],
    };

    expect(normalizeUnambiguousComponentTypes([response], [unit])).toEqual({
      responses: [response],
      componentRepairs: [],
    });
  });

  test("removes a condition-only object reference when an operative object exists outside it", () => {
    const source =
      "Versichert sind Vorräte, soweit sie zum Gebäude zählen und kein anderer Versicherungsschutz besteht.";
    const unit = {
      unitId: "condition-object-reference",
      source: {
        blockIds: ["block"],
        combinedText: source,
        blocks: [{ blockId: "block", exactText: source }],
      },
    };
    const normalized = normalizeUnambiguousComponentTypes(
      [
        {
          unitId: unit.unitId,
          primaryClass: "INSURED_OBJECT",
          semanticClasses: ["INSURED_OBJECT"],
          requirements: [
            {
              displayLabel: source,
              components: [
                {
                  type: "OBJECT",
                  label: "Vorräte",
                  sourceBlockIds: ["block"],
                },
                {
                  type: "OBJECT",
                  label: "Gebäude",
                  sourceBlockIds: ["block"],
                },
                {
                  type: "CONDITION",
                  label:
                    "soweit sie zum Gebäude zählen und kein anderer Versicherungsschutz besteht.",
                  sourceBlockIds: ["block"],
                },
              ],
            },
          ],
        },
      ],
      [unit]
    );

    expect(
      normalized.responses[0].requirements[0].components.map(
        ({ type, label }) => [type, label]
      )
    ).toEqual([
      ["OBJECT", "Vorräte"],
      [
        "CONDITION",
        "soweit sie zum Gebäude zählen und kein anderer Versicherungsschutz besteht.",
      ],
    ]);
  });

  test("materializes branch scopes and a limit basis from a coverage governor", () => {
    const first =
      "Zusätzlich sind im Rahmen der Feuer-, Sturm-, Leitungswasser-, Gebäude- und";
    const second =
      "Grundstückshaftpflichtversicherung bis zur Höhe der Gebäudeversicherungssumme mitversichert:";
    const item = "- Nebengebäude";
    const unit = {
      unitId: "coverage-branch-governed-item",
      unitKind: "LIST",
      source: {
        blockIds: ["item"],
        combinedText: item,
        blocks: [{ blockId: "item", exactText: item }],
      },
      governingContext: {
        blockIds: ["governor-one", "governor-two"],
        combinedText: [first, second].join("\n"),
        blocks: [
          { blockId: "governor-one", exactText: first },
          { blockId: "governor-two", exactText: second },
        ],
      },
      logicalSourceSegments: [],
    };
    const normalized = normalizeUnambiguousComponentTypes(
      [
        {
          unitId: unit.unitId,
          primaryClass: "INSURED_OBJECT",
          semanticClasses: ["INSURED_OBJECT"],
          requirements: [
            {
              displayLabel: item,
              components: [
                {
                  type: "OBJECT",
                  label: "Nebengebäude",
                  sourceBlockIds: ["item"],
                },
                {
                  type: "COVERAGE_EFFECT",
                  label: "mitversichert",
                  coverageEffect: "INCLUDED",
                  sourceBlockIds: ["governor-two"],
                },
              ],
            },
          ],
        },
      ],
      [unit]
    );
    const components = normalized.responses[0].requirements[0].components;

    expect(normalized.responses[0].semanticClasses).toEqual([
      "INSURED_OBJECT",
      "LIMIT",
      "VARIANT",
    ]);
    expect(
      components
        .filter(({ type }) => type === "SCOPE")
        .map(({ label }) => label)
    ).toEqual([
      "Feuer-",
      "Sturm-",
      "Leitungswasser-",
      "Gebäude-",
      "Grundstückshaftpflichtversicherung",
    ]);
    expect(components).toContainEqual({
      type: "LIMIT_BASIS",
      label: "bis zur Höhe der Gebäudeversicherungssumme",
      sourceBlockIds: ["governor-two"],
    });
  });

  test("normalizes slash-separated branch scopes before a quantified governor limit", () => {
    const first =
      "Zusätzlich im Rahmen der Feuer- / Sturm- und Leitungswasserversicherung sind mitversichert bis zu";
    const second =
      "jeweils l0% der Gebäudeversicherungssumme auf ,,Erstes Risiko“:";
    const source = [first, second].join("\n");
    const unit = {
      unitId: "quantified-coverage-branch-governor",
      unitKind: "CLAUSE",
      source: {
        blockIds: ["governor-one", "governor-two"],
        combinedText: source,
        blocks: [
          { blockId: "governor-one", exactText: first },
          { blockId: "governor-two", exactText: second },
        ],
      },
      logicalSourceSegments: [],
    };
    const normalized = normalizeUnambiguousComponentTypes(
      [
        {
          unitId: unit.unitId,
          primaryClass: "OPERATIVE_COVERAGE_STATEMENT",
          semanticClasses: ["OPERATIVE_COVERAGE_STATEMENT"],
          requirements: [
            {
              displayLabel: source,
              components: [
                {
                  type: "OBJECT",
                  label: "Feuer- / Sturm- und Leitungswasserversicherung",
                  sourceBlockIds: ["governor-one"],
                },
                {
                  type: "COVERAGE_EFFECT",
                  label: "mitversichert",
                  coverageEffect: "INCLUDED",
                  sourceBlockIds: ["governor-one"],
                },
                {
                  type: "SCOPE",
                  label: "Feuer- / Sturm- und Leitungswasserversicherung",
                  sourceBlockIds: ["governor-one"],
                },
                {
                  type: "VALUE_AND_UNIT",
                  label: "bis zu jeweils l0%",
                  rawValue: "l0%",
                  sourceBlockIds: ["governor-one", "governor-two"],
                },
                {
                  type: "LIMIT_BASIS",
                  label: "der Gebäudeversicherungssumme auf ,,Erstes Risiko“",
                  sourceBlockIds: ["governor-two"],
                },
              ],
            },
          ],
        },
      ],
      [unit]
    );
    const components = normalized.responses[0].requirements[0].components;

    expect(components.some(({ type }) => type === "OBJECT")).toBe(false);
    expect(
      components
        .filter(({ type }) => type === "SCOPE")
        .map(({ label }) => label)
    ).toEqual(["Feuer-", "Sturm-", "Leitungswasserversicherung"]);
    expect(components).toContainEqual({
      type: "VALUE_AND_UNIT",
      label: "bis zu\njeweils l0%",
      rawValue: "l0",
      unit: "%",
      sourceBlockIds: ["governor-one", "governor-two"],
    });
    expect(components).toContainEqual({
      type: "LIMIT_BASIS",
      label: "der Gebäudeversicherungssumme auf ,,Erstes Risiko“",
      sourceBlockIds: ["governor-two"],
    });
    expect(normalized.componentRepairs).toContainEqual({
      unitId: unit.unitId,
      requirementIndex: 0,
      action: "NORMALIZE_COVERAGE_BRANCH_GOVERNOR_ROLES",
      scopes: 3,
      removedObjectComponents: 1,
      removedScopeComponents: 1,
      removedEquivalentGovernorComponents: 2,
    });
  });

  test.each([
    "die tatsächlichen Kosten für Ersatzräumlichkeiten",
    "Kosten für ein Hotelzimmer",
  ])("maps a non-physical cost role out of OBJECT: %s", (label) => {
    const unit = {
      unitId: "non-physical-cost",
      source: {
        blockIds: ["cost"],
        combinedText: label,
        blocks: [{ blockId: "cost", exactText: label }],
      },
    };
    const normalized = normalizeUnambiguousComponentTypes(
      [
        {
          unitId: unit.unitId,
          primaryClass: "INSURED_OBJECT",
          semanticClasses: ["INSURED_OBJECT"],
          requirements: [
            {
              displayLabel: label,
              components: [{ type: "OBJECT", label, sourceBlockIds: ["cost"] }],
            },
          ],
        },
      ],
      [unit]
    );

    expect(normalized.responses[0]).toMatchObject({
      primaryClass: "COST",
      semanticClasses: ["COST"],
    });
    expect(normalized.responses[0].requirements[0].components[0]).toMatchObject(
      {
        type: "FACT_ROLE",
        label,
      }
    );
  });

  test("maps cost-purpose pseudo objects to their operative roles", () => {
    const source =
      "Kosten für Planung und Tätigkeiten, die für den Wiederaufbau nach einem ersatzpflichtigen Schaden erforderlich sind.";
    const unit = {
      unitId: "cost-purpose-roles",
      source: {
        blockIds: ["block"],
        combinedText: source,
        blocks: [{ blockId: "block", exactText: source }],
      },
    };
    const normalized = normalizeUnambiguousComponentTypes(
      [
        {
          unitId: unit.unitId,
          primaryClass: "COST",
          semanticClasses: ["COST"],
          requirements: [
            {
              displayLabel: source,
              components: [
                {
                  type: "FACT_ROLE",
                  label: "Kosten für Planung",
                  sourceBlockIds: ["block"],
                },
                {
                  type: "OBJECT",
                  label: "Tätigkeiten",
                  sourceBlockIds: ["block"],
                },
                {
                  type: "OBJECT",
                  label:
                    "Wiederaufbau nach einem ersatzpflichtigen Schaden erforderlich sind",
                  sourceBlockIds: ["block"],
                },
              ],
            },
          ],
        },
      ],
      [unit]
    );

    expect(
      normalized.responses[0].requirements[0].components.map(({ type }) => type)
    ).toEqual(["FACT_ROLE", "FACT_ROLE", "CONDITION"]);
  });

  test.each([
    {
      source:
        "- Mehrkosten für bauliche Verbesserungen - das sind Kosten, die sich anlässlich der Wiederherstellung von Gebäuden  und/oder Betriebseinrichtung nach einem ersatzpflichtigen Schaden auf Grund gelinderter gesetzlicher, baupolizeilicher oder technischer Vorschriften, Anlagenteile gänzlich oder teilweise zu erneuern oder zusätzlich neu herzustellen, ergeben;",
      modelLabel:
        "- Mehrkosten für bauliche Verbesserungen - das sind Kosten, die sich anlässlich der Wiederherstellung von Gebäuden und/oder Betriebseinrichtung nach einem ersatzpflichtigen Schaden auf Grund gelinderter gesetzlicher, baupolizeilicher oder technischer Vorschriften, Anlagenteile gänzlich oder teilweise zu erneuern oder zusätzlich neu herzustellen, ergeben;",
      expected: [
        ["FACT_ROLE", "Mehrkosten für bauliche Verbesserungen"],
        ["FACT_ROLE", "das sind Kosten"],
        [
          "SCOPE",
          "Wiederherstellung von Gebäuden  und/oder Betriebseinrichtung",
        ],
        ["CONDITION", "nach einem ersatzpflichtigen Schaden"],
        [
          "CONDITION",
          "auf Grund gelinderter gesetzlicher, baupolizeilicher oder technischer Vorschriften",
        ],
        [
          "FACT_ROLE",
          "Anlagenteile gänzlich oder teilweise zu erneuern oder zusätzlich neu herzustellen, ergeben;",
        ],
      ],
    },
    {
      source:
        "- Mehrkosten für behördlich vorgeschriebene Verbesserungen - hierunter fallen Kosten, die sich anlässlich der Reparatur von versicherten Bauteilen bei einem gedeckten Schaden wegen geänderter öffentlich-rechtlicher Vorschriften, bestehende Bauteile vollständig zu ersetzen oder neu zu errichten, ergeben;",
      expected: [
        [
          "FACT_ROLE",
          "Mehrkosten für behördlich vorgeschriebene Verbesserungen",
        ],
        ["FACT_ROLE", "hierunter fallen Kosten"],
        ["SCOPE", "Reparatur von versicherten Bauteilen"],
        ["CONDITION", "bei einem gedeckten Schaden"],
        ["CONDITION", "wegen geänderter öffentlich-rechtlicher Vorschriften"],
        [
          "FACT_ROLE",
          "bestehende Bauteile vollständig zu ersetzen oder neu zu errichten, ergeben;",
        ],
      ],
    },
    {
      source:
        "- Mehrkosten infolge Preissteigerung zwischen dem Eintritt des Schadenereignisses und der Wiederherstellung oder Wiederbeschaffung entstandenen Erhöhung der Ersatzleistung;",
      expected: [
        ["FACT_ROLE", "Mehrkosten infolge Preissteigerung"],
        [
          "TEMPORAL_VALIDITY",
          "zwischen dem Eintritt des Schadenereignisses und der Wiederherstellung oder Wiederbeschaffung",
        ],
        ["FACT_ROLE", "Erhöhung der Ersatzleistung"],
      ],
    },
  ])(
    "splits broad cost roles into searchable atoms: $source",
    ({ source, modelLabel = source, expected }) => {
      const unit = {
        unitId: "broad-cost-role",
        source: {
          blockIds: ["block"],
          combinedText: source,
          blocks: [{ blockId: "block", exactText: source }],
        },
      };
      const normalized = normalizeUnambiguousComponentTypes(
        [
          {
            unitId: unit.unitId,
            primaryClass: "COST",
            semanticClasses: ["COST"],
            requirements: [
              {
                displayLabel: source,
                components: [
                  {
                    type: "FACT_ROLE",
                    label: modelLabel,
                    sourceBlockIds: ["block"],
                  },
                ],
              },
            ],
          },
        ],
        [unit]
      );

      expect(
        normalized.responses[0].requirements[0].components.map(
          ({ type, label }) => [type, label]
        )
      ).toEqual(expected);
    }
  );

  test("canonicalizes a pre-split cost definition across the whole requirement", () => {
    const source =
      "- Mehrkosten für bauliche Verbesserungen - das sind Kosten, die sich anlässlich der Wiederherstellung von Gebäuden und Betriebseinrichtung nach einem ersatzpflichtigen Schaden auf Grund gelinderter technischer Vorschriften, Anlagenteile teilweise zu erneuern oder neu herzustellen, ergeben;";
    const unit = {
      unitId: "pre-split-cost-definition",
      source: {
        blockIds: ["owned"],
        combinedText: source,
        blocks: [{ blockId: "owned", exactText: source }],
      },
      governingContext: {
        blockIds: ["governor"],
        combinedText: "mitversichert",
        blocks: [{ blockId: "governor", exactText: "mitversichert" }],
      },
    };
    const normalized = normalizeUnambiguousComponentTypes(
      [
        {
          unitId: unit.unitId,
          primaryClass: "COST",
          semanticClasses: ["COST"],
          requirements: [
            {
              displayLabel: source,
              components: [
                {
                  type: "FACT_ROLE",
                  label: "Mehrkosten für bauliche Verbesserungen",
                  sourceBlockIds: ["owned"],
                },
                {
                  type: "PERIL_OR_CAUSE",
                  label:
                    "Wiederherstellung von Gebäuden und Betriebseinrichtung nach einem ersatzpflichtigen Schaden",
                  sourceBlockIds: ["owned"],
                },
                {
                  type: "CONDITION",
                  label: "auf Grund gelinderter technischer Vorschriften",
                  sourceBlockIds: ["owned"],
                },
                {
                  type: "OBJECT",
                  label:
                    "Anlagenteile teilweise zu erneuern oder neu herzustellen, ergeben;",
                  sourceBlockIds: ["owned"],
                },
                {
                  type: "COVERAGE_EFFECT",
                  label: "mitversichert",
                  coverageEffect: "INCLUDED",
                  sourceBlockIds: ["governor"],
                },
              ],
            },
          ],
        },
      ],
      [unit]
    );

    expect(
      normalized.responses[0].requirements[0].components.map(
        ({ type, label }) => [type, label]
      )
    ).toEqual([
      ["FACT_ROLE", "Mehrkosten für bauliche Verbesserungen"],
      ["FACT_ROLE", "das sind Kosten"],
      ["SCOPE", "Wiederherstellung von Gebäuden und Betriebseinrichtung"],
      ["CONDITION", "nach einem ersatzpflichtigen Schaden"],
      ["CONDITION", "auf Grund gelinderter technischer Vorschriften"],
      [
        "FACT_ROLE",
        "Anlagenteile teilweise zu erneuern oder neu herzustellen, ergeben;",
      ],
      ["COVERAGE_EFFECT", "mitversichert"],
    ]);
  });

  test("does not atomize a cost statement without a definition structure", () => {
    const source = "Mehrkosten für Umbauten werden nicht ersetzt;";
    const unit = {
      unitId: "non-definition-cost-role",
      source: {
        blockIds: ["block"],
        combinedText: source,
        blocks: [{ blockId: "block", exactText: source }],
      },
    };
    const normalized = normalizeUnambiguousComponentTypes(
      [
        {
          unitId: unit.unitId,
          primaryClass: "COST",
          semanticClasses: ["COST"],
          requirements: [
            {
              displayLabel: source,
              components: [
                {
                  type: "FACT_ROLE",
                  label: source,
                  sourceBlockIds: ["block"],
                },
              ],
            },
          ],
        },
      ],
      [unit]
    );

    expect(
      normalized.responses[0].requirements[0].components.map(
        ({ type, label }) => [type, label]
      )
    ).toEqual([["FACT_ROLE", source]]);
  });

  test.each([
    {
      blocks: [
        {
          blockId: "first",
          exactText:
            "Eine im Inneren eines Behälters durch chemische Umsetzung hervorgerufene Explosion gilt auch ",
        },
        {
          blockId: "second",
          exactText:
            "dann als Explosion, wenn die Wandung des Behälters nicht zerrissen ist; ",
        },
      ],
      domainType: "PERIL_OR_CAUSE",
      modelLabel: "Explosion",
      expected: [
        [
          "PERIL_OR_CAUSE",
          "Eine im Inneren eines Behälters durch chemische Umsetzung hervorgerufene Explosion",
        ],
        ["FACT_ROLE", "gilt auch \ndann als Explosion"],
        ["CONDITION", "wenn die Wandung des Behälters nicht zerrissen ist;"],
      ],
    },
    {
      blocks: [
        {
          blockId: "only",
          exactText:
            "Eine durch elektrische Entladung hervorgerufene Beschädigung gilt auch dann als Sachschaden, wenn kein Brand entsteht;",
        },
      ],
      domainType: "DAMAGE_OR_EFFECT",
      modelLabel: "Sachschaden",
      expected: [
        [
          "DAMAGE_OR_EFFECT",
          "Eine durch elektrische Entladung hervorgerufene Beschädigung",
        ],
        ["FACT_ROLE", "gilt auch dann als Sachschaden"],
        ["CONDITION", "wenn kein Brand entsteht;"],
      ],
    },
  ])(
    "canonicalizes a conditional equivalence definition: $modelLabel",
    ({ blocks, domainType, modelLabel, expected }) => {
      const combinedText = blocks.map(({ exactText }) => exactText).join("\n");
      const unit = {
        unitId: "conditional-equivalence-definition",
        unitKind: "CLAUSE",
        structurePath: [],
        source: {
          blockIds: blocks.map(({ blockId }) => blockId),
          combinedText,
          blocks,
        },
      };
      const normalized = normalizeUnambiguousComponentTypes(
        [
          {
            unitId: unit.unitId,
            primaryClass: "PERIL_OR_DAMAGE",
            semanticClasses: ["PERIL_OR_DAMAGE"],
            requirements: [
              {
                displayLabel: combinedText,
                components: [
                  {
                    type: domainType,
                    label: modelLabel,
                    sourceBlockIds: blocks.map(({ blockId }) => blockId),
                  },
                ],
              },
            ],
          },
        ],
        [unit]
      );

      expect(normalized.responses[0].semanticClasses).toEqual([
        "PERIL_OR_DAMAGE",
        "DEFINITION",
        "CONDITION",
      ]);
      expect(
        normalized.responses[0].requirements[0].components.map(
          ({ type, label }) => [type, label]
        )
      ).toEqual(expected);
    }
  );

  test("leaves a non-equivalence peril statement unchanged", () => {
    const source = "Eine Explosion gilt nicht als Brand;";
    const unit = {
      unitId: "non-equivalence-peril",
      source: {
        blockIds: ["block"],
        combinedText: source,
        blocks: [{ blockId: "block", exactText: source }],
      },
    };
    const normalized = normalizeUnambiguousComponentTypes(
      [
        {
          unitId: unit.unitId,
          primaryClass: "PERIL_OR_DAMAGE",
          semanticClasses: ["PERIL_OR_DAMAGE"],
          requirements: [
            {
              displayLabel: source,
              components: [
                {
                  type: "PERIL_OR_CAUSE",
                  label: "Explosion",
                  sourceBlockIds: ["block"],
                },
              ],
            },
          ],
        },
      ],
      [unit]
    );

    expect(normalized.responses[0].requirements[0].components).toEqual([
      {
        type: "PERIL_OR_CAUSE",
        label: "Explosion",
        sourceBlockIds: ["block"],
      },
    ]);
  });

  test("types list items governed by insured damages as causes or damages", () => {
    const source = "Verrußung\ndie Energie des elektrischen Stromes";
    const unit = {
      unitId: "damage-cause-list",
      source: {
        blockIds: ["soot", "electricity"],
        combinedText: source,
        blocks: [
          { blockId: "soot", exactText: "Verrußung" },
          {
            blockId: "electricity",
            exactText: "die Energie des elektrischen Stromes",
          },
        ],
      },
      governingContext: {
        blockIds: ["governor"],
        combinedText: "Zusätzlich versichert sind Schäden durch",
        blocks: [
          {
            blockId: "governor",
            exactText: "Zusätzlich versichert sind Schäden durch",
          },
        ],
      },
    };
    const normalized = normalizeUnambiguousComponentTypes(
      [
        {
          unitId: unit.unitId,
          primaryClass: "INSURED_OBJECT",
          semanticClasses: ["INSURED_OBJECT"],
          requirements: [
            {
              displayLabel: "Verrußung",
              components: [
                {
                  type: "OBJECT",
                  label: "Verrußung",
                  sourceBlockIds: ["soot"],
                },
              ],
            },
            {
              displayLabel: "die Energie des elektrischen Stromes",
              components: [
                {
                  type: "OBJECT",
                  label: "die Energie des elektrischen Stromes",
                  sourceBlockIds: ["electricity"],
                },
              ],
            },
          ],
        },
      ],
      [unit]
    );

    expect(normalized.responses[0]).toMatchObject({
      primaryClass: "PERIL_OR_DAMAGE",
      semanticClasses: [
        "PERIL_OR_DAMAGE",
        "OPERATIVE_COVERAGE_STATEMENT",
      ],
    });
    expect(
      normalized.responses[0].requirements.map(({ components }) =>
        components.map(({ type }) => type)
      )
    ).toEqual([
      ["DAMAGE_OR_EFFECT", "COVERAGE_EFFECT"],
      ["PERIL_OR_CAUSE", "COVERAGE_EFFECT"],
    ]);
    expect(
      normalized.responses[0].requirements.map(({ components }) =>
        components.at(-1)
      )
    ).toEqual([
      {
        type: "COVERAGE_EFFECT",
        label: "versichert sind",
        sourceBlockIds: ["governor"],
        coverageEffect: "INCLUDED",
      },
      {
        type: "COVERAGE_EFFECT",
        label: "versichert sind",
        sourceBlockIds: ["governor"],
        coverageEffect: "INCLUDED",
      },
    ]);
  });

  test("repairs an already peril-typed damage and materializes one inherited effect per item", () => {
    const unit = {
      unitId: "interrupted-damage-cause-list",
      source: {
        blockIds: ["blast", "cable"],
        combinedText: "• Sprengstoffexplosion\n• Kabelschmorschäden",
        blocks: [
          { blockId: "blast", exactText: "• Sprengstoffexplosion" },
          { blockId: "cable", exactText: "• Kabelschmorschäden" },
        ],
      },
      governingContext: {
        relationType: "RECOVERS_INTERRUPTED_LIST_GOVERNOR",
        unitIds: ["governor"],
        blockIds: ["governor-block"],
        combinedText: "Versichert sind Schäden durch",
        blocks: [
          {
            blockId: "governor-block",
            exactText: "Versichert sind Schäden durch",
          },
        ],
      },
    };
    const response = {
      unitId: unit.unitId,
      primaryClass: "PERIL_OR_DAMAGE",
      semanticClasses: ["PERIL_OR_DAMAGE"],
      requirements: [
        {
          displayLabel: "• Sprengstoffexplosion",
          components: [
            {
              type: "PERIL_OR_CAUSE",
              label: "Sprengstoffexplosion",
              sourceBlockIds: ["blast"],
            },
          ],
        },
        {
          displayLabel: "• Kabelschmorschäden",
          components: [
            {
              type: "PERIL_OR_CAUSE",
              label: "Kabelschmorschäden",
              sourceBlockIds: ["cable"],
            },
          ],
        },
      ],
    };

    const normalized = normalizeUnambiguousComponentTypes([response], [unit]);

    expect(normalized.responses[0].semanticClasses).toEqual([
      "PERIL_OR_DAMAGE",
      "OPERATIVE_COVERAGE_STATEMENT",
    ]);
    expect(
      normalized.responses[0].requirements.map(({ components }) =>
        components.map(({ type }) => type)
      )
    ).toEqual([
      ["PERIL_OR_CAUSE", "COVERAGE_EFFECT"],
      ["DAMAGE_OR_EFFECT", "COVERAGE_EFFECT"],
    ]);
    expect(
      normalized.responses[0].requirements.every(
        ({ components }) =>
          components.filter(({ type }) => type === "COVERAGE_EFFECT")
            .length === 1
      )
    ).toBe(true);
  });

  test("materializes an inherited exclusion without replacing an existing effect", () => {
    const unit = {
      unitId: "excluded-list",
      source: {
        blockIds: ["item-a", "item-b"],
        combinedText: "• Schäden A\n• Schäden B",
        blocks: [
          { blockId: "item-a", exactText: "• Schäden A" },
          { blockId: "item-b", exactText: "• Schäden B" },
        ],
      },
      governingContext: {
        unitIds: ["exclusion-governor"],
        blockIds: ["exclusion-block"],
        combinedText: "Nicht versichert sind",
        blocks: [
          { blockId: "exclusion-block", exactText: "Nicht versichert sind" },
        ],
      },
    };
    const existingEffect = {
      type: "COVERAGE_EFFECT",
      label: "Nicht versichert sind",
      sourceBlockIds: ["exclusion-block"],
      coverageEffect: "EXCLUDED",
    };
    const response = {
      unitId: unit.unitId,
      primaryClass: "PERIL_OR_DAMAGE",
      semanticClasses: ["PERIL_OR_DAMAGE"],
      requirements: [
        {
          displayLabel: "• Schäden A",
          components: [
            {
              type: "DAMAGE_OR_EFFECT",
              label: "Schäden A",
              sourceBlockIds: ["item-a"],
            },
          ],
        },
        {
          displayLabel: "• Schäden B",
          components: [
            {
              type: "DAMAGE_OR_EFFECT",
              label: "Schäden B",
              sourceBlockIds: ["item-b"],
            },
            existingEffect,
          ],
        },
      ],
    };

    const normalized = normalizeUnambiguousComponentTypes([response], [unit]);

    expect(normalized.responses[0].semanticClasses).toEqual([
      "PERIL_OR_DAMAGE",
      "EXCLUSION",
    ]);
    expect(
      normalized.responses[0].requirements.map(({ components }) =>
        components.filter(({ type }) => type === "COVERAGE_EFFECT")
      )
    ).toEqual([[existingEffect], [existingEffect]]);
  });

  test("terminalizes a pure governor only after its evidence is attached to consumers", () => {
    const governor = {
      unitId: "governor",
      unitKind: "CLAUSE",
      source: {
        blockIds: ["governor-block"],
        combinedText: "Zusätzlich versichert sind Schäden durch",
        blocks: [
          {
            blockId: "governor-block",
            exactText: "Zusätzlich versichert sind Schäden durch",
          },
        ],
      },
    };
    const consumer = {
      unitId: "consumer",
      unitKind: "LIST",
      source: {
        blockIds: ["consumer-block"],
        combinedText: "• Verrußung",
        blocks: [{ blockId: "consumer-block", exactText: "• Verrußung" }],
      },
      governingContext: {
        unitIds: [governor.unitId],
        blockIds: ["governor-block"],
        combinedText: governor.source.combinedText,
        blocks: governor.source.blocks,
      },
    };
    const response = {
      unitId: governor.unitId,
      primaryClass: "OPERATIVE_COVERAGE_STATEMENT",
      semanticClasses: ["OPERATIVE_COVERAGE_STATEMENT", "PERIL_OR_DAMAGE"],
      requirements: [
        {
          displayLabel: governor.source.combinedText,
          components: [
            {
              type: "COVERAGE_EFFECT",
              label: "versichert",
              coverageEffect: "INCLUDED",
              sourceBlockIds: ["governor-block"],
            },
            {
              type: "DAMAGE_OR_EFFECT",
              label: "Schäden",
              sourceBlockIds: ["governor-block"],
            },
          ],
        },
      ],
    };

    expect(
      normalizeUnambiguousComponentTypes([response], [governor, consumer])
        .responses[0]
    ).toEqual({
      unitId: governor.unitId,
      primaryClass: "DUPLICATE",
      semanticClasses: ["DUPLICATE"],
      requirements: [],
    });
    expect(
      normalizeUnambiguousComponentTypes([response], [governor]).responses[0]
    ).toEqual(response);
  });

  test("atomizes a named peril definition, explicit extension, and preserved right in one list requirement", () => {
    const source =
      "• Brand \n das ist ein Feuer, das sich bestimmungswidrig ausbreitet; Schäden durch Kaminbrand sind \nmitversichert. Das Regressrecht des Versicherers bleibt davon unberührt; ";
    const blocks = [
      { blockId: "heading", exactText: "• Brand " },
      {
        blockId: "definition",
        exactText:
          " das ist ein Feuer, das sich bestimmungswidrig ausbreitet; Schäden durch Kaminbrand sind ",
      },
      {
        blockId: "follow-up",
        exactText:
          "mitversichert. Das Regressrecht des Versicherers bleibt davon unberührt; ",
      },
    ];
    const unit = {
      unitId: "named-peril-with-follow-ups",
      unitKind: "LIST",
      source: {
        blockIds: blocks.map(({ blockId }) => blockId),
        combinedText: source,
        blocks,
      },
    };
    const normalized = normalizeUnambiguousComponentTypes(
      [
        {
          unitId: unit.unitId,
          primaryClass: "OPERATIVE_COVERAGE_STATEMENT",
          semanticClasses: ["PERIL_OR_DAMAGE", "OPERATIVE_COVERAGE_STATEMENT"],
          requirements: [
            {
              displayLabel: source,
              components: [
                {
                  type: "OBJECT",
                  label:
                    "Brand \n das ist ein Feuer, das sich bestimmungswidrig ausbreitet",
                  sourceBlockIds: ["heading", "definition"],
                },
                {
                  type: "COVERAGE_EFFECT",
                  label: "mitversichert",
                  coverageEffect: "INCLUDED",
                  sourceBlockIds: ["follow-up"],
                },
              ],
            },
          ],
        },
      ],
      [unit]
    );

    expect(normalized.responses[0].semanticClasses).toEqual([
      "PERIL_OR_DAMAGE",
      "OPERATIVE_COVERAGE_STATEMENT",
      "DEFINITION",
      "DOCUMENT_PRECEDENCE_OR_REPLACEMENT",
    ]);
    expect(
      normalized.responses[0].requirements.map(({ components }) =>
        components.map(({ type }) => type)
      )
    ).toEqual([
      [
        "PERIL_OR_CAUSE",
        "FACT_ROLE",
        "DAMAGE_OR_EFFECT",
        "COVERAGE_EFFECT",
        "PRECEDENCE_OR_REPLACEMENT",
      ],
    ]);
  });

  test("atomizes a named peril definition and scoped condition in one list requirement", () => {
    const source =
      "• Explosion \n ist eine auf Gasen beruhende Kraftäußerung. Eine Explosion (Zerbersten) eines Behälters (Kessel, Rohrleitungen) liegt nur vor, wenn seine Wandung zerrissen wird.";
    const unit = {
      unitId: "named-peril-with-condition",
      unitKind: "LIST",
      source: {
        blockIds: ["block"],
        combinedText: source,
        blocks: [{ blockId: "block", exactText: source }],
      },
    };
    const normalized = normalizeUnambiguousComponentTypes(
      [
        {
          unitId: unit.unitId,
          primaryClass: "PERIL_OR_DAMAGE",
          semanticClasses: ["PERIL_OR_DAMAGE"],
          requirements: [
            {
              displayLabel: source,
              components: [
                {
                  type: "PERIL_OR_CAUSE",
                  label: source,
                  sourceBlockIds: ["block"],
                },
              ],
            },
          ],
        },
      ],
      [unit]
    );

    expect(normalized.responses[0].semanticClasses).toEqual([
      "PERIL_OR_DAMAGE",
      "DEFINITION",
      "CONDITION",
      "VARIANT",
    ]);
    expect(
      normalized.responses[0].requirements.map(({ components }) =>
        components.map(({ type, label }) => [type, label])
      )
    ).toEqual([
      [
        ["PERIL_OR_CAUSE", "Explosion"],
        ["FACT_ROLE", "ist eine auf Gasen beruhende Kraftäußerung."],
        ["PERIL_OR_CAUSE", "Eine Explosion (Zerbersten)"],
        ["SCOPE", "eines Behälters (Kessel, Rohrleitungen)"],
        ["CONDITION", "liegt nur vor, wenn seine Wandung zerrissen wird."],
      ],
    ]);
  });

  test("separates a financial-loss role from its insured-object scope", () => {
    const label =
      "Mietverlust für privat und gewerblich genutzte Gebäudeeinheiten und –räume";
    const unit = {
      unitId: "financial-loss-scope",
      source: {
        blockIds: ["loss"],
        combinedText: label,
        blocks: [{ blockId: "loss", exactText: label }],
      },
    };
    const normalized = normalizeUnambiguousComponentTypes(
      [
        {
          unitId: unit.unitId,
          primaryClass: "INSURED_OBJECT",
          semanticClasses: ["INSURED_OBJECT"],
          requirements: [
            {
              displayLabel: label,
              components: [{ type: "OBJECT", label, sourceBlockIds: ["loss"] }],
            },
          ],
        },
      ],
      [unit]
    );

    expect(normalized.responses[0]).toMatchObject({
      primaryClass: "COST",
      semanticClasses: ["COST", "VARIANT"],
    });
    expect(normalized.responses[0].requirements[0].components).toEqual([
      { type: "FACT_ROLE", label: "Mietverlust", sourceBlockIds: ["loss"] },
      {
        type: "SCOPE",
        label: "für privat und gewerblich genutzte Gebäudeeinheiten und –räume",
        sourceBlockIds: ["loss"],
      },
    ]);
  });

  test("splits a coordinated cost list into independently searchable roles", () => {
    const label =
      "Sicherungs-, Aufräumungs-, Abbruch-, Feuerlösch-, De- und Remontage-, Bewegungs-, Schutz- und Reinigungskosten sowie Lagerkosten";
    const unit = {
      unitId: "coordinated-cost-roles",
      source: {
        blockIds: ["costs"],
        combinedText: label,
        blocks: [{ blockId: "costs", exactText: label }],
      },
    };
    const normalized = normalizeUnambiguousComponentTypes(
      [
        {
          unitId: unit.unitId,
          primaryClass: "INSURED_OBJECT",
          semanticClasses: ["INSURED_OBJECT"],
          requirements: [
            {
              displayLabel: label,
              components: [
                { type: "OBJECT", label, sourceBlockIds: ["costs"] },
              ],
            },
          ],
        },
      ],
      [unit]
    );

    expect(normalized.responses[0]).toMatchObject({
      primaryClass: "COST",
      semanticClasses: ["COST"],
    });
    expect(
      normalized.responses[0].requirements[0].components.map(
        ({ label }) => label
      )
    ).toEqual([
      "Sicherungs-",
      "Aufräumungs-",
      "Abbruch-",
      "Feuerlösch-",
      "De- und Remontage-",
      "Bewegungs-",
      "Schutz-",
      "Reinigungskosten",
      "Lagerkosten",
    ]);
    expect(
      normalized.responses[0].requirements[0].components.every(
        ({ type }) => type === "FACT_ROLE"
      )
    ).toBe(true);
  });

  test("splits OCR-bearing tiered limits into values, scope and basis", () => {
    const source =
      "Sicherungs- und Reinigungskosten bis zu maximal l0%, in der Feuerversicherung maximal 15%, der Gebäudeversicherungssumme auf ,,Erstes Risiko“;";
    const broadLimit =
      "bis zu maximal l0%, in der Feuerversicherung maximal 15%, der Gebäudeversicherungssumme";
    const firstRisk = "auf ,,Erstes Risiko“;";
    const unit = {
      unitId: "tiered-limit-basis",
      source: {
        blockIds: ["limit"],
        combinedText: source,
        blocks: [{ blockId: "limit", exactText: source }],
      },
    };
    const normalized = normalizeUnambiguousComponentTypes(
      [
        {
          unitId: unit.unitId,
          primaryClass: "COST",
          semanticClasses: ["COST"],
          requirements: [
            {
              displayLabel: source,
              components: [
                {
                  type: "FACT_ROLE",
                  label: "Sicherungs- und Reinigungskosten",
                  sourceBlockIds: ["limit"],
                },
                {
                  type: "LIMIT_BASIS",
                  label: broadLimit,
                  sourceBlockIds: ["limit"],
                },
                {
                  type: "SCOPE",
                  label: firstRisk,
                  sourceBlockIds: ["limit"],
                },
              ],
            },
          ],
        },
      ],
      [unit]
    );
    const components = normalized.responses[0].requirements[0].components;

    expect(normalized.responses[0]).toMatchObject({
      primaryClass: "COST",
      semanticClasses: ["COST", "LIMIT", "VARIANT"],
    });
    expect(components).toEqual([
      {
        type: "FACT_ROLE",
        label: "Sicherungs- und Reinigungskosten",
        sourceBlockIds: ["limit"],
      },
      {
        type: "VALUE_AND_UNIT",
        label: "bis zu maximal l0%",
        rawValue: "l0",
        unit: "%",
        sourceBlockIds: ["limit"],
      },
      {
        type: "VALUE_AND_UNIT",
        label: "maximal 15%",
        rawValue: "15",
        unit: "%",
        sourceBlockIds: ["limit"],
      },
      {
        type: "SCOPE",
        label: "in der Feuerversicherung",
        sourceBlockIds: ["limit"],
      },
      {
        type: "LIMIT_BASIS",
        label: "der Gebäudeversicherungssumme",
        sourceBlockIds: ["limit"],
      },
      { type: "LIMIT_BASIS", label: firstRisk, sourceBlockIds: ["limit"] },
    ]);
  });

  test("does not reinterpret a physical object merely because a cost follows", () => {
    const label = "Gebäude samt notwendigen Reparaturkosten";
    const unit = {
      unitId: "object-with-cost-qualifier",
      source: {
        blockIds: ["object"],
        combinedText: label,
        blocks: [{ blockId: "object", exactText: label }],
      },
    };
    const response = {
      unitId: unit.unitId,
      primaryClass: "INSURED_OBJECT",
      semanticClasses: ["INSURED_OBJECT"],
      requirements: [
        {
          displayLabel: label,
          components: [{ type: "OBJECT", label, sourceBlockIds: ["object"] }],
        },
      ],
    };

    expect(normalizeUnambiguousComponentTypes([response], [unit])).toEqual({
      responses: [response],
      componentRepairs: [],
    });
  });

  test("splits a terminal subsidiary clause into its own precedence requirement", () => {
    const condition =
      "Die Entschädigung wird nur insoweit geleistet, als die Wohnung unbenutzbar ist;";
    const precedence =
      "Diese Deckung gilt subsidiär zu einer bestehenden Haushaltsversicherung.";
    const source = [condition, precedence].join("\n");
    const unit = {
      unitId: "subsidiary-precedence",
      source: {
        blockIds: ["condition", "precedence"],
        combinedText: source,
        blocks: [
          { blockId: "condition", exactText: condition },
          { blockId: "precedence", exactText: precedence },
        ],
      },
    };
    const normalized = normalizeUnambiguousComponentTypes(
      [
        {
          unitId: unit.unitId,
          primaryClass: "CONDITION",
          semanticClasses: ["CONDITION"],
          requirements: [
            {
              displayLabel: source,
              components: [
                {
                  type: "CONDITION",
                  label: condition,
                  sourceBlockIds: ["condition"],
                },
                {
                  type: "CONDITION",
                  label: precedence,
                  sourceBlockIds: ["precedence"],
                },
              ],
            },
          ],
        },
      ],
      [unit]
    );

    expect(normalized.responses[0].semanticClasses).toEqual([
      "CONDITION",
      "DOCUMENT_PRECEDENCE_OR_REPLACEMENT",
    ]);
    expect(normalized.responses[0].requirements).toEqual([
      {
        displayLabel: condition,
        components: [
          {
            type: "CONDITION",
            label: condition,
            sourceBlockIds: ["condition"],
          },
        ],
      },
      {
        displayLabel: precedence,
        components: [
          {
            type: "PRECEDENCE_OR_REPLACEMENT",
            label: precedence,
            sourceBlockIds: ["precedence"],
          },
        ],
      },
    ]);
  });

  test("moves a pure first-risk scope into the limit basis", () => {
    const label = "auf ,,Erstes Risiko“;";
    const unit = {
      unitId: "first-risk-basis",
      source: {
        blockIds: ["basis"],
        combinedText: label,
        blocks: [{ blockId: "basis", exactText: label }],
      },
    };
    const normalized = normalizeUnambiguousComponentTypes(
      [
        {
          unitId: unit.unitId,
          primaryClass: "VARIANT",
          semanticClasses: ["VARIANT"],
          requirements: [
            {
              displayLabel: label,
              components: [{ type: "SCOPE", label, sourceBlockIds: ["basis"] }],
            },
          ],
        },
      ],
      [unit]
    );

    expect(normalized.responses[0]).toMatchObject({
      primaryClass: "LIMIT",
      semanticClasses: ["LIMIT"],
    });
    expect(normalized.responses[0].requirements[0].components).toEqual([
      { type: "LIMIT_BASIS", label, sourceBlockIds: ["basis"] },
    ]);
  });

  test("restores an exact source-bound condition when a model omits connective source text", () => {
    const unit = {
      unitId: "unit-one",
      unitKind: "CLAUSE",
      source: {
        combinedText:
          "Die Kosten sind unter der Voraussetzung versichert, dass sie angezeigt werden;",
        blocks: [
          {
            blockId: "condition-one",
            structuralKind: "PARAGRAPH",
            exactText: "Die Kosten sind unter der Voraussetzung",
          },
          {
            blockId: "condition-two",
            structuralKind: "PARAGRAPH",
            exactText: "versichert, dass sie angezeigt werden;",
          },
        ],
      },
      logicalSourceSegments: [],
    };
    const response = {
      unitId: unit.unitId,
      requirements: [
        {
          displayLabel: unit.source.combinedText,
          components: [
            {
              type: "CONDITION",
              label: "unter der Voraussetzung dass sie angezeigt werden;",
              sourceBlockIds: ["condition-one", "condition-two"],
            },
          ],
        },
      ],
    };

    const normalized = normalizeUnambiguousComponentTypes([response], [unit]);

    expect(normalized.responses[0].requirements[0].components[0].label).toBe(
      "unter der Voraussetzung\nversichert, dass sie angezeigt werden;"
    );
    expect(normalized.componentRepairs).toEqual([
      expect.objectContaining({
        unitId: "unit-one",
        action: "RESTORE_EXACT_CONDITION_SOURCE_TEXT",
      }),
    ]);
  });

  test("adds a uniquely required adjacent source block to a split component", () => {
    const unit = {
      unitId: "unit-one",
      unitKind: "CLAUSE",
      source: {
        combinedText:
          "Kosten der Wiederauffüllung der Aushubgrube mit\nErdreich",
        blocks: [
          {
            blockId: "cost-one",
            structuralKind: "PARAGRAPH",
            exactText: "Kosten der Wiederauffüllung der Aushubgrube mit",
          },
          {
            blockId: "cost-two",
            structuralKind: "PARAGRAPH",
            exactText: "Erdreich",
          },
        ],
      },
      logicalSourceSegments: [],
    };
    const response = {
      unitId: unit.unitId,
      requirements: [
        {
          displayLabel: unit.source.combinedText,
          components: [
            {
              type: "FACT_ROLE",
              label: unit.source.combinedText,
              sourceBlockIds: ["cost-one"],
            },
          ],
        },
      ],
    };

    const normalized = normalizeUnambiguousComponentTypes([response], [unit]);

    expect(
      normalized.responses[0].requirements[0].components[0].sourceBlockIds
    ).toEqual(["cost-one", "cost-two"]);
    expect(normalized.componentRepairs).toEqual([
      expect.objectContaining({
        unitId: "unit-one",
        action: "RESTORE_COMPONENT_SOURCE_BLOCK_IDS",
        fromSourceBlockIds: ["cost-one"],
        toSourceBlockIds: ["cost-one", "cost-two"],
      }),
    ]);
  });

  test("materializes a cost fact role without removing its object role", () => {
    const unit = {
      unitId: "unit-one",
      unitKind: "CLAUSE",
      source: {
        combinedText: "Kosten für Planung; eine kosten- oder zeitsparende Art",
        blocks: [
          {
            blockId: "cost",
            structuralKind: "PARAGRAPH",
            exactText: "Kosten für Planung",
          },
          {
            blockId: "adjective",
            structuralKind: "PARAGRAPH",
            exactText: "eine kosten- oder zeitsparende Art",
          },
        ],
      },
      logicalSourceSegments: [],
    };
    const result = materializeSharedSignalComponents(unit, [
      {
        displayLabel: unit.source.combinedText,
        sourceBlockIds: ["cost", "adjective"],
        components: [
          {
            type: "OBJECT",
            label: "Kosten für Planung",
            sourceBlockIds: ["cost"],
          },
          {
            type: "OBJECT",
            label: "eine kosten- oder zeitsparende Art",
            sourceBlockIds: ["adjective"],
          },
        ],
      },
    ]);

    expect(result.requirements[0].components.map(({ type }) => type)).toEqual([
      "OBJECT",
      "OBJECT",
      "FACT_ROLE",
    ]);
    expect(result.requirements[0].components[2]).toEqual({
      type: "FACT_ROLE",
      label: "Kosten für Planung",
      sourceBlockIds: ["cost"],
    });
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        unitId: "unit-one",
        code: "LOCAL_SIGNAL_COMPONENT_MATERIALIZED",
        signalId: "EXPLICIT_COST_ROLE",
      }),
    ]);
  });

  test("restores source-bound positive coverage polarity and its primary class", () => {
    const unit = {
      unitId: "unit-one",
      unitKind: "LIST",
      source: {
        combinedText: "Verrußung",
        blocks: [
          {
            blockId: "item",
            structuralKind: "LIST_ITEM",
            exactText: "Verrußung",
          },
        ],
      },
      governingContext: {
        blocks: [
          {
            blockId: "governor",
            structuralKind: "LIST_GOVERNOR",
            exactText: "Zusätzlich versichert sind Schäden durch",
          },
        ],
      },
      logicalSourceSegments: [],
    };
    const response = {
      unitId: unit.unitId,
      primaryClass: "EXCLUSION",
      semanticClasses: ["EXCLUSION", "PERIL_OR_DAMAGE"],
      requirements: [
        {
          displayLabel: "Verrußung",
          components: [
            {
              type: "PERIL_OR_CAUSE",
              label: "Verrußung",
              sourceBlockIds: ["item"],
            },
            {
              type: "COVERAGE_EFFECT",
              label: "ausgenommen sind",
              coverageEffect: "EXCLUDED",
              sourceBlockIds: ["governor"],
            },
          ],
        },
      ],
    };

    const normalized = normalizeUnambiguousComponentTypes([response], [unit]);
    const result = normalized.responses[0];

    expect(result.primaryClass).toBe("OPERATIVE_COVERAGE_STATEMENT");
    expect(result.semanticClasses).toEqual([
      "OPERATIVE_COVERAGE_STATEMENT",
      "PERIL_OR_DAMAGE",
    ]);
    expect(result.requirements[0].components[1]).toMatchObject({
      label: "Zusätzlich versichert sind",
      coverageEffect: "INCLUDED",
      sourceBlockIds: ["governor"],
    });
    expect(normalized.componentRepairs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "RESTORE_EXPLICIT_COVERAGE_EFFECT",
        }),
        expect.objectContaining({
          action: "NORMALIZE_POSITIVE_COVERAGE_PRIMARY_CLASS",
        }),
      ])
    );
  });

  test("hard-times out a hanging request, aborts it and records safe recovery", async () => {
    let lateResolve;
    let abortTriggered = false;
    const recoverModelAfterAbort = jest.fn(async (settlement) => ({
      status: "SAFE_RELOADED",
      ...settlement,
    }));
    const client = {
      chat: {
        completions: {
          create: jest.fn(
            (_payload, { signal }) =>
              new Promise((resolve) => {
                lateResolve = resolve;
                signal.addEventListener("abort", () => {
                  abortTriggered = true;
                });
              })
          ),
        },
      },
    };

    const request = requestCompletionWithTimeout({
      client,
      payload: { model: "qwen", messages: [] },
      requestTimeoutMs: 10,
      abortSettlementTimeoutMs: 5,
      recoverModelAfterAbort,
    });

    await expect(request).rejects.toMatchObject({
      errorClass: "MODEL_REQUEST_TIMEOUT",
      retrySafe: true,
      telemetry: expect.objectContaining({
        timedOut: true,
        timeoutMs: 10,
        abortTriggered: true,
        requestSettledAfterAbort: false,
        recovery: expect.objectContaining({ status: "SAFE_RELOADED" }),
      }),
    });
    expect(abortTriggered).toBe(true);
    expect(recoverModelAfterAbort).toHaveBeenCalledTimes(1);
    lateResolve({ choices: [{ message: { content: "late" } }] });
  });

  test("starts a retry only after safe settlement and ignores the late response", async () => {
    const source = artifact(["Seite 1\nVersichert sind Gebäude.\n"], "6");
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const batch = buildADrivenClassificationBatches(plan).batches[0];
    const valid = batch.expectedUnitIds.map((unitId) =>
      validResponse(plan.units.find((unit) => unit.unitId === unitId))
    );
    let lateResolve;
    let releaseRecovery;
    let signalRecoveryStarted;
    const recoveryStarted = new Promise((resolve) => {
      signalRecoveryStarted = resolve;
    });
    const recoverModelAfterAbort = jest.fn(
      () =>
        new Promise((resolve) => {
          signalRecoveryStarted();
          releaseRecovery = () => resolve({ status: "SAFE_RELOADED" });
        })
    );
    const client = {
      chat: {
        completions: {
          create: jest.fn((_payload, options) => {
            if (client.chat.completions.create.mock.calls.length === 1)
              return new Promise((resolve) => {
                lateResolve = resolve;
                options.signal.addEventListener("abort", () => {});
              });
            return Promise.resolve({
              model: "qwen/qwen3.6-35b-a3b",
              choices: [{ message: { content: JSON.stringify(valid) } }],
              usage: {},
            });
          }),
        },
      },
    };

    const running = runBatch({
      client,
      model: "qwen/qwen3.6-35b-a3b",
      modelContext: 42_496,
      plan,
      batch,
      maximumAttempts: 2,
      requestTimeoutMs: 10,
      abortSettlementTimeoutMs: 5,
      recoverModelAfterAbort,
    });
    await recoveryStarted;
    expect(recoverModelAfterAbort).toHaveBeenCalledTimes(1);
    expect(client.chat.completions.create).toHaveBeenCalledTimes(1);

    lateResolve({
      model: "stale-model-response",
      choices: [{ message: { content: "[]" } }],
      usage: {},
    });
    await new Promise((resolve) => setImmediate(resolve));
    expect(client.chat.completions.create).toHaveBeenCalledTimes(1);
    releaseRecovery();

    const result = await running;
    expect(client.chat.completions.create).toHaveBeenCalledTimes(2);
    expect(result.validation.passed).toBe(true);
    expect(result.responses).toEqual(valid);
    expect(result.attempts[0]).toMatchObject({
      errorClass: "MODEL_REQUEST_TIMEOUT",
      timedOut: true,
      abortTriggered: true,
      validationPassed: false,
    });
    expect(result.attempts[1]).toMatchObject({
      errorClass: null,
      timedOut: false,
      validationPassed: true,
    });
  });

  test("splits a timed-out parent batch deterministically and passes only after every unit is merged", async () => {
    const source = artifact(
      [
        "Seite 1\nVersichert sind Gebäude.\n\nVersichert sind Nebengebäude.\n\nVersichert sind Garagen.\n\nVersichert sind Carports.\n",
      ],
      "b"
    );
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const batch = buildADrivenClassificationBatches(plan, {
      maximumUnits: 4,
      maximumCharacters: 12_000,
    }).batches[0];
    expect(batch.expectedUnitIds).toHaveLength(4);
    const requested = [];
    const client = {
      chat: {
        completions: {
          create: jest.fn(({ messages }) => {
            const input = JSON.parse(
              messages.find(({ role }) => role === "user").content
            );
            requested.push(input.expectedUnitIds);
            if (requested.length === 1) return new Promise(() => {});
            return Promise.resolve({
              model: "qwen/qwen3.6-35b-a3b",
              choices: [
                {
                  message: {
                    content: JSON.stringify(
                      input.expectedUnitIds.map((unitId) =>
                        validResponse(
                          plan.units.find((unit) => unit.unitId === unitId)
                        )
                      )
                    ),
                  },
                },
              ],
              usage: {},
            });
          }),
        },
      },
    };

    const result = await runBatch({
      client,
      model: "qwen/qwen3.6-35b-a3b",
      modelContext: 42_496,
      plan,
      batch,
      maximumAttempts: 3,
      requestTimeoutMs: 10,
      abortSettlementTimeoutMs: 5,
      recoverModelAfterAbort: jest.fn(async () => ({
        status: "SAFE_RELOADED",
      })),
    });

    expect(result.validation.passed).toBe(true);
    expect(result.responses).toHaveLength(batch.expectedUnitIds.length);
    expect(requested[0]).toEqual(batch.expectedUnitIds);
    expect(requested[1]).toEqual(
      result.attempts[0].timeoutRetryPartition.retryUnitIds
    );
    expect(requested[2]).toEqual(
      result.attempts[0].timeoutRetryPartition.deferredUnitIds
    );
    expect(new Set(requested.slice(1).flat())).toEqual(
      new Set(batch.expectedUnitIds)
    );
    expect(result.attempts.at(-1).validationPassed).toBe(true);
  });

  test("repairs only JSON syntax before validating the semantic response", async () => {
    const source = artifact(["Seite 1\nVersichert sind Gebäude.\n"], "9");
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const batch = buildADrivenClassificationBatches(plan).batches[0];
    const valid = batch.expectedUnitIds.map((unitId) =>
      validResponse(plan.units.find((unit) => unit.unitId === unitId))
    );
    const validJson = JSON.stringify(valid);
    const malformedJson = `${validJson.slice(0, -1)}}]`;
    const client = {
      chat: {
        completions: {
          create: jest.fn(async () => ({
            model: "qwen/qwen3.6-35b-a3b",
            choices: [{ message: { content: malformedJson } }],
            usage: {},
          })),
        },
      },
    };

    const result = await runBatch({
      client,
      model: "qwen/qwen3.6-35b-a3b",
      modelContext: 42_496,
      plan,
      batch,
      maximumAttempts: 2,
    });

    expect(result.validation.passed).toBe(true);
    expect(client.chat.completions.create).toHaveBeenCalledTimes(1);
    expect(result.attempts[0]).toMatchObject({
      errorClass: null,
      validationPassed: true,
      syntaxRepair: expect.objectContaining({
        applied: true,
        originalResponseSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
        repairedResponseSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      }),
    });
  });

  test("repairs a prematurely closed requirements envelope before semantic validation", async () => {
    const source = artifact(
      ["Seite 1\n• Sprengstoffexplosion;\n• Blitzschlag;\n"],
      "a"
    );
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const batch = buildADrivenClassificationBatches(plan).batches[0];
    const unit = plan.units.find(
      ({ unitId }) => unitId === batch.expectedUnitIds[0]
    );
    const response = {
      unitId: unit.unitId,
      primaryClass: "PERIL_OR_DAMAGE",
      semanticClasses: ["PERIL_OR_DAMAGE"],
      requirements: unit.logicalSourceSegments.map((segment) => ({
        displayLabel: segment.combinedText,
        components: [
          {
            type: "PERIL_OR_CAUSE",
            label: segment.combinedText,
            sourceBlockIds: segment.blockIds,
          },
        ],
      })),
    };
    const validJson = JSON.stringify([response]);
    const malformedJson = validJson.replace(
      /\]\},\{"displayLabel"/u,
      ']}]},{"displayLabel"'
    );
    expect(malformedJson).not.toBe(validJson);
    const client = {
      chat: {
        completions: {
          create: jest.fn(async () => ({
            model: "qwen/qwen3.6-35b-a3b",
            choices: [{ message: { content: malformedJson } }],
            usage: {},
          })),
        },
      },
    };

    const result = await runBatch({
      client,
      model: "qwen/qwen3.6-35b-a3b",
      modelContext: 42_496,
      plan,
      batch,
      maximumAttempts: 1,
    });

    expect(result.validation.passed).toBe(true);
    expect(result.responses).toEqual([response]);
    expect(result.attempts[0].syntaxRepair).toMatchObject({
      applied: true,
      strategy: "PREMATURE_REQUIREMENTS_ARRAY_CLOSE",
    });
  });

  test("merges compatible duplicate unit envelopes before semantic validation", async () => {
    const source = artifact(
      ["Seite 1\n• Sprengstoffexplosion;\n• Blitzschlag;\n"],
      "b"
    );
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const batch = buildADrivenClassificationBatches(plan).batches[0];
    const unit = plan.units.find(
      ({ unitId }) => unitId === batch.expectedUnitIds[0]
    );
    const duplicateEnvelopes = unit.logicalSourceSegments.map((segment) => ({
      unitId: unit.unitId,
      primaryClass: "PERIL_OR_DAMAGE",
      semanticClasses: ["PERIL_OR_DAMAGE"],
      requirements: [
        {
          displayLabel: segment.combinedText,
          components: [
            {
              type: "PERIL_OR_CAUSE",
              label: segment.combinedText,
              sourceBlockIds: segment.blockIds,
            },
          ],
        },
      ],
    }));
    const client = {
      chat: {
        completions: {
          create: jest.fn(async () => ({
            model: "qwen/qwen3.6-35b-a3b",
            choices: [
              { message: { content: JSON.stringify(duplicateEnvelopes) } },
            ],
            usage: {},
          })),
        },
      },
    };

    const result = await runBatch({
      client,
      model: "qwen/qwen3.6-35b-a3b",
      modelContext: 42_496,
      plan,
      batch,
      maximumAttempts: 1,
    });

    expect(result.validation.passed).toBe(true);
    expect(result.responses).toHaveLength(1);
    expect(result.responses[0].requirements).toHaveLength(2);
    expect(result.attempts[0].envelopeRepair).toEqual({
      applied: true,
      strategy: "COMPATIBLE_DUPLICATE_UNIT_ENVELOPES",
      mergedUnitIds: [unit.unitId],
    });
  });

  test("normalizes only an exclusion terminal used as a component type", async () => {
    const source = artifact(
      ["Seite 1\nNicht versichert sind Treibhäuser.\n"],
      "c"
    );
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const batch = buildADrivenClassificationBatches(plan).batches[0];
    const unit = plan.units.find(
      ({ unitId }) => unitId === batch.expectedUnitIds[0]
    );
    const response = {
      unitId: unit.unitId,
      primaryClass: "INSURED_OBJECT",
      semanticClasses: ["INSURED_OBJECT"],
      requirements: [
        {
          displayLabel: unit.source.combinedText,
          components: [
            {
              type: "OBJECT",
              label: "Treibhäuser",
              sourceBlockIds: unit.source.blockIds,
            },
            {
              type: "EXCLUSION",
              label: "Nicht versichert",
              sourceBlockIds: unit.source.blockIds,
            },
          ],
        },
      ],
    };
    const client = {
      chat: {
        completions: {
          create: jest.fn(async () => ({
            model: "qwen/qwen3.6-35b-a3b",
            choices: [{ message: { content: JSON.stringify([response]) } }],
            usage: {},
          })),
        },
      },
    };

    const result = await runBatch({
      client,
      model: "qwen/qwen3.6-35b-a3b",
      modelContext: 42_496,
      plan,
      batch,
      maximumAttempts: 1,
    });

    expect(result.validation.passed).toBe(true);
    expect(result.responses[0].requirements[0].components[1]).toMatchObject({
      type: "COVERAGE_EFFECT",
      coverageEffect: "EXCLUDED",
      label: "Nicht versichert",
    });
    expect(result.attempts[0].componentRepairs).toEqual([
      expect.objectContaining({
        unitId: unit.unitId,
        action: "NORMALIZE_COMPONENT_TYPE",
        fromType: "EXCLUSION",
        toType: "COVERAGE_EFFECT",
        coverageEffect: "EXCLUDED",
      }),
    ]);
  });

  test("drops a redundant applicability effect when a condition already owns it", async () => {
    const source = artifact(
      [
        "Seite 1\nVersichert sind Schäden; dafür gelten ausschließlich die Bestimmungen, sofern vereinbart.\n",
      ],
      "d"
    );
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const batch = buildADrivenClassificationBatches(plan).batches[0];
    const unit = plan.units.find(
      ({ unitId }) => unitId === batch.expectedUnitIds[0]
    );
    const response = {
      unitId: unit.unitId,
      primaryClass: "OPERATIVE_COVERAGE_STATEMENT",
      semanticClasses: ["OPERATIVE_COVERAGE_STATEMENT", "CONDITION"],
      requirements: [
        {
          displayLabel: unit.source.combinedText,
          components: [
            {
              type: "DAMAGE_OR_EFFECT",
              label: "Schäden",
              sourceBlockIds: unit.source.blockIds,
            },
            {
              type: "COVERAGE_EFFECT",
              label: "Versichert",
              sourceBlockIds: unit.source.blockIds,
              coverageEffect: "INCLUDED",
            },
            {
              type: "CONDITION",
              label: "sofern vereinbart",
              sourceBlockIds: unit.source.blockIds,
            },
            {
              type: "COVERAGE_EFFECT",
              label: "gelten ausschließlich die Bestimmungen",
              sourceBlockIds: unit.source.blockIds,
              coverageEffect: "CONDITIONAL",
            },
          ],
        },
      ],
    };
    const client = {
      chat: {
        completions: {
          create: jest.fn(async () => ({
            model: "qwen/qwen3.6-35b-a3b",
            choices: [{ message: { content: JSON.stringify([response]) } }],
            usage: {},
          })),
        },
      },
    };

    const result = await runBatch({
      client,
      model: "qwen/qwen3.6-35b-a3b",
      modelContext: 42_496,
      plan,
      batch,
      maximumAttempts: 1,
    });

    expect(result.validation.passed).toBe(true);
    expect(result.responses[0].requirements[0].components).toHaveLength(3);
    expect(result.attempts[0].componentRepairs).toEqual([
      expect.objectContaining({
        unitId: unit.unitId,
        action: "DROP_REDUNDANT_APPLICABILITY_EFFECT",
      }),
    ]);
  });

  test("drops redundant definition, duration and agreement effects only beside their semantic owners", async () => {
    const source = artifact(
      [
        "Seite 1\nDer Neubauwert gilt. Im Falle eines Prozesses wird die Frist erstreckt; es gilt als vereinbart, dass die Neuwertentschädigung geleistet wird.\n",
      ],
      "e"
    );
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const batch = buildADrivenClassificationBatches(plan).batches[0];
    const unit = plan.units.find(
      ({ unitId }) => unitId === batch.expectedUnitIds[0]
    );
    const response = {
      unitId: unit.unitId,
      primaryClass: "OPERATIVE_COVERAGE_STATEMENT",
      semanticClasses: [
        "OPERATIVE_COVERAGE_STATEMENT",
        "DEFINITION",
        "CONDITION",
      ],
      requirements: [
        {
          displayLabel: unit.source.combinedText,
          components: [
            {
              type: "FACT_ROLE",
              label: "Neubauwert gilt",
              sourceBlockIds: unit.source.blockIds,
            },
            {
              type: "COVERAGE_EFFECT",
              label: "gilt",
              sourceBlockIds: unit.source.blockIds,
              coverageEffect: "CONDITIONAL",
            },
            {
              type: "CONDITION",
              label: "Im Falle eines Prozesses",
              sourceBlockIds: unit.source.blockIds,
            },
            {
              type: "COVERAGE_EFFECT",
              label: "wird die Frist erstreckt",
              sourceBlockIds: unit.source.blockIds,
              coverageEffect: "CONDITIONAL",
            },
            {
              type: "COVERAGE_EFFECT",
              label: "gilt als vereinbart",
              sourceBlockIds: unit.source.blockIds,
              coverageEffect: "CONDITIONAL",
            },
            {
              type: "COVERAGE_EFFECT",
              label: "Neuwertentschädigung geleistet wird",
              sourceBlockIds: unit.source.blockIds,
              coverageEffect: "INCLUDED",
            },
          ],
        },
      ],
    };
    const client = {
      chat: {
        completions: {
          create: jest.fn(async () => ({
            model: "qwen/qwen3.6-35b-a3b",
            choices: [{ message: { content: JSON.stringify([response]) } }],
            usage: {},
          })),
        },
      },
    };

    const result = await runBatch({
      client,
      model: "qwen/qwen3.6-35b-a3b",
      modelContext: 42_496,
      plan,
      batch,
      maximumAttempts: 1,
    });

    expect(result.validation.passed).toBe(true);
    expect(result.responses[0].requirements[0].components).toHaveLength(3);
    expect(
      result.attempts[0].componentRepairs.filter(
        ({ action }) => action === "DROP_REDUNDANT_NON_COVERAGE_EFFECT"
      )
    ).toHaveLength(3);
  });

  test("normalizes bare gilt in an as-definition without treating it as coverage", async () => {
    const source = artifact(
      ["Seite 1\nDer Neubauwert als Ersatzwert gilt.\n"],
      "f"
    );
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const batch = buildADrivenClassificationBatches(plan).batches[0];
    const unit = plan.units.find(
      ({ unitId }) => unitId === batch.expectedUnitIds[0]
    );
    const response = {
      unitId: unit.unitId,
      primaryClass: "DEFINITION",
      semanticClasses: ["DEFINITION"],
      requirements: [
        {
          displayLabel: unit.source.combinedText,
          components: [
            {
              type: "COVERAGE_EFFECT",
              label: "gilt",
              sourceBlockIds: unit.source.blockIds,
              coverageEffect: "CONDITIONAL",
            },
          ],
        },
      ],
    };
    const client = {
      chat: {
        completions: {
          create: jest.fn(async () => ({
            model: "qwen/qwen3.6-35b-a3b",
            choices: [{ message: { content: JSON.stringify([response]) } }],
            usage: {},
          })),
        },
      },
    };

    const result = await runBatch({
      client,
      model: "qwen/qwen3.6-35b-a3b",
      modelContext: 42_496,
      plan,
      batch,
      maximumAttempts: 1,
    });

    expect(result.validation.passed).toBe(true);
    expect(result.responses[0].requirements[0].components[0]).toEqual({
      type: "FACT_ROLE",
      label: "gilt",
      sourceBlockIds: unit.source.blockIds,
    });
    expect(result.attempts[0].componentRepairs).toEqual([
      expect.objectContaining({ action: "NORMALIZE_BARE_GILT_TO_FACT_ROLE" }),
    ]);
  });

  test("normalizes an agreed replacement value to precedence semantics", () => {
    const unit = {
      unitId: "unit-one",
      unitKind: "CLAUSE",
      source: {
        combinedText:
          "Sollte in der Polizze eine andere Versicherungssumme aufscheinen, gilt diese vereinbart.",
        blocks: [
          {
            blockId: "replacement",
            structuralKind: "PARAGRAPH",
            exactText:
              "Sollte in der Polizze eine andere Versicherungssumme aufscheinen, gilt diese vereinbart.",
          },
        ],
      },
      logicalSourceSegments: [],
    };
    const response = {
      unitId: unit.unitId,
      requirements: [
        {
          displayLabel: unit.source.combinedText,
          components: [
            {
              type: "COVERAGE_EFFECT",
              label: "gilt diese vereinbart",
              sourceBlockIds: ["replacement"],
              coverageEffect: "INCLUDED",
            },
          ],
        },
      ],
    };

    const normalized = normalizeUnambiguousComponentTypes([response], [unit]);

    expect(normalized.responses[0].requirements[0].components[0]).toEqual({
      type: "PRECEDENCE_OR_REPLACEMENT",
      label: "gilt diese vereinbart",
      sourceBlockIds: ["replacement"],
    });
    expect(normalized.componentRepairs).toEqual([
      expect.objectContaining({
        action: "NORMALIZE_AGREED_REPLACEMENT_TO_PRECEDENCE_ROLE",
      }),
    ]);
  });

  test("reuses PASS batches, resumes at the first incomplete batch and creates no duplicate result", async () => {
    const temporary = fs.mkdtempSync(
      path.join(os.tmpdir(), "lf-a-classification-resume-")
    );
    try {
      const source = artifact(
        [
          "Seite 1\nVersichert sind Gebäude.\n\nVersichert sind Nebengebäude.\n\nSelbstbehalt EUR 500.\n",
        ],
        "5"
      );
      const plan = buildADrivenSourceUnitPlan({
        documents: [document("source", 0, source)],
      });
      const allBatches = buildADrivenClassificationBatches(plan, {
        maximumUnits: 1,
        maximumCharacters: 12_000,
      });
      expect(allBatches.batches.length).toBeGreaterThanOrEqual(3);
      const batches = {
        ...allBatches,
        batches: allBatches.batches.slice(0, 3),
      };
      const args = {
        output: temporary,
        model: "qwen/qwen3.6-35b-a3b",
        modelContext: 42_496,
        maximumAttempts: 1,
        requestTimeoutMs: 1_000,
        abortSettlementTimeoutMs: 10,
      };
      const completionFor = (batch) => ({
        model: args.model,
        choices: [
          {
            message: {
              content: JSON.stringify(
                batch.expectedUnitIds.map((unitId) =>
                  validResponse(
                    plan.units.find((unit) => unit.unitId === unitId)
                  )
                )
              ),
            },
          },
        ],
        usage: {},
      });
      for (const batch of [batches.batches[0], batches.batches[2]]) {
        const seeded = await runBatch({
          client: {
            chat: {
              completions: {
                create: jest.fn(async () => completionFor(batch)),
              },
            },
          },
          model: args.model,
          modelContext: args.modelContext,
          plan,
          batch,
          maximumAttempts: 1,
          requestTimeoutMs: args.requestTimeoutMs,
          abortSettlementTimeoutMs: args.abortSettlementTimeoutMs,
        });
        const file = batchResultFile(temporary, batch);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, `${JSON.stringify(seeded, null, 2)}\n`, {
          mode: 0o600,
        });
      }
      const before = fs.readFileSync(
        batchResultFile(temporary, batches.batches[0]),
        "utf8"
      );
      const requestedBatchIds = [];
      const client = {
        chat: {
          completions: {
            create: jest.fn(async ({ messages }) => {
              const input = JSON.parse(
                messages.find(({ role }) => role === "user").content
              );
              requestedBatchIds.push(input.batchId);
              return completionFor(batches.batches[1]);
            }),
          },
        },
      };

      const results = await processClassificationBatches({
        args,
        plan,
        batches,
        client,
        recoverModelAfterAbort: jest.fn(),
      });
      expect(results).toHaveLength(3);
      expect(requestedBatchIds).toEqual([batches.batches[1].batchId]);
      expect(
        fs.readFileSync(batchResultFile(temporary, batches.batches[0]), "utf8")
      ).toBe(before);
      expect(fs.readdirSync(path.join(temporary, "batches"))).toHaveLength(3);

      const secondClient = {
        chat: { completions: { create: jest.fn() } },
      };
      await processClassificationBatches({
        args,
        plan,
        batches,
        client: secondClient,
        recoverModelAfterAbort: jest.fn(),
      });
      expect(secondClient.chat.completions.create).not.toHaveBeenCalled();
      expect(fs.readdirSync(path.join(temporary, "batches"))).toHaveLength(3);
    } finally {
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  });

  test("archives a stale PASS validation and reuses its still-valid unit responses", async () => {
    const temporary = fs.mkdtempSync(
      path.join(os.tmpdir(), "lf-a-classification-stale-pass-")
    );
    try {
      const source = artifact(["Seite 1\nVersichert sind Gebäude.\n"], "8");
      const plan = buildADrivenSourceUnitPlan({
        documents: [document("source", 0, source)],
      });
      const built = buildADrivenClassificationBatches(plan);
      const batches = { ...built, batches: built.batches.slice(0, 1) };
      const batch = batches.batches[0];
      const args = {
        output: temporary,
        model: "qwen/qwen3.6-35b-a3b",
        modelContext: 42_496,
        maximumAttempts: 1,
        requestTimeoutMs: 1_000,
        abortSettlementTimeoutMs: 10,
      };
      const seeded = await runBatch({
        client: {
          chat: {
            completions: {
              create: jest.fn(async () => ({
                model: args.model,
                choices: [
                  {
                    message: {
                      content: JSON.stringify(
                        batch.expectedUnitIds.map((unitId) =>
                          validResponse(
                            plan.units.find((unit) => unit.unitId === unitId)
                          )
                        )
                      ),
                    },
                  },
                ],
                usage: {},
              })),
            },
          },
        },
        model: args.model,
        modelContext: args.modelContext,
        plan,
        batch,
        maximumAttempts: 1,
      });
      seeded.validation = {
        ...seeded.validation,
        diagnostics: [{ code: "STALE_VALIDATION" }],
      };
      const file = batchResultFile(temporary, batch);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, `${JSON.stringify(seeded, null, 2)}\n`, {
        mode: 0o600,
      });
      const client = { chat: { completions: { create: jest.fn() } } };

      const results = await processClassificationBatches({
        args,
        plan,
        batches,
        client,
        recoverModelAfterAbort: jest.fn(),
      });

      expect(results[0].validation.passed).toBe(true);
      expect(client.chat.completions.create).not.toHaveBeenCalled();
      expect(fs.readdirSync(path.join(temporary, "batches"))).toHaveLength(1);
      expect(
        fs.readdirSync(path.join(temporary, "superseded-batches"))
      ).toHaveLength(1);

      fs.rmSync(batchResultFile(temporary, batch));
      const resumeClient = { chat: { completions: { create: jest.fn() } } };
      const resumed = await processClassificationBatches({
        args,
        plan,
        batches,
        client: resumeClient,
        recoverModelAfterAbort: jest.fn(),
      });
      expect(resumed[0].validation.passed).toBe(true);
      expect(resumeClient.chat.completions.create).not.toHaveBeenCalled();
    } finally {
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  });

  test("upgrades an older run and prompt by revalidating its responses", async () => {
    const temporary = fs.mkdtempSync(
      path.join(os.tmpdir(), "lf-a-classification-v12-upgrade-")
    );
    try {
      const source = artifact(["Seite 1\nVersichert sind Gebäude.\n"], "1");
      const plan = deriveClassificationEvidencePlan(
        buildADrivenSourceUnitPlan({
          documents: [document("source", 0, source)],
        })
      );
      const built = buildADrivenClassificationBatches(plan);
      const batches = { ...built, batches: built.batches.slice(0, 1) };
      const batch = batches.batches[0];
      const contextualBatch = {
        ...batch,
        units: batch.expectedUnitIds.map((unitId) =>
          plan.units.find((unit) => unit.unitId === unitId)
        ),
      };
      const args = {
        output: temporary,
        model: "qwen/qwen3.6-35b-a3b",
        modelContext: 42_496,
        maximumAttempts: 1,
        requestTimeoutMs: 1_000,
        abortSettlementTimeoutMs: 10,
      };
      const responses = contextualBatch.units.map(validResponse);
      const seeded = await runBatch({
        client: {
          chat: {
            completions: {
              create: jest.fn(async () => ({
                model: args.model,
                choices: [{ message: { content: JSON.stringify(responses) } }],
                usage: {},
              })),
            },
          },
        },
        model: args.model,
        modelContext: args.modelContext,
        plan,
        batch,
        maximumAttempts: 1,
      });
      const predecessor = {
        ...seeded,
        contractId: "LF_A_BOUNDED_CLASSIFICATION_RUN_V12",
        promptContractId: "LF_A_BOUNDED_CLASSIFICATION_PROMPT_V19",
      };
      delete predecessor.semanticSignalContractId;
      const file = batchResultFile(temporary, batch);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, `${JSON.stringify(predecessor, null, 2)}\n`, {
        mode: 0o600,
      });
      const client = { chat: { completions: { create: jest.fn() } } };

      const [upgraded] = await processClassificationBatches({
        args,
        plan,
        batches,
        client,
        recoverModelAfterAbort: jest.fn(),
      });

      expect(upgraded.contractId).toBe("LF_A_BOUNDED_CLASSIFICATION_RUN_V36");
      expect(upgraded.semanticSignalContractId).toBe(
        A_SEMANTIC_SIGNAL_CONTRACT_ID
      );
      expect(upgraded.responses).toEqual(responses);
      expect(client.chat.completions.create).not.toHaveBeenCalled();
      expect(
        fs.readdirSync(path.join(temporary, "superseded-batches"))
      ).toHaveLength(1);
    } finally {
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  });

  test("revalidates a bound V13 predecessor after its evidence context changes", async () => {
    const temporary = fs.mkdtempSync(
      path.join(os.tmpdir(), "lf-a-classification-v13-context-upgrade-")
    );
    try {
      const source = artifact(["Seite 1\nVersichert sind Gebäude.\n"], "c");
      const plan = deriveClassificationEvidencePlan(
        buildADrivenSourceUnitPlan({
          documents: [document("source", 0, source)],
        })
      );
      const built = buildADrivenClassificationBatches(plan);
      const batches = { ...built, batches: built.batches.slice(0, 1) };
      const batch = batches.batches[0];
      const responses = batch.expectedUnitIds.map((unitId) =>
        validResponse(plan.units.find((unit) => unit.unitId === unitId))
      );
      const args = {
        output: temporary,
        model: "qwen/qwen3.6-35b-a3b",
        modelContext: 42_496,
        maximumAttempts: 1,
        requestTimeoutMs: 1_000,
        abortSettlementTimeoutMs: 10,
      };
      const seeded = await runBatch({
        client: {
          chat: {
            completions: {
              create: jest.fn(async () => ({
                model: args.model,
                choices: [{ message: { content: JSON.stringify(responses) } }],
                usage: {},
              })),
            },
          },
        },
        model: args.model,
        modelContext: args.modelContext,
        plan,
        batch,
        maximumAttempts: 1,
      });
      const predecessor = {
        ...seeded,
        promptSha256: "f".repeat(64),
      };
      const file = batchResultFile(temporary, batch);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, `${JSON.stringify(predecessor, null, 2)}\n`, {
        mode: 0o600,
      });
      const client = { chat: { completions: { create: jest.fn() } } };

      const [upgraded] = await processClassificationBatches({
        args,
        plan,
        batches,
        client,
        recoverModelAfterAbort: jest.fn(),
      });

      expect(upgraded.promptSha256).not.toBe(predecessor.promptSha256);
      expect(upgraded.responses).toEqual(responses);
      expect(client.chat.completions.create).not.toHaveBeenCalled();
      expect(
        fs.readdirSync(path.join(temporary, "superseded-batches"))
      ).toHaveLength(1);
    } finally {
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  });

  test("normalizes a historically accepted numbered heading before reusing its PASS batch", async () => {
    const temporary = fs.mkdtempSync(
      path.join(os.tmpdir(), "lf-a-classification-heading-pass-")
    );
    try {
      const source = artifact(["Seite 1\nVersichert sind Gebäude.\n"], "d");
      const sourcePlan = buildADrivenSourceUnitPlan({
        documents: [document("source", 0, source)],
      });
      const plan = deriveClassificationEvidencePlan(sourcePlan);
      const headingText =
        "3. Obliegenheiten des Versicherungsnehmers im Schadenfall";
      const pendingUnit = plan.units.find(
        ({ initialDisposition }) =>
          initialDisposition === "PENDING_CLASSIFICATION"
      );
      pendingUnit.unitKind = "LIST";
      pendingUnit.source.combinedText = headingText;
      for (const block of pendingUnit.source.blocks) {
        block.exactText = headingText;
        block.structuralKind = "HEADING_CANDIDATE";
      }
      const built = buildADrivenClassificationBatches(plan);
      const batch = built.batches.find(({ expectedUnitIds }) =>
        expectedUnitIds.some((unitId) => {
          const unit = plan.units.find(
            (candidate) => candidate.unitId === unitId
          );
          return unit?.unitKind === "LIST";
        })
      );
      expect(batch).toBeDefined();
      const batches = { ...built, batches: [batch] };
      const contextualBatch = {
        ...batch,
        units: batch.expectedUnitIds.map((unitId) =>
          plan.units.find((candidate) => candidate.unitId === unitId)
        ),
      };
      const unit = plan.units.find(
        ({ unitId }) =>
          unitId ===
          batch.units.find(({ unitKind }) => unitKind === "LIST").unitId
      );
      const args = {
        output: temporary,
        model: "qwen/qwen3.6-35b-a3b",
        modelContext: 42_496,
        maximumAttempts: 1,
        requestTimeoutMs: 1_000,
        abortSettlementTimeoutMs: 10,
      };
      const staleResponse = {
        unitId: unit.unitId,
        primaryClass: "INSURED_OBJECT",
        semanticClasses: ["INSURED_OBJECT"],
        requirements: [
          {
            displayLabel: unit.source.combinedText,
            components: unit.source.blocks.map((block) => ({
              type: "OBJECT",
              label: block.exactText,
              sourceBlockIds: [block.blockId],
            })),
          },
        ],
      };
      const otherResponses = batch.units
        .filter(({ unitId }) => unitId !== unit.unitId)
        .map(({ unitId }) =>
          validResponse(
            plan.units.find((candidate) => candidate.unitId === unitId)
          )
        );
      const responses = [...otherResponses, staleResponse];
      const rawResponse = JSON.stringify(responses);
      const seeded = await runBatch({
        client: {
          chat: {
            completions: {
              create: jest.fn(async () => ({
                model: args.model,
                choices: [{ message: { content: rawResponse } }],
                usage: {},
              })),
            },
          },
        },
        model: args.model,
        modelContext: args.modelContext,
        plan,
        batch: contextualBatch,
        maximumAttempts: 1,
      });
      const result = {
        ...seeded,
        classificationEvidenceContextContractId:
          "LF_A_CLASSIFICATION_EVIDENCE_CONTEXT_V1",
        responses,
        validation: validateBatchResponses(plan, batch, responses),
        rawResponse,
        rawResponseSha256: crypto
          .createHash("sha256")
          .update(rawResponse)
          .digest("hex"),
      };
      const file = batchResultFile(temporary, batch);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, `${JSON.stringify(result, null, 2)}\n`, {
        mode: 0o600,
      });

      const client = { chat: { completions: { create: jest.fn() } } };
      const [repaired] = await processClassificationBatches({
        args,
        plan,
        batches,
        client,
        recoverModelAfterAbort: jest.fn(),
      });

      expect(client.chat.completions.create).not.toHaveBeenCalled();
      expect(
        repaired.responses.find(({ unitId }) => unitId === unit.unitId)
      ).toEqual({
        unitId: unit.unitId,
        primaryClass: "STRUCTURE",
        semanticClasses: ["STRUCTURE"],
        requirements: [],
      });
      expect(
        fs.readdirSync(path.join(temporary, "superseded-batches"))
      ).toHaveLength(1);
    } finally {
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  });

  test("exhausted retries stop fail-closed and leave the batch resumable", async () => {
    const temporary = fs.mkdtempSync(
      path.join(os.tmpdir(), "lf-a-classification-fail-closed-")
    );
    try {
      const source = artifact(["Seite 1\nVersichert sind Gebäude.\n"], "4");
      const plan = buildADrivenSourceUnitPlan({
        documents: [document("source", 0, source)],
      });
      const built = buildADrivenClassificationBatches(plan);
      const batches = { ...built, batches: built.batches.slice(0, 1) };
      const batch = batches.batches[0];
      const args = {
        output: temporary,
        model: "qwen/qwen3.6-35b-a3b",
        modelContext: 42_496,
        maximumAttempts: 1,
        requestTimeoutMs: 1_000,
        abortSettlementTimeoutMs: 10,
      };
      const invalidClient = {
        chat: {
          completions: {
            create: jest.fn(async () => ({
              model: args.model,
              choices: [{ message: { content: "[]" } }],
              usage: {},
            })),
          },
        },
      };

      await expect(
        processClassificationBatches({
          args,
          plan,
          batches,
          client: invalidClient,
          recoverModelAfterAbort: jest.fn(),
        })
      ).rejects.toThrow(
        `LF_A_CLASSIFICATION_BATCH_FAILED_CLOSED:${batch.batchIndex}:${batch.batchId}`
      );
      expect(fs.existsSync(batchResultFile(temporary, batch))).toBe(false);
      const attemptDirectory = path.join(
        temporary,
        "attempts",
        `${String(batch.batchIndex).padStart(4, "0")}-${batch.batchId}`
      );
      expect(fs.readdirSync(attemptDirectory)).toHaveLength(1);
      const failedAttempt = JSON.parse(
        fs.readFileSync(
          path.join(attemptDirectory, fs.readdirSync(attemptDirectory)[0]),
          "utf8"
        )
      );
      expect(failedAttempt.attempt).toMatchObject({
        attempt: 1,
        rawResponse: "[]",
        rawResponseSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
        responses: [],
        validationPassed: false,
      });

      const validClient = {
        chat: {
          completions: {
            create: jest.fn(async () => ({
              model: args.model,
              choices: [
                {
                  message: {
                    content: JSON.stringify(
                      batch.expectedUnitIds.map((unitId) =>
                        validResponse(
                          plan.units.find((unit) => unit.unitId === unitId)
                        )
                      )
                    ),
                  },
                },
              ],
              usage: {},
            })),
          },
        },
      };
      await processClassificationBatches({
        args,
        plan,
        batches,
        client: validClient,
        recoverModelAfterAbort: jest.fn(),
      });
      expect(fs.existsSync(batchResultFile(temporary, batch))).toBe(true);
      expect(fs.readdirSync(attemptDirectory)).toHaveLength(2);
      expect(fs.readdirSync(path.join(temporary, "batches"))).toHaveLength(1);
    } finally {
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  });

  test("revalidates a predecessor journal and resumes only its unaccepted units", async () => {
    const temporary = fs.mkdtempSync(
      path.join(os.tmpdir(), "lf-a-classification-partial-resume-")
    );
    try {
      const source = artifact(
        ["Seite 1\nVersichert sind Gebäude.\n\nVersichert sind Garagen.\n"],
        "0"
      );
      const plan = buildADrivenSourceUnitPlan({
        documents: [document("source", 0, source)],
      });
      const built = buildADrivenClassificationBatches(plan, {
        maximumUnits: 2,
        maximumCharacters: 12_000,
      });
      const batches = { ...built, batches: built.batches.slice(0, 1) };
      const batch = batches.batches[0];
      expect(batch.expectedUnitIds).toHaveLength(2);
      const valid = batch.expectedUnitIds.map((unitId) =>
        validResponse(plan.units.find((unit) => unit.unitId === unitId))
      );
      const invalidSecond = JSON.parse(JSON.stringify(valid[1]));
      invalidSecond.requirements[0].components[0].label = "";
      const args = {
        output: temporary,
        model: "qwen/qwen3.6-35b-a3b",
        modelContext: 42_496,
        maximumAttempts: 1,
        requestTimeoutMs: 1_000,
        abortSettlementTimeoutMs: 10,
      };

      await expect(
        processClassificationBatches({
          args,
          plan,
          batches,
          client: {
            chat: {
              completions: {
                create: jest.fn(async () => ({
                  model: args.model,
                  choices: [
                    {
                      message: {
                        content: JSON.stringify([valid[0], invalidSecond]),
                      },
                    },
                  ],
                  usage: {},
                })),
              },
            },
          },
          recoverModelAfterAbort: jest.fn(),
        })
      ).rejects.toThrow("LF_A_CLASSIFICATION_BATCH_FAILED_CLOSED");

      const attemptDirectory = path.join(
        temporary,
        "attempts",
        `${String(batch.batchIndex).padStart(4, "0")}-${batch.batchId}`
      );
      const [attemptName] = fs.readdirSync(attemptDirectory);
      const attemptFile = path.join(attemptDirectory, attemptName);
      const predecessorAttempt = JSON.parse(
        fs.readFileSync(attemptFile, "utf8")
      );
      predecessorAttempt.semanticSignalContractId =
        A_SEMANTIC_SIGNAL_CONTRACT_ID_V2;
      fs.writeFileSync(
        attemptFile,
        `${JSON.stringify(predecessorAttempt, null, 2)}\n`,
        { mode: 0o600 }
      );

      const requested = [];
      const results = await processClassificationBatches({
        args,
        plan,
        batches,
        client: {
          chat: {
            completions: {
              create: jest.fn(async ({ messages }) => {
                const input = JSON.parse(
                  messages.find(({ role }) => role === "user").content
                );
                requested.push(input.expectedUnitIds);
                return {
                  model: args.model,
                  choices: [
                    { message: { content: JSON.stringify([valid[1]]) } },
                  ],
                  usage: {},
                };
              }),
            },
          },
        },
        recoverModelAfterAbort: jest.fn(),
      });

      expect(requested).toEqual([[batch.expectedUnitIds[1]]]);
      expect(results[0].responses).toEqual(valid);
      expect(results[0].resumedAcceptedUnits).toBe(1);
      expect(fs.existsSync(batchResultFile(temporary, batch))).toBe(true);
    } finally {
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  });

  test("retries only unresolved unit IDs and preserves accepted responses", async () => {
    const source = artifact(
      ["Seite 1\nVersichert sind Gebäude.\n\nVersichert sind Nebengebäude.\n"],
      "3"
    );
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const batch = buildADrivenClassificationBatches(plan).batches[0];
    const valid = batch.expectedUnitIds.map((unitId) =>
      validResponse(plan.units.find((unit) => unit.unitId === unitId))
    );
    const invalid = JSON.parse(JSON.stringify(valid));
    invalid.at(-1).requirements[0].components[0].label = "";
    const requested = [];
    const repairMessages = [];
    const previousAnswers = [];
    const client = {
      chat: {
        completions: {
          create: jest.fn(async ({ messages }) => {
            const input = JSON.parse(
              messages.find(({ role }) => role === "user").content
            );
            requested.push(input.expectedUnitIds);
            repairMessages.push(messages.at(-1).content);
            previousAnswers.push(
              messages.find(({ role }) => role === "assistant")?.content || null
            );
            const responses = requested.length === 1 ? invalid : [valid.at(-1)];
            return {
              model: "qwen/qwen3.6-35b-a3b",
              choices: [{ message: { content: JSON.stringify(responses) } }],
              usage: {},
            };
          }),
        },
      },
    };

    const result = await runBatch({
      client,
      model: "qwen/qwen3.6-35b-a3b",
      modelContext: 42_496,
      plan,
      batch,
      maximumAttempts: 3,
    });

    expect(result.validation.passed).toBe(true);
    expect(result.responses).toEqual(valid);
    expect(requested).toEqual([
      batch.expectedUnitIds,
      [batch.expectedUnitIds.at(-1)],
    ]);
    expect(result.attempts.map(({ pendingUnits }) => pendingUnits)).toEqual([
      1, 0,
    ]);
    expect(repairMessages[1]).toContain(
      "governingContext ist ausschließlich Evidenz"
    );
    expect(repairMessages[1]).toContain(
      "ersetze die falsch typisierte OBJECT-Komponente"
    );
    expect(repairMessages[1]).toContain(
      "Wenn observedComponentTypes OBJECT nennt und semanticClasses zugleich INSURED_OBJECT enthält"
    );
    expect(repairMessages[1]).toContain(
      "Entferne beim Ergänzen einer missingRequiredComponentGroup keine Komponente"
    );
    expect(repairMessages[1]).toContain(
      "ersetze sourceBlockIds der exakt bezeichneten Komponente vollständig und zeichengetreu durch requiredSourceBlockIds"
    );
    expect(repairMessages[1]).toContain(
      "COMPONENT_SOURCE_TEXT_INVALID declaredSourceExactText"
    );
    expect(repairMessages[1]).toContain(
      "REQUIREMENT_DISPLAY_LABEL_OUTSIDE_OWNED_SOURCE bedeutet"
    );
    expect(repairMessages[1]).toContain(
      "REQUIREMENT_SOURCE_TEXT_INVALID bedeutet"
    );
    expect(repairMessages[1]).toContain("COVERAGE_EFFECT_LABEL_INVALID");
    expect(repairMessages[1]).toContain(
      "LIST_GOVERNOR_REQUIREMENT_STANDALONE bedeutet"
    );
    expect(repairMessages[1]).toContain(
      "uncoveredBlocks-Eintrag mit structuralKind LIST_GOVERNOR"
    );
    expect(repairMessages[1]).toContain("DUPLICATE_UNIT_RESPONSE bedeutet");
    expect(repairMessages[1]).toContain("UNKNOWN_UNIT_ID bedeutet");
    expect(repairMessages[1]).toContain(
      "beschreiben für sich eine Bewertungs- oder Definitionsregel"
    );
    expect(repairMessages[1]).toContain("ist nur eine Vereinbarungseinleitung");
    expect(repairMessages[1]).toContain(
      "entferne zugleich OPERATIVE_COVERAGE_STATEMENT"
    );
    expect(repairMessages[1]).toContain(
      "ausschließlich aus HEADING_CANDIDATE-Blöcken bestehende LIST-Unit"
    );
    expect(repairMessages[1]).toContain(
      "„ausgenommen sind“ die Deckungswirkung EXCLUDED"
    );
    expect(previousAnswers).toEqual([null, JSON.stringify([invalid.at(-1)])]);
  });

  test("normalizes a numbered heading-only list unit without borrowing clause semantics", async () => {
    const source = artifact(
      ["Seite 1\n12. Radioaktive Isotope: Kosten für Aufräumung\n"],
      "b"
    );
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const unit = plan.units.find(({ unitKind }) => unitKind === "LIST");
    const plannedBatch = buildADrivenClassificationBatches(plan).batches.find(
      ({ expectedUnitIds }) => expectedUnitIds.includes(unit.unitId)
    );
    const batch = {
      ...plannedBatch,
      units: plannedBatch.expectedUnitIds.map((unitId) =>
        plan.units.find((candidate) => candidate.unitId === unitId)
      ),
    };
    expect(unit.unitKind).toBe("LIST");
    expect(
      unit.source.blocks.every(
        ({ structuralKind }) => structuralKind === "HEADING_CANDIDATE"
      )
    ).toBe(true);
    const client = {
      chat: {
        completions: {
          create: jest.fn(async () => ({
            model: "qwen/qwen3.6-35b-a3b",
            choices: [
              {
                message: {
                  content: JSON.stringify([
                    {
                      unitId: unit.unitId,
                      primaryClass: "EXCLUSION",
                      semanticClasses: ["EXCLUSION"],
                      requirements: [
                        {
                          displayLabel: unit.source.combinedText,
                          components: [
                            {
                              type: "OBJECT",
                              label: unit.source.combinedText,
                              sourceBlockIds: unit.source.blockIds,
                            },
                          ],
                        },
                      ],
                    },
                  ]),
                },
              },
            ],
            usage: {},
          })),
        },
      },
    };

    const result = await runBatch({
      client,
      model: "qwen/qwen3.6-35b-a3b",
      modelContext: 42_496,
      plan,
      batch,
      maximumAttempts: 1,
    });

    expect(result.validation.passed).toBe(true);
    expect(result.responses).toEqual([
      {
        unitId: unit.unitId,
        primaryClass: "STRUCTURE",
        semanticClasses: ["STRUCTURE"],
        requirements: [],
      },
    ]);
    expect(result.attempts[0].componentRepairs).toContainEqual({
      unitId: unit.unitId,
      action: "NORMALIZE_NUMBERED_HEADING_TO_STRUCTURE",
    });
  });

  test("normalizes a sum-allocation process to a definition", async () => {
    const source = artifact(
      [
        "Seite 1\nDie Versicherungssumme dient zum Ausgleich und wird aufgeteilt. Die Verteilung richtet sich nach der Unterversicherung.\n",
      ],
      "d"
    );
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const unit = plan.units.find(
      ({ initialDisposition }) =>
        initialDisposition === "PENDING_CLASSIFICATION"
    );
    const plannedBatch = buildADrivenClassificationBatches(plan).batches.find(
      ({ expectedUnitIds }) => expectedUnitIds.includes(unit.unitId)
    );
    const batch = {
      ...plannedBatch,
      units: plannedBatch.expectedUnitIds.map((unitId) =>
        plan.units.find((candidate) => candidate.unitId === unitId)
      ),
    };
    const client = {
      chat: {
        completions: {
          create: jest.fn(async () => ({
            model: "qwen/qwen3.6-35b-a3b",
            choices: [
              {
                message: {
                  content: JSON.stringify([
                    {
                      unitId: unit.unitId,
                      primaryClass: "OPERATIVE_COVERAGE_STATEMENT",
                      semanticClasses: ["OPERATIVE_COVERAGE_STATEMENT"],
                      requirements: [
                        {
                          displayLabel: unit.source.combinedText,
                          components: [
                            {
                              type: "OBJECT",
                              label: unit.source.combinedText,
                              sourceBlockIds: unit.source.blockIds,
                            },
                          ],
                        },
                      ],
                    },
                  ]),
                },
              },
            ],
            usage: {},
          })),
        },
      },
    };

    const result = await runBatch({
      client,
      model: "qwen/qwen3.6-35b-a3b",
      modelContext: 42_496,
      plan,
      batch,
      maximumAttempts: 1,
    });

    expect(result.validation.passed).toBe(true);
    expect(result.responses[0].primaryClass).toBe("DEFINITION");
    expect(result.responses[0].semanticClasses).toEqual(["DEFINITION"]);
    expect(result.responses[0].requirements[0].components[0].type).toBe(
      "FACT_ROLE"
    );
    expect(result.attempts[0].componentRepairs).toContainEqual({
      unitId: unit.unitId,
      action: "NORMALIZE_ALLOCATION_RULE_TO_DEFINITION",
    });
  });

  test("expands an elided insurer performance obligation from exact source text", async () => {
    const source = artifact(
      [
        "Seite 1\nAbweichend davon ist der Versicherer bei Veräußerung der Sache auch dann zur Leistung verpflichtet.\n",
      ],
      "e"
    );
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const unit = plan.units.find(
      ({ initialDisposition }) =>
        initialDisposition === "PENDING_CLASSIFICATION"
    );
    const plannedBatch = buildADrivenClassificationBatches(plan).batches.find(
      ({ expectedUnitIds }) => expectedUnitIds.includes(unit.unitId)
    );
    const batch = {
      ...plannedBatch,
      units: plannedBatch.expectedUnitIds.map((unitId) =>
        plan.units.find((candidate) => candidate.unitId === unitId)
      ),
    };
    const client = {
      chat: {
        completions: {
          create: jest.fn(async () => ({
            model: "qwen/qwen3.6-35b-a3b",
            choices: [
              {
                message: {
                  content: JSON.stringify([
                    {
                      unitId: unit.unitId,
                      primaryClass: "OPERATIVE_COVERAGE_STATEMENT",
                      semanticClasses: ["OPERATIVE_COVERAGE_STATEMENT"],
                      requirements: [
                        {
                          displayLabel: unit.source.combinedText,
                          components: [
                            {
                              type: "COVERAGE_EFFECT",
                              label:
                                "ist der Versicherer ... zur Leistung verpflichtet",
                              sourceBlockIds: unit.source.blockIds,
                              coverageEffect: "INCLUDED",
                            },
                          ],
                        },
                      ],
                    },
                  ]),
                },
              },
            ],
            usage: {},
          })),
        },
      },
    };

    const result = await runBatch({
      client,
      model: "qwen/qwen3.6-35b-a3b",
      modelContext: 42_496,
      plan,
      batch,
      maximumAttempts: 1,
    });

    expect(result.validation.passed).toBe(true);
    expect(result.responses[0].requirements[0].components[0].label).toContain(
      "bei Veräußerung der Sache auch dann"
    );
    expect(result.attempts[0].componentRepairs).toContainEqual({
      unitId: unit.unitId,
      requirementIndex: 0,
      componentIndex: 0,
      action: "EXPAND_ELIDED_PERFORMANCE_OBLIGATION",
    });
  });

  test("normalizes a statutory applicability extension to precedence semantics", async () => {
    const source = artifact(
      [
        "Seite 1\nIn Erweiterung des § 158 VersVG ist dieser auch auf weitere Sparten anwendbar.\n",
      ],
      "f"
    );
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const unit = plan.units.find(
      ({ initialDisposition }) =>
        initialDisposition === "PENDING_CLASSIFICATION"
    );
    const plannedBatch = buildADrivenClassificationBatches(plan).batches.find(
      ({ expectedUnitIds }) => expectedUnitIds.includes(unit.unitId)
    );
    const batch = {
      ...plannedBatch,
      units: plannedBatch.expectedUnitIds.map((unitId) =>
        plan.units.find((candidate) => candidate.unitId === unitId)
      ),
    };
    const client = {
      chat: {
        completions: {
          create: jest.fn(async () => ({
            model: "qwen/qwen3.6-35b-a3b",
            choices: [
              {
                message: {
                  content: JSON.stringify([
                    {
                      unitId: unit.unitId,
                      primaryClass: "OPERATIVE_COVERAGE_STATEMENT",
                      semanticClasses: ["OPERATIVE_COVERAGE_STATEMENT"],
                      requirements: [
                        {
                          displayLabel: unit.source.combinedText,
                          components: [
                            {
                              type: "SCOPE",
                              label: "weitere Sparten",
                              sourceBlockIds: unit.source.blockIds,
                            },
                            {
                              type: "COVERAGE_EFFECT",
                              label: "ist dieser auch auf ... anwendbar",
                              sourceBlockIds: unit.source.blockIds,
                              coverageEffect: "INCLUDED",
                            },
                          ],
                        },
                      ],
                    },
                  ]),
                },
              },
            ],
            usage: {},
          })),
        },
      },
    };

    const result = await runBatch({
      client,
      model: "qwen/qwen3.6-35b-a3b",
      modelContext: 42_496,
      plan,
      batch,
      maximumAttempts: 1,
    });

    expect(result.validation.passed).toBe(true);
    expect(result.responses[0].primaryClass).toBe(
      "DOCUMENT_PRECEDENCE_OR_REPLACEMENT"
    );
    expect(result.responses[0].requirements[0].components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "SCOPE" }),
        expect.objectContaining({ type: "PRECEDENCE_OR_REPLACEMENT" }),
      ])
    );
    expect(result.attempts[0].componentRepairs).toContainEqual({
      unitId: unit.unitId,
      action: "NORMALIZE_STATUTORY_APPLICABILITY_EXTENSION",
    });
  });

  test("serializes multiple semantic retry failures into bounded single-unit repairs", async () => {
    const source = artifact(
      [
        "Seite 1\nVersichert sind Gebäude.\n\nVersichert sind Garagen.\n\nVersichert sind Nebengebäude.\n",
      ],
      "4"
    );
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const batch = buildADrivenClassificationBatches(plan).batches[0];
    expect(batch.expectedUnitIds).toHaveLength(3);
    const valid = batch.expectedUnitIds.map((unitId) =>
      validResponse(plan.units.find((unit) => unit.unitId === unitId))
    );
    const invalid = valid.map((response) =>
      JSON.parse(JSON.stringify(response))
    );
    invalid[1].requirements[0].components[0].label = "";
    invalid[2].requirements[0].components[0].label = "";
    const requested = [];
    const client = {
      chat: {
        completions: {
          create: jest.fn(async ({ messages }) => {
            const input = JSON.parse(
              messages.find(({ role }) => role === "user").content
            );
            requested.push(input.expectedUnitIds);
            const responses =
              requested.length === 1
                ? [valid[0], invalid[1], invalid[2]]
                : requested.length === 2
                  ? [invalid[1]]
                  : requested.length === 3
                    ? [valid[1]]
                    : [valid[2]];
            return {
              model: "qwen/qwen3.6-35b-a3b",
              choices: [{ message: { content: JSON.stringify(responses) } }],
              usage: {},
            };
          }),
        },
      },
    };

    const result = await runBatch({
      client,
      model: "qwen/qwen3.6-35b-a3b",
      modelContext: 42_496,
      plan,
      batch,
      maximumAttempts: 3,
    });

    expect(result.validation.passed).toBe(true);
    expect(requested).toEqual([
      batch.expectedUnitIds,
      [batch.expectedUnitIds[1]],
      [batch.expectedUnitIds[1]],
      [batch.expectedUnitIds[2]],
    ]);
    expect(
      result.attempts.map(({ semanticRetryUnitIds }) => semanticRetryUnitIds)
    ).toEqual([
      [batch.expectedUnitIds[1]],
      [batch.expectedUnitIds[1]],
      [batch.expectedUnitIds[2]],
      [],
    ]);
    expect(result.attempts.map(({ unitAttempts }) => unitAttempts)).toEqual([
      Object.fromEntries(batch.expectedUnitIds.map((unitId) => [unitId, 1])),
      { [batch.expectedUnitIds[1]]: 2 },
      { [batch.expectedUnitIds[1]]: 3 },
      { [batch.expectedUnitIds[2]]: 2 },
    ]);
  });

  test("keeps homogeneous classification-envelope repairs grouped", async () => {
    const source = artifact(
      ["Seite 1\nVersichert sind Gebäude.\n\nVersichert sind Garagen.\n"],
      "5"
    );
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const batch = buildADrivenClassificationBatches(plan).batches[0];
    const valid = batch.expectedUnitIds.map((unitId) =>
      validResponse(plan.units.find((unit) => unit.unitId === unitId))
    );
    const invalid = valid.map((response) => ({
      ...response,
      semanticClasses: ["INSURED_OBJECT"],
    }));
    const requested = [];
    const client = {
      chat: {
        completions: {
          create: jest.fn(async ({ messages }) => {
            const input = JSON.parse(
              messages.find(({ role }) => role === "user").content
            );
            requested.push(input.expectedUnitIds);
            return {
              model: "qwen/qwen3.6-35b-a3b",
              choices: [
                {
                  message: {
                    content: JSON.stringify(
                      requested.length === 1 ? invalid : valid
                    ),
                  },
                },
              ],
              usage: {},
            };
          }),
        },
      },
    };

    const result = await runBatch({
      client,
      model: "qwen/qwen3.6-35b-a3b",
      modelContext: 42_496,
      plan,
      batch,
      maximumAttempts: 2,
    });

    expect(result.validation.passed).toBe(true);
    expect(requested).toEqual([batch.expectedUnitIds, batch.expectedUnitIds]);
    expect(result.attempts[0]).toMatchObject({
      semanticRetryUnitIds: batch.expectedUnitIds,
      semanticRetryStrategy: "GROUPED_ENVELOPE_REPAIR",
    });
  });

  test("plans every block across multiple A documents without fixed pages or rows", () => {
    const first = artifact(
      [
        "Seite 1\nFeuer\nZusätzlich versichert sind Schäden durch\n",
        "Seite 2\n- Rauch\n- Explosion\nNeue Deckung Hagel\n",
      ],
      "a"
    );
    const second = artifact(
      ["Seite 1\nNachtrag\nDer Hagelschutz ersetzt die bisherige Regelung.\n"],
      "b"
    );
    const input = {
      documents: [document("a-doc", 0, first), document("b-doc", 1, second)],
    };
    const left = buildADrivenSourceUnitPlan(input);
    const right = buildADrivenSourceUnitPlan(input);

    expect(left).toEqual(right);
    expect(left.runContractId).toBe("LF_REFERENCE_A_DRIVEN_V2");
    expect(left.summary.documents).toBe(2);
    expect(left.summary.sourceBlocks).toBeGreaterThan(8);
    expect(left.units.some(({ unitKind }) => unitKind === "LIST")).toBe(true);
    expect(left.summary.continuationRelations).toBe(1);
    expect(
      left.relations.some(({ type }) => type === "CONTINUES_ON_NEXT_PAGE")
    ).toBe(true);
    expect(
      new Set(left.units.flatMap(({ source }) => source.blockIds)).size
    ).toBe(left.summary.sourceBlocks);
    const batches = buildADrivenClassificationBatches(left, {
      maximumUnits: 2,
      maximumCharacters: 1_000,
    });
    expect(batches.summary.expectedUnits).toBe(left.summary.pendingUnits);
    expect(
      batches.batches.every(
        ({ expectedUnitIds }) => expectedUnitIds.length <= 2
      )
    ).toBe(true);
    expect(
      batches.batches.flatMap(({ expectedUnitIds }) => expectedUnitIds)
    ).toHaveLength(left.summary.pendingUnits);
    expect(
      batches.batches.every(({ units }) =>
        units.every(
          ({ ownedSourceBlockIds, evidenceSourceBlockIds, sourceBlocks }) =>
            sourceBlocks.length === ownedSourceBlockIds.length &&
            evidenceSourceBlockIds.length >= ownedSourceBlockIds.length &&
            sourceBlocks.every(
              ({ blockId, exactText, exactTextSha256 }) =>
                ownedSourceBlockIds.includes(blockId) &&
                exactText.length > 0 &&
                /^[a-f0-9]{64}$/u.test(exactTextSha256)
            )
        )
      )
    ).toBe(true);
  });

  test("binds list requirements to an explicit preceding governor without duplicating owned blocks", () => {
    const source = artifact(
      [
        "Seite 1\nDECKUNG\nZusätzlich versichert sind Schäden durch\n• Rauch;\n",
      ],
      "9"
    );
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const governor = plan.units.find(({ source: unitSource }) =>
      unitSource.combinedText.includes("Zusätzlich versichert")
    );
    const list = plan.units.find(({ unitKind }) => unitKind === "LIST");
    const governorBlock = governor.source.blocks[0];
    const listBlock = list.source.blocks[0];

    expect(list.governingContext.unitIds).toEqual([governor.unitId]);
    expect(list.governingContext.blockIds).toEqual([governorBlock.blockId]);
    expect(
      plan.relations.some(
        ({ type, fromUnitId, toUnitId }) =>
          type === "GOVERNS_FOLLOWING_LIST" &&
          fromUnitId === governor.unitId &&
          toUnitId === list.unitId
      )
    ).toBe(true);
    expect(
      plan.units.flatMap(({ source: unitSource }) => unitSource.blockIds)
    ).toHaveLength(plan.summary.sourceBlocks);

    const responses = plan.units
      .filter(
        ({ initialDisposition }) =>
          initialDisposition === "PENDING_CLASSIFICATION"
      )
      .map((unit) => {
        if (unit.unitId === list.unitId)
          return {
            unitId: unit.unitId,
            primaryClass: "OPERATIVE_COVERAGE_STATEMENT",
            semanticClasses: [
              "OPERATIVE_COVERAGE_STATEMENT",
              "PERIL_OR_DAMAGE",
            ],
            requirements: [
              {
                displayLabel: "Rauch;",
                components: [
                  {
                    type: "PERIL_OR_CAUSE",
                    label: "Rauch",
                    sourceBlockIds: [listBlock.blockId],
                  },
                  {
                    type: "COVERAGE_EFFECT",
                    label: "versichert",
                    coverageEffect: "INCLUDED",
                    sourceBlockIds: [governorBlock.blockId],
                  },
                ],
              },
            ],
          };
        return validResponse(unit);
      });
    const manifest = buildADrivenSemanticManifest({ plan, responses });
    const requirement = manifest.requirements.find(({ sourceUnitIds }) =>
      sourceUnitIds.includes(list.unitId)
    );

    expect(manifest.summary.unresolvedUnits).toBe(0);
    expect(requirement.sourceBlockIds).toEqual([
      governorBlock.blockId,
      listBlock.blockId,
    ]);
    expect(requirement.sourceUnitIds).toEqual([governor.unitId, list.unitId]);
    expect(requirement.sourceSpans).toHaveLength(2);
  });

  test("shares an owned list governor across item requirements without treating it as an item", () => {
    const source = artifact(
      [
        "Seite 1\n• Mitversichert sind Schadenersatzverpflichtungen\n- des Hauseigentümers;\n- des Hausverwalters;\n",
      ],
      "7"
    );
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const unit = plan.units.find(({ source: unitSource }) =>
      unitSource.combinedText.includes("Mitversichert sind")
    );
    expect(unit.logicalSourceSegments).toHaveLength(3);
    const [governor, ...items] = unit.logicalSourceSegments;
    expect(
      unit.source.blocks.find(({ blockId }) => blockId === governor.blockIds[0])
        .structuralKind
    ).toBe("LIST_GOVERNOR");
    const itemRequirements = items.map((segment) => ({
      displayLabel: segment.combinedText,
      components: [
        {
          type: "FACT_ROLE",
          label: segment.combinedText,
          sourceBlockIds: segment.blockIds,
        },
        {
          type: "COVERAGE_EFFECT",
          label: "Mitversichert sind",
          sourceBlockIds: governor.blockIds,
          coverageEffect: "INCLUDED",
        },
      ],
    }));
    const response = {
      unitId: unit.unitId,
      primaryClass: "OPERATIVE_COVERAGE_STATEMENT",
      semanticClasses: ["OPERATIVE_COVERAGE_STATEMENT"],
      requirements: itemRequirements,
    };

    const validManifest = buildADrivenSemanticManifest({
      plan,
      responses: [response],
    });
    expect(
      validManifest.unitTerminals.find(({ unitId }) => unitId === unit.unitId)
        .terminalDisposition
    ).toBe("OPERATIVE_MAPPED");

    const standaloneManifest = buildADrivenSemanticManifest({
      plan,
      responses: [
        {
          ...response,
          requirements: [
            {
              displayLabel: governor.combinedText,
              components: [
                {
                  type: "COVERAGE_EFFECT",
                  label: "Mitversichert sind",
                  sourceBlockIds: governor.blockIds,
                  coverageEffect: "INCLUDED",
                },
              ],
            },
            ...itemRequirements,
          ],
        },
      ],
    });
    expect(
      standaloneManifest.unitTerminals
        .find(({ unitId }) => unitId === unit.unitId)
        .diagnostics.map(({ code }) => code)
    ).toContain("LIST_GOVERNOR_REQUIREMENT_STANDALONE");

    const uncoveredManifest = buildADrivenSemanticManifest({
      plan,
      responses: [
        {
          unitId: unit.unitId,
          primaryClass: "INSURED_OBJECT",
          semanticClasses: ["INSURED_OBJECT"],
          requirements: items.map((segment) => ({
            displayLabel: segment.combinedText,
            components: [
              {
                type: "OBJECT",
                label: segment.combinedText,
                sourceBlockIds: segment.blockIds,
              },
            ],
          })),
        },
      ],
    });
    expect(
      uncoveredManifest.unitTerminals.find(
        ({ unitId }) => unitId === unit.unitId
      ).diagnostics
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "OPERATIVE_UNIT_BLOCK_COVERAGE_INCOMPLETE",
          blockIds: governor.blockIds,
          uncoveredBlocks: [
            expect.objectContaining({
              blockId: governor.blockIds[0],
              structuralKind: "LIST_GOVERNOR",
              exactText: governor.combinedText,
            }),
          ],
        }),
      ])
    );
  });

  test("keeps same-level bullet segments as independent operative items", () => {
    const source = artifact(
      ["Seite 1\n• Sprengstoffexplosion;\n• Blitzschlag;\n"],
      "8"
    );
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const unit = plan.units.find(({ source: unitSource }) =>
      unitSource.combinedText.includes("Sprengstoffexplosion")
    );
    expect(unit.logicalSourceSegments).toHaveLength(2);
    expect(
      unit.logicalSourceSegments.map(
        ({ blockIds }) =>
          unit.source.blocks.find(({ blockId }) => blockId === blockIds[0])
            .structuralKind
      )
    ).toEqual(["LIST_GOVERNOR", "LIST_GOVERNOR"]);

    const response = {
      unitId: unit.unitId,
      primaryClass: "PERIL_OR_DAMAGE",
      semanticClasses: ["PERIL_OR_DAMAGE"],
      requirements: unit.logicalSourceSegments.map((segment) => ({
        displayLabel: segment.combinedText,
        components: [
          {
            type: "PERIL_OR_CAUSE",
            label: segment.combinedText,
            sourceBlockIds: segment.blockIds,
          },
        ],
      })),
    };
    const manifest = buildADrivenSemanticManifest({
      plan,
      responses: [response],
    });
    const terminal = manifest.unitTerminals.find(
      ({ unitId }) => unitId === unit.unitId
    );

    expect(terminal.terminalDisposition).toBe("OPERATIVE_MAPPED");
    expect(terminal.diagnostics).toEqual([]);
    expect(
      manifest.requirements.filter(({ sourceUnitIds }) =>
        sourceUnitIds.includes(unit.unitId)
      )
    ).toHaveLength(2);
  });

  test("keeps a cross-page list clause together while page furniture stays independently owned", () => {
    const source = artifact(
      [
        "Seite 1\nDECKUNG\nZusätzlich sind mitversichert, wenn der Versicherungsnehmer ersatzpflichtig ist, Schäden durch\n- Bewegliche Gegenstände sowie unbewegliche",
        "Seite 2\nGegenstände auf dem Grundstück wie Laternen und Schwimmbecken;\n- Inhalt von Heizöltanks;\n- Erdkabel;\n",
      ],
      "c"
    );
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const continued = plan.units.find(({ source: unitSource }) =>
      unitSource.combinedText.includes("Bewegliche Gegenstände")
    );
    const followingList = plan.units.find(({ source: unitSource }) =>
      unitSource.combinedText.includes("Inhalt von Heizöltanks")
    );
    const pageFurniture = plan.units.find(
      ({ unitKind, source: unitSource }) =>
        unitKind === "METADATA" && unitSource.combinedText.includes("Seite 2")
    );
    const continuation = plan.relations.find(
      ({ type, fromUnitId, toUnitId }) =>
        type === "CONTINUES_ON_NEXT_PAGE" &&
        fromUnitId === continued.unitId &&
        toUnitId === continued.unitId
    );

    expect(continued.unitKind).toBe("LIST");
    expect(continued.source.physicalPages).toEqual([1, 2]);
    expect(continued.source.combinedText).toContain(
      "Gegenstände auf dem Grundstück"
    );
    expect(continued.source.contiguous).toBe(false);
    expect(continued.logicalSourceSegments).toHaveLength(1);
    expect(continued.logicalSourceSegments[0].blockIds).toEqual(
      continued.source.blockIds
    );
    const classificationUnit = buildADrivenClassificationBatches(plan)
      .batches.flatMap(({ units }) => units)
      .find(({ unitId }) => unitId === continued.unitId);
    expect(classificationUnit.logicalSourceSegments).toEqual(
      continued.logicalSourceSegments
    );
    expect(pageFurniture.source.blockIds).toHaveLength(1);
    expect(continuation.fromBlockId).toBe(continued.source.blockIds[0]);
    expect(continuation.toBlockId).toBe(continued.source.blockIds[1]);
    expect(followingList.governingContext.combinedText).toContain(
      "Zusätzlich sind mitversichert"
    );
    expect(followingList.logicalSourceSegments).toHaveLength(2);
    expect(
      plan.units.flatMap(({ source: unitSource }) => unitSource.blockIds)
    ).toHaveLength(plan.summary.sourceBlocks);

    const splitResponse = {
      unitId: continued.unitId,
      primaryClass: "INSURED_OBJECT",
      semanticClasses: ["INSURED_OBJECT"],
      requirements: continued.source.blocks.map((block) => ({
        displayLabel: block.exactText,
        components: [
          {
            type: "OBJECT",
            label: block.exactText,
            sourceBlockIds: [block.blockId],
          },
        ],
      })),
    };
    const splitManifest = buildADrivenSemanticManifest({
      plan,
      responses: [splitResponse],
    });
    expect(
      splitManifest.unitTerminals
        .find(({ unitId }) => unitId === continued.unitId)
        .diagnostics.map(({ code }) => code)
    ).toContain("LIST_CONTINUATION_SEGMENT_SPLIT");

    const joinedManifest = buildADrivenSemanticManifest({
      plan,
      responses: [
        {
          unitId: continued.unitId,
          primaryClass: "INSURED_OBJECT",
          semanticClasses: ["INSURED_OBJECT"],
          requirements: [
            {
              displayLabel: continued.source.combinedText,
              components: [
                {
                  type: "OBJECT",
                  label: continued.source.combinedText,
                  sourceBlockIds: continued.source.blockIds,
                },
              ],
            },
          ],
        },
      ],
    });
    expect(
      joinedManifest.unitTerminals.find(
        ({ unitId }) => unitId === continued.unitId
      ).terminalDisposition
    ).toBe("OPERATIVE_MAPPED");

    const mergedListManifest = buildADrivenSemanticManifest({
      plan,
      responses: [
        {
          unitId: followingList.unitId,
          primaryClass: "INSURED_OBJECT",
          semanticClasses: ["INSURED_OBJECT"],
          requirements: [
            {
              displayLabel: followingList.source.blocks[0].exactText,
              components: followingList.source.blocks.map((block) => ({
                type: "OBJECT",
                label: block.exactText,
                sourceBlockIds: [block.blockId],
              })),
            },
          ],
        },
      ],
    });
    expect(
      mergedListManifest.unitTerminals
        .find(({ unitId }) => unitId === followingList.unitId)
        .diagnostics.map(({ code }) => code)
    ).toContain("LIST_SOURCE_SEGMENTS_MERGED");
  });

  test("does not report an unpunctuated page footer as a heading continuation", () => {
    const source = artifact(
      [
        "Seite 1\nVERSICHERUNG AG",
        "Seite 2\nPRÄAMBEL\nVersichert sind Gebäude.\n",
      ],
      "d"
    );
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });

    expect(
      plan.relations.filter(({ type }) => type === "CONTINUES_ON_NEXT_PAGE")
    ).toEqual([]);
    expect(
      plan.units
        .flatMap(({ source: unitSource }) => unitSource.blocks)
        .every(({ structuralKind }) => typeof structuralKind === "string")
    ).toBe(true);
  });

  test("materializes multiple requirements from one bounded unit and owns final IDs", () => {
    const source = artifact(
      ["Seite 1\nDECKUNG\nVersichert sind Garage und Carport.\n"],
      "c"
    );
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const clause = plan.units.find(({ unitKind }) => unitKind === "CLAUSE");
    const responses = plan.units
      .filter(
        ({ initialDisposition }) =>
          initialDisposition !== "NON_OPERATIVE_TERMINAL"
      )
      .map(validResponse);
    const response = responses.find(({ unitId }) => unitId === clause.unitId);
    const blockId = clause.source.blocks.find(({ exactText }) =>
      exactText.includes("Garage und Carport")
    ).blockId;
    response.requirements = ["Garage", "Carport"].map((label) => ({
      displayLabel: label,
      components: [
        { type: "OBJECT", label, sourceBlockIds: [blockId] },
        {
          type: "COVERAGE_EFFECT",
          label: "Versichert",
          coverageEffect: "INCLUDED",
          sourceBlockIds: [blockId],
        },
      ],
    }));

    const manifest = buildADrivenSemanticManifest({ plan, responses });
    const reorderedResponses = JSON.parse(JSON.stringify(responses));
    reorderedResponses
      .find(({ unitId }) => unitId === clause.unitId)
      .requirements.reverse();
    const reordered = buildADrivenSemanticManifest({
      plan,
      responses: reorderedResponses.reverse(),
    });

    expect(manifest.summary.allBlocksTerminal).toBe(true);
    expect(manifest.summary.unresolvedUnits).toBe(0);
    expect(
      manifest.requirements.filter(({ sourceUnitIds }) =>
        sourceUnitIds.includes(clause.unitId)
      )
    ).toHaveLength(2);
    expect(
      manifest.requirements.every(({ requirementId }) =>
        /^AR-[a-f0-9]{24}$/u.test(requirementId)
      )
    ).toBe(true);
    expect(reordered.manifestSha256).toBe(manifest.manifestSha256);
  });

  test("turns missing, duplicate, unknown and invalid model IDs into visible unresolved state", () => {
    const source = artifact(
      ["Seite 1\nDeckung\nVersichert sind Gebäude.\n\nSelbstbehalt EUR 500.\n"],
      "d"
    );
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const pending = plan.units.filter(
      ({ initialDisposition }) =>
        initialDisposition === "PENDING_CLASSIFICATION"
    );
    const duplicate = validResponse(pending[0]);
    const manifest = buildADrivenSemanticManifest({
      plan,
      responses: [
        duplicate,
        duplicate,
        { ...validResponse(pending[1]), unitId: "AU-unknown" },
      ],
    });

    expect(manifest.summary.allBlocksTerminal).toBe(true);
    expect(manifest.summary.unresolvedUnits).toBe(pending.length);
    expect(manifest.summary.reviewRequiredBlocks).toBeGreaterThan(0);
    expect(manifest.diagnostics.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "UNKNOWN_UNIT_ID",
        "DUPLICATE_UNIT_RESPONSE",
        "MISSING_UNIT_RESPONSE",
      ])
    );
    expect(manifest.summary.responseIntegrityStatus).toBe("UNRESOLVED");
  });

  test("does not let an operative semantic class disappear as structure", () => {
    const source = artifact(["Seite 1\nLimit 10 % der Summe\n"], "9");
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const unit = plan.units.find(
      ({ initialDisposition }) =>
        initialDisposition === "PENDING_CLASSIFICATION"
    );
    const manifest = buildADrivenSemanticManifest({
      plan,
      responses: [
        {
          unitId: unit.unitId,
          primaryClass: "STRUCTURE",
          semanticClasses: ["STRUCTURE", "LIMIT"],
          requirements: [],
        },
      ],
    });
    expect(manifest.summary.unresolvedUnits).toBe(1);
    expect(
      manifest.blockTerminals.find(({ unitId }) => unitId === unit.unitId)
    ).toMatchObject({
      terminalDisposition: "UNRESOLVED_REVIEW_REQUIRED",
      reviewRequired: true,
    });
  });

  test("explains when primaryClass is missing from semanticClasses", () => {
    const source = artifact(["Seite 1\nVersichert sind Gebäude.\n"], "a");
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const unit = plan.units.find(
      ({ initialDisposition }) =>
        initialDisposition === "PENDING_CLASSIFICATION"
    );
    const manifest = buildADrivenSemanticManifest({
      plan,
      responses: [
        {
          ...validResponse(unit),
          primaryClass: "OPERATIVE_COVERAGE_STATEMENT",
          semanticClasses: ["INSURED_OBJECT"],
        },
      ],
    });

    expect(manifest.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "INVALID_UNIT_CLASSIFICATION",
          primaryClass: "OPERATIVE_COVERAGE_STATEMENT",
          semanticClasses: ["INSURED_OBJECT"],
          reasons: ["PRIMARY_CLASS_MISSING_FROM_SEMANTIC_CLASSES"],
        }),
      ])
    );
  });

  test("keeps layout-only bullet blocks owned without inventing semantic components", () => {
    const source = artifact(
      ["Seite 1\nDECKUNG\nVersichert sind Gebäude.\n"],
      "b"
    );
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const unit = plan.units.find(({ unitKind }) => unitKind === "CLAUSE");
    const sourceBlock = unit.source.blocks[0];
    const markerBlockId = crypto
      .createHash("sha256")
      .update("marker")
      .digest("hex");
    const markerBlock = {
      ...sourceBlock,
      blockId: markerBlockId,
      exactText: "•",
      exactTextSha256: crypto.createHash("sha256").update("•").digest("hex"),
    };
    unit.source.blocks.push(markerBlock);
    unit.source.blockIds.push(markerBlockId);
    unit.source.combinedText += "\n•";
    plan.summary.sourceBlocks += 1;
    const responses = plan.units
      .filter(
        ({ initialDisposition }) =>
          initialDisposition === "PENDING_CLASSIFICATION"
      )
      .map((plannedUnit) =>
        plannedUnit.unitId === unit.unitId
          ? {
              unitId: unit.unitId,
              primaryClass: "OPERATIVE_COVERAGE_STATEMENT",
              semanticClasses: [
                "OPERATIVE_COVERAGE_STATEMENT",
                "INSURED_OBJECT",
              ],
              requirements: [
                {
                  displayLabel: sourceBlock.exactText,
                  components: [
                    {
                      type: "OBJECT",
                      label: sourceBlock.exactText,
                      sourceBlockIds: [sourceBlock.blockId],
                    },
                    {
                      type: "COVERAGE_EFFECT",
                      label: sourceBlock.exactText,
                      coverageEffect: "INCLUDED",
                      sourceBlockIds: [sourceBlock.blockId],
                    },
                  ],
                },
              ],
            }
          : validResponse(plannedUnit)
      );

    const manifest = buildADrivenSemanticManifest({ plan, responses });
    const markerTerminal = manifest.blockTerminals.find(
      ({ blockId }) => blockId === markerBlockId
    );

    expect(manifest.summary.unresolvedUnits).toBe(0);
    expect(markerTerminal).toMatchObject({
      terminalDisposition: "NON_OPERATIVE_TERMINAL",
      primaryClass: "STRUCTURE",
      requirementIds: [],
      reviewRequired: false,
    });
  });

  test("reports a requirement label taken only from outside the owned unit", () => {
    const source = artifact(
      ["Seite 1\nDECKUNG\nVersichert sind Gebäude.\n"],
      "c"
    );
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const unit = plan.units.find(({ unitKind }) => unitKind === "CLAUSE");
    const responses = plan.units
      .filter(
        ({ initialDisposition }) =>
          initialDisposition === "PENDING_CLASSIFICATION"
      )
      .map((plannedUnit) => {
        const response = validResponse(plannedUnit);
        if (plannedUnit.unitId === unit.unitId)
          response.requirements[0].displayLabel = "nur aus Governor-Kontext";
        return response;
      });

    const manifest = buildADrivenSemanticManifest({ plan, responses });

    expect(manifest.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "REQUIREMENT_DISPLAY_LABEL_OUTSIDE_OWNED_SOURCE",
          unitId: unit.unitId,
          requirementIndex: 0,
          invalidLiteralValue: "nur aus Governor-Kontext",
          allowedEvidence: unit.source.blocks.map(({ blockId, exactText }) => ({
            blockId,
            exactText,
          })),
        }),
      ])
    );
  });

  test("reports declared, rejected and allowed IDs for out-of-scope evidence", () => {
    const source = artifact(["Seite 1\nVersichert sind Gebäude.\n"], "d");
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const unit = plan.units.find(
      ({ initialDisposition }) =>
        initialDisposition === "PENDING_CLASSIFICATION"
    );
    const response = validResponse(unit);
    const foreignBlockId = "f".repeat(64);
    response.requirements[0].components[0].sourceBlockIds = [foreignBlockId];
    const manifest = buildADrivenSemanticManifest({
      plan,
      responses: [response],
    });

    expect(manifest.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "COMPONENT_SOURCE_BLOCK_ID_OUT_OF_SCOPE",
          declaredSourceBlockIds: [foreignBlockId],
          outOfScopeBlockIds: [foreignBlockId],
          allowedSourceBlockIds: unit.source.blockIds,
          requiredSourceBlockIds: unit.source.blockIds,
        }),
      ])
    );
  });

  test("reports an invented component literal without silently replacing it", () => {
    const source = artifact(["Seite 1\nAustritt von Wasser.\n"], "e");
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const unit = plan.units.find(
      ({ initialDisposition }) =>
        initialDisposition === "PENDING_CLASSIFICATION"
    );
    const response = validResponse(unit);
    response.primaryClass = "PERIL_OR_DAMAGE";
    response.semanticClasses = ["PERIL_OR_DAMAGE"];
    response.requirements[0].components = [
      {
        type: "PERIL_OR_CAUSE",
        label: unit.source.blocks[0].exactText,
        sourceBlockIds: [unit.source.blockIds[0]],
      },
      {
        type: "COVERAGE_EFFECT",
        label: "versichert",
        coverageEffect: "INCLUDED",
        sourceBlockIds: [unit.source.blockIds[0]],
      },
    ];
    const manifest = buildADrivenSemanticManifest({
      plan,
      responses: [response],
    });

    expect(manifest.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "COMPONENT_SOURCE_TEXT_INVALID",
          componentType: "COVERAGE_EFFECT",
          invalidLiteralValues: ["versichert"],
          declaredSourceBlockIds: [unit.source.blockIds[0]],
          declaredSourceExactText: unit.source.blocks[0].exactText,
          allowedEvidence: expect.arrayContaining([
            expect.objectContaining({ blockId: unit.source.blockIds[0] }),
          ]),
        }),
      ])
    );
  });

  test("canonicalizes only a whole declared source range dehyphenated by layout", () => {
    const source = artifact(
      ["Seite 1\n- Bundes-\nUmwelthaftungsgesetz.\n"],
      "f"
    );
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const unit = plan.units.find(
      ({ initialDisposition }) =>
        initialDisposition === "PENDING_CLASSIFICATION"
    );
    const normalizedLabel = "- Bundes-Umwelthaftungsgesetz.";
    const response = {
      unitId: unit.unitId,
      primaryClass: "INSURED_OBJECT",
      semanticClasses: ["INSURED_OBJECT"],
      requirements: [
        {
          displayLabel: normalizedLabel,
          components: [
            {
              type: "OBJECT",
              label: normalizedLabel,
              sourceBlockIds: unit.source.blockIds,
            },
          ],
        },
      ],
    };
    const manifest = buildADrivenSemanticManifest({
      plan,
      responses: [response],
    });
    const requirement = manifest.requirements.find(({ sourceUnitIds }) =>
      sourceUnitIds.includes(unit.unitId)
    );

    expect(manifest.summary.unresolvedUnits).toBe(0);
    expect(requirement.displayLabel).toBe(unit.source.combinedText.trim());
    expect(requirement.components[0].label).toBe(
      unit.source.combinedText.trim()
    );
  });

  test("canonicalizes a case-only literal from its declared source block", () => {
    const source = artifact(["Seite 1\nNicht versichert sind Gebäude.\n"], "0");
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const unit = plan.units.find(
      ({ initialDisposition }) =>
        initialDisposition === "PENDING_CLASSIFICATION"
    );
    const manifest = buildADrivenSemanticManifest({
      plan,
      responses: [
        {
          unitId: unit.unitId,
          primaryClass: "EXCLUSION",
          semanticClasses: ["EXCLUSION"],
          requirements: [
            {
              displayLabel: unit.source.combinedText,
              components: [
                {
                  type: "OBJECT",
                  label: "Gebäude",
                  sourceBlockIds: unit.source.blockIds,
                },
                {
                  type: "COVERAGE_EFFECT",
                  label: "nicht versichert",
                  sourceBlockIds: unit.source.blockIds,
                  coverageEffect: "EXCLUDED",
                },
              ],
            },
          ],
        },
      ],
    });
    const requirement = manifest.requirements.find(({ sourceUnitIds }) =>
      sourceUnitIds.includes(unit.unitId)
    );

    expect(manifest.summary.unresolvedUnits).toBe(0);
    expect(
      requirement.components.find(({ type }) => type === "COVERAGE_EFFECT")
        .label
    ).toBe("Nicht versichert");
  });

  test("accepts Versicherungsschutz besteht in either German word order", () => {
    const source = artifact(
      ["Seite 1\nEs besteht Versicherungsschutz für Nebengebäude.\n"],
      "2"
    );
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const unit = plan.units.find(
      ({ initialDisposition }) =>
        initialDisposition === "PENDING_CLASSIFICATION"
    );
    const manifest = buildADrivenSemanticManifest({
      plan,
      responses: [
        {
          unitId: unit.unitId,
          primaryClass: "OPERATIVE_COVERAGE_STATEMENT",
          semanticClasses: ["OPERATIVE_COVERAGE_STATEMENT", "INSURED_OBJECT"],
          requirements: [
            {
              displayLabel: unit.source.combinedText,
              components: [
                {
                  type: "OBJECT",
                  label: "Nebengebäude",
                  sourceBlockIds: unit.source.blockIds,
                },
                {
                  type: "COVERAGE_EFFECT",
                  label: "besteht Versicherungsschutz",
                  sourceBlockIds: unit.source.blockIds,
                  coverageEffect: "INCLUDED",
                },
              ],
            },
          ],
        },
      ],
    });

    expect(manifest.summary.unresolvedUnits).toBe(0);
  });

  test("accepts erstreckt sich dabei nicht as an exclusion effect", () => {
    const source = artifact(
      ["Seite 1\nDie Versicherung erstreckt sich dabei nicht auf Schäden.\n"],
      "3"
    );
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const unit = plan.units.find(
      ({ initialDisposition }) =>
        initialDisposition === "PENDING_CLASSIFICATION"
    );
    const manifest = buildADrivenSemanticManifest({
      plan,
      responses: [
        {
          unitId: unit.unitId,
          primaryClass: "EXCLUSION",
          semanticClasses: ["EXCLUSION", "PERIL_OR_DAMAGE"],
          requirements: [
            {
              displayLabel: unit.source.combinedText,
              components: [
                {
                  type: "DAMAGE_OR_EFFECT",
                  label: "Schäden",
                  sourceBlockIds: unit.source.blockIds,
                },
                {
                  type: "COVERAGE_EFFECT",
                  label: "erstreckt sich dabei nicht",
                  sourceBlockIds: unit.source.blockIds,
                  coverageEffect: "EXCLUDED",
                },
              ],
            },
          ],
        },
      ],
    });

    expect(manifest.summary.unresolvedUnits).toBe(0);
  });

  test("accepts bezieht sich in Abänderung auch auf as an inclusion effect", () => {
    const source = artifact(
      [
        "Seite 1\nDer Versicherungsschutz bezieht sich in Abänderung von Art. 7 auch auf Sachschäden.\n",
      ],
      "4"
    );
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const unit = plan.units.find(
      ({ initialDisposition }) =>
        initialDisposition === "PENDING_CLASSIFICATION"
    );
    const manifest = buildADrivenSemanticManifest({
      plan,
      responses: [
        {
          unitId: unit.unitId,
          primaryClass: "OPERATIVE_COVERAGE_STATEMENT",
          semanticClasses: ["OPERATIVE_COVERAGE_STATEMENT", "PERIL_OR_DAMAGE"],
          requirements: [
            {
              displayLabel: unit.source.combinedText,
              components: [
                {
                  type: "DAMAGE_OR_EFFECT",
                  label: "Sachschäden",
                  sourceBlockIds: unit.source.blockIds,
                },
                {
                  type: "COVERAGE_EFFECT",
                  label: "bezieht sich in Abänderung von Art. 7 auch auf",
                  sourceBlockIds: unit.source.blockIds,
                  coverageEffect: "INCLUDED",
                },
              ],
            },
          ],
        },
      ],
    });

    expect(manifest.summary.unresolvedUnits).toBe(0);
  });

  test("accepts erstattet as a cost coverage effect", () => {
    const source = artifact(
      ["Seite 1\nDie erforderlichen Kosten werden erstattet.\n"],
      "4"
    );
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const unit = plan.units.find(
      ({ initialDisposition }) =>
        initialDisposition === "PENDING_CLASSIFICATION"
    );
    const manifest = buildADrivenSemanticManifest({
      plan,
      responses: [
        {
          unitId: unit.unitId,
          primaryClass: "OPERATIVE_COVERAGE_STATEMENT",
          semanticClasses: ["OPERATIVE_COVERAGE_STATEMENT", "COST"],
          requirements: [
            {
              displayLabel: unit.source.combinedText,
              components: [
                {
                  type: "FACT_ROLE",
                  label: "Kosten",
                  sourceBlockIds: unit.source.blockIds,
                },
                {
                  type: "COVERAGE_EFFECT",
                  label: "erstattet",
                  sourceBlockIds: unit.source.blockIds,
                  coverageEffect: "INCLUDED",
                },
              ],
            },
          ],
        },
      ],
    });

    expect(manifest.summary.unresolvedUnits).toBe(0);
  });

  test("canonicalizes one unambiguous OCR character in a long source label", () => {
    const source = artifact(
      [
        "Seite 1\nVersichert sind Gebäude, die zum Neuwert zu ersetzten sind.\n",
      ],
      "5"
    );
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const unit = plan.units.find(
      ({ initialDisposition }) =>
        initialDisposition === "PENDING_CLASSIFICATION"
    );
    const manifest = buildADrivenSemanticManifest({
      plan,
      responses: [
        {
          unitId: unit.unitId,
          primaryClass: "OPERATIVE_COVERAGE_STATEMENT",
          semanticClasses: ["OPERATIVE_COVERAGE_STATEMENT", "INSURED_OBJECT"],
          requirements: [
            {
              displayLabel:
                "Versichert sind Gebäude, die zum Neuwert zu ersetzen sind.",
              components: [
                {
                  type: "OBJECT",
                  label: "Gebäude",
                  sourceBlockIds: unit.source.blockIds,
                },
                {
                  type: "COVERAGE_EFFECT",
                  label: "Versichert",
                  sourceBlockIds: unit.source.blockIds,
                  coverageEffect: "INCLUDED",
                },
              ],
            },
          ],
        },
      ],
    });

    expect(manifest.summary.unresolvedUnits).toBe(0);
    expect(manifest.requirements[0].displayLabel).toBe(
      "Versichert sind Gebäude, die zum Neuwert zu ersetzten sind."
    );
  });

  test.each([
    "erwirbt den Anspruch auf Zahlung",
    "erfolgt die Entschädigung nach dem Zeitwert",
    "Neuwertentschädigung geleistet wird",
    "zum Neuwert zu ersetzten",
  ])("accepts a source-bound indemnity effect: %s", (effectLabel) => {
    const source = artifact(
      [`Seite 1\nVersicherte Leistung: ${effectLabel}.\n`],
      "6"
    );
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const unit = plan.units.find(
      ({ initialDisposition }) =>
        initialDisposition === "PENDING_CLASSIFICATION"
    );
    const manifest = buildADrivenSemanticManifest({
      plan,
      responses: [
        {
          unitId: unit.unitId,
          primaryClass: "OPERATIVE_COVERAGE_STATEMENT",
          semanticClasses: ["OPERATIVE_COVERAGE_STATEMENT"],
          requirements: [
            {
              displayLabel: unit.source.combinedText,
              components: [
                {
                  type: "COVERAGE_EFFECT",
                  label: effectLabel,
                  sourceBlockIds: unit.source.blockIds,
                  coverageEffect: "INCLUDED",
                },
              ],
            },
          ],
        },
      ],
    });

    expect(manifest.summary.unresolvedUnits).toBe(0);
  });

  test.each(["Der", "Desgleichen"])(
    "trims only an uncited nonsemantic boundary token: %s",
    (boundaryToken) => {
      const source = artifact(
        [
          `Seite 1\nDer Neubauwert gilt. ${boundaryToken} \nVersicherungsnehmer erwirbt den Anspruch auf Zahlung.\n`,
        ],
        "7"
      );
      const plan = buildADrivenSourceUnitPlan({
        documents: [document("source", 0, source)],
      });
      const unit = plan.units.find(
        ({ initialDisposition, source: unitSource }) =>
          initialDisposition === "PENDING_CLASSIFICATION" &&
          unitSource.blocks.length > 1
      );
      const [definitionBlock, claimBlock] = unit.source.blocks;
      const manifest = buildADrivenSemanticManifest({
        plan,
        responses: [
          {
            unitId: unit.unitId,
            primaryClass: "OPERATIVE_COVERAGE_STATEMENT",
            semanticClasses: ["OPERATIVE_COVERAGE_STATEMENT", "DEFINITION"],
            requirements: [
              {
                displayLabel: definitionBlock.exactText,
                components: [
                  {
                    type: "FACT_ROLE",
                    label: definitionBlock.exactText,
                    sourceBlockIds: [definitionBlock.blockId],
                  },
                ],
              },
              {
                displayLabel: `${boundaryToken} Versicherungsnehmer erwirbt den Anspruch auf Zahlung.`,
                components: [
                  {
                    type: "COVERAGE_EFFECT",
                    label: "erwirbt den Anspruch auf Zahlung",
                    sourceBlockIds: [claimBlock.blockId],
                    coverageEffect: "INCLUDED",
                  },
                ],
              },
            ],
          },
        ],
      });

      expect(manifest.summary.unresolvedUnits).toBe(0);
      expect(manifest.requirements[1].displayLabel).toBe(
        "Versicherungsnehmer erwirbt den Anspruch auf Zahlung."
      );
    }
  );

  test("rejects a coverage effect component whose label is not a coverage effect", () => {
    const source = artifact(
      ["Seite 1\nNicht versichert sind Vorschäden.\n"],
      "1"
    );
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const unit = plan.units.find(
      ({ initialDisposition }) =>
        initialDisposition === "PENDING_CLASSIFICATION"
    );
    const response = validResponse(unit);
    response.primaryClass = "EXCLUSION";
    response.semanticClasses = ["EXCLUSION"];
    response.requirements[0].components = [
      {
        type: "OBJECT",
        label: "Vorschäden",
        sourceBlockIds: unit.source.blockIds,
      },
      {
        type: "COVERAGE_EFFECT",
        label: "Vorschäden",
        sourceBlockIds: unit.source.blockIds,
        coverageEffect: "EXCLUDED",
      },
    ];

    const manifest = buildADrivenSemanticManifest({
      plan,
      responses: [response],
    });

    expect(manifest.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "COVERAGE_EFFECT_LABEL_INVALID",
          invalidLiteralValue: "Vorschäden",
          allowedCoverageEffectEvidence: [
            expect.objectContaining({ blockId: unit.source.blockIds[0] }),
          ],
        }),
      ])
    );
  });

  test("accepts an insurer waiver of objections as a literal coverage effect", () => {
    const source = artifact(
      [
        "Seite 1\nBei versicherten Schäden verzichtet der Versicherer auf den Einwand der Gefahrenerhöhung.\n",
      ],
      "a"
    );
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const unit = plan.units.find(
      ({ initialDisposition }) =>
        initialDisposition === "PENDING_CLASSIFICATION"
    );
    const block = unit.source.blocks[0];
    const manifest = buildADrivenSemanticManifest({
      plan,
      responses: [
        {
          unitId: unit.unitId,
          primaryClass: "OPERATIVE_COVERAGE_STATEMENT",
          semanticClasses: ["OPERATIVE_COVERAGE_STATEMENT"],
          requirements: [
            {
              displayLabel: block.exactText,
              components: [
                {
                  type: "COVERAGE_EFFECT",
                  label:
                    "verzichtet der Versicherer auf den Einwand der Gefahrenerhöhung",
                  sourceBlockIds: [block.blockId],
                  coverageEffect: "INCLUDED",
                },
              ],
            },
          ],
        },
      ],
    });

    expect(manifest.summary.unresolvedUnits).toBe(0);
    expect(manifest.diagnostics).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "COVERAGE_EFFECT_LABEL_INVALID" }),
      ])
    );
  });

  test("accepts an express exception as a literal excluded coverage effect", () => {
    const source = artifact(
      ["Seite 1\nVom Summenausgleich ausgenommen sind Erst-Risiko-Summen.\n"],
      "c"
    );
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const unit = plan.units.find(
      ({ initialDisposition }) =>
        initialDisposition === "PENDING_CLASSIFICATION"
    );
    const block = unit.source.blocks[0];
    const manifest = buildADrivenSemanticManifest({
      plan,
      responses: [
        {
          unitId: unit.unitId,
          primaryClass: "EXCLUSION",
          semanticClasses: ["EXCLUSION"],
          requirements: [
            {
              displayLabel: block.exactText,
              components: [
                {
                  type: "OBJECT",
                  label: "Erst-Risiko-Summen",
                  sourceBlockIds: [block.blockId],
                },
                {
                  type: "COVERAGE_EFFECT",
                  label: "ausgenommen sind",
                  sourceBlockIds: [block.blockId],
                  coverageEffect: "EXCLUDED",
                },
              ],
            },
          ],
        },
      ],
    });

    expect(manifest.summary.unresolvedUnits).toBe(0);
    expect(manifest.diagnostics).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "COVERAGE_EFFECT_LABEL_INVALID" }),
      ])
    );
  });

  test("accepts exklusive as a literal excluded coverage effect", () => {
    const source = artifact(
      ["Seite 1\nKellerabteile, jedoch exklusive deren Inhalt.\n"],
      "b"
    );
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const unit = plan.units.find(
      ({ initialDisposition }) =>
        initialDisposition === "PENDING_CLASSIFICATION"
    );
    const block = unit.source.blocks[0];
    const manifest = buildADrivenSemanticManifest({
      plan,
      responses: [
        {
          unitId: unit.unitId,
          primaryClass: "EXCLUSION",
          semanticClasses: ["EXCLUSION", "INSURED_OBJECT"],
          requirements: [
            {
              displayLabel: block.exactText,
              components: [
                {
                  type: "OBJECT",
                  label: "Kellerabteile",
                  sourceBlockIds: [block.blockId],
                },
                {
                  type: "COVERAGE_EFFECT",
                  label: "exklusive",
                  sourceBlockIds: [block.blockId],
                  coverageEffect: "EXCLUDED",
                },
              ],
            },
          ],
        },
      ],
      semanticSignalContractId: A_SEMANTIC_SIGNAL_CONTRACT_ID,
    });

    expect(manifest.summary.unresolvedUnits).toBe(0);
  });

  test("rejects semantic attributes attached to the wrong component type", () => {
    const source = artifact(
      ["Seite 1\nDECKUNG\nVersichert sind Gebäude.\n"],
      "7"
    );
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const unit = plan.units.find(({ unitKind }) => unitKind === "CLAUSE");
    const block = unit.source.blocks[0];
    const manifest = buildADrivenSemanticManifest({
      plan,
      responses: [
        ...plan.units
          .filter(({ unitKind }) => unitKind === "HEADING")
          .map(validResponse),
        {
          unitId: unit.unitId,
          primaryClass: "INSURED_OBJECT",
          semanticClasses: ["INSURED_OBJECT"],
          requirements: [
            {
              displayLabel: block.exactText,
              components: [
                {
                  type: "OBJECT",
                  label: "Gebäude",
                  coverageEffect: "INCLUDED",
                  sourceBlockIds: [block.blockId],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(manifest.summary.unresolvedUnits).toBe(1);
    expect(manifest.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "INVALID_UNIT_ATOMIZATION" }),
        expect.objectContaining({ code: "COVERAGE_EFFECT_TYPE_INVALID" }),
      ])
    );
  });

  test("reports a missing literal raw value precisely for retry", () => {
    const source = artifact(
      ["Seite 1\nLIMIT\nBis zu 10% der Gebäudeversicherungssumme.\n"],
      "8"
    );
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const unit = plan.units.find(({ unitKind }) => unitKind === "CLAUSE");
    const block = unit.source.blocks[0];
    const manifest = buildADrivenSemanticManifest({
      plan,
      responses: [
        ...plan.units
          .filter(({ unitKind }) => unitKind === "HEADING")
          .map(validResponse),
        {
          unitId: unit.unitId,
          primaryClass: "LIMIT",
          semanticClasses: ["LIMIT"],
          requirements: [
            {
              displayLabel: block.exactText,
              components: [
                {
                  type: "VALUE_AND_UNIT",
                  label: "10%",
                  sourceBlockIds: [block.blockId],
                },
                {
                  type: "LIMIT_BASIS",
                  label: "Gebäudeversicherungssumme",
                  sourceBlockIds: [block.blockId],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(manifest.summary.unresolvedUnits).toBe(1);
    expect(manifest.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "VALUE_AND_UNIT_RAW_VALUE_MISSING",
          unitId: unit.unitId,
          requirementIndex: 0,
          componentIndex: 0,
        }),
      ])
    );
  });

  test("accepts a limit basis without inventing a numeric value", () => {
    const source = artifact(
      ["Seite 1\nLIMIT\nBis zur vereinbarten Versicherungssumme.\n"],
      "5"
    );
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const unit = plan.units.find(({ unitKind }) => unitKind === "CLAUSE");
    const block = unit.source.blocks[0];
    const manifest = buildADrivenSemanticManifest({
      plan,
      responses: plan.units
        .filter(
          ({ initialDisposition }) =>
            initialDisposition === "PENDING_CLASSIFICATION"
        )
        .map((plannedUnit) =>
          plannedUnit.unitId === unit.unitId
            ? {
                unitId: unit.unitId,
                primaryClass: "LIMIT",
                semanticClasses: ["LIMIT"],
                requirements: [
                  {
                    displayLabel: block.exactText,
                    components: [
                      {
                        type: "LIMIT_BASIS",
                        label: block.exactText,
                        sourceBlockIds: [block.blockId],
                      },
                    ],
                  },
                ],
              }
            : validResponse(plannedUnit)
        ),
    });

    expect(manifest.summary.unresolvedUnits).toBe(0);
    expect(manifest.requirements[0].components[0].type).toBe("LIMIT_BASIS");
  });

  test("rejects source IDs that omit a block used by a component label", () => {
    const source = artifact(
      [
        "Seite 1\nDEFINITION\nBetreuung durch die LF Immo\nVersicherungsmakler GmbH erfolgt.\n",
      ],
      "4"
    );
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const unit = plan.units.find(({ source: unitSource }) =>
      unitSource.combinedText.includes("Betreuung durch")
    );
    const responses = plan.units
      .filter(
        ({ initialDisposition }) =>
          initialDisposition === "PENDING_CLASSIFICATION"
      )
      .map((plannedUnit) =>
        plannedUnit.unitId === unit.unitId
          ? {
              unitId: unit.unitId,
              primaryClass: "DEFINITION",
              semanticClasses: ["DEFINITION"],
              requirements: [
                {
                  displayLabel: unit.source.combinedText,
                  components: [
                    {
                      type: "FACT_ROLE",
                      label: "LF Immo\nVersicherungsmakler GmbH",
                      sourceBlockIds: [unit.source.blockIds[0]],
                    },
                  ],
                },
              ],
            }
          : validResponse(plannedUnit)
      );
    const rejected = buildADrivenSemanticManifest({ plan, responses });
    expect(rejected.summary.unresolvedUnits).toBe(1);
    expect(rejected.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "COMPONENT_SOURCE_TEXT_INVALID",
          blockIds: [unit.source.blockIds[1]],
          declaredSourceBlockIds: [unit.source.blockIds[0]],
          requiredSourceBlockIds: unit.source.blockIds,
        }),
      ])
    );

    responses.find(
      ({ unitId }) => unitId === unit.unitId
    ).requirements[0].components[0].sourceBlockIds = unit.source.blockIds;
    const accepted = buildADrivenSemanticManifest({ plan, responses });
    const component = accepted.requirements.find(({ sourceUnitIds }) =>
      sourceUnitIds.includes(unit.unitId)
    ).components[0];
    expect(accepted.summary.unresolvedUnits).toBe(0);
    expect(component.sourceBlockIds).toEqual(unit.source.blockIds);
  });

  test("reports owned blocks omitted by an operative requirement", () => {
    const source = artifact(
      ["Seite 1\nDEFINITION\nProdukt gilt für\nVersicherungsmakler GmbH.\n"],
      "2"
    );
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const unit = plan.units.find(({ source: unitSource }) =>
      unitSource.combinedText.includes("Produkt gilt")
    );
    const lastBlock = unit.source.blocks.at(-1);
    const manifest = buildADrivenSemanticManifest({
      plan,
      responses: plan.units
        .filter(
          ({ initialDisposition }) =>
            initialDisposition === "PENDING_CLASSIFICATION"
        )
        .map((plannedUnit) =>
          plannedUnit.unitId === unit.unitId
            ? {
                unitId: unit.unitId,
                primaryClass: "DEFINITION",
                semanticClasses: ["DEFINITION"],
                requirements: [
                  {
                    displayLabel: unit.source.combinedText,
                    components: [
                      {
                        type: "FACT_ROLE",
                        label: lastBlock.exactText,
                        sourceBlockIds: [lastBlock.blockId],
                      },
                    ],
                  },
                ],
              }
            : validResponse(plannedUnit)
        ),
    });

    expect(manifest.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "REQUIREMENT_SOURCE_TEXT_INVALID",
          unitId: unit.unitId,
          requirementIndex: 0,
          invalidLiteralValue: unit.source.combinedText.trim(),
          selectedSourceBlockIds: [lastBlock.blockId],
          selectedSourceExactText: lastBlock.exactText,
          requiredSourceBlockIds: unit.source.blockIds,
        }),
        expect.objectContaining({
          code: "REQUIREMENT_OWNED_BLOCKS_UNCITED",
          unitId: unit.unitId,
          blockIds: [unit.source.blockIds[0]],
        }),
      ])
    );
  });

  test("reports the exact missing component group for a mixed definition", () => {
    const source = artifact(["Seite 1\nBrand ist ein Feuer.\n"], "1");
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const unit = plan.units.find(
      ({ initialDisposition }) =>
        initialDisposition === "PENDING_CLASSIFICATION"
    );
    const block = unit.source.blocks[0];
    const manifest = buildADrivenSemanticManifest({
      plan,
      responses: [
        {
          unitId: unit.unitId,
          primaryClass: "DEFINITION",
          semanticClasses: ["DEFINITION", "PERIL_OR_DAMAGE"],
          requirements: [
            {
              displayLabel: block.exactText,
              components: [
                {
                  type: "PERIL_OR_CAUSE",
                  label: "Brand",
                  sourceBlockIds: [block.blockId],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(manifest.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "UNIT_SEMANTIC_COMPONENTS_INCOMPLETE",
          unitId: unit.unitId,
          missingRequiredComponentGroups: [["FACT_ROLE"]],
          observedComponentTypes: ["PERIL_OR_CAUSE"],
        }),
      ])
    );
  });

  test("identifies an unsupported coverage class without literal effect evidence", () => {
    const source = artifact(
      [
        "Seite 1\nAustritt von Wasser aus Solarheizungsanlagen, wenn diese fix installiert sind.\n",
      ],
      "1"
    );
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const unit = plan.units.find(
      ({ initialDisposition }) =>
        initialDisposition === "PENDING_CLASSIFICATION"
    );
    const block = unit.source.blocks[0];
    const manifest = buildADrivenSemanticManifest({
      plan,
      responses: [
        {
          unitId: unit.unitId,
          primaryClass: "OPERATIVE_COVERAGE_STATEMENT",
          semanticClasses: ["PERIL_OR_DAMAGE", "OPERATIVE_COVERAGE_STATEMENT"],
          requirements: [
            {
              displayLabel: block.exactText,
              components: [
                {
                  type: "OBJECT",
                  label: block.exactText,
                  sourceBlockIds: [block.blockId],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(manifest.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "UNIT_SEMANTIC_COMPONENTS_INCOMPLETE",
          unitId: unit.unitId,
          missingRequiredComponentGroups: [
            ["PERIL_OR_CAUSE", "DAMAGE_OR_EFFECT"],
            ["COVERAGE_EFFECT"],
          ],
          observedComponentTypes: ["OBJECT"],
          unsupportedSemanticClasses: ["OPERATIVE_COVERAGE_STATEMENT"],
        }),
      ])
    );
  });

  test("normalizes a product configuration without effect evidence to definition and variant", () => {
    const source = artifact(
      [
        "Seite 1\nGrunddeckung der Versicherung ist das Produkt der Wohnhausversicherung mit der Variante PREMIUM in den jeweils beantragten Sparten.\n",
      ],
      "7"
    );
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const unit = plan.units.find(
      ({ initialDisposition }) =>
        initialDisposition === "PENDING_CLASSIFICATION"
    );
    const block = unit.source.blocks[0];
    const normalized = normalizeUnambiguousComponentTypes(
      [
        {
          unitId: unit.unitId,
          primaryClass: "OPERATIVE_COVERAGE_STATEMENT",
          semanticClasses: ["INSURED_OBJECT", "OPERATIVE_COVERAGE_STATEMENT"],
          requirements: [
            {
              displayLabel: block.exactText,
              components: [
                {
                  type: "OBJECT",
                  label:
                    "Grunddeckung der Versicherung ist das Produkt der Wohnhausversicherung mit der Variante PREMIUM",
                  sourceBlockIds: [block.blockId],
                },
                {
                  type: "FACT_ROLE",
                  label: "in den jeweils beantragten Sparten",
                  sourceBlockIds: [block.blockId],
                },
                {
                  type: "COVERAGE_EFFECT",
                  label: "ist",
                  sourceBlockIds: [block.blockId],
                  coverageEffect: "INCLUDED",
                },
              ],
            },
          ],
        },
      ],
      [unit]
    );

    expect(normalized.responses[0]).toMatchObject({
      primaryClass: "DEFINITION",
      semanticClasses: ["DEFINITION", "VARIANT"],
    });
    expect(
      normalized.responses[0].requirements[0].components.map(({ type }) => type)
    ).toEqual(["FACT_ROLE", "SCOPE", "SCOPE"]);
    expect(normalized.componentRepairs).toContainEqual({
      unitId: unit.unitId,
      action: "NORMALIZE_PRODUCT_CONFIGURATION_TO_DEFINITION",
    });
    expect(normalized.componentRepairs).toContainEqual({
      unitId: unit.unitId,
      action: "NORMALIZE_EXPLICIT_SCOPE_ROLE",
      fromType: "OBJECT",
      toType: "SCOPE",
      components: 1,
    });
    expect(
      normalized.responses[0].requirements[0].components.map(({ label }) =>
        label.trim()
      )
    ).toEqual([
      "Grunddeckung der Versicherung ist das Produkt der Wohnhausversicherung",
      "mit der Variante PREMIUM",
      "in den jeweils beantragten Sparten",
    ]);
    expect(normalized.componentRepairs).toContainEqual({
      unitId: unit.unitId,
      action: "SPLIT_EMBEDDED_EXPLICIT_SCOPE_ROLE",
      fromType: "OBJECT",
      scopeComponents: 1,
    });
    expect(normalized.componentRepairs).toContainEqual({
      unitId: unit.unitId,
      action: "NORMALIZE_EXPLICIT_SCOPE_ROLE",
      fromType: "FACT_ROLE",
      toType: "SCOPE",
      components: 1,
    });
  });

  test("rejoins split product subject and predicate into one source-bound fact relation", () => {
    const sourceText =
      "Grunddeckung der Versicherung ist das Produkt der Wohnhausversicherung mit der Variante PREMIUM in den jeweils beantragten Sparten.";
    const source = artifact([`Seite 1\n${sourceText}\n`], "a");
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const unit = plan.units.find(
      ({ initialDisposition }) =>
        initialDisposition === "PENDING_CLASSIFICATION"
    );
    const block = unit.source.blocks[0];
    const normalized = normalizeUnambiguousComponentTypes(
      [
        {
          unitId: unit.unitId,
          primaryClass: "DEFINITION",
          semanticClasses: ["DEFINITION", "VARIANT"],
          requirements: [
            {
              displayLabel: block.exactText,
              components: [
                {
                  type: "FACT_ROLE",
                  label: "Grunddeckung der Versicherung",
                  sourceBlockIds: [block.blockId],
                },
                {
                  type: "FACT_ROLE",
                  label: "Produkt der Wohnhausversicherung",
                  sourceBlockIds: [block.blockId],
                },
                {
                  type: "SCOPE",
                  label: "mit der Variante PREMIUM",
                  sourceBlockIds: [block.blockId],
                },
                {
                  type: "SCOPE",
                  label: "in den jeweils beantragten Sparten",
                  sourceBlockIds: [block.blockId],
                },
              ],
            },
          ],
        },
      ],
      [unit]
    );

    expect(
      normalized.responses[0].requirements[0].components.map(
        ({ type, label }) => [type, label.trim()]
      )
    ).toEqual([
      [
        "FACT_ROLE",
        "Grunddeckung der Versicherung ist das Produkt der Wohnhausversicherung",
      ],
      ["SCOPE", "mit der Variante PREMIUM"],
      ["SCOPE", "in den jeweils beantragten Sparten"],
    ]);
    expect(normalized.componentRepairs).toContainEqual({
      unitId: unit.unitId,
      requirementIndex: 0,
      action: "MERGE_PRODUCT_CONFIGURATION_FACT_RELATION",
      mergedFactRoles: 2,
    });
  });

  test("does not merge multiple product relations across a semicolon", () => {
    const sourceText =
      "Grunddeckung ist das Produkt BASIS; der Tarif ist PREMIUM mit der Variante PLUS in den jeweils beantragten Sparten.";
    const source = artifact([`Seite 1\n${sourceText}\n`], "b");
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const unit = plan.units.find(
      ({ initialDisposition }) =>
        initialDisposition === "PENDING_CLASSIFICATION"
    );
    const block = unit.source.blocks[0];
    const response = {
      unitId: unit.unitId,
      primaryClass: "DEFINITION",
      semanticClasses: ["DEFINITION", "VARIANT"],
      requirements: [
        {
          displayLabel: block.exactText,
          components: [
            {
              type: "FACT_ROLE",
              label: "Grunddeckung ist das Produkt BASIS",
              sourceBlockIds: [block.blockId],
            },
            {
              type: "FACT_ROLE",
              label: "der Tarif ist PREMIUM",
              sourceBlockIds: [block.blockId],
            },
            {
              type: "SCOPE",
              label: "mit der Variante PLUS",
              sourceBlockIds: [block.blockId],
            },
          ],
        },
      ],
    };
    const normalized = normalizeUnambiguousComponentTypes([response], [unit]);

    expect(normalized.responses[0].requirements[0].components).toEqual(
      response.requirements[0].components
    );
    expect(normalized.componentRepairs).not.toContainEqual(
      expect.objectContaining({
        action: "MERGE_PRODUCT_CONFIGURATION_FACT_RELATION",
      })
    );
  });

  test.each([
    [
      "Es gilt die für den Versicherungsnehmer im jeweiligen Schadensfall bessere Deckung.",
      ["SCOPE", "SCOPE", "PRECEDENCE_OR_REPLACEMENT"],
      [
        "für den Versicherungsnehmer",
        "im jeweiligen Schadensfall",
        "bessere Deckung",
      ],
    ],
    [
      "Es gilt im Versicherungsfall die günstigere Regelung.",
      ["SCOPE", "PRECEDENCE_OR_REPLACEMENT"],
      ["im Versicherungsfall", "günstigere Regelung"],
    ],
  ])(
    "normalizes a positive more-favorable selection rule: %s",
    (sourceText, expectedTypes, expectedLabels) => {
      const source = artifact([`Seite 1\n${sourceText}\n`], "8");
      const plan = buildADrivenSourceUnitPlan({
        documents: [document("source", 0, source)],
      });
      const unit = plan.units.find(
        ({ initialDisposition }) =>
          initialDisposition === "PENDING_CLASSIFICATION"
      );
      const block = unit.source.blocks[0];
      const normalized = normalizeUnambiguousComponentTypes(
        [
          {
            unitId: unit.unitId,
            primaryClass: "OPERATIVE_COVERAGE_STATEMENT",
            semanticClasses: ["OPERATIVE_COVERAGE_STATEMENT"],
            requirements: [
              {
                displayLabel: sourceText,
                components: [
                  {
                    type: "COVERAGE_EFFECT",
                    label: "gilt",
                    sourceBlockIds: [block.blockId],
                    coverageEffect: "INCLUDED",
                  },
                ],
              },
            ],
          },
        ],
        [unit]
      );

      expect(normalized.responses[0]).toMatchObject({
        primaryClass: "DOCUMENT_PRECEDENCE_OR_REPLACEMENT",
        semanticClasses: ["DOCUMENT_PRECEDENCE_OR_REPLACEMENT"],
      });
      expect(
        normalized.responses[0].requirements[0].components.map(
          ({ type }) => type
        )
      ).toEqual(expectedTypes);
      expect(
        normalized.responses[0].requirements[0].components.map(
          ({ label }) => label
        )
      ).toEqual(expectedLabels);
      expect(normalized.componentRepairs).toContainEqual({
        unitId: unit.unitId,
        action: "NORMALIZE_MORE_FAVORABLE_COVERAGE_PRECEDENCE",
      });
      expect(
        buildADrivenSemanticManifest({
          plan,
          responses: normalized.responses,
          semanticSignalContractId: A_SEMANTIC_SIGNAL_CONTRACT_ID,
        }).summary.unresolvedUnits
      ).toBe(0);
    }
  );

  test.each([
    "Die bessere Deckung gilt nicht.",
    "Das Informationsblatt erläutert die bessere Deckung.",
  ])(
    "does not normalize a non-positive selection statement: %s",
    (sourceText) => {
      const source = artifact([`Seite 1\n${sourceText}\n`], "9");
      const plan = buildADrivenSourceUnitPlan({
        documents: [document("source", 0, source)],
      });
      const unit = plan.units.find(
        ({ initialDisposition }) =>
          initialDisposition === "PENDING_CLASSIFICATION"
      );
      const response = {
        unitId: unit.unitId,
        primaryClass: "CONDITION",
        semanticClasses: ["CONDITION"],
        requirements: [],
      };
      const normalized = normalizeUnambiguousComponentTypes([response], [unit]);

      expect(normalized.responses).toEqual([response]);
      expect(normalized.componentRepairs).not.toContainEqual(
        expect.objectContaining({
          action: "NORMALIZE_MORE_FAVORABLE_COVERAGE_PRECEDENCE",
        })
      );
    }
  );

  test("moves party and restoration fragments out of insured objects into their full condition", () => {
    const sourceText =
      "Versichert sind Heizungsanlagen, sofern sie dem Versicherungsnehmer oder Gebäudeeigentümer gehören und dieser für die Wiederbeschaffung aufzukommen hat.";
    const source = artifact([`Seite 1\n${sourceText}\n`], "a");
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const unit = plan.units.find(
      ({ initialDisposition }) =>
        initialDisposition === "PENDING_CLASSIFICATION"
    );
    const block = unit.source.blocks[0];
    const normalized = normalizeUnambiguousComponentTypes(
      [
        {
          unitId: unit.unitId,
          primaryClass: "OPERATIVE_COVERAGE_STATEMENT",
          semanticClasses: ["OPERATIVE_COVERAGE_STATEMENT", "INSURED_OBJECT"],
          requirements: [
            {
              displayLabel: sourceText,
              components: [
                {
                  type: "COVERAGE_EFFECT",
                  label: "Versichert",
                  sourceBlockIds: [block.blockId],
                  coverageEffect: "INCLUDED",
                },
                {
                  type: "OBJECT",
                  label: "Heizungsanlagen",
                  sourceBlockIds: [block.blockId],
                },
                {
                  type: "OBJECT",
                  label: "Gebäudeeigentümer",
                  sourceBlockIds: [block.blockId],
                },
                {
                  type: "OBJECT",
                  label: "Wiederbeschaffung",
                  sourceBlockIds: [block.blockId],
                },
              ],
            },
          ],
        },
      ],
      [unit]
    );
    const components = normalized.responses[0].requirements[0].components;

    expect(components.filter(({ type }) => type === "OBJECT")).toEqual([
      expect.objectContaining({ label: "Heizungsanlagen" }),
    ]);
    expect(components.filter(({ type }) => type === "CONDITION")).toEqual([
      expect.objectContaining({
        label:
          "sofern sie dem Versicherungsnehmer oder Gebäudeeigentümer gehören und dieser für die Wiederbeschaffung aufzukommen hat.",
      }),
    ]);
    expect(normalized.componentRepairs).toContainEqual({
      unitId: unit.unitId,
      action: "NORMALIZE_CONDITION_MEMBERSHIP_OBJECTS",
      requirementIndex: 0,
      removedObjectComponents: 2,
      removedLabels: ["Gebäudeeigentümer", "Wiederbeschaffung"],
    });
    expect(
      buildADrivenSemanticManifest({
        plan,
        responses: normalized.responses,
        semanticSignalContractId: A_SEMANTIC_SIGNAL_CONTRACT_ID,
      }).summary.unresolvedUnits
    ).toBe(0);
  });

  test("does not rewrite restoration wording outside an explicit condition", () => {
    const unit = {
      unitId: "restoration-object-without-condition",
      source: {
        blockIds: ["block"],
        combinedText: "Versichert sind Anlagen zur Wiederherstellung.",
        blocks: [
          {
            blockId: "block",
            exactText: "Versichert sind Anlagen zur Wiederherstellung.",
          },
        ],
      },
    };
    const response = {
      unitId: unit.unitId,
      primaryClass: "INSURED_OBJECT",
      semanticClasses: ["INSURED_OBJECT"],
      requirements: [
        {
          displayLabel: unit.source.combinedText,
          components: [
            {
              type: "OBJECT",
              label: "Anlagen zur Wiederherstellung",
              sourceBlockIds: ["block"],
            },
          ],
        },
      ],
    };
    const normalized = normalizeUnambiguousComponentTypes([response], [unit]);

    expect(normalized.responses).toEqual([response]);
    expect(normalized.componentRepairs).not.toContainEqual(
      expect.objectContaining({
        action: "NORMALIZE_CONDITION_MEMBERSHIP_OBJECTS",
      })
    );
  });

  test("limits a repaired condition to its requirement instead of consuming later list items", () => {
    const first =
      "Versichert sind Heizungsanlagen, sofern sie dem Versicherungsnehmer";
    const second = "oder Gebäudeeigentümer gehören.";
    const later = "Weitere versicherte Sachen.";
    const unit = {
      unitId: "multi-requirement-condition",
      source: {
        blockIds: ["first", "second", "later"],
        combinedText: [first, second, later].join("\n"),
        blocks: [
          { blockId: "first", exactText: first },
          { blockId: "second", exactText: second },
          { blockId: "later", exactText: later },
        ],
      },
    };
    const response = {
      unitId: unit.unitId,
      primaryClass: "INSURED_OBJECT",
      semanticClasses: ["INSURED_OBJECT"],
      requirements: [
        {
          displayLabel: [first, second].join("\n"),
          components: [
            {
              type: "OBJECT",
              label: "Heizungsanlagen",
              sourceBlockIds: ["first"],
            },
            {
              type: "OBJECT",
              label: "Gebäudeeigentümer",
              sourceBlockIds: ["second"],
            },
          ],
        },
        {
          displayLabel: later,
          components: [
            { type: "OBJECT", label: later, sourceBlockIds: ["later"] },
          ],
        },
      ],
    };
    const normalized = normalizeUnambiguousComponentTypes([response], [unit]);
    const condition = normalized.responses[0].requirements[0].components.find(
      ({ type }) => type === "CONDITION"
    );

    expect(condition).toEqual({
      type: "CONDITION",
      label:
        "sofern sie dem Versicherungsnehmer\noder Gebäudeeigentümer gehören.",
      sourceBlockIds: ["first", "second"],
    });
    expect(normalized.responses[0].requirements[1]).toEqual(
      response.requirements[1]
    );
  });

  test("drops only the unsupported coverage class from a non-product fact", () => {
    const unit = {
      unitId: "peril-without-effect",
      unitKind: "CLAUSE",
      source: {
        blockIds: ["block"],
        combinedText:
          "Austritt von Wasser aus Solarheizungsanlagen, wenn diese fix installiert sind.",
        blocks: [
          {
            blockId: "block",
            structuralKind: "PARAGRAPH",
            exactText:
              "Austritt von Wasser aus Solarheizungsanlagen, wenn diese fix installiert sind.",
          },
        ],
      },
      logicalSourceSegments: [],
    };
    const normalized = normalizeUnambiguousComponentTypes(
      [
        {
          unitId: unit.unitId,
          primaryClass: "OPERATIVE_COVERAGE_STATEMENT",
          semanticClasses: ["PERIL_OR_DAMAGE", "OPERATIVE_COVERAGE_STATEMENT"],
          requirements: [
            {
              displayLabel: unit.source.combinedText,
              components: [
                {
                  type: "PERIL_OR_CAUSE",
                  label: "Austritt von Wasser",
                  sourceBlockIds: ["block"],
                },
                {
                  type: "CONDITION",
                  label: "wenn diese fix installiert sind",
                  sourceBlockIds: ["block"],
                },
                {
                  type: "COVERAGE_EFFECT",
                  label: "ist",
                  sourceBlockIds: ["block"],
                  coverageEffect: "INCLUDED",
                },
              ],
            },
          ],
        },
      ],
      [unit]
    );

    expect(normalized.responses[0]).toMatchObject({
      primaryClass: "PERIL_OR_DAMAGE",
      semanticClasses: ["PERIL_OR_DAMAGE"],
    });
    expect(
      normalized.responses[0].requirements[0].components.map(({ type }) => type)
    ).toEqual(["PERIL_OR_CAUSE", "CONDITION"]);
    expect(normalized.componentRepairs).toContainEqual({
      unitId: unit.unitId,
      action: "DROP_UNSUPPORTED_COVERAGE_CLASS",
      fromPrimaryClass: "OPERATIVE_COVERAGE_STATEMENT",
      toPrimaryClass: "PERIL_OR_DAMAGE",
    });
  });

  test("normalizes an effect-free coverage branch schedule to atomic scopes and limits", () => {
    const branchList =
      "Feuer, Sturm, Leitungswasser, Glasbruch, Haus- und Grundbesitz Haftpflicht";
    const valueLead = "mit einer Pauschalversicherungssumme von";
    const valueAndVariant =
      "€ 2.000.000,-. In der Sparte Leitungswasser gilt die jeweils beantragte Variante A, C oder D.";
    const unit = {
      unitId: "coverage-branch-schedule",
      unitKind: "CLAUSE",
      source: {
        blockIds: ["branches", "value-lead", "value-variant"],
        combinedText: [branchList, valueLead, valueAndVariant].join("\n"),
        blocks: [
          { blockId: "branches", exactText: branchList },
          { blockId: "value-lead", exactText: valueLead },
          { blockId: "value-variant", exactText: valueAndVariant },
        ],
      },
      logicalSourceSegments: [],
    };
    const normalized = normalizeUnambiguousComponentTypes(
      [
        {
          unitId: unit.unitId,
          primaryClass: "OPERATIVE_COVERAGE_STATEMENT",
          semanticClasses: ["OPERATIVE_COVERAGE_STATEMENT"],
          requirements: [
            {
              displayLabel: unit.source.combinedText,
              components: [
                {
                  type: "OBJECT",
                  label: branchList,
                  sourceBlockIds: ["branches"],
                },
                {
                  type: "VALUE_AND_UNIT",
                  label: "Pauschalversicherungssumme von\n€ 2.000.000,-",
                  rawValue: "€ 2.000.000,-",
                  sourceBlockIds: ["value-lead", "value-variant"],
                },
                {
                  type: "SCOPE",
                  label:
                    "In der Sparte Leitungswasser gilt die jeweils beantragte Variante A, C oder D.",
                  sourceBlockIds: ["value-variant"],
                },
                {
                  type: "COVERAGE_EFFECT",
                  label: "gilt",
                  coverageEffect: "INCLUDED",
                  sourceBlockIds: ["value-variant"],
                },
              ],
            },
          ],
        },
      ],
      [unit]
    );

    expect(normalized.responses[0]).toMatchObject({
      primaryClass: "LIMIT",
      semanticClasses: ["LIMIT", "VARIANT"],
    });
    expect(
      normalized.responses[0].requirements[0].components.map(
        ({ type, label }) => [type, label]
      )
    ).toEqual([
      ["SCOPE", "Feuer"],
      ["SCOPE", "Sturm"],
      ["SCOPE", "Leitungswasser"],
      ["SCOPE", "Glasbruch"],
      ["SCOPE", "Haus- und Grundbesitz Haftpflicht"],
      ["VALUE_AND_UNIT", "Pauschalversicherungssumme von\n€ 2.000.000,-"],
      [
        "SCOPE",
        "In der Sparte Leitungswasser gilt die jeweils beantragte Variante A, C oder D.",
      ],
    ]);
    expect(normalized.componentRepairs).toContainEqual({
      unitId: unit.unitId,
      requirementIndex: 0,
      componentIndex: 0,
      action: "SPLIT_COVERAGE_BRANCH_SCHEDULE_SCOPE",
      fromType: "OBJECT",
      components: 5,
    });
    expect(normalized.componentRepairs).toContainEqual({
      unitId: unit.unitId,
      action: "DROP_UNSUPPORTED_COVERAGE_CLASS",
      fromPrimaryClass: "OPERATIVE_COVERAGE_STATEMENT",
      toPrimaryClass: "LIMIT",
    });
  });

  test("does not reinterpret an explicit coverage statement as a branch schedule", () => {
    const source =
      "Versichert sind Gebäude, Nebengebäude. In der Sparte Gebäude gilt die Variante Premium.";
    const unit = {
      unitId: "explicit-coverage-branch-list",
      unitKind: "CLAUSE",
      source: {
        blockIds: ["block"],
        combinedText: source,
        blocks: [{ blockId: "block", exactText: source }],
      },
      logicalSourceSegments: [],
    };
    const response = {
      unitId: unit.unitId,
      primaryClass: "OPERATIVE_COVERAGE_STATEMENT",
      semanticClasses: ["OPERATIVE_COVERAGE_STATEMENT", "INSURED_OBJECT"],
      requirements: [
        {
          displayLabel: source,
          components: [
            {
              type: "OBJECT",
              label: "Gebäude, Nebengebäude",
              sourceBlockIds: ["block"],
            },
            {
              type: "SCOPE",
              label: "In der Sparte Gebäude gilt die Variante Premium",
              sourceBlockIds: ["block"],
            },
            {
              type: "COVERAGE_EFFECT",
              label: "Versichert",
              sourceBlockIds: ["block"],
              coverageEffect: "INCLUDED",
            },
          ],
        },
      ],
    };

    expect(normalizeUnambiguousComponentTypes([response], [unit])).toEqual({
      responses: [response],
      componentRepairs: [],
    });
  });

  test("normalizes only an unambiguous component alias used as a semantic class", () => {
    const source =
      "Darüber hinaus gilt der Exklusivschutz, wobei die Versicherungssummen nicht addiert werden und nur einmal pro Schadenfall zur Anwendung kommen.";
    const unit = {
      unitId: "limit-basis-semantic-alias",
      unitKind: "CLAUSE",
      source: {
        blockIds: ["block"],
        combinedText: source,
        blocks: [{ blockId: "block", exactText: source }],
      },
      logicalSourceSegments: [],
    };
    const normalized = normalizeUnambiguousComponentTypes(
      [
        {
          unitId: unit.unitId,
          primaryClass: "DEFINITION",
          semanticClasses: ["DEFINITION", "CONDITION", "LIMIT_BASIS"],
          requirements: [
            {
              displayLabel: source,
              components: [
                {
                  type: "FACT_ROLE",
                  label: "gilt der Exklusivschutz",
                  sourceBlockIds: ["block"],
                },
                {
                  type: "CONDITION",
                  label: "wobei die Versicherungssummen nicht addiert werden",
                  sourceBlockIds: ["block"],
                },
                {
                  type: "LIMIT_BASIS",
                  label: "nur einmal pro Schadenfall",
                  sourceBlockIds: ["block"],
                },
              ],
            },
          ],
        },
      ],
      [unit]
    );

    expect(normalized.responses[0].semanticClasses).toEqual([
      "DEFINITION",
      "CONDITION",
      "LIMIT",
    ]);
    expect(normalized.componentRepairs).toContainEqual({
      unitId: unit.unitId,
      action: "NORMALIZE_SEMANTIC_CLASS_ALIAS",
      field: "semanticClasses",
      from: "LIMIT_BASIS",
      to: "LIMIT",
    });
  });

  test("does not guess an ambiguous value component used as a semantic class", () => {
    const response = {
      unitId: "ambiguous-value-semantic-alias",
      primaryClass: "DEFINITION",
      semanticClasses: ["DEFINITION", "VALUE_AND_UNIT"],
      requirements: [],
    };
    const unit = {
      unitId: response.unitId,
      unitKind: "CLAUSE",
      source: { blockIds: [], blocks: [], combinedText: "" },
      logicalSourceSegments: [],
    };

    expect(normalizeUnambiguousComponentTypes([response], [unit])).toEqual({
      responses: [response],
      componentRepairs: [],
    });
  });

  test("preserves an operative coverage class with explicit literal effect evidence", () => {
    const unit = {
      unitId: "explicit-effect",
      unitKind: "CLAUSE",
      source: {
        blockIds: ["block"],
        combinedText: "Versichert sind Gebäude.",
        blocks: [
          {
            blockId: "block",
            structuralKind: "PARAGRAPH",
            exactText: "Versichert sind Gebäude.",
          },
        ],
      },
      logicalSourceSegments: [],
    };
    const response = {
      unitId: unit.unitId,
      primaryClass: "OPERATIVE_COVERAGE_STATEMENT",
      semanticClasses: ["OPERATIVE_COVERAGE_STATEMENT", "INSURED_OBJECT"],
      requirements: [
        {
          displayLabel: unit.source.combinedText,
          components: [
            {
              type: "OBJECT",
              label: "Gebäude",
              sourceBlockIds: ["block"],
            },
            {
              type: "COVERAGE_EFFECT",
              label: "Versichert",
              sourceBlockIds: ["block"],
              coverageEffect: "INCLUDED",
            },
          ],
        },
      ],
    };
    const normalized = normalizeUnambiguousComponentTypes([response], [unit]);

    expect(normalized.responses).toEqual([response]);
    expect(normalized.componentRepairs).toEqual([]);
  });

  test("accepts only whitespace-normalized labels while preserving exact spans", () => {
    const source = artifact(
      ["Seite 1\nDECKUNG\ngilt für alle Gebäude,\nund Nebengebäude.\n"],
      "6"
    );
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const unit = plan.units.find(({ unitKind }) => unitKind === "CLAUSE");
    const normalized = unit.source.blocks
      .map(({ exactText }) => exactText)
      .join(" ");
    const manifest = buildADrivenSemanticManifest({
      plan,
      responses: [
        ...plan.units
          .filter(({ unitKind }) => unitKind === "HEADING")
          .map(validResponse),
        {
          unitId: unit.unitId,
          primaryClass: "CONDITION",
          semanticClasses: ["CONDITION"],
          requirements: [
            {
              displayLabel: normalized,
              components: [
                {
                  type: "CONDITION",
                  label: normalized,
                  sourceBlockIds: unit.source.blockIds,
                },
              ],
            },
          ],
        },
      ],
    });

    expect(manifest.summary.unresolvedUnits).toBe(0);
    expect(manifest.requirements[0].sourceSpans).toEqual(
      unit.source.blocks.map(
        ({
          blockId,
          physicalPageNumber,
          documentStart,
          documentEnd,
          exactText,
          exactTextSha256,
        }) =>
          expect.objectContaining({
            blockId,
            physicalPageNumber,
            documentStart,
            documentEnd,
            exactText,
            exactTextSha256,
          })
      )
    );
  });

  test("normalizes only the list marker while retaining the exact source span", () => {
    const source = artifact(["Seite 1\nOBJEKTE\n• gemauerte Öfen;\n"], "1");
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const unit = plan.units.find(({ unitKind }) => unitKind === "LIST");
    const block = unit.source.blocks[0];
    const manifest = buildADrivenSemanticManifest({
      plan,
      responses: plan.units
        .filter(
          ({ initialDisposition }) =>
            initialDisposition === "PENDING_CLASSIFICATION"
        )
        .map((plannedUnit) =>
          plannedUnit.unitId === unit.unitId
            ? {
                unitId: unit.unitId,
                primaryClass: "INSURED_OBJECT",
                semanticClasses: ["INSURED_OBJECT"],
                requirements: [
                  {
                    displayLabel: "- gemauerte Öfen;",
                    components: [
                      {
                        type: "OBJECT",
                        label: "- gemauerte Öfen;",
                        sourceBlockIds: [block.blockId],
                      },
                    ],
                  },
                ],
              }
            : validResponse(plannedUnit)
        ),
    });

    expect(manifest.summary.unresolvedUnits).toBe(0);
    expect(manifest.requirements[0].sourceSpans[0].exactText).toBe(
      "• gemauerte Öfen;"
    );
  });

  test("normalizes equivalent double-quote glyphs while retaining the exact source span", () => {
    const source = artifact(
      ["Seite 1\nVARIANTE\nEs gilt die Variante „A-Deckung“.\n"],
      "2"
    );
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const unit = plan.units.find(({ unitKind }) => unitKind === "CLAUSE");
    const block = unit.source.blocks[0];
    const manifest = buildADrivenSemanticManifest({
      plan,
      responses: [
        ...plan.units
          .filter(({ unitKind }) => unitKind === "HEADING")
          .map(validResponse),
        {
          unitId: unit.unitId,
          primaryClass: "VARIANT",
          semanticClasses: ["VARIANT"],
          requirements: [
            {
              displayLabel: 'Es gilt die Variante "A-Deckung".',
              components: [
                {
                  type: "SCOPE",
                  label: 'Variante "A-Deckung"',
                  sourceBlockIds: [block.blockId],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(manifest.summary.unresolvedUnits).toBe(0);
    expect(manifest.requirements[0].sourceSpans[0].exactText).toBe(
      "Es gilt die Variante „A-Deckung“."
    );
  });

  test("keeps the legacy oracle strictly evaluation-only", () => {
    const source = artifact(
      ["Seite 1\nDeckung\nVersichert sind Gebäude.\n"],
      "e"
    );
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const responses = plan.units
      .filter(
        ({ initialDisposition }) =>
          initialDisposition !== "NON_OPERATIVE_TERMINAL"
      )
      .map(validResponse);
    const manifest = buildADrivenSemanticManifest({ plan, responses });
    const dynamic = manifest.requirements[0];
    const dynamicObject = dynamic.components.find(
      ({ type }) => type === "OBJECT"
    );
    const legacyManifest = {
      manifestSha256: "f".repeat(64),
      categories: [
        {
          subcategories: [{ requirementIds: ["PR-01"] }],
        },
      ],
      requirements: [
        {
          requirementId: "PR-01",
          components: [
            {
              id: "object",
              factRole: "INSURED_OBJECT",
              sourceSpanIds: ["legacy-span"],
            },
          ],
          sourceSpans: [
            {
              spanId: "legacy-span",
              blockIds: [dynamic.sourceBlockIds[0]],
            },
          ],
        },
      ],
    };
    const draft = buildLegacyOracleCrosswalkDraft({
      dynamicManifest: manifest,
      legacyManifest,
    });

    expect(draft.summary.coveredComponents).toBe(0);
    expect(draft.records[0].sourceOverlapCandidates).toHaveLength(1);
    expect(manifest.requirements).toHaveLength(
      manifest.summary.semanticRequirements
    );

    const reviewed = validateLegacyOracleCrosswalk({
      draft,
      dynamicManifest: manifest,
      decisions: [
        {
          legacyRequirementId: "PR-01",
          legacyComponentId: "object",
          relation: "EQUIVALENT",
          dynamicTargets: [dynamicObject.componentId],
          reviewStatus: "APPROVED",
          reviewerIds: ["reviewer-1", "reviewer-2"],
        },
      ],
    });
    expect(reviewed.summary).toMatchObject({
      coveredRequirements: 1,
      coveredComponents: 1,
      acceptanceReady: false,
    });
  });

  test("audits ownership, response IDs, nonoperative risk and both crosswalk directions separately", () => {
    const source = artifact(
      ["Seite 1\nDeckung\nVersichert sind Gebäude.\n"],
      "f"
    );
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const classificationBatches = buildADrivenClassificationBatches(plan);
    const responses = plan.units
      .filter(
        ({ initialDisposition }) =>
          initialDisposition === "PENDING_CLASSIFICATION"
      )
      .map(validResponse);
    const manifest = buildADrivenSemanticManifest({ plan, responses });
    const dynamicRequirement = manifest.requirements[0];
    const dynamicObject = dynamicRequirement.components.find(
      ({ type }) => type === "OBJECT"
    );
    const legacyManifest = {
      manifestSha256: "a".repeat(64),
      requirements: [
        {
          requirementId: "PR-01",
          displayLabel: "Gebäude",
          components: [
            {
              id: "object",
              label: "Gebäude",
              factRole: "INSURED_OBJECT",
              sourceSpanIds: ["span"],
            },
            {
              id: "condition",
              label: "Gebäude",
              factRole: "CONDITION",
              sourceSpanIds: ["span"],
            },
          ],
          sourceSpans: [
            {
              spanId: "span",
              blockIds: dynamicObject.sourceBlockIds,
            },
          ],
        },
      ],
    };
    const audit = buildADrivenAStatusAudit({
      plan,
      manifest,
      responses,
      classificationBatches,
      batchResults: classificationBatches.batches.map((batch) => ({
        batchId: batch.batchId,
        validation: { passed: true },
      })),
      legacyManifest,
    });

    expect(audit.summary).toMatchObject({
      sourceOwnershipPassed: true,
      responseEnvelopePassed: true,
      sourceReferenceIntegrityPassed: true,
      unresolvedUnits: 0,
      missingLegacyRequirements: 0,
      missingLegacyComponents: 0,
      roleIncompatibleLegacyComponents: 1,
      semanticCrosswalkApproved: false,
      acceptanceReady: false,
    });
    expect(audit.componentCrosswalk[0]).toMatchObject({
      relationCandidate: "ONE_TO_ONE_CANDIDATE",
      compatibleDynamicTargets: [
        expect.objectContaining({
          dynamicComponentId: dynamicObject.componentId,
        }),
      ],
    });
    expect(audit.componentCrosswalk[1]).toMatchObject({
      relationCandidate: "ROLE_INCOMPATIBLE",
      sourceOverlappingDynamicTargets: expect.any(Array),
      compatibleDynamicTargets: [],
    });
    expect(audit.dynamicComponentCrosswalk).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ relationCandidate: "ADDITIONAL" }),
      ])
    );
  });

  test("routes overbroad typed labels and isolated party roles to atomicity review", () => {
    const source = artifact(
      [
        "Seite 1\nDECKUNG\nVersichert sind Gebäude, sofern sie ständig bewohnt sind.\nVersicherungsnehmer bzw. Verwalter und Treuhänder\n\nFamilienwohnbau GmbH\n",
      ],
      "d"
    );
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const headingResponses = plan.units
      .filter(({ unitKind }) => unitKind === "HEADING")
      .map(validResponse);
    const clauses = plan.units.filter(({ unitKind }) => unitKind === "CLAUSE");
    const coverageUnit = clauses.find(({ source }) =>
      source.combinedText.includes("Versichert sind Gebäude")
    );
    const partyUnit = clauses.find(({ source }) =>
      source.combinedText.includes("Versicherungsnehmer")
    );
    const manifest = buildADrivenSemanticManifest({
      plan,
      responses: [
        ...headingResponses,
        {
          unitId: coverageUnit.unitId,
          primaryClass: "OPERATIVE_COVERAGE_STATEMENT",
          semanticClasses: [
            "OPERATIVE_COVERAGE_STATEMENT",
            "INSURED_OBJECT",
            "CONDITION",
          ],
          requirements: [
            {
              displayLabel: coverageUnit.source.combinedText,
              components: [
                {
                  type: "OBJECT",
                  label: coverageUnit.source.combinedText,
                  sourceBlockIds: coverageUnit.source.blockIds,
                },
                {
                  type: "COVERAGE_EFFECT",
                  label: "Versichert",
                  coverageEffect: "INCLUDED",
                  sourceBlockIds: coverageUnit.source.blockIds,
                },
                {
                  type: "CONDITION",
                  label: "sofern sie ständig bewohnt sind",
                  sourceBlockIds: coverageUnit.source.blockIds,
                },
              ],
            },
          ],
        },
        {
          unitId: partyUnit.unitId,
          primaryClass: "DEFINITION",
          semanticClasses: ["DEFINITION"],
          requirements: [
            {
              displayLabel: partyUnit.source.combinedText,
              components: [
                {
                  type: "FACT_ROLE",
                  label: partyUnit.source.combinedText,
                  sourceBlockIds: partyUnit.source.blockIds,
                },
              ],
            },
          ],
        },
      ],
    });
    const audit = assessADrivenManifestAtomicityRisks({ plan, manifest });

    expect(audit.summary).toMatchObject({
      reviewRequiredUnits: 2,
      reviewRequiredComponents: 2,
      atomicityReviewPassed: false,
    });
    expect(audit.auditSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(audit.risks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "COMPONENT_LABEL_CONTAINS_TYPED_SIBLING",
          componentType: "OBJECT",
          owningUnitId: coverageUnit.unitId,
        }),
        expect.objectContaining({
          code: "COMPOUND_PARTY_ROLE_COMPONENT",
          componentType: "FACT_ROLE",
          owningUnitId: partyUnit.unitId,
        }),
        expect.objectContaining({
          code: "ISOLATED_PARTY_ROLE_LABEL",
          componentType: "FACT_ROLE",
          nextUnit: expect.objectContaining({
            exactText: expect.stringContaining("Familienwohnbau GmbH"),
          }),
        }),
      ])
    );
  });

  test("compares atomicity audits without treating a lower heuristic count as product approval", () => {
    const manifest = (manifestSha256, components) => ({
      contractId: A_DYNAMIC_MANIFEST_CONTRACT_ID,
      sourceUnitPlanSha256: "plan",
      manifestSha256,
      requirements: [{ components }],
      summary: {
        totalSourceBlocks: 10,
        unresolvedUnits: 0,
        reviewRequiredBlocks: 0,
        allBlocksTerminal: true,
      },
    });
    const risk = {
      code: "OVERBROAD_COMPONENT_LABEL",
      componentType: "OBJECT",
      sourceUnitIds: ["unit"],
    };
    const audit = (contractId, dynamicManifestSha256, risks) => ({
      contractId,
      sourceUnitPlanSha256: "plan",
      dynamicManifestSha256,
      auditSha256: `${dynamicManifestSha256}-audit`,
      risks,
      summary: {
        reviewRequiredUnits: new Set(
          risks.map((item) => item.sourceUnitIds.at(-1))
        ).size,
        reviewRequiredComponents: risks.length,
        risks: risks.length,
      },
    });
    const comparison = compareADrivenManifestAtomicity({
      baselineManifest: manifest("baseline", [{ id: "one" }]),
      baselineAudit: audit("LF_A_DYNAMIC_ATOMICITY_RISK_AUDIT_V1", "baseline", [
        risk,
      ]),
      currentManifest: manifest("current", [{ id: "one" }, { id: "two" }]),
      currentAudit: audit(
        "LF_A_DYNAMIC_ATOMICITY_RISK_AUDIT_V2",
        "current",
        []
      ),
    });

    expect(comparison.delta).toMatchObject({
      semanticComponents: 1,
      reviewRequiredUnits: -1,
      risks: -1,
    });
    expect(comparison.riskGroups.resolved).toEqual([
      expect.objectContaining({
        owningUnitId: "unit",
        baseline: 1,
        current: 0,
      }),
    ]);
    expect(comparison.assessment).toEqual({
      sourceIntegrityMaintained: true,
      atomicitySignalsReduced: true,
      noNewRiskGroups: true,
      candidateImprovement: true,
      productGatePassed: false,
    });
    expect(comparison.comparisonSha256).toMatch(/^[a-f0-9]{64}$/u);
  });

  test("resolves nonoperative page markers, structural headings and reused operative governors", () => {
    const source = artifact(
      ["Seite 1\nNicht versichert sind:\nVorschäden.\n"],
      "a"
    );
    const sourcePlan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const plan = deriveClassificationEvidencePlan(sourcePlan);
    const heading = plan.units.find(({ unitKind }) => unitKind === "HEADING");
    const operativeClause = plan.units.find(
      ({ initialDisposition, unitKind }) =>
        initialDisposition === "PENDING_CLASSIFICATION" &&
        unitKind !== "HEADING"
    );
    const metadata = plan.units.find(({ unitKind }) => unitKind === "METADATA");
    const responses = [
      {
        unitId: operativeClause.unitId,
        primaryClass: "EXCLUSION",
        semanticClasses: ["EXCLUSION"],
        requirements: [
          {
            displayLabel: operativeClause.source.blocks[0].exactText,
            components: [
              {
                type: "OBJECT",
                label: operativeClause.source.blocks[0].exactText,
                sourceBlockIds: operativeClause.source.blockIds,
              },
              {
                type: "COVERAGE_EFFECT",
                label: "Nicht versichert",
                sourceBlockIds: heading.source.blockIds,
                coverageEffect: "EXCLUDED",
              },
            ],
          },
        ],
      },
    ];
    const manifest = buildADrivenSemanticManifest({ plan, responses });
    const headingTerminal = manifest.unitTerminals.find(
      ({ unitId }) => unitId === heading.unitId
    );
    headingTerminal.terminalDisposition = "NON_OPERATIVE_TERMINAL";
    headingTerminal.primaryClass = "STRUCTURE";
    headingTerminal.semanticClasses = ["STRUCTURE"];
    headingTerminal.requirementIds = [];
    const classificationBatches = buildADrivenClassificationBatches(plan);
    const legacyManifest = {
      manifestSha256: "b".repeat(64),
      requirements: [
        {
          requirementId: "EX-01",
          displayLabel: "Vorschäden",
          components: [
            {
              id: "effect",
              label: "Nicht versichert",
              factRole: "EXCLUSION",
              sourceSpanIds: ["span"],
            },
            {
              id: "inherited-effect",
              label: "Vorschäden nicht versichert",
              factRole: "EXCLUSION",
              sourceSpanIds: ["item-span"],
            },
          ],
          sourceSpans: [
            {
              spanId: "span",
              blockIds: [
                ...heading.source.blockIds,
                ...(metadata?.source.blockIds || []),
              ],
            },
            {
              spanId: "item-span",
              blockIds: operativeClause.source.blockIds,
            },
          ],
        },
      ],
    };
    const audit = buildADrivenAStatusAudit({
      plan,
      manifest,
      responses,
      classificationBatches,
      batchResults: classificationBatches.batches.map((batch) => ({
        batchId: batch.batchId,
        validation: { passed: true },
      })),
      legacyManifest,
    });

    expect(audit.summary.suspiciousNonOperativeUnits).toBe(0);
    expect(audit.summary.inheritedRoleCandidateLegacyComponents).toBe(1);
    expect(
      audit.componentCrosswalk.find(
        ({ legacyComponentId }) => legacyComponentId === "inherited-effect"
      )
    ).toMatchObject({
      relationCandidate: "INHERITED_ROLE_CANDIDATE",
      sourceOverlappingDynamicTargets: [
        expect.objectContaining({ dynamicComponentType: "OBJECT" }),
      ],
      requirementScopedCompatibleDynamicTargets: [
        expect.objectContaining({
          dynamicComponentType: "COVERAGE_EFFECT",
          matchScope: "SAME_DYNAMIC_REQUIREMENT",
        }),
      ],
    });
    expect(audit.reviewedNonOperativeUnits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          unitId: heading.unitId,
          reviewDisposition: "OPERATIVE_GOVERNOR_EVIDENCE_REUSED",
        }),
        ...(metadata
          ? [
              expect.objectContaining({
                unitId: metadata.unitId,
                reviewDisposition: "PAGE_MARKER_CONFIRMED",
              }),
            ]
          : []),
      ])
    );
  });
});

describe("LF_REFERENCE_A_DRIVEN_V2 B candidate and decision contracts", () => {
  const pageContent =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const documents = [
    {
      uuid: "b-doc",
      sha256: "b".repeat(64),
      pageContent,
      pageContentSha256: crypto
        .createHash("sha256")
        .update(pageContent)
        .digest("hex"),
      pageMap: [{ pageNumber: 1, start: 0, end: pageContent.length }],
      clauseBoundaries: [
        {
          clauseBoundaryId: "clause-1",
          documentStart: 0,
          documentEnd: pageContent.length,
        },
        {
          clauseBoundaryId: "clause-2",
          documentStart: 0,
          documentEnd: pageContent.length,
        },
      ],
    },
  ];

  function candidate(id, start, end, clauseBoundaryId = "clause-1") {
    return {
      candidateId: id,
      documentUuid: "b-doc",
      documentSha256: "b".repeat(64),
      clauseBoundaryId,
      documentStart: start,
      documentEnd: end,
      physicalPageNumber: 1,
      exactText: pageContent.slice(start, end),
      channels: id === "one" ? ["BM25"] : ["DINGHY"],
    };
  }

  test("compacts only overlapping candidates inside one document clause", () => {
    const result = compactReferenceCandidates(
      [
        candidate("one", 10, 30),
        candidate("two", 25, 45),
        candidate("three", 25, 45, "clause-2"),
      ],
      { documents }
    );

    expect(result.inputCandidates).toBe(3);
    expect(result.compactCandidates).toHaveLength(2);
    expect(
      result.compactCandidates.find(
        ({ clauseBoundaryId }) => clauseBoundaryId === "clause-1"
      )
    ).toMatchObject({
      memberCandidateIds: ["one", "two"],
      channels: ["BM25", "DINGHY"],
      semanticDecision: null,
    });
  });

  test("rejects a candidate whose quote does not match the server document", () => {
    const forged = candidate("forged", 10, 30);
    forged.exactText = "erfundene Fundstelle";
    expect(() => compactReferenceCandidates([forged], { documents })).toThrow(
      "LF_COUNTERPART_CANDIDATE_SOURCE_INVALID"
    );
  });

  test("accepts only server-owned candidates and keeps bad model output unresolved", () => {
    const candidates = compactReferenceCandidates([candidate("one", 10, 30)], {
      documents,
    }).compactCandidates;
    const packages = [
      {
        packageId: "package-1",
        componentId: "component-1",
        documentUuid: "b-doc",
        candidates,
        requiredDimensions: ["OBJECT", "COVERAGE_EFFECT"],
        semanticChecks: semanticChecks("component-1", [
          "OBJECT",
          "COVERAGE_EFFECT",
        ]),
        searchCoverage: {
          channelExecutionStatus: "CHANNELS_PARTIAL",
          absenceStatus: "NOT_CERTIFIED_BOUNDED_TOP_K",
          negativeConclusionEligible: false,
          requiredChannels: ["CURRENT", "BM25", "STRUCTURE", "DINGHY"],
          completedChannels: ["CURRENT", "BM25"],
        },
      },
      {
        packageId: "package-2",
        componentId: "component-2",
        documentUuid: "b-doc",
        candidates: [],
        requiredDimensions: ["OBJECT"],
        semanticChecks: semanticChecks("component-2", ["OBJECT"]),
        searchCoverage: {
          channelExecutionStatus: "CHANNELS_COMPLETE",
          absenceStatus: "NOT_CERTIFIED_BOUNDED_TOP_K",
          negativeConclusionEligible: false,
          requiredChannels: ["CURRENT", "BM25", "STRUCTURE", "DINGHY"],
          completedChannels: ["CURRENT", "BM25", "STRUCTURE", "DINGHY"],
        },
      },
    ];
    const result = validateCounterpartDecisions({
      searchExecution: searchExecutionArtifact(packages),
      responses: [
        {
          packageId: "package-1",
          decision: "SUPPORTED",
          selectedCandidateIds: [candidates[0].compactCandidateId],
          dimensionChecks: decisionChecks(packages[0], "MATCH", [
            candidates[0].compactCandidateId,
          ]),
        },
        {
          packageId: "package-2",
          decision: "SUPPORTED",
          selectedCandidateIds: ["invented-candidate"],
          dimensionChecks: decisionChecks(packages[1], "MATCH", [
            "invented-candidate",
          ]),
        },
        {
          packageId: "unknown",
          decision: "NOT_SUPPORTED",
          selectedCandidateIds: [],
          dimensionChecks: [],
        },
      ],
    });

    expect(result.summary).toEqual({
      plannedPackages: 2,
      terminalPackages: 1,
      unresolvedPackages: 1,
    });
    expect(result.results[1]).toMatchObject({
      status: "UNRESOLVED",
      reasonCode: "INVALID_PACKAGE_DECISION",
    });
    expect(
      result.diagnostics.find(({ packageId }) => packageId === "package-2")
        ?.issues
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "DIMENSION_CHECKS_INVALID" }),
        expect.objectContaining({
          code: "SELECTED_CANDIDATE_IDS_UNKNOWN",
        }),
      ])
    );
    expect(result.diagnostics.map(({ code }) => code)).toContain(
      "UNKNOWN_PACKAGE_ID"
    );
  });

  test("reports the exact aggregate decision contract violated by mixed outcomes", () => {
    const candidates = compactReferenceCandidates([candidate("one", 10, 30)], {
      documents,
    }).compactCandidates;
    const packageItem = {
      packageId: "package-mixed",
      componentId: "component-mixed",
      documentUuid: "b-doc",
      candidates,
      requiredDimensions: ["FACT_ROLE", "SCOPE"],
      semanticChecks: semanticChecks("component-mixed", ["FACT_ROLE", "SCOPE"]),
      searchCoverage: {
        channelExecutionStatus: "CHANNELS_COMPLETE",
        absenceStatus: "NOT_CERTIFIED_BOUNDED_TOP_K",
        negativeConclusionEligible: false,
        requiredChannels: ["CURRENT", "BM25", "STRUCTURE", "DINGHY"],
        completedChannels: ["CURRENT", "BM25", "STRUCTURE", "DINGHY"],
      },
    };
    const candidateId = candidates[0].compactCandidateId;
    const result = validateCounterpartDecisions({
      searchExecution: searchExecutionArtifact([packageItem]),
      responses: [
        {
          packageId: packageItem.packageId,
          decision: "NOT_SUPPORTED",
          selectedCandidateIds: [candidateId],
          dimensionChecks: packageItem.semanticChecks.map(
            ({ checkId, dimension }, index) => ({
              checkId,
              dimension,
              outcome: index === 0 ? "MISMATCH" : "MATCH",
              candidateIds: [candidateId],
            })
          ),
        },
      ],
    });

    expect(result.diagnostics[0]).toMatchObject({
      code: "INVALID_PACKAGE_DECISION",
      packageId: packageItem.packageId,
      issues: [
        {
          code: "NOT_SUPPORTED_OUTCOME_CONTRACT_INVALID",
          outcomes: ["MISMATCH", "MATCH"],
        },
      ],
    });
  });
});

describe("LF_REFERENCE_A_DRIVEN_V2 search matrix and binary result", () => {
  test("tells Qwen that unestablished dimensions cannot cite candidates", () => {
    const messages = counterpartDecisionPrompt({
      batchId: "batch",
      expectedPackageIds: [],
      packages: [],
    });
    expect(messages[0].content).toContain(
      "Für jeden NOT_ESTABLISHED-Check muss candidateIds exakt [] sein"
    );
    expect(messages[0].content).toContain(
      "alle candidateIds [] und selectedCandidateIds []"
    );
    expect(messages[0].content).toContain(
      "darf selectedCandidateIds niemals leer sein"
    );
  });

  test("repairs invalid partial NOT_SUPPORTED responses one package at a time", async () => {
    const manifest = searchEligibleManifest();
    const searchPlan = buildADrivenCounterpartSearchPlan({
      manifest,
      documents: [{ uuid: "b-doc", position: 0, sha256: "b".repeat(64) }],
    });
    const exactText = "Gebäude sind am Versicherungsort erwähnt.";
    const retrieval = retrievalArtifact(
      searchPlan,
      searchPlan.packages.map((item) => ({
        packageId: item.packageId,
        completedChannels: [...REQUIRED_SEARCH_CHANNELS],
        candidates: [
          {
            compactCandidateId: "candidate-one",
            documentUuid: "b-doc",
            documentSha256: "b".repeat(64),
            clauseBoundaryId: "clause-one",
            channels: ["DINGHY"],
            sourceSpans: [
              {
                spanId: "span-one",
                exactText,
                exactTextSha256: crypto
                  .createHash("sha256")
                  .update(exactText)
                  .digest("hex"),
                physicalPageNumber: 1,
                documentStart: 0,
                documentEnd: exactText.length,
              },
            ],
          },
        ],
      }))
    );
    const searchExecution = materializeADrivenCounterpartSearchExecution({
      plan: searchPlan,
      retrieval,
    });
    const batch = buildADrivenCounterpartDecisionPlan(searchExecution, {
      maximumPackages: 2,
      maximumCharacters: 14_000,
    }).batches.find(({ packages }) => packages[0].semanticChecks.length > 1);
    const partialResponses = batch.packages.map((item) => ({
      packageId: item.packageId,
      decision: "NOT_SUPPORTED",
      selectedCandidateIds: [],
      dimensionChecks: item.semanticChecks.map(
        ({ checkId, dimension }, index) => ({
          checkId,
          dimension,
          outcome: index === 0 ? "MATCH" : "NOT_ESTABLISHED",
          candidateIds: index === 0 ? ["candidate-one"] : [],
        })
      ),
    }));
    const client = {
      chat: {
        completions: {
          create: jest
            .fn()
            .mockResolvedValueOnce({
              model: "qwen/qwen3.6-35b-a3b",
              choices: [
                { message: { content: JSON.stringify(partialResponses) } },
              ],
              usage: {},
            })
            .mockImplementation(({ messages }) => {
              const request = JSON.parse(messages[1].content);
              return Promise.resolve({
                model: "qwen/qwen3.6-35b-a3b",
                choices: [
                  {
                    message: {
                      content: JSON.stringify(
                        request.packages.map((item) => {
                          const original = partialResponses.find(
                            ({ packageId }) => packageId === item.packageId
                          );
                          return {
                            ...original,
                            selectedCandidateIds: ["candidate-one"],
                          };
                        })
                      ),
                    },
                  },
                ],
                usage: {},
              });
            }),
        },
      },
    };

    const result = await runCounterpartDecisionBatch({
      client,
      model: "qwen/qwen3.6-35b-a3b",
      modelContext: 42_496,
      searchExecution,
      batch,
      maximumAttempts: batch.expectedPackageIds.length + 1,
    });

    expect(result.validation.passed).toBe(true);
    expect(result.attempts).toHaveLength(batch.expectedPackageIds.length + 1);
    expect(result.attempts[0]).toMatchObject({
      acceptedPackages: 0,
      pendingPackages: batch.expectedPackageIds.length,
      validationPassed: false,
    });
    for (const [index, call] of client.chat.completions.create.mock.calls
      .slice(1)
      .entries()) {
      const request = JSON.parse(call[0].messages[1].content);
      expect(request.expectedPackageIds).toEqual([
        batch.expectedPackageIds[index],
      ]);
      expect(request.packages).toHaveLength(1);
      expect(call[0].messages.at(-1).content).toContain(
        "darf bei einem MATCH oder MISMATCH niemals leer sein"
      );
    }
  });

  test("applies the retry limit per package instead of exhausting the batch on the first package", async () => {
    const manifest = searchEligibleManifest();
    const searchPlan = buildADrivenCounterpartSearchPlan({
      manifest,
      documents: [{ uuid: "b-doc", position: 0, sha256: "b".repeat(64) }],
    });
    const exactText = "Gebäude sind am Versicherungsort erwähnt.";
    const retrieval = retrievalArtifact(
      searchPlan,
      searchPlan.packages.map((item) => ({
        packageId: item.packageId,
        completedChannels: [...REQUIRED_SEARCH_CHANNELS],
        candidates: [
          {
            compactCandidateId: "candidate-one",
            documentUuid: "b-doc",
            documentSha256: "b".repeat(64),
            clauseBoundaryId: "clause-one",
            channels: ["DINGHY"],
            sourceSpans: [
              {
                spanId: "span-one",
                exactText,
                exactTextSha256: crypto
                  .createHash("sha256")
                  .update(exactText)
                  .digest("hex"),
                physicalPageNumber: 1,
                documentStart: 0,
                documentEnd: exactText.length,
              },
            ],
          },
        ],
      }))
    );
    const searchExecution = materializeADrivenCounterpartSearchExecution({
      plan: searchPlan,
      retrieval,
    });
    const batch = buildADrivenCounterpartDecisionPlan(searchExecution, {
      maximumPackages: 2,
      maximumCharacters: 14_000,
    }).batches.find(({ packages }) => packages[0].semanticChecks.length > 1);
    const invalidByPackage = new Map(
      batch.packages.map((item) => [
        item.packageId,
        {
          packageId: item.packageId,
          decision: "NOT_SUPPORTED",
          selectedCandidateIds: [],
          dimensionChecks: item.semanticChecks.map(
            ({ checkId, dimension }, index) => ({
              checkId,
              dimension,
              outcome: index === 0 ? "MATCH" : "NOT_ESTABLISHED",
              candidateIds: index === 0 ? ["candidate-one"] : [],
            })
          ),
        },
      ])
    );
    const modelCallsByPackage = new Map();
    const client = {
      chat: {
        completions: {
          create: jest.fn().mockImplementation(({ messages }) => {
            const request = JSON.parse(messages[1].content);
            const responses = request.expectedPackageIds.map((packageId) => {
              const count = (modelCallsByPackage.get(packageId) || 0) + 1;
              modelCallsByPackage.set(packageId, count);
              const original = invalidByPackage.get(packageId);
              const requiredCount =
                packageId === batch.expectedPackageIds[0] ? 3 : 2;
              return count < requiredCount
                ? original
                : { ...original, selectedCandidateIds: ["candidate-one"] };
            });
            return Promise.resolve({
              model: "qwen/qwen3.6-35b-a3b",
              choices: [{ message: { content: JSON.stringify(responses) } }],
              usage: {},
            });
          }),
        },
      },
    };

    const result = await runCounterpartDecisionBatch({
      client,
      model: "qwen/qwen3.6-35b-a3b",
      modelContext: 42_496,
      searchExecution,
      batch,
      maximumAttempts: 3,
    });

    expect(result.validation.passed).toBe(true);
    expect(client.chat.completions.create).toHaveBeenCalledTimes(4);
    expect(
      result.attempts.map(({ requestedPackageIds }) => requestedPackageIds)
    ).toEqual([
      batch.expectedPackageIds,
      [batch.expectedPackageIds[0]],
      [batch.expectedPackageIds[0]],
      [batch.expectedPackageIds[1]],
    ]);
    expect(result.attempts[2].packageAttemptCounts).toEqual({
      [batch.expectedPackageIds[0]]: 3,
    });
    expect(
      client.chat.completions.create.mock.calls[1][0].messages.at(-1).content
    ).toContain("SELECTED_CANDIDATE_UNION_MISMATCH");
  });

  test("keeps a real-sized compacted candidate package inside the default decision budget", () => {
    const manifest = searchEligibleManifest();
    const searchPlan = buildADrivenCounterpartSearchPlan({
      manifest,
      documents: [{ uuid: "b-doc", position: 0, sha256: "b".repeat(64) }],
    });
    const exactText = `Versicherter Originalwortlaut ${"x".repeat(15_000)}`;
    const retrieval = retrievalArtifact(
      searchPlan,
      searchPlan.packages.map((item) => ({
        packageId: item.packageId,
        completedChannels: [...REQUIRED_SEARCH_CHANNELS],
        candidates: [
          {
            compactCandidateId: "candidate-large",
            documentUuid: "b-doc",
            documentSha256: "b".repeat(64),
            clauseBoundaryId: "clause-large",
            channels: ["DINGHY"],
            sourceSpans: [
              {
                spanId: "span-large",
                exactText,
                exactTextSha256: crypto
                  .createHash("sha256")
                  .update(exactText)
                  .digest("hex"),
                physicalPageNumber: 1,
                documentStart: 0,
                documentEnd: exactText.length,
              },
            ],
          },
        ],
      }))
    );
    const execution = materializeADrivenCounterpartSearchExecution({
      plan: searchPlan,
      retrieval,
    });

    expect(() =>
      buildADrivenCounterpartDecisionPlan(execution, {
        maximumPackages: 2,
        maximumCharacters: 14_000,
      })
    ).toThrow("LF_A_DRIVEN_DECISION_PACKAGE_TOO_LARGE");
    const plan = buildADrivenCounterpartDecisionPlan(execution);
    expect(plan.summary.plannedPackages).toBe(execution.packages.length);
    expect(plan.batches.length).toBeGreaterThan(0);
  });

  test("validates a bounded semantic decision runner batch", async () => {
    const manifest = searchEligibleManifest();
    const searchPlan = buildADrivenCounterpartSearchPlan({
      manifest,
      documents: [{ uuid: "b-doc", position: 0, sha256: "b".repeat(64) }],
    });
    const exactText = "Gebäude und Nebengebäude sind versichert.";
    const packageResults = searchPlan.packages.map((item) => ({
      packageId: item.packageId,
      completedChannels: [...REQUIRED_SEARCH_CHANNELS],
      candidates: [
        {
          compactCandidateId: "candidate-one",
          documentUuid: "b-doc",
          documentSha256: "b".repeat(64),
          clauseBoundaryId: "clause-one",
          channels: ["DINGHY"],
          sourceSpans: [
            {
              spanId: "span-one",
              exactText,
              exactTextSha256: crypto
                .createHash("sha256")
                .update(exactText)
                .digest("hex"),
              physicalPageNumber: 1,
              documentStart: 0,
              documentEnd: exactText.length,
            },
          ],
        },
      ],
    }));
    const retrieval = retrievalArtifact(searchPlan, packageResults);
    const searchExecution = materializeADrivenCounterpartSearchExecution({
      plan: searchPlan,
      retrieval,
    });
    const batch = buildADrivenCounterpartDecisionPlan(searchExecution, {
      maximumPackages: 2,
      maximumCharacters: 14_000,
    }).batches[0];
    const client = {
      chat: {
        completions: {
          create: jest.fn(async ({ messages }) => {
            const request = JSON.parse(messages[1].content);
            return {
              model: "qwen/qwen3.6-35b-a3b",
              choices: [
                {
                  message: {
                    content: JSON.stringify(
                      request.packages.map((item) => ({
                        packageId: item.packageId,
                        decision: "SUPPORTED",
                        selectedCandidateIds: ["candidate-one"],
                        dimensionChecks: item.semanticChecks.map(
                          ({ checkId, dimension }) => ({
                            checkId,
                            dimension,
                            outcome: "MATCH",
                            candidateIds: ["candidate-one"],
                          })
                        ),
                      }))
                    ),
                  },
                },
              ],
              usage: {},
            };
          }),
        },
      },
    };

    const result = await runCounterpartDecisionBatch({
      client,
      model: "qwen/qwen3.6-35b-a3b",
      modelContext: 42_496,
      searchExecution,
      batch,
      maximumAttempts: 2,
    });

    expect(result.validation.passed).toBe(true);
    expect(result.responses).toHaveLength(batch.expectedPackageIds.length);
    expect(result.attempts).toHaveLength(1);
  });

  test("journals malformed B output and changes the retry prompt before accepting repaired JSON", async () => {
    const manifest = searchEligibleManifest();
    const searchPlan = buildADrivenCounterpartSearchPlan({
      manifest,
      documents: [{ uuid: "b-doc", position: 0, sha256: "b".repeat(64) }],
    });
    const exactText = "Gebäude und Nebengebäude sind versichert.";
    const retrieval = retrievalArtifact(
      searchPlan,
      searchPlan.packages.map((item) => ({
        packageId: item.packageId,
        completedChannels: [...REQUIRED_SEARCH_CHANNELS],
        candidates: [
          {
            compactCandidateId: "candidate-one",
            documentUuid: "b-doc",
            documentSha256: "b".repeat(64),
            clauseBoundaryId: "clause-one",
            channels: ["DINGHY"],
            sourceSpans: [
              {
                spanId: "span-one",
                exactText,
                exactTextSha256: crypto
                  .createHash("sha256")
                  .update(exactText)
                  .digest("hex"),
                physicalPageNumber: 1,
                documentStart: 0,
                documentEnd: exactText.length,
              },
            ],
          },
        ],
      }))
    );
    const searchExecution = materializeADrivenCounterpartSearchExecution({
      plan: searchPlan,
      retrieval,
    });
    const batch = buildADrivenCounterpartDecisionPlan(searchExecution, {
      maximumPackages: 1,
      maximumCharacters: 14_000,
    }).batches[0];
    const validResponses = batch.packages.map((item) => ({
      packageId: item.packageId,
      decision: "SUPPORTED",
      selectedCandidateIds: ["candidate-one"],
      dimensionChecks: item.semanticChecks.map(({ checkId, dimension }) => ({
        checkId,
        dimension,
        outcome: "MATCH",
        candidateIds: ["candidate-one"],
      })),
    }));
    const malformed = `${JSON.stringify(validResponses)}\n${JSON.stringify(
      validResponses
    )}`;
    const client = {
      chat: {
        completions: {
          create: jest
            .fn()
            .mockResolvedValueOnce({
              model: "qwen/qwen3.6-35b-a3b",
              choices: [{ message: { content: malformed } }],
              usage: {},
            })
            .mockResolvedValueOnce({
              model: "qwen/qwen3.6-35b-a3b",
              choices: [
                { message: { content: JSON.stringify(validResponses) } },
              ],
              usage: {},
            }),
        },
      },
    };

    const result = await runCounterpartDecisionBatch({
      client,
      model: "qwen/qwen3.6-35b-a3b",
      modelContext: 42_496,
      searchExecution,
      batch,
      maximumAttempts: 2,
    });

    expect(result.validation.passed).toBe(true);
    expect(result.attempts[0]).toMatchObject({
      errorClass: "MODEL_RESPONSE_INVALID",
      rawResponse: malformed,
      rawResponseSha256: crypto
        .createHash("sha256")
        .update(malformed)
        .digest("hex"),
      responses: [],
      validationPassed: false,
    });
    expect(result.attempts[1].messagesSha256).not.toBe(
      result.attempts[0].messagesSha256
    );
    const retryMessages =
      client.chat.completions.create.mock.calls[1][0].messages;
    expect(retryMessages.at(-2)).toEqual({
      role: "assistant",
      content: malformed,
    });
    expect(retryMessages.at(-1).content).toContain(
      "Repariere ausschließlich die JSON-Syntax"
    );
  });

  test("aborts a hanging B decision request and retries only after safe recovery", async () => {
    const manifest = searchEligibleManifest();
    const searchPlan = buildADrivenCounterpartSearchPlan({
      manifest,
      documents: [{ uuid: "b-doc", position: 0, sha256: "b".repeat(64) }],
    });
    const exactText = "Gebäude und Nebengebäude sind versichert.";
    const retrieval = retrievalArtifact(
      searchPlan,
      searchPlan.packages.map((item) => ({
        packageId: item.packageId,
        completedChannels: [...REQUIRED_SEARCH_CHANNELS],
        candidates: [
          {
            compactCandidateId: "candidate-one",
            documentUuid: "b-doc",
            documentSha256: "b".repeat(64),
            clauseBoundaryId: "clause-one",
            channels: ["DINGHY"],
            sourceSpans: [
              {
                spanId: "span-one",
                exactText,
                exactTextSha256: crypto
                  .createHash("sha256")
                  .update(exactText)
                  .digest("hex"),
                physicalPageNumber: 1,
                documentStart: 0,
                documentEnd: exactText.length,
              },
            ],
          },
        ],
      }))
    );
    const searchExecution = materializeADrivenCounterpartSearchExecution({
      plan: searchPlan,
      retrieval,
    });
    const batch = buildADrivenCounterpartDecisionPlan(searchExecution, {
      maximumPackages: 2,
      maximumCharacters: 14_000,
    }).batches[0];
    const validResponses = batch.packages.map((item) => ({
      packageId: item.packageId,
      decision: "SUPPORTED",
      selectedCandidateIds: ["candidate-one"],
      dimensionChecks: item.semanticChecks.map(({ checkId, dimension }) => ({
        checkId,
        dimension,
        outcome: "MATCH",
        candidateIds: ["candidate-one"],
      })),
    }));
    let lateResolve;
    let releaseRecovery;
    let signalRecoveryStarted;
    let abortTriggered = false;
    const recoveryStarted = new Promise((resolve) => {
      signalRecoveryStarted = resolve;
    });
    const recoverModelAfterAbort = jest.fn(
      () =>
        new Promise((resolve) => {
          signalRecoveryStarted();
          releaseRecovery = () => resolve({ status: "SAFE_RELOADED" });
        })
    );
    const client = {
      chat: {
        completions: {
          create: jest.fn((_payload, { signal }) => {
            if (client.chat.completions.create.mock.calls.length === 1)
              return new Promise((resolve) => {
                lateResolve = resolve;
                signal.addEventListener("abort", () => {
                  abortTriggered = true;
                });
              });
            return Promise.resolve({
              model: "qwen/qwen3.6-35b-a3b",
              choices: [
                { message: { content: JSON.stringify(validResponses) } },
              ],
              usage: {},
            });
          }),
        },
      },
    };
    const running = runCounterpartDecisionBatch({
      client,
      model: "qwen/qwen3.6-35b-a3b",
      modelContext: 42_496,
      searchExecution,
      batch,
      maximumAttempts: 2,
      requestTimeoutMs: 10,
      abortSettlementTimeoutMs: 5,
      recoverModelAfterAbort,
    });
    await recoveryStarted;
    expect(abortTriggered).toBe(true);
    expect(recoverModelAfterAbort).toHaveBeenCalledTimes(1);
    expect(client.chat.completions.create).toHaveBeenCalledTimes(1);
    lateResolve({
      model: "stale-response",
      choices: [{ message: { content: "[]" } }],
      usage: {},
    });
    await new Promise((resolve) => setImmediate(resolve));
    expect(client.chat.completions.create).toHaveBeenCalledTimes(1);
    releaseRecovery();
    const result = await running;
    expect(client.chat.completions.create).toHaveBeenCalledTimes(2);
    expect(result.validation.passed).toBe(true);
    expect(result.responses).toEqual(validResponses);
    expect(result.attempts[0]).toMatchObject({
      errorClass: "MODEL_REQUEST_TIMEOUT",
      timedOut: true,
      abortTriggered: true,
      validationPassed: false,
    });
  });

  test("stops fail-closed, journals attempts and resumes at the first incomplete B batch", async () => {
    const manifest = searchEligibleManifest();
    const searchPlan = buildADrivenCounterpartSearchPlan({
      manifest,
      documents: [{ uuid: "b-doc", position: 0, sha256: "b".repeat(64) }],
    });
    const exactText = "Gebäude und Nebengebäude sind versichert.";
    const retrieval = retrievalArtifact(
      searchPlan,
      searchPlan.packages.map((item) => ({
        packageId: item.packageId,
        completedChannels: [...REQUIRED_SEARCH_CHANNELS],
        candidates: [
          {
            compactCandidateId: "candidate-one",
            documentUuid: "b-doc",
            documentSha256: "b".repeat(64),
            clauseBoundaryId: "clause-one",
            channels: ["DINGHY"],
            sourceSpans: [
              {
                spanId: "span-one",
                exactText,
                exactTextSha256: crypto
                  .createHash("sha256")
                  .update(exactText)
                  .digest("hex"),
                physicalPageNumber: 1,
                documentStart: 0,
                documentEnd: exactText.length,
              },
            ],
          },
        ],
      }))
    );
    const searchExecution = materializeADrivenCounterpartSearchExecution({
      plan: searchPlan,
      retrieval,
    });
    const decisionPlan = buildADrivenCounterpartDecisionPlan(searchExecution, {
      maximumPackages: 1,
      maximumCharacters: 14_000,
    });
    expect(decisionPlan.batches.length).toBeGreaterThan(1);
    const output = fs.mkdtempSync(
      path.join(os.tmpdir(), "lf-b-decision-resume-")
    );
    const args = {
      output,
      model: "qwen/qwen3.6-35b-a3b",
      modelContext: 42_496,
      maximumAttempts: 1,
      requestTimeoutMs: 100,
      abortSettlementTimeoutMs: 10,
      modelRecoveryTimeoutMs: 100,
    };
    const validForPayload = ({ messages }) => {
      const request = JSON.parse(messages[1].content);
      return request.packages.map((item) => ({
        packageId: item.packageId,
        decision: "SUPPORTED",
        selectedCandidateIds: ["candidate-one"],
        dimensionChecks: item.semanticChecks.map(({ checkId, dimension }) => ({
          checkId,
          dimension,
          outcome: "MATCH",
          candidateIds: ["candidate-one"],
        })),
      }));
    };
    const firstClient = {
      chat: {
        completions: {
          create: jest.fn(async (payload) => ({
            model: args.model,
            choices: [
              {
                message: {
                  content:
                    firstClient.chat.completions.create.mock.calls.length === 1
                      ? JSON.stringify(validForPayload(payload))
                      : "[]",
                },
              },
            ],
            usage: {},
          })),
        },
      },
    };
    await expect(
      processCounterpartDecisionBatches({
        args,
        searchExecution,
        decisionPlan,
        client: firstClient,
        recoverModelAfterAbort: jest.fn(),
      })
    ).rejects.toThrow("LF_A_DRIVEN_DECISION_BATCH_FAILED_CLOSED:1:");
    expect(firstClient.chat.completions.create).toHaveBeenCalledTimes(2);
    expect(
      fs.readdirSync(path.join(output, "batches"), { recursive: true })
    ).toHaveLength(1);
    const completedBatch = path.join(
      output,
      "batches",
      fs.readdirSync(path.join(output, "batches"))[0]
    );
    const predecessor = JSON.parse(fs.readFileSync(completedBatch, "utf8"));
    predecessor.promptContractId = "LF_A_DRIVEN_COUNTERPART_DECISION_PROMPT_V2";
    predecessor.promptSha256 = "a".repeat(64);
    fs.writeFileSync(completedBatch, `${JSON.stringify(predecessor)}\n`);

    const resumeClient = {
      chat: {
        completions: {
          create: jest.fn(async (payload) => ({
            model: args.model,
            choices: [
              {
                message: { content: JSON.stringify(validForPayload(payload)) },
              },
            ],
            usage: {},
          })),
        },
      },
    };
    const resumed = await processCounterpartDecisionBatches({
      args,
      searchExecution,
      decisionPlan,
      client: resumeClient,
      recoverModelAfterAbort: jest.fn(),
    });
    expect(resumed).toHaveLength(decisionPlan.batches.length);
    expect(resumeClient.chat.completions.create).toHaveBeenCalledTimes(
      decisionPlan.batches.length - 1
    );
    expect(
      fs.readdirSync(path.join(output, "batches"), { recursive: true })
    ).toHaveLength(decisionPlan.batches.length);
    expect(
      fs.readdirSync(path.join(output, "superseded-batches"))
    ).toHaveLength(1);
  });

  test("plans every A component against every B document without B-only rows", () => {
    const manifest = searchEligibleManifest();
    const bDocuments = [
      {
        uuid: "b-two",
        position: 1,
        sha256: "2".repeat(64),
        originalName: "Nachtrag.pdf",
      },
      {
        uuid: "b-one",
        position: 0,
        sha256: "1".repeat(64),
        originalName: "Polizze.pdf",
      },
    ];
    const left = buildADrivenCounterpartSearchPlan({
      manifest,
      documents: bDocuments,
    });
    const right = buildADrivenCounterpartSearchPlan({
      manifest,
      documents: [...bDocuments].reverse(),
    });

    expect(left).toEqual(right);
    expect(left.summary).toMatchObject({
      components: manifest.summary.semanticComponents,
      documents: 2,
      plannedPackages: manifest.summary.semanticComponents * 2,
      completeMatrix: true,
      customerRowsFromSideB: 0,
    });
    expect(left.summary.requiredChannels).toEqual(REQUIRED_SEARCH_CHANNELS);
    expect(
      left.packages.every(
        ({ searchCoverage }) =>
          searchCoverage.scope === "ONE_COMPONENT_ONE_B_DOCUMENT" &&
          searchCoverage.globalTopNAllowed === false
      )
    ).toBe(true);
    expect(
      new Set(
        left.packages.map(
          ({ componentId, documentUuid }) => `${componentId}:${documentUuid}`
        )
      ).size
    ).toBe(left.packages.length);
    expect(
      left.packages.every(
        ({ componentId, semanticChecks: checks }) =>
          checks.length > 0 &&
          new Set(checks.map(({ checkId }) => checkId)).size ===
            checks.length &&
          checks.filter(
            ({ role, componentId: checkedId }) =>
              role === "TARGET" && checkedId === componentId
          ).length === 1
      )
    ).toBe(true);
  });

  test("publishes only binary rows after a complete terminal decision matrix", () => {
    const manifest = searchEligibleManifest();
    const searchPlan = buildADrivenCounterpartSearchPlan({
      manifest,
      documents: [{ uuid: "b-doc", position: 0, sha256: "b".repeat(64) }],
    });
    const exactText = "Gebäude sind versichert.";
    const exactTextSha256 = crypto
      .createHash("sha256")
      .update(exactText)
      .digest("hex");
    const packageResults = searchPlan.packages.map((item) => ({
      packageId: item.packageId,
      completedChannels: [...REQUIRED_SEARCH_CHANNELS],
      candidates: [
        {
          compactCandidateId: "candidate-one",
          documentUuid: "b-doc",
          documentSha256: "b".repeat(64),
          clauseBoundaryId: "clause-one",
          sourceSpans: [
            {
              exactText,
              exactTextSha256,
              documentStart: 0,
              documentEnd: exactText.length,
            },
          ],
        },
      ],
    }));
    const retrieval = retrievalArtifact(searchPlan, packageResults);
    const searchExecution = materializeADrivenCounterpartSearchExecution({
      plan: searchPlan,
      retrieval,
    });
    const responses = searchExecution.packages.map((item) => ({
      packageId: item.packageId,
      decision: "SUPPORTED",
      selectedCandidateIds: ["candidate-one"],
      dimensionChecks: decisionChecks(item, "MATCH", ["candidate-one"]),
    }));
    const decisions = validateCounterpartDecisions({
      searchExecution,
      responses,
    });
    const result = buildADrivenBinaryReferenceResult({
      manifest,
      searchPlan,
      retrieval,
      searchExecution,
      decisions,
    });

    expect(result.summary).toMatchObject({
      rows: manifest.summary.semanticRequirements,
      found: manifest.summary.semanticRequirements,
      notFound: 0,
      unresolved: 0,
      sideBOnlyRows: 0,
      binaryCustomerStatus: true,
    });
    expect(
      new Set(result.rows.map(({ customerStatus }) => customerStatus))
    ).toEqual(new Set(["FOUND"]));
    expect(
      result.rows.every(
        ({
          aCategoryPath,
          aCheckPoint,
          aOriginalContent,
          aSourceSpans,
          bCounterparts,
          bEffects,
          reviewHint,
          manualAssessment,
        }) =>
          Array.isArray(aCategoryPath) &&
          aCheckPoint.length > 0 &&
          aOriginalContent.length > 0 &&
          aSourceSpans.length > 0 &&
          bCounterparts.length > 0 &&
          bEffects.length > 0 &&
          reviewHint.length > 0 &&
          manualAssessment === ""
      )
    ).toBe(true);
    expect(
      result.rows.reduce(
        (sum, { componentFindings }) => sum + componentFindings.length,
        0
      )
    ).toBe(manifest.summary.semanticComponents);
    const partialResponses = searchExecution.packages.map((item, index) =>
      index === 0
        ? {
            packageId: item.packageId,
            decision: "NOT_SUPPORTED",
            selectedCandidateIds: ["candidate-one"],
            dimensionChecks: item.semanticChecks.map(
              ({ checkId, dimension }, checkIndex) => ({
                checkId,
                dimension,
                outcome: checkIndex === 0 ? "MATCH" : "NOT_ESTABLISHED",
                candidateIds: checkIndex === 0 ? ["candidate-one"] : [],
              })
            ),
          }
        : responses[index]
    );
    const partial = validateCounterpartDecisions({
      searchExecution,
      responses: partialResponses,
    });
    expect(partial.summary.unresolvedPackages).toBe(0);
    expect(partial.results[0]).toMatchObject({
      status: "TERMINAL",
      decision: "NOT_SUPPORTED",
      selectedCandidateIds: ["candidate-one"],
      absenceConclusion: false,
    });
    expect(() =>
      buildADrivenBinaryReferenceResult({
        manifest,
        searchPlan,
        retrieval,
        searchExecution,
        decisions: partial,
      })
    ).toThrow("LF_A_DRIVEN_BINARY_NOT_FOUND_REQUIRES_CERTIFIED_ABSENCE");
    const boundedMisses = validateCounterpartDecisions({
      searchExecution,
      responses: searchExecution.packages.map((item) => ({
        packageId: item.packageId,
        decision: "NOT_SUPPORTED",
        selectedCandidateIds: [],
        dimensionChecks: decisionChecks(item, "NOT_ESTABLISHED"),
      })),
    });
    expect(() =>
      buildADrivenBinaryReferenceResult({
        manifest,
        searchPlan,
        retrieval,
        searchExecution,
        decisions: boundedMisses,
      })
    ).toThrow("LF_A_DRIVEN_BINARY_NOT_FOUND_REQUIRES_CERTIFIED_ABSENCE");
    const unresolved = validateCounterpartDecisions({
      searchExecution,
      responses: responses.slice(1),
    });
    expect(() =>
      buildADrivenBinaryReferenceResult({
        manifest,
        searchPlan,
        retrieval,
        searchExecution,
        decisions: unresolved,
      })
    ).toThrow("LF_A_DRIVEN_BINARY_RESULT_INPUT_INVALID");
  });

  test("rejects tampering at the retrieval boundary", () => {
    const manifest = searchEligibleManifest();
    const searchPlan = buildADrivenCounterpartSearchPlan({
      manifest,
      documents: [{ uuid: "b-doc", position: 0, sha256: "b".repeat(64) }],
    });
    const retrieval = retrievalArtifact(
      searchPlan,
      searchPlan.packages.map(({ packageId }) => ({
        packageId,
        completedChannels: [],
        candidates: [],
      }))
    );
    const tampered = JSON.parse(JSON.stringify(retrieval));
    tampered.packageResults[0].completedChannels.push("CURRENT");

    expect(() =>
      materializeADrivenCounterpartSearchExecution({
        plan: searchPlan,
        retrieval: tampered,
      })
    ).toThrow("LF_A_DRIVEN_RETRIEVAL_DIGEST_INVALID");
  });
});

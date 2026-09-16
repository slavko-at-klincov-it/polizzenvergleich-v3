const {
  A_DRIVEN_RUN_CONTRACT_ID,
  A_SOURCE_UNIT_PLAN_CONTRACT_ID,
  buildADrivenSourceUnitPlan,
  stableStringify,
} = require("../../utils/policyAnalysis/aDrivenSourceUnitPlan");
const {
  A_DYNAMIC_MANIFEST_CONTRACT_ID,
  A_DYNAMIC_MANIFEST_CONTRACT_ID_V11,
  A_DYNAMIC_MANIFEST_CONTRACT_ID_V12,
  A_SEMANTIC_SIGNAL_CONTRACT_ID,
  A_SEMANTIC_SIGNAL_CONTRACT_ID_V1,
  A_SEMANTIC_SIGNAL_CONTRACT_ID_V2,
  A_SEMANTIC_SIGNAL_CONTRACT_ID_V6,
  A_SEMANTIC_SIGNAL_CONTRACT_ID_V7,
  A_SEMANTIC_SIGNAL_CONTRACT_ID_V9,
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
  A_DRIVEN_REQUIREMENT_BINARY_RESULT_CONTRACT_ID,
  buildADrivenBinaryReferenceResult,
  buildADrivenRequirementBinaryReferenceResult,
  validateADrivenRequirementBinaryReferenceResult,
} = require("../../utils/policyAnalysis/aDrivenBinaryReferenceResult");
const {
  buildADrivenGoldRegression,
} = require("../../utils/policyAnalysis/aDrivenGoldRegression");
const {
  buildADrivenRequirementPlanGoldRegression,
} = require("../../utils/policyAnalysis/aDrivenRequirementPlanGoldRegression");
const {
  assessADrivenManifestAtomicityRisks,
  buildADrivenAStatusAudit,
  compareADrivenManifestAtomicity,
} = require("../../utils/policyAnalysis/aDrivenAStatusAudit");
const {
  attachTopLevelRequirementFragments,
  batchResultFile,
  compatibleSeedResponses,
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
  journalState: requirementDecisionJournalState,
  normalizeIdentityCoreModifierDifferences,
  normalizeRepeatedCandidateIds,
  prompt: requirementDecisionPrompt,
  repairInstruction: requirementDecisionRepairInstruction,
  runBatch: runRequirementDecisionBatch,
} = require("../../scripts/qa/runADrivenRequirementCounterpartDecisions.cjs");
const {
  buildADrivenCounterpartDecisionPlan,
} = require("../../utils/policyAnalysis/aDrivenCounterpartDecisionPlan");
const {
  A_DRIVEN_REQUIREMENT_DECISION_CONTRACT_ID,
  A_DRIVEN_REQUIREMENT_DECISION_PLAN_CONTRACT_ID,
  buildADrivenRequirementDecisionPlan,
  validateADrivenRequirementDecisionArtifact,
  validateADrivenRequirementDecisionResponses,
} = require("../../utils/policyAnalysis/aDrivenRequirementCounterpartDecision");
const {
  buildADrivenCompleteBCorpus,
} = require("../../utils/policyAnalysis/aDrivenCompleteBCorpus");
const {
  A_DRIVEN_REQUIREMENT_DECISION_PLAN_CONTRACT_ID_V2,
  buildADrivenRequirementSegmentedPlan,
} = require("../../utils/policyAnalysis/aDrivenRequirementSegmentedPlan");
const {
  A_DRIVEN_REQUIREMENT_ABSENCE_PLAN_CONTRACT_ID,
  buildADrivenRequirementAbsencePlan,
  buildADrivenRequirementFinalDecisions,
  buildADrivenRequirementRescueReviewPlan,
  validateADrivenRequirementAbsenceDecisionArtifact,
  validateADrivenRequirementAbsencePlan,
  validateADrivenRequirementAbsencePartitionResponse,
  validateADrivenRequirementAbsenceResponses,
  validateADrivenRequirementFinalDecisionArtifact,
} = require("../../utils/policyAnalysis/aDrivenRequirementAbsenceCertification");
const {
  reviewWorkbookRows,
  writeADrivenRequirementReviewWorkbook,
} = require("../../utils/policyAnalysis/aDrivenRequirementReviewWorkbook");
const {
  buildADrivenReferenceProductResult,
  validateADrivenReferenceProductResult,
  writeADrivenReferenceProductArtifacts,
} = require("../../utils/policyComparison/aDrivenReferenceResultBuilder");
const {
  validatePublishedComparisonArtifactSet,
} = require("../../utils/policyComparison/artifactSetPublisher");
const {
  readValidatedComparisonResult,
} = require("../../utils/policyComparison/comparisonResultReader");
const {
  POLICY_COMPARISON_MODE,
} = require("../../utils/policyComparison/modes");
const {
  presentReferenceCustomerResult,
} = require("../../utils/policyComparison/referenceCustomerPresentation");
const {
  compatibleSeedPartitionResponses,
  parseSingleDecision: parseRequirementAbsenceDecision,
  positiveCandidateSignals: requirementAbsencePositiveCandidateSignals,
  preliminaryDecision: preliminaryRequirementAbsenceDecision,
  preliminaryDecisionArtifact,
  prompt: requirementAbsencePrompt,
  runPartition: runRequirementAbsencePartition,
} = require("../../scripts/qa/runADrivenRequirementAbsenceDecisions.cjs");
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
    expect(systemText).toContain(
      "eine einleitende Formulierung „aus der/dem …“"
    );
    expect(systemText).toContain("Die Versicherung erstreckt sich auf …");
    expect(systemText).toContain(
      "structurePath ist ausschließlich Navigation und niemals Evidenz"
    );
    expect(systemText).toContain(
      "governingContext kann Deckungswirkung, Limit, Bedingung, Scope, Gefahr"
    );
    expect(systemText).toContain(
      "einen gemeinsamen Schaden-, Wirkungs- oder Ursachenbegriff nicht künstlich vor jedes Zielobjekt kopieren"
    );
    expect(systemText).toContain(
      "Ellipsen wie „...“ und neu zusammengesetzte Labels sind verboten"
    );
    expect(systemText).toContain(
      "In Ergänzung bestehender/der bestehenden Bestimmungen oder Bedingungen"
    );
    expect(systemText).toContain(
      "als eigene wörtliche PRECEDENCE_OR_REPLACEMENT-Komponente"
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

  test("recovers a positive coverage heading expressed as Versicherung erstreckt sich auf", () => {
    const source = (combinedText, blockId) => ({
      documentUuid: "doc",
      blockIds: [blockId],
      blocks: [{ blockId, exactText: combinedText }],
      combinedText,
    });
    const headingText =
      "8.2. Die Versicherung erstreckt sich auf Schadenersatzverpflichtungen";
    const plan = {
      units: [
        {
          unitId: "coverage-heading",
          unitKind: "HEADING",
          structurePath: [headingText],
          source: source(headingText, "coverage-heading-block"),
        },
        {
          unitId: "covered-item",
          unitKind: "LIST",
          structurePath: [headingText],
          source: source(
            "• aus der Wartung und Pflege des Gebäudes",
            "covered-item-block"
          ),
        },
        {
          unitId: "duration-heading",
          unitKind: "HEADING",
          structurePath: ["Die Frist erstreckt sich auf zwölf Monate"],
          source: source(
            "Die Frist erstreckt sich auf zwölf Monate",
            "duration-heading-block"
          ),
        },
        {
          unitId: "duration-item",
          unitKind: "CLAUSE",
          structurePath: ["Die Frist erstreckt sich auf zwölf Monate"],
          source: source("Wiederaufbau", "duration-item-block"),
        },
      ],
    };

    const recovered = deriveClassificationEvidencePlan(plan);
    const byId = new Map(recovered.units.map((unit) => [unit.unitId, unit]));

    expect(byId.get("covered-item").governingContext).toMatchObject({
      relationType: "RECOVERS_OPERATIVE_HEADING_GOVERNOR",
      unitIds: ["coverage-heading"],
      blockIds: ["coverage-heading-block"],
    });
    expect(byId.get("duration-item").governingContext).toBeUndefined();
    expect(recovered.classificationEvidenceContext.recoveredContexts).toBe(1);
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
      contractId: "LF_A_CLASSIFICATION_EVIDENCE_CONTEXT_V6",
      recoveredContexts: 2,
      refinedListUnits: 0,
      additionalLogicalSegments: 0,
    });
  });

  test("continues an open list governor across adjacent items and a same-polarity semicolon bridge", () => {
    const source = (combinedText, blockId, ordinal) => ({
      documentUuid: "doc",
      blockIds: [blockId],
      blocks: [{ blockId, exactText: combinedText, ordinal }],
      combinedText,
    });
    const plan = {
      units: [
        {
          unitId: "governor",
          unitKind: "CLAUSE",
          structurePath: ["Grunddeckung"],
          source: source("Versichert sind Schäden durch", "governor", 1),
        },
        {
          unitId: "first-item",
          unitKind: "LIST",
          structurePath: ["Grunddeckung"],
          source: source("• Rohrbruch.", "first", 2),
        },
        {
          unitId: "covered-bridge",
          unitKind: "CLAUSE",
          structurePath: ["Grunddeckung"],
          source: source(
            "Das Vorhandensein einer Fußbodenheizung ist mitversichert;",
            "bridge",
            3
          ),
        },
        {
          unitId: "second-item",
          unitKind: "LIST",
          structurePath: ["Grunddeckung"],
          source: source("• Frostschäden;", "second", 4),
        },
        {
          unitId: "third-item",
          unitKind: "LIST",
          structurePath: ["Grunddeckung"],
          source: source("• Wasseraustritt.", "third", 5),
        },
      ],
    };

    const recovered = deriveClassificationEvidencePlan(plan);
    const byId = new Map(recovered.units.map((unit) => [unit.unitId, unit]));

    expect(byId.get("first-item").governingContext).toMatchObject({
      relationType: "RECOVERS_ADJACENT_LIST_GOVERNOR",
      unitIds: ["governor"],
      blockIds: ["governor"],
    });
    expect(byId.get("covered-bridge").governingContext).toBeUndefined();
    for (const unitId of ["second-item", "third-item"])
      expect(byId.get(unitId).governingContext).toMatchObject({
        relationType: "RECOVERS_CONTINUED_LIST_GOVERNOR",
        unitIds: ["governor"],
        blockIds: ["governor"],
      });
    expect(recovered.classificationEvidenceContext).toEqual({
      contractId: "LF_A_CLASSIFICATION_EVIDENCE_CONTEXT_V6",
      recoveredContexts: 3,
      refinedListUnits: 0,
      additionalLogicalSegments: 0,
    });
  });

  test("recovers a negative reimbursement governor across adjacent list items", () => {
    const source = (combinedText, blockId, ordinal) => ({
      documentUuid: "doc",
      blockIds: [blockId],
      blocks: [{ blockId, exactText: combinedText, ordinal }],
      combinedText,
    });
    const structurePath = ["Entschädigung"];
    const plan = {
      units: [
        {
          unitId: "negative-governor",
          unitKind: "CLAUSE",
          structurePath,
          source: source("Nicht ersetzt werden", "governor", 1),
        },
        {
          unitId: "first-exclusion",
          unitKind: "LIST",
          structurePath,
          source: source("• ein persönlicher Liebhaberwert;", "first", 2),
        },
        {
          unitId: "second-exclusion",
          unitKind: "LIST",
          structurePath,
          source: source("• Vorschäden.", "second", 3),
        },
      ],
    };

    const recovered = deriveClassificationEvidencePlan(plan);
    const byId = new Map(recovered.units.map((unit) => [unit.unitId, unit]));

    expect(byId.get("first-exclusion").governingContext).toMatchObject({
      relationType: "RECOVERS_ADJACENT_LIST_GOVERNOR",
      unitIds: ["negative-governor"],
      blockIds: ["governor"],
    });
    expect(byId.get("second-exclusion").governingContext).toMatchObject({
      relationType: "RECOVERS_CONTINUED_LIST_GOVERNOR",
      unitIds: ["negative-governor"],
      blockIds: ["governor"],
    });
    expect(recovered.classificationEvidenceContext).toEqual({
      contractId: "LF_A_CLASSIFICATION_EVIDENCE_CONTEXT_V6",
      recoveredContexts: 2,
      refinedListUnits: 0,
      additionalLogicalSegments: 0,
    });
  });

  test("keeps the nearest explicit coverage governor when an outer heading has the opposite polarity", () => {
    const source = (combinedText, blockId, ordinal) => ({
      documentUuid: "doc",
      blockIds: [blockId],
      blocks: [{ blockId, exactText: combinedText, ordinal }],
      combinedText,
    });
    const plan = {
      units: [
        {
          unitId: "positive-heading",
          unitKind: "HEADING",
          source: source("Versichert sind:", "positive-heading", 1),
        },
        {
          unitId: "negative-governor",
          unitKind: "CLAUSE",
          structurePath: ["Versichert sind:"],
          source: source("Nicht versichert sind", "negative-governor", 2),
        },
        {
          unitId: "excluded-item",
          unitKind: "LIST",
          structurePath: ["Versichert sind:"],
          source: source("• Innenverglasungen", "excluded-item", 3),
        },
        {
          unitId: "negative-heading",
          unitKind: "HEADING",
          source: source("Nicht versichert sind:", "negative-heading", 4),
        },
        {
          unitId: "positive-governor",
          unitKind: "CLAUSE",
          structurePath: ["Nicht versichert sind:"],
          source: source("Mitversichert sind", "positive-governor", 5),
        },
        {
          unitId: "included-item",
          unitKind: "LIST",
          structurePath: ["Nicht versichert sind:"],
          source: source("• Solaranlagen", "included-item", 6),
        },
      ],
    };

    const recovered = deriveClassificationEvidencePlan(plan);
    const byId = new Map(recovered.units.map((unit) => [unit.unitId, unit]));

    expect(byId.get("negative-governor").governingContext).toBeUndefined();
    expect(byId.get("excluded-item").governingContext).toMatchObject({
      relationType: "RECOVERS_ADJACENT_LIST_GOVERNOR",
      unitIds: ["negative-governor"],
      blockIds: ["negative-governor"],
    });
    expect(byId.get("positive-governor").governingContext).toBeUndefined();
    expect(byId.get("included-item").governingContext).toMatchObject({
      relationType: "RECOVERS_ADJACENT_LIST_GOVERNOR",
      unitIds: ["positive-governor"],
      blockIds: ["positive-governor"],
    });
    expect(recovered.classificationEvidenceContext).toEqual({
      contractId: "LF_A_CLASSIFICATION_EVIDENCE_CONTEXT_V6",
      recoveredContexts: 2,
      refinedListUnits: 0,
      additionalLogicalSegments: 0,
    });
  });

  test.each([
    {
      name: "opposite-polarity bridge",
      bridgeText: "Dieser Baustein ist nicht versichert;",
      bridgeOrdinal: 3,
      targetOrdinal: 4,
      targetPath: ["Grunddeckung"],
    },
    {
      name: "closed intervening clause",
      bridgeText: "Der Vertrag endet heute.",
      bridgeOrdinal: 3,
      targetOrdinal: 4,
      targetPath: ["Grunddeckung"],
    },
    {
      name: "source gap",
      bridgeText: "Dieser Baustein ist mitversichert;",
      bridgeOrdinal: 3,
      targetOrdinal: 5,
      targetPath: ["Grunddeckung"],
    },
    {
      name: "structure change",
      bridgeText: "Dieser Baustein ist mitversichert;",
      bridgeOrdinal: 3,
      targetOrdinal: 4,
      targetPath: ["Ausschlüsse"],
    },
  ])("stops continued list governors at a $name", (variant) => {
    const source = (combinedText, blockId, ordinal) => ({
      documentUuid: "doc",
      blockIds: [blockId],
      blocks: [{ blockId, exactText: combinedText, ordinal }],
      combinedText,
    });
    const plan = {
      units: [
        {
          unitId: "governor",
          unitKind: "CLAUSE",
          structurePath: ["Grunddeckung"],
          source: source("Versichert sind Schäden durch", "governor", 1),
        },
        {
          unitId: "first-item",
          unitKind: "LIST",
          structurePath: ["Grunddeckung"],
          source: source("• Rohrbruch.", "first", 2),
        },
        {
          unitId: "bridge",
          unitKind: "CLAUSE",
          structurePath: ["Grunddeckung"],
          source: source(variant.bridgeText, "bridge", variant.bridgeOrdinal),
        },
        {
          unitId: "target",
          unitKind: "LIST",
          structurePath: variant.targetPath,
          source: source("• Frostschäden.", "target", variant.targetOrdinal),
        },
      ],
    };

    const recovered = deriveClassificationEvidencePlan(plan);

    expect(
      recovered.units.find(({ unitId }) => unitId === "target").governingContext
    ).toBeUndefined();
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

async function writeCompletedClassificationSeed({ directory, plan }) {
  const batches = buildADrivenClassificationBatches(plan);
  const args = {
    model: "qwen/qwen3.6-35b-a3b",
    modelContext: 42_496,
  };
  const results = [];
  for (const batch of batches.batches) {
    const contextualBatch = {
      ...batch,
      units: batch.expectedUnitIds.map((unitId) =>
        plan.units.find((unit) => unit.unitId === unitId)
      ),
    };
    const responses = contextualBatch.units.map(validResponse);
    const result = await runBatch({
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
      batch: contextualBatch,
      maximumAttempts: 1,
    });
    const file = batchResultFile(directory, batch);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(result, null, 2)}\n`);
    results.push(result);
  }
  const responses = results.flatMap(({ responses: items }) => items);
  const firstResult = results[0];
  const summary = {
    contractId: firstResult.contractId,
    sourceUnitPlanSha256: plan.planSha256,
    promptContractId: firstResult.promptContractId,
    validatorContractId: firstResult.validatorContractId,
    semanticSignalContractId: firstResult.semanticSignalContractId,
    classificationBatchesSha256: crypto
      .createHash("sha256")
      .update(JSON.stringify(batches))
      .digest("hex"),
    model: {
      id: args.model,
      loadedContextLength: args.modelContext,
    },
    batches: batches.batches.length,
    validBatches: batches.batches.length,
    unresolvedBatches: 0,
    unresolvedUnits: 0,
    reviewRequiredBlocks: 0,
    allBlocksTerminal: true,
    responseIntegrityStatus: "VALID",
  };
  fs.writeFileSync(
    path.join(directory, "source-unit-plan.private.json"),
    `${JSON.stringify(plan, null, 2)}\n`
  );
  fs.writeFileSync(
    path.join(directory, "classification-batches.private.json"),
    `${JSON.stringify(batches, null, 2)}\n`
  );
  fs.writeFileSync(
    path.join(directory, "responses.private.json"),
    `${JSON.stringify(responses, null, 2)}\n`
  );
  fs.writeFileSync(
    path.join(directory, "summary.private.json"),
    `${JSON.stringify(summary, null, 2)}\n`
  );
  return { batches, responses, summary };
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

  test("requires an exclusion effect for an explicit negative reimbursement clause", () => {
    const source =
      "Die Behandlungskosten für kontaminierte Sachen werden nicht ersetzt.";
    const diagnostics = requirementRoleEvidenceDiagnostics(
      evidenceUnit(["b1", source]),
      [
        requirement(
          ["b1"],
          [component("FACT_ROLE", "b1", { label: "Behandlungskosten" })]
        ),
      ]
    );

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "REQUIREMENT_ROLE_EVIDENCE_UNMAPPED",
          signalId: "EXPLICIT_EXCLUSION",
          requiredCoverageEffect: "EXCLUDED",
          matchedEvidence: expect.arrayContaining([
            expect.objectContaining({ match: "nicht ersetzt" }),
          ]),
        }),
      ])
    );
  });

  test("binds a clear cost anaphor to the prior cost role in the same requirement", () => {
    const unit = evidenceUnit(
      ["cost-role", "Entstehen Kosten für die Behandlung von Altlasten,"],
      [
        "cost-anaphor",
        "werden nur jene Kosten ersetzt, die den Betrag übersteigen.",
      ]
    );
    const requirements = [
      requirement(
        ["cost-role", "cost-anaphor"],
        [
          component("FACT_ROLE", "cost-role", {
            label: "Kosten für die Behandlung von Altlasten",
          }),
          component("COVERAGE_EFFECT", "cost-anaphor", {
            label: "ersetzt",
            coverageEffect: "INCLUDED",
          }),
        ]
      ),
    ];

    expect(requirementRoleEvidenceDiagnostics(unit, requirements)).toEqual([]);
    expect(
      requirementRoleEvidenceDiagnostics(unit, requirements, {
        semanticSignalContractId: A_SEMANTIC_SIGNAL_CONTRACT_ID_V9,
      })
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "REQUIREMENT_ROLE_EVIDENCE_UNMAPPED",
          signalId: "EXPLICIT_COST_ROLE",
          matchedEvidence: expect.arrayContaining([
            expect.objectContaining({ blockId: "cost-anaphor" }),
          ]),
        }),
      ])
    );
  });

  test("does not let a prior cost role absorb a new non-anaphoric cost type", () => {
    const unit = evidenceUnit(
      ["treatment", "Kosten für die Behandlung von Altlasten werden ersetzt."],
      ["demolition", "Zusätzliche Kosten für den Abbruch werden nicht ersetzt."]
    );
    const diagnostics = requirementRoleEvidenceDiagnostics(unit, [
      requirement(
        ["treatment", "demolition"],
        [
          component("FACT_ROLE", "treatment", {
            label: "Kosten für die Behandlung von Altlasten",
          }),
          component("COVERAGE_EFFECT", "treatment", {
            label: "ersetzt",
            coverageEffect: "INCLUDED",
          }),
          component("COVERAGE_EFFECT", "demolition", {
            label: "nicht ersetzt",
            coverageEffect: "EXCLUDED",
          }),
        ]
      ),
    ]);

    expect(
      diagnostics.filter(({ signalId }) => signalId === "EXPLICIT_COST_ROLE")
    ).toEqual([
      expect.objectContaining({
        matchedEvidence: expect.arrayContaining([
          expect.objectContaining({ blockId: "demolition" }),
        ]),
      }),
    ]);
  });

  test("does not treat a German word after beträgt as an OCR numeric value", () => {
    const source =
      "Die Versicherungssumme beträgt im Rahmen der Pauschalversicherungssumme.";
    const diagnostics = requirementRoleEvidenceDiagnostics(
      evidenceUnit(["b1", source]),
      [
        requirement(
          ["b1"],
          [
            component("LIMIT_BASIS", "b1", {
              label: "im Rahmen der Pauschalversicherungssumme",
            }),
          ]
        ),
      ]
    );

    expect(diagnostics).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          signalId: "EXPLICIT_QUANTIFIED_VALUE",
        }),
      ])
    );
  });

  test("keeps an OCR-like quantity when it contains at least one real digit", () => {
    const source = "Die Entschädigung beträgt l0 % der Versicherungssumme.";
    const diagnostics = requirementRoleEvidenceDiagnostics(
      evidenceUnit(["b1", source]),
      [requirement(["b1"], [component("LIMIT_BASIS", "b1")])]
    );

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "REQUIREMENT_ROLE_EVIDENCE_UNMAPPED",
          signalId: "EXPLICIT_QUANTIFIED_VALUE",
          matchedEvidence: expect.arrayContaining([
            expect.objectContaining({ match: "beträgt l0 %" }),
          ]),
        }),
      ])
    );
  });

  test("accepts a source-bound amount after im Rahmen without inventing an extra value", () => {
    const source =
      "Die Versicherungssumme beträgt im Rahmen der Pauschalversicherungssumme EUR 5.000,- pro Schadenfall.";
    const diagnostics = requirementRoleEvidenceDiagnostics(
      evidenceUnit(["b1", source]),
      [
        requirement(
          ["b1"],
          [
            component("LIMIT_BASIS", "b1", {
              label: "im Rahmen der Pauschalversicherungssumme",
            }),
            component("VALUE_AND_UNIT", "b1", {
              label: "EUR 5.000,- pro Schadenfall",
              rawValue: "5.000",
              unit: "EUR",
            }),
          ]
        ),
      ]
    );

    expect(diagnostics).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          signalId: "EXPLICIT_QUANTIFIED_VALUE",
        }),
      ])
    );
  });

  test("keeps the frozen V7 quantified-value behavior available for replay", () => {
    const source =
      "Die Versicherungssumme beträgt im Rahmen der Pauschalversicherungssumme.";
    const diagnostics = requirementRoleEvidenceDiagnostics(
      evidenceUnit(["b1", source]),
      [requirement(["b1"], [component("LIMIT_BASIS", "b1")])],
      { semanticSignalContractId: A_SEMANTIC_SIGNAL_CONTRACT_ID_V7 }
    );

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          signalContractId: A_SEMANTIC_SIGNAL_CONTRACT_ID_V7,
          signalId: "EXPLICIT_QUANTIFIED_VALUE",
        }),
      ])
    );
  });

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

  test("materializes an inherited percentage limit basis from its exact source block", () => {
    const unit = {
      ...evidenceUnit(["item", "Gebäudebestandteile"]),
      governingContext: {
        blockIds: ["limit-value", "limit-basis"],
        blocks: [
          {
            blockId: "limit-value",
            exactText: "Zusätzlich versichert bis zu 1%der ",
          },
          {
            blockId: "limit-basis",
            exactText: "Gebäudeversicherungssumme maximal EUR 10.000,-",
          },
        ],
      },
    };
    const result = materializeSharedSignalComponents(unit, [
      requirement(
        ["item"],
        [
          component("OBJECT", "item", { label: "Gebäudebestandteile" }),
          component("VALUE_AND_UNIT", "limit-value", {
            label: "1%",
            rawValue: "1",
            unit: "%",
          }),
        ]
      ),
    ]);

    expect(result.requirements[0].components).toContainEqual({
      type: "LIMIT_BASIS",
      label: "Gebäudeversicherungssumme",
      sourceBlockIds: ["limit-basis"],
    });
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "LOCAL_SIGNAL_COMPONENT_MATERIALIZED",
        signalId: "EXPLICIT_LIMIT_BASIS",
        componentType: "LIMIT_BASIS",
        sourceBlockIds: ["limit-basis"],
      })
    );
    expect(
      requirementRoleEvidenceDiagnostics(unit, result.requirements)
    ).toEqual([]);
  });

  test("materializes an intentional-damage peril without absorbing its object", () => {
    const source =
      "Böswillige Beschädigung und Unbrauchbarmachen (erweiterter Vandalismus) von Gebäudebestandteilen";
    const unit = evidenceUnit(["item", source]);
    const result = materializeSharedSignalComponents(unit, [
      {
        ...requirement(
          ["item"],
          [
            component("OBJECT", "item", {
              label: "Gebäudebestandteilen",
            }),
          ]
        ),
        displayLabel: source,
      },
    ]);

    expect(result.requirements[0].components).toContainEqual({
      type: "PERIL_OR_CAUSE",
      label:
        "Böswillige Beschädigung und Unbrauchbarmachen (erweiterter Vandalismus)",
      sourceBlockIds: ["item"],
    });
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "LOCAL_SIGNAL_COMPONENT_MATERIALIZED",
        signalId: "EXPLICIT_INTENTIONAL_DAMAGE",
      })
    );
    expect(
      requirementRoleEvidenceDiagnostics(unit, result.requirements)
    ).toEqual([]);
  });

  test("does not infer a peril from an unqualified damage-to-object phrase", () => {
    const source = "Beschädigung von Gebäudebestandteilen";
    const unit = evidenceUnit(["item", source]);
    const input = [
      {
        ...requirement(
          ["item"],
          [
            component("OBJECT", "item", {
              label: "Gebäudebestandteilen",
            }),
          ]
        ),
        displayLabel: source,
      },
    ];

    expect(materializeSharedSignalComponents(unit, input)).toEqual({
      requirements: input,
      diagnostics: [],
    });
  });

  test("keeps the frozen V6 signal contract free of V7 intentional-damage materialization", () => {
    const source = "Vorsätzliche Beschädigung von Gebäudebestandteilen";
    const unit = evidenceUnit(["item", source]);
    const input = [
      {
        ...requirement(
          ["item"],
          [
            component("OBJECT", "item", {
              label: "Gebäudebestandteilen",
            }),
          ]
        ),
        displayLabel: source,
      },
    ];

    expect(
      materializeSharedSignalComponents(unit, input, {
        semanticSignalContractId: A_SEMANTIC_SIGNAL_CONTRACT_ID_V6,
      })
    ).toEqual({ requirements: input, diagnostics: [] });
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

  test("materializes every bounded parent condition into each subordinate item", () => {
    const unit = {
      unitId: "subordinate-objects",
      source: {
        blockIds: ["item-one", "item-two"],
        blocks: [
          { blockId: "item-one", exactText: "elektrische Einrichtungen" },
          { blockId: "item-two", exactText: "Pumpen und Motoren" },
        ],
        combinedText: "elektrische Einrichtungen\nPumpen und Motoren",
      },
      governingContext: {
        blockIds: [
          "ownership-lead",
          "ownership-tail",
          "limit-condition-lead",
          "limit-condition-tail",
        ],
        blocks: [
          {
            blockId: "ownership-lead",
            exactText: "soweit sie im Eigentum des Versicherungsnehmers /",
          },
          {
            blockId: "ownership-tail",
            exactText: "Gebäudeeigentümers stehen – bis 1%",
          },
          {
            blockId: "limit-condition-lead",
            exactText: "sofern kein zusätzlicher Betrag",
          },
          {
            blockId: "limit-condition-tail",
            exactText: "laut Polizze vereinbart wurde, innerhalb von Gebäuden",
          },
        ],
      },
    };
    const result = materializeSharedSignalComponents(unit, [
      requirement(
        ["item-one"],
        [
          component("OBJECT", "item-one", {
            label: "elektrische Einrichtungen",
          }),
        ]
      ),
      requirement(
        ["item-two"],
        [component("OBJECT", "item-two", { label: "Pumpen und Motoren" })]
      ),
    ]);

    for (const requirementResult of result.requirements)
      expect(
        requirementResult.components
          .filter(({ type }) => type === "CONDITION")
          .map(({ label, sourceBlockIds }) => ({ label, sourceBlockIds }))
      ).toEqual([
        {
          label:
            "soweit sie im Eigentum des Versicherungsnehmers /\nGebäudeeigentümers stehen",
          sourceBlockIds: ["ownership-lead", "ownership-tail"],
        },
        {
          label:
            "sofern kein zusätzlicher Betrag\nlaut Polizze vereinbart wurde",
          sourceBlockIds: ["limit-condition-lead", "limit-condition-tail"],
        },
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

  test("treats ausgenommen below a colon-terminated negative governor as an exception", () => {
    const unit = {
      ...evidenceUnit([
        "custody-item",
        "genommen haben (ausgenommen die vorgenannten Sachen der Logiergäste).",
      ]),
      governingContext: {
        blockIds: ["negative-governor"],
        blocks: [
          {
            blockId: "negative-governor",
            exactText:
              "8.4. Nicht versichert im Rahmen der Gebäude- und Grundstückshaftpflichtversicherung sind:",
          },
        ],
      },
    };
    const exclusion = component("COVERAGE_EFFECT", "negative-governor", {
      label: "Nicht versichert",
      coverageEffect: "EXCLUDED",
    });
    const requirements = [
      requirement(
        ["custody-item"],
        [
          component("OBJECT", "custody-item", { label: "Sachen" }),
          component("SCOPE", "custody-item", {
            label: "ausgenommen die vorgenannten Sachen der Logiergäste",
          }),
          exclusion,
        ]
      ),
    ];
    const result = materializeSharedSignalComponents(unit, requirements);

    expect(
      result.requirements[0].components.filter(
        ({ type }) => type === "COVERAGE_EFFECT"
      )
    ).toEqual([exclusion]);
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

  test("does not treat a different larger numeric literal as evidence for a smaller value", () => {
    const unit = {
      ...evidenceUnit(["item", "elektrische Einrichtungen"]),
      governingContext: {
        blockIds: ["limit-governor"],
        blocks: [
          {
            blockId: "limit-governor",
            exactText: "bis 1% der Versicherungssumme mindestens EUR 10.000",
          },
        ],
      },
    };
    const result = materializeSharedSignalComponents(unit, [
      {
        ...requirement(
          ["limit-governor", "item"],
          [
            component("OBJECT", "item", {
              label: "elektrische Einrichtungen",
            }),
            component("LIMIT_BASIS", "limit-governor", {
              label: "bis 1% der Versicherungssumme",
            }),
            {
              type: "VALUE_AND_UNIT",
              label: "mindestens EUR 10.000",
              rawValue: "10.000",
              unit: "EUR",
              sourceBlockIds: ["limit-governor"],
            },
          ]
        ),
        displayLabel: "elektrische Einrichtungen",
      },
    ]);

    expect(result.requirements[0].components).toContainEqual({
      type: "VALUE_AND_UNIT",
      label: "bis 1%",
      rawValue: "1",
      unit: "%",
      sourceBlockIds: ["limit-governor"],
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

  test("canonicalizes an inverted aggregated-event definition with its local coverage governor", () => {
    const blocks = [
      {
        blockId: "aggregate-relation",
        exactText:
          "• Weiters  gelten  als  ein  Versicherungsfall  mehrere  auf  derselben  Ursache  beruhende ",
      },
      {
        blockId: "aggregate-members",
        exactText:
          "Schadenereignisse  sowie  Schadenereignisse  die  auf  gleichartigen  Ursachen  beruhen,  wenn ",
      },
      {
        blockId: "aggregate-condition",
        exactText:
          "zwischen  diesen  Ursachen  ein  rechtlicher,  wirtschaftlicher  oder  technischer  Zusammenhang ",
      },
      { blockId: "aggregate-end", exactText: "besteht. " },
    ];
    const source = blocks.map(({ exactText }) => exactText).join("\n");
    const unit = {
      unitId: "inverted-aggregate-definition",
      unitKind: "LIST",
      source: {
        blockIds: blocks.map(({ blockId }) => blockId),
        combinedText: source,
        blocks,
      },
      governingContext: {
        blockIds: ["coverage-governor"],
        combinedText: "8.1. Versichert sind  ",
        blocks: [
          {
            blockId: "coverage-governor",
            exactText: "8.1. Versichert sind  ",
          },
        ],
      },
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
                  label: source,
                  sourceBlockIds: unit.source.blockIds,
                },
                {
                  type: "COVERAGE_EFFECT",
                  label: "gelten als ein Versicherungsfall",
                  sourceBlockIds: ["aggregate-relation"],
                  coverageEffect: "INCLUDED",
                },
              ],
            },
          ],
        },
      ],
      [unit]
    );

    const response = normalized.responses[0];
    expect(response.primaryClass).toBe("DEFINITION");
    expect(response.semanticClasses).toEqual([
      "DEFINITION",
      "CONDITION",
      "OPERATIVE_COVERAGE_STATEMENT",
    ]);
    expect(response.requirements[0].components.map(({ type }) => type)).toEqual(
      ["FACT_ROLE", "CONDITION", "CONDITION", "COVERAGE_EFFECT"]
    );
    expect(response.requirements[0].components[0]).toMatchObject({
      type: "FACT_ROLE",
      label: "gelten  als  ein  Versicherungsfall",
      sourceBlockIds: ["aggregate-relation"],
    });
    expect(response.requirements[0].components.at(-1)).toEqual({
      type: "COVERAGE_EFFECT",
      label: "Versichert sind",
      sourceBlockIds: ["coverage-governor"],
      coverageEffect: "INCLUDED",
    });
    expect(
      new Set(
        response.requirements[0].components.flatMap(
          ({ sourceBlockIds }) => sourceBlockIds
        )
      )
    ).toEqual(new Set([...unit.source.blockIds, "coverage-governor"]));
    expect(normalized.componentRepairs).toContainEqual({
      unitId: unit.unitId,
      requirementIndex: 0,
      action: "CANONICALIZE_AGGREGATED_EVENT_DEFINITION",
      memberConditions: 2,
    });
  });

  test("canonicalizes a subject-first aggregated-event definition without inventing coverage", () => {
    const source =
      "Mehrere Schäden aus derselben Ursache gelten als ein Schadenereignis.";
    const unit = {
      unitId: "subject-first-aggregate-definition",
      source: {
        blockIds: ["aggregate"],
        combinedText: source,
        blocks: [{ blockId: "aggregate", exactText: source }],
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
                  label: source,
                  sourceBlockIds: ["aggregate"],
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
      semanticClasses: ["DEFINITION", "CONDITION"],
    });
    expect(
      normalized.responses[0].requirements[0].components.map(
        ({ type, label }) => [type, label]
      )
    ).toEqual([
      ["FACT_ROLE", "gelten als ein Schadenereignis"],
      ["CONDITION", "Mehrere Schäden aus derselben Ursache"],
    ]);
    expect(
      normalized.responses[0].requirements[0].components.some(
        ({ type }) => type === "COVERAGE_EFFECT"
      )
    ).toBe(false);
  });

  test.each([
    "Mehrere Gebäude gelten als versicherte Sachen.",
    "Mehrere Schäden gelten nicht als ein Versicherungsfall.",
    "Ein Versicherungsfall gilt als eingetreten, wenn der Schaden angezeigt wurde.",
    "Die bessere Deckung gilt als vereinbart.",
  ])("does not reinterpret a non-aggregate relation: %s", (source) => {
    const unit = {
      unitId: "non-aggregate-relation",
      source: {
        blockIds: ["block"],
        combinedText: source,
        blocks: [{ blockId: "block", exactText: source }],
      },
    };
    const response = {
      unitId: unit.unitId,
      primaryClass: "INSURED_OBJECT",
      semanticClasses: ["INSURED_OBJECT"],
      requirements: [
        {
          displayLabel: source,
          components: [
            { type: "OBJECT", label: source, sourceBlockIds: ["block"] },
          ],
        },
      ],
    };
    const normalized = normalizeUnambiguousComponentTypes([response], [unit]);

    expect(normalized.responses[0]).toEqual(response);
    expect(normalized.componentRepairs).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "CANONICALIZE_AGGREGATED_EVENT_DEFINITION",
        }),
      ])
    );
  });

  test("canonicalizes an anaphoric cost allocation rule without losing its coverage governor", () => {
    const blocks = [
      {
        blockId: "cost-role",
        exactText:
          "• die Kosten der Feststellung und Abwehr einer behaupteten Schadenersatzverpflichtung. ",
      },
      {
        blockId: "cost-allocation",
        exactText:
          "Diese Kosten werden auf die Pauschalversicherungssumme angerechnet. ",
      },
    ];
    const source = blocks.map(({ exactText }) => exactText).join("\n");
    const unit = {
      unitId: "anaphoric-cost-allocation",
      unitKind: "LIST",
      source: {
        blockIds: blocks.map(({ blockId }) => blockId),
        combinedText: source,
        blocks,
      },
      governingContext: {
        blockIds: ["coverage-governor"],
        combinedText: "Versichert sind",
        blocks: [
          { blockId: "coverage-governor", exactText: "Versichert sind" },
        ],
      },
    };
    const normalized = normalizeUnambiguousComponentTypes(
      [
        {
          unitId: unit.unitId,
          primaryClass: "COST",
          semanticClasses: ["COST", "OPERATIVE_COVERAGE_STATEMENT"],
          requirements: [
            {
              displayLabel: source,
              components: [
                {
                  type: "FACT_ROLE",
                  label:
                    "die Kosten der Feststellung und Abwehr einer behaupteten Schadenersatzverpflichtung",
                  sourceBlockIds: ["cost-role"],
                },
                {
                  type: "LIMIT_BASIS",
                  label: "auf die Pauschalversicherungssumme angerechnet",
                  sourceBlockIds: ["cost-allocation"],
                },
                {
                  type: "COVERAGE_EFFECT",
                  label: "Versichert sind",
                  sourceBlockIds: ["coverage-governor"],
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
      primaryClass: "COST",
      semanticClasses: expect.arrayContaining([
        "COST",
        "LIMIT",
        "DEFINITION",
        "OPERATIVE_COVERAGE_STATEMENT",
      ]),
    });
    expect(
      normalized.responses[0].requirements[0].components.map(
        ({ type, label }) => [type, label]
      )
    ).toEqual([
      [
        "FACT_ROLE",
        "die Kosten der Feststellung und Abwehr einer behaupteten Schadenersatzverpflichtung",
      ],
      ["COVERAGE_EFFECT", "Versichert sind"],
      [
        "FACT_ROLE",
        "Diese Kosten werden auf die Pauschalversicherungssumme angerechnet.",
      ],
      ["LIMIT_BASIS", "Pauschalversicherungssumme"],
    ]);
    expect(normalized.componentRepairs).toContainEqual({
      unitId: unit.unitId,
      requirementIndex: 0,
      action: "CANONICALIZE_COST_ALLOCATION_DEFINITION",
      replacedComponents: 1,
    });
  });

  test("canonicalizes a source-bound standalone cost allocation relation", () => {
    const source =
      "Verteidigungskosten werden auf die Versicherungssumme angerechnet.";
    const unit = {
      unitId: "standalone-cost-allocation",
      source: {
        blockIds: ["allocation"],
        combinedText: source,
        blocks: [{ blockId: "allocation", exactText: source }],
      },
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
                  type: "COVERAGE_EFFECT",
                  label: source,
                  sourceBlockIds: ["allocation"],
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
      primaryClass: "COST",
      semanticClasses: ["COST", "LIMIT", "DEFINITION"],
    });
    expect(
      normalized.responses[0].requirements[0].components.map(
        ({ type, label }) => [type, label]
      )
    ).toEqual([
      ["FACT_ROLE", source],
      ["LIMIT_BASIS", "Versicherungssumme"],
    ]);
  });

  test.each([
    "Diese Kosten werden nicht auf die Versicherungssumme angerechnet.",
    "Die Versicherungssumme wird auf die Kosten angerechnet.",
    "Kosten werden angerechnet.",
    "Kosten werden auf die Deckung angerechnet.",
    "Kosten werden ersetzt.",
  ])("does not reinterpret a non-allocation statement: %s", (source) => {
    const unit = {
      unitId: "non-cost-allocation",
      source: {
        blockIds: ["statement"],
        combinedText: source,
        blocks: [{ blockId: "statement", exactText: source }],
      },
    };
    const response = {
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

  test("atomizes a continued liability activity enumeration and preserves the positive heading governor", () => {
    const blocks = [
      {
        blockId: "activities-one",
        exactText:
          "• aus der Innehabung, Verwaltung, Beaufsichtigung, Versorgung, Reinhaltung, Beleuchtung, ",
      },
      {
        blockId: "activities-two",
        exactText:
          "Betrieb und Pflege der versicherten Liegenschaft einschließlich der darauf befindlichen ",
      },
      {
        blockId: "objects-one",
        exactText:
          "Gebäude, Nebengebäude und Einrichtungen wie z.B. Aufzüge, Heizungs- und Klimaanlagen, ",
      },
      {
        blockId: "objects-two",
        exactText: "Schwimmbecken, Kinderspielplätze und Gartenanlagen.",
      },
    ];
    const source = blocks.map(({ exactText }) => exactText).join("\n");
    const unit = {
      unitId: "continued-liability-activities",
      unitKind: "LIST",
      structurePath: [
        "Die Versicherung erstreckt sich auf Schadenersatzverpflichtungen",
      ],
      source: {
        blockIds: blocks.map(({ blockId }) => blockId),
        combinedText: source,
        blocks,
      },
      governingContext: {
        unitIds: ["coverage-heading"],
        blockIds: ["coverage-heading-block"],
        combinedText:
          "Die Versicherung erstreckt sich auf Schadenersatzverpflichtungen",
        blocks: [
          {
            blockId: "coverage-heading-block",
            exactText:
              "Die Versicherung erstreckt sich auf Schadenersatzverpflichtungen",
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
                {
                  type: "OBJECT",
                  label: "versicherten Liegenschaft",
                  sourceBlockIds: ["activities-two"],
                },
                {
                  type: "OBJECT",
                  label:
                    "Gebäude, Nebengebäude und Einrichtungen wie z.B. Aufzüge, Heizungs- und Klimaanlagen, \nSchwimmbecken, Kinderspielplätze und Gartenanlagen",
                  sourceBlockIds: ["objects-one", "objects-two"],
                },
              ],
            },
          ],
        },
      ],
      [unit]
    );

    const response = normalized.responses[0];
    expect(response.primaryClass).toBe("INSURED_OBJECT");
    expect(response.semanticClasses).toEqual([
      "INSURED_OBJECT",
      "PERIL_OR_DAMAGE",
      "OPERATIVE_COVERAGE_STATEMENT",
    ]);
    expect(
      response.requirements[0].components
        .filter(({ type }) => type === "PERIL_OR_CAUSE")
        .map(({ label }) => label)
    ).toEqual([
      "Innehabung",
      "Verwaltung",
      "Beaufsichtigung",
      "Versorgung",
      "Reinhaltung",
      "Beleuchtung",
      "Betrieb",
      "Pflege",
    ]);
    expect(
      response.requirements[0].components
        .filter(({ type }) => type === "OBJECT")
        .map(({ label }) => label)
    ).toEqual([
      "versicherten Liegenschaft",
      "Gebäude",
      "Nebengebäude",
      "Einrichtungen",
      "Aufzüge",
      "Heizungs- und Klimaanlagen",
      "Schwimmbecken",
      "Kinderspielplätze",
      "Gartenanlagen",
    ]);
    expect(response.requirements[0].components.at(-1)).toEqual({
      type: "COVERAGE_EFFECT",
      label: "Die Versicherung erstreckt sich auf",
      sourceBlockIds: ["coverage-heading-block"],
      coverageEffect: "INCLUDED",
    });
    expect(
      new Set(
        response.requirements[0].components.flatMap(
          ({ sourceBlockIds }) => sourceBlockIds
        )
      )
    ).toEqual(
      new Set([...unit.source.blockIds, ...unit.governingContext.blockIds])
    );
    expect(normalized.componentRepairs).toContainEqual({
      unitId: unit.unitId,
      requirementIndex: 0,
      action: "ATOMIZE_LIABILITY_ACTIVITY_ENUMERATION",
      activityComponents: 8,
    });
    expect(normalized.componentRepairs).toContainEqual({
      unitId: unit.unitId,
      requirementIndex: 0,
      componentIndex: 9,
      action: "ATOMIZE_COORDINATED_OBJECT_ENUMERATION",
      objectComponents: 8,
    });
  });

  test("atomizes a wording variant of a liability activity enumeration", () => {
    const source =
      "• aus dem Besitz, der Wartung und der Benützung des Gebäudes.";
    const unit = {
      unitId: "liability-activity-wording-variant",
      structurePath: ["Haftpflichtversicherung"],
      source: {
        blockIds: ["statement"],
        combinedText: source,
        blocks: [{ blockId: "statement", exactText: source }],
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
                  label: "Gebäudes",
                  sourceBlockIds: ["statement"],
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
      ["PERIL_OR_CAUSE", "Besitz"],
      ["PERIL_OR_CAUSE", "Wartung"],
      ["PERIL_OR_CAUSE", "Benützung"],
      ["OBJECT", "Gebäudes"],
    ]);
  });

  test.each([
    {
      name: "outside liability context",
      source: "• aus der Wartung und Pflege des Gebäudes.",
      structurePath: ["Sachversicherung"],
    },
    {
      name: "single cause",
      source: "• aus der Beschädigung des Gebäudes.",
      structurePath: ["Haftpflichtversicherung"],
    },
    {
      name: "alternative rather than coordinated list",
      source: "• aus der Wartung oder Pflege des Gebäudes.",
      structurePath: ["Haftpflichtversicherung"],
    },
    {
      name: "not a leading causal scope",
      source: "Kosten aus der Wartung und Pflege des Gebäudes.",
      structurePath: ["Haftpflichtversicherung"],
    },
  ])("does not invent a liability activity enumeration: $name", (fixture) => {
    const unit = {
      unitId: "non-liability-activity-enumeration",
      structurePath: fixture.structurePath,
      source: {
        blockIds: ["statement"],
        combinedText: fixture.source,
        blocks: [{ blockId: "statement", exactText: fixture.source }],
      },
    };
    const response = {
      unitId: unit.unitId,
      primaryClass: "INSURED_OBJECT",
      semanticClasses: ["INSURED_OBJECT"],
      requirements: [
        {
          displayLabel: fixture.source,
          components: [
            {
              type: "OBJECT",
              label: "Gebäudes",
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

  test.each([
    "Heizungs- und Klimaanlagen",
    "Sach-, Haftpflicht- und Rechtsschutzversicherung",
  ])("does not split a coupled compound object label: %s", (label) => {
    const source = `${label} sind versichert.`;
    const unit = {
      unitId: "coupled-compound-object",
      source: {
        blockIds: ["statement"],
        combinedText: source,
        blocks: [{ blockId: "statement", exactText: source }],
      },
    };
    const response = {
      unitId: unit.unitId,
      primaryClass: "INSURED_OBJECT",
      semanticClasses: ["INSURED_OBJECT"],
      requirements: [
        {
          displayLabel: source,
          components: [
            { type: "OBJECT", label, sourceBlockIds: ["statement"] },
          ],
        },
      ],
    };

    expect(normalizeUnambiguousComponentTypes([response], [unit])).toEqual({
      responses: [response],
      componentRepairs: [],
    });
  });

  test.each([
    {
      label: "- Tiefgaragen und Autoabstellplätze;",
      expected: ["Tiefgaragen", "Autoabstellplätze"],
    },
    {
      label: "Gebäude und Nebengebäude",
      expected: ["Gebäude", "Nebengebäude"],
    },
    {
      label: "Adaptierungen und Investitionen der Bewohner",
      expected: ["Adaptierungen", "Investitionen der Bewohner"],
    },
    {
      label: "Erdkabel und Hauswasserpumpen am Versicherungsgrundstück",
      expected: ["Erdkabel", "Hauswasserpumpen am Versicherungsgrundstück"],
    },
  ])(
    "atomizes a simple independent object pair: $label",
    ({ label, expected }) => {
      const source = `${label} sind versichert.`;
      const unit = {
        unitId: "independent-object-pair",
        source: {
          blockIds: ["statement"],
          combinedText: source,
          blocks: [{ blockId: "statement", exactText: source }],
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
                  { type: "OBJECT", label, sourceBlockIds: ["statement"] },
                ],
              },
            ],
          },
        ],
        [unit]
      );

      expect(
        normalized.responses[0].requirements[0].components.map(
          ({ type, label: componentLabel }) => [type, componentLabel]
        )
      ).toEqual(expected.map((componentLabel) => ["OBJECT", componentLabel]));
      expect(normalized.componentRepairs).toContainEqual({
        unitId: unit.unitId,
        requirementIndex: 0,
        componentIndex: 0,
        action: "ATOMIZE_COORDINATED_OBJECT_ENUMERATION",
        objectComponents: 2,
      });
    }
  );

  test.each([
    "Schäden an den angeschlossenen Einrichtungen und Armaturen",
    "ständig instandgehaltene Gebäude und Betriebseinrichtungen",
    "Die Erfüllung von Verträgen und die an die Stelle tretende Ersatzleistung",
  ])("does not split a dependent or clausal object phrase: %s", (label) => {
    const source = `${label}.`;
    const unit = {
      unitId: "dependent-object-pair",
      source: {
        blockIds: ["statement"],
        combinedText: source,
        blocks: [{ blockId: "statement", exactText: source }],
      },
    };
    const response = {
      unitId: unit.unitId,
      primaryClass: "INSURED_OBJECT",
      semanticClasses: ["INSURED_OBJECT"],
      requirements: [
        {
          displayLabel: source,
          components: [
            { type: "OBJECT", label, sourceBlockIds: ["statement"] },
          ],
        },
      ],
    };

    expect(normalizeUnambiguousComponentTypes([response], [unit])).toEqual({
      responses: [response],
      componentRepairs: [],
    });
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
      semanticClasses: ["PERIL_OR_DAMAGE", "OPERATIVE_COVERAGE_STATEMENT"],
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
        label: "Zusätzlich versichert sind",
        sourceBlockIds: ["governor"],
        coverageEffect: "INCLUDED",
      },
      {
        type: "COVERAGE_EFFECT",
        label: "Zusätzlich versichert sind",
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
          components.filter(({ type }) => type === "COVERAGE_EFFECT").length ===
          1
      )
    ).toBe(true);
  });

  test("types a subordinate list after a damages-at governor as insured objects", () => {
    const unit = {
      unitId: "insured-equipment-list",
      source: {
        blockIds: ["equipment"],
        combinedText: "- sämtlichen elektrischen Einrichtungen",
        blocks: [
          {
            blockId: "equipment",
            exactText: "- sämtlichen elektrischen Einrichtungen",
          },
        ],
      },
      governingContext: {
        unitIds: ["coverage-governor", "cause-governor"],
        blockIds: ["coverage", "cause"],
        combinedText:
          "Zusätzlich versichert sind Schäden durch\n• Überspannung innerhalb von Gebäuden an",
        blocks: [
          {
            blockId: "coverage",
            exactText: "Zusätzlich versichert sind Schäden durch",
          },
          {
            blockId: "cause",
            exactText: "• Überspannung innerhalb von Gebäuden an",
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
          displayLabel: "sämtlichen elektrischen Einrichtungen",
          components: [
            {
              type: "PERIL_OR_CAUSE",
              label: "sämtlichen elektrischen Einrichtungen",
              sourceBlockIds: ["equipment"],
            },
          ],
        },
      ],
    };

    const normalized = normalizeUnambiguousComponentTypes([response], [unit]);

    expect(normalized.responses[0]).toMatchObject({
      primaryClass: "INSURED_OBJECT",
      semanticClasses: ["INSURED_OBJECT", "OPERATIVE_COVERAGE_STATEMENT"],
    });
    expect(
      normalized.responses[0].requirements[0].components.map(({ type }) => type)
    ).toEqual(["OBJECT", "COVERAGE_EFFECT"]);
  });

  test("materializes an inherited exclusion without duplicating an existing effect", () => {
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
    ).toEqual([
      [{ ...existingEffect, label: "Nicht versichert" }],
      [existingEffect],
    ]);
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

  test("terminalizes a consumed pure coverage governor without a damage phrase", () => {
    const governor = {
      unitId: "coverage-governor",
      unitKind: "CLAUSE",
      source: {
        blockIds: ["coverage-block"],
        combinedText: "Zusätzlich versichert sind",
        blocks: [
          {
            blockId: "coverage-block",
            exactText: "Zusätzlich versichert sind",
          },
        ],
      },
    };
    const consumer = {
      unitId: "cost-item",
      unitKind: "LIST",
      source: {
        blockIds: ["cost-block"],
        combinedText: "• Mehrkosten für die Abfallbehandlung",
        blocks: [
          {
            blockId: "cost-block",
            exactText: "• Mehrkosten für die Abfallbehandlung",
          },
        ],
      },
      governingContext: {
        unitIds: [governor.unitId],
        blockIds: ["coverage-block"],
        combinedText: governor.source.combinedText,
        blocks: governor.source.blocks,
      },
    };
    const response = {
      unitId: governor.unitId,
      primaryClass: "OPERATIVE_COVERAGE_STATEMENT",
      semanticClasses: ["OPERATIVE_COVERAGE_STATEMENT"],
      requirements: [
        {
          displayLabel: governor.source.combinedText,
          components: [
            {
              type: "COVERAGE_EFFECT",
              label: "versichert sind",
              coverageEffect: "INCLUDED",
              sourceBlockIds: ["coverage-block"],
            },
          ],
        },
      ],
    };

    const normalized = normalizeUnambiguousComponentTypes(
      [response],
      [governor, consumer]
    );

    expect(normalized.responses[0]).toEqual({
      unitId: governor.unitId,
      primaryClass: "DUPLICATE",
      semanticClasses: ["DUPLICATE"],
      requirements: [],
    });
    expect(normalized.componentRepairs).toContainEqual(
      expect.objectContaining({
        unitId: governor.unitId,
        action: "TERMINALIZE_CONSUMED_COVERAGE_GOVERNOR",
        consumerUnitIds: [consumer.unitId],
      })
    );
  });

  test("terminalizes a consumed negative reimbursement governor", () => {
    const governor = {
      unitId: "negative-reimbursement-governor",
      unitKind: "CLAUSE",
      source: {
        blockIds: ["governor-block"],
        combinedText: "Nicht ersetzt werden",
        blocks: [
          { blockId: "governor-block", exactText: "Nicht ersetzt werden" },
        ],
      },
    };
    const consumer = {
      unitId: "excluded-item",
      unitKind: "LIST",
      source: {
        blockIds: ["item-block"],
        combinedText: "• Vorschäden.",
        blocks: [{ blockId: "item-block", exactText: "• Vorschäden." }],
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
      primaryClass: "EXCLUSION",
      semanticClasses: ["EXCLUSION"],
      requirements: [
        {
          displayLabel: governor.source.combinedText,
          components: [
            {
              type: "COVERAGE_EFFECT",
              label: "Nicht ersetzt werden",
              coverageEffect: "EXCLUDED",
              sourceBlockIds: ["governor-block"],
            },
          ],
        },
      ],
    };

    const normalized = normalizeUnambiguousComponentTypes(
      [response],
      [governor, consumer]
    );

    expect(normalized.responses[0]).toEqual({
      unitId: governor.unitId,
      primaryClass: "DUPLICATE",
      semanticClasses: ["DUPLICATE"],
      requirements: [],
    });
    expect(normalized.componentRepairs).toContainEqual(
      expect.objectContaining({
        unitId: governor.unitId,
        action: "TERMINALIZE_CONSUMED_COVERAGE_GOVERNOR",
        consumerUnitIds: [consumer.unitId],
      })
    );
  });

  test("materializes an omitted source-bound contractual waiver as its own requirement", () => {
    const unit = {
      unitId: "contractual-waiver",
      unitKind: "CLAUSE",
      source: {
        blockIds: ["cause-a", "cause-b", "waiver"],
        combinedText:
          "Bei Schäden, die nach Feuerwehr- und Alarmübungen bzw. durch Einrichtungen von Feuerwehren entstehen, verzichtet der\nVersicherer auf den Einwand der Gefahrenerhöhung und der Verletzung der Anzeigepflicht.",
        blocks: [
          {
            blockId: "cause-a",
            exactText: "Bei Schäden, die nach Feuerwehr- und Alarmübungen bzw.",
          },
          {
            blockId: "cause-b",
            exactText:
              "durch Einrichtungen von Feuerwehren entstehen, verzichtet der",
          },
          {
            blockId: "waiver",
            exactText:
              "Versicherer auf den Einwand der Gefahrenerhöhung und der Verletzung der Anzeigepflicht.",
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
          displayLabel:
            "Bei Schäden, die nach Feuerwehr- und Alarmübungen bzw. durch Einrichtungen von Feuerwehren entstehen, verzichtet der Versicherer auf den Einwand der Gefahrenerhöhung und der Verletzung der Anzeigepflicht.",
          components: [
            {
              type: "PERIL_OR_CAUSE",
              label: "Feuerwehr- und Alarmübungen",
              sourceBlockIds: ["cause-a", "cause-b"],
            },
          ],
        },
      ],
    };

    const normalized = normalizeUnambiguousComponentTypes([response], [unit]);
    const waiver = normalized.responses[0].requirements[1];

    expect(normalized.responses[0].primaryClass).toBe("PERIL_OR_DAMAGE");
    expect(normalized.responses[0].semanticClasses).toEqual([
      "PERIL_OR_DAMAGE",
      "DEFINITION",
    ]);
    expect(normalized.responses[0].requirements[0].displayLabel).toBe(
      "Bei Schäden, die nach Feuerwehr- und Alarmübungen bzw. durch Einrichtungen von Feuerwehren entstehen,"
    );
    expect(waiver).toEqual({
      displayLabel:
        "verzichtet der\nVersicherer auf den Einwand der Gefahrenerhöhung und der Verletzung der Anzeigepflicht.",
      components: [
        {
          type: "FACT_ROLE",
          label:
            "verzichtet der\nVersicherer auf den Einwand der Gefahrenerhöhung und der Verletzung der Anzeigepflicht.",
          sourceBlockIds: ["cause-b", "waiver"],
        },
      ],
    });
    expect(normalized.componentRepairs).toContainEqual({
      unitId: unit.unitId,
      action: "MATERIALIZE_EXPLICIT_CONTRACTUAL_WAIVER",
      sourceBlockIds: ["cause-b", "waiver"],
    });
    expect(normalized.componentRepairs).toContainEqual({
      unitId: unit.unitId,
      requirementIndex: 0,
      action: "TRIM_MATERIALIZED_CONTRACTUAL_WAIVER_FROM_REQUIREMENT",
    });
  });

  test("does not materialize a negated or already mapped contractual waiver", () => {
    const unit = (unitId, combinedText) => ({
      unitId,
      unitKind: "CLAUSE",
      source: {
        blockIds: [unitId],
        combinedText,
        blocks: [{ blockId: unitId, exactText: combinedText }],
      },
    });
    const negativeUnit = unit(
      "negative-waiver",
      "Der Versicherer verzichtet nicht auf den Einwand der Gefahrenerhöhung."
    );
    const mappedUnit = unit(
      "mapped-waiver",
      "Der Versicherer verzichtet auf den Einwand der Gefahrenerhöhung."
    );
    const negativeResponse = {
      unitId: negativeUnit.unitId,
      primaryClass: "CONDITION",
      semanticClasses: ["CONDITION"],
      requirements: [],
    };
    const mappedResponse = {
      unitId: mappedUnit.unitId,
      primaryClass: "DEFINITION",
      semanticClasses: ["DEFINITION"],
      requirements: [
        {
          displayLabel: mappedUnit.source.combinedText,
          components: [
            {
              type: "FACT_ROLE",
              label: mappedUnit.source.combinedText,
              sourceBlockIds: [mappedUnit.unitId],
            },
          ],
        },
      ],
    };

    const normalized = normalizeUnambiguousComponentTypes(
      [negativeResponse, mappedResponse],
      [negativeUnit, mappedUnit]
    );

    expect(normalized.responses).toEqual([negativeResponse, mappedResponse]);
    expect(normalized.componentRepairs).not.toContainEqual(
      expect.objectContaining({
        action: "MATERIALIZE_EXPLICIT_CONTRACTUAL_WAIVER",
      })
    );
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

  test("binds a repeated qualified benefit list heading to its owning block", () => {
    const heading = "• Vorsorge für Umsatzsteuer (im Totalschadenfall): ";
    const body =
      "Vorläufige Deckung in Höhe von 20 % betreffend die Vorsorge für Umsatzsteuer.";
    const unit = {
      unitId: "qualified-benefit-heading",
      unitKind: "LIST",
      source: {
        blockIds: ["heading", "body"],
        combinedText: `${heading}\n${body}`,
        blocks: [
          {
            blockId: "heading",
            structuralKind: "LIST_GOVERNOR",
            exactText: heading,
          },
          { blockId: "body", structuralKind: "BODY_LINE", exactText: body },
        ],
      },
      logicalSourceSegments: [
        {
          segmentId: "benefit-item",
          type: "LIST_ITEM_WITH_CONTINUATIONS",
          blockIds: ["heading", "body"],
        },
      ],
    };
    const normalized = normalizeUnambiguousComponentTypes(
      [
        {
          unitId: unit.unitId,
          primaryClass: "LIMIT",
          semanticClasses: ["LIMIT"],
          requirements: [
            {
              displayLabel: heading.trim(),
              components: [
                {
                  type: "OBJECT",
                  label: "Vorsorge für Umsatzsteuer",
                  sourceBlockIds: ["body"],
                },
                {
                  type: "VALUE_AND_UNIT",
                  label: "20 %",
                  rawValue: "20",
                  unit: "%",
                  sourceBlockIds: ["body"],
                },
              ],
            },
          ],
        },
      ],
      [unit]
    );

    expect(normalized.responses[0].semanticClasses).toEqual([
      "LIMIT",
      "VARIANT",
    ]);
    expect(normalized.responses[0].requirements[0].components).toEqual([
      {
        type: "FACT_ROLE",
        label: "Vorsorge für Umsatzsteuer",
        sourceBlockIds: ["heading"],
      },
      {
        type: "VALUE_AND_UNIT",
        label: "20 %",
        rawValue: "20",
        unit: "%",
        sourceBlockIds: ["body"],
      },
      {
        type: "SCOPE",
        label: "(im Totalschadenfall)",
        sourceBlockIds: ["heading"],
      },
    ]);
    expect(normalized.componentRepairs).toContainEqual(
      expect.objectContaining({
        unitId: unit.unitId,
        action: "NORMALIZE_QUALIFIED_BENEFIT_LIST_HEADING",
      })
    );
  });

  test("does not reinterpret a qualified physical-object list heading as a benefit", () => {
    const heading = "• Gebäude (im Eigentum des Versicherungsnehmers): ";
    const unit = {
      unitId: "qualified-object-heading",
      unitKind: "LIST",
      source: {
        blockIds: ["heading"],
        combinedText: heading,
        blocks: [
          {
            blockId: "heading",
            structuralKind: "LIST_GOVERNOR",
            exactText: heading,
          },
        ],
      },
      logicalSourceSegments: [
        {
          segmentId: "object-item",
          type: "LIST_ITEM_WITH_CONTINUATIONS",
          blockIds: ["heading"],
        },
      ],
    };
    const response = {
      unitId: unit.unitId,
      primaryClass: "INSURED_OBJECT",
      semanticClasses: ["INSURED_OBJECT"],
      requirements: [
        {
          displayLabel: heading.trim(),
          components: [
            {
              type: "OBJECT",
              label: "Gebäude",
              sourceBlockIds: ["heading"],
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

  test("keeps sibling list segments separate and types governed damage events correctly", () => {
    const first =
      "- das Abhandenkommen von versicherten Sachen anlässlich des Schadens,";
    const secondLead =
      "- die Beschädigung von Gebäudebestandteilen anlässlich eines versuchten oder vollbrachten";
    const secondTail = "Einbruchdiebstahles";
    const unit = {
      unitId: "damage-list-segments",
      unitKind: "LIST",
      source: {
        blockIds: ["first", "second-lead", "second-tail"],
        combinedText: [first, secondLead, secondTail].join("\n"),
        blocks: [
          { blockId: "first", exactText: first },
          { blockId: "second-lead", exactText: secondLead },
          { blockId: "second-tail", exactText: secondTail },
        ],
      },
      logicalSourceSegments: [
        {
          segmentId: "first-segment",
          type: "LIST_ITEM_WITH_CONTINUATIONS",
          blockIds: ["first"],
          combinedText: first,
        },
        {
          segmentId: "second-segment",
          type: "LIST_ITEM_WITH_CONTINUATIONS",
          blockIds: ["second-lead", "second-tail"],
          combinedText: [secondLead, secondTail].join("\n"),
        },
      ],
      governingContext: {
        blockIds: ["governor"],
        combinedText: "Schäden durch",
        blocks: [{ blockId: "governor", exactText: "Schäden durch" }],
      },
    };
    const secondRequirement = {
      displayLabel: [secondLead, secondTail].join("\n"),
      components: [
        {
          type: "DAMAGE_OR_EFFECT",
          label: "Beschädigung von Gebäudebestandteilen",
          sourceBlockIds: ["second-lead"],
        },
        {
          type: "PERIL_OR_CAUSE",
          label: "versuchten oder vollbrachten\nEinbruchdiebstahles",
          sourceBlockIds: ["second-lead", "second-tail"],
        },
      ],
    };
    const normalized = normalizeUnambiguousComponentTypes(
      [
        {
          unitId: unit.unitId,
          primaryClass: "PERIL_OR_DAMAGE",
          semanticClasses: ["PERIL_OR_DAMAGE"],
          requirements: [
            {
              displayLabel: first,
              components: [
                {
                  type: "OBJECT",
                  label: "Abhandenkommen von versicherten Sachen",
                  sourceBlockIds: ["first"],
                },
                {
                  type: "PERIL_OR_CAUSE",
                  label: "Einbruchdiebstahles",
                  sourceBlockIds: ["second-tail"],
                },
              ],
            },
            secondRequirement,
          ],
        },
      ],
      [unit]
    );

    expect(normalized.responses[0].requirements).toEqual([
      {
        displayLabel: first,
        components: [
          {
            type: "DAMAGE_OR_EFFECT",
            label: "Abhandenkommen von versicherten Sachen",
            sourceBlockIds: ["first"],
          },
        ],
      },
      secondRequirement,
    ]);
    expect(normalized.componentRepairs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          unitId: unit.unitId,
          requirementIndex: 0,
          componentIndex: 1,
          action: "DROP_CROSS_SEGMENT_COMPONENT",
          segmentId: "first-segment",
          sourceBlockIds: ["second-tail"],
        }),
        expect.objectContaining({
          unitId: unit.unitId,
          requirementIndex: 0,
          componentIndex: 0,
          action: "NORMALIZE_DAMAGE_CAUSE_GOVERNOR_OBJECT",
          fromType: "OBJECT",
          toType: "DAMAGE_OR_EFFECT",
        }),
      ])
    );
  });

  test("retains a shared governor component in every matched list segment", () => {
    const unit = {
      unitId: "shared-list-governor",
      unitKind: "LIST",
      source: {
        blockIds: ["first", "second"],
        combinedText: "- Brand\n- Sturm",
        blocks: [
          { blockId: "first", exactText: "- Brand" },
          { blockId: "second", exactText: "- Sturm" },
        ],
      },
      logicalSourceSegments: [
        {
          segmentId: "first-segment",
          blockIds: ["first"],
          combinedText: "- Brand",
        },
        {
          segmentId: "second-segment",
          blockIds: ["second"],
          combinedText: "- Sturm",
        },
      ],
      governingContext: {
        blockIds: ["governor"],
        combinedText: "Versichert sind Schäden durch",
        blocks: [
          {
            blockId: "governor",
            exactText: "Versichert sind Schäden durch",
          },
        ],
      },
    };
    const response = {
      unitId: unit.unitId,
      primaryClass: "OPERATIVE_COVERAGE_STATEMENT",
      semanticClasses: ["OPERATIVE_COVERAGE_STATEMENT", "PERIL_OR_DAMAGE"],
      requirements: ["first", "second"].map((blockId, index) => ({
        displayLabel: index === 0 ? "• Brand" : "• Sturm",
        components: [
          {
            type: "PERIL_OR_CAUSE",
            label: index === 0 ? "Brand" : "Sturm",
            sourceBlockIds: [blockId],
          },
          {
            type: "COVERAGE_EFFECT",
            label: "Versichert sind",
            sourceBlockIds: ["governor"],
            coverageEffect: "INCLUDED",
          },
        ],
      })),
    };
    const normalized = normalizeUnambiguousComponentTypes([response], [unit]);

    expect(
      normalized.responses[0].requirements.map(({ components }) =>
        components.find(({ type }) => type === "COVERAGE_EFFECT")
      )
    ).toEqual([
      expect.objectContaining({ sourceBlockIds: ["governor"] }),
      expect.objectContaining({ sourceBlockIds: ["governor"] }),
    ]);
    expect(normalized.componentRepairs).not.toContainEqual(
      expect.objectContaining({ action: "DROP_CROSS_SEGMENT_COMPONENT" })
    );
  });

  test("rebinds same-polarity list effects to their exact inherited governor", () => {
    const unit = {
      unitId: "negative-reimbursement-items",
      unitKind: "LIST",
      source: {
        blockIds: ["first", "second"],
        combinedText: "• ein persönlicher Liebhaberwert;\n• Vorschäden.",
        blocks: [
          {
            blockId: "first",
            exactText: "• ein persönlicher Liebhaberwert;",
          },
          { blockId: "second", exactText: "• Vorschäden." },
        ],
      },
      logicalSourceSegments: [
        {
          segmentId: "first-segment",
          blockIds: ["first"],
          combinedText: "• ein persönlicher Liebhaberwert;",
        },
        {
          segmentId: "second-segment",
          blockIds: ["second"],
          combinedText: "• Vorschäden.",
        },
      ],
      governingContext: {
        unitIds: ["negative-governor"],
        blockIds: ["governor"],
        combinedText: "Nicht ersetzt werden",
        blocks: [{ blockId: "governor", exactText: "Nicht ersetzt werden" }],
      },
    };
    const response = {
      unitId: unit.unitId,
      primaryClass: "EXCLUSION",
      semanticClasses: ["EXCLUSION"],
      requirements: [
        ["first", "• ein persönlicher Liebhaberwert;", "Liebhaberwert"],
        ["second", "• Vorschäden.", "Vorschäden"],
      ].map(([blockId, displayLabel, objectLabel]) => ({
        displayLabel,
        components: [
          { type: "OBJECT", label: objectLabel, sourceBlockIds: [blockId] },
          {
            type: "COVERAGE_EFFECT",
            label: "ausgenommen sind",
            sourceBlockIds: [blockId],
            coverageEffect: "EXCLUDED",
          },
        ],
      })),
    };
    const normalized = normalizeUnambiguousComponentTypes([response], [unit]);

    expect(
      normalized.responses[0].requirements.map(({ components }) =>
        components.find(({ type }) => type === "COVERAGE_EFFECT")
      )
    ).toEqual([
      {
        type: "COVERAGE_EFFECT",
        label: "Nicht ersetzt",
        sourceBlockIds: ["governor"],
        coverageEffect: "EXCLUDED",
      },
      {
        type: "COVERAGE_EFFECT",
        label: "Nicht ersetzt",
        sourceBlockIds: ["governor"],
        coverageEffect: "EXCLUDED",
      },
    ]);
    expect(
      normalized.componentRepairs.filter(
        ({ action }) => action === "REBIND_INHERITED_COVERAGE_EFFECT"
      )
    ).toHaveLength(2);
  });

  test("prefers the nearest same-polarity governor over an outer coverage heading", () => {
    const unit = {
      unitId: "locally-augmented-list",
      unitKind: "LIST",
      source: {
        blockIds: ["item"],
        combinedText: "• Kosten für Notverglasung;",
        blocks: [{ blockId: "item", exactText: "• Kosten für Notverglasung;" }],
      },
      logicalSourceSegments: [
        {
          segmentId: "item-segment",
          blockIds: ["item"],
          combinedText: "• Kosten für Notverglasung;",
        },
      ],
      governingContext: {
        unitIds: ["outer-heading", "local-governor"],
        blockIds: ["outer", "local"],
        combinedText:
          "Versichert sind im Rahmen der Glaspauschale:\nZusätzlich versichert sind",
        blocks: [
          {
            blockId: "outer",
            exactText: "Versichert sind im Rahmen der Glaspauschale:",
          },
          { blockId: "local", exactText: "Zusätzlich versichert sind" },
        ],
      },
    };
    const response = {
      unitId: unit.unitId,
      primaryClass: "OPERATIVE_COVERAGE_STATEMENT",
      semanticClasses: ["OPERATIVE_COVERAGE_STATEMENT", "COST"],
      requirements: [
        {
          displayLabel: "• Kosten für Notverglasung;",
          components: [
            {
              type: "FACT_ROLE",
              label: "Kosten für Notverglasung",
              sourceBlockIds: ["item"],
            },
            {
              type: "COVERAGE_EFFECT",
              label: "Versichert sind",
              sourceBlockIds: ["outer"],
              coverageEffect: "INCLUDED",
            },
          ],
        },
      ],
    };

    const normalized = normalizeUnambiguousComponentTypes([response], [unit]);

    expect(
      normalized.responses[0].requirements[0].components.find(
        ({ type }) => type === "COVERAGE_EFFECT"
      )
    ).toEqual({
      type: "COVERAGE_EFFECT",
      label: "Zusätzlich versichert sind",
      sourceBlockIds: ["local"],
      coverageEffect: "INCLUDED",
    });
    expect(normalized.componentRepairs).toContainEqual(
      expect.objectContaining({
        unitId: unit.unitId,
        action: "REBIND_NEAREST_INHERITED_COVERAGE_EFFECT",
        fromSourceBlockIds: ["outer"],
        toSourceBlockIds: ["local"],
      })
    );
  });

  test("does not rebind an inherited coverage effect across opposite polarity", () => {
    const unit = {
      unitId: "opposite-inherited-polarity",
      unitKind: "LIST",
      source: {
        blockIds: ["item"],
        combinedText: "• Vorschäden.",
        blocks: [{ blockId: "item", exactText: "• Vorschäden." }],
      },
      logicalSourceSegments: [],
      governingContext: {
        unitIds: ["negative-governor"],
        blockIds: ["governor"],
        combinedText: "Nicht ersetzt werden",
        blocks: [{ blockId: "governor", exactText: "Nicht ersetzt werden" }],
      },
    };
    const response = {
      unitId: unit.unitId,
      primaryClass: "OPERATIVE_COVERAGE_STATEMENT",
      semanticClasses: ["OPERATIVE_COVERAGE_STATEMENT", "INSURED_OBJECT"],
      requirements: [
        {
          displayLabel: "• Vorschäden.",
          components: [
            { type: "OBJECT", label: "Vorschäden", sourceBlockIds: ["item"] },
            {
              type: "COVERAGE_EFFECT",
              label: "versichert",
              sourceBlockIds: ["item"],
              coverageEffect: "INCLUDED",
            },
          ],
        },
      ],
    };
    const normalized = normalizeUnambiguousComponentTypes([response], [unit]);

    expect(normalized.responses).toEqual([response]);
    expect(normalized.componentRepairs).not.toContainEqual(
      expect.objectContaining({ action: "REBIND_INHERITED_COVERAGE_EFFECT" })
    );
  });

  test("retains an internal list governor that qualifies a following item", () => {
    const limit =
      "• bis zu jeweils 5% der Gebäudeversicherungssumme auf Erstes Risiko";
    const item = "- Nebengebäude";
    const unit = {
      unitId: "internal-list-governor",
      unitKind: "LIST",
      source: {
        blockIds: ["limit", "item"],
        combinedText: `${limit}\n${item}`,
        blocks: [
          {
            blockId: "limit",
            structuralKind: "LIST_GOVERNOR",
            exactText: limit,
          },
          {
            blockId: "item",
            structuralKind: "LIST_ITEM",
            exactText: item,
          },
        ],
      },
      logicalSourceSegments: [
        {
          segmentId: "limit-segment",
          blockIds: ["limit"],
          combinedText: limit,
        },
        {
          segmentId: "item-segment",
          blockIds: ["item"],
          combinedText: item,
        },
      ],
    };
    const response = {
      unitId: unit.unitId,
      primaryClass: "INSURED_OBJECT",
      semanticClasses: ["INSURED_OBJECT", "LIMIT"],
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
              type: "VALUE_AND_UNIT",
              label: "bis zu jeweils 5%",
              rawValue: "5",
              unit: "%",
              sourceBlockIds: ["limit"],
            },
            {
              type: "LIMIT_BASIS",
              label: "der Gebäudeversicherungssumme auf Erstes Risiko",
              sourceBlockIds: ["limit"],
            },
          ],
        },
      ],
    };
    const normalized = normalizeUnambiguousComponentTypes([response], [unit]);

    expect(normalized.responses).toEqual([response]);
    expect(normalized.componentRepairs).not.toContainEqual(
      expect.objectContaining({ action: "DROP_CROSS_SEGMENT_COMPONENT" })
    );
  });

  test("does not auto-repair a component that mixes local and sibling segment sources", () => {
    const unit = {
      unitId: "mixed-list-segment-source",
      unitKind: "LIST",
      source: {
        blockIds: ["first", "second"],
        combinedText: "- erste Regel\n- zweite Regel",
        blocks: [
          { blockId: "first", exactText: "- erste Regel" },
          { blockId: "second", exactText: "- zweite Regel" },
        ],
      },
      logicalSourceSegments: [
        {
          segmentId: "first-segment",
          blockIds: ["first"],
          combinedText: "- erste Regel",
        },
        {
          segmentId: "second-segment",
          blockIds: ["second"],
          combinedText: "- zweite Regel",
        },
      ],
    };
    const response = {
      unitId: unit.unitId,
      primaryClass: "DEFINITION",
      semanticClasses: ["DEFINITION"],
      requirements: [
        {
          displayLabel: "- erste Regel",
          components: [
            {
              type: "FACT_ROLE",
              label: "erste Regel",
              sourceBlockIds: ["first", "second"],
            },
          ],
        },
        {
          displayLabel: "- zweite Regel",
          components: [
            {
              type: "FACT_ROLE",
              label: "zweite Regel",
              sourceBlockIds: ["second"],
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

  test("restores a source-bound exclusion effect from an invalid partial label", () => {
    const source =
      "Die Versicherung erstreckt sich dabei nicht auf Schäden durch Einbruchdiebstahl.";
    const unit = {
      unitId: "negative-effect-unit",
      unitKind: "CLAUSE",
      source: {
        blockIds: ["clause"],
        combinedText: source,
        blocks: [
          {
            blockId: "clause",
            structuralKind: "PARAGRAPH",
            exactText: source,
          },
        ],
      },
      logicalSourceSegments: [],
    };
    const normalized = normalizeUnambiguousComponentTypes(
      [
        {
          unitId: unit.unitId,
          primaryClass: "EXCLUSION",
          semanticClasses: ["EXCLUSION", "PERIL_OR_DAMAGE"],
          requirements: [
            {
              displayLabel: source,
              components: [
                {
                  type: "PERIL_OR_CAUSE",
                  label: "Einbruchdiebstahl",
                  sourceBlockIds: ["clause"],
                },
                {
                  type: "COVERAGE_EFFECT",
                  label: "nicht auf Schäden durch",
                  sourceBlockIds: ["clause"],
                  coverageEffect: "EXCLUDED",
                },
              ],
            },
          ],
        },
      ],
      [unit]
    );

    expect(normalized.responses[0].requirements[0].components[1]).toEqual({
      type: "COVERAGE_EFFECT",
      label: "erstreckt sich dabei nicht",
      sourceBlockIds: ["clause"],
      coverageEffect: "EXCLUDED",
    });
    expect(normalized.componentRepairs).toContainEqual(
      expect.objectContaining({
        unitId: unit.unitId,
        action: "RESTORE_EXPLICIT_COVERAGE_EFFECT",
      })
    );
  });

  test("prefers a negative reimbursement predicate over an insured-object adjective", () => {
    const source =
      "Die Kosten für die Behandlung von nicht versicherten Sachen werden nicht ersetzt.";
    const unit = {
      unitId: "negative-reimbursement-unit",
      unitKind: "CLAUSE",
      source: {
        blockIds: ["clause"],
        combinedText: source,
        blocks: [
          {
            blockId: "clause",
            structuralKind: "PARAGRAPH",
            exactText: source,
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
          semanticClasses: ["OPERATIVE_COVERAGE_STATEMENT", "COST"],
          requirements: [
            {
              displayLabel: source,
              components: [
                {
                  type: "FACT_ROLE",
                  label: "Kosten",
                  sourceBlockIds: ["clause"],
                },
                {
                  type: "COVERAGE_EFFECT",
                  label: "versicherten",
                  sourceBlockIds: ["clause"],
                  coverageEffect: "INCLUDED",
                },
              ],
            },
          ],
        },
      ],
      [unit]
    );

    expect(normalized.responses[0].requirements[0].components[1]).toEqual({
      type: "COVERAGE_EFFECT",
      label: "nicht ersetzt",
      sourceBlockIds: ["clause"],
      coverageEffect: "EXCLUDED",
    });
    expect(normalized.componentRepairs).toContainEqual(
      expect.objectContaining({
        unitId: unit.unitId,
        action: "RESTORE_EXPLICIT_COVERAGE_EFFECT",
        fromCoverageEffect: "INCLUDED",
        toCoverageEffect: "EXCLUDED",
      })
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

  test("reuses only source-identical responses from a complete integrity-bound seed run", async () => {
    const temporary = fs.mkdtempSync(
      path.join(os.tmpdir(), "lf-a-classification-seed-")
    );
    try {
      const source = artifact(
        [
          "Seite 1\nVersichert sind Gebäude.\n\nVersichert sind Nebengebäude.\n",
        ],
        "e"
      );
      const plan = buildADrivenSourceUnitPlan({
        documents: [document("seed-source", 0, source)],
      });
      const pendingUnits = plan.units.filter(
        ({ initialDisposition }) =>
          initialDisposition === "PENDING_CLASSIFICATION"
      );
      const { batches, responses, summary } =
        await writeCompletedClassificationSeed({
          directory: temporary,
          plan,
        });
      const planFile = path.join(temporary, "source-unit-plan.private.json");
      const responsesFile = path.join(temporary, "responses.private.json");
      const summaryFile = path.join(temporary, "summary.private.json");

      const completeSeed = compatibleSeedResponses({
        seedShadowRoot: temporary,
        plan,
      });
      expect(completeSeed.responses).toEqual(responses);
      expect(completeSeed.sourceUnitPlanSha256).toBe(plan.planSha256);
      expect(completeSeed.responsesSha256).toBe(
        crypto
          .createHash("sha256")
          .update(stableStringify(responses))
          .digest("hex")
      );
      expect(completeSeed.runContractId).toBe(summary.contractId);
      expect(completeSeed.compatibleUnits).toBe(plan.units.length);
      expect(completeSeed.suppliedResponses).toBe(responses.length);

      const changedPlan = structuredClone(plan);
      const changedUnit = changedPlan.units.find(
        ({ unitId }) => unitId === pendingUnits[0].unitId
      );
      changedUnit.source.blocks[0].exactTextSha256 = "0".repeat(64);
      const { planSha256: _oldPlanSha256, ...changedPayload } = changedPlan;
      changedPlan.planSha256 = digest(changedPlan.contractId, changedPayload);

      const partialSeed = compatibleSeedResponses({
        seedShadowRoot: temporary,
        plan: changedPlan,
      });
      expect(partialSeed.compatibleUnits).toBe(plan.units.length - 1);
      expect(partialSeed.responses.map(({ unitId }) => unitId)).not.toContain(
        pendingUnits[0].unitId
      );

      const invalidSeedPlan = structuredClone(plan);
      invalidSeedPlan.planSha256 = "f".repeat(64);
      fs.writeFileSync(
        planFile,
        `${JSON.stringify(invalidSeedPlan, null, 2)}\n`
      );
      expect(() =>
        compatibleSeedResponses({ seedShadowRoot: temporary, plan })
      ).toThrow("LF_A_CLASSIFICATION_SEED_PLAN_INTEGRITY_INVALID");

      fs.writeFileSync(planFile, `${JSON.stringify(plan, null, 2)}\n`);
      fs.writeFileSync(
        responsesFile,
        `${JSON.stringify([...responses, responses[0]], null, 2)}\n`
      );
      expect(() =>
        compatibleSeedResponses({ seedShadowRoot: temporary, plan })
      ).toThrow("LF_A_CLASSIFICATION_SEED_RESPONSES_DUPLICATE_ID");

      fs.writeFileSync(
        responsesFile,
        `${JSON.stringify(
          [...responses, { ...responses[0], unitId: "AU-unknown" }],
          null,
          2
        )}\n`
      );
      expect(() =>
        compatibleSeedResponses({ seedShadowRoot: temporary, plan })
      ).toThrow("LF_A_CLASSIFICATION_SEED_RESPONSE_ID_UNKNOWN");

      fs.writeFileSync(
        responsesFile,
        `${JSON.stringify(responses, null, 2)}\n`
      );
      fs.writeFileSync(
        summaryFile,
        `${JSON.stringify(
          { ...summary, validBatches: summary.validBatches - 1 },
          null,
          2
        )}\n`
      );
      expect(() =>
        compatibleSeedResponses({ seedShadowRoot: temporary, plan })
      ).toThrow("LF_A_CLASSIFICATION_SEED_RUN_INCOMPLETE_OR_INVALID");

      fs.writeFileSync(summaryFile, `${JSON.stringify(summary, null, 2)}\n`);
      const firstBatchFile = batchResultFile(temporary, batches.batches[0]);
      const firstBatch = JSON.parse(fs.readFileSync(firstBatchFile, "utf8"));
      firstBatch.rawResponseSha256 = "a".repeat(64);
      fs.writeFileSync(
        firstBatchFile,
        `${JSON.stringify(firstBatch, null, 2)}\n`
      );
      expect(() =>
        compatibleSeedResponses({ seedShadowRoot: temporary, plan })
      ).toThrow("LF_A_CLASSIFICATION_SEED_BATCH_RESULT_INVALID");
    } finally {
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  });

  test("materializes complete seed batches without a model call or duplicate artifact", async () => {
    const temporary = fs.mkdtempSync(
      path.join(os.tmpdir(), "lf-a-classification-seed-batches-")
    );
    try {
      const source = artifact(
        [
          "Seite 1\nVersichert sind Gebäude.\n\nVersichert sind Nebengebäude.\n",
        ],
        "d"
      );
      const sourcePlan = buildADrivenSourceUnitPlan({
        documents: [document("seed-source", 0, source)],
      });
      const plan = deriveClassificationEvidencePlan(sourcePlan);
      const batches = buildADrivenClassificationBatches(sourcePlan, {
        maximumUnits: 1,
        maximumCharacters: 12_000,
      });
      const responses = sourcePlan.units
        .filter(
          ({ initialDisposition }) =>
            initialDisposition === "PENDING_CLASSIFICATION"
        )
        .map(({ unitId }) =>
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
      const client = { chat: { completions: { create: jest.fn() } } };

      const results = await processClassificationBatches({
        args,
        plan,
        batches,
        client,
        recoverModelAfterAbort: jest.fn(),
        seed: {
          responses,
          sourceUnitPlanSha256: sourcePlan.planSha256,
          compatibleUnits: sourcePlan.units.length,
          suppliedResponses: responses.length,
        },
      });

      expect(client.chat.completions.create).not.toHaveBeenCalled();
      expect(results.every(({ validation }) => validation.passed)).toBe(true);
      expect(results.flatMap(({ attempts }) => attempts)).toEqual([]);
      expect(
        results.reduce(
          (sum, { seededAcceptedUnits }) => sum + seededAcceptedUnits,
          0
        )
      ).toBe(responses.length);
      expect(fs.readdirSync(path.join(temporary, "batches"))).toHaveLength(
        batches.batches.length
      );

      const secondClient = {
        chat: { completions: { create: jest.fn() } },
      };
      await processClassificationBatches({
        args,
        plan,
        batches,
        client: secondClient,
        recoverModelAfterAbort: jest.fn(),
        seed: {
          responses,
          sourceUnitPlanSha256: sourcePlan.planSha256,
          compatibleUnits: sourcePlan.units.length,
          suppliedResponses: responses.length,
        },
      });
      expect(secondClient.chat.completions.create).not.toHaveBeenCalled();
      expect(fs.readdirSync(path.join(temporary, "batches"))).toHaveLength(
        batches.batches.length
      );
    } finally {
      fs.rmSync(temporary, { recursive: true, force: true });
    }
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

  test.each([
    A_DYNAMIC_MANIFEST_CONTRACT_ID_V11,
    A_DYNAMIC_MANIFEST_CONTRACT_ID_V12,
  ])(
    "upgrades an older run and prompt with validator %s by revalidating its responses",
    async (validatorContractId) => {
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
                  choices: [
                    { message: { content: JSON.stringify(responses) } },
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
        const predecessor = {
          ...seeded,
          contractId: "LF_A_BOUNDED_CLASSIFICATION_RUN_V12",
          promptContractId: "LF_A_BOUNDED_CLASSIFICATION_PROMPT_V19",
          validatorContractId,
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

        expect(upgraded.contractId).toBe("LF_A_BOUNDED_CLASSIFICATION_RUN_V62");
        expect(upgraded.validatorContractId).toBe(
          A_DYNAMIC_MANIFEST_CONTRACT_ID
        );
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
    }
  );

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

  test("continues with untouched units after one semantic repair exhausts and resumes only the remainder", async () => {
    const source = artifact(
      [
        "Seite 1\nVersichert sind Gebäude.\n\nVersichert sind Garagen.\n\nVersichert sind Nebengebäude.\n",
      ],
      "c"
    );
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const batch = buildADrivenClassificationBatches(plan).batches[0];
    expect(batch.expectedUnitIds).toHaveLength(3);
    const valid = batch.expectedUnitIds.map((unitId) =>
      validResponse(plan.units.find((unit) => unit.unitId === unitId))
    );
    const invalid = valid.map((response) => {
      const copy = JSON.parse(JSON.stringify(response));
      copy.requirements[0].components[0].label = "";
      return copy;
    });
    const requested = [];
    const client = {
      chat: {
        completions: {
          create: jest.fn(async ({ messages }) => {
            const input = JSON.parse(
              messages.find(({ role }) => role === "user").content
            );
            requested.push(input.expectedUnitIds);
            const requestedUnitId = input.expectedUnitIds[0];
            const responseIndex =
              batch.expectedUnitIds.indexOf(requestedUnitId);
            const responses =
              requested.length === 1
                ? invalid
                : requestedUnitId === batch.expectedUnitIds[0]
                  ? [invalid[0]]
                  : [valid[responseIndex]];
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

    expect(result.validation.passed).toBe(false);
    expect(requested).toEqual([
      batch.expectedUnitIds,
      [batch.expectedUnitIds[0]],
      [batch.expectedUnitIds[0]],
      [batch.expectedUnitIds[1]],
      [batch.expectedUnitIds[2]],
    ]);
    expect(result.responses.map(({ unitId }) => unitId)).toEqual([
      batch.expectedUnitIds[1],
      batch.expectedUnitIds[2],
    ]);
    expect(
      result.attempts.map(({ semanticRetryStrategy }) => semanticRetryStrategy)
    ).toEqual([
      "SINGLE_UNIT_REPAIR",
      "SINGLE_UNIT_REPAIR",
      "NEXT_PENDING_UNIT",
      "NEXT_PENDING_UNIT",
      "EXHAUSTED",
    ]);

    const resumedRequested = [];
    const resumed = await runBatch({
      client: {
        chat: {
          completions: {
            create: jest.fn(async ({ messages }) => {
              const input = JSON.parse(
                messages.find(({ role }) => role === "user").content
              );
              resumedRequested.push(input.expectedUnitIds);
              return {
                model: "qwen/qwen3.6-35b-a3b",
                choices: [{ message: { content: JSON.stringify([valid[0]]) } }],
                usage: {},
              };
            }),
          },
        },
      },
      model: "qwen/qwen3.6-35b-a3b",
      modelContext: 42_496,
      plan,
      batch,
      maximumAttempts: 3,
      initialAcceptedResponses: result.responses,
    });

    expect(resumed.validation.passed).toBe(true);
    expect(resumed.resumedAcceptedUnits).toBe(2);
    expect(resumedRequested).toEqual([[batch.expectedUnitIds[0]]]);
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

  test("refines embedded lowercase lettered clauses into independent list segments", () => {
    const source = artifact(
      [
        "Seite 1\nAUSSCHLÜSSE\n- jenen Teilen von unbeweglichen Sachen, die Gegenstand einer Bearbeitung,\nBenützung oder Tätigkeit sind.\nd) Schäden an Sachen, die entliehen oder gemietet wurden,\nsofern sie in Verwahrung genommen wurden.\ne) Ansprüche aus Gewährleistung für Mängel.\n",
      ],
      "4"
    );
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const baseUnit = plan.units.find(({ source: unitSource }) =>
      unitSource.combinedText.includes("jenen Teilen")
    );

    expect(baseUnit.logicalSourceSegments).toHaveLength(1);
    const recovered = deriveClassificationEvidencePlan(plan);
    const refined = recovered.units.find(
      ({ unitId }) => unitId === baseUnit.unitId
    );

    expect(refined.logicalSourceSegments).toHaveLength(3);
    expect(
      refined.logicalSourceSegments.map(({ combinedText }) => combinedText)
    ).toEqual([
      expect.stringContaining("jenen Teilen"),
      expect.stringContaining("d) Schäden an Sachen"),
      expect.stringContaining("e) Ansprüche aus Gewährleistung"),
    ]);
    expect(refined.logicalSourceSegments[1].combinedText).toContain(
      "sofern sie in Verwahrung genommen wurden"
    );
    expect(recovered.classificationEvidenceContext).toMatchObject({
      contractId: "LF_A_CLASSIFICATION_EVIDENCE_CONTEXT_V6",
      refinedListUnits: 1,
      additionalLogicalSegments: 2,
    });
    expect(plan.units.find(({ unitId }) => unitId === baseUnit.unitId)).toBe(
      baseUnit
    );
  });

  test("does not split an inline parenthetical letter marker", () => {
    const source = artifact(
      [
        "Seite 1\nDECKUNG\n- Sachen (ausgenommen a) besonders bezeichnete Gegenstände),\ndie im Gebäude verwahrt werden.\n",
      ],
      "6"
    );
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const baseUnit = plan.units.find(({ source: unitSource }) =>
      unitSource.combinedText.includes("besonders bezeichnete")
    );
    const recovered = deriveClassificationEvidencePlan(plan);
    const refined = recovered.units.find(
      ({ unitId }) => unitId === baseUnit.unitId
    );

    expect(baseUnit.logicalSourceSegments).toHaveLength(1);
    expect(refined.logicalSourceSegments).toEqual(
      baseUnit.logicalSourceSegments
    );
    expect(recovered.classificationEvidenceContext).toMatchObject({
      refinedListUnits: 0,
      additionalLogicalSegments: 0,
    });
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

  test("keeps an unfinished clause intact beyond twelve source blocks", () => {
    const clauseLines = [
      "Eine lange Klausel beginnt",
      ...Array.from(
        { length: 11 },
        (_, index) => `mit einem weiteren fachlichen Satzteil ${index + 1}`
      ),
      "und endet erst in diesem dreizehnten Quellblock.",
    ];
    const source = artifact(
      [`Seite 1\nDECKUNG\n${clauseLines.join("\n")}\n`],
      "a"
    );

    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const clause = plan.units.find(({ source: unitSource }) =>
      unitSource.combinedText.includes("Eine lange Klausel beginnt")
    );

    expect(clause.source.blocks.length).toBeGreaterThan(12);
    expect(clause.source.combinedText).toContain(
      "und endet erst in diesem dreizehnten Quellblock."
    );
    expect(
      plan.units.some(
        ({ source: unitSource }) =>
          unitSource.combinedText.trim() ===
          "und endet erst in diesem dreizehnten Quellblock."
      )
    ).toBe(false);
  });

  test("joins a lowercase sentence continuation across an extraction paragraph gap", () => {
    const source = artifact(
      [
        "Seite 1\nDECKUNG\nDer Versicherungsnehmer muss Gefahrenerhöhungen unverzüglich\n\nanzeigen. Danach gilt eine weitere Regel.\n",
      ],
      "b"
    );

    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const clause = plan.units.find(({ source: unitSource }) =>
      unitSource.combinedText.includes("Gefahrenerhöhungen")
    );

    expect(clause.source.combinedText).toContain(
      "Gefahrenerhöhungen unverzüglich\nanzeigen."
    );
    expect(
      plan.units.some(({ source: unitSource }) =>
        unitSource.combinedText.trim().startsWith("anzeigen.")
      )
    ).toBe(false);
  });

  test("fails closed instead of splitting an oversized unfinished clause", () => {
    const clauseLines = Array.from(
      { length: 13 },
      (_, index) => `fortsetzung ${index + 1} ${"x".repeat(990)}`
    );
    const source = artifact(
      [`Seite 1\nDECKUNG\n${clauseLines.join("\n")}\n`],
      "c"
    );

    expect(() =>
      buildADrivenSourceUnitPlan({
        documents: [document("source", 0, source)],
      })
    ).toThrow(/LF_A_SOURCE_SYNTACTIC_UNIT_TOO_LARGE/u);
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

  test("canonicalizes a whole declared source range dehyphenated by layout", () => {
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

  test("accepts a source-bound dehyphenated component inside a wider declared range", () => {
    const source = artifact(
      [
        "Seite 1\nVersichert sind Sicherheitsfachkräfte und -\nbeauftragte sowie Hausverwalter.\n",
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
                  label: "Sicherheitsfachkräfte und -beauftragte",
                  sourceBlockIds: unit.source.blockIds,
                },
                {
                  type: "OBJECT",
                  label: "Hausverwalter",
                  sourceBlockIds: unit.source.blockIds,
                },
                {
                  type: "COVERAGE_EFFECT",
                  label: "Versichert",
                  coverageEffect: "INCLUDED",
                  sourceBlockIds: unit.source.blockIds,
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
    expect(requirement.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "OBJECT",
          label: "Sicherheitsfachkräfte und -beauftragte",
          sourceBlockIds: unit.source.blockIds,
        }),
      ])
    );
  });

  test("does not treat a removed semantic hyphen as layout dehyphenation", () => {
    const source = artifact(
      ["Seite 1\nVersichert sind Sicherheitsfachkräfte und -\nbeauftragte.\n"],
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
                  label: "Sicherheitsfachkräfte und Beauftragte",
                  sourceBlockIds: unit.source.blockIds,
                },
                {
                  type: "COVERAGE_EFFECT",
                  label: "Versichert",
                  coverageEffect: "INCLUDED",
                  sourceBlockIds: unit.source.blockIds,
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
          code: "COMPONENT_SOURCE_TEXT_INVALID",
          componentType: "OBJECT",
          invalidLiteralValues: ["Sicherheitsfachkräfte und Beauftragte"],
        }),
      ])
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

  test("ignores a navigation-only exclusion heading and completes one continued peril item", () => {
    const lead =
      "- Starkregen (unvorhersehbares, unregelmäßiges Ansteigen von Wasserläufen, ";
    const continuation = "Rückhaltebecken und künstlichen Wasseranlagen);";
    const governorLead =
      "• Naturereignisse bis 1 % der Gebäudeversicherungssumme – mindestens EUR 20.000, maximal";
    const governorTail =
      "EUR 100.000 pro Objekt – auf Erstes Risiko, insbesondere Schäden durch";
    const exactBlock = (blockId, exactText, ordinal, structuralKind) => ({
      blockId,
      ordinal,
      structuralKind,
      physicalPageNumber: 4,
      documentStart: ordinal * 100,
      documentEnd: ordinal * 100 + exactText.length,
      exactText,
      exactTextSha256: crypto
        .createHash("sha256")
        .update(exactText)
        .digest("hex"),
    });
    const ownedBlocks = [
      exactBlock("peril-lead", lead, 10, "LIST_ITEM"),
      exactBlock("peril-tail", continuation, 11, "BODY_LINE"),
    ];
    const governingBlocks = [
      exactBlock("limit-lead", governorLead, 8, "LIST_GOVERNOR"),
      exactBlock("limit-tail", governorTail, 9, "BODY_LINE"),
    ];
    const combinedText = `${lead}\n${continuation}`;
    const unit = {
      unitId: "continued-peril-with-navigation-heading",
      unitOrder: 0,
      packageOrder: [0, 0],
      unitKind: "LIST",
      structurePath: ["Nicht versichert sind:"],
      source: {
        documentUuid: "doc",
        documentSha256: "d".repeat(64),
        documentPosition: 0,
        documentRole: "MAIN_POLICY",
        documentStatus: "ACTIVE",
        blockIds: ownedBlocks.map(({ blockId }) => blockId),
        blocks: ownedBlocks,
        physicalPages: [4],
        documentStart: ownedBlocks[0].documentStart,
        documentEnd: ownedBlocks.at(-1).documentEnd,
        combinedText,
        combinedTextSha256: crypto
          .createHash("sha256")
          .update(combinedText)
          .digest("hex"),
        contiguous: true,
      },
      logicalSourceSegments: [
        {
          segmentId: "continued-peril",
          type: "LIST_ITEM_WITH_CONTINUATIONS",
          blockIds: ownedBlocks.map(({ blockId }) => blockId),
          combinedText,
          combinedTextSha256: crypto
            .createHash("sha256")
            .update(combinedText)
            .digest("hex"),
        },
      ],
      semanticAuthority: false,
      initialDisposition: "PENDING_CLASSIFICATION",
      governingContext: {
        relationType: "GOVERNS_FOLLOWING_LIST",
        unitIds: ["limit-governor"],
        blockIds: governingBlocks.map(({ blockId }) => blockId),
        blocks: governingBlocks,
        combinedText: `${governorLead}\n${governorTail}`,
      },
    };
    const normalized = normalizeUnambiguousComponentTypes(
      [
        {
          unitId: unit.unitId,
          primaryClass: "EXCLUSION",
          semanticClasses: ["EXCLUSION"],
          requirements: [
            {
              displayLabel: combinedText,
              components: [
                {
                  type: "PERIL_OR_CAUSE",
                  label: "Starkregen",
                  sourceBlockIds: ["peril-lead"],
                },
                {
                  type: "COVERAGE_EFFECT",
                  label: "ausgenommen sind",
                  sourceBlockIds: ["limit-lead"],
                  coverageEffect: "EXCLUDED",
                },
              ],
            },
          ],
        },
      ],
      [unit]
    );

    expect(normalized.responses[0]).toEqual({
      unitId: unit.unitId,
      primaryClass: "PERIL_OR_DAMAGE",
      semanticClasses: ["PERIL_OR_DAMAGE"],
      requirements: [
        {
          displayLabel: combinedText,
          components: [
            {
              type: "PERIL_OR_CAUSE",
              label: "Starkregen",
              sourceBlockIds: ["peril-lead", "peril-tail"],
            },
          ],
        },
      ],
    });
    expect(normalized.componentRepairs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          unitId: unit.unitId,
          action: "DROP_UNSUPPORTED_COVERAGE_CLASS",
          fromPrimaryClass: "EXCLUSION",
          toPrimaryClass: "PERIL_OR_DAMAGE",
        }),
        expect.objectContaining({
          unitId: unit.unitId,
          action: "COMPLETE_SINGLE_LIST_CONTINUATION_COMPONENT_SOURCE_IDS",
          segmentId: "continued-peril",
          fromSourceBlockIds: ["peril-lead"],
          toSourceBlockIds: ["peril-lead", "peril-tail"],
        }),
      ])
    );

    const plan = {
      schemaVersion: 2,
      contractId: A_SOURCE_UNIT_PLAN_CONTRACT_ID,
      runContractId: A_DRIVEN_RUN_CONTRACT_ID,
      planSha256: "a".repeat(64),
      documents: [{ documentUuid: "doc" }],
      units: [unit],
      relations: [],
      summary: { sourceBlocks: 2 },
    };
    const manifest = buildADrivenSemanticManifest({
      plan,
      responses: normalized.responses,
      semanticSignalContractId: A_SEMANTIC_SIGNAL_CONTRACT_ID,
    });
    expect(manifest.summary).toMatchObject({
      unresolvedUnits: 0,
      reviewRequiredBlocks: 0,
      allBlocksTerminal: true,
      responseIntegrityStatus: "VALID",
    });
  });

  test("completes typed component provenance across one bounded multi-block list segment", () => {
    const exactBlock = (blockId, exactText, ordinal, structuralKind) => ({
      blockId,
      ordinal,
      structuralKind,
      physicalPageNumber: 7,
      documentStart: ordinal * 200,
      documentEnd: ordinal * 200 + exactText.length,
      exactText,
      exactTextSha256: crypto
        .createHash("sha256")
        .update(exactText)
        .digest("hex"),
    });
    const blocks = [
      exactBlock(
        "smoke",
        "• Rauchspuren, auch wenn sie durch Schwelbrand entstehen;",
        20,
        "LIST_GOVERNOR"
      ),
      exactBlock(
        "electric-lead",
        "• Elektrische Energie (Überspannung,",
        21,
        "LIST_GOVERNOR"
      ),
      exactBlock(
        "electric-causes",
        "Kurzschluss, Erdschluss), insbesondere Schäden an Leitungen,",
        22,
        "BODY_LINE"
      ),
      exactBlock(
        "electric-damage",
        "die durch Überlastung entstehen und keinen Brand",
        23,
        "BODY_LINE"
      ),
      exactBlock(
        "electric-tail",
        "im Sinn der Bedingungen darstellen;",
        24,
        "BODY_LINE"
      ),
    ];
    const governor = exactBlock(
      "coverage-governor",
      "Zusätzlich versichert sind Schäden durch",
      19,
      "LIST_GOVERNOR"
    );
    const firstText = blocks[0].exactText;
    const secondText = blocks
      .slice(1)
      .map(({ exactText }) => exactText)
      .join("\n");
    const combinedText = `${firstText}\n${secondText}`;
    const unit = {
      unitId: "bounded-multi-component-list",
      unitOrder: 0,
      packageOrder: [0, 0],
      unitKind: "LIST",
      structurePath: ["Zusatzdeckung"],
      source: {
        documentUuid: "doc",
        documentSha256: "d".repeat(64),
        documentPosition: 0,
        documentRole: "MAIN_POLICY",
        documentStatus: "ACTIVE",
        blockIds: blocks.map(({ blockId }) => blockId),
        blocks,
        physicalPages: [7],
        documentStart: blocks[0].documentStart,
        documentEnd: blocks.at(-1).documentEnd,
        combinedText,
        combinedTextSha256: crypto
          .createHash("sha256")
          .update(combinedText)
          .digest("hex"),
        contiguous: true,
      },
      logicalSourceSegments: [
        {
          segmentId: "smoke-segment",
          type: "LIST_ITEM_WITH_CONTINUATIONS",
          blockIds: ["smoke"],
          combinedText: firstText,
        },
        {
          segmentId: "electric-segment",
          type: "LIST_ITEM_WITH_CONTINUATIONS",
          blockIds: blocks.slice(1).map(({ blockId }) => blockId),
          combinedText: secondText,
        },
      ],
      semanticAuthority: false,
      initialDisposition: "PENDING_CLASSIFICATION",
      governingContext: {
        relationType: "GOVERNS_FOLLOWING_LIST",
        unitIds: ["coverage-governor-unit"],
        blockIds: [governor.blockId],
        blocks: [governor],
        combinedText: governor.exactText,
      },
    };
    const response = {
      unitId: unit.unitId,
      primaryClass: "OPERATIVE_COVERAGE_STATEMENT",
      semanticClasses: ["OPERATIVE_COVERAGE_STATEMENT", "PERIL_OR_DAMAGE"],
      requirements: [
        {
          displayLabel: firstText,
          components: [
            {
              type: "DAMAGE_OR_EFFECT",
              label: "Rauchspuren",
              sourceBlockIds: ["smoke"],
            },
            {
              type: "COVERAGE_EFFECT",
              label: "Zusätzlich versichert sind",
              sourceBlockIds: [governor.blockId],
              coverageEffect: "INCLUDED",
            },
          ],
        },
        {
          displayLabel: secondText,
          components: [
            {
              type: "PERIL_OR_CAUSE",
              label: "Elektrische Energie",
              sourceBlockIds: ["electric-lead"],
            },
            {
              type: "DAMAGE_OR_EFFECT",
              label: "Schäden an Leitungen",
              sourceBlockIds: ["electric-causes"],
            },
            {
              type: "COVERAGE_EFFECT",
              label: "Zusätzlich versichert sind",
              sourceBlockIds: [governor.blockId],
              coverageEffect: "INCLUDED",
            },
          ],
        },
      ],
    };
    const normalized = normalizeUnambiguousComponentTypes([response], [unit]);
    const secondComponents = normalized.responses[0].requirements[1].components;

    expect(secondComponents[0].sourceBlockIds).toEqual([
      "electric-lead",
      "electric-causes",
    ]);
    expect(secondComponents[1].sourceBlockIds).toEqual([
      "electric-causes",
      "electric-damage",
      "electric-tail",
    ]);
    expect(normalized.componentRepairs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          unitId: unit.unitId,
          action: "COMPLETE_BOUNDED_LIST_SEGMENT_COMPONENT_SOURCE_IDS",
          segmentId: "electric-segment",
        }),
      ])
    );

    const plan = {
      schemaVersion: 2,
      contractId: A_SOURCE_UNIT_PLAN_CONTRACT_ID,
      runContractId: A_DRIVEN_RUN_CONTRACT_ID,
      planSha256: "a".repeat(64),
      documents: [{ documentUuid: "doc" }],
      units: [unit],
      relations: [],
      summary: { sourceBlocks: blocks.length },
    };
    const manifest = buildADrivenSemanticManifest({
      plan,
      responses: normalized.responses,
      semanticSignalContractId: A_SEMANTIC_SIGNAL_CONTRACT_ID,
    });
    expect(manifest.summary).toMatchObject({
      unresolvedUnits: 0,
      reviewRequiredBlocks: 0,
      allBlocksTerminal: true,
      responseIntegrityStatus: "VALID",
    });
    expect(
      manifest.requirements
        .find(({ displayLabel }) => displayLabel === firstText)
        .components.some(({ type }) => type === "CONDITION")
    ).toBe(true);
  });

  test("keeps a bounded continuation fail-closed when no component anchors its first block", () => {
    const lead = {
      blockId: "unmapped-lead",
      structuralKind: "LIST_GOVERNOR",
      exactText: "• Elektrische Energie sowie",
    };
    const tail = {
      blockId: "mapped-tail",
      structuralKind: "BODY_LINE",
      exactText: "Schäden an Leitungen;",
    };
    const combinedText = `${lead.exactText}\n${tail.exactText}`;
    const unit = {
      unitId: "unanchored-list-lead",
      unitKind: "LIST",
      source: {
        blockIds: [lead.blockId, tail.blockId],
        blocks: [lead, tail],
        combinedText,
      },
      logicalSourceSegments: [
        {
          segmentId: "unanchored-segment",
          type: "LIST_ITEM_WITH_CONTINUATIONS",
          blockIds: [lead.blockId, tail.blockId],
          combinedText,
        },
      ],
    };
    const response = {
      unitId: unit.unitId,
      primaryClass: "PERIL_OR_DAMAGE",
      semanticClasses: ["PERIL_OR_DAMAGE"],
      requirements: [
        {
          displayLabel: combinedText,
          components: [
            {
              type: "DAMAGE_OR_EFFECT",
              label: "Schäden an Leitungen",
              sourceBlockIds: [tail.blockId],
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

  test("materializes a source-bound supplemental document relationship", () => {
    const intro =
      "In Ergänzung bestehender, dem Vertrag zugrunde liegender einschlägiger Bestimmungen in ";
    const ruleLead =
      "Versicherungsbedingungen o. ä. gilt die Behandlung von Sonderabfall ";
    const ruleTail = "als mitversichert.";
    const block = (blockId, exactText, ordinal) => ({
      blockId,
      ordinal,
      structuralKind: "BODY_LINE",
      physicalPageNumber: 1,
      documentStart: ordinal * 100,
      documentEnd: ordinal * 100 + exactText.length,
      exactText,
      exactTextSha256: crypto
        .createHash("sha256")
        .update(exactText)
        .digest("hex"),
    });
    const blocks = [
      block("intro", intro, 1),
      block("rule-lead", ruleLead, 2),
      block("rule-tail", ruleTail, 3),
    ];
    const combinedText = blocks.map(({ exactText }) => exactText).join("\n");
    const unit = {
      unitId: "supplemental-document-context",
      unitOrder: 0,
      packageOrder: [0, 0],
      unitKind: "CLAUSE",
      structurePath: [],
      source: {
        documentUuid: "doc",
        documentSha256: "d".repeat(64),
        documentPosition: 0,
        documentRole: "MAIN_POLICY",
        documentStatus: "FRAMEWORK_TERMS",
        blockIds: blocks.map(({ blockId }) => blockId),
        blocks,
        physicalPages: [1],
        documentStart: blocks[0].documentStart,
        documentEnd: blocks.at(-1).documentEnd,
        combinedText,
        combinedTextSha256: crypto
          .createHash("sha256")
          .update(combinedText)
          .digest("hex"),
        contiguous: true,
      },
      logicalSourceSegments: [],
      semanticAuthority: false,
      initialDisposition: "PENDING_CLASSIFICATION",
    };
    const response = {
      unitId: unit.unitId,
      primaryClass: "OPERATIVE_COVERAGE_STATEMENT",
      semanticClasses: ["OPERATIVE_COVERAGE_STATEMENT"],
      requirements: [
        {
          displayLabel:
            "gilt die Behandlung von Sonderabfall \nals mitversichert.",
          components: [
            {
              type: "OBJECT",
              label: "Behandlung von Sonderabfall",
              sourceBlockIds: ["rule-lead"],
            },
            {
              type: "COVERAGE_EFFECT",
              label: "mitversichert",
              sourceBlockIds: ["rule-tail"],
              coverageEffect: "INCLUDED",
            },
          ],
        },
      ],
    };
    const normalized = normalizeUnambiguousComponentTypes([response], [unit]);

    expect(normalized.responses[0]).toEqual({
      ...response,
      semanticClasses: [
        "OPERATIVE_COVERAGE_STATEMENT",
        "DOCUMENT_PRECEDENCE_OR_REPLACEMENT",
      ],
      requirements: [
        {
          ...response.requirements[0],
          components: [
            {
              type: "PRECEDENCE_OR_REPLACEMENT",
              label:
                "In Ergänzung bestehender, dem Vertrag zugrunde liegender einschlägiger Bestimmungen in \nVersicherungsbedingungen o. ä.",
              sourceBlockIds: ["intro", "rule-lead"],
            },
            ...response.requirements[0].components,
          ],
        },
      ],
    });
    expect(normalized.componentRepairs).toContainEqual({
      unitId: unit.unitId,
      requirementIndex: 0,
      action: "MATERIALIZE_SUPPLEMENTAL_DOCUMENT_CONTEXT",
      sourceBlockIds: ["intro", "rule-lead"],
    });

    const manifest = buildADrivenSemanticManifest({
      plan: {
        schemaVersion: 2,
        contractId: A_SOURCE_UNIT_PLAN_CONTRACT_ID,
        runContractId: A_DRIVEN_RUN_CONTRACT_ID,
        planSha256: "a".repeat(64),
        documents: [{ documentUuid: "doc" }],
        units: [unit],
        relations: [],
        summary: { sourceBlocks: 3 },
      },
      responses: normalized.responses,
      semanticSignalContractId: A_SEMANTIC_SIGNAL_CONTRACT_ID,
    });
    expect(manifest.summary).toMatchObject({
      unresolvedUnits: 0,
      reviewRequiredBlocks: 0,
      allBlocksTerminal: true,
      responseIntegrityStatus: "VALID",
    });
  });

  test("does not treat a supplemental physical object as a document relationship", () => {
    const sourceText =
      "In Ergänzung bestehender Gebäude gilt die Garage als mitversichert.";
    const unit = {
      unitId: "supplemental-object",
      unitKind: "CLAUSE",
      source: {
        blockIds: ["block"],
        combinedText: sourceText,
        blocks: [{ blockId: "block", exactText: sourceText }],
      },
      logicalSourceSegments: [],
    };
    const response = {
      unitId: unit.unitId,
      primaryClass: "OPERATIVE_COVERAGE_STATEMENT",
      semanticClasses: ["OPERATIVE_COVERAGE_STATEMENT", "INSURED_OBJECT"],
      requirements: [
        {
          displayLabel: sourceText,
          components: [
            {
              type: "OBJECT",
              label: "Garage",
              sourceBlockIds: ["block"],
            },
            {
              type: "COVERAGE_EFFECT",
              label: "mitversichert",
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

  test("splits a repeated shared damage phrase from coordinated literal objects", () => {
    const lead =
      "• die nur in einem Zerkratzen, Verschrammen oder Absplittern der Glasoberfläche bzw. der darauf ";
    const continuation =
      "angebrachten Folie, Malerei, Schriften oder Beläge, auch des Spiegelbelages, bestehen;  ";
    const exclusion = "Nicht versichert sind Schäden  ";
    const block = (blockId, exactText, ordinal, structuralKind) => ({
      blockId,
      ordinal,
      structuralKind,
      physicalPageNumber: 16,
      documentStart: ordinal * 200,
      documentEnd: ordinal * 200 + exactText.length,
      exactText,
      exactTextSha256: crypto
        .createHash("sha256")
        .update(exactText)
        .digest("hex"),
    });
    const ownedBlocks = [
      block("lead", lead, 451, "LIST_GOVERNOR"),
      block("continuation", continuation, 452, "BODY_LINE"),
    ];
    const governor = block("exclusion", exclusion, 450, "LIST_GOVERNOR");
    const combinedText = `${lead}\n${continuation}`;
    const unit = {
      unitId: "shared-damage-object-enumeration",
      unitOrder: 0,
      packageOrder: [0, 0],
      unitKind: "LIST",
      structurePath: ["Versichert sind im Rahmen der Glaspauschale:"],
      source: {
        documentUuid: "doc",
        documentSha256: "d".repeat(64),
        documentPosition: 0,
        documentRole: "MAIN_POLICY",
        documentStatus: "FRAMEWORK_TERMS",
        blockIds: ownedBlocks.map(({ blockId }) => blockId),
        blocks: ownedBlocks,
        physicalPages: [16],
        documentStart: ownedBlocks[0].documentStart,
        documentEnd: ownedBlocks.at(-1).documentEnd,
        combinedText,
        combinedTextSha256: crypto
          .createHash("sha256")
          .update(combinedText)
          .digest("hex"),
        contiguous: true,
      },
      logicalSourceSegments: [
        {
          segmentId: "glass-surface-damage",
          type: "LIST_ITEM_WITH_CONTINUATIONS",
          blockIds: ownedBlocks.map(({ blockId }) => blockId),
          combinedText,
          combinedTextSha256: crypto
            .createHash("sha256")
            .update(combinedText)
            .digest("hex"),
        },
      ],
      semanticAuthority: false,
      initialDisposition: "PENDING_CLASSIFICATION",
      governingContext: {
        relationType: "GOVERNS_FOLLOWING_LIST",
        unitIds: ["exclusion-governor"],
        blockIds: [governor.blockId],
        blocks: [governor],
        combinedText: exclusion,
      },
    };
    const repeatedLabels = [
      "Zerkratzen, Verschrammen oder Absplittern der Glasoberfläche",
      "Zerkratzen, Verschrammen oder Absplittern der darauf angebrachten Folie",
      "Zerkratzen, Verschrammen oder Absplittern Malerei",
      "Zerkratzen, Verschrammen oder Absplittern Schriften",
      "Zerkratzen, Verschrammen oder Absplittern Beläge",
      "Zerkratzen, Verschrammen oder Absplittern Spiegelbelages",
    ];
    const response = {
      unitId: unit.unitId,
      primaryClass: "EXCLUSION",
      semanticClasses: ["EXCLUSION"],
      requirements: [
        {
          displayLabel: combinedText,
          components: [
            ...repeatedLabels.map((label) => ({
              type: "PERIL_OR_CAUSE",
              label,
              sourceBlockIds: ["lead", "continuation"],
            })),
            {
              type: "COVERAGE_EFFECT",
              label: "Nicht versichert",
              sourceBlockIds: ["exclusion"],
              coverageEffect: "EXCLUDED",
            },
          ],
        },
      ],
    };
    const normalized = normalizeUnambiguousComponentTypes([response], [unit]);

    expect(normalized.responses[0]).toEqual({
      ...response,
      semanticClasses: ["EXCLUSION", "PERIL_OR_DAMAGE", "INSURED_OBJECT"],
      requirements: [
        {
          displayLabel: combinedText,
          components: [
            {
              type: "PERIL_OR_CAUSE",
              label: "Zerkratzen, Verschrammen oder Absplittern",
              sourceBlockIds: ["lead"],
            },
            ...[
              ["Glasoberfläche", "lead"],
              ["Folie", "continuation"],
              ["Malerei", "continuation"],
              ["Schriften", "continuation"],
              ["Beläge", "continuation"],
              ["Spiegelbelages", "continuation"],
            ].map(([label, blockId]) => ({
              type: "OBJECT",
              label,
              sourceBlockIds: [blockId],
            })),
            response.requirements[0].components.at(-1),
          ],
        },
      ],
    });
    expect(normalized.componentRepairs).toContainEqual({
      unitId: unit.unitId,
      requirementIndex: 0,
      action: "SPLIT_SHARED_ACTION_OBJECT_ENUMERATION",
      fromComponentType: "PERIL_OR_CAUSE",
      sharedLabel: "Zerkratzen, Verschrammen oder Absplittern",
      objectLabels: [
        "Glasoberfläche",
        "Folie",
        "Malerei",
        "Schriften",
        "Beläge",
        "Spiegelbelages",
      ],
    });

    const manifest = buildADrivenSemanticManifest({
      plan: {
        schemaVersion: 2,
        contractId: A_SOURCE_UNIT_PLAN_CONTRACT_ID,
        runContractId: A_DRIVEN_RUN_CONTRACT_ID,
        planSha256: "a".repeat(64),
        documents: [{ documentUuid: "doc" }],
        units: [unit],
        relations: [],
        summary: { sourceBlocks: 2 },
      },
      responses: normalized.responses,
      semanticSignalContractId: A_SEMANTIC_SIGNAL_CONTRACT_ID,
    });
    expect(manifest.summary).toMatchObject({
      unresolvedUnits: 0,
      reviewRequiredBlocks: 0,
      allBlocksTerminal: true,
      responseIntegrityStatus: "VALID",
    });
  });

  test("does not split a generic shared preposition into a false peril", () => {
    const sourceText = "Schäden durch Feuer, Sturm und Hagel";
    const unit = {
      unitId: "generic-shared-preposition",
      unitKind: "CLAUSE",
      source: {
        blockIds: ["block"],
        combinedText: sourceText,
        blocks: [{ blockId: "block", exactText: sourceText }],
      },
      logicalSourceSegments: [],
    };
    const response = {
      unitId: unit.unitId,
      primaryClass: "PERIL_OR_DAMAGE",
      semanticClasses: ["PERIL_OR_DAMAGE"],
      requirements: [
        {
          displayLabel: sourceText,
          components: ["Feuer", "Sturm", "Hagel"].map((peril) => ({
            type: "PERIL_OR_CAUSE",
            label: `Schäden durch ${peril}`,
            sourceBlockIds: ["block"],
          })),
        },
      ],
    };

    expect(normalizeUnambiguousComponentTypes([response], [unit])).toEqual({
      responses: [response],
      componentRepairs: [],
    });
  });

  test("preserves an exclusion backed by a literal source effect", () => {
    const sourceText = "Ausgeschlossen sind Schäden durch Hagel.";
    const unit = {
      unitId: "literal-exclusion",
      unitKind: "CLAUSE",
      structurePath: ["Deckungsumfang"],
      source: {
        blockIds: ["block"],
        combinedText: sourceText,
        blocks: [{ blockId: "block", exactText: sourceText }],
      },
      logicalSourceSegments: [],
    };
    const response = {
      unitId: unit.unitId,
      primaryClass: "EXCLUSION",
      semanticClasses: ["EXCLUSION", "PERIL_OR_DAMAGE"],
      requirements: [
        {
          displayLabel: sourceText,
          components: [
            {
              type: "COVERAGE_EFFECT",
              label: "Ausgeschlossen",
              sourceBlockIds: ["block"],
              coverageEffect: "EXCLUDED",
            },
            {
              type: "PERIL_OR_CAUSE",
              label: "Hagel",
              sourceBlockIds: ["block"],
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

  test("does not extend one component across independent list segments", () => {
    const first = "- Starkregen";
    const second = "- Erdrutsch";
    const unit = {
      unitId: "independent-perils",
      unitKind: "LIST",
      structurePath: ["Nicht versichert sind:"],
      source: {
        blockIds: ["first", "second"],
        combinedText: `${first}\n${second}`,
        blocks: [
          { blockId: "first", exactText: first },
          { blockId: "second", exactText: second },
        ],
      },
      logicalSourceSegments: [
        {
          segmentId: "first-peril",
          type: "LIST_ITEM_WITH_CONTINUATIONS",
          blockIds: ["first"],
          combinedText: first,
        },
        {
          segmentId: "second-peril",
          type: "LIST_ITEM_WITH_CONTINUATIONS",
          blockIds: ["second"],
          combinedText: second,
        },
      ],
    };
    const normalized = normalizeUnambiguousComponentTypes(
      [
        {
          unitId: unit.unitId,
          primaryClass: "EXCLUSION",
          semanticClasses: ["EXCLUSION"],
          requirements: [
            {
              displayLabel: first,
              components: [
                {
                  type: "PERIL_OR_CAUSE",
                  label: "Starkregen",
                  sourceBlockIds: ["first"],
                },
                {
                  type: "COVERAGE_EFFECT",
                  label: "ausgenommen sind",
                  sourceBlockIds: ["first"],
                  coverageEffect: "EXCLUDED",
                },
              ],
            },
          ],
        },
      ],
      [unit]
    );

    expect(normalized.responses[0].requirements[0].components[0]).toEqual({
      type: "PERIL_OR_CAUSE",
      label: "Starkregen",
      sourceBlockIds: ["first"],
    });
    expect(normalized.componentRepairs).not.toContainEqual(
      expect.objectContaining({
        action: "COMPLETE_SINGLE_LIST_CONTINUATION_COMPONENT_SOURCE_IDS",
      })
    );
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

    const normalized = normalizeUnambiguousComponentTypes([response], [unit]);

    expect(normalized.responses[0]).toMatchObject({
      primaryClass: "OPERATIVE_COVERAGE_STATEMENT",
      semanticClasses: ["OPERATIVE_COVERAGE_STATEMENT", "INSURED_OBJECT"],
    });
    expect(
      normalized.responses[0].requirements[0].components.map(
        ({ type, label }) => [type, label]
      )
    ).toEqual([
      ["OBJECT", "Gebäude"],
      ["OBJECT", "Nebengebäude"],
      ["SCOPE", "In der Sparte Gebäude gilt die Variante Premium"],
      ["COVERAGE_EFFECT", "Versichert"],
    ]);
    expect(normalized.componentRepairs).toContainEqual({
      unitId: unit.unitId,
      requirementIndex: 0,
      componentIndex: 0,
      action: "ATOMIZE_COORDINATED_OBJECT_ENUMERATION",
      objectComponents: 2,
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

  test("accepts predicate-free insurance headings and fully reused list governors as nonoperative terminals", () => {
    const plannedSource = (blockId, exactText, ordinal) => ({
      documentUuid: "doc",
      blockIds: [blockId],
      blocks: [
        {
          blockId,
          ordinal,
          structuralKind: "BODY_LINE",
          exactText,
        },
      ],
      combinedText: exactText,
    });
    const plan = {
      contractId: A_SOURCE_UNIT_PLAN_CONTRACT_ID,
      planSha256: "status-plan",
      summary: { sourceBlocks: 3 },
      units: [
        {
          unitId: "branch-heading",
          unitKind: "CLAUSE",
          initialDisposition: "PENDING_CLASSIFICATION",
          source: plannedSource(
            "branch-block",
            "Grundstückshaftpflichtversicherung",
            1
          ),
        },
        {
          unitId: "coverage-governor",
          unitKind: "CLAUSE",
          initialDisposition: "PENDING_CLASSIFICATION",
          source: plannedSource(
            "governor-block",
            "Zusätzlich sind versichert",
            2
          ),
        },
        {
          unitId: "cost-item",
          unitKind: "LIST",
          initialDisposition: "PENDING_CLASSIFICATION",
          source: plannedSource("item-block", "• Suchkosten", 3),
        },
      ],
    };
    const manifest = {
      contractId: A_DYNAMIC_MANIFEST_CONTRACT_ID,
      sourceUnitPlanSha256: plan.planSha256,
      manifestSha256: "b".repeat(64),
      summary: {
        semanticRequirements: 1,
        semanticComponents: 2,
      },
      unitTerminals: [
        {
          unitId: "branch-heading",
          terminalDisposition: "NON_OPERATIVE_TERMINAL",
          primaryClass: "STRUCTURE",
          semanticClasses: ["STRUCTURE"],
          requirementIds: [],
          diagnostics: [],
        },
        {
          unitId: "coverage-governor",
          terminalDisposition: "DUPLICATE_TERMINAL",
          primaryClass: "DUPLICATE",
          semanticClasses: ["DUPLICATE"],
          requirementIds: [],
          diagnostics: [],
        },
        {
          unitId: "cost-item",
          terminalDisposition: "OPERATIVE_MAPPED",
          primaryClass: "OPERATIVE_COVERAGE_STATEMENT",
          semanticClasses: ["OPERATIVE_COVERAGE_STATEMENT", "COST"],
          requirementIds: ["dynamic-requirement"],
          diagnostics: [],
        },
      ],
      blockTerminals: [
        { documentUuid: "doc", blockId: "branch-block" },
        { documentUuid: "doc", blockId: "governor-block" },
        { documentUuid: "doc", blockId: "item-block" },
      ],
      requirements: [
        {
          requirementId: "dynamic-requirement",
          displayLabel: "• Suchkosten",
          sourceUnitIds: ["coverage-governor", "cost-item"],
          sourceBlockIds: ["governor-block", "item-block"],
          sourceSpans: [
            { documentUuid: "doc", blockId: "governor-block" },
            { documentUuid: "doc", blockId: "item-block" },
          ],
          components: [
            {
              componentId: "coverage-component",
              type: "COVERAGE_EFFECT",
              label: "versichert",
              coverageEffect: "INCLUDED",
              sourceBlockIds: ["governor-block"],
            },
            {
              componentId: "cost-component",
              type: "FACT_ROLE",
              label: "Suchkosten",
              sourceBlockIds: ["item-block"],
            },
          ],
        },
      ],
    };
    const responses = plan.units.map((unit) => ({ unitId: unit.unitId }));
    const audit = buildADrivenAStatusAudit({
      plan,
      manifest,
      responses,
      classificationBatches: {
        batches: [
          {
            expectedUnitIds: plan.units.map(({ unitId }) => unitId),
          },
        ],
      },
      batchResults: [{ validation: { passed: true } }],
      legacyManifest: {
        manifestSha256: "c".repeat(64),
        requirements: [
          {
            requirementId: "legacy-branch",
            displayLabel: "Grundstückshaftpflichtversicherung",
            components: [
              {
                id: "legacy-branch-component",
                label: "Grundstückshaftpflichtversicherung",
                factRole: "INSURED_OBJECT",
                sourceSpanIds: ["legacy-branch-span"],
              },
            ],
            sourceSpans: [
              {
                spanId: "legacy-branch-span",
                blockIds: ["branch-block"],
              },
            ],
          },
        ],
      },
    });

    expect(audit.summary).toMatchObject({
      suspiciousNonOperativeUnits: 0,
      nonOperativeReviewPassed: true,
    });
    expect(audit.reviewedNonOperativeUnits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          unitId: "branch-heading",
          reviewDisposition: "INSURANCE_BRANCH_HEADING_CONFIRMED",
        }),
        expect.objectContaining({
          unitId: "coverage-governor",
          reviewDisposition: "OPERATIVE_GOVERNOR_EVIDENCE_REUSED",
        }),
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
          targetOutcome: "MISMATCH",
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
        ({ checkId, dimension, role }) => ({
          checkId,
          dimension,
          outcome: role === "TARGET" ? "MATCH" : "NOT_ESTABLISHED",
          candidateIds: role === "TARGET" ? ["candidate-one"] : [],
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
                            decision: "SUPPORTED",
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
            ({ checkId, dimension, role }) => ({
              checkId,
              dimension,
              outcome: role === "TARGET" ? "MATCH" : "NOT_ESTABLISHED",
              candidateIds: role === "TARGET" ? ["candidate-one"] : [],
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
                : {
                    ...original,
                    decision: "SUPPORTED",
                    selectedCandidateIds: ["candidate-one"],
                  };
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

    const limitedOutput = fs.mkdtempSync(
      path.join(os.tmpdir(), "lf-b-decision-limited-resume-")
    );
    const limitedArgs = {
      ...args,
      output: limitedOutput,
      maximumNewBatches: 1,
    };
    const limitedClient = {
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
    const limited = await processCounterpartDecisionBatches({
      args: limitedArgs,
      searchExecution,
      decisionPlan,
      client: limitedClient,
      recoverModelAfterAbort: jest.fn(),
    });
    expect(limited).toHaveLength(1);
    expect(limited.complete).toBe(false);
    expect(limited.newBatches).toBe(1);
    expect(limited.nextBatchIndex).toBe(1);
    expect(limitedClient.chat.completions.create).toHaveBeenCalledTimes(1);

    const limitedResumeClient = {
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
    const limitedResumed = await processCounterpartDecisionBatches({
      args: limitedArgs,
      searchExecution,
      decisionPlan,
      client: limitedResumeClient,
      recoverModelAfterAbort: jest.fn(),
    });
    expect(limitedResumed[0]).toEqual(limited[0]);
    expect(limitedResumed.newBatches).toBe(1);
    expect(limitedResumeClient.chat.completions.create).toHaveBeenCalledTimes(
      1
    );
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
    const partialPackageIndex = searchExecution.packages.findIndex(
      ({ componentType }) => componentType !== "COVERAGE_EFFECT"
    );
    const partialResponses = searchExecution.packages.map((item, index) =>
      index === partialPackageIndex
        ? {
            packageId: item.packageId,
            decision: "CONTRADICTED",
            selectedCandidateIds: ["candidate-one"],
            dimensionChecks: item.semanticChecks.map(
              ({ checkId, dimension, role }) => ({
                checkId,
                dimension,
                outcome: role === "TARGET" ? "MISMATCH" : "NOT_ESTABLISHED",
                candidateIds: role === "TARGET" ? ["candidate-one"] : [],
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
    expect(partial.results[partialPackageIndex]).toMatchObject({
      status: "TERMINAL",
      decision: "CONTRADICTED",
      selectedCandidateIds: ["candidate-one"],
      absenceConclusion: false,
    });
    const partialResult = buildADrivenBinaryReferenceResult({
      manifest,
      searchPlan,
      retrieval,
      searchExecution,
      decisions: partial,
    });
    expect(partialResult.rows[0]).toMatchObject({
      customerStatus: "FOUND",
      counterpartOutcome: "PARTIAL_COUNTERPART",
    });
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

describe("LF_REFERENCE_A_DRIVEN_V2 requirement-level decisions", () => {
  function requirementDecisionFixture() {
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
            compactCandidateId: `candidate-${item.packageId}`,
            documentUuid: "b-doc",
            documentSha256: "b".repeat(64),
            clauseBoundaryId: "clause-one",
            channels: ["DINGHY", "LEXICAL_BM25"],
            sourceSpans: [
              {
                candidateId: `source-${item.packageId}`,
                exactText,
                exactTextSha256: crypto
                  .createHash("sha256")
                  .update(exactText)
                  .digest("hex"),
                physicalPageNumber: 1,
                documentStart: 0,
                documentEnd: exactText.length,
                channels: ["DINGHY", "LEXICAL_BM25"],
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
    const decisionPlan = buildADrivenRequirementDecisionPlan({
      manifest,
      searchPlan,
      searchExecution,
    });
    return { manifest, searchPlan, searchExecution, decisionPlan };
  }

  function twoRequirementBatch(decisionPlan) {
    const first = decisionPlan.rows[0];
    const second = JSON.parse(JSON.stringify(first));
    second.requirementId = `${first.requirementId}-second`;
    second.reviewId = `${first.reviewId}-second`;
    second.components = second.components.map((component) => ({
      ...component,
      componentId: `${component.componentId}-second`,
    }));
    return {
      ...decisionPlan.batches[0],
      expectedRequirementIds: [first.requirementId, second.requirementId],
      rows: [first, second],
    };
  }

  function validRequirementResponse(row) {
    const candidateId = row.candidates[0].candidateId;
    return {
      requirementId: row.requirementId,
      contextFinding: { outcome: "MATCH", candidateIds: [candidateId] },
      componentFindings: row.components.map((component) => ({
        componentId: component.componentId,
        dimension: component.dimension,
        outcome: "MATCH",
        candidateIds: [candidateId],
      })),
      unmodeledDifferences: [],
      rationale: "Dasselbe fachliche Element ist quellengebunden belegt.",
    };
  }

  test("keeps the complete retrieval matrix but reviews one coherent A requirement", () => {
    const { manifest, searchExecution, decisionPlan } =
      requirementDecisionFixture();

    expect(decisionPlan.summary).toMatchObject({
      requirements: manifest.summary.semanticRequirements,
      components: manifest.summary.semanticComponents,
      absenceCertifiedRequirements: 0,
    });
    expect(decisionPlan.rows).toHaveLength(
      manifest.summary.semanticRequirements
    );
    expect(decisionPlan.batches.length).toBeLessThan(
      searchExecution.packages.length
    );
    expect(
      decisionPlan.rows.every(
        ({ components, candidates, searchCoverage }) =>
          components.length > 0 &&
          candidates.length > 0 &&
          searchCoverage.channelsComplete
      )
    ).toBe(true);
    expect(decisionPlan.selection.characterClippingAllowed).toBe(false);
    expect(decisionPlan.selection.goldInputsAllowed).toBe(false);
  });

  test("combines disjoint hash-bound plan segments without recomputing valid responses", () => {
    const { decisionPlan } = requirementDecisionFixture();
    const twoBatchPayload = JSON.parse(JSON.stringify(decisionPlan));
    delete twoBatchPayload.planSha256;
    const secondRow = JSON.parse(JSON.stringify(twoBatchPayload.rows[0]));
    secondRow.requirementId = `${secondRow.requirementId}-second`;
    secondRow.reviewId = `${secondRow.reviewId}-second`;
    twoBatchPayload.rows.push(secondRow);
    twoBatchPayload.batches = [
      {
        ...twoBatchPayload.batches[0],
        batchIndex: 0,
        expectedRequirementIds: [twoBatchPayload.rows[0].requirementId],
        rows: [twoBatchPayload.rows[0]],
      },
      {
        ...twoBatchPayload.batches[0],
        batchId: `${twoBatchPayload.batches[0].batchId}-second`,
        batchIndex: 1,
        expectedRequirementIds: [secondRow.requirementId],
        rows: [secondRow],
      },
    ];
    twoBatchPayload.summary.requirements = 2;
    twoBatchPayload.summary.components =
      twoBatchPayload.rows[0].components.length * 2;
    twoBatchPayload.summary.selectedCandidates =
      twoBatchPayload.rows[0].candidates.length * 2;
    twoBatchPayload.summary.batches = 2;
    const currentPlan = {
      ...twoBatchPayload,
      planSha256: digest(
        A_DRIVEN_REQUIREMENT_DECISION_PLAN_CONTRACT_ID,
        twoBatchPayload
      ),
    };
    const legacyPayload = JSON.parse(JSON.stringify(twoBatchPayload));
    legacyPayload.contractId =
      A_DRIVEN_REQUIREMENT_DECISION_PLAN_CONTRACT_ID_V2;
    const legacyPlan = {
      ...legacyPayload,
      planSha256: digest(
        A_DRIVEN_REQUIREMENT_DECISION_PLAN_CONTRACT_ID_V2,
        legacyPayload
      ),
    };
    const split = 1;

    const combined = buildADrivenRequirementSegmentedPlan({
      segments: [
        {
          plan: legacyPlan,
          startBatchIndex: 0,
          endBatchIndexExclusive: split,
        },
        {
          plan: currentPlan,
          startBatchIndex: split,
          endBatchIndexExclusive: currentPlan.batches.length,
        },
      ],
    });

    expect(combined.selection).toMatchObject({
      strategy: "HASH_BOUND_DISJOINT_SOURCE_PLAN_SEGMENTS",
      characterClippingAllowed: false,
      goldInputsAllowed: false,
    });
    expect(combined.rows.map(({ requirementId }) => requirementId)).toEqual(
      currentPlan.rows.map(({ requirementId }) => requirementId)
    );
    expect(combined.selection.segments).toEqual([
      expect.objectContaining({
        sourcePlanSha256: legacyPlan.planSha256,
        startBatchIndex: 0,
        endBatchIndexExclusive: split,
      }),
      expect.objectContaining({
        sourcePlanSha256: currentPlan.planSha256,
        startBatchIndex: split,
        endBatchIndexExclusive: currentPlan.batches.length,
      }),
    ]);
  });

  test("rejects gaps and semantic drift between plan segments", () => {
    const { decisionPlan } = requirementDecisionFixture();
    const twoBatchPayload = JSON.parse(JSON.stringify(decisionPlan));
    delete twoBatchPayload.planSha256;
    const secondRow = JSON.parse(JSON.stringify(twoBatchPayload.rows[0]));
    secondRow.requirementId = `${secondRow.requirementId}-second`;
    secondRow.reviewId = `${secondRow.reviewId}-second`;
    twoBatchPayload.rows.push(secondRow);
    twoBatchPayload.batches = [
      {
        ...twoBatchPayload.batches[0],
        batchIndex: 0,
        expectedRequirementIds: [twoBatchPayload.rows[0].requirementId],
        rows: [twoBatchPayload.rows[0]],
      },
      {
        ...twoBatchPayload.batches[0],
        batchId: `${twoBatchPayload.batches[0].batchId}-second`,
        batchIndex: 1,
        expectedRequirementIds: [secondRow.requirementId],
        rows: [secondRow],
      },
    ];
    twoBatchPayload.summary.requirements = 2;
    twoBatchPayload.summary.components =
      twoBatchPayload.rows[0].components.length * 2;
    twoBatchPayload.summary.selectedCandidates =
      twoBatchPayload.rows[0].candidates.length * 2;
    twoBatchPayload.summary.batches = 2;
    const currentPlan = {
      ...twoBatchPayload,
      planSha256: digest(
        A_DRIVEN_REQUIREMENT_DECISION_PLAN_CONTRACT_ID,
        twoBatchPayload
      ),
    };
    const split = 1;
    expect(() =>
      buildADrivenRequirementSegmentedPlan({
        segments: [
          {
            plan: currentPlan,
            startBatchIndex: 0,
            endBatchIndexExclusive: split,
          },
          {
            plan: currentPlan,
            startBatchIndex: split,
            endBatchIndexExclusive: split,
          },
        ],
      })
    ).toThrow("LF_A_DRIVEN_SEGMENT_RANGE_INVALID");

    expect(() =>
      buildADrivenRequirementSegmentedPlan({
        segments: [
          {
            plan: currentPlan,
            startBatchIndex: 0,
            endBatchIndexExclusive: split,
          },
        ],
      })
    ).toThrow("LF_A_DRIVEN_SEGMENT_RANGE_GAP");

    const driftedPayload = JSON.parse(JSON.stringify(currentPlan));
    delete driftedPayload.planSha256;
    driftedPayload.rows[0].displayLabel += " manipuliert";
    driftedPayload.batches[0].rows[0].displayLabel += " manipuliert";
    const drifted = {
      ...driftedPayload,
      planSha256: digest(
        A_DRIVEN_REQUIREMENT_DECISION_PLAN_CONTRACT_ID,
        driftedPayload
      ),
    };
    expect(() =>
      buildADrivenRequirementSegmentedPlan({
        segments: [
          {
            plan: drifted,
            startBatchIndex: 0,
            endBatchIndexExclusive: split,
          },
          {
            plan: currentPlan,
            startBatchIndex: split,
            endBatchIndexExclusive: currentPlan.batches.length,
          },
        ],
      })
    ).toThrow("LF_A_DRIVEN_SEGMENT_PLAN_SEMANTIC_IDENTITY_MISMATCH");
  });

  test("adds complete-corpus rescue once per requirement and document", () => {
    const { manifest, searchPlan, searchExecution } =
      requirementDecisionFixture();
    const completeCorpus = buildADrivenCompleteBCorpus({
      documents: [
        document(
          "b-doc",
          0,
          artifact(
            [
              "Seite 1\nErste vollständige Klausel.",
              "Seite 2\nZweite vollständige Klausel.",
              "Seite 3\nDritte vollständige Klausel.",
              "Seite 4\nVierte vollständige Klausel.",
            ],
            "b"
          )
        ),
      ],
    });
    expect(completeCorpus.clauses.length).toBeGreaterThan(2);

    const decisionPlan = buildADrivenRequirementDecisionPlan({
      manifest,
      searchPlan,
      searchExecution,
      completeCorpus,
      maximumCandidatesPerComponent: 1,
      maximumCompleteCorpusCandidatesPerDocument: 2,
    });
    const row = decisionPlan.rows[0];

    expect(row.searchCoverage).toMatchObject({
      candidateSelection:
        "PER_COMPONENT_RETRIEVAL_PLUS_REQUIREMENT_DOCUMENT_RESCUE",
      completeCorpusRescueScope: "ONE_REQUIREMENT_ONE_B_DOCUMENT",
      completeCorpusRescueCandidatesSelected: 2,
    });
    expect(
      row.candidates.filter(({ channels }) =>
        channels.includes("COMPLETE_B_CORPUS")
      )
    ).toHaveLength(2);
    expect(
      new Set(
        row.components.flatMap(
          ({ navigationCandidateIds }) => navigationCandidateIds
        )
      ).size
    ).toBe(row.candidates.length);
  });

  test("uses a source-bound binary counterpart prompt without Gold input", () => {
    const { decisionPlan } = requirementDecisionFixture();
    const messages = requirementDecisionPrompt(decisionPlan.batches[0]);
    const system = messages[0].content;
    const request = JSON.parse(messages[1].content);

    expect(system).toContain("GEFUNDEN bedeutet");
    expect(system).toContain("Abweichende Werte, Limits, Bedingungen");
    expect(system).toContain("bloße Keyword-Nennung");
    expect(system).toContain("sprachlogisch zwingende Verbindung");
    expect(system).toContain("keine ungeschriebene Ausnahme");
    expect(system).toContain("ausdrücklich umfassender Oberbegriff");
    expect(system).toContain(
      "nur ähnlicher wirtschaftlicher Zweck genügt nicht"
    );
    expect(system).toContain("kleinste Menge von candidateIds");
    expect(request.expectedRequirementIds).toEqual(
      decisionPlan.batches[0].expectedRequirementIds
    );
    expect(JSON.stringify(request).toLowerCase()).not.toContain("gold");
  });

  test("gives invalid identity-core difference retries actionable schema feedback", () => {
    const { decisionPlan } = requirementDecisionFixture();
    const batch = decisionPlan.batches[0];
    const component = batch.rows[0].components.find(({ identityCore }) =>
      Boolean(identityCore)
    );
    const invalidResponse = {
      requirementId: batch.rows[0].requirementId,
      contextFinding: {
        outcome: "MATCH",
        candidateIds: [batch.rows[0].candidates[0].candidateId],
      },
      componentFindings: batch.rows[0].components.map((item) => ({
        componentId: item.componentId,
        dimension: item.dimension,
        outcome:
          item.componentId === component.componentId
            ? "COUNTERPART_WITH_DIFFERENCE"
            : "MATCH",
        candidateIds: [batch.rows[0].candidates[0].candidateId],
      })),
    };
    const instruction = requirementDecisionRepairInstruction(
      batch,
      [
        {
          requirementId: batch.rows[0].requirementId,
          code: "INVALID_REQUIREMENT_RESPONSE",
          issues: [
            {
              code: "COMPONENT_FINDING_INVALID",
              componentId: component.componentId,
            },
          ],
        },
      ],
      [invalidResponse]
    );

    expect(instruction).toContain(
      `${component.componentId}:${component.dimension}`
    );
    expect(instruction).toContain("Verbindliches Komponentenschema");
    for (const expected of batch.rows[0].components) {
      expect(instruction).toContain(expected.componentId);
      expect(instruction).toContain(`\"dimension\":\"${expected.dimension}\"`);
    }
    expect(instruction).toContain(
      "outcome NOT_ESTABLISHED und candidateIds []"
    );
    expect(instruction).toContain(
      "COUNTERPART_WITH_DIFFERENCE ist ausschließlich"
    );
    expect(instruction).toContain("RELATED_ONLY bei einem bloß verwandten");
    expect(instruction).toContain("Erlaubte candidateIds je Requirement");
    for (const { candidateId } of batch.rows[0].candidates)
      expect(instruction).toContain(candidateId);
    expect(instruction).toContain("Zeichen für Zeichen aus der Liste");
    expect(instruction).toContain("entferne jede andere oder erfundene ID");
    expect(instruction).toContain("Vorige ungültige Struktur");
    expect(instruction).toContain(
      JSON.stringify(invalidResponse.componentFindings)
    );
    expect(requirementDecisionPrompt(batch)).toHaveLength(2);
    expect(
      requirementDecisionPrompt(batch, [
        { code: "INVALID_REQUIREMENT_RESPONSE", issues: [] },
      ])
    ).toHaveLength(3);
  });

  test("normalizes only repeated candidate IDs before strict validation", () => {
    const source = [
      {
        requirementId: "requirement",
        contextFinding: {
          outcome: "MATCH",
          candidateIds: ["one", "one", "two"],
        },
        componentFindings: [
          {
            componentId: "component",
            candidateIds: ["two", "two"],
          },
        ],
        unmodeledDifferences: [
          { dimension: "SCOPE", candidateIds: ["one", "one"] },
        ],
      },
    ];

    const normalized = normalizeRepeatedCandidateIds(source);

    expect(normalized).toMatchObject({
      duplicateCandidateIdsRemoved: 3,
      responses: [
        {
          contextFinding: { candidateIds: ["one", "two"] },
          componentFindings: [{ candidateIds: ["two"] }],
          unmodeledDifferences: [{ candidateIds: ["one"] }],
        },
      ],
    });
    expect(source[0].contextFinding.candidateIds).toEqual([
      "one",
      "one",
      "two",
    ]);
  });

  test("normalizes an identity-core difference only when every candidate has bound modifier evidence", () => {
    const { decisionPlan } = requirementDecisionFixture();
    const batch = decisionPlan.batches[0];
    const row = batch.rows[0];
    const candidateId = row.candidates[0].candidateId;
    const identityCore = row.components.find(({ identityCore }) => identityCore);
    const response = validRequirementResponse(row);
    response.componentFindings = response.componentFindings.map((finding) =>
      finding.componentId === identityCore.componentId
        ? { ...finding, outcome: "COUNTERPART_WITH_DIFFERENCE" }
        : finding
    );
    response.unmodeledDifferences = [
      {
        dimension: "VALUE_AND_UNIT",
        description: "Der Wert weicht ab.",
        candidateIds: [candidateId],
      },
    ];

    expect(
      validateBatchResponses(decisionPlan, batch, [response]).passed
    ).toBe(false);
    const normalized = normalizeIdentityCoreModifierDifferences(batch, [
      response,
    ]);

    expect(normalized.normalizations).toEqual([
      {
        requirementId: row.requirementId,
        componentId: identityCore.componentId,
        dimension: identityCore.dimension,
        fromOutcome: "COUNTERPART_WITH_DIFFERENCE",
        toOutcome: "MATCH",
        candidateIds: [candidateId],
        modifierDimensions: ["VALUE_AND_UNIT"],
      },
    ]);
    expect(
      normalized.responses[0].componentFindings.find(
        ({ componentId }) => componentId === identityCore.componentId
      ).outcome
    ).toBe("MATCH");
    expect(
      validateBatchResponses(
        decisionPlan,
        batch,
        normalized.responses
      ).passed
    ).toBe(true);
    expect(response.componentFindings).toContainEqual(
      expect.objectContaining({
        componentId: identityCore.componentId,
        outcome: "COUNTERPART_WITH_DIFFERENCE",
      })
    );
  });

  test.each([
    ["without modifier evidence", []],
    [
      "with an identity-core difference",
      [
        {
          dimension: "OBJECT",
          description: "Der fachliche Kern ist verschieden.",
        },
      ],
    ],
  ])("keeps an unsafe identity-core difference invalid %s", (_name, differences) => {
    const { decisionPlan } = requirementDecisionFixture();
    const batch = decisionPlan.batches[0];
    const row = batch.rows[0];
    const candidateId = row.candidates[0].candidateId;
    const identityCore = row.components.find(({ identityCore }) => identityCore);
    const response = validRequirementResponse(row);
    response.componentFindings = response.componentFindings.map((finding) =>
      finding.componentId === identityCore.componentId
        ? { ...finding, outcome: "COUNTERPART_WITH_DIFFERENCE" }
        : finding
    );
    response.unmodeledDifferences = differences.map((difference) => ({
      ...difference,
      candidateIds: [candidateId],
    }));

    const normalized = normalizeIdentityCoreModifierDifferences(batch, [
      response,
    ]);

    expect(normalized.normalizations).toEqual([]);
    expect(normalized.responses).toEqual([response]);
    expect(
      validateBatchResponses(
        decisionPlan,
        batch,
        normalized.responses
      ).passed
    ).toBe(false);
  });

  test("accepts a bound identity-core modifier response without retry", async () => {
    const { decisionPlan } = requirementDecisionFixture();
    const sourceBatch = decisionPlan.batches[0];
    const row = sourceBatch.rows[0];
    const batch = {
      ...sourceBatch,
      expectedRequirementIds: [row.requirementId],
      rows: [row],
    };
    const response = validRequirementResponse(row);
    const identityCore = row.components.find(({ identityCore }) => identityCore);
    const candidateId = row.candidates[0].candidateId;
    response.componentFindings = response.componentFindings.map((finding) =>
      finding.componentId === identityCore.componentId
        ? { ...finding, outcome: "COUNTERPART_WITH_DIFFERENCE" }
        : finding
    );
    response.unmodeledDifferences = [
      {
        dimension: "LIMIT_BASIS",
        description: "Die Berechnungsbasis weicht ab.",
        candidateIds: [candidateId],
      },
    ];
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

    const result = await runRequirementDecisionBatch({
      client,
      model: "qwen/qwen3.6-35b-a3b",
      modelContext: 42_496,
      plan: decisionPlan,
      batch,
      maximumAttempts: 2,
    });

    expect(client.chat.completions.create).toHaveBeenCalledTimes(1);
    expect(result.validation.passed).toBe(true);
    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0].identityCoreModifierNormalizations).toHaveLength(
      1
    );
    expect(result.responses[0].componentFindings).toContainEqual(
      expect.objectContaining({
        componentId: identityCore.componentId,
        outcome: "MATCH",
      })
    );
    expect(result.responses[0].unmodeledDifferences).toEqual(
      response.unmodeledDifferences
    );
  });

  test("retries invalid JSON and stores only a contract-valid requirement response", async () => {
    const { decisionPlan } = requirementDecisionFixture();
    const sourceBatch = decisionPlan.batches[0];
    const row = sourceBatch.rows[0];
    const batch = {
      ...sourceBatch,
      expectedRequirementIds: [row.requirementId],
      rows: [row],
    };
    const candidateId = row.candidates[0].candidateId;
    const valid = {
      requirementId: row.requirementId,
      contextFinding: { outcome: "MATCH", candidateIds: [candidateId] },
      componentFindings: row.components.map((component) => ({
        componentId: component.componentId,
        dimension: component.dimension,
        outcome: "MATCH",
        candidateIds: [candidateId],
      })),
      unmodeledDifferences: [],
      rationale: "Dasselbe fachliche Element ist quellengebunden belegt.",
    };
    const client = {
      chat: {
        completions: {
          create: jest
            .fn()
            .mockResolvedValueOnce({
              model: "qwen/qwen3.6-35b-a3b",
              choices: [{ message: { content: "kein JSON" } }],
              usage: {},
            })
            .mockResolvedValueOnce({
              model: "qwen/qwen3.6-35b-a3b",
              choices: [{ message: { content: JSON.stringify([valid]) } }],
              usage: {},
            }),
        },
      },
    };

    const result = await runRequirementDecisionBatch({
      client,
      model: "qwen/qwen3.6-35b-a3b",
      modelContext: 42_496,
      plan: decisionPlan,
      batch,
      maximumAttempts: 2,
    });

    expect(result.validation.passed).toBe(true);
    expect(result.responses).toEqual([valid]);
    expect(result.attempts).toHaveLength(2);
    expect(result.attempts[0]).toMatchObject({
      errorClass: "MODEL_RESPONSE_INVALID",
      responses: [],
    });
    expect(result.attempts[1]).toMatchObject({
      errorClass: null,
      acceptedRequirements: 1,
      pendingRequirements: 0,
    });
  });

  test("splits a safely timed-out requirement batch and passes only after every requirement is merged", async () => {
    const { decisionPlan } = requirementDecisionFixture();
    const batch = twoRequirementBatch(decisionPlan);
    const requested = [];
    const client = {
      chat: {
        completions: {
          create: jest.fn(({ messages }) => {
            const input = JSON.parse(
              messages.find(({ role }) => role === "user").content
            );
            requested.push(input.expectedRequirementIds);
            if (requested.length === 1) return new Promise(() => {});
            return Promise.resolve({
              model: "qwen/qwen3.6-35b-a3b",
              choices: [
                {
                  message: {
                    content: JSON.stringify(
                      input.expectedRequirementIds.map((requirementId) =>
                        validRequirementResponse(
                          batch.rows.find(
                            (row) => row.requirementId === requirementId
                          )
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

    const result = await runRequirementDecisionBatch({
      client,
      model: "qwen/qwen3.6-35b-a3b",
      modelContext: 42_496,
      plan: decisionPlan,
      batch,
      maximumAttempts: 2,
      requestTimeoutMs: 10,
      abortSettlementTimeoutMs: 5,
      recoverModelAfterAbort: jest.fn(async () => ({
        status: "SAFE_RELOADED",
      })),
    });

    expect(result.validation.passed).toBe(true);
    expect(result.responses).toHaveLength(2);
    expect(requested).toEqual([
      batch.expectedRequirementIds,
      [batch.expectedRequirementIds[0]],
      [batch.expectedRequirementIds[1]],
    ]);
    expect(result.attempts[0].timeoutRetryPartition).toEqual({
      strategy: "SINGLE_REQUIREMENT_AFTER_SAFE_TIMEOUT",
      retryRequirementIds: [batch.expectedRequirementIds[0]],
      deferredRequirementIds: [batch.expectedRequirementIds[1]],
    });
    expect(result.attempts.at(-1).semanticRetryStrategy).toBe("COMPLETE");
  });

  test("keeps an exhausted timed-out requirement fail-closed while completing deferred work", async () => {
    const { decisionPlan } = requirementDecisionFixture();
    const batch = twoRequirementBatch(decisionPlan);
    const requested = [];
    const client = {
      chat: {
        completions: {
          create: jest.fn(({ messages }) => {
            const input = JSON.parse(
              messages.find(({ role }) => role === "user").content
            );
            requested.push(input.expectedRequirementIds);
            if (
              requested.length < 3 ||
              input.expectedRequirementIds[0] ===
                batch.expectedRequirementIds[0]
            )
              return new Promise(() => {});
            const row = batch.rows.find(
              ({ requirementId }) =>
                requirementId === input.expectedRequirementIds[0]
            );
            return Promise.resolve({
              model: "qwen/qwen3.6-35b-a3b",
              choices: [
                {
                  message: {
                    content: JSON.stringify([validRequirementResponse(row)]),
                  },
                },
              ],
              usage: {},
            });
          }),
        },
      },
    };

    const result = await runRequirementDecisionBatch({
      client,
      model: "qwen/qwen3.6-35b-a3b",
      modelContext: 42_496,
      plan: decisionPlan,
      batch,
      maximumAttempts: 2,
      requestTimeoutMs: 10,
      abortSettlementTimeoutMs: 5,
      recoverModelAfterAbort: jest.fn(async () => ({
        status: "SAFE_RELOADED",
      })),
    });

    expect(requested).toEqual([
      batch.expectedRequirementIds,
      [batch.expectedRequirementIds[0]],
      [batch.expectedRequirementIds[1]],
    ]);
    expect(result.validation.passed).toBe(false);
    expect(result.responses.map(({ requirementId }) => requirementId)).toEqual([
      batch.expectedRequirementIds[1],
    ]);
  });

  test("resumes a safely journaled grouped timeout at a single requirement", async () => {
    const { decisionPlan } = requirementDecisionFixture();
    const batch = twoRequirementBatch(decisionPlan);
    const output = fs.mkdtempSync(
      path.join(os.tmpdir(), "lf-a-requirement-timeout-resume-")
    );
    const args = {
      model: "qwen/qwen3.6-35b-a3b",
      modelContext: 42_496,
      requestTimeoutMs: 180_000,
      abortSettlementTimeoutMs: 15_000,
      modelRecoveryTimeoutMs: 180_000,
    };
    try {
      const directory = path.join(output, "attempts", `00000-${batch.batchId}`);
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(
        path.join(directory, "cycle-001-attempt-001.private.json"),
        `${JSON.stringify({
          schemaVersion: 1,
          contractId: "LF_A_DRIVEN_REQUIREMENT_DECISION_TRANSPORT_V1",
          decisionPlanSha256: decisionPlan.planSha256,
          promptContractId: "LF_A_DRIVEN_REQUIREMENT_DECISION_PROMPT_V2",
          promptSha256: crypto
            .createHash("sha256")
            .update(JSON.stringify(requirementDecisionPrompt(batch)))
            .digest("hex"),
          requestedModel: args.model,
          modelContext: args.modelContext,
          requestTimeoutMs: args.requestTimeoutMs,
          abortSettlementTimeoutMs: args.abortSettlementTimeoutMs,
          modelRecoveryTimeoutMs: args.modelRecoveryTimeoutMs,
          batchId: batch.batchId,
          batchIndex: batch.batchIndex,
          expectedRequirementIds: batch.expectedRequirementIds,
          attempt: {
            requestedRequirementIds: batch.expectedRequirementIds,
            errorClass: "MODEL_REQUEST_TIMEOUT",
            timedOut: true,
            abortTriggered: true,
            requestSettledAfterAbort: true,
            recovery: { status: "SAFE_RELOADED" },
            responses: [],
          },
        })}\n`
      );
      const resumeState = requirementDecisionJournalState({
        output,
        plan: decisionPlan,
        batch,
        args,
      });
      expect(resumeState).toEqual({
        acceptedResponses: [],
        identityCoreModifierNormalizations: [],
        resumeAfterSafeGroupedTimeout: true,
      });

      const requested = [];
      const result = await runRequirementDecisionBatch({
        client: {
          chat: {
            completions: {
              create: jest.fn(async ({ messages }) => {
                const input = JSON.parse(
                  messages.find(({ role }) => role === "user").content
                );
                requested.push(input.expectedRequirementIds);
                return {
                  model: args.model,
                  choices: [
                    {
                      message: {
                        content: JSON.stringify(
                          input.expectedRequirementIds.map((requirementId) =>
                            validRequirementResponse(
                              batch.rows.find(
                                (row) => row.requirementId === requirementId
                              )
                            )
                          )
                        ),
                      },
                    },
                  ],
                  usage: {},
                };
              }),
            },
          },
        },
        model: args.model,
        modelContext: args.modelContext,
        plan: decisionPlan,
        batch,
        maximumAttempts: 2,
        initialAcceptedResponses: resumeState.acceptedResponses,
        resumeAfterSafeGroupedTimeout:
          resumeState.resumeAfterSafeGroupedTimeout,
      });

      expect(result.validation.passed).toBe(true);
      expect(requested).toEqual([
        [batch.expectedRequirementIds[0]],
        [batch.expectedRequirementIds[1]],
      ]);
    } finally {
      fs.rmSync(output, { recursive: true, force: true });
    }
  });

  test("resumes a journaled identity-core modifier response without another model call", async () => {
    const { decisionPlan } = requirementDecisionFixture();
    const sourceBatch = decisionPlan.batches[0];
    const row = sourceBatch.rows[0];
    const batch = {
      ...sourceBatch,
      expectedRequirementIds: [row.requirementId],
      rows: [row],
    };
    const output = fs.mkdtempSync(
      path.join(os.tmpdir(), "lf-a-core-modifier-resume-")
    );
    const args = {
      model: "qwen/qwen3.6-35b-a3b",
      modelContext: 42_496,
      requestTimeoutMs: 180_000,
      abortSettlementTimeoutMs: 15_000,
      modelRecoveryTimeoutMs: 180_000,
    };
    const response = validRequirementResponse(row);
    const identityCore = row.components.find(({ identityCore }) => identityCore);
    const candidateId = row.candidates[0].candidateId;
    response.componentFindings = response.componentFindings.map((finding) =>
      finding.componentId === identityCore.componentId
        ? { ...finding, outcome: "COUNTERPART_WITH_DIFFERENCE" }
        : finding
    );
    response.unmodeledDifferences = [
      {
        dimension: "VALUE_AND_UNIT",
        description: "Der Wert weicht ab.",
        candidateIds: [candidateId],
      },
    ];
    try {
      const directory = path.join(
        output,
        "attempts",
        `00000-${batch.batchId}`
      );
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(
        path.join(directory, "cycle-001-attempt-001.private.json"),
        `${JSON.stringify({
          schemaVersion: 1,
          contractId: "LF_A_DRIVEN_REQUIREMENT_DECISION_TRANSPORT_V1",
          decisionPlanSha256: decisionPlan.planSha256,
          promptContractId: "LF_A_DRIVEN_REQUIREMENT_DECISION_PROMPT_V2",
          promptSha256: crypto
            .createHash("sha256")
            .update(JSON.stringify(requirementDecisionPrompt(batch)))
            .digest("hex"),
          requestedModel: args.model,
          modelContext: args.modelContext,
          requestTimeoutMs: args.requestTimeoutMs,
          abortSettlementTimeoutMs: args.abortSettlementTimeoutMs,
          modelRecoveryTimeoutMs: args.modelRecoveryTimeoutMs,
          batchId: batch.batchId,
          batchIndex: batch.batchIndex,
          expectedRequirementIds: batch.expectedRequirementIds,
          attempt: { responses: [response] },
        })}\n`
      );

      const resumeState = requirementDecisionJournalState({
        output,
        plan: decisionPlan,
        batch,
        args,
      });
      expect(resumeState.acceptedResponses).toHaveLength(1);
      expect(resumeState.identityCoreModifierNormalizations).toHaveLength(1);
      const client = {
        chat: { completions: { create: jest.fn() } },
      };
      const result = await runRequirementDecisionBatch({
        client,
        model: args.model,
        modelContext: args.modelContext,
        plan: decisionPlan,
        batch,
        maximumAttempts: 2,
        initialAcceptedResponses: resumeState.acceptedResponses,
        initialIdentityCoreModifierNormalizations:
          resumeState.identityCoreModifierNormalizations,
      });

      expect(client.chat.completions.create).not.toHaveBeenCalled();
      expect(result.validation.passed).toBe(true);
      expect(result.attempts).toEqual([]);
      expect(result.resumedIdentityCoreModifierNormalizations).toHaveLength(1);
    } finally {
      fs.rmSync(output, { recursive: true, force: true });
    }
  });

  test("accepts a source-bound response after removing duplicate candidate references", async () => {
    const { decisionPlan } = requirementDecisionFixture();
    const sourceBatch = decisionPlan.batches[0];
    const row = sourceBatch.rows[0];
    const batch = {
      ...sourceBatch,
      expectedRequirementIds: [row.requirementId],
      rows: [row],
    };
    const candidateId = row.candidates[0].candidateId;
    const response = {
      requirementId: row.requirementId,
      contextFinding: {
        outcome: "MATCH",
        candidateIds: [candidateId, candidateId],
      },
      componentFindings: row.components.map((component) => ({
        componentId: component.componentId,
        dimension: component.dimension,
        outcome: "MATCH",
        candidateIds: [candidateId, candidateId],
      })),
      unmodeledDifferences: [],
      rationale: "Dasselbe fachliche Element ist belegt.",
    };
    const result = await runRequirementDecisionBatch({
      client: {
        chat: {
          completions: {
            create: jest.fn(async () => ({
              model: "qwen/qwen3.6-35b-a3b",
              choices: [{ message: { content: JSON.stringify([response]) } }],
              usage: {},
            })),
          },
        },
      },
      model: "qwen/qwen3.6-35b-a3b",
      modelContext: 42_496,
      plan: decisionPlan,
      batch,
      maximumAttempts: 1,
    });

    expect(result.validation.passed).toBe(true);
    expect(result.attempts[0].duplicateCandidateIdsRemoved).toBe(
      row.components.length + 1
    );
    expect(result.responses[0].contextFinding.candidateIds).toEqual([
      candidateId,
    ]);
    expect(
      result.responses[0].componentFindings.every(
        ({ candidateIds }) => candidateIds.length === 1
      )
    ).toBe(true);
  });

  test("keeps a source-bound partial or opposite counterpart found", () => {
    const { decisionPlan } = requirementDecisionFixture();
    const partialResponses = decisionPlan.rows.map((row) => {
      const candidateId = row.candidates[0].candidateId;
      const coreIndex = row.components.findIndex(
        ({ identityCore }) => identityCore
      );
      return {
        requirementId: row.requirementId,
        contextFinding: { outcome: "MATCH", candidateIds: [candidateId] },
        componentFindings: row.components.map((component, index) => ({
          componentId: component.componentId,
          dimension: component.dimension,
          outcome: index === coreIndex ? "MATCH" : "NOT_ESTABLISHED",
          candidateIds: index === coreIndex ? [candidateId] : [],
        })),
        unmodeledDifferences: [],
        rationale: "Der fachliche Kern ist belegt; Details fehlen.",
      };
    });
    const partial = validateADrivenRequirementDecisionResponses({
      plan: decisionPlan,
      responses: partialResponses,
    });

    expect(partial.summary.unresolvedRequirements).toBe(0);
    expect(partial.results[0]).toMatchObject({
      status: "TERMINAL",
      customerFound: true,
      customerStatus: "FOUND",
      counterpartOutcome: "PARTIAL_COUNTERPART",
      absenceCertified: false,
    });

    const oppositeResponses = partialResponses.map((response, rowIndex) => {
      const candidateId = decisionPlan.rows[rowIndex].candidates[0].candidateId;
      const oppositeIndex = response.componentFindings.findIndex(
        ({ dimension }) => dimension === "COVERAGE_EFFECT"
      );
      return {
        ...response,
        componentFindings: response.componentFindings.map((finding, index) =>
          index === oppositeIndex
            ? {
                ...finding,
                outcome: "OPPOSITE",
                candidateIds: [candidateId],
              }
            : finding
        ),
      };
    });
    const opposite = validateADrivenRequirementDecisionResponses({
      plan: decisionPlan,
      responses: oppositeResponses,
    });
    expect(opposite.results[0]).toMatchObject({
      customerFound: true,
      counterpartOutcome: "CONTRADICTED",
    });
  });

  test("keeps a partially established identity core found", () => {
    const { decisionPlan: sourcePlan } = requirementDecisionFixture();
    const decisionPlan = JSON.parse(JSON.stringify(sourcePlan));
    const row = decisionPlan.rows[0];
    const firstCore = row.components.find(({ identityCore }) => identityCore);
    const secondCore = {
      ...firstCore,
      componentId: `${firstCore.componentId}-second-core`,
      label: "Hausverwaltung",
    };
    row.components.push(secondCore);
    const batchRow = decisionPlan.batches
      .flatMap(({ rows }) => rows)
      .find(({ requirementId }) => requirementId === row.requirementId);
    batchRow.components.push(secondCore);
    decisionPlan.summary.components += 1;
    const { planSha256: _oldPlanSha256, ...payload } = decisionPlan;
    decisionPlan.planSha256 = crypto
      .createHash("sha256")
      .update(
        `${A_DRIVEN_REQUIREMENT_DECISION_PLAN_CONTRACT_ID}\u0000${stableStringify(
          payload
        )}`
      )
      .digest("hex");
    const responses = decisionPlan.rows.map((plannedRow) => {
      const candidateId = plannedRow.candidates[0].candidateId;
      return {
        requirementId: plannedRow.requirementId,
        contextFinding: { outcome: "MATCH", candidateIds: [candidateId] },
        componentFindings: plannedRow.components.map((component) => ({
          componentId: component.componentId,
          dimension: component.dimension,
          outcome:
            component.componentId === secondCore.componentId
              ? "NOT_ESTABLISHED"
              : "MATCH",
          candidateIds:
            component.componentId === secondCore.componentId
              ? []
              : [candidateId],
        })),
        unmodeledDifferences: [],
        rationale: "Nur ein Teil des fachlichen Identitätskerns ist belegt.",
      };
    });

    const result = validateADrivenRequirementDecisionResponses({
      plan: decisionPlan,
      responses,
    });

    expect(result.results[0]).toMatchObject({
      status: "TERMINAL",
      customerFound: true,
      customerStatus: "FOUND",
      counterpartOutcome: "PARTIAL_COUNTERPART",
      absenceCertified: false,
    });
  });

  test("requires exhaustive fallback for related-only or missing candidates", () => {
    const { decisionPlan } = requirementDecisionFixture();
    const responses = decisionPlan.rows.map((row) => {
      const candidateId = row.candidates[0].candidateId;
      return {
        requirementId: row.requirementId,
        contextFinding: {
          outcome: "RELATED_ONLY",
          candidateIds: [candidateId],
        },
        componentFindings: row.components.map((component) => ({
          componentId: component.componentId,
          dimension: component.dimension,
          outcome: "RELATED_ONLY",
          candidateIds: [candidateId],
        })),
        unmodeledDifferences: [],
        rationale: "Nur thematische Nähe.",
      };
    });
    const result = validateADrivenRequirementDecisionResponses({
      plan: decisionPlan,
      responses,
    });

    expect(result.results[0]).toMatchObject({
      customerFound: null,
      customerStatus: "FALLBACK_REQUIRED",
      counterpartOutcome: null,
      absenceCertified: false,
    });

    const tampered = JSON.parse(JSON.stringify(responses));
    tampered[0].componentFindings[0].candidateIds = ["invented-candidate"];
    const invalid = validateADrivenRequirementDecisionResponses({
      plan: decisionPlan,
      responses: tampered,
    });
    expect(invalid.results[0]).toMatchObject({
      status: "UNRESOLVED",
      reasonCode: "INVALID_REQUIREMENT_RESPONSE",
    });

    expect(preliminaryDecisionArtifact(decisionPlan, result)).toMatchObject({
      subset: { planSha256: decisionPlan.planSha256 },
      decisions: {
        decisionSha256: result.decisionSha256,
        summary: { fallbackRequiredRequirements: result.results.length },
      },
    });
    expect(() => preliminaryDecisionArtifact(decisionPlan, invalid)).toThrow(
      "LF_A_DRIVEN_REQUIREMENT_DECISION_ARTIFACT_INVALID"
    );

    const withoutFallback = validateADrivenRequirementDecisionResponses({
      plan: decisionPlan,
      responses: decisionPlan.rows.map((plannedRow) => {
        const selectedCandidateId = plannedRow.candidates[0].candidateId;
        return {
          requirementId: plannedRow.requirementId,
          contextFinding: {
            outcome: "MATCH",
            candidateIds: [selectedCandidateId],
          },
          componentFindings: plannedRow.components.map((component) => ({
            componentId: component.componentId,
            dimension: component.dimension,
            outcome: "MATCH",
            candidateIds: [selectedCandidateId],
          })),
          unmodeledDifferences: [],
          rationale: "Dasselbe fachliche Element ist belegt.",
        };
      }),
    });
    expect(() =>
      preliminaryDecisionArtifact(decisionPlan, withoutFallback)
    ).toThrow("LF_A_DRIVEN_REQUIREMENT_ABSENCE_PRELIMINARY_DECISIONS_INVALID");
  });

  test("selects only fallback rows from a validated mixed preliminary batch", () => {
    const { decisionPlan } = requirementDecisionFixture();
    const mixedBatch = twoRequirementBatch(decisionPlan);
    const payload = JSON.parse(JSON.stringify(decisionPlan));
    delete payload.planSha256;
    payload.rows = mixedBatch.rows;
    payload.batches = [{ ...mixedBatch, batchIndex: 0 }];
    payload.summary.requirements = mixedBatch.rows.length;
    payload.summary.components = mixedBatch.rows.reduce(
      (sum, row) => sum + row.components.length,
      0
    );
    payload.summary.selectedCandidates = mixedBatch.rows.reduce(
      (sum, row) => sum + row.candidates.length,
      0
    );
    payload.summary.batches = 1;
    const plan = {
      ...payload,
      planSha256: digest(
        A_DRIVEN_REQUIREMENT_DECISION_PLAN_CONTRACT_ID,
        payload
      ),
    };
    const found = validRequirementResponse(plan.rows[0]);
    const fallbackRow = plan.rows[1];
    const fallbackCandidateId = fallbackRow.candidates[0].candidateId;
    const fallback = {
      requirementId: fallbackRow.requirementId,
      contextFinding: {
        outcome: "RELATED_ONLY",
        candidateIds: [fallbackCandidateId],
      },
      componentFindings: fallbackRow.components.map((component) => ({
        componentId: component.componentId,
        dimension: component.dimension,
        outcome: "RELATED_ONLY",
        candidateIds: [fallbackCandidateId],
      })),
      unmodeledDifferences: [],
      rationale: "Nur thematische Nähe.",
    };
    const rawResponse = JSON.stringify([found, fallback]);
    const selected = preliminaryRequirementAbsenceDecision(plan, {
      decisionPlanSha256: plan.planSha256,
      validation: { passed: true },
      responses: [found, fallback],
      rawResponse,
      rawResponseSha256: crypto
        .createHash("sha256")
        .update(rawResponse)
        .digest("hex"),
    });

    expect(
      selected.subset.rows.map(({ requirementId }) => requirementId)
    ).toEqual([fallbackRow.requirementId]);
    expect(selected.decisions.summary).toMatchObject({
      terminalRequirements: 1,
      fallbackRequiredRequirements: 1,
      unresolvedRequirements: 0,
    });
  });

  test("certifies NOT_FOUND only after every complete B clause partition is terminal", async () => {
    const { manifest, searchPlan, searchExecution } =
      requirementDecisionFixture();
    const completeCorpus = buildADrivenCompleteBCorpus({
      documents: [
        document(
          "b-doc",
          0,
          artifact(
            [
              "Seite 1\nErste fachfremde Klausel.",
              "Seite 2\nZweite fachfremde Klausel.",
              "Seite 3\nDritte fachfremde Klausel.",
            ],
            "b"
          )
        ),
      ],
    });
    const decisionPlan = buildADrivenRequirementDecisionPlan({
      manifest,
      searchPlan,
      searchExecution,
      completeCorpus,
      maximumCompleteCorpusCandidatesPerDocument: 1,
    });
    const preliminaryResponses = decisionPlan.rows.map((row) => {
      const candidateId = row.candidates[0].candidateId;
      return {
        requirementId: row.requirementId,
        contextFinding: {
          outcome: "RELATED_ONLY",
          candidateIds: [candidateId],
        },
        componentFindings: row.components.map((component) => ({
          componentId: component.componentId,
          dimension: component.dimension,
          outcome: "RELATED_ONLY",
          candidateIds: [candidateId],
        })),
        unmodeledDifferences: [],
        rationale: "Kein Gegenstück in der Navigationsauswahl.",
      };
    });
    const preliminaryDecisions = validateADrivenRequirementDecisionResponses({
      plan: decisionPlan,
      responses: preliminaryResponses,
    });
    const absencePlan = buildADrivenRequirementAbsencePlan({
      decisionPlan,
      preliminaryDecisions,
      completeCorpus,
      maximumPartitionCharacters: 10_000,
    });

    expect(validateADrivenRequirementAbsencePlan(absencePlan)).toBe(true);
    expect(absencePlan.summary).toMatchObject({
      fallbackRequirements: 1,
      documents: 1,
      corpusClauses: completeCorpus.clauses.length,
      plannedClauseReviews: completeCorpus.clauses.length,
      customerNotFoundEligible: false,
    });
    expect(
      new Set(
        absencePlan.partitions.flatMap(({ candidateIds }) => candidateIds)
      ).size
    ).toBe(completeCorpus.clauses.length);

    const negativeResponses = absencePlan.partitions.map((partition) => ({
      partitionId: partition.partitionId,
      decision: "NO_COUNTERPART_IN_PARTITION",
      candidateIds: [],
      rationale: "Kein Gegenstück in dieser vollständigen Partition.",
    }));
    expect(
      validateADrivenRequirementAbsencePartitionResponse({
        plan: absencePlan,
        partitionId: absencePlan.partitions[0].partitionId,
        response: negativeResponses[0],
      }).result
    ).toMatchObject({
      status: "TERMINAL",
      decision: "NO_COUNTERPART_IN_PARTITION",
    });
    const partitionPrompt = requirementAbsencePrompt(
      absencePlan,
      absencePlan.partitions[0]
    );
    expect(partitionPrompt[0].content).toContain(
      "vollständige, servergebundene Partition"
    );
    expect(partitionPrompt[0].content).toContain("genau ein JSON-Objekt");
    expect(partitionPrompt[0].content).toContain("ein leeres Array");
    expect(partitionPrompt[0].content).toContain(
      "ausdrücklich umfassender Oberbegriff"
    );
    expect(partitionPrompt[0].content).toContain(
      "funktional gleiche Vertragswirkung"
    );
    expect(partitionPrompt[0].content).toContain(
      "anderen Gegenstand, Vorgang oder Auslöser"
    );
    expect(partitionPrompt[0].content).toContain(
      "Konstruiere keine ungeschriebene Ausnahme"
    );
    expect(JSON.stringify(partitionPrompt).toLowerCase()).not.toContain("gold");
    const malformed = `${JSON.stringify(negativeResponses[0])}\n${JSON.stringify(
      {
        ...negativeResponses[0],
        decision: "COUNTERPART_PRESENT",
        candidateIds: [absencePlan.partitions[0].candidateIds[0]],
      }
    )}`;
    expect(() => parseRequirementAbsenceDecision(malformed)).toThrow();
    expect(
      requirementAbsencePositiveCandidateSignals({
        rawResponse: malformed,
        plan: absencePlan,
        partition: absencePlan.partitions[0],
      })
    ).toEqual([absencePlan.partitions[0].candidateIds[0]]);
    expect(
      requirementAbsencePositiveCandidateSignals({
        rawResponse: `${JSON.stringify(negativeResponses[0])}\n${JSON.stringify(
          {
            ...negativeResponses[0],
            decision: "COUNTERPART_PRESENT",
            candidateIds: ["UNKNOWN-CANDIDATE"],
          }
        )}`,
        plan: absencePlan,
        partition: absencePlan.partitions[0],
      })
    ).toEqual([]);
    const retryMessages = [];
    const repairedRun = await runRequirementAbsencePartition({
      client: {
        chat: {
          completions: {
            create: jest.fn(async ({ messages }) => {
              retryMessages.push(messages);
              if (retryMessages.length === 1)
                return {
                  model: "qwen/qwen3.6-35b-a3b",
                  choices: [{ message: { content: malformed } }],
                  usage: {},
                };
              const response =
                retryMessages.length === 2
                  ? negativeResponses[0]
                  : {
                      ...negativeResponses[0],
                      decision: "COUNTERPART_PRESENT",
                      candidateIds: [absencePlan.partitions[0].candidateIds[0]],
                    };
              return {
                model: "qwen/qwen3.6-35b-a3b",
                choices: [{ message: { content: JSON.stringify(response) } }],
                usage: {},
              };
            }),
          },
        },
      },
      model: "qwen/qwen3.6-35b-a3b",
      modelContext: 42_496,
      plan: absencePlan,
      partition: absencePlan.partitions[0],
      maximumAttempts: 3,
      requestTimeoutMs: 100,
      abortSettlementTimeoutMs: 10,
      recoverModelAfterAbort: jest.fn(),
    });
    expect(repairedRun.validation.result).toMatchObject({
      status: "TERMINAL",
      decision: "COUNTERPART_PRESENT",
    });
    expect(repairedRun.attempts).toHaveLength(3);
    expect(repairedRun.attempts[0].errorClass).toBe("MODEL_RESPONSE_INVALID");
    expect(repairedRun.attempts[0].positiveCandidateSignals).toEqual([
      absencePlan.partitions[0].candidateIds[0],
    ]);
    expect(repairedRun.attempts[1].errorClass).toBe("POSITIVE_SIGNAL_CONFLICT");
    expect(retryMessages[0]).toHaveLength(2);
    expect(retryMessages[1]).toHaveLength(3);
    expect(retryMessages[2]).toHaveLength(3);
    expect(retryMessages[1].at(-1).content).toContain(
      "genau ein einziges JSON-Objekt"
    );
    expect(retryMessages[1].at(-1).content).toContain(
      "Keine Analyse, Selbstkorrektur"
    );
    expect(retryMessages[1].at(-1).content).toContain(
      absencePlan.partitions[0].candidateIds[0]
    );
    expect(retryMessages[2].at(-1).content).toContain(
      "nicht zur Abwesenheitszertifizierung"
    );
    const confirmedNegativeRun = await runRequirementAbsencePartition({
      client: {
        chat: {
          completions: {
            create: jest
              .fn()
              .mockResolvedValueOnce({
                model: "qwen/qwen3.6-35b-a3b",
                choices: [{ message: { content: malformed } }],
                usage: {},
              })
              .mockResolvedValue({
                model: "qwen/qwen3.6-35b-a3b",
                choices: [
                  {
                    message: {
                      content: JSON.stringify(negativeResponses[0]),
                    },
                  },
                ],
                usage: {},
              }),
          },
        },
      },
      model: "qwen/qwen3.6-35b-a3b",
      modelContext: 42_496,
      plan: absencePlan,
      partition: absencePlan.partitions[0],
      maximumAttempts: 3,
      requestTimeoutMs: 100,
      abortSettlementTimeoutMs: 10,
      recoverModelAfterAbort: jest.fn(),
    });
    expect(confirmedNegativeRun.validation.result).toMatchObject({
      status: "TERMINAL",
      decision: "NO_COUNTERPART_IN_PARTITION",
    });
    expect(
      confirmedNegativeRun.attempts.map(({ errorClass }) => errorClass)
    ).toEqual(["MODEL_RESPONSE_INVALID", "POSITIVE_SIGNAL_CONFLICT", null]);
    expect(
      parseRequirementAbsenceDecision(JSON.stringify(negativeResponses[0]))
    ).toEqual(negativeResponses[0]);
    expect(
      parseRequirementAbsenceDecision(JSON.stringify([negativeResponses[0]]))
    ).toEqual(negativeResponses[0]);
    expect(() => parseRequirementAbsenceDecision("[]")).toThrow(
      "LF_A_DRIVEN_REQUIREMENT_ABSENCE_RESPONSE_COUNT_INVALID"
    );
    const partitionRun = await runRequirementAbsencePartition({
      client: {
        chat: {
          completions: {
            create: jest.fn(async () => ({
              model: "qwen/qwen3.6-35b-a3b",
              choices: [
                {
                  message: {
                    content: JSON.stringify(negativeResponses[0]),
                  },
                },
              ],
              usage: {},
            })),
          },
        },
      },
      model: "qwen/qwen3.6-35b-a3b",
      modelContext: 42_496,
      plan: absencePlan,
      partition: absencePlan.partitions[0],
      maximumAttempts: 1,
      requestTimeoutMs: 100,
      abortSettlementTimeoutMs: 10,
      recoverModelAfterAbort: jest.fn(),
    });
    expect(partitionRun.validation.result).toMatchObject({
      status: "TERMINAL",
      decision: "NO_COUNTERPART_IN_PARTITION",
    });
    const certified = validateADrivenRequirementAbsenceResponses({
      plan: absencePlan,
      responses: negativeResponses,
    });
    const seedSummary = {
      contractId: "LF_A_DRIVEN_REQUIREMENT_ABSENCE_RUN_V1",
      absencePlanSha256: absencePlan.planSha256,
      absenceDecisionSha256: certified.decisionSha256,
      model: {
        id: "qwen/qwen3.6-35b-a3b",
        loadedContextLength: 42_496,
      },
      promptContractId: "LF_A_DRIVEN_REQUIREMENT_ABSENCE_PROMPT_V4",
      unresolved: 0,
      terminalPartitions: absencePlan.partitions.length,
      plannedPartitions: absencePlan.partitions.length,
    };
    const seeded = compatibleSeedPartitionResponses({
      seedPlan: absencePlan,
      seedDecisions: certified,
      seedSummary,
      plan: absencePlan,
      model: "qwen/qwen3.6-35b-a3b",
      modelContext: 42_496,
      requestTimeoutMs: 180_000,
      abortSettlementTimeoutMs: 15_000,
    });
    expect(seeded.size).toBe(absencePlan.partitions.length);
    expect(seeded.get(absencePlan.partitions[0].partitionId)).toMatchObject({
      absencePlanSha256: absencePlan.planSha256,
      attempts: [],
      reuse: {
        contractId: "LF_A_DRIVEN_REQUIREMENT_ABSENCE_VALIDATED_SEED_V1",
        sourceAbsenceDecisionSha256: certified.decisionSha256,
      },
      validation: { result: { status: "TERMINAL" } },
    });
    const { planSha256: _planSha256, ...changedPayload } = JSON.parse(
      JSON.stringify(absencePlan)
    );
    changedPayload.requirements[0].displayLabel += " verändert";
    const changedPlan = {
      ...changedPayload,
      planSha256: digest(
        A_DRIVEN_REQUIREMENT_ABSENCE_PLAN_CONTRACT_ID,
        changedPayload
      ),
    };
    expect(
      compatibleSeedPartitionResponses({
        seedPlan: absencePlan,
        seedDecisions: certified,
        seedSummary,
        plan: changedPlan,
        model: "qwen/qwen3.6-35b-a3b",
        modelContext: 42_496,
        requestTimeoutMs: 180_000,
        abortSettlementTimeoutMs: 15_000,
      }).size
    ).toBe(0);
    expect(() =>
      compatibleSeedPartitionResponses({
        seedPlan: absencePlan,
        seedDecisions: certified,
        seedSummary: { ...seedSummary, absenceDecisionSha256: "0".repeat(64) },
        plan: absencePlan,
        model: "qwen/qwen3.6-35b-a3b",
        modelContext: 42_496,
        requestTimeoutMs: 180_000,
        abortSettlementTimeoutMs: 15_000,
      })
    ).toThrow("LF_A_DRIVEN_REQUIREMENT_ABSENCE_SEED_INVALID");
    expect(() =>
      compatibleSeedPartitionResponses({
        seedPlan: absencePlan,
        seedDecisions: certified,
        seedSummary: {
          ...seedSummary,
          promptContractId: "LF_A_DRIVEN_REQUIREMENT_ABSENCE_PROMPT_V3",
        },
        plan: absencePlan,
        model: "qwen/qwen3.6-35b-a3b",
        modelContext: 42_496,
        requestTimeoutMs: 180_000,
        abortSettlementTimeoutMs: 15_000,
      })
    ).toThrow("LF_A_DRIVEN_REQUIREMENT_ABSENCE_SEED_INVALID");
    expect(certified.summary).toMatchObject({
      requirements: 1,
      terminalNotFound: 1,
      counterpartReviewRequired: 0,
      unresolved: 0,
      terminalPartitions: absencePlan.partitions.length,
      customerNotFoundEligible: true,
    });
    expect(certified.results[0]).toMatchObject({
      status: "TERMINAL",
      customerStatus: "NOT_FOUND",
      absenceCertified: true,
      reviewedDocuments: 1,
      reviewedClauses: completeCorpus.clauses.length,
    });
    const finalCertified = buildADrivenRequirementFinalDecisions({
      decisionPlan,
      preliminaryDecisions,
      absencePlan,
      absenceDecisions: certified,
    });
    expect(finalCertified.summary).toMatchObject({
      plannedRequirements: 1,
      terminalRequirements: 1,
      unresolvedRequirements: 0,
      foundRequirements: 0,
      notFoundRequirements: 1,
      absenceCertifiedRequirements: 1,
      completeCorpusAbsences: 1,
      rescueCounterparts: 0,
      rescueAbsences: 0,
      binaryCustomerStatus: true,
      sideBOnlyRows: 0,
    });
    expect(finalCertified.results[0]).toMatchObject({
      customerFound: false,
      customerStatus: "NOT_FOUND",
      absenceCertified: true,
      resolutionPath: "COMPLETE_CORPUS_ABSENCE",
      counterpartEvidence: [],
    });
    expect(
      validateADrivenRequirementFinalDecisionArtifact(finalCertified, {
        decisionPlan,
        preliminaryDecisions,
        absencePlan,
        absenceDecisions: certified,
      })
    ).toBe(finalCertified);
    const binaryCertified = buildADrivenRequirementBinaryReferenceResult({
      manifest,
      decisionPlan,
      preliminaryDecisions,
      absencePlan,
      absenceDecisions: certified,
      finalDecisions: finalCertified,
    });
    expect(binaryCertified.summary).toMatchObject({
      rows: 1,
      found: 0,
      notFound: 1,
      unresolved: 0,
      sideBOnlyRows: 0,
      binaryCustomerStatus: true,
    });
    expect(binaryCertified.rows[0]).toMatchObject({
      requirementId: decisionPlan.rows[0].requirementId,
      customerStatus: "NOT_FOUND",
      customerStatusLabel: "Nicht gefunden",
      counterpartOutcome: "NO_COUNTERPART_ESTABLISHED",
      bEvidence: [],
      bCounterparts: [],
      manualAssessment: "",
      resolutionPath: "COMPLETE_CORPUS_ABSENCE",
    });
    expect(reviewWorkbookRows(binaryCertified)[0]).toMatchObject({
      7: "",
      9: "",
      10: "Nicht gefunden",
      12: "",
    });
    expect(
      validateADrivenRequirementBinaryReferenceResult(binaryCertified, {
        manifest,
        decisionPlan,
        preliminaryDecisions,
        absencePlan,
        absenceDecisions: certified,
        finalDecisions: finalCertified,
      })
    ).toBe(binaryCertified);

    const semanticallyTamperedPreliminary = JSON.parse(
      JSON.stringify(preliminaryDecisions)
    );
    semanticallyTamperedPreliminary.results[0].customerFound = true;
    semanticallyTamperedPreliminary.results[0].customerStatus = "FOUND";
    semanticallyTamperedPreliminary.results[0].counterpartOutcome =
      "FULL_COUNTERPART";
    delete semanticallyTamperedPreliminary.decisionSha256;
    semanticallyTamperedPreliminary.decisionSha256 = digest(
      A_DRIVEN_REQUIREMENT_DECISION_CONTRACT_ID,
      semanticallyTamperedPreliminary
    );
    expect(() =>
      validateADrivenRequirementDecisionArtifact(
        semanticallyTamperedPreliminary,
        decisionPlan
      )
    ).toThrow("LF_A_DRIVEN_REQUIREMENT_DECISION_ARTIFACT_MISMATCH");

    const preliminaryCandidateId =
      decisionPlan.rows[0].candidates[0].candidateId;
    const preliminaryFound = validateADrivenRequirementDecisionResponses({
      plan: decisionPlan,
      responses: [
        {
          requirementId: decisionPlan.rows[0].requirementId,
          contextFinding: {
            outcome: "MATCH",
            candidateIds: [preliminaryCandidateId],
          },
          componentFindings: decisionPlan.rows[0].components.map(
            ({ componentId, dimension }) => ({
              componentId,
              dimension,
              outcome: "MATCH",
              candidateIds: [preliminaryCandidateId],
            })
          ),
          unmodeledDifferences: [],
          rationale: "Das Gegenstück ist bereits im ersten Suchlauf belegt.",
        },
      ],
    });
    const emptyAbsencePlan = buildADrivenRequirementAbsencePlan({
      decisionPlan,
      preliminaryDecisions: preliminaryFound,
      completeCorpus,
      maximumPartitionCharacters: 10_000,
    });
    const emptyAbsenceDecisions = validateADrivenRequirementAbsenceResponses({
      plan: emptyAbsencePlan,
      responses: [],
    });
    const finalPreliminaryFound = buildADrivenRequirementFinalDecisions({
      decisionPlan,
      preliminaryDecisions: preliminaryFound,
      absencePlan: emptyAbsencePlan,
      absenceDecisions: emptyAbsenceDecisions,
    });
    expect(finalPreliminaryFound.summary).toMatchObject({
      foundRequirements: 1,
      notFoundRequirements: 0,
      preliminaryCounterparts: 1,
      completeCorpusAbsences: 0,
    });
    expect(finalPreliminaryFound.results[0]).toMatchObject({
      customerStatus: "FOUND",
      resolutionPath: "PRELIMINARY_COUNTERPART",
      absenceReview: null,
    });

    const incomplete = validateADrivenRequirementAbsenceResponses({
      plan: absencePlan,
      responses: negativeResponses.slice(1),
    });
    expect(incomplete.results[0]).toMatchObject({
      status: "UNRESOLVED",
      customerStatus: "FALLBACK_REQUIRED",
      absenceCertified: false,
    });
    expect(incomplete.summary.customerNotFoundEligible).toBe(false);

    const positiveResponses = JSON.parse(JSON.stringify(negativeResponses));
    positiveResponses[0] = {
      partitionId: absencePlan.partitions[0].partitionId,
      decision: "COUNTERPART_PRESENT",
      candidateIds: [absencePlan.partitions[0].candidateIds[0]],
      rationale: "Ein möglicher fachlicher Gegenstückkandidat ist vorhanden.",
    };
    const candidateFound = validateADrivenRequirementAbsenceResponses({
      plan: absencePlan,
      responses: positiveResponses,
    });
    expect(candidateFound.results[0]).toMatchObject({
      status: "COUNTERPART_REVIEW_REQUIRED",
      customerStatus: "FALLBACK_REQUIRED",
      absenceCertified: false,
      reasonCode: "FULL_CORPUS_COUNTERPART_CANDIDATE_FOUND",
    });
    expect(candidateFound.results[0].bEvidence).toHaveLength(1);
    expect(
      validateADrivenRequirementAbsenceDecisionArtifact(
        candidateFound,
        absencePlan,
        { requireComplete: true }
      )
    ).toBe(candidateFound);

    const rescuePlan = buildADrivenRequirementRescueReviewPlan({
      decisionPlan,
      preliminaryDecisions,
      absencePlan,
      absenceDecisions: candidateFound,
      completeCorpus,
      maximumRequirementsPerBatch: 1,
    });
    expect(rescuePlan.summary).toMatchObject({
      requirements: 1,
      components: decisionPlan.rows[0].components.length,
      fullCorpusReviewCandidates: 1,
      batches: 1,
    });
    expect(rescuePlan.selection).toMatchObject({
      strategy: "FULL_CORPUS_POSITIVE_CANDIDATE_REVIEW",
      sourceDecisionPlanSha256: decisionPlan.planSha256,
      preliminaryDecisionSha256: preliminaryDecisions.decisionSha256,
      absencePlanSha256: absencePlan.planSha256,
      absenceDecisionSha256: candidateFound.decisionSha256,
      characterClippingAllowed: false,
      goldInputsAllowed: false,
    });
    const rescueRow = rescuePlan.rows[0];
    expect(rescueRow.searchCoverage.fullCorpusReviewCandidateIds).toHaveLength(
      1
    );
    const rescueCandidateId =
      rescueRow.searchCoverage.fullCorpusReviewCandidateIds[0];
    expect(
      rescueRow.components.every(({ navigationCandidateIds }) =>
        navigationCandidateIds.includes(rescueCandidateId)
      )
    ).toBe(true);
    expect(
      rescueRow.candidates.find(
        ({ candidateId }) => candidateId === rescueCandidateId
      )
    ).toMatchObject({
      documentUuid: absencePlan.candidates[0].documentUuid,
      exactTextSha256: absencePlan.candidates[0].exactTextSha256,
    });
    const rescueRun = await runRequirementDecisionBatch({
      client: {
        chat: {
          completions: {
            create: jest.fn(async () => ({
              model: "qwen/qwen3.6-35b-a3b",
              choices: [
                {
                  message: {
                    content: JSON.stringify([
                      {
                        requirementId: rescueRow.requirementId,
                        contextFinding: {
                          outcome: "MATCH",
                          candidateIds: [rescueCandidateId],
                        },
                        componentFindings: rescueRow.components.map(
                          ({ componentId, dimension }) => ({
                            componentId,
                            dimension,
                            outcome: "MATCH",
                            candidateIds: [rescueCandidateId],
                          })
                        ),
                        unmodeledDifferences: [],
                        rationale:
                          "Der Vollkorpuskandidat belegt denselben fachlichen Kern.",
                      },
                    ]),
                  },
                },
              ],
              usage: {},
            })),
          },
        },
      },
      model: "qwen/qwen3.6-35b-a3b",
      modelContext: 42_496,
      plan: rescuePlan,
      batch: rescuePlan.batches[0],
      maximumAttempts: 1,
      requestTimeoutMs: 100,
      abortSettlementTimeoutMs: 10,
      recoverModelAfterAbort: jest.fn(),
    });
    expect(rescueRun.validation.passed).toBe(true);
    const rescueDecisions = validateADrivenRequirementDecisionResponses({
      plan: rescuePlan,
      responses: rescueRun.responses,
    });
    const finalFound = buildADrivenRequirementFinalDecisions({
      decisionPlan,
      preliminaryDecisions,
      absencePlan,
      absenceDecisions: candidateFound,
      rescuePlan,
      rescueDecisions,
    });
    expect(finalFound.summary).toMatchObject({
      foundRequirements: 1,
      notFoundRequirements: 0,
      rescueCounterparts: 1,
      rescueAbsences: 0,
    });
    expect(finalFound.results[0]).toMatchObject({
      customerFound: true,
      customerStatus: "FOUND",
      counterpartOutcome: "FULL_COUNTERPART",
      absenceCertified: false,
      resolutionPath: "FULL_CORPUS_RESCUE_COUNTERPART",
    });
    expect(finalFound.results[0].counterpartEvidence).toHaveLength(1);
    const binaryFound = buildADrivenRequirementBinaryReferenceResult({
      manifest,
      decisionPlan,
      preliminaryDecisions,
      absencePlan,
      absenceDecisions: candidateFound,
      rescuePlan,
      rescueDecisions,
      finalDecisions: finalFound,
    });
    expect(binaryFound.summary).toMatchObject({
      rows: 1,
      found: 1,
      notFound: 0,
      unresolved: 0,
      sideBOnlyRows: 0,
      binaryCustomerStatus: true,
    });
    expect(binaryFound.rows[0]).toMatchObject({
      customerStatus: "FOUND",
      customerStatusLabel: "Gefunden",
      counterpartOutcome: "FULL_COUNTERPART",
      resolutionPath: "FULL_CORPUS_RESCUE_COUNTERPART",
      manualAssessment: "",
    });
    expect(binaryFound.rows[0].bCounterparts).toHaveLength(1);
    expect(binaryFound.rows[0].componentFindings).toHaveLength(
      manifest.summary.semanticComponents
    );
    const productDocuments = [
      ...manifest.documents.map((document) => ({
        uuid: document.documentUuid,
        side: "A",
        position: document.documentPosition,
        role: document.documentRole,
        documentStatus: document.documentStatus,
        originalName: "Referenz A.pdf",
        sha256: document.documentSha256,
      })),
      {
        uuid: binaryFound.rows[0].bCounterparts[0].documentUuid,
        side: "B",
        position: 0,
        role: "MAIN_POLICY",
        documentStatus: "ACTIVE",
        originalName: "Vergleich B.pdf",
        sha256: "b".repeat(64),
      },
    ];
    const productInputs = {
      binaryResult: binaryFound,
      manifest,
      lineageInputs: {
        manifest,
        decisionPlan,
        preliminaryDecisions,
        absencePlan,
        absenceDecisions: candidateFound,
        rescuePlan,
        rescueDecisions,
        finalDecisions: finalFound,
      },
      documents: productDocuments,
      metadata: {
        generatedAt: "2026-09-14T00:00:00.000Z",
        sessionUuid: "session",
        runSignature: "signature",
      },
    };
    const productResult = buildADrivenReferenceProductResult(productInputs);
    expect(productResult).toMatchObject({
      contractId: "LF_A_DRIVEN_REFERENCE_A_TO_B_RESULT_V1",
      comparisonMode: "LF_IMMO_REFERENCE_A_TO_B_V1",
      customerPresentationContractId: "LF_REFERENCE_CUSTOMER_PRESENTATION_V1",
      productProfile: {
        id: "LF_REFERENCE_A_DRIVEN_V2",
        discoversTopologyFromSourceA: true,
        supportsMultipleSourceDocuments: true,
        goldDefinesProductionRows: false,
      },
      template: {
        semanticRequirements: 1,
        incompleteSearchRequirements: 0,
      },
      totals: {
        rows: 1,
        found: 1,
        notFound: 0,
        unresolved: 0,
        sideBOnlyRows: 0,
      },
    });
    expect(productResult.categories).toHaveLength(1);
    expect(productResult.categories[0].rows[0]).toMatchObject({
      categoryId: binaryFound.rows[0].requirementId,
      packageB: {
        coverage: "Fachliches Gegenstück vorhanden",
        contributors: [
          expect.objectContaining({
            documentUuid: binaryFound.rows[0].bCounterparts[0].documentUuid,
          }),
        ],
      },
    });
    expect(
      validateADrivenReferenceProductResult(productResult, productInputs)
    ).toBe(productResult);
    const customerResult = presentReferenceCustomerResult(productResult);
    expect(customerResult).toMatchObject({
      contractId: "LF_REFERENCE_CUSTOMER_PRESENTATION_V1",
      totals: {
        rows: 1,
        sideBOnlyRows: 0,
        customerSearchStatuses: { GEFUNDEN: 1, NICHT_GEFUNDEN: 0 },
      },
    });
    expect(customerResult.categories[0].rows[0]).toMatchObject({
      customerSearchStatus: "GEFUNDEN",
      customerSearchStatusLabel: "Gefunden",
    });
    expect(customerResult.categories[0].rows[0]).not.toHaveProperty(
      "pointDecision"
    );
    const tamperedProductResult = JSON.parse(JSON.stringify(productResult));
    tamperedProductResult.categories[0].rows[0].packageB.documentedContent =
      "Manipuliert";
    expect(() =>
      validateADrivenReferenceProductResult(
        tamperedProductResult,
        productInputs
      )
    ).toThrow("LF_A_DRIVEN_PRODUCT_RESULT_DIGEST_INVALID");
    const productArtifactRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "lf-a-driven-product-artifacts-")
    );
    const productArtifactDirectory = path.join(productArtifactRoot, "result");
    const productArtifacts = await writeADrivenReferenceProductArtifacts({
      ...productInputs,
      outputDirectory: productArtifactDirectory,
    });
    expect(productArtifacts.result.resultSha256).toBe(
      productResult.resultSha256
    );
    expect(
      validatePublishedComparisonArtifactSet(productArtifactDirectory)
    ).toMatchObject({
      outputDirectory: productArtifactDirectory,
      reused: true,
    });
    expect(
      readValidatedComparisonResult(
        productArtifacts.jsonFile,
        POLICY_COMPARISON_MODE.LF_REFERENCE_A_TO_B
      )
    ).toEqual(productResult);
    expect(fs.statSync(productArtifacts.workbookFile).mode & 0o777).toBe(0o600);
    const workbookRows = reviewWorkbookRows(binaryFound);
    expect(workbookRows).toHaveLength(1);
    expect(workbookRows[0][10]).toBe("Gefunden");
    expect(workbookRows[0][12]).toBe("");
    const workbookDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), "lf-a-driven-review-workbook-")
    );
    const workbookFile = path.join(workbookDirectory, "review.xlsx");
    const workbookSummary = await writeADrivenRequirementReviewWorkbook(
      binaryFound,
      workbookFile
    );
    expect(workbookSummary).toMatchObject({
      rows: 1,
      found: 1,
      notFound: 0,
      file: workbookFile,
      formulaCells: 0,
      sheets: 1,
    });
    expect(fs.statSync(workbookFile).mode & 0o777).toBe(0o600);
    const workbookHash = crypto
      .createHash("sha256")
      .update(fs.readFileSync(workbookFile))
      .digest("hex");
    await writeADrivenRequirementReviewWorkbook(binaryFound, workbookFile);
    expect(
      crypto
        .createHash("sha256")
        .update(fs.readFileSync(workbookFile))
        .digest("hex")
    ).toBe(workbookHash);

    const rescueNegativeResponse = {
      requirementId: rescueRow.requirementId,
      contextFinding: {
        outcome: "RELATED_ONLY",
        candidateIds: [rescueCandidateId],
      },
      componentFindings: rescueRow.components.map(
        ({ componentId, dimension }) => ({
          componentId,
          dimension,
          outcome: "RELATED_ONLY",
          candidateIds: [rescueCandidateId],
        })
      ),
      unmodeledDifferences: [],
      rationale:
        "Der Vollkorpuskandidat ist geprüft, aber kein fachliches Gegenstück.",
    };
    const rescueNegativeDecisions = validateADrivenRequirementDecisionResponses(
      {
        plan: rescuePlan,
        responses: [rescueNegativeResponse],
      }
    );
    const finalRescueAbsence = buildADrivenRequirementFinalDecisions({
      decisionPlan,
      preliminaryDecisions,
      absencePlan,
      absenceDecisions: candidateFound,
      rescuePlan,
      rescueDecisions: rescueNegativeDecisions,
    });
    expect(finalRescueAbsence.summary).toMatchObject({
      foundRequirements: 0,
      notFoundRequirements: 1,
      rescueCounterparts: 0,
      rescueAbsences: 1,
      absenceCertifiedRequirements: 1,
    });
    expect(finalRescueAbsence.results[0]).toMatchObject({
      customerFound: false,
      customerStatus: "NOT_FOUND",
      absenceCertified: true,
      resolutionPath: "FULL_CORPUS_RESCUE_ABSENCE",
      counterpartEvidence: [],
    });
    expect(finalRescueAbsence.results[0].assessment.bEvidence).toHaveLength(1);

    const incompleteRescuePlan = JSON.parse(JSON.stringify(rescuePlan));
    incompleteRescuePlan.rows[0].searchCoverage.fullCorpusReviewCandidateIds =
      [];
    delete incompleteRescuePlan.planSha256;
    incompleteRescuePlan.planSha256 = digest(
      A_DRIVEN_REQUIREMENT_DECISION_PLAN_CONTRACT_ID,
      incompleteRescuePlan
    );
    const incompleteRescueDecisions =
      validateADrivenRequirementDecisionResponses({
        plan: incompleteRescuePlan,
        responses: [rescueNegativeResponse],
      });
    expect(() =>
      buildADrivenRequirementFinalDecisions({
        decisionPlan,
        preliminaryDecisions,
        absencePlan,
        absenceDecisions: candidateFound,
        rescuePlan: incompleteRescuePlan,
        rescueDecisions: incompleteRescueDecisions,
      })
    ).toThrow("LF_A_DRIVEN_REQUIREMENT_FINAL_RESCUE_SOURCE_COVERAGE_INVALID");
    expect(() =>
      buildADrivenRequirementRescueReviewPlan({
        decisionPlan,
        preliminaryDecisions,
        absencePlan,
        absenceDecisions: {
          ...candidateFound,
          decisionSha256: "0".repeat(64),
        },
        completeCorpus,
      })
    ).toThrow("LF_A_DRIVEN_REQUIREMENT_ABSENCE_DECISION_ARTIFACT_MISMATCH");
  });
});

describe("LF_REFERENCE_A_DRIVEN_V2 Gold regression boundary", () => {
  function syntheticGold(manifest) {
    const requirement = manifest.requirements[0];
    const component = requirement.components[0];
    return {
      contractId: "LF_1PLUS9_GOLD_283_V1",
      status: "FROZEN_SOURCE_BOUND_GOLD_FOR_KNOWN_LF_1PLUS9_283_ROWS",
      goldAuthority: true,
      qaOnly: true,
      productionRule: false,
      releaseApproval: false,
      generalizationProof: false,
      goldSha256: "9".repeat(64),
      summary: { rows: 1 },
      rows: [
        {
          analysisRowId: "LR01-001",
          requirementId: "KNOWN-01",
          referenceA: {
            sourceSpans: [{ blockIds: requirement.sourceBlockIds }],
          },
          components: [
            {
              componentId: "known-component",
              factRole:
                component.type === "OBJECT" ? "INSURED_OBJECT" : "BENEFIT",
            },
          ],
          goldDecision: {
            customerFound: true,
            outcome: "FULL_COUNTERPART",
            sources: [],
          },
        },
      ],
    };
  }

  test("keeps frozen Gold as a QA-only source-overlap denominator", () => {
    const manifest = searchEligibleManifest();
    const gold = syntheticGold(manifest);
    const regression = buildADrivenGoldRegression({
      manifest,
      gold,
      expectedGoldSha256: gold.goldSha256,
    });

    expect(regression).toMatchObject({
      qaOnly: true,
      productionRule: false,
      generalizationProof: false,
      dynamicResultSha256: null,
      crosswalk: {
        summary: {
          legacyRequirements: 1,
          legacyRequirementsSourceCovered: 1,
          legacyRequirementsMissing: 0,
          measurementEligibleRequirements: 1,
          ambiguousMeasurementRequirements: 0,
          legacyComponents: 1,
          legacyComponentsRoleCovered: 1,
        },
      },
      resultRegression: null,
    });
  });

  test("measures the requirement-level V6 binary result without changing Gold", () => {
    const manifest = searchEligibleManifest();
    const gold = syntheticGold(manifest);
    const evidenceText =
      "Dasselbe fachliche Gegenstück ist in Paket B quellengebunden belegt.";
    const evidenceHash = crypto
      .createHash("sha256")
      .update(evidenceText)
      .digest("hex");
    gold.rows[0].goldDecision.sources = [
      {
        referenceId: "gold-source",
        file: "Vergleich B.pdf",
        location: "Seite 1",
        exactText: evidenceText,
        exactTextSha256: evidenceHash,
      },
    ];
    const payload = {
      schemaVersion: 1,
      contractId: A_DRIVEN_REQUIREMENT_BINARY_RESULT_CONTRACT_ID,
      runContractId: "LF_REFERENCE_A_DRIVEN_V2",
      dynamicManifestSha256: manifest.manifestSha256,
      requirementDecisionPlanSha256: "1".repeat(64),
      finalRequirementDecisionSha256: "2".repeat(64),
      documents: manifest.documents,
      rows: manifest.requirements.map((requirement) => ({
        requirementId: requirement.requirementId,
        customerStatus: "FOUND",
        bEvidence: [
          {
            documentUuid: "document-b",
            originalName: "Vergleich B.pdf",
            physicalPageNumber: 1,
            exactText: evidenceText,
            exactTextSha256: evidenceHash,
          },
        ],
      })),
      summary: {
        rows: manifest.requirements.length,
        found: manifest.requirements.length,
        notFound: 0,
        unresolved: 0,
        sideBOnlyRows: 0,
        binaryCustomerStatus: true,
      },
      proofLimit: "QA-Test",
    };
    const result = {
      ...payload,
      resultSha256: digest(
        A_DRIVEN_REQUIREMENT_BINARY_RESULT_CONTRACT_ID,
        payload
      ),
    };
    const regression = buildADrivenGoldRegression({
      manifest,
      gold,
      expectedGoldSha256: gold.goldSha256,
      result,
    });

    expect(regression.dynamicResultSha256).toBe(result.resultSha256);
    expect(regression.resultRegression.summary).toMatchObject({
      measurementEligibleRows: 1,
      resolved: 1,
      binaryMatches: 1,
      binaryMismatches: 0,
      boundGoldSources: 1,
      sameFileGoldSources: 1,
      sameFileAndPageGoldSources: 1,
    });
    expect(gold.productionRule).toBe(false);
    expect(gold.qaOnly).toBe(true);
  });

  test("does not score rows whose shared A block creates an ambiguous Gold mapping", () => {
    const manifest = searchEligibleManifest();
    const gold = syntheticGold(manifest);
    gold.summary.rows = 2;
    gold.rows.push({
      ...JSON.parse(JSON.stringify(gold.rows[0])),
      analysisRowId: "LR01-002",
      requirementId: "KNOWN-02",
      components: [
        {
          componentId: "known-component-two",
          factRole: gold.rows[0].components[0].factRole,
        },
      ],
    });

    const regression = buildADrivenGoldRegression({
      manifest,
      gold,
      expectedGoldSha256: gold.goldSha256,
    });

    expect(regression.crosswalk.summary).toMatchObject({
      legacyRequirements: 2,
      measurementEligibleRequirements: 0,
      ambiguousMeasurementRequirements: 2,
      mergedDynamicRequirements: 1,
    });
    expect(regression.crosswalk.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          measurementEligible: false,
          measurementEligibility: "MERGED_OR_SHARED_SOURCE_CONTEXT",
        }),
      ])
    );
  });

  test("rejects a different Gold identity before evaluation", () => {
    const manifest = searchEligibleManifest();
    const gold = syntheticGold(manifest);

    expect(() =>
      buildADrivenGoldRegression({
        manifest,
        gold,
        expectedGoldSha256: "8".repeat(64),
      })
    ).toThrow("LF_A_DRIVEN_GOLD_INPUT_INVALID");
  });

  test("binds frozen Gold sources to retrieval by document fingerprint", () => {
    const manifest = searchEligibleManifest();
    const searchPlan = buildADrivenCounterpartSearchPlan({
      manifest,
      documents: [{ uuid: "b-doc", position: 0, sha256: "b".repeat(64) }],
    });
    const exactText = "Gebäude und Nebengebäude sind versichert.";
    const exactTextSha256 = crypto
      .createHash("sha256")
      .update(exactText)
      .digest("hex");
    const retrievalText = "Allgemeine Hinweise zur Sachversicherung.";
    const retrievalTextSha256 = crypto
      .createHash("sha256")
      .update(retrievalText)
      .digest("hex");
    const completeCorpus = buildADrivenCompleteBCorpus({
      documents: [
        {
          document: {
            uuid: "b-doc",
            position: 0,
            sha256: "b".repeat(64),
            role: "TERMS",
            documentStatus: "FRAMEWORK_TERMS",
            originalName: "known-b.pdf",
          },
          artifact: artifact([`${exactText}\n`], "b"),
        },
      ],
    });
    const retrieval = retrievalArtifact(
      searchPlan,
      searchPlan.packages.map((item) => ({
        packageId: item.packageId,
        completedChannels: [...REQUIRED_SEARCH_CHANNELS],
        candidates: [
          {
            compactCandidateId: `candidate-${item.packageId}`,
            documentUuid: "b-doc",
            documentSha256: "b".repeat(64),
            clauseBoundaryId: "clause-one",
            channels: ["DINGHY", "LEXICAL_BM25"],
            sourceSpans: [
              {
                candidateId: `source-${item.packageId}`,
                exactText: retrievalText,
                exactTextSha256: retrievalTextSha256,
                physicalPageNumber: 1,
                documentStart: 0,
                documentEnd: retrievalText.length,
                channels: ["DINGHY", "LEXICAL_BM25"],
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
    const gold = syntheticGold(manifest);
    gold.sourceDocuments = [
      {
        uuid: "historical-uuid",
        fingerprint: "b".repeat(64),
        originalName: "known-b.docx",
        role: "TERMS",
        documentStatus: "FRAMEWORK_TERMS",
      },
    ];
    gold.adjudicationScope = {
      explicitlyAdjudicatedRows: [],
      automaticallyAcceptedRows: ["KNOWN-01"],
    };
    gold.rows[0].goldDecision.sources = [
      {
        referenceId: "R1",
        file: "known-b.pdf",
        exactText,
        exactTextSha256,
      },
    ];

    const regression = buildADrivenRequirementPlanGoldRegression({
      manifest,
      gold,
      expectedGoldSha256: gold.goldSha256,
      searchPlan,
      searchExecution,
      completeCorpus,
    });

    expect(regression).toMatchObject({
      qaOnly: true,
      productionRule: false,
      generalizationProof: false,
      summary: {
        rows: 1,
        positiveRows: 1,
        goldSources: 1,
        retrievalCorpusBoundGoldSources: 0,
        completeBCorpusBoundGoldSources: 1,
        fullRetrievalBoundGoldSources: 0,
        selectedBoundGoldSources: 1,
        positiveRowsWithAllSourcesRetrieved: 0,
        positiveRowsWithAllSourcesInCompleteCorpus: 1,
        positiveRowsWithAllSourcesSelected: 1,
        scopes: {
          AUTOMATIC_207: {
            rows: 1,
            positiveRows: 1,
            positiveRowsFullyRetrieved: 0,
            positiveRowsFullyInCompleteCorpus: 1,
            positiveRowsFullySelected: 1,
          },
        },
      },
    });
    expect(regression.records[0].sourceBindings[0]).toMatchObject({
      status: "SELECTED_BOUND",
      documentUuid: "b-doc",
      documentPosition: 0,
    });
  });
});

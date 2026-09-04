jest.mock(
  "../../../utils/policyAnalysis/targetedCategoryMaterializationContract",
  () => ({
    assertTargetedCategoryMaterializationInputs: jest.fn(),
  })
);

const {
  materializeCandidateTriage,
} = require("../../../utils/policyAnalysis/candidateTriageContract");
const {
  buildControlledOccurrenceWorksheet,
} = require("../../../utils/policyAnalysis/controlledOccurrenceWorksheet");
const {
  DOCUMENT_STATUS,
  buildDeterministicPreparedEvidenceJudgement,
  buildPreparedEvidenceTargets,
  materializePreparedEvidence,
  parseAndValidatePreparedEvidenceResponse,
} = require("../../../utils/policyAnalysis/preparedEvidenceContract");
const {
  selectTargetRequirements,
} = require("../../../utils/policyAnalysis/targetRequirementSelection");
const {
  assertTargetedCategoryMaterializationInputs,
} = require("../../../utils/policyAnalysis/targetedCategoryMaterializationContract");
const {
  TARGETED_CATEGORY_RESULT_CONTRACT_ID,
  materializeTargetedCategoryResult,
  replayModelPreparedEvidenceJudgement,
} = require("../../../utils/policyAnalysis/targetedCategoryResultContract");
const {
  rebuildTargetedSelectedSources,
} = require("../../../utils/policyAnalysis/targetedSelectedSourcesContract");

function raw(value) {
  return Buffer.from(JSON.stringify(value, null, 2));
}

function rewrite(bytes, mutate) {
  const value = JSON.parse(bytes.toString("utf8"));
  mutate(value);
  return raw(value);
}

function fixture() {
  const pageContent = "Sturm ist versichert.";
  const fingerprint = "b".repeat(64);
  const documentArtifact = {
    schemaVersion: 1,
    fingerprint,
    document: {
      id: "targeted-result-document",
      sourceDocumentId: fingerprint,
      title: "targeted-result.pdf",
      documentType: "pdf",
      pageContent,
      pageMap: [{ pageNumber: 1, start: 0, end: pageContent.length }],
      pdfExtraction: {
        schemaVersion: 1,
        totalPages: 1,
        processedPages: 1,
        pagesWithText: 1,
        complete: true,
      },
    },
  };
  const catalog = {
    schemaVersion: 1,
    catalogId: "targeted-result-catalog-v1",
    categoryView: "ST",
    requirements: [
      {
        id: "ST-01",
        label: "Sturmdeckung",
        requestedFields: [],
        components: [
          {
            id: "storm",
            label: "Sturm",
            factRole: "PERIL",
            aliases: ["Sturm"],
          },
        ],
      },
      {
        id: "ST-02",
        label: "Hageldeckung",
        requestedFields: [],
        components: [
          {
            id: "hail",
            label: "Hagel",
            factRole: "PERIL",
            aliases: ["Hagel"],
          },
        ],
      },
    ],
  };
  const selected = selectTargetRequirements({
    catalog,
    requirementIds: ["ST-01"],
  });
  const worksheet = {
    ...buildControlledOccurrenceWorksheet({
      document: documentArtifact.document,
      documentFingerprint: documentArtifact.fingerprint,
      catalog: selected.catalog,
    }),
    targetRequirementSelection: selected.selection,
  };
  const occurrence = worksheet.requirements[0].components[0].occurrences[0];
  const validatedTriage = {
    judgements: [{ candidateId: occurrence.candidateId, binding: "DIRECT" }],
  };
  const materializedTriage = materializeCandidateTriage({
    worksheet,
    validatedTriage,
  });
  const targets = buildPreparedEvidenceTargets({
    worksheet,
    documentStatus: DOCUMENT_STATUS.ACTIVE,
    candidateTriage: materializedTriage,
    expectedTargetSelectionDigestSha256:
      selected.selection.selectionDigestSha256,
  });
  const target = targets[0];
  const judgement =
    buildDeterministicPreparedEvidenceJudgement(target) ||
    parseAndValidatePreparedEvidenceResponse({
      responseText: JSON.stringify({
        schemaVersion: 1,
        componentId: target.componentId,
        selectedCandidateIds: [occurrence.candidateId],
        coverageEffect: "INCLUDED",
        conflictState: "NONE",
      }),
      target,
    });
  const materializedEvidence = materializePreparedEvidence({
    worksheet,
    targets,
    judgements: [judgement],
  });
  const selectedSources = rebuildTargetedSelectedSources({
    targets,
    materializedEvidence,
    documentArtifact,
    worksheet,
  });
  const prompt = [
    "| Kategorie-ID | Stufe | Kategorie |",
    "|---|---|---|",
    "| ST-02 | B | Hageldeckung |",
    "| ST-01 | A | Sturmdeckung |",
    "",
    "Schließe unmittelbar nach der Tabelle mit genau diesem Hinweis:",
    "„Private QA-Prüfung.“",
  ].join("\n");
  const inputContract = Object.freeze({
    manifestDigestSha256: "a".repeat(64),
    categoryView: "ST",
    document: Object.freeze({
      uuid: "document-a-0",
      sha256: documentArtifact.fingerprint,
      documentStatus: DOCUMENT_STATUS.ACTIVE,
    }),
    requirementIds: Object.freeze(["ST-01"]),
    targetSelectionDigestSha256: selected.selection.selectionDigestSha256,
    artifactHashes: Object.freeze({
      worksheetSha256: "1".repeat(64),
      materializedTriageSha256: "2".repeat(64),
      materializedEvidenceSha256: "3".repeat(64),
      selectedSourcesSha256: "4".repeat(64),
    }),
  });
  const input = {
    worksheetBytes: raw(worksheet),
    materializedTriageBytes: raw(materializedTriage),
    materializedEvidenceBytes: raw(materializedEvidence),
    selectedSourcesBytes: raw(selectedSources),
    documentArtifactBytes: raw(documentArtifact),
    categoryPromptBytes: Buffer.from(prompt),
  };
  assertTargetedCategoryMaterializationInputs.mockReturnValue(inputContract);
  return {
    input,
    inputContract,
    worksheet,
    targets,
    materializedTriage,
    documentArtifact,
  };
}

describe("targeted category result contract", () => {
  beforeEach(() => {
    assertTargetedCategoryMaterializationInputs.mockReset();
  });

  test("first asserts the bound inputs and returns only the projected QA rows", () => {
    const { input } = fixture();

    const result = materializeTargetedCategoryResult(input);

    expect(assertTargetedCategoryMaterializationInputs).toHaveBeenCalledTimes(
      1
    );
    expect(assertTargetedCategoryMaterializationInputs).toHaveBeenCalledWith(
      input
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      categoryId: "ST-01",
      categoryName: "Sturmdeckung",
      coverage: "Ja",
      reviewStatus: "BELEGT",
    });
    expect(result.answer).toContain("| ST-01 | A | Sturmdeckung |");
    expect(result.answer).not.toContain("| ST-02 | B | Hageldeckung |");
    expect(result.report).toMatchObject({
      contractId: TARGETED_CATEGORY_RESULT_CONTRACT_ID,
      runKind: "TARGETED_QA_ONLY",
      customerMaterializationAllowed: false,
      publishable: false,
      deployable: false,
      requirementIds: ["ST-01"],
      rowCount: 1,
      selectedSourceCount: 1,
      qualityGate: { pass: false, reason: "TARGETED_QA_ONLY" },
    });
  });

  test("calls the input boundary before attempting to parse result artifacts", () => {
    const { input } = fixture();
    input.worksheetBytes = Buffer.from("not-json");

    expect(() => materializeTargetedCategoryResult(input)).toThrow(
      "TARGETED_RESULT_WORKSHEET_JSON_INVALID"
    );
    expect(assertTargetedCategoryMaterializationInputs).toHaveBeenCalledWith(
      input
    );
  });

  test("replays a server-normalized model effect without expanding a narrow candidate", () => {
    const selectedCandidateIds = ["candidate:direct"];
    const target = {
      targetId: "prepared-target:EL-04:flood",
      requirementId: "EL-04",
      componentId: "flood",
      factRole: "PERIL",
      documentStatus: DOCUMENT_STATUS.ACTIVE,
      unresolvedCandidateIds: [],
      candidates: [
        {
          candidateId: selectedCandidateIds[0],
          candidateBinding: "DIRECT",
          scopeLeadText: "Versichert sind Schäden durch Hochwasser.",
          contextText: "Versichert sind Schäden durch Hochwasser.",
        },
        {
          candidateId: "candidate:narrow",
          candidateBinding: "NARROW_SCOPE",
          scopeLeadText: "Mitversichert gelten Hochwasserschäden.",
          contextText: "Mitversichert gelten Hochwasserschäden.",
        },
      ],
    };
    const judgement = parseAndValidatePreparedEvidenceResponse({
      responseText: JSON.stringify({
        schemaVersion: 1,
        componentId: target.componentId,
        selectedCandidateIds,
        coverageEffect: "DEFINED",
        conflictState: "NONE",
      }),
      target,
      allowUniqueCandidateIdRepair: false,
    });
    expect(judgement).toMatchObject({
      selectedCandidateIds,
      coverageEffect: "INCLUDED",
      decisionOwner: "MODEL_SELECTION_SERVER_EFFECT_RULE",
    });
    expect(
      replayModelPreparedEvidenceJudgement({ judgement, target })
    ).toMatchObject({
      selectedCandidateIds,
      coverageEffect: "INCLUDED",
      decisionOwner: "MODEL_SELECTION_SERVER_EFFECT_RULE",
    });
  });

  test.each([
    [
      "server-owned triage source data",
      (input) => {
        input.materializedTriageBytes = rewrite(
          input.materializedTriageBytes,
          (triage) => {
            triage[0].exactText = "Hagel";
          }
        );
      },
      "TARGETED_RESULT_TRIAGE_REBUILD_MISMATCH",
    ],
    [
      "a selected candidate outside its prepared target",
      (input) => {
        input.materializedEvidenceBytes = rewrite(
          input.materializedEvidenceBytes,
          (evidence) => {
            evidence.judgements[0].selectedCandidateIds = ["candidate:unknown"];
          }
        );
      },
      "PREPARED_SELECTED_ID_UNKNOWN",
    ],
    [
      "a non-deterministic rollup",
      (input) => {
        input.materializedEvidenceBytes = rewrite(
          input.materializedEvidenceBytes,
          (evidence) => {
            evidence.rollups[0].coveragePicture = "EXCLUDED";
          }
        );
      },
      "TARGETED_RESULT_EVIDENCE_REBUILD_MISMATCH",
    ],
    [
      "persisted sources that differ from their target candidates",
      (input) => {
        input.selectedSourcesBytes = rewrite(
          input.selectedSourcesBytes,
          (sources) => {
            sources[0].exactText = "Hagel";
          }
        );
      },
      "TARGETED_RESULT_SELECTED_SOURCES_MISMATCH",
    ],
    [
      "a prompt without the manifest target definition",
      (input) => {
        input.categoryPromptBytes = Buffer.from(
          "Schließe unmittelbar nach der Tabelle mit genau diesem Hinweis:\nPrivate QA-Prüfung."
        );
      },
      "TARGETED_RESULT_PROMPT_DEFINITION_MISSING",
    ],
  ])("rejects %s", (_label, mutate, errorCode) => {
    const { input } = fixture();
    mutate(input);

    expect(() => materializeTargetedCategoryResult(input)).toThrow(errorCode);
  });
});

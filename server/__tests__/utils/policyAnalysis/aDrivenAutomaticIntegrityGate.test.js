const crypto = require("crypto");
const {
  A_DYNAMIC_MANIFEST_CONTRACT_ID,
  buildADrivenSemanticManifest,
} = require("../../../utils/policyAnalysis/aDrivenSemanticManifest");
const {
  buildADrivenClassificationBatches,
} = require("../../../utils/policyAnalysis/aDrivenClassificationContract");
const {
  buildADrivenSourceUnitPlan,
} = require("../../../utils/policyAnalysis/aDrivenSourceUnitPlan");
const {
  buildAutomatedADrivenIntegrityReceipt,
  validateInputManifestBinding,
} = require("../../../utils/policyAnalysis/aDrivenAutomaticIntegrityGate");

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function artifact(text, fingerprintCharacter = "a") {
  const marker = "[DOCUMENT_PAGE 1]\n";
  return {
    schemaVersion: 1,
    fingerprint: fingerprintCharacter.repeat(64),
    document: {
      sourceDocumentId: fingerprintCharacter.repeat(64),
      pageContent: `${marker}${text}`,
      pageMap: [
        {
          pageNumber: 1,
          start: marker.length,
          end: marker.length + text.length,
        },
      ],
      pdfExtraction: {
        schemaVersion: 1,
        complete: true,
        totalPages: 1,
        processedPages: 1,
        pagesWithText: 1,
      },
    },
  };
}

function fixture() {
  const source = artifact("Zum Gebäude gehören die fest verbundenen Bauteile.\n", "a");
  const plan = buildADrivenSourceUnitPlan({
    documents: [
      {
        document: {
          uuid: "a-document",
          position: 0,
          sha256: source.fingerprint,
          role: "MAIN_POLICY",
          documentStatus: "ACTIVE",
        },
        artifact: source,
      },
    ],
  });
  const classificationBatches = buildADrivenClassificationBatches(plan);
  const responses = plan.units
    .filter(
      ({ initialDisposition }) =>
        initialDisposition === "PENDING_CLASSIFICATION"
    )
    .map((unit) => ({
      unitId: unit.unitId,
      primaryClass: unit.unitKind === "HEADING" ? "STRUCTURE" : "INSURED_OBJECT",
      semanticClasses:
        unit.unitKind === "HEADING" ? ["STRUCTURE"] : ["INSURED_OBJECT"],
      requirements:
        unit.unitKind === "HEADING"
          ? []
          : [
              {
                displayLabel: "Gebäude",
                components: [
                  {
                    type: "OBJECT",
                    label: "Gebäude",
                    sourceBlockIds: [unit.source.blockIds[0]],
                  },
                ],
              },
            ],
    }));
  const manifest = buildADrivenSemanticManifest({ plan, responses });
  const batchResults = classificationBatches.batches.map((batch) => ({
    batchId: batch.batchId,
    batchIndex: batch.batchIndex,
    sourceUnitPlanSha256: plan.planSha256,
    responses: responses.filter(({ unitId }) =>
      batch.expectedUnitIds.includes(unitId)
    ),
    validation: { passed: true },
  }));
  const classificationSummary = {
    sourceUnitPlanSha256: plan.planSha256,
    classificationBatchesSha256: sha256(
      JSON.stringify(classificationBatches)
    ),
    validatorContractId: A_DYNAMIC_MANIFEST_CONTRACT_ID,
    semanticSignalContractId: manifest.semanticSignalContractId,
    model: { id: "model", loadedContextLength: 1024 },
    transport: { requestTimeoutMs: 1000 },
    batches: classificationBatches.batches.length,
    validBatches: classificationBatches.batches.length,
    unresolvedBatches: 0,
    semanticRequirements: manifest.summary.semanticRequirements,
    semanticComponents: manifest.summary.semanticComponents,
    unresolvedUnits: 0,
    reviewRequiredBlocks: 0,
    allBlocksTerminal: true,
    responseIntegrityStatus: "VALID",
  };
  const inputManifest = {
    documents: [
      {
        side: "A",
        uuid: "a-document",
        sha256: source.fingerprint,
        position: 0,
      },
      {
        side: "B",
        uuid: "b-document",
        sha256: "b".repeat(64),
        position: 0,
      },
    ],
  };
  const inputManifestBytes = Buffer.from(JSON.stringify(inputManifest));
  return {
    plan,
    classificationBatches,
    batchResults,
    responses,
    classificationSummary,
    manifest,
    inputManifest,
    inputManifestBytes,
    artifactFileSha256s: { manifest: "c".repeat(64) },
  };
}

describe("automatic A-driven B-shadow readiness", () => {
  test("allows a private B shadow solely from dynamic A integrity", () => {
    const receipt = buildAutomatedADrivenIntegrityReceipt(fixture());
    expect(receipt).toMatchObject({
      status: "AUTOMATED_A_INTEGRITY_PASS",
      bShadowPilotAllowed: true,
      legacyCrosswalkRequiredForLaunch: false,
      humanReviewRequiredForLaunch: false,
      cryptographicSignatureRequiredForLaunch: false,
      productRoutingAllowed: false,
      customerWorkbookAllowed: false,
      deploymentAllowed: false,
      semanticCompletenessClaimed: false,
      summary: {
        aDocuments: 1,
        bDocuments: 1,
        semanticRequirements: 1,
        semanticComponents: 1,
      },
    });
    expect(receipt).not.toHaveProperty("legacyRequirements");
    expect(receipt).not.toHaveProperty("legacyComponents");
  });

  test("stops fail-closed for an incomplete batch or mutated A manifest", () => {
    const incomplete = fixture();
    incomplete.batchResults[0].validation.passed = false;
    expect(() => buildAutomatedADrivenIntegrityReceipt(incomplete)).toThrow(
      "LF_A_AUTOMATED_GATE_BATCH_RESULTS_INVALID"
    );

    const mutated = fixture();
    mutated.manifest.requirements[0].displayLabel = "Manipuliert";
    expect(() => buildAutomatedADrivenIntegrityReceipt(mutated)).toThrow(
      "LF_A_DYNAMIC_MANIFEST_DIGEST_INVALID"
    );
  });

  test("binds multiple dynamic A documents without fixed row or page counts", () => {
    const binding = validateInputManifestBinding({
      inputManifest: {
        documents: [
          { side: "A", uuid: "a-1", sha256: "1".repeat(64), position: 0 },
          { side: "A", uuid: "a-2", sha256: "2".repeat(64), position: 1 },
          { side: "B", uuid: "b-1", sha256: "3".repeat(64), position: 0 },
        ],
      },
      dynamicManifest: {
        documents: [
          {
            documentUuid: "a-1",
            documentSha256: "1".repeat(64),
            documentPosition: 0,
          },
          {
            documentUuid: "a-2",
            documentSha256: "2".repeat(64),
            documentPosition: 1,
          },
        ],
      },
    });
    expect(binding.aDocuments).toHaveLength(2);
    expect(binding.bDocuments).toHaveLength(1);
  });
});

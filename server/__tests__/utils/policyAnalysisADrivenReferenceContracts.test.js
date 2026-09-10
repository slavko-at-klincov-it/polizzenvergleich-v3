const {
  buildADrivenSourceUnitPlan,
  stableStringify,
} = require("../../utils/policyAnalysis/aDrivenSourceUnitPlan");
const {
  buildADrivenSemanticManifest,
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
  runBatch,
} = require("../../scripts/qa/runADrivenReferenceClassification.cjs");
const crypto = require("crypto");

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
            label: firstBlock.exactText,
            coverageEffect: "INCLUDED",
            sourceBlockIds: [firstBlock.blockId],
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

describe("LF_REFERENCE_A_DRIVEN_V2 source and semantic contracts", () => {
  test("retries only unresolved unit IDs and preserves accepted responses", async () => {
    const source = artifact(
      [
        "Seite 1\nVersichert sind Gebäude.\n\nVersichert sind Nebengebäude.\n",
      ],
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
    const client = {
      chat: {
        completions: {
          create: jest.fn(async ({ messages }) => {
            const input = JSON.parse(messages[1].content);
            requested.push(input.expectedUnitIds);
            const responses =
              requested.length === 1 ? invalid : [valid.at(-1)];
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
  });

  test("plans every block across multiple A documents without fixed pages or rows", () => {
    const first = artifact(
      [
        "Seite 1\nFeuer\nVersichert sind Gebäude und Nebengebäude:\n",
        "Seite 2\n- Garagen\n- Carports\nNeue Deckung Hagel\n",
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
    expect(left.relations[0].type).toBe("CONTINUES_ON_NEXT_PAGE");
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
          ({ sourceBlockIds, sourceBlocks }) =>
            sourceBlocks.length === sourceBlockIds.length &&
            sourceBlocks.every(
              ({ blockId, exactText, exactTextSha256 }) =>
                sourceBlockIds.includes(blockId) &&
                exactText.length > 0 &&
                /^[a-f0-9]{64}$/u.test(exactTextSha256)
            )
        )
      )
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
          label,
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

  test("server-expands a source-bound label across its unique adjacent blocks", () => {
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
    const manifest = buildADrivenSemanticManifest({ plan, responses });
    const component = manifest.requirements.find(({ sourceUnitIds }) =>
      sourceUnitIds.includes(unit.unitId)
    ).components[0];

    expect(manifest.summary.unresolvedUnits).toBe(0);
    expect(component.sourceBlockIds).toEqual(unit.source.blockIds);
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
    expect(draft.records[0].sourceOverlapCandidates).toHaveLength(2);
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
          dimensionChecks: [
            { dimension: "OBJECT", outcome: "MATCH" },
            { dimension: "COVERAGE_EFFECT", outcome: "MATCH" },
          ],
        },
        {
          packageId: "package-2",
          decision: "SUPPORTED",
          selectedCandidateIds: ["invented-candidate"],
          dimensionChecks: [{ dimension: "OBJECT", outcome: "MATCH" }],
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
    expect(result.diagnostics.map(({ code }) => code)).toContain(
      "UNKNOWN_PACKAGE_ID"
    );
  });
});

describe("LF_REFERENCE_A_DRIVEN_V2 search matrix and binary result", () => {
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
      dimensionChecks: item.requiredDimensions.map((dimension) => ({
        dimension,
        outcome: "MATCH",
      })),
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
      rows: manifest.summary.semanticComponents,
      found: manifest.summary.semanticComponents,
      notFound: 0,
      unresolved: 0,
      sideBOnlyRows: 0,
      binaryCustomerStatus: true,
    });
    expect(
      new Set(result.rows.map(({ customerStatus }) => customerStatus))
    ).toEqual(new Set(["FOUND"]));
    const boundedMisses = validateCounterpartDecisions({
      searchExecution,
      responses: searchExecution.packages.map((item) => ({
        packageId: item.packageId,
        decision: "NOT_SUPPORTED",
        selectedCandidateIds: [],
        dimensionChecks: item.requiredDimensions.map((dimension) => ({
          dimension,
          outcome: "NOT_ESTABLISHED",
        })),
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

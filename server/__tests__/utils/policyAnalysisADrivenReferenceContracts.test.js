const {
  buildADrivenSourceUnitPlan,
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
const crypto = require("crypto");

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

describe("LF_REFERENCE_A_DRIVEN_V2 source and semantic contracts", () => {
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
      batches.batches.every(({ expectedUnitIds }) => expectedUnitIds.length <= 2)
    ).toBe(true);
    expect(
      batches.batches.flatMap(({ expectedUnitIds }) => expectedUnitIds)
    ).toHaveLength(left.summary.pendingUnits);
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
      .filter(({ initialDisposition }) => initialDisposition !== "NON_OPERATIVE_TERMINAL")
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
    reorderedResponses.find(
      ({ unitId }) => unitId === clause.unitId
    ).requirements.reverse();
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
      manifest.requirements.every(({ requirementId }) => /^AR-[a-f0-9]{24}$/u.test(requirementId))
    ).toBe(true);
    expect(reordered.manifestSha256).toBe(manifest.manifestSha256);
  });

  test("turns missing, duplicate, unknown and invalid model IDs into visible unresolved state", () => {
    const source = artifact(
      [
        "Seite 1\nDeckung\nVersichert sind Gebäude.\n\nSelbstbehalt EUR 500.\n",
      ],
      "d"
    );
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const pending = plan.units.filter(
      ({ initialDisposition }) => initialDisposition === "PENDING_CLASSIFICATION"
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
      ({ initialDisposition }) => initialDisposition === "PENDING_CLASSIFICATION"
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

  test("keeps the legacy oracle strictly evaluation-only", () => {
    const source = artifact(
      ["Seite 1\nDeckung\nVersichert sind Gebäude.\n"],
      "e"
    );
    const plan = buildADrivenSourceUnitPlan({
      documents: [document("source", 0, source)],
    });
    const responses = plan.units
      .filter(({ initialDisposition }) => initialDisposition !== "NON_OPERATIVE_TERMINAL")
      .map(validResponse);
    const manifest = buildADrivenSemanticManifest({ plan, responses });
    const dynamic = manifest.requirements[0];
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
          dynamicTargets: [dynamic.components[0].componentId],
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
  const pageContent = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
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
      result.compactCandidates.find(({ clauseBoundaryId }) => clauseBoundaryId === "clause-1")
    ).toMatchObject({
      memberCandidateIds: ["one", "two"],
      channels: ["BM25", "DINGHY"],
      semanticDecision: null,
    });
  });

  test("rejects a candidate whose quote does not match the server document", () => {
    const forged = candidate("forged", 10, 30);
    forged.exactText = "erfundene Fundstelle";
    expect(() =>
      compactReferenceCandidates([forged], { documents })
    ).toThrow("LF_COUNTERPART_CANDIDATE_SOURCE_INVALID");
  });

  test("accepts only server-owned candidates and keeps bad model output unresolved", () => {
    const candidates = compactReferenceCandidates(
      [candidate("one", 10, 30)],
      { documents }
    ).compactCandidates;
    const packages = [
      {
        packageId: "package-1",
        componentId: "component-1",
        documentUuid: "b-doc",
        candidates,
        requiredDimensions: ["OBJECT", "COVERAGE_EFFECT"],
        searchCoverage: {
          status: "INCOMPLETE",
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
          status: "COMPLETE",
          requiredChannels: ["CURRENT", "BM25", "STRUCTURE", "DINGHY"],
          completedChannels: ["CURRENT", "BM25", "STRUCTURE", "DINGHY"],
        },
      },
    ];
    const result = validateCounterpartDecisions({
      packages,
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

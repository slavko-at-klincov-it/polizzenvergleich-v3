const crypto = require("crypto");
const {
  buildADrivenSourceUnitPlan,
} = require("../../utils/policyAnalysis/aDrivenSourceUnitPlan");
const {
  buildADrivenSemanticManifest,
} = require("../../utils/policyAnalysis/aDrivenSemanticManifest");
const {
  REQUIRED_SEARCH_CHANNELS,
  buildADrivenCounterpartSearchPlan,
  materializeADrivenCounterpartSearchExecution,
} = require("../../utils/policyAnalysis/aDrivenCounterpartSearchPlan");
const {
  validateCounterpartDecisions,
} = require("../../utils/policyAnalysis/referenceCounterpartDecisionContract");
const {
  buildClauseBoundaries,
  retrieveADrivenCounterpartCandidates,
} = require("../../utils/policyAnalysis/aDrivenCounterpartRetrieval");

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function artifact(pages) {
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
  const pageContent = chunks.join("");
  const fingerprint = sha256(pageContent);
  return {
    schemaVersion: 1,
    fingerprint,
    document: {
      sourceDocumentId: fingerprint,
      pageContent,
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

function sourceDocument(artifactValue, uuid = "a-source", position = 0) {
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

function response(unit) {
  if (unit.unitKind === "HEADING")
    return {
      unitId: unit.unitId,
      primaryClass: "STRUCTURE",
      semanticClasses: ["STRUCTURE"],
      requirements: [],
    };
  return {
    unitId: unit.unitId,
    primaryClass: "OPERATIVE_COVERAGE_STATEMENT",
    semanticClasses: ["OPERATIVE_COVERAGE_STATEMENT", "INSURED_OBJECT"],
    requirements: unit.source.blocks.map((block) => ({
      displayLabel: block.exactText,
      components: [
        {
          type: "OBJECT",
          label: block.exactText,
          sourceBlockIds: [block.blockId],
        },
        {
          type: "COVERAGE_EFFECT",
          label: block.exactText,
          coverageEffect: "INCLUDED",
          sourceBlockIds: [block.blockId],
        },
      ],
    })),
  };
}

function completeManifest(pages) {
  const source = artifact(pages);
  const plan = buildADrivenSourceUnitPlan({
    documents: [sourceDocument(source)],
  });
  const responses = plan.units
    .filter(
      ({ initialDisposition }) =>
        initialDisposition === "PENDING_CLASSIFICATION"
    )
    .map(response);
  return {
    plan,
    manifest: buildADrivenSemanticManifest({ plan, responses }),
  };
}

describe("LF_REFERENCE_A_DRIVEN_V2 A mutation contracts", () => {
  const baselinePages = [
    "Seite 1\nDECKUNG\nVersichert sind Gebäude.\n\nAUSSCHLUSS\nNicht versichert ist Verschleiß.\n",
  ];

  test.each([
    [
      "renamed heading",
      [
        "Seite 1\nVERSICHERUNGSUMFANG\nVersichert sind Gebäude.\n\nAUSSCHLUSS\nNicht versichert ist Verschleiß.\n",
      ],
    ],
    [
      "new coverage",
      [
        "Seite 1\nDECKUNG\nVersichert sind Gebäude.\n\nVersichert sind Nebengebäude.\n\nAUSSCHLUSS\nNicht versichert ist Verschleiß.\n",
      ],
    ],
    [
      "reordered chapters",
      [
        "Seite 1\nAUSSCHLUSS\nNicht versichert ist Verschleiß.\n\nDECKUNG\nVersichert sind Gebäude.\n",
      ],
    ],
    [
      "different page count",
      [
        "Seite 1\nDECKUNG\nVersichert sind Gebäude;\n",
        "Seite 2\nund Nebengebäude.\n\nAUSSCHLUSS\nNicht versichert ist Verschleiß.\n",
      ],
    ],
    [
      "paraphrase",
      [
        "Seite 1\nDECKUNG\nZum versicherten Bestand zählen Gebäude.\n\nAUSSCHLUSS\nAbnützung ist vom Schutz ausgenommen.\n",
      ],
    ],
    [
      "table",
      [
        "Seite 1\nDECKUNG\nLeistung\tLimit\nFeuer\tEUR 5.000\n\nAUSSCHLUSS\nNicht versichert ist Verschleiß.\n",
      ],
    ],
    [
      "OCR token split",
      [
        "Seite 1\nDECKUNG\nVersichert sind Gebäu de.\n\nAUSSCHLUSS\nNicht versichert ist Verschleiß.\n",
      ],
    ],
  ])("detects %s without reusing a fixed A inventory", (_name, pages) => {
    const baseline = completeManifest(baselinePages);
    const mutated = completeManifest(pages);

    expect(mutated.plan.planSha256).not.toBe(baseline.plan.planSha256);
    expect(mutated.manifest.manifestSha256).not.toBe(
      baseline.manifest.manifestSha256
    );
    expect(mutated.manifest.summary).toMatchObject({
      unresolvedUnits: 0,
      allBlocksTerminal: true,
      responseIntegrityStatus: "VALID",
    });
    expect(mutated.manifest.requirements).not.toEqual(
      baseline.manifest.requirements
    );
  });

  test("adds a source-bound result when A contains a new clause", () => {
    const baseline = completeManifest(baselinePages);
    const added = completeManifest([
      "Seite 1\nDECKUNG\nVersichert sind Gebäude.\n\nVersichert sind Nebengebäude.\n\nAUSSCHLUSS\nNicht versichert ist Verschleiß.\n",
    ]);

    expect(added.manifest.summary.semanticRequirements).toBe(
      baseline.manifest.summary.semanticRequirements + 1
    );
    expect(
      added.manifest.requirements.some(({ displayLabel }) =>
        displayLabel.includes("Nebengebäude")
      )
    ).toBe(true);
  });

  test("does not split one clause merely because OCR inserted double spaces", () => {
    const source = artifact([
      "Seite 1\nDECKUNG\nPauschalversicherungssumme von  \n€ 2.000.000,- . In  der  Sparte Leitungswasser gilt die Variante.\n",
    ]);
    const plan = buildADrivenSourceUnitPlan({
      documents: [sourceDocument(source)],
    });
    const content = plan.units.find(({ source: unitSource }) =>
      unitSource.combinedText.includes("Pauschalversicherungssumme")
    );

    expect(content.unitKind).toBe("CLAUSE");
    expect(content.source.blockIds).toHaveLength(2);
    expect(content.source.combinedText).toContain("€ 2.000.000,-");
  });

  test("covers a second A document and a cross-page continuation", () => {
    const main = artifact([
      "Seite 1\nDECKUNG\nVersichert sind Gebäude;\n",
      "Seite 2\nund Nebengebäude.\n",
    ]);
    const supplement = artifact([
      "Seite 1\nNACHTRAG\nZusätzlich versichert sind Carports.\n",
    ]);
    const plan = buildADrivenSourceUnitPlan({
      documents: [
        sourceDocument(main, "main", 0),
        sourceDocument(supplement, "supplement", 1),
      ],
    });

    expect(plan.summary.documents).toBe(2);
    expect(plan.summary.continuationRelations).toBe(1);
    expect(
      new Set(plan.units.map(({ source }) => source.documentUuid))
    ).toEqual(new Set(["main", "supplement"]));
  });
});

describe("LF_REFERENCE_A_DRIVEN_V2 adversarial B contracts", () => {
  test("uses independent deterministic channels and a per-package Dinghy result", () => {
    const { manifest } = completeManifest([
      "Seite 1\nDECKUNG\nVersichert sind Gebäude.\n",
    ]);
    const bArtifact = artifact([
      "Seite 1\n\nDECKUNG\nWohnobjekte stehen unter Versicherungsschutz.\n",
    ]);
    const plan = buildADrivenCounterpartSearchPlan({
      manifest,
      documents: [
        {
          uuid: "b-doc",
          position: 0,
          sha256: bArtifact.fingerprint,
        },
      ],
    });
    const documentForClauses = {
      uuid: "b-doc",
      sha256: bArtifact.fingerprint,
      pageContent: bArtifact.document.pageContent,
      pageContentSha256: sha256(bArtifact.document.pageContent),
      pageMap: bArtifact.document.pageMap,
    };
    const semanticClause = buildClauseBoundaries(documentForClauses).find(
      ({ exactText }) => exactText.includes("Wohnobjekte")
    );
    const dinghyRankings = new Map(
      plan.packages.map(({ packageId }) => [
        packageId,
        [{ clauseBoundaryId: semanticClause.clauseBoundaryId, score: 0.82 }],
      ])
    );
    const deterministicOnly = retrieveADrivenCounterpartCandidates({
      plan,
      documents: [
        {
          document: { uuid: "b-doc", sha256: bArtifact.fingerprint },
          artifact: bArtifact,
        },
      ],
    });
    const full = retrieveADrivenCounterpartCandidates({
      plan,
      documents: [
        {
          document: { uuid: "b-doc", sha256: bArtifact.fingerprint },
          artifact: bArtifact,
        },
      ],
      dinghyRankings,
    });

    expect(
      deterministicOnly.packageResults.every(
        ({ completedChannels }) => !completedChannels.includes("DINGHY")
      )
    ).toBe(true);
    expect(full.summary).toMatchObject({
      packages: plan.packages.length,
      completeDinghyPackages: plan.packages.length,
      noGlobalTopN: true,
    });
    expect(
      full.packageResults.every(
        ({ completedChannels, channelCandidateCounts, candidates }) =>
          completedChannels.length === REQUIRED_SEARCH_CHANNELS.length &&
          channelCandidateCounts.DINGHY === 1 &&
          candidates.some(({ channels }) => channels.includes("DINGHY"))
      )
    ).toBe(true);
  });

  test("rejects found when a required semantic dimension mismatches", () => {
    const { manifest } = completeManifest([
      "Seite 1\nDECKUNG\nVersichert sind Gebäude.\n",
    ]);
    const plan = buildADrivenCounterpartSearchPlan({
      manifest,
      documents: [{ uuid: "b-doc", position: 0, sha256: "b".repeat(64) }],
    });
    const exactText = "Fahrzeuge sind versichert.";
    const candidate = {
      compactCandidateId: "wrong-object",
      documentUuid: "b-doc",
      documentSha256: "b".repeat(64),
      clauseBoundaryId: "clause-one",
      sourceSpans: [
        {
          exactText,
          exactTextSha256: sha256(exactText),
          documentStart: 0,
          documentEnd: exactText.length,
        },
      ],
    };
    const execution = materializeADrivenCounterpartSearchExecution({
      plan,
      packageResults: plan.packages.map(({ packageId }) => ({
        packageId,
        completedChannels: [...REQUIRED_SEARCH_CHANNELS],
        candidates: [candidate],
      })),
    });
    const decisions = validateCounterpartDecisions({
      packages: execution.packages,
      responses: execution.packages.map((item) => ({
        packageId: item.packageId,
        decision: "SUPPORTED",
        selectedCandidateIds: [candidate.compactCandidateId],
        dimensionChecks: item.requiredDimensions.map((dimension, index) => ({
          dimension,
          outcome: index === 0 ? "MISMATCH" : "MATCH",
        })),
      })),
    });

    expect(decisions.summary.terminalPackages).toBe(0);
    expect(decisions.summary.unresolvedPackages).toBe(plan.packages.length);
  });

  test("does not accept not-found while one retrieval channel is incomplete", () => {
    const { manifest } = completeManifest([
      "Seite 1\nDECKUNG\nVersichert sind Gebäude.\n",
    ]);
    const plan = buildADrivenCounterpartSearchPlan({
      manifest,
      documents: [{ uuid: "b-doc", position: 0, sha256: "b".repeat(64) }],
    });
    const execution = materializeADrivenCounterpartSearchExecution({
      plan,
      packageResults: plan.packages.map(({ packageId }) => ({
        packageId,
        completedChannels: REQUIRED_SEARCH_CHANNELS.filter(
          (channel) => channel !== "DINGHY"
        ),
        candidates: [],
      })),
    });
    const decisions = validateCounterpartDecisions({
      packages: execution.packages,
      responses: execution.packages.map((item) => ({
        packageId: item.packageId,
        decision: "NOT_SUPPORTED",
        selectedCandidateIds: [],
        dimensionChecks: item.requiredDimensions.map((dimension) => ({
          dimension,
          outcome: "NOT_ESTABLISHED",
        })),
      })),
    });

    expect(execution.summary.partialPackages).toBe(plan.packages.length);
    expect(decisions.summary.unresolvedPackages).toBe(plan.packages.length);
  });
});

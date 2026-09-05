const crypto = require("crypto");
const {
  VS22_SOURCE_BOUND_LOCAL_NARROW_CONTINUATION_SCHEMA_VERSION,
  VS22_SOURCE_BOUND_LOCAL_NARROW_CONTINUATION_CONTRACT_ID,
  buildVs22LocalNarrowContinuationProof,
  validateVs22LocalNarrowContinuationProof,
} = require("../../utils/policyComparison/vs22LocalNarrowContinuationProofContract");
const {
  materializeAtomicFacts,
} = require("../../utils/policyComparison/resultBuilder");

const FINGERPRINT = crypto
  .createHash("sha256")
  .update("vs22-local-narrow-continuation-fixture")
  .digest("hex");
const DEFAULT_NARROW =
  "gefährlichem Abfall und Sonderabfall, der durch Eindringen oder Vermischen versicherter Sachen in bzw. mit Erdreich, Wasser und/oder Luft entsteht, gilt als mitversichert.";

function hash(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function sourceFor(candidate) {
  const relativeStart =
    candidate.documentStart - candidate.contextDocumentStart;
  const relativeEnd = candidate.documentEnd - candidate.contextDocumentStart;
  const conditionStart = Math.max(0, relativeStart - 240);
  const conditionEnd = Math.min(
    candidate.contextText.length,
    relativeEnd + 240
  );
  const conditionText = candidate.contextText.slice(
    conditionStart,
    conditionEnd
  );
  return {
    candidateId: candidate.candidateId,
    physicalPageNumber: candidate.physicalPageNumber,
    exactText: candidate.exactText,
    conditionCheckText: conditionText,
    documentFingerprint: FINGERPRINT,
    candidateIdentityPageNumber: candidate.physicalPageNumber,
    documentStart: candidate.documentStart,
    documentEnd: candidate.documentEnd,
    exactTextSha256: hash(candidate.exactText),
    conditionCheckDocumentStart:
      candidate.contextDocumentStart + conditionStart,
    conditionCheckDocumentEnd: candidate.contextDocumentStart + conditionEnd,
    conditionCheckTextSha256: hash(conditionText),
    candidateBinding: candidate.candidateBinding,
    ...(candidate.deterministicBindingBasis
      ? { deterministicBindingBasis: candidate.deterministicBindingBasis }
      : {}),
    ...(candidate.comparisonScopeKey
      ? { comparisonScopeKey: candidate.comparisonScopeKey }
      : {}),
  };
}

function fixture({
  narrowText = DEFAULT_NARROW,
  positiveGeneralText = "Kosten für Sondermüll und gefährlichen Abfall gelten als mitversichert: Der Sondermüll entsteht aus einem versicherten Ereignis.",
  bridge = "\n\n[DOCUMENT_PAGE 28]\n",
  toPage = 28,
  extraNarrow = false,
  narrowScopeKey = null,
} = {}) {
  const page27 = `Seite 27\n14. ${positiveGeneralText} ${"Weitere Voraussetzungen zur fachgerechten Entsorgung. ".repeat(
    12
  )}Die dem Gesetz nach notwendige Behandlung von Sondermüll,`;
  const page28 = `Seite ${toPage}\n${narrowText}\n15. Weitere Bestimmungen`;
  const pageTexts = Array.from(
    { length: 26 },
    (_unused, index) => `Seite ${index + 1}\nUnbeteiligter Inhalt.`
  );
  pageTexts.push(page27, page28);
  let pageContent = "";
  const pageMap = [];
  for (const [index, pageText] of pageTexts.entries()) {
    const pageNumber = index === 27 ? toPage : index + 1;
    if (index > 0)
      pageContent +=
        index === 27 ? bridge : `\n\n[DOCUMENT_PAGE ${pageNumber}]\n`;
    const start = pageContent.length;
    pageContent += pageText;
    pageMap.push({ pageNumber, start, end: pageContent.length });
  }
  const page27Start = pageMap[26].start;
  const page28Start = pageMap[27].start;
  const directText = "Sondermüll";
  const narrowExactText =
    narrowText.match(/gefährlich\p{L}*\s+Abfall/iu)?.[0] || narrowText;
  const directStart = page27Start + page27.lastIndexOf(directText);
  const positiveColon = page27.indexOf("mitversichert:");
  const positiveStart =
    page27Start +
    (positiveColon >= 0
      ? page27.indexOf(directText, positiveColon)
      : page27.indexOf(directText));
  const narrowStart = page28Start + page28.indexOf(narrowExactText);
  const direct = {
    candidateId: "candidate:vs22:general",
    physicalPageNumber: 27,
    exactText: directText,
    documentStart: directStart,
    documentEnd: directStart + directText.length,
    contextText: page27,
    contextDocumentStart: page27Start,
    candidateBinding: "DIRECT",
    deterministicBindingBasis: "EXPLICIT_HAZARDOUS_WASTE_COSTS",
  };
  const positiveGeneral = {
    ...direct,
    candidateId: "candidate:vs22:general:positive",
    documentStart: positiveStart,
    documentEnd: positiveStart + directText.length,
  };
  const narrow = {
    candidateId: "candidate:vs22:narrow",
    physicalPageNumber: toPage,
    exactText: narrowExactText,
    documentStart: narrowStart,
    documentEnd: narrowStart + narrowExactText.length,
    contextText: page28,
    contextDocumentStart: page28Start,
    candidateBinding: "NARROW_SCOPE",
    ...(narrowScopeKey ? { comparisonScopeKey: narrowScopeKey } : {}),
  };
  const candidates = [positiveGeneral, direct, narrow];
  if (extraNarrow) {
    candidates.push({
      ...narrow,
      candidateId: "candidate:vs22:narrow:duplicate",
    });
  }
  const sources = candidates.map(sourceFor);
  const selectedCandidateIds = candidates.map(({ candidateId }) => candidateId);
  const documentArtifact = {
    schemaVersion: 1,
    fingerprint: FINGERPRINT,
    document: {
      sourceDocumentId: FINGERPRINT,
      pageContent,
      pageMap,
      pdfExtraction: {
        schemaVersion: 1,
        totalPages: 28,
        processedPages: 28,
        pagesWithText: 28,
        complete: true,
      },
    },
  };
  return {
    documentArtifact,
    documentFingerprint: FINGERPRINT,
    requirementId: "VS-22",
    componentId: "hazardous_waste",
    selectedScopePicture: "GENERAL_AND_NARROW",
    selectedCandidateIds,
    selectedCandidates: candidates,
    sources,
  };
}

function atomFrom(context, proof) {
  return {
    requirementId: context.requirementId,
    componentId: context.componentId,
    selectedScopePicture: context.selectedScopePicture,
    selectedCandidateIds: context.selectedCandidateIds,
    sources: context.sources,
    vs22LocalNarrowContinuationProof: proof,
  };
}

describe("VS22 source-bound local narrow continuation proof", () => {
  test("builds and replays the real S27 to S28 PageMap bridge shape", () => {
    const context = fixture();
    const proof = buildVs22LocalNarrowContinuationProof(context);

    expect(proof).toMatchObject({
      schemaVersion: VS22_SOURCE_BOUND_LOCAL_NARROW_CONTINUATION_SCHEMA_VERSION,
      contractId: VS22_SOURCE_BOUND_LOCAL_NARROW_CONTINUATION_CONTRACT_ID,
      requirementId: "VS-22",
      componentId: "hazardous_waste",
      documentFingerprint: FINGERPRINT,
      selectedScopePicture: "GENERAL_AND_NARROW",
      directGeneralCandidateIds: [
        "candidate:vs22:general",
        "candidate:vs22:general:positive",
      ],
      positiveGeneralCandidateIds: ["candidate:vs22:general:positive"],
      continuation: {
        predecessorCandidateId: "candidate:vs22:general",
        continuationCandidateId: "candidate:vs22:narrow",
        fromPhysicalPageNumber: 27,
        toPhysicalPageNumber: 28,
        previousPage: { pageNumber: 27 },
        nextPage: { pageNumber: 28 },
        assertion:
          "LOCAL_POSITIVE_NARROW_CONTINUATION_OF_GENERAL_HAZARDOUS_WASTE_CLAUSE",
      },
    });
    expect(validateVs22LocalNarrowContinuationProof(proof)).toBe(true);
    expect(validateVs22LocalNarrowContinuationProof(proof, context)).toBe(true);
    expect(
      validateVs22LocalNarrowContinuationProof(proof, {
        atom: atomFrom(context, proof),
      })
    ).toBe(true);
  });

  test.each([
    [
      "optional wording",
      "gefährlicher Abfall, der durch Eindringen versicherter Sachen in Erdreich entsteht, gilt nur bei gesonderter Vereinbarung als mitversichert.",
    ],
    [
      "negated wording",
      "gefährlicher Abfall, der durch Eindringen versicherter Sachen in Erdreich entsteht, gilt als nicht mitversichert.",
    ],
    [
      "liability wording",
      "Die Haftpflicht für gefährlichen Abfall, der durch Eindringen versicherter Sachen in Erdreich entsteht, gilt als mitversichert.",
    ],
    [
      "storage wording",
      "Lagerkosten für gefährlichen Abfall, der durch Eindringen versicherter Sachen in Erdreich entsteht, gelten als mitversichert.",
    ],
    [
      "unrelated positive wording",
      "Gefährlicher Abfall gilt als mitversichert.",
    ],
  ])("rejects %s as a local continuation", (_name, narrowText) => {
    expect(
      buildVs22LocalNarrowContinuationProof(fixture({ narrowText }))
    ).toBeNull();
  });

  test.each([
    ["wrong page marker", { bridge: "\n[DOCUMENT_PAGE 29]\n" }],
    ["new heading in bridge", { bridge: "\nNeue Deckung\n" }],
    ["nonconsecutive PageMap", { toPage: 29 }],
    ["a second narrow candidate", { extraNarrow: true }],
    ["a scoped narrow candidate", { narrowScopeKey: "OTHER_SCOPE" }],
  ])("rejects %s", (_name, options) => {
    expect(buildVs22LocalNarrowContinuationProof(fixture(options))).toBeNull();
  });

  test("rejects range, context, fingerprint and source-set tampering", () => {
    const mutations = [
      (context) => {
        context.sources[0].documentStart += 1;
      },
      (context) => {
        context.sources[1].conditionCheckText += " manipuliert";
      },
      (context) => {
        context.selectedCandidates[1].contextDocumentStart += 1;
      },
      (context) => {
        context.documentArtifact.fingerprint = "0".repeat(64);
      },
      (context) => {
        context.sources.pop();
      },
      (context) => {
        context.selectedCandidateIds.push("candidate:missing");
      },
    ];
    for (const mutate of mutations) {
      const context = fixture();
      mutate(context);
      expect(buildVs22LocalNarrowContinuationProof(context)).toBeNull();
    }
  });

  test("requires a positive general source distinct from the open predecessor", () => {
    const context = fixture();
    const positiveId = "candidate:vs22:general:positive";
    context.selectedCandidateIds = context.selectedCandidateIds.filter(
      (candidateId) => candidateId !== positiveId
    );
    context.selectedCandidates = context.selectedCandidates.filter(
      ({ candidateId }) => candidateId !== positiveId
    );
    context.sources = context.sources.filter(
      ({ candidateId }) => candidateId !== positiveId
    );

    expect(buildVs22LocalNarrowContinuationProof(context)).toBeNull();
  });

  test("rejects an unrelated positive sentence beside a hazardous-waste definition", () => {
    expect(
      buildVs22LocalNarrowContinuationProof(
        fixture({
          positiveGeneralText:
            "Sondermüll ist nur definiert. Das Gebäude ist versichert.",
        })
      )
    ).toBeNull();
  });

  test("rejects an unrelated positive object in the same sentence", () => {
    expect(
      buildVs22LocalNarrowContinuationProof(
        fixture({
          positiveGeneralText:
            "Sondermüll ist nur definiert und das Gebäude ist versichert.",
        })
      )
    ).toBeNull();
  });

  test("accepts the real 5230 nominal limit wording and its local colon binding", () => {
    const context = fixture({
      positiveGeneralText:
        "Kosten für die Behandlung von Sondermüll, gefährlichem Abfall sowie Sonderabfall mit der im vorliegenden Besonderen Teil ausgewiesenen Versicherungssumme auf erstes Risiko zusätzlich zur Versicherungssumme unter folgenden Voraussetzungen mitversichert: Der Sondermüll, gefährliche Abfall und Sonderabfall muss aus einem versicherten Ereignis entstanden sein.",
    });

    expect(buildVs22LocalNarrowContinuationProof(context)).not.toBeNull();
  });

  test.each(["candidate:vs22:general:positive", "candidate:vs22:general"])(
    "rejects a %s context crossing its physical page",
    (candidateId) => {
      const context = fixture();
      const candidate = context.selectedCandidates.find(
        (item) => item.candidateId === candidateId
      );
      const page26 = context.documentArtifact.document.pageMap[25];
      const page27 = context.documentArtifact.document.pageMap[26];
      candidate.contextDocumentStart = page26.start;
      candidate.contextText =
        context.documentArtifact.document.pageContent.slice(
          page26.start,
          page27.end
        );
      const sourceIndex = context.sources.findIndex(
        (source) => source.candidateId === candidateId
      );
      context.sources[sourceIndex] = sourceFor(candidate);

      expect(buildVs22LocalNarrowContinuationProof(context)).toBeNull();
    }
  );

  test("rejects a narrow context extending from physical page 28 into page 29", () => {
    const context = fixture();
    const artifact = context.documentArtifact.document;
    const page28 = artifact.pageMap[27];
    const page29Bridge = "\n\n[DOCUMENT_PAGE 29]\n";
    const page29Text = "Seite 29\nUnbeteiligter Folgeinhalt.";
    const page29Start = artifact.pageContent.length + page29Bridge.length;
    artifact.pageContent += `${page29Bridge}${page29Text}`;
    artifact.pageMap.push({
      pageNumber: 29,
      start: page29Start,
      end: artifact.pageContent.length,
    });
    artifact.pdfExtraction.totalPages = 29;
    artifact.pdfExtraction.processedPages = 29;
    artifact.pdfExtraction.pagesWithText = 29;
    const candidateId = "candidate:vs22:narrow";
    const candidate = context.selectedCandidates.find(
      (item) => item.candidateId === candidateId
    );
    candidate.contextText = artifact.pageContent.slice(
      page28.start,
      artifact.pageMap[28].end
    );
    const sourceIndex = context.sources.findIndex(
      (source) => source.candidateId === candidateId
    );
    context.sources[sourceIndex] = sourceFor(candidate);

    expect(buildVs22LocalNarrowContinuationProof(context)).toBeNull();
  });

  test("fails closed when proof or replay atom is tampered", () => {
    const context = fixture();
    const proof = buildVs22LocalNarrowContinuationProof(context);
    const tamperedProof = JSON.parse(JSON.stringify(proof));
    tamperedProof.continuation.toPhysicalPageNumber = 29;
    expect(validateVs22LocalNarrowContinuationProof(tamperedProof)).toBe(false);

    const atom = atomFrom(context, proof);
    atom.sources[1].exactText = `${atom.sources[1].exactText} manipuliert`;
    expect(validateVs22LocalNarrowContinuationProof(proof, { atom })).toBe(
      false
    );
  });

  test("does not produce a proof outside exact VS-22 hazardous_waste scope", () => {
    for (const override of [
      { requirementId: "VS-21" },
      { componentId: "decontamination" },
      { selectedScopePicture: "GENERAL" },
    ]) {
      expect(
        buildVs22LocalNarrowContinuationProof({ ...fixture(), ...override })
      ).toBeNull();
    }
  });

  test("materializeAtomicFacts attaches the proof only to the exact VS-22 atom", () => {
    const context = fixture();
    const worksheet = {
      catalog: { id: "vs-occurrence-full-draft-v0.16", categoryView: "VS" },
      requirements: [
        {
          id: "VS-22",
          label: "Sondermüll",
          requestedFields: [],
          scopePolicy: "GENERAL_REQUIRED",
          componentSatisfactionPolicy: "ALL",
          components: [
            {
              id: "hazardous_waste",
              label: "Sondermüll",
              factRole: "INSURED_OBJECT",
              occurrences: [],
            },
          ],
        },
      ],
    };
    const judgement = {
      targetId: "target:VS-22:hazardous_waste",
      requirementId: "VS-22",
      componentId: "hazardous_waste",
      evidencePresence: "FOUND",
      coverageEffect: "INCLUDED",
      conflictState: "NONE",
      selectedScopePicture: "GENERAL_AND_NARROW",
      documentApplicability: "ACTIVE",
      selectedCandidateIds: context.selectedCandidateIds,
      unresolvedCandidateIds: [],
    };
    const atoms = materializeAtomicFacts({
      document: {
        uuid: "document:vs22",
        role: "MAIN_POLICY",
        documentStatus: "ACTIVE",
        sha256: FINGERPRINT,
      },
      worksheet,
      materializedEvidence: { judgements: [judgement] },
      requestedFields: {
        requirements: [
          {
            requirementId: "VS-22",
            requestedFields: [],
            requestedFieldStatus: "NOT_REQUIRED",
            fields: [],
          },
        ],
      },
      targets: [
        {
          targetId: judgement.targetId,
          requirementId: "VS-22",
          componentId: "hazardous_waste",
          factRole: "INSURED_OBJECT",
          candidates: context.selectedCandidates,
        },
      ],
      documentArtifact: context.documentArtifact,
      report: null,
    });

    expect(atoms).toHaveLength(1);
    expect(
      validateVs22LocalNarrowContinuationProof(
        atoms[0].vs22LocalNarrowContinuationProof,
        { atom: atoms[0] }
      )
    ).toBe(true);
  });
});

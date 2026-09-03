const crypto = require("crypto");
const feFullCatalog = require("../../../resources/policyAnalysis/fe-occurrence-full-draft.v0.1.json");
const {
  rebuildTargetedSelectedSources,
} = require("../../../utils/policyAnalysis/targetedSelectedSourcesContract");
const {
  buildControlledOccurrenceWorksheet,
} = require("../../../utils/policyAnalysis/controlledOccurrenceWorksheet");
const {
  DOCUMENT_STATUS,
  buildPreparedEvidenceTargets,
} = require("../../../utils/policyAnalysis/preparedEvidenceContract");

function fixture() {
  const firstPage = "Sturm ist versichert. Kontext Sturmdeckung.";
  const secondPage = "Hagel ist versichert. Kontext Hageldeckung.";
  const separator = "\n";
  const pageContent = `${firstPage}${separator}${secondPage}`;
  const secondPageStart = firstPage.length + separator.length;
  const documentArtifact = {
    schemaVersion: 1,
    fingerprint: "fixture-fingerprint",
    document: {
      sourceDocumentId: "fixture-fingerprint",
      pageContent,
      pageMap: [
        { pageNumber: 1, start: 0, end: firstPage.length },
        {
          pageNumber: 2,
          start: secondPageStart,
          end: pageContent.length,
        },
      ],
      pdfExtraction: { complete: true },
    },
  };
  const targets = [
    {
      targetId: "prepared-target:ST-01:storm",
      requirementId: "ST-01",
      componentId: "storm",
      candidates: [
        {
          candidateId: "candidate:storm",
          candidateBinding: "DIRECT",
          physicalPageNumber: 1,
          printedPageLabel: "1",
          exactText: "Sturm",
          documentStart: 0,
          documentEnd: 5,
          contextText: firstPage,
          contextDocumentStart: 0,
        },
      ],
    },
    {
      targetId: "prepared-target:ST-02:hail",
      requirementId: "ST-02",
      componentId: "hail",
      candidates: [
        {
          candidateId: "candidate:hail",
          candidateBinding: "NARROW_SCOPE",
          physicalPageNumber: 2,
          printedPageLabel: null,
          exactText: "Hagel",
          documentStart: secondPageStart,
          documentEnd: secondPageStart + 5,
          contextText: secondPage,
          contextDocumentStart: secondPageStart,
        },
      ],
    },
  ];
  const materializedEvidence = {
    judgements: [
      {
        targetId: targets[0].targetId,
        requirementId: "ST-01",
        componentId: "storm",
        selectedCandidateIds: ["candidate:storm"],
      },
      {
        targetId: targets[1].targetId,
        requirementId: "ST-02",
        componentId: "hail",
        selectedCandidateIds: ["candidate:hail"],
      },
    ],
  };
  return { targets, materializedEvidence, documentArtifact };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function nestedProvenanceFixture() {
  const firstPage = [
    "• Überspannung infolge indirekter Blitzschlag innerhalb und außerhalb von versicherten Gebäuden am Versicherungsgrundstück, an",
    "- Licht- und Kraftinstallationen sowie Zähler- und Sicherungskästen;",
  ].join("\n");
  const secondPage = ["Seite 2", "- Erd- und Telefonkabeln.", ""].join("\n");
  const separator = "\n\n[DOCUMENT_PAGE 2]\n";
  const pageContent = `${firstPage}${separator}${secondPage}`;
  const documentArtifact = {
    schemaVersion: 1,
    fingerprint: "targeted-fe-a05-provenance",
    document: {
      id: "targeted-fe-a05-provenance",
      sourceDocumentId: "targeted-fe-a05-provenance",
      title: "targeted-fe-a05-provenance.pdf",
      documentType: "pdf",
      pageContent,
      pageMap: [
        { pageNumber: 1, start: 0, end: firstPage.length },
        {
          pageNumber: 2,
          start: firstPage.length + separator.length,
          end: pageContent.length,
        },
      ],
      pdfExtraction: {
        schemaVersion: 1,
        totalPages: 2,
        processedPages: 2,
        pagesWithText: 2,
        complete: true,
      },
    },
  };
  const catalog = {
    ...feFullCatalog,
    requirements: [
      feFullCatalog.requirements.find(({ id }) => id === "FE-A05"),
    ],
  };
  const worksheet = buildControlledOccurrenceWorksheet({
    document: documentArtifact.document,
    documentFingerprint: documentArtifact.fingerprint,
    catalog,
  });
  const occurrence = worksheet.requirements[0].components[0].occurrences[0];
  const targets = buildPreparedEvidenceTargets({
    worksheet,
    documentStatus: DOCUMENT_STATUS.FRAMEWORK_TERMS,
    candidateTriage: [
      {
        requirementId: "FE-A05",
        componentId: "indirect_lightning_damage",
        candidateId: occurrence.candidateId,
        binding: "DIRECT",
      },
    ],
  });
  const materializedEvidence = {
    judgements: [
      {
        targetId: targets[0].targetId,
        requirementId: "FE-A05",
        componentId: "indirect_lightning_damage",
        selectedCandidateIds: [occurrence.candidateId],
      },
    ],
  };
  return { targets, materializedEvidence, documentArtifact, worksheet };
}

describe("targeted selected sources contract", () => {
  test("reconstructs the current selected-sources artifact from server-owned targets", () => {
    const input = fixture();
    const before = clone(input);

    expect(rebuildTargetedSelectedSources(input)).toEqual([
      {
        requirementId: "ST-01",
        componentId: "storm",
        candidateId: "candidate:storm",
        candidateBinding: "DIRECT",
        physicalPageNumber: 1,
        printedPageLabel: "1",
        exactText: "Sturm",
        contextText: "Sturm ist versichert. Kontext Sturmdeckung.",
        contextDocumentStart: 0,
      },
      {
        requirementId: "ST-02",
        componentId: "hail",
        candidateId: "candidate:hail",
        candidateBinding: "NARROW_SCOPE",
        physicalPageNumber: 2,
        printedPageLabel: null,
        exactText: "Hagel",
        contextText: "Hagel ist versichert. Kontext Hageldeckung.",
        contextDocumentStart:
          input.targets[1].candidates[0].contextDocumentStart,
      },
    ]);
    expect(input).toEqual(before);
  });

  test("replays selected FE-A05 object and parent proofs against original document bytes", () => {
    const input = nestedProvenanceFixture();
    const [source] = rebuildTargetedSelectedSources(input);

    expect(source).toMatchObject({
      requirementId: "FE-A05",
      componentId: "indirect_lightning_damage",
      objectScopeProof: {
        objectScopeKeys: [
          "BUILDING_ELECTRICAL_INSTALLATIONS",
          "OBJECTS_OUTSIDE_BUILDINGS",
          "UNDERGROUND_CABLES",
        ],
      },
      nestedListContinuationProof: {
        contractId: "NESTED_LIST_CONTINUATION_PROOF_V1",
      },
    });
  });

  test("requires a matching worksheet whenever a target carries object-scope provenance", () => {
    const input = nestedProvenanceFixture();
    delete input.worksheet;
    expect(() => rebuildTargetedSelectedSources(input)).toThrow(
      "TARGETED_SOURCES_PROVENANCE_WORKSHEET_INVALID"
    );

    const foreignIdentity = nestedProvenanceFixture();
    foreignIdentity.documentArtifact.fingerprint = "foreign-fingerprint";
    expect(() => rebuildTargetedSelectedSources(foreignIdentity)).toThrow(
      "TARGETED_SOURCES_PROVENANCE_WORKSHEET_INVALID"
    );
  });

  test("rejects removed candidate provenance and never emits an unselected proof", () => {
    const stripped = nestedProvenanceFixture();
    delete stripped.targets[0].candidates[0].objectScopeProof;
    delete stripped.targets[0].candidates[0].nestedListContinuationProof;
    expect(() => rebuildTargetedSelectedSources(stripped)).toThrow(
      "TARGETED_SOURCES_PROVENANCE_PRESENCE_MISMATCH"
    );

    const unselected = nestedProvenanceFixture();
    const selectedCandidate = unselected.targets[0].candidates[0];
    const unselectedCandidate = {
      ...clone(selectedCandidate),
      candidateId: "candidate:unselected-object-scope",
    };
    unselected.targets[0].candidates.push(unselectedCandidate);
    const component = unselected.worksheet.requirements[0].components[0];
    component.occurrences.push({
      ...clone(component.occurrences[0]),
      candidateId: unselectedCandidate.candidateId,
    });
    const sources = rebuildTargetedSelectedSources(unselected);
    expect(sources).toHaveLength(1);
    expect(sources[0].candidateId).toBe(selectedCandidate.candidateId);
  });

  test("rejects a candidate proof that differs from its worksheet occurrence", () => {
    const input = nestedProvenanceFixture();
    input.targets[0].candidates[0].objectScopeProof.proofDigest = "f".repeat(64);

    expect(() => rebuildTargetedSelectedSources(input)).toThrow(
      "TARGETED_SOURCES_PROVENANCE_OBJECT_PROOF_INVALID"
    );
  });

  test("rejects an unselected object proof without its component contract", () => {
    const input = nestedProvenanceFixture();
    const target = input.targets[0];
    const component = input.worksheet.requirements[0].components[0];
    const proofFreeCandidate = clone(target.candidates[0]);
    proofFreeCandidate.candidateId = "candidate:selected-proof-free";
    delete proofFreeCandidate.objectScopeProof;
    delete proofFreeCandidate.nestedListContinuationProof;
    target.candidates.push(proofFreeCandidate);
    const proofFreeOccurrence = clone(component.occurrences[0]);
    proofFreeOccurrence.candidateId = proofFreeCandidate.candidateId;
    delete proofFreeOccurrence.objectScopeProof;
    delete proofFreeOccurrence.nestedListContinuationProof;
    component.occurrences.push(proofFreeOccurrence);
    input.materializedEvidence.judgements[0].selectedCandidateIds = [
      proofFreeCandidate.candidateId,
    ];
    delete component.objectScopeEvidenceContract;

    expect(() => rebuildTargetedSelectedSources(input)).toThrow(
      "TARGETED_SOURCES_PROVENANCE_COMPONENT_CONTRACT_MISSING"
    );
  });

  test("fails closed when the selected parent proof no longer matches document bytes", () => {
    const input = nestedProvenanceFixture();
    input.documentArtifact.document.pageContent =
      input.documentArtifact.document.pageContent.replace("Telefon", "Xelefon");
    input.worksheet.document.pageContentSha256 = crypto
      .createHash("sha256")
      .update(input.documentArtifact.document.pageContent)
      .digest("hex");

    expect(() => rebuildTargetedSelectedSources(input)).toThrow(
      "TARGETED_SOURCES_PROVENANCE_PARENT_PROOF_INVALID"
    );
  });

  test.each([
    [
      "unknown selected candidate",
      (value) => {
        value.materializedEvidence.judgements[0].selectedCandidateIds = [
          "candidate:unknown",
        ];
      },
      "TARGETED_SOURCES_SELECTED_ID_UNKNOWN",
    ],
    [
      "duplicate selected source",
      (value) => {
        value.materializedEvidence.judgements[0].selectedCandidateIds.push(
          "candidate:storm"
        );
      },
      "TARGETED_SOURCES_SELECTED_ID_DUPLICATE",
    ],
    [
      "candidate selected by the wrong target",
      (value) => {
        value.materializedEvidence.judgements[0].selectedCandidateIds = [
          "candidate:hail",
        ];
      },
      "TARGETED_SOURCES_SELECTED_ID_WRONG_TARGET",
    ],
    [
      "wrong judgement ownership",
      (value) => {
        value.materializedEvidence.judgements[0].componentId = "hail";
      },
      "TARGETED_SOURCES_JUDGEMENT_OWNERSHIP_INVALID",
    ],
    [
      "duplicate candidate ownership in targets",
      (value) => {
        value.targets[1].candidates[0].candidateId = "candidate:storm";
      },
      "TARGETED_SOURCES_CANDIDATE_OWNERSHIP_DUPLICATE",
    ],
    [
      "missing target judgement",
      (value) => {
        value.materializedEvidence.judgements.pop();
      },
      "TARGETED_SOURCES_JUDGEMENT_TARGET_MISSING",
    ],
  ])("rejects %s", (_label, mutate, errorCode) => {
    const input = fixture();
    mutate(input);

    expect(() => rebuildTargetedSelectedSources(input)).toThrow(errorCode);
  });

  test.each([
    [
      "an unknown physical page",
      (candidate) => {
        candidate.physicalPageNumber = 3;
      },
      "TARGETED_SOURCES_PHYSICAL_PAGE_INVALID",
    ],
    [
      "an exact span outside its page",
      (candidate) => {
        candidate.documentEnd = 99;
      },
      "TARGETED_SOURCES_EXACT_RANGE_INVALID",
    ],
    [
      "exact text that differs from the document bytes",
      (candidate) => {
        candidate.exactText = "Brand";
      },
      "TARGETED_SOURCES_EXACT_RANGE_INVALID",
    ],
    [
      "a context start that does not bind the context text",
      (candidate) => {
        candidate.contextDocumentStart = 1;
      },
      "TARGETED_SOURCES_CONTEXT_RANGE_INVALID",
    ],
  ])("rejects %s", (_label, mutate, errorCode) => {
    const input = fixture();
    mutate(input.targets[0].candidates[0]);

    expect(() => rebuildTargetedSelectedSources(input)).toThrow(errorCode);
  });
});

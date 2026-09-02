const {
  rebuildTargetedSelectedSources,
} = require("../../../utils/policyAnalysis/targetedSelectedSourcesContract");

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

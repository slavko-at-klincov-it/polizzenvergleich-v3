const crypto = require("crypto");
const {
  ARTIFACT_BACKED_SOURCE_SCOPE_CONTRACT_ID,
  createArtifactBackedSourceScopeResolver,
  sourceBoundSectionScopeKeys,
} = require("../../../utils/policyAnalysis/sourceBoundSectionScopeContract");

function fixture() {
  const fingerprint = "a".repeat(64);
  const firstPage =
    "Die Feuerversicherung\nFeuerversicherung\nAufräumungskosten sind versichert.";
  const secondPage = "Fortsetzung\nAbbruchkosten sind versichert.";
  const pageContent = `${firstPage}\n${secondPage}`;
  const secondPageStart = firstPage.length + 1;
  const heading = "Feuerversicherung";
  const headingStart = firstPage.indexOf(heading, 5);
  const occurrenceText = "Aufräumungskosten";
  const occurrenceStart = firstPage.indexOf(occurrenceText);
  const occurrence = {
    candidateId: "candidate:fe-cost",
    pageNumber: 1,
    physicalPageNumber: 1,
    pageStart: occurrenceStart,
    pageEnd: occurrenceStart + occurrenceText.length,
    documentStart: occurrenceStart,
    documentEnd: occurrenceStart + occurrenceText.length,
    exactText: occurrenceText,
    context: {
      unitType: "PARAGRAPH",
      pageStart: 0,
      pageEnd: firstPage.length,
      documentStart: 0,
      documentEnd: firstPage.length,
      text: firstPage,
    },
    pageScopeHints: [
      {
        scopeKey: "FEUER_INSURANCE",
        text: "Die Feuerversicherung",
        pageStart: 0,
        pageEnd: "Die Feuerversicherung".length,
      },
    ],
    sectionScopeHint: {
      scopeKey: "FEUER_INSURANCE",
      text: heading,
      pageStart: headingStart,
      pageEnd: headingStart + heading.length,
      physicalPageNumber: 1,
      source: "CURRENT_PAGE_HEADING",
    },
  };
  const document = {
    sourceDocumentId: fingerprint,
    pageContent,
    pageMap: [
      { pageNumber: 1, start: 0, end: firstPage.length },
      {
        pageNumber: 2,
        start: secondPageStart,
        end: pageContent.length,
      },
    ],
    pdfExtraction: {
      schemaVersion: 1,
      complete: true,
      totalPages: 2,
      processedPages: 2,
    },
  };
  const worksheet = {
    schemaVersion: 2,
    candidateOnly: true,
    document: {
      sourceDocumentId: fingerprint,
      fingerprint,
      physicalPages: 2,
      pageContentLength: pageContent.length,
      pageContentSha256: crypto
        .createHash("sha256")
        .update(pageContent)
        .digest("hex"),
      pageBoundaries: [
        {
          physicalPageNumber: 1,
          documentStart: 0,
          documentEnd: firstPage.length,
        },
        {
          physicalPageNumber: 2,
          documentStart: secondPageStart,
          documentEnd: pageContent.length,
        },
      ],
    },
    requirements: [
      {
        id: "FE-C01",
        components: [{ id: "cleanup_costs", occurrences: [occurrence] }],
      },
    ],
  };
  return {
    documentArtifact: { schemaVersion: 1, fingerprint, document },
    worksheet,
    occurrence,
    secondPage,
    secondPageStart,
  };
}

function multiScopeFixture() {
  const fingerprint = "c".repeat(64);
  const heading = [
    "2. Versicherungsumfang Feuer-, Sturm-, Leitungswasser- und Gebäude- und",
    "Grundstückshaftpflichtversicherung",
  ].join("\n");
  const occurrenceText = "Feuerlöschkosten";
  const pageContent = `${heading}\n${occurrenceText} sind bis 15 % mitversichert.`;
  const occurrenceStart = pageContent.indexOf(occurrenceText);
  const occurrence = {
    candidateId: "candidate:multi-scope-fe-cost",
    pageNumber: 1,
    physicalPageNumber: 1,
    pageStart: occurrenceStart,
    pageEnd: occurrenceStart + occurrenceText.length,
    documentStart: occurrenceStart,
    documentEnd: occurrenceStart + occurrenceText.length,
    exactText: occurrenceText,
    context: {
      unitType: "PARAGRAPH",
      pageStart: occurrenceStart,
      pageEnd: pageContent.length,
      documentStart: occurrenceStart,
      documentEnd: pageContent.length,
      text: pageContent.slice(occurrenceStart),
    },
    pageScopeHints: [],
    sectionScopeHint: {
      scopeKey: null,
      scopeKeys: [
        "FEUER_INSURANCE",
        "HAFTPFLICHT_INSURANCE",
        "LEITUNGSWASSER_INSURANCE",
        "STURM_INSURANCE",
      ],
      scopeResolution:
        "SOURCE_BOUND_MULTILINE_COMBINED_INSURANCE_HEADING_V1",
      text: heading,
      pageStart: 0,
      pageEnd: heading.length,
      physicalPageNumber: 1,
      source: "CURRENT_PAGE_HEADING",
    },
  };
  const document = {
    sourceDocumentId: fingerprint,
    pageContent,
    pageMap: [{ pageNumber: 1, start: 0, end: pageContent.length }],
    pdfExtraction: {
      schemaVersion: 1,
      complete: true,
      totalPages: 1,
      processedPages: 1,
    },
  };
  const worksheet = {
    schemaVersion: 2,
    candidateOnly: true,
    document: {
      sourceDocumentId: fingerprint,
      fingerprint,
      physicalPages: 1,
      pageContentLength: pageContent.length,
      pageContentSha256: crypto
        .createHash("sha256")
        .update(pageContent)
        .digest("hex"),
      pageBoundaries: [
        {
          physicalPageNumber: 1,
          documentStart: 0,
          documentEnd: pageContent.length,
        },
      ],
    },
    requirements: [
      {
        id: "FE-D01",
        components: [
          { id: "firefighting_costs", occurrences: [occurrence] },
        ],
      },
    ],
  };
  return {
    documentArtifact: { schemaVersion: 1, fingerprint, document },
    worksheet,
    occurrence,
  };
}

describe("artifact-backed source scope", () => {
  test("retains only exact section and page hints from the bound source", () => {
    const { documentArtifact, worksheet, occurrence } = fixture();
    const resolver = createArtifactBackedSourceScopeResolver({
      worksheet,
      documentArtifact,
    });
    const resolved = resolver.resolveOccurrence(occurrence);

    expect(resolver.contractId).toBe(ARTIFACT_BACKED_SOURCE_SCOPE_CONTRACT_ID);
    expect(resolved).not.toBe(occurrence);
    expect(resolved.sectionScopeHint).toEqual(occurrence.sectionScopeHint);
    expect(resolved.pageScopeHints).toEqual(occurrence.pageScopeHints);
    expect(sourceBoundSectionScopeKeys(resolved)).toEqual(["FEUER_INSURANCE"]);
  });

  test("accepts an exact preceding-page heading for a later occurrence", () => {
    const base = fixture();
    const occurrenceText = "Abbruchkosten";
    const localStart = base.secondPage.indexOf(occurrenceText);
    const occurrence = {
      ...base.occurrence,
      candidateId: "candidate:fe-abbruch",
      pageNumber: 2,
      physicalPageNumber: 2,
      pageStart: localStart,
      pageEnd: localStart + occurrenceText.length,
      documentStart: base.secondPageStart + localStart,
      documentEnd: base.secondPageStart + localStart + occurrenceText.length,
      exactText: occurrenceText,
      context: {
        unitType: "PARAGRAPH",
        pageStart: 0,
        pageEnd: base.secondPage.length,
        documentStart: base.secondPageStart,
        documentEnd: base.secondPageStart + base.secondPage.length,
        text: base.secondPage,
      },
      pageScopeHints: [],
      sectionScopeHint: {
        ...base.occurrence.sectionScopeHint,
        source: "PRECEDING_PAGE_HEADING",
      },
    };
    base.worksheet.requirements[0].components[0].occurrences = [occurrence];

    expect(
      createArtifactBackedSourceScopeResolver(base).resolveOccurrence(
        occurrence
      ).sectionScopeHint
    ).toEqual(occurrence.sectionScopeHint);
  });

  test("accepts a certified exact multiline multi-scope heading", () => {
    const base = multiScopeFixture();
    const resolved = createArtifactBackedSourceScopeResolver(
      base
    ).resolveOccurrence(base.occurrence);

    expect(sourceBoundSectionScopeKeys(resolved)).toEqual([
      "FEUER_INSURANCE",
      "HAFTPFLICHT_INSURANCE",
      "LEITUNGSWASSER_INSURANCE",
      "STURM_INSURANCE",
    ]);
  });

  test.each([
    ["unknown resolution", (section) => (section.scopeResolution = "UNKNOWN")],
    [
      "partial scope set",
      (section) => section.scopeKeys.splice(1, 1),
    ],
    [
      "duplicate scope key",
      (section) => section.scopeKeys.push("FEUER_INSURANCE"),
    ],
  ])("does not source-bind a multiline heading with %s", (_label, mutate) => {
    const base = multiScopeFixture();
    mutate(base.occurrence.sectionScopeHint);

    expect(sourceBoundSectionScopeKeys(base.occurrence)).toEqual([]);
  });

  test.each([
    [
      "same-length section text",
      (occurrence) => {
        occurrence.sectionScopeHint.text = "Sturmversicherung";
      },
      "SOURCE_SCOPE_SECTION_HINT_INVALID",
    ],
    [
      "shifted section offset",
      (occurrence) => {
        occurrence.sectionScopeHint.pageStart += 1;
        occurrence.sectionScopeHint.pageEnd += 1;
      },
      "SOURCE_SCOPE_SECTION_HINT_INVALID",
    ],
    [
      "invented page title",
      (occurrence) => {
        occurrence.pageScopeHints[0].text = "Die Sturmversicherung";
        occurrence.pageScopeHints[0].pageEnd =
          occurrence.pageScopeHints[0].text.length;
      },
      "SOURCE_SCOPE_PAGE_HINT_INVALID",
    ],
    [
      "altered occurrence context",
      (occurrence) => {
        occurrence.context.text = occurrence.context.text.replace(
          "Feuerversicherung",
          "Sturmversicherung"
        );
      },
      "SOURCE_SCOPE_OCCURRENCE_RANGE_INVALID",
    ],
  ])("fails closed for %s", (_label, mutate, expectedCode) => {
    const base = fixture();
    mutate(base.occurrence);
    const resolver = createArtifactBackedSourceScopeResolver(base);

    expect(() => resolver.resolveOccurrence(base.occurrence)).toThrow(
      expectedCode
    );
  });

  test("rejects a document artifact that does not match the worksheet hash", () => {
    const base = fixture();
    base.documentArtifact.document.pageContent += " manipuliert";

    expect(() => createArtifactBackedSourceScopeResolver(base)).toThrow(
      "SOURCE_SCOPE_DOCUMENT_BINDING_INVALID"
    );
  });

  test("rejects an occurrence not owned by the bound worksheet", () => {
    const base = fixture();
    const resolver = createArtifactBackedSourceScopeResolver(base);

    expect(() =>
      resolver.resolveOccurrence({
        ...base.occurrence,
        candidateId: "candidate:foreign",
      })
    ).toThrow("SOURCE_SCOPE_OCCURRENCE_OWNERSHIP_INVALID");
  });
});

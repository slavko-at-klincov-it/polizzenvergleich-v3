const crypto = require("crypto");
const {
  buildLw20DefaultExclusionSourceAudit,
  validPersistedLw20DefaultExclusionSourceAudit,
} = require("../../utils/policyAnalysis/lw20DefaultExclusionSourceAudit");

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function sourceFixture({
  itemC = "c) durch Grundwasser, Sickerwasser oder Stauwasser;",
  sectionText = "Allgemeine Bedingungen für die Leitungswasserversicherung",
  governorText =
    "Nicht versichert sind Schäden, so ferne nicht anders vereinbart:",
} = {}) {
  const pageText = [
    sectionText,
    "Versichert sind Schäden durch bestimmungswidrig austretendes Leitungswasser.",
    governorText,
    "a) durch andere Gefahren;",
    "b) vor Vertragsbeginn entstandene Schäden, auch wenn sie später sichtbar werden;",
    itemC,
    "d) durch Erdbeben.",
  ].join("\n");
  const exactText = "Grundwasser";
  const documentStart = pageText.indexOf(exactText);
  const candidateId = `candidate:${sha256(pageText)}`;
  const occurrence = {
    candidateId,
    matchedAlias: exactText,
    physicalPageNumber: 1,
    pageNumber: 1,
    pageStart: documentStart,
    pageEnd: documentStart + exactText.length,
    documentStart,
    documentEnd: documentStart + exactText.length,
    exactText,
    context: {
      unitType: "WORD_WINDOW_FALLBACK",
      pageStart: 0,
      pageEnd: pageText.length,
      documentStart: 0,
      documentEnd: pageText.length,
      text: pageText,
    },
    sectionScopeHint: {
      scopeKey: "LEITUNGSWASSER_INSURANCE",
      text: sectionText,
      pageStart: 0,
      pageEnd: sectionText.length,
      physicalPageNumber: 1,
      source: "CURRENT_PAGE_HEADING",
    },
    coverageGovernorHint: {
      text: governorText,
      pageStart: pageText.indexOf(governorText),
      pageEnd: pageText.indexOf(governorText) + governorText.length,
      physicalPageNumber: 1,
      source: "CURRENT_PAGE_GOVERNOR",
    },
  };
  const document = {
    uuid: "doc-lw20",
    sha256: sha256("doc-lw20"),
  };
  return {
    document,
    documentArtifact: {
      schemaVersion: 1,
      fingerprint: document.sha256,
      document: {
        sourceDocumentId: document.sha256,
        pageContent: pageText,
        pageMap: [{ pageNumber: 1, start: 0, end: pageText.length }],
        pdfExtraction: {
          totalPages: 1,
          processedPages: 1,
          pagesWithText: 1,
          complete: true,
        },
      },
    },
    requirement: {
      id: "LW-20",
      scopePolicy: "GENERAL_REQUIRED",
      componentSatisfactionPolicy: "ALL",
    },
    component: {
      id: "ground_seepage_or_retained_water",
      factRole: "PERIL",
      occurrences: [occurrence],
    },
    judgement: {
      requirementId: "LW-20",
      componentId: "ground_seepage_or_retained_water",
      evidencePresence: "FOUND",
      coverageEffect: "EXCLUDED",
      conflictState: "NONE",
      selectedScopePicture: "GENERAL",
      selectedCandidateIds: [candidateId],
      unresolvedCandidateIds: [],
    },
    target: {
      requirementId: "LW-20",
      componentId: "ground_seepage_or_retained_water",
      factRole: "PERIL",
      candidates: [
        {
          candidateId,
          candidateBinding: "DIRECT",
          deterministicBindingBasis: "EXPLICIT_NEGATIVE_CLAUSE_GOVERNOR",
          physicalPageNumber: 1,
          exactText,
          documentStart,
          documentEnd: documentStart + exactText.length,
          contextText: pageText,
          contextDocumentStart: 0,
        },
      ],
    },
  };
}

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

describe("LW-20 artifact-bound default exclusion source audit", () => {
  test("accepts the real multi-item form while ignoring a condition in sibling item b", () => {
    const fixture = sourceFixture();
    const audit = buildLw20DefaultExclusionSourceAudit(fixture);

    expect(audit).toMatchObject({
      schemaVersion: 1,
      contractId: "LW20_DEFAULT_EXCLUSION_SOURCE_AUDIT_V1",
      document: {
        uuid: fixture.document.uuid,
        sha256: fixture.document.sha256,
        physicalPageNumber: 1,
      },
      source: {
        candidateId: fixture.judgement.selectedCandidateIds[0],
        exactText: "Grundwasser",
        sectionScopeKey: "LEITUNGSWASSER_INSURANCE",
      },
    });
    expect(
      validPersistedLw20DefaultExclusionSourceAudit(audit, {
        documentUuid: fixture.document.uuid,
        documentSha256: fixture.document.sha256,
        candidateId: fixture.judgement.selectedCandidateIds[0],
      })
    ).toBe(true);
  });

  test.each([
    [
      "condition in target item",
      () =>
        sourceFixture({
          itemC:
            "c) durch Grundwasser nur bei besonderer Vereinbarung versichert;",
        }),
    ],
    [
      "positive override in target item",
      () =>
        sourceFixture({
          itemC: "c) Grundwasser ist abweichend davon mitversichert;",
        }),
    ],
    [
      "wrong insurance section",
      () => sourceFixture({ sectionText: "Allgemeine Sturmbedingungen" }),
    ],
    [
      "missing default governor",
      () => sourceFixture({ governorText: "Besondere Hinweise:" }),
    ],
  ])("rejects %s", (_label, makeFixture) => {
    expect(buildLw20DefaultExclusionSourceAudit(makeFixture())).toBeNull();
  });

  test.each([
    ["wrong scope policy", (fixture) => (fixture.requirement.scopePolicy = "ANY")],
    [
      "duplicate target candidate",
      (fixture) => fixture.target.candidates.push(copy(fixture.target.candidates[0])),
    ],
    [
      "duplicate worksheet occurrence",
      (fixture) => fixture.component.occurrences.push(copy(fixture.component.occurrences[0])),
    ],
    [
      "candidate offset mismatch",
      (fixture) => (fixture.target.candidates[0].documentStart += 1),
    ],
    [
      "document SHA mismatch",
      (fixture) => (fixture.documentArtifact.fingerprint = "f".repeat(64)),
    ],
  ])("fails closed for %s", (_label, mutate) => {
    const fixture = sourceFixture();
    mutate(fixture);
    expect(buildLw20DefaultExclusionSourceAudit(fixture)).toBeNull();
  });

  test("rejects persisted audit tampering and extra fields", () => {
    const fixture = sourceFixture();
    const original = buildLw20DefaultExclusionSourceAudit(fixture);
    const mutations = [
      (audit) => (audit.source.itemPageStart += 1),
      (audit) => (audit.source.candidateId = "candidate:other"),
      (audit) => (audit.document.sha256 = "f".repeat(64)),
      (audit) => (audit.uncontracted = true),
    ];
    for (const mutate of mutations) {
      const audit = copy(original);
      mutate(audit);
      expect(
        validPersistedLw20DefaultExclusionSourceAudit(audit, {
          documentUuid: fixture.document.uuid,
          documentSha256: fixture.document.sha256,
          candidateId: fixture.judgement.selectedCandidateIds[0],
        })
      ).toBe(false);
    }
  });
});

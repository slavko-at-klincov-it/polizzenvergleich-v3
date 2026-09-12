const ExcelJS = require("exceljs");
const {
  CANDIDATE_HEADERS,
  INDEPENDENCE_ATTESTATION,
  MAX_WORKBOOK_BYTES,
  REVIEW_HEADERS,
  expectedCandidateRows,
  expectedReviewRow,
  importReviewerWorkbook,
  loadReviewWorkbook,
} = require("../../../utils/policyAnalysis/aDrivenLegacyReviewWorkbook");

function candidate(id, label, page = 2) {
  return {
    dynamicRequirementId: `AR-${id}`,
    dynamicRequirementLabel: `Anforderung ${label}`,
    dynamicComponentId: `AC-${id}`,
    dynamicComponentType: "PERIL",
    dynamicComponentLabel: label,
    sourceEvidence: [
      { physicalPageNumber: page, exactText: `Dynamic Beleg ${label}` },
    ],
    contextKind: "EXACT_COMPONENT_SOURCE_OVERLAP",
  };
}

function record(index, candidates) {
  return {
    recordId: `DR-${index}`,
    legacyRequirementId: `PR-${index}`,
    legacyRequirementLabel: `Legacy Anforderung ${index}`,
    legacyComponentId: `legacy-${index}`,
    legacyComponentLabel: `Legacy Komponente ${index}`,
    legacyFactRole: "PERIL",
    sourceEvidence: [
      { physicalPageNumber: index + 1, exactText: `Legacy Beleg ${index}` },
    ],
    candidates,
    mechanicalRoleReview: {
      disposition:
        candidates.length === 1 ? "ONE_TO_ONE_CANDIDATE" : "SPLIT_CANDIDATE",
    },
  };
}

function fixture() {
  const draft = {
    basisSha256: "a".repeat(64),
    draftSha256: "b".repeat(64),
    records: [
      record(1, [candidate("one", "Feuer")]),
      record(2, [candidate("two", "Sturm"), candidate("three", "Hagel")]),
    ],
  };
  const input = {
    contractId: "LF_A_V12_283_631_REVIEW_INPUT_V2",
    basisSha256: draft.basisSha256,
    draftSha256: draft.draftSha256,
    registrySha256: "c".repeat(64),
    reviewerSlot: "A",
    reviewerId: "reviewer-a",
    reviewerKind: "HUMAN_DOMAIN_EXPERT",
    reviewOrigin: "HUMAN_REVIEW",
    modelOrAutomationIdentity: null,
    independenceAttestation: {
      otherReviewerDecisionArtifactSeenBeforeSubmission: false,
      reviewPerformedIndependently: false,
    },
    decisions: draft.records.map(({ recordId }) => ({
      recordId,
      relation: "UNREVIEWED",
      dynamicTargets: [],
      mergeGroupId: null,
      rootCauseDisposition: "UNREVIEWED",
      rationale: "",
    })),
  };
  return { draft, input };
}

function workbookFixture(draft, input) {
  const workbook = new ExcelJS.Workbook();
  const guide = workbook.addWorksheet("Anleitung");
  guide.getCell("B9").value = draft.basisSha256;
  guide.getCell("B10").value = draft.draftSha256;
  guide.getCell("B22").value = INDEPENDENCE_ATTESTATION;
  guide.getCell("B23").value = input.reviewerSlot;
  guide.getCell("B24").value = input.reviewerId;

  const review = workbook.addWorksheet("Review");
  REVIEW_HEADERS.forEach((value, index) => {
    review.getCell(5, index + 1).value = value;
  });
  draft.records.forEach((item, index) => {
    expectedReviewRow(item, index).forEach((value, column) => {
      review.getCell(6 + index, column + 1).value = value;
    });
  });
  review.getCell("L6").value = "EQUIVALENT";
  review.getCell("M6").value = "AC-one";
  review.getCell("O6").value = "NO_UPSTREAM_DEFECT";
  review.getCell("P6").value = "Inhalt und Rolle stimmen überein.";
  review.getCell("L7").value = "SPLIT_INTO_DYNAMIC";
  review.getCell("M7").value = "AC-three; AC-two";
  review.getCell("O7").value = "SPLIT_OR_MERGE_RELATION";
  review.getCell("P7").value = "Zwei getrennte Gefahrenkomponenten.";

  const candidates = workbook.addWorksheet("Kandidaten");
  CANDIDATE_HEADERS.forEach((value, index) => {
    candidates.getCell(4, index + 1).value = value;
  });
  expectedCandidateRows(draft).forEach((row, rowIndex) => {
    row.forEach((value, column) => {
      candidates.getCell(5 + rowIndex, column + 1).value = value;
    });
  });
  return workbook;
}

describe("A-driven legacy review workbook", () => {
  test("imports complete, independently attested decisions without signing or approving", () => {
    const { draft, input } = fixture();
    const result = importReviewerWorkbook({
      workbook: workbookFixture(draft, input),
      draft,
      input,
    });
    expect(result.independenceAttestation).toEqual({
      otherReviewerDecisionArtifactSeenBeforeSubmission: false,
      reviewPerformedIndependently: true,
    });
    expect(result.decisions).toEqual([
      {
        recordId: "DR-1",
        relation: "EQUIVALENT",
        dynamicTargets: ["AC-one"],
        mergeGroupId: null,
        rootCauseDisposition: "NO_UPSTREAM_DEFECT",
        rationale: "Inhalt und Rolle stimmen überein.",
      },
      {
        recordId: "DR-2",
        relation: "SPLIT_INTO_DYNAMIC",
        dynamicTargets: ["AC-three", "AC-two"],
        mergeGroupId: null,
        rootCauseDisposition: "SPLIT_OR_MERGE_RELATION",
        rationale: "Zwei getrennte Gefahrenkomponenten.",
      },
    ]);
    expect(result).not.toHaveProperty("signature");
    expect(result).not.toHaveProperty("status");
  });

  test.each([
    [
      "review evidence",
      (workbook) =>
        (workbook.getWorksheet("Review").getCell("H6").value = "manipuliert"),
    ],
    [
      "candidate evidence",
      (workbook) =>
        (workbook.getWorksheet("Kandidaten").getCell("L5").value =
          "manipuliert"),
    ],
    [
      "draft binding",
      (workbook) =>
        (workbook.getWorksheet("Anleitung").getCell("B10").value = "f".repeat(
          64
        )),
    ],
  ])("rejects mutated %s", (_name, mutate) => {
    const { draft, input } = fixture();
    const workbook = workbookFixture(draft, input);
    mutate(workbook);
    expect(() => importReviewerWorkbook({ workbook, draft, input })).toThrow(
      /LF_A_REVIEW_WORKBOOK_(EVIDENCE_MUTATED|DRAFT_BINDING_INVALID)/u
    );
  });

  test("rejects formulas in human decision cells", () => {
    const { draft, input } = fixture();
    const workbook = workbookFixture(draft, input);
    workbook.getWorksheet("Review").getCell("P6").value = {
      formula: '="looks human"',
      result: "looks human",
    };
    expect(() => importReviewerWorkbook({ workbook, draft, input })).toThrow(
      "LF_A_REVIEW_WORKBOOK_CELL_TYPE_INVALID:Review!P6"
    );
  });

  test("rejects a foreign target and invalid relation cardinality fail-closed", () => {
    const { draft, input } = fixture();
    const workbook = workbookFixture(draft, input);
    workbook.getWorksheet("Review").getCell("M6").value = "AC-foreign";
    expect(() => importReviewerWorkbook({ workbook, draft, input })).toThrow(
      "LF_A_DOUBLE_REVIEW_DECISION_INVALID:DR-1"
    );
  });

  test("requires explicit identity-bound independence attestation", () => {
    const { draft, input } = fixture();
    const workbook = workbookFixture(draft, input);
    workbook.getWorksheet("Anleitung").getCell("B22").value = "ja";
    expect(() => importReviewerWorkbook({ workbook, draft, input })).toThrow(
      "LF_A_REVIEW_WORKBOOK_ATTESTATION_INVALID"
    );
  });

  test("rejects reused or non-pristine reviewer templates", () => {
    const { draft, input } = fixture();
    input.decisions[0].relation = "EQUIVALENT";
    expect(() =>
      importReviewerWorkbook({
        workbook: workbookFixture(draft, input),
        draft,
        input,
      })
    ).toThrow("LF_A_REVIEW_WORKBOOK_TEMPLATE_NOT_PRISTINE");
  });

  test("rejects extra review and candidate rows", () => {
    const { draft, input } = fixture();
    const reviewWorkbook = workbookFixture(draft, input);
    reviewWorkbook.getWorksheet("Review").getCell("B8").value = "DR-extra";
    expect(() =>
      importReviewerWorkbook({ workbook: reviewWorkbook, draft, input })
    ).toThrow("LF_A_REVIEW_WORKBOOK_EXTRA_ROW:Review!B8");

    const candidateWorkbook = workbookFixture(draft, input);
    candidateWorkbook.getWorksheet("Kandidaten").getCell("A8").value =
      "DR-extra";
    expect(() =>
      importReviewerWorkbook({ workbook: candidateWorkbook, draft, input })
    ).toThrow("LF_A_REVIEW_WORKBOOK_EXTRA_ROW:Kandidaten!A8");
  });

  test("loads valid XLSX bytes and rejects invalid or oversized payloads", async () => {
    const { draft, input } = fixture();
    const bytes = await workbookFixture(draft, input).xlsx.writeBuffer();
    await expect(loadReviewWorkbook(Buffer.from(bytes))).resolves.toBeDefined();
    await expect(loadReviewWorkbook(Buffer.from("not xlsx"))).rejects.toThrow(
      "LF_A_REVIEW_WORKBOOK_XLSX_INVALID"
    );
    await expect(
      loadReviewWorkbook(Buffer.alloc(MAX_WORKBOOK_BYTES + 1))
    ).rejects.toThrow("LF_A_REVIEW_WORKBOOK_TOO_LARGE");
  });
});

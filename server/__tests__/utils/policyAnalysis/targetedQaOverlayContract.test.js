const {
  materializeTargetedQaCategoryOverlay,
} = require("../../../utils/policyAnalysis/targetedQaOverlayContract");
const {
  selectionDigest,
} = require("../../../utils/policyAnalysis/targetRequirementSelection");

const DOCUMENT = Object.freeze({
  uuid: "document-01",
  sha256: "a".repeat(64),
  documentStatus: "FRAMEWORK_TERMS",
});

function occurrence(candidateId) {
  return {
    candidateId,
    exactText: "Sturmdeckung",
    pageNumber: 1,
    physicalPageNumber: 1,
  };
}

function requirement(id, occurrences = []) {
  return {
    id,
    label: id,
    requestedFields: [],
    scopeRules: { narrowAliases: [], narrowScopeKeys: [] },
    scopePolicy: "GENERAL_REQUIRED",
    componentSatisfactionPolicy: "ALL",
    coverageAggregationPolicy: "ALL_COMPONENT_EFFECTS",
    componentCount: 1,
    components: [
      {
        id: "coverage",
        label: "Coverage",
        factRole: "BENEFIT",
        contextMode: "SENTENCE_OR_LIST_ITEM",
        aliases: [id],
        terminalState:
          occurrences.length > 0
            ? "CONTROLLED_CANDIDATES_FOUND"
            : "NO_CONTROLLED_CANDIDATE",
        occurrenceCount: occurrences.length,
        occurrences,
      },
    ],
  };
}

function selection(requirementIds) {
  const digestContract = {
    schemaVersion: 1,
    contractId: "QA_TARGET_REQUIREMENT_SELECTION_V1",
    catalogId: "st",
    categoryView: "ST",
    requirementIds,
    requirementContracts: requirementIds.map((requirementId) => ({
      requirementId,
      searchContractDigestSha256: requirementId
        .replace(/[^0-9]/gu, "")
        .padStart(64, "0"),
    })),
  };
  return {
    ...digestContract,
    requirementCount: requirementIds.length,
    selectionDigestSha256: selectionDigest(digestContract),
  };
}

function worksheet(requirements, targeted = false) {
  return {
    schemaVersion: 1,
    candidateOnly: true,
    catalog: { id: "st", categoryView: "ST", schemaVersion: 1 },
    document: {
      sourceDocumentId: DOCUMENT.sha256,
      fingerprint: DOCUMENT.sha256,
      physicalPages: 1,
      pageContentSha256: "b".repeat(64),
    },
    summary: {},
    bindingGroups: [],
    requirements,
    ...(targeted
      ? {
          targetRequirementSelection: selection(
            requirements.map(({ id }) => id)
          ),
        }
      : {}),
  };
}

function target(requirementId, candidates = []) {
  return {
    targetId: `prepared-target:${requirementId}:coverage`,
    categoryView: "ST",
    requirementId,
    requirementLabel: requirementId,
    componentId: "coverage",
    componentLabel: "Coverage",
    factRole: "BENEFIT",
    documentStatus: DOCUMENT.documentStatus,
    candidates: candidates.map((candidateId) => ({
      candidateId,
      physicalPageNumber: 1,
      exactText: "Sturmdeckung",
    })),
    serverRejectedCandidates: [],
    unresolvedCandidateIds: [],
  };
}

function judgement(requirementId, coverageEffect, selectedCandidateIds = []) {
  const missing = coverageEffect === "UNKNOWN";
  return {
    targetId: `prepared-target:${requirementId}:coverage`,
    requirementId,
    componentId: "coverage",
    selectedCandidateIds,
    unresolvedCandidateIds: [],
    evidencePresence: missing ? "NOT_FOUND" : "FOUND",
    coverageEffect,
    conflictState: "NONE",
    selectedScopePicture: missing ? "UNKNOWN" : "GENERAL",
    documentApplicability: missing ? "UNKNOWN" : "CONDITIONAL",
    decisionOwner: missing ? "SERVER" : "MODEL",
  };
}

function row(categoryId, marker) {
  return { categoryId, categoryName: categoryId, marker };
}

function requested(requirementId, marker) {
  return {
    requirementId,
    requestedFields: [],
    requestedFieldStatus: "NOT_EVALUATED",
    fields: [],
    marker,
  };
}

function targetedReport(targeted, requirementIds = ["ST-02"]) {
  return {
    schemaVersion: 1,
    contractId: "TARGETED_QA_CATEGORY_RESULT_V1",
    runKind: "TARGETED_QA_ONLY",
    status: "TECHNICAL_PASS_REVIEW_REQUIRED",
    categoryView: "ST",
    document: DOCUMENT,
    requirementIds,
    rowCount: requirementIds.length,
    tableContract: { pass: true },
    outputSemanticDigests: {
      rowsSha256: selectionDigest(targeted.rows),
      requestedFieldsSha256: selectionDigest(targeted.requestedFields),
    },
  };
}

function validInput() {
  const ids = ["ST-01", "ST-02", "ST-03"];
  const baselineTargets = ids.map((id) => target(id));
  const baselineJudgements = ids.map((id) => judgement(id, "UNKNOWN"));
  const targetedCandidate = occurrence("targeted-candidate");
  const targeted = {
    rows: [row("ST-02", "targeted")],
    worksheet: worksheet([requirement("ST-02", [targetedCandidate])], true),
    targets: [target("ST-02", [targetedCandidate.candidateId])],
    materializedEvidence: {
      judgements: [
        judgement("ST-02", "EXCLUDED", [targetedCandidate.candidateId]),
      ],
      rollups: [],
    },
    requestedFields: {
      requirements: [requested("ST-02", "targeted")],
    },
  };
  targeted.report = targetedReport(targeted);
  return {
    categoryView: "ST",
    targetRequirementIds: ["ST-02"],
    document: DOCUMENT,
    baseline: {
      rows: ids.map((id) => row(id, "baseline")),
      worksheet: worksheet(ids.map((id) => requirement(id))),
      targets: baselineTargets,
      materializedEvidence: {
        judgements: baselineJudgements,
        rollups: [],
      },
      requestedFields: {
        requirements: ids.map((id) => requested(id, "baseline")),
      },
    },
    targeted,
  };
}

describe("targeted QA category overlay contract", () => {
  test("replaces only selected requirements and recomputes full rollups", () => {
    const input = validInput();
    const result = materializeTargetedQaCategoryOverlay(input);

    expect(result.rows.map(({ marker }) => marker)).toEqual([
      "baseline",
      "targeted",
      "baseline",
    ]);
    expect(
      result.requestedFields.requirements.map(({ marker }) => marker)
    ).toEqual(["baseline", "targeted", "baseline"]);
    expect(result.materializedEvidence.judgements).toEqual([
      input.baseline.materializedEvidence.judgements[0],
      input.targeted.materializedEvidence.judgements[0],
      input.baseline.materializedEvidence.judgements[2],
    ]);
    expect(result.materializedEvidence.rollups).toHaveLength(3);
    expect(result.worksheet.summary).toEqual({
      requirementCount: 3,
      componentCount: 3,
      componentsWithCandidates: 1,
      componentsWithoutCandidates: 2,
      occurrenceCount: 1,
    });
    expect(result.worksheet).not.toHaveProperty("targetRequirementSelection");
  });

  test("rejects a targeted artifact that owns an unselected requirement", () => {
    const input = validInput();
    input.targeted.rows = [row("ST-01", "wrong")];
    input.targeted.report = targetedReport(input.targeted);
    expect(() => materializeTargetedQaCategoryOverlay(input)).toThrow(
      "TARGETED_OVERLAY_ROWS_INVALID_TARGET_SET_MISMATCH"
    );
  });

  test("rejects a targeted worksheet from another document", () => {
    const input = validInput();
    input.targeted.worksheet.document.fingerprint = "c".repeat(64);
    expect(() => materializeTargetedQaCategoryOverlay(input)).toThrow(
      "TARGETED_OVERLAY_WORKSHEET_DOCUMENT_MISMATCH"
    );
  });

  test("rejects a malformed target-selection digest", () => {
    const input = validInput();
    input.targeted.worksheet.targetRequirementSelection.selectionDigestSha256 =
      "0".repeat(64);
    expect(() => materializeTargetedQaCategoryOverlay(input)).toThrow(
      "TARGET_REQUIREMENT_SELECTION_DIGEST_MISMATCH"
    );
  });

  test("rejects a target candidate absent from its worksheet", () => {
    const input = validInput();
    input.targeted.targets[0].candidates[0].candidateId = "invented";
    input.targeted.materializedEvidence.judgements[0].selectedCandidateIds = [
      "invented",
    ];
    expect(() => materializeTargetedQaCategoryOverlay(input)).toThrow(
      "TARGETED_OVERLAY_TARGET_CHAIN_CANDIDATE_PARTITION"
    );
  });

  test("rejects rows changed after the validated result report", () => {
    const input = validInput();
    input.targeted.rows[0].marker = "tampered";
    expect(() => materializeTargetedQaCategoryOverlay(input)).toThrow(
      "TARGETED_OVERLAY_RESULT_REPORT_MISMATCH"
    );
  });

  test("rejects a baseline that silently omits a non-target row", () => {
    const input = validInput();
    input.baseline.rows = input.baseline.rows.filter(
      ({ categoryId }) => categoryId !== "ST-03"
    );
    expect(() => materializeTargetedQaCategoryOverlay(input)).toThrow(
      "TARGETED_OVERLAY_ROWS_INVALID_BASELINE_SET_MISMATCH"
    );
  });
});

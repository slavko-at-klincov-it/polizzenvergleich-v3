const {
  materializeTargetedQaCategoryOverlay,
} = require("../../../utils/policyAnalysis/targetedQaOverlayContract");

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

function target(requirementId, candidates = []) {
  return {
    targetId: `target:${requirementId}:coverage`,
    categoryView: "ST",
    requirementId,
    requirementLabel: requirementId,
    componentId: "coverage",
    componentLabel: "Coverage",
    factRole: "BENEFIT",
    documentStatus: "POLICY",
    candidates,
    serverRejectedCandidates: [],
    unresolvedCandidateIds: [],
  };
}

function judgement(requirementId, coverageEffect) {
  const missing = coverageEffect === "UNKNOWN";
  return {
    targetId: `target:${requirementId}:coverage`,
    requirementId,
    componentId: "coverage",
    selectedCandidateIds: missing ? [] : ["targeted"],
    unresolvedCandidateIds: [],
    evidencePresence: missing ? "NOT_FOUND" : "FOUND",
    coverageEffect,
    conflictState: "NONE",
    selectedScopePicture: missing ? "UNKNOWN" : "GENERAL",
    documentApplicability: missing ? "UNKNOWN" : "APPLICABLE",
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

function worksheet(requirements, targeted = false) {
  return {
    schemaVersion: 1,
    candidateOnly: true,
    catalog: { id: "st", categoryView: "ST", schemaVersion: 1 },
    document: { sourceDocumentId: "doc", fingerprint: "a".repeat(64) },
    summary: {},
    bindingGroups: requirements.map(({ id }) => ({
      id: `binding:${id}`,
      requirementId: id,
      type: "SHARED_SPAN",
      candidateIds: [],
    })),
    requirements,
    ...(targeted
      ? {
          targetRequirementSelection: {
            requirementIds: requirements.map(({ id }) => id),
          },
        }
      : {}),
  };
}

describe("targeted QA category overlay contract", () => {
  test("replaces only selected requirements and recomputes full rollups", () => {
    const ids = ["ST-01", "ST-02", "ST-03"];
    const baselineTargets = ids.map((id) => target(id));
    const baselineJudgements = ids.map((id) => judgement(id, "UNKNOWN"));
    const targetedTargets = [target("ST-02", [{ candidateId: "targeted" }])];
    const targetedJudgements = [judgement("ST-02", "EXCLUDED")];
    const result = materializeTargetedQaCategoryOverlay({
      categoryView: "ST",
      targetRequirementIds: ["ST-02"],
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
      targeted: {
        rows: [row("ST-02", "targeted")],
        worksheet: worksheet([requirement("ST-02")], true),
        targets: targetedTargets,
        materializedEvidence: {
          judgements: targetedJudgements,
          rollups: [],
        },
        requestedFields: {
          requirements: [requested("ST-02", "targeted")],
        },
      },
    });

    expect(result.rows.map(({ marker }) => marker)).toEqual([
      "baseline",
      "targeted",
      "baseline",
    ]);
    expect(
      result.requestedFields.requirements.map(({ marker }) => marker)
    ).toEqual(["baseline", "targeted", "baseline"]);
    expect(result.materializedEvidence.judgements).toEqual([
      baselineJudgements[0],
      targetedJudgements[0],
      baselineJudgements[2],
    ]);
    expect(result.materializedEvidence.rollups).toHaveLength(3);
    expect(result.worksheet.summary).toEqual({
      requirementCount: 3,
      componentCount: 3,
      componentsWithCandidates: 0,
      componentsWithoutCandidates: 3,
      occurrenceCount: 0,
    });
    expect(result.worksheet).not.toHaveProperty("targetRequirementSelection");
    expect(result.worksheet.bindingGroups.map(({ id }) => id)).toEqual([
      "binding:ST-01",
      "binding:ST-02",
      "binding:ST-03",
    ]);
  });

  test("rejects a targeted artifact that owns an unselected requirement", () => {
    expect(() =>
      materializeTargetedQaCategoryOverlay({
        categoryView: "ST",
        targetRequirementIds: ["ST-02"],
        baseline: {
          rows: [row("ST-01", "baseline"), row("ST-02", "baseline")],
          worksheet: worksheet([requirement("ST-01"), requirement("ST-02")]),
          targets: [target("ST-01"), target("ST-02")],
          materializedEvidence: {
            judgements: [
              judgement("ST-01", "UNKNOWN"),
              judgement("ST-02", "UNKNOWN"),
            ],
          },
          requestedFields: {
            requirements: [
              requested("ST-01", "baseline"),
              requested("ST-02", "baseline"),
            ],
          },
        },
        targeted: {
          rows: [row("ST-01", "wrong")],
          worksheet: worksheet([requirement("ST-02")], true),
          targets: [target("ST-02")],
          materializedEvidence: {
            judgements: [judgement("ST-02", "UNKNOWN")],
          },
          requestedFields: {
            requirements: [requested("ST-02", "targeted")],
          },
        },
      })
    ).toThrow("TARGETED_OVERLAY_ROWS_INVALID_TARGET_SET_MISMATCH");
  });
});

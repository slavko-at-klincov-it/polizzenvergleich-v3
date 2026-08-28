const {
  buildTechnicalReviewControlSet,
  evaluatePreparedEvidenceControls,
} = require("../../../utils/policyAnalysis/preparedEvidenceControls");

const MATERIALIZED = {
  judgements: [
    {
      requirementId: "EL-16",
      componentId: "winter_garden",
      evidencePresence: "FOUND",
      coverageEffect: "INCLUDED",
      documentApplicability: "CONDITIONAL",
    },
  ],
};
const SOURCES = [
  {
    requirementId: "EL-16",
    componentId: "winter_garden",
    physicalPageNumber: 15,
  },
];

describe("preparedEvidenceControls", () => {
  test("builds exhaustive REVIEW_REQUIRED controls without claiming fachliche approval", () => {
    const controlSet = buildTechnicalReviewControlSet({
      worksheet: {
        requirements: [
          {
            id: "VS-16",
            components: [{ id: "garage" }, { id: "underground_garage" }],
          },
        ],
      },
      controlSetId: "vs-full-discovery",
    });

    expect(controlSet).toMatchObject({
      schemaVersion: 1,
      controlSetId: "vs-full-discovery",
      reviewStatus: "REVIEW_REQUIRED",
    });
    expect(controlSet.controls).toHaveLength(2);
    expect(controlSet.controls[0]).toMatchObject({
      requirementId: "VS-16",
      componentId: "garage",
      allowedEvidencePresence: ["FOUND", "NOT_FOUND"],
    });
  });

  test("passes only when values and required/forbidden physical pages agree", () => {
    const [result] = evaluatePreparedEvidenceControls({
      materialized: MATERIALIZED,
      sources: SOURCES,
      controlSet: {
        schemaVersion: 1,
        controls: [
          {
            id: "winter",
            requirementId: "EL-16",
            componentId: "winter_garden",
            allowedEvidencePresence: ["FOUND"],
            allowedCoverageEffects: ["INCLUDED"],
            allowedApplicabilities: ["CONDITIONAL"],
            requiredPhysicalPages: [15],
            forbiddenPhysicalPages: [16],
          },
        ],
      },
    });

    expect(result).toMatchObject({
      id: "winter",
      pass: true,
      observedPhysicalPages: [15],
    });
  });

  test("fails a source on a forbidden neighboring page", () => {
    const [result] = evaluatePreparedEvidenceControls({
      materialized: MATERIALIZED,
      sources: [...SOURCES, { ...SOURCES[0], physicalPageNumber: 18 }],
      controlSet: {
        schemaVersion: 1,
        controls: [
          {
            id: "scope-negative",
            requirementId: "EL-16",
            componentId: "winter_garden",
            allowedEvidencePresence: ["FOUND"],
            allowedCoverageEffects: ["INCLUDED"],
            allowedApplicabilities: ["CONDITIONAL"],
            forbiddenPhysicalPages: [18],
          },
        ],
      },
    });

    expect(result.pass).toBe(false);
  });

  test("accepts one reviewer-approved alternative evidence page", () => {
    const [result] = evaluatePreparedEvidenceControls({
      materialized: MATERIALIZED,
      sources: SOURCES,
      controlSet: {
        schemaVersion: 1,
        controls: [
          {
            id: "alternative-page",
            requirementId: "EL-16",
            componentId: "winter_garden",
            allowedEvidencePresence: ["FOUND"],
            allowedCoverageEffects: ["INCLUDED"],
            allowedApplicabilities: ["CONDITIONAL"],
            requiredAnyPhysicalPages: [10, 15],
          },
        ],
      },
    });

    expect(result.pass).toBe(true);
  });

  test("rejects an empty control set instead of vacuously passing", () => {
    expect(() =>
      evaluatePreparedEvidenceControls({
        materialized: MATERIALIZED,
        sources: SOURCES,
        controlSet: { schemaVersion: 1, controls: [] },
      })
    ).toThrow("PREPARED_CONTROL_SET_EMPTY");
  });

  test("rejects incomplete component coverage", () => {
    expect(() =>
      evaluatePreparedEvidenceControls({
        materialized: {
          judgements: [
            ...MATERIALIZED.judgements,
            {
              requirementId: "EL-16",
              componentId: "display_case",
              evidencePresence: "FOUND",
              coverageEffect: "EXCLUDED",
              documentApplicability: "CONDITIONAL",
            },
          ],
        },
        sources: SOURCES,
        controlSet: {
          schemaVersion: 1,
          controls: [
            {
              id: "winter-only",
              requirementId: "EL-16",
              componentId: "winter_garden",
              allowedEvidencePresence: ["FOUND"],
              allowedCoverageEffects: ["INCLUDED"],
              allowedApplicabilities: ["CONDITIONAL"],
            },
          ],
        },
      })
    ).toThrow("PREPARED_CONTROL_COVERAGE_INCOMPLETE: EL-16:display_case");
  });

  test("rejects duplicate control IDs and unknown component targets", () => {
    const baseControl = {
      id: "duplicate",
      requirementId: "EL-16",
      componentId: "winter_garden",
      allowedEvidencePresence: ["FOUND"],
      allowedCoverageEffects: ["INCLUDED"],
      allowedApplicabilities: ["CONDITIONAL"],
    };
    expect(() =>
      evaluatePreparedEvidenceControls({
        materialized: MATERIALIZED,
        sources: SOURCES,
        controlSet: {
          schemaVersion: 1,
          controls: [baseControl, { ...baseControl }],
        },
      })
    ).toThrow("PREPARED_CONTROL_ID_DUPLICATE: duplicate");
    expect(() =>
      evaluatePreparedEvidenceControls({
        materialized: MATERIALIZED,
        sources: SOURCES,
        controlSet: {
          schemaVersion: 1,
          controls: [
            {
              ...baseControl,
              id: "unknown",
              componentId: "not_in_materialized",
            },
          ],
        },
      })
    ).toThrow("PREPARED_CONTROL_TARGET_UNKNOWN: EL-16:not_in_materialized");
  });
});

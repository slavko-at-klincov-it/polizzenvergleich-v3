const {
  presentComparisonError,
  presentComparisonMetrics,
  presentLfSearchStatus,
  presentPointDecision,
} = require("../../../frontend/src/utils/chat/policyComparisonResultPresenter.cjs");

describe("policy comparison result presenter", () => {
  test("maps unsupported LF structures to a customer-safe action", () => {
    expect(presentComparisonError("NEUES_LF_PROFIL_ERFORDERLICH")).toMatch(
      /neues, fachlich geprüftes LF-Profil erforderlich/
    );
    expect(
      presentComparisonError("REFERENCE_SOURCE_DOCUMENT_FINGERPRINT_MISMATCH")
    ).toMatch(/erneut hochladen/);
  });

  test("never exposes worker logs or local storage paths", () => {
    const presented = presentComparisonError(
      "DOCUMENT_ANALYSIS_FAILED: exit=1 log=/Users/private/server/storage/worker.log"
    );
    expect(presented).toMatch(/technisch nicht abgeschlossen/);
    expect(presented).not.toContain("/Users/");
    expect(presented).not.toContain("worker.log");
    expect(presentComparisonError("INTERNAL_UNKNOWN:/private/path")).toMatch(
      /Administration kontaktieren/
    );
  });

  test("presents a V2 point decision", () => {
    expect(
      presentPointDecision({
        pointDecision: {
          outcome: "VORTEIL_B",
          reason: "B ist in diesem Punkt besser.",
          ruleId: "RULE_V1",
        },
      })
    ).toMatchObject({
      outcome: "VORTEIL_B",
      label: "Vorteil Paket B",
      legacyFallback: false,
    });
  });

  test("keeps a stored V1 result fail-closed", () => {
    expect(
      presentPointDecision({ difference: "Fachlich zu prüfen." })
    ).toMatchObject({
      outcome: "UNKLAR",
      reason: "Fachlich zu prüfen.",
      ruleId: "LEGACY_FAIL_CLOSED_V1",
      legacyFallback: true,
    });
  });

  test("labels bilateral complete absence without calling it equivalent", () => {
    expect(
      presentPointDecision({
        pointDecision: {
          outcome: "KEIN_DOKUMENTIERTER_VORTEIL",
          reason: "In beiden Paketen nicht gefunden.",
          ruleId: "COMPLETE_SEARCH_ABSENCE_BOTH_V1",
        },
      })
    ).toMatchObject({
      outcome: "KEIN_DOKUMENTIERTER_VORTEIL",
      label: "In beiden Polizzen keine passende Vertragsregelung gefunden",
      legacyFallback: false,
    });
  });

  test("labels the audited bilateral absence decision as comparison equality", () => {
    expect(
      presentPointDecision({
        pointDecision: {
          outcome: "GLEICHWERTIG",
          reason:
            "Gleichwertig für diesen Vergleichspunkt: In beiden Polizzen wurde keine passende Vertragsregelung gefunden.",
          ruleId: "EQUAL_COMPLETE_CONTROLLED_ABSENCE_BOTH_V1",
        },
      })
    ).toMatchObject({
      outcome: "GLEICHWERTIG",
      label: "Gleichwertig",
      legacyFallback: false,
    });
  });

  test("labels a one-sided controlled zero match as documentation difference", () => {
    expect(
      presentPointDecision({
        pointDecision: {
          outcome: "DOKUMENTATIONSUNTERSCHIED",
          reason: "Nur in Paket A dokumentiert.",
          ruleId: "QUALIFIED_ABSENCE_DOCUMENTATION_DIFFERENCE_V1",
        },
      })
    ).toMatchObject({
      outcome: "DOKUMENTATIONSUNTERSCHIED",
      label: "Dokumentationsunterschied",
      legacyFallback: false,
    });
  });

  test("presents directed LF counterpart outcomes without symmetric wording", () => {
    const row = {
      categoryId: "LF-VS-02",
      pointDecision: {
        outcome: "TEILWEISES_GEGENSTUECK",
        reasonCode: "ONLY_PART_OF_REFERENCE_COMPONENTS_EVIDENCED_IN_B",
        reason: "Nur ein Teil ist belegt.",
        reviewRequired: true,
        ruleId: "REFERENCE_COMPONENT_COMPLETENESS_V2",
      },
    };
    expect(presentPointDecision(row)).toMatchObject({
      outcome: "TEILWEISES_GEGENSTUECK",
      label: "Teilweises Gegenstück",
      legacyFallback: false,
    });
    expect(
      presentComparisonMetrics({
        comparisonMode: "LF_IMMO_REFERENCE_A_TO_B_V1",
        categories: [{ categoryView: "LF-VS", rows: [row] }],
        totals: {
          rows: 1,
          sideBOnlyRows: 0,
          customerReviewRequired: 1,
          outcomes: { TEILWEISES_GEGENSTUECK: 1 },
        },
      })
    ).toMatchObject({
      rows: 1,
      customerReviewRequired: 1,
      pointDecisions: { TEILWEISES_GEGENSTUECK: 1 },
      searchStatuses: { GEFUNDEN: 0, NICHT_GEFUNDEN: 1 },
      storedMetricDiscrepancy: false,
    });
  });

  test("presents only binary LF search states while preserving the internal outcome", () => {
    const partial = {
      packageB: {
        documentedContent: "Teilbeleg",
        source: "B.pdf: Seite 2: Teilbeleg",
        contributors: [{ documentUuid: "b-1", source: "Seite 2: Teilbeleg" }],
      },
      outcome: "TEILWEISES_GEGENSTUECK",
      pointDecision: { outcome: "TEILWEISES_GEGENSTUECK" },
    };
    const conflicting = {
      packageB: {
        documentedContent: "Konfliktbeleg",
        source: "B.pdf: Seite 3: Konfliktbeleg",
        contributors: [
          { documentUuid: "b-1", source: "Seite 3: Konfliktbeleg" },
        ],
      },
      outcome: "GEGENSTUECK_UNKLAR",
      pointDecision: { outcome: "GEGENSTUECK_UNKLAR" },
    };
    const missing = {
      packageB: { contributors: [] },
      outcome: "GEGENSTUECK_UNKLAR",
      pointDecision: { outcome: "GEGENSTUECK_UNKLAR" },
    };

    expect(presentLfSearchStatus(partial)).toEqual({
      status: "GEFUNDEN",
      label: "Gefunden",
    });
    expect(presentLfSearchStatus(conflicting)).toEqual({
      status: "GEFUNDEN",
      label: "Gefunden",
    });
    expect(presentLfSearchStatus(missing)).toEqual({
      status: "NICHT_GEFUNDEN",
      label: "Nicht gefunden",
    });
    expect(presentPointDecision(partial).outcome).toBe(
      "TEILWEISES_GEGENSTUECK"
    );
  });

  test("recounts a V3.7.4 public LF result from visible evidence and member rows", () => {
    const result = {
      schemaVersion: 1,
      contractId: "LF_REFERENCE_CUSTOMER_PRESENTATION_V1",
      comparisonMode: "LF_IMMO_REFERENCE_A_TO_B_V1",
      categories: [
        {
          categoryView: "LR01",
          rows: [
            {
              categoryId: "A-01",
              customerSearchStatus: "GEFUNDEN",
              customerSearchStatusLabel: "Gefunden",
              packageB: {
                documentedContent: "Teilbeleg",
                source: "B.pdf: Seite 2: Teilbeleg",
                contributors: [
                  { documentUuid: "b-1", source: "Seite 2: Teilbeleg" },
                ],
              },
            },
            {
              categoryId: "A-02",
              customerSearchStatus: "NICHT_GEFUNDEN",
              customerSearchStatusLabel: "Nicht gefunden",
              packageB: { contributors: [] },
            },
          ],
        },
      ],
      totals: {
        rows: 2,
        sideBOnlyRows: 0,
        customerSearchStatuses: { GEFUNDEN: 1, NICHT_GEFUNDEN: 1 },
        customerSearchRowKeysByStatus: {
          GEFUNDEN: ["LR01:A-01"],
          NICHT_GEFUNDEN: ["LR01:A-02"],
        },
      },
    };

    expect(presentComparisonMetrics(result)).toEqual({
      rows: 2,
      customerReviewRequired: null,
      pointDecisions: {},
      searchStatuses: { GEFUNDEN: 1, NICHT_GEFUNDEN: 1 },
      searchRowKeysByStatus: {
        GEFUNDEN: ["LR01:A-01"],
        NICHT_GEFUNDEN: ["LR01:A-02"],
      },
      pointDecisionRowKeysByOutcome: {},
      customerReviewBreakdown: [],
      customerPresentation: true,
      legacyFallback: false,
      storedMetricDiscrepancy: false,
    });
  });

  test("does not trust a declared LF customer status over visible evidence", () => {
    const row = {
      categoryId: "A-01",
      customerSearchStatus: "GEFUNDEN",
      customerSearchStatusLabel: "Gefunden",
      packageB: { contributors: [] },
    };
    expect(presentLfSearchStatus(row)).toEqual({
      status: "NICHT_GEFUNDEN",
      label: "Nicht gefunden",
    });
    const metrics = presentComparisonMetrics({
      schemaVersion: 1,
      contractId: "LF_REFERENCE_CUSTOMER_PRESENTATION_V1",
      comparisonMode: "LF_IMMO_REFERENCE_A_TO_B_V1",
      categories: [{ categoryView: "LR01", rows: [row] }],
      totals: {
        rows: 1,
        sideBOnlyRows: 0,
        customerSearchStatuses: { GEFUNDEN: 1, NICHT_GEFUNDEN: 0 },
        customerSearchRowKeysByStatus: {
          GEFUNDEN: ["LR01:A-01"],
          NICHT_GEFUNDEN: [],
        },
      },
    });
    expect(metrics.searchStatuses).toEqual({
      GEFUNDEN: 0,
      NICHT_GEFUNDEN: 1,
    });
    expect(metrics.storedMetricDiscrepancy).toBe(true);
  });

  test("uses only the customer-review metric and never the legacy difference total", () => {
    expect(
      presentComparisonMetrics({
        schemaVersion: 6,
        categories: [
          {
            categoryView: "VS",
            rows: [
              {
                categoryId: "VS-01",
                pointDecision: {
                  outcome: "UNKLAR",
                  reasonCode: "MISSING_ONE_SIDE",
                  reviewRequired: false,
                },
              },
            ],
          },
        ],
        totals: {
          rows: 1,
          customerReviewRequired: 1,
          legacyTechnicalDifferences: 105,
          pointDecisions: {
            VORTEIL_A: 0,
            VORTEIL_B: 0,
            DOKUMENTATIONSUNTERSCHIED: 0,
            GLEICHWERTIG: 0,
            KEIN_DOKUMENTIERTER_VORTEIL: 0,
            NICHT_VERGLEICHBAR: 0,
            UNKLAR: 1,
          },
        },
      })
    ).toEqual({
      rows: 1,
      customerReviewRequired: 1,
      pointDecisions: {
        VORTEIL_A: 0,
        VORTEIL_B: 0,
        DOKUMENTATIONSUNTERSCHIED: 0,
        GLEICHWERTIG: 0,
        KEIN_DOKUMENTIERTER_VORTEIL: 0,
        NICHT_VERGLEICHBAR: 0,
        UNKLAR: 1,
      },
      pointDecisionRowKeysByOutcome: {
        VORTEIL_A: [],
        VORTEIL_B: [],
        DOKUMENTATIONSUNTERSCHIED: [],
        GLEICHWERTIG: [],
        KEIN_DOKUMENTIERTER_VORTEIL: [],
        NICHT_VERGLEICHBAR: [],
        UNKLAR: ["VS:VS-01"],
      },
      customerReviewBreakdown: [
        {
          reasonCode: "MISSING_ONE_SIDE",
          label: "Nur eine Seite enthält einen belastbaren Beleg",
          count: 1,
        },
      ],
      legacyFallback: false,
      storedMetricDiscrepancy: false,
    });
    expect(
      presentComparisonMetrics({
        schemaVersion: 5,
        categories: [
          {
            categoryView: "VS",
            rows: [
              {
                categoryId: "VS-01",
                difference: "Altes Ergebnis ohne Punktentscheidung",
              },
            ],
          },
        ],
        totals: {
          rows: 1,
          reviewRequired: 105,
          pointDecisionReviewRequired: 0,
        },
      })
    ).toEqual({
      rows: 1,
      customerReviewRequired: 1,
      pointDecisions: {
        VORTEIL_A: 0,
        VORTEIL_B: 0,
        DOKUMENTATIONSUNTERSCHIED: 0,
        GLEICHWERTIG: 0,
        KEIN_DOKUMENTIERTER_VORTEIL: 0,
        NICHT_VERGLEICHBAR: 0,
        UNKLAR: 1,
      },
      pointDecisionRowKeysByOutcome: {
        VORTEIL_A: [],
        VORTEIL_B: [],
        DOKUMENTATIONSUNTERSCHIED: [],
        GLEICHWERTIG: [],
        KEIN_DOKUMENTIERTER_VORTEIL: [],
        NICHT_VERGLEICHBAR: [],
        UNKLAR: ["VS:VS-01"],
      },
      customerReviewBreakdown: [
        {
          reasonCode: "LEGACY_RESULT_WITHOUT_POINT_DECISION",
          label: "Anderer Prüfgrund",
          count: 1,
        },
      ],
      legacyFallback: true,
      storedMetricDiscrepancy: true,
    });
  });

  test("labels package review blockers without multiplying their row count", () => {
    const metrics = presentComparisonMetrics({
      schemaVersion: 7,
      categories: [
        {
          categoryView: "VS",
          rows: [
            {
              categoryId: "VS-01",
              pointDecision: {
                outcome: "UNKLAR",
                reasonCode: "PACKAGE_REVIEW_STATUS_BLOCKS_DECISION",
                reviewRequired: true,
              },
            },
          ],
        },
      ],
      totals: {
        rows: 1,
        customerReviewRequired: 1,
        pointDecisions: {
          VORTEIL_A: 0,
          VORTEIL_B: 0,
          DOKUMENTATIONSUNTERSCHIED: 0,
          GLEICHWERTIG: 0,
          KEIN_DOKUMENTIERTER_VORTEIL: 0,
          NICHT_VERGLEICHBAR: 0,
          UNKLAR: 1,
        },
      },
    });
    expect(metrics.customerReviewRequired).toBe(1);
    expect(metrics.customerReviewBreakdown).toEqual([
      {
        reasonCode: "PACKAGE_REVIEW_STATUS_BLOCKS_DECISION",
        label: "Offene Teilpunkte in mindestens einer Polizze",
        count: 1,
      },
    ]);
  });
});

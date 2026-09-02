const {
  customerResultText,
  packageReviewCustomerExplanation,
} = require("../../utils/policyComparison/customerResultPresenter");

function presented(outcome, overrides = {}) {
  return customerResultText({
    pointDecision: {
      outcome,
      reasonCode: "FIXTURE",
      reason: "Begründung für Paket A und Paket B.",
      reviewRequired: outcome === "UNKLAR",
      ruleId: "ATOMIC_COVERAGE_EQUALITY_V1",
      ...overrides,
    },
  });
}

describe("policy comparison customer result presenter", () => {
  function auditEntry(code, side = "B", overrides = {}) {
    return {
      code,
      side,
      level: "COMPONENT",
      requirementId: "VS-01",
      componentId: "component",
      factRole: "BENEFIT",
      documentUuids: ["document-b"],
      observed: null,
      ...overrides,
    };
  }

  function packageReviewDecision(blockers, signals = [], schemaVersion = 1) {
    return {
      outcome: "UNKLAR",
      reasonCode: "PACKAGE_REVIEW_STATUS_BLOCKS_DECISION",
      reason: "Generischer technischer Text.",
      reviewRequired: true,
      ruleId: "FAIL_CLOSED_V1",
      packageReviewAudit: {
        schemaVersion,
        contractId: `PACKAGE_REVIEW_BLOCKERS_V${schemaVersion}`,
        packageStatuses: { A: "BELEGT", B: "TEILBELEGT" },
        blockers,
        signals,
      },
    };
  }

  test.each([
    ["VORTEIL_A", "Vorteil Polizze A:"],
    ["VORTEIL_B", "Vorteil Polizze B:"],
    [
      "DOKUMENTATIONSUNTERSCHIED",
      "Kein klarer Vorteil: Dokumentationsunterschied –",
    ],
    ["GLEICHWERTIG", "Kein klarer Vorteil: gleichwertig –"],
    ["NICHT_VERGLEICHBAR", "Kein klarer Vorteil: nicht vergleichbar –"],
    ["UNKLAR", "Kein klarer Vorteil: ungeklärt –"],
    [
      "KEIN_DOKUMENTIERTER_VORTEIL",
      "Kein klarer Vorteil: In beiden Polizzen wurde nach vollständiger kontrollierter Suche keine passende Vertragsregelung gefunden.",
    ],
  ])("maps %s to the customer signal %s", (outcome, prefix) => {
    expect(presented(outcome).startsWith(prefix)).toBe(true);
  });

  test("degrades an unsafe advantage decision to unclear", () => {
    expect(
      presented("VORTEIL_A", { reviewRequired: true }).startsWith(
        "Kein klarer Vorteil: ungeklärt –"
      )
    ).toBe(true);
  });

  test("keeps the verified-absence caveat customer-visible", () => {
    const text = presented("VORTEIL_B", {
      reason:
        "Vorteil Paket B: Garagenschutz ist in Paket B ausdrücklich eingeschlossen. In Paket A wurde keine Regelung gefunden; ein ausdrücklicher Ausschluss in Paket A ist damit nicht belegt.",
    });
    expect(text.startsWith("Vorteil Polizze B:")).toBe(true);
    expect(text).toContain(
      "ausdrücklicher Ausschluss in Polizze A ist damit nicht belegt"
    );
  });

  test("does not expose rule identifiers or search dispositions", () => {
    const text = presented("UNKLAR", {
      reasonCode: "ATOMIC_EVIDENCE_INCOMPLETE",
      reason: "FAIL_CLOSED_V1 SEARCH_INCOMPLETE",
      reviewRequired: true,
      ruleId: "FAIL_CLOSED_V1",
    });
    expect(text).not.toContain("FAIL_CLOSED_V1");
    expect(text).not.toContain("SEARCH_INCOMPLETE");
  });

  test("degrades an unknown decision rule to unclear", () => {
    expect(
      presented("VORTEIL_A", { ruleId: "UNREVIEWED_RULE" }).startsWith(
        "Kein klarer Vorteil: ungeklärt –"
      )
    ).toBe(true);
  });

  test("keeps an approved ANY comparability result customer-visible", () => {
    expect(
      presented("NICHT_VERGLEICHBAR", {
        ruleId: "ANY_COMPONENT_IDENTITY_GATE_V1",
      }).startsWith("Kein klarer Vorteil: nicht vergleichbar –")
    ).toBe(true);
  });

  test("keeps the approved sole-scope result customer-visible", () => {
    const text = presented("NICHT_VERGLEICHBAR", {
      reason:
        "Nicht direkt vergleichbar: Das Limit ist in Polizze A allgemein und in Polizze B nur für einen engeren Deckungsumfang belegt.",
      ruleId: "SOLE_SCOPE_REVIEW_BLOCKER_TO_ATOMIC_NONCOMPARABLE_V1",
      reviewRequired: false,
    });
    expect(text.startsWith("Kein klarer Vorteil: nicht vergleichbar –")).toBe(
      true
    );
    expect(text).not.toContain("SOLE_SCOPE_REVIEW");
    expect(text).not.toMatch(/GENERAL|NARROW_ONLY/u);
  });

  test("explains package blockers per policy without exposing technical identifiers", () => {
    const decision = packageReviewDecision([
      auditEntry("MISSING_REQUIRED_COMPONENT"),
      auditEntry("FIELD_INCOMPLETE"),
    ]);
    const text = customerResultText({ pointDecision: decision });
    expect(text).toContain("Polizze B:");
    expect(text).toContain("erforderlicher Teilpunkt");
    expect(text).toContain("Werte, Limits");
    expect(text).not.toContain("MISSING_REQUIRED_COMPONENT");
    expect(text).not.toContain("document-b");
    expect(text).not.toContain("component");
  });

  test("deduplicates hint families and ignores applicability signals", () => {
    const decision = packageReviewDecision(
      [
        auditEntry("UNKNOWN_COVERAGE_EFFECT"),
        auditEntry("COVERAGE_EFFECT_NOT_DECISIVE"),
      ],
      [auditEntry("PROPOSED_ONLY")]
    );
    const explanation = packageReviewCustomerExplanation(decision);
    expect(
      explanation.match(/Vertragswirkung eines Teilpunkts/gu)
    ).toHaveLength(1);
    expect(explanation).not.toContain("PROPOSED_ONLY");
  });

  test("presents current V2 and historical V1 package audits identically", () => {
    const blockers = [auditEntry("MISSING_REQUIRED_COMPONENT")];
    expect(
      packageReviewCustomerExplanation(packageReviewDecision(blockers, [], 2))
    ).toBe(
      packageReviewCustomerExplanation(packageReviewDecision(blockers, [], 1))
    );
  });

  test("separates A and B hints without creating additional review counts", () => {
    const explanation = packageReviewCustomerExplanation(
      packageReviewDecision([
        auditEntry("SCOPE_INCOMPLETE", "A", {
          documentUuids: ["document-a"],
        }),
        auditEntry("UNRESOLVED_CANDIDATE", "B"),
      ])
    );
    expect(explanation).toContain("Polizze A:");
    expect(explanation).toContain("Polizze B:");
    expect(explanation).toContain("nicht zusätzlich gezählt");
  });

  test("falls back to the generic text for an invalid audit", () => {
    const text = customerResultText({
      pointDecision: packageReviewDecision([
        auditEntry("UNKNOWN_FUTURE_BLOCKER"),
      ]),
    });
    expect(text).toContain(
      "Mindestens ein Prüfstatus lässt noch keine sichere Bewertung zu."
    );
  });

  test.each([
    [
      "missing audit version",
      { schemaVersion: undefined, contractId: undefined },
    ],
    [
      "unknown audit version",
      { schemaVersion: 3, contractId: "PACKAGE_REVIEW_BLOCKERS_V3" },
    ],
    [
      "mismatched audit contract",
      { schemaVersion: 2, contractId: "PACKAGE_REVIEW_BLOCKERS_V1" },
    ],
  ])("fails closed for %s", (_label, auditOverrides) => {
    const decision = packageReviewDecision([
      auditEntry("MISSING_REQUIRED_COMPONENT"),
    ]);
    decision.packageReviewAudit = {
      ...decision.packageReviewAudit,
      ...auditOverrides,
    };
    expect(packageReviewCustomerExplanation(decision)).toBeNull();
  });
});

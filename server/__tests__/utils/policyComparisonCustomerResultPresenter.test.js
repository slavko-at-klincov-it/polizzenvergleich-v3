const {
  customerResultText,
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
});

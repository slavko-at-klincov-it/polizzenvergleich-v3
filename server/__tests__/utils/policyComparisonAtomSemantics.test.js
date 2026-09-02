const {
  hasOptionalCoverageSource,
} = require("../../utils/policyComparison/comparisonAtomSemantics");

function atom(overrides = {}) {
  return {
    evidencePresence: "FOUND",
    documentStatus: "ACTIVE",
    documentApplicability: "ACTIVE",
    sources: [],
    fields: [],
    ...overrides,
  };
}

describe("comparison atom semantics", () => {
  test.each([
    "Der Deckungsbaustein ist optional eingeschlossen.",
    "Die Erweiterung ist wahlweise mitversichert.",
    "Der Schutz gilt gegen Mehrbeitrag.",
    "Die Gefahr ist auf Wunsch mitversichert.",
    "Die Gefahr kann eingeschlossen werden.",
    "Der Schutz besteht nur bei gesonderter Vereinbarung.",
  ])("recognizes a bound active option: %s", (exactText) => {
    expect(hasOptionalCoverageSource(atom({ sources: [{ exactText }] }))).toBe(
      true
    );
  });

  test.each([
    "Der Deckungsbaustein ist nicht optional, sondern eingeschlossen.",
    "Die Leistung ist nicht wahlweise, sondern automatisch versichert.",
    "Der Schutz ist ohne Mehrprämie eingeschlossen.",
    "Keine gesonderte Vereinbarung ist erforderlich.",
  ])("rejects a negated option control: %s", (exactText) => {
    expect(hasOptionalCoverageSource(atom({ sources: [{ exactText }] }))).toBe(
      false
    );
  });

  test.each([
    "Der Baustein ist optional; keine gesonderte Vereinbarung ist erforderlich.",
    "Der Schutz gilt gegen Mehrprämie; die Karenzfrist entfällt.",
    "Auf Wunsch mitversichert, aber ohne Mehrbeitrag.",
  ])(
    "does not let an unrelated negation hide an active option: %s",
    (exactText) => {
      expect(
        hasOptionalCoverageSource(atom({ sources: [{ exactText }] }))
      ).toBe(true);
    }
  );
});

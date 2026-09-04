const fs = require("fs");
const path = require("path");
const {
  LF_REFERENCE_PROFILE,
  categoryCatalogs,
} = require("../../utils/policyComparison/lfReferenceProfile");

describe("LF reference comparison profile", () => {
  test("provides exactly 10 categories and 35 A-owned result rows", () => {
    const categories = categoryCatalogs();
    const requirements = categories.flatMap(
      ({ catalog }) => catalog.requirements
    );
    expect(categories).toHaveLength(10);
    expect(requirements).toHaveLength(35);
    expect(LF_REFERENCE_PROFILE).toMatchObject({
      categoryCount: 10,
      rowCount: 35,
      noEmbeddings: true,
      discoversSideBOnly: false,
    });
    expect(
      new Set(requirements.map(({ sourceReferenceId }) => sourceReferenceId))
        .size
    ).toBe(35);
  });

  test("splits compound LF points into mandatory typed components", () => {
    const requirements = categoryCatalogs().flatMap(
      ({ catalog }) => catalog.requirements
    );
    const bySourceId = new Map(
      requirements.map((requirement) => [
        requirement.sourceReferenceId,
        requirement,
      ])
    );
    expect(
      bySourceId.get("LF-VS-02").components.map(({ factRole }) => factRole)
    ).toEqual(["INSURED_OBJECT", "LIMIT", "EXCLUSION"]);
    expect(
      bySourceId.get("LF-HP-03").components.map(({ factRole }) => factRole)
    ).toContain("DEDUCTIBLE");
    expect(bySourceId.get("LF-GL-03").components).toHaveLength(4);
    expect(bySourceId.get("LF-KO-02").components).toHaveLength(6);
    expect(bySourceId.get("LF-KO-03").components).toHaveLength(10);
    expect(bySourceId.get("LF-ST-02").components).toHaveLength(5);
    expect(bySourceId.get("LF-ST-04").components).toHaveLength(1);
    expect(
      requirements.every(
        ({ componentSatisfactionPolicy }) =>
          componentSatisfactionPolicy === "ALL"
      )
    ).toBe(true);
  });

  test("requests structured values only for fields present in the LF clause", () => {
    const bySourceId = new Map(
      categoryCatalogs()
        .flatMap(({ catalog }) => catalog.requirements)
        .map((requirement) => [requirement.sourceReferenceId, requirement])
    );

    expect(bySourceId.get("LF-PR-02").requestedFields).toEqual([]);
    expect(bySourceId.get("LF-KO-01").requestedFields).toEqual(["duration"]);
    expect(bySourceId.get("LF-KO-02").requestedFields).toEqual([
      "limit",
      "duration",
    ]);
    expect(bySourceId.get("LF-AV-02").requestedFields).toEqual(["duration"]);
    expect(bySourceId.get("LF-AV-05").requestedFields).toEqual(["duration"]);
  });

  test("models product basis and favorability as contract conditions", () => {
    const requirements = categoryCatalogs().flatMap(
      ({ catalog }) => catalog.requirements
    );
    const bySourceId = new Map(
      requirements.map((requirement) => [
        requirement.sourceReferenceId,
        requirement,
      ])
    );
    const productBasis = bySourceId.get("LF-PR-01");
    const favorability = bySourceId.get("LF-PR-02");

    expect(productBasis.components[0].aliases).toContain(
      "Produktvariante Premiumschutz"
    );
    expect(productBasis.components[1].aliases).toContain(
      "für alle beantragten Sparten"
    );
    expect(favorability.components[0]).toMatchObject({
      id: "better_coverage",
      factRole: "CONDITION",
    });
    expect(favorability.components[0].aliases).toContain(
      "günstigere Auslegung"
    );
  });

  test("keeps embedding calls out of the directed production runner", () => {
    const runner = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../utils/policyComparison/referenceRunner.js"
      ),
      "utf8"
    );
    expect(runner).not.toMatch(
      /\.embeddings\.|embeddingModel|selectCandidates/iu
    );
    expect(runner).toContain("buildCategoryOccurrenceWorksheet.cjs");
    expect(runner).toContain("runVsCandidateTriage.cjs");
    expect(runner).toContain("runPreparedEvidenceEvaluation.cjs");
  });
});

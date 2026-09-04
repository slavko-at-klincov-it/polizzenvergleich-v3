const fs = require("fs");
const path = require("path");
const {
  LF_REFERENCE_PROFILE,
  categoryCatalogs,
} = require("../../utils/policyComparison/lfReferenceProfile");
const {
  buildControlledOccurrenceWorksheet,
} = require("../../utils/policyAnalysis/controlledOccurrenceWorksheet");

describe("LF reference comparison profile", () => {
  test("provides exactly 10 categories and 35 A-owned result rows", () => {
    const categories = categoryCatalogs();
    const requirements = categories.flatMap(
      ({ catalog }) => catalog.requirements
    );
    expect(categories).toHaveLength(10);
    expect(requirements).toHaveLength(35);
    expect(LF_REFERENCE_PROFILE).toMatchObject({
      id: "LF_IMMO_REFERENCE_35_V2_CONTROLLED",
      catalogId: "lf-immo-reference-35-controlled-v2",
      componentContractId: "LF_REFERENCE_COMPONENTS_ALL_REQUIRED_V2",
      categoryCount: 10,
      rowCount: 35,
      noEmbeddings: true,
      discoversSideBOnly: false,
    });
    expect(
      new Set(requirements.map(({ sourceReferenceId }) => sourceReferenceId))
        .size
    ).toBe(35);
    expect(
      requirements.every(
        ({ negativeSearchPolicy }) =>
          negativeSearchPolicy ===
          "REPORT_COMPLETE_ZERO_CONTROLLED_SEARCH_V2"
      )
    ).toBe(true);
  });

  test("materializes every V2 catalog through the production worksheet contract", () => {
    const document = {
      id: "lf-v2-contract-probe",
      sourceDocumentId: "lf-v2-contract-probe",
      title: "lf-v2-contract-probe.pdf",
      documentType: "pdf",
      pageContent: "Kein Treffer in diesem synthetischen Vertragsdokument.",
      pageMap: [
        {
          pageNumber: 1,
          start: 0,
          end: 54,
        },
      ],
      pdfExtraction: {
        schemaVersion: 1,
        totalPages: 1,
        processedPages: 1,
        pagesWithText: 1,
        complete: true,
      },
    };

    for (const { catalog } of categoryCatalogs()) {
      expect(() =>
        buildControlledOccurrenceWorksheet({
          catalog,
          document,
          documentFingerprint: "1".repeat(64),
        })
      ).not.toThrow();
    }
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
    expect(bySourceId.get("LF-GL-02")).toMatchObject({
      scopePolicy: "MATCHING_SCOPE_INCLUDED_SUFFICIENT",
      scopeRules: {
        narrowAliases: [],
        narrowScopeKeys: ["STURM_INSURANCE"],
      },
    });
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
    expect(bySourceId.get("LF-KO-01").coverageAggregationPolicy).toBe(
      "COVERAGE_ROLES_ONLY"
    );
    expect(bySourceId.get("LF-HP-01").coverageAggregationPolicy).toBe(
      "ALL_COMPONENT_EFFECTS"
    );
    expect(
      bySourceId
        .get("LF-AV-02")
        .components.find(({ id }) => id === "restoration_period")
    ).toMatchObject({ factRole: "CONDITION", requestedFields: ["duration"] });
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

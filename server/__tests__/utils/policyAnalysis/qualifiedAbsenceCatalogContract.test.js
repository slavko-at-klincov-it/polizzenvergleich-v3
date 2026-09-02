const catalogs = [
  require("../../../resources/policyAnalysis/vs-occurrence-full-draft.v0.2.json"),
  require("../../../resources/policyAnalysis/fe-occurrence-full-draft.v0.1.json"),
  require("../../../resources/policyAnalysis/lw-occurrence-full-draft.v0.1.json"),
  require("../../../resources/policyAnalysis/st-occurrence-full-draft.v0.1.json"),
  require("../../../resources/policyAnalysis/el-occurrence-full-draft.v0.1.json"),
];
const {
  buildControlledOccurrenceWorksheet,
} = require("../../../utils/policyAnalysis/controlledOccurrenceWorksheet");

const EXPECTED_MEANINGS = Object.freeze({
  COVERAGE_ONLY: 91,
  COVERAGE_MIXED: 25,
  COST_COVERAGE: 24,
  EXCLUSION: 13,
  VALUE_TERM: 16,
  CONDITION_ONLY: 44,
  DEFINITION_ONLY: 10,
  DOCUMENT_REFERENCE: 1,
});

function document(text = "Ohne passenden Vertragsinhalt") {
  return {
    title: "Fixture",
    sourceDocumentId: "fixture",
    pageContent: text,
    pageMap: [{ pageNumber: 1, start: 0, end: text.length }],
    pdfExtraction: {
      schemaVersion: 1,
      totalPages: 1,
      processedPages: 1,
      pagesWithText: 1,
      complete: true,
    },
  };
}

describe("qualified absence catalog contract", () => {
  test("classifies every productive row explicitly without blanket advantage eligibility", () => {
    const requirements = catalogs.flatMap((catalog) => catalog.requirements);
    const meanings = requirements.reduce((counts, requirement) => {
      counts[requirement.absenceMeaning] =
        (counts[requirement.absenceMeaning] || 0) + 1;
      return counts;
    }, {});

    expect(requirements).toHaveLength(224);
    expect(meanings).toEqual(EXPECTED_MEANINGS);
    expect(catalogs.every(({ schemaVersion }) => schemaVersion === 2)).toBe(
      true
    );
    expect(
      requirements.every(({ negativeSearchPolicy, absenceMeaning }) =>
        Boolean(negativeSearchPolicy && absenceMeaning)
      )
    ).toBe(true);

    const certified = requirements.filter(
      ({ negativeSearchPolicy }) =>
        negativeSearchPolicy === "CERTIFY_COMPLETE_ZERO_OCCURRENCE_V1"
    );
    expect(certified).toEqual([]);
    expect(
      requirements
        .filter(({ absenceComparisonPolicy }) => absenceComparisonPolicy)
        .map(({ id }) => id)
    ).toEqual([]);
  });

  test("keeps exclusions, values, conditions, definitions and references documentation-only", () => {
    const nonCoverageMeanings = new Set([
      "EXCLUSION",
      "VALUE_TERM",
      "CONDITION_ONLY",
      "DEFINITION_ONLY",
      "DOCUMENT_REFERENCE",
    ]);
    const unsafe = catalogs
      .flatMap((catalog) => catalog.requirements)
      .filter(({ absenceMeaning }) => nonCoverageMeanings.has(absenceMeaning))
      .filter(({ absenceComparisonPolicy }) => absenceComparisonPolicy);

    expect(unsafe).toEqual([]);
  });

  test("keeps VS-16 neutral until a new row certification is approved", () => {
    const requirement = catalogs[0].requirements.find(
      ({ id }) => id === "VS-16"
    );
    const worksheet = buildControlledOccurrenceWorksheet({
      document: document(),
      documentFingerprint: "fixture-fingerprint",
      catalog: {
        schemaVersion: 2,
        catalogId: "fixture-v2",
        categoryView: "VS",
        requirements: [requirement],
      },
    });

    expect(worksheet).toMatchObject({
      schemaVersion: 2,
      requirements: [
        {
          id: "VS-16",
          negativeSearchPolicy: "REPORT_COMPLETE_ZERO_CONTROLLED_SEARCH_V1",
          absenceMeaning: "COVERAGE_ONLY",
        },
      ],
    });
  });

  test("rejects an incomplete schema V2 absence contract", () => {
    expect(() =>
      buildControlledOccurrenceWorksheet({
        document: document(),
        documentFingerprint: "fixture-fingerprint",
        catalog: {
          schemaVersion: 2,
          catalogId: "invalid-v2",
          categoryView: "VS",
          requirements: [
            {
              id: "VS-01",
              label: "Fixture",
              requestedFields: [],
              components: [
                {
                  id: "fixture",
                  label: "Fixture",
                  factRole: "BENEFIT",
                  aliases: ["Fixture"],
                },
              ],
            },
          ],
        },
      })
    ).toThrow("QUALIFIED_ABSENCE_CONTRACT_REQUIRED: VS-01");
  });

  test("rejects a comparison policy that has no approved registry binding", () => {
    const source = catalogs[0].requirements.find(({ id }) => id === "VS-17");
    expect(() =>
      buildControlledOccurrenceWorksheet({
        document: document(),
        documentFingerprint: "uncertified-fixture",
        catalog: {
          schemaVersion: 2,
          catalogId: "uncertified-catalog-v1",
          categoryView: "VS",
          requirements: [
            {
              ...source,
              negativeSearchPolicy: "CERTIFY_COMPLETE_ZERO_OCCURRENCE_V1",
              absenceComparisonPolicy:
                "ASSUME_NOT_INCLUDED_AFTER_COMPLETE_ZERO_OCCURRENCE_V1",
              absenceCertificationId: "missing-certification",
            },
          ],
        },
      })
    ).toThrow("COVERAGE_CERTIFICATION_REFERENCE_INVALID");
  });
});

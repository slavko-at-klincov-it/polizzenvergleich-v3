const fs = require("fs");
const path = require("path");

jest.mock(
  "../../../utils/policyAnalysis/baselineWorksheetRebuildContract",
  () => ({
    assertBaselineWorksheetRebuild: jest.fn(() =>
      Object.freeze({
        semanticWorksheetDigestSha256: "f".repeat(64),
      })
    ),
  })
);

const {
  assertBaselineWorksheetRebuild,
} = require("../../../utils/policyAnalysis/baselineWorksheetRebuildContract");
const {
  buildControlledOccurrenceWorksheet,
} = require("../../../utils/policyAnalysis/controlledOccurrenceWorksheet");
const { sha256 } = require("../../../utils/policyAnalysis/runIdentity");
const {
  selectTargetRequirements,
} = require("../../../utils/policyAnalysis/targetRequirementSelection");
const {
  TARGETED_WORKSHEET_BUILD_CONTRACT_ID,
  buildTargetedWorksheet,
} = require("../../../utils/policyAnalysis/targetedWorksheetBuildContract");

const CATALOG_BYTES = fs.readFileSync(
  path.resolve(
    __dirname,
    "../../../resources/policyAnalysis/st-occurrence-full-draft.v0.1.json"
  )
);

function raw(value) {
  return Buffer.from(JSON.stringify(value, null, 2));
}

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

function fixture() {
  const catalog = JSON.parse(CATALOG_BYTES.toString("utf8"));
  const requirementIds = ["ST-01", "ST-02"];
  const selected = selectTargetRequirements({ catalog, requirementIds });
  const fingerprint = "a".repeat(64);
  const pageContent = [
    "Sturm ist eine wetterbedingte Luftbewegung mit einer Windgeschwindigkeit von mehr als 60 km/h.",
    "Der Nachweis der Windstärke an der maßgeblichen Messstelle ist erforderlich.",
  ].join("\n");
  const documentArtifact = {
    schemaVersion: 1,
    fingerprint,
    document: {
      id: fingerprint,
      sourceDocumentId: fingerprint,
      title: "target.pdf",
      documentType: "pdf",
      pageContent,
      pageMap: [{ pageNumber: 1, start: 0, end: pageContent.length }],
      pdfExtraction: {
        schemaVersion: 1,
        totalPages: 1,
        processedPages: 1,
        pagesWithText: 1,
        complete: true,
      },
    },
  };
  const fullWorksheet = buildControlledOccurrenceWorksheet({
    document: documentArtifact.document,
    documentFingerprint: fingerprint,
    catalog,
  });
  const manifest = {
    schemaVersion: 3,
    contractId: "TARGETED_QA_MANIFEST_V3",
    manifestDigestSha256: "b".repeat(64),
    categoryTargets: [
      {
        categoryView: "ST",
        catalogId: catalog.catalogId,
        catalogSha256: sha256(CATALOG_BYTES),
        requirementIds,
        expectedTargetSelectionDigestSha256:
          selected.selection.selectionDigestSha256,
        targetRequirementSelection: selected.selection,
      },
    ],
  };
  return {
    manifest,
    expectedManifestDigestSha256: manifest.manifestDigestSha256,
    expectedExecution: { releaseId: "fixture" },
    categoryView: "ST",
    documentUuid: "document-st",
    catalogBytes: Buffer.from(CATALOG_BYTES),
    documentArtifactBytes: raw(documentArtifact),
    fullWorksheetBytes: raw(fullWorksheet),
  };
}

describe("targeted worksheet build contract", () => {
  beforeEach(() => {
    assertBaselineWorksheetRebuild.mockClear();
    assertBaselineWorksheetRebuild.mockReturnValue(
      Object.freeze({ semanticWorksheetDigestSha256: "f".repeat(64) })
    );
  });

  test("builds the exact manifest-selected worksheet after the green baseline gate", () => {
    const input = fixture();
    const result = buildTargetedWorksheet(input);

    expect(assertBaselineWorksheetRebuild).toHaveBeenCalledTimes(1);
    expect(assertBaselineWorksheetRebuild).toHaveBeenCalledWith(input);
    expect(result.worksheet.requirements.map(({ id }) => id)).toEqual([
      "ST-01",
      "ST-02",
    ]);
    expect(
      result.worksheet.requirements.map((requirement) =>
        requirement.components.map(({ id }) => id)
      )
    ).toEqual([
      ["storm_wind_speed_definition"],
      ["wind_proof_duty", "measuring_station"],
    ]);
    expect(result.worksheet.targetRequirementSelection).toEqual(
      input.manifest.categoryTargets[0].targetRequirementSelection
    );
    expect(result.provenance).toMatchObject({
      contractId: TARGETED_WORKSHEET_BUILD_CONTRACT_ID,
      runKind: "TARGETED_QA_ONLY",
      categoryView: "ST",
      documentUuid: "document-st",
      requirementCount: 2,
      componentCount: 3,
      baselineSemanticWorksheetDigestSha256: "f".repeat(64),
    });
    expect(Object.isFrozen(result.provenance)).toBe(true);
  });

  test("is deterministic for identical certified inputs", () => {
    const input = fixture();
    const first = buildTargetedWorksheet(input);
    const second = buildTargetedWorksheet(input);

    expect(second).toEqual(first);
    expect(input.manifest.categoryTargets[0].requirementIds).toEqual([
      "ST-01",
      "ST-02",
    ]);
  });

  test("never continues after a failed baseline rebuild gate", () => {
    const failure = new Error("BASELINE_WORKSHEET_REBUILD_MISMATCH");
    failure.code = "BASELINE_WORKSHEET_REBUILD_MISMATCH";
    assertBaselineWorksheetRebuild.mockImplementationOnce(() => {
      throw failure;
    });

    expect(() => buildTargetedWorksheet(fixture())).toThrow(
      "BASELINE_WORKSHEET_REBUILD_MISMATCH"
    );
  });

  test.each([
    [
      "catalog bytes",
      (input) => {
        input.catalogBytes = Buffer.concat([
          input.catalogBytes,
          Buffer.from(" "),
        ]);
      },
      "TARGETED_WORKSHEET_CATALOG_SHA_MISMATCH",
    ],
    [
      "manifest id order",
      (input) => {
        input.manifest.categoryTargets[0].requirementIds.reverse();
      },
      "TARGETED_WORKSHEET_SELECTION_MISMATCH",
    ],
    [
      "selection digest",
      (input) => {
        input.manifest.categoryTargets[0].expectedTargetSelectionDigestSha256 =
          "0".repeat(64);
      },
      "TARGETED_WORKSHEET_SELECTION_MISMATCH",
    ],
    [
      "unknown requirement",
      (input) => {
        input.manifest.categoryTargets[0].requirementIds = ["ST-99"];
      },
      "TARGET_REQUIREMENT_SELECTION_UNKNOWN_IDS",
    ],
  ])("rejects %s tamper", (_label, mutate, expectedCode) => {
    const input = fixture();
    mutate(input);
    expect(() => buildTargetedWorksheet(input)).toThrow(expectedCode);
  });

  test("does not mutate manifest or catalog inputs", () => {
    const input = fixture();
    const manifestBefore = copy(input.manifest);
    const catalogBefore = Buffer.from(input.catalogBytes);

    buildTargetedWorksheet(input);

    expect(input.manifest).toEqual(manifestBefore);
    expect(input.catalogBytes).toEqual(catalogBefore);
  });
});

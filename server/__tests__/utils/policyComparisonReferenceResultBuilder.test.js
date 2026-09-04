const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  categoryCatalogs,
} = require("../../utils/policyComparison/lfReferenceProfile");
const {
  REFERENCE_OUTCOME,
  buildReferenceComparisonResult,
  validateReferenceComparison,
} = require("../../utils/policyComparison/referenceResultBuilder");

function document(uuid, side, position) {
  return {
    uuid,
    side,
    position,
    role: position === 0 ? "MAIN_POLICY" : "SUPPLEMENT",
    documentStatus: "ACTIVE",
    originalName: `${uuid}.pdf`,
    sha256: crypto.createHash("sha256").update(uuid).digest("hex"),
  };
}

function row(requirement, found) {
  return {
    categoryId: requirement.id,
    stage: "K",
    categoryName: requirement.label,
    documentedContent: found
      ? `Belegter Inhalt ${requirement.id}`
      : "keine belegte Fundstelle gefunden",
    coverage: found ? "Ja" : "Nicht feststellbar",
    coverageAmount: "Nicht feststellbar",
    source: found
      ? "PDF-Seite 1: „belegter Inhalt“"
      : "keine belegte Fundstelle gefunden",
    reviewStatus: found ? "BELEGT" : "UNGEKLÄRT",
  };
}

function effectFor(component) {
  if (component.factRole === "EXCLUSION") return "EXCLUDED";
  if (["LIMIT", "DEDUCTIBLE", "CONDITION"].includes(component.factRole))
    return "DEFINED";
  return "INCLUDED";
}

function writeRun(root, sourceDocument, foundRequirementIds = new Set()) {
  const outputDirectory = path.join(root, sourceDocument.uuid);
  for (const { categoryView, catalog } of categoryCatalogs()) {
    const categoryRoot = path.join(outputDirectory, categoryView);
    const resultRoot = path.join(categoryRoot, "result");
    const effectsRoot = path.join(categoryRoot, "effects");
    fs.mkdirSync(resultRoot, { recursive: true });
    fs.mkdirSync(effectsRoot, { recursive: true });
    fs.writeFileSync(
      path.join(resultRoot, "rows.private.json"),
      JSON.stringify(
        catalog.requirements.map((requirement) =>
          row(requirement, foundRequirementIds.has(requirement.id))
        )
      )
    );
    fs.writeFileSync(
      path.join(effectsRoot, "materialized.private.json"),
      JSON.stringify({
        judgements: catalog.requirements.flatMap((requirement) =>
          requirement.components.map((component) => ({
            requirementId: requirement.id,
            componentId: component.id,
            evidencePresence: foundRequirementIds.has(requirement.id)
              ? "FOUND"
              : "NOT_FOUND",
            coverageEffect: foundRequirementIds.has(requirement.id)
              ? effectFor(component)
              : "UNKNOWN",
            conflictState: "NONE",
          }))
        ),
      })
    );
  }
  return { document: sourceDocument, outputDirectory };
}

describe("directed LF reference result builder", () => {
  let root;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "lf-reference-result-"));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  test("creates only A-owned rows and never discovers B-only rows", () => {
    const firstRequirement = categoryCatalogs()[0].catalog.requirements[0];
    const allReferenceIds = new Set(
      categoryCatalogs().flatMap(({ catalog }) =>
        catalog.requirements.map(({ id }) => id)
      )
    );
    const runs = [
      writeRun(root, document("reference-a", "A", 0), allReferenceIds),
      writeRun(
        root,
        document("counterpart-b1", "B", 0),
        new Set([firstRequirement.id])
      ),
      writeRun(root, document("counterpart-b2", "B", 1)),
    ];

    const result = buildReferenceComparisonResult(runs, {
      sessionUuid: "synthetic-session",
      runSignature: "a".repeat(64),
    });

    expect(() => validateReferenceComparison(result)).not.toThrow();
    expect(result.totals).toMatchObject({
      categories: 10,
      rows: 35,
      referenceRowsAnalyzed: 35,
      sideBOnlyRows: 0,
      outcomes: {
        [REFERENCE_OUTCOME.FOUND]: 1,
        [REFERENCE_OUTCOME.NOT_FOUND]: 34,
      },
    });
    expect(result.categories[0].rows[0]).toMatchObject({
      categoryId: "LF-PR-01",
      pointDecision: { outcome: REFERENCE_OUTCOME.FOUND },
      packageB: {
        contributors: [
          expect.objectContaining({ documentUuid: "counterpart-b1" }),
        ],
      },
    });
  });

  test("fails closed when an additional result row is injected", () => {
    const allReferenceIds = new Set(
      categoryCatalogs().flatMap(({ catalog }) =>
        catalog.requirements.map(({ id }) => id)
      )
    );
    const result = buildReferenceComparisonResult(
      [
        writeRun(root, document("reference-a", "A", 0), allReferenceIds),
        writeRun(root, document("counterpart-b", "B", 0)),
      ],
      {}
    );
    result.categories[0].rows.push({
      ...result.categories[0].rows[0],
      categoryId: "B-ONLY-01",
    });
    expect(() => validateReferenceComparison(result)).toThrow(
      "REFERENCE_RESULT_ROW_SET_INVALID"
    );
  });

  test("does not convert unresolved B candidates into a controlled zero result", () => {
    const firstCategory = categoryCatalogs()[0];
    const firstRequirement = firstCategory.catalog.requirements[0];
    const allReferenceIds = new Set(
      categoryCatalogs().flatMap(({ catalog }) =>
        catalog.requirements.map(({ id }) => id)
      )
    );
    const counterpart = writeRun(root, document("counterpart-b", "B", 0));
    const effectsFile = path.join(
      counterpart.outputDirectory,
      firstCategory.categoryView,
      "effects",
      "materialized.private.json"
    );
    const effects = JSON.parse(fs.readFileSync(effectsFile, "utf8"));
    const unresolved = effects.judgements.find(
      ({ requirementId }) => requirementId === firstRequirement.id
    );
    unresolved.evidencePresence = "FOUND";
    unresolved.unresolvedCandidateIds = ["candidate:unresolved"];
    fs.writeFileSync(effectsFile, JSON.stringify(effects));

    const result = buildReferenceComparisonResult(
      [
        writeRun(root, document("reference-a", "A", 0), allReferenceIds),
        counterpart,
      ],
      {}
    );

    expect(result.categories[0].rows[0]).toMatchObject({
      pointDecision: {
        outcome: REFERENCE_OUTCOME.UNCLEAR,
        reviewRequired: true,
      },
      packageB: { reviewStatus: "UNGEKLÄRT" },
    });
  });

  test("does not report a found counterpart when B documents conflict", () => {
    const firstRequirement = categoryCatalogs()[0].catalog.requirements[0];
    const allReferenceIds = new Set(
      categoryCatalogs().flatMap(({ catalog }) =>
        catalog.requirements.map(({ id }) => id)
      )
    );
    const left = writeRun(
      root,
      document("counterpart-left", "B", 0),
      new Set([firstRequirement.id])
    );
    const right = writeRun(
      root,
      document("counterpart-right", "B", 1),
      new Set([firstRequirement.id])
    );
    const rightRowsFile = path.join(
      right.outputDirectory,
      categoryCatalogs()[0].categoryView,
      "result",
      "rows.private.json"
    );
    const rightRows = JSON.parse(fs.readFileSync(rightRowsFile, "utf8"));
    rightRows[0].coverage = "Nein";
    fs.writeFileSync(rightRowsFile, JSON.stringify(rightRows));
    const rightEffectsFile = path.join(
      right.outputDirectory,
      categoryCatalogs()[0].categoryView,
      "effects",
      "materialized.private.json"
    );
    const rightEffects = JSON.parse(fs.readFileSync(rightEffectsFile, "utf8"));
    rightEffects.judgements
      .filter(({ requirementId }) => requirementId === firstRequirement.id)
      .forEach((judgement) => {
        judgement.coverageEffect = "EXCLUDED";
      });
    fs.writeFileSync(rightEffectsFile, JSON.stringify(rightEffects));

    const result = buildReferenceComparisonResult(
      [
        writeRun(root, document("reference-a", "A", 0), allReferenceIds),
        left,
        right,
      ],
      {}
    );

    expect(result.categories[0].rows[0]).toMatchObject({
      pointDecision: { outcome: REFERENCE_OUTCOME.UNCLEAR },
      packageB: { reviewStatus: "WIDERSPRÜCHLICH" },
    });
  });

  test("uses package-specific evidence before generic terms and does not treat definitions as insured objects", () => {
    const objectRequirement = categoryCatalogs()
      .flatMap(({ catalog }) => catalog.requirements)
      .find(({ sourceReferenceId }) => sourceReferenceId === "LF-VS-01");
    const allReferenceIds = new Set(
      categoryCatalogs().flatMap(({ catalog }) =>
        catalog.requirements.map(({ id }) => id)
      )
    );
    const supplement = document("counterpart-supplement", "B", 1);
    supplement.role = "SUPPLEMENT";
    const terms = document("counterpart-terms", "B", 2);
    terms.role = "TERMS";
    const supplementRun = writeRun(
      root,
      supplement,
      new Set([objectRequirement.id])
    );
    const termsRun = writeRun(root, terms, new Set([objectRequirement.id]));
    const termsEffectsFile = path.join(
      termsRun.outputDirectory,
      "RV",
      "effects",
      "materialized.private.json"
    );
    const termsEffects = JSON.parse(fs.readFileSync(termsEffectsFile, "utf8"));
    termsEffects.judgements
      .filter(
        ({ requirementId }) => requirementId === objectRequirement.id
      )
      .forEach((judgement) => {
        judgement.coverageEffect = "DEFINED";
      });
    fs.writeFileSync(termsEffectsFile, JSON.stringify(termsEffects));

    const result = buildReferenceComparisonResult(
      [
        writeRun(root, document("reference-a", "A", 0), allReferenceIds),
        supplementRun,
        termsRun,
      ],
      {}
    );
    const rowResult = result.categories
      .flatMap(({ rows }) => rows)
      .find(({ categoryId }) => categoryId === "LF-VS-01");

    expect(rowResult).toMatchObject({
      pointDecision: { outcome: REFERENCE_OUTCOME.FOUND },
      packageB: { reviewStatus: "BELEGT" },
    });
  });

  test("does not satisfy an insured-object component from a definition alone", () => {
    const objectRequirement = categoryCatalogs()
      .flatMap(({ catalog }) => catalog.requirements)
      .find(({ sourceReferenceId }) => sourceReferenceId === "LF-VS-01");
    const allReferenceIds = new Set(
      categoryCatalogs().flatMap(({ catalog }) =>
        catalog.requirements.map(({ id }) => id)
      )
    );
    const terms = document("counterpart-terms", "B", 1);
    terms.role = "TERMS";
    const termsRun = writeRun(root, terms, new Set([objectRequirement.id]));
    const termsEffectsFile = path.join(
      termsRun.outputDirectory,
      "RV",
      "effects",
      "materialized.private.json"
    );
    const termsEffects = JSON.parse(fs.readFileSync(termsEffectsFile, "utf8"));
    termsEffects.judgements
      .filter(
        ({ requirementId }) => requirementId === objectRequirement.id
      )
      .forEach((judgement) => {
        judgement.coverageEffect = "DEFINED";
      });
    fs.writeFileSync(termsEffectsFile, JSON.stringify(termsEffects));

    const result = buildReferenceComparisonResult(
      [
        writeRun(root, document("reference-a", "A", 0), allReferenceIds),
        termsRun,
      ],
      {}
    );
    const rowResult = result.categories
      .flatMap(({ rows }) => rows)
      .find(({ categoryId }) => categoryId === "LF-VS-01");

    expect(rowResult).toMatchObject({
      pointDecision: { outcome: REFERENCE_OUTCOME.PARTIAL },
      packageB: { reviewStatus: "TEILBELEGT" },
    });
  });
});

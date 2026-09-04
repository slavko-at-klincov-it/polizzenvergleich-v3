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

function requestedFieldsFor(component) {
  if (Array.isArray(component.requestedFields)) return component.requestedFields;
  if (component.factRole === "LIMIT") return ["limit"];
  if (component.factRole === "DEDUCTIBLE") return ["deductible"];
  return [];
}

function writeRun(root, sourceDocument, foundRequirementIds = new Set()) {
  const outputDirectory = path.join(root, sourceDocument.uuid);
  for (const { categoryView, catalog } of categoryCatalogs()) {
    const categoryRoot = path.join(outputDirectory, categoryView);
    const resultRoot = path.join(categoryRoot, "result");
    const effectsRoot = path.join(categoryRoot, "effects");
    fs.mkdirSync(resultRoot, { recursive: true });
    fs.mkdirSync(effectsRoot, { recursive: true });
    const found = (requirement) => foundRequirementIds.has(requirement.id);
    fs.writeFileSync(
      path.join(resultRoot, "rows.private.json"),
      JSON.stringify(
        catalog.requirements.map((requirement) =>
          row(requirement, found(requirement))
        )
      )
    );
    const selectedSources = catalog.requirements.flatMap((requirement) =>
      found(requirement)
        ? requirement.components.map((component) => ({
            requirementId: requirement.id,
            componentId: component.id,
            candidateId: `candidate:${requirement.id}:${component.id}`,
            candidateBinding: "DIRECT",
            physicalPageNumber: 1,
            exactText: `Belegter Inhalt ${component.id}`,
          }))
        : []
    );
    fs.writeFileSync(
      path.join(effectsRoot, "materialized.private.json"),
      JSON.stringify({
        judgements: catalog.requirements.flatMap((requirement) =>
          requirement.components.map((component) => ({
            requirementId: requirement.id,
            componentId: component.id,
            selectedCandidateIds: found(requirement)
              ? [`candidate:${requirement.id}:${component.id}`]
              : [],
            unresolvedCandidateIds: [],
            evidencePresence: found(requirement) ? "FOUND" : "NOT_FOUND",
            coverageEffect: found(requirement)
              ? effectFor(component)
              : "UNKNOWN",
            conflictState: "NONE",
            selectedScopePicture: found(requirement) ? "GENERAL" : "UNKNOWN",
          }))
        ),
      })
    );
    fs.writeFileSync(
      path.join(effectsRoot, "selected-sources.private.json"),
      JSON.stringify(selectedSources)
    );
    fs.writeFileSync(
      path.join(resultRoot, "requested-fields.private.json"),
      JSON.stringify({
        requirements: catalog.requirements.map((requirement) => {
          const factsByField = new Map();
          requirement.components.flatMap((component) =>
            requestedFieldsFor(component).map((field) => ({
              field,
              component,
            }))
          ).forEach(({ field, component }) => {
            if (!factsByField.has(field)) factsByField.set(field, []);
            if (found(requirement))
              factsByField.get(field).push({
                rawValue: "10",
                normalizedValue: "10",
                valueType: "MONEY",
                source: {
                  candidateId: `candidate:${requirement.id}:${component.id}`,
                  physicalPageNumber: 1,
                  exactText: "10",
                },
                componentScope: { id: component.id },
              });
          });
          const fields = [...factsByField].map(([field, facts]) => ({
            field,
            status: found(requirement) ? "FOUND" : "NOT_FOUND",
            facts,
          }));
          return {
            requirementId: requirement.id,
            requestedFields: [...new Set(fields.map(({ field }) => field))],
            requestedFieldStatus:
              fields.length === 0
                ? "NOT_REQUIRED"
                : found(requirement)
                  ? "COMPLETE"
                  : "NOT_FOUND",
            fields,
          };
        }),
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

  test("rejects a result carrying the superseded V1 contract identity", () => {
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
    result.schemaVersion = 1;
    result.contractId = "LF_REFERENCE_A_TO_B_RESULT_V1";
    result.productProfile = {
      ...result.productProfile,
      id: "LF_IMMO_REFERENCE_35_V1_CONTROLLED",
      catalogId: "lf-immo-reference-35-controlled-v1",
      componentContractId: "LF_REFERENCE_COMPONENTS_ALL_REQUIRED_V1",
    };

    expect(() => validateReferenceComparison(result)).toThrow(
      "REFERENCE_RESULT_CONTRACT_INVALID"
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

  test("preserves an internal conflict beside positive package evidence", () => {
    const firstCategory = categoryCatalogs()[0];
    const firstRequirement = firstCategory.catalog.requirements[0];
    const allReferenceIds = new Set(
      categoryCatalogs().flatMap(({ catalog }) =>
        catalog.requirements.map(({ id }) => id)
      )
    );
    const positive = writeRun(
      root,
      document("counterpart-positive", "B", 0),
      new Set([firstRequirement.id])
    );
    const conflicting = writeRun(
      root,
      document("counterpart-conflicting", "B", 1),
      new Set([firstRequirement.id])
    );
    const effectsFile = path.join(
      conflicting.outputDirectory,
      firstCategory.categoryView,
      "effects",
      "materialized.private.json"
    );
    const effects = JSON.parse(fs.readFileSync(effectsFile, "utf8"));
    const judgement = effects.judgements.find(
      ({ requirementId }) => requirementId === firstRequirement.id
    );
    judgement.coverageEffect = "UNKNOWN";
    judgement.conflictState = "ACTIVE_SAME_SCOPE";
    fs.writeFileSync(effectsFile, JSON.stringify(effects));

    const result = buildReferenceComparisonResult(
      [
        writeRun(root, document("reference-a", "A", 0), allReferenceIds),
        positive,
        conflicting,
      ],
      {}
    );

    expect(result.categories[0].rows[0]).toMatchObject({
      pointDecision: {
        outcome: REFERENCE_OUTCOME.UNCLEAR,
        reviewRequired: true,
      },
      packageB: { reviewStatus: "WIDERSPRÜCHLICH" },
    });
  });

  test("preserves unresolved candidates beside positive package evidence", () => {
    const firstCategory = categoryCatalogs()[0];
    const firstRequirement = firstCategory.catalog.requirements[0];
    const allReferenceIds = new Set(
      categoryCatalogs().flatMap(({ catalog }) =>
        catalog.requirements.map(({ id }) => id)
      )
    );
    const positive = writeRun(
      root,
      document("counterpart-positive", "B", 0),
      new Set([firstRequirement.id])
    );
    const unresolved = writeRun(
      root,
      document("counterpart-unresolved", "B", 1)
    );
    const effectsFile = path.join(
      unresolved.outputDirectory,
      firstCategory.categoryView,
      "effects",
      "materialized.private.json"
    );
    const effects = JSON.parse(fs.readFileSync(effectsFile, "utf8"));
    const judgement = effects.judgements.find(
      ({ requirementId }) => requirementId === firstRequirement.id
    );
    judgement.evidencePresence = "FOUND";
    judgement.unresolvedCandidateIds = ["candidate:unresolved"];
    fs.writeFileSync(effectsFile, JSON.stringify(effects));

    const result = buildReferenceComparisonResult(
      [
        writeRun(root, document("reference-a", "A", 0), allReferenceIds),
        positive,
        unresolved,
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

  test("does not complete a package from evidence hidden behind an unclear row", () => {
    const requirement = categoryCatalogs()
      .flatMap(({ catalog }) => catalog.requirements)
      .find(({ components }) => components.length > 1);
    const definition = categoryCatalogs().find(({ catalog }) =>
      catalog.requirements.some(({ id }) => id === requirement.id)
    );
    const allReferenceIds = new Set(
      categoryCatalogs().flatMap(({ catalog }) =>
        catalog.requirements.map(({ id }) => id)
      )
    );
    const first = writeRun(
      root,
      document("counterpart-partial", "B", 0),
      new Set([requirement.id])
    );
    const second = writeRun(
      root,
      document("counterpart-unclear", "B", 1),
      new Set([requirement.id])
    );
    const firstEffectsFile = path.join(
      first.outputDirectory,
      definition.categoryView,
      "effects",
      "materialized.private.json"
    );
    const firstEffects = JSON.parse(fs.readFileSync(firstEffectsFile, "utf8"));
    firstEffects.judgements.find(
      ({ requirementId, componentId }) =>
        requirementId === requirement.id &&
        componentId === requirement.components[1].id
    ).evidencePresence = "NOT_FOUND";
    const firstMissing = firstEffects.judgements.find(
      ({ requirementId, componentId }) =>
        requirementId === requirement.id &&
        componentId === requirement.components[1].id
    );
    firstMissing.coverageEffect = "UNKNOWN";
    firstMissing.selectedCandidateIds = [];
    firstMissing.selectedScopePicture = "UNKNOWN";
    fs.writeFileSync(firstEffectsFile, JSON.stringify(firstEffects));
    const firstRowsFile = path.join(
      first.outputDirectory,
      definition.categoryView,
      "result",
      "rows.private.json"
    );
    const firstRows = JSON.parse(fs.readFileSync(firstRowsFile, "utf8"));
    firstRows.find(({ categoryId }) => categoryId === requirement.id).reviewStatus =
      "TEILBELEGT";
    fs.writeFileSync(firstRowsFile, JSON.stringify(firstRows));
    const secondRowsFile = path.join(
      second.outputDirectory,
      definition.categoryView,
      "result",
      "rows.private.json"
    );
    const secondRows = JSON.parse(fs.readFileSync(secondRowsFile, "utf8"));
    secondRows.find(({ categoryId }) => categoryId === requirement.id).reviewStatus =
      "UNGEKLÄRT";
    fs.writeFileSync(secondRowsFile, JSON.stringify(secondRows));

    const result = buildReferenceComparisonResult(
      [
        writeRun(root, document("reference-a", "A", 0), allReferenceIds),
        first,
        second,
      ],
      {}
    );
    const rowResult = result.categories
      .flatMap(({ rows }) => rows)
      .find(({ analysisRowId }) => analysisRowId === requirement.id);

    expect(rowResult).toMatchObject({
      pointDecision: { outcome: REFERENCE_OUTCOME.PARTIAL },
      packageB: { reviewStatus: "TEILBELEGT" },
    });
  });

  test("completes LF-GL-02 from its declared narrower storm inclusion", () => {
    const requirement = categoryCatalogs()
      .flatMap(({ catalog }) => catalog.requirements)
      .find(({ sourceReferenceId }) => sourceReferenceId === "LF-GL-02");
    const definition = categoryCatalogs().find(({ catalog }) =>
      catalog.requirements.some(({ id }) => id === requirement.id)
    );
    const allReferenceIds = new Set(
      categoryCatalogs().flatMap(({ catalog }) =>
        catalog.requirements.map(({ id }) => id)
      )
    );
    const counterpart = writeRun(
      root,
      document("counterpart-narrow-storm-glass", "B", 0),
      new Set([requirement.id])
    );
    const effectsFile = path.join(
      counterpart.outputDirectory,
      definition.categoryView,
      "effects",
      "materialized.private.json"
    );
    const effects = JSON.parse(fs.readFileSync(effectsFile, "utf8"));
    const judgement = effects.judgements.find(
      ({ requirementId, componentId }) =>
        requirementId === requirement.id && componentId === "solar_glass"
    );
    judgement.selectedScopePicture = "NARROW_ONLY";
    judgement.comparisonScopeKeys = ["STURM_INSURANCE"];
    fs.writeFileSync(effectsFile, JSON.stringify(effects));
    const sourcesFile = path.join(
      counterpart.outputDirectory,
      definition.categoryView,
      "effects",
      "selected-sources.private.json"
    );
    const sources = JSON.parse(fs.readFileSync(sourcesFile, "utf8"));
    sources.find(
      ({ requirementId, componentId }) =>
        requirementId === requirement.id && componentId === "solar_glass"
    ).candidateBinding = "NARROW_SCOPE";
    fs.writeFileSync(sourcesFile, JSON.stringify(sources));

    const result = buildReferenceComparisonResult(
      [
        writeRun(root, document("reference-a", "A", 0), allReferenceIds),
        counterpart,
      ],
      {}
    );
    const rowResult = result.categories
      .flatMap(({ rows }) => rows)
      .find(({ analysisRowId }) => analysisRowId === requirement.id);

    expect(rowResult).toMatchObject({
      pointDecision: {
        outcome: REFERENCE_OUTCOME.FOUND,
        reviewRequired: false,
      },
      packageB: { reviewStatus: "BELEGT" },
    });

    judgement.comparisonScopeKeys = ["FEUER_INSURANCE"];
    fs.writeFileSync(effectsFile, JSON.stringify(effects));
    const wrongScopeResult = buildReferenceComparisonResult(
      [
        writeRun(root, document("reference-a-wrong-scope", "A", 0), allReferenceIds),
        counterpart,
      ],
      {}
    );
    expect(
      wrongScopeResult.categories
        .flatMap(({ rows }) => rows)
        .find(({ analysisRowId }) => analysisRowId === requirement.id)
    ).toMatchObject({
      pointDecision: {
        outcome: REFERENCE_OUTCOME.PARTIAL,
        reviewRequired: true,
      },
      packageB: { reviewStatus: "TEILBELEGT" },
    });

    judgement.comparisonScopeKeys = ["STURM_INSURANCE"];
    for (const componentId of ["special_glass", "special_glass_limit"]) {
      const componentJudgement = effects.judgements.find(
        ({ requirementId, componentId: observedComponentId }) =>
          requirementId === requirement.id &&
          observedComponentId === componentId
      );
      componentJudgement.selectedScopePicture = "NARROW_ONLY";
      componentJudgement.comparisonScopeKeys = ["STURM_INSURANCE"];
      const componentSource = sources.find(
        ({ requirementId, componentId: observedComponentId }) =>
          requirementId === requirement.id &&
          observedComponentId === componentId
      );
      componentSource.candidateBinding = "NARROW_SCOPE";
      fs.writeFileSync(effectsFile, JSON.stringify(effects));
      fs.writeFileSync(sourcesFile, JSON.stringify(sources));

      const componentScopedResult = buildReferenceComparisonResult(
        [
          writeRun(
            root,
            document(`reference-a-${componentId}`, "A", 0),
            allReferenceIds
          ),
          counterpart,
        ],
        {}
      );
      expect(
        componentScopedResult.categories
          .flatMap(({ rows }) => rows)
          .find(({ analysisRowId }) => analysisRowId === requirement.id)
      ).toMatchObject({
        pointDecision: {
          outcome: REFERENCE_OUTCOME.PARTIAL,
          reviewRequired: true,
        },
        packageB: { reviewStatus: "TEILBELEGT" },
      });

      componentJudgement.selectedScopePicture = "GENERAL";
      componentJudgement.comparisonScopeKeys = [];
      componentSource.candidateBinding = "DIRECT";
    }
  });

  test("does not complete a limit component without its bound requested field", () => {
    const requirement = categoryCatalogs()
      .flatMap(({ catalog }) => catalog.requirements)
      .find(
        ({ components }) =>
          components.length > 1 &&
          components.some(({ factRole }) => factRole === "LIMIT")
      );
    const definition = categoryCatalogs().find(({ catalog }) =>
      catalog.requirements.some(({ id }) => id === requirement.id)
    );
    const limitComponent = requirement.components.find(
      ({ factRole }) => factRole === "LIMIT"
    );
    const allReferenceIds = new Set(
      categoryCatalogs().flatMap(({ catalog }) =>
        catalog.requirements.map(({ id }) => id)
      )
    );
    const counterpart = writeRun(
      root,
      document("counterpart-missing-limit", "B", 0),
      new Set([requirement.id])
    );
    const fieldsFile = path.join(
      counterpart.outputDirectory,
      definition.categoryView,
      "result",
      "requested-fields.private.json"
    );
    const fields = JSON.parse(fs.readFileSync(fieldsFile, "utf8"));
    const fieldResult = fields.requirements.find(
      ({ requirementId }) => requirementId === requirement.id
    );
    for (const field of fieldResult.fields)
      field.facts = field.facts.filter(
        (fact) => fact.componentScope?.id !== limitComponent.id
      );
    fs.writeFileSync(fieldsFile, JSON.stringify(fields));

    const result = buildReferenceComparisonResult(
      [
        writeRun(root, document("reference-a", "A", 0), allReferenceIds),
        counterpart,
      ],
      {}
    );
    const rowResult = result.categories
      .flatMap(({ rows }) => rows)
      .find(({ analysisRowId }) => analysisRowId === requirement.id);

    expect(rowResult).toMatchObject({
      pointDecision: { outcome: REFERENCE_OUTCOME.PARTIAL },
      packageB: { reviewStatus: "TEILBELEGT" },
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

  test("does not hide a terms exclusion behind supplement inclusion", () => {
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
    const termsEffects = JSON.parse(
      fs.readFileSync(termsEffectsFile, "utf8")
    );
    termsEffects.judgements
      .filter(({ requirementId }) => requirementId === objectRequirement.id)
      .forEach((judgement) => {
        judgement.coverageEffect = "EXCLUDED";
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
      pointDecision: { outcome: REFERENCE_OUTCOME.UNCLEAR },
      packageB: { reviewStatus: "WIDERSPRÜCHLICH" },
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

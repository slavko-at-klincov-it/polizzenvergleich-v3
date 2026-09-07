const resource = require("../../resources/policyAnalysis/lf-immo-reference-complete.v1.json");
const {
  LF_DYNAMIC_REFERENCE_PROFILE,
  categoryCatalogsFromManifest,
  dynamicAnalysisPrompt,
} = require("../../utils/policyComparison/lfDynamicReferenceProfile");
const {
  discoveryPlanIdentity,
} = require("../../utils/policyComparison/lfDynamicSideBDiscovery");
const {
  buildControlledOccurrenceWorksheet,
} = require("../../utils/policyAnalysis/controlledOccurrenceWorksheet");

function documentFromText(text, id = "lf-side-b-discovery-probe") {
  return {
    id,
    sourceDocumentId: id,
    title: `${id}.pdf`,
    documentType: "pdf",
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

function manifestFromResource() {
  const categories = [];
  const requirements = resource.requirements.map((definition, sourceOrder) => {
    let category = categories.find(({ id }) => id === definition.categoryId);
    if (!category) {
      category = {
        id: definition.categoryId,
        label: definition.categoryLabel,
        subcategories: [],
      };
      categories.push(category);
    }
    let subcategory = category.subcategories.find(
      ({ id }) => id === definition.subcategoryId
    );
    if (!subcategory) {
      subcategory = {
        id: definition.subcategoryId,
        label: definition.subcategoryLabel,
        requirementIds: [],
      };
      category.subcategories.push(subcategory);
    }
    subcategory.requirementIds.push(definition.id);
    return {
      requirementId: definition.id,
      sourceOrder,
      displayLabel: definition.label,
      physicalPages: definition.pages,
      searchPlanStatus: "EXPLORATORY_INCOMPLETE",
      components: definition.components.map((component) => ({
        ...component,
        factRole:
          {
            AGGREGATION: "CONDITION",
            BASIS: "CONDITION",
            COVERAGE: "BENEFIT",
            CONFLICT: "DOCUMENT_STATUS",
            DURATION: "LIMIT",
            OBLIGATION: "CONDITION",
            PROCESS: "CONDITION",
            REVIEW: "DOCUMENT_STATUS",
            RIGHT: "BENEFIT",
            SCOPE: "CONDITION",
            TERMINATION: "CONDITION",
            VALUATION: "CONDITION",
          }[component.factRole] || component.factRole,
      })),
      sourceSpans: [{ spanId: `${definition.id}-span` }],
    };
  });
  return { manifestSha256: "a".repeat(64), categories, requirements };
}

describe("complete LF dynamic reference profile", () => {
  test("contains the complete ordered semantic inventory", () => {
    expect(resource.requirements).toHaveLength(283);
    expect(new Set(resource.requirements.map(({ id }) => id)).size).toBe(283);
    expect(resource.requirements[0].id).toBe("PR-01");
    expect(resource.requirements.at(-1).id).toBe("AV-46");
    expect(
      resource.requirements.filter(({ crossPage }) => crossPage)
    ).toHaveLength(10);
    expect(resource.sharedValueGovernors).toHaveLength(6);
    expect(resource.sharedSemanticGovernors).toHaveLength(1);
    expect(resource.blockDispositionRules).toHaveLength(4);
    expect(LF_DYNAMIC_REFERENCE_PROFILE).toMatchObject({
      topologySource: "SERVER_CURATED_SEMANTIC_ORACLE",
      topologyRequirements: 283,
      topologyCategories: 13,
      sourceEvidenceBoundAtRunTime: true,
      discoversTopologyFromSourceA: false,
    });
  });

  test("creates 13 execution catalogs while preserving all 283 source rows", () => {
    const catalogs = categoryCatalogsFromManifest(manifestFromResource());
    expect(catalogs).toHaveLength(13);
    expect(
      catalogs.reduce(
        (sum, entry) => sum + entry.catalog.requirements.length,
        0
      )
    ).toBe(283);
    expect(
      catalogs
        .flatMap(({ catalog }) => catalog.requirements)
        .every(
          (requirement) =>
            requirement.negativeSearchPolicy === undefined &&
            requirement.searchPlanStatus === "EXPLORATORY_INCOMPLETE" &&
            requirement.sourceReferenceId
        )
    ).toBe(true);
    expect(dynamicAnalysisPrompt(catalogs[0])).toContain(
      "Schließe unmittelbar nach der Tabelle mit genau diesem Hinweis:"
    );
    expect(dynamicAnalysisPrompt(catalogs[0])).toContain(
      "serverseitig kuratiertes LF-IMMO-Fachprofil"
    );
    expect(catalogs[0].catalog.catalogId).toContain(
      discoveryPlanIdentity(resource)
    );
  });

  test("adds only versioned side-B discovery without changing the source manifest", () => {
    const manifest = manifestFromResource();
    const manifestBytes = JSON.stringify(manifest);
    const requirements = categoryCatalogsFromManifest(manifest).flatMap(
      ({ catalog }) => catalog.requirements
    );
    const component = (sourceReferenceId, componentId) =>
      requirements
        .find(
          (requirement) => requirement.sourceReferenceId === sourceReferenceId
        )
        .components.find(({ id }) => id === componentId);

    expect(component("PR-01", "applicability").conceptSearches).toHaveLength(1);
    expect(component("PR-03", "broker_condition").conceptSearches).toHaveLength(
      1
    );
    expect(component("PR-04", "base_product").conceptSearches).toHaveLength(1);
    expect(component("PR-05", "glass").aliases).toContain(
      "Glaspauschalversicherung"
    );
    expect(component("PR-05", "liability").conceptSearches).toHaveLength(
      1
    );
    expect(component("PR-06", "liability_sum").aliases).toContain(
      "Pauschalversicherungssumme"
    );
    expect(component("PR-08", "additional_cover").conceptSearches).toHaveLength(
      1
    );
    expect(component("PR-02", "insured_group").conceptSearches).toBeUndefined();
    expect(JSON.stringify(manifest)).toBe(manifestBytes);
  });

  test("discovers the confirmed semantic side-B wording without broad single-term matches", () => {
    const [lr01] = categoryCatalogsFromManifest(manifestFromResource());
    const text = [
      "Diese Rahmenvereinbarung gilt für Neuverträge und für Konvertierungen von Bestandsverträgen.",
      "Der Schriftverkehr für die durch den Makler betreuten Verträge wird mit dem Makler abgewickelt.",
      "Diese werden Vertragsinhalt, wenn die Produktvariante Premiumschutz beantragt wurde.",
      "Feuerversicherung gem. Sparte, Leitungswasserversicherung gem. Sparte, Sturmversicherung gem. Sparte, Glaspauschalversicherung gem. Sparte und Haftpflichtversicherung gem. Sparte.",
      "PauschalversicherungssummeEUR3.000.000,00",
      "Neben den Allgemeinen Bedingungen werden die Klauseln dieser Rahmenvereinbarung Vertragsinhalt.",
    ].join("\n");
    const worksheet = buildControlledOccurrenceWorksheet({
      catalog: lr01.catalog,
      document: documentFromText(text),
      documentFingerprint: "b".repeat(64),
    });
    const occurrenceCount = (sourceReferenceId, componentId) =>
      worksheet.requirements
        .find(
          (requirement) => requirement.sourceReferenceId === sourceReferenceId
        )
        .components.find(({ id }) => id === componentId).occurrenceCount;

    for (const [requirementId, componentId] of [
      ["PR-01", "applicability"],
      ["PR-03", "broker_condition"],
      ["PR-04", "base_product"],
      ["PR-05", "glass"],
      ["PR-05", "liability"],
      ["PR-06", "liability_sum"],
      ["PR-08", "additional_cover"],
    ])
      expect(occurrenceCount(requirementId, componentId)).toBeGreaterThan(0);

    const isolatedTerms = [
      "Neuverträge werden angeboten.",
      "Konvertierungen werden gesondert beschrieben.",
      "Der Makler erhält Unterlagen.",
      "Premium ist eine Bezeichnung.",
      "Eine Rahmenvereinbarung liegt vor.",
      "Eine Haftpflichtversicherung wird erwähnt.",
    ].join("\n\n");
    const isolatedWorksheet = buildControlledOccurrenceWorksheet({
      catalog: lr01.catalog,
      document: documentFromText(isolatedTerms, "isolated-terms"),
      documentFingerprint: "c".repeat(64),
    });
    const isolatedRequirement = (sourceReferenceId) =>
      isolatedWorksheet.requirements.find(
        (requirement) => requirement.sourceReferenceId === sourceReferenceId
      );
    for (const requirementId of [
      "PR-01",
      "PR-03",
      "PR-04",
      "PR-05",
      "PR-08",
    ])
      expect(
        isolatedRequirement(requirementId).components.reduce(
          (sum, component) => sum + component.occurrenceCount,
          0
        )
      ).toBe(0);
  });

  test("keeps the printed expert-clause contradiction review-only", () => {
    const conflict = resource.requirements.find(({ id }) => id === "AV-34");
    expect(conflict.components.map(({ factRole }) => factRole)).toEqual([
      "CONFLICT",
      "REVIEW",
    ]);
  });
});

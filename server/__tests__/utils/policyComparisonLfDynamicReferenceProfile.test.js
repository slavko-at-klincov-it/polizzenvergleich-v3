const resource = require("../../resources/policyAnalysis/lf-immo-reference-complete.v1.json");
const {
  LF_DYNAMIC_REFERENCE_PROFILE,
  categoryCatalogsFromManifest,
  dynamicAnalysisPrompt,
} = require("../../utils/policyComparison/lfDynamicReferenceProfile");
const {
  discoveryPlanIdentity,
  plan,
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
            DURATION: "CONDITION",
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
    expect(component("PR-05", "liability").conceptSearches).toHaveLength(1);
    expect(component("PR-06", "liability_sum").aliases).toContain(
      "Pauschalversicherungssumme"
    );
    expect(component("PR-08", "additional_cover").conceptSearches).toHaveLength(
      1
    );
    expect(component("PR-02", "insured_group").conceptSearches).toBeUndefined();
    const durationRequirement = requirements.find(
      ({ sourceReferenceId }) => sourceReferenceId === "GLT-02"
    );
    expect(
      durationRequirement.components.find(
        ({ id }) => id === "environmental_discovery_tail"
      )
    ).toMatchObject({
      factRole: "CONDITION",
      requestedFields: ["duration"],
    });
    expect(durationRequirement.requestedFields).toEqual(["duration"]);
    expect(JSON.stringify(manifest)).toBe(manifestBytes);
  });

  test("adds the bounded V2 discovery tranche for audited semantic wording", () => {
    expect(plan.planId).toBe("LF_DYNAMIC_SIDE_B_DISCOVERY_V2");
    const catalogs = categoryCatalogsFromManifest(manifestFromResource());
    const executionRequirement = (sourceReferenceId) =>
      catalogs
        .flatMap(({ catalog }) => catalog.requirements)
        .find(
          (requirement) => requirement.sourceReferenceId === sourceReferenceId
        );
    const catalogFor = (sourceReferenceId) =>
      catalogs.find(({ catalog }) =>
        catalog.requirements.some(
          (requirement) => requirement.sourceReferenceId === sourceReferenceId
        )
      ).catalog;

    const probes = [
      [
        "VS-03",
        "extensions",
        "Baubestandteile und Gebäudezubehör, die fest mit dem Bauwerk verbunden sind.",
      ],
      [
        "VS-03",
        "extensions",
        "Versichert sind fix mit dem Gebäude verbundene Beschattungen, Pergolen und Rollläden.",
      ],
      [
        "VS-04",
        "building_installations",
        "Gebäudeelektroinstallationen inklusive Schaltgeräten.",
      ],
      [
        "VS-18",
        "solar_pv",
        "Versichert sind Solar- und Photovoltaikanlagen am Grundstück.",
      ],
      [
        "VS-21",
        "meters_controls",
        "Gebäudeelektroinstallationen inklusive Schalt-, Verteiler- und Messgeräten.",
      ],
      [
        "GL-18",
        "obstacle_costs",
        "Ersetzt werden Entfernung und Wiederanbringen von Hindernissen wie Gittern.",
      ],
      [
        "GL-24",
        "surface_damage",
        "Ausgeschlossen sind Schäden durch Zerkratzen oder Verschrammen der Oberflächen.",
      ],
      [
        "HP-02",
        "legal_liability_trigger",
        "Es bestehen Schadenersatzverpflichtungen aufgrund gesetzlicher Haftpflichtbestimmungen privatrechtlichen Inhalts.",
      ],
      [
        "HP-02",
        "insured_risk_origin",
        "Versicherungsfall ist ein Schadenereignis, das dem versicherten Risiko entspringt.",
      ],
      [
        "HP-X01",
        "insured_self",
        "Kein Versicherungsschutz besteht für Schäden, die sich der Versicherungsnehmer selbst zufügt.",
      ],
      [
        "HP-X01",
        "household_members",
        "Ausgeschlossen sind Schäden zwischen dem Versicherungsnehmer und mit ihm in häuslicher Gemeinschaft lebenden Ehegatten oder Lebensgefährten.",
      ],
      [
        "GLT-02",
        "event_during_policy",
        "Der Vorfall muss sich während der Wirksamkeit des Versicherungsschutzes ereignen.",
      ],
      [
        "GLT-05",
        "first_medical_diagnosis",
        "Der Versicherungsfall gilt mit der ersten Feststellung der Gesundheitsschädigung durch einen Arzt als eingetreten.",
      ],
    ];

    for (const [sourceReferenceId, componentId, text] of probes) {
      const worksheet = buildControlledOccurrenceWorksheet({
        catalog: catalogFor(sourceReferenceId),
        document: documentFromText(text, `${sourceReferenceId}-${componentId}`),
        documentFingerprint: "d".repeat(64),
      });
      const requirement = worksheet.requirements.find(
        (entry) => entry.sourceReferenceId === sourceReferenceId
      );
      const occurrenceCount = requirement.components.find(
        ({ id }) => id === componentId
      ).occurrenceCount;
      if (occurrenceCount === 0)
        throw new Error(
          `DISCOVERY_PROBE_MISSED:${sourceReferenceId}:${componentId}`
        );
    }

    const negativeText = [
      "Gebäudetechnik wird regelmäßig gewartet.",
      "Solarenergie ist ein Thema der Nachhaltigkeit.",
      "Messwerte werden dokumentiert.",
      "Ein Hindernis wird erwähnt.",
      "Die Haftungsfrage bleibt offen.",
      "Der Vertrag besitzt eine Wirksamkeit.",
      "Eine ärztliche Behandlung kann erforderlich sein.",
    ].join("\n");
    for (const [sourceReferenceId, componentId] of probes) {
      const worksheet = buildControlledOccurrenceWorksheet({
        catalog: catalogFor(sourceReferenceId),
        document: documentFromText(
          negativeText,
          `negative-${sourceReferenceId}-${componentId}`
        ),
        documentFingerprint: "e".repeat(64),
      });
      const requirement = worksheet.requirements.find(
        (entry) => entry.sourceReferenceId === sourceReferenceId
      );
      expect(
        requirement.components.find(({ id }) => id === componentId)
          .occurrenceCount
      ).toBe(0);
    }

    const broadSelfReference = buildControlledOccurrenceWorksheet({
      catalog: catalogFor("HP-X01"),
      document: documentFromText(
        "Der Versicherungsnehmer selbst hat die Sanierung durchzuführen.",
        "negative-hp-x01-broad-self-reference"
      ),
      documentFingerprint: "f".repeat(64),
    });
    expect(
      broadSelfReference.requirements
        .find(({ sourceReferenceId }) => sourceReferenceId === "HP-X01")
        .components.find(({ id }) => id === "insured_self").occurrenceCount
    ).toBe(0);

    const ocrSelfExclusion = buildControlledOccurrenceWorksheet({
      catalog: catalogFor("HP-X01"),
      document: documentFromText(
        "Kein Versicherungsschutz besteht für Schäden, die sich der Versicherungnehmer selbst zufügt.",
        "positive-hp-x01-ocr-self-exclusion"
      ),
      documentFingerprint: "1".repeat(64),
    });
    expect(
      ocrSelfExclusion.requirements
        .find(({ sourceReferenceId }) => sourceReferenceId === "HP-X01")
        .components.find(({ id }) => id === "insured_self").occurrenceCount
    ).toBe(1);

    expect(executionRequirement("VS-21").components).toHaveLength(2);
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
    for (const requirementId of ["PR-01", "PR-03", "PR-04", "PR-05", "PR-08"])
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

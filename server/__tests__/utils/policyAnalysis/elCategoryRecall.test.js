const elCatalog = require("../../../resources/policyAnalysis/el-occurrence-full-draft.v0.1.json");
const elPilotCatalog = require("../../../resources/policyAnalysis/el-occurrence-pilot.v0.1.json");
const {
  buildControlledOccurrenceWorksheet,
} = require("../../../utils/policyAnalysis/controlledOccurrenceWorksheet");
const {
  buildCandidateTriagePayload,
} = require("../../../utils/policyAnalysis/candidateTriageContract");

function documentFromText(text) {
  return {
    id: "el-recall",
    sourceDocumentId: "el-recall",
    title: "el-recall",
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

function worksheet(text) {
  return buildControlledOccurrenceWorksheet({
    document: documentFromText(text),
    documentFingerprint: "el-recall",
    catalog: elCatalog,
  });
}

function component(result, requirementId, componentId) {
  return result.requirements
    .find(({ id }) => id === requirementId)
    .components.find(({ id }) => id === componentId);
}

function expectFound(result, requirementId, componentIds) {
  for (const componentId of componentIds)
    expect(
      component(result, requirementId, componentId).occurrences.length
    ).toBeGreaterThan(0);
}

function expectOpen(result, requirementId, componentIds) {
  for (const componentId of componentIds)
    expect(component(result, requirementId, componentId).occurrences).toEqual(
      []
    );
}

describe("EL category recall catalog", () => {
  test("finds the evidenced catastrophe clauses while leaving absent earth movements open", () => {
    const result = worksheet(
      [
        "5. Sturmversicherung",
        "Versichert sind Schäden durch Felssturz, Steinschlag und Erdrutsch.",
        "Zusätzlich versichert sind Katastrophen bis 1 % der Gebäudeversicherungssumme, mindestens EUR 20.000 und maximal EUR 100.000 pro versichertem Objekt, insbesondere Schäden durch:",
        "Hochwasser durch unvorhersehbares Ansteigen und Überborden von Gewässern.",
        "Überschwemmungen durch Regen- oder Schmelzwasser in erheblichem Umfang, das nicht auf normalem Weg abfließt, sowie durch in diesem Zusammenhang auftretenden Rückstau.",
        "Lawinen und Lawinenluftdruck.",
        "Erdbeben (es gilt ein Selbstbehalt von EUR 350 pro Schadenfall als vereinbart).",
      ].join("\n")
    );

    expectFound(result, "EL-01", ["elemental_per_event_limit"]);
    expectFound(result, "EL-03", ["shared_elemental_limit"]);
    expectFound(result, "EL-04", ["flood", "inundation"]);
    expectFound(result, "EL-05", [
      "heavy_rain",
      "surface_water",
      "without_watercourse_overflow",
    ]);
    expectFound(result, "EL-06", ["sewer_backflow"]);
    expectFound(result, "EL-08", ["landslide"]);
    expectOpen(result, "EL-08", ["sinkhole", "subsidence"]);
    expectFound(result, "EL-09", ["avalanche"]);
    expectFound(result, "EL-11", ["elemental_deductible"]);
  });

  test("finds explicit glass objects, limits and costs without inventing common-area glass", () => {
    const result = worksheet(
      [
        "7. Glasbruch",
        "Versichert sind im Rahmen der Gebäude-Glaspauschale die Verglasung der versicherten Gebäude bis zu einer Einzelscheibengröße von 10 m².",
        "In Wohnungen gelten Fenster und Mehrscheibenisolierungen als mitversichert.",
        "Sicherheitsgläser sind mitversichert.",
        "Die Verglasung von Nebengebäuden bis 5 % ist mitversichert.",
        "Blei-, Messing- und Kunstverglasungen bis EUR 1.500 sind mitversichert.",
        "Portale und Außenverglasungen bis EUR 10.000 sind mitversichert.",
        "Nicht versichert sind Verbundsicherheitsgläser mit den Eigenschaften durchbruchhemmend oder durchschusshemmend.",
        "Zusätzlich versichert sind Kosten für eine erforderliche Notverglasung oder Notverschalung.",
        "Glasbruchschäden, die im Zusammenhang mit einer Zusammenrottung, einem Krawall oder Tumult entstehen, sind versichert.",
      ].join("\n")
    );

    expectFound(result, "EL-13", ["building_glazing_breakage"]);
    expectOpen(result, "EL-14", [
      "stairwell_glass_breakage",
      "common_room_glass_breakage",
    ]);
    expectFound(result, "EL-15", [
      "insulating_or_safety_glass",
      "resistant_laminated_safety_glass",
    ]);
    expectFound(result, "EL-17", [
      "emergency_glazing_costs",
      "emergency_glazing_cost_limit",
    ]);
    expectOpen(result, "EL-18", ["glass_deductible"]);
    expectFound(result, "EL-18", ["glass_limit"]);
    expectFound(result, "EL-35", ["civil_unrest"]);
    expectOpen(result, "EL-35", ["strike", "lockout"]);
  });

  test("finds the explicit graffiti exclusion and burglary building-part clauses conservatively", () => {
    const result = worksheet(
      [
        "4. Feuerversicherung",
        "Ausgeschlossen vom Versicherungsschutz bleiben Schäden durch Graffiti.",
        "Mitversichert sind die Beschädigung oder das Abhandenkommen von Gebäudebestandteilen im Zusammenhang mit einem vollbrachten oder versuchten Einbruchdiebstahl.",
        "Die Vandalismusdeckung erstreckt sich nicht auf Vandalismus im Zuge eines Einbruchdiebstahls.",
      ].join("\n")
    );

    expectFound(result, "EL-26", ["graffiti_damage"]);
    expectOpen(result, "EL-26", [
      "graffiti_removal",
      "graffiti_limit",
      "graffiti_annual_count",
    ]);
    expectFound(result, "EL-27", ["burglary"]);
    expectOpen(result, "EL-27", ["common_areas", "cellar_compartments"]);
    expectFound(result, "EL-28", ["burglary_building_damage"]);
    expectFound(result, "EL-29", ["theft_of_fixed_building_parts"]);

    const el27Targets = buildCandidateTriagePayload(
      result
    ).bindingTargets.filter(({ requirementId }) => requirementId === "EL-27");
    expect(
      el27Targets.some(
        (target) =>
          target.contextText.includes("Beschädigung oder das Abhandenkommen") &&
          target.scopeResolution.scopeMatch === "NARROW"
      )
    ).toBe(true);
    expect(
      el27Targets.some(
        (target) =>
          target.contextText.includes("Vandalismusdeckung") &&
          target.modelDecisionFields.length > 0
      )
    ).toBe(true);
  });

  test("keeps EL-16 unchanged and all aliases document-independent", () => {
    const fullEl16 = elCatalog.requirements.find(({ id }) => id === "EL-16");
    const pilotEl16 = elPilotCatalog.requirements.find(
      ({ id }) => id === "EL-16"
    );
    expect(fullEl16).toEqual(pilotEl16);

    const aliases = elCatalog.requirements.flatMap((requirement) =>
      requirement.components.flatMap((candidate) => candidate.aliases)
    );
    for (const alias of aliases)
      expect(alias).not.toMatch(
        /(?:\bSeite\b|\.pdf\b|\bLF\s+IMMO\b|\bGenerali\b|\bWEVIG\b)/iu
      );
  });
});

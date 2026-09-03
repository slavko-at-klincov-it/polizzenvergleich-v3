const feCatalog = require("../../../resources/policyAnalysis/fe-occurrence-full-draft.v0.1.json");
const lwCatalog = require("../../../resources/policyAnalysis/lw-occurrence-full-draft.v0.1.json");
const stCatalog = require("../../../resources/policyAnalysis/st-occurrence-full-draft.v0.1.json");
const vbCatalog = require("../../../resources/policyAnalysis/vb-occurrence-full-draft.v0.1.json");
const weCatalog = require("../../../resources/policyAnalysis/we-occurrence-full-draft.v0.1.json");
const {
  buildControlledOccurrenceWorksheet,
} = require("../../../utils/policyAnalysis/controlledOccurrenceWorksheet");

function documentFromPages(pages, id) {
  let pageContent = "";
  const pageMap = pages.map((text, index) => {
    const start = pageContent.length;
    pageContent += text;
    const end = pageContent.length;
    if (index < pages.length - 1) pageContent += "\n";
    return { pageNumber: index + 1, start, end };
  });
  return {
    id,
    sourceDocumentId: id,
    title: `${id}.pdf`,
    documentType: "pdf",
    pageContent,
    pageMap,
    pdfExtraction: {
      schemaVersion: 1,
      totalPages: pages.length,
      processedPages: pages.length,
      pagesWithText: pages.filter(Boolean).length,
      complete: true,
    },
  };
}

function worksheet(catalog, text) {
  return buildControlledOccurrenceWorksheet({
    document: documentFromPages([text], `recall-${catalog.categoryView}`),
    documentFingerprint: `recall-${catalog.categoryView}`,
    catalog,
  });
}

function component(result, requirementId, componentId) {
  return result.requirements
    .find(({ id }) => id === requirementId)
    .components.find(({ id }) => id === componentId);
}

function expectOccurrences(result, expectations) {
  for (const [requirementId, componentIds] of expectations)
    for (const componentId of componentIds)
      expect(
        component(result, requirementId, componentId).occurrences.length
      ).toBeGreaterThan(0);
}

function expectSharedGroup(result, requirementId, componentIds) {
  expect(
    result.bindingGroups.some(
      (group) =>
        group.requirementId === requirementId &&
        componentIds.every((componentId) =>
          group.candidateIds.some((candidateId) =>
            component(result, requirementId, componentId).occurrences.some(
              (occurrence) => occurrence.candidateId === candidateId
            )
          )
        )
    )
  ).toBe(true);
}

describe("P0 category catalog candidate recall", () => {
  test("finds coordinated aircraft, parts and cargo plus firefighting costs", () => {
    const result = worksheet(
      feCatalog,
      [
        "Feuerversicherung",
        "Versichert sind Schäden durch Absturz und Anprall von Luft- oder Raumfahrzeugen, deren Teile bzw. Ladung.",
        "Sicherungs-, Aufräumungs-, Abbruch-, Feuerlösch-, Bewegungs- und Schutzkosten sind bis maximal 15 % der Gebäudeversicherungssumme auf Erstes Risiko mitversichert.",
      ].join("\n")
    );

    expectOccurrences(result, [
      ["FE-A13", ["aircraft_crash", "aircraft_parts", "aircraft_cargo"]],
      ["FE-D01", ["firefighting_costs", "firefighting_costs_limit"]],
    ]);
    expectSharedGroup(result, "FE-A13", [
      "aircraft_crash",
      "aircraft_parts",
      "aircraft_cargo",
    ]);
    expectSharedGroup(result, "FE-D01", [
      "firefighting_costs",
      "firefighting_costs_limit",
    ]);
  });

  test("finds both roles of an explicitly labelled insurance period", () => {
    const result = worksheet(
      feCatalog,
      [
        "Der Versicherungsschutz beginnt erst mit Zugang der Polizze.",
        "Versicherungsbeginn 19.01.2026, 0:00 Uhr, Versicherungsablauf 01.01.2037, 0:00 Uhr",
        "FEUERVERSICHERUNG",
      ].join("\n")
    );

    expectOccurrences(result, [
      ["FE-F05", ["temporal_validity", "coverage_start"]],
    ]);
  });

  test("finds the six prioritised Leitungswasser clause forms", () => {
    const result = worksheet(
      lwCatalog,
      [
        "Leitungswasserversicherung",
        "Versichert sind Schäden durch Bruch von wasserführenden Rohren innerhalb des Versicherungsgrundstückes.",
        "Das Vorhandensein einer Wasser führenden Fußboden- und Wandheizung ist mitversichert.",
        "Nicht versichert sind Schäden durch Grund- oder Hochwasser oder dadurch verursachten Rückstau.",
        "Nicht versichert sind Schäden durch Holzfäule, Schwamm- und Vermorschungsschäden.",
        "Mitversichert sind die Kosten der Rohrreinigung der Ableitungsrohre nach der Beseitigung von Verstopfungen bis EUR 2.000 je Schadenfall.",
        "Mitversichert sind die Kosten für den Wasserverlust nach einem ersatzpflichtigen Schaden bis EUR 10.000 je Schadenfall.",
      ].join("\n")
    );

    expectOccurrences(result, [
      ["LW-05", ["pipe_break", "pipe_itself"]],
      ["LW-11", ["heating_system"]],
      ["LW-12", ["underfloor_heating"]],
      ["LW-18", ["sewer_backwater_assignment"]],
      ["LW-22", ["fungus_damage", "rot_damage"]],
      ["LW-26", ["pipe_blockage", "cleaning_costs"]],
      ["LW-27", ["utility_water_loss_costs"]],
    ]);
    expectSharedGroup(result, "LW-05", ["pipe_break", "pipe_itself"]);
    expectSharedGroup(result, "LW-22", ["fungus_damage", "rot_damage"]);
    expectSharedGroup(result, "LW-26", ["pipe_blockage", "cleaning_costs"]);
  });

  test("finds sprinkler activation and sewer-network backwater in Leitungswasser scope", () => {
    const result = worksheet(
      lwCatalog,
      [
        "LEITUNGSWASSERVERSICHERUNG",
        "Nicht versichert sind Schäden im Falle einer bestimmungsgemäßen Auslösung der Sprinkleranlage.",
        "LW06 Rückstau aus dem Kanalnetz nach einem Schadenereignis Überschwemmung oder Hochwasser.",
      ].join("\n")
    );

    expect(
      component(result, "LW-13", "sprinkler_or_extinguishing_discharge")
        .occurrences
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          matchedAlias: "CONCEPT_SEARCH:sprinkler-or-extinguishing-activation",
          sectionScopeHint: expect.objectContaining({
            scopeKey: "LEITUNGSWASSER_INSURANCE",
          }),
        }),
      ])
    );
    expect(
      component(result, "LW-18", "sewer_backwater_assignment").occurrences
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          matchedAlias: "CONCEPT_SEARCH:backwater-from-sewer-network",
          sectionScopeHint: expect.objectContaining({
            scopeKey: "LEITUNGSWASSER_INSURANCE",
          }),
        }),
      ])
    );
  });

  test("finds compound Kanalrückstau under a structured LW division heading", () => {
    const result = worksheet(
      lwCatalog,
      [
        "B4 Leitungswasserversicherung (LW)",
        "LW06 Kanalrückstau nach einer Überschwemmung ist in dieser Sparte geregelt.",
      ].join("\n")
    );

    expect(
      component(result, "LW-18", "sewer_backwater_assignment").occurrences
    ).toEqual([
      expect.objectContaining({
        matchedAlias: "Kanalrückstau",
        sectionScopeHint: expect.objectContaining({
          scopeKey: "LEITUNGSWASSER_INSURANCE",
        }),
      }),
    ]);
  });

  test("does not join unrelated sprinkler and backwater atoms across scope gaps", () => {
    const result = worksheet(
      lwCatalog,
      [
        "LEITUNGSWASSERVERSICHERUNG",
        "Die Sprinkleranlage wird jährlich gewartet.",
        "Die bestimmungsgemäße Auslösung der Alarmanlage ist zu protokollieren.",
        "",
        "Ein Rückstau im Straßenverkehr ist nicht Gegenstand des Vertrags.",
        "",
        "Das Kanalnetz wird turnusmäßig inspiziert.",
      ].join("\n")
    );

    expect(
      component(result, "LW-13", "sprinkler_or_extinguishing_discharge")
    ).toMatchObject({
      terminalState: "NO_CONTROLLED_CANDIDATE",
      occurrenceCount: 0,
    });
    expect(
      component(result, "LW-18", "sewer_backwater_assignment")
    ).toMatchObject({
      terminalState: "NO_CONTROLLED_CANDIDATE",
      occurrenceCount: 0,
    });
  });

  test("maps a roof avalanche clause to both avalanche and snow-slide roles", () => {
    const result = worksheet(
      stCatalog,
      [
        "STURMVERSICHERUNG",
        "Mitversichert gelten",
        "Dachlawinen (Schnee und Eis) auf Erstes Risiko EUR 7.500,00.",
      ].join("\n")
    );

    expectOccurrences(result, [["ST-27", ["avalanche", "snow_slide"]]]);
    expectSharedGroup(result, "ST-27", ["avalanche", "snow_slide"]);
  });

  test.each([
    ["Leckortungskosten bis EUR 2.500", "leak_location_costs"],
    [
      "Suchkosten zur Auffindung der Schadensstelle bis EUR 2.500",
      "search_costs",
    ],
  ])(
    "treats the LW-08 wording %s as an alternative fact",
    (clause, expectedComponentId) => {
      const result = worksheet(
        lwCatalog,
        ["LEITUNGSWASSERVERSICHERUNG", "Mitversichert gelten", clause].join(
          "\n"
        )
      );
      const requirement = result.requirements.find(({ id }) => id === "LW-08");

      expect(requirement.componentSatisfactionPolicy).toBe("ANY");
      expect(requirement.scopeRules.narrowAliases).toContain(
        "Leitungswasser- und Sturmversicherung"
      );
      expect(
        component(result, "LW-08", expectedComponentId).occurrences
      ).not.toHaveLength(0);
    }
  );

  test("finds the eight prioritised general-contract clauses", () => {
    const result = worksheet(
      vbCatalog,
      [
        "ALLGEMEINE VERTRAGSBESTIMMUNGEN",
        "Paritätisches Kündigungsrecht nach einem Schadensfall.",
        "Anzeige von Gefahrenerhöhungen: Gefahrerhöhungen sind unverzüglich anzuzeigen.",
        "Der Versicherungsnehmer hat nach einem Schadenfall unverzüglich seine Hausverwaltung oder die zuständige Gebäudeversicherung über den Schadenhergang und Schadenumfang zu informieren.",
        "Die Verletzung dieser Pflichten kann zum Verlust des Versicherungsschutzes führen.",
        "Auswahl des Sachverständigen: Das Gutachten tritt an Stelle des Schiedsgutachterverfahrens.",
        "Sachverständigenkosten werden zu 80 %, höchstens EUR 36.337, ersetzt.",
        "Die Wiederherstellung muss innerhalb dreier Jahre nach dem Schadenfall erfolgen; die Frist für die Wiederherstellung wird um die Dauer des Deckungsprozesses erstreckt.",
        "Die Versicherung unterstützt die Feststellung und Erledigung oder Abwehr des Schadens im Zusammenhang mit der Schadenbearbeitung.",
      ].join("\n")
    );

    expectOccurrences(result, [
      ["VB-05", ["policyholder_claim_termination"]],
      ["VB-06", ["insurer_claim_termination"]],
      ["VB-17", ["risk_increase_notification"]],
      ["VB-21", ["claim_notification_deadline"]],
      ["VB-22", ["late_notification_consequence"]],
      ["VB-24", ["expert_procedure", "expert_cost_allocation"]],
      ["VB-26", ["reinstatement_deadline"]],
      ["VB-36", ["claims_handling", "claims_contact"]],
    ]);
    expectSharedGroup(result, "VB-36", ["claims_handling", "claims_contact"]);
  });

  test("finds claims handling and contact in a compact service block", () => {
    const result = worksheet(
      vbCatalog,
      [
        "ALLGEMEINE VERTRAGSBESTIMMUNGEN",
        "Das kostenlose Schadenmanagement:",
        "Unter 0800 204 44 00 ermöglichen wir Ihnen rund um die Uhr eine rasche und unbürokratische telefonische Schadenmeldung.",
        "Bei Problemen und Notfällen erhalten Sie Beratung und Hilfestellung.",
      ].join("\n")
    );

    expectOccurrences(result, [
      ["VB-36", ["claims_handling", "claims_contact"]],
    ]);
    expectSharedGroup(result, "VB-36", ["claims_handling", "claims_contact"]);
  });

  test("finds every beneficiary in the tenant recourse-waiver clause", () => {
    const result = worksheet(
      vbCatalog,
      [
        "ALLGEMEINE VERTRAGSBESTIMMUNGEN",
        "5. Regressverzicht",
        "Richtet sich der Ersatzanspruch gegen einen Mieter des versicherten Gebäudes, dessen Hausangestellten oder einen mit ihm in häuslicher Gemeinschaft lebenden Familienangehörigen, verzichtet der Versicherer auf seinen Regressanspruch, soweit der Mieter den Schaden weder vorsätzlich noch grob fahrlässig verursacht hat.",
      ].join("\n")
    );

    expectOccurrences(result, [
      ["VB-16", ["residents_recourse_waiver", "residents", "tenants"]],
    ]);
    expect(component(result, "VB-15", "unit_owners").occurrences).toHaveLength(
      0
    );
  });

  test("finds coordinated apartment finishes, cellar scope and rental units", () => {
    const result = worksheet(
      weCatalog,
      [
        "Wohnungseigentum",
        "Versichert ist die Differenz zwischen Zeitwert und Neuwert bei Schäden an Tapeten, Malereien, textilen Wand und Bodenbelägen.",
        "Mitversichert sind Keller- und andere Abstellabteile oder -boxen samt dazugehörigen Türen, jedoch exklusive deren Inhalt.",
        "Mitversichert ist der Mietverlust für privat und gewerblich genutzte Gebäudeeinheiten und -räume, wenn der Mieter / Pächter den Bestandzins verweigern kann.",
      ].join("\n")
    );

    expectOccurrences(result, [
      ["WE-07", ["painting", "wallpaper", "wall_coverings"]],
      ["WE-13", ["basement_compartments", "building_component"]],
      ["WE-14", ["basement_contents"]],
      ["WE-17", ["rent_loss", "rented_units"]],
      ["WE-19", ["commercial_units", "inside_building"]],
    ]);
    expectSharedGroup(result, "WE-07", [
      "painting",
      "wallpaper",
      "wall_coverings",
    ]);
    expectSharedGroup(result, "WE-13", [
      "basement_compartments",
      "building_component",
    ]);
    expectSharedGroup(result, "WE-17", ["rent_loss", "rented_units"]);
    expectSharedGroup(result, "WE-19", ["commercial_units", "inside_building"]);
  });
});

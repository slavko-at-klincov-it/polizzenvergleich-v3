const catalog = require("../../../resources/policyAnalysis/hp-occurrence-full-draft.v0.2.json");
const {
  buildControlledOccurrenceWorksheet,
} = require("../../../utils/policyAnalysis/controlledOccurrenceWorksheet");

function documentFromText(text, id = "hp-recall") {
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

function worksheet(text, id) {
  return buildControlledOccurrenceWorksheet({
    document: documentFromText(text, id),
    documentFingerprint: id || "hp-recall",
    catalog,
  });
}

function component(result, requirementId, componentId) {
  return result.requirements
    .find(({ id }) => id === requirementId)
    .components.find(({ id }) => id === componentId);
}

function expectOccurrences(result, requirements) {
  for (const [requirementId, componentIds] of requirements)
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

describe("HP category candidate recall", () => {
  test("finds the liability amount, annual aggregate and pure financial-loss clause", () => {
    const result = worksheet(
      [
        "8. Gebäude- und Grundstückshaftpflichtversicherung",
        "Die Pauschaldeckungssumme beträgt EUR 2.000.000.",
        "Die jeweils maßgebende Pauschalversicherungssumme für alle Versicherungsfälle eines Jahres zusammen maximal dreimal zur Verfügung.",
        "Reine Vermögensschäden sind mitversichert. Bei reinen Vermögensschäden ist der Versicherungsfall der Verstoß.",
        "Die Versicherung übernimmt Schadenersatzverpflichtungen wegen Personen- und Sachschäden.",
      ].join("\n"),
      "hp-limits"
    );

    expectOccurrences(result, [
      [
        "HP-01",
        ["combined_liability_limit", "personal_injury", "property_damage"],
      ],
      ["HP-02", ["annual_aggregate_multiple"]],
      ["HP-03", ["pure_financial_loss_sublimit"]],
    ]);
    expect(
      component(result, "HP-01", "combined_liability_limit").occurrences[0]
        .context.text
    ).toContain("2.000.000");
    expect(
      component(result, "HP-02", "annual_aggregate_multiple").occurrences[0]
        .context.text
    ).toContain("maximal dreimal");
    const financialOnly = worksheet(
      "Reine Vermögensschäden sind mitversichert. Bei reinen Vermögensschäden ist der Versicherungsfall der Verstoß.",
      "hp-financial-loss-without-sublimit"
    );
    expect(
      component(financialOnly, "HP-03", "pure_financial_loss_sublimit")
        .occurrences[0].context.text
    ).not.toMatch(/EUR|€|Prozent|%/u);
  });

  test("finds compact product-summary wording for combined and builders liability limits", () => {
    const result = worksheet(
      [
        "HAFTPFLICHTVERSICHERUNG",
        "-PauschalversicherungssummeEUR3.000.000,00",
        "Mitversichert gelten",
        "- Bauherr - Umbau-, Neubau- und Sanierungshaftpflichtrisiko (Gesamtbaukosten EUR 1.000.000) Sublimit EUR 3.000.000,00",
      ].join("\n"),
      "hp-product-summary"
    );

    expectOccurrences(result, [
      [
        "HP-01",
        ["combined_liability_limit", "personal_injury", "property_damage"],
      ],
      ["HP-08", ["builders_liability", "construction_sum_limit"]],
    ]);
    expectSharedGroup(result, "HP-01", ["personal_injury", "property_damage"]);
    expect(
      component(result, "HP-08", "construction_sum_limit").occurrences[0]
        .context.text
    ).toContain("Gesamtbaukosten EUR 1.000.000");
  });

  test("finds narrow cleaning claims, tenant recourse and playground scope", () => {
    const result = worksheet(
      [
        "Mitversichert ist die Innehabung und Pflege der Liegenschaft einschließlich Kinderspielplätze.",
        "Regressverzicht: Richtet sich der Ersatzanspruch gegen einen Mieter des versicherten Gebäudes, verzichtet der Versicherer auf seinen Regressanspruch, soweit der Mieter den Schaden weder vorsätzlich noch grob fahrlässig verursacht hat.",
        "Schadenersatzansprüche der Miteigentümer oder Mieter im Zusammenhang mit Reinigungs- und Betreuungsarbeiten sind mitversichert.",
      ].join("\n"),
      "hp-people"
    );

    expectOccurrences(result, [
      ["HP-15", ["cross_liability"]],
      ["HP-16", ["recourse_waiver", "tenants"]],
      ["HP-18", ["playground"]],
    ]);
    expect(
      component(result, "HP-18", "play_equipment_inspection").occurrences
    ).toHaveLength(0);
  });

  test("finds serial events, passive defence and cost allocation", () => {
    const result = worksheet(
      [
        "Als ein Versicherungsfall mehrere auf derselben Ursache beruhende Schadenereignisse sowie Schadenereignisse auf gleichartigen Ursachen.",
        "Die Versicherung übernimmt die Kosten der Feststellung und Abwehr (auch vor Gericht) einer von einem Dritten behaupteten Schadenersatzverpflichtung, auch im Falle eines unberechtigten Anspruches.",
        "Diese Kosten werden auf die Pauschalversicherungssumme angerechnet.",
      ].join("\n"),
      "hp-defence"
    );

    expectOccurrences(result, [
      ["HP-21", ["serial_loss_clause", "loss_event_definition"]],
      ["HP-23", ["passive_legal_protection"]],
      ["HP-24", ["defence_costs", "counted_against_limit"]],
    ]);
    expectSharedGroup(result, "HP-21", [
      "serial_loss_clause",
      "loss_event_definition",
    ]);
    expect(
      result.requirements.find(({ id }) => id === "HP-24")
        .coverageAggregationPolicy
    ).toBe("COVERAGE_ROLES_ONLY");
  });

  test("finds Austria, rented-property exclusion and cleaning damage", () => {
    const result = worksheet(
      [
        "Der Versicherungsschutz erstreckt sich auf Schadenfälle, die in Österreich eingetreten sind.",
        "Nicht versichert sind Schäden an Sachen, die entliehen, gemietet, geleast, gepachtet oder in Verwahrung genommen wurden.",
        "Sach- und Personenschäden im Zusammenhang mit Reinigungs- und Betreuungsarbeiten durch Miteigentümer, Mieter und deren dort wohnende Angehörige sind mitversichert.",
      ].join("\n"),
      "hp-scope"
    );

    expectOccurrences(result, [
      ["HP-25", ["territorial_scope"]],
      ["HP-26", ["rented_property_damage"]],
      ["HP-27", ["cleaning_or_caretaking_staff", "staff_caused_damage"]],
    ]);
    expect(
      component(result, "HP-25", "foreign_coverage").occurrences
    ).toHaveLength(0);
    expectSharedGroup(result, "HP-27", [
      "cleaning_or_caretaking_staff",
      "staff_caused_damage",
    ]);
    expect(
      result.requirements.find(({ id }) => id === "HP-27")
        .coverageAggregationPolicy
    ).toBe("COVERAGE_ROLES_ONLY");
  });

  test.each([
    [
      "exact policy wording",
      "Der Versicherungsschutz bezieht sich auf weltweit eingetretene Schadenereignisse.",
      "weltweit eingetretene Schadenereignisse",
    ],
    [
      "inflected concept wording",
      "Bei weltweit eintretenden Schadenereignissen besteht Versicherungsschutz.",
      "CONCEPT_SEARCH:worldwide-loss-events",
    ],
    [
      "reordered concept wording",
      "Schadenereignisse, die weltweit eintreten, sind vom Versicherungsschutz umfasst.",
      "CONCEPT_SEARCH:worldwide-loss-events",
    ],
  ])(
    "binds HP-25 worldwide coverage to both semantic components for %s",
    (_label, text, matchedAlias) => {
      const result = worksheet(text, `hp-worldwide-${_label}`);
      const territorial = component(
        result,
        "HP-25",
        "territorial_scope"
      ).occurrences;
      const foreign = component(
        result,
        "HP-25",
        "foreign_coverage"
      ).occurrences;

      expect(territorial).toHaveLength(1);
      expect(foreign).toHaveLength(1);
      expect(territorial[0].matchedAlias).toBe(matchedAlias);
      expect(foreign[0].matchedAlias).toBe(matchedAlias);
      expect(territorial[0].context.text).toBe(foreign[0].context.text);
      expectSharedGroup(result, "HP-25", [
        "territorial_scope",
        "foreign_coverage",
      ]);
    }
  );

  test("normalizes an OCR-style hyphenated line break in the exact worldwide clause", () => {
    const result = worksheet(
      "Der Versicherungsschutz bezieht sich auf welt-\nweit eingetretene Schadenereignisse.",
      "hp-worldwide-ocr-break"
    );

    expectOccurrences(result, [
      ["HP-25", ["territorial_scope", "foreign_coverage"]],
    ]);
    expectSharedGroup(result, "HP-25", [
      "territorial_scope",
      "foreign_coverage",
    ]);
  });

  test.each([
    [
      "worldwide portfolio without a loss event",
      "Das Portfolio ist weltweit verteilt.",
    ],
    ["loss event without worldwide scope", "Schadenereignisse werden erfasst."],
    [
      "terms separated by a paragraph boundary",
      "Der Versicherungsschutz gilt weltweit.\n\nSchadenereignisse werden gesondert definiert.",
    ],
  ])("rejects HP-25 concept candidates for %s", (_label, text) => {
    const result = worksheet(text, `hp-worldwide-negative-${_label}`);

    expect(
      component(result, "HP-25", "territorial_scope").occurrences
    ).toHaveLength(0);
    expect(
      component(result, "HP-25", "foreign_coverage").occurrences
    ).toHaveLength(0);
  });

  test("finds only the two-year environmental tail", () => {
    const result = worksheet(
      "Für Umweltsachschäden erstreckt sich der Versicherungsschutz auf eine Umweltstörung, die während der Wirksamkeit des Versicherungsschutzes oder spätestens zwei Jahre danach festgestellt wird.",
      "hp-environment-tail"
    );

    expectOccurrences(result, [
      ["HP-33", ["extended_reporting_period", "after_contract_end"]],
    ]);
    expectSharedGroup(result, "HP-33", [
      "extended_reporting_period",
      "after_contract_end",
    ]);
    expect(
      component(result, "HP-33", "extended_reporting_period").occurrences[0]
        .context.text
    ).toContain("zwei Jahre danach");
  });

  test("does not treat property contingency or positive pollutant treatment as HP-34/35", () => {
    const result = worksheet(
      [
        "Sachversicherung: Vorsorge für Neu-, Zu- und Umbauten sowie Neuanschaffungen.",
        "Wurde eine Vorsorgeversicherung vereinbart, dient sie dem Ausgleich einer Unterversicherung.",
        "Mitversichert sind Kosten für die Behandlung von gefährlichem Abfall, wenn diese durch Schadstoffe verursacht werden.",
      ].join("\n"),
      "hp-false-positive-guards"
    );

    expect(
      component(result, "HP-34", "contingency_coverage").occurrences
    ).toHaveLength(0);
    expect(component(result, "HP-34", "new_risks").occurrences).toHaveLength(0);
    expect(
      component(result, "HP-35", "pollutant_exclusion").occurrences
    ).toHaveLength(0);
  });
});

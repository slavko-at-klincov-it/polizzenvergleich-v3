const {
  DETERMINISTIC_BINDING,
  deterministicVsCandidateBinding,
  deterministicVsPreparedDecision,
} = require("../../../utils/policyAnalysis/deterministicVsEvidenceRules");

function occurrence(text) {
  return { context: { text } };
}

describe("deterministicVsEvidenceRules", () => {
  test("keeps waste-related temporary storage in its narrow causal scope", () => {
    const scopedOccurrence = ({ scopeLead = "", contextText, exactText }) => {
      const contextStart = 2_000;
      const relativeStart = contextText.indexOf(exactText);
      return {
        exactText,
        documentStart: contextStart + relativeStart,
        documentEnd: contextStart + relativeStart + exactText.length,
        context: {
          text: contextText,
          documentStart: contextStart,
          documentEnd: contextStart + contextText.length,
        },
        scopeLead: { text: scopeLead },
      };
    };
    const bindingFor = (source) =>
      deterministicVsCandidateBinding({
        requirementId: "VS-32",
        componentId: "temporary_storage_costs",
        occurrence: source,
      });

    expect(
      bindingFor(
        scopedOccurrence({
          contextText:
            "Kosten für Sondermüll und gefährlichen Abfall. Die Kosten einer Zwischenlagerung übernimmt der Versicherer.",
          exactText: "Kosten einer Zwischenlagerung",
        })
      )
    ).toEqual({
      binding: DETERMINISTIC_BINDING.NARROW_SCOPE,
      basis: "VS_32_WASTE_OR_CONTAMINATION_STORAGE_SCOPE",
      authoritative: true,
    });
    expect(
      bindingFor(
        scopedOccurrence({
          scopeLead:
            "Kontaminierte Sachen werden zur Ablagerungsstätte transportiert. Versichert sind:",
          contextText:
            "- Die Kosten einer sechsmonatigen Zwischenlagerung sind versichert;",
          exactText: "Kosten einer sechsmonatigen Zwischenlagerung",
        })
      )
    ).toMatchObject({ binding: DETERMINISTIC_BINDING.NARROW_SCOPE });
    expect(
      bindingFor(
        scopedOccurrence({
          contextText:
            "Die Kosten einer Zwischenlagerung sind versichert. Ein späterer Abschnitt regelt Sondermüll.",
          exactText: "Kosten einer Zwischenlagerung",
        })
      )
    ).toBeNull();
  });

  test.each([
    [
      "VS-01",
      "replacement_new_value",
      "Das versicherte Gebäude ist zum Neuwert zu ersetzen.",
      "EXPLICIT_NEW_VALUE_BENEFIT",
    ],
    [
      "VS-02",
      "current_value_clause",
      "Wird die Sache nicht innerhalb dreier Jahre wiederhergestellt, erfolgt die Entschädigung nach dem Zeitwert.",
      "EXPLICIT_CURRENT_VALUE_CLAUSE",
    ],
    [
      "VS-02",
      "residual_value_threshold",
      "Für instandgehaltene Gebäude gilt ein Zeitwert von mindestens 30 %.",
      "EXPLICIT_RESIDUAL_VALUE_THRESHOLD",
    ],
    [
      "VS-07",
      "underinsurance_waiver",
      "Der Versicherer verzichtet auf den Einwand einer eventuell bestehenden Unterversicherung.",
      "EXPLICIT_UNDERINSURANCE_WAIVER",
    ],
    [
      "VS-07",
      "underinsurance_waiver",
      "Verzicht auf den Einwand der Unterversicherung wird vereinbart.",
      "EXPLICIT_UNDERINSURANCE_WAIVER",
    ],
    [
      "VS-08",
      "underinsurance_waiver_condition",
      "Die Vorschriften finden im Schadenfall nur Anwendung, wenn die Voraussetzungen erfüllt sind.",
      "EXPLICIT_UNDERINSURANCE_CONDITION",
    ],
    [
      "VS-09",
      "underinsurance_waiver_prerequisites",
      "Der Schutz gilt für Objekte, für die ein Neuwertschätzgutachten besteht.",
      "EXPLICIT_UNDERINSURANCE_PREREQUISITE",
    ],
    [
      "VS-10",
      "automatic_index_adjustment",
      "Die Versicherungssumme erhöht oder vermindert sich jährlich bei Hauptfälligkeit.",
      "EXPLICIT_AUTOMATIC_INDEX_ADJUSTMENT",
    ],
    [
      "VS-11",
      "index_type",
      "Maßgeblich ist der Baukostenindex (Baumeisterarbeiten).",
      "EXPLICIT_INDEX_TYPE",
    ],
    [
      "VS-15",
      "outbuilding_cover",
      "Darüber hinaus besteht Versicherungsschutz für Nebengebäude bis maximal 5 %.",
      "EXPLICIT_OUTBUILDING_COVER",
    ],
    [
      "VS-35",
      "restoration_clause",
      "Der Anspruch besteht, wenn die Verwendung der Entschädigung zur Wiederbeschaffung oder Wiederherstellung innerhalb dreier Jahre sichergestellt ist.",
      "EXPLICIT_RESTORATION_CLAUSE",
    ],
    [
      "VS-35",
      "reconstruction_period",
      "Wird die Sache nicht innerhalb dreier Jahre wiederhergestellt, erfolgt die Entschädigung nach dem Zeitwert.",
      "EXPLICIT_RECONSTRUCTION_PERIOD",
    ],
  ])(
    "binds explicit %s evidence directly",
    (requirementId, componentId, text, basis) => {
      expect(
        deterministicVsCandidateBinding({
          requirementId,
          componentId,
          occurrence: occurrence(text),
        })
      ).toEqual({ binding: DETERMINISTIC_BINDING.DIRECT, basis });
    }
  );

  test("keeps a generic Baukostenindex occurrence out of the index-type facts", () => {
    expect(
      deterministicVsCandidateBinding({
        requirementId: "VS-11",
        componentId: "index_type",
        occurrence: occurrence(
          "Die Frist beginnt nach der letzten Anpassung an den Baukostenindex."
        ),
      })
    ).toEqual({
      binding: DETERMINISTIC_BINDING.MENTION_ONLY,
      basis: "GENERIC_INDEX_MENTION_WITHOUT_TYPE",
    });
  });

  test("does not treat a liability mention of an outbuilding as insured property cover", () => {
    expect(
      deterministicVsCandidateBinding({
        requirementId: "VS-15",
        componentId: "outbuilding_cover",
        occurrence: occurrence(
          "Die Haftpflicht umfasst Schadenersatzverpflichtungen aus Nebengebäuden auf Erstes Risiko."
        ),
      })
    ).toEqual({
      binding: DETERMINISTIC_BINDING.MENTION_ONLY,
      basis: "EXPLICIT_OUTBUILDING_COVER_WRONG_SCOPE",
    });
  });

  test("keeps a bare outbuilding occurrence as a non-evidentiary mention", () => {
    expect(
      deterministicVsCandidateBinding({
        requirementId: "VS-15",
        componentId: "outbuilding_cover",
        occurrence: occurrence("innerhalb der Gebäude und Nebengebäude"),
      })
    ).toEqual({
      binding: DETERMINISTIC_BINDING.MENTION_ONLY,
      basis: "GENERIC_OUTBUILDING_MENTION_WITHOUT_COVER",
    });
  });

  test.each(["cleanup_costs", "demolition_costs"])(
    "keeps %s mentions from an activated liability clause out of VS-21 property cost cover",
    (componentId) => {
      expect(
        deterministicVsCandidateBinding({
          requirementId: "VS-21",
          componentId,
          occurrence: {
            ...occurrence(
              "Bauherr - versichert sind Schadenersatzverpflichtungen aus Abbruch-, Grab- und Bauarbeiten."
            ),
            sectionScopeHint: {
              scopeKey: "HAFTPFLICHT_INSURANCE",
              clauseCode: "81PW0160",
            },
          },
        })
      ).toEqual({
        binding: DETERMINISTIC_BINDING.MENTION_ONLY,
        basis: "LIABILITY_SECTION_NOT_PROPERTY_CLEANUP_COST_COVER",
      });
    }
  );

  test("keeps a generic restoration mention outside the clause as non-evidentiary", () => {
    expect(
      deterministicVsCandidateBinding({
        requirementId: "VS-35",
        componentId: "restoration_clause",
        occurrence: occurrence(
          "Der Gebäudeeigentümer hat vertraglich für die Wiederherstellung aufzukommen."
        ),
      })
    ).toEqual({
      binding: DETERMINISTIC_BINDING.MENTION_ONLY,
      basis: "GENERIC_RESTORATION_MENTION_WITHOUT_CLAUSE",
    });
  });

  test("does not guess when a familiar category contains unproven wording", () => {
    expect(
      deterministicVsCandidateBinding({
        requirementId: "VS-07",
        componentId: "underinsurance_waiver",
        occurrence: occurrence("Unterversicherung wird hier erwähnt."),
      })
    ).toBeNull();
  });

  test("owns a prepared effect only for candidates carrying a matching deterministic binding", () => {
    const target = {
      requirementId: "VS-10",
      componentId: "automatic_index_adjustment",
      candidates: [
        {
          candidateId: "candidate:index-adjustment",
          candidateBinding: "DIRECT",
          deterministicBindingBasis: "EXPLICIT_AUTOMATIC_INDEX_ADJUSTMENT",
        },
      ],
    };

    expect(deterministicVsPreparedDecision(target)).toEqual({
      selectedCandidateIds: ["candidate:index-adjustment"],
      coverageEffect: "INCLUDED",
      basis: "EXPLICIT_VS_RULE:VS-10",
    });
    expect(
      deterministicVsPreparedDecision({
        ...target,
        candidates: [
          {
            ...target.candidates[0],
            deterministicBindingBasis: undefined,
          },
        ],
      })
    ).toBeNull();
  });

  test("selects one source per distinct index type instead of repeating the same type per section", () => {
    const candidate = (candidateId, contextText, contextDocumentStart) => ({
      candidateId,
      candidateBinding: "DIRECT",
      deterministicBindingBasis: "EXPLICIT_INDEX_TYPE",
      contextText,
      contextDocumentStart,
    });
    const target = {
      requirementId: "VS-11",
      componentId: "index_type",
      candidates: [
        candidate(
          "candidate:fire",
          "BKI 2020 (Baukostenindex für den Wohnhaus- und Siedlungsbau - Baumeisterarbeiten 2020 - Insgesamt)",
          100
        ),
        candidate(
          "candidate:storm",
          "BKI 2020 (Baukostenindex für den Wohnhaus- und Siedlungsbau - Baumeisterarbeiten 2020 - Insgesamt)",
          300
        ),
        candidate(
          "candidate:clause",
          "Veröffentlicht wird der Baukostenindex (Baumeisterarbeiten).",
          500
        ),
      ],
    };

    expect(deterministicVsPreparedDecision(target)).toMatchObject({
      selectedCandidateIds: ["candidate:fire", "candidate:clause"],
      coverageEffect: "DEFINED",
    });
  });

  test.each([
    [
      "VS-20",
      "playground_equipment",
      "Als mitversichert gelten Spielplatzeinrichtungen, das sind fest installierte Kinderspielgeräte im Freien.",
      "EXPLICIT_PLAYGROUND_EQUIPMENT",
    ],
    [
      "VS-34",
      "community_devices",
      "Einfriedungen, Außenanlagen, gemeinschaftliche Einrichtungen, Spielplatzeinrichtungen 10PG0010 Als mitversichert gelten:",
      "EXPLICIT_COMMUNITY_DEVICES",
    ],
    [
      "VS-23",
      "movement_costs",
      "Bewegungs- und Schutzkosten sind Kosten, die zur Wiederherstellung entstehen.",
      "EXPLICIT_MOVEMENT_COSTS",
    ],
    [
      "VS-31",
      "hotel_or_replacement_accommodation_costs",
      "Mitversichert sind die tatsächlichen Kosten für Ersatzräumlichkeiten für die Dauer der tatsächlichen Unbenutzbarkeit.",
      "EXPLICIT_REPLACEMENT_ACCOMMODATION_COSTS",
    ],
    [
      "VS-36",
      "maximum_indemnity_per_event",
      "Die Höchstentschädigung im Schadensfall beträgt inklusive aller Positionen maximal 150 %.",
      "EXPLICIT_MAXIMUM_INDEMNITY_PER_LOSS",
    ],
  ])(
    "binds source-specific full-VS evidence for %s",
    (requirementId, componentId, text, basis) => {
      expect(
        deterministicVsCandidateBinding({
          requirementId,
          componentId,
          occurrence: occurrence(text),
        })
      ).toEqual({ binding: DETERMINISTIC_BINDING.DIRECT, basis });
    }
  );

  test("rejects the glazing-only outdoor-lighting occurrence", () => {
    expect(
      deterministicVsCandidateBinding({
        requirementId: "VS-19",
        componentId: "outdoor_lighting",
        occurrence: occurrence(
          "Versichert ist der Bruch der Verglasung von Außenbeleuchtung und Laternen."
        ),
      })
    ).toEqual({
      binding: DETERMINISTIC_BINDING.MENTION_ONLY,
      basis: "EXPLICIT_OUTDOOR_LIGHTING_WRONG_SCOPE",
    });
  });

  test("keeps a bare community-facilities heading model-owned", () => {
    expect(
      deterministicVsCandidateBinding({
        requirementId: "VS-34",
        componentId: "community_devices",
        occurrence: occurrence(
          "Einfriedungen, Außenanlagen, gemeinschaftliche Einrichtungen, Spielplatzeinrichtungen"
        ),
      })
    ).toBeNull();
  });

  test("a limit role is direct only when a value follows the category phrase", () => {
    const limitOccurrence = (text, exactText) => {
      const documentStart = 100;
      const start = text.indexOf(exactText);
      return {
        context: {
          text,
          documentStart,
          documentEnd: documentStart + text.length,
        },
        documentStart: documentStart + start,
        documentEnd: documentStart + start + exactText.length,
      };
    };
    const phrase = "Mehrkosten durch behördliche Auflagen";

    expect(
      deterministicVsCandidateBinding({
        requirementId: "VS-25",
        componentId: "authority_reconstruction_extra_cost_limit",
        occurrence: limitOccurrence(
          `${phrase} auf Erstes Risiko EUR1.530.400,00`,
          phrase
        ),
      })
    ).toEqual({
      binding: DETERMINISTIC_BINDING.DIRECT,
      basis: "EXPLICIT_AUTHORITY_RECONSTRUCTION_COSTS",
    });
    expect(
      deterministicVsCandidateBinding({
        requirementId: "VS-25",
        componentId: "authority_reconstruction_extra_cost_limit",
        occurrence: limitOccurrence(
          `${phrase}. Das sind Kosten für bauliche Verbesserungen.`,
          phrase
        ),
      })
    ).toEqual({
      binding: DETERMINISTIC_BINDING.MENTION_ONLY,
      basis: "EXPLICIT_AUTHORITY_RECONSTRUCTION_COSTS_WITHOUT_BOUND_LIMIT",
    });
  });
});

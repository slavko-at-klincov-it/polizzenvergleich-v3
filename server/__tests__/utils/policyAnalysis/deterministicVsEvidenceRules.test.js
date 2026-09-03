const {
  DETERMINISTIC_BINDING,
  deterministicVsCandidateBinding,
  deterministicVsPreparedDecision,
} = require("../../../utils/policyAnalysis/deterministicVsEvidenceRules");
const vsCatalog = require("../../../resources/policyAnalysis/vs-occurrence-full-draft.v0.2.json");

function occurrence(text) {
  return { context: { text } };
}

function sourceOccurrence({ text, exactText, contextStart = 1_000 }) {
  const relativeStart = text.indexOf(exactText);
  if (relativeStart < 0) throw new Error("TEST_EXACT_TEXT_MISSING");
  return {
    exactText,
    documentStart: contextStart + relativeStart,
    documentEnd: contextStart + relativeStart + exactText.length,
    context: {
      text,
      documentStart: contextStart,
      documentEnd: contextStart + text.length,
    },
  };
}

describe("deterministicVsEvidenceRules", () => {
  test("keeps resident adaptations separate from above-standard apartment equipment", () => {
    const requirement = (id) =>
      vsCatalog.requirements.find((candidate) => candidate.id === id);
    const aliases = (id) => requirement(id).components[0].aliases;

    expect(vsCatalog.catalogId).toBe("vs-occurrence-full-draft-v0.16");
    expect(aliases("VS-13")).toContain(
      "Adaptierungen und Investitionen der Bewohner"
    );
    expect(aliases("VS-14")).not.toContain(
      "Adaptierungen und Investitionen der Bewohner"
    );
  });

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
      "Für instandgehaltene Gebäude gilt ein Zeitwert von mindestens 30 % und damit die volle Neuwertentschädigung.",
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
      "VS-08",
      "underinsurance_waiver_condition",
      "Der Versicherer verzichtet auf den Einwand einer Unterversicherung, soweit die Versicherungssumme um nicht mehr als 15 % vom Versicherungswert abweicht.",
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
      "VS-13",
      "apartment_interior_fitout",
      "Versichert sind: - Adaptierungen und Investitionen der Bewohner;",
      "EXPLICIT_RESIDENT_INTERIOR_ADAPTATIONS",
    ],
    [
      "VS-14",
      "apartment_special_equipment",
      "Versichert ist die Sonderausstattung einzelner Wohnungen, soweit diese über die Standardausführung hinausgeht.",
      "EXPLICIT_APARTMENT_SPECIAL_EQUIPMENT_ABOVE_STANDARD",
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
          occurrence:
            requirementId === "VS-02" &&
            componentId === "residual_value_threshold"
              ? sourceOccurrence({
                  text,
                  exactText: "Zeitwert von mindestens 30 %",
                })
              : occurrence(text),
        })
      ).toEqual({ binding: DETERMINISTIC_BINDING.DIRECT, basis });
    }
  );

  test.each([
    [
      "Liegt der Zeitwert der Sachen unter 40 % der Neuherstellungskosten, wird maximal der Zeitwert ersetzt.",
      "Zeitwert der Sachen unter 40 % der Neuherstellungskosten",
    ],
    [
      "Sämtliche zum Neuwert versicherte Gebäude und Sachen sind zum Neuwert zu ersetzen, sofern der Zeitwert der versicherten Gebäude und Sachen im Schadenzeitpunkt zumindest 20 % des Neuwertes betragen hat.",
      "Zeitwert der versicherten Gebäude und Sachen im Schadenzeitpunkt zumindest 20 % des Neuwertes",
    ],
  ])("binds a source-local variable VS-02 threshold: %s", (text, exactText) => {
    expect(
      deterministicVsCandidateBinding({
        requirementId: "VS-02",
        componentId: "residual_value_threshold",
        occurrence: sourceOccurrence({ text, exactText }),
      })
    ).toEqual({
      binding: DETERMINISTIC_BINDING.DIRECT,
      basis: "EXPLICIT_RESIDUAL_VALUE_THRESHOLD",
    });
  });

  test.each([
    "Der Zeitwert wird aus dem Neuwert abzüglich Alter und Abnützung ermittelt.",
    "Der Zeitwert beträgt 40 %.",
    "Restwerte bis 15 % des Neuwertes werden ersetzt.",
    "Die Versicherungssumme weicht um 20 % vom Versicherungswert ab.",
    "Die Grenze von 40 % gilt nicht; ersetzt wird unabhängig davon zum Neuwert.",
  ])("does not bind a non-threshold VS-02 percentage: %s", (text) => {
    const exactText = text.match(
      /(?:Zeitwert|Restwerte|Versicherungssumme|Grenze)/u
    )[0];
    expect(
      deterministicVsCandidateBinding({
        requirementId: "VS-02",
        componentId: "residual_value_threshold",
        occurrence: sourceOccurrence({ text, exactText }),
      })
    ).toBeNull();
  });

  test("does not treat a bare sum-deviation statement as a waiver condition", () => {
    expect(
      deterministicVsCandidateBinding({
        requirementId: "VS-08",
        componentId: "underinsurance_waiver_condition",
        occurrence: occurrence(
          "Die Versicherungssumme darf um nicht mehr als 25 % vom Versicherungswert abweichen."
        ),
      })
    ).toBeNull();
  });

  test.each([
    "Der Versicherer verzichtet nicht auf den Einwand einer Unterversicherung, soweit die Versicherungssumme um nicht mehr als 25 % vom Versicherungswert abweicht.",
    "Der Versicherer kann wahlweise auf den Einwand einer Unterversicherung verzichten, soweit die Versicherungssumme um nicht mehr als 25 % vom Versicherungswert abweicht.",
  ])(
    "keeps negated or optional deviation clauses out of direct evidence",
    (text) => {
      expect(
        deterministicVsCandidateBinding({
          requirementId: "VS-08",
          componentId: "underinsurance_waiver_condition",
          occurrence: occurrence(text),
        })
      ).toEqual({
        binding: DETERMINISTIC_BINDING.MENTION_ONLY,
        basis: "NEGATED_OR_OPTIONAL_UNDERINSURANCE_WAIVER",
      });
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

  test("does not promote resident adaptations to above-standard apartment equipment", () => {
    expect(
      deterministicVsCandidateBinding({
        requirementId: "VS-14",
        componentId: "apartment_special_equipment",
        occurrence: occurrence(
          "Versichert sind: - Adaptierungen und Investitionen der Bewohner;"
        ),
      })
    ).toEqual({
      binding: DETERMINISTIC_BINDING.MENTION_ONLY,
      basis: "RESIDENT_ADAPTATIONS_DO_NOT_PROVE_ABOVE_STANDARD_EQUIPMENT",
    });
  });

  test.each([
    [
      "Sonderausstattung einzelner Wohnungen ist nicht versichert, auch wenn sie über die Standardausführung hinausgeht.",
      "EXPLICIT_APARTMENT_SPECIAL_EQUIPMENT_ABOVE_STANDARD_WRONG_SCOPE",
    ],
    [
      "Definition: Sonderausstattung einzelner Wohnungen bezeichnet Ausführungen über die Standardausführung hinaus.",
      "EXPLICIT_APARTMENT_SPECIAL_EQUIPMENT_ABOVE_STANDARD_WRONG_SCOPE",
    ],
  ])(
    "keeps negative or definitional special-equipment wording non-evidentiary",
    (text, basis) => {
      expect(
        deterministicVsCandidateBinding({
          requirementId: "VS-14",
          componentId: "apartment_special_equipment",
          occurrence: occurrence(text),
        })
      ).toEqual({ binding: DETERMINISTIC_BINDING.MENTION_ONLY, basis });
    }
  );

  test.each([
    "Sonderausstattung einzelner Wohnungen wird erwähnt. In einer anderen Klausel ist eine Leistung über die Standardausführung hinaus versichert.",
  ])(
    "does not join separated special-equipment and above-standard clauses",
    (text) => {
      expect(
        deterministicVsCandidateBinding({
          requirementId: "VS-14",
          componentId: "apartment_special_equipment",
          occurrence: occurrence(text),
        })
      ).toBeNull();
    }
  );

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

  test("rejects a demolition-state clause without rejecting demolition costs", () => {
    const nonCost = sourceOccurrence({
      text: "Der Verkehrswert ist maßgeblich. Ein Gebäude ist dauernd entwertet, wenn es zum Abbruch bestimmt oder für seinen Betriebszweck nicht mehr verwendbar ist.",
      exactText: "Abbruch",
    });
    expect(
      deterministicVsCandidateBinding({
        requirementId: "VS-21",
        componentId: "demolition_costs",
        occurrence: nonCost,
      })
    ).toEqual({
      binding: DETERMINISTIC_BINDING.MENTION_ONLY,
      basis: "DEMOLITION_STATE_NOT_DEMOLITION_COST",
      authoritative: true,
    });
    expect(
      deterministicVsCandidateBinding({
        requirementId: "VS-21",
        componentId: "cleanup_costs",
        occurrence: nonCost,
      })
    ).toBeNull();

    expect(
      deterministicVsCandidateBinding({
        requirementId: "VS-21",
        componentId: "demolition_costs",
        occurrence: sourceOccurrence({
          text: "Die Kosten für den Abbruch eines zum Abbruch bestimmten Gebäudes sind bis 15 % versichert.",
          exactText: "Abbruch",
        }),
      })
    ).toBeNull();
  });

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

  test.each([
    [
      "restoration_clause",
      "Wiederherstellung bzw. Wiederbeschaffung zur Gänze sichergestellt",
      "Die Entschädigungsleistung wird unter den Voraussetzungen erbracht, dass die Wiederherstellung bzw. Wiederbeschaffung zur Gänze sichergestellt ist.",
      "EXPLICIT_RESTORATION_CLAUSE",
    ],
    [
      "reconstruction_period",
      "Wiederherstellung bzw. Wiederbeschaffung binnen drei Jahren",
      "Die Entschädigungsleistung wird unter den Voraussetzungen erbracht, dass die Wiederherstellung bzw. Wiederbeschaffung binnen drei Jahren ab dem Eintritt des Schadenereignisses erfolgt.",
      "EXPLICIT_RECONSTRUCTION_PERIOD",
    ],
    [
      "restoration_clause",
      "Für die Wiederherstellung genügt es",
      "Für die Wiederherstellung genügt es, wenn für zerstörte oder beschädigte Gebäude wieder Gebäude hergestellt werden, die dem gleichen Zweck dienen.",
      "EXPLICIT_RESTORATION_CLAUSE",
    ],
    [
      "restoration_clause",
      "Wiederaufbau bzw. die Wiederherstellung kann auch",
      "Der Wiederaufbau bzw. die Wiederherstellung kann auch ohne Vorliegen eines behördlichen Wiederaufbauverbotes innerhalb Österreichs erfolgen.",
      "EXPLICIT_RESTORATION_CLAUSE",
    ],
    [
      "restoration_clause",
      "Entschädigung zur Gänze für die Wiederherstellung bzw. Wiederbeschaffung verwendet",
      "Den Anspruch auf Gesamtentschädigung erwirbt der Versicherungsnehmer nur, wenn gesichert ist, dass die Entschädigung zur Gänze für die Wiederherstellung bzw. Wiederbeschaffung verwendet wird.",
      "EXPLICIT_RESTORATION_CLAUSE",
    ],
    [
      "reconstruction_period",
      "diese Frist um die Dauer dieses Prozesses erstreckt",
      "Der Anspruch auf Gesamtentschädigung setzt die Wiederherstellung binnen drei Jahren voraus. Im Falle eines Deckungsprozesses wird diese Frist um die Dauer dieses Prozesses erstreckt.",
      "EXPLICIT_RECONSTRUCTION_PERIOD",
    ],
  ])(
    "binds the local EABS VS-35 %s phrase",
    (componentId, exactText, text, basis) => {
      expect(
        deterministicVsCandidateBinding({
          requirementId: "VS-35",
          componentId,
          occurrence: sourceOccurrence({ text, exactText }),
        })
      ).toEqual({
        binding: DETERMINISTIC_BINDING.DIRECT,
        basis,
        authoritative: true,
      });
    }
  );

  test.each([
    "Die Kosten der Wiederherstellung bzw. Wiederbeschaffung zur Gänze sichergestellt gespeicherter Daten werden ersetzt.",
    "Die Entschädigungsleistung setzt nicht voraus, dass die Wiederherstellung bzw. Wiederbeschaffung zur Gänze sichergestellt ist.",
    "Die Entschädigungsleistung nennt optional die Wiederherstellung bzw. Wiederbeschaffung zur Gänze sichergestellt.",
  ])("does not bind an adversarial restoration phrase: %s", (text) => {
    const exactText =
      "Wiederherstellung bzw. Wiederbeschaffung zur Gänze sichergestellt";
    expect(
      deterministicVsCandidateBinding({
        requirementId: "VS-35",
        componentId: "restoration_clause",
        occurrence: sourceOccurrence({ text, exactText }),
      })
    ).toEqual({
      binding: DETERMINISTIC_BINDING.MENTION_ONLY,
      basis: "GENERIC_RESTORATION_MENTION_WITHOUT_CLAUSE",
    });
  });

  test("does not bind an earlier generic occurrence from a later real clause", () => {
    const exactText = "Wiederbeschaffung oder Wiederherstellung";
    const text =
      "Kosten für Datenträger richten sich nach Wiederbeschaffung oder Wiederherstellung. Später gilt: Die Entschädigungsleistung wird unter den Voraussetzungen erbracht, dass die Wiederherstellung bzw. Wiederbeschaffung binnen drei Jahren erfolgt.";
    expect(
      deterministicVsCandidateBinding({
        requirementId: "VS-35",
        componentId: "restoration_clause",
        occurrence: sourceOccurrence({ text, exactText }),
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

  test.each([
    "Keine Aufwertung der Gebäudeversicherungssummen und Prämien erfolgt nach dem Baukostenindex.",
    "Die Indexanpassung ist aufgehoben. Historisch: Die Aufwertung der Gebäudeversicherungssummen und Prämien erfolgt nach dem Baukostenindex.",
    "Die Indexanpassung ist ausgesetzt; die Aufwertung der Gebäudeversicherungssummen und Prämien erfolgt nach dem Baukostenindex nicht mehr.",
    "Die Versicherungssumme erhöht oder vermindert sich jährlich nicht.",
    "Die Versicherungssumme erhöht oder vermindert sich jährlich nur auf Antrag.",
    "Gegen eine Mehrprämie gilt: Die Versicherungssumme erhöht oder vermindert sich jährlich.",
  ])("rejects a negated or optional VS-10 mechanism: %s", (text) => {
    expect(
      deterministicVsCandidateBinding({
        requirementId: "VS-10",
        componentId: "automatic_index_adjustment",
        occurrence: occurrence(text),
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

  test("keeps generic outdoor facilities from proving VS-19 paths", () => {
    expect(
      deterministicVsCandidateBinding({
        requirementId: "VS-19",
        componentId: "outdoor_paths",
        occurrence: sourceOccurrence({
          text: "Außenanlagen wie Müllsammelplätze, Beleuchtungsanlagen und Fahnenstangen",
          exactText: "Außenanlagen",
        }),
      })
    ).toEqual({
      binding: DETERMINISTIC_BINDING.MENTION_ONLY,
      basis: "GENERIC_OUTDOOR_FACILITIES_WITHOUT_PATHS",
      authoritative: true,
    });
    expect(
      deterministicVsCandidateBinding({
        requirementId: "VS-19",
        componentId: "outdoor_paths",
        occurrence: sourceOccurrence({
          text: "Außenanlagen einschließlich befestigter Gehwege",
          exactText: "Außenanlagen",
        }),
      })
    ).toEqual({
      binding: DETERMINISTIC_BINDING.DIRECT,
      basis: "EXPLICIT_OUTDOOR_PATHS",
    });
    for (const text of [
      "Außenanlagen einschließlich Asphaltierungen",
      "Außenanlagen einschließlich befestigter Flächen",
      "Außenanlagen einschließlich Bodenbefestigungen",
      "Außenanlagen einschließlich Zufahrtswege",
      "Außenanlagen sind mitversichert",
    ]) {
      const decision = deterministicVsCandidateBinding({
        requirementId: "VS-19",
        componentId: "outdoor_paths",
        occurrence: sourceOccurrence({ text, exactText: "Außenanlagen" }),
      });
      expect(decision?.basis).not.toBe(
        "GENERIC_OUTDOOR_FACILITIES_WITHOUT_PATHS"
      );
    }
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

  test.each([
    "authority_reconstruction_extra_costs",
    "authority_reconstruction_extra_cost_limit",
  ])(
    "keeps a pure VS-25 sum-equalization allocation out of %s",
    (componentId) => {
      const phrase = "Mehrkosten durch behördliche Auflagen";
      const text =
        "Sind Gebäude und Inhalt gegen die gleiche Gefahr versichert, wird diese Versicherung in den Summenausgleich einbezogen.\n" +
        `c) gelten die ${phrase} für Gebäude und Inhalt gemeinsam summarisch versichert.\n` +
        "Alle anderen Positionen, die auf Erstes Risiko versichert sind, sind vom Summenausgleich ausgeschlossen.";

      expect(
        deterministicVsCandidateBinding({
          requirementId: "VS-25",
          componentId,
          occurrence: sourceOccurrence({ text, exactText: phrase }),
        })
      ).toEqual({
        binding: DETERMINISTIC_BINDING.MENTION_ONLY,
        basis: "PURE_SUM_EQUALIZATION_ALLOCATION_NOT_AUTHORITY_COST_GRANT",
        authoritative: true,
      });
    }
  );

  test("does not suppress a VS-25 grant with its own local first-risk limit", () => {
    const phrase = "Mehrkosten durch behördliche Auflagen";
    const text =
      "Die Versicherung wird in den Summenausgleich einbezogen.\n" +
      `${phrase} sind bis 5 % des NBW auf Erstes Risiko mitversichert.`;

    expect(
      deterministicVsCandidateBinding({
        requirementId: "VS-25",
        componentId: "authority_reconstruction_extra_costs",
        occurrence: sourceOccurrence({ text, exactText: phrase }),
      })
    ).toEqual({
      binding: DETERMINISTIC_BINDING.DIRECT,
      basis: "EXPLICIT_AUTHORITY_RECONSTRUCTION_COSTS",
    });
  });

  test("does not authorize a VS-25 allocation rejection for invalid offsets", () => {
    const phrase = "Mehrkosten durch behördliche Auflagen";
    const text =
      "Die Versicherung wird in den Summenausgleich einbezogen.\n" +
      `c) gelten die ${phrase} für Gebäude und Inhalt gemeinsam summarisch versichert.`;
    const invalid = sourceOccurrence({ text, exactText: phrase });
    invalid.documentStart += 1;
    invalid.documentEnd += 1;

    const decision = deterministicVsCandidateBinding({
      requirementId: "VS-25",
      componentId: "authority_reconstruction_extra_costs",
      occurrence: invalid,
    });
    expect(
      decision?.basis ===
        "PURE_SUM_EQUALIZATION_ALLOCATION_NOT_AUTHORITY_COST_GRANT" &&
        decision?.authoritative === true
    ).toBe(false);
  });
});

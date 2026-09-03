const {
  PACKAGE_MEMBER,
  canonicalComparisonAtoms,
  comparisonApplicability,
  completeRawComparisonAtom,
  semanticComparisonAtomKey,
} = require("../../utils/policyComparison/comparisonAtomCanonicalization");

function rawAtom(id, overrides = {}) {
  const candidateId = `candidate-${id}`;
  return {
    requirementId: "VS-01",
    requirementContractDigest: "a".repeat(64),
    componentId: "sum_insured",
    componentLabel: "Versicherungssumme",
    factRole: "LIMIT",
    componentSatisfactionPolicy: "ALL",
    coverageAggregationPolicy: null,
    declaredComponents: [{ id: "sum_insured", factRole: "LIMIT" }],
    evidencePresence: "FOUND",
    coverageEffect: "DEFINED",
    conflictState: "NONE",
    selectedScopePicture: "GENERAL",
    scopePolicy: "GENERAL_REQUIRED",
    documentUuids: [`document-${id}`],
    documentRole: "MAIN_POLICY",
    documentStatus: "ACTIVE",
    documentApplicability: "ACTIVE",
    selectedCandidateIds: [candidateId],
    unresolvedCandidateIds: [],
    requestedFieldStatus: "NOT_REQUIRED",
    requestedFields: [],
    optionalFields: [],
    fields: [],
    sources: [
      {
        candidateId,
        physicalPageNumber: 3,
        printedPageLabel: "Seite 2",
        exactText: "Versicherungssumme ist vereinbart.",
        conditionCheckText: "Die Regelung gilt für den Vertrag.",
        startOffset: 120,
        endOffset: 158,
      },
    ],
    ...overrides,
  };
}

function limitAtom(id, value, overrides = {}) {
  const candidateId = `candidate-${id}`;
  return rawAtom(id, {
    selectedCandidateIds: [candidateId],
    requestedFieldStatus: "COMPLETE",
    requestedFields: ["limit"],
    fields: [
      {
        field: "limit",
        status: "FOUND",
        facts: [
          {
            rawValue: value,
            normalizedValue: value,
            valueType: "MONEY",
            unit: "EUR",
            limitKind: "CAPPED",
            qualifier: "je Schadenfall",
            variantScope: { key: "all" },
            componentScope: { key: "building" },
            source: {
              candidateId,
              physicalPageNumber: 3,
              exactText: value,
              startOffset: 140,
              endOffset: 150,
            },
          },
        ],
      },
    ],
    sources: [
      {
        candidateId,
        physicalPageNumber: 3,
        printedPageLabel: "Seite 2",
        exactText: `Limit ${value}`,
        startOffset: 120,
        endOffset: 158,
      },
    ],
    ...overrides,
  });
}

function permutations(values) {
  if (values.length < 2) return [values];
  return values.flatMap((value, index) =>
    permutations(values.filter((_, candidate) => candidate !== index)).map(
      (tail) => [value, ...tail]
    )
  );
}

describe("comparison atom canonicalization", () => {
  test("maps only the three exact document status and applicability pairs", () => {
    const valid = [
      ["ACTIVE", "ACTIVE"],
      ["FRAMEWORK_TERMS", "CONDITIONAL"],
      ["PROPOSAL", "PROPOSED_ONLY"],
    ];
    for (const [documentStatus, documentApplicability] of valid)
      expect(
        comparisonApplicability(
          rawAtom(`${documentStatus}-${documentApplicability}`, {
            documentStatus,
            documentApplicability,
          })
        )
      ).toBe(PACKAGE_MEMBER);

    const invalid = [
      ["ACTIVE", "CONDITIONAL"],
      ["FRAMEWORK_TERMS", "ACTIVE"],
      ["PROPOSAL", "ACTIVE"],
      ["UNKNOWN", "ACTIVE"],
      ["ACTIVE", "UNKNOWN"],
    ];
    for (const [documentStatus, documentApplicability] of invalid) {
      const candidate = rawAtom(`${documentStatus}-${documentApplicability}`, {
        documentStatus,
        documentApplicability,
      });
      expect(comparisonApplicability(candidate)).toBeNull();
      expect(completeRawComparisonAtom(candidate)).toBe(false);
    }
    expect(
      comparisonApplicability(
        rawAtom("not-found", { evidencePresence: "NOT_FOUND" })
      )
    ).toBeNull();
  });

  test("groups active, framework and proposal contributors deterministically without losing provenance", () => {
    const contributors = [
      rawAtom("active"),
      rawAtom("framework", {
        documentRole: "FRAMEWORK",
        documentStatus: "FRAMEWORK_TERMS",
        documentApplicability: "CONDITIONAL",
      }),
      rawAtom("proposal", {
        documentRole: "PROPOSAL",
        documentStatus: "PROPOSAL",
        documentApplicability: "PROPOSED_ONLY",
      }),
    ];
    const variants = permutations(contributors).map((atoms) =>
      canonicalComparisonAtoms(atoms)
    );
    expect(new Set(variants.map(JSON.stringify)).size).toBe(1);
    expect(variants[0]).toHaveLength(1);
    expect(variants[0][0]).toMatchObject({
      comparisonApplicability: PACKAGE_MEMBER,
      documentApplicability: PACKAGE_MEMBER,
      documentUuids: [
        "document-active",
        "document-framework",
        "document-proposal",
      ],
    });
    expect(variants[0][0].comparisonContributors).toHaveLength(3);
    expect(variants[0][0].comparisonContributors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          documentStatus: "FRAMEWORK_TERMS",
          documentApplicability: "CONDITIONAL",
          comparisonApplicability: PACKAGE_MEMBER,
          sources: [
            expect.objectContaining({
              printedPageLabel: "Seite 2",
              conditionCheckText: "Die Regelung gilt für den Vertrag.",
              startOffset: 120,
              endOffset: 158,
            }),
          ],
        }),
      ])
    );
  });

  test("uses semantic field values while preserving raw field sources", () => {
    const formattedA = limitAtom("a", "EUR 5.000,00");
    const formattedB = limitAtom("b", "5 000,00 EUR");
    expect(semanticComparisonAtomKey(formattedA)).toBe(
      semanticComparisonAtomKey(formattedB)
    );
    const [canonical] = canonicalComparisonAtoms([formattedB, formattedA]);
    expect(canonical.comparisonContributors).toHaveLength(2);
    expect(
      canonical.comparisonContributors.flatMap(({ fields }) => fields)
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "limit",
          status: "FOUND",
          facts: [
            expect.objectContaining({
              source: expect.objectContaining({
                startOffset: 140,
                endOffset: 150,
              }),
            }),
          ],
        }),
      ])
    );

    expect(
      semanticComparisonAtomKey(
        limitAtom("different", "EUR 5.000,00", {
          fields: [
            {
              ...formattedA.fields[0],
              facts: [
                {
                  ...formattedA.fields[0].facts[0],
                  qualifier: "pro Versicherungsjahr",
                },
              ],
            },
          ],
        })
      )
    ).not.toBe(semanticComparisonAtomKey(formattedA));
  });

  test("accepts GENERAL_AND_NARROW but rejects unknown scope and incomplete requested fields", () => {
    expect(
      completeRawComparisonAtom(
        rawAtom("combined", { selectedScopePicture: "GENERAL_AND_NARROW" })
      )
    ).toBe(true);
    expect(
      completeRawComparisonAtom(
        rawAtom("unknown", { selectedScopePicture: "UNKNOWN" })
      )
    ).toBe(false);
    expect(
      completeRawComparisonAtom(
        rawAtom("narrow-invalid", {
          selectedScopePicture: "NARROW_ONLY",
          scopePolicy: "GENERAL_REQUIRED",
        })
      )
    ).toBe(false);
    expect(
      completeRawComparisonAtom(
        rawAtom("narrow-valid", {
          selectedScopePicture: "NARROW_ONLY",
          scopePolicy: "MATCHING_SCOPE_DEFINITIVE_SUFFICIENT",
        })
      )
    ).toBe(true);
    expect(
      completeRawComparisonAtom(
        rawAtom("policy-unknown", { scopePolicy: "UNKNOWN" })
      )
    ).toBe(false);
    expect(
      completeRawComparisonAtom(
        rawAtom("narrow-excluded", {
          factRole: "DAMAGE",
          coverageEffect: "EXCLUDED",
          selectedScopePicture: "NARROW_ONLY",
          scopePolicy: "MATCHING_SCOPE_INCLUDED_SUFFICIENT",
        })
      )
    ).toBe(false);
    expect(
      completeRawComparisonAtom(
        limitAtom("field-mismatch", "EUR 5.000,00", {
          requestedFields: ["limit", "duration"],
        })
      )
    ).toBe(false);
  });

  test("validates optional fields separately from required fields", () => {
    const found = limitAtom("optional-found", "EUR 5.000,00", {
      requestedFieldStatus: "NOT_REQUIRED",
      requestedFields: [],
      optionalFields: ["limit"],
    });
    expect(completeRawComparisonAtom(found)).toBe(true);

    const notFound = rawAtom("optional-not-found", {
      optionalFields: ["limit"],
      fields: [{ field: "limit", status: "NOT_FOUND", facts: [] }],
    });
    expect(completeRawComparisonAtom(notFound)).toBe(true);

    const partial = {
      ...found,
      fields: [
        {
          ...found.fields[0],
          status: "PARTIAL",
        },
      ],
    };
    expect(completeRawComparisonAtom(partial)).toBe(false);
  });

  test("keeps differing component labels and unsafe contributors in separate groups", () => {
    const left = rawAtom("label-a", { componentLabel: "Versicherungssumme" });
    const differentLabel = rawAtom("label-b", {
      componentLabel: "Deckungssumme",
    });
    const conditional = rawAtom("conditional", {
      sources: [
        {
          candidateId: "candidate-conditional",
          physicalPageNumber: 3,
          exactText: "Die Summe gilt nur, sofern die Anlage gewartet wird.",
        },
      ],
    });
    for (const atoms of [
      [left, differentLabel, conditional],
      [conditional, differentLabel, left],
    ])
      expect(canonicalComparisonAtoms(atoms)).toHaveLength(3);
  });

  test("keeps exact narrow comparison scopes separate and preserves their provenance", () => {
    const glass = rawAtom("glass", {
      factRole: "COST",
      coverageEffect: "INCLUDED",
      selectedScopePicture: "NARROW_ONLY",
      scopePolicy: "MATCHING_SCOPE_INCLUDED_SUFFICIENT",
      comparisonScopeKeys: ["GLASBRUCH_INSURANCE"],
    });
    const fire = rawAtom("fire", {
      factRole: "COST",
      coverageEffect: "INCLUDED",
      selectedScopePicture: "NARROW_ONLY",
      scopePolicy: "MATCHING_SCOPE_INCLUDED_SUFFICIENT",
      comparisonScopeKeys: ["FEUER_INSURANCE"],
    });

    expect(semanticComparisonAtomKey(glass)).not.toBe(
      semanticComparisonAtomKey(fire)
    );
    expect(canonicalComparisonAtoms([glass, fire])).toEqual([
      expect.objectContaining({
        comparisonProjectionContractId: "PACKAGE_MEMBER_CANONICAL_ATOM_V2",
        comparisonScopeKeys: ["FEUER_INSURANCE"],
      }),
      expect.objectContaining({
        comparisonProjectionContractId: "PACKAGE_MEMBER_CANONICAL_ATOM_V2",
        comparisonScopeKeys: ["GLASBRUCH_INSURANCE"],
      }),
    ]);
  });

  test("requires VS-24 narrow scope keys to match every selected source", () => {
    const valid = rawAtom("vs24", {
      requirementId: "VS-24",
      componentId: "scaffolding_costs",
      factRole: "COST",
      coverageEffect: "INCLUDED",
      selectedScopePicture: "NARROW_ONLY",
      scopePolicy: "MATCHING_SCOPE_INCLUDED_SUFFICIENT",
      comparisonScopeKeys: ["GLASBRUCH_INSURANCE"],
      sources: [
        {
          candidateId: "candidate-vs24",
          candidateBinding: "NARROW_SCOPE",
          comparisonScopeKey: "GLASBRUCH_INSURANCE",
          physicalPageNumber: 3,
          exactText: "Gerüstkosten",
        },
      ],
    });

    expect(completeRawComparisonAtom(valid)).toBe(true);
    expect(
      completeRawComparisonAtom({ ...valid, comparisonScopeKeys: [] })
    ).toBe(false);
    expect(
      completeRawComparisonAtom({
        ...valid,
        comparisonScopeKeys: ["FEUER_INSURANCE"],
      })
    ).toBe(false);
    expect(
      completeRawComparisonAtom({
        ...valid,
        comparisonScopeKeys: [
          "FEUER_INSURANCE",
          "GLASBRUCH_INSURANCE",
        ],
      })
    ).toBe(false);
  });
});

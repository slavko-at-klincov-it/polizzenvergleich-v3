const crypto = require("crypto");
const {
  OBJECT_SCOPE_EVIDENCE_SOURCE,
  SOURCE_BOUND_OBJECT_SCOPE_EVIDENCE_CONTRACT_ID,
  buildSourceBoundObjectScopeProof,
  validateObjectScopeEvidenceContract,
  validSourceBoundObjectScopeProof,
} = require("../../../utils/policyAnalysis/objectScopeEvidenceContract");

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function contract() {
  return {
    contractId: SOURCE_BOUND_OBJECT_SCOPE_EVIDENCE_CONTRACT_ID,
    allowedEvidenceSources: Object.values(OBJECT_SCOPE_EVIDENCE_SOURCE),
    families: [
      {
        objectScopeKey: "BUILDING_ELECTRICAL_INSTALLATIONS",
        patterns: [
          {
            sourceKinds: ["STRUCTURAL_LOCAL_CONTEXT"],
            allOf: [["Gebäude-Elektroinstallationen"]],
          },
        ],
      },
      {
        objectScopeKey: "UNDERGROUND_CABLES",
        patterns: [
          {
            sourceKinds: ["STRUCTURAL_LOCAL_CONTEXT"],
            allOf: [["Erdkabel"]],
          },
          {
            sourceKinds: ["NESTED_LIST_CONTINUATION"],
            allOf: [["Erd- und Telefonkabeln"]],
          },
        ],
      },
    ],
  };
}

function localOccurrence(text, unitType = "LIST_ITEM") {
  return {
    physicalPageNumber: 2,
    context: {
      unitType,
      documentStart: 100,
      documentEnd: 100 + text.length,
      text,
    },
  };
}

function continuationProof() {
  const firstText = "• Indirekter Blitzschlag gilt an\n- erster Gegenstand;";
  const secondText = "- Erd- und Telefonkabeln.";
  const segments = [
    {
      kind: "PARENT_WITH_SUBLIST",
      physicalPageNumber: 1,
      pageStart: 10,
      pageEnd: 10 + firstText.length,
      documentStart: 10,
      documentEnd: 10 + firstText.length,
      text: firstText,
      sha256: sha256(firstText),
    },
    {
      kind: "CONTINUED_SUBLIST",
      physicalPageNumber: 2,
      pageStart: 8,
      pageEnd: 8 + secondText.length,
      documentStart: 100,
      documentEnd: 100 + secondText.length,
      text: secondText,
      sha256: sha256(secondText),
    },
  ];
  const gapText = "\n\n[DOCUMENT_PAGE 2]\n";
  const gap = {
    documentStart: segments[0].documentEnd,
    documentEnd: segments[1].documentStart - 8,
    text: gapText,
    sha256: sha256(gapText),
  };
  const pagePrelude = {
    kind: "PAGE_FURNITURE",
    physicalPageNumber: 2,
    pageStart: 0,
    pageEnd: 8,
    documentStart: segments[1].documentStart - 8,
    documentEnd: segments[1].documentStart,
    text: "Seite 2\n",
    sha256: sha256("Seite 2\n"),
  };
  const boundaryWithoutDigest = {
    kind: "PAGE_END",
    physicalPageNumber: 2,
    pageStart: 8 + secondText.length,
    pageEnd: 8 + secondText.length,
    documentStart: segments[1].documentEnd,
    documentEnd: segments[1].documentEnd,
    text: "",
  };
  const boundary = {
    ...boundaryWithoutDigest,
    sha256: sha256(JSON.stringify(boundaryWithoutDigest)),
  };
  const digestPayload = {
    contractId: "NESTED_LIST_CONTINUATION_PROOF_V1",
    segments: segments.map(
      ({ kind, physicalPageNumber, documentStart, documentEnd, sha256 }) => ({
        kind,
        physicalPageNumber,
        documentStart,
        documentEnd,
        sha256,
      })
    ),
    gapSha256: gap.sha256,
    pagePreludeSha256: pagePrelude.sha256,
    boundarySha256: boundary.sha256,
  };
  return {
    contractId: "NESTED_LIST_CONTINUATION_PROOF_V1",
    documentStart: segments[0].documentStart,
    documentEnd: segments[1].documentEnd,
    segments,
    gap,
    pagePrelude,
    boundary,
    proofDigest: sha256(JSON.stringify(digestPayload)),
  };
}

describe("source-bound object-scope evidence contract", () => {
  test("binds an umlaut alias across punctuation and preserves exact offsets", () => {
    const occurrence = localOccurrence(
      "Indirekter Blitzschlag an GEBÄUDE—Elektroinstallationen."
    );
    const proof = buildSourceBoundObjectScopeProof({
      contract: contract(),
      occurrence,
    });

    expect(proof.objectScopeKeys).toEqual([
      "BUILDING_ELECTRICAL_INSTALLATIONS",
    ]);
    expect(proof.assertions[0]).toMatchObject({
      sourceKind: "STRUCTURAL_LOCAL_CONTEXT",
      matches: [
        {
          matchedAlias: "Gebäude-Elektroinstallationen",
          exactText: "GEBÄUDE—Elektroinstallationen",
        },
      ],
    });
    expect(proof.assertions[0].matches[0].documentStart).toBeGreaterThanOrEqual(
      occurrence.context.documentStart
    );
    expect(proof.assertions[0].matches[0].documentEnd).toBeLessThanOrEqual(
      occurrence.context.documentEnd
    );
  });

  test("does not classify word-window neighbours or alias substrings", () => {
    expect(
      buildSourceBoundObjectScopeProof({
        contract: contract(),
        occurrence: localOccurrence(
          "Fremdklausel über Gebäude-Elektroinstallationen und Erdkabel.",
          "WORD_WINDOW_FALLBACK"
        ),
      })
    ).toBeNull();
    expect(
      buildSourceBoundObjectScopeProof({
        contract: contract(),
        occurrence: localOccurrence(
          "Versichert ist nur ein eigenständiger Erdkabelschaden."
        ),
      })
    ).toBeNull();
  });

  test("classifies an explicit object in a negative clause without inventing an effect", () => {
    const proof = buildSourceBoundObjectScopeProof({
      contract: contract(),
      occurrence: localOccurrence("Erdkabel sind nicht mitversichert."),
    });

    expect(proof.objectScopeKeys).toEqual(["UNDERGROUND_CABLES"]);
    expect(proof).not.toHaveProperty("coverageEffect");
    expect(proof.assertions[0]).not.toHaveProperty("coverageEffect");
  });

  test("binds the complete matcher contract into the proof digest", () => {
    const occurrence = localOccurrence(
      "Indirekter Blitzschlag an Gebäude-Elektroinstallationen."
    );
    const original = buildSourceBoundObjectScopeProof({
      contract: contract(),
      occurrence,
    });
    const extendedContract = contract();
    extendedContract.families[0].patterns[0].allOf[0].push(
      "Elektroinstallationen des Gebäudes"
    );
    const extended = buildSourceBoundObjectScopeProof({
      contract: extendedContract,
      occurrence,
    });

    expect(extended.assertions).toEqual(original.assertions);
    expect(extended.objectScopeEvidenceContractDigest).not.toBe(
      original.objectScopeEvidenceContractDigest
    );
    expect(extended.proofDigest).not.toBe(original.proofDigest);
  });

  test("requires authoritative validation before consuming nested-list sources", () => {
    const occurrence = {
      ...localOccurrence("indirekter Blitzschlag", "WORD_WINDOW_FALLBACK"),
      nestedListContinuationProof: continuationProof(),
    };
    expect(
      buildSourceBoundObjectScopeProof({
        contract: contract(),
        occurrence,
      })
    ).toBeNull();

    const proof = buildSourceBoundObjectScopeProof({
      contract: contract(),
      occurrence,
      nestedListContinuationValidated: true,
    });
    expect(proof.objectScopeKeys).toEqual(["UNDERGROUND_CABLES"]);
    expect(proof.assertions[0]).toMatchObject({
      sourceKind: "NESTED_LIST_CONTINUATION",
      continuationProofDigest:
        occurrence.nestedListContinuationProof.proofDigest,
    });

    occurrence.objectScopeProof = proof;
    expect(
      validSourceBoundObjectScopeProof({
        contract: contract(),
        occurrence,
        nestedListContinuationValidated: true,
      })
    ).toBe(true);
    occurrence.objectScopeProof.assertions[0].matches[0].exactText =
      "manipuliert";
    expect(
      validSourceBoundObjectScopeProof({
        contract: contract(),
        occurrence,
        nestedListContinuationValidated: true,
      })
    ).toBe(false);
  });

  test("fails closed for a tampered continuation envelope", () => {
    const nestedListContinuationProof = continuationProof();
    nestedListContinuationProof.segments[1].text = "- Erdkabel.";
    const occurrence = {
      ...localOccurrence("indirekter Blitzschlag", "WORD_WINDOW_FALLBACK"),
      nestedListContinuationProof,
    };
    expect(
      buildSourceBoundObjectScopeProof({
        contract: contract(),
        occurrence,
        nestedListContinuationValidated: true,
      })
    ).toBeNull();
  });

  test("rejects undeclared sources and duplicate normalized aliases", () => {
    const invalidSource = contract();
    invalidSource.families[0].patterns[0].sourceKinds = ["PAGE_WIDE_TEXT"];
    expect(() => validateObjectScopeEvidenceContract(invalidSource)).toThrow(
      "OBJECT_SCOPE_SOURCE_KINDS_INVALID"
    );

    const duplicateAlias = contract();
    duplicateAlias.families[0].patterns[0].allOf = [
      ["Gebäude-Elektroinstallationen", "gebäude elektroinstallationen"],
    ];
    expect(() => validateObjectScopeEvidenceContract(duplicateAlias)).toThrow(
      "OBJECT_SCOPE_ALIAS_INVALID"
    );
  });
});

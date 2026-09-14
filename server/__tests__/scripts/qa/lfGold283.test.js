const {
  ADJUDICATION_CONTRACT_ID,
  CONTRACT_ID,
  buildLfKnownFixtureGold283,
  typedLocator,
} = require("../../../../scripts/qa/lib/lf-gold283.cjs");

const digest = (character) => character.repeat(64);

function fixture() {
  const ids = Array.from(
    { length: 283 },
    (_, index) => `REQ-${String(index).padStart(3, "0")}`
  );
  const primary = new Set(ids.slice(0, 29));
  const common = ids.slice(29);
  const flagged = new Set(common.slice(0, 47));
  const explicit = ids.slice(0, 76);
  const searchedDocuments = Array.from({ length: 9 }, (_, index) => ({
    originalName: `B-${index}.pdf`,
    fingerprint: digest(String((index % 9) + 1)),
    role: index === 0 ? "MAIN_POLICY" : "TERMS",
  }));
  const referenceA = {
    sourceSpans: [{ spanId: "a", exactText: "A-Quelle" }],
  };
  const components = [
    { componentId: "component", factRole: "BENEFIT", label: "Leistung" },
  ];
  const decisions = Object.fromEntries(
    ids.map((id) => [id, { status: "Ja", refs: ["B1"] }])
  );
  decisions[ids[76]].status = "Nein";
  return {
    matrix: {
      rows: ids.map((requirementId, sourceOrder) => ({
        analysisRowId: `row-${sourceOrder}`,
        requirementId,
        sourceOrder,
        primaryComparison: {
          primaryAdjudicationCandidate: primary.has(requirementId),
        },
      })),
    },
    validation: {
      contractId: "LF_1PLUS9_GOLD283_POSITIVE_BINDING_VALIDATION_V2",
      scope: { commonPositiveIds: common },
      summary: {
        commonPositiveRows: 254,
        flaggedCommonPositiveRows: 47,
        validatedCommonPositiveRows: 207,
        flaggedIds: [...flagged],
      },
      rows: common.map((requirementId) => ({
        requirementId,
        status: flagged.has(requirementId) ? "FLAGGED" : "PASS",
      })),
    },
    comparisons: ids.map((id, index) => ({
      id,
      Astra_E: "Ja",
      Astra_F: index === 76 ? "Nein" : "Ja",
      Fable_E: "Ja",
      Fable_F: index === 76 ? "Nein" : "Ja",
      assessment: "Beide Quellen stimmen im fachlichen Kern überein.",
    })),
    astraDecisions: decisions,
    evidenceBank: {
      B1: {
        file: "B.pdf",
        location: "PDF-Seite 1",
        text: "Quellengebundenes Gegenstück",
      },
    },
    sourceRowMap: { B1: 1 },
    technicalValidation: {
      template_rows: 283,
      all_input_sha256_unchanged: true,
    },
    runManifest: {
      run_id: "astra-283",
      model_id: "gpt-6-astra",
      reasoning: "xhigh",
      start_utc: "2026-09-13T00:00:00.000Z",
      end_utc: "2026-09-13T01:00:00.000Z",
      host: "Mac Studio via ssh macstudio",
      blindness: { status: "BLIND_UNTIL_FREEZE" },
    },
    packet: {
      rows: ids.map((requirementId) => ({
        requirementId,
        referenceA,
        components,
        searchedDocuments,
      })),
    },
    goldCandidate: {
      rows: ids.map((requirementId, sourceOrder) => ({
        requirementId,
        sourceOrder,
        category: "Kategorie",
        subcategory: "Unterkategorie",
        point: `Punkt ${sourceOrder}`,
        components,
      })),
    },
    gold30: {
      contractId: "LF_1PLUS9_GOLD_30_V1",
      rows: ids.slice(0, 30).map((requirementId, index) => ({
        requirementId,
        goldDecision: {
          outcome:
            index === 0
              ? "NO_COUNTERPART_ESTABLISHED"
              : "FULL_COUNTERPART",
          customerFound: index !== 0,
        },
      })),
    },
    adjudication: {
      contractId: ADJUDICATION_CONTRACT_ID,
      rows: explicit.map((requirementId, index) => ({
        requirementId,
        outcome:
          index === 0 ? "NO_COUNTERPART_ESTABLISHED" : "FULL_COUNTERPART",
        selectedSourceRefs: index === 0 ? [] : ["B1"],
        reviewedSourceRefs: ["B1"],
        rationale: `Source-bound Entscheidung ${index}`,
      })),
    },
    fileBindings: {
      gold30: { file: "/private/gold30.json", fileSha256: digest("a") },
    },
    createdAt: "2026-09-14T00:00:00.000Z",
  };
}

describe("LF Gold-283 QA freezer", () => {
  it("freezes 76 explicit and 207 validated automatic decisions", () => {
    const gold = buildLfKnownFixtureGold283(fixture());
    expect(gold.contractId).toBe(CONTRACT_ID);
    expect(gold.goldAuthority).toBe(true);
    expect(gold.productionRule).toBe(false);
    expect(gold.releaseApproval).toBe(false);
    expect(gold.summary).toMatchObject({
      rows: 283,
      customerFound: 282,
      customerNotFound: 1,
      explicitAdjudications: 76,
      validatedAutomaticAcceptances: 207,
      sourceBoundFoundRows: 282,
      knownFixtureAbsenceCertified: 1,
    });
    expect(gold.rows[0].goldDecision.absenceSearch.documentsSearched).toHaveLength(
      9
    );
    expect(gold.rows[76].goldDecision.reviewMethod).toBe(
      "VALIDATED_207_COMMON_POSITIVE_ACCEPTANCE"
    );
  });

  it("rejects scope drift and invented source references", () => {
    const drifted = fixture();
    drifted.adjudication.rows.pop();
    expect(() => buildLfKnownFixtureGold283(drifted)).toThrow(
      "LF_GOLD283_INPUT_CONTRACT_INVALID"
    );

    const invented = fixture();
    invented.adjudication.rows[1].selectedSourceRefs = ["INVENTED"];
    expect(() => buildLfKnownFixtureGold283(invented)).toThrow(
      "LF_GOLD283_SOURCE_BINDING_INVALID:INVENTED"
    );
  });

  it("requires source-type-appropriate locators", () => {
    expect(typedLocator({ file: "a.pdf", location: "PDF-Seite 4" })).toEqual({
      type: "PDF_PAGE",
      valid: true,
    });
    expect(typedLocator({ file: "a.md", location: "Zeilen 10-12" })).toEqual({
      type: "MARKDOWN_ROW",
      valid: true,
    });
    expect(typedLocator({ file: "a.pdf", location: "Kapitel A" }).valid).toBe(
      false
    );
  });
});

const crypto = require("crypto");
const { decidePoint } = require("../../utils/policyComparison/pointDecision");
const {
  customerResultText,
} = require("../../utils/policyComparison/customerResultPresenter");
const {
  customerSafeComparisonReadView,
  deriveCustomerMetrics,
  validateCustomerComparison,
} = require("../../utils/policyComparison/customerMetricContract");
const {
  PRODUCT_PROFILE,
  STRUCTURAL_CONCEPT_CONTEXT_PRODUCT_PROFILE_IDENTITY,
} = require("../../utils/policyComparison/productContract");
const {
  CUSTOMER_RESULT_RULE_OUTCOME_CONTRACT,
} = require("../../utils/policyComparison/customerResultRuleOutcomeContract");
const {
  buildVs22LocalNarrowContinuationProof,
} = require("../../utils/policyComparison/vs22LocalNarrowContinuationProofContract");
const {
  VS22_HAZARDOUS_WASTE_PORTFOLIO_RULE_ID,
  VS22_REQUIREMENT_CONTRACT_DIGEST,
  buildVs22HazardousWastePortfolioAudit,
  buildVs22SourceAtomDigestReplay,
  validateVs22HazardousWastePortfolioAudit,
  vs22HazardousWastePortfolioDecision,
} = require("../../utils/policyComparison/vs22HazardousWastePortfolioComparisonContract");

const components = [
  { id: "disposal_costs", factRole: "COST" },
  { id: "hazardous_waste", factRole: "INSURED_OBJECT" },
  { id: "hazardous_waste_cost_limit", factRole: "LIMIT" },
];
const contract = {
  digest: VS22_REQUIREMENT_CONTRACT_DIGEST,
  componentSatisfactionPolicy: "ALL",
  components,
};

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableValue(value[key])])
  );
}

function sha256(value) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(stableValue(value)))
    .digest("hex");
}

function sha256Text(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function sourceEnvelope(source, index) {
  const conditionCheckText = source.conditionCheckText;
  const exactText = source.exactText;
  const relativeStart = conditionCheckText.indexOf(exactText);
  if (relativeStart < 0) throw new Error("TEST_SOURCE_TEXT_NOT_LOCAL");
  const conditionCheckDocumentStart = 1000 + index * 1000;
  const documentStart = conditionCheckDocumentStart + relativeStart;
  return {
    ...source,
    documentFingerprint: "a".repeat(64),
    candidateIdentityPageNumber: source.physicalPageNumber,
    documentStart,
    documentEnd: documentStart + exactText.length,
    exactTextSha256: sha256Text(exactText),
    conditionCheckDocumentStart,
    conditionCheckDocumentEnd:
      conditionCheckDocumentStart + conditionCheckText.length,
    conditionCheckTextSha256: sha256Text(conditionCheckText),
  };
}

function replaceSourceText(source, { exactText, conditionCheckText }, index) {
  Object.assign(
    source,
    sourceEnvelope(
      {
        ...source,
        exactText: exactText ?? source.exactText,
        conditionCheckText,
      },
      index
    )
  );
}

function coherentlyRehash(audit) {
  for (const side of ["A", "B"])
    audit.sides[side].projectedAtomsDigestSha256 = sha256(
      audit.sides[side].projectedAtoms
    );
  delete audit.assessmentDigestSha256;
  audit.assessmentDigestSha256 = sha256(audit);
}

function document(uuid, side, index) {
  return {
    uuid,
    side,
    sha256: uuid.repeat(64).slice(0, 64),
    role: index === 0 ? "MAIN_POLICY" : "SUPPLEMENT",
    documentStatus: index === 0 ? "PROPOSAL" : "FRAMEWORK_TERMS",
  };
}

function searchCell({ documentUuid, componentId, found }) {
  return {
    disposition: found
      ? "RELEVANT_FOUND"
      : "NO_MATCH_AFTER_COMPLETE_CONTROLLED_SEARCH",
    comparisonTreatment: found ? null : "DOCUMENTATION_ONLY_V1",
    negativeSearchPolicy: "REPORT_COMPLETE_ZERO_CONTROLLED_SEARCH_V1",
    absenceMeaning: "COVERAGE_MIXED",
    comparisonPolicy: null,
    absenceCertification: null,
    requirementContract: contract,
    searchPlanId: `vs-occurrence-full-draft-v0.16/VS-22/${componentId}`,
    documentUuid,
    catalogId: "vs-occurrence-full-draft-v0.16",
    physicalPagesChecked: 5,
    totalPhysicalPages: 5,
    aliases: [componentId],
    conceptSearchIds: [],
    gates: {
      negativeSearchApproved: true,
      certifiedNegativeSearch: false,
      completeTextExtraction: true,
      completeCategoryTechnicalContract: true,
      zeroOccurrenceTerminal: !found,
      zeroCandidateTerminal: !found,
      serverNegativeTerminal: !found,
    },
  };
}

function atomFor({ side, documentUuid, component, mode, index }) {
  const found = mode === "INCLUDED" || component.id === "disposal_costs";
  const candidateId = `candidate:${side}:${documentUuid}:${component.id}`;
  const searchAudit = searchCell({
    documentUuid,
    componentId: component.id,
    found,
  });
  const isLimit = component.id === "hazardous_waste_cost_limit";
  const fields =
    isLimit && mode === "INCLUDED"
      ? [
          {
            field: "limit",
            status: "FOUND",
            facts: [
              {
                normalizedValue: "EUR 7.300",
                valueType: "MONEY",
                unit: "EUR",
                limitKind: "CAPPED",
                source: {
                  candidateId,
                  physicalPageNumber: 5,
                  exactText: "EUR 7.300",
                },
              },
            ],
          },
        ]
      : [{ field: "limit", status: "NOT_FOUND", facts: [] }];
  return {
    requirementId: "VS-22",
    componentId: component.id,
    componentLabel: component.id,
    factRole: component.factRole,
    documentUuids: [documentUuid],
    documentRole: index === 0 ? "MAIN_POLICY" : "SUPPLEMENT",
    documentStatus: index === 0 ? "PROPOSAL" : "FRAMEWORK_TERMS",
    evidencePresence: found ? "FOUND" : "NOT_FOUND",
    coverageEffect: found ? (isLimit ? "DEFINED" : "INCLUDED") : "UNKNOWN",
    conflictState: "NONE",
    selectedScopePicture: found ? "GENERAL" : "UNKNOWN",
    scopePolicy: "GENERAL_REQUIRED",
    documentApplicability: found
      ? index === 0
        ? "PROPOSED_ONLY"
        : "CONDITIONAL"
      : "UNKNOWN",
    selectedCandidateIds: found ? [candidateId] : [],
    unresolvedCandidateIds: [],
    requestedFieldStatus:
      isLimit && mode === "INCLUDED" ? "COMPLETE" : "NOT_FOUND",
    requestedFields: ["limit"],
    optionalFields: [],
    fields,
    sources: found
      ? [
          {
            candidateId,
            physicalPageNumber: 5,
            candidateBinding: "DIRECT",
            deterministicBindingBasis:
              isLimit || component.id === "hazardous_waste"
                ? "EXPLICIT_HAZARDOUS_WASTE_COSTS"
                : "EXPLICIT_DISPOSAL_COSTS",
            exactText:
              component.id === "disposal_costs"
                ? "Entsorgungskosten sind mitversichert"
                : component.id === "hazardous_waste"
                  ? "Gefährlicher Abfall ist mitversichert"
                  : "Sondermüll bis EUR 7.300",
          },
        ]
      : [],
    componentSatisfactionPolicy: "ALL",
    coverageAggregationPolicy: "ALL_COMPONENT_EFFECTS",
    requirementContractDigest: contract.digest,
    declaredComponents: components,
    searchAudit,
  };
}

function packageFixture(side, mode, documentCount) {
  const documents = Array.from({ length: documentCount }, (_, index) =>
    document(`${side.toLowerCase()}${index + 1}`, side, index)
  );
  const atoms = documents.flatMap(({ uuid }, index) =>
    components.map((component) =>
      atomFor({ side, documentUuid: uuid, component, mode, index })
    )
  );
  const searchComponents = atoms.map(({ searchAudit }) => searchAudit);
  const summary = {
    evidenceFound: true,
    coverage: mode === "INCLUDED" ? "Ja" : "Nicht feststellbar",
    reviewStatus: mode === "INCLUDED" ? "BELEGT" : "TEILBELEGT",
    searchDisposition: "RELEVANT_FOUND",
    comparisonTreatment: null,
    requirementContract: contract,
    facts: documents.map(({ uuid }) => ({
      documentUuid: uuid,
      coverage: mode === "INCLUDED" ? "Ja" : "Nicht feststellbar",
      reviewStatus: mode === "INCLUDED" ? "BELEGT" : "TEILBELEGT",
    })),
    searchAudit: {
      disposition: "SEARCH_INCOMPLETE",
      comparisonTreatment: null,
      documentCount: documents.length,
      documentUuids: documents.map(({ uuid }) => uuid).sort(),
      physicalPagesChecked: documents.length * 5,
      searchPlanIds: components
        .map(({ id }) => `vs-occurrence-full-draft-v0.16/VS-22/${id}`)
        .sort(),
      requirementContract: contract,
      components: searchComponents,
    },
  };
  return { documents, atoms, summary };
}

function fixture(reverse = false) {
  const included = packageFixture(reverse ? "B" : "A", "INCLUDED", 1);
  const absent = packageFixture(reverse ? "A" : "B", "ABSENT", 2);
  return {
    categoryId: "VS-22",
    packageA: reverse ? absent.summary : included.summary,
    packageB: reverse ? included.summary : absent.summary,
    atomsA: reverse ? absent.atoms : included.atoms,
    atomsB: reverse ? included.atoms : absent.atoms,
    requirementContractA: contract,
    requirementContractB: contract,
    expectedDocumentsA: reverse ? absent.documents : included.documents,
    expectedDocumentsB: reverse ? included.documents : absent.documents,
  };
}

function mixedScopeFixture(
  reverse = false,
  {
    positiveDirectLine = "Kosten für Sondermüll sind auf erstes Risiko zusätzlich mitversichert.",
    narrowText = "gefährlichem Abfall und Sonderabfall, der durch Eindringen oder Vermischen versicherter Sachen in bzw. mit Erdreich, Wasser und/oder Luft entsteht, gilt als mitversichert.",
    proofFingerprint = null,
    additionalDirectLine = null,
  } = {}
) {
  const input = fixture(reverse);
  const winner = reverse ? "B" : "A";
  const atom = input[`atoms${winner}`].find(
    ({ componentId }) => componentId === "hazardous_waste"
  );
  const fingerprint = input[`expectedDocuments${winner}`][0].sha256;
  const neutralDirectLines = Array.from(
    { length: 10 },
    (_, index) => `Begriff Sondermüll in Vertragsbestimmung ${index + 1}.`
  );
  if (additionalDirectLine) neutralDirectLines[0] = additionalDirectLine;
  const directLines = [positiveDirectLine, ...neutralDirectLines];
  const page27 = `Seite 27\n${directLines.join("\n")}\nDie dem Gesetz nach notwendige Behandlung von Sondermüll,`;
  const page28 = `Seite 28\n${narrowText}`;
  const pageTexts = Array.from(
    { length: 26 },
    (_unused, index) => `Seite ${index + 1}\nUnbeteiligter Inhalt.`
  );
  pageTexts.push(page27, page28);
  let pageContent = "";
  const pageMap = [];
  for (const [index, pageText] of pageTexts.entries()) {
    const pageNumber = index + 1;
    if (index > 0) pageContent += `\n\n[DOCUMENT_PAGE ${pageNumber}]\n`;
    const start = pageContent.length;
    pageContent += pageText;
    pageMap.push({ pageNumber, start, end: pageContent.length });
  }
  const page27Start = pageMap[26].start;
  const page28Start = pageMap[27].start;
  const directCandidates = directLines.map((line, index) => {
    const exactText = "Sondermüll";
    const documentStart =
      page27Start + page27.indexOf(line) + line.indexOf(exactText);
    return {
      candidateId: `candidate:${winner}:hazardous-waste:direct:${index}`,
      physicalPageNumber: 27,
      candidateBinding: "DIRECT",
      deterministicBindingBasis: "EXPLICIT_HAZARDOUS_WASTE_COSTS",
      exactText,
      documentStart,
      documentEnd: documentStart + exactText.length,
      contextText: page27,
      contextDocumentStart: page27Start,
    };
  });
  const predecessorText = "Sondermüll";
  const predecessorStart = page27Start + page27.lastIndexOf(predecessorText);
  directCandidates.push({
    candidateId: `candidate:${winner}:hazardous-waste:direct:predecessor`,
    physicalPageNumber: 27,
    candidateBinding: "DIRECT",
    deterministicBindingBasis: "EXPLICIT_HAZARDOUS_WASTE_COSTS",
    exactText: predecessorText,
    documentStart: predecessorStart,
    documentEnd: predecessorStart + predecessorText.length,
    contextText: page27,
    contextDocumentStart: page27Start,
  });
  const narrowExactText = "gefährlichem Abfall";
  const narrowStart = page28Start + page28.indexOf(narrowExactText);
  const narrowCandidate = {
    candidateId: `candidate:${winner}:hazardous-waste:narrow:continuation`,
    physicalPageNumber: 28,
    candidateBinding: "NARROW_SCOPE",
    exactText: narrowExactText,
    documentStart: narrowStart,
    documentEnd: narrowStart + narrowExactText.length,
    contextText: page28,
    contextDocumentStart: page28Start,
  };
  const selectedCandidates = [...directCandidates, narrowCandidate];
  const sources = selectedCandidates.map((candidate) => {
    const relativeStart =
      candidate.documentStart - candidate.contextDocumentStart;
    const relativeEnd = candidate.documentEnd - candidate.contextDocumentStart;
    const conditionStart = Math.max(0, relativeStart - 240);
    const conditionEnd = Math.min(
      candidate.contextText.length,
      relativeEnd + 240
    );
    const conditionCheckText = candidate.contextText.slice(
      conditionStart,
      conditionEnd
    );
    const conditionCheckDocumentStart =
      candidate.contextDocumentStart + conditionStart;
    return {
      candidateId: candidate.candidateId,
      physicalPageNumber: candidate.physicalPageNumber,
      candidateIdentityPageNumber: candidate.physicalPageNumber,
      documentFingerprint: proofFingerprint || fingerprint,
      candidateBinding: candidate.candidateBinding,
      ...(candidate.deterministicBindingBasis
        ? { deterministicBindingBasis: candidate.deterministicBindingBasis }
        : {}),
      exactText: candidate.exactText,
      conditionCheckText,
      documentStart: candidate.documentStart,
      documentEnd: candidate.documentEnd,
      exactTextSha256: sha256Text(candidate.exactText),
      conditionCheckDocumentStart,
      conditionCheckDocumentEnd:
        conditionCheckDocumentStart + conditionCheckText.length,
      conditionCheckTextSha256: sha256Text(conditionCheckText),
    };
  });
  const documentArtifact = {
    schemaVersion: 1,
    fingerprint: proofFingerprint || fingerprint,
    document: {
      sourceDocumentId: proofFingerprint || fingerprint,
      pageContent,
      pageMap,
      pdfExtraction: {
        schemaVersion: 1,
        totalPages: 28,
        processedPages: 28,
        pagesWithText: 28,
        complete: true,
      },
    },
  };
  atom.sources = sources;
  atom.selectedCandidateIds = sources.map(({ candidateId }) => candidateId);
  atom.selectedScopePicture = "GENERAL_AND_NARROW";
  atom.vs22LocalNarrowContinuationProof = buildVs22LocalNarrowContinuationProof(
    {
      documentArtifact,
      documentFingerprint: proofFingerprint || fingerprint,
      requirementId: "VS-22",
      componentId: "hazardous_waste",
      selectedScopePicture: atom.selectedScopePicture,
      selectedCandidateIds: atom.selectedCandidateIds,
      selectedCandidates,
      sources,
    }
  );
  for (const candidateAtom of input[`atoms${winner}`]) {
    candidateAtom.searchAudit.physicalPagesChecked = 28;
    candidateAtom.searchAudit.totalPhysicalPages = 28;
  }
  input[`package${winner}`].searchAudit.physicalPagesChecked = 28;
  return input;
}

describe("VS-22 hazardous-waste portfolio comparison contract", () => {
  test.each([
    [false, "A", "VORTEIL_A"],
    [true, "B", "VORTEIL_B"],
  ])(
    "certifies the complete direction (reverse=%s)",
    (reverse, winner, outcome) => {
      const input = fixture(reverse);
      const audit = buildVs22HazardousWastePortfolioAudit(input);

      expect(audit).toMatchObject({
        schemaVersion: 3,
        contractId: "VS22_HAZARDOUS_WASTE_PORTFOLIO_AUDIT_V3",
        categoryId: "VS-22",
        winner,
        missingComponentIds: ["hazardous_waste", "hazardous_waste_cost_limit"],
        assessmentDigestSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      });
      expect(vs22HazardousWastePortfolioDecision(audit)).toMatchObject({
        outcome,
        ruleId: VS22_HAZARDOUS_WASTE_PORTFOLIO_RULE_ID,
        reviewRequired: false,
      });
      expect(() =>
        validateVs22HazardousWastePortfolioAudit(audit, {
          categoryId: input.categoryId,
          packageA: input.packageA,
          packageB: input.packageB,
          requirementContractA: contract,
          requirementContractB: contract,
          expectedDocumentsA: input.expectedDocumentsA,
          expectedDocumentsB: input.expectedDocumentsB,
          atomsA: input.atomsA,
          atomsB: input.atomsB,
        })
      ).not.toThrow();
    }
  );

  test("keeps the historical V2 audit and V1 source replay readable", () => {
    const input = fixture();
    const audit = buildVs22HazardousWastePortfolioAudit(input);
    audit.schemaVersion = 2;
    audit.contractId = "VS22_HAZARDOUS_WASTE_PORTFOLIO_AUDIT_V2";
    audit.comparisonTreatment =
      "VS22_HAZARDOUS_WASTE_INCLUDED_OVER_CONTROLLED_ABSENCE_V1";
    coherentlyRehash(audit);
    const sourceAtomDigestReplay = buildVs22SourceAtomDigestReplay(input);
    sourceAtomDigestReplay.schemaVersion = 1;
    sourceAtomDigestReplay.contractId = "VS22_SOURCE_ATOM_DIGEST_REPLAY_V1";
    delete sourceAtomDigestReplay.replayDigestSha256;
    sourceAtomDigestReplay.replayDigestSha256 = sha256(sourceAtomDigestReplay);

    expect(() =>
      validateVs22HazardousWastePortfolioAudit(audit, {
        categoryId: input.categoryId,
        packageA: input.packageA,
        packageB: input.packageB,
        requirementContractA: contract,
        requirementContractB: contract,
        expectedDocumentsA: input.expectedDocumentsA,
        expectedDocumentsB: input.expectedDocumentsB,
        sourceAtomDigestReplay,
      })
    ).not.toThrow();
    expect(vs22HazardousWastePortfolioDecision(audit)).toMatchObject({
      ruleId: "VS22_HAZARDOUS_WASTE_PORTFOLIO_ADVANTAGE_V1",
      comparisonTreatment:
        "VS22_HAZARDOUS_WASTE_INCLUDED_OVER_CONTROLLED_ABSENCE_V1",
    });

    const categories = [
      {
        categoryView: "VS",
        rows: [
          {
            categoryId: "VS-22",
            outcome: "A_BELEGT_B_VOLLSTÄNDIG_NICHT_GEFUNDEN",
            packageA: input.packageA,
            packageB: input.packageB,
            pointDecision: vs22HazardousWastePortfolioDecision(audit),
            vs22SourceAtomDigestReplay: sourceAtomDigestReplay,
          },
        ],
      },
    ];
    expect(
      validateCustomerComparison({
        schemaVersion: 15,
        status: "COMPARISON_RESULT_MATERIALIZED",
        productProfile: STRUCTURAL_CONCEPT_CONTEXT_PRODUCT_PROFILE_IDENTITY,
        customerResultRuleOutcomeContract: {
          schemaVersion: CUSTOMER_RESULT_RULE_OUTCOME_CONTRACT.schemaVersion,
          contractId: CUSTOMER_RESULT_RULE_OUTCOME_CONTRACT.contractId,
        },
        documents: [...input.expectedDocumentsA, ...input.expectedDocumentsB],
        categories,
        totals: deriveCustomerMetrics(categories),
      })
    ).toMatchObject({
      customerReviewRequired: 0,
      pointDecisions: { VORTEIL_A: 1 },
    });
  });

  test.each([
    [false, "A", "VORTEIL_A"],
    [true, "B", "VORTEIL_B"],
  ])(
    "accepts a source-bound 12-direct plus one safe narrow continuation replay (reverse=%s)",
    (reverse, winner, outcome) => {
      const input = mixedScopeFixture(reverse);
      const audit = buildVs22HazardousWastePortfolioAudit(input);
      const sourceAtomDigestReplay = buildVs22SourceAtomDigestReplay(input);

      expect(audit).toMatchObject({ winner });
      expect(audit.sides[winner].hazardousWasteProofs[0]).toMatchObject({
        selectedScopePicture: "GENERAL_AND_NARROW",
      });
      expect(decidePoint(input)).toMatchObject({
        outcome,
        ruleId: VS22_HAZARDOUS_WASTE_PORTFOLIO_RULE_ID,
        reviewRequired: false,
      });
      expect(sourceAtomDigestReplay).toMatchObject({
        schemaVersion: 2,
        contractId: "VS22_SOURCE_ATOM_DIGEST_REPLAY_V2",
      });
      expect(() =>
        validateVs22HazardousWastePortfolioAudit(audit, {
          categoryId: input.categoryId,
          packageA: input.packageA,
          packageB: input.packageB,
          requirementContractA: contract,
          requirementContractB: contract,
          expectedDocumentsA: input.expectedDocumentsA,
          expectedDocumentsB: input.expectedDocumentsB,
          sourceAtomDigestReplay,
        })
      ).not.toThrow();
    }
  );

  test.each([
    [
      "an unrelated positive sentence",
      {
        positiveDirectLine:
          "Sondermüll ist nur definiert. Das Gebäude ist versichert.",
      },
    ],
    [
      "a negated direct inclusion",
      {
        positiveDirectLine: "Kosten für Sondermüll sind nicht mitversichert.",
      },
    ],
    [
      "an optional direct inclusion",
      {
        positiveDirectLine:
          "Kosten für Sondermüll sind nur bei gesonderter Vereinbarung mitversichert.",
      },
    ],
    [
      "a liability-only direct inclusion",
      {
        positiveDirectLine:
          "In der Haftpflichtversicherung sind Kosten für Sondermüll mitversichert.",
      },
    ],
    [
      "a negated narrow continuation",
      {
        narrowText:
          "gefährlichem Abfall und Sonderabfall, der durch Eindringen oder Vermischen versicherter Sachen in bzw. mit Erdreich, Wasser und/oder Luft entsteht, gilt als nicht mitversichert.",
      },
    ],
    [
      "an optional narrow continuation",
      {
        narrowText:
          "gefährlichem Abfall und Sonderabfall, der durch Eindringen oder Vermischen versicherter Sachen in bzw. mit Erdreich, Wasser und/oder Luft entsteht, gilt nur bei gesonderter Vereinbarung als mitversichert.",
      },
    ],
    [
      "a different narrow cause",
      {
        narrowText:
          "gefährlichem Abfall und Sonderabfall, der durch Zwischenlagerung versicherter Sachen in Erdreich entsteht, gilt als mitversichert.",
      },
    ],
    [
      "a proof fingerprint outside the package manifest",
      { proofFingerprint: "f".repeat(64) },
    ],
  ])("rejects coherently built mixed scope with %s", (_label, options) => {
    const input = mixedScopeFixture(false, options);
    expect(buildVs22HazardousWastePortfolioAudit(input)).toBeNull();
  });

  test.each([
    "Sondermüll ist nicht eingeschlossen.",
    "Für Sondermüll besteht kein Versicherungsschutz.",
  ])(
    "rejects a coherent additional negative direct source: %s",
    (additionalDirectLine) => {
      const input = mixedScopeFixture(false, { additionalDirectLine });
      const hazardousAtom = input.atomsA.find(
        ({ componentId }) => componentId === "hazardous_waste"
      );

      expect(hazardousAtom.vs22LocalNarrowContinuationProof).not.toBeNull();
      expect(buildVs22HazardousWastePortfolioAudit(input)).toBeNull();
    }
  );

  test.each([
    [
      "only direct sources",
      (atom) => {
        atom.sources = atom.sources.filter(
          ({ candidateBinding }) => candidateBinding === "DIRECT"
        );
      },
    ],
    [
      "only the narrow source",
      (atom) => {
        atom.sources = atom.sources.filter(
          ({ candidateBinding }) => candidateBinding === "NARROW_SCOPE"
        );
      },
    ],
    [
      "a second narrow source",
      (atom) => {
        atom.sources.push({
          ...atom.sources.at(-1),
          candidateId: "candidate:A:hazardous-waste:narrow:second",
        });
      },
    ],
    [
      "an unknown source binding",
      (atom) => {
        atom.sources[0].candidateBinding = "MENTION_ONLY";
      },
    ],
    [
      "a wrong direct binding basis",
      (atom) => {
        atom.sources[0].deterministicBindingBasis = "EXPLICIT_DISPOSAL_COSTS";
      },
    ],
    [
      "no locally positive direct source",
      (atom) => {
        atom.sources
          .filter(({ candidateBinding }) => candidateBinding === "DIRECT")
          .forEach((source, index) =>
            replaceSourceText(
              source,
              {
                conditionCheckText: source.conditionCheckText.replace(
                  "sind zusätzlich mitversichert",
                  "ist definiert"
                ),
              },
              index
            )
          );
      },
    ],
    [
      "a negated direct source",
      (atom) => {
        replaceSourceText(
          atom.sources[0],
          {
            conditionCheckText:
              "Die Kosten für Sondermüll sind nicht versichert.",
          },
          0
        );
      },
    ],
    [
      "an optional direct source",
      (atom) => {
        replaceSourceText(
          atom.sources[0],
          {
            conditionCheckText:
              "Die Kosten für Sondermüll können gegen Mehrprämie mitversichert werden.",
          },
          0
        );
      },
    ],
    [
      "a liability source",
      (atom) => {
        replaceSourceText(
          atom.sources[0],
          {
            conditionCheckText:
              "In der Haftpflichtversicherung ist Sondermüll mitversichert.",
          },
          0
        );
      },
    ],
    [
      "a negated narrow continuation",
      (atom) => {
        const source = atom.sources.at(-1);
        replaceSourceText(
          source,
          {
            conditionCheckText: source.conditionCheckText.replace(
              "gilt als mitversichert",
              "gilt als nicht mitversichert"
            ),
          },
          atom.sources.length - 1
        );
      },
    ],
    [
      "an appended exclusion inside the narrow context",
      (atom) => {
        const source = atom.sources.at(-1);
        replaceSourceText(
          source,
          {
            conditionCheckText: `${source.conditionCheckText} Schäden durch Sondermüll sind ausgeschlossen.`,
          },
          atom.sources.length - 1
        );
      },
    ],
    [
      "a different narrow cause",
      (atom) => {
        const source = atom.sources.at(-1);
        replaceSourceText(
          source,
          {
            conditionCheckText: source.conditionCheckText.replace(
              "Eindringen oder Vermischen",
              "Zwischenlagerung"
            ),
          },
          atom.sources.length - 1
        );
      },
    ],
    [
      "a source scope key",
      (atom) => {
        atom.sources.at(-1).comparisonScopeKey = "hazardous:soil-only";
      },
    ],
    [
      "an atom scope key",
      (atom) => {
        atom.comparisonScopeKeys = ["hazardous:soil-only"];
      },
    ],
    [
      "a source not selected by the atom",
      (atom) => {
        atom.sources.push({
          ...atom.sources[0],
          candidateId: "candidate:A:hazardous-waste:unselected",
        });
      },
    ],
    [
      "a duplicate selected source",
      (atom) => {
        atom.sources.push({ ...atom.sources[0] });
      },
    ],
    [
      "a tampered exact-text hash",
      (atom) => {
        atom.sources[0].exactTextSha256 = "f".repeat(64);
      },
    ],
    [
      "a tampered condition offset",
      (atom) => {
        atom.sources.at(-1).conditionCheckDocumentStart += 1;
      },
    ],
  ])("fails closed for mixed scope with %s", (_label, mutate) => {
    const input = mixedScopeFixture();
    const atom = input.atomsA.find(
      ({ componentId }) => componentId === "hazardous_waste"
    );
    mutate(atom);
    atom.selectedCandidateIds = atom.sources.map(
      ({ candidateId }) => candidateId
    );
    expect(buildVs22HazardousWastePortfolioAudit(input)).toBeNull();
  });

  test("keeps the hazardous-waste limit on the existing GENERAL-only contract", () => {
    const input = mixedScopeFixture();
    input.atomsA.find(
      ({ componentId }) => componentId === "hazardous_waste_cost_limit"
    ).selectedScopePicture = "GENERAL_AND_NARROW";

    expect(buildVs22HazardousWastePortfolioAudit(input)).toBeNull();
  });

  test("runs before the package review gate and renders the customer advantage", () => {
    const input = fixture();
    const decision = decidePoint(input);

    expect(decision).toMatchObject({
      outcome: "VORTEIL_A",
      reasonCode: "INCLUDED_HAZARDOUS_WASTE_OVER_COMPLETE_CONTROLLED_ABSENCE",
      ruleId: VS22_HAZARDOUS_WASTE_PORTFOLIO_RULE_ID,
      reviewRequired: false,
    });
    expect(customerResultText({ pointDecision: decision })).toContain(
      "Vorteil Polizze A:"
    );
  });

  test("requires source atoms or an independently stored source digest", () => {
    const input = fixture();
    const audit = buildVs22HazardousWastePortfolioAudit(input);
    const sourceAtomDigestReplay = buildVs22SourceAtomDigestReplay(input);
    const validationOptions = {
      categoryId: input.categoryId,
      packageA: input.packageA,
      packageB: input.packageB,
      requirementContractA: contract,
      requirementContractB: contract,
      expectedDocumentsA: input.expectedDocumentsA,
      expectedDocumentsB: input.expectedDocumentsB,
    };

    expect(() =>
      validateVs22HazardousWastePortfolioAudit(audit, validationOptions)
    ).toThrow("VS22_SOURCE_ATOM_DIGEST_REPLAY_REQUIRED");
    expect(() =>
      validateVs22HazardousWastePortfolioAudit(audit, {
        ...validationOptions,
        sourceAtomDigestReplay,
      })
    ).not.toThrow();

    const tampered = JSON.parse(JSON.stringify(audit));
    tampered.sides.A.projectedAtoms.find(
      ({ componentId }) => componentId === "hazardous_waste"
    ).sources[0].exactText = "Allgemeine Entsorgungskosten";
    coherentlyRehash(tampered);
    expect(() =>
      validateVs22HazardousWastePortfolioAudit(tampered, {
        ...validationOptions,
        sourceAtomDigestReplay,
      })
    ).toThrow("VS22_SOURCE_ATOM_DIGEST_REPLAY_MISMATCH");
  });

  test("canonicalizes proof arrays before replay-only validation", () => {
    const canonicalInput = fixture();
    const permutedInput = {
      ...canonicalInput,
      atomsB: [...canonicalInput.atomsB].reverse(),
    };
    const canonicalAudit =
      buildVs22HazardousWastePortfolioAudit(canonicalInput);
    const permutedAudit = buildVs22HazardousWastePortfolioAudit(permutedInput);
    const sourceAtomDigestReplay =
      buildVs22SourceAtomDigestReplay(permutedInput);

    expect(permutedAudit).toEqual(canonicalAudit);
    expect(() =>
      validateVs22HazardousWastePortfolioAudit(permutedAudit, {
        categoryId: permutedInput.categoryId,
        packageA: permutedInput.packageA,
        packageB: permutedInput.packageB,
        requirementContractA: contract,
        requirementContractB: contract,
        expectedDocumentsA: permutedInput.expectedDocumentsA,
        expectedDocumentsB: permutedInput.expectedDocumentsB,
        sourceAtomDigestReplay,
      })
    ).not.toThrow();
  });

  test("replays the current mixed V3 customer result against the private V2 row digest and strips it from the read view", () => {
    const input = mixedScopeFixture();
    const audit = buildVs22HazardousWastePortfolioAudit(input);
    const categories = [
      {
        categoryView: "VS",
        rows: [
          {
            categoryId: "VS-22",
            outcome: "A_BELEGT_B_VOLLSTÄNDIG_NICHT_GEFUNDEN",
            packageA: input.packageA,
            packageB: input.packageB,
            pointDecision: vs22HazardousWastePortfolioDecision(audit),
            vs22SourceAtomDigestReplay: buildVs22SourceAtomDigestReplay(input),
          },
        ],
      },
    ];
    const result = {
      schemaVersion: 15,
      status: "COMPARISON_RESULT_MATERIALIZED",
      productProfile: PRODUCT_PROFILE,
      customerResultRuleOutcomeContract: {
        schemaVersion: CUSTOMER_RESULT_RULE_OUTCOME_CONTRACT.schemaVersion,
        contractId: CUSTOMER_RESULT_RULE_OUTCOME_CONTRACT.contractId,
      },
      documents: [...input.expectedDocumentsA, ...input.expectedDocumentsB],
      categories,
      totals: deriveCustomerMetrics(categories),
    };

    expect(validateCustomerComparison(result)).toMatchObject({
      customerReviewRequired: 0,
      pointDecisions: { VORTEIL_A: 1 },
    });
    expect(
      customerSafeComparisonReadView(result).categories[0].rows[0]
    ).not.toHaveProperty("vs22SourceAtomDigestReplay");

    const tampered = JSON.parse(JSON.stringify(result));
    const tamperedAudit =
      tampered.categories[0].rows[0].pointDecision
        .vs22HazardousWastePortfolioAudit;
    tamperedAudit.sides.A.projectedAtoms.find(
      ({ componentId }) => componentId === "hazardous_waste"
    ).sources[0].exactText = "Allgemeine Entsorgungskosten";
    coherentlyRehash(tamperedAudit);
    expect(() => validateCustomerComparison(tampered)).toThrow(
      "COMPARISON_VS22_PORTFOLIO_AUDIT_INVALID"
    );

    const replayTampered = JSON.parse(JSON.stringify(result));
    const replay =
      replayTampered.categories[0].rows[0].vs22SourceAtomDigestReplay;
    replay.sourceAtomDigestsSha256.A = "f".repeat(64);
    delete replay.replayDigestSha256;
    replay.replayDigestSha256 = sha256(replay);
    expect(() => validateCustomerComparison(replayTampered)).toThrow(
      "COMPARISON_VS22_PORTFOLIO_AUDIT_INVALID"
    );
  });

  test.each([
    [
      "rehashes a missing terminal gate",
      (audit) => {
        const atom = audit.sides.B.projectedAtoms.find(
          ({ componentId }) => componentId === "hazardous_waste"
        );
        atom.searchAudit.gates.zeroOccurrenceTerminal = false;
      },
    ],
    [
      "rehashes a general-disposal limit as hazardous limit",
      (audit) => {
        const atom = audit.sides.A.projectedAtoms.find(
          ({ componentId }) => componentId === "hazardous_waste_cost_limit"
        );
        atom.componentId = "disposal_costs";
      },
    ],
    [
      "rehashes a document identity change",
      (audit) => {
        audit.sides.B.documentManifest[0].sha256 = "f".repeat(64);
      },
    ],
    [
      "rehashes an atom document status independently of the manifest",
      (audit) => {
        audit.sides.A.projectedAtoms[0].documentStatus = "ACTIVE";
      },
    ],
  ])("rejects an attacker that %s", (_label, mutate) => {
    const input = fixture();
    const audit = buildVs22HazardousWastePortfolioAudit(input);
    mutate(audit);
    coherentlyRehash(audit);

    expect(() =>
      validateVs22HazardousWastePortfolioAudit(audit, {
        categoryId: input.categoryId,
        packageA: input.packageA,
        packageB: input.packageB,
        requirementContractA: contract,
        requirementContractB: contract,
        expectedDocumentsA: input.expectedDocumentsA,
        expectedDocumentsB: input.expectedDocumentsB,
        atomsA: input.atomsA,
        atomsB: input.atomsB,
      })
    ).toThrow(/^VS22_/u);
  });

  test.each([
    ["missing search cell", (input) => input.atomsB.pop()],
    [
      "missing hazardous limit",
      (input) => {
        const atom = input.atomsA.find(
          ({ componentId }) => componentId === "hazardous_waste_cost_limit"
        );
        atom.evidencePresence = "NOT_FOUND";
        atom.coverageEffect = "UNKNOWN";
      },
    ],
    [
      "general disposal limit used as special limit",
      (input) => {
        const atom = input.atomsA.find(
          ({ componentId }) => componentId === "hazardous_waste_cost_limit"
        );
        atom.componentId = "disposal_costs";
      },
    ],
    [
      "general disposal wording relabeled as special limit",
      (input) => {
        const atom = input.atomsA.find(
          ({ componentId }) => componentId === "hazardous_waste_cost_limit"
        );
        atom.sources[0].exactText =
          "Allgemeine Entsorgungskosten bis EUR 6.121.600";
        atom.fields[0].facts[0].source.exactText = "EUR 6.121.600";
      },
    ],
    [
      "optional hazardous-waste limit",
      (input) => {
        const atom = input.atomsA.find(
          ({ componentId }) => componentId === "hazardous_waste_cost_limit"
        );
        atom.sources[0].conditionCheckText =
          "Sondermüll kann gegen Mehrprämie eingeschlossen werden";
      },
    ],
    [
      "source page beyond the document",
      (input) => {
        const atom = input.atomsA.find(
          ({ componentId }) => componentId === "hazardous_waste_cost_limit"
        );
        atom.sources[0].physicalPageNumber = 6;
        atom.fields[0].facts[0].source.physicalPageNumber = 6;
      },
    ],
    [
      "non-limit value type relabeled as a limit",
      (input) => {
        const fact = input.atomsA.find(
          ({ componentId }) => componentId === "hazardous_waste_cost_limit"
        ).fields[0].facts[0];
        fact.valueType = "DURATION";
        fact.unit = "DAYS";
      },
    ],
    [
      "deductible relabeled as a hazardous-waste limit",
      (input) => {
        const fact = input.atomsA.find(
          ({ componentId }) => componentId === "hazardous_waste_cost_limit"
        ).fields[0].facts[0];
        fact.limitKind = "DEDUCTIBLE";
      },
    ],
    [
      "non-deterministic hazardous-waste candidate",
      (input) => {
        const atom = input.atomsA.find(
          ({ componentId }) => componentId === "hazardous_waste_cost_limit"
        );
        atom.sources[0].deterministicBindingBasis = "EXPLICIT_DISPOSAL_COSTS";
      },
    ],
    [
      "conflicting disposal contributor",
      (input) => {
        input.atomsB.find(
          ({ componentId }) => componentId === "disposal_costs"
        ).conflictState = "CONFLICT";
      },
    ],
    [
      "unresolved disposal contributor",
      (input) => {
        input.atomsB.find(
          ({ componentId }) => componentId === "disposal_costs"
        ).unresolvedCandidateIds = ["candidate:unresolved"];
      },
    ],
    [
      "incomplete manifest",
      (input) => {
        input.expectedDocumentsB.pop();
      },
    ],
  ])("fails closed for %s", (_label, mutate) => {
    const input = fixture();
    mutate(input);
    expect(buildVs22HazardousWastePortfolioAudit(input)).toBeNull();
  });
});

const {
  SYSTEM_PROMPT,
  buildAuditCase,
  buildAuditResultRecord,
  buildSourceChunks,
  canonicalJson,
  expandModelCandidateReferences,
  modelResponseFormat,
  normalizeModelAuditMetadata,
  parseModelJson,
  parseDocumentPages,
  promptPayload,
  rankCandidates,
  rebindModelEvidenceCandidates,
  sha256,
  validateAuditResult,
  validateAuditResultRecord,
} = require("../../../utils/policyAnalysis/lfReferenceReviewAudit");

function fixture() {
  const requirement = {
    requirementId: "VS-05",
    components: [
      {
        id: "technical_objects",
        label: "Aufzüge, Antennen, Solar und Photovoltaik",
        factRole: "INSURED_OBJECT",
        aliases: ["Photovoltaikanlage"],
      },
      {
        id: "agreed_sum",
        label: "Vereinbarte Versicherungssumme",
        factRole: "LIMIT",
        aliases: ["Neuwertsumme"],
      },
    ],
    values: [],
  };
  const row = {
    categoryId: "VS-05",
    analysisRowId: "LR02-005",
    sourceOrder: 4,
    categoryName: "Technische Anlagen am Gebäude",
    subcategoryId: "VS-GEB",
    subcategoryName: "Gebäude",
    packageA: {
      documentedContent: "Aufzüge und Photovoltaik zum Neuwert",
      source: "Seite 3",
    },
    packageB: {
      reviewStatus: "TEILBELEGT",
      documentedContent: "Photovoltaikanlage versichert",
      coverage: "Ja",
      coverageAmount: "Nicht feststellbar",
      contributors: [
        {
          documentUuid: "b-document",
          documentName: "B.pdf",
          documentStatus: "FRAMEWORK_TERMS",
          reviewStatus: "BELEGT",
          source: "PDF-Seite 1: „Die Photovoltaikanlage ist mitversichert.“",
        },
      ],
    },
    outcome: "TEILWEISES_GEGENSTUECK",
    pointDecision: {
      outcome: "TEILWEISES_GEGENSTUECK",
      reasonCode: "ONLY_PART_OF_REFERENCE_COMPONENTS_EVIDENCED_IN_B",
    },
  };
  const documents = [
    {
      uuid: "b-document",
      position: 0,
      name: "B.pdf",
      role: "TERMS",
      documentStatus: "FRAMEWORK_TERMS",
      sha256: "a".repeat(64),
      artifactSha256: "b".repeat(64),
      pages: [
        {
          pageNumber: 1,
          text: "Die Photovoltaikanlage ist mitversichert. Die Neuwertsumme beträgt EUR 50.000.",
        },
      ],
    },
  ];
  const chunks = buildSourceChunks(documents, {
    windowSize: 900,
    overlap: 100,
  });
  const retrieval = rankCandidates({ row, requirement, chunks });
  const auditCase = buildAuditCase({
    row,
    requirement,
    retrieval,
    sourceInventory: documents.map(({ pages, ...document }) => ({
      ...document,
      pageCount: pages.length,
    })),
    productionEvidence: [
      {
        documentUuid: "b-document",
        judgements: [],
        selectedSources: [],
      },
    ],
    bindings: {
      sourceCommit: "c".repeat(40),
      comparisonMode: "LF_IMMO_REFERENCE_A_TO_B_V1",
    },
  });
  return { auditCase, candidateId: auditCase.candidates[0].id };
}

function validResult(candidateId) {
  return {
    componentAssessments: [
      {
        componentId: "technical_objects",
        finding: "DIRECT_SUPPORT",
        supportingCandidateIds: [candidateId],
        contradictingCandidateIds: [],
        reviewedCandidateIds: [],
        exactQuotes: [
          {
            candidateId,
            quote: "Die Photovoltaikanlage ist mitversichert.",
          },
        ],
        coverageEffect: "INCLUDED",
        scopeRelation: "SAME_OR_BROADER",
        observedBValues: [],
        note: "Die technische Anlage ist ausdrücklich mitversichert.",
      },
      {
        componentId: "agreed_sum",
        finding: "NO_MATCH_IN_CANDIDATES",
        supportingCandidateIds: [],
        contradictingCandidateIds: [],
        reviewedCandidateIds: [],
        exactQuotes: [],
        coverageEffect: "UNKNOWN",
        scopeRelation: "UNCLEAR",
        observedBValues: [],
        note: "Kein sicher gebundener Wertbeleg im Auditkandidaten.",
      },
    ],
    currentSourceAssessment: "VALID_PARTIAL_EVIDENCE",
    rootCause: "TRUE_PARTIAL",
    recommendedAction: "KEEP_PARTIAL",
    valueComparison: "UNCLEAR",
    reasoning: "Eine Komponente ist belegt, der erforderliche Wertbeleg fehlt.",
    confidence: "HIGH",
  };
}

describe("LF reference review audit contract", () => {
  test("forbids treating economically related but different cost types as support", () => {
    expect(SYSTEM_PROMPT).toContain(
      "Ersatzunterkunft ist beispielsweise kein Beleg für Zwischenlagerung"
    );
  });

  test("accepts model-serialized escaped whitespace in an otherwise exact quote", () => {
    const { auditCase, candidateId } = fixture();
    const result = validResult(candidateId);
    result.componentAssessments[0].exactQuotes[0].quote = String.raw`Die Photovoltaikanlage ist\nmitversichert.`;

    expect(
      validateAuditResult(auditCase, result).componentAssessments
    ).toHaveLength(2);
  });

  test("accepts Unicode quotation-mark variants around otherwise exact text", () => {
    const { auditCase, candidateId } = fixture();
    auditCase.candidates[0].text =
      "Die Photovoltaikanlage gilt auf „Erstes Risiko“ als mitversichert.";
    const result = validResult(candidateId);
    result.componentAssessments[0].exactQuotes[0].quote =
      "Die Photovoltaikanlage gilt auf “Erstes Risiko” als mitversichert.";

    expect(
      validateAuditResult(auditCase, result).componentAssessments
    ).toHaveLength(2);
  });

  test("binds non-supporting comparison quotes as reviewed candidates", () => {
    const { auditCase, candidateId } = fixture();
    const result = validResult(candidateId);
    result.componentAssessments[0] = {
      ...result.componentAssessments[0],
      finding: "NO_MATCH_IN_CANDIDATES",
      supportingCandidateIds: [],
      reviewedCandidateIds: [],
      coverageEffect: "UNKNOWN",
      scopeRelation: "DIFFERENT",
      observedBValues: [],
      note: "Die zitierte Passage betrifft nur einen fachlich anderen Gegenstand.",
    };

    const normalized = normalizeModelAuditMetadata(result);
    expect(normalized.componentAssessments[0].reviewedCandidateIds).toEqual([
      candidateId,
    ]);
    expect(validateAuditResult(auditCase, normalized)).toMatchObject({
      rowDisposition: "NO_ADDITIONAL_MATCH_IN_CANDIDATES",
    });
  });

  test("retains every reviewed source when one model reference is rebound to multiple candidates", () => {
    const { auditCase, candidateId } = fixture();
    const secondCandidate = {
      ...auditCase.candidates[0],
      id: `candidate:${"d".repeat(64)}`,
      text: "Die Versicherungssumme für Außenanlagen beträgt EUR 77.000.",
      textSha256: "e".repeat(64),
    };
    auditCase.candidates.push(secondCandidate);
    const result = validResult(candidateId);
    result.componentAssessments[0] = {
      ...result.componentAssessments[0],
      finding: "NO_MATCH_IN_CANDIDATES",
      supportingCandidateIds: [],
      reviewedCandidateIds: [candidateId],
      exactQuotes: [
        {
          candidateId,
          quote: "Die Photovoltaikanlage ist mitversichert.",
        },
        {
          candidateId,
          quote: "Die Versicherungssumme für Außenanlagen beträgt EUR 77.000.",
        },
      ],
      coverageEffect: "UNKNOWN",
      scopeRelation: "DIFFERENT",
      observedBValues: [],
      note: "Die Passagen wurden geprüft, tragen diese Komponente aber nicht.",
    };

    const rebound = rebindModelEvidenceCandidates(
      auditCase,
      normalizeModelAuditMetadata(result)
    );
    expect(rebound.componentAssessments[0].reviewedCandidateIds).toEqual([
      candidateId,
      secondCandidate.id,
    ]);
    expect(validateAuditResult(auditCase, rebound)).toMatchObject({
      rowDisposition: "NO_ADDITIONAL_MATCH_IN_CANDIDATES",
    });
  });

  test("drops an unbound model quote and fails the component closed", () => {
    const { auditCase, candidateId } = fixture();
    const result = validResult(candidateId);
    result.componentAssessments[0].exactQuotes[0].quote =
      "Dieser angebliche Beleg steht in keinem Dokument von Paket B.";

    const rebound = rebindModelEvidenceCandidates(auditCase, result);
    expect(rebound.componentAssessments[0]).toMatchObject({
      componentId: "technical_objects",
      finding: "NO_MATCH_IN_CANDIDATES",
      supportingCandidateIds: [],
      contradictingCandidateIds: [],
      reviewedCandidateIds: [],
      exactQuotes: [],
      coverageEffect: "UNKNOWN",
      scopeRelation: "UNCLEAR",
      observedBValues: [],
    });
    expect(validateAuditResult(auditCase, rebound)).toMatchObject({
      rowDisposition: "NO_ADDITIONAL_MATCH_IN_CANDIDATES",
      serverNormalizations: [
        {
          componentId: "technical_objects",
          originalFinding: "DIRECT_SUPPORT",
          normalizedFinding: "NO_MATCH_IN_CANDIDATES",
          reasons: ["UNBOUND_QUOTE_DROPPED"],
        },
      ],
    });
  });

  test("removes model-added boundary ellipses only when the remaining quote is exact", () => {
    const { auditCase, candidateId } = fixture();
    const result = validResult(candidateId);
    result.componentAssessments[0].exactQuotes[0].quote =
      "...Die Photovoltaikanlage ist mitversichert.";

    const rebound = rebindModelEvidenceCandidates(auditCase, result);
    expect(rebound.componentAssessments[0].exactQuotes[0].quote).toBe(
      "Die Photovoltaikanlage ist mitversichert."
    );
    expect(validateAuditResult(auditCase, rebound)).toMatchObject(rebound);
  });

  test.each(["INSURED_OBJECT", "CONDITION"])(
    "downgrades support for an unrelated %s component without a semantic anchor",
    (factRole) => {
      const { auditCase, candidateId } = fixture();
      const unrelated =
        "Fahnenstangen und Werkzeuge für die Pflege der Grünanlagen sind mitversichert.";
      auditCase.semanticRequirement.components[0].factRole = factRole;
      auditCase.candidates[0].text = unrelated;
      const result = validResult(candidateId);
      result.componentAssessments[0].exactQuotes[0].quote = unrelated;

      expect(validateAuditResult(auditCase, result)).toMatchObject({
        rowDisposition: "PRESENT_BUT_NO_DECISION_READY_COMPONENT",
        serverNormalizations: [
          {
            componentId: "technical_objects",
            originalFinding: "DIRECT_SUPPORT",
            normalizedFinding: "RELATED_ONLY",
            reasons: ["SEMANTIC_ANCHOR_MISSING"],
          },
        ],
        componentAssessments: [
          expect.objectContaining({
            componentId: "technical_objects",
            finding: "RELATED_ONLY",
            supportingCandidateIds: [],
            reviewedCandidateIds: [candidateId],
            coverageEffect: "UNKNOWN",
            scopeRelation: "DIFFERENT",
          }),
          expect.any(Object),
        ],
      });
    }
  );

  test("downgrades first-risk wording that omits every comparable limit value", () => {
    const { auditCase, candidateId } = fixture();
    const component = auditCase.semanticRequirement.components[1];
    component.sourceSpanIds = ["shared-limit-span"];
    component.valueBinding = {
      type: "PERCENT",
      basisLabel: "Gebäudeversicherungssumme",
      formula: "basis * 0.05",
    };
    auditCase.semanticRequirement.values = [
      {
        componentId: "shared_limit",
        sourceSpanId: "shared-limit-span",
        rawValue: "5%",
        normalizedValue: "5%",
      },
    ];
    auditCase.candidates[0].text += " Die Neuwertsumme gilt auf Erstes Risiko.";
    const result = validResult(candidateId);
    result.componentAssessments[1] = {
      componentId: "agreed_sum",
      finding: "DIRECT_SUPPORT",
      supportingCandidateIds: [candidateId],
      contradictingCandidateIds: [],
      reviewedCandidateIds: [],
      exactQuotes: [
        {
          candidateId,
          quote: "Die Neuwertsumme gilt auf Erstes Risiko.",
        },
      ],
      coverageEffect: "DEFINED",
      scopeRelation: "SAME_OR_BROADER",
      observedBValues: [],
      note: "Das Limitprinzip ist genannt, aber jeder konkrete Wert fehlt.",
    };

    expect(validateAuditResult(auditCase, result)).toMatchObject({
      rowDisposition: "PARTIAL_REMAINS_WITH_EVIDENCE",
      serverNormalizations: [
        {
          componentId: "agreed_sum",
          originalFinding: "DIRECT_SUPPORT",
          normalizedFinding: "RELATED_ONLY",
          reasons: ["COMPARABLE_LIMIT_VALUE_MISSING"],
        },
      ],
      componentAssessments: [
        expect.any(Object),
        expect.objectContaining({
          componentId: "agreed_sum",
          finding: "RELATED_ONLY",
          supportingCandidateIds: [],
          reviewedCandidateIds: [candidateId],
          coverageEffect: "UNKNOWN",
          scopeRelation: "UNCLEAR",
        }),
      ],
    });
  });

  test("does not impose a co-located limit value on a separate object component", () => {
    const { auditCase, candidateId } = fixture();
    const sharedSpanId = "shared-source-span";
    auditCase.semanticRequirement.components[0].sourceSpanIds = [sharedSpanId];
    auditCase.semanticRequirement.components[1].sourceSpanIds = [sharedSpanId];
    auditCase.semanticRequirement.components[1].valueBinding = {
      type: "PERCENT",
      formula: "basis * 0.05",
    };
    auditCase.semanticRequirement.values = [
      {
        componentId: "agreed_sum",
        sourceSpanId: sharedSpanId,
        rawValue: "5%",
      },
    ];
    const result = validResult(candidateId);

    const validated = validateAuditResult(auditCase, result);
    expect(validated.componentAssessments[0]).toMatchObject({
      componentId: "technical_objects",
      finding: "DIRECT_SUPPORT",
    });
    expect(validated).not.toHaveProperty("serverNormalizations");
  });

  test("accepts a required percentage when the exact quote carries it", () => {
    const { auditCase, candidateId } = fixture();
    const component = auditCase.semanticRequirement.components[1];
    component.sourceSpanIds = ["shared-limit-span"];
    component.valueBinding = {
      type: "PERCENT",
      formula: "basis * 0.05",
    };
    auditCase.semanticRequirement.values = [
      {
        componentId: "shared_limit",
        sourceSpanId: "shared-limit-span",
        rawValue: "5%",
      },
    ];
    auditCase.candidates[0].text +=
      " Die Versicherungssumme beträgt fünf Prozent auf Erstes Risiko.";
    const result = validResult(candidateId);
    result.componentAssessments[1] = {
      componentId: "agreed_sum",
      finding: "DIRECT_SUPPORT",
      supportingCandidateIds: [candidateId],
      contradictingCandidateIds: [],
      reviewedCandidateIds: [],
      exactQuotes: [
        {
          candidateId,
          quote:
            "Die Versicherungssumme beträgt fünf Prozent auf Erstes Risiko.",
        },
      ],
      coverageEffect: "DEFINED",
      scopeRelation: "SAME_OR_BROADER",
      observedBValues: [],
      note: "Der konkrete Prozentsatz ist direkt an den Beleg gebunden.",
    };

    const validated = validateAuditResult(auditCase, result);
    expect(validated).toMatchObject({
      rowDisposition: "COMPLETE_COUNTERPART_CANDIDATE",
    });
    expect(validated).not.toHaveProperty("serverNormalizations");
  });

  test.each([
    "Die Versicherungssumme beträgt zehn Prozent auf Erstes Risiko.",
    "Die Versicherungssumme beträgt EUR 75.000 auf Erstes Risiko.",
  ])(
    "accepts a different concrete limit value as a comparable counterpart: %s",
    (quote) => {
      const { auditCase, candidateId } = fixture();
      const component = auditCase.semanticRequirement.components[1];
      component.sourceSpanIds = ["shared-limit-span"];
      component.valueBinding = {
        type: "PERCENT",
        formula: "basis * 0.05",
      };
      auditCase.semanticRequirement.values = [
        {
          componentId: "shared_limit",
          sourceSpanId: "shared-limit-span",
          rawValue: "5%",
        },
      ];
      auditCase.candidates[0].text += ` ${quote}`;
      const result = validResult(candidateId);
      result.componentAssessments[1] = {
        componentId: "agreed_sum",
        finding: "DIRECT_SUPPORT",
        supportingCandidateIds: [candidateId],
        contradictingCandidateIds: [],
        reviewedCandidateIds: [],
        exactQuotes: [{ candidateId, quote }],
        coverageEffect: "DEFINED",
        scopeRelation: "SAME_OR_BROADER",
        observedBValues: [
          { candidateId, value: quote, relationToA: "DIFFERENT" },
        ],
        note: "Derselbe Limitpunkt ist mit einem abweichenden Wert geregelt.",
      };
      result.valueComparison = "DIFFERENT";

      const validated = validateAuditResult(auditCase, result);
      expect(validated).toMatchObject({
        rowDisposition: "COMPLETE_COUNTERPART_CANDIDATE",
        valueComparison: "DIFFERENT",
      });
      expect(validated).not.toHaveProperty("serverNormalizations");
    }
  );

  test("parses physical pages and rejects a mismatching page map", () => {
    expect(
      parseDocumentPages("[DOCUMENT_PAGE 1]\nEins\n[DOCUMENT_PAGE 2]\nZwei", [
        { pageNumber: 1 },
        { pageNumber: 2 },
      ])
    ).toEqual([
      { pageNumber: 1, text: "Eins" },
      { pageNumber: 2, text: "Zwei" },
    ]);
    expect(() =>
      parseDocumentPages("[DOCUMENT_PAGE 1]\nEins", [{ pageNumber: 2 }])
    ).toThrow("LF_REFERENCE_AUDIT_PAGE_MAP_MISMATCH");
  });

  test("always includes current source pages and binds the case digest", () => {
    const { auditCase, candidateId } = fixture();
    expect(
      auditCase.retrieval.currentContributorGroups[0].matchingCandidateIds
    ).toContain(candidateId);
    const digestless = { ...auditCase };
    delete digestless.inputSha256;
    expect(auditCase.inputSha256).toBe(sha256(canonicalJson(digestless)));
    const prompt = promptPayload(auditCase);
    expect(prompt.currentPartialResult).not.toHaveProperty(
      "productionEvidence"
    );
    expect(prompt.currentPartialResult.contributorGroups[0]).not.toHaveProperty(
      "currentSource"
    );
    expect(prompt.sources[0].candidateId).toBe("C01");
    expect(JSON.stringify(prompt)).not.toContain(candidateId);
  });

  test("builds a strict model schema from bound components and short references", () => {
    const { auditCase } = fixture();
    const format = modelResponseFormat(auditCase);
    const schema = format.json_schema.schema;
    const component = schema.properties.componentAssessments;
    expect(format).toMatchObject({
      type: "json_schema",
      json_schema: { strict: true },
    });
    expect(schema.additionalProperties).toBe(false);
    expect(component).toMatchObject({ minItems: 2, maxItems: 2 });
    expect(component.items.properties.componentId.enum).toEqual([
      "technical_objects",
      "agreed_sum",
    ]);
    expect(
      component.items.properties.supportingCandidateIds.items.enum
    ).toEqual(["C01"]);
    expect(component.items.required).toContain("exactQuotes");
  });

  test("expands short model references back to bound candidate hashes", () => {
    const { auditCase, candidateId } = fixture();
    const modelResult = validResult("C01");
    const expanded = expandModelCandidateReferences(auditCase, modelResult);
    expect(expanded.componentAssessments[0].supportingCandidateIds).toEqual([
      candidateId,
    ]);
    expect(expanded.componentAssessments[0].exactQuotes[0].candidateId).toBe(
      candidateId
    );
    expect(validateAuditResult(auditCase, expanded)).toMatchObject({
      rowDisposition: "PARTIAL_REMAINS_WITH_EVIDENCE",
    });
  });

  test("rebinds a real quote from a wrong model reference to its source", () => {
    const { auditCase, candidateId } = fixture();
    const wrongCandidateId = `candidate:${"e".repeat(64)}`;
    auditCase.candidates.push({
      ...auditCase.candidates[0],
      id: wrongCandidateId,
      pageNumber: 2,
      text: "Ein anderer Quellentext ohne die zitierte Aussage.",
      textSha256: sha256("Ein anderer Quellentext ohne die zitierte Aussage."),
    });
    const rebound = rebindModelEvidenceCandidates(
      auditCase,
      validResult(wrongCandidateId)
    );
    expect(rebound.componentAssessments[0].supportingCandidateIds).toEqual([
      candidateId,
    ]);
    expect(rebound.componentAssessments[0].exactQuotes[0].candidateId).toBe(
      candidateId
    );
    expect(validateAuditResult(auditCase, rebound)).toMatchObject({
      rowDisposition: "PARTIAL_REMAINS_WITH_EVIDENCE",
    });
  });

  test("normalizes non-steering model metadata before evidence validation", () => {
    const metadata = validResult("C01");
    delete metadata.valueComparison;
    metadata.componentAssessments[0].observedBValues = [
      {
        candidateId: "C01",
        value: "engerer Wert",
        relationToA: "NARROWER",
      },
    ];
    metadata.componentAssessments[0].scopeRelation = "NARROWER";
    metadata.componentAssessments[1].coverageEffect = "EXCLUDED";
    const normalized = normalizeModelAuditMetadata(metadata);
    expect(normalized.valueComparison).toBe("DIFFERENT");
    expect(normalized.componentAssessments[0].finding).toBe("NARROWER_SUPPORT");
    expect(
      normalized.componentAssessments[0].observedBValues[0].relationToA
    ).toBe("DIFFERENT");
    expect(normalized.componentAssessments[1].coverageEffect).toBe("UNKNOWN");
  });

  test("assigns an exact quote to the supporting role declared by the finding", () => {
    const metadata = validResult("C01");
    metadata.componentAssessments[0].supportingCandidateIds = [];
    expect(
      normalizeModelAuditMetadata(metadata).componentAssessments[0]
        .supportingCandidateIds
    ).toEqual(["C01"]);
  });

  test("turns a missing finding with different scope into non-supporting evidence", () => {
    const metadata = validResult("C01");
    const assessment = metadata.componentAssessments[0];
    delete assessment.finding;
    delete assessment.contradictingCandidateIds;
    delete assessment.coverageEffect;
    assessment.scopeRelation = "DIFFERENT";
    assessment.observedBValues = [
      {
        candidateId: "C01",
        value: "anderer Gegenstand",
        relationToA: "DIFFERENT",
      },
    ];
    const normalized = normalizeModelAuditMetadata(metadata);
    expect(normalized.componentAssessments[0]).toMatchObject({
      finding: "RELATED_ONLY",
      supportingCandidateIds: [],
      contradictingCandidateIds: [],
      reviewedCandidateIds: ["C01"],
      coverageEffect: "UNKNOWN",
      observedBValues: [],
    });
  });

  test("derives the partial row disposition from atomic component findings", () => {
    const { auditCase, candidateId } = fixture();
    const result = validResult(candidateId);
    result.componentAssessments[1].reviewedCandidateIds = [candidateId];
    expect(validateAuditResult(auditCase, result)).toMatchObject({
      rowDisposition: "PARTIAL_REMAINS_WITH_EVIDENCE",
    });
  });

  test("does not promote a row when every component is only narrowly supported", () => {
    const { auditCase, candidateId } = fixture();
    const result = validResult(candidateId);
    result.componentAssessments[0].finding = "NARROWER_SUPPORT";
    result.componentAssessments[0].scopeRelation = "NARROWER";
    result.componentAssessments[1] = {
      ...result.componentAssessments[1],
      finding: "NARROWER_SUPPORT",
      supportingCandidateIds: [candidateId],
      exactQuotes: [
        {
          candidateId,
          quote: "Die Neuwertsumme beträgt EUR 50.000.",
        },
      ],
      coverageEffect: "LIMITED",
      scopeRelation: "NARROWER",
    };
    expect(validateAuditResult(auditCase, result)).toMatchObject({
      rowDisposition: "PARTIAL_REMAINS_WITH_EVIDENCE",
      recommendedAction: "KEEP_PARTIAL",
    });

    result.componentAssessments.forEach((assessment) => {
      assessment.finding = "DIRECT_SUPPORT";
      assessment.scopeRelation = "SAME_OR_BROADER";
    });
    expect(validateAuditResult(auditCase, result)).toMatchObject({
      rowDisposition: "COMPLETE_COUNTERPART_CANDIDATE",
      recommendedAction: "PROMOTE_TO_FOUND_AFTER_RULE_FIX",
    });
  });

  test("does not mislabel a one-component related hit as a true partial", () => {
    const { auditCase, candidateId } = fixture();
    auditCase.semanticRequirement.components = [
      auditCase.semanticRequirement.components[0],
    ];
    const result = validResult(candidateId);
    result.componentAssessments = [
      {
        ...result.componentAssessments[0],
        finding: "RELATED_ONLY",
        supportingCandidateIds: [],
        reviewedCandidateIds: [candidateId],
        note: "Nur thematisch verwandt, aber nicht derselbe versicherte Gegenstand.",
      },
    ];
    result.currentSourceAssessment = "RELATED_ONLY";
    result.rootCause = "FALSE_POSITIVE_CURRENT_SOURCE";
    result.recommendedAction = "DEMOTE_TO_UNCLEAR_AFTER_RULE_FIX";
    expect(validateAuditResult(auditCase, result)).toMatchObject({
      rowDisposition: "PRESENT_BUT_NO_DECISION_READY_COMPONENT",
    });
  });

  test("limits explicitly reviewed candidates to five relevant sources", () => {
    const { auditCase, candidateId } = fixture();
    const reviewedCandidates = Array.from({ length: 6 }, (_value, index) => ({
      ...auditCase.candidates[0],
      id: `candidate:${String(index + 1).repeat(64)}`,
    }));
    auditCase.candidates.push(...reviewedCandidates);
    const result = validResult(candidateId);
    result.componentAssessments[1].reviewedCandidateIds =
      reviewedCandidates.map(({ id }) => id);
    expect(() => validateAuditResult(auditCase, result)).toThrow(
      "LF_REFERENCE_AUDIT_REVIEWED_CANDIDATE_LIMIT_INVALID"
    );
  });

  test("binds an exact quote across overlapping windows on the same physical page", () => {
    const { auditCase, candidateId } = fixture();
    const overlappingCandidateId = `candidate:${"d".repeat(64)}`;
    auditCase.candidates.push({
      ...auditCase.candidates[0],
      id: overlappingCandidateId,
      pageOffsetStart: 45,
      text: "Die Neuwertsumme beträgt EUR 50.000.",
      textSha256: sha256("Die Neuwertsumme beträgt EUR 50.000."),
    });
    const result = validResult(candidateId);
    result.componentAssessments[0].supportingCandidateIds = [
      overlappingCandidateId,
    ];
    result.componentAssessments[0].exactQuotes[0].candidateId =
      overlappingCandidateId;
    expect(validateAuditResult(auditCase, result)).toMatchObject({
      rowDisposition: "PARTIAL_REMAINS_WITH_EVIDENCE",
    });

    auditCase.candidates.at(-1).pageNumber = 2;
    expect(() => validateAuditResult(auditCase, result)).toThrow(
      "LF_REFERENCE_AUDIT_QUOTE_INVALID"
    );
  });

  test("accepts PDF line-wrap hyphenation without accepting a paraphrase", () => {
    const { auditCase, candidateId } = fixture();
    auditCase.candidates[0].text =
      "Die Photovoltaikanlage am Versicherungs-\ngrundstück ist mitversichert.";
    const result = validResult(candidateId);
    result.componentAssessments[0].exactQuotes[0].quote =
      "Die Photovoltaikanlage am Versicherungsgrundstück ist mitversichert.";
    expect(validateAuditResult(auditCase, result)).toMatchObject({
      rowDisposition: "PARTIAL_REMAINS_WITH_EVIDENCE",
    });

    auditCase.candidates[0].text =
      "Die Photovoltaikanlage ist auf Erstes Risiko \n EUR 50.000 versichert.";
    result.componentAssessments[0].exactQuotes[0].quote =
      "Die Photovoltaikanlage ist auf Erstes RisikoEUR 50.000 versichert.";
    expect(validateAuditResult(auditCase, result)).toMatchObject({
      rowDisposition: "PARTIAL_REMAINS_WITH_EVIDENCE",
    });

    result.componentAssessments[0].exactQuotes[0].quote =
      "Die Photovoltaikanlage ist ohne Einschränkung mitversichert.";
    expect(() => validateAuditResult(auditCase, result)).toThrow(
      "LF_REFERENCE_AUDIT_QUOTE_INVALID"
    );
  });

  test("repairs malformed model JSON before applying the audit contract", () => {
    const parsed = parseModelJson(
      '{"note":"bis zu 5% auf ,,Erstes Risiko" und danach","value":1}'
    );
    expect(parsed).toMatchObject({
      repaired: true,
      value: {
        note: 'bis zu 5% auf ,,Erstes Risiko" und danach',
        value: 1,
      },
    });
  });

  test.each([
    [
      "unknown candidate",
      (result) => {
        result.componentAssessments[0].supportingCandidateIds = ["unknown"];
      },
    ],
    [
      "invented quote",
      (result) => {
        result.componentAssessments[0].exactQuotes[0].quote =
          "Dieses Zitat ist in keinem Kandidaten enthalten.";
      },
    ],
    [
      "extra output key",
      (result) => {
        result.uncontracted = true;
      },
    ],
  ])("rejects %s", (_label, mutate) => {
    const { auditCase, candidateId } = fixture();
    const result = validResult(candidateId);
    mutate(result);
    expect(() => validateAuditResult(auditCase, result)).toThrow(
      /LF_REFERENCE_AUDIT_/u
    );
  });

  test("server-derives the action while retaining the model recommendation", () => {
    const { auditCase, candidateId } = fixture();
    const result = validResult(candidateId);
    result.recommendedAction = "PROMOTE_TO_FOUND_AFTER_RULE_FIX";
    expect(validateAuditResult(auditCase, result)).toMatchObject({
      rowDisposition: "PARTIAL_REMAINS_WITH_EVIDENCE",
      recommendedAction: "KEEP_PARTIAL",
      modelRecommendedAction: "PROMOTE_TO_FOUND_AFTER_RULE_FIX",
    });
  });

  test("detects persisted audit record tampering", () => {
    const { auditCase, candidateId } = fixture();
    const startedAt = new Date("2026-09-07T12:00:00.000Z");
    const record = buildAuditResultRecord({
      auditCase,
      result: validResult(candidateId),
      model: "qwen/test",
      endpoint: "http://127.0.0.1:1234/v1",
      startedAt,
      finishedAt: new Date("2026-09-07T12:00:01.000Z"),
      rawResponse: {},
    });
    expect(
      validateAuditResultRecord(auditCase, record, { model: "qwen/test" })
    ).toBe(record);
    record.result.reasoning =
      "Manipulierte Begründung mit ausreichender Länge.";
    expect(() =>
      validateAuditResultRecord(auditCase, record, { model: "qwen/test" })
    ).toThrow("LF_REFERENCE_AUDIT_RECORD_DIGEST_INVALID");
    expect(record.systemPromptSha256).toBe(sha256(SYSTEM_PROMPT));
  });
});

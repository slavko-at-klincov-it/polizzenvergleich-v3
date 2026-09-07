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
          source:
            "PDF-Seite 1: „Die Photovoltaikanlage ist mitversichert.“",
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
  const chunks = buildSourceChunks(documents, { windowSize: 900, overlap: 100 });
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
  test("accepts model-serialized escaped whitespace in an otherwise exact quote", () => {
    const { auditCase, candidateId } = fixture();
    const result = validResult(candidateId);
    result.componentAssessments[0].exactQuotes[0].quote =
      String.raw`Die Photovoltaikanlage ist\nmitversichert.`;

    expect(validateAuditResult(auditCase, result)).toMatchObject({
      componentAssessments: expect.any(Array),
    });
  });

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
    expect(prompt.currentPartialResult).not.toHaveProperty("productionEvidence");
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
    expect(
      component.items.properties.componentId.enum
    ).toEqual(["technical_objects", "agreed_sum"]);
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
    expect(normalized.componentAssessments[0].finding).toBe(
      "NARROWER_SUPPORT"
    );
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
    result.componentAssessments[1].reviewedCandidateIds = reviewedCandidates.map(
      ({ id }) => id
    );
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
    ["unknown candidate", (result) => {
      result.componentAssessments[0].supportingCandidateIds = ["unknown"];
    }],
    ["invented quote", (result) => {
      result.componentAssessments[0].exactQuotes[0].quote =
        "Dieses Zitat ist in keinem Kandidaten enthalten.";
    }],
    ["extra output key", (result) => {
      result.uncontracted = true;
    }],
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
    expect(validateAuditResultRecord(auditCase, record, { model: "qwen/test" })).toBe(
      record
    );
    record.result.reasoning = "Manipulierte Begründung mit ausreichender Länge.";
    expect(() =>
      validateAuditResultRecord(auditCase, record, { model: "qwen/test" })
    ).toThrow("LF_REFERENCE_AUDIT_RECORD_DIGEST_INVALID");
    expect(record.systemPromptSha256).toBe(sha256(SYSTEM_PROMPT));
  });
});

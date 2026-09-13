const {
  SOURCE_REVIEW_RESPONSE_CONTRACT_ID,
} = require("../../../utils/policyAnalysis/lfKnownFixtureSourceReview");
const {
  expectedPacketRowCount,
  messages,
  parseJsonObject,
  repairMessages,
  responseFormat,
  reviewRowForModel,
  runReviewRow,
} = require("../../../scripts/qa/runLfKnownFixtureSourceReview.cjs");
const fs = require("fs");
const os = require("os");
const path = require("path");

const row = {
  requirementId: "VS-25",
  analysisRowId: "LR02-025",
  point: "Gewerblich genutzte Nebengebäude",
  components: [
    {
      componentId: "__row_context__:VS-25",
      dimension: "SCOPE",
      candidates: [],
    },
    {
      componentId: "commercial_outbuilding",
      dimension: "OBJECT",
      candidates: [],
    },
  ],
};

describe("LF known fixture source review runner", () => {
  it("accepts only the versioned 30-row or complete 283-row review scope", () => {
    expect(
      expectedPacketRowCount({
        selection: { sample: "REPRESENTATIVE_30_V1" },
      })
    ).toBe(30);
    expect(
      expectedPacketRowCount({ selection: { sample: "ALL_283_V1" } })
    ).toBe(283);
    expect(
      expectedPacketRowCount({ selection: { sample: "ARBITRARY" } })
    ).toBeNull();
  });

  it("parses one JSON object after a hidden thinking block", () => {
    expect(
      parseJsonObject(
        `<think>intern</think>${JSON.stringify({
          contractId: SOURCE_REVIEW_RESPONSE_CONTRACT_ID,
        })}`
      )
    ).toEqual({ contractId: SOURCE_REVIEW_RESPONSE_CONTRACT_ID });
  });

  it("makes the scope mismatch and non-absence rule explicit", () => {
    const system = messages(row)[0].content;
    expect(system).toContain(
      "gemeinschaftlich genutzt ist nicht gewerblich genutzt"
    );
    expect(system).toContain("globalReferenceARebind");
    expect(system).toContain("__row_context__-Check ist zwingend");
    expect(system).toContain(
      "__row_context__-Check kann allein niemals ein Gegenstück begründen"
    );
    expect(system).toContain("COUNTERPART_WITH_DIFFERENCE");
    expect(system).toContain("unmodeledDifferences ist immer ein Array");
    expect(system).toContain("kein globaler Abwesenheitsnachweis");
    expect(messages(row)[1].content).toContain('"requirementId":"VS-25"');
  });

  it("sends compact source evidence while retaining the review semantics", () => {
    const compact = reviewRowForModel({
      ...row,
      searchedDocuments: [
        {
          uuid: "doc-1",
          fingerprint: "a".repeat(64),
          originalName: "B.pdf",
          role: "TERMS",
          documentStatus: "FRAMEWORK_TERMS",
        },
      ],
      globalReferenceARebind: [
        {
          candidateId: "candidate-1",
          documentFingerprint: "a".repeat(64),
          documentName: "B.pdf",
          documentRole: "TERMS",
          documentStatus: "FRAMEWORK_TERMS",
          physicalPageNumber: 2,
          documentStart: 100,
          documentEnd: 140,
          exactQuote: "Exakter Belegtext",
          exactQuoteSha256: "b".repeat(64),
          evidenceOrigin: "GLOBAL_REFERENCE_A_REBIND",
        },
      ],
    });
    expect(compact.searchedDocuments[0]).toEqual({
      originalName: "B.pdf",
      role: "TERMS",
      documentStatus: "FRAMEWORK_TERMS",
    });
    expect(compact.globalReferenceARebind[0]).toEqual({
      candidateId: "candidate-1",
      documentName: "B.pdf",
      documentRole: "TERMS",
      documentStatus: "FRAMEWORK_TERMS",
      physicalPageNumber: 2,
      exactQuote: "Exakter Belegtext",
      evidenceOrigin: "GLOBAL_REFERENCE_A_REBIND",
    });
  });

  it("repairs a row-level outcome mistakenly used on a component", () => {
    const repaired = repairMessages(
      row,
      '{"outcome":"NO_COUNTERPART_ESTABLISHED"}',
      { code: "LF_SOURCE_REVIEW_COMPONENT_FINDING_INVALID" }
    );
    expect(repaired.at(-1).content).toContain(
      "innerhalb jedes componentFinding ist ausschließlich MATCH, COUNTERPART_WITH_DIFFERENCE, OPPOSITE, RELATED_ONLY oder NOT_ESTABLISHED"
    );
    expect(repaired.at(-1).content).toContain(
      "derselbe fachliche Kern belegt ist und nur ein Modifikator abweicht, setze den Kern auf MATCH"
    );
  });

  it("constrains structured output to the source review contract", () => {
    const schema = responseFormat(row).json_schema.schema;
    expect(schema.properties.outcome).toBeUndefined();
    expect(schema.required).not.toContain("outcome");
    expect(schema.required).toContain("unmodeledDifferences");
    expect(schema.properties.componentFindings.minItems).toBe(2);
    expect(
      schema.properties.componentFindings.items.properties.outcome.enum
    ).toEqual([
      "MATCH",
      "COUNTERPART_WITH_DIFFERENCE",
      "OPPOSITE",
      "RELATED_ONLY",
      "NOT_ESTABLISHED",
    ]);
  });

  it("stops fail-closed without retrying when model recovery is unsafe", async () => {
    const output = fs.mkdtempSync(
      path.join(os.tmpdir(), "lf-source-review-unsafe-")
    );
    const unsafe = new Error("recovery failed");
    unsafe.errorClass = "MODEL_SAFE_RECOVERY_FAILED";
    unsafe.retrySafe = false;
    unsafe.telemetry = {
      timedOut: true,
      timeoutMs: 10,
      abortTriggered: true,
      requestSettledAfterAbort: false,
      recovery: { status: "FAILED", error: "SDK missing" },
    };
    const create = jest.fn().mockRejectedValue(unsafe);

    await expect(
      runReviewRow({
        client: { chat: { completions: { create } } },
        recoverModelAfterAbort: jest.fn(),
        args: {
          output,
          model: "qwen/qwen3.6-35b-a3b",
          modelContext: 42_496,
          maximumAttempts: 3,
          requestTimeoutMs: 10,
          abortSettlementTimeoutMs: 10,
        },
        packet: { packetSha256: "packet-sha" },
        row: { ...row, reviewIndex: 0, relation: "CLAUDE_FULL_SYSTEM_FOUND" },
      })
    ).rejects.toThrow(
      "LF_SOURCE_REVIEW_RETRIES_EXHAUSTED:VS-25:MODEL_SAFE_RECOVERY_FAILED"
    );

    expect(create).toHaveBeenCalledTimes(1);
    const attempts = fs.readdirSync(path.join(output, "attempts"));
    expect(attempts).toHaveLength(1);
    const attempt = JSON.parse(
      fs.readFileSync(path.join(output, "attempts", attempts[0]), "utf8")
    );
    expect(attempt).toMatchObject({
      errorClass: "MODEL_SAFE_RECOVERY_FAILED",
      timedOut: true,
      abortTriggered: true,
      validated: false,
    });
    expect(fs.existsSync(path.join(output, "rows"))).toBe(false);
  });
});

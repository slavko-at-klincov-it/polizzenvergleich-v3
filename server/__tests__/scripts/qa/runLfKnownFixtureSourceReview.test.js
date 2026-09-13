const {
  SOURCE_REVIEW_RESPONSE_CONTRACT_ID,
} = require("../../../utils/policyAnalysis/lfKnownFixtureSourceReview");
const {
  messages,
  parseJsonObject,
  repairMessages,
} = require("../../../scripts/qa/runLfKnownFixtureSourceReview.cjs");

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
    expect(system).toContain("__row_context__-Check ist zwingend");
    expect(system).toContain("kein globaler Abwesenheitsnachweis");
    expect(messages(row)[1].content).toContain('"requirementId":"VS-25"');
  });

  it("repairs a row-level outcome mistakenly used on a component", () => {
    const repaired = repairMessages(
      row,
      '{"outcome":"NO_COUNTERPART_ESTABLISHED"}',
      { code: "LF_SOURCE_REVIEW_COMPONENT_FINDING_INVALID" }
    );
    expect(repaired.at(-1).content).toContain(
      "innerhalb jedes componentFinding ist ausschließlich MATCH, MISMATCH oder NOT_ESTABLISHED"
    );
  });
});

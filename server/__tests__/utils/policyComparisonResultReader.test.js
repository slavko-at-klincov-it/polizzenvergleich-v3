const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  readValidatedComparisonResult,
} = require("../../utils/policyComparison/comparisonResultReader");
const {
  POLICY_COMPARISON_MODE,
} = require("../../utils/policyComparison/modes");
const {
  LF_DYNAMIC_REFERENCE_PROFILE,
} = require("../../utils/policyComparison/lfDynamicReferenceProfile");
const {
  LF_REFERENCE_PROFILE,
  categoryCatalogs,
} = require("../../utils/policyComparison/lfReferenceProfile");
const {
  DYNAMIC_REFERENCE_RESULT_CONTRACT_ID,
} = require("../../utils/policyComparison/dynamicReferenceResultBuilder");
const {
  REFERENCE_OUTCOME,
  REFERENCE_RESULT_CONTRACT_ID,
  deriveTotals,
} = require("../../utils/policyComparison/referenceResultBuilder");

function unresolvedRow(categoryId, sourceOrder) {
  return {
    categoryId,
    sourceOrder,
    packageA: {
      documentUuid: "source-a",
      searchPlanStatus: "EXPLORATORY_INCOMPLETE",
    },
    packageB: { contributors: [] },
    outcome: REFERENCE_OUTCOME.UNCLEAR,
    pointDecision: {
      outcome: REFERENCE_OUTCOME.UNCLEAR,
      reviewRequired: true,
    },
  };
}

function historicalReferenceResult() {
  const categories = categoryCatalogs().map((definition) => ({
    categoryView: definition.sourceCategoryId,
    categoryName: definition.label,
    rows: definition.catalog.requirements.map((requirement) =>
      unresolvedRow(requirement.sourceReferenceId)
    ),
  }));
  return {
    schemaVersion: 2,
    contractId: REFERENCE_RESULT_CONTRACT_ID,
    comparisonMode: POLICY_COMPARISON_MODE.LF_REFERENCE_A_TO_B,
    productProfile: LF_REFERENCE_PROFILE,
    documents: [
      { uuid: "source-a", side: "A" },
      { uuid: "counterpart-b", side: "B" },
    ],
    categories,
    totals: deriveTotals(categories),
  };
}

function dynamicReferenceResult() {
  const manifest = {
    manifestSha256: "b".repeat(64),
    source: { sourceBlockLedgerSha256: "c".repeat(64) },
    summary: {
      sourceBlocks: 3,
      semanticRequirements: 1,
      decisionEligibleRequirements: 1,
      incompleteSearchRequirements: 1,
      reviewRequiredBlocks: 1,
    },
    requirements: [{ requirementId: "FE-01" }],
    sharedValueGovernors: [],
    sharedSemanticGovernors: [],
  };
  const categories = [
    {
      categoryView: "FE",
      rows: [unresolvedRow("FE-01", 0)],
    },
  ];
  const result = {
    schemaVersion: 3,
    contractId: DYNAMIC_REFERENCE_RESULT_CONTRACT_ID,
    comparisonMode: POLICY_COMPARISON_MODE.LF_REFERENCE_A_TO_B,
    productProfile: LF_DYNAMIC_REFERENCE_PROFILE,
    templateDigest: "d".repeat(64),
    template: {
      sourceBlockLedgerSha256: manifest.source.sourceBlockLedgerSha256,
      semanticRequirementManifestSha256: manifest.manifestSha256,
      ...manifest.summary,
      sharedValueGovernors: 0,
      sharedSemanticGovernors: 0,
    },
    documents: [
      { uuid: "source-a", side: "A", sha256: "a".repeat(64) },
      { uuid: "counterpart-b", side: "B", sha256: "e".repeat(64) },
    ],
    categories,
    totals: deriveTotals(categories),
  };
  return { manifest, result };
}

describe("policy comparison result reader", () => {
  let root;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "comparison-result-reader-"));
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  function resultFile(comparisonMode) {
    const file = path.join(root, "comparison.private.json");
    fs.writeFileSync(file, JSON.stringify({ comparisonMode }));
    return file;
  }

  test("rejects an LF result attached to a symmetric session", () => {
    expect(() =>
      readValidatedComparisonResult(
        resultFile(POLICY_COMPARISON_MODE.LF_REFERENCE_A_TO_B),
        POLICY_COMPARISON_MODE.SYMMETRIC_A_B
      )
    ).toThrow(
      "COMPARISON_RESULT_MODE_MISMATCH:SYMMETRIC_A_B_CORE5_V1:LF_IMMO_REFERENCE_A_TO_B_V1"
    );
  });

  test("rejects a symmetric result attached to an LF session", () => {
    expect(() =>
      readValidatedComparisonResult(
        resultFile(POLICY_COMPARISON_MODE.SYMMETRIC_A_B),
        POLICY_COMPARISON_MODE.LF_REFERENCE_A_TO_B
      )
    ).toThrow(
      "COMPARISON_RESULT_MODE_MISMATCH:LF_IMMO_REFERENCE_A_TO_B_V1:SYMMETRIC_A_B_CORE5_V1"
    );
  });

  test("treats a pre-mode result as symmetric and never as LF", () => {
    expect(() =>
      readValidatedComparisonResult(
        resultFile(undefined),
        POLICY_COMPARISON_MODE.LF_REFERENCE_A_TO_B
      )
    ).toThrow(
      "COMPARISON_RESULT_MODE_MISMATCH:LF_IMMO_REFERENCE_A_TO_B_V1:SYMMETRIC_A_B_CORE5_V1"
    );
    expect(() =>
      readValidatedComparisonResult(
        resultFile(undefined),
        POLICY_COMPARISON_MODE.SYMMETRIC_A_B
      )
    ).not.toThrow("COMPARISON_RESULT_MODE_MISMATCH");
  });

  test("continues to read historical 35-row LF results without template artifacts", () => {
    const file = path.join(root, "historical-reference.private.json");
    fs.writeFileSync(file, JSON.stringify(historicalReferenceResult()));
    const validateDynamicTemplate = jest.fn();

    const result = readValidatedComparisonResult(
      file,
      POLICY_COMPARISON_MODE.LF_REFERENCE_A_TO_B,
      { validateDynamicTemplate }
    );

    expect(result.totals.referenceRowsAnalyzed).toBe(35);
    expect(validateDynamicTemplate).not.toHaveBeenCalled();
  });

  test("passes the dynamic source identity and result templateDigest to full template validation", () => {
    const { manifest, result } = dynamicReferenceResult();
    const runRoot = path.join(root, "run");
    const resultDirectory = path.join(runRoot, "result");
    const documentDirectory = path.join(
      runRoot,
      "documents",
      "A-01-source-a"
    );
    fs.mkdirSync(resultDirectory, { recursive: true });
    fs.mkdirSync(documentDirectory, { recursive: true });
    const file = path.join(resultDirectory, "comparison.private.json");
    const documentArtifactFile = path.join(
      documentDirectory,
      "document.private.json"
    );
    fs.writeFileSync(file, JSON.stringify(result));
    fs.writeFileSync(documentArtifactFile, "{}");
    const validateDynamicTemplate = jest.fn(() => ({ manifest }));

    expect(
      readValidatedComparisonResult(
        file,
        POLICY_COMPARISON_MODE.LF_REFERENCE_A_TO_B,
        { validateDynamicTemplate }
      )
    ).toEqual(result);
    expect(validateDynamicTemplate).toHaveBeenCalledWith(
      {
        templateRoot: path.join(runRoot, "reference-template"),
        documentArtifactFile,
        sourceDocument: result.documents[0],
        templateDigest: result.templateDigest,
      },
      { fsImpl: fs }
    );
  });
});

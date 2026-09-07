const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  publishCachedResponse,
  readValidatedCachedResponse,
  responseCacheIdentity,
  seedResponseCacheFromRunHistory,
} = require("../../../utils/policyAnalysis/validatedModelResponseCache");

const model = "qwen/qwen3.6-35b-a3b";
const modelTokenLimit = 42496;
const messages = [
  { role: "system", content: "contract" },
  { role: "user", content: '{"task":"ONE"}' },
];
const responseText = '{"schemaVersion":1,"answer":"YES"}';

describe("validated model response cache", () => {
  let root;
  let cacheDirectory;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "model-response-cache-"));
    cacheDirectory = path.join(root, "response-cache-v1");
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("binds identity to phase, model, context limit and exact messages", () => {
    const base = responseCacheIdentity({
      phase: "TRIAGE",
      model,
      modelTokenLimit,
      messages,
    });
    expect(
      responseCacheIdentity({
        phase: "PREPARED_EVIDENCE",
        model,
        modelTokenLimit,
        messages,
      }).cacheKey
    ).not.toBe(base.cacheKey);
    expect(
      responseCacheIdentity({
        phase: "TRIAGE",
        model,
        modelTokenLimit,
        messages: [...messages, { role: "user", content: "changed" }],
      }).cacheKey
    ).not.toBe(base.cacheKey);
  });

  it("publishes atomically and revalidates before returning a hit", () => {
    const cacheKey = publishCachedResponse({
      cacheDirectory,
      phase: "TRIAGE",
      model,
      modelTokenLimit,
      messages,
      responseText,
      responseModel: model,
    });
    const validateResponse = jest.fn((text) => JSON.parse(text));
    const hit = readValidatedCachedResponse({
      cacheDirectory,
      phase: "TRIAGE",
      model,
      modelTokenLimit,
      messages,
      validateResponse,
    });
    expect(hit).toMatchObject({ cacheKey, responseText });
    expect(hit.validated.answer).toBe("YES");
    expect(validateResponse).toHaveBeenCalledWith(responseText);
    expect(
      fs.statSync(path.join(cacheDirectory, `${cacheKey}.private.json`)).mode &
        0o777
    ).toBe(0o600);
  });

  it("fails closed on corruption and current-parser rejection", () => {
    const cacheKey = publishCachedResponse({
      cacheDirectory,
      phase: "TRIAGE",
      model,
      modelTokenLimit,
      messages,
      responseText,
      responseModel: model,
    });
    const file = path.join(cacheDirectory, `${cacheKey}.private.json`);
    const entry = JSON.parse(fs.readFileSync(file, "utf8"));
    entry.responseText = "tampered";
    fs.writeFileSync(file, JSON.stringify(entry));
    expect(
      readValidatedCachedResponse({
        cacheDirectory,
        phase: "TRIAGE",
        model,
        modelTokenLimit,
        messages,
        validateResponse: JSON.parse,
      })
    ).toBeNull();

    fs.rmSync(cacheDirectory, { recursive: true, force: true });
    publishCachedResponse({
      cacheDirectory,
      phase: "TRIAGE",
      model,
      modelTokenLimit,
      messages,
      responseText,
      responseModel: model,
    });
    expect(
      readValidatedCachedResponse({
        cacheDirectory,
        phase: "TRIAGE",
        model,
        modelTokenLimit,
        messages,
        validateResponse: () => {
          throw new Error("new contract rejects old response");
        },
      })
    ).toBeNull();
  });

  it("seeds only matching successful single-target calls", () => {
    const runRoot = path.join(root, "resume-old");
    const phaseRoot = path.join(runRoot, "B-01", "LR01", "triage");
    fs.mkdirSync(phaseRoot, { recursive: true });
    const resultRoot = path.join(runRoot, "result");
    fs.mkdirSync(resultRoot, { recursive: true });
    for (const name of [
      "artifact-set-manifest.private.json",
      "comparison.private.json",
      "export.private.json",
      "polizzenvergleich.xlsx",
    ])
      fs.writeFileSync(path.join(resultRoot, name), "fixture");
    fs.writeFileSync(
      path.join(phaseRoot, "answers.private.json"),
      JSON.stringify([
        {
          targetId: "target:1",
          attempt: 1,
          responseText,
          metrics: { responseModel: model },
        },
      ])
    );
    fs.writeFileSync(
      path.join(phaseRoot, "messages.private.json"),
      JSON.stringify([{ targetId: "target:1", attempt: 1, messages }])
    );
    fs.writeFileSync(
      path.join(phaseRoot, "report.json"),
      JSON.stringify({
        status: "TECHNICAL_PASS_REVIEW_REQUIRED",
        model: {
          provider: "LMStudioLLM",
          id: model,
          declaredTokenLimit: modelTokenLimit,
          temperature: 0,
        },
      })
    );

    const stats = seedResponseCacheFromRunHistory({
      sessionRunsRoot: root,
      cacheDirectory,
    });
    expect(stats).toMatchObject({
      completedRunRoots: 1,
      answerFiles: 1,
      candidateResponses: 1,
      published: 1,
    });
    expect(
      readValidatedCachedResponse({
        cacheDirectory,
        phase: "TRIAGE",
        model,
        modelTokenLimit,
        messages,
        validateResponse: JSON.parse,
      })?.validated.answer
    ).toBe("YES");
  });
});

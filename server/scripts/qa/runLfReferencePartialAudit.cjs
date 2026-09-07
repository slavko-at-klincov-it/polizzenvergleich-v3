#!/usr/bin/env node

process.umask(0o077);

const fs = require("fs");
const path = require("path");
const { performance } = require("perf_hooks");
const { OpenAI } = require("openai");
const {
  SYSTEM_PROMPT,
  buildAuditResultRecord,
  canonicalJson,
  jsonFromModelText,
  promptPayload,
  sha256,
  validateAuditResult,
  validateAuditResultRecord,
} = require("../../utils/policyAnalysis/lfReferenceReviewAudit");
const {
  INDEX_CONTRACT_ID,
  readJson,
  writePrivateJson,
} = require("./buildLfReferencePartialAuditCases.cjs");

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value)
      throw new Error(`LF_REFERENCE_AUDIT_ARGUMENT_INVALID:${key || "-"}`);
    values[key.slice(2)] = value;
  }
  const allowed = new Set([
    "auditRoot",
    "endpoint",
    "model",
    "modelTokenLimit",
    "maxAttempts",
    "limit",
  ]);
  const unknown = Object.keys(values).filter((key) => !allowed.has(key));
  if (unknown.length)
    throw new Error(`LF_REFERENCE_AUDIT_ARGUMENT_UNKNOWN:${unknown.join(",")}`);
  for (const required of ["auditRoot", "model", "modelTokenLimit"])
    if (!values[required])
      throw new Error(`LF_REFERENCE_AUDIT_ARGUMENT_REQUIRED:${required}`);
  const number = (key, fallback, minimum) => {
    const parsed = Number(values[key] ?? fallback);
    if (!Number.isSafeInteger(parsed) || parsed < minimum)
      throw new Error(`LF_REFERENCE_AUDIT_ARGUMENT_NUMBER_INVALID:${key}`);
    return parsed;
  };
  return {
    auditRoot: path.resolve(values.auditRoot),
    endpoint: values.endpoint ?? "http://127.0.0.1:1234/v1",
    model: values.model,
    modelTokenLimit: number("modelTokenLimit", 0, 1024),
    maxAttempts: number("maxAttempts", 3, 1),
    limit: number("limit", 0, 0),
  };
}

async function verifyModel({ endpoint, model, modelTokenLimit, fetchImpl = fetch }) {
  const apiRoot = endpoint.replace(/\/v1\/?$/u, "");
  const response = await fetchImpl(`${apiRoot}/api/v0/models`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new Error(`LF_REFERENCE_AUDIT_MODEL_LIST_FAILED:${response.status}`);
  const body = await response.json();
  const loaded = body?.data?.find(
    ({ id, type, state }) => id === model && type === "llm" && state === "loaded"
  );
  if (
    !loaded ||
    Number(loaded.loaded_context_length) !== Number(modelTokenLimit)
  )
    throw new Error(
      `LF_REFERENCE_AUDIT_MODEL_NOT_EXACTLY_LOADED:${model}:${modelTokenLimit}`
    );
  return {
    id: loaded.id,
    type: loaded.type,
    state: loaded.state,
    loadedContextLength: Number(loaded.loaded_context_length),
  };
}

function validateIndex(index) {
  const withoutDigest = { ...index };
  delete withoutDigest.indexSha256;
  if (
    index?.contractId !== INDEX_CONTRACT_ID ||
    index?.advisoryOnly !== true ||
    index?.primaryResultMutationAllowed !== false ||
    index?.targetOutcome !== "TEILWEISES_GEGENSTUECK" ||
    index?.caseCount !== index?.expectedCaseCount ||
    !Array.isArray(index?.cases) ||
    index.cases.length !== index.caseCount ||
    new Set(index.cases.map(({ caseId }) => caseId)).size !== index.caseCount ||
    index.indexSha256 !== sha256(canonicalJson(withoutDigest))
  )
    throw new Error("LF_REFERENCE_AUDIT_INDEX_INVALID");
  return index;
}

function failureRecord({ auditCase, args, attempts, error }) {
  return {
    schemaVersion: 1,
    contractId: "LF_REFERENCE_REVIEW_AUDIT_FAILURE_V1",
    status: "FAILED",
    advisoryOnly: true,
    primaryResultMutationAllowed: false,
    caseId: auditCase.caseId,
    caseInputSha256: auditCase.inputSha256,
    model: args.model,
    modelTokenLimit: args.modelTokenLimit,
    endpoint: args.endpoint,
    systemPromptSha256: sha256(SYSTEM_PROMPT),
    attemptCount: attempts.length,
    attempts,
    error: String(error?.stack || error),
    failedAt: new Date().toISOString(),
  };
}

function summaryFromIndex({ auditRoot, index, model }) {
  const summary = {
    schemaVersion: 1,
    contractId: "LF_PARTIAL_COUNTERPART_AUDIT_PROGRESS_V1",
    advisoryOnly: true,
    primaryResultMutationAllowed: false,
    indexSha256: index.indexSha256,
    model,
    expectedCaseCount: index.caseCount,
    completedCaseCount: 0,
    failedCaseCount: 0,
    pendingCaseCount: 0,
    rowDispositions: Object.fromEntries(
      [
        "COMPLETE_COUNTERPART_CANDIDATE",
        "PARTIAL_REMAINS_WITH_EVIDENCE",
        "PRESENT_BUT_NO_DECISION_READY_COMPONENT",
        "CONTRADICTION_REVIEW_REQUIRED",
        "AUDIT_UNCLEAR",
        "NO_ADDITIONAL_MATCH_IN_CANDIDATES",
      ].map((value) => [value, 0])
    ),
    rootCauses: {},
    completedCaseIds: [],
    failedCaseIds: [],
    pendingCaseIds: [],
  };
  for (const item of index.cases) {
    const caseFile = path.join(
      auditRoot,
      "cases",
      `${item.caseId}.private.json`
    );
    const auditCase = readJson(caseFile, "CASE");
    const resultFile = path.join(
      auditRoot,
      "results",
      `${item.caseId}.private.json`
    );
    const failureFile = path.join(
      auditRoot,
      "failures",
      `${item.caseId}.private.json`
    );
    try {
      const record = readJson(resultFile, "RESULT");
      validateAuditResultRecord(auditCase, record, { model });
      summary.completedCaseCount += 1;
      summary.completedCaseIds.push(item.caseId);
      summary.rowDispositions[record.result.rowDisposition] += 1;
      summary.rootCauses[record.result.rootCause] =
        (summary.rootCauses[record.result.rootCause] ?? 0) + 1;
    } catch {
      if (fs.existsSync(failureFile)) {
        summary.failedCaseCount += 1;
        summary.failedCaseIds.push(item.caseId);
      } else {
        summary.pendingCaseCount += 1;
        summary.pendingCaseIds.push(item.caseId);
      }
    }
  }
  summary.summarySha256 = sha256(canonicalJson(summary));
  return summary;
}

async function runAudit(args, dependencies = {}) {
  const index = validateIndex(
    readJson(path.join(args.auditRoot, "index.private.json"), "INDEX")
  );
  const loadedModel = await (dependencies.verifyModelFn ?? verifyModel)({
    endpoint: args.endpoint,
    model: args.model,
    modelTokenLimit: args.modelTokenLimit,
    fetchImpl: dependencies.fetchImpl,
  });
  const client =
    dependencies.client ??
    new OpenAI({ baseURL: args.endpoint, apiKey: "lm-studio" });
  const selected =
    args.limit > 0 ? index.cases.slice(0, args.limit) : index.cases;
  let ordinal = 0;
  for (const item of selected) {
    ordinal += 1;
    const auditCase = readJson(
      path.join(args.auditRoot, "cases", `${item.caseId}.private.json`),
      "CASE"
    );
    if (auditCase.inputSha256 !== item.inputSha256)
      throw new Error(`LF_REFERENCE_AUDIT_CASE_INDEX_MISMATCH:${item.caseId}`);
    const resultFile = path.join(
      args.auditRoot,
      "results",
      `${item.caseId}.private.json`
    );
    try {
      const existing = readJson(resultFile, "RESULT");
      validateAuditResultRecord(auditCase, existing, { model: args.model });
      console.log(
        `[lf-partial-audit] SKIP ${ordinal}/${selected.length} ${item.caseId}`
      );
      continue;
    } catch {}

    const payload = promptPayload(auditCase);
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: canonicalJson(payload) },
    ];
    const attempts = [];
    let completed = null;
    let lastError = null;
    const startedAt = new Date();
    const started = performance.now();
    for (let attempt = 1; attempt <= args.maxAttempts; attempt += 1) {
      let responseBody = null;
      let modelText = "";
      const attemptStarted = performance.now();
      try {
        const response = await client.chat.completions.create({
          model: args.model,
          messages,
          temperature: 0,
          max_tokens: 5000,
        });
        responseBody = response;
        modelText = response.choices?.[0]?.message?.content ?? "";
        const result = validateAuditResult(
          auditCase,
          jsonFromModelText(modelText)
        );
        attempts.push({
          attempt,
          status: "VALID",
          durationMs: Math.round(performance.now() - attemptStarted),
          responseModel: response.model ?? null,
          usage: response.usage ?? null,
          rawResponse: response,
        });
        completed = buildAuditResultRecord({
          auditCase,
          result,
          model: args.model,
          endpoint: args.endpoint,
          startedAt,
          finishedAt: new Date(),
          rawResponse: responseBody,
        });
        break;
      } catch (error) {
        lastError = error;
        attempts.push({
          attempt,
          status: "INVALID",
          durationMs: Math.round(performance.now() - attemptStarted),
          error: String(error?.message || error),
          rawText: modelText,
          rawResponse: responseBody,
        });
        if (attempt < args.maxAttempts)
          messages.push(
            { role: "assistant", content: modelText },
            {
              role: "user",
              content: `Die vorige Antwort verletzt den Auditvertrag: ${
                error.message
              }. Korrigiere nur das JSON. Für jede gelieferte Komponente muss genau ein componentAssessment vorliegen. Verwende ausschließlich vorhandene Kandidaten- und Komponenten-IDs; jede verwendete Kandidaten-ID braucht ein exaktes, wörtlich enthaltenes Zitat. Setze keinen finalen Zeilenstatus.`,
            }
          );
      }
    }
    writePrivateJson(
      path.join(args.auditRoot, "attempts", `${item.caseId}.private.json`),
      {
        schemaVersion: 1,
        contractId: "LF_REFERENCE_REVIEW_AUDIT_ATTEMPTS_V1",
        caseId: item.caseId,
        caseInputSha256: item.inputSha256,
        model: args.model,
        modelTokenLimit: args.modelTokenLimit,
        systemPromptSha256: sha256(SYSTEM_PROMPT),
        durationMs: Math.round(performance.now() - started),
        attempts,
      }
    );
    if (completed) {
      writePrivateJson(resultFile, completed);
      const failureFile = path.join(
        args.auditRoot,
        "failures",
        `${item.caseId}.private.json`
      );
      if (fs.existsSync(failureFile)) fs.unlinkSync(failureFile);
      console.log(
        `[lf-partial-audit] DONE ${ordinal}/${selected.length} ${item.caseId} ${completed.result.rowDisposition} ${completed.durationMs}ms`
      );
    } else {
      writePrivateJson(
        path.join(args.auditRoot, "failures", `${item.caseId}.private.json`),
        failureRecord({ auditCase, args, attempts, error: lastError })
      );
      console.error(
        `[lf-partial-audit] FAILED ${ordinal}/${selected.length} ${item.caseId}: ${lastError?.message}`
      );
    }
    writePrivateJson(
      path.join(args.auditRoot, "progress.private.json"),
      summaryFromIndex({ auditRoot: args.auditRoot, index, model: args.model })
    );
  }
  const summary = summaryFromIndex({
    auditRoot: args.auditRoot,
    index,
    model: args.model,
  });
  summary.loadedModel = loadedModel;
  summary.completedAt = new Date().toISOString();
  const digestless = { ...summary };
  delete digestless.summarySha256;
  summary.summarySha256 = sha256(canonicalJson(digestless));
  writePrivateJson(path.join(args.auditRoot, "progress.private.json"), summary);
  return summary;
}

async function run() {
  const args = parseArguments(process.argv.slice(2));
  const summary = await runAudit(args);
  console.log(
    `[lf-partial-audit] STATUS: ${summary.completedCaseCount}/${summary.expectedCaseCount} vollständig, ${summary.failedCaseCount} technisch fehlgeschlagen`
  );
  if (
    args.limit === 0 &&
    (summary.completedCaseCount !== summary.expectedCaseCount ||
      summary.failedCaseCount > 0)
  )
    process.exitCode = 1;
}

if (require.main === module)
  run().catch((error) => {
    console.error(`[lf-partial-audit] ${error.stack || error.message}`);
    process.exitCode = 1;
  });

module.exports = {
  parseArguments,
  runAudit,
  summaryFromIndex,
  validateIndex,
  verifyModel,
};

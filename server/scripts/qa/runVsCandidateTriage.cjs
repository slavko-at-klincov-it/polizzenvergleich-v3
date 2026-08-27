#!/usr/bin/env node

process.umask(0o077);

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

function fail(message) {
  console.error(`[vs-candidate-triage] ${message}`);
  process.exit(1);
}

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value) fail(`Ungültiges Argument: ${key}`);
    values[key.slice(2)] = value;
  }
  return values;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function sha256File(file) {
  return sha256(fs.readFileSync(file));
}

function writePrivateJson(outputDirectory, fileName, value) {
  const file = path.join(outputDirectory, fileName);
  fs.writeFileSync(file, JSON.stringify(value, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.chmodSync(file, 0o600);
}

function aggregateCompletionMetrics(calls, model) {
  const totals = calls.reduce(
    (result, call) => {
      result.prompt_tokens += call.metrics?.prompt_tokens || 0;
      result.completion_tokens += call.metrics?.completion_tokens || 0;
      result.total_tokens += call.metrics?.total_tokens || 0;
      result.duration += call.metrics?.duration || 0;
      return result;
    },
    { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, duration: 0 }
  );
  const responseModels = [
    ...new Set(
      calls.map((call) => call.metrics?.responseModel).filter(Boolean)
    ),
  ];
  return {
    callCount: calls.length,
    ...totals,
    outputTps:
      totals.duration > 0 ? totals.completion_tokens / totals.duration : 0,
    model,
    responseModel:
      responseModels.length === 1 && calls.length > 0
        ? responseModels[0]
        : null,
    responseModelComplete:
      calls.length > 0 &&
      calls.every(({ metrics }) => metrics?.responseModel === model),
    provider: "LMStudioLLM",
    timestamp: new Date(),
  };
}

async function run() {
  const args = parseArguments(process.argv.slice(2));
  const worksheetFile = path.resolve(args.worksheet || "");
  const systemPromptFile = path.resolve(args.systemPromptFile || "");
  const controlFile = path.resolve(args.controlFile || "");
  const outputDirectory = path.resolve(args.output || "");
  for (const [label, file] of [
    ["Worksheet", worksheetFile],
    ["Systemprompt", systemPromptFile],
    ["Kontrollen", controlFile],
  ]) {
    if (!file || !fs.existsSync(file)) fail(`${label} fehlt: ${file}`);
  }
  if (!args.output) fail("--output ist erforderlich");

  fs.mkdirSync(outputDirectory, { recursive: true, mode: 0o700 });
  fs.chmodSync(outputDirectory, 0o700);
  process.env.LMSTUDIO_BASE_PATH =
    process.env.LMSTUDIO_BASE_PATH || "http://127.0.0.1:1234/v1";
  process.env.LMSTUDIO_MODEL_PREF =
    args.model || process.env.LMSTUDIO_MODEL_PREF || "qwen3.5-4b-mlx";
  process.env.LMSTUDIO_MODEL_TOKEN_LIMIT =
    args.modelTokenLimit || process.env.LMSTUDIO_MODEL_TOKEN_LIMIT || "32768";

  const {
    buildCandidateTriagePayload,
    buildSingleBindingTargetPayload,
    deriveCandidateBinding,
    evaluateCandidateTriageControls,
    materializeCandidateTriage,
    parseAndValidateCandidateTriage,
    parseAndValidateSingleBindingTarget,
  } = require("../../utils/policyAnalysis/candidateTriageContract");
  const { LMStudioLLM } = require("../../utils/AiProviders/lmStudio");

  const worksheet = JSON.parse(fs.readFileSync(worksheetFile, "utf8"));
  const systemPrompt = fs.readFileSync(systemPromptFile, "utf8");
  const controlSet = JSON.parse(fs.readFileSync(controlFile, "utf8"));
  const controlReviewStatus = controlSet.reviewStatus || "NOT_DECLARED";
  if (
    !["NOT_DECLARED", "REVIEW_REQUIRED", "APPROVED"].includes(
      controlReviewStatus
    )
  )
    fail(`Ungültiger Control-Reviewstatus: ${controlReviewStatus}`);
  const payload = buildCandidateTriagePayload(worksheet);
  const userPrompt = JSON.stringify(payload);
  const llm = new LMStudioLLM(null, process.env.LMSTUDIO_MODEL_PREF);
  const startedAt = new Date();
  const calls = [];
  const messageCalls = [];
  const targetJudgements = [];
  let validationError = null;

  for (const target of payload.bindingTargets) {
    if (target.modelDecisionFields.length === 0) {
      const roleMatch = target.roleResolution.roleMatch;
      const scopeMatch = target.scopeResolution.scopeMatch;
      targetJudgements.push({
        targetId: target.targetId,
        roleMatch,
        scopeMatch,
        binding: deriveCandidateBinding({ roleMatch, scopeMatch }),
        decisionOwner: "SERVER",
      });
      continue;
    }
    const singlePayload = buildSingleBindingTargetPayload({
      payload,
      targetId: target.targetId,
    });
    const messages = llm.constructPrompt({
      systemPrompt,
      contextTexts: [],
      chatHistory: [],
      userPrompt: JSON.stringify(singlePayload),
    });
    const completion = await llm.getChatCompletion(messages, {
      temperature: 0,
      maxTokens: 128,
    });
    const call = {
      targetId: target.targetId,
      payloadSha256: sha256(JSON.stringify(singlePayload)),
      responseText: completion?.textResponse || "",
      metrics: completion?.metrics || null,
    };
    calls.push(call);
    messageCalls.push({ targetId: target.targetId, messages });
    if (!completion?.textResponse) {
      validationError = {
        code: "TRIAGE_EMPTY_RESPONSE",
        message: `TRIAGE_EMPTY_RESPONSE: ${target.targetId}`,
      };
      break;
    }
    try {
      targetJudgements.push(
        parseAndValidateSingleBindingTarget({
          responseText: completion.textResponse,
          target,
        })
      );
    } catch (error) {
      validationError = {
        code: error.code || "UNKNOWN",
        message: error.message,
        targetId: target.targetId,
      };
      break;
    }
  }
  const finishedAt = new Date();
  const combinedJudgements = targetJudgements.map(({ targetId, binding }) => ({
    targetId,
    binding,
  }));
  writePrivateJson(outputDirectory, "answers.private.json", calls);
  writePrivateJson(outputDirectory, "messages.private.json", messageCalls);
  writePrivateJson(outputDirectory, "combined-answer.private.json", {
    schemaVersion: payload.schemaVersion,
    judgements: combinedJudgements,
  });

  let validatedTriage = null;
  let materialized = null;
  let controls = [];
  if (validationError === null) {
    try {
      validatedTriage = parseAndValidateCandidateTriage({
        responseText: JSON.stringify({
          schemaVersion: payload.schemaVersion,
          judgements: combinedJudgements,
        }),
        worksheet,
      });
      materialized = materializeCandidateTriage({ worksheet, validatedTriage });
      controls = evaluateCandidateTriageControls({ materialized, controlSet });
      writePrivateJson(
        outputDirectory,
        "validated-triage.private.json",
        validatedTriage
      );
      writePrivateJson(
        outputDirectory,
        "materialized-triage.private.json",
        materialized
      );
    } catch (error) {
      validationError = {
        code: error.code || "UNKNOWN",
        message: error.message,
      };
    }
  }

  const formalPass = validatedTriage !== null;
  const controlsPass = formalPass && controls.every(({ pass }) => pass);
  const technicalPass = formalPass && controlsPass;
  const report = {
    status: technicalPass
      ? controlReviewStatus === "APPROVED"
        ? "PASS"
        : "TECHNICAL_PASS_REVIEW_REQUIRED"
      : "REVISE",
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    model: {
      provider: "LMStudioLLM",
      id: process.env.LMSTUDIO_MODEL_PREF,
      declaredTokenLimit: Number(process.env.LMSTUDIO_MODEL_TOKEN_LIMIT),
      temperature: 0,
      seed: null,
    },
    contracts: {
      worksheetPath: worksheetFile,
      worksheetSha256: sha256File(worksheetFile),
      systemPromptPath: systemPromptFile,
      systemPromptSha256: sha256File(systemPromptFile),
      controlPath: controlFile,
      controlSha256: sha256File(controlFile),
      payloadSha256: sha256(userPrompt),
    },
    input: {
      requirementCount: new Set(
        payload.bindingTargets.map(({ requirementId }) => requirementId)
      ).size,
      bindingTargetCount: payload.bindingTargets.length,
      serverTerminalTargetCount: payload.bindingTargets.filter(
        (target) => target.modelDecisionFields.length === 0
      ).length,
      modelTargetCount: calls.length,
      candidateCount: payload.bindingTargets.reduce(
        (sum, target) => sum + target.candidateIds.length,
        0
      ),
    },
    completion: aggregateCompletionMetrics(
      calls,
      process.env.LMSTUDIO_MODEL_PREF
    ),
    validation: {
      formalPass,
      error: validationError,
      targetJudgementCount: validatedTriage?.targetJudgements.length || 0,
      judgementCount: validatedTriage?.judgements.length || 0,
    },
    controls: {
      pass: controlsPass,
      reviewStatus: controlReviewStatus,
      results: controls,
    },
  };
  writePrivateJson(outputDirectory, "report.json", report);
  console.log(
    `[vs-candidate-triage] ${report.status}: ` +
      `${report.validation.judgementCount}/${report.input.candidateCount} IDs, ` +
      `${controls.filter(({ pass }) => pass).length}/${controls.length} Kontrollen`
  );
}

run().catch((error) => fail(error.stack || error.message));

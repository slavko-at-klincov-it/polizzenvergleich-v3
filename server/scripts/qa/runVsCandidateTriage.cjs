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
      calls.length === 0 ||
      calls.every(({ metrics }) => metrics?.responseModel === model),
    executionMode: calls.length === 0 ? "SERVER_ONLY" : "MODEL_ASSISTED",
    provider: "LMStudioLLM",
    timestamp: new Date(),
  };
}

async function run() {
  const args = parseArguments(process.argv.slice(2));
  const allowedArguments = new Set([
    "worksheet",
    "systemPromptFile",
    "hybridSystemPromptFile",
    "controlFile",
    "controlMode",
    "output",
    "model",
    "modelTokenLimit",
    "maxAttemptsPerTarget",
  ]);
  const unknownArguments = Object.keys(args).filter(
    (argument) => !allowedArguments.has(argument)
  );
  if (unknownArguments.length)
    fail(`Unbekannte Argumente: ${unknownArguments.join(",")}`);
  const worksheetFile = path.resolve(args.worksheet || "");
  const systemPromptFile = path.resolve(args.systemPromptFile || "");
  const hybridSystemPromptFile = args.hybridSystemPromptFile
    ? path.resolve(args.hybridSystemPromptFile)
    : null;
  const controlFile = args.controlFile ? path.resolve(args.controlFile) : null;
  const controlMode = args.controlMode || "file";
  const outputDirectory = path.resolve(args.output || "");
  for (const [label, file] of [
    ["Worksheet", worksheetFile],
    ["Systemprompt", systemPromptFile],
    ...(hybridSystemPromptFile
      ? [["Hybrid-Systemprompt", hybridSystemPromptFile]]
      : []),
  ]) {
    if (!file || !fs.existsSync(file)) fail(`${label} fehlt: ${file}`);
  }
  if (!["file", "technical-review"].includes(controlMode))
    fail(`Ungültiger --controlMode: ${controlMode}`);
  if (controlMode === "file" && (!controlFile || !fs.existsSync(controlFile)))
    fail(`Kontrollen fehlen: ${controlFile}`);
  if (controlMode === "technical-review" && controlFile)
    fail(
      "--controlFile und --controlMode technical-review schließen einander aus"
    );
  if (!args.output) fail("--output ist erforderlich");

  fs.mkdirSync(outputDirectory, { recursive: true, mode: 0o700 });
  fs.chmodSync(outputDirectory, 0o700);
  process.env.LMSTUDIO_BASE_PATH =
    process.env.LMSTUDIO_BASE_PATH || "http://127.0.0.1:1234/v1";
  process.env.LMSTUDIO_MODEL_PREF =
    args.model || process.env.LMSTUDIO_MODEL_PREF || "qwen/qwen3.6-35b-a3b";
  process.env.LMSTUDIO_MODEL_TOKEN_LIMIT =
    args.modelTokenLimit || process.env.LMSTUDIO_MODEL_TOKEN_LIMIT || "42496";

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
  const hybridSystemPromptAddon = hybridSystemPromptFile
    ? fs.readFileSync(hybridSystemPromptFile, "utf8")
    : null;
  const hybridSystemPrompt = hybridSystemPromptAddon
    ? `${systemPrompt.trimEnd()}\n\n${hybridSystemPromptAddon.trim()}\n`
    : null;
  let controlSet = controlFile
    ? JSON.parse(fs.readFileSync(controlFile, "utf8"))
    : null;
  if (controlMode === "technical-review")
    controlSet = {
      schemaVersion: 1,
      controlSetId: `${String(
        worksheet.catalog?.categoryView || "category"
      ).toLowerCase()}-full-triage-technical-review-generated-v1`,
      reviewStatus: "REVIEW_REQUIRED",
      controls: [],
    };
  const controlReviewStatus = controlSet.reviewStatus || "NOT_DECLARED";
  if (
    !["NOT_DECLARED", "REVIEW_REQUIRED", "APPROVED"].includes(
      controlReviewStatus
    )
  )
    fail(`Ungültiger Control-Reviewstatus: ${controlReviewStatus}`);
  const payload = buildCandidateTriagePayload(worksheet);
  const hybridTargetCount = payload.bindingTargets.filter(
    (target) => target.hybridSemanticContract
  ).length;
  if (hybridTargetCount > 0 && !hybridSystemPrompt)
    fail(
      `Worksheet enthält ${hybridTargetCount} Hybrid-Ziele, aber --hybridSystemPromptFile fehlt`
    );
  const userPrompt = JSON.stringify(payload);
  const llm = new LMStudioLLM(null, process.env.LMSTUDIO_MODEL_PREF);
  const maxAttemptsPerTarget = Number(args.maxAttemptsPerTarget || 2);
  if (
    !Number.isInteger(maxAttemptsPerTarget) ||
    maxAttemptsPerTarget < 1 ||
    maxAttemptsPerTarget > 3
  )
    fail("--maxAttemptsPerTarget muss zwischen 1 und 3 liegen");
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
    let targetComplete = false;
    let previousError = null;
    for (let attempt = 1; attempt <= maxAttemptsPerTarget; attempt += 1) {
      const retryPayload = previousError
        ? {
            ...singlePayload,
            retryInstruction:
              "Die vorige Antwort war formal ungültig. Gib kein targetId-Feld aus, verwende nur die erlaubten Enumwerte und antworte erneut ausschließlich mit dem verlangten JSON-Objekt.",
            previousErrorCode: previousError.code,
          }
        : singlePayload;
      const messages = llm.constructPrompt({
        systemPrompt: target.hybridSemanticContract
          ? hybridSystemPrompt
          : systemPrompt,
        contextTexts: [],
        chatHistory: [],
        userPrompt: JSON.stringify(retryPayload),
      });
      const completion = await llm.getChatCompletion(messages, {
        temperature: 0,
        maxTokens: 128,
      });
      if (
        completion?.metrics?.responseModel !== process.env.LMSTUDIO_MODEL_PREF
      )
        fail(
          `Falsches LM-Studio-Chatmodell bei ${target.targetId}: erwartet ${process.env.LMSTUDIO_MODEL_PREF}, erhalten ${completion?.metrics?.responseModel || "NICHT_GEMELDET"}. Lauf sofort abgebrochen.`
        );
      calls.push({
        targetId: target.targetId,
        attempt,
        payloadSha256: sha256(JSON.stringify(retryPayload)),
        responseText: completion?.textResponse || "",
        metrics: completion?.metrics || null,
      });
      messageCalls.push({ targetId: target.targetId, attempt, messages });
      try {
        if (!completion?.textResponse) {
          const emptyError = new Error(
            `TRIAGE_EMPTY_RESPONSE: ${target.targetId}`
          );
          emptyError.code = "TRIAGE_EMPTY_RESPONSE";
          throw emptyError;
        }
        targetJudgements.push(
          parseAndValidateSingleBindingTarget({
            responseText: completion.textResponse,
            target,
          })
        );
        targetComplete = true;
        break;
      } catch (error) {
        previousError = {
          code: error.code || "UNKNOWN",
          message: error.message,
        };
      }
    }
    if (!targetComplete) {
      validationError = {
        ...previousError,
        targetId: target.targetId,
        attempts: maxAttemptsPerTarget,
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
      if (controlMode === "technical-review")
        controlSet.controls = materialized.map((candidate) => ({
          id: `technical-review:${candidate.candidateId}`,
          selector: { candidateId: candidate.candidateId },
          allowedBindings: [
            "DIRECT",
            "NARROW_SCOPE",
            "MENTION_ONLY",
            "UNRESOLVED",
          ],
        }));
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
      // A document can legitimately have no candidates for a category. The
      // generated technical-review control set is then empty by construction,
      // so there is nothing to evaluate and no model call is required.
      controls =
        controlMode === "technical-review" && materialized.length === 0
          ? []
          : evaluateCandidateTriageControls({ materialized, controlSet });
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
      hybridSystemPromptPath: hybridSystemPromptFile,
      hybridSystemPromptSha256: hybridSystemPromptFile
        ? sha256File(hybridSystemPromptFile)
        : null,
      controlPath: controlFile,
      controlSha256: controlFile
        ? sha256File(controlFile)
        : sha256(JSON.stringify(controlSet)),
      controlMode,
      materializedTriageSha256: materialized
        ? sha256File(
            path.join(outputDirectory, "materialized-triage.private.json")
          )
        : null,
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
      modelTargetCount: new Set(calls.map(({ targetId }) => targetId)).size,
      hybridTargetCount,
      modelAttemptCount: calls.length,
      candidateCount: payload.bindingTargets.reduce(
        (sum, target) => sum + target.candidateIds.length,
        0
      ),
      maxAttemptsPerTarget,
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
  if (!technicalPass) process.exitCode = 2;
}

run().catch((error) => fail(error.stack || error.message));

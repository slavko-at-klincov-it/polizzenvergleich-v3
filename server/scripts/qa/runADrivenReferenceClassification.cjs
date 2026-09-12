#!/usr/bin/env node

process.umask(0o077);

const crypto = require("crypto");
const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");
const { performance } = require("perf_hooks");
const { promisify } = require("util");
const { jsonrepair } = require("jsonrepair");
const { OpenAI } = require("openai");
const {
  A_CLASSIFICATION_CONTRACT_ID,
} = require("../../utils/policyAnalysis/aDrivenClassificationContract");
const {
  A_DYNAMIC_MANIFEST_CONTRACT_ID,
  A_SEMANTIC_SIGNAL_CONTRACT_ID,
  A_SEMANTIC_SIGNAL_CONTRACT_ID_V1,
  A_SEMANTIC_SIGNAL_CONTRACT_ID_V2,
  A_SEMANTIC_SIGNAL_CONTRACT_ID_V3,
  A_SEMANTIC_SIGNAL_CONTRACT_ID_V4,
  A_SEMANTIC_SIGNAL_CONTRACT_ID_V5,
  buildADrivenSemanticManifest,
  hasCoverageEffectEvidence,
} = require("../../utils/policyAnalysis/aDrivenSemanticManifest");
const {
  A_SOURCE_UNIT_PLAN_CONTRACT_ID,
  stableStringify,
} = require("../../utils/policyAnalysis/aDrivenSourceUnitPlan");

const RUN_CONTRACT_ID = "LF_A_BOUNDED_CLASSIFICATION_RUN_V29";
const RESUMABLE_PREDECESSOR_RUN_CONTRACT_IDS = new Set([
  "LF_A_BOUNDED_CLASSIFICATION_RUN_V12",
  "LF_A_BOUNDED_CLASSIFICATION_RUN_V13",
  "LF_A_BOUNDED_CLASSIFICATION_RUN_V14",
  "LF_A_BOUNDED_CLASSIFICATION_RUN_V15",
  "LF_A_BOUNDED_CLASSIFICATION_RUN_V16",
  "LF_A_BOUNDED_CLASSIFICATION_RUN_V17",
  "LF_A_BOUNDED_CLASSIFICATION_RUN_V18",
  "LF_A_BOUNDED_CLASSIFICATION_RUN_V19",
  "LF_A_BOUNDED_CLASSIFICATION_RUN_V20",
  "LF_A_BOUNDED_CLASSIFICATION_RUN_V21",
  "LF_A_BOUNDED_CLASSIFICATION_RUN_V22",
  "LF_A_BOUNDED_CLASSIFICATION_RUN_V23",
  "LF_A_BOUNDED_CLASSIFICATION_RUN_V24",
  "LF_A_BOUNDED_CLASSIFICATION_RUN_V25",
  "LF_A_BOUNDED_CLASSIFICATION_RUN_V26",
  "LF_A_BOUNDED_CLASSIFICATION_RUN_V27",
  "LF_A_BOUNDED_CLASSIFICATION_RUN_V28",
  RUN_CONTRACT_ID,
]);
const RESUMABLE_SEMANTIC_SIGNAL_CONTRACT_IDS = new Set([
  A_SEMANTIC_SIGNAL_CONTRACT_ID_V1,
  A_SEMANTIC_SIGNAL_CONTRACT_ID_V2,
  A_SEMANTIC_SIGNAL_CONTRACT_ID_V3,
  A_SEMANTIC_SIGNAL_CONTRACT_ID_V4,
  A_SEMANTIC_SIGNAL_CONTRACT_ID_V5,
  A_SEMANTIC_SIGNAL_CONTRACT_ID,
]);
const PROMPT_CONTRACT_ID = "LF_A_BOUNDED_CLASSIFICATION_PROMPT_V24";
const RESUMABLE_PREDECESSOR_PROMPT_CONTRACT_IDS = new Set([
  "LF_A_BOUNDED_CLASSIFICATION_PROMPT_V12",
  "LF_A_BOUNDED_CLASSIFICATION_PROMPT_V13",
  "LF_A_BOUNDED_CLASSIFICATION_PROMPT_V14",
  "LF_A_BOUNDED_CLASSIFICATION_PROMPT_V15",
  "LF_A_BOUNDED_CLASSIFICATION_PROMPT_V16",
  "LF_A_BOUNDED_CLASSIFICATION_PROMPT_V17",
  "LF_A_BOUNDED_CLASSIFICATION_PROMPT_V18",
  "LF_A_BOUNDED_CLASSIFICATION_PROMPT_V19",
  "LF_A_BOUNDED_CLASSIFICATION_PROMPT_V20",
  "LF_A_BOUNDED_CLASSIFICATION_PROMPT_V21",
  "LF_A_BOUNDED_CLASSIFICATION_PROMPT_V22",
  "LF_A_BOUNDED_CLASSIFICATION_PROMPT_V23",
  PROMPT_CONTRACT_ID,
]);
const DEFAULT_MODEL = "qwen/qwen3.6-35b-a3b";
const DEFAULT_CONTEXT = 42_496;
const DEFAULT_REQUEST_TIMEOUT_MS = 180_000;
const DEFAULT_ABORT_SETTLEMENT_TIMEOUT_MS = 15_000;
const DEFAULT_MODEL_RECOVERY_TIMEOUT_MS = 180_000;
const MAXIMUM_ATTEMPTS = 8;
const TRANSPORT_CONTRACT_ID = "LF_A_CLASSIFICATION_TRANSPORT_V1";
const CLASSIFICATION_EVIDENCE_CONTEXT_CONTRACT_ID =
  "LF_A_CLASSIFICATION_EVIDENCE_CONTEXT_V1";
const execFile = promisify(childProcess.execFile);

function fail(message) {
  console.error(`[lf-a-driven-classification] ${message}`);
  process.exit(1);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function argumentsFrom(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value)
      fail(`Ungültiges Argument: ${key || "-"}`);
    const name = key.slice(2);
    if (Object.hasOwn(values, name)) fail(`Doppeltes Argument: ${name}`);
    values[name] = value;
  }
  const allowed = new Set([
    "shadowRoot",
    "output",
    "model",
    "modelContext",
    "maximumAttempts",
    "requestTimeoutMs",
    "abortSettlementTimeoutMs",
    "modelRecoveryTimeoutMs",
    "lmStudioSdk",
    "qwenModelKey",
  ]);
  const unknown = Object.keys(values).filter((key) => !allowed.has(key));
  if (unknown.length) fail(`Unbekannte Argumente: ${unknown.join(",")}`);
  for (const required of ["shadowRoot", "output"])
    if (!values[required]) fail(`--${required} ist erforderlich`);
  const modelContext = Number(values.modelContext || DEFAULT_CONTEXT);
  const maximumAttempts = Number(values.maximumAttempts || 2);
  const requestTimeoutMs = Number(
    values.requestTimeoutMs || DEFAULT_REQUEST_TIMEOUT_MS
  );
  const abortSettlementTimeoutMs = Number(
    values.abortSettlementTimeoutMs || DEFAULT_ABORT_SETTLEMENT_TIMEOUT_MS
  );
  const modelRecoveryTimeoutMs = Number(
    values.modelRecoveryTimeoutMs || DEFAULT_MODEL_RECOVERY_TIMEOUT_MS
  );
  if (
    !Number.isInteger(modelContext) ||
    modelContext < 1_000 ||
    !Number.isInteger(maximumAttempts) ||
    maximumAttempts < 1 ||
    maximumAttempts > MAXIMUM_ATTEMPTS ||
    !Number.isInteger(requestTimeoutMs) ||
    requestTimeoutMs < 1 ||
    !Number.isInteger(abortSettlementTimeoutMs) ||
    abortSettlementTimeoutMs < 1 ||
    !Number.isInteger(modelRecoveryTimeoutMs) ||
    modelRecoveryTimeoutMs < 1
  )
    fail("Numerische Laufparameter sind ungültig");
  if (!values.lmStudioSdk || !values.qwenModelKey)
    fail(
      "--lmStudioSdk und --qwenModelKey sind für sichere Timeouts erforderlich"
    );
  return {
    shadowRoot: path.resolve(values.shadowRoot),
    output: path.resolve(values.output),
    model: values.model || DEFAULT_MODEL,
    modelContext,
    maximumAttempts,
    requestTimeoutMs,
    abortSettlementTimeoutMs,
    modelRecoveryTimeoutMs,
    lmStudioSdk: path.resolve(values.lmStudioSdk),
    qwenModelKey: values.qwenModelKey,
  };
}

function readJson(file, code) {
  let stat;
  try {
    stat = fs.lstatSync(file);
  } catch {
    throw new Error(`${code}_MISSING`);
  }
  if (!stat.isFile() || stat.isSymbolicLink())
    throw new Error(`${code}_INVALID`);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    throw new Error(`${code}_INVALID`);
  }
}

function writePrivateJson(file, value) {
  if (fs.existsSync(file))
    throw new Error(`LF_A_CLASSIFICATION_OUTPUT_EXISTS:${file}`);
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.renameSync(temporary, file);
  fs.chmodSync(file, 0o600);
}

function batchResultFile(output, batch) {
  return path.join(
    output,
    "batches",
    `${String(batch.batchIndex).padStart(4, "0")}-${batch.batchId}.private.json`
  );
}

function errorClass(error) {
  if (typeof error?.errorClass === "string") return error.errorClass;
  if (error?.name === "AbortError") return "MODEL_REQUEST_ABORTED";
  return "MODEL_RESPONSE_INVALID";
}

function timeoutRetryPartition(batch) {
  if (!Array.isArray(batch?.units) || batch.units.length < 2) return null;
  const weights = batch.units.map((unit) =>
    Math.max(
      1,
      (unit.sourceBlocks || []).reduce(
        (sum, block) => sum + String(block.exactText || "").length,
        0
      )
    )
  );
  const total = weights.reduce((sum, value) => sum + value, 0);
  let left = 0;
  let splitIndex = 1;
  let bestDifference = Number.POSITIVE_INFINITY;
  for (let index = 1; index < weights.length; index += 1) {
    left += weights[index - 1];
    const difference = Math.abs(left - (total - left));
    if (difference < bestDifference) {
      bestDifference = difference;
      splitIndex = index;
    }
  }
  const retryUnits = batch.units.slice(0, splitIndex);
  const deferredUnits = batch.units.slice(splitIndex);
  return {
    strategy: "CONTIGUOUS_CHARACTER_BALANCED_SPLIT",
    retryUnitIds: retryUnits.map(({ unitId }) => unitId),
    deferredUnitIds: deferredUnits.map(({ unitId }) => unitId),
    retryUnits,
  };
}

async function waitForSettlement(promise, timeoutMs) {
  let timeoutId;
  try {
    return await Promise.race([
      promise.then(
        () => true,
        () => true
      ),
      new Promise((resolve) => {
        timeoutId = setTimeout(() => resolve(false), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function requestCompletionWithTimeout({
  client,
  payload,
  requestTimeoutMs,
  abortSettlementTimeoutMs,
  recoverModelAfterAbort,
}) {
  const controller = new AbortController();
  let timeoutId;
  let timedOut = false;
  const request = Promise.resolve().then(() =>
    client.chat.completions.create(payload, {
      signal: controller.signal,
      timeout: requestTimeoutMs + abortSettlementTimeoutMs + 1_000,
      maxRetries: 0,
    })
  );
  request.catch(() => {});
  try {
    return await Promise.race([
      request,
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          timedOut = true;
          const timeoutError = new Error(
            `LF_A_CLASSIFICATION_MODEL_REQUEST_TIMEOUT:${requestTimeoutMs}`
          );
          timeoutError.errorClass = "MODEL_REQUEST_TIMEOUT";
          reject(timeoutError);
        }, requestTimeoutMs);
      }),
    ]);
  } catch (error) {
    if (!timedOut) throw error;
    controller.abort(error);
    const settlementStarted = performance.now();
    const requestSettledAfterAbort = await waitForSettlement(
      request,
      abortSettlementTimeoutMs
    );
    const settlementDurationMs = Math.round(
      performance.now() - settlementStarted
    );
    let recovery;
    try {
      recovery = await recoverModelAfterAbort({
        requestSettledAfterAbort,
      });
    } catch (recoveryError) {
      const unsafe = new Error(
        `LF_A_CLASSIFICATION_MODEL_SAFE_RECOVERY_FAILED:${recoveryError.message}`
      );
      unsafe.errorClass = "MODEL_SAFE_RECOVERY_FAILED";
      unsafe.retrySafe = false;
      unsafe.telemetry = {
        timedOut: true,
        timeoutMs: requestTimeoutMs,
        abortTriggered: true,
        requestSettledAfterAbort,
        settlementDurationMs,
        recovery: {
          status: "FAILED",
          error: recoveryError.message,
        },
      };
      throw unsafe;
    }
    error.retrySafe = true;
    error.telemetry = {
      timedOut: true,
      timeoutMs: requestTimeoutMs,
      abortTriggered: true,
      requestSettledAfterAbort,
      settlementDurationMs,
      recovery,
    };
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function parseJsonArray(modelText) {
  const normalized = String(modelText || "")
    .replace(/<think>[\s\S]*?<\/think>/giu, "")
    .trim();
  const start = normalized.indexOf("[");
  if (start < 0)
    throw new Error("LF_A_CLASSIFICATION_RESPONSE_JSON_ARRAY_MISSING");
  const end = normalized.lastIndexOf("]");
  const candidate = normalized.slice(start, end >= start ? end + 1 : undefined);
  let parsed;
  let syntaxRepair = null;
  try {
    parsed = JSON.parse(candidate);
  } catch (strictError) {
    let repaired = candidate.replace(
      /\]\}\s*,\s*(?=\{\s*"displayLabel"\s*:)/gu,
      ","
    );
    const withoutRepeatedOwnerClosures = repaired.replace(
      /(\]\})\}\s*,\s*(?=\{\s*"displayLabel"\s*:)/gu,
      "$1,"
    );
    const strategy =
      withoutRepeatedOwnerClosures === repaired
        ? "PREMATURE_REQUIREMENTS_ARRAY_CLOSE"
        : "PREMATURE_REQUIREMENTS_ARRAY_CLOSE_AND_REPEATED_OWNER_CLOSE";
    repaired = withoutRepeatedOwnerClosures;
    try {
      if (repaired === candidate) throw strictError;
      parsed = JSON.parse(repaired);
    } catch {
      repaired = jsonrepair(candidate);
      parsed = JSON.parse(repaired);
      syntaxRepair = {
        applied: true,
        strategy: "JSONREPAIR",
        originalError: strictError.message,
        originalResponseSha256: sha256(candidate),
        repairedResponseSha256: sha256(repaired),
      };
    }
    syntaxRepair ||= {
      applied: true,
      strategy,
      originalError: strictError.message,
      originalResponseSha256: sha256(candidate),
      repairedResponseSha256: sha256(repaired),
    };
  }
  if (!Array.isArray(parsed))
    throw new Error("LF_A_CLASSIFICATION_RESPONSE_NOT_ARRAY");
  return { responses: parsed, syntaxRepair };
}

function mergeCompatibleDuplicateUnitResponses(responses) {
  const grouped = new Map();
  for (const response of responses) {
    const records = grouped.get(response?.unitId) || [];
    records.push(response);
    grouped.set(response?.unitId, records);
  }
  const mergedUnitIds = [];
  const emitted = new Set();
  const normalized = [];
  for (const response of responses) {
    const unitId = response?.unitId;
    if (emitted.has(unitId)) continue;
    const records = grouped.get(unitId) || [];
    const compatible =
      records.length > 1 &&
      records.every(
        (record) =>
          record?.primaryClass === records[0]?.primaryClass &&
          stableStringify(record?.semanticClasses) ===
            stableStringify(records[0]?.semanticClasses) &&
          Array.isArray(record?.requirements)
      );
    if (!compatible) {
      normalized.push(...records);
      emitted.add(unitId);
      continue;
    }
    normalized.push({
      ...records[0],
      requirements: records.flatMap(({ requirements }) => requirements),
    });
    mergedUnitIds.push(unitId);
    emitted.add(unitId);
  }
  return {
    responses: normalized,
    envelopeRepair: mergedUnitIds.length
      ? {
          applied: true,
          strategy: "COMPATIBLE_DUPLICATE_UNIT_ENVELOPES",
          mergedUnitIds,
        }
      : null,
  };
}

function attachTopLevelRequirementFragments(responses, expectedUnitIds) {
  if (expectedUnitIds.length !== 1) return { responses, envelopeRepair: null };
  const expectedUnitId = expectedUnitIds[0];
  const owners = responses.filter(
    (response) => response?.unitId === expectedUnitId
  );
  const fragments = responses.filter((response) => !response?.unitId);
  const fragmentsAreUnambiguous = fragments.every(
    (fragment) =>
      fragment &&
      typeof fragment === "object" &&
      !Array.isArray(fragment) &&
      typeof fragment.displayLabel === "string" &&
      fragment.displayLabel.trim().length > 0 &&
      Array.isArray(fragment.components) &&
      fragment.components.length > 0 &&
      Object.keys(fragment).every((key) =>
        ["displayLabel", "components"].includes(key)
      )
  );
  if (
    owners.length !== 1 ||
    fragments.length === 0 ||
    responses.length !== owners.length + fragments.length ||
    !Array.isArray(owners[0].requirements) ||
    !fragmentsAreUnambiguous
  )
    return { responses, envelopeRepair: null };
  return {
    responses: [
      {
        ...owners[0],
        requirements: [...owners[0].requirements, ...fragments],
      },
    ],
    envelopeRepair: {
      applied: true,
      strategy: "ATTACH_UNAMBIGUOUS_TOP_LEVEL_REQUIREMENT_FRAGMENTS",
      unitId: expectedUnitId,
      attachedRequirements: fragments.length,
    },
  };
}

function listSegmentRepairSkeletons(batch, diagnostics) {
  const requested = new Map(
    diagnostics.flatMap(({ code, unitId, segmentId, segmentIds }) => {
      if (!unitId) return [];
      if (code === "LIST_CONTINUATION_SEGMENT_SPLIT" && segmentId)
        return [[`${unitId}:${segmentId}`, true]];
      if (code === "LIST_SOURCE_SEGMENTS_MERGED" && Array.isArray(segmentIds))
        return segmentIds.map((id) => [`${unitId}:${id}`, true]);
      return [];
    })
  );
  return batch.units.flatMap((unit) =>
    (unit.logicalSourceSegments || [])
      .filter(({ segmentId }) => requested.has(`${unit.unitId}:${segmentId}`))
      .map(({ segmentId, combinedText, blockIds }) => ({
        unitId: unit.unitId,
        segmentId,
        exactDisplayLabel: combinedText,
        requiredBlockIds: blockIds,
      }))
  );
}

function normalizationEvidenceBlocks(unit) {
  return [
    ...(unit?.source?.blocks || []),
    ...(unit?.governingContext?.blocks || []),
  ].filter(
    (block, index, blocks) =>
      blocks.findIndex(({ blockId }) => blockId === block.blockId) === index
  );
}

function exactConditionLabel(unit, component) {
  if (
    component?.type !== "CONDITION" ||
    !Array.isArray(component.sourceBlockIds) ||
    component.sourceBlockIds.length === 0
  )
    return null;
  const selectedIds = new Set(component.sourceBlockIds);
  const selectedBlocks = normalizationEvidenceBlocks(unit).filter(
    ({ blockId }) => selectedIds.has(blockId)
  );
  if (selectedBlocks.length !== selectedIds.size) return null;
  const declaredSourceText = selectedBlocks
    .map(({ exactText }) => exactText)
    .join("\n")
    .trim();
  const marker =
    /\b(?:sofern|wenn|falls|vorausgesetzt|soweit)\b|\bunter\s+der\s+voraussetzung\b/iu.exec(
      declaredSourceText
    );
  if (!marker) return null;
  const normalizedSource = declaredSourceText.replace(/\s+/gu, " ").trim();
  const normalizedLabel = String(component.label || "")
    .replace(/\s+/gu, " ")
    .trim();
  if (!normalizedLabel || normalizedSource.includes(normalizedLabel))
    return null;
  if (
    !/\b(?:sofern|wenn|falls|vorausgesetzt|soweit|dass)\b/iu.test(
      normalizedLabel
    )
  )
    return null;
  return declaredSourceText.slice(marker.index).trim();
}

function completeComponentSourceBlockIds(unit, component) {
  if (
    !Array.isArray(component?.sourceBlockIds) ||
    component.sourceBlockIds.length === 0
  )
    return null;
  const blocks = normalizationEvidenceBlocks(unit);
  const declaredIds = new Set(component.sourceBlockIds);
  if (
    blocks.length === 0 ||
    [...declaredIds].some(
      (blockId) => !blocks.some((block) => block.blockId === blockId)
    )
  )
    return null;
  const normalize = (value) =>
    String(value || "")
      .replace(/\s+/gu, " ")
      .trim();
  const label = normalize(component.label);
  if (!label) return null;
  const declaredText = normalize(
    blocks
      .filter(({ blockId }) => declaredIds.has(blockId))
      .map(({ exactText }) => exactText)
      .join("\n")
  );
  if (declaredText.includes(label)) return null;
  const candidates = [];
  for (let start = 0; start < blocks.length; start += 1) {
    for (let end = start; end < blocks.length; end += 1) {
      const selected = blocks.slice(start, end + 1);
      const selectedIds = selected.map(({ blockId }) => blockId);
      if (![...declaredIds].every((blockId) => selectedIds.includes(blockId)))
        continue;
      if (
        !normalize(
          selected.map(({ exactText }) => exactText).join("\n")
        ).includes(label)
      )
        continue;
      candidates.push(selectedIds);
    }
  }
  if (candidates.length === 0) return null;
  const minimumLength = Math.min(...candidates.map(({ length }) => length));
  const minimal = candidates.filter(({ length }) => length === minimumLength);
  const unique = [
    ...new Map(
      minimal.map((blockIds) => [stableStringify(blockIds), blockIds])
    ).values(),
  ];
  if (unique.length !== 1 || unique[0].length === declaredIds.size) return null;
  return unique[0];
}

function explicitCoverageEffectRepair(unit, component) {
  if (
    component?.type !== "COVERAGE_EFFECT" ||
    !Array.isArray(component.sourceBlockIds) ||
    component.sourceBlockIds.length === 0
  )
    return null;
  const selectedIds = new Set(component.sourceBlockIds);
  const blocks = normalizationEvidenceBlocks(unit).filter(({ blockId }) =>
    selectedIds.has(blockId)
  );
  if (blocks.length !== selectedIds.size) return null;
  const sourceText = blocks.map(({ exactText }) => exactText).join("\n");
  const negative =
    /\b(?:ausgeschlossen|ausgenommen(?:\s+sind)?|exklusive|nicht\s+(?:mit)?versichert|kein(?:e[snmr]?)?\s+(?:Deckung|Versicherungsschutz))\b/iu.exec(
      sourceText
    );
  const positive =
    /\b(?:zusätzlich\s+)?(?:mit)?versichert(?:e[snmr]?)?(?:\s+sind)?\b/iu.exec(
      sourceText
    );
  if ((negative && positive) || (!negative && !positive)) return null;
  const evidence = negative || positive;
  const coverageEffect = negative ? "EXCLUDED" : "INCLUDED";
  const normalizedSource = sourceText.replace(/\s+/gu, " ").trim();
  const normalizedLabel = String(component.label || "")
    .replace(/\s+/gu, " ")
    .trim();
  if (
    component.coverageEffect === coverageEffect &&
    normalizedSource.includes(normalizedLabel)
  )
    return null;
  return { label: evidence[0], coverageEffect };
}

function explicitScopeRoleRepair(component, { allowObject = false } = {}) {
  if (
    component?.type !== "FACT_ROLE" &&
    !(allowObject && component?.type === "OBJECT")
  )
    return null;
  if (
    !/^\s*(?:(?:mit|unter)\s+(?:der\s+)?Variante\b|(?:in|für)\s+(?:den|die|allen)\s+(?:jeweils\s+)?(?:beantragten|vereinbarten|gewählten)\s+Sparten\b)/iu.test(
      String(component.label || "")
    )
  )
    return null;
  return { ...component, type: "SCOPE" };
}

function splitProductConfigurationScopeRoles(component) {
  if (component?.type !== "FACT_ROLE" && component?.type !== "OBJECT")
    return null;
  const label = String(component.label || "");
  const starts = [
    ...label.matchAll(
      /\b(?:(?:mit|unter)\s+(?:der\s+)?Variante\b|(?:in|für)\s+(?:den|die|allen)\s+(?:jeweils\s+)?(?:beantragten|vereinbarten|gewählten)\s+Sparten\b)/giu
    ),
  ].map(({ index }) => index);
  if (starts.length === 0) return null;
  const components = [];
  const prefix = label.slice(0, starts[0]).trim();
  if (prefix) components.push({ ...component, label: prefix });
  for (let index = 0; index < starts.length; index += 1) {
    const scope = label
      .slice(starts[index], starts[index + 1] ?? label.length)
      .trim();
    if (scope) components.push({ ...component, type: "SCOPE", label: scope });
  }
  return components.some(({ type }) => type === "SCOPE") ? components : null;
}

function sourceBlockIdsForExactSpan(unit, exactSpan) {
  const sourceText = String(unit?.source?.combinedText || "");
  const blocks = unit?.source?.blocks || [];
  const start = sourceText.indexOf(exactSpan);
  if (start < 0 || !exactSpan || blocks.length === 0) return [];
  const end = start + exactSpan.length;
  let blockStart = 0;
  return blocks.flatMap((block, index) => {
    const blockEnd = blockStart + String(block.exactText || "").length;
    const overlaps = blockEnd > start && blockStart < end;
    const result = overlaps ? [block.blockId] : [];
    blockStart = blockEnd + (index < blocks.length - 1 ? 1 : 0);
    return result;
  });
}

function normalizeProductConfigurationFactRelation(components, unit) {
  const sourceText = String(unit?.source?.combinedText || "");
  const definitionStart = /\b(?:Grund|Basis)deckung\b/iu.exec(sourceText);
  const scopeStart =
    /\b(?:(?:mit|unter)\s+(?:der\s+)?Variante\b|(?:in|für)\s+(?:den|die|allen)\s+(?:jeweils\s+)?(?:beantragten|vereinbarten|gewählten)\s+Sparten\b)/iu.exec(
      sourceText
    );
  if (
    !definitionStart ||
    !scopeStart ||
    scopeStart.index <= definitionStart.index
  )
    return { components, mergedFactRoles: 0 };
  const relation = sourceText
    .slice(definitionStart.index, scopeStart.index)
    .trim();
  const copulas = relation.match(/\b(?:ist|sind)\b/giu) || [];
  if (
    copulas.length !== 1 ||
    /[;!?]/u.test(relation) ||
    !/\b(?:Produkt|Tarif|Versicherung)\b/iu.test(relation)
  )
    return { components, mergedFactRoles: 0 };
  const comparableRelation = relation.replace(/\s+/gu, " ").trim();
  const factRoleIndexes = components.flatMap((component, index) => {
    const comparableLabel = String(component?.label || "")
      .replace(/\s+/gu, " ")
      .trim();
    return component?.type === "FACT_ROLE" &&
      comparableLabel &&
      comparableRelation.includes(comparableLabel)
      ? [index]
      : [];
  });
  if (factRoleIndexes.length < 2) return { components, mergedFactRoles: 0 };
  const sourceBlockIds = sourceBlockIdsForExactSpan(unit, relation);
  if (sourceBlockIds.length === 0) return { components, mergedFactRoles: 0 };
  const firstIndex = factRoleIndexes[0];
  const mergedIndexes = new Set(factRoleIndexes);
  return {
    components: components.flatMap((component, index) => {
      if (index === firstIndex)
        return [{ type: "FACT_ROLE", label: relation, sourceBlockIds }];
      return mergedIndexes.has(index) ? [] : [component];
    }),
    mergedFactRoles: factRoleIndexes.length,
  };
}

function moreFavorableCoveragePrecedence(unit) {
  const sourceText = String(unit?.source?.combinedText || "");
  const relation =
    /^\s*(?:Es\s+)?(?:gilt|gelten|kommt|kommen)\b(?<middle>[\s\S]{0,240}?)\b(?<precedence>(?:bessere|günstigere|weitergehende)\s+(?:Deckung|Regelung|Leistung))\b(?:\s+zur\s+Anwendung)?[.!]?\s*$/iu.exec(
      sourceText
    );
  if (!relation || /\b(?:nicht|kein(?:e[snmr]?)?)\b/iu.test(relation[0]))
    return null;
  const sourceBlockIds = [...(unit?.source?.blockIds || [])];
  if (sourceBlockIds.length === 0) return null;
  const components = [];
  const scopePatterns = [
    /\bfür\s+(?:den|die)\s+Versicherungsnehmer(?:in|innen)?\b/iu,
    /\b(?:im|pro|je)\s+(?:jeweiligen\s+)?(?:Schadensfall|Versicherungsfall|Kollisionsfall)\b/iu,
  ];
  for (const pattern of scopePatterns) {
    const match = pattern.exec(sourceText);
    if (match)
      components.push({
        sourceTextOrder: match.index,
        type: "SCOPE",
        label: match[0],
        sourceBlockIds,
      });
  }
  const precedenceIndex = sourceText.indexOf(relation.groups.precedence);
  components.push({
    sourceTextOrder: precedenceIndex,
    type: "PRECEDENCE_OR_REPLACEMENT",
    label: relation.groups.precedence,
    sourceBlockIds,
  });
  return {
    displayLabel: sourceText.trim(),
    components: components
      .sort((left, right) => left.sourceTextOrder - right.sourceTextOrder)
      .map(({ sourceTextOrder: _sourceTextOrder, ...component }) => component),
  };
}

function normalizeConditionalMembershipObjects(requirements, unit) {
  const sourceText = String(unit?.source?.combinedText || "");
  const sourceBlocks = unit?.source?.blocks || [];
  if (!Array.isArray(unit?.source?.blockIds) || sourceBlocks.length === 0)
    return { requirements, repairs: [] };
  const roleOrActionPattern =
    /\b(?:Versicherungsnehmer|Gebäudeeigentümer|Eigentümer|Mieter|Pächter)\p{L}*\b|\b(?:Wiederbeschaffung|Wiederherstellung|Reparatur|Ersatzleistung)\p{L}*\b/iu;
  const repairs = [];
  const normalizedRequirements = requirements.map(
    (requirement, requirementIndex) => {
      const displayLabel = String(requirement?.displayLabel || "");
      const conditionMarker =
        /\b(?:sofern|wenn|falls|vorausgesetzt|soweit)\b|\bunter\s+der\s+Voraussetzung\b/iu.exec(
          displayLabel
        );
      const components = Array.isArray(requirement?.components)
        ? requirement.components
        : [];
      if (!conditionMarker || components.length === 0) return requirement;
      const conditionLabel = displayLabel.slice(conditionMarker.index).trim();
      const normalizedCondition = conditionLabel.replace(/\s+/gu, " ").trim();
      const conditionStart = sourceText.indexOf(conditionLabel);
      if (conditionStart < 0) return requirement;
      const conditionEnd = conditionStart + conditionLabel.length;
      let blockStart = 0;
      const conditionSourceBlockIds = sourceBlocks.flatMap((block, index) => {
        const blockEnd = blockStart + String(block.exactText || "").length;
        const overlaps = blockEnd > conditionStart && blockStart < conditionEnd;
        const result = overlaps ? [block.blockId] : [];
        blockStart = blockEnd + (index < sourceBlocks.length - 1 ? 1 : 0);
        return result;
      });
      if (conditionSourceBlockIds.length === 0) return requirement;
      const hasObjectOutsideCondition = components.some((component) => {
        if (component?.type !== "OBJECT") return false;
        const label = String(component.label || "")
          .replace(/\s+/gu, " ")
          .trim();
        return label && !normalizedCondition.includes(label);
      });
      const rejected = components.filter((component) => {
        if (component?.type !== "OBJECT") return false;
        const label = String(component.label || "")
          .replace(/\s+/gu, " ")
          .trim();
        return (
          label &&
          normalizedCondition.includes(label) &&
          (hasObjectOutsideCondition || roleOrActionPattern.test(label))
        );
      });
      if (rejected.length === 0) return requirement;
      const retained = components.filter(
        (component) => !rejected.includes(component)
      );
      if (!retained.some(({ type }) => type === "CONDITION"))
        retained.push({
          type: "CONDITION",
          label: conditionLabel,
          sourceBlockIds: conditionSourceBlockIds,
        });
      repairs.push({
        requirementIndex,
        removedObjectComponents: rejected.length,
        removedLabels: rejected.map(({ label }) => label),
      });
      return { ...requirement, components: retained };
    }
  );
  return { requirements: normalizedRequirements, repairs };
}

function normalizeCoverageBranchScheduleComponents(requirements, unit) {
  const sourceText = String(unit?.source?.combinedText || "");
  if (
    hasCoverageEffectEvidence(unit) ||
    !/\bSparte(?:n)?\b/iu.test(sourceText) ||
    !/\bVariante(?:n)?\b/iu.test(sourceText)
  )
    return { requirements, repairs: [] };
  const repairs = [];
  const normalizedRequirements = requirements.map(
    (requirement, requirementIndex) => {
      const components = Array.isArray(requirement?.components)
        ? requirement.components
        : [];
      const hasExplicitBranchScope = components.some(
        (component) =>
          component?.type === "SCOPE" &&
          /\b(?:Sparte|Variante)(?:n)?\b/iu.test(String(component.label || ""))
      );
      if (!hasExplicitBranchScope) return requirement;
      const normalizedComponents = components.flatMap(
        (component, componentIndex) => {
          if (component?.type !== "OBJECT") return [component];
          const label = String(component.label || "");
          const branchLabels = label
            .split(/\s*,\s*/u)
            .map((value) => value.trim())
            .filter(Boolean);
          if (
            branchLabels.length < 2 ||
            branchLabels.some(
              (value) =>
                value.length > 120 ||
                /\b(?:ist|sind|wird|werden|gilt|gelten|besteht|bestehen|hat|haben|muss|müssen|kann|können|darf|dürfen)\b/iu.test(
                  value
                )
            )
          )
            return [component];
          repairs.push({
            requirementIndex,
            componentIndex,
            action: "SPLIT_COVERAGE_BRANCH_SCHEDULE_SCOPE",
            fromType: "OBJECT",
            components: branchLabels.length,
          });
          return branchLabels.map((branchLabel) => ({
            ...component,
            type: "SCOPE",
            label: branchLabel,
          }));
        }
      );
      return { ...requirement, components: normalizedComponents };
    }
  );
  return { requirements: normalizedRequirements, repairs };
}

function normalizePureQuantifiedLimitObjectComponents(requirements) {
  const repairs = [];
  const normalizedRequirements = requirements.map(
    (requirement, requirementIndex) => ({
      ...requirement,
      components: (requirement.components || []).flatMap(
        (component, componentIndex) => {
          if (component?.type !== "OBJECT") return [component];
          const match =
            /^\s*[•▪\-–—]?\s*(?<value>(?:bis\s+(?:zu\s+)?(?:jeweils\s+)?|höchstens\s+|maximal\s+|max\.\s+)?(?:(?<currency>€|EUR|Euro)\s*)?(?<raw>[0-9lI]+(?:[.,][0-9lI]+)?)\s*(?<unit>%|€|EUR|Euro)?)(?:\s+)(?<basis>(?:(?:der\s+)?(?:Gebäude(?:gesamt)?versicherungssumme|Versicherungssumme)(?:\s+auf\s+[„“”"',]*\s*Erstes\s+Risiko[„“”"',]*)?|auf\s+[„“”"',]*\s*Erstes\s+Risiko[„“”"',]*))\s*[.;]?\s*$/iu.exec(
              String(component.label || "")
            );
          if (!match?.groups?.value || !match.groups.raw || !match.groups.basis)
            return [component];
          const unit = match.groups.unit || match.groups.currency || null;
          repairs.push({
            requirementIndex,
            componentIndex,
            action: "NORMALIZE_PURE_QUANTIFIED_LIMIT_OBJECT",
            fromType: "OBJECT",
            toTypes: ["VALUE_AND_UNIT", "LIMIT_BASIS"],
          });
          return [
            {
              type: "VALUE_AND_UNIT",
              label: match.groups.value,
              rawValue: match.groups.raw,
              ...(unit ? { unit } : {}),
              sourceBlockIds: component.sourceBlockIds,
            },
            {
              type: "LIMIT_BASIS",
              label: match.groups.basis,
              sourceBlockIds: component.sourceBlockIds,
            },
          ];
        }
      ),
    })
  );
  return { requirements: normalizedRequirements, repairs };
}

function coverageBranchGovernor(unit) {
  const evidenceSources = [unit?.source, unit?.governingContext].filter(
    (source) => source?.combinedText && Array.isArray(source?.blocks)
  );
  for (const source of evidenceSources) {
    const sourceText = String(source.combinedText || "");
    const fixedBasisMatch =
      /\bim\s+Rahmen\s+der\s+(?<branches>[\s\S]{1,240}?)\s+(?<limit>bis\s+zur\s+Höhe\s+der\s+(?:Gebäude(?:gesamt)?versicherungssumme|Versicherungssumme))\s+(?<effect>(?:mit)?versichert)\b/iu.exec(
        sourceText
      );
    const quantifiedMatch =
      /\bim\s+Rahmen\s+der\s+(?<branches>[\s\S]{1,240}?)\s+(?:(?:ist|sind)\s+)?(?<effect>(?:mit)?versichert)\s+(?<value>bis\s+(?:zu\s+)?(?:jeweils\s+)?(?<raw>[0-9lI]+(?:[.,][0-9lI]+)?)\s*(?<unit>%|€|EUR|Euro))\s+(?<basis>der\s+(?:Gebäude(?:gesamt)?versicherungssumme|Versicherungssumme)(?:\s+auf\s+[„“”"',]*\s*Erstes\s+Risiko[„“”"',]*)?)/iu.exec(
        sourceText
      );
    const match = fixedBasisMatch || quantifiedMatch;
    const limitLabel = fixedBasisMatch?.groups?.limit;
    const basisLabel = quantifiedMatch?.groups?.basis;
    if (!match?.groups?.branches || (!limitLabel && !basisLabel)) continue;
    const branches = match.groups.branches
      .split(/\s*(?:,|\/)\s*|\s+und\s+/iu)
      .map((label) => label.trim())
      .filter((label) => label && label.length <= 120 && /\p{L}/u.test(label));
    if (branches.length < 2 || !/versicherung\s*$/iu.test(branches.at(-1)))
      continue;
    const evidenceUnit = { source };
    const components = [
      ...branches.map((label) => ({
        type: "SCOPE",
        label,
        sourceBlockIds: sourceBlockIdsForExactSpan(evidenceUnit, label),
      })),
      ...(quantifiedMatch
        ? [
            {
              type: "VALUE_AND_UNIT",
              label: quantifiedMatch.groups.value,
              rawValue: quantifiedMatch.groups.raw,
              unit: quantifiedMatch.groups.unit,
              sourceBlockIds: sourceBlockIdsForExactSpan(
                evidenceUnit,
                quantifiedMatch.groups.value
              ),
            },
          ]
        : []),
      {
        type: "LIMIT_BASIS",
        label: limitLabel || basisLabel,
        sourceBlockIds: sourceBlockIdsForExactSpan(
          evidenceUnit,
          limitLabel || basisLabel
        ),
      },
    ];
    if (components.some(({ sourceBlockIds }) => sourceBlockIds.length === 0))
      continue;
    return { source, branchesText: match.groups.branches, components };
  }
  return null;
}

function normalizeCoverageBranchGovernorComponents(requirements, unit) {
  const governor = coverageBranchGovernor(unit);
  if (!governor) return { requirements, repairs: [] };
  const governorBlockIds = new Set(
    governor.components.flatMap(({ sourceBlockIds }) => sourceBlockIds)
  );
  const normalizedGovernorBranches = governor.branchesText
    .replace(/\s+/gu, " ")
    .trim();
  const normalizedComponentLabel = (component) =>
    String(component?.label || "")
      .replace(/\s+/gu, " ")
      .trim();
  const repairs = [];
  const normalizedRequirements = requirements.map(
    (requirement, requirementIndex) => {
      let removedObjectComponents = 0;
      let removedScopeComponents = 0;
      let removedEquivalentGovernorComponents = 0;
      const retained = (requirement.components || []).filter((component) => {
        const label = String(component.label || "");
        const normalizedLabel = normalizedComponentLabel(component);
        const usesGovernor = (component.sourceBlockIds || []).some((blockId) =>
          governorBlockIds.has(blockId)
        );
        if (!usesGovernor) return true;
        const matchesGovernorBranches =
          normalizedLabel &&
          (normalizedGovernorBranches.includes(normalizedLabel) ||
            normalizedLabel.includes(normalizedGovernorBranches));
        if (
          component?.type === "OBJECT" &&
          /versicherung\b/iu.test(label) &&
          (matchesGovernorBranches ||
            /\b(?:Versicherungssumme|bis\s+zur\s+Höhe)\b/iu.test(label))
        ) {
          removedObjectComponents += 1;
          return false;
        }
        if (component?.type === "SCOPE" && matchesGovernorBranches) {
          removedScopeComponents += 1;
          return false;
        }
        const matchesCanonicalGovernorRole = governor.components.some(
          (governorComponent) =>
            governorComponent.type === component?.type &&
            normalizedComponentLabel(governorComponent) === normalizedLabel
        );
        if (
          matchesCanonicalGovernorRole &&
          ["VALUE_AND_UNIT", "LIMIT_BASIS"].includes(component?.type)
        ) {
          removedEquivalentGovernorComponents += 1;
          return false;
        }
        return true;
      });
      const existing = new Set(
        retained.map(({ type, label }) =>
          stableStringify({
            type,
            label: String(label || "")
              .replace(/\s+/gu, " ")
              .trim(),
          })
        )
      );
      const additions = governor.components.filter(
        ({ type, label }) =>
          !existing.has(
            stableStringify({
              type,
              label: String(label || "")
                .replace(/\s+/gu, " ")
                .trim(),
            })
          )
      );
      if (
        additions.length === 0 &&
        retained.length === requirement.components.length
      )
        return requirement;
      repairs.push({
        requirementIndex,
        action: "NORMALIZE_COVERAGE_BRANCH_GOVERNOR_ROLES",
        scopes: governor.components.filter(({ type }) => type === "SCOPE")
          .length,
        removedObjectComponents,
        ...(removedScopeComponents > 0 ? { removedScopeComponents } : {}),
        ...(removedEquivalentGovernorComponents > 0
          ? { removedEquivalentGovernorComponents }
          : {}),
      });
      return { ...requirement, components: [...retained, ...additions] };
    }
  );
  return { requirements: normalizedRequirements, repairs };
}

function normalizeNonPhysicalCostObjectComponents(requirements) {
  const repairs = [];
  const normalizedRequirements = requirements.map(
    (requirement, requirementIndex) => ({
      ...requirement,
      components: (requirement.components || []).map(
        (component, componentIndex) => {
          if (component?.type !== "OBJECT") return component;
          const label = String(component.label || "");
          const startsWithCostRole =
            /^\s*[-•]?\s*(?:(?:der|die|das)\s+)?(?:(?:tatsächlich(?:e|en|er|es)?|zusätzlich(?:e|en|er|es)?|notwendig(?:e|en|er|es)?|erforderlich(?:e|en|er|es)?)\s+)?(?:\p{L}*kosten|Miet(?:verlust|ausfall)|Pacht(?:verlust|ausfall)|Ertragsausfall)\b/iu.test(
              label
            );
          const coordinatedCostList =
            /^\s*[-•]?\s*(?:\p{L}+-\s*,\s*){2,}[\s\S]*\p{L}*kosten\b/iu.test(
              label
            );
          if (!startsWithCostRole && !coordinatedCostList) return component;
          repairs.push({
            requirementIndex,
            componentIndex,
            action: "NORMALIZE_NON_PHYSICAL_COST_OBJECT",
            fromType: "OBJECT",
            toType: "FACT_ROLE",
          });
          return { ...component, type: "FACT_ROLE" };
        }
      ),
    })
  );
  return { requirements: normalizedRequirements, repairs };
}

function normalizeCostPurposeObjectComponents(requirements) {
  const repairs = [];
  const normalizedRequirements = requirements.map(
    (requirement, requirementIndex) => {
      const components = requirement.components || [];
      const hasCostRole = components.some(
        (component) =>
          component?.type === "FACT_ROLE" &&
          /^\s*[-•]?\s*(?:Mehr)?\p{L}*kosten\b/iu.test(
            String(component.label || "")
          )
      );
      if (!hasCostRole) return requirement;
      return {
        ...requirement,
        components: components.map((component, componentIndex) => {
          if (component?.type !== "OBJECT") return component;
          const label = String(component.label || "");
          let toType = null;
          if (
            /^\s*(?:Tätigkeiten|Leistungen|Planung|Bauleitung|Projektabwicklung|Ausschreibung)\b/iu.test(
              label
            )
          )
            toType = "FACT_ROLE";
          else if (
            /^\s*(?:Wiederaufbau|Wiederherstellung|Wiederbeschaffung|Reparatur)\b[\s\S]*\berforderlich(?:e[snmr]?)?(?:\s+sind)?\b/iu.test(
              label
            )
          )
            toType = "CONDITION";
          if (!toType) return component;
          repairs.push({
            requirementIndex,
            componentIndex,
            action: "NORMALIZE_COST_PURPOSE_OBJECT_ROLE",
            fromType: "OBJECT",
            toType,
          });
          return { ...component, type: toType };
        }),
      };
    }
  );
  return { requirements: normalizedRequirements, repairs };
}

function normalizeAtomicCostRoleComponents(requirements, unit) {
  const repairs = [];
  const unitSourceText = String(unit?.source?.combinedText || "");
  const unitSourceBlockIds = unit?.source?.blockIds || [];
  const costDefinitionPattern =
    /^\s*[-•]?\s*(?<role>Mehrkosten\s+für\s+[^;\n-]+?)\s+-\s+(?<definition>das\s+sind\s+Kosten[\s\S]*?ergeben;?)\s*$/iu;
  const priceIncreasePattern =
    /^\s*[-•]?\s*(?<role>Mehrkosten\s+infolge\s+Preissteigerung)\s+(?<temporal>zwischen\s+dem\s+Eintritt\s+des\s+Schadenereignisses\s+und\s+der\s+Wiederherstellung\s+oder\s+Wiederbeschaffung)\s+entstandenen\s+(?<result>Erhöhung\s+der\s+Ersatzleistung);?\s*$/iu;
  const normalizedRequirements = requirements.map(
    (requirement, requirementIndex) => ({
      ...requirement,
      components: (requirement.components || []).flatMap(
        (component, componentIndex) => {
          if (component?.type !== "FACT_ROLE") return [component];
          const label = String(component.label || "");
          const declaredSourceBlockIds = new Set(
            component.sourceBlockIds || []
          );
          const coversWholeUnit =
            unitSourceBlockIds.length > 0 &&
            unitSourceBlockIds.every((blockId) =>
              declaredSourceBlockIds.has(blockId)
            ) &&
            label.replace(/\s+/gu, " ").trim().length >=
              unitSourceText.replace(/\s+/gu, " ").trim().length * 0.85;
          const costDefinition =
            costDefinitionPattern.exec(label) ||
            (coversWholeUnit
              ? costDefinitionPattern.exec(unitSourceText)
              : null);
          if (costDefinition?.groups) {
            const roleSourceBlockIds = sourceBlockIdsForExactSpan(
              unit,
              costDefinition.groups.role
            );
            const definitionSourceBlockIds = sourceBlockIdsForExactSpan(
              unit,
              costDefinition.groups.definition
            );
            if (roleSourceBlockIds.length && definitionSourceBlockIds.length) {
              repairs.push({
                requirementIndex,
                componentIndex,
                action: "SPLIT_COST_DEFINITION_ROLE",
              });
              return [
                {
                  ...component,
                  label: costDefinition.groups.role,
                  sourceBlockIds: roleSourceBlockIds,
                },
                {
                  type: "DEFINITION",
                  label: costDefinition.groups.definition,
                  sourceBlockIds: definitionSourceBlockIds,
                },
              ];
            }
          }
          const priceIncrease =
            priceIncreasePattern.exec(label) ||
            (coversWholeUnit
              ? priceIncreasePattern.exec(unitSourceText)
              : null);
          if (priceIncrease?.groups) {
            const components = [
              {
                ...component,
                label: priceIncrease.groups.role,
                sourceBlockIds: sourceBlockIdsForExactSpan(
                  unit,
                  priceIncrease.groups.role
                ),
              },
              {
                type: "TEMPORAL_VALIDITY",
                label: priceIncrease.groups.temporal,
                sourceBlockIds: sourceBlockIdsForExactSpan(
                  unit,
                  priceIncrease.groups.temporal
                ),
              },
              {
                type: "FACT_ROLE",
                label: priceIncrease.groups.result,
                sourceBlockIds: sourceBlockIdsForExactSpan(
                  unit,
                  priceIncrease.groups.result
                ),
              },
            ];
            if (
              components.every(({ sourceBlockIds }) => sourceBlockIds.length)
            ) {
              repairs.push({
                requirementIndex,
                componentIndex,
                action: "SPLIT_PRICE_INCREASE_COST_ROLE",
              });
              return components;
            }
          }
          const lossWithObjectScope =
            /^\s*(?<role>(?:der\s+)?(?:Miet(?:verlust|ausfall)|Pacht(?:verlust|ausfall)|Ertragsausfall))\s+(?<scope>für\s+[\s\S]*(?:Gebäude|Räum|Einheit|Objekt|Standort|Grundstück)[-\p{L}\s–/]*)\s*$/iu.exec(
              label
            );
          if (lossWithObjectScope?.groups) {
            const roleSourceBlockIds = sourceBlockIdsForExactSpan(
              unit,
              lossWithObjectScope.groups.role
            );
            const scopeSourceBlockIds = sourceBlockIdsForExactSpan(
              unit,
              lossWithObjectScope.groups.scope
            );
            if (roleSourceBlockIds.length && scopeSourceBlockIds.length) {
              repairs.push({
                requirementIndex,
                componentIndex,
                action: "SPLIT_FINANCIAL_LOSS_ROLE_AND_SCOPE",
              });
              return [
                {
                  ...component,
                  label: lossWithObjectScope.groups.role,
                  sourceBlockIds: roleSourceBlockIds,
                },
                {
                  type: "SCOPE",
                  label: lossWithObjectScope.groups.scope,
                  sourceBlockIds: scopeSourceBlockIds,
                },
              ];
            }
          }
          const costParts = [
            ...label.matchAll(
              /(?:\p{L}+-\s+und\s+\p{L}+-|\p{L}+-|\p{L}*kosten)/giu
            ),
          ].map(([value]) => value.trim());
          if (
            costParts.length < 3 ||
            !costParts.some((value) => /kosten$/iu.test(value))
          )
            return [component];
          const remainder = costParts.reduce(
            (value, part) => value.replace(part, " "),
            label
          );
          if (
            remainder
              .replace(/\b(?:und|sowie)\b/giu, " ")
              .replace(/[-–—•,;\s]/gu, "")
          )
            return [component];
          const components = costParts.map((part) => ({
            type: "FACT_ROLE",
            label: part,
            sourceBlockIds: sourceBlockIdsForExactSpan(unit, part),
          }));
          if (
            components.some(({ sourceBlockIds }) => sourceBlockIds.length === 0)
          )
            return [component];
          repairs.push({
            requirementIndex,
            componentIndex,
            action: "SPLIT_COORDINATED_COST_ROLES",
            components: components.length,
          });
          return components;
        }
      ),
    })
  );
  return { requirements: normalizedRequirements, repairs };
}

function normalizeTieredLimitBasisComponents(requirements, unit) {
  const repairs = [];
  let addedScope = false;
  const normalizedRequirements = requirements.map(
    (requirement, requirementIndex) => ({
      ...requirement,
      components: (requirement.components || []).flatMap(
        (component, componentIndex) => {
          if (component?.type !== "LIMIT_BASIS") return [component];
          const label = String(component.label || "");
          const basis =
            /\b(?:der\s+)?(?:Gebäude(?:gesamt)?versicherungssumme|Versicherungssumme)\b/iu.exec(
              label
            );
          const values = [
            ...label.matchAll(
              /\b(?:bis\s+zu\s+)?(?:maximal|max\.?|höchstens)\s+(?:(?<currency>€|EUR|Euro)\s*)?(?<raw>[0-9lI]+(?:[.,][0-9lI]+)?)\s*(?<unit>%|€|EUR|Euro)?/giu
            ),
          ];
          if (!basis || values.length === 0) return [component];
          const valueComponents = values.map((match) => ({
            type: "VALUE_AND_UNIT",
            label: match[0],
            rawValue: match.groups.raw,
            ...(match.groups.unit || match.groups.currency
              ? { unit: match.groups.unit || match.groups.currency }
              : {}),
            sourceBlockIds: sourceBlockIdsForExactSpan(unit, match[0]),
          }));
          const scopes = [
            ...label.matchAll(/\bin\s+der\s+\p{L}+versicherung\b/giu),
          ].map((match) => ({
            type: "SCOPE",
            label: match[0],
            sourceBlockIds: sourceBlockIdsForExactSpan(unit, match[0]),
          }));
          const basisSourceBlockIds = sourceBlockIdsForExactSpan(
            unit,
            basis[0]
          );
          if (
            basisSourceBlockIds.length === 0 ||
            [...valueComponents, ...scopes].some(
              ({ sourceBlockIds }) => sourceBlockIds.length === 0
            )
          )
            return [component];
          addedScope ||= scopes.length > 0;
          repairs.push({
            requirementIndex,
            componentIndex,
            action: "SPLIT_TIERED_LIMIT_BASIS",
            values: valueComponents.length,
            scopes: scopes.length,
          });
          return [
            ...valueComponents,
            ...scopes,
            {
              type: "LIMIT_BASIS",
              label: basis[0],
              sourceBlockIds: basisSourceBlockIds,
            },
          ];
        }
      ),
    })
  );
  return { requirements: normalizedRequirements, repairs, addedScope };
}

function normalizeSubsidiaryPrecedenceRequirements(requirements, unit) {
  const sourceText = String(unit?.source?.combinedText || "").trim();
  const match =
    /(?<clause>\b(?:Diese|Die|Der|Das)\s+(?:Deckung|Versicherungsschutz|Leistung|Versicherung)\s+(?:gilt|ist)\s+(?:subsidiär|nachrangig)\s+(?:zu|gegenüber)\s+[^.;!?]+[.]?)\s*$/iu.exec(
      sourceText
    );
  if (!match?.groups?.clause) return { requirements, repairs: [] };
  const clause = match.groups.clause;
  const sourceBlockIds = sourceBlockIdsForExactSpan(unit, clause);
  if (sourceBlockIds.length === 0) return { requirements, repairs: [] };
  const sourceIds = new Set(sourceBlockIds);
  const repairs = [];
  const normalizedRequirements = requirements.flatMap(
    (requirement, requirementIndex) => {
      const displayLabel = String(requirement.displayLabel || "");
      const clauseIndex = displayLabel.indexOf(clause);
      if (clauseIndex < 0) return [requirement];
      const retained = (requirement.components || []).filter((component) => {
        const label = String(component.label || "").trim();
        const touchesPrecedenceBlocks = component.sourceBlockIds?.some(
          (blockId) => sourceIds.has(blockId)
        );
        const whollyInsideClause =
          label && touchesPrecedenceBlocks && clause.includes(label);
        const onlyPrecedenceBlocks =
          component.sourceBlockIds?.length > 0 &&
          component.sourceBlockIds.every((blockId) => sourceIds.has(blockId));
        return !whollyInsideClause && !onlyPrecedenceBlocks;
      });
      const prefix = displayLabel.slice(0, clauseIndex).trim();
      repairs.push({
        requirementIndex,
        action: "SPLIT_SUBSIDIARY_PRECEDENCE_REQUIREMENT",
        removedComponents:
          (requirement.components || []).length - retained.length,
      });
      return [
        ...(prefix && retained.length > 0
          ? [{ ...requirement, displayLabel: prefix, components: retained }]
          : []),
        {
          displayLabel: clause,
          components: [
            {
              type: "PRECEDENCE_OR_REPLACEMENT",
              label: clause,
              sourceBlockIds,
            },
          ],
        },
      ];
    }
  );
  return { requirements: normalizedRequirements, repairs };
}

function semanticClassesFromSourceBoundComponents(requirements, unit) {
  const components = requirements.flatMap((requirement) =>
    Array.isArray(requirement?.components) ? requirement.components : []
  );
  const componentTypes = new Set(
    components
      .map(({ type }) => type)
      .filter((type) => type && type !== "COVERAGE_EFFECT")
  );
  const sourceText = String(unit?.source?.combinedText || "");
  const classes = new Set();
  if (componentTypes.has("DEDUCTIBLE")) classes.add("DEDUCTIBLE");
  if (componentTypes.has("LIMIT_BASIS")) classes.add("LIMIT");
  if (componentTypes.has("VALUE_AND_UNIT")) {
    const costSignal =
      /\b(?:Kosten|Aufwendungen|Gebühren|Honorar|Entsorgung|Räumung|Abbruch|Dekontamination)\b/iu.test(
        sourceText
      );
    const limitSignal =
      /\b(?:Versicherungssumme|Höchst(?:betrag|entschädigung)|Limit|Grenze|bis\s+zu|Prozent|%|EUR|Euro|€|einmal\s+pro)\b/iu.test(
        sourceText
      );
    if (limitSignal || !costSignal) classes.add("LIMIT");
    else classes.add("COST");
  }
  if (componentTypes.has("TEMPORAL_VALIDITY")) classes.add("DURATION");
  if (componentTypes.has("SCOPE")) classes.add("VARIANT");
  if (
    componentTypes.has("PERIL_OR_CAUSE") ||
    componentTypes.has("DAMAGE_OR_EFFECT")
  )
    classes.add("PERIL_OR_DAMAGE");
  if (componentTypes.has("CONDITION")) classes.add("CONDITION");
  if (componentTypes.has("FACT_ROLE")) classes.add("DEFINITION");
  if (componentTypes.has("PRECEDENCE_OR_REPLACEMENT"))
    classes.add("DOCUMENT_PRECEDENCE_OR_REPLACEMENT");
  if (componentTypes.has("OBJECT") && classes.size > 0)
    classes.add("INSURED_OBJECT");
  const priority = [
    "LIMIT",
    "DEDUCTIBLE",
    "COST",
    "DURATION",
    "VARIANT",
    "PERIL_OR_DAMAGE",
    "INSURED_OBJECT",
    "CONDITION",
    "DEFINITION",
    "DOCUMENT_PRECEDENCE_OR_REPLACEMENT",
  ];
  return priority.filter((semanticClass) => classes.has(semanticClass));
}

function normalizeUnambiguousSemanticClassAliases(response) {
  const aliases = new Map([
    ["OBJECT", "INSURED_OBJECT"],
    ["PERIL_OR_CAUSE", "PERIL_OR_DAMAGE"],
    ["DAMAGE_OR_EFFECT", "PERIL_OR_DAMAGE"],
    ["FACT_ROLE", "DEFINITION"],
    ["SCOPE", "VARIANT"],
    ["LIMIT_BASIS", "LIMIT"],
    ["TEMPORAL_VALIDITY", "DURATION"],
    ["PRECEDENCE_OR_REPLACEMENT", "DOCUMENT_PRECEDENCE_OR_REPLACEMENT"],
  ]);
  const repairs = [];
  const mapAlias = (value, field) => {
    const mapped = aliases.get(value) || value;
    if (mapped !== value) repairs.push({ field, from: value, to: mapped });
    return mapped;
  };
  const primaryClass = mapAlias(response?.primaryClass, "primaryClass");
  const semanticClasses = [
    ...new Set(
      (Array.isArray(response?.semanticClasses)
        ? response.semanticClasses
        : []
      ).map((semanticClass) => mapAlias(semanticClass, "semanticClasses"))
    ),
  ];
  return {
    response: { ...response, primaryClass, semanticClasses },
    repairs,
  };
}

function normalizeUnambiguousComponentTypes(responses, units = []) {
  const repairs = [];
  const unitsById = new Map(units.map((unit) => [unit.unitId, unit]));
  const normalized = responses.map((response) => {
    const semanticAliasNormalization =
      normalizeUnambiguousSemanticClassAliases(response);
    response = semanticAliasNormalization.response;
    for (const repair of semanticAliasNormalization.repairs)
      repairs.push({
        unitId: response?.unitId,
        action: "NORMALIZE_SEMANTIC_CLASS_ALIAS",
        ...repair,
      });
    const unit = unitsById.get(response?.unitId);
    const sourceText = String(unit?.source?.combinedText || "");
    const numberedHeadingWithoutPredicate =
      unit?.unitKind === "LIST" &&
      unit.source?.blocks?.length > 0 &&
      unit.source.blocks.every(
        ({ structuralKind }) => structuralKind === "HEADING_CANDIDATE"
      ) &&
      /^\s*\d+[.)]\s/u.test(sourceText) &&
      !/\b(?:ist|sind|wird|werden|gilt|gelten|besteht|bestehen|hat|haben|muss|müssen|kann|können|darf|dürfen|umfasst|umfassen|versichert|mitversichert|ausgeschlossen|ersetzt|leistet|verzichtet)\b/iu.test(
        sourceText
      );
    if (numberedHeadingWithoutPredicate) {
      if (
        response?.primaryClass !== "STRUCTURE" ||
        response?.semanticClasses?.length !== 1 ||
        response.semanticClasses[0] !== "STRUCTURE" ||
        response?.requirements?.length
      )
        repairs.push({
          unitId: response?.unitId,
          action: "NORMALIZE_NUMBERED_HEADING_TO_STRUCTURE",
        });
      return {
        unitId: response?.unitId,
        primaryClass: "STRUCTURE",
        semanticClasses: ["STRUCTURE"],
        requirements: [],
      };
    }
    const predicateFreeInsuranceBranchHeading =
      unit?.source?.blocks?.length === 1 &&
      /^\s*[\p{L}][\p{L}\s-]{1,120}versicherung\s*$/iu.test(sourceText) &&
      !/\b(?:ist|sind|wird|werden|gilt|gelten|besteht|bestehen|hat|haben|muss|müssen|kann|können|darf|dürfen|umfasst|umfassen|versichert|mitversichert|ausgeschlossen|ersetzt|leistet|verzichtet)\b/iu.test(
        sourceText
      );
    if (predicateFreeInsuranceBranchHeading) {
      repairs.push({
        unitId: response?.unitId,
        action: "NORMALIZE_INSURANCE_BRANCH_HEADING_TO_STRUCTURE",
      });
      return {
        unitId: response?.unitId,
        primaryClass: "STRUCTURE",
        semanticClasses: ["STRUCTURE"],
        requirements: [],
      };
    }
    let requirements = Array.isArray(response?.requirements)
      ? response.requirements
      : [];
    const conditionalMembership = normalizeConditionalMembershipObjects(
      requirements,
      unit
    );
    requirements = conditionalMembership.requirements;
    for (const repair of conditionalMembership.repairs)
      repairs.push({
        unitId: response?.unitId,
        action: "NORMALIZE_CONDITION_MEMBERSHIP_OBJECTS",
        ...repair,
      });
    const pureQuantifiedLimit =
      normalizePureQuantifiedLimitObjectComponents(requirements);
    requirements = pureQuantifiedLimit.requirements;
    for (const repair of pureQuantifiedLimit.repairs)
      repairs.push({ unitId: response?.unitId, ...repair });
    if (pureQuantifiedLimit.repairs.length > 0) {
      const hasObject = requirements.some((requirement) =>
        (requirement.components || []).some(({ type }) => type === "OBJECT")
      );
      const semanticClasses = [
        ...new Set([...(response.semanticClasses || []), "LIMIT"]),
      ].filter(
        (semanticClass) => semanticClass !== "INSURED_OBJECT" || hasObject
      );
      response = {
        ...response,
        primaryClass:
          response.primaryClass === "INSURED_OBJECT" && !hasObject
            ? "LIMIT"
            : response.primaryClass,
        semanticClasses,
      };
    }
    const coverageBranchGovernor = normalizeCoverageBranchGovernorComponents(
      requirements,
      unit
    );
    requirements = coverageBranchGovernor.requirements;
    for (const repair of coverageBranchGovernor.repairs)
      repairs.push({ unitId: response?.unitId, ...repair });
    if (coverageBranchGovernor.repairs.length > 0)
      response = {
        ...response,
        semanticClasses: [
          ...new Set([...(response.semanticClasses || []), "LIMIT", "VARIANT"]),
        ],
      };
    const nonPhysicalCost =
      normalizeNonPhysicalCostObjectComponents(requirements);
    requirements = nonPhysicalCost.requirements;
    for (const repair of nonPhysicalCost.repairs)
      repairs.push({ unitId: response?.unitId, ...repair });
    if (nonPhysicalCost.repairs.length > 0) {
      const hasObject = requirements.some((requirement) =>
        (requirement.components || []).some(({ type }) => type === "OBJECT")
      );
      response = {
        ...response,
        primaryClass:
          response.primaryClass === "INSURED_OBJECT" && !hasObject
            ? "COST"
            : response.primaryClass,
        semanticClasses: [
          ...new Set([...(response.semanticClasses || []), "COST"]),
        ].filter(
          (semanticClass) => semanticClass !== "INSURED_OBJECT" || hasObject
        ),
      };
    }
    const costPurposeObjects =
      normalizeCostPurposeObjectComponents(requirements);
    requirements = costPurposeObjects.requirements;
    for (const repair of costPurposeObjects.repairs)
      repairs.push({ unitId: response?.unitId, ...repair });
    const atomicCostRoles = normalizeAtomicCostRoleComponents(
      requirements,
      unit
    );
    requirements = atomicCostRoles.requirements;
    for (const repair of atomicCostRoles.repairs)
      repairs.push({ unitId: response?.unitId, ...repair });
    if (
      atomicCostRoles.repairs.some(
        ({ action }) => action === "SPLIT_FINANCIAL_LOSS_ROLE_AND_SCOPE"
      )
    )
      response = {
        ...response,
        semanticClasses: [
          ...new Set([...(response.semanticClasses || []), "VARIANT"]),
        ],
      };
    if (
      atomicCostRoles.repairs.some(
        ({ action }) => action === "SPLIT_COST_DEFINITION_ROLE"
      )
    )
      response = {
        ...response,
        semanticClasses: [
          ...new Set([...(response.semanticClasses || []), "DEFINITION"]),
        ],
      };
    const tieredLimitBasis = normalizeTieredLimitBasisComponents(
      requirements,
      unit
    );
    requirements = tieredLimitBasis.requirements;
    for (const repair of tieredLimitBasis.repairs)
      repairs.push({ unitId: response?.unitId, ...repair });
    if (tieredLimitBasis.repairs.length > 0)
      response = {
        ...response,
        semanticClasses: [
          ...new Set([
            ...(response.semanticClasses || []),
            "LIMIT",
            ...(tieredLimitBasis.addedScope ? ["VARIANT"] : []),
          ]),
        ],
      };
    const subsidiaryPrecedence = normalizeSubsidiaryPrecedenceRequirements(
      requirements,
      unit
    );
    requirements = subsidiaryPrecedence.requirements;
    for (const repair of subsidiaryPrecedence.repairs)
      repairs.push({ unitId: response?.unitId, ...repair });
    if (subsidiaryPrecedence.repairs.length > 0) {
      const hasNonPrecedenceRequirement = requirements.some((requirement) =>
        (requirement.components || []).some(
          ({ type }) => type !== "PRECEDENCE_OR_REPLACEMENT"
        )
      );
      response = {
        ...response,
        primaryClass: hasNonPrecedenceRequirement
          ? response.primaryClass
          : "DOCUMENT_PRECEDENCE_OR_REPLACEMENT",
        semanticClasses: [
          ...new Set([
            ...(response.semanticClasses || []),
            "DOCUMENT_PRECEDENCE_OR_REPLACEMENT",
          ]),
        ],
      };
    }
    const firstRiskScopes = requirements.flatMap((requirement) =>
      (requirement.components || []).filter(
        (component) =>
          component?.type === "SCOPE" &&
          /^\s*auf\s+[„“”"',]*\s*Erstes\s+Risiko[„“”"',]*\s*[.;]?\s*$/iu.test(
            String(component.label || "")
          )
      )
    );
    if (firstRiskScopes.length > 0) {
      const hasOtherScope = requirements.some((requirement) =>
        (requirement.components || []).some(
          (component) =>
            component?.type === "SCOPE" && !firstRiskScopes.includes(component)
        )
      );
      response = {
        ...response,
        primaryClass:
          response.primaryClass === "VARIANT" && !hasOtherScope
            ? "LIMIT"
            : response.primaryClass,
        semanticClasses: [
          ...new Set([...(response.semanticClasses || []), "LIMIT"]),
        ].filter(
          (semanticClass) => semanticClass !== "VARIANT" || hasOtherScope
        ),
      };
    }
    const coverageBranchSchedule = normalizeCoverageBranchScheduleComponents(
      requirements,
      unit
    );
    requirements = coverageBranchSchedule.requirements;
    for (const repair of coverageBranchSchedule.repairs)
      repairs.push({ unitId: response?.unitId, ...repair });
    const productConfigurationDefinition =
      requirements.length > 0 &&
      !hasCoverageEffectEvidence(unit) &&
      /\b(?:Grund|Basis)deckung\b[\s\S]{0,240}\b(?:Produkt|Tarif)\b[\s\S]{0,240}\bVariante\b/iu.test(
        sourceText
      );
    if (productConfigurationDefinition) {
      repairs.push({
        unitId: response?.unitId,
        action: "NORMALIZE_PRODUCT_CONFIGURATION_TO_DEFINITION",
      });
      const normalizedRequirements = requirements.map(
        (requirement, requirementIndex) => {
          const scopedComponents = (requirement.components || []).flatMap(
            (component) => {
              if (component?.type === "COVERAGE_EFFECT") return [];
              const productRoleComponent =
                component?.type === "OBJECT" &&
                /\b(?:Produkt|Tarif|Versicherung)\b/iu.test(
                  String(component.label || "")
                )
                  ? { ...component, type: "FACT_ROLE" }
                  : component;
              const splitScopeComponents =
                splitProductConfigurationScopeRoles(productRoleComponent);
              if (splitScopeComponents) {
                const scopeCount = splitScopeComponents.filter(
                  ({ type }) => type === "SCOPE"
                ).length;
                if (splitScopeComponents.length > scopeCount)
                  repairs.push({
                    unitId: response.unitId,
                    action: "SPLIT_EMBEDDED_EXPLICIT_SCOPE_ROLE",
                    fromType: component.type,
                    scopeComponents: scopeCount,
                  });
                repairs.push({
                  unitId: response.unitId,
                  action: "NORMALIZE_EXPLICIT_SCOPE_ROLE",
                  fromType: component.type,
                  toType: "SCOPE",
                  components: scopeCount,
                });
                return splitScopeComponents;
              }
              return [productRoleComponent];
            }
          );
          const factRelation = normalizeProductConfigurationFactRelation(
            scopedComponents,
            unit
          );
          if (factRelation.mergedFactRoles > 0)
            repairs.push({
              unitId: response.unitId,
              requirementIndex,
              action: "MERGE_PRODUCT_CONFIGURATION_FACT_RELATION",
              mergedFactRoles: factRelation.mergedFactRoles,
            });
          return { ...requirement, components: factRelation.components };
        }
      );
      const hasScope = normalizedRequirements.some((requirement) =>
        requirement.components.some(({ type }) => type === "SCOPE")
      );
      return {
        ...response,
        primaryClass: "DEFINITION",
        semanticClasses: ["DEFINITION", ...(hasScope ? ["VARIANT"] : [])],
        requirements: normalizedRequirements,
      };
    }
    const favorableCoveragePrecedence = moreFavorableCoveragePrecedence(unit);
    if (favorableCoveragePrecedence) {
      repairs.push({
        unitId: response?.unitId,
        action: "NORMALIZE_MORE_FAVORABLE_COVERAGE_PRECEDENCE",
      });
      return {
        ...response,
        primaryClass: "DOCUMENT_PRECEDENCE_OR_REPLACEMENT",
        semanticClasses: ["DOCUMENT_PRECEDENCE_OR_REPLACEMENT"],
        requirements: [favorableCoveragePrecedence],
      };
    }
    const allocationDefinition =
      response?.primaryClass === "OPERATIVE_COVERAGE_STATEMENT" &&
      response?.semanticClasses?.length === 1 &&
      requirements.length > 0 &&
      requirements.every(
        (requirement) =>
          requirement?.components?.length > 0 &&
          requirement.components.every(({ type }) => type === "OBJECT")
      ) &&
      /\bVersicherungssumme\b/iu.test(sourceText) &&
      /\b(?:dient|aufgeteilt|Verteilung\s+richtet\s+sich)\b/iu.test(
        sourceText
      ) &&
      !/\b(?:ausgeschlossen|ausgenommen|(?:mit)?versichert|Versicherungsschutz|gedeckt|ersetzt|erstattet|Entschädigung|Anspruch\s+auf\s+(?:Zahlung|Leistung))\b/iu.test(
        sourceText
      );
    if (allocationDefinition) {
      repairs.push({
        unitId: response?.unitId,
        action: "NORMALIZE_ALLOCATION_RULE_TO_DEFINITION",
      });
      return {
        ...response,
        primaryClass: "DEFINITION",
        semanticClasses: ["DEFINITION"],
        requirements: requirements.map((requirement) => ({
          ...requirement,
          components: requirement.components.map((component) => ({
            ...component,
            type: "FACT_ROLE",
          })),
        })),
      };
    }
    const statutoryApplicabilityExtension =
      response?.primaryClass === "OPERATIVE_COVERAGE_STATEMENT" &&
      /\bIn\s+Erweiterung\s+des\s+§[\s\S]{1,300}?\banwendbar\b/iu.test(
        sourceText
      );
    if (statutoryApplicabilityExtension) {
      repairs.push({
        unitId: response?.unitId,
        action: "NORMALIZE_STATUTORY_APPLICABILITY_EXTENSION",
      });
      return {
        ...response,
        primaryClass: "DOCUMENT_PRECEDENCE_OR_REPLACEMENT",
        semanticClasses: ["DOCUMENT_PRECEDENCE_OR_REPLACEMENT"],
        requirements: requirements.map((requirement) => ({
          ...requirement,
          components: [
            ...(requirement.components || []).filter(
              ({ type }) => type !== "COVERAGE_EFFECT"
            ),
            {
              type: "PRECEDENCE_OR_REPLACEMENT",
              label: sourceText,
              sourceBlockIds: unit.source.blockIds,
            },
          ],
        })),
      };
    }
    return {
      ...response,
      requirements: Array.isArray(response?.requirements)
        ? requirements.map((requirement, requirementIndex) => ({
            ...requirement,
            components: Array.isArray(requirement?.components)
              ? requirement.components.flatMap((component, componentIndex) => {
                  const hasComponentType = (type) =>
                    requirement.components.some(
                      (candidate) => candidate?.type === type
                    );
                  const componentLabel = String(component?.label || "");
                  if (
                    component?.type === "SCOPE" &&
                    /^\s*auf\s+[„“”"',]*\s*Erstes\s+Risiko[„“”"',]*\s*[.;]?\s*$/iu.test(
                      componentLabel
                    )
                  ) {
                    repairs.push({
                      unitId: response.unitId,
                      requirementIndex,
                      componentIndex,
                      action: "NORMALIZE_FIRST_RISK_TO_LIMIT_BASIS",
                      fromType: "SCOPE",
                      toType: "LIMIT_BASIS",
                    });
                    return [{ ...component, type: "LIMIT_BASIS" }];
                  }
                  const scopeComponent = explicitScopeRoleRepair(component);
                  if (scopeComponent) {
                    repairs.push({
                      unitId: response.unitId,
                      requirementIndex,
                      componentIndex,
                      action: "NORMALIZE_EXPLICIT_SCOPE_ROLE",
                      fromType: component.type,
                      toType: "SCOPE",
                    });
                    return [scopeComponent];
                  }
                  const completeSourceBlockIds =
                    completeComponentSourceBlockIds(unit, component);
                  if (completeSourceBlockIds) {
                    const sourceRepairedComponent = {
                      ...component,
                      sourceBlockIds: completeSourceBlockIds,
                    };
                    repairs.push({
                      unitId: response.unitId,
                      requirementIndex,
                      componentIndex,
                      action: "RESTORE_COMPONENT_SOURCE_BLOCK_IDS",
                      fromSourceBlockIds: component.sourceBlockIds,
                      toSourceBlockIds: completeSourceBlockIds,
                    });
                    const repairedConditionLabel = exactConditionLabel(
                      unit,
                      sourceRepairedComponent
                    );
                    if (repairedConditionLabel) {
                      repairs.push({
                        unitId: response.unitId,
                        requirementIndex,
                        componentIndex,
                        action: "RESTORE_EXACT_CONDITION_SOURCE_TEXT",
                      });
                      return [
                        {
                          ...sourceRepairedComponent,
                          label: repairedConditionLabel,
                        },
                      ];
                    }
                    return [sourceRepairedComponent];
                  }
                  const sourceBoundConditionLabel = exactConditionLabel(
                    unit,
                    component
                  );
                  if (sourceBoundConditionLabel) {
                    repairs.push({
                      unitId: response.unitId,
                      requirementIndex,
                      componentIndex,
                      action: "RESTORE_EXACT_CONDITION_SOURCE_TEXT",
                    });
                    return [{ ...component, label: sourceBoundConditionLabel }];
                  }
                  const exactPerformanceObligation =
                    component?.type === "COVERAGE_EFFECT" &&
                    /(?:\.\.\.|…)/u.test(componentLabel)
                      ? /\bist\s+der\s+Versicherer[\s\S]{1,240}?\bzur\s+Leistung\s+verpflichtet\b/iu.exec(
                          sourceText
                        )?.[0]
                      : null;
                  if (exactPerformanceObligation) {
                    repairs.push({
                      unitId: response.unitId,
                      requirementIndex,
                      componentIndex,
                      action: "EXPAND_ELIDED_PERFORMANCE_OBLIGATION",
                    });
                    return [
                      { ...component, label: exactPerformanceObligation },
                    ];
                  }
                  if (
                    component?.type === "COVERAGE_EFFECT" &&
                    /^gilt$/iu.test(componentLabel) &&
                    /\bals\b[\s\S]*\bgilt\b/iu.test(
                      String(requirement.displayLabel || "")
                    )
                  ) {
                    repairs.push({
                      unitId: response.unitId,
                      requirementIndex,
                      componentIndex,
                      action: "NORMALIZE_BARE_GILT_TO_FACT_ROLE",
                    });
                    const { coverageEffect: _coverageEffect, ...rest } =
                      component;
                    return [{ ...rest, type: "FACT_ROLE" }];
                  }
                  if (
                    component?.type === "COVERAGE_EFFECT" &&
                    /\bgilt\s+(?:diese|dieser|dieses)\s+vereinbart\b/iu.test(
                      componentLabel
                    )
                  ) {
                    repairs.push({
                      unitId: response.unitId,
                      requirementIndex,
                      componentIndex,
                      action: "NORMALIZE_AGREED_REPLACEMENT_TO_PRECEDENCE_ROLE",
                    });
                    const { coverageEffect: _coverageEffect, ...rest } =
                      component;
                    return [{ ...rest, type: "PRECEDENCE_OR_REPLACEMENT" }];
                  }
                  if (
                    component?.type === "COVERAGE_EFFECT" &&
                    component.coverageEffect === "CONDITIONAL" &&
                    /\bgelten\b[\s\S]*\bBestimmungen\b/iu.test(
                      String(component.label || "")
                    ) &&
                    requirement.components.some(
                      ({ type }) => type === "CONDITION"
                    )
                  ) {
                    repairs.push({
                      unitId: response.unitId,
                      requirementIndex,
                      componentIndex,
                      action: "DROP_REDUNDANT_APPLICABILITY_EFFECT",
                    });
                    return [];
                  }
                  const coverageEffectRepair = explicitCoverageEffectRepair(
                    unit,
                    component
                  );
                  if (coverageEffectRepair) {
                    repairs.push({
                      unitId: response.unitId,
                      requirementIndex,
                      componentIndex,
                      action: "RESTORE_EXPLICIT_COVERAGE_EFFECT",
                      fromCoverageEffect: component.coverageEffect || null,
                      toCoverageEffect: coverageEffectRepair.coverageEffect,
                    });
                    return [{ ...component, ...coverageEffectRepair }];
                  }
                  if (
                    component?.type === "COVERAGE_EFFECT" &&
                    ((/^gilt$/iu.test(componentLabel) &&
                      hasComponentType("FACT_ROLE")) ||
                      (/\bwird\s+die\s+Frist\b[\s\S]*\berstreckt\b/iu.test(
                        componentLabel
                      ) &&
                        (hasComponentType("CONDITION") ||
                          hasComponentType("TEMPORAL_VALIDITY"))) ||
                      (/\bgilt\s+als\s+vereinbart\b/iu.test(componentLabel) &&
                        requirement.components.some(
                          (candidate) =>
                            candidate !== component &&
                            candidate?.type === "COVERAGE_EFFECT" &&
                            /\b\w*entschädigung\s+geleistet\s+wird\b/iu.test(
                              String(candidate.label || "")
                            )
                        )))
                  ) {
                    repairs.push({
                      unitId: response.unitId,
                      requirementIndex,
                      componentIndex,
                      action: "DROP_REDUNDANT_NON_COVERAGE_EFFECT",
                    });
                    return [];
                  }
                  if (
                    component?.type !== "EXCLUSION" ||
                    component.coverageEffect
                  )
                    return [component];
                  repairs.push({
                    unitId: response.unitId,
                    requirementIndex,
                    componentIndex,
                    action: "NORMALIZE_COMPONENT_TYPE",
                    fromType: "EXCLUSION",
                    toType: "COVERAGE_EFFECT",
                    coverageEffect: "EXCLUDED",
                  });
                  return [
                    {
                      ...component,
                      type: "COVERAGE_EFFECT",
                      coverageEffect: "EXCLUDED",
                    },
                  ];
                })
              : requirement?.components,
          }))
        : response?.requirements,
    };
  });
  const unsupportedCoverageNormalized = normalized.map((response) => {
    const unit = unitsById.get(response?.unitId);
    const semanticClasses = Array.isArray(response?.semanticClasses)
      ? response.semanticClasses
      : [];
    let remainingClasses = semanticClasses.filter(
      (semanticClass) => semanticClass !== "OPERATIVE_COVERAGE_STATEMENT"
    );
    if (
      !unit ||
      (response?.primaryClass !== "OPERATIVE_COVERAGE_STATEMENT" &&
        !semanticClasses.includes("OPERATIVE_COVERAGE_STATEMENT")) ||
      hasCoverageEffectEvidence(unit)
    )
      return response;
    if (remainingClasses.length === 0)
      remainingClasses = semanticClassesFromSourceBoundComponents(
        response.requirements || [],
        unit
      );
    if (remainingClasses.length === 0) return response;
    repairs.push({
      unitId: response.unitId,
      action: "DROP_UNSUPPORTED_COVERAGE_CLASS",
      fromPrimaryClass: response.primaryClass,
      toPrimaryClass:
        response.primaryClass === "OPERATIVE_COVERAGE_STATEMENT"
          ? remainingClasses[0]
          : response.primaryClass,
    });
    return {
      ...response,
      primaryClass:
        response.primaryClass === "OPERATIVE_COVERAGE_STATEMENT"
          ? remainingClasses[0]
          : response.primaryClass,
      semanticClasses: remainingClasses,
      requirements: Array.isArray(response.requirements)
        ? response.requirements.map((requirement) => ({
            ...requirement,
            components: Array.isArray(requirement?.components)
              ? requirement.components.filter(
                  ({ type }) => type !== "COVERAGE_EFFECT"
                )
              : requirement?.components,
          }))
        : response.requirements,
    };
  });
  const polarityNormalized = unsupportedCoverageNormalized.map((response) => {
    if (response?.primaryClass !== "EXCLUSION") return response;
    const coverageEffects = (response.requirements || []).flatMap(
      ({ components }) =>
        (components || []).filter(({ type }) => type === "COVERAGE_EFFECT")
    );
    if (
      coverageEffects.length === 0 ||
      coverageEffects.some(
        ({ coverageEffect }) => coverageEffect !== "INCLUDED"
      )
    )
      return response;
    repairs.push({
      unitId: response.unitId,
      action: "NORMALIZE_POSITIVE_COVERAGE_PRIMARY_CLASS",
    });
    return {
      ...response,
      primaryClass: "OPERATIVE_COVERAGE_STATEMENT",
      semanticClasses: [
        "OPERATIVE_COVERAGE_STATEMENT",
        ...(response.semanticClasses || []).filter(
          (semanticClass) =>
            semanticClass !== "EXCLUSION" &&
            semanticClass !== "OPERATIVE_COVERAGE_STATEMENT"
        ),
      ],
    };
  });
  const listGovernorNormalization = normalizeStandaloneListGovernorRequirements(
    polarityNormalized,
    units
  );
  return {
    responses: listGovernorNormalization.responses,
    componentRepairs: [...repairs, ...listGovernorNormalization.repairs],
  };
}

function normalizeStandaloneListGovernorRequirements(responses, units = []) {
  const repairs = [];
  const unitsById = new Map(units.map((unit) => [unit.unitId, unit]));
  return {
    responses: responses.map((response) => {
      const unit = unitsById.get(response?.unitId);
      if (!unit) return response;
      const segments = unit?.logicalSourceSegments || [];
      const firstSegment = segments[0];
      const firstBlockId = firstSegment?.blockIds?.[0];
      const firstBlock = unit?.source?.blocks?.find(
        ({ blockId }) => blockId === firstBlockId
      );
      const hasSubordinateItems =
        segments.length > 1 &&
        segments.slice(1).every((segment) => {
          const block = unit.source.blocks.find(
            ({ blockId }) => blockId === segment.blockIds[0]
          );
          return block?.structuralKind === "LIST_ITEM";
        });
      if (
        firstBlock?.structuralKind !== "LIST_GOVERNOR" ||
        !hasSubordinateItems ||
        !Array.isArray(response?.requirements)
      )
        return response;
      const governorBlockIds = new Set(firstSegment.blockIds);
      const itemBlockIds = new Set(
        segments.slice(1).flatMap(({ blockIds }) => blockIds)
      );
      const standalone = response.requirements
        .map((requirement, requirementIndex) => ({
          requirement,
          requirementIndex,
          sourceBlockIds: new Set(
            (requirement.components || []).flatMap(
              ({ sourceBlockIds }) => sourceBlockIds || []
            )
          ),
        }))
        .filter(
          ({ sourceBlockIds }) =>
            [...sourceBlockIds].some((blockId) =>
              governorBlockIds.has(blockId)
            ) &&
            ![...sourceBlockIds].some((blockId) => itemBlockIds.has(blockId))
        );
      const targets = response.requirements
        .map((requirement, requirementIndex) => ({
          requirement,
          requirementIndex,
        }))
        .filter(({ requirement, requirementIndex }) => {
          if (
            standalone.some(
              (candidate) => candidate.requirementIndex === requirementIndex
            )
          )
            return false;
          return (requirement.components || []).some(({ sourceBlockIds }) =>
            (sourceBlockIds || []).some((blockId) => itemBlockIds.has(blockId))
          );
        });
      if (standalone.length !== 1 || targets.length === 0) return response;
      const [governor] = standalone;
      const movedComponents = governor.requirement.components || [];
      repairs.push({
        unitId: unit.unitId,
        action: "MATERIALIZE_SHARED_LIST_GOVERNOR_COMPONENTS",
        sourceRequirementIndex: governor.requirementIndex,
        targetRequirementIndexes: targets.map(
          ({ requirementIndex }) => requirementIndex
        ),
        governorBlockIds: [...governorBlockIds],
      });
      return {
        ...response,
        requirements: response.requirements.flatMap(
          (requirement, requirementIndex) => {
            if (requirementIndex === governor.requirementIndex) return [];
            if (
              !targets.some(
                (target) => target.requirementIndex === requirementIndex
              )
            )
              return [requirement];
            const existing = new Set(
              (requirement.components || []).map(stableStringify)
            );
            return [
              {
                ...requirement,
                components: [
                  ...(requirement.components || []),
                  ...movedComponents.filter(
                    (component) => !existing.has(stableStringify(component))
                  ),
                ],
              },
            ];
          }
        ),
      };
    }),
    repairs,
  };
}

function endsWithSentence(textValue) {
  return /[.!?][”"')\]]?$/u.test(String(textValue || "").trim());
}

function classificationGovernorContext(previous, current) {
  if (
    !previous ||
    !current ||
    previous.source?.documentUuid !== current.source?.documentUuid ||
    current.governingContext ||
    !Array.isArray(previous.source?.blocks) ||
    previous.source.blocks.length === 0
  )
    return null;
  const previousText = String(previous.source.combinedText || "").trim();
  const embeddedListStart = previous.source.blocks.findIndex(
    ({ exactText }) => String(exactText || "").trim() === "•"
  );
  const continuesEmbeddedList =
    embeddedListStart > 0 && !endsWithSentence(previousText);
  const opensFollowingList =
    previous.unitKind !== "LIST" &&
    current.unitKind === "LIST" &&
    !endsWithSentence(previousText) &&
    /\b(?:Deckung|gedeckt|mitversichert|versichert|Versicherungsschutz)\b/iu.test(
      previousText
    );
  const recoversAdjacentAnaphora =
    ["LIST", "CLAUSE"].includes(current.unitKind) &&
    /\b(?:bis\s+zu\s+)?(?:dies(?:er|e|es|em|en)|derselben)\s+(?:Größe|Höhe|Dauer|Summe|Betrag|Wert|Frist|Anzahl)\b/iu.test(
      String(current.source?.combinedText || "")
    ) &&
    /(?:€\s*)?[0-9]+(?:[.,][0-9]+)?\s*(?:%|€|EUR|Euro|m(?:²|2)?|qm|Tage?|Monate?|Jahre?)\b/iu.test(
      previousText
    );
  if (
    !continuesEmbeddedList &&
    !opensFollowingList &&
    !recoversAdjacentAnaphora
  )
    return null;
  const blocks = continuesEmbeddedList
    ? previous.source.blocks.slice(0, embeddedListStart)
    : previous.source.blocks;
  if (blocks.length === 0) return null;
  const combinedText = blocks.map(({ exactText }) => exactText).join("\n");
  return {
    relationType: continuesEmbeddedList
      ? "RECOVERS_EMBEDDED_LIST_GOVERNOR"
      : opensFollowingList
        ? "RECOVERS_ADJACENT_LIST_GOVERNOR"
        : "RECOVERS_ADJACENT_ANAPHORIC_CONTEXT",
    contractId: CLASSIFICATION_EVIDENCE_CONTEXT_CONTRACT_ID,
    unitIds: [previous.unitId],
    blockIds: blocks.map(({ blockId }) => blockId),
    blocks,
    combinedText,
    combinedTextSha256: sha256(combinedText),
  };
}

function operativeHeadingGovernorContext(heading, current) {
  const headingText = String(heading?.source?.combinedText || "").trim();
  if (
    heading?.unitKind !== "HEADING" ||
    current?.unitKind === "HEADING" ||
    heading.source?.documentUuid !== current?.source?.documentUuid ||
    String(current?.structurePath?.at(-1) || "").trim() !== headingText ||
    !/\b(?:ausgeschlossen|mitversichert|nicht\s+versichert|versichert\s+sind|Versicherungsschutz\s+(?:besteht|gilt))\b/iu.test(
      headingText
    )
  )
    return null;
  const existing = current.governingContext;
  const blocks = [...heading.source.blocks, ...(existing?.blocks || [])].filter(
    ({ blockId }, index, entries) =>
      entries.findIndex((candidate) => candidate.blockId === blockId) === index
  );
  const combinedText = blocks.map(({ exactText }) => exactText).join("\n");
  return {
    relationType: existing
      ? "AUGMENTS_WITH_OPERATIVE_HEADING_GOVERNOR"
      : "RECOVERS_OPERATIVE_HEADING_GOVERNOR",
    contractId: CLASSIFICATION_EVIDENCE_CONTEXT_CONTRACT_ID,
    unitIds: [...new Set([heading.unitId, ...(existing?.unitIds || [])])],
    blockIds: blocks.map(({ blockId }) => blockId),
    blocks,
    combinedText,
    combinedTextSha256: sha256(combinedText),
  };
}

function deriveClassificationEvidencePlan(plan) {
  const units = plan.units.map((unit) => ({ ...unit }));
  const contentUnitsByDocument = new Map();
  for (const unit of units) {
    if (unit.unitKind === "METADATA") continue;
    const documentUuid = unit.source?.documentUuid;
    const entries = contentUnitsByDocument.get(documentUuid) || [];
    entries.push(unit);
    contentUnitsByDocument.set(documentUuid, entries);
  }
  let recoveredContexts = 0;
  for (const contentUnits of contentUnitsByDocument.values())
    for (let index = 1; index < contentUnits.length; index += 1) {
      const current = contentUnits[index];
      const context = classificationGovernorContext(
        contentUnits[index - 1],
        current
      );
      if (!context) continue;
      current.governingContext = context;
      recoveredContexts += 1;
    }
  for (const contentUnits of contentUnitsByDocument.values()) {
    let activeHeading = null;
    for (const current of contentUnits) {
      if (current.unitKind === "HEADING") {
        activeHeading = current;
        continue;
      }
      const context = operativeHeadingGovernorContext(activeHeading, current);
      if (!context) continue;
      current.governingContext = context;
      recoveredContexts += 1;
    }
  }
  return {
    ...plan,
    units,
    classificationEvidenceContext: {
      contractId: CLASSIFICATION_EVIDENCE_CONTEXT_CONTRACT_ID,
      recoveredContexts,
    },
  };
}

function classificationBatch(plan, batch) {
  const units = new Map(plan.units.map((unit) => [unit.unitId, unit]));
  return {
    ...batch,
    units: batch.expectedUnitIds.map((unitId) => {
      const unit = units.get(unitId);
      if (!unit)
        throw new Error(`LF_A_CLASSIFICATION_CONTEXT_UNIT_MISSING:${unitId}`);
      return unit;
    }),
  };
}

function prompt(batch) {
  return [
    {
      role: "system",
      content:
        'Du zerlegst ausschließlich die übergebenen Originaleinheiten eines österreichischen Gebäudeversicherungs-Referenzpakets A. Erfinde keine IDs, Kurzbezeichnungen oder Textparaphrasen. Antworte nur als JSON-Array mit exakt einem Objekt je expectedUnitId und keiner weiteren ID. Jede operative Aussage wird in eine oder mehrere atomare Anforderungen zerlegt. Physische Textblöcke oder Seitenumbrüche sind keine fachlichen Elementgrenzen. Jedes logicalSourceSegments-Element vom Typ LIST_ITEM_WITH_CONTINUATIONS ist genau ein zusammenhängender Listenpunkt und erzeugt genau eine eigene Anforderung: Alle seine blockIds müssen gemeinsam in dieser einen Anforderung vorkommen; teile ihn nie nach Zeile oder Seite und vereinige nie zwei segmentIds in einer Anforderung. primaryClass muss immer auch wortgleich in semanticClasses enthalten sein. displayLabel muss ein wörtlicher, zusammenhängender Teilstring aus originalText sein; kopiere ihn exakt, statt einen Titel zu formulieren. Jede Anforderung enthält ausschließlich displayLabel und components, keine weiteren Felder. Komponenten enthalten type, label, sourceBlockIds und optional rawValue, unit, coverageEffect, qualifier. label ist immer ein nichtleerer wörtlicher Teilstring. rawValue, unit und qualifier müssen, wenn gesetzt, jeweils wörtliche Teilstrings mindestens eines in sourceBlockIds referenzierten sourceBlocks sein. Komponenten dürfen ausschließlich evidenceSourceBlockIds zitieren. ownedSourceBlockIds gehören der Einheit; governingContext enthält ausschließlich serverseitig verknüpfte, vorangestellte Listengovernor-Evidenz. Verwende deren wörtliche Deckungswirkung für abhängige Listenpunkte. Beispielstruktur für einen versicherten Listenpunkt: components:[{type:"OBJECT",label:"<wörtlicher Listenpunkt>",sourceBlockIds:["<Listenblock>"]},{type:"COVERAGE_EFFECT",label:"mitversichert",sourceBlockIds:["<Governorblock>"],coverageEffect:"INCLUDED"}]. OBJECT enthält niemals coverageEffect. coverageEffect ist nur bei type COVERAGE_EFFECT erlaubt, dort verpflichtend und exakt einer der Enumwerte INCLUDED, EXCLUDED, CONDITIONAL, OPTIONAL, UNKNOWN; das deutsche Quellwort steht ausschließlich in label. COVERAGE_EFFECT.label muss ein nichtleerer wörtlicher Wirkungsausdruck aus der Quelle sein, zum Beispiel „versichert“, „nicht versichert“, „gilt“ oder „ausgeschlossen“. Bei jeder operativen Einheit muss die Vereinigungsmenge aller components.sourceBlockIds mindestens alle ownedSourceBlockIds der Einheit enthalten. Referenziere auch einleitende Klausel-Governor wie „Versicherungsschutz ... besteht unter der“, selbst wenn die eigentliche Bedingung im Folgeblock steht. Deckungskonzept-/Produkttitel und Firmenrollen auf einem Deckblatt verwenden primaryClass DEFINITION und semanticClasses ["DEFINITION"] mit SCOPE- und FACT_ROLE-Komponenten oder sind vollständig nichtoperativ; SCOPE und FACT_ROLE sind niemals primaryClass oder semanticClasses. Auch der Titelblock muss bei einer operativen Misch-Unit durch eine Komponente zitiert sein. Reine Überschriften/Struktur/Metadaten/Duplikate erzeugen keine Anforderungen. Wenn keine sichere Klassifikation möglich ist, verwende UNRESOLVED. primaryClass und semanticClasses dürfen nur folgende Werte enthalten: OPERATIVE_COVERAGE_STATEMENT, EXCLUSION, INSURED_OBJECT, PERIL_OR_DAMAGE, DEFINITION, CONDITION, COST, LIMIT, DEDUCTIBLE, OBLIGATION, DURATION, VARIANT, DOCUMENT_PRECEDENCE_OR_REPLACEMENT, STRUCTURE, METADATA, DUPLICATE, UNRESOLVED. Komponentenwerte wie OBJECT, SCOPE und FACT_ROLE sind dort verboten. type darf nur sein: OBJECT, PERIL_OR_CAUSE, DAMAGE_OR_EFFECT, COVERAGE_EFFECT, SCOPE, FACT_ROLE, CONDITION, VALUE_AND_UNIT, LIMIT_BASIS, DEDUCTIBLE, TEMPORAL_VALIDITY, DOCUMENT_ROLE, PRECEDENCE_OR_REPLACEMENT. Terminalklassen sind keine Komponententypen. Verwende für INSURED_OBJECT→OBJECT, PERIL_OR_DAMAGE→PERIL_OR_CAUSE oder DAMAGE_OR_EFFECT, DEFINITION→FACT_ROLE, CONDITION und OBLIGATION→CONDITION, COST→FACT_ROLE oder VALUE_AND_UNIT, LIMIT mit konkreter Zahl→VALUE_AND_UNIT samt rawValue, LIMIT ohne konkrete Zahl→LIMIT_BASIS, DURATION→TEMPORAL_VALIDITY, VARIANT→SCOPE sowie DOCUMENT_PRECEDENCE_OR_REPLACEMENT→PRECEDENCE_OR_REPLACEMENT. Es gibt insbesondere niemals type VARIANT, OBLIGATION, LIMIT, COST oder DURATION. Vertragsrollen wie Versicherungsnehmer, Verwalter, Makler oder Treuhänder sind FACT_ROLE unter DEFINITION, niemals INSURED_OBJECT. INSURED_OBJECT bezeichnet das versicherte Sachobjekt wie Gebäude oder Nebengebäude und braucht OBJECT. OPERATIVE_COVERAGE_STATEMENT gilt nur für tatsächliche Deckungswirkung und braucht COVERAGE_EFFECT; administrative Vermerkspflichten, Voraussetzungen oder Betreuung sind CONDITION beziehungsweise OBLIGATION und keine Deckungswirkung. Eine bloße Aufzählung von Versicherungssparten mit Versicherungssumme und gewählter Variante, aber ohne wörtlichen Deckungswirkungsausdruck, ist LIMIT/VARIANT und keine OPERATIVE_COVERAGE_STATEMENT. Gib jede komma-getrennte Sparte als eigene SCOPE-Komponente aus; „gilt“ in „in der Sparte ... gilt die Variante“ ist kein COVERAGE_EFFECT. VALUE_AND_UNIT braucht immer ein wörtliches rawValue; LIMIT_BASIS bezeichnet eine Bezugsgröße ohne konkrete Zahl. DEDUCTIBLE braucht DEDUCTIBLE. Ausgabeform je Einheit exakt: {unitId,primaryClass,semanticClasses,requirements}.',
    },
    {
      role: "system",
      content:
        "Präzisierung: Eine reine unitKind-HEADING-Unit ist immer STRUCTURE mit requirements:[], auch wenn sie einen Produktnamen enthält. Nur eine gemischte Nicht-HEADING-Unit, die Titeltext und Firmenrollen gemeinsam besitzt, wird als DEFINITION mit SCOPE-/FACT_ROLE-Komponenten abgebildet. Wenn governingContext null ist und in den ownedSourceBlocks kein wörtliches Deckungswirkungswort steht, klassifiziere eine Objektliste als INSURED_OBJECT mit OBJECT-Komponenten ohne COVERAGE_EFFECT. Erfinde insbesondere niemals das label versichert und suche keinen Ersatzbeleg in einem anderen Listenelement. Nennt COMPONENT_SOURCE_TEXT_INVALID konkrete blockIds, muss die korrigierte Komponente diese IDs zusätzlich ausdrücklich in sourceBlockIds aufnehmen; der Server ergänzt sie niemals still.",
    },
    {
      role: "system",
      content:
        "Verbindliche Atomisierungspräzisierung: Ein Komponentenlabel ist der kürzeste zusammenhängende wörtliche Quellteil, der genau die eigene semantische Dimension noch eindeutig bezeichnet. Kopiere niemals vorsorglich den ganzen Satz oder Listenpunkt in OBJECT, PERIL_OR_CAUSE, DAMAGE_OR_EFFECT, COVERAGE_EFFECT, FACT_ROLE, VALUE_AND_UNIT oder LIMIT_BASIS, wenn darin eigenständige Inhalte anderer Typen enthalten sind. Das frühere Platzhalterbeispiel <wörtlicher Listenpunkt> bedeutet daher den kürzesten wörtlichen Objektteil innerhalb dieses Listenpunkts, nicht automatisch den vollständigen Listenpunkt. Trenne Deckungswirkung, Objekt, Gefahr/Ursache, Schaden/Wirkung, Bedingung, Rollenbezeichnung, konkrete Zahl samt Einheit und Limitbasis in eigene Komponenten. Ein Komponentenlabel darf das Label einer anders typisierten Schwesterkomponente nur enthalten, wenn kein kürzerer zusammenhängender Quellteil die eigene Dimension eindeutig ausdrückt. Koordinierte Aufzählungen desselben Typs werden in einzelne Komponenten zerlegt, wenn jedes Element fachlich selbstständig in B gesucht und gefunden werden kann; untrennbare zusammengesetzte Begriffe und bloße Synonyme bleiben zusammen. FACT_ROLE bezeichnet die konkrete fachliche Rolle oder Leistungsart und lässt separat typisierte Bedingungen, Werte und Limitbasen weg. VALUE_AND_UNIT.label und rawValue enthalten den konkreten Wertausdruck; LIMIT_BASIS enthält nur die wörtliche Bezugsgröße. Komponenten müssen gemeinsam weiterhin alle operativen ownedSourceBlockIds belegen. Wenn eine fachlich saubere wörtliche Trennung wegen Grammatik oder Quellfragmentierung nicht sicher möglich ist, verwende UNRESOLVED statt eines überbreiten Sammellabels.",
    },
    {
      role: "system",
      content:
        "Produkt- und Tarifkonfigurationen sind keine versicherten Sachobjekte: Eine Aussage wie Grund- oder Basisdeckung ist Produkt/Tarif X mit Variante Y wird als DEFINITION und bei genannter Variante zusätzlich VARIANT klassifiziert, mit getrennten FACT_ROLE- und SCOPE-Komponenten. Verwende INSURED_OBJECT/OBJECT nur für das tatsächlich versicherte Sachobjekt wie Gebäude, Nebengebäude oder technische Anlage, niemals allein für den Namen oder die Konfiguration eines Versicherungsprodukts.",
    },
    {
      role: "system",
      content:
        "Explizite Geltungsbereichsangaben wie „mit der Variante …“ sowie „in den jeweils beantragten/vereinbarten Sparten“ sind SCOPE-Komponenten und niemals FACT_ROLE oder OBJECT. Mehrere getrennte Scope-Angaben derselben Requirement bleiben mehrere source-bound SCOPE-Komponenten.",
    },
    {
      role: "system",
      content:
        "Eine positive Auswahlregel, wonach im Schaden-, Versicherungs- oder Kollisionsfall die bessere, günstigere oder weitergehende Deckung/Regelung/Leistung gilt, ist DOCUMENT_PRECEDENCE_OR_REPLACEMENT. Gib den wörtlichen günstigeren Regelgegenstand als PRECEDENCE_OR_REPLACEMENT und Begünstigten- sowie Fallscope getrennt als SCOPE aus. Eine negierte Aussage ist von dieser Regel ausdrücklich nicht erfasst.",
    },
    {
      role: "system",
      content:
        "In einer durch sofern/wenn/falls/vorausgesetzt/soweit eingeleiteten Eigentums-, Zuordnungs- oder Wiederbeschaffungsbedingung sind Parteien wie Versicherungsnehmer, Eigentümer, Mieter oder Pächter und Handlungen wie Wiederbeschaffung/Wiederherstellung niemals versicherte OBJECT-Komponenten. Bilde den vollständigen wörtlichen Bedingungssatz als CONDITION ab und lasse nur die tatsächlich versicherten Sachen als OBJECT stehen.",
    },
    {
      role: "system",
      content:
        "Ein eigenständiger quantifizierter Listengovernor wie „bis zu jeweils 5 % der Gebäudeversicherungssumme auf Erstes Risiko“ ist niemals OBJECT. Bilde den konkreten Wertausdruck als VALUE_AND_UNIT mit rawValue und die Bezugsgröße einschließlich „auf Erstes Risiko“ als LIMIT_BASIS ab. Wenn dieser Governor nachfolgende versicherte Objekte begrenzt, gehören seine Limitkomponenten zu deren jeweiliger Anforderung; die versicherten Sachen bleiben davon getrennte OBJECT-Komponenten.",
    },
    {
      role: "system",
      content:
        "Versicherungssparten und Versicherungsproduktnamen sind keine versicherten Sachen. Eine prädikatlose alleinstehende Spartenbezeichnung ist STRUCTURE. In einem Deckungs-Governor wie „im Rahmen der Feuer-, Sturm- und Leitungswasserversicherung ... mitversichert“ ist jede Sparte eine eigene SCOPE-Komponente; eine genannte Versicherungssumme bleibt LIMIT_BASIS. Kostenarten, Aufwendungen, Miet-/Pacht-/Ertragsausfall oder Mietverlust sind COST mit FACT_ROLE und niemals OBJECT. „subsidiär“ oder „nachrangig“ bezeichnet eine eigene DOCUMENT_PRECEDENCE_OR_REPLACEMENT-Anforderung. „auf Erstes Risiko“ ist LIMIT_BASIS, nicht SCOPE.",
    },
    {
      role: "system",
      content:
        "Koordinierte Kostenaufzählungen werden in getrennte, wörtliche FACT_ROLE-Komponenten atomisiert, soweit die einzelnen Quellfragmente selbstständig suchbar sind. Trenne bei Miet-/Pacht-/Ertragsausfall den Leistungsbegriff als FACT_ROLE von einem ausdrücklich genannten Objekt- oder Nutzungsscope. Bei mehreren Limitstufen bekommt jede konkrete Prozent- oder Geldangabe eine eigene VALUE_AND_UNIT-Komponente; ein zugehöriger Spartensatz ist SCOPE und die gemeinsame Versicherungssumme ist LIMIT_BASIS. OCR-Zeichen wie l oder I in einer Zahl werden nicht still korrigiert, sondern exakt als rawValue zitiert.",
    },
    {
      role: "user",
      content: JSON.stringify({
        contractId: A_CLASSIFICATION_CONTRACT_ID,
        promptContractId: PROMPT_CONTRACT_ID,
        batchId: batch.batchId,
        expectedUnitIds: batch.expectedUnitIds,
        units: batch.units,
      }),
    },
  ];
}

function validateBatchResponses(
  plan,
  batch,
  responses,
  { semanticSignalContractId = A_SEMANTIC_SIGNAL_CONTRACT_ID } = {}
) {
  const manifest = buildADrivenSemanticManifest({
    plan,
    responses,
    semanticSignalContractId,
  });
  const expected = new Set(batch.expectedUnitIds);
  const unitTerminals = manifest.unitTerminals.filter(({ unitId }) =>
    expected.has(unitId)
  );
  const diagnostics = [
    ...manifest.diagnostics.filter(
      ({ unitId, code }) =>
        expected.has(unitId) ||
        ["UNKNOWN_UNIT_ID", "DUPLICATE_UNIT_RESPONSE"].includes(code)
    ),
  ];
  const passed =
    unitTerminals.length === expected.size &&
    unitTerminals.every(
      ({ terminalDisposition }) =>
        terminalDisposition !== "UNRESOLVED_REVIEW_REQUIRED"
    ) &&
    !diagnostics.some(({ code }) =>
      [
        "UNKNOWN_UNIT_ID",
        "DUPLICATE_UNIT_RESPONSE",
        "MISSING_UNIT_RESPONSE",
      ].includes(code)
    );
  return {
    passed,
    diagnostics,
    terminalDispositions: Object.fromEntries(
      unitTerminals.map(({ unitId, terminalDisposition }) => [
        unitId,
        terminalDisposition,
      ])
    ),
  };
}

function envelopeRepairCanStayGrouped(diagnostics, pendingUnitIds) {
  const pending = new Set(pendingUnitIds);
  const relevant = diagnostics.filter(({ unitId }) => pending.has(unitId));
  return (
    relevant.length === pending.size &&
    relevant.every(
      ({ code, reasons }) =>
        code === "INVALID_UNIT_CLASSIFICATION" &&
        Array.isArray(reasons) &&
        reasons.length > 0 &&
        reasons.every((reason) =>
          [
            "PRIMARY_CLASS_MISSING_FROM_SEMANTIC_CLASSES",
            "SEMANTIC_CLASSES_INVALID_OR_EMPTY",
          ].includes(reason)
        )
    )
  );
}

async function verifyModel({ baseUrl, model, modelContext }) {
  const apiRoot = baseUrl.replace(/\/v1\/?$/u, "");
  const response = await fetch(`${apiRoot}/api/v0/models`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok)
    throw new Error(`LF_A_CLASSIFICATION_MODEL_LIST_FAILED:${response.status}`);
  const body = await response.json();
  const loaded = body?.data?.find(
    ({ id, type, state }) =>
      id === model && type === "llm" && state === "loaded"
  );
  if (!loaded || Number(loaded.loaded_context_length) !== Number(modelContext))
    throw new Error(
      `LF_A_CLASSIFICATION_MODEL_NOT_EXACTLY_LOADED:${model}:${modelContext}`
    );
  return {
    id: loaded.id,
    state: loaded.state,
    loadedContextLength: Number(loaded.loaded_context_length),
  };
}

function createLmStudioRecovery({
  baseUrl,
  model,
  modelContext,
  lmStudioSdk,
  qwenModelKey,
  modelRecoveryTimeoutMs,
}) {
  const unloadScript = path.resolve(
    __dirname,
    "../../../scripts/macos/unload-lmstudio-model.cjs"
  );
  const loadScript = path.resolve(
    __dirname,
    "../../../scripts/macos/load-qwen36.cjs"
  );
  return async ({ requestSettledAfterAbort }) => {
    const started = performance.now();
    await execFile(process.execPath, [unloadScript, lmStudioSdk, model], {
      timeout: modelRecoveryTimeoutMs,
      maxBuffer: 1024 * 1024,
    });
    await execFile(
      process.execPath,
      [loadScript, lmStudioSdk, qwenModelKey, model],
      {
        timeout: modelRecoveryTimeoutMs,
        maxBuffer: 1024 * 1024,
      }
    );
    const verified = await verifyModel({ baseUrl, model, modelContext });
    return {
      status: "SAFE_RELOADED",
      method: "TARGETED_UNLOAD_RELOAD_AND_EXACT_MODEL_VERIFY",
      requestSettledAfterAbort,
      durationMs: Math.round(performance.now() - started),
      verified,
    };
  };
}

function existingBatchResult(file, plan, batch, args) {
  const result = readJson(file, "LF_A_CLASSIFICATION_BATCH_RESULT");
  const validationBatch =
    result?.classificationEvidenceContextContractId ===
    CLASSIFICATION_EVIDENCE_CONTEXT_CONTRACT_ID
      ? classificationBatch(plan, batch)
      : batch;
  const expectedPromptSha256 = sha256(JSON.stringify(prompt(validationBatch)));
  if (
    result?.contractId !== RUN_CONTRACT_ID ||
    result.sourceUnitPlanSha256 !== plan.planSha256 ||
    result.batchId !== batch.batchId ||
    result.promptContractId !== PROMPT_CONTRACT_ID ||
    result.promptSha256 !== expectedPromptSha256 ||
    result.validatorContractId !== A_DYNAMIC_MANIFEST_CONTRACT_ID ||
    result.semanticSignalContractId !== A_SEMANTIC_SIGNAL_CONTRACT_ID ||
    result.requestedModel !== args.model ||
    result.modelContext !== args.modelContext ||
    result.batchIndex !== batch.batchIndex ||
    stableStringify(result.expectedUnitIds) !==
      stableStringify(batch.expectedUnitIds) ||
    !Array.isArray(result.responses) ||
    typeof result.rawResponse !== "string" ||
    result.rawResponseSha256 !== sha256(result.rawResponse)
  )
    throw new Error("LF_A_CLASSIFICATION_BATCH_RESULT_BINDING_INVALID");
  const normalizedResponses = normalizeUnambiguousComponentTypes(
    result.responses,
    plan.units
  ).responses;
  if (
    stableStringify(normalizedResponses) !== stableStringify(result.responses)
  )
    throw new Error("LF_A_CLASSIFICATION_BATCH_RESULT_VALIDATION_INVALID");
  const validation = validateBatchResponses(
    plan,
    validationBatch,
    normalizedResponses
  );
  if (stableStringify(validation) !== stableStringify(result.validation))
    throw new Error("LF_A_CLASSIFICATION_BATCH_RESULT_VALIDATION_INVALID");
  if (!validation.passed)
    throw new Error("LF_A_CLASSIFICATION_BATCH_RESULT_NOT_PASS");
  return result;
}

function predecessorBatchResponses(file, plan, batch, args) {
  const result = readJson(file, "LF_A_CLASSIFICATION_PREDECESSOR_BATCH_RESULT");
  if (
    !RESUMABLE_PREDECESSOR_RUN_CONTRACT_IDS.has(result?.contractId) ||
    result.sourceUnitPlanSha256 !== plan.planSha256 ||
    result.batchId !== batch.batchId ||
    result.batchIndex !== batch.batchIndex ||
    !RESUMABLE_PREDECESSOR_PROMPT_CONTRACT_IDS.has(result.promptContractId) ||
    result.validatorContractId !== A_DYNAMIC_MANIFEST_CONTRACT_ID ||
    result.requestedModel !== args.model ||
    result.modelContext !== args.modelContext ||
    stableStringify(result.expectedUnitIds) !==
      stableStringify(batch.expectedUnitIds) ||
    !Array.isArray(result.responses) ||
    typeof result.rawResponse !== "string" ||
    result.rawResponseSha256 !== sha256(result.rawResponse)
  )
    throw new Error("LF_A_CLASSIFICATION_PREDECESSOR_BINDING_INVALID");
  return result.responses;
}

function createAttemptRecorder({ output, plan, batch, args }) {
  const batchStem = `${String(batch.batchIndex).padStart(4, "0")}-${batch.batchId}`;
  const directory = path.join(output, "attempts", batchStem);
  const existing = fs.existsSync(directory)
    ? fs
        .readdirSync(directory)
        .map((name) => /^cycle-(\d+)-attempt-\d+\.private\.json$/u.exec(name))
        .filter(Boolean)
        .map((match) => Number(match[1]))
    : [];
  const cycle = (existing.length ? Math.max(...existing) : 0) + 1;
  return async (attempt) => {
    const file = path.join(
      directory,
      `cycle-${String(cycle).padStart(4, "0")}-attempt-${String(
        attempt.attempt
      ).padStart(2, "0")}.private.json`
    );
    writePrivateJson(file, {
      schemaVersion: 1,
      contractId: TRANSPORT_CONTRACT_ID,
      sourceUnitPlanSha256: plan.planSha256,
      promptContractId: PROMPT_CONTRACT_ID,
      semanticSignalContractId: A_SEMANTIC_SIGNAL_CONTRACT_ID,
      classificationEvidenceContextContractId:
        CLASSIFICATION_EVIDENCE_CONTEXT_CONTRACT_ID,
      requestedModel: args.model,
      modelContext: args.modelContext,
      requestTimeoutMs: args.requestTimeoutMs,
      abortSettlementTimeoutMs: args.abortSettlementTimeoutMs,
      batchIndex: batch.batchIndex,
      batchId: batch.batchId,
      resumeCycle: cycle,
      recordedAt: new Date().toISOString(),
      attempt,
    });
  };
}

function acceptedResponsesFromAttemptJournal({ output, plan, batch, args }) {
  const directory = path.join(
    output,
    "attempts",
    `${String(batch.batchIndex).padStart(4, "0")}-${batch.batchId}`
  );
  if (!fs.existsSync(directory)) return [];
  const accepted = new Map();
  for (const name of fs.readdirSync(directory).sort()) {
    if (!/^cycle-\d+-attempt-\d+\.private\.json$/u.test(name)) continue;
    const artifact = readJson(
      path.join(directory, name),
      "LF_A_CLASSIFICATION_ATTEMPT"
    );
    if (
      artifact?.contractId !== TRANSPORT_CONTRACT_ID ||
      artifact?.sourceUnitPlanSha256 !== plan.planSha256 ||
      artifact.promptContractId !== PROMPT_CONTRACT_ID ||
      !RESUMABLE_SEMANTIC_SIGNAL_CONTRACT_IDS.has(
        artifact.semanticSignalContractId
      ) ||
      artifact.requestedModel !== args.model ||
      artifact.modelContext !== args.modelContext ||
      artifact.batchIndex !== batch.batchIndex ||
      artifact.batchId !== batch.batchId ||
      !Array.isArray(artifact.attempt?.responses)
    )
      continue;
    const journalResponses = normalizeUnambiguousComponentTypes(
      mergeCompatibleDuplicateUnitResponses(artifact.attempt.responses)
        .responses,
      plan.units
    ).responses;
    for (const response of journalResponses) {
      if (accepted.has(response?.unitId)) continue;
      const unit = batch.units.find(
        ({ unitId }) => unitId === response?.unitId
      );
      if (!unit) continue;
      const singleUnitBatch = {
        ...batch,
        expectedUnitIds: [unit.unitId],
        units: [unit],
      };
      const validation = validateBatchResponses(plan, singleUnitBatch, [
        response,
      ]);
      if (validation.passed) accepted.set(unit.unitId, response);
    }
  }
  return batch.expectedUnitIds
    .filter((unitId) => accepted.has(unitId))
    .map((unitId) => accepted.get(unitId));
}

function currentlyValidResponses(plan, batch, responses) {
  const accepted = new Map();
  const normalizedResponses = normalizeUnambiguousComponentTypes(
    Array.isArray(responses) ? responses : [],
    plan.units
  ).responses;
  for (const response of normalizedResponses) {
    if (accepted.has(response?.unitId)) continue;
    const unit = batch.units.find(({ unitId }) => unitId === response?.unitId);
    if (!unit) continue;
    const validation = validateBatchResponses(
      plan,
      { ...batch, expectedUnitIds: [unit.unitId], units: [unit] },
      [response]
    );
    if (validation.passed) accepted.set(unit.unitId, response);
  }
  return batch.expectedUnitIds
    .filter((unitId) => accepted.has(unitId))
    .map((unitId) => accepted.get(unitId));
}

function archiveSupersededBatchResult(file, output, batch, reason) {
  const raw = fs.readFileSync(file, "utf8");
  const directory = path.join(output, "superseded-batches");
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const target = path.join(
    directory,
    `${String(batch.batchIndex).padStart(4, "0")}-${batch.batchId}.${reason.toLowerCase()}.${sha256(raw).slice(0, 16)}.private.json`
  );
  if (fs.existsSync(target))
    throw new Error(`LF_A_CLASSIFICATION_SUPERSEDED_OUTPUT_EXISTS:${target}`);
  fs.renameSync(file, target);
  fs.chmodSync(target, 0o600);
  return { responses: readJson(target, "LF_A_SUPERSEDED_BATCH").responses };
}

function responsesFromSupersededBatchArtifacts({ output, plan, batch, args }) {
  const directory = path.join(output, "superseded-batches");
  if (!fs.existsSync(directory)) return [];
  const stem = `${String(batch.batchIndex).padStart(4, "0")}-${batch.batchId}.`;
  return fs
    .readdirSync(directory)
    .filter((name) => name.startsWith(stem) && name.endsWith(".private.json"))
    .sort()
    .flatMap((name) => {
      const file = path.join(directory, name);
      const artifact = readJson(file, "LF_A_CLASSIFICATION_SUPERSEDED_BATCH");
      const validationBatch =
        artifact?.classificationEvidenceContextContractId ===
        CLASSIFICATION_EVIDENCE_CONTEXT_CONTRACT_ID
          ? classificationBatch(plan, batch)
          : batch;
      const recognizedContract =
        artifact?.contractId === RUN_CONTRACT_ID ||
        RESUMABLE_PREDECESSOR_RUN_CONTRACT_IDS.has(artifact?.contractId);
      if (
        !recognizedContract ||
        artifact.sourceUnitPlanSha256 !== plan.planSha256 ||
        artifact.batchId !== batch.batchId ||
        artifact.batchIndex !== batch.batchIndex ||
        artifact.promptContractId !== PROMPT_CONTRACT_ID ||
        artifact.promptSha256 !==
          sha256(JSON.stringify(prompt(validationBatch))) ||
        artifact.validatorContractId !== A_DYNAMIC_MANIFEST_CONTRACT_ID ||
        artifact.requestedModel !== args.model ||
        artifact.modelContext !== args.modelContext ||
        stableStringify(artifact.expectedUnitIds) !==
          stableStringify(batch.expectedUnitIds) ||
        !Array.isArray(artifact.responses) ||
        typeof artifact.rawResponse !== "string" ||
        artifact.rawResponseSha256 !== sha256(artifact.rawResponse)
      )
        return [];
      return artifact.responses;
    });
}

function validateCompletedRun({ args, plan, batches, summaryFile }) {
  const summary = readJson(summaryFile, "LF_A_CLASSIFICATION_SUMMARY");
  if (
    summary?.contractId !== RUN_CONTRACT_ID ||
    summary.sourceUnitPlanSha256 !== plan.planSha256 ||
    summary.promptContractId !== PROMPT_CONTRACT_ID ||
    summary.validatorContractId !== A_DYNAMIC_MANIFEST_CONTRACT_ID ||
    summary.semanticSignalContractId !== A_SEMANTIC_SIGNAL_CONTRACT_ID ||
    summary.classificationBatchesSha256 !== sha256(JSON.stringify(batches)) ||
    summary.model?.id !== args.model ||
    summary.model?.loadedContextLength !== args.modelContext ||
    summary.batches !== batches.batches.length
  )
    throw new Error("LF_A_CLASSIFICATION_SUMMARY_BINDING_INVALID");
  const batchResults = batches.batches.map((batch) =>
    existingBatchResult(
      path.join(
        args.output,
        "batches",
        `${String(batch.batchIndex).padStart(4, "0")}-${batch.batchId}.private.json`
      ),
      plan,
      batch,
      args
    )
  );
  const responses = batchResults.flatMap(({ responses: items }) => items);
  const storedResponses = readJson(
    path.join(args.output, "responses.private.json"),
    "LF_A_CLASSIFICATION_RESPONSES"
  );
  if (stableStringify(responses) !== stableStringify(storedResponses))
    throw new Error("LF_A_CLASSIFICATION_RESPONSES_BINDING_INVALID");
  const manifest = buildADrivenSemanticManifest({
    plan,
    responses,
    semanticSignalContractId: A_SEMANTIC_SIGNAL_CONTRACT_ID,
  });
  const storedManifest = readJson(
    path.join(args.output, "dynamic-semantic-manifest.private.json"),
    "LF_A_CLASSIFICATION_MANIFEST"
  );
  if (stableStringify(manifest) !== stableStringify(storedManifest))
    throw new Error("LF_A_CLASSIFICATION_MANIFEST_BINDING_INVALID");
  const expectedCounts = {
    validBatches: batchResults.filter(({ validation }) => validation.passed)
      .length,
    unresolvedBatches: batchResults.filter(
      ({ validation }) => !validation.passed
    ).length,
    semanticRequirements: manifest.summary.semanticRequirements,
    semanticComponents: manifest.summary.semanticComponents,
    unresolvedUnits: manifest.summary.unresolvedUnits,
    reviewRequiredBlocks: manifest.summary.reviewRequiredBlocks,
    allBlocksTerminal: manifest.summary.allBlocksTerminal,
    responseIntegrityStatus: manifest.summary.responseIntegrityStatus,
  };
  for (const [key, value] of Object.entries(expectedCounts))
    if (summary[key] !== value)
      throw new Error(`LF_A_CLASSIFICATION_SUMMARY_COUNT_INVALID:${key}`);
  return summary;
}

async function runBatch({
  client,
  model,
  modelContext,
  plan,
  batch,
  maximumAttempts,
  requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  abortSettlementTimeoutMs = DEFAULT_ABORT_SETTLEMENT_TIMEOUT_MS,
  recoverModelAfterAbort = async () => ({ status: "SAFE_TEST_DOUBLE" }),
  onAttempt = async () => {},
  initialAcceptedResponses = [],
}) {
  const acceptedResponses = new Map(
    initialAcceptedResponses.map((response) => [response.unitId, response])
  );
  const initiallyPendingUnitIds = batch.expectedUnitIds.filter(
    (unitId) => !acceptedResponses.has(unitId)
  );
  const attemptsByUnit = new Map(
    initiallyPendingUnitIds.map((unitId) => [unitId, 0])
  );
  let workingBatch = {
    ...batch,
    batchId:
      acceptedResponses.size > 0
        ? `${batch.batchId}-resume-pending`
        : batch.batchId,
    expectedUnitIds: initiallyPendingUnitIds,
    units: batch.units.filter(({ unitId }) =>
      initiallyPendingUnitIds.includes(unitId)
    ),
  };
  let messages = prompt(workingBatch);
  let last = {
    responses: [],
    validation: {
      passed: false,
      diagnostics: [{ code: "NO_MODEL_ATTEMPT" }],
      terminalDispositions: {},
    },
    rawText: "",
    error: null,
  };
  const attempts = [];
  if (initiallyPendingUnitIds.length === 0) {
    const responses = batch.expectedUnitIds.map((unitId) =>
      acceptedResponses.get(unitId)
    );
    const validation = validateBatchResponses(plan, batch, responses);
    return {
      schemaVersion: 1,
      contractId: RUN_CONTRACT_ID,
      sourceUnitPlanSha256: plan.planSha256,
      promptContractId: PROMPT_CONTRACT_ID,
      semanticSignalContractId: A_SEMANTIC_SIGNAL_CONTRACT_ID,
      promptSha256: sha256(JSON.stringify(prompt(batch))),
      validatorContractId: A_DYNAMIC_MANIFEST_CONTRACT_ID,
      requestedModel: model,
      modelContext,
      transportContractId: TRANSPORT_CONTRACT_ID,
      requestTimeoutMs,
      abortSettlementTimeoutMs,
      batchId: batch.batchId,
      batchIndex: batch.batchIndex,
      expectedUnitIds: batch.expectedUnitIds,
      responses,
      validation,
      rawResponseSha256: sha256(""),
      rawResponse: "",
      error: null,
      attempts,
      resumedAcceptedUnits: acceptedResponses.size,
    };
  }
  const maximumRequestCalls = initiallyPendingUnitIds.length * maximumAttempts;
  for (let attempt = 1; attempt <= maximumRequestCalls; attempt += 1) {
    if (
      workingBatch.expectedUnitIds.some(
        (unitId) => (attemptsByUnit.get(unitId) || 0) >= maximumAttempts
      )
    )
      break;
    for (const unitId of workingBatch.expectedUnitIds)
      attemptsByUnit.set(unitId, (attemptsByUnit.get(unitId) || 0) + 1);
    const started = performance.now();
    let observedRawText = "";
    let observedResponses = [];
    try {
      const messagesSha256 = sha256(JSON.stringify(messages));
      const completion = await requestCompletionWithTimeout({
        client,
        payload: {
          model,
          messages,
          temperature: 0,
          max_tokens: 12_000,
        },
        requestTimeoutMs,
        abortSettlementTimeoutMs,
        recoverModelAfterAbort,
      });
      const rawText = completion.choices?.[0]?.message?.content || "";
      observedRawText = rawText;
      const parsed = parseJsonArray(rawText);
      const fragmentRepair = attachTopLevelRequirementFragments(
        parsed.responses,
        workingBatch.expectedUnitIds
      );
      const duplicateRepair = mergeCompatibleDuplicateUnitResponses(
        fragmentRepair.responses
      );
      const mergedResponsesFromEnvelope = duplicateRepair.responses;
      const envelopeRepair =
        fragmentRepair.envelopeRepair || duplicateRepair.envelopeRepair;
      const { responses, componentRepairs } =
        normalizeUnambiguousComponentTypes(
          mergedResponsesFromEnvelope,
          plan.units
        );
      const { syntaxRepair } = parsed;
      observedResponses = responses;
      const workingValidation = validateBatchResponses(
        plan,
        workingBatch,
        responses
      );
      for (const unitId of workingBatch.expectedUnitIds) {
        if (
          workingValidation.terminalDispositions[unitId] ===
          "UNRESOLVED_REVIEW_REQUIRED"
        )
          continue;
        const records = responses.filter(
          (response) => response.unitId === unitId
        );
        if (records.length === 1) acceptedResponses.set(unitId, records[0]);
      }
      const pendingUnitIds = batch.expectedUnitIds.filter(
        (unitId) => !acceptedResponses.has(unitId)
      );
      const pendingResponses = responses.filter(({ unitId }) =>
        pendingUnitIds.includes(unitId)
      );
      const mergedResponses = batch.expectedUnitIds.flatMap((unitId) => {
        if (acceptedResponses.has(unitId))
          return [acceptedResponses.get(unitId)];
        return pendingResponses.filter(
          (response) => response.unitId === unitId
        );
      });
      const validation = validateBatchResponses(plan, batch, mergedResponses);
      const groupedEnvelopeRepair = envelopeRepairCanStayGrouped(
        validation.diagnostics,
        pendingUnitIds
      );
      const semanticRetryUnitIds =
        pendingUnitIds.length > 1 &&
        !workingBatch.batchId.includes("-timeout-split-") &&
        !groupedEnvelopeRepair
          ? [pendingUnitIds[0]]
          : pendingUnitIds;
      const attemptRecord = {
        attempt,
        requestedUnitIds: workingBatch.expectedUnitIds,
        unitAttempts: Object.fromEntries(
          workingBatch.expectedUnitIds.map((unitId) => [
            unitId,
            attemptsByUnit.get(unitId),
          ])
        ),
        messagesSha256,
        durationMs: Math.round(performance.now() - started),
        errorClass: null,
        timedOut: false,
        abortTriggered: false,
        responseModel: completion.model || null,
        promptTokens: completion.usage?.prompt_tokens || 0,
        completionTokens: completion.usage?.completion_tokens || 0,
        totalTokens: completion.usage?.total_tokens || 0,
        parsedResponses: responses.length,
        rawResponseSha256: sha256(rawText),
        rawResponse: rawText,
        syntaxRepair,
        envelopeRepair,
        componentRepairs,
        responses,
        acceptedUnits: acceptedResponses.size,
        pendingUnits: pendingUnitIds.length,
        semanticRetryUnitIds,
        semanticRetryStrategy: groupedEnvelopeRepair
          ? "GROUPED_ENVELOPE_REPAIR"
          : semanticRetryUnitIds.length < pendingUnitIds.length
            ? "SINGLE_UNIT_REPAIR"
            : "ALL_PENDING",
        validationPassed: validation.passed,
        diagnostics: validation.diagnostics,
      };
      attempts.push(attemptRecord);
      await onAttempt(attemptRecord);
      last = { responses: mergedResponses, validation, rawText, error: null };
      if (validation.passed) break;
      if (
        semanticRetryUnitIds.some(
          (unitId) => (attemptsByUnit.get(unitId) || 0) >= maximumAttempts
        )
      )
        break;
      workingBatch = {
        ...batch,
        batchId: `${batch.batchId}-retry-${attempt + 1}`,
        expectedUnitIds: semanticRetryUnitIds,
        units: batch.units.filter(({ unitId }) =>
          semanticRetryUnitIds.includes(unitId)
        ),
      };
      const repairDiagnostics = validation.diagnostics.filter(
        ({ unitId }) => !unitId || semanticRetryUnitIds.includes(unitId)
      );
      messages = [
        ...prompt(workingBatch),
        {
          role: "assistant",
          content: JSON.stringify(pendingResponses),
        },
        {
          role: "user",
          content: `Die Antwort verletzt den Vertrag: ${JSON.stringify(
            repairDiagnostics
          )}. Korrigiere ausschließlich das JSON-Array. Verwende exakt alle expectedUnitIds einmal und keine unbekannten IDs. primaryClass muss in semanticClasses enthalten sein. Nennt INVALID_UNIT_CLASSIFICATION den Grund PRIMARY_CLASS_MISSING_FROM_SEMANTIC_CLASSES, kopiere den angegebenen primaryClass-Wert wortgleich zusätzlich in semanticClasses und ändere die bereits gültigen Komponenten nicht. OBJECT, SCOPE, FACT_ROLE und andere component.type-Werte sind niemals primaryClass/semanticClasses. Deckungskonzept-/Produkttitel plus Firmenrollen verwenden DEFINITION mit SCOPE-/FACT_ROLE-Komponenten. Jede in missingRequiredComponentGroups genannte Typgruppe muss durch mindestens eine eigene Komponente erfüllt sein, außer die Diagnose nennt die verursachende Klasse in unsupportedSemanticClasses; dann entferne exakt diese unbelegte Klasse aus primaryClass und semanticClasses und behalte eine andere belegte Klasse als primaryClass. Wenn observedComponentTypes stattdessen OBJECT nennt, ersetze die falsch typisierte OBJECT-Komponente durch PERIL_OR_CAUSE oder DAMAGE_OR_EFFECT; erzeuge dafür keine zusätzliche Requirement. Enthält semanticClasses DEFINITION, ergänze immer eine FACT_ROLE-Komponente mit einem wörtlichen Definitionssignal aus der Quelle, zum Beispiel „ist“, „sind“ oder „gilt als“; enthält dieselbe Unit zusätzlich PERIL_OR_DAMAGE, bleibt dafür eine getrennte PERIL_OR_CAUSE- oder DAMAGE_OR_EFFECT-Komponente erforderlich. Kopiere displayLabel und alle Komponentenfelder exakt aus den referenzierten sourceBlocks; formuliere keine Kurzlabels und entferne keine Wörter, Satzzeichen oder OCR-Zeichen. Nenne in sourceBlockIds jeden Block, aus dem label, rawValue, unit oder qualifier Text übernimmt. Bei COMPONENT_SOURCE_TEXT_INVALID mit requiredSourceBlockIds ersetze sourceBlockIds an exakt dem genannten requirementIndex und componentIndex vollständig durch requiredSourceBlockIds; ändere dabei weder label noch rawValue, unit oder qualifier. Fehlen requiredSourceBlockIds und ist die componentType für keine semanticClass erforderlich, lösche die unbelegte Komponente vollständig; erfinde oder paraphrasiere keinen Ersatz für invalidLiteralValues. Ist dabei componentType COVERAGE_EFFECT und enthält allowedEvidence kein wörtliches Deckungswirkungswort, lösche die unbelegte COVERAGE_EFFECT-Komponente und entferne zugleich OPERATIVE_COVERAGE_STATEMENT aus primaryClass und semanticClasses; behalte eine anderweitig belegte Klasse wie PERIL_OR_DAMAGE, INSURED_OBJECT, CONDITION oder LIMIT samt ihren gültigen Komponenten bei. Bei COMPONENT_SOURCE_BLOCK_ID_OUT_OF_SCOPE darf die korrigierte Komponente ausschließlich IDs aus allowedSourceBlockIds verwenden; entferne jede outOfScopeBlockId oder ersetze sie durch den wörtlich passenden Block aus allowedSourceBlockIds. REQUIREMENT_DISPLAY_LABEL_OUTSIDE_OWNED_SOURCE bedeutet: Lösche die eigene Requirement, deren displayLabel nur aus governingContext stammt, und verschiebe ihre fachlich nötigen Komponenten in die Requirement des abhängigen ownedSourceBlocks. REQUIREMENT_OWNED_BLOCKS_UNCITED und OPERATIVE_UNIT_BLOCK_COVERAGE_INCOMPLETE nennen owned blockIds, für deren fachlichen Text noch keine Komponente existiert; ergänze eine fachlich passende Komponente für genau diese Blöcke. Reine Aufzählungszeichenblöcke benötigen keine Komponente. LIST_CONTINUATION_SEGMENT_SPLIT bedeutet: alle genannten blockIds in genau einer gemeinsamen Anforderung. LIST_SOURCE_SEGMENTS_MERGED bedeutet: jedes genannte segmentId als eigene Anforderung ausgeben. governingContext ist ausschließlich Evidenz für den abhängigen Listenpunkt: Zitiere seinen Wirkungsblock als COVERAGE_EFFECT-Komponente in jeder betroffenen Requirement, aber erzeuge niemals eine eigene Requirement, deren displayLabel nur aus governingContext stammt. Fehlt ein COVERAGE_EFFECT und enthält weder ownedSourceBlocks noch governingContext ein wörtliches Wirkungswort, erfinde keines: Entferne OPERATIVE_COVERAGE_STATEMENT aus primaryClass/semanticClasses und verwende die tatsächlich belegte Rolle LIMIT, DEDUCTIBLE, COST, CONDITION, OBLIGATION oder DEFINITION. Entferne coverageEffect aus jeder OBJECT- oder sonstigen Nicht-COVERAGE_EFFECT-Komponente. Erzeuge bei vorhandenem Wirkungswort stattdessen eine separate Komponente {type:"COVERAGE_EFFECT",label:"<wörtliches Wirkungswort>",sourceBlockIds:["<Belegblock>"],coverageEffect:"INCLUDED|EXCLUDED|CONDITIONAL|OPTIONAL|UNKNOWN"}; der Enumwert ist niemals ein deutsches Wort. Die Vereinigungsmenge aller components.sourceBlockIds muss für jede operative Einheit alle fachlichen ownedSourceBlockIds der Einheit abdecken; vergiss keine einleitenden governingContext-Blöcke. Vertragsrollen sind DEFINITION/FACT_ROLE, keine versicherten Objekte. Administrative Pflichten oder Voraussetzungen sind CONDITION oder OBLIGATION als semanticClass, ihre Komponente hat aber immer type CONDITION. COMPONENT_TYPE_INVALID bedeutet, dass der genannte Terminalklassen-Typ ersetzt werden muss. Terminalklassen wie VARIANT, OBLIGATION, LIMIT, COST und DURATION sind niemals component.type. Ein LIMIT mit konkreter Zahl benötigt VALUE_AND_UNIT samt rawValue; eine Limitbezugsgröße ohne Zahl verwendet LIMIT_BASIS. Bei einer Prozentgrenze bezeichnet VALUE_AND_UNIT die wörtliche Prozentangabe und rawValue wiederholt mindestens deren wörtlichen Zahlenwert; LIMIT_BASIS bezeichnet die wörtliche Bezugsgröße wie „Gebäudeversicherungssumme“. VARIANT verwendet SCOPE.`,
        },
      ];
      messages.at(-1).content +=
        " Präzisierung für gemischte Klassen: Wenn observedComponentTypes OBJECT nennt und semanticClasses zugleich INSURED_OBJECT enthält, behalte die gültige OBJECT-Komponente und ergänze PERIL_OR_CAUSE oder DAMAGE_OR_EFFECT als separate Komponente derselben Requirement. Ersetze OBJECT nur, wenn INSURED_OBJECT weder primaryClass noch semanticClasses ist. Entferne beim Ergänzen einer missingRequiredComponentGroup keine Komponente, die eine andere vorhandene semanticClass weiterhin benötigt. Nennt COMPONENT_SOURCE_BLOCK_ID_OUT_OF_SCOPE zusätzlich requiredSourceBlockIds, ersetze sourceBlockIds der exakt bezeichneten Komponente vollständig und zeichengetreu durch requiredSourceBlockIds; kopiere keine ähnlich aussehende Hash-ID aus der alten Antwort. Nennt COMPONENT_SOURCE_TEXT_INVALID declaredSourceExactText, ersetze jedes invalidLiteralValue der bezeichneten Komponente durch einen wörtlichen zusammenhängenden Teilstring daraus oder durch declaredSourceExactText selbst. Erhalte dabei Zeilenumbrüche, Trennstriche, Mehrfachleerzeichen, Satzzeichen und OCR-Zeichen exakt; dehypheniere und normalisiere nichts. War dasselbe normalisierte Literal zugleich displayLabel, ersetze auch displayLabel durch denselben exakten ownedSourceBlocks-Teilstring. Ändere declaredSourceBlockIds dabei nicht. REQUIREMENT_DISPLAY_LABEL_OUTSIDE_OWNED_SOURCE bedeutet: Ersetze das displayLabel am genannten requirementIndex durch einen exakt kopierten zusammenhängenden Ausschnitt aus allowedEvidence; erhalte insbesondere OCR-Schreibfehler, Leerzeichen und Zeilenumbrüche. REQUIREMENT_SOURCE_TEXT_INVALID bedeutet: Die Vereinigungsmenge der Komponenten-sourceBlockIds dieser Requirement muss jeden Block enthalten, aus dem ihr displayLabel Text übernimmt. Wenn requiredSourceBlockIds angegeben sind, ergänze eine fachlich passende Komponente für den fehlenden Randblock oder verkürze displayLabel auf einen exakt zitierten zusammenhängenden Ausschnitt aus selectedSourceExactText; erfinde keine ID. COVERAGE_EFFECT_LABEL_INVALID bedeutet: Das bisherige label ist keine Deckungswirkung. Verwende ausschließlich einen wörtlichen Wirkungsausdruck samt blockId aus allowedCoverageEffectEvidence. Ist diese Liste leer, lösche die COVERAGE_EFFECT-Komponente und entferne die unbelegte operative Deckungsklasse. Bei einer EXCLUSION bedeutet der wörtliche Ausdruck „ausgenommen sind“ die Deckungswirkung EXCLUDED und ist als eigene COVERAGE_EFFECT-Komponente auszugeben. Eine nummerierte, ausschließlich aus HEADING_CANDIDATE-Blöcken bestehende LIST-Unit ohne eigenes Prädikat oder Wirkungswort ist STRUCTURE mit requirements:[]; übertrage die Wirkung der nachfolgenden Klausel niemals auf diese Überschrift. Eine Regel, die ausschließlich beschreibt, wozu eine Versicherungssumme dient, wie sie aufgeteilt wird oder wonach sich ihre Verteilung richtet, ist DEFINITION mit FACT_ROLE-Komponenten und keine OPERATIVE_COVERAGE_STATEMENT. Eine ausdrückliche Erweiterung der Anwendbarkeit eines Gesetzesparagraphen auf weitere Sparten ist DOCUMENT_PRECEDENCE_OR_REPLACEMENT mit PRECEDENCE_OR_REPLACEMENT-Komponente und keine Deckungswirkung. Wörter wie „angerechnet“, „gelten als verloren“, „Bewertung“, „Ersatzwert“, „Restwert“, „Neuwert“ und „Zeitwert“ beschreiben für sich eine Bewertungs- oder Definitionsregel, keine Deckungswirkung und keine Gefahr. Verwende dafür DEFINITION mit einer wörtlichen FACT_ROLE-Komponente; enthält die Regel eine konkrete Grenze, ergänze LIMIT mit VALUE_AND_UNIT und LIMIT_BASIS. „gilt als vereinbart“ ist nur eine Vereinbarungseinleitung; wenn derselbe Satz die tatsächliche Leistung „Neuwertentschädigung geleistet wird“ enthält, ist ausschließlich dieser Leistungsausdruck der COVERAGE_EFFECT. LIST_GOVERNOR_REQUIREMENT_STANDALONE bedeutet: Lösche die eigenständige Governor-Requirement. Verwende ihren COVERAGE_EFFECT stattdessen in jeder fachlichen Requirement der folgenden Item-Segmente. Der gemeinsame Governor darf in mehreren Requirements zitiert werden; jedes Nicht-Governor-logicalSourceSegment bleibt genau einer eigenen Requirement zugeordnet. Nennt OPERATIVE_UNIT_BLOCK_COVERAGE_INCOMPLETE einen uncoveredBlocks-Eintrag mit structuralKind LIST_GOVERNOR ohne Deckungswirkungswort, füge dessen exactText als passende SCOPE-, CONDITION-, OBJECT- oder FACT_ROLE-Komponente in die fachlich abhängige Item-Requirement ein; erzeuge für den Governor keine eigene Requirement. DUPLICATE_UNIT_RESPONSE bedeutet: Gib für die genannte unitId genau ein Objekt aus und vereinige die fachlich getrennten Punkte ausschließlich als mehrere Einträge im requirements-Array dieses einen Objekts; verliere dabei keinen Punkt und keine Komponente. UNKNOWN_UNIT_ID bedeutet: Erzeuge niemals eine Ersatz- oder Unter-ID. Ordne alle fachlich getrennten Aussagen als mehrere requirements demselben einzigen erwarteten unitId-Objekt zu. Das gilt auch für lange Fließtextklauseln; alle uncoveredBlocks müssen durch fachlich passende Komponenten unter dieser unveränderten unitId belegt werden.";
      messages.at(-1).content +=
        " REQUIREMENT_ROLE_EVIDENCE_UNMAPPED bedeutet: In der exakt genannten Requirement fehlt für matchedEvidence eine anforderungsbezogene Rollenkomponente. Ergänze sie in derselben Requirement und zitiere den genannten blockId; leihe keine Komponente aus einer benachbarten Requirement. EXPLICIT_CONDITION benötigt CONDITION. EXPLICIT_DEDUCTIBLE benötigt DEDUCTIBLE. EXPLICIT_QUANTIFIED_VALUE benötigt VALUE_AND_UNIT mit wörtlichem rawValue. EXPLICIT_LIMIT_BASIS benötigt LIMIT_BASIS. EXPLICIT_NON_NUMERIC_LIMIT benötigt LIMIT_BASIS. EXPLICIT_EXCLUSION benötigt eine eigene COVERAGE_EFFECT-Komponente mit coverageEffect EXCLUDED und einem wörtlichen Ausschlussausdruck als label.";
      messages.at(-1).content +=
        " Die Reparaturpflicht zur Zeichen- und Quelltreue hebt die Atomisierungspräzisierung nicht auf: Erfinde keine Kurzbezeichnung und paraphrasiere nicht, aber verkürze ein überbreites Komponentenlabel auf den kürzesten noch eindeutigen, zusammenhängenden und zeichengetreu kopierten Quellsubstring seiner eigenen Dimension. Erhalte bereits gültige Komponenten nur dann unverändert, wenn sie auch diese typed-minimal-Regel erfüllen.";
      messages.at(-1).content +=
        " Eine bloße Spartenaufzählung mit Versicherungssumme und gewählter Variante, aber ohne wörtlichen Deckungswirkungsausdruck, bleibt LIMIT/VARIANT statt OPERATIVE_COVERAGE_STATEMENT. Verwende jede komma-getrennte Sparte als eigene SCOPE-Komponente. Das Wort „gilt“ in „in der Sparte ... gilt die Variante“ ist keine Deckungswirkung und darf nicht als COVERAGE_EFFECT ausgegeben werden.";
      messages.at(-1).content +=
        " Verwende in semanticClasses ausschließlich Terminalklassen. Insbesondere wird eine LIMIT_BASIS-Komponente durch die Terminalklasse LIMIT getragen; LIMIT_BASIS selbst ist niemals eine semanticClass.";
      const segmentSkeletons = listSegmentRepairSkeletons(
        workingBatch,
        repairDiagnostics
      );
      if (segmentSkeletons.length)
        messages.at(-1).content +=
          ` Verbindliche serverseitige Requirement-Skelette: ${JSON.stringify(
            segmentSkeletons
          )}. Erzeuge für jedes Skelett genau einen getrennten Eintrag innerhalb des requirements-Arrays des zugehörigen unitId-Objekts. exactDisplayLabel ist wörtlich zu übernehmen; requiredBlockIds müssen gemeinsam von dessen Komponenten zitiert werden. Gib niemals eine Requirement als eigenes Top-Level-Arrayobjekt aus und vereinige niemals zwei segmentIds.`;
    } catch (error) {
      const partition =
        errorClass(error) === "MODEL_REQUEST_TIMEOUT" &&
        error.retrySafe !== false &&
        workingBatch.expectedUnitIds.some(
          (unitId) => (attemptsByUnit.get(unitId) || 0) < maximumAttempts
        )
          ? timeoutRetryPartition(workingBatch)
          : null;
      const attemptRecord = {
        attempt,
        requestedUnitIds: workingBatch.expectedUnitIds,
        unitAttempts: Object.fromEntries(
          workingBatch.expectedUnitIds.map((unitId) => [
            unitId,
            attemptsByUnit.get(unitId),
          ])
        ),
        messagesSha256: sha256(JSON.stringify(messages)),
        durationMs: Math.round(performance.now() - started),
        errorClass: errorClass(error),
        timedOut: error?.telemetry?.timedOut === true,
        timeoutMs: error?.telemetry?.timeoutMs || requestTimeoutMs,
        abortTriggered: error?.telemetry?.abortTriggered === true,
        requestSettledAfterAbort:
          error?.telemetry?.requestSettledAfterAbort ?? null,
        settlementDurationMs: error?.telemetry?.settlementDurationMs ?? null,
        recovery: error?.telemetry?.recovery || null,
        rawResponseSha256: sha256(observedRawText),
        rawResponse: observedRawText,
        responses: observedResponses,
        timeoutRetryPartition: partition
          ? {
              strategy: partition.strategy,
              retryUnitIds: partition.retryUnitIds,
              deferredUnitIds: partition.deferredUnitIds,
            }
          : null,
        validationPassed: false,
        error: error.message,
      };
      attempts.push(attemptRecord);
      await onAttempt(attemptRecord);
      last = {
        responses: batch.expectedUnitIds
          .filter((unitId) => acceptedResponses.has(unitId))
          .map((unitId) => acceptedResponses.get(unitId)),
        validation: {
          passed: false,
          diagnostics: [
            { code: "MODEL_RESPONSE_INVALID", detail: error.message },
          ],
          terminalDispositions: {},
        },
        rawText: "",
        error: error.message,
      };
      if (error.retrySafe === false) break;
      if (partition) {
        workingBatch = {
          ...batch,
          batchId: `${batch.batchId}-timeout-split-${attempt + 1}`,
          expectedUnitIds: partition.retryUnitIds,
          units: partition.retryUnits,
        };
        messages = prompt(workingBatch);
      } else if (
        errorClass(error) === "MODEL_RESPONSE_INVALID" &&
        observedRawText &&
        observedResponses.length === 0
      ) {
        messages = [
          ...prompt(workingBatch),
          { role: "assistant", content: observedRawText },
          {
            role: "user",
            content: `Die vorige Antwort war technisch ungültiges JSON (${error.message}). Repariere ausschließlich die JSON-Syntax. Gib genau ein vollständiges JSON-Array mit allen expectedUnitIds aus; ändere keine fachlichen Werte, Source-IDs oder Texte und füge kein Markdown hinzu.`,
          },
        ];
      }
    }
  }
  return {
    schemaVersion: 1,
    contractId: RUN_CONTRACT_ID,
    sourceUnitPlanSha256: plan.planSha256,
    promptContractId: PROMPT_CONTRACT_ID,
    semanticSignalContractId: A_SEMANTIC_SIGNAL_CONTRACT_ID,
    promptSha256: sha256(JSON.stringify(prompt(batch))),
    validatorContractId: A_DYNAMIC_MANIFEST_CONTRACT_ID,
    requestedModel: model,
    modelContext,
    transportContractId: TRANSPORT_CONTRACT_ID,
    requestTimeoutMs,
    abortSettlementTimeoutMs,
    batchId: batch.batchId,
    batchIndex: batch.batchIndex,
    expectedUnitIds: batch.expectedUnitIds,
    responses: last.responses,
    validation: last.validation,
    rawResponseSha256: sha256(last.rawText),
    rawResponse: last.rawText,
    error: last.error,
    attempts,
    resumedAcceptedUnits: initialAcceptedResponses.length,
  };
}

async function processClassificationBatches({
  args,
  plan,
  batches,
  client,
  recoverModelAfterAbort,
}) {
  const batchResults = [];
  for (const batch of batches.batches) {
    const file = batchResultFile(args.output, batch);
    let result;
    let reused = false;
    let supersededResponses = [];
    if (fs.existsSync(file)) {
      try {
        result = existingBatchResult(file, plan, batch, args);
        reused = true;
      } catch (error) {
        const recoverableCurrentFailure = [
          "LF_A_CLASSIFICATION_BATCH_RESULT_VALIDATION_INVALID",
          "LF_A_CLASSIFICATION_BATCH_RESULT_NOT_PASS",
        ].includes(error.message);
        const resumablePredecessor =
          error.message === "LF_A_CLASSIFICATION_BATCH_RESULT_BINDING_INVALID"
            ? predecessorBatchResponses(file, plan, batch, args)
            : null;
        if (!recoverableCurrentFailure && !resumablePredecessor) throw error;
        supersededResponses = archiveSupersededBatchResult(
          file,
          args.output,
          batch,
          resumablePredecessor
            ? "LF_A_CLASSIFICATION_PREDECESSOR_UPGRADE"
            : error.message
        ).responses;
      }
    }
    if (!reused) {
      const contextualBatch = classificationBatch(plan, batch);
      const journalResponses = acceptedResponsesFromAttemptJournal({
        output: args.output,
        plan,
        batch: contextualBatch,
        args,
      });
      const archivedResponses = responsesFromSupersededBatchArtifacts({
        output: args.output,
        plan,
        batch,
        args,
      });
      const acceptedResponses = currentlyValidResponses(plan, contextualBatch, [
        ...supersededResponses,
        ...archivedResponses,
        ...journalResponses,
      ]);
      result = await runBatch({
        client,
        model: args.model,
        modelContext: args.modelContext,
        plan,
        batch: contextualBatch,
        maximumAttempts: args.maximumAttempts,
        requestTimeoutMs: args.requestTimeoutMs,
        abortSettlementTimeoutMs: args.abortSettlementTimeoutMs,
        recoverModelAfterAbort,
        initialAcceptedResponses: acceptedResponses,
        onAttempt: createAttemptRecorder({
          output: args.output,
          plan,
          batch: contextualBatch,
          args,
        }),
      });
      result.classificationEvidenceContextContractId =
        CLASSIFICATION_EVIDENCE_CONTEXT_CONTRACT_ID;
      if (!result.validation.passed) {
        const failure = new Error(
          `LF_A_CLASSIFICATION_BATCH_FAILED_CLOSED:${batch.batchIndex}:${batch.batchId}`
        );
        failure.batchResult = result;
        throw failure;
      }
      writePrivateJson(file, result);
    }
    batchResults.push(result);
    console.log(
      `[lf-a-driven-classification] Batch ${batch.batchIndex + 1}/${batches.batches.length}: PASS${reused ? " (wiederverwendet)" : ""}`
    );
  }
  return batchResults;
}

async function run() {
  const args = argumentsFrom(process.argv.slice(2));
  const sourcePlan = readJson(
    path.join(args.shadowRoot, "source-unit-plan.private.json"),
    "LF_A_CLASSIFICATION_SOURCE_PLAN"
  );
  const batches = readJson(
    path.join(args.shadowRoot, "classification-batches.private.json"),
    "LF_A_CLASSIFICATION_BATCHES"
  );
  if (
    sourcePlan?.contractId !== A_SOURCE_UNIT_PLAN_CONTRACT_ID ||
    batches?.contractId !== A_CLASSIFICATION_CONTRACT_ID ||
    batches.sourceUnitPlanSha256 !== sourcePlan.planSha256
  )
    throw new Error("LF_A_CLASSIFICATION_INPUT_BINDING_INVALID");
  const plan = deriveClassificationEvidencePlan(sourcePlan);
  if (fs.existsSync(path.join(args.output, "summary.private.json"))) {
    const summary = validateCompletedRun({
      args,
      plan,
      batches,
      summaryFile: path.join(args.output, "summary.private.json"),
    });
    console.log(
      `[lf-a-driven-classification] bereits vollständig: ${summary.validBatches}/${summary.batches} Batches`
    );
    return;
  }
  if (fs.existsSync(args.output)) {
    const stat = fs.lstatSync(args.output);
    if (!stat.isDirectory() || stat.isSymbolicLink())
      throw new Error("LF_A_CLASSIFICATION_OUTPUT_INVALID");
  } else {
    fs.mkdirSync(args.output, { recursive: true, mode: 0o700 });
  }
  const baseUrl = process.env.LMSTUDIO_BASE_PATH || "http://127.0.0.1:1234/v1";
  const loadedModel = await verifyModel({
    baseUrl,
    model: args.model,
    modelContext: args.modelContext,
  });
  const client = new OpenAI({
    baseURL: baseUrl,
    apiKey: "lm-studio",
    maxRetries: 0,
  });
  const recoverModelAfterAbort = createLmStudioRecovery({
    baseUrl,
    model: args.model,
    modelContext: args.modelContext,
    lmStudioSdk: args.lmStudioSdk,
    qwenModelKey: args.qwenModelKey,
    modelRecoveryTimeoutMs: args.modelRecoveryTimeoutMs,
  });
  const startedAt = new Date().toISOString();
  const started = performance.now();
  const batchResults = await processClassificationBatches({
    args,
    plan,
    batches,
    client,
    recoverModelAfterAbort,
  });
  const responses = batchResults.flatMap(({ responses: items }) => items);
  const manifest = buildADrivenSemanticManifest({
    plan,
    responses,
    semanticSignalContractId: A_SEMANTIC_SIGNAL_CONTRACT_ID,
  });
  const completedAt = new Date().toISOString();
  const summary = {
    schemaVersion: 1,
    contractId: RUN_CONTRACT_ID,
    sourceUnitPlanSha256: plan.planSha256,
    promptContractId: PROMPT_CONTRACT_ID,
    validatorContractId: A_DYNAMIC_MANIFEST_CONTRACT_ID,
    semanticSignalContractId: A_SEMANTIC_SIGNAL_CONTRACT_ID,
    classificationBatchesSha256: sha256(JSON.stringify(batches)),
    model: loadedModel,
    transport: {
      contractId: TRANSPORT_CONTRACT_ID,
      requestTimeoutMs: args.requestTimeoutMs,
      abortSettlementTimeoutMs: args.abortSettlementTimeoutMs,
      modelRecoveryTimeoutMs: args.modelRecoveryTimeoutMs,
      recoveryMethod: "TARGETED_UNLOAD_RELOAD_AND_EXACT_MODEL_VERIFY",
    },
    classificationEvidenceContext: plan.classificationEvidenceContext,
    startedAt,
    completedAt,
    wallDurationMs: Math.round(performance.now() - started),
    batches: batchResults.length,
    validBatches: batchResults.filter(({ validation }) => validation.passed)
      .length,
    unresolvedBatches: batchResults.filter(
      ({ validation }) => !validation.passed
    ).length,
    modelAttempts: batchResults.reduce(
      (sum, { attempts }) => sum + attempts.length,
      0
    ),
    semanticRequirements: manifest.summary.semanticRequirements,
    semanticComponents: manifest.summary.semanticComponents,
    unresolvedUnits: manifest.summary.unresolvedUnits,
    reviewRequiredBlocks: manifest.summary.reviewRequiredBlocks,
    allBlocksTerminal: manifest.summary.allBlocksTerminal,
    responseIntegrityStatus: manifest.summary.responseIntegrityStatus,
    acceptanceReady: false,
    proofLimit:
      "Bounded A-Klassifizierungs-Shadow. Ohne bestandene A-Atomizitäts- und Mutationsgates, vollständige B-Suche, symmetrische Nichtregression, fachlichen Ergebnisreview und zuvor ungesehenen Holdout kein Produkt- oder 99-Prozent-Nachweis. Der 283/631-Crosswalk ist nur Regressionsevidenz für das bekannte LF-Dokument.",
  };
  writePrivateJson(path.join(args.output, "responses.private.json"), responses);
  writePrivateJson(
    path.join(args.output, "dynamic-semantic-manifest.private.json"),
    manifest
  );
  writePrivateJson(path.join(args.output, "summary.private.json"), summary);
  console.log(
    `[lf-a-driven-classification] ${summary.validBatches}/${summary.batches} Batches PASS, ${summary.semanticRequirements} Anforderungen, ${summary.unresolvedUnits} Units ungeklärt`
  );
}

if (require.main === module)
  run().catch((error) => fail(error.stack || error.message));

module.exports = {
  CLASSIFICATION_EVIDENCE_CONTEXT_CONTRACT_ID,
  acceptedResponsesFromAttemptJournal,
  attachTopLevelRequirementFragments,
  batchResultFile,
  classificationBatch,
  createLmStudioRecovery,
  createAttemptRecorder,
  deriveClassificationEvidencePlan,
  listSegmentRepairSkeletons,
  normalizeStandaloneListGovernorRequirements,
  normalizeUnambiguousComponentTypes,
  parseJsonArray,
  processClassificationBatches,
  prompt,
  requestCompletionWithTimeout,
  responsesFromSupersededBatchArtifacts,
  runBatch,
  validateBatchResponses,
  validateCompletedRun,
};

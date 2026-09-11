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
  buildADrivenSemanticManifest,
} = require("../../utils/policyAnalysis/aDrivenSemanticManifest");
const {
  A_SOURCE_UNIT_PLAN_CONTRACT_ID,
  stableStringify,
} = require("../../utils/policyAnalysis/aDrivenSourceUnitPlan");

const RUN_CONTRACT_ID = "LF_A_BOUNDED_CLASSIFICATION_RUN_V12";
const PROMPT_CONTRACT_ID = "LF_A_BOUNDED_CLASSIFICATION_PROMPT_V14";
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
    const repaired = jsonrepair(candidate);
    parsed = JSON.parse(repaired);
    syntaxRepair = {
      applied: true,
      originalError: strictError.message,
      originalResponseSha256: sha256(candidate),
      repairedResponseSha256: sha256(repaired),
    };
  }
  if (!Array.isArray(parsed))
    throw new Error("LF_A_CLASSIFICATION_RESPONSE_NOT_ARRAY");
  return { responses: parsed, syntaxRepair };
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
  if (!continuesEmbeddedList && !opensFollowingList) return null;
  const blocks = continuesEmbeddedList
    ? previous.source.blocks.slice(0, embeddedListStart)
    : previous.source.blocks;
  if (blocks.length === 0) return null;
  const combinedText = blocks.map(({ exactText }) => exactText).join("\n");
  return {
    relationType: continuesEmbeddedList
      ? "RECOVERS_EMBEDDED_LIST_GOVERNOR"
      : "RECOVERS_ADJACENT_LIST_GOVERNOR",
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
        'Du zerlegst ausschließlich die übergebenen Originaleinheiten eines österreichischen Gebäudeversicherungs-Referenzpakets A. Erfinde keine IDs, Kurzbezeichnungen oder Textparaphrasen. Antworte nur als JSON-Array mit exakt einem Objekt je expectedUnitId und keiner weiteren ID. Jede operative Aussage wird in eine oder mehrere atomare Anforderungen zerlegt. Physische Textblöcke oder Seitenumbrüche sind keine fachlichen Elementgrenzen. Jedes logicalSourceSegments-Element vom Typ LIST_ITEM_WITH_CONTINUATIONS ist genau ein zusammenhängender Listenpunkt und erzeugt genau eine eigene Anforderung: Alle seine blockIds müssen gemeinsam in dieser einen Anforderung vorkommen; teile ihn nie nach Zeile oder Seite und vereinige nie zwei segmentIds in einer Anforderung. primaryClass muss immer auch wortgleich in semanticClasses enthalten sein. displayLabel muss ein wörtlicher, zusammenhängender Teilstring aus originalText sein; kopiere ihn exakt, statt einen Titel zu formulieren. Jede Anforderung enthält ausschließlich displayLabel und components, keine weiteren Felder. Komponenten enthalten type, label, sourceBlockIds und optional rawValue, unit, coverageEffect, qualifier. label ist immer ein nichtleerer wörtlicher Teilstring. rawValue, unit und qualifier müssen, wenn gesetzt, jeweils wörtliche Teilstrings mindestens eines in sourceBlockIds referenzierten sourceBlocks sein. Komponenten dürfen ausschließlich evidenceSourceBlockIds zitieren. ownedSourceBlockIds gehören der Einheit; governingContext enthält ausschließlich serverseitig verknüpfte, vorangestellte Listengovernor-Evidenz. Verwende deren wörtliche Deckungswirkung für abhängige Listenpunkte. Beispielstruktur für einen versicherten Listenpunkt: components:[{type:"OBJECT",label:"<wörtlicher Listenpunkt>",sourceBlockIds:["<Listenblock>"]},{type:"COVERAGE_EFFECT",label:"mitversichert",sourceBlockIds:["<Governorblock>"],coverageEffect:"INCLUDED"}]. OBJECT enthält niemals coverageEffect. coverageEffect ist nur bei type COVERAGE_EFFECT erlaubt, dort verpflichtend und exakt einer der Enumwerte INCLUDED, EXCLUDED, CONDITIONAL, OPTIONAL, UNKNOWN; das deutsche Quellwort steht ausschließlich in label. COVERAGE_EFFECT.label muss ein nichtleerer wörtlicher Wirkungsausdruck aus der Quelle sein, zum Beispiel „versichert“, „nicht versichert“, „gilt“ oder „ausgeschlossen“. Bei jeder operativen Einheit muss die Vereinigungsmenge aller components.sourceBlockIds mindestens alle ownedSourceBlockIds der Einheit enthalten. Referenziere auch einleitende Klausel-Governor wie „Versicherungsschutz ... besteht unter der“, selbst wenn die eigentliche Bedingung im Folgeblock steht. Deckungskonzept-/Produkttitel und Firmenrollen auf einem Deckblatt verwenden primaryClass DEFINITION und semanticClasses ["DEFINITION"] mit SCOPE- und FACT_ROLE-Komponenten oder sind vollständig nichtoperativ; SCOPE und FACT_ROLE sind niemals primaryClass oder semanticClasses. Auch der Titelblock muss bei einer operativen Misch-Unit durch eine Komponente zitiert sein. Reine Überschriften/Struktur/Metadaten/Duplikate erzeugen keine Anforderungen. Wenn keine sichere Klassifikation möglich ist, verwende UNRESOLVED. primaryClass und semanticClasses dürfen nur folgende Werte enthalten: OPERATIVE_COVERAGE_STATEMENT, EXCLUSION, INSURED_OBJECT, PERIL_OR_DAMAGE, DEFINITION, CONDITION, COST, LIMIT, DEDUCTIBLE, OBLIGATION, DURATION, VARIANT, DOCUMENT_PRECEDENCE_OR_REPLACEMENT, STRUCTURE, METADATA, DUPLICATE, UNRESOLVED. Komponentenwerte wie OBJECT, SCOPE und FACT_ROLE sind dort verboten. type darf nur sein: OBJECT, PERIL_OR_CAUSE, DAMAGE_OR_EFFECT, COVERAGE_EFFECT, SCOPE, FACT_ROLE, CONDITION, VALUE_AND_UNIT, LIMIT_BASIS, DEDUCTIBLE, TEMPORAL_VALIDITY, DOCUMENT_ROLE, PRECEDENCE_OR_REPLACEMENT. Terminalklassen sind keine Komponententypen. Verwende für INSURED_OBJECT→OBJECT, PERIL_OR_DAMAGE→PERIL_OR_CAUSE oder DAMAGE_OR_EFFECT, DEFINITION→FACT_ROLE, CONDITION und OBLIGATION→CONDITION, COST→FACT_ROLE oder VALUE_AND_UNIT, LIMIT mit konkreter Zahl→VALUE_AND_UNIT samt rawValue, LIMIT ohne konkrete Zahl→LIMIT_BASIS, DURATION→TEMPORAL_VALIDITY, VARIANT→SCOPE sowie DOCUMENT_PRECEDENCE_OR_REPLACEMENT→PRECEDENCE_OR_REPLACEMENT. Es gibt insbesondere niemals type VARIANT, OBLIGATION, LIMIT, COST oder DURATION. Vertragsrollen wie Versicherungsnehmer, Verwalter, Makler oder Treuhänder sind FACT_ROLE unter DEFINITION, niemals INSURED_OBJECT. INSURED_OBJECT bezeichnet das versicherte Sachobjekt wie Gebäude oder Nebengebäude und braucht OBJECT. OPERATIVE_COVERAGE_STATEMENT gilt nur für tatsächliche Deckungswirkung und braucht COVERAGE_EFFECT; administrative Vermerkspflichten, Voraussetzungen oder Betreuung sind CONDITION beziehungsweise OBLIGATION und keine Deckungswirkung. VALUE_AND_UNIT braucht immer ein wörtliches rawValue; LIMIT_BASIS bezeichnet eine Bezugsgröße ohne konkrete Zahl. DEDUCTIBLE braucht DEDUCTIBLE. Ausgabeform je Einheit exakt: {unitId,primaryClass,semanticClasses,requirements}.',
    },
    {
      role: "system",
      content:
        "Präzisierung: Eine reine unitKind-HEADING-Unit ist immer STRUCTURE mit requirements:[], auch wenn sie einen Produktnamen enthält. Nur eine gemischte Nicht-HEADING-Unit, die Titeltext und Firmenrollen gemeinsam besitzt, wird als DEFINITION mit SCOPE-/FACT_ROLE-Komponenten abgebildet. Wenn governingContext null ist und in den ownedSourceBlocks kein wörtliches Deckungswirkungswort steht, klassifiziere eine Objektliste als INSURED_OBJECT mit OBJECT-Komponenten ohne COVERAGE_EFFECT. Erfinde insbesondere niemals das label versichert und suche keinen Ersatzbeleg in einem anderen Listenelement. Nennt COMPONENT_SOURCE_TEXT_INVALID konkrete blockIds, muss die korrigierte Komponente diese IDs zusätzlich ausdrücklich in sourceBlockIds aufnehmen; der Server ergänzt sie niemals still.",
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

function validateBatchResponses(plan, batch, responses) {
  const manifest = buildADrivenSemanticManifest({ plan, responses });
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
  const validation = validateBatchResponses(
    plan,
    validationBatch,
    result.responses
  );
  if (stableStringify(validation) !== stableStringify(result.validation))
    throw new Error("LF_A_CLASSIFICATION_BATCH_RESULT_VALIDATION_INVALID");
  if (!validation.passed)
    throw new Error("LF_A_CLASSIFICATION_BATCH_RESULT_NOT_PASS");
  return result;
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
      artifact.requestedModel !== args.model ||
      artifact.modelContext !== args.modelContext ||
      artifact.batchIndex !== batch.batchIndex ||
      artifact.batchId !== batch.batchId ||
      !Array.isArray(artifact.attempt?.responses)
    )
      continue;
    for (const response of artifact.attempt.responses) {
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
  for (const response of Array.isArray(responses) ? responses : []) {
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

function validateCompletedRun({ args, plan, batches, summaryFile }) {
  const summary = readJson(summaryFile, "LF_A_CLASSIFICATION_SUMMARY");
  if (
    summary?.contractId !== RUN_CONTRACT_ID ||
    summary.sourceUnitPlanSha256 !== plan.planSha256 ||
    summary.promptContractId !== PROMPT_CONTRACT_ID ||
    summary.validatorContractId !== A_DYNAMIC_MANIFEST_CONTRACT_ID ||
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
  const manifest = buildADrivenSemanticManifest({ plan, responses });
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
      const { responses, syntaxRepair } = parseJsonArray(rawText);
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
        " Präzisierung für gemischte Klassen: Wenn observedComponentTypes OBJECT nennt und semanticClasses zugleich INSURED_OBJECT enthält, behalte die gültige OBJECT-Komponente und ergänze PERIL_OR_CAUSE oder DAMAGE_OR_EFFECT als separate Komponente derselben Requirement. Ersetze OBJECT nur, wenn INSURED_OBJECT weder primaryClass noch semanticClasses ist. Entferne beim Ergänzen einer missingRequiredComponentGroup keine Komponente, die eine andere vorhandene semanticClass weiterhin benötigt. Nennt COMPONENT_SOURCE_BLOCK_ID_OUT_OF_SCOPE zusätzlich requiredSourceBlockIds, ersetze sourceBlockIds der exakt bezeichneten Komponente vollständig und zeichengetreu durch requiredSourceBlockIds; kopiere keine ähnlich aussehende Hash-ID aus der alten Antwort. LIST_GOVERNOR_REQUIREMENT_STANDALONE bedeutet: Lösche die eigenständige Governor-Requirement. Verwende ihren COVERAGE_EFFECT stattdessen in jeder fachlichen Requirement der folgenden Item-Segmente. Der gemeinsame Governor darf in mehreren Requirements zitiert werden; jedes Nicht-Governor-logicalSourceSegment bleibt genau einer eigenen Requirement zugeordnet. Nennt OPERATIVE_UNIT_BLOCK_COVERAGE_INCOMPLETE einen uncoveredBlocks-Eintrag mit structuralKind LIST_GOVERNOR ohne Deckungswirkungswort, füge dessen exactText als passende SCOPE-, CONDITION-, OBJECT- oder FACT_ROLE-Komponente in die fachlich abhängige Item-Requirement ein; erzeuge für den Governor keine eigene Requirement. DUPLICATE_UNIT_RESPONSE bedeutet: Gib für die genannte unitId genau ein Objekt aus und vereinige die fachlich getrennten Punkte ausschließlich als mehrere Einträge im requirements-Array dieses einen Objekts; verliere dabei keinen Punkt und keine Komponente.";
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
        if (
          ![
            "LF_A_CLASSIFICATION_BATCH_RESULT_VALIDATION_INVALID",
            "LF_A_CLASSIFICATION_BATCH_RESULT_NOT_PASS",
          ].includes(error.message)
        )
          throw error;
        supersededResponses = archiveSupersededBatchResult(
          file,
          args.output,
          batch,
          error.message
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
      const acceptedResponses = currentlyValidResponses(plan, contextualBatch, [
        ...journalResponses,
        ...supersededResponses,
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
  const manifest = buildADrivenSemanticManifest({ plan, responses });
  const completedAt = new Date().toISOString();
  const summary = {
    schemaVersion: 1,
    contractId: RUN_CONTRACT_ID,
    sourceUnitPlanSha256: plan.planSha256,
    promptContractId: PROMPT_CONTRACT_ID,
    validatorContractId: A_DYNAMIC_MANIFEST_CONTRACT_ID,
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
      "Bounded A-Klassifizierungs-Shadow. Ohne doppelt geprüften 283/631-Crosswalk, vollständige B-Suche, Experten-Goldstandard und Holdout kein Produkt- oder 99-Prozent-Nachweis.",
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
  batchResultFile,
  createAttemptRecorder,
  deriveClassificationEvidencePlan,
  processClassificationBatches,
  requestCompletionWithTimeout,
  runBatch,
};

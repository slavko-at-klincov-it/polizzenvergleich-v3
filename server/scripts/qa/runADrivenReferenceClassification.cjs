#!/usr/bin/env node

process.umask(0o077);

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { performance } = require("perf_hooks");
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

const RUN_CONTRACT_ID = "LF_A_BOUNDED_CLASSIFICATION_RUN_V3";
const PROMPT_CONTRACT_ID = "LF_A_BOUNDED_CLASSIFICATION_PROMPT_V5";
const DEFAULT_MODEL = "qwen/qwen3.6-35b-a3b";
const DEFAULT_CONTEXT = 42_496;

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
  ]);
  const unknown = Object.keys(values).filter((key) => !allowed.has(key));
  if (unknown.length) fail(`Unbekannte Argumente: ${unknown.join(",")}`);
  for (const required of ["shadowRoot", "output"])
    if (!values[required]) fail(`--${required} ist erforderlich`);
  const modelContext = Number(values.modelContext || DEFAULT_CONTEXT);
  const maximumAttempts = Number(values.maximumAttempts || 2);
  if (
    !Number.isInteger(modelContext) ||
    modelContext < 1_000 ||
    !Number.isInteger(maximumAttempts) ||
    maximumAttempts < 1 ||
    maximumAttempts > 3
  )
    fail("Numerische Laufparameter sind ungültig");
  return {
    shadowRoot: path.resolve(values.shadowRoot),
    output: path.resolve(values.output),
    model: values.model || DEFAULT_MODEL,
    modelContext,
    maximumAttempts,
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

function parseJsonArray(modelText) {
  const normalized = String(modelText || "")
    .replace(/<think>[\s\S]*?<\/think>/giu, "")
    .trim();
  const start = normalized.indexOf("[");
  const end = normalized.lastIndexOf("]");
  if (start < 0 || end < start)
    throw new Error("LF_A_CLASSIFICATION_RESPONSE_JSON_ARRAY_MISSING");
  const parsed = JSON.parse(normalized.slice(start, end + 1));
  if (!Array.isArray(parsed))
    throw new Error("LF_A_CLASSIFICATION_RESPONSE_NOT_ARRAY");
  return parsed;
}

function prompt(batch) {
  return [
    {
      role: "system",
      content:
        "Du zerlegst ausschließlich die übergebenen Originaleinheiten eines österreichischen Gebäudeversicherungs-Referenzpakets A. Erfinde keine IDs, Kurzbezeichnungen oder Textparaphrasen. Antworte nur als JSON-Array mit exakt einem Objekt je expectedUnitId und keiner weiteren ID. Jede operative Aussage wird in eine oder mehrere atomare Anforderungen zerlegt. primaryClass muss immer auch wortgleich in semanticClasses enthalten sein. displayLabel muss ein wörtlicher, zusammenhängender Teilstring aus originalText sein; kopiere ihn exakt, statt einen Titel zu formulieren. Jede Anforderung enthält ausschließlich displayLabel und components, keine weiteren Felder. Komponenten enthalten type, label, sourceBlockIds und optional rawValue, unit, coverageEffect, qualifier. label ist immer ein nichtleerer wörtlicher Teilstring. rawValue, unit und qualifier müssen, wenn gesetzt, jeweils wörtliche Teilstrings mindestens eines in sourceBlockIds referenzierten sourceBlocks sein. Verwende coverageEffect ausschließlich bei type COVERAGE_EFFECT und dort verpflichtend. COVERAGE_EFFECT.label muss ein nichtleerer wörtlicher Wirkungsausdruck aus der Quelle sein, zum Beispiel „versichert“, „nicht versichert“, „gilt“ oder „ausgeschlossen“; niemals eine leere Zeichenfolge. Bei jeder operativen Einheit muss die Vereinigungsmenge aller components.sourceBlockIds exakt alle sourceBlockIds der Einheit enthalten. Referenziere auch einleitende Klausel-Governor wie „Versicherungsschutz ... besteht unter der“, selbst wenn die eigentliche Bedingung im Folgeblock steht. Reine Überschriften/Struktur/Metadaten/Duplikate erzeugen keine Anforderungen. Wenn keine sichere Klassifikation möglich ist, verwende UNRESOLVED. primaryClass und semanticClasses dürfen nur folgende Werte enthalten: OPERATIVE_COVERAGE_STATEMENT, EXCLUSION, INSURED_OBJECT, PERIL_OR_DAMAGE, DEFINITION, CONDITION, COST, LIMIT, DEDUCTIBLE, OBLIGATION, DURATION, VARIANT, DOCUMENT_PRECEDENCE_OR_REPLACEMENT, STRUCTURE, METADATA, DUPLICATE, UNRESOLVED. type darf nur sein: OBJECT, PERIL_OR_CAUSE, DAMAGE_OR_EFFECT, COVERAGE_EFFECT, SCOPE, FACT_ROLE, CONDITION, VALUE_AND_UNIT, LIMIT_BASIS, DEDUCTIBLE, TEMPORAL_VALIDITY, DOCUMENT_ROLE, PRECEDENCE_OR_REPLACEMENT. Terminalklassen sind keine Komponententypen. Verwende für INSURED_OBJECT→OBJECT, PERIL_OR_DAMAGE→PERIL_OR_CAUSE oder DAMAGE_OR_EFFECT, DEFINITION→FACT_ROLE, CONDITION und OBLIGATION→CONDITION, COST→FACT_ROLE oder VALUE_AND_UNIT, LIMIT mit konkreter Zahl→VALUE_AND_UNIT samt rawValue, LIMIT ohne konkrete Zahl→LIMIT_BASIS, DURATION→TEMPORAL_VALIDITY, VARIANT→SCOPE sowie DOCUMENT_PRECEDENCE_OR_REPLACEMENT→PRECEDENCE_OR_REPLACEMENT. Es gibt insbesondere niemals type VARIANT, OBLIGATION, LIMIT, COST oder DURATION. Vertragsrollen wie Versicherungsnehmer, Verwalter, Makler oder Treuhänder sind FACT_ROLE unter DEFINITION, niemals INSURED_OBJECT. INSURED_OBJECT bezeichnet das versicherte Sachobjekt wie Gebäude oder Nebengebäude und braucht OBJECT. OPERATIVE_COVERAGE_STATEMENT gilt nur für tatsächliche Deckungswirkung und braucht COVERAGE_EFFECT; administrative Vermerkspflichten, Voraussetzungen oder Betreuung sind CONDITION beziehungsweise OBLIGATION und keine Deckungswirkung. coverageEffect darf nur INCLUDED, EXCLUDED, CONDITIONAL, OPTIONAL oder UNKNOWN sein. VALUE_AND_UNIT braucht immer ein wörtliches rawValue; LIMIT_BASIS bezeichnet eine Bezugsgröße ohne konkrete Zahl. DEDUCTIBLE braucht DEDUCTIBLE. Ausgabeform je Einheit exakt: {unitId,primaryClass,semanticClasses,requirements}.",
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

function existingBatchResult(file, plan, batch, args) {
  const result = readJson(file, "LF_A_CLASSIFICATION_BATCH_RESULT");
  const expectedPromptSha256 = sha256(JSON.stringify(prompt(batch)));
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
  const validation = validateBatchResponses(plan, batch, result.responses);
  if (stableStringify(validation) !== stableStringify(result.validation))
    throw new Error("LF_A_CLASSIFICATION_BATCH_RESULT_VALIDATION_INVALID");
  return result;
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
}) {
  const acceptedResponses = new Map();
  let workingBatch = batch;
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
  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    const started = performance.now();
    try {
      const messagesSha256 = sha256(JSON.stringify(messages));
      const completion = await client.chat.completions.create({
        model,
        messages,
        temperature: 0,
        max_tokens: 12_000,
      });
      const rawText = completion.choices?.[0]?.message?.content || "";
      const responses = parseJsonArray(rawText);
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
      attempts.push({
        attempt,
        requestedUnitIds: workingBatch.expectedUnitIds,
        messagesSha256,
        durationMs: Math.round(performance.now() - started),
        responseModel: completion.model || null,
        promptTokens: completion.usage?.prompt_tokens || 0,
        completionTokens: completion.usage?.completion_tokens || 0,
        totalTokens: completion.usage?.total_tokens || 0,
        parsedResponses: responses.length,
        acceptedUnits: acceptedResponses.size,
        pendingUnits: pendingUnitIds.length,
        validationPassed: validation.passed,
        diagnostics: validation.diagnostics,
      });
      last = { responses: mergedResponses, validation, rawText, error: null };
      if (validation.passed) break;
      workingBatch = {
        ...batch,
        batchId: `${batch.batchId}-retry-${attempt + 1}`,
        expectedUnitIds: pendingUnitIds,
        units: batch.units.filter(({ unitId }) =>
          pendingUnitIds.includes(unitId)
        ),
      };
      messages = [
        ...prompt(workingBatch),
        {
          role: "user",
          content: `Die Antwort verletzt den Vertrag: ${JSON.stringify(
            validation.diagnostics
          )}. Korrigiere ausschließlich das JSON-Array. Verwende exakt alle expectedUnitIds einmal und keine unbekannten IDs. primaryClass muss in semanticClasses enthalten sein. Kopiere displayLabel und alle Komponentenfelder exakt aus den referenzierten sourceBlocks; formuliere keine Kurzlabels und entferne keine Wörter, Satzzeichen oder OCR-Zeichen. Nenne in sourceBlockIds jeden Block, aus dem label, rawValue, unit oder qualifier Text übernimmt. Die Vereinigungsmenge aller components.sourceBlockIds muss für jede operative Einheit alle sourceBlockIds der Einheit abdecken; vergiss keine einleitenden Governor-Blöcke. COVERAGE_EFFECT ist eine eigene Komponente mit nichtleerem wörtlichem Wirkungs-label und coverageEffect. Vertragsrollen sind DEFINITION/FACT_ROLE, keine versicherten Objekte. Administrative Pflichten oder Voraussetzungen sind CONDITION oder OBLIGATION als semanticClass, ihre Komponente hat aber immer type CONDITION. Terminalklassen wie VARIANT, OBLIGATION, LIMIT, COST und DURATION sind niemals component.type. Ein LIMIT mit konkreter Zahl benötigt VALUE_AND_UNIT samt rawValue; eine Limitbezugsgröße ohne Zahl verwendet LIMIT_BASIS. Bei einer Prozentgrenze bezeichnet VALUE_AND_UNIT die wörtliche Prozentangabe und rawValue wiederholt mindestens deren wörtlichen Zahlenwert; LIMIT_BASIS bezeichnet die wörtliche Bezugsgröße wie „Gebäudeversicherungssumme“. VARIANT verwendet SCOPE.`,
        },
      ];
    } catch (error) {
      attempts.push({
        attempt,
        requestedUnitIds: workingBatch.expectedUnitIds,
        messagesSha256: sha256(JSON.stringify(messages)),
        durationMs: Math.round(performance.now() - started),
        validationPassed: false,
        error: error.message,
      });
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
    batchId: batch.batchId,
    batchIndex: batch.batchIndex,
    expectedUnitIds: batch.expectedUnitIds,
    responses: last.responses,
    validation: last.validation,
    rawResponseSha256: sha256(last.rawText),
    rawResponse: last.rawText,
    error: last.error,
    attempts,
  };
}

async function run() {
  const args = argumentsFrom(process.argv.slice(2));
  const plan = readJson(
    path.join(args.shadowRoot, "source-unit-plan.private.json"),
    "LF_A_CLASSIFICATION_SOURCE_PLAN"
  );
  const batches = readJson(
    path.join(args.shadowRoot, "classification-batches.private.json"),
    "LF_A_CLASSIFICATION_BATCHES"
  );
  if (
    plan?.contractId !== A_SOURCE_UNIT_PLAN_CONTRACT_ID ||
    batches?.contractId !== A_CLASSIFICATION_CONTRACT_ID ||
    batches.sourceUnitPlanSha256 !== plan.planSha256
  )
    throw new Error("LF_A_CLASSIFICATION_INPUT_BINDING_INVALID");
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
  const client = new OpenAI({ baseURL: baseUrl, apiKey: "lm-studio" });
  const startedAt = new Date().toISOString();
  const started = performance.now();
  const batchResults = [];
  for (const batch of batches.batches) {
    const file = path.join(
      args.output,
      "batches",
      `${String(batch.batchIndex).padStart(4, "0")}-${batch.batchId}.private.json`
    );
    const result = fs.existsSync(file)
      ? existingBatchResult(file, plan, batch, args)
      : await runBatch({
          client,
          model: args.model,
          modelContext: args.modelContext,
          plan,
          batch,
          maximumAttempts: args.maximumAttempts,
        });
    if (!fs.existsSync(file)) writePrivateJson(file, result);
    batchResults.push(result);
    console.log(
      `[lf-a-driven-classification] Batch ${batch.batchIndex + 1}/${batches.batches.length}: ${result.validation.passed ? "PASS" : "UNRESOLVED"}`
    );
  }
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

module.exports = { runBatch };

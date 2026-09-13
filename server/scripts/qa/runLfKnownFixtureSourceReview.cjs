#!/usr/bin/env node

process.umask(0o077);

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { performance } = require("perf_hooks");
const { OpenAI } = require("openai");
const {
  SOURCE_REVIEW_PACKET_CONTRACT_ID,
  SOURCE_REVIEW_RESPONSE_CONTRACT_ID,
  sha256,
  validateSourceReviewResponse,
} = require("../../utils/policyAnalysis/lfKnownFixtureSourceReview");
const {
  createLmStudioRecovery,
  requestCompletionWithTimeout,
} = require("./runADrivenReferenceClassification.cjs");

const RUN_CONTRACT_ID = "LF_1PLUS9_SOURCE_REVIEW_RUN_V10";
const RESULT_CONTRACT_ID = "LF_1PLUS9_SOURCE_REVIEW_RESULT_V10";
const PROMPT_CONTRACT_ID = "LF_1PLUS9_SOURCE_REVIEW_PROMPT_V10";
const DEFAULT_MODEL = "qwen/qwen3.6-35b-a3b";
const DEFAULT_CONTEXT = 42_496;

function fail(message) {
  console.error(`[lf-source-review] ${message}`);
  process.exit(1);
}

function argumentsFrom(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value)
      fail(`Ungültiges Argument: ${key || "-"}`);
    values[key.slice(2)] = value;
  }
  for (const required of ["packet", "output", "lmStudioSdk", "qwenModelKey"])
    if (!values[required]) fail(`--${required} ist erforderlich`);
  const numbers = {
    modelContext: Number(values.modelContext || DEFAULT_CONTEXT),
    maximumAttempts: Number(values.maximumAttempts || 3),
    requestTimeoutMs: Number(values.requestTimeoutMs || 180_000),
    abortSettlementTimeoutMs: Number(values.abortSettlementTimeoutMs || 15_000),
    modelRecoveryTimeoutMs: Number(values.modelRecoveryTimeoutMs || 180_000),
  };
  if (
    Object.values(numbers).some(
      (number) => !Number.isInteger(number) || number < 1
    ) ||
    numbers.maximumAttempts > 8
  )
    fail("Numerische Laufparameter sind ungültig");
  return {
    packet: path.resolve(values.packet),
    output: path.resolve(values.output),
    lmStudioSdk: path.resolve(values.lmStudioSdk),
    qwenModelKey: values.qwenModelKey,
    model: values.model || DEFAULT_MODEL,
    ...numbers,
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
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writePrivateJson(file, value) {
  if (fs.existsSync(file)) throw new Error(`OUTPUT_EXISTS:${file}`);
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.renameSync(temporary, file);
  fs.chmodSync(file, 0o600);
}

function parseJsonObject(modelText) {
  const normalized = String(modelText || "")
    .replace(/<think>[\s\S]*?<\/think>/giu, "")
    .trim();
  const start = normalized.indexOf("{");
  const end = normalized.lastIndexOf("}");
  if (start < 0 || end < start)
    throw new Error("LF_SOURCE_REVIEW_RESPONSE_JSON_OBJECT_MISSING");
  const parsed = JSON.parse(normalized.slice(start, end + 1));
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object")
    throw new Error("LF_SOURCE_REVIEW_RESPONSE_NOT_OBJECT");
  return parsed;
}

function candidateForModel(candidate) {
  return {
    candidateId: candidate.candidateId,
    documentName: candidate.documentName,
    documentRole: candidate.documentRole,
    documentStatus: candidate.documentStatus,
    physicalPageNumber: candidate.physicalPageNumber,
    exactQuote: candidate.exactQuote,
    evidenceOrigin: candidate.evidenceOrigin || "ROW_RETRIEVAL",
  };
}

function reviewRowForModel(row) {
  return {
    reviewIndex: row.reviewIndex,
    analysisRowId: row.analysisRowId,
    requirementId: row.requirementId,
    relation: row.relation,
    category: row.category,
    subcategory: row.subcategory,
    point: row.point,
    referenceA: row.referenceA,
    claudeClaim: row.claudeClaim,
    systemClaim: row.systemClaim,
    searchedDocuments: (row.searchedDocuments || []).map(
      ({ originalName, role, documentStatus }) => ({
        originalName,
        role,
        documentStatus,
      })
    ),
    retrieval: row.retrieval,
    actualComponents: row.actualComponents,
    components: row.components.map((component) => ({
      componentId: component.componentId,
      label: component.label,
      factRole: component.factRole,
      dimension: component.dimension,
      contextOnly: component.contextOnly === true,
      candidates: component.candidates.map(candidateForModel),
    })),
    globalClaudeRebind: (row.globalClaudeRebind || []).map(candidateForModel),
    globalReferenceARebind: (row.globalReferenceARebind || []).map(
      candidateForModel
    ),
  };
}

function messages(row) {
  return [
    {
      role: "system",
      content: [
        "Du führst eine source-bound fachliche Gegenstückprüfung für österreichische Gebäudeversicherung durch.",
        "Antworte ausschließlich mit genau einem JSON-Objekt und verwende nur vorgelegte candidateId-Werte und deren exakte Originaltexte.",
        "globalClaudeRebind enthält unabhängig vom Zeilenretrieval im gesamten Quellkorpus rückgebundene Claude-Fundstellen.",
        "globalReferenceARebind enthält für jeden A-Check zusätzlich unabhängig im gesamten Quellkorpus gesuchte A-Wortlautkandidaten.",
        "Beide dürfen für jeden Check verwendet werden, aber nur soweit ihr Wortlaut ihn wirklich trägt.",
        "Ähnliche Wörter sind kein Beleg, wenn Gegenstand, Gefahr, Wirkung, Rolle, Bedingung, Wert oder Scope abweichen; gemeinschaftlich genutzt ist nicht gewerblich genutzt.",
        "Ein Synonym ist nur bei gleicher versicherungsfachlicher Bedeutung ein MATCH.",
        "Der synthetische __row_context__-Check ist zwingend und prüft Kategorie, Unterkategorie und Prüfpunkt als fachlichen Scope; allgemeine Klauseln dürfen keinen speziellen Produktbaustein ersetzen.",
        "Der synthetische __row_context__-Check kann allein niemals ein Gegenstück begründen; mindestens eine nicht-synthetische fachliche Komponente muss im selben Scope belegt sein.",
        "Pro Check ist genau ein Ergebnis auszugeben:",
        "MATCH mit mindestens einer candidateId bedeutet fachlich gleiche Unterstützung.",
        "COUNTERPART_WITH_DIFFERENCE mit mindestens einer candidateId bedeutet dasselbe fachliche Vergleichselement, aber mit abweichendem Wert, Limit, Scope oder einer abweichenden Bedingung; die Abweichung muss zusätzlich source-bound in unmodeledDifferences stehen.",
        "COUNTERPART_WITH_DIFFERENCE ist ausschließlich für SCOPE, CONDITION, VALUE_AND_UNIT, LIMIT_BASIS, DEDUCTIBLE und TEMPORAL_VALIDITY zulässig. Bei OBJECT, PERIL_OR_CAUSE, DAMAGE_OR_EFFECT, COVERAGE_EFFECT, FACT_ROLE, DOCUMENT_ROLE oder PRECEDENCE_OR_REPLACEMENT ist ein anderer fachlicher Kern RELATED_ONLY oder bei wirklich gegenteiliger Wirkung OPPOSITE.",
        "OPPOSITE mit mindestens einer candidateId bedeutet ein echtes Gegenstück desselben Scopes mit gegenteiliger Wirkung.",
        "RELATED_ONLY mit mindestens einer candidateId bedeutet nur thematische Nähe bei anderem Gegenstand, Scope, Rolle oder Sachverhalt.",
        "NOT_ESTABLISHED bedeutet, dass in den Kandidaten kein tragfähiger Beleg vorliegt, und verlangt candidateIds:[].",
        "Das bloße Fehlen einer A-Regel in B ist niemals OPPOSITE.",
        "unmodeledDifferences ist immer ein Array; jede fachlich relevante zusätzliche Einschränkung, jeder engere Scope und jede abweichende Wirkung ohne passenden Check muss dort source-bound als {dimension,description,candidateIds} stehen.",
        "Gib keinen Zeilenstatus aus; der Server leitet ihn deterministisch aus den Einzelbefunden ab.",
        "NO_COUNTERPART_ESTABLISHED bedeutet später nur: in den vorgelegten exakten Kandidaten nicht belegt; es ist kein globaler Abwesenheitsnachweis.",
        "Erfinde niemals Fundstellen, IDs oder Inhalte.",
        "Ein abweichender Wert oder eine engere beziehungsweise weitere Bedingung macht eine echte Vergleichsstelle nicht zu RELATED_ONLY; RELATED_ONLY gilt nur für ein anderes fachliches Element, Objekt, eine andere Rolle oder einen anderen Sachverhalt.",
        "Das Ausgabeformat ist exakt {contractId,requirementId,componentFindings:[{componentId,dimension,outcome,candidateIds}],unmodeledDifferences:[{dimension,description,candidateIds}],rationale}.",
        "contractId muss LF_1PLUS9_SOURCE_REVIEW_RESPONSE_V8 sein.",
      ].join(" "),
    },
    {
      role: "user",
      content: JSON.stringify({
        promptContractId: PROMPT_CONTRACT_ID,
        responseContractId: SOURCE_REVIEW_RESPONSE_CONTRACT_ID,
        reviewRow: reviewRowForModel(row),
      }),
    },
  ];
}

function responseFormat(row) {
  const candidateIds = [
    ...new Set(
      [
        ...(row.globalClaudeRebind || []),
        ...(row.globalReferenceARebind || []),
        ...row.components.flatMap(({ candidates }) => candidates),
      ].map(({ candidateId }) => candidateId)
    ),
  ];
  return {
    type: "json_schema",
    json_schema: {
      name: "lf_known_fixture_source_review",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          contractId: {
            type: "string",
            enum: [SOURCE_REVIEW_RESPONSE_CONTRACT_ID],
          },
          requirementId: { type: "string", enum: [row.requirementId] },
          componentFindings: {
            type: "array",
            minItems: row.components.length,
            maxItems: row.components.length,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                componentId: {
                  type: "string",
                  enum: row.components.map(({ componentId }) => componentId),
                },
                dimension: {
                  type: "string",
                  enum: [
                    ...new Set(
                      row.components.map(({ dimension }) => dimension)
                    ),
                  ],
                },
                outcome: {
                  type: "string",
                  enum: [
                    "MATCH",
                    "COUNTERPART_WITH_DIFFERENCE",
                    "OPPOSITE",
                    "RELATED_ONLY",
                    "NOT_ESTABLISHED",
                  ],
                },
                candidateIds: {
                  type: "array",
                  items: { type: "string", enum: candidateIds },
                  uniqueItems: true,
                },
              },
              required: ["componentId", "dimension", "outcome", "candidateIds"],
            },
          },
          unmodeledDifferences: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                dimension: {
                  type: "string",
                  enum: [
                    "OBJECT",
                    "PERIL_OR_CAUSE",
                    "DAMAGE_OR_EFFECT",
                    "COVERAGE_EFFECT",
                    "SCOPE",
                    "FACT_ROLE",
                    "CONDITION",
                    "VALUE_AND_UNIT",
                    "LIMIT_BASIS",
                    "DEDUCTIBLE",
                    "TEMPORAL_VALIDITY",
                    "DOCUMENT_ROLE",
                    "PRECEDENCE_OR_REPLACEMENT",
                  ],
                },
                description: { type: "string", minLength: 1 },
                candidateIds: {
                  type: "array",
                  minItems: 1,
                  items: { type: "string", enum: candidateIds },
                  uniqueItems: true,
                },
              },
              required: ["dimension", "description", "candidateIds"],
            },
          },
          rationale: { type: "string", minLength: 1 },
        },
        required: [
          "contractId",
          "requirementId",
          "componentFindings",
          "unmodeledDifferences",
          "rationale",
        ],
      },
    },
  };
}

function repairMessages(row, rawResponse, error) {
  return [
    ...messages(row),
    { role: "assistant", content: rawResponse },
    {
      role: "user",
      content: `Die Antwort ist formal ungültig (${errorClass(
        error
      )}). Korrigiere dasselbe Objekt, ohne neue Kandidaten zu erfinden. Wichtig: Gib keinen outcome auf Zeilenebene aus; der Server rollt ihn auf. outcome innerhalb jedes componentFinding ist ausschließlich MATCH, COUNTERPART_WITH_DIFFERENCE, OPPOSITE, RELATED_ONLY oder NOT_ESTABLISHED. NOT_ESTABLISHED hat candidateIds exakt []; alle anderen Outcomes benötigen mindestens eine erlaubte candidateId. COUNTERPART_WITH_DIFFERENCE ist nur für SCOPE, CONDITION, VALUE_AND_UNIT, LIMIT_BASIS, DEDUCTIBLE und TEMPORAL_VALIDITY erlaubt und benötigt außerdem mindestens eine source-bound unmodeledDifference mit einer derselben candidateIds. Falls bei OBJECT, PERIL_OR_CAUSE, DAMAGE_OR_EFFECT, COVERAGE_EFFECT, FACT_ROLE, DOCUMENT_ROLE oder PRECEDENCE_OR_REPLACEMENT derselbe fachliche Kern belegt ist und nur ein Modifikator abweicht, setze den Kern auf MATCH und dokumentiere den Modifikator separat in unmodeledDifferences. Falls bereits der fachliche Kern verschieden ist, verwende RELATED_ONLY. Bei echt gegenteiliger Wirkung desselben Scopes verwende OPPOSITE. unmodeledDifferences ist immer ein Array; jeder Eintrag braucht dimension, eine Beschreibung und mindestens eine vorhandene candidateId. requirementId und alle componentId/dimension-Paare müssen unverändert bleiben.`,
    },
  ];
}

function errorClass(error) {
  if (typeof error?.errorClass === "string") return error.errorClass;
  if (error instanceof SyntaxError) return "MODEL_JSON_INVALID";
  if (typeof error?.code === "string") return error.code;
  return "MODEL_RESPONSE_INVALID";
}

function nextAttemptFile(output, row) {
  const directory = path.join(output, "attempts");
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const prefix = `${String(row.reviewIndex + 1).padStart(2, "0")}-${row.requirementId}-`;
  const count = fs
    .readdirSync(directory)
    .filter(
      (name) => name.startsWith(prefix) && name.endsWith(".private.json")
    ).length;
  return path.join(
    directory,
    `${prefix}${String(count + 1).padStart(3, "0")}.private.json`
  );
}

function resultFile(output, row) {
  return path.join(
    output,
    "rows",
    `${String(row.reviewIndex + 1).padStart(2, "0")}-${row.requirementId}.private.json`
  );
}

function reusableResult(file, { packetSha256, model, modelContext, row }) {
  if (!fs.existsSync(file)) return null;
  const result = readJson(file, "LF_SOURCE_REVIEW_RESULT");
  if (
    result?.contractId !== RESULT_CONTRACT_ID ||
    result?.status !== "MODEL_SOURCE_REVIEW_VALIDATED_NOT_GOLD" ||
    result.packetSha256 !== packetSha256 ||
    result.model !== model ||
    result.modelContext !== modelContext ||
    result.requirementId !== row.requirementId
  )
    throw new Error(`LF_SOURCE_REVIEW_RESULT_BINDING_INVALID:${file}`);
  validateSourceReviewResponse(row, result.response);
  return result;
}

function recoverValidatedAttempt(output, packet, row) {
  const directory = path.join(output, "attempts");
  if (!fs.existsSync(directory)) return null;
  const prefix = `${String(row.reviewIndex + 1).padStart(2, "0")}-${row.requirementId}-`;
  const files = fs
    .readdirSync(directory)
    .filter((name) => name.startsWith(prefix) && name.endsWith(".private.json"))
    .sort();
  for (const name of files) {
    const attempt = readJson(
      path.join(directory, name),
      "LF_SOURCE_REVIEW_ATTEMPT"
    );
    if (
      attempt.contractId !== RUN_CONTRACT_ID ||
      attempt.packetSha256 !== packet.packetSha256 ||
      attempt.requirementId !== row.requirementId ||
      typeof attempt.rawResponse !== "string" ||
      !attempt.rawResponse
    )
      continue;
    try {
      return {
        attemptFile: name,
        requestSha256: attempt.requestSha256,
        rawResponse: attempt.rawResponse,
        response: validateSourceReviewResponse(
          row,
          parseJsonObject(attempt.rawResponse)
        ),
      };
    } catch {
      // A prior invalid response remains immutable evidence and is skipped.
    }
  }
  return null;
}

async function runReviewRow({
  client,
  recoverModelAfterAbort,
  args,
  packet,
  row,
}) {
  const file = resultFile(args.output, row);
  const reusable = reusableResult(file, {
    packetSha256: packet.packetSha256,
    model: args.model,
    modelContext: args.modelContext,
    row,
  });
  if (reusable) return { result: reusable, reused: true };
  const recovered = recoverValidatedAttempt(args.output, packet, row);
  if (recovered) {
    const result = {
      schemaVersion: 1,
      contractId: RESULT_CONTRACT_ID,
      status: "MODEL_SOURCE_REVIEW_VALIDATED_NOT_GOLD",
      goldAuthority: false,
      packetSha256: packet.packetSha256,
      promptContractId: PROMPT_CONTRACT_ID,
      promptSha256: recovered.requestSha256,
      model: args.model,
      modelContext: args.modelContext,
      requirementId: row.requirementId,
      analysisRowId: row.analysisRowId,
      relation: row.relation,
      response: recovered.response,
      rawResponseSha256: sha256(recovered.rawResponse),
      recoveredFromAttemptFile: recovered.attemptFile,
      completedAt: new Date().toISOString(),
    };
    writePrivateJson(file, result);
    return { result, reused: true };
  }
  let requestMessages = messages(row);
  let lastError = null;
  for (let attempt = 1; attempt <= args.maximumAttempts; attempt += 1) {
    const started = performance.now();
    const requestSha256 = sha256(JSON.stringify(requestMessages));
    let rawResponse = "";
    try {
      const completion = await requestCompletionWithTimeout({
        client,
        payload: {
          model: args.model,
          messages: requestMessages,
          temperature: 0,
          max_tokens: 6_000,
          response_format: responseFormat(row),
        },
        requestTimeoutMs: args.requestTimeoutMs,
        abortSettlementTimeoutMs: args.abortSettlementTimeoutMs,
        recoverModelAfterAbort,
      });
      rawResponse = completion.choices?.[0]?.message?.content || "";
      const response = validateSourceReviewResponse(
        row,
        parseJsonObject(rawResponse)
      );
      const attemptArtifact = {
        schemaVersion: 1,
        contractId: RUN_CONTRACT_ID,
        packetSha256: packet.packetSha256,
        requirementId: row.requirementId,
        attempt,
        durationMs: Math.round(performance.now() - started),
        requestSha256,
        errorClass: null,
        timedOut: false,
        abortTriggered: false,
        responseModel: completion.model || null,
        usage: completion.usage || null,
        rawResponseSha256: sha256(rawResponse),
        rawResponse,
        validated: true,
      };
      writePrivateJson(nextAttemptFile(args.output, row), attemptArtifact);
      const result = {
        schemaVersion: 1,
        contractId: RESULT_CONTRACT_ID,
        status: "MODEL_SOURCE_REVIEW_VALIDATED_NOT_GOLD",
        goldAuthority: false,
        packetSha256: packet.packetSha256,
        promptContractId: PROMPT_CONTRACT_ID,
        promptSha256: requestSha256,
        model: args.model,
        modelContext: args.modelContext,
        requirementId: row.requirementId,
        analysisRowId: row.analysisRowId,
        relation: row.relation,
        response,
        rawResponseSha256: sha256(rawResponse),
        completedAt: new Date().toISOString(),
      };
      writePrivateJson(file, result);
      return { result, reused: false };
    } catch (error) {
      lastError = error;
      writePrivateJson(nextAttemptFile(args.output, row), {
        schemaVersion: 1,
        contractId: RUN_CONTRACT_ID,
        packetSha256: packet.packetSha256,
        requirementId: row.requirementId,
        attempt,
        durationMs: Math.round(performance.now() - started),
        requestSha256,
        errorClass: errorClass(error),
        errorMessage: String(error?.message || error),
        timedOut: error?.telemetry?.timedOut === true,
        timeoutMs: error?.telemetry?.timeoutMs || args.requestTimeoutMs,
        abortTriggered: error?.telemetry?.abortTriggered === true,
        requestSettledAfterAbort:
          error?.telemetry?.requestSettledAfterAbort ?? null,
        recovery: error?.telemetry?.recovery || null,
        rawResponseSha256: sha256(rawResponse),
        rawResponse,
        validated: false,
      });
      if (rawResponse)
        requestMessages = repairMessages(row, rawResponse, error);
    }
  }
  throw new Error(
    `LF_SOURCE_REVIEW_RETRIES_EXHAUSTED:${row.requirementId}:${errorClass(lastError)}`
  );
}

async function verifyModel({ baseUrl, model, modelContext }) {
  const response = await fetch(
    `${baseUrl.replace(/\/v1\/?$/u, "")}/api/v0/models`,
    { signal: AbortSignal.timeout(15_000) }
  );
  if (!response.ok) throw new Error(`MODEL_LIST_FAILED:${response.status}`);
  const body = await response.json();
  const loaded = body?.data?.find(
    (candidate) =>
      candidate.id === model &&
      candidate.type === "llm" &&
      candidate.state === "loaded"
  );
  if (Number(loaded?.loaded_context_length) !== modelContext)
    throw new Error(`MODEL_NOT_EXACTLY_LOADED:${model}:${modelContext}`);
  return {
    id: loaded.id,
    state: loaded.state,
    loadedContextLength: Number(loaded.loaded_context_length),
  };
}

function expectedPacketRowCount(packet) {
  if (packet?.selection?.sample === "REPRESENTATIVE_30_V1") return 30;
  if (packet?.selection?.sample === "ALL_283_V1") return 283;
  return null;
}

async function run() {
  const args = argumentsFrom(process.argv.slice(2));
  const packet = readJson(args.packet, "LF_SOURCE_REVIEW_PACKET");
  const expectedRows = expectedPacketRowCount(packet);
  if (
    packet?.contractId !== SOURCE_REVIEW_PACKET_CONTRACT_ID ||
    packet?.status !== "READY_FOR_SOURCE_REVIEW" ||
    expectedRows === null ||
    !Array.isArray(packet.rows) ||
    packet.rows.length !== expectedRows
  )
    throw new Error("LF_SOURCE_REVIEW_PACKET_INVALID");
  if (fs.existsSync(args.output)) {
    const stat = fs.lstatSync(args.output);
    if (!stat.isDirectory() || stat.isSymbolicLink())
      throw new Error("LF_SOURCE_REVIEW_OUTPUT_INVALID");
  } else fs.mkdirSync(args.output, { recursive: true, mode: 0o700 });
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
  const results = [];
  for (const row of packet.rows) {
    const reviewed = await runReviewRow({
      client,
      recoverModelAfterAbort,
      args,
      packet,
      row,
    });
    results.push(reviewed);
    console.log(
      `[lf-source-review] ${row.reviewIndex + 1}/${packet.rows.length} ${row.requirementId}: ${reviewed.result.response.outcome}${reviewed.reused ? " (wiederverwendet)" : ""}`
    );
  }
  const responses = results.map(({ result }) => result.response);
  const outcomeCounts = Object.fromEntries(
    [...new Set(responses.map(({ outcome }) => outcome))]
      .sort()
      .map((outcome) => [
        outcome,
        responses.filter((response) => response.outcome === outcome).length,
      ])
  );
  const summary = {
    schemaVersion: 1,
    contractId: RUN_CONTRACT_ID,
    status: "MODEL_SOURCE_REVIEW_COMPLETE_NOT_GOLD",
    goldAuthority: false,
    packetSha256: packet.packetSha256,
    promptContractId: PROMPT_CONTRACT_ID,
    model: loadedModel,
    transport: {
      requestTimeoutMs: args.requestTimeoutMs,
      abortSettlementTimeoutMs: args.abortSettlementTimeoutMs,
      modelRecoveryTimeoutMs: args.modelRecoveryTimeoutMs,
      maximumAttempts: args.maximumAttempts,
    },
    startedAt,
    completedAt: new Date().toISOString(),
    wallDurationMs: Math.round(performance.now() - started),
    rows: results.length,
    reusedRows: results.filter(({ reused }) => reused).length,
    outcomeCounts,
    customerFoundRows: responses.filter(({ customerFound }) => customerFound)
      .length,
    customerNotFoundRows: responses.filter(
      ({ customerFound }) => !customerFound
    ).length,
    nextGate: "INDEPENDENT_SOURCE_ADJUDICATION",
  };
  const summaryFile = path.join(args.output, "summary.private.json");
  if (fs.existsSync(summaryFile)) {
    const existing = readJson(summaryFile, "LF_SOURCE_REVIEW_SUMMARY");
    if (
      existing.packetSha256 !== summary.packetSha256 ||
      existing.rows !== summary.rows ||
      JSON.stringify(existing.outcomeCounts) !== JSON.stringify(outcomeCounts)
    )
      throw new Error("LF_SOURCE_REVIEW_SUMMARY_CONFLICT");
  } else writePrivateJson(summaryFile, summary);
  console.log(JSON.stringify(summary));
}

if (require.main === module)
  run().catch((error) => fail(error.stack || error.message));

module.exports = {
  expectedPacketRowCount,
  messages,
  parseJsonObject,
  reviewRowForModel,
  recoverValidatedAttempt,
  repairMessages,
  responseFormat,
  reusableResult,
  runReviewRow,
};

#!/usr/bin/env node

process.umask(0o077);

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { performance } = require("perf_hooks");
const { OpenAI } = require("openai");
const {
  buildADrivenTerminalEvidenceReplay,
} = require("../../utils/policyAnalysis/aDrivenBFactIndex");
const {
  validateADrivenRequirementDecisionPlan,
} = require("../../utils/policyAnalysis/aDrivenRequirementCounterpartDecision");
const {
  createLmStudioRecovery,
  parseJsonArray,
  requestCompletionWithTimeout,
} = require("./runADrivenReferenceClassification.cjs");
const {
  readJson,
  writePrivateJson,
} = require("./buildADrivenBFastPathShadow.cjs");
const {
  replayPlan,
  requirementsForPartition,
} = require("./runADrivenBCorpusLocatorShadow.cjs");

const RUN_CONTRACT_ID = "LF_A_DRIVEN_COMPACT_WINDOW_DECISION_RUN_V11";
const PROMPT_CONTRACT_ID = "LF_A_DRIVEN_COMPACT_WINDOW_DECISION_PROMPT_V10";
const REUSABLE_RUN_CONTRACT_IDS = new Set([RUN_CONTRACT_ID]);
const DEFAULT_MODEL = "qwen/qwen3.6-35b-a3b";
const DEFAULT_CONTEXT = 42_496;
const OUTCOMES = new Set([
  "MATCH",
  "OPPOSITE",
  "RELATED_ONLY",
  "NOT_ESTABLISHED",
]);
const POSITIVE_OUTCOMES = new Set(["MATCH", "OPPOSITE"]);

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function fail(message) {
  console.error(`[lf-compact-window-decisions] ${message}`);
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
  for (const required of [
    "decisionPlan",
    "locatorPlan",
    "factIndex",
    "rescuePlan",
    "rescueDecisions",
    "output",
    "lmStudioSdk",
    "qwenModelKey",
  ])
    if (!values[required]) fail(`--${required} ist erforderlich`);
  const integer = (name, fallback, minimum = 1) => {
    const parsed = Number(values[name] ?? fallback);
    if (!Number.isSafeInteger(parsed) || parsed < minimum)
      fail(`--${name} ist ungültig`);
    return parsed;
  };
  return {
    decisionPlan: path.resolve(values.decisionPlan),
    locatorPlan: path.resolve(values.locatorPlan),
    factIndex: path.resolve(values.factIndex),
    rescuePlan: path.resolve(values.rescuePlan),
    rescueDecisions: path.resolve(values.rescueDecisions),
    output: path.resolve(values.output),
    seedOutput: values.seedOutput ? path.resolve(values.seedOutput) : null,
    lmStudioSdk: path.resolve(values.lmStudioSdk),
    qwenModelKey: values.qwenModelKey,
    model: values.model || DEFAULT_MODEL,
    modelContext: integer("modelContext", DEFAULT_CONTEXT, 1_000),
    maximumAttempts: integer("maximumAttempts", 2),
    maximumEvidencePerRequirement: integer("maximumEvidencePerRequirement", 48),
    maximumComponentsPerRequest: integer("maximumComponentsPerRequest", 1),
    requestTimeoutMs: integer("requestTimeoutMs", 300_000),
    abortSettlementTimeoutMs: integer("abortSettlementTimeoutMs", 15_000),
    modelRecoveryTimeoutMs: integer("modelRecoveryTimeoutMs", 180_000),
  };
}

function partitionCompactDecisionWork(
  decisionPlan,
  locatorPlan,
  maximumComponentsPerRequest = 1,
  factIndex = null
) {
  const sourceRowsById = new Map(
    decisionPlan.rows.map((row) => [row.requirementId, row])
  );
  const locatorRequirementsById = new Map(
    locatorPlan.requirements.map((row) => [row.requirementId, row])
  );
  const work = [];
  for (const sourcePartition of locatorPlan.partitions) {
    let currentRequirementIds = [];
    let currentComponents = 0;
    const flush = () => {
      if (!currentRequirementIds.length) return;
      const sourcePartitionPart = work.filter(
        ({ sourcePartitionIndex }) =>
          sourcePartitionIndex === sourcePartition.partitionIndex
      ).length;
      const sourceFactIds = new Set(sourcePartition.factIds);
      const routedFactIds = new Set();
      let keepCompletePartition = false;
      for (const requirementId of currentRequirementIds) {
        const locatorRequirement = locatorRequirementsById.get(requirementId);
        if (!locatorRequirement)
          throw new Error(
            `LF_A_DRIVEN_COMPACT_WINDOW_LOCATOR_REQUIREMENT_MISSING:${requirementId}`
          );
        if (!Array.isArray(locatorRequirement.candidateFactIds)) {
          keepCompletePartition = true;
          break;
        }
        for (const factId of locatorRequirement.candidateFactIds)
          if (sourceFactIds.has(factId)) routedFactIds.add(factId);
      }
      const factIds = keepCompletePartition
        ? [...sourcePartition.factIds]
        : sourcePartition.factIds.filter((factId) => routedFactIds.has(factId));
      if (!factIds.length)
        throw new Error(
          `LF_A_DRIVEN_COMPACT_WINDOW_ROUTED_CANDIDATES_MISSING:${currentRequirementIds.join(",")}`
        );
      const candidateByFactId = new Map(
        sourcePartition.candidates.map((candidate) => [
          candidate.factId,
          candidate,
        ])
      );
      let candidates = factIds.map((factId) => {
        const candidate = candidateByFactId.get(factId);
        if (!candidate)
          throw new Error(
            `LF_A_DRIVEN_COMPACT_WINDOW_CANDIDATE_MISSING:${factId}`
          );
        return candidate;
      });
      let decisionFactIds = factIds;
      let candidateContext = "ROUTED_SOURCE_WINDOW";
      if (factIndex) {
        const parentById = new Map(
          factIndex.facts.map((fact) => [fact.factId, fact])
        );
        const seenParentIds = new Set();
        const completeParentCandidates = [];
        const representativeWindowIds = [];
        for (const candidate of candidates) {
          const parentFactId = candidate.parentFactId || candidate.factId;
          if (seenParentIds.has(parentFactId)) continue;
          const parent = parentById.get(parentFactId);
          if (!parent)
            throw new Error(
              `LF_A_DRIVEN_COMPACT_WINDOW_PARENT_FACT_MISSING:${parentFactId}`
            );
          seenParentIds.add(parentFactId);
          representativeWindowIds.push(candidate.factId);
          completeParentCandidates.push({
            ...candidate,
            exactText: parent.exactText,
            exactTextSha256: parent.exactTextSha256,
            parentFactId,
            decisionContext: "COMPLETE_PARENT_FACT",
          });
        }
        decisionFactIds = representativeWindowIds;
        candidates = completeParentCandidates;
        candidateContext = "COMPLETE_PARENT_FACT";
      }
      work.push({
        ...sourcePartition,
        partitionId: `${sourcePartition.partitionId}-D${sourcePartitionPart + 1}${factIndex ? "-PF" : ""}`,
        partitionIndex: work.length,
        sourcePartitionIndex: sourcePartition.partitionIndex,
        sourcePartitionPart,
        requirementIds: currentRequirementIds,
        factIds: decisionFactIds,
        candidates,
        candidateContext,
      });
      currentRequirementIds = [];
      currentComponents = 0;
    };
    for (const requirementId of sourcePartition.requirementIds) {
      const row = sourceRowsById.get(requirementId);
      if (!row)
        throw new Error(
          `LF_A_DRIVEN_COMPACT_WINDOW_REQUIREMENT_MISSING:${requirementId}`
        );
      const components = row.components.length;
      if (
        currentRequirementIds.length &&
        currentComponents + components > maximumComponentsPerRequest
      )
        flush();
      currentRequirementIds.push(requirementId);
      currentComponents += components;
      if (currentComponents >= maximumComponentsPerRequest) flush();
    }
    flush();
  }
  return work;
}

function compactComponent(component, index) {
  return {
    k: index + 1,
    d: component.dimension,
    label: component.label,
    core: component.identityCore,
    ...(component.rawValue ? { value: component.rawValue } : {}),
    ...(component.unit ? { unit: component.unit } : {}),
    ...(component.qualifier ? { qualifier: component.qualifier } : {}),
    ...(component.coverageEffect ? { effect: component.coverageEffect } : {}),
  };
}

function compactDecisionPromptView(decisionPlan, locatorPlan, partition) {
  const sourceRowsById = new Map(
    decisionPlan.rows.map((row) => [row.requirementId, row])
  );
  const locatorRequirements = requirementsForPartition(locatorPlan, partition);
  return {
    requirements: locatorRequirements.map((requirement, index) => {
      const sourceRow = sourceRowsById.get(requirement.requirementId);
      if (!sourceRow)
        throw new Error(
          `LF_A_DRIVEN_COMPACT_WINDOW_REQUIREMENT_MISSING:${requirement.requirementId}`
        );
      return {
        r: index + 1,
        label: sourceRow.displayLabel,
        path: sourceRow.structurePath,
        components: sourceRow.components.map(compactComponent),
      };
    }),
    candidates: partition.candidates.map((candidate, index) => ({
      c: index + 1,
      role: candidate.documentRole,
      page: candidate.physicalPageNumber,
      text: candidate.exactText,
    })),
  };
}

function prompt(
  decisionPlan,
  locatorPlan,
  partition,
  maximumEvidencePerRequirement,
  repair = null
) {
  const view = compactDecisionPromptView(decisionPlan, locatorPlan, partition);
  const messages = [
    {
      role: "system",
      content: `Du entscheidest mehrere fachliche Anforderungen aus Referenzpaket A direkt gegen die einmalig angezeigten, vollständigen und servergebundenen B-Klauselkontexte. Prüfe jedes r und jede Komponente k unabhängig. MATCH bedeutet derselbe fachliche Kern im passenden Objekt-, Gefahren-, Schaden- oder Rollenkontext. OPPOSITE bedeutet derselbe Kern mit ausdrücklich gegenteiliger Vertragswirkung oder Ausschluss. RELATED_ONLY bedeutet bloß verwandt ohne Gegenstück. NOT_ESTABLISHED bedeutet im vorgelegten Kandidatensatz nicht belegt und ist ausdrücklich kein Abwesenheitsnachweis für das gesamte B-Paket. Abweichende Werte, Limits, Bedingungen, Umfänge oder Zeiträume bleiben MATCH auf Kontextebene; die betroffene Komponente kann MATCH oder OPPOSITE sein. Bei FACT_ROLE muss B dieselbe Kosten-, Leistungs-, Definitions- oder sonstige Faktrolle ausdrücken: Ein Objekt, Raum, Gerät oder eine Tätigkeit mit demselben Stichwort ist kein Gegenstück zu einer Kosten- oder Leistungsanforderung. Eine bloße Keyword-Nennung, Überschrift, Nachbarklausel, irgendeine andere Kostenposition oder Branchenüblichkeit genügt nicht. Nutze nur angezeigte c und höchstens ${maximumEvidencePerRequirement} eindeutige c je r insgesamt. Antworte ausschließlich als kompaktes JSON-Array in exakt der r-Reihenfolge: [{"r":1,"o":"MATCH","c":[2],"f":[{"k":1,"o":"MATCH","c":[2]}]}]. Jedes r und jedes k exakt einmal. f MUSS für jede angezeigte k genau einen eigenen Eintrag enthalten, auch wenn dessen o NOT_ESTABLISHED ist; ein Kontext-o gilt niemals automatisch für eine ausgelassene Komponente. o ist nur MATCH, OPPOSITE, RELATED_ONLY oder NOT_ESTABLISHED. NOT_ESTABLISHED hat c []; alle anderen Outcomes benötigen mindestens ein c. Keine Erläuterung und keine weiteren Felder.`,
    },
    {
      role: "user",
      content: JSON.stringify({
        contractId: RUN_CONTRACT_ID,
        promptContractId: PROMPT_CONTRACT_ID,
        partitionId: partition.partitionId,
        requirements: view.requirements,
        candidates: view.candidates,
      }),
    },
  ];
  if (repair) messages.push({ role: "user", content: repair });
  return messages;
}

function validateAliasDecisionResponse(
  response,
  decisionPlan,
  locatorPlan,
  partition,
  maximumEvidencePerRequirement
) {
  const view = compactDecisionPromptView(decisionPlan, locatorPlan, partition);
  const mergedRequirementNumbers = new Set();
  const synthesizedEmptyFindingsNumbers = new Set();
  let responseItems = Array.isArray(response)
    ? response.map((item) => {
        if (
          item &&
          Object.keys(item).sort().join(",") === "c,o,r" &&
          item.o === "NOT_ESTABLISHED" &&
          Array.isArray(item.c) &&
          item.c.length === 0 &&
          Number.isSafeInteger(item.r)
        ) {
          synthesizedEmptyFindingsNumbers.add(item.r);
          return { ...item, f: [] };
        }
        return item;
      })
    : response;
  if (
    Array.isArray(responseItems) &&
    responseItems.length > view.requirements.length
  ) {
    const groups = new Map();
    let mergeable = true;
    for (const item of responseItems) {
      if (
        !item ||
        Object.keys(item).sort().join(",") !== "c,f,o,r" ||
        !Number.isSafeInteger(item.r) ||
        item.r < 1 ||
        item.r > view.requirements.length ||
        !Array.isArray(item.c) ||
        !Array.isArray(item.f)
      ) {
        mergeable = false;
        break;
      }
      const group = groups.get(item.r) || {
        r: item.r,
        o: item.o,
        c: [],
        findingsByComponent: new Map(),
        fragments: 0,
      };
      if (group.o !== item.o) {
        mergeable = false;
        break;
      }
      group.c.push(...item.c);
      group.fragments += 1;
      for (const finding of item.f) {
        const existing = group.findingsByComponent.get(finding?.k);
        if (existing && JSON.stringify(existing) !== JSON.stringify(finding)) {
          mergeable = false;
          break;
        }
        group.findingsByComponent.set(finding?.k, finding);
      }
      if (!mergeable) break;
      groups.set(item.r, group);
    }
    if (
      mergeable &&
      groups.size === view.requirements.length &&
      view.requirements.every(({ r }) => groups.has(r))
    ) {
      responseItems = view.requirements.map(({ r }) => {
        const group = groups.get(r);
        if (group.fragments > 1) mergedRequirementNumbers.add(r);
        return {
          r,
          o: group.o,
          c: [...new Set(group.c)],
          f: [...group.findingsByComponent.values()].sort(
            (left, right) => left.k - right.k
          ),
        };
      });
    }
  }
  if (
    !Array.isArray(responseItems) ||
    responseItems.length !== view.requirements.length
  )
    throw new Error("LF_A_DRIVEN_COMPACT_WINDOW_RESPONSE_LENGTH_INVALID");
  const displayed = new Set(view.candidates.map(({ c }) => c));
  const validateEvidence = (outcome, evidence) =>
    OUTCOMES.has(outcome) &&
    Array.isArray(evidence) &&
    new Set(evidence).size === evidence.length &&
    evidence.every(
      (candidateNumber) =>
        Number.isSafeInteger(candidateNumber) && displayed.has(candidateNumber)
    ) &&
    (outcome === "NOT_ESTABLISHED"
      ? evidence.length === 0
      : evidence.length > 0);
  return responseItems.map((item, index) => {
    const expected = view.requirements[index];
    if (
      !item ||
      Object.keys(item).sort().join(",") !== "c,f,o,r" ||
      item.r !== expected.r ||
      !validateEvidence(item.o, item.c) ||
      !Array.isArray(item.f) ||
      new Set(item.f.map(({ k }) => k)).size !== item.f.length ||
      item.f.some(
        ({ k }) => !expected.components.some((component) => component.k === k)
      )
    )
      throw new Error(
        `LF_A_DRIVEN_COMPACT_WINDOW_RESPONSE_ITEM_INVALID:${expected.r}`
      );
    const allEvidence = [...item.c];
    const findingsByComponentNumber = new Map(
      item.f.map((finding) => [finding?.k, finding])
    );
    const deterministicNormalizations = [];
    if (synthesizedEmptyFindingsNumbers.has(expected.r))
      deterministicNormalizations.push({
        reason: "NOT_ESTABLISHED_EMPTY_FINDINGS_SYNTHESIZED",
      });
    if (mergedRequirementNumbers.has(expected.r))
      deterministicNormalizations.push({
        reason: "SPLIT_REQUIREMENT_ITEMS_MERGED",
      });
    const components = expected.components.map((expectedComponent) => {
      let finding = findingsByComponentNumber.get(expectedComponent.k);
      if (!finding && POSITIVE_OUTCOMES.has(item.o))
        throw new Error(
          `LF_A_DRIVEN_COMPACT_WINDOW_COMPONENT_MISSING:${expected.r}:${expectedComponent.k}`
        );
      if (!finding) {
        finding = {
          k: expectedComponent.k,
          o: "NOT_ESTABLISHED",
          c: [],
        };
        deterministicNormalizations.push({
          componentNumber: expectedComponent.k,
          reason: "MISSING_COMPONENT_DOWNGRADED_TO_NOT_ESTABLISHED",
        });
      }
      if (
        finding &&
        Object.keys(finding).sort().join(",") === "c,f,k,o" &&
        Array.isArray(finding.f) &&
        finding.f.length === 0
      ) {
        const { f: _emptyNestedFindings, ...flatFinding } = finding;
        finding = flatFinding;
        deterministicNormalizations.push({
          componentNumber: expectedComponent.k,
          reason: "EMPTY_NESTED_FINDINGS_REMOVED",
        });
      }
      if (
        finding?.o === "RELATED_ONLY" &&
        Array.isArray(finding.c) &&
        finding.c.length === 0
      ) {
        finding = { ...finding, o: "NOT_ESTABLISHED" };
        deterministicNormalizations.push({
          componentNumber: expectedComponent.k,
          reason: "UNCITED_RELATED_ONLY_DOWNGRADED_TO_NOT_ESTABLISHED",
        });
      }
      if (
        !finding ||
        Object.keys(finding).sort().join(",") !== "c,k,o" ||
        finding.k !== expectedComponent.k ||
        !validateEvidence(finding.o, finding.c)
      )
        throw new Error(
          `LF_A_DRIVEN_COMPACT_WINDOW_COMPONENT_INVALID:${expected.r}:${expectedComponent.k}`
        );
      allEvidence.push(...finding.c);
      return finding;
    });
    const candidateNumbers = [...new Set(allEvidence)];
    if (candidateNumbers.length > maximumEvidencePerRequirement)
      throw new Error(
        `LF_A_DRIVEN_COMPACT_WINDOW_EVIDENCE_LIMIT:${expected.r}`
      );
    return {
      requirementId: requirementsForPartition(locatorPlan, partition)[index]
        .requirementId,
      contextOutcome: item.o,
      candidateFactIds: candidateNumbers.map(
        (candidateNumber) => partition.factIds[candidateNumber - 1]
      ),
      componentFindings: components,
      deterministicNormalizations,
    };
  });
}

function reusableCompactDecisionPartition({
  args,
  decisionPlan,
  locatorPlan,
  partition,
}) {
  if (!args.seedOutput) return null;
  const resultPath = path.join(
    args.seedOutput,
    `partition-${String(partition.partitionIndex).padStart(3, "0")}.private.json`
  );
  if (!fs.existsSync(resultPath)) return null;
  const result = readJson(
    resultPath,
    "LF_A_DRIVEN_COMPACT_WINDOW_SEED_PARTITION"
  );
  const passAttempt = [...(result.attempts || [])]
    .reverse()
    .find(({ status, rawResponse }) => status === "PASS" && rawResponse);
  if (
    !REUSABLE_RUN_CONTRACT_IDS.has(result.contractId) ||
    result.locatorPlanSha256 !== locatorPlan.planSha256 ||
    result.partitionId !== partition.partitionId ||
    !passAttempt
  )
    throw new Error(
      `LF_A_DRIVEN_COMPACT_WINDOW_SEED_INVALID:${partition.partitionId}`
    );
  const parsed = parseJsonArray(passAttempt.rawResponse);
  return {
    responses: validateAliasDecisionResponse(
      parsed.responses,
      decisionPlan,
      locatorPlan,
      partition,
      args.maximumEvidencePerRequirement
    ),
    attempts: result.attempts,
    reusedFrom: resultPath,
  };
}

async function verifyModel({ baseUrl, model, modelContext }) {
  const response = await fetch(
    `${baseUrl.replace(/\/v1\/?$/u, "")}/api/v0/models`,
    { signal: AbortSignal.timeout(15_000) }
  );
  if (!response.ok)
    throw new Error(
      `LF_A_DRIVEN_COMPACT_WINDOW_MODEL_LIST_FAILED:${response.status}`
    );
  const body = await response.json();
  const loaded = body?.data?.find(
    ({ id, type, state }) =>
      id === model && type === "llm" && state === "loaded"
  );
  if (!loaded || Number(loaded.loaded_context_length) !== Number(modelContext))
    throw new Error(
      `LF_A_DRIVEN_COMPACT_WINDOW_MODEL_NOT_EXACTLY_LOADED:${model}:${modelContext}`
    );
  return {
    id: loaded.id,
    state: loaded.state,
    loadedContextLength: Number(loaded.loaded_context_length),
  };
}

async function decidePartition({
  args,
  decisionPlan,
  locatorPlan,
  partition,
  client,
  recoverModelAfterAbort,
}) {
  const attempts = [];
  for (let attempt = 1; attempt <= args.maximumAttempts; attempt += 1) {
    const missingComponent = attempts
      .at(-1)
      ?.errorMessage?.match(
        /LF_A_DRIVEN_COMPACT_WINDOW_COMPONENT_MISSING:(\d+):(\d+)/u
      );
    const repair = attempts.length
      ? `Die vorige Antwort war nicht vertragsgültig. Wiederhole alle r und k exakt in der vorgegebenen Reihenfolge.${
          missingComponent
            ? ` Insbesondere fehlte für r=${missingComponent[1]} die Komponente k=${missingComponent[2]}; bewerte sie semantisch selbstständig und gib sie in f an.`
            : ""
        } Gültige Kandidaten sind c=1..${partition.factIds.length}; je r insgesamt höchstens ${args.maximumEvidencePerRequirement}. Verwende exakt die Felder r,o,c,f beziehungsweise k,o,c.`
      : null;
    const messages = prompt(
      decisionPlan,
      locatorPlan,
      partition,
      args.maximumEvidencePerRequirement,
      repair
    );
    const started = performance.now();
    let rawResponse = "";
    try {
      const completion = await requestCompletionWithTimeout({
        client,
        payload: {
          model: args.model,
          messages,
          temperature: 0,
          max_tokens: 8_000,
        },
        requestTimeoutMs: args.requestTimeoutMs,
        abortSettlementTimeoutMs: args.abortSettlementTimeoutMs,
        recoverModelAfterAbort,
      });
      rawResponse = completion.choices?.[0]?.message?.content || "";
      const parsed = parseJsonArray(rawResponse);
      const responses = validateAliasDecisionResponse(
        parsed.responses,
        decisionPlan,
        locatorPlan,
        partition,
        args.maximumEvidencePerRequirement
      );
      attempts.push({
        attempt,
        status: "PASS",
        durationMs: Math.round(performance.now() - started),
        rawResponse,
        rawResponseSha256: sha256(rawResponse),
        syntaxRepair: parsed.syntaxRepair,
        usage: completion.usage || null,
      });
      return { responses, attempts };
    } catch (error) {
      attempts.push({
        attempt,
        status: "RETRY",
        durationMs: Math.round(performance.now() - started),
        rawResponse,
        rawResponseSha256: sha256(rawResponse),
        errorClass: error.errorClass || error.name || "MODEL_RESPONSE_INVALID",
        errorMessage: error.message,
      });
    }
  }
  const error = new Error(
    `LF_A_DRIVEN_COMPACT_WINDOW_ATTEMPTS_EXHAUSTED:${partition.partitionId}`
  );
  error.attempts = attempts;
  throw error;
}

async function run() {
  const args = argumentsFrom(process.argv.slice(2));
  if (fs.existsSync(args.output))
    throw new Error("LF_A_DRIVEN_COMPACT_WINDOW_OUTPUT_EXISTS");
  const decisionPlan = readJson(
    args.decisionPlan,
    "LF_A_DRIVEN_COMPACT_WINDOW_DECISION_PLAN"
  );
  validateADrivenRequirementDecisionPlan(decisionPlan);
  const locatorPlan = readJson(
    args.locatorPlan,
    "LF_A_DRIVEN_COMPACT_WINDOW_LOCATOR_PLAN"
  );
  const factIndex = readJson(
    args.factIndex,
    "LF_A_DRIVEN_COMPACT_WINDOW_FACT_INDEX"
  );
  const rescuePlan = readJson(
    args.rescuePlan,
    "LF_A_DRIVEN_COMPACT_WINDOW_RESCUE_PLAN"
  );
  const rescueDecisions = readJson(
    args.rescueDecisions,
    "LF_A_DRIVEN_COMPACT_WINDOW_RESCUE_DECISIONS"
  );
  const decisionPartitions = partitionCompactDecisionWork(
    decisionPlan,
    locatorPlan,
    args.maximumComponentsPerRequest,
    factIndex
  );
  fs.mkdirSync(args.output, { recursive: true, mode: 0o700 });
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
  for (const partition of decisionPartitions) {
    let result = reusableCompactDecisionPartition({
      args,
      decisionPlan,
      locatorPlan,
      partition,
    });
    try {
      if (!result)
        result = await decidePartition({
          args,
          decisionPlan,
          locatorPlan,
          partition,
          client,
          recoverModelAfterAbort,
        });
    } catch (error) {
      writePrivateJson(
        path.join(
          args.output,
          `partition-${String(partition.partitionIndex).padStart(3, "0")}-failed.private.json`
        ),
        {
          schemaVersion: 1,
          contractId: RUN_CONTRACT_ID,
          partitionId: partition.partitionId,
          attempts: error.attempts || [],
        }
      );
      throw error;
    }
    const artifact = {
      schemaVersion: 1,
      contractId: RUN_CONTRACT_ID,
      locatorPlanSha256: locatorPlan.planSha256,
      partitionId: partition.partitionId,
      responses: result.responses,
      attempts: result.attempts,
      ...(result.reusedFrom ? { reusedFrom: result.reusedFrom } : {}),
    };
    writePrivateJson(
      path.join(
        args.output,
        `partition-${String(partition.partitionIndex).padStart(3, "0")}.private.json`
      ),
      artifact
    );
    results.push(artifact);
    console.log(
      `[lf-compact-window-decisions] Partition ${partition.partitionIndex + 1}/${decisionPartitions.length}: PASS${result.reusedFrom ? " (wiederverwendet)" : ""}`
    );
  }
  const fastPlan = replayPlan(locatorPlan, factIndex, results);
  const replay = buildADrivenTerminalEvidenceReplay({
    fastPlan,
    factIndex,
    rescuePlan,
    rescueDecisions,
  });
  const contextOutcomes = results
    .flatMap(({ responses }) => responses)
    .reduce((counts, { contextOutcome }) => {
      counts[contextOutcome] = (counts[contextOutcome] || 0) + 1;
      return counts;
    }, {});
  const summary = {
    schemaVersion: 1,
    contractId: RUN_CONTRACT_ID,
    locatorPlanSha256: locatorPlan.planSha256,
    model: loadedModel,
    startedAt,
    completedAt: new Date().toISOString(),
    wallDurationMs: Math.round(performance.now() - started),
    modelRequests: results.filter(({ reusedFrom }) => !reusedFrom).length,
    modelAttempts: results.reduce(
      (sum, result) => sum + (result.reusedFrom ? 0 : result.attempts.length),
      0
    ),
    reusedPartitions: results.filter(({ reusedFrom }) => reusedFrom).length,
    totalDecisionPartitions: decisionPartitions.length,
    candidateContext: "COMPLETE_PARENT_FACT",
    contextOutcomes,
    positiveContextDecisions: Object.entries(contextOutcomes).reduce(
      (sum, [outcome, count]) =>
        sum + (POSITIVE_OUTCOMES.has(outcome) ? count : 0),
      0
    ),
    ...replay.summary,
    acceptanceReady: false,
    proofLimit:
      "Direkte kompakte Entscheidungen gegen vollständige Elternklauseln gerouteter Quellfenster. NOT_ESTABLISHED ist kein Vollkorpus-Abwesenheitsnachweis.",
  };
  writePrivateJson(path.join(args.output, "fast-plan.private.json"), fastPlan);
  writePrivateJson(path.join(args.output, "replay.private.json"), replay);
  writePrivateJson(path.join(args.output, "summary.private.json"), summary);
  console.log(
    `[lf-compact-window-decisions] ${summary.recoveredTerminalEvidenceFacts}/${summary.expectedTerminalEvidenceFacts} finale Rescue-Evidenzfakten; ${summary.positiveContextDecisions} positive Kontexturteile; ${summary.modelRequests} Requests; ${summary.wallDurationMs} ms; NICHT GEFUNDEN gesperrt`
  );
}

if (require.main === module)
  run().catch((error) => fail(error.stack || error.message));

module.exports = {
  OUTCOMES,
  compactDecisionPromptView,
  partitionCompactDecisionWork,
  prompt,
  reusableCompactDecisionPartition,
  validateAliasDecisionResponse,
};

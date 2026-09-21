#!/usr/bin/env node

process.umask(0o077);

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  A_DRIVEN_REQUIREMENT_DECISION_PLAN_CONTRACT_ID,
  validateADrivenRequirementDecisionPlan,
} = require("../../utils/policyAnalysis/aDrivenRequirementCounterpartDecision");
const {
  stableStringify,
} = require("../../utils/policyAnalysis/aDrivenSourceUnitPlan");

const ROUTED_WINDOW_SELECTION_CONTRACT_ID =
  "LF_A_DRIVEN_ROUTED_WINDOW_DECISION_SELECTION_V1";

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function fail(message) {
  console.error(`[lf-routed-window-decision-plan] ${message}`);
  process.exit(1);
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
    throw new Error(`LF_A_DRIVEN_ROUTED_WINDOW_OUTPUT_EXISTS:${file}`);
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.renameSync(temporary, file);
  fs.chmodSync(file, 0o600);
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
    "sourceDecisionPlan",
    "locatorPlan",
    "factIndex",
    "output",
  ])
    if (!values[required]) fail(`--${required} ist erforderlich`);
  const maximumRequirementsPerBatch = Number(
    values.maximumRequirementsPerBatch || 8
  );
  const maximumBatchCharacters = Number(values.maximumBatchCharacters || 70_000);
  if (
    !Number.isSafeInteger(maximumRequirementsPerBatch) ||
    maximumRequirementsPerBatch < 1 ||
    !Number.isSafeInteger(maximumBatchCharacters) ||
    maximumBatchCharacters < 20_000
  )
    fail("Batchparameter sind ungültig");
  return {
    sourceDecisionPlan: path.resolve(values.sourceDecisionPlan),
    locatorPlan: path.resolve(values.locatorPlan),
    factIndex: path.resolve(values.factIndex),
    output: path.resolve(values.output),
    maximumRequirementsPerBatch,
    maximumBatchCharacters,
  };
}

function candidateCatalog(locatorPlan) {
  const byWindowId = new Map();
  for (const partition of locatorPlan.partitions || [])
    for (const candidate of partition.candidates || []) {
      const existing = byWindowId.get(candidate.factId);
      if (
        existing &&
        stableStringify(existing) !== stableStringify(candidate)
      )
        throw new Error(
          `LF_A_DRIVEN_ROUTED_WINDOW_CANDIDATE_CONFLICT:${candidate.factId}`
        );
      byWindowId.set(candidate.factId, candidate);
    }
  return byWindowId;
}

function routedCandidate({ requirementId, window, parent, originalName }) {
  const candidateId = `RCE-${sha256(
    stableStringify({
      contractId: ROUTED_WINDOW_SELECTION_CONTRACT_ID,
      requirementId,
      windowId: window.factId,
      parentFactId: window.parentFactId,
    })
  ).slice(0, 24)}`;
  return {
    candidateId,
    documentUuid: parent.documentUuid,
    documentSha256: parent.documentSha256,
    documentPosition: parent.documentPosition,
    documentRole: parent.documentRole,
    documentStatus: parent.documentStatus,
    originalName: originalName || parent.documentUuid,
    physicalPageNumber: parent.physicalPageNumber,
    clauseBoundaryId: parent.clauseBoundaryId,
    documentStart: parent.documentStart,
    documentEnd: parent.documentEnd,
    exactText: window.exactText,
    exactTextSha256: sha256(window.exactText),
    channels: ["A_DRIVEN_QUERY_EXPANDED_SOURCE_WINDOW"],
    routedWindowId: window.factId,
    parentFactId: window.parentFactId,
  };
}

function buildRoutedWindowDecisionPlan({
  sourceDecisionPlan,
  locatorPlan,
  factIndex,
  maximumRequirementsPerBatch = 8,
  maximumBatchCharacters = 70_000,
} = {}) {
  validateADrivenRequirementDecisionPlan(sourceDecisionPlan);
  if (
    !String(locatorPlan?.contractId || "").startsWith(
      "LF_A_DRIVEN_B_CORPUS_LOCATOR_PLAN_V"
    ) ||
    !Array.isArray(locatorPlan.requirements) ||
    !Array.isArray(locatorPlan.partitions) ||
    !Array.isArray(factIndex?.facts)
  )
    throw new Error("LF_A_DRIVEN_ROUTED_WINDOW_INPUT_INVALID");
  const sourceRowsById = new Map(
    sourceDecisionPlan.rows.map((row) => [row.requirementId, row])
  );
  const windowsById = candidateCatalog(locatorPlan);
  const parentsById = new Map(
    factIndex.facts.map((fact) => [fact.factId, fact])
  );
  const originalNameByDocumentUuid = new Map(
    sourceDecisionPlan.rows
      .flatMap((row) => row.candidates || [])
      .map((candidate) => [candidate.documentUuid, candidate.originalName])
  );
  const rows = locatorPlan.requirements
    .map((requirement) => {
      const sourceRow = sourceRowsById.get(requirement.requirementId);
      if (!sourceRow)
        throw new Error(
          `LF_A_DRIVEN_ROUTED_WINDOW_REQUIREMENT_MISSING:${requirement.requirementId}`
        );
      const candidates = [...new Set(requirement.candidateFactIds || [])].map(
        (windowId) => {
          const window = windowsById.get(windowId);
          const parent = window && parentsById.get(window.parentFactId);
          if (!window || !parent)
            throw new Error(
              `LF_A_DRIVEN_ROUTED_WINDOW_SOURCE_MISSING:${windowId}`
            );
          return routedCandidate({
            requirementId: requirement.requirementId,
            window,
            parent,
            originalName: originalNameByDocumentUuid.get(parent.documentUuid),
          });
        }
      );
      const candidateIds = candidates.map(({ candidateId }) => candidateId);
      const components = sourceRow.components.map((component) => ({
        ...component,
        navigationCandidateIds: candidateIds,
      }));
      const reviewIdentity = {
        contractId: ROUTED_WINDOW_SELECTION_CONTRACT_ID,
        requirementId: requirement.requirementId,
        candidateIds,
      };
      return {
        ...sourceRow,
        reviewId: `ADR-${sha256(stableStringify(reviewIdentity)).slice(0, 24)}`,
        components,
        candidates,
        searchCoverage: {
          ...sourceRow.searchCoverage,
          candidateSelection: ROUTED_WINDOW_SELECTION_CONTRACT_ID,
          sourceCandidatesAvailable: candidates.length,
          sourceCandidatesSelected: candidates.length,
          absenceCertified: false,
        },
      };
    })
    .sort(
      (left, right) =>
        left.sourceOrder[0] - right.sourceOrder[0] ||
        left.sourceOrder[1] - right.sourceOrder[1] ||
        left.sourceOrder[2] - right.sourceOrder[2] ||
        left.requirementId.localeCompare(right.requirementId)
    );
  const batches = [];
  let current = [];
  let currentCharacters = 0;
  const flush = () => {
    if (!current.length) return;
    const batchIndex = batches.length;
    const expectedRequirementIds = current.map(({ requirementId }) =>
      String(requirementId)
    );
    batches.push({
      batchId: `ADB-${sha256(
        stableStringify({
          contractId: ROUTED_WINDOW_SELECTION_CONTRACT_ID,
          batchIndex,
          expectedRequirementIds,
        })
      ).slice(0, 24)}`,
      batchIndex,
      expectedRequirementIds,
      rows: current,
    });
    current = [];
    currentCharacters = 0;
  };
  for (const row of rows) {
    const rowCharacters = JSON.stringify(row).length;
    if (rowCharacters > maximumBatchCharacters)
      throw new Error(
        `LF_A_DRIVEN_ROUTED_WINDOW_ROW_TOO_LARGE:${row.requirementId}`
      );
    if (
      current.length >= maximumRequirementsPerBatch ||
      (current.length &&
        currentCharacters + rowCharacters > maximumBatchCharacters)
    )
      flush();
    current.push(row);
    currentCharacters += rowCharacters;
  }
  flush();
  const payload = {
    schemaVersion: sourceDecisionPlan.schemaVersion,
    contractId: A_DRIVEN_REQUIREMENT_DECISION_PLAN_CONTRACT_ID,
    dynamicManifestSha256: sourceDecisionPlan.dynamicManifestSha256,
    searchPlanSha256: sourceDecisionPlan.searchPlanSha256,
    searchExecutionSha256: sourceDecisionPlan.searchExecutionSha256,
    completeBCorpusSha256: sourceDecisionPlan.completeBCorpusSha256,
    selection: {
      contractId: ROUTED_WINDOW_SELECTION_CONTRACT_ID,
      locatorPlanSha256: locatorPlan.planSha256,
      factIndexSha256: factIndex.factIndexSha256,
      maximumRequirementsPerBatch,
      maximumBatchCharacters,
      candidateAuthority: "SERVER_BOUND_NAVIGATION_ONLY",
      characterClippingAllowed: false,
      goldInputsAllowed: false,
      customerNotFoundEligible: false,
    },
    rows,
    batches,
    summary: {
      requirements: rows.length,
      components: rows.reduce((sum, row) => sum + row.components.length, 0),
      selectedCandidates: rows.reduce(
        (sum, row) => sum + row.candidates.length,
        0
      ),
      batches: batches.length,
      absenceCertifiedRequirements: 0,
    },
  };
  const plan = {
    ...payload,
    planSha256: sha256(
      `${A_DRIVEN_REQUIREMENT_DECISION_PLAN_CONTRACT_ID}\u0000${stableStringify(
        payload
      )}`
    ),
  };
  validateADrivenRequirementDecisionPlan(plan);
  return plan;
}

function run() {
  const args = argumentsFrom(process.argv.slice(2));
  const plan = buildRoutedWindowDecisionPlan({
    sourceDecisionPlan: readJson(
      args.sourceDecisionPlan,
      "LF_A_DRIVEN_ROUTED_WINDOW_SOURCE_PLAN"
    ),
    locatorPlan: readJson(
      args.locatorPlan,
      "LF_A_DRIVEN_ROUTED_WINDOW_LOCATOR_PLAN"
    ),
    factIndex: readJson(args.factIndex, "LF_A_DRIVEN_ROUTED_WINDOW_FACT_INDEX"),
    maximumRequirementsPerBatch: args.maximumRequirementsPerBatch,
    maximumBatchCharacters: args.maximumBatchCharacters,
  });
  writePrivateJson(args.output, plan);
  console.log(
    `[lf-routed-window-decision-plan] ${plan.summary.requirements} Anforderungen, ${plan.summary.selectedCandidates} Fensterpaare, ${plan.summary.batches} Entscheidungsrequests; NICHT GEFUNDEN gesperrt`
  );
}

if (require.main === module)
  try {
    run();
  } catch (error) {
    fail(error.stack || error.message);
  }

module.exports = {
  ROUTED_WINDOW_SELECTION_CONTRACT_ID,
  buildRoutedWindowDecisionPlan,
};

const fs = require("fs");
const path = require("path");
const { stableStringify } = require("../policyAnalysis/aDrivenSourceUnitPlan");

const RESUME_DIRECTORY_PATTERN = /^resume-[a-f0-9]{24}$/u;
const BATCH_RESULT_PATTERN = /^\d{4}-AUB-[a-f0-9]+\.private\.json$/u;
const B_DECISION_BATCH_RESULT_PATTERN =
  /^(\d{5})-ADRB-[a-f0-9]+\.private\.json$/u;
const ATTEMPT_RESULT_PATTERN = /^cycle-\d+-attempt-\d+\.private\.json$/u;

function safeJson(file) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 50_000_000)
    throw new Error("LF_A_PARTIAL_RESUME_ARTIFACT_INVALID");
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function safeDirectory(directory) {
  const stat = fs.lstatSync(directory);
  return stat.isDirectory() && !stat.isSymbolicLink();
}

function releaseIndependentIdentity(contract) {
  if (
    !contract ||
    typeof contract !== "object" ||
    !contract.comparisonMode ||
    !contract.productProfile ||
    !contract.configuration ||
    !Array.isArray(contract.documents)
  )
    throw new Error("LF_A_PARTIAL_RESUME_RUN_CONTRACT_INVALID");
  return {
    schemaVersion: contract.schemaVersion,
    comparisonMode: contract.comparisonMode,
    productProfile: contract.productProfile,
    configuration: contract.configuration,
    documents: contract.documents,
  };
}

function countRegularFiles(directory, pattern, recursive = false) {
  if (!fs.existsSync(directory) || !safeDirectory(directory)) return 0;
  let count = 0;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (recursive && entry.isDirectory()) {
      count += countRegularFiles(target, pattern, true);
      continue;
    }
    if (entry.isFile() && pattern.test(entry.name)) count += 1;
  }
  return count;
}

function countContiguousBDecisionBatches(directory) {
  if (!fs.existsSync(directory) || !safeDirectory(directory)) return 0;
  const indices = new Set();
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isFile() || entry.isSymbolicLink()) continue;
    const match = entry.name.match(B_DECISION_BATCH_RESULT_PATTERN);
    if (match) indices.add(Number(match[1]));
  }
  let contiguous = 0;
  while (indices.has(contiguous)) contiguous += 1;
  return contiguous;
}

function selectADrivenPartialResumeSource({
  sessionRunsRoot,
  currentRunRoot,
  currentContract,
}) {
  if (!fs.existsSync(sessionRunsRoot) || !safeDirectory(sessionRunsRoot))
    return null;
  const expectedIdentity = stableStringify(
    releaseIndependentIdentity(currentContract)
  );
  const candidates = [];
  for (const entry of fs.readdirSync(sessionRunsRoot, {
    withFileTypes: true,
  })) {
    if (
      !entry.isDirectory() ||
      entry.isSymbolicLink() ||
      !RESUME_DIRECTORY_PATTERN.test(entry.name)
    )
      continue;
    const runRoot = path.join(sessionRunsRoot, entry.name);
    if (path.resolve(runRoot) === path.resolve(currentRunRoot)) continue;
    try {
      if (!safeDirectory(runRoot)) continue;
      const contract = safeJson(
        path.join(runRoot, "run-contract.private.json")
      );
      if (
        stableStringify(releaseIndependentIdentity(contract)) !==
        expectedIdentity
      )
        continue;
      const planRoot = path.join(runRoot, "a-driven-v2", "a-plan");
      const outputRoot = path.join(runRoot, "a-driven-v2", "a-classification");
      if (!safeDirectory(planRoot) || !safeDirectory(outputRoot)) continue;
      for (const file of [
        path.join(planRoot, "source-unit-plan.private.json"),
        path.join(planRoot, "classification-batches.private.json"),
      ])
        safeJson(file);
      const completedBatchArtifacts = countRegularFiles(
        path.join(outputRoot, "batches"),
        BATCH_RESULT_PATTERN
      );
      const attemptArtifacts = countRegularFiles(
        path.join(outputRoot, "attempts"),
        ATTEMPT_RESULT_PATTERN,
        true
      );
      if (completedBatchArtifacts === 0 && attemptArtifacts === 0) continue;
      candidates.push({
        runRoot,
        planRoot,
        outputRoot,
        completedBatchArtifacts,
        attemptArtifacts,
        modifiedAtMs: fs.statSync(runRoot).mtimeMs,
      });
    } catch {
      continue;
    }
  }
  return (
    candidates.sort(
      (left, right) =>
        right.completedBatchArtifacts - left.completedBatchArtifacts ||
        right.attemptArtifacts - left.attemptArtifacts ||
        right.modifiedAtMs - left.modifiedAtMs ||
        left.runRoot.localeCompare(right.runRoot)
    )[0] || null
  );
}

function selectADrivenBDecisionResumeSource({
  sessionRunsRoot,
  currentRunRoot,
  currentContract,
}) {
  if (!fs.existsSync(sessionRunsRoot) || !safeDirectory(sessionRunsRoot))
    return null;
  const expectedIdentity = stableStringify(
    releaseIndependentIdentity(currentContract)
  );
  const candidates = [];
  for (const entry of fs.readdirSync(sessionRunsRoot, {
    withFileTypes: true,
  })) {
    if (
      !entry.isDirectory() ||
      entry.isSymbolicLink() ||
      !RESUME_DIRECTORY_PATTERN.test(entry.name)
    )
      continue;
    const runRoot = path.join(sessionRunsRoot, entry.name);
    if (path.resolve(runRoot) === path.resolve(currentRunRoot)) continue;
    try {
      if (!safeDirectory(runRoot)) continue;
      const contract = safeJson(
        path.join(runRoot, "run-contract.private.json")
      );
      if (
        stableStringify(releaseIndependentIdentity(contract)) !==
        expectedIdentity
      )
        continue;
      const outputRoot = path.join(
        runRoot,
        "a-driven-v2",
        "b-requirement-decisions"
      );
      if (!safeDirectory(outputRoot)) continue;
      safeJson(path.join(outputRoot, "decision-plan.private.json"));
      const contiguousCompletedBatchArtifacts =
        countContiguousBDecisionBatches(path.join(outputRoot, "batches"));
      const attemptArtifacts = countRegularFiles(
        path.join(outputRoot, "attempts"),
        ATTEMPT_RESULT_PATTERN,
        true
      );
      if (contiguousCompletedBatchArtifacts === 0 && attemptArtifacts === 0)
        continue;
      candidates.push({
        runRoot,
        outputRoot,
        contiguousCompletedBatchArtifacts,
        attemptArtifacts,
        modifiedAtMs: fs.statSync(runRoot).mtimeMs,
      });
    } catch {
      continue;
    }
  }
  return (
    candidates.sort(
      (left, right) =>
        right.contiguousCompletedBatchArtifacts -
          left.contiguousCompletedBatchArtifacts ||
        right.attemptArtifacts - left.attemptArtifacts ||
        right.modifiedAtMs - left.modifiedAtMs ||
        left.runRoot.localeCompare(right.runRoot)
    )[0] || null
  );
}

module.exports = {
  releaseIndependentIdentity,
  selectADrivenBDecisionResumeSource,
  selectADrivenPartialResumeSource,
};

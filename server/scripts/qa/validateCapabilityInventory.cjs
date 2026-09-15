#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../..");
const DEFAULT_INVENTORY = path.join(
  REPOSITORY_ROOT,
  "docs",
  "POLIZZENVERGLEICH_CAPABILITY_INVENTAR_V1.json"
);
const MATURITY = new Set([
  "IDEA",
  "HYPOTHESIS",
  "EXPERIMENTAL",
  "VALIDATED",
  "REJECTED",
  "SUPERSEDED",
  "DEFERRED",
]);
const ACTIVATION = new Set([
  "ACTIVE_PRODUCTION",
  "ACTIVE_SHADOW",
  "QA_ONLY",
  "AVAILABLE_NOT_WIRED",
  "INACTIVE",
]);
const ACTIVE = new Set(["ACTIVE_PRODUCTION", "ACTIVE_SHADOW"]);
const CAPABILITY_ID = /^CAP-[A-Z]+-[0-9]{3}$/u;
const WORKFLOW_ID = /^WF-[A-Z0-9-]+$/u;
const SHA256 = /^[a-f0-9]{40,64}$/u;

function fail(code, detail = "") {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  throw error;
}

function regularRepositoryFile(relativePath, code) {
  if (
    typeof relativePath !== "string" ||
    !relativePath ||
    path.isAbsolute(relativePath)
  )
    fail(code, String(relativePath));
  const resolved = path.resolve(REPOSITORY_ROOT, relativePath);
  if (
    !resolved.startsWith(`${REPOSITORY_ROOT}${path.sep}`) ||
    !fs.existsSync(resolved)
  )
    fail(code, relativePath);
  const stat = fs.lstatSync(resolved);
  if (!stat.isFile() || stat.isSymbolicLink()) fail(code, relativePath);
  return resolved;
}

function requireString(value, code, detail) {
  if (typeof value !== "string" || value.trim().length === 0)
    fail(code, detail);
}

function requireStringArray(value, code, detail, { allowEmpty = false } = {}) {
  if (
    !Array.isArray(value) ||
    (!allowEmpty && value.length === 0) ||
    value.some((item) => typeof item !== "string" || !item.trim())
  )
    fail(code, detail);
}

function textContains(file, value, code, detail) {
  requireString(value, code, detail);
  if (!fs.readFileSync(file, "utf8").includes(value)) fail(code, detail);
}

function validateCapability(capability, ids) {
  if (!CAPABILITY_ID.test(String(capability?.id || "")))
    fail("CAPABILITY_ID_INVALID", String(capability?.id || ""));
  if (ids.has(capability.id)) fail("CAPABILITY_ID_DUPLICATE", capability.id);
  ids.add(capability.id);
  for (const field of [
    "name",
    "purpose",
    "pipelinePhase",
    "activationReason",
    "reactivationCriteria",
  ])
    requireString(
      capability[field],
      "CAPABILITY_REQUIRED_FIELD_MISSING",
      `${capability.id}:${field}`
    );
  requireStringArray(
    capability.productModes,
    "CAPABILITY_MODES_INVALID",
    capability.id
  );
  if (
    capability.productModes.some((mode) => !["LF", "AB"].includes(mode))
  )
    fail("CAPABILITY_MODE_UNKNOWN", capability.id);
  if (!MATURITY.has(capability.maturityStatus))
    fail("CAPABILITY_MATURITY_INVALID", capability.id);
  if (!ACTIVATION.has(capability.activationStatus))
    fail("CAPABILITY_ACTIVATION_INVALID", capability.id);
  for (const mode of ["LF", "AB"])
    if (!ACTIVATION.has(capability.activationByMode?.[mode]))
      fail("CAPABILITY_MODE_ACTIVATION_INVALID", `${capability.id}:${mode}`);

  requireStringArray(
    capability.implementationFiles,
    "CAPABILITY_IMPLEMENTATION_FILES_INVALID",
    capability.id,
    { allowEmpty: true }
  );
  for (const relativePath of capability.implementationFiles)
    regularRepositoryFile(relativePath, "CAPABILITY_IMPLEMENTATION_FILE_MISSING");

  if (!Array.isArray(capability.publicEntrypoints))
    fail("CAPABILITY_ENTRYPOINTS_INVALID", capability.id);
  for (const entrypoint of capability.publicEntrypoints || []) {
    const file = regularRepositoryFile(
      entrypoint?.path,
      "CAPABILITY_ENTRYPOINT_FILE_MISSING"
    );
    textContains(
      file,
      entrypoint?.symbol,
      "CAPABILITY_ENTRYPOINT_SYMBOL_MISSING",
      `${capability.id}:${entrypoint?.path}:${entrypoint?.symbol}`
    );
  }

  if (!Array.isArray(capability.callers))
    fail("CAPABILITY_CALLERS_INVALID", capability.id);
  if (ACTIVE.has(capability.activationStatus) && capability.callers.length === 0)
    fail("ACTIVE_CAPABILITY_CALLER_REQUIRED", capability.id);
  for (const caller of capability.callers || []) {
    const file = regularRepositoryFile(
      caller?.path,
      "CAPABILITY_CALLER_FILE_MISSING"
    );
    textContains(
      file,
      caller?.contains,
      "CAPABILITY_CALLER_BINDING_MISSING",
      `${capability.id}:${caller?.path}:${caller?.contains}`
    );
  }

  for (const field of ["inputs", "outputs", "sideEffects", "dependencies"])
    requireStringArray(
      capability[field],
      "CAPABILITY_ARRAY_FIELD_INVALID",
      `${capability.id}:${field}`,
      { allowEmpty: field === "sideEffects" || field === "dependencies" }
    );
  for (const field of ["recall", "precision", "sourceBinding", "generalization"])
    requireString(
      capability.qualityImpact?.[field],
      "CAPABILITY_QUALITY_IMPACT_MISSING",
      `${capability.id}:${field}`
    );
  for (const field of ["runtime", "ram", "gpu"])
    requireString(
      capability.resourceImpact?.[field],
      "CAPABILITY_RESOURCE_IMPACT_MISSING",
      `${capability.id}:${field}`
    );
  requireStringArray(
    capability.knownLimitsRisks,
    "CAPABILITY_LIMITS_INVALID",
    capability.id
  );
  requireStringArray(
    capability.evidence?.tests,
    "CAPABILITY_TESTS_INVALID",
    capability.id,
    { allowEmpty: true }
  );
  for (const testFile of capability.evidence?.tests || [])
    regularRepositoryFile(testFile, "CAPABILITY_TEST_FILE_MISSING");
  for (const field of ["runs", "adrs", "failures"])
    requireStringArray(
      capability.evidence?.[field],
      "CAPABILITY_EVIDENCE_INVALID",
      `${capability.id}:${field}`,
      { allowEmpty: true }
    );
  if (!SHA256.test(String(capability.lastVerifiedCommit || "")))
    fail("CAPABILITY_VERIFIED_COMMIT_INVALID", capability.id);
  if (!Array.isArray(capability.relations))
    fail("CAPABILITY_RELATIONS_INVALID", capability.id);
}

function validateCapabilityInventory(inventory) {
  if (
    inventory?.schemaVersion !== 1 ||
    inventory?.inventoryId !== "POLIZZENVERGLEICH_CAPABILITY_INVENTAR_V1"
  )
    fail("CAPABILITY_INVENTORY_HEADER_INVALID");
  requireString(inventory.changeSetId, "CAPABILITY_CHANGESET_ID_REQUIRED");
  const ids = new Set();
  if (!Array.isArray(inventory.capabilities) || inventory.capabilities.length === 0)
    fail("CAPABILITY_INVENTORY_EMPTY");
  for (const capability of inventory.capabilities)
    validateCapability(capability, ids);

  for (const capability of inventory.capabilities)
    for (const relation of capability.relations || []) {
      if (!inventory.relationshipTypes.includes(relation?.type))
        fail("CAPABILITY_RELATION_TYPE_INVALID", capability.id);
      if (!ids.has(relation?.target))
        fail("CAPABILITY_RELATION_TARGET_UNKNOWN", `${capability.id}:${relation?.target}`);
    }

  const workflowIds = new Set();
  for (const workflow of inventory.workflowMaps || []) {
    if (!WORKFLOW_ID.test(String(workflow?.id || "")))
      fail("CAPABILITY_WORKFLOW_ID_INVALID", String(workflow?.id || ""));
    if (workflowIds.has(workflow.id))
      fail("CAPABILITY_WORKFLOW_ID_DUPLICATE", workflow.id);
    workflowIds.add(workflow.id);
    requireString(workflow.name, "CAPABILITY_WORKFLOW_NAME_REQUIRED", workflow.id);
    requireStringArray(
      workflow.nodes,
      "CAPABILITY_WORKFLOW_NODES_INVALID",
      workflow.id
    );
    if (new Set(workflow.nodes).size !== workflow.nodes.length)
      fail("CAPABILITY_WORKFLOW_NODE_DUPLICATE", workflow.id);
    for (const capabilityId of workflow.nodes)
      if (!ids.has(capabilityId))
        fail("CAPABILITY_WORKFLOW_NODE_UNKNOWN", `${workflow.id}:${capabilityId}`);
  }

  const contractIds = new Set();
  for (const binding of inventory.contractBindings || []) {
    requireString(binding?.id, "CAPABILITY_CONTRACT_ID_INVALID");
    if (contractIds.has(binding.id))
      fail("CAPABILITY_CONTRACT_ID_DUPLICATE", binding.id);
    contractIds.add(binding.id);
    const file = regularRepositoryFile(
      binding?.path,
      "CAPABILITY_CONTRACT_FILE_MISSING"
    );
    textContains(
      file,
      binding.id,
      "CAPABILITY_CONTRACT_BINDING_MISSING",
      `${binding.path}:${binding.id}`
    );
  }

  return {
    inventoryId: inventory.inventoryId,
    changeSetId: inventory.changeSetId,
    capabilities: inventory.capabilities.length,
    workflows: inventory.workflowMaps.length,
    contractBindings: inventory.contractBindings.length,
    activeProduction: inventory.capabilities.filter(
      ({ activationStatus }) => activationStatus === "ACTIVE_PRODUCTION"
    ).length,
    activeShadow: inventory.capabilities.filter(
      ({ activationStatus }) => activationStatus === "ACTIVE_SHADOW"
    ).length,
    qaOnly: inventory.capabilities.filter(
      ({ activationStatus }) => activationStatus === "QA_ONLY"
    ).length,
  };
}

function readInventory(file = DEFAULT_INVENTORY) {
  const resolved = path.resolve(file);
  const stat = fs.lstatSync(resolved);
  if (!stat.isFile() || stat.isSymbolicLink())
    fail("CAPABILITY_INVENTORY_FILE_INVALID", resolved);
  return JSON.parse(fs.readFileSync(resolved, "utf8"));
}

function main() {
  const file = process.argv[2] || DEFAULT_INVENTORY;
  const summary = validateCapabilityInventory(readInventory(file));
  process.stdout.write(`${JSON.stringify({ status: "PASS", ...summary })}\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exit(1);
  }
}

module.exports = {
  DEFAULT_INVENTORY,
  validateCapabilityInventory,
};

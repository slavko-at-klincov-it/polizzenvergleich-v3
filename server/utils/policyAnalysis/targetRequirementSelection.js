const crypto = require("crypto");
const {
  requirementSearchContractDigest,
} = require("./coverageOnlyCertificationContract");

const TARGET_REQUIREMENT_SELECTION_SCHEMA_VERSION = 1;
const TARGET_REQUIREMENT_SELECTION_CONTRACT_ID =
  "QA_TARGET_REQUIREMENT_SELECTION_V1";

function selectionError(code, detail = "") {
  const error = new Error(detail ? `${code}: ${detail}` : code);
  error.code = code;
  return error;
}

function requiredText(value, code) {
  const text = String(value || "").trim();
  if (!text) throw selectionError(code);
  return text;
}

function parsedRequirementIds(requirementIds) {
  const values = Array.isArray(requirementIds)
    ? requirementIds
    : String(requirementIds || "").split(",");
  const normalized = values.map((value) => String(value || "").trim());
  if (normalized.every((value) => !value))
    throw selectionError("TARGET_REQUIREMENT_SELECTION_EMPTY");
  if (normalized.some((value) => !value))
    throw selectionError("TARGET_REQUIREMENT_SELECTION_EMPTY_ID");
  const seen = new Set();
  const duplicates = new Set();
  for (const id of normalized) {
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  if (duplicates.size > 0)
    throw selectionError(
      "TARGET_REQUIREMENT_SELECTION_DUPLICATE_IDS",
      [...duplicates].sort().join(",")
    );
  return normalized;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])])
    );
  return value;
}

function selectionDigest(contract) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(stableValue(contract)))
    .digest("hex");
}

function assertRequirementCategory({ categoryView, requirementId }) {
  if (!requirementId.startsWith(`${categoryView}-`))
    throw selectionError(
      "TARGET_REQUIREMENT_CATEGORY_MISMATCH",
      `${categoryView}:${requirementId}`
    );
}

function exactKeys(value, expectedKeys, code) {
  const actual = Object.keys(value || {}).sort();
  const expected = [...expectedKeys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  )
    throw selectionError(code, actual.join(","));
}

/**
 * Verifies a standalone target-selection contract before another QA contract
 * persists or forwards its digest. Role: boundary. Side effects: none.
 */
function assertTargetRequirementSelectionContract(
  selection,
  {
    expectedCatalogId = null,
    expectedCategoryView = null,
    expectedSelectionDigestSha256 = null,
  } = {}
) {
  if (!selection || typeof selection !== "object" || Array.isArray(selection))
    throw selectionError("TARGET_REQUIREMENT_SELECTION_REQUIRED");
  exactKeys(
    selection,
    [
      "schemaVersion",
      "contractId",
      "catalogId",
      "categoryView",
      "requirementIds",
      "requirementContracts",
      "requirementCount",
      "selectionDigestSha256",
    ],
    "TARGET_REQUIREMENT_SELECTION_CONTRACT_KEYS_INVALID"
  );
  if (
    selection.schemaVersion !== TARGET_REQUIREMENT_SELECTION_SCHEMA_VERSION ||
    selection.contractId !== TARGET_REQUIREMENT_SELECTION_CONTRACT_ID
  )
    throw selectionError("TARGET_REQUIREMENT_SELECTION_CONTRACT_INVALID");

  const catalogId = requiredText(
    selection.catalogId,
    "TARGET_REQUIREMENT_SELECTION_CATALOG_ID_REQUIRED"
  );
  const categoryView = requiredText(
    selection.categoryView,
    "TARGET_REQUIREMENT_SELECTION_CATEGORY_REQUIRED"
  );
  if (
    !Array.isArray(selection.requirementIds) ||
    !Array.isArray(selection.requirementContracts) ||
    selection.requirementIds.length === 0
  )
    throw selectionError("TARGET_REQUIREMENT_SELECTION_IDS_INVALID");

  const requirementIds = selection.requirementIds.map((requirementId) =>
    requiredText(requirementId, "TARGET_REQUIREMENT_SELECTION_ID_INVALID")
  );
  for (const requirementId of requirementIds)
    assertRequirementCategory({ categoryView, requirementId });
  if (
    new Set(requirementIds).size !== requirementIds.length ||
    selection.requirementCount !== requirementIds.length ||
    selection.requirementContracts.length !== requirementIds.length
  )
    throw selectionError("TARGET_REQUIREMENT_SELECTION_REQUIREMENTS_MISMATCH");

  for (const [index, contract] of selection.requirementContracts.entries()) {
    exactKeys(
      contract,
      ["requirementId", "searchContractDigestSha256"],
      "TARGET_REQUIREMENT_SELECTION_REQUIREMENT_CONTRACT_KEYS_INVALID"
    );
    if (
      contract.requirementId !== requirementIds[index] ||
      !/^[a-f0-9]{64}$/u.test(contract.searchContractDigestSha256 || "")
    )
      throw selectionError(
        "TARGET_REQUIREMENT_SELECTION_REQUIREMENTS_MISMATCH"
      );
  }

  const digestContract = {
    schemaVersion: selection.schemaVersion,
    contractId: selection.contractId,
    catalogId,
    categoryView,
    requirementIds,
    requirementContracts: selection.requirementContracts,
  };
  if (selection.selectionDigestSha256 !== selectionDigest(digestContract))
    throw selectionError("TARGET_REQUIREMENT_SELECTION_DIGEST_MISMATCH");
  if (expectedCatalogId && catalogId !== expectedCatalogId)
    throw selectionError("TARGET_REQUIREMENT_SELECTION_CATALOG_MISMATCH");
  if (expectedCategoryView && categoryView !== expectedCategoryView)
    throw selectionError("TARGET_REQUIREMENT_SELECTION_CATEGORY_MISMATCH");
  if (
    expectedSelectionDigestSha256 &&
    selection.selectionDigestSha256 !== expectedSelectionDigestSha256
  )
    throw selectionError(
      "TARGET_REQUIREMENT_SELECTION_EXPECTED_DIGEST_MISMATCH"
    );
  return selection;
}

/**
 * Selects complete requirement contracts for a QA-only targeted run. The
 * canonical catalog identity and the original requirement objects are kept
 * unchanged; selection provenance is returned as a separate versioned
 * contract. Role: transform. Side effects: none.
 */
function selectTargetRequirements({ catalog, requirementIds }) {
  if (!catalog || typeof catalog !== "object" || Array.isArray(catalog))
    throw selectionError("TARGET_REQUIREMENT_CATALOG_INVALID");
  const catalogId = requiredText(
    catalog.catalogId,
    "TARGET_REQUIREMENT_CATALOG_ID_REQUIRED"
  );
  const categoryView = requiredText(
    catalog.categoryView,
    "TARGET_REQUIREMENT_CATEGORY_REQUIRED"
  );
  if (!Array.isArray(catalog.requirements))
    throw selectionError("TARGET_REQUIREMENT_CATALOG_REQUIREMENTS_INVALID");

  const requirementById = new Map();
  for (const requirement of catalog.requirements) {
    const id = requiredText(
      requirement?.id,
      "TARGET_REQUIREMENT_CATALOG_REQUIREMENT_ID_REQUIRED"
    );
    if (requirementById.has(id))
      throw selectionError("TARGET_REQUIREMENT_CATALOG_ID_DUPLICATE", id);
    assertRequirementCategory({ categoryView, requirementId: id });
    requirementById.set(id, requirement);
  }

  const requestedIds = parsedRequirementIds(requirementIds);
  const unknownIds = requestedIds.filter((id) => !requirementById.has(id));
  if (unknownIds.length)
    throw selectionError(
      "TARGET_REQUIREMENT_SELECTION_UNKNOWN_IDS",
      unknownIds.sort().join(",")
    );

  const requested = new Set(requestedIds);
  const canonicalRequirementIds = catalog.requirements
    .map(({ id }) => id)
    .filter((id) => requested.has(id));
  const selectedRequirements = canonicalRequirementIds.map((id) =>
    requirementById.get(id)
  );
  const digestContract = {
    schemaVersion: TARGET_REQUIREMENT_SELECTION_SCHEMA_VERSION,
    contractId: TARGET_REQUIREMENT_SELECTION_CONTRACT_ID,
    catalogId,
    categoryView,
    requirementIds: canonicalRequirementIds,
    requirementContracts: selectedRequirements.map((requirement) => ({
      requirementId: requirement.id,
      searchContractDigestSha256: requirementSearchContractDigest({
        catalogId,
        requirement,
      }),
    })),
  };
  const selection = {
    ...digestContract,
    requirementCount: canonicalRequirementIds.length,
    selectionDigestSha256: selectionDigest(digestContract),
  };

  return {
    catalog: {
      ...catalog,
      catalogId,
      requirements: selectedRequirements,
    },
    selection,
  };
}

/**
 * Verifies that persisted target-selection provenance describes exactly the
 * worksheet that will enter triage/evidence processing. Role: boundary.
 * Side effects: none.
 */
function assertTargetRequirementSelection(
  worksheet,
  { expectedSelectionDigestSha256 = null } = {}
) {
  const selection = worksheet?.targetRequirementSelection;
  if (!selection) {
    if (expectedSelectionDigestSha256)
      throw selectionError("TARGET_REQUIREMENT_SELECTION_REQUIRED");
    return null;
  }
  if (!worksheet?.catalog || !Array.isArray(worksheet.requirements))
    throw selectionError("TARGET_REQUIREMENT_WORKSHEET_INVALID");
  assertTargetRequirementSelectionContract(selection, {
    expectedCatalogId: worksheet.catalog.id,
    expectedCategoryView: worksheet.catalog.categoryView,
    expectedSelectionDigestSha256,
  });
  const categoryView = selection.categoryView;

  const worksheetRequirementIds = worksheet.requirements.map((requirement) =>
    requiredText(
      requirement?.id,
      "TARGET_REQUIREMENT_WORKSHEET_REQUIREMENT_ID_REQUIRED"
    )
  );
  for (const requirementId of worksheetRequirementIds)
    assertRequirementCategory({ categoryView, requirementId });
  if (
    new Set(worksheetRequirementIds).size !== worksheetRequirementIds.length ||
    selection.requirementCount !== worksheetRequirementIds.length ||
    selection.requirementIds.length !== worksheetRequirementIds.length ||
    selection.requirementIds.some(
      (requirementId, index) => requirementId !== worksheetRequirementIds[index]
    )
  )
    throw selectionError("TARGET_REQUIREMENT_SELECTION_REQUIREMENTS_MISMATCH");
  return selection;
}

module.exports = {
  TARGET_REQUIREMENT_SELECTION_CONTRACT_ID,
  TARGET_REQUIREMENT_SELECTION_SCHEMA_VERSION,
  assertTargetRequirementSelection,
  assertTargetRequirementSelectionContract,
  selectTargetRequirements,
  selectionDigest,
};

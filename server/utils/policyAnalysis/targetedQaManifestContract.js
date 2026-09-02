const { sha256 } = require("./runIdentity");
const {
  assertTargetRequirementSelectionContract,
  selectTargetRequirements,
  selectionDigest,
} = require("./targetRequirementSelection");

const TARGETED_QA_MANIFEST_SCHEMA_VERSION = 1;
const TARGETED_QA_MANIFEST_CONTRACT_ID = "TARGETED_QA_MANIFEST_V1";
const TARGETED_QA_RUN_KIND = "TARGETED_QA_ONLY";
const BASELINE_PACKAGE_RUN_KIND = "ISOLATED_PACKAGE_QA";
const EXPECTED_DOCUMENT_COUNT = 10;
const EXPECTED_REQUIREMENT_COUNT = 69;
const EXPECTED_ROW_COUNT = 224;
const EXPECTED_REVIEW_COUNT = 69;
const EXPECTED_NO_REVIEW_COUNT = 155;
const DOCUMENT_SIDES = Object.freeze(["A", "B"]);
const DOCUMENT_ROLES = Object.freeze([
  "MAIN_POLICY",
  "SUPPLEMENT",
  "ENDORSEMENT",
  "TERMS",
  "OTHER",
]);
const DOCUMENT_STATUSES = Object.freeze([
  "ACTIVE",
  "FRAMEWORK_TERMS",
  "PROPOSAL",
]);
const CANONICAL_CATALOG_SHA256 = Object.freeze({
  VS: "271b430c977e087232a6eec31146f70242a8feb93ad1e00559c0df85fdb8cffc",
  FE: "7978f1ce98617e782ca422d71dc7ae32c8e34d6ad1a74e4453acc2eeb435f248",
  LW: "9d43eadd994af8596e2ea3608d2cc56d66e1f61b7e71bc7c417aabb29b23846a",
  ST: "03a815d5139591fdb358cf0853ce390b88728baccadf4cc918699ff40d8b8e9c",
  EL: "382c37e12bc95aed43eb75f40eac5b635c427e3ee14f74d65688e35f746356f9",
});

function manifestError(code, detail = "") {
  const error = new Error(detail ? `${code}: ${detail}` : code);
  error.code = code;
  return error;
}

function exactKeys(value, expectedKeys, code) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw manifestError(code);
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  )
    throw manifestError(code, actual.join(","));
}

function requiredText(value, code) {
  const text = String(value || "").trim();
  if (!text) throw manifestError(code);
  return text;
}

function sha256Text(value, code) {
  const text = String(value || "");
  if (!/^[a-f0-9]{64}$/u.test(text)) throw manifestError(code);
  return text;
}

function rawBuffer(value, code) {
  if (!Buffer.isBuffer(value) && !(value instanceof Uint8Array))
    throw manifestError(code);
  return Buffer.from(value);
}

function parseJsonBytes(bytes, code) {
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch {
    throw manifestError(code);
  }
}

function canonicalProductProfile(profile) {
  exactKeys(
    profile,
    [
      "id",
      "comparisonContractId",
      "categoryViews",
      "categoryRowCounts",
      "categoryCatalogIds",
      "expectedRowCount",
    ],
    "TARGETED_QA_PRODUCT_PROFILE_INVALID"
  );
  const categoryViews = Array.isArray(profile.categoryViews)
    ? profile.categoryViews.map((categoryView) =>
        requiredText(categoryView, "TARGETED_QA_CATEGORY_VIEW_INVALID")
      )
    : [];
  if (
    categoryViews.length === 0 ||
    new Set(categoryViews).size !== categoryViews.length
  )
    throw manifestError("TARGETED_QA_PRODUCT_PROFILE_CATEGORIES_INVALID");
  exactKeys(
    profile.categoryRowCounts,
    categoryViews,
    "TARGETED_QA_PRODUCT_PROFILE_ROW_COUNTS_INVALID"
  );
  exactKeys(
    profile.categoryCatalogIds,
    categoryViews,
    "TARGETED_QA_PRODUCT_PROFILE_CATALOG_IDS_INVALID"
  );
  const categoryRowCounts = {};
  const categoryCatalogIds = {};
  for (const categoryView of categoryViews) {
    const rowCount = profile.categoryRowCounts[categoryView];
    if (!Number.isInteger(rowCount) || rowCount < 1)
      throw manifestError(
        "TARGETED_QA_PROFILE_ROW_COUNT_INVALID",
        categoryView
      );
    categoryRowCounts[categoryView] = rowCount;
    categoryCatalogIds[categoryView] = requiredText(
      profile.categoryCatalogIds[categoryView],
      "TARGETED_QA_PROFILE_CATALOG_ID_INVALID"
    );
  }
  if (
    profile.expectedRowCount !== EXPECTED_ROW_COUNT ||
    Object.values(categoryRowCounts).reduce((sum, count) => sum + count, 0) !==
      EXPECTED_ROW_COUNT
  )
    throw manifestError("TARGETED_QA_PROFILE_ROW_TOTAL_INVALID");
  return {
    id: requiredText(profile.id, "TARGETED_QA_PROFILE_ID_REQUIRED"),
    comparisonContractId: requiredText(
      profile.comparisonContractId,
      "TARGETED_QA_COMPARISON_CONTRACT_ID_REQUIRED"
    ),
    categoryViews,
    categoryRowCounts,
    categoryCatalogIds,
    expectedRowCount: EXPECTED_ROW_COUNT,
  };
}

function canonicalDocument(document, { primaryManifestRequired }) {
  const keys = [
    "uuid",
    "side",
    "position",
    "role",
    "documentStatus",
    "originalName",
    "sha256",
  ];
  if (primaryManifestRequired) keys.push("primaryManifestSha256");
  exactKeys(document, keys, "TARGETED_QA_DOCUMENT_KEYS_INVALID");
  const side = requiredText(
    document.side,
    "TARGETED_QA_DOCUMENT_SIDE_REQUIRED"
  );
  if (!DOCUMENT_SIDES.includes(side))
    throw manifestError("TARGETED_QA_DOCUMENT_SIDE_UNKNOWN", side);
  const role = requiredText(
    document.role,
    "TARGETED_QA_DOCUMENT_ROLE_REQUIRED"
  );
  if (!DOCUMENT_ROLES.includes(role))
    throw manifestError("TARGETED_QA_DOCUMENT_ROLE_UNKNOWN", role);
  const documentStatus = requiredText(
    document.documentStatus,
    "TARGETED_QA_DOCUMENT_STATUS_REQUIRED"
  );
  if (!DOCUMENT_STATUSES.includes(documentStatus))
    throw manifestError("TARGETED_QA_DOCUMENT_STATUS_UNKNOWN", documentStatus);
  if (!Number.isInteger(document.position) || document.position < 0)
    throw manifestError("TARGETED_QA_DOCUMENT_POSITION_INVALID");
  return {
    uuid: requiredText(document.uuid, "TARGETED_QA_DOCUMENT_UUID_REQUIRED"),
    side,
    position: document.position,
    role,
    documentStatus,
    originalName: requiredText(
      document.originalName,
      "TARGETED_QA_DOCUMENT_NAME_REQUIRED"
    ),
    sha256: sha256Text(document.sha256, "TARGETED_QA_DOCUMENT_SHA_INVALID"),
    ...(primaryManifestRequired
      ? {
          primaryManifestSha256: sha256Text(
            document.primaryManifestSha256,
            "TARGETED_QA_PRIMARY_MANIFEST_SHA_INVALID"
          ),
        }
      : {}),
  };
}

function canonicalPackageDocuments(documents) {
  if (!Array.isArray(documents) || documents.length !== EXPECTED_DOCUMENT_COUNT)
    throw manifestError("TARGETED_QA_DOCUMENT_COUNT_INVALID");
  const canonical = documents.map((document) =>
    canonicalDocument(document, { primaryManifestRequired: true })
  );
  if (
    canonical[0].side !== "A" ||
    canonical[0].position !== 0 ||
    canonical
      .slice(1)
      .some(
        (document, index) =>
          document.side !== "B" || document.position !== index
      )
  )
    throw manifestError("TARGETED_QA_DOCUMENT_MATRIX_ORDER_INVALID");
  if (new Set(canonical.map(({ uuid }) => uuid)).size !== canonical.length)
    throw manifestError("TARGETED_QA_DOCUMENT_UUID_DUPLICATE");
  return canonical;
}

function canonicalPackageContract(contract) {
  exactKeys(
    contract,
    [
      "schemaVersion",
      "runKind",
      "releaseId",
      "productProfile",
      "sourceInputManifest",
      "documents",
      "runSignature",
    ],
    "TARGETED_QA_PACKAGE_CONTRACT_INVALID"
  );
  if (
    contract.schemaVersion !== 1 ||
    contract.runKind !== BASELINE_PACKAGE_RUN_KIND
  )
    throw manifestError("TARGETED_QA_PACKAGE_CONTRACT_INVALID");
  exactKeys(
    contract.sourceInputManifest,
    ["file", "sha256"],
    "TARGETED_QA_SOURCE_MANIFEST_INVALID"
  );
  return {
    schemaVersion: 1,
    runKind: BASELINE_PACKAGE_RUN_KIND,
    releaseId: requiredText(
      contract.releaseId,
      "TARGETED_QA_BASELINE_RELEASE_REQUIRED"
    ),
    productProfile: canonicalProductProfile(contract.productProfile),
    sourceInputManifest: {
      file: requiredText(
        contract.sourceInputManifest.file,
        "TARGETED_QA_SOURCE_MANIFEST_FILE_REQUIRED"
      ),
      sha256: sha256Text(
        contract.sourceInputManifest.sha256,
        "TARGETED_QA_SOURCE_MANIFEST_SHA_INVALID"
      ),
    },
    documents: canonicalPackageDocuments(contract.documents),
    runSignature: sha256Text(
      contract.runSignature,
      "TARGETED_QA_BASELINE_RUN_SIGNATURE_INVALID"
    ),
  };
}

function registryTargetKeys(registry) {
  return registry.categoryTargets.flatMap(({ categoryView, requirementIds }) =>
    requirementIds.map((requirementId) => `${categoryView}:${requirementId}`)
  );
}

function validatePackageRegistryBinding({ packageContract, registry }) {
  if (packageContract.releaseId !== registry.baseline.codeCommitSha)
    throw manifestError("TARGETED_QA_BASELINE_RELEASE_MISMATCH");
  if (
    JSON.stringify(packageContract.productProfile.categoryViews) !==
    JSON.stringify(registry.canonicalCategoryOrder)
  )
    throw manifestError("TARGETED_QA_PROFILE_CATEGORY_ORDER_MISMATCH");
  for (const [
    index,
    categoryView,
  ] of registry.canonicalCategoryOrder.entries()) {
    if (
      packageContract.productProfile.categoryCatalogIds[categoryView] !==
      registry.categoryTargets[index].catalogId
    )
      throw manifestError("TARGETED_QA_PROFILE_CATALOG_MISMATCH", categoryView);
  }
}

function canonicalRegistry(registry) {
  exactKeys(
    registry,
    [
      "schemaVersion",
      "registryId",
      "status",
      "documentSpecificQaOnly",
      "productionRule",
      "publishable",
      "deployable",
      "sourceDocumentationPath",
      "baseline",
      "canonicalCategoryOrder",
      "expectedRequirementCount",
      "expectedDistribution",
      "categoryTargets",
    ],
    "TARGETED_QA_REGISTRY_INVALID"
  );
  if (
    registry.schemaVersion !== 1 ||
    registry.status !== TARGETED_QA_RUN_KIND ||
    registry.documentSpecificQaOnly !== true ||
    registry.productionRule !== false ||
    registry.publishable !== false ||
    registry.deployable !== false ||
    registry.expectedRequirementCount !== EXPECTED_REQUIREMENT_COUNT ||
    !Array.isArray(registry.canonicalCategoryOrder) ||
    JSON.stringify(registry.canonicalCategoryOrder) !==
      JSON.stringify(Object.keys(CANONICAL_CATALOG_SHA256)) ||
    !Array.isArray(registry.categoryTargets)
  )
    throw manifestError("TARGETED_QA_REGISTRY_INVALID");
  exactKeys(
    registry.baseline,
    [
      "runId",
      "runSignatureSha256",
      "packageContractSha256",
      "comparisonSha256",
      "codeCommitSha",
      "documentedWorkingStateCommitSha",
    ],
    "TARGETED_QA_REGISTRY_BASELINE_INVALID"
  );
  exactKeys(
    registry.expectedDistribution,
    registry.canonicalCategoryOrder,
    "TARGETED_QA_REGISTRY_DISTRIBUTION_INVALID"
  );
  let targetCount = 0;
  const seen = new Set();
  for (const [
    index,
    categoryView,
  ] of registry.canonicalCategoryOrder.entries()) {
    const target = registry.categoryTargets[index];
    exactKeys(
      target,
      ["categoryView", "catalogId", "requirementIds"],
      "TARGETED_QA_REGISTRY_TARGET_INVALID"
    );
    if (
      target.categoryView !== categoryView ||
      !Array.isArray(target.requirementIds) ||
      target.requirementIds.length !==
        registry.expectedDistribution[categoryView]
    )
      throw manifestError("TARGETED_QA_REGISTRY_DISTRIBUTION_INVALID");
    for (const requirementId of target.requirementIds) {
      if (
        typeof requirementId !== "string" ||
        !requirementId.startsWith(`${categoryView}-`) ||
        seen.has(requirementId)
      )
        throw manifestError("TARGETED_QA_REGISTRY_TARGET_INVALID");
      seen.add(requirementId);
      targetCount += 1;
    }
  }
  if (targetCount !== EXPECTED_REQUIREMENT_COUNT)
    throw manifestError("TARGETED_QA_REGISTRY_TARGET_COUNT_INVALID");
  for (const field of [
    "runSignatureSha256",
    "packageContractSha256",
    "comparisonSha256",
  ])
    sha256Text(registry.baseline[field], "TARGETED_QA_REGISTRY_HASH_INVALID");
  return registry;
}

function sortedUnique(values, code) {
  if (!Array.isArray(values) || new Set(values).size !== values.length)
    throw manifestError(code);
  return [...values].sort();
}

function comparisonReviewKeys(comparison) {
  const byReason = comparison.totals?.customerReviewRowKeysByReasonCode;
  if (!byReason || typeof byReason !== "object" || Array.isArray(byReason))
    throw manifestError("TARGETED_QA_COMPARISON_REVIEW_KEYS_INVALID");
  return sortedUnique(
    Object.values(byReason).flatMap((values) => values),
    "TARGETED_QA_COMPARISON_REVIEW_KEYS_INVALID"
  );
}

function validateComparison({ comparison, packageContract, registry }) {
  if (
    !comparison ||
    typeof comparison !== "object" ||
    Array.isArray(comparison)
  )
    throw manifestError("TARGETED_QA_COMPARISON_INVALID");
  if (
    comparison.runSignature !== packageContract.runSignature ||
    comparison.runSignature !== registry.baseline.runSignatureSha256 ||
    JSON.stringify(canonicalProductProfile(comparison.productProfile)) !==
      JSON.stringify(packageContract.productProfile)
  )
    throw manifestError("TARGETED_QA_COMPARISON_IDENTITY_MISMATCH");
  if (
    !Array.isArray(comparison.documents) ||
    comparison.documents.length !== 10
  )
    throw manifestError("TARGETED_QA_COMPARISON_DOCUMENTS_INVALID");
  const projectedDocuments = packageContract.documents.map(
    ({
      uuid,
      side,
      role,
      documentStatus,
      originalName,
      sha256: documentSha,
    }) => ({
      uuid,
      side,
      role,
      documentStatus,
      originalName,
      sha256: documentSha,
    })
  );
  for (const [index, comparisonDocument] of comparison.documents.entries()) {
    const withPosition = {
      ...comparisonDocument,
      position: packageContract.documents[index].position,
    };
    const canonical = canonicalDocument(withPosition, {
      primaryManifestRequired: false,
    });
    const { position: _position, ...withoutPosition } = canonical;
    if (
      JSON.stringify(withoutPosition) !==
      JSON.stringify(projectedDocuments[index])
    )
      throw manifestError("TARGETED_QA_COMPARISON_DOCUMENT_MISMATCH");
  }
  if (
    comparison.totals?.rows !== EXPECTED_ROW_COUNT ||
    comparison.totals?.customerReviewRequired !== EXPECTED_REVIEW_COUNT ||
    comparison.totals?.noCustomerReviewRequired !== EXPECTED_NO_REVIEW_COUNT ||
    !Array.isArray(comparison.categories) ||
    comparison.categories.length !== registry.canonicalCategoryOrder.length
  )
    throw manifestError("TARGETED_QA_COMPARISON_TOTALS_INVALID");
  for (const [
    index,
    categoryView,
  ] of registry.canonicalCategoryOrder.entries()) {
    const category = comparison.categories[index];
    if (
      category?.categoryView !== categoryView ||
      !Array.isArray(category.rows) ||
      category.rows.length !==
        packageContract.productProfile.categoryRowCounts[categoryView]
    )
      throw manifestError("TARGETED_QA_COMPARISON_CATEGORY_ROWS_INVALID");
  }
  const expectedReviewKeys = sortedUnique(
    registryTargetKeys(registry),
    "TARGETED_QA_REGISTRY_TARGET_INVALID"
  );
  const reviewKeys = comparisonReviewKeys(comparison);
  const unclearKeys = sortedUnique(
    comparison.totals?.pointDecisionRowKeysByOutcome?.UNKLAR,
    "TARGETED_QA_COMPARISON_UNCLEAR_KEYS_INVALID"
  );
  if (
    JSON.stringify(reviewKeys) !== JSON.stringify(expectedReviewKeys) ||
    JSON.stringify(unclearKeys) !== JSON.stringify(expectedReviewKeys)
  )
    throw manifestError("TARGETED_QA_COMPARISON_REVIEW_MEMBERSHIP_MISMATCH");
  return {
    schemaVersion: comparison.schemaVersion,
    runSignature: comparison.runSignature,
    productProfile: packageContract.productProfile,
    documents: projectedDocuments,
    totals: {
      rows: EXPECTED_ROW_COUNT,
      customerReviewRequired: EXPECTED_REVIEW_COUNT,
      noCustomerReviewRequired: EXPECTED_NO_REVIEW_COUNT,
      reviewRowKeys: expectedReviewKeys,
    },
  };
}

function canonicalExecution(execution, categoryOrder) {
  exactKeys(
    execution,
    ["releaseId", "model", "context", "nodeVersion", "promptSha256ByCategory"],
    "TARGETED_QA_EXECUTION_INVALID"
  );
  if (!Number.isInteger(execution.context) || execution.context < 1)
    throw manifestError("TARGETED_QA_EXECUTION_CONTEXT_INVALID");
  exactKeys(
    execution.promptSha256ByCategory,
    categoryOrder,
    "TARGETED_QA_EXECUTION_PROMPTS_INVALID"
  );
  const promptSha256ByCategory = {};
  for (const categoryView of categoryOrder)
    promptSha256ByCategory[categoryView] = sha256Text(
      execution.promptSha256ByCategory[categoryView],
      "TARGETED_QA_EXECUTION_PROMPT_SHA_INVALID"
    );
  return {
    releaseId: requiredText(
      execution.releaseId,
      "TARGETED_QA_EXECUTION_RELEASE_REQUIRED"
    ),
    model: requiredText(
      execution.model,
      "TARGETED_QA_EXECUTION_MODEL_REQUIRED"
    ),
    context: execution.context,
    nodeVersion: requiredText(
      execution.nodeVersion,
      "TARGETED_QA_EXECUTION_NODE_VERSION_REQUIRED"
    ),
    promptSha256ByCategory,
  };
}

function buildCategoryTargets({ registry, catalogBytesByCategory }) {
  exactKeys(
    catalogBytesByCategory,
    registry.canonicalCategoryOrder,
    "TARGETED_QA_CATALOG_BYTES_INVALID"
  );
  return registry.categoryTargets.map((target) => {
    const bytes = rawBuffer(
      catalogBytesByCategory[target.categoryView],
      "TARGETED_QA_CATALOG_BYTES_INVALID"
    );
    const catalogSha256 = sha256(bytes);
    if (catalogSha256 !== CANONICAL_CATALOG_SHA256[target.categoryView])
      throw manifestError(
        "TARGETED_QA_CATALOG_SHA_MISMATCH",
        target.categoryView
      );
    const catalog = parseJsonBytes(bytes, "TARGETED_QA_CATALOG_JSON_INVALID");
    if (
      catalog.catalogId !== target.catalogId ||
      catalog.categoryView !== target.categoryView
    )
      throw manifestError("TARGETED_QA_CATALOG_IDENTITY_MISMATCH");
    const selected = selectTargetRequirements({
      catalog,
      requirementIds: target.requirementIds,
    });
    if (
      JSON.stringify(selected.selection.requirementIds) !==
      JSON.stringify(target.requirementIds)
    )
      throw manifestError("TARGETED_QA_CATALOG_TARGET_ORDER_MISMATCH");
    return {
      categoryView: target.categoryView,
      catalogId: target.catalogId,
      catalogSha256,
      requirementIds: [...target.requirementIds],
      expectedTargetSelectionDigestSha256:
        selected.selection.selectionDigestSha256,
      targetRequirementSelection: selected.selection,
    };
  });
}

function digestContract(manifest) {
  const { manifestDigestSha256: _digest, ...contract } = manifest;
  return contract;
}

function buildTargetedQaManifest({
  qaRegistryBytes,
  packageContractBytes,
  baselineComparisonBytes,
  catalogBytesByCategory,
  execution,
}) {
  const registryRaw = rawBuffer(
    qaRegistryBytes,
    "TARGETED_QA_REGISTRY_BYTES_REQUIRED"
  );
  const registry = canonicalRegistry(
    parseJsonBytes(registryRaw, "TARGETED_QA_REGISTRY_JSON_INVALID")
  );
  const packageRaw = rawBuffer(
    packageContractBytes,
    "TARGETED_QA_PACKAGE_BYTES_REQUIRED"
  );
  if (sha256(packageRaw) !== registry.baseline.packageContractSha256)
    throw manifestError("TARGETED_QA_PACKAGE_BYTES_SHA_MISMATCH");
  const comparisonRaw = rawBuffer(
    baselineComparisonBytes,
    "TARGETED_QA_COMPARISON_BYTES_REQUIRED"
  );
  if (sha256(comparisonRaw) !== registry.baseline.comparisonSha256)
    throw manifestError("TARGETED_QA_COMPARISON_BYTES_SHA_MISMATCH");
  const packageContract = canonicalPackageContract(
    parseJsonBytes(packageRaw, "TARGETED_QA_PACKAGE_JSON_INVALID")
  );
  if (packageContract.runSignature !== registry.baseline.runSignatureSha256)
    throw manifestError("TARGETED_QA_BASELINE_RUN_SIGNATURE_MISMATCH");
  validatePackageRegistryBinding({ packageContract, registry });
  const comparison = parseJsonBytes(
    comparisonRaw,
    "TARGETED_QA_COMPARISON_JSON_INVALID"
  );
  const comparisonProjection = validateComparison({
    comparison,
    packageContract,
    registry,
  });
  const categoryTargets = buildCategoryTargets({
    registry,
    catalogBytesByCategory,
  });
  const canonicalExecutionConfig = canonicalExecution(
    execution,
    registry.canonicalCategoryOrder
  );
  const manifest = {
    schemaVersion: TARGETED_QA_MANIFEST_SCHEMA_VERSION,
    contractId: TARGETED_QA_MANIFEST_CONTRACT_ID,
    runKind: TARGETED_QA_RUN_KIND,
    executionPolicy: {
      productMutationAllowed: false,
      fullMaterializerAllowed: false,
    },
    trustAnchor: {
      registryId: registry.registryId,
      registrySha256: sha256(registryRaw),
      packageContractFileSha256: registry.baseline.packageContractSha256,
      baselineComparisonFileSha256: registry.baseline.comparisonSha256,
      baselineRunSignature: registry.baseline.runSignatureSha256,
    },
    baseline: {
      packageContract,
      comparisonProjection,
    },
    execution: canonicalExecutionConfig,
    documentMatrix: {
      expectedDocumentCount: EXPECTED_DOCUMENT_COUNT,
      sideCounts: { A: 1, B: 9 },
      documents: packageContract.documents,
      documentMatrixDigestSha256: selectionDigest(packageContract.documents),
    },
    categoryTargets,
  };
  return {
    ...manifest,
    manifestDigestSha256: selectionDigest(manifest),
  };
}

function assertTargetedQaManifest(
  manifest,
  { expectedManifestDigestSha256 = null, expectedExecution = null } = {}
) {
  exactKeys(
    manifest,
    [
      "schemaVersion",
      "contractId",
      "runKind",
      "executionPolicy",
      "trustAnchor",
      "baseline",
      "execution",
      "documentMatrix",
      "categoryTargets",
      "manifestDigestSha256",
    ],
    "TARGETED_QA_MANIFEST_INVALID"
  );
  if (
    manifest.schemaVersion !== TARGETED_QA_MANIFEST_SCHEMA_VERSION ||
    manifest.contractId !== TARGETED_QA_MANIFEST_CONTRACT_ID ||
    manifest.runKind !== TARGETED_QA_RUN_KIND
  )
    throw manifestError("TARGETED_QA_MANIFEST_CONTRACT_INVALID");
  exactKeys(
    manifest.executionPolicy,
    ["productMutationAllowed", "fullMaterializerAllowed"],
    "TARGETED_QA_EXECUTION_POLICY_INVALID"
  );
  if (
    manifest.executionPolicy.productMutationAllowed !== false ||
    manifest.executionPolicy.fullMaterializerAllowed !== false
  )
    throw manifestError("TARGETED_QA_EXECUTION_POLICY_INVALID");
  exactKeys(
    manifest.trustAnchor,
    [
      "registryId",
      "registrySha256",
      "packageContractFileSha256",
      "baselineComparisonFileSha256",
      "baselineRunSignature",
    ],
    "TARGETED_QA_TRUST_ANCHOR_INVALID"
  );
  for (const key of [
    "registrySha256",
    "packageContractFileSha256",
    "baselineComparisonFileSha256",
    "baselineRunSignature",
  ])
    sha256Text(manifest.trustAnchor[key], "TARGETED_QA_TRUST_ANCHOR_INVALID");
  exactKeys(
    manifest.baseline,
    ["packageContract", "comparisonProjection"],
    "TARGETED_QA_BASELINE_INVALID"
  );
  const packageContract = canonicalPackageContract(
    manifest.baseline.packageContract
  );
  if (
    packageContract.runSignature !==
      manifest.trustAnchor.baselineRunSignature ||
    manifest.baseline.comparisonProjection?.runSignature !==
      manifest.trustAnchor.baselineRunSignature ||
    JSON.stringify(manifest.baseline.comparisonProjection?.documents) !==
      JSON.stringify(
        packageContract.documents.map(
          ({
            uuid,
            side,
            role,
            documentStatus,
            originalName,
            sha256: documentSha,
          }) => ({
            uuid,
            side,
            role,
            documentStatus,
            originalName,
            sha256: documentSha,
          })
        )
      )
  )
    throw manifestError("TARGETED_QA_BASELINE_PROJECTION_MISMATCH");
  const projection = manifest.baseline.comparisonProjection;
  if (
    projection?.totals?.rows !== EXPECTED_ROW_COUNT ||
    projection?.totals?.customerReviewRequired !== EXPECTED_REVIEW_COUNT ||
    projection?.totals?.noCustomerReviewRequired !== EXPECTED_NO_REVIEW_COUNT ||
    !Array.isArray(projection?.totals?.reviewRowKeys) ||
    projection.totals.reviewRowKeys.length !== EXPECTED_REVIEW_COUNT
  )
    throw manifestError("TARGETED_QA_BASELINE_TOTALS_MISMATCH");
  const categoryOrder = packageContract.productProfile.categoryViews;
  const execution = canonicalExecution(manifest.execution, categoryOrder);
  if (expectedExecution) {
    const expected = canonicalExecution(expectedExecution, categoryOrder);
    if (JSON.stringify(execution) !== JSON.stringify(expected))
      throw manifestError("TARGETED_QA_EXPECTED_EXECUTION_MISMATCH");
  }
  if (
    !manifest.documentMatrix ||
    manifest.documentMatrix?.expectedDocumentCount !==
      EXPECTED_DOCUMENT_COUNT ||
    JSON.stringify(manifest.documentMatrix?.sideCounts) !==
      JSON.stringify({ A: 1, B: 9 }) ||
    JSON.stringify(manifest.documentMatrix?.documents) !==
      JSON.stringify(packageContract.documents) ||
    manifest.documentMatrix?.documentMatrixDigestSha256 !==
      selectionDigest(packageContract.documents)
  )
    throw manifestError("TARGETED_QA_DOCUMENT_MATRIX_MISMATCH");
  if (
    !Array.isArray(manifest.categoryTargets) ||
    manifest.categoryTargets.length !== categoryOrder.length
  )
    throw manifestError("TARGETED_QA_CATEGORY_TARGETS_INVALID");
  let targetCount = 0;
  const targetRowKeys = [];
  for (const [index, categoryView] of categoryOrder.entries()) {
    const target = manifest.categoryTargets[index];
    exactKeys(
      target,
      [
        "categoryView",
        "catalogId",
        "catalogSha256",
        "requirementIds",
        "expectedTargetSelectionDigestSha256",
        "targetRequirementSelection",
      ],
      "TARGETED_QA_CATEGORY_TARGET_INVALID"
    );
    if (
      target?.categoryView !== categoryView ||
      target.catalogId !==
        packageContract.productProfile.categoryCatalogIds[categoryView] ||
      target.catalogSha256 !== CANONICAL_CATALOG_SHA256[categoryView] ||
      target.expectedTargetSelectionDigestSha256 !==
        target.targetRequirementSelection?.selectionDigestSha256
    )
      throw manifestError("TARGETED_QA_CATEGORY_TARGET_INVALID");
    assertTargetRequirementSelectionContract(
      target.targetRequirementSelection,
      {
        expectedCatalogId: target.catalogId,
        expectedCategoryView: categoryView,
        expectedSelectionDigestSha256:
          target.expectedTargetSelectionDigestSha256,
      }
    );
    if (
      JSON.stringify(target.requirementIds) !==
      JSON.stringify(target.targetRequirementSelection.requirementIds)
    )
      throw manifestError("TARGETED_QA_CATEGORY_TARGET_INVALID");
    targetCount += target.requirementIds.length;
    targetRowKeys.push(
      ...target.requirementIds.map(
        (requirementId) => `${categoryView}:${requirementId}`
      )
    );
  }
  if (
    targetCount !== EXPECTED_REQUIREMENT_COUNT ||
    JSON.stringify([...targetRowKeys].sort()) !==
      JSON.stringify(projection.totals.reviewRowKeys)
  )
    throw manifestError("TARGETED_QA_CATEGORY_TARGET_COUNT_INVALID");
  const actualDigest = selectionDigest(digestContract(manifest));
  if (manifest.manifestDigestSha256 !== actualDigest)
    throw manifestError("TARGETED_QA_MANIFEST_DIGEST_MISMATCH");
  if (
    expectedManifestDigestSha256 &&
    actualDigest !== expectedManifestDigestSha256
  )
    throw manifestError("TARGETED_QA_EXPECTED_MANIFEST_DIGEST_MISMATCH");
  return manifest;
}

module.exports = {
  CANONICAL_CATALOG_SHA256,
  EXPECTED_DOCUMENT_COUNT,
  EXPECTED_REQUIREMENT_COUNT,
  TARGETED_QA_MANIFEST_CONTRACT_ID,
  TARGETED_QA_MANIFEST_SCHEMA_VERSION,
  TARGETED_QA_RUN_KIND,
  assertTargetedQaManifest,
  buildTargetedQaManifest,
};

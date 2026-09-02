#!/usr/bin/env node

process.umask(0o077);

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const {
  buildControlledOccurrenceWorksheet,
} = require("../../utils/policyAnalysis/controlledOccurrenceWorksheet");
const {
  releaseIdentity,
  sha256,
} = require("../../utils/policyAnalysis/runIdentity");
const {
  PRODUCT_PROFILE,
} = require("../../utils/policyComparison/productContract");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../..");
const CONTRACT_ID = "TARGET_REQUIREMENT_RECALL_AUDIT_V2";
const CATALOG_FILES = Object.freeze({
  VS: "server/resources/policyAnalysis/vs-occurrence-full-draft.v0.2.json",
  FE: "server/resources/policyAnalysis/fe-occurrence-full-draft.v0.1.json",
  LW: "server/resources/policyAnalysis/lw-occurrence-full-draft.v0.1.json",
  ST: "server/resources/policyAnalysis/st-occurrence-full-draft.v0.1.json",
  EL: "server/resources/policyAnalysis/el-occurrence-full-draft.v0.1.json",
});

function auditError(code, detail = "") {
  const error = new Error(detail ? `${code}: ${detail}` : code);
  error.code = code;
  return error;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableValue(value[key])])
  );
}

function stableDigest(value) {
  return sha256(JSON.stringify(stableValue(value)));
}

function parseArguments(argv) {
  if (argv.length % 2 !== 0) throw auditError("TARGET_RECALL_ARGUMENT_INVALID");
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value)
      throw auditError("TARGET_RECALL_ARGUMENT_INVALID", key);
    const name = key.slice(2);
    if (Object.hasOwn(values, name))
      throw auditError("TARGET_RECALL_ARGUMENT_DUPLICATE", name);
    values[name] = value;
  }
  const expected = [
    "baselineRoot",
    "categoryView",
    "requirementId",
    "expectedBaselinePackageSha256",
    "expectedDocumentCount",
    "output",
  ];
  const unknown = Object.keys(values).filter((key) => !expected.includes(key));
  if (unknown.length)
    throw auditError("TARGET_RECALL_ARGUMENT_UNKNOWN", unknown.join(","));
  for (const required of expected)
    if (!values[required])
      throw auditError("TARGET_RECALL_ARGUMENT_REQUIRED", required);
  if (!path.isAbsolute(values.baselineRoot) || !path.isAbsolute(values.output))
    throw auditError("TARGET_RECALL_ABSOLUTE_PATH_REQUIRED");
  if (!Object.hasOwn(CATALOG_FILES, values.categoryView))
    throw auditError("TARGET_RECALL_CATEGORY_INVALID", values.categoryView);
  if (!values.requirementId.startsWith(`${values.categoryView}-`))
    throw auditError("TARGET_RECALL_REQUIREMENT_INVALID", values.requirementId);
  if (!/^[a-f0-9]{64}$/u.test(values.expectedBaselinePackageSha256))
    throw auditError("TARGET_RECALL_BASELINE_HASH_INVALID");
  const expectedDocumentCount = Number(values.expectedDocumentCount);
  if (!Number.isInteger(expectedDocumentCount) || expectedDocumentCount < 2)
    throw auditError("TARGET_RECALL_DOCUMENT_COUNT_INVALID");
  return { ...values, expectedDocumentCount };
}

function readPrivateJson(file, code, fsImpl) {
  if (!fsImpl.existsSync(file) || !fsImpl.statSync(file).isFile())
    throw auditError(code, file);
  const bytes = fsImpl.readFileSync(file);
  let value;
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw auditError(code, file);
  }
  return { bytes, value };
}

function documentDirectory(baselineRoot, uuid, fsImpl) {
  const suffix = `-${uuid}`;
  const matches = fsImpl
    .readdirSync(baselineRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.endsWith(suffix))
    .map(({ name }) => path.join(baselineRoot, name));
  if (matches.length !== 1)
    throw auditError("TARGET_RECALL_DOCUMENT_DIRECTORY_INVALID", uuid);
  return matches[0];
}

function occurrenceProjection(requirement) {
  return requirement.components.map((component) => ({
    componentId: component.id,
    terminalState: component.terminalState,
    occurrenceCount: component.occurrenceCount,
    occurrences: component.occurrences.map(
      ({
        candidateId,
        matchedAlias,
        physicalPageNumber,
        exactText,
        documentStart,
        documentEnd,
        sectionScopeHint,
        pageScopeHints,
      }) => ({
        candidateId,
        matchedAlias,
        physicalPageNumber,
        exactText,
        documentStart,
        documentEnd,
        sectionScopeHint: sectionScopeHint || null,
        pageScopeHints: pageScopeHints || [],
      })
    ),
  }));
}

function completeDocumentArtifact(artifact, expected) {
  const extraction = artifact?.document?.pdfExtraction;
  return Boolean(
    artifact?.schemaVersion === 1 &&
      artifact.fingerprint === expected.sha256 &&
      artifact.document?.sourceDocumentId === artifact.fingerprint &&
      extraction?.complete === true &&
      Number.isInteger(extraction.totalPages) &&
      extraction.totalPages > 0 &&
      extraction.processedPages === extraction.totalPages &&
      extraction.pagesWithText === extraction.totalPages &&
      Array.isArray(artifact.document.pageMap) &&
      artifact.document.pageMap.length === extraction.totalPages
  );
}

function run(
  args,
  {
    fsImpl = fs,
    repositoryRoot = REPOSITORY_ROOT,
    releaseIdentityFn = releaseIdentity,
    buildWorksheetFn = buildControlledOccurrenceWorksheet,
  } = {}
) {
  const baselineRoot = path.resolve(args.baselineRoot);
  const output = path.resolve(args.output);
  if (fsImpl.existsSync(output))
    throw auditError("TARGET_RECALL_OUTPUT_EXISTS", output);

  const packageFile = path.join(
    baselineRoot,
    "PACKAGE-COMPARISON",
    "package-contract.private.json"
  );
  const packageArtifact = readPrivateJson(
    packageFile,
    "TARGET_RECALL_BASELINE_PACKAGE_INVALID",
    fsImpl
  );
  const packageSha256 = sha256(packageArtifact.bytes);
  if (packageSha256 !== args.expectedBaselinePackageSha256)
    throw auditError("TARGET_RECALL_BASELINE_PACKAGE_HASH_MISMATCH");
  const documents = packageArtifact.value?.documents;
  if (
    !Array.isArray(documents) ||
    documents.length !== args.expectedDocumentCount ||
    !documents.some(({ side }) => side === "A") ||
    !documents.some(({ side }) => side === "B") ||
    new Set(documents.map(({ uuid }) => uuid)).size !== documents.length
  )
    throw auditError("TARGET_RECALL_BASELINE_DOCUMENT_SET_INVALID");

  const catalogFile = path.join(
    repositoryRoot,
    CATALOG_FILES[args.categoryView]
  );
  const catalogArtifact = readPrivateJson(
    catalogFile,
    "TARGET_RECALL_CATALOG_INVALID",
    fsImpl
  );
  const catalog = catalogArtifact.value;
  const catalogRequirement = catalog?.requirements?.find(
    ({ id }) => id === args.requirementId
  );
  if (
    catalog?.categoryView !== args.categoryView ||
    PRODUCT_PROFILE.categoryCatalogIds[args.categoryView] !==
      catalog.catalogId ||
    !catalogRequirement
  )
    throw auditError("TARGET_RECALL_CATALOG_CONTRACT_MISMATCH");

  const documentAudits = documents
    .map((expected) => {
      const directory = documentDirectory(baselineRoot, expected.uuid, fsImpl);
      const documentArtifact = readPrivateJson(
        path.join(directory, "document.private.json"),
        "TARGET_RECALL_DOCUMENT_INVALID",
        fsImpl
      );
      const manifestArtifact = readPrivateJson(
        path.join(directory, "manifest.private.json"),
        "TARGET_RECALL_PRIMARY_MANIFEST_INVALID",
        fsImpl
      );
      if (
        sha256(manifestArtifact.bytes) !== expected.primaryManifestSha256 ||
        !completeDocumentArtifact(documentArtifact.value, expected)
      )
        throw auditError(
          "TARGET_RECALL_DOCUMENT_PROVENANCE_MISMATCH",
          expected.uuid
        );

      const baselineWorksheetArtifact = readPrivateJson(
        path.join(directory, args.categoryView, "worksheet.private.json"),
        "TARGET_RECALL_BASELINE_WORKSHEET_INVALID",
        fsImpl
      );
      const baselineWorksheet = baselineWorksheetArtifact.value;
      if (
        baselineWorksheet?.candidateOnly !== true ||
        baselineWorksheet?.catalog?.categoryView !== args.categoryView ||
        baselineWorksheet?.document?.fingerprint !== expected.sha256 ||
        baselineWorksheet?.document?.physicalPages !==
          documentArtifact.value.document.pdfExtraction.totalPages
      )
        throw auditError(
          "TARGET_RECALL_BASELINE_WORKSHEET_CONTRACT_MISMATCH",
          expected.uuid
        );

      const currentWorksheet = buildWorksheetFn({
        document: documentArtifact.value.document,
        documentFingerprint: documentArtifact.value.fingerprint,
        catalog,
      });
      const baselineById = new Map(
        baselineWorksheet.requirements.map((requirement) => [
          requirement.id,
          requirement,
        ])
      );
      const currentById = new Map(
        currentWorksheet.requirements.map((requirement) => [
          requirement.id,
          requirement,
        ])
      );
      if (
        baselineById.size !== currentById.size ||
        [...baselineById.keys()].some((id) => !currentById.has(id))
      )
        throw auditError(
          "TARGET_RECALL_REQUIREMENT_SET_MISMATCH",
          expected.uuid
        );
      const changedRequirementIds = [...baselineById.keys()].filter(
        (id) =>
          stableDigest(baselineById.get(id)) !==
          stableDigest(currentById.get(id))
      );
      const baselineRequirement = baselineById.get(args.requirementId);
      const currentRequirement = currentById.get(args.requirementId);
      if (!baselineRequirement || !currentRequirement)
        throw auditError("TARGET_RECALL_REQUIREMENT_MISSING", expected.uuid);

      return {
        documentUuid: expected.uuid,
        side: expected.side,
        position: expected.position,
        role: expected.role,
        documentStatus: expected.documentStatus,
        physicalPages: documentArtifact.value.document.pdfExtraction.totalPages,
        hashes: {
          documentArtifactSha256: sha256(documentArtifact.bytes),
          primaryManifestSha256: sha256(manifestArtifact.bytes),
          baselineWorksheetSha256: sha256(baselineWorksheetArtifact.bytes),
          baselineRequirementSha256: stableDigest(baselineRequirement),
          currentRequirementSha256: stableDigest(currentRequirement),
        },
        baselineCatalogId: baselineWorksheet.catalog.id,
        currentCatalogId: currentWorksheet.catalog.id,
        changedRequirementIds,
        baseline: occurrenceProjection(baselineRequirement),
        current: occurrenceProjection(currentRequirement),
      };
    })
    .sort((left, right) =>
      `${left.side}\u0000${left.position}\u0000${left.documentUuid}`.localeCompare(
        `${right.side}\u0000${right.position}\u0000${right.documentUuid}`
      )
    );

  const allCurrentComponentsTerminalZero = documentAudits.every(({ current }) =>
    current.every(
      ({ terminalState, occurrenceCount, occurrences }) =>
        terminalState === "NO_CONTROLLED_CANDIDATE" &&
        occurrenceCount === 0 &&
        occurrences.length === 0
    )
  );
  const onlySelectedRequirementChanged = documentAudits.every(
    ({ changedRequirementIds }) =>
      changedRequirementIds.length === 1 &&
      changedRequirementIds[0] === args.requirementId
  );
  const baselineOccurrenceCount = documentAudits.reduce(
    (sum, { baseline }) =>
      sum +
      baseline.reduce(
        (inner, component) => inner + component.occurrenceCount,
        0
      ),
    0
  );
  const currentOccurrenceCount = documentAudits.reduce(
    (sum, { current }) =>
      sum +
      current.reduce(
        (inner, component) => inner + component.occurrenceCount,
        0
      ),
    0
  );
  const gates = {
    baselinePackageHash: true,
    exactDocumentCount: documentAudits.length === args.expectedDocumentCount,
    bothPackageSidesPresent: ["A", "B"].every((side) =>
      documentAudits.some((document) => document.side === side)
    ),
    completeDocumentExtraction: true,
    primaryManifestHashes: true,
    baselineWorksheetContracts: true,
    currentCatalogMatchesProductProfile: true,
    onlySelectedRequirementChanged,
  };
  const findings = {
    allCurrentComponentsTerminalZero,
    occurrenceDelta: currentOccurrenceCount - baselineOccurrenceCount,
  };
  const report = {
    schemaVersion: 2,
    contractId: CONTRACT_ID,
    runKind: "TARGET_REQUIREMENT_RECALL_AUDIT_ONLY",
    status: Object.values(gates).every(Boolean)
      ? "TECHNICAL_PASS_REVIEW_REQUIRED"
      : "FAILED",
    customerMaterializationAllowed: false,
    publishable: false,
    deployable: false,
    releaseId: releaseIdentityFn(repositoryRoot),
    generatedAt: new Date().toISOString(),
    target: {
      categoryView: args.categoryView,
      requirementId: args.requirementId,
      currentCatalogId: catalog.catalogId,
      currentCatalogSha256: sha256(catalogArtifact.bytes),
      currentRequirementContractSha256: stableDigest(catalogRequirement),
    },
    baseline: {
      packageContractSha256: packageSha256,
      releaseId: packageArtifact.value.releaseId,
      runSignature: packageArtifact.value.runSignature,
      productProfile: packageArtifact.value.productProfile,
    },
    currentProductProfile: PRODUCT_PROFILE,
    counts: {
      documents: documentAudits.length,
      sides: Object.fromEntries(
        ["A", "B"].map((side) => [
          side,
          documentAudits.filter((document) => document.side === side).length,
        ])
      ),
      physicalPages: documentAudits.reduce(
        (sum, document) => sum + document.physicalPages,
        0
      ),
      baselineOccurrences: baselineOccurrenceCount,
      currentOccurrences: currentOccurrenceCount,
    },
    gates,
    findings,
    candidateConclusion: allCurrentComponentsTerminalZero
      ? "CONTROLLED_OCCURRENCE_ZERO_ON_BOTH_SIDES"
      : "CURRENT_OCCURRENCES_REQUIRE_FURTHER_TRIAGE",
    documents: documentAudits,
    proofLimit:
      "QA-only recall audit. It proves the selected requirement's controlled raw-occurrence state over the exact bound baseline documents. It does not materialize evidence, decide package comparison, authorize customer output, or prove arbitrary-policy correctness.",
  };
  report.reportDigestSha256 = stableDigest(report);
  fsImpl.mkdirSync(path.dirname(output), { recursive: true, mode: 0o700 });
  fsImpl.writeFileSync(output, JSON.stringify(report, null, 2), {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });
  fsImpl.chmodSync(output, 0o600);
  return report;
}

function main(argv = process.argv.slice(2)) {
  return run(parseArguments(argv));
}

if (require.main === module) {
  try {
    const result = main();
    console.log(
      `[target-recall-audit] ${result.status}: ${result.target.categoryView}:${result.target.requirementId}, ` +
        `${result.counts.baselineOccurrences}->${result.counts.currentOccurrences} Rohfundstellen in ${result.counts.documents} Dokumenten`
    );
  } catch (error) {
    console.error(`[target-recall-audit] ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  CATALOG_FILES,
  CONTRACT_ID,
  main,
  parseArguments,
  run,
  stableDigest,
};

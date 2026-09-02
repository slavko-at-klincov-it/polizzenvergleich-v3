#!/usr/bin/env node

process.umask(0o077);

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  CATEGORY_ORDER,
  fixedSourcePaths,
} = require("./ensureTargetedQaManifest.cjs");
const {
  buildComparisonResult,
} = require("../../utils/policyComparison/resultBuilder");
const {
  assertBaselineWorksheetRebuild,
} = require("../../utils/policyAnalysis/baselineWorksheetRebuildContract");
const {
  buildPreparedEvidenceTargets,
} = require("../../utils/policyAnalysis/preparedEvidenceContract");
const {
  TERMINAL_OCCURRENCE_DIGEST_CONTRACT_ID,
} = require("../../utils/policyAnalysis/deterministicTerminalRejectionContract");
const {
  materializeTargetedQaCategoryOverlay,
} = require("../../utils/policyAnalysis/targetedQaOverlayContract");
const {
  assertTargetedQaManifest,
} = require("../../utils/policyAnalysis/targetedQaManifestContract");
const {
  releaseIdentity,
  sha256,
} = require("../../utils/policyAnalysis/runIdentity");
const {
  selectionDigest,
} = require("../../utils/policyAnalysis/targetRequirementSelection");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../..");
const EXPECTED_DOCUMENT_COUNT = 10;
const EXPECTED_PAIR_COUNT = 50;
const EXPECTED_TARGET_COUNT = 69;
const EXPECTED_NON_TARGET_COUNT = 155;
const EXPECTED_ROW_COUNT = 224;
const OVERLAY_REPORT_CONTRACT_ID = "TARGETED_QA_OVERLAY_CATEGORY_REPORT_V1";
const OVERLAY_GUARD_CONTRACT_ID = "TARGETED_QA_OVERLAY_GUARD_V1";

function overlayCliError(code, detail = "") {
  const error = new Error(detail ? `${code}: ${detail}` : code);
  error.code = code;
  return error;
}

function parseArguments(argv) {
  if (argv.length % 2 !== 0)
    throw overlayCliError("TARGETED_OVERLAY_ARGUMENT_INVALID");
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value)
      throw overlayCliError("TARGETED_OVERLAY_ARGUMENT_INVALID", key);
    const name = key.slice(2);
    if (Object.hasOwn(values, name))
      throw overlayCliError("TARGETED_OVERLAY_ARGUMENT_DUPLICATE", name);
    values[name] = value;
  }
  const expected = [
    "baselineRoot",
    "targetRoot",
    "manifest",
    "expectedManifestDigest",
    "output",
  ];
  const unknown = Object.keys(values).filter((key) => !expected.includes(key));
  if (unknown.length)
    throw overlayCliError(
      "TARGETED_OVERLAY_ARGUMENT_UNKNOWN",
      unknown.join(",")
    );
  for (const required of expected)
    if (!values[required])
      throw overlayCliError("TARGETED_OVERLAY_ARGUMENT_REQUIRED", required);
  for (const name of ["baselineRoot", "targetRoot", "manifest", "output"])
    if (!path.isAbsolute(values[name]))
      throw overlayCliError("TARGETED_OVERLAY_ABSOLUTE_PATH_REQUIRED", name);
  if (!/^[a-f0-9]{64}$/u.test(values.expectedManifestDigest))
    throw overlayCliError("TARGETED_OVERLAY_MANIFEST_DIGEST_INVALID");
  return values;
}

function isWithin(parent, candidate) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) && relative !== "..")
  );
}

function realDirectory(directory, code, fsImpl) {
  if (
    !fsImpl.existsSync(directory) ||
    fsImpl.lstatSync(directory).isSymbolicLink() ||
    !fsImpl.statSync(directory).isDirectory()
  )
    throw overlayCliError(code, directory);
  return fsImpl.realpathSync(directory);
}

function privateBytes(file, code, fsImpl, scope) {
  if (
    !fsImpl.existsSync(file) ||
    fsImpl.lstatSync(file).isSymbolicLink() ||
    !fsImpl.statSync(file).isFile()
  )
    throw overlayCliError(code, file);
  const real = fsImpl.realpathSync(file);
  if (scope && !isWithin(scope, real)) throw overlayCliError(code, file);
  return fsImpl.readFileSync(real);
}

function privateJson(file, code, fsImpl, scope) {
  try {
    return JSON.parse(privateBytes(file, code, fsImpl, scope).toString("utf8"));
  } catch (error) {
    if (error?.code) throw error;
    throw overlayCliError(code, file);
  }
}

function mkdirPrivate(directory, fsImpl) {
  fsImpl.mkdirSync(directory, { recursive: false, mode: 0o700 });
  fsImpl.chmodSync(directory, 0o700);
}

function writePrivate(file, value, fsImpl) {
  fsImpl.writeFileSync(file, JSON.stringify(value, null, 2), {
    flag: "wx",
    mode: 0o600,
  });
  fsImpl.chmodSync(file, 0o600);
}

function writePrivateBytes(file, bytes, fsImpl) {
  fsImpl.writeFileSync(file, bytes, { flag: "wx", mode: 0o600 });
  fsImpl.chmodSync(file, 0o600);
}

function documentDirectoryName(document, index) {
  return `DOC-${String(index + 1).padStart(2, "0")}-${document.uuid}`;
}

function categoryFiles(root, documentDirectory, categoryView) {
  const directory = path.join(root, documentDirectory, categoryView);
  return {
    directory,
    worksheet: path.join(directory, "worksheet.private.json"),
    evidence: path.join(directory, "effects", "materialized.private.json"),
    targets: path.join(directory, "effects", "targets.private.json"),
    triage: path.join(directory, "triage", "materialized-triage.private.json"),
    effectsReport: path.join(directory, "effects", "report.json"),
    rows: path.join(directory, "result", "rows.private.json"),
    requested: path.join(directory, "result", "requested-fields.private.json"),
    resultReport: path.join(directory, "result", "report.private.json"),
    baselineResultReport: path.join(directory, "result", "report.json"),
  };
}

function targetKey(categoryView, requirementId) {
  return `${categoryView}:${requirementId}`;
}

function comparisonRows(comparison) {
  return new Map(
    (comparison.categories || []).flatMap(({ categoryView, rows }) =>
      (rows || []).map((row) => [targetKey(categoryView, row.categoryId), row])
    )
  );
}

function assertExact(value, expected, code, detail = "") {
  if (JSON.stringify(value) !== JSON.stringify(expected))
    throw overlayCliError(code, detail);
}

function filterRequirementOwned(values, targetSet, requirementIdOf) {
  return (values || []).filter(
    (value) => !targetSet.has(requirementIdOf(value))
  );
}

function nonTargetProjection(artifacts, targetSet) {
  return {
    rows: filterRequirementOwned(
      artifacts.rows,
      targetSet,
      ({ categoryId }) => categoryId
    ),
    requirements: filterRequirementOwned(
      artifacts.worksheet.requirements,
      targetSet,
      ({ id }) => id
    ),
    bindingGroups: filterRequirementOwned(
      artifacts.worksheet.bindingGroups || [],
      targetSet,
      ({ requirementId }) => requirementId
    ),
    judgements: filterRequirementOwned(
      artifacts.materializedEvidence.judgements,
      targetSet,
      ({ requirementId }) => requirementId
    ),
    rollups: filterRequirementOwned(
      artifacts.materializedEvidence.rollups,
      targetSet,
      ({ categoryId }) => categoryId
    ),
    targets: filterRequirementOwned(
      artifacts.targets,
      targetSet,
      ({ requirementId }) => requirementId
    ),
    requestedFields: filterRequirementOwned(
      artifacts.requestedFields.requirements,
      targetSet,
      ({ requirementId }) => requirementId
    ),
  };
}

function readBaselineArtifacts(files, fsImpl, root) {
  return {
    worksheet: privateJson(
      files.worksheet,
      "TARGETED_OVERLAY_BASELINE_WORKSHEET_INVALID",
      fsImpl,
      root
    ),
    materializedEvidence: privateJson(
      files.evidence,
      "TARGETED_OVERLAY_BASELINE_EVIDENCE_INVALID",
      fsImpl,
      root
    ),
    targets: privateJson(
      files.targets,
      "TARGETED_OVERLAY_BASELINE_TARGETS_INVALID",
      fsImpl,
      root
    ),
    rows: privateJson(
      files.rows,
      "TARGETED_OVERLAY_BASELINE_ROWS_INVALID",
      fsImpl,
      root
    ),
    requestedFields: privateJson(
      files.requested,
      "TARGETED_OVERLAY_BASELINE_REQUESTED_INVALID",
      fsImpl,
      root
    ),
    report: privateJson(
      files.baselineResultReport,
      "TARGETED_OVERLAY_BASELINE_REPORT_INVALID",
      fsImpl,
      root
    ),
  };
}

function readTargetArtifacts(files, fsImpl, root) {
  return {
    worksheet: privateJson(
      files.worksheet,
      "TARGETED_OVERLAY_TARGET_WORKSHEET_INVALID",
      fsImpl,
      root
    ),
    materializedEvidence: privateJson(
      files.evidence,
      "TARGETED_OVERLAY_TARGET_EVIDENCE_INVALID",
      fsImpl,
      root
    ),
    targets: privateJson(
      files.targets,
      "TARGETED_OVERLAY_TARGET_TARGETS_INVALID",
      fsImpl,
      root
    ),
    triage: privateJson(
      files.triage,
      "TARGETED_OVERLAY_TARGET_TRIAGE_INVALID",
      fsImpl,
      root
    ),
    rows: privateJson(
      files.rows,
      "TARGETED_OVERLAY_TARGET_ROWS_INVALID",
      fsImpl,
      root
    ),
    requestedFields: privateJson(
      files.requested,
      "TARGETED_OVERLAY_TARGET_REQUESTED_INVALID",
      fsImpl,
      root
    ),
    report: privateJson(
      files.resultReport,
      "TARGETED_OVERLAY_TARGET_REPORT_INVALID",
      fsImpl,
      root
    ),
    effectsReport: privateJson(
      files.effectsReport,
      "TARGETED_OVERLAY_TARGET_EFFECTS_REPORT_INVALID",
      fsImpl,
      root
    ),
  };
}

function safeServerTargetRefresh({
  persistedTargets,
  rebuiltTargets,
  judgements,
}) {
  if (
    !Array.isArray(persistedTargets) ||
    !Array.isArray(rebuiltTargets) ||
    !Array.isArray(judgements) ||
    persistedTargets.length !== rebuiltTargets.length
  )
    throw overlayCliError("TARGETED_OVERLAY_SERVER_TARGET_REFRESH_INVALID");
  const persistedByKey = new Map(
    persistedTargets.map((target) => [
      `${target?.requirementId || ""}\u0000${target?.componentId || ""}`,
      target,
    ])
  );
  const judgementByKey = new Map(
    judgements.map((judgement) => [
      `${judgement?.requirementId || ""}\u0000${judgement?.componentId || ""}`,
      judgement,
    ])
  );
  if (
    persistedByKey.size !== persistedTargets.length ||
    judgementByKey.size !== judgements.length
  )
    throw overlayCliError("TARGETED_OVERLAY_SERVER_TARGET_REFRESH_DUPLICATE");

  const refreshedKeys = [];
  for (const rebuilt of rebuiltTargets) {
    const key = `${rebuilt?.requirementId || ""}\u0000${rebuilt?.componentId || ""}`;
    const persisted = persistedByKey.get(key);
    const judgement = judgementByKey.get(key);
    if (!persisted || !judgement)
      throw overlayCliError(
        "TARGETED_OVERLAY_SERVER_TARGET_REFRESH_IDENTITY",
        key
      );
    if (JSON.stringify(persisted) === JSON.stringify(rebuilt)) continue;

    const { serverRejectedCandidates: persistedRejections, ...persistedCore } =
      persisted;
    const { serverRejectedCandidates: rebuiltRejections, ...rebuiltCore } =
      rebuilt;
    if (
      JSON.stringify(persistedCore) !== JSON.stringify(rebuiltCore) ||
      !Array.isArray(persistedRejections) ||
      !Array.isArray(rebuiltRejections) ||
      persistedRejections.length !== rebuiltRejections.length ||
      judgement.decisionOwner !== "SERVER" ||
      judgement.evidencePresence !== "NOT_FOUND" ||
      judgement.coverageEffect !== "UNKNOWN" ||
      judgement.conflictState !== "NONE" ||
      judgement.selectedCandidateIds?.length !== 0 ||
      judgement.unresolvedCandidateIds?.length !== 0
    )
      throw overlayCliError(
        "TARGETED_OVERLAY_SERVER_TARGET_REFRESH_UNSAFE",
        key
      );

    for (let index = 0; index < persistedRejections.length; index += 1) {
      const oldRejection = persistedRejections[index];
      const newRejection = rebuiltRejections[index];
      const {
        terminalRejectionContractId,
        occurrenceDigestContractId,
        decisionOwner,
        decisionBasis,
        physicalPageNumber,
        sectionScopeSource,
        observedScopeKeys,
        scopeProofMode,
        occurrenceDigestSha256,
        ...newOriginalFields
      } = newRejection;
      if (
        JSON.stringify(oldRejection) !== JSON.stringify(newOriginalFields) ||
        terminalRejectionContractId !==
          "DETERMINISTIC_OTHER_CATEGORY_TERMINAL_V1" ||
        occurrenceDigestContractId !==
          TERMINAL_OCCURRENCE_DIGEST_CONTRACT_ID ||
        decisionOwner !== "SERVER" ||
        decisionBasis !== "EXPLICIT_OTHER_CATEGORY_SECTION" ||
        !Number.isInteger(physicalPageNumber) ||
        physicalPageNumber < 1 ||
        sectionScopeSource !== "CURRENT_PAGE_HEADING" ||
        !Array.isArray(observedScopeKeys) ||
        observedScopeKeys.length !== 1 ||
        !String(observedScopeKeys[0] || "").endsWith("_INSURANCE") ||
        (scopeProofMode !== undefined &&
          scopeProofMode !==
            "CURRENT_SECTION_PLUS_LOCAL_FOREIGN_COVERAGE_V1") ||
        !/^[a-f0-9]{64}$/u.test(String(occurrenceDigestSha256 || ""))
      )
        throw overlayCliError(
          "TARGETED_OVERLAY_SERVER_TARGET_REFRESH_PROVENANCE",
          key
        );
    }
    refreshedKeys.push(key.replace("\u0000", ":"));
  }
  if (persistedByKey.size !== rebuiltTargets.length)
    throw overlayCliError("TARGETED_OVERLAY_SERVER_TARGET_REFRESH_SET");
  return {
    targets: rebuiltTargets,
    refreshedKeys: refreshedKeys.sort(),
    persistedTargetsSha256: selectionDigest(persistedTargets),
    refreshedTargetsSha256: selectionDigest(rebuiltTargets),
  };
}

function validateTargetPair({
  artifacts,
  files,
  pairSummary,
  manifest,
  document,
  categoryTarget,
  buildTargetsFn,
  fsImpl,
  targetRoot,
}) {
  const report = artifacts.report;
  const effectsReport = artifacts.effectsReport;
  const worksheetSha256 = sha256(
    privateBytes(
      files.worksheet,
      "TARGETED_OVERLAY_TARGET_WORKSHEET_INVALID",
      fsImpl,
      targetRoot
    )
  );
  const triageSha256 = sha256(
    privateBytes(
      files.triage,
      "TARGETED_OVERLAY_TARGET_TRIAGE_INVALID",
      fsImpl,
      targetRoot
    )
  );
  const evidenceSha256 = sha256(
    privateBytes(
      files.evidence,
      "TARGETED_OVERLAY_TARGET_EVIDENCE_INVALID",
      fsImpl,
      targetRoot
    )
  );
  const rebuiltTargets = buildTargetsFn({
    worksheet: artifacts.worksheet,
    documentStatus: document.documentStatus,
    candidateTriage: artifacts.triage,
    expectedTargetSelectionDigestSha256:
      categoryTarget.expectedTargetSelectionDigestSha256,
  });
  const targetRefresh = safeServerTargetRefresh({
    persistedTargets: artifacts.targets,
    rebuiltTargets,
    judgements: artifacts.materializedEvidence?.judgements,
  });
  if (
    pairSummary?.documentUuid !== document.uuid ||
    pairSummary?.categoryView !== categoryTarget.categoryView ||
    pairSummary.result?.reportSha256 !==
      sha256(
        privateBytes(
          files.resultReport,
          "TARGETED_OVERLAY_TARGET_REPORT_INVALID",
          fsImpl,
          targetRoot
        )
      ) ||
    pairSummary.effects?.reportSha256 !==
      sha256(
        privateBytes(
          files.effectsReport,
          "TARGETED_OVERLAY_TARGET_EFFECTS_REPORT_INVALID",
          fsImpl,
          targetRoot
        )
      ) ||
    report.contractId !== "TARGETED_QA_CATEGORY_RESULT_V1" ||
    report.runKind !== "TARGETED_QA_ONLY" ||
    report.customerMaterializationAllowed !== false ||
    report.publishable !== false ||
    report.deployable !== false ||
    report.manifestDigestSha256 !== manifest.manifestDigestSha256 ||
    report.document?.uuid !== document.uuid ||
    report.document?.sha256 !== document.sha256 ||
    report.categoryView !== categoryTarget.categoryView ||
    JSON.stringify(report.requirementIds) !==
      JSON.stringify(categoryTarget.requirementIds) ||
    report.rowCount !== categoryTarget.requirementIds.length ||
    report.outputSemanticDigests?.rowsSha256 !==
      selectionDigest(artifacts.rows) ||
    report.outputSemanticDigests?.requestedFieldsSha256 !==
      selectionDigest(artifacts.requestedFields) ||
    report.inputArtifactHashes?.worksheetSha256 !== worksheetSha256 ||
    report.inputArtifactHashes?.materializedTriageSha256 !== triageSha256 ||
    report.inputArtifactHashes?.materializedEvidenceSha256 !== evidenceSha256 ||
    effectsReport.contracts?.worksheetSha256 !== worksheetSha256 ||
    effectsReport.contracts?.triageSha256 !== triageSha256 ||
    effectsReport.contracts?.materializedEvidenceSha256 !== evidenceSha256 ||
    effectsReport.contracts?.expectedTargetSelectionDigestSha256 !==
      categoryTarget.expectedTargetSelectionDigestSha256 ||
    effectsReport.contracts?.targetSelectionDigestSha256 !==
      categoryTarget.expectedTargetSelectionDigestSha256
  )
    throw overlayCliError(
      "TARGETED_OVERLAY_TARGET_PAIR_CONTRACT_MISMATCH",
      `${document.uuid}:${categoryTarget.categoryView}`
    );
  return targetRefresh;
}

function categoryQaReport({
  manifest,
  document,
  categoryTarget,
  overlay,
  hashes,
}) {
  return {
    schemaVersion: 1,
    contractId: OVERLAY_REPORT_CONTRACT_ID,
    runKind: "TARGETED_QA_OVERLAY_ONLY",
    status: "TECHNICAL_PASS_REVIEW_REQUIRED",
    customerMaterializationAllowed: false,
    publishable: false,
    deployable: false,
    manifestDigestSha256: manifest.manifestDigestSha256,
    baselineRunSignature: manifest.trustAnchor.baselineRunSignature,
    targetExecution: manifest.execution,
    document: {
      uuid: document.uuid,
      sha256: document.sha256,
      documentStatus: document.documentStatus,
    },
    categoryView: categoryTarget.categoryView,
    targetRequirementIds: categoryTarget.requirementIds,
    rowCount: overlay.rows.length,
    expectedRowCount:
      manifest.baseline.packageContract.productProfile.categoryRowCounts[
        categoryTarget.categoryView
      ],
    hashes,
    gates: {
      manifestContract: true,
      baselineArtifactIdentity: true,
      baselineWorksheetRebuild: true,
      targetArtifactIdentity: true,
      overlayContract: true,
      fullRowCount: true,
      nonTargetArtifactIdentity: true,
    },
    qualityGate: {
      pass: false,
      status: "REVIEW_REQUIRED",
      reason: "TARGETED_QA_OVERLAY_ONLY",
    },
  };
}

function run(
  args,
  {
    fsImpl = fs,
    repositoryRoot = REPOSITORY_ROOT,
    assertManifestFn = assertTargetedQaManifest,
    assertBaselineWorksheetRebuildFn = assertBaselineWorksheetRebuild,
    overlayFn = materializeTargetedQaCategoryOverlay,
    buildTargetsFn = buildPreparedEvidenceTargets,
    buildComparisonFn = buildComparisonResult,
    releaseIdentityFn = releaseIdentity,
  } = {}
) {
  const repository = realDirectory(
    repositoryRoot,
    "TARGETED_OVERLAY_REPOSITORY_INVALID",
    fsImpl
  );
  const baseline = realDirectory(
    args.baselineRoot,
    "TARGETED_OVERLAY_BASELINE_INVALID",
    fsImpl
  );
  const targetRoot = realDirectory(
    args.targetRoot,
    "TARGETED_OVERLAY_TARGET_ROOT_INVALID",
    fsImpl
  );
  const outputParent = realDirectory(
    path.dirname(args.output),
    "TARGETED_OVERLAY_OUTPUT_PARENT_INVALID",
    fsImpl
  );
  const output = path.join(outputParent, path.basename(args.output));
  if (
    fsImpl.existsSync(output) ||
    isWithin(repository, output) ||
    isWithin(baseline, output) ||
    isWithin(targetRoot, output)
  )
    throw overlayCliError("TARGETED_OVERLAY_OUTPUT_SCOPE_INVALID", output);

  const manifestBytes = privateBytes(
    args.manifest,
    "TARGETED_OVERLAY_MANIFEST_INVALID",
    fsImpl
  );
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  assertManifestFn(manifest, {
    expectedManifestDigestSha256: args.expectedManifestDigest,
    expectedExecution: manifest.execution,
  });
  if (
    manifest.documentMatrix.documents.length !== EXPECTED_DOCUMENT_COUNT ||
    manifest.categoryTargets.length !== CATEGORY_ORDER.length ||
    manifest.categoryTargets.reduce(
      (sum, target) => sum + target.requirementIds.length,
      0
    ) !== EXPECTED_TARGET_COUNT
  )
    throw overlayCliError("TARGETED_OVERLAY_MANIFEST_MATRIX_INVALID");

  const baselinePackageFile = path.join(
    baseline,
    "PACKAGE-COMPARISON",
    "package-contract.private.json"
  );
  const baselineComparisonFile = path.join(
    baseline,
    "PACKAGE-COMPARISON",
    "comparison.private.json"
  );
  const baselinePackageBytes = privateBytes(
    baselinePackageFile,
    "TARGETED_OVERLAY_BASELINE_PACKAGE_INVALID",
    fsImpl,
    baseline
  );
  const baselineComparisonBytes = privateBytes(
    baselineComparisonFile,
    "TARGETED_OVERLAY_BASELINE_COMPARISON_INVALID",
    fsImpl,
    baseline
  );
  if (
    sha256(baselinePackageBytes) !==
      manifest.trustAnchor.packageContractFileSha256 ||
    sha256(baselineComparisonBytes) !==
      manifest.trustAnchor.baselineComparisonFileSha256
  )
    throw overlayCliError("TARGETED_OVERLAY_BASELINE_TRUST_ANCHOR_MISMATCH");
  assertExact(
    JSON.parse(baselinePackageBytes.toString("utf8")),
    manifest.baseline.packageContract,
    "TARGETED_OVERLAY_BASELINE_PACKAGE_MISMATCH"
  );
  const baselineComparison = JSON.parse(
    baselineComparisonBytes.toString("utf8")
  );
  const baselineComparisonByKey = comparisonRows(baselineComparison);
  if (baselineComparisonByKey.size !== EXPECTED_ROW_COUNT)
    throw overlayCliError("TARGETED_OVERLAY_BASELINE_ROW_COUNT_INVALID");

  const runSummaryFile = path.join(targetRoot, "run-summary.private.json");
  const runSummaryBytes = privateBytes(
    runSummaryFile,
    "TARGETED_OVERLAY_RUN_SUMMARY_INVALID",
    fsImpl,
    targetRoot
  );
  const runSummary = JSON.parse(runSummaryBytes.toString("utf8"));
  if (
    runSummary.contractId !== "TARGETED_QA_ALL_50_RUN_V1" ||
    runSummary.runKind !== "TARGETED_QA_ONLY" ||
    runSummary.customerMaterializationAllowed !== false ||
    runSummary.publishable !== false ||
    runSummary.deployable !== false ||
    runSummary.manifestDigestSha256 !== manifest.manifestDigestSha256 ||
    runSummary.manifestFileSha256 !== sha256(manifestBytes) ||
    JSON.stringify(runSummary.execution) !==
      JSON.stringify(manifest.execution) ||
    runSummary.pairCount !== EXPECTED_PAIR_COUNT ||
    !Array.isArray(runSummary.pairs) ||
    runSummary.pairs.length !== EXPECTED_PAIR_COUNT
  )
    throw overlayCliError("TARGETED_OVERLAY_RUN_SUMMARY_MISMATCH");

  const staging = path.join(
    outputParent,
    `.${path.basename(output)}.staging-${process.pid}-${crypto.randomBytes(10).toString("hex")}`
  );
  mkdirPrivate(staging, fsImpl);
  const sources = fixedSourcePaths(repository);
  const pairGuards = [];
  const documentRuns = [];
  let nonTargetDocumentRowInstances = 0;
  try {
    for (const [
      documentIndex,
      document,
    ] of manifest.documentMatrix.documents.entries()) {
      const documentDirectory = documentDirectoryName(document, documentIndex);
      const baselineDocumentDirectory = path.join(baseline, documentDirectory);
      const targetDocumentDirectory = path.join(targetRoot, documentDirectory);
      realDirectory(
        baselineDocumentDirectory,
        "TARGETED_OVERLAY_BASELINE_DOCUMENT_INVALID",
        fsImpl
      );
      realDirectory(
        targetDocumentDirectory,
        "TARGETED_OVERLAY_TARGET_DOCUMENT_INVALID",
        fsImpl
      );
      const overlayDocumentDirectory = path.join(staging, documentDirectory);
      mkdirPrivate(overlayDocumentDirectory, fsImpl);
      const documentArtifactFile = path.join(
        baselineDocumentDirectory,
        "document.private.json"
      );
      const documentArtifactBytes = privateBytes(
        documentArtifactFile,
        "TARGETED_OVERLAY_DOCUMENT_ARTIFACT_INVALID",
        fsImpl,
        baselineDocumentDirectory
      );
      if (sha256(documentArtifactBytes) !== document.documentArtifactSha256)
        throw overlayCliError(
          "TARGETED_OVERLAY_DOCUMENT_ARTIFACT_SHA_MISMATCH",
          document.uuid
        );
      writePrivateBytes(
        path.join(overlayDocumentDirectory, "document.private.json"),
        documentArtifactBytes,
        fsImpl
      );

      for (const categoryView of CATEGORY_ORDER) {
        const categoryTarget = manifest.categoryTargets.find(
          (target) => target.categoryView === categoryView
        );
        const baselineFiles = categoryFiles(
          baseline,
          documentDirectory,
          categoryView
        );
        const targetFiles = categoryFiles(
          targetRoot,
          documentDirectory,
          categoryView
        );
        const baselineArtifacts = readBaselineArtifacts(
          baselineFiles,
          fsImpl,
          baseline
        );
        const targetArtifacts = readTargetArtifacts(
          targetFiles,
          fsImpl,
          targetRoot
        );
        const pairSummary = runSummary.pairs.find(
          (pair) =>
            pair.documentUuid === document.uuid &&
            pair.categoryView === categoryView
        );
        if (!pairSummary)
          throw overlayCliError(
            "TARGETED_OVERLAY_PAIR_SUMMARY_MISSING",
            `${document.uuid}:${categoryView}`
          );
        const targetRefresh = validateTargetPair({
          artifacts: targetArtifacts,
          files: targetFiles,
          pairSummary,
          manifest,
          document,
          categoryTarget,
          buildTargetsFn,
          fsImpl,
          targetRoot,
        });
        targetArtifacts.targets = targetRefresh.targets;
        const worksheetRebuild = assertBaselineWorksheetRebuildFn({
          manifest,
          expectedManifestDigestSha256: manifest.manifestDigestSha256,
          expectedExecution: manifest.execution,
          categoryView,
          documentUuid: document.uuid,
          catalogBytes: privateBytes(
            sources.catalogs[categoryView],
            "TARGETED_OVERLAY_CATALOG_INVALID",
            fsImpl,
            repository
          ),
          documentArtifactBytes,
          fullWorksheetBytes: privateBytes(
            baselineFiles.worksheet,
            "TARGETED_OVERLAY_BASELINE_WORKSHEET_INVALID",
            fsImpl,
            baseline
          ),
        });
        const overlay = overlayFn({
          categoryView,
          targetRequirementIds: categoryTarget.requirementIds,
          document,
          baseline: baselineArtifacts,
          targeted: targetArtifacts,
        });
        const expectedCategoryRows =
          manifest.baseline.packageContract.productProfile.categoryRowCounts[
            categoryView
          ];
        if (overlay.rows.length !== expectedCategoryRows)
          throw overlayCliError(
            "TARGETED_OVERLAY_CATEGORY_ROW_COUNT_INVALID",
            `${document.uuid}:${categoryView}`
          );
        const targetSet = new Set(categoryTarget.requirementIds);
        const beforeNonTarget = nonTargetProjection(
          baselineArtifacts,
          targetSet
        );
        const afterNonTarget = nonTargetProjection(overlay, targetSet);
        assertExact(
          afterNonTarget,
          beforeNonTarget,
          "TARGETED_OVERLAY_NON_TARGET_ARTIFACT_DRIFT",
          `${document.uuid}:${categoryView}`
        );
        nonTargetDocumentRowInstances += beforeNonTarget.rows.length;

        const overlayCategoryDirectory = path.join(
          overlayDocumentDirectory,
          categoryView
        );
        const overlayEffectsDirectory = path.join(
          overlayCategoryDirectory,
          "effects"
        );
        const overlayResultDirectory = path.join(
          overlayCategoryDirectory,
          "result"
        );
        mkdirPrivate(overlayCategoryDirectory, fsImpl);
        mkdirPrivate(overlayEffectsDirectory, fsImpl);
        mkdirPrivate(overlayResultDirectory, fsImpl);
        writePrivate(
          path.join(overlayCategoryDirectory, "worksheet.private.json"),
          overlay.worksheet,
          fsImpl
        );
        writePrivate(
          path.join(overlayEffectsDirectory, "materialized.private.json"),
          overlay.materializedEvidence,
          fsImpl
        );
        writePrivate(
          path.join(overlayEffectsDirectory, "targets.private.json"),
          overlay.targets,
          fsImpl
        );
        writePrivate(
          path.join(overlayResultDirectory, "rows.private.json"),
          overlay.rows,
          fsImpl
        );
        writePrivate(
          path.join(overlayResultDirectory, "requested-fields.private.json"),
          overlay.requestedFields,
          fsImpl
        );
        const hashes = {
          baselineWorksheetSha256: worksheetRebuild.fullWorksheetSha256,
          targetWorksheetSha256: sha256(
            privateBytes(
              targetFiles.worksheet,
              "TARGETED_OVERLAY_TARGET_WORKSHEET_INVALID",
              fsImpl,
              targetRoot
            )
          ),
          worksheetSemanticSha256: selectionDigest(overlay.worksheet),
          evidenceSemanticSha256: selectionDigest(overlay.materializedEvidence),
          targetsSemanticSha256: selectionDigest(overlay.targets),
          requestedFieldsSemanticSha256: selectionDigest(
            overlay.requestedFields
          ),
          rowsSemanticSha256: selectionDigest(overlay.rows),
          nonTargetProjectionSha256: selectionDigest(afterNonTarget),
        };
        const report = categoryQaReport({
          manifest,
          document,
          categoryTarget,
          overlay,
          hashes,
        });
        writePrivate(
          path.join(overlayResultDirectory, "report.json"),
          report,
          fsImpl
        );
        pairGuards.push({
          documentUuid: document.uuid,
          categoryView,
          targetRequirementCount: categoryTarget.requirementIds.length,
          nonTargetRequirementCount: beforeNonTarget.rows.length,
          gates: {
            baselineWorksheetRebuild: true,
            targetContract: true,
            nonTargetArtifactIdentity: true,
          },
          serverTargetRefresh: {
            refreshedKeys: targetRefresh.refreshedKeys,
            persistedTargetsSha256: targetRefresh.persistedTargetsSha256,
            refreshedTargetsSha256: targetRefresh.refreshedTargetsSha256,
          },
          hashes,
        });
      }
      documentRuns.push({
        document,
        outputDirectory: overlayDocumentDirectory,
      });
    }
    if (
      pairGuards.length !== EXPECTED_PAIR_COUNT ||
      nonTargetDocumentRowInstances !==
        EXPECTED_NON_TARGET_COUNT * EXPECTED_DOCUMENT_COUNT
    )
      throw overlayCliError("TARGETED_OVERLAY_INSTANCE_COUNT_INVALID");

    const comparison = buildComparisonFn(documentRuns, {
      runKind: "TARGETED_QA_OVERLAY_ONLY",
      sourceReleaseId: manifest.execution.releaseId,
      overlayReleaseId: releaseIdentityFn(repository),
      baselineRunSignature: manifest.trustAnchor.baselineRunSignature,
      manifestDigestSha256: manifest.manifestDigestSha256,
      customerMaterializationAllowed: false,
      publishable: false,
      deployable: false,
    });
    const comparisonByKey = comparisonRows(comparison);
    if (comparisonByKey.size !== EXPECTED_ROW_COUNT)
      throw overlayCliError("TARGETED_OVERLAY_COMPARISON_ROW_COUNT_INVALID");
    const reviewKeys = new Set(
      manifest.baseline.comparisonProjection.totals.reviewRowKeys
    );
    const changedNonTargetRows = [];
    const targetDeltas = [];
    for (const [key, baselineRow] of baselineComparisonByKey) {
      const overlayRow = comparisonByKey.get(key);
      if (!overlayRow)
        throw overlayCliError("TARGETED_OVERLAY_COMPARISON_ROW_MISSING", key);
      if (reviewKeys.has(key)) {
        targetDeltas.push({
          rowKey: key,
          changed: JSON.stringify(overlayRow) !== JSON.stringify(baselineRow),
          baselineSha256: selectionDigest(baselineRow),
          overlaySha256: selectionDigest(overlayRow),
          baselineOutcome: baselineRow.pointDecision?.outcome || null,
          overlayOutcome: overlayRow.pointDecision?.outcome || null,
        });
      } else if (JSON.stringify(overlayRow) !== JSON.stringify(baselineRow)) {
        changedNonTargetRows.push(key);
      }
    }
    if (
      reviewKeys.size !== EXPECTED_TARGET_COUNT ||
      targetDeltas.length !== EXPECTED_TARGET_COUNT ||
      changedNonTargetRows.length !== 0
    )
      throw overlayCliError(
        "TARGETED_OVERLAY_FINAL_NON_TARGET_DRIFT",
        changedNonTargetRows.join(",")
      );

    const packageDirectory = path.join(staging, "PACKAGE-COMPARISON");
    mkdirPrivate(packageDirectory, fsImpl);
    const comparisonFile = path.join(
      packageDirectory,
      "comparison.private.json"
    );
    writePrivate(comparisonFile, comparison, fsImpl);
    const guard = {
      schemaVersion: 1,
      contractId: OVERLAY_GUARD_CONTRACT_ID,
      runKind: "TARGETED_QA_OVERLAY_ONLY",
      status: "TECHNICAL_PASS_REVIEW_REQUIRED",
      customerMaterializationAllowed: false,
      publishable: false,
      deployable: false,
      releaseId: releaseIdentityFn(repository),
      sources: {
        manifestDigestSha256: manifest.manifestDigestSha256,
        manifestFileSha256: sha256(manifestBytes),
        baselinePackageSha256: sha256(baselinePackageBytes),
        baselineComparisonSha256: sha256(baselineComparisonBytes),
        targetRunSummarySha256: sha256(runSummaryBytes),
      },
      counts: {
        documents: EXPECTED_DOCUMENT_COUNT,
        categories: CATEGORY_ORDER.length,
        pairs: pairGuards.length,
        rows: EXPECTED_ROW_COUNT,
        targetRequirements: EXPECTED_TARGET_COUNT,
        nonTargetRequirements: EXPECTED_NON_TARGET_COUNT,
        targetDocumentRowInstances:
          EXPECTED_TARGET_COUNT * EXPECTED_DOCUMENT_COUNT,
        nonTargetDocumentRowInstances,
        identicalNonTargetComparisonRows: EXPECTED_NON_TARGET_COUNT,
      },
      gates: {
        manifestAndSourceHashes: true,
        allPairsMaterialized: true,
        perDocumentNonTargetArtifactsIdentical: true,
        finalNonTargetComparisonRowsIdentical: true,
        privateQaOnlyOutput: true,
      },
      pairGuards,
      baselineTotals: baselineComparison.totals,
      overlayTotals: comparison.totals,
      targetDeltas,
      changedNonTargetRows,
      comparisonSha256: sha256(
        Buffer.from(JSON.stringify(comparison, null, 2))
      ),
      proofLimit:
        "QA-only overlay. It proves exact preservation of the 155 non-target comparison rows for this bound 10-document run; it does not prove arbitrary-policy correctness or authorize customer output.",
    };
    writePrivate(
      path.join(packageDirectory, "overlay-guard.private.json"),
      guard,
      fsImpl
    );
    fsImpl.renameSync(staging, output);
    return { output, comparison, guard };
  } catch (error) {
    if (fsImpl.existsSync(staging))
      fsImpl.rmSync(staging, { recursive: true, force: true });
    throw error;
  }
}

function main(argv = process.argv.slice(2)) {
  return run(parseArguments(argv));
}

if (require.main === module) {
  try {
    const result = main();
    console.log(
      `[targeted-qa-overlay] COMPLETE: ${result.guard.counts.pairs} Paare, ${result.guard.counts.identicalNonTargetComparisonRows} unveraenderte Nicht-Zielzeilen in ${result.output}`
    );
  } catch (error) {
    console.error(`[targeted-qa-overlay] ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  EXPECTED_PAIR_COUNT,
  OVERLAY_GUARD_CONTRACT_ID,
  OVERLAY_REPORT_CONTRACT_ID,
  main,
  parseArguments,
  run,
  safeServerTargetRefresh,
};

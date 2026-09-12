#!/usr/bin/env node
process.umask(0o077);

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  stableStringify,
} = require("../../utils/policyAnalysis/aDrivenSourceUnitPlan");
const {
  CURRENT_V12_REVIEW_PROFILE,
  createClassificationEvidence,
  createCrosswalkDraft,
  createDynamicRemainderDraft,
  createDynamicRemainderReviewerTemplate,
  createReviewBasis,
  createReviewerRegistry,
  createReviewerTemplate,
  createRunProvenance,
  reconcileApprovedCrosswalk,
  reconcileDynamicRemainderReview,
  sealReviewerArtifact,
  sealDynamicRemainderReviewerArtifact,
  validateClassificationChain,
  validateCrosswalkDraft,
  validateDynamicRemainderDraft,
  validateDynamicRemainderReconciliation,
  validateDynamicRemainderReviewerArtifact,
  validateApprovedCrosswalk,
  validateReviewBasis,
  validateReviewerArtifact,
  validateReviewerRegistry,
  reviewCampaignProfile,
} = require("../../utils/policyAnalysis/aDrivenLegacyDoubleReview");

const BASIS_FILE = "review-basis.private.json";
const DRAFT_FILE = "crosswalk-draft.private.json";
const REGISTRY_FILE = "reviewer-registry.private.json";
const APPROVED_CROSSWALK_FILE = "approved-crosswalk.private.json";
const DYNAMIC_REMAINDER_DRAFT_FILE = "dynamic-remainder-draft.private.json";
const DYNAMIC_REMAINDER_RECONCILIATION_FILE =
  "dynamic-remainder-reconciliation.private.json";
const FREEZE_ARTIFACT_SET_FILE = "freeze-artifact-set.private.json";
const FREEZE_ARTIFACT_SET_CONTRACT_ID = "LF_A_REVIEW_FREEZE_ARTIFACT_SET_V1";

function fail(code, detail) {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  throw error;
}

function digest(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function assertNoPrivateKeyMaterial(value, source = "generated-artifact") {
  const text = Buffer.isBuffer(value) ? value.toString("utf8") : String(value);
  if (/-----BEGIN [^-\r\n]*PRIVATE KEY-----/u.test(text))
    fail("LF_A_DOUBLE_REVIEW_PRIVATE_KEY_MATERIAL_FORBIDDEN", source);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const values = {};
  for (let index = 0; index < rest.length; index += 2) {
    if (!rest[index]?.startsWith("--") || rest[index + 1] === undefined)
      fail("LF_A_DOUBLE_REVIEW_CLI_ARGUMENT_INVALID");
    const name = rest[index].slice(2);
    if (Object.hasOwn(values, name))
      fail("LF_A_DOUBLE_REVIEW_CLI_ARGUMENT_DUPLICATE", name);
    values[name] = rest[index + 1];
  }
  return { command, values };
}

function assertRegularSingleLink(filePath) {
  const linkStat = fs.lstatSync(filePath);
  const stat = fs.statSync(filePath);
  if (linkStat.isSymbolicLink() || !stat.isFile() || stat.nlink !== 1)
    fail("LF_A_DOUBLE_REVIEW_SOURCE_NOT_REGULAR_SINGLE_LINK", filePath);
  return stat;
}

function readRegular(filePath) {
  const raw = readRawRegular(filePath);
  let value;
  try {
    value = JSON.parse(raw.toString("utf8"));
  } catch {
    fail("LF_A_DOUBLE_REVIEW_SOURCE_JSON_INVALID", filePath);
  }
  return { raw, value, fileSha256: digest(raw) };
}

function readRawRegular(filePath) {
  assertRegularSingleLink(filePath);
  return fs.readFileSync(filePath);
}

function resolveInside(root, relativePath) {
  const absoluteRoot = fs.realpathSync(root);
  const absolute = path.resolve(absoluteRoot, relativePath);
  if (!absolute.startsWith(`${absoluteRoot}${path.sep}`))
    fail("LF_A_DOUBLE_REVIEW_SOURCE_OUTSIDE_RUN_ROOT", relativePath);
  return absolute;
}

function copyRegularVerified(source, destination) {
  const sourceStat = assertRegularSingleLink(source);
  const sourceBytes = fs.readFileSync(source);
  assertNoPrivateKeyMaterial(sourceBytes, source);
  const sourceHash = digest(sourceBytes);
  fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);
  fs.chmodSync(destination, 0o400);
  const destinationStat = assertRegularSingleLink(destination);
  const destinationHash = digest(fs.readFileSync(destination));
  if (sourceStat.ino === destinationStat.ino || sourceHash !== destinationHash)
    fail("LF_A_DOUBLE_REVIEW_COPY_VERIFICATION_FAILED", source);
  return sourceHash;
}

function intrinsicSha(value) {
  for (const field of [
    "planSha256",
    "manifestSha256",
    "batchPlanSha256",
    "responsesSha256",
    "summarySha256",
    "ledgerSha256",
    "auditSha256",
  ])
    if (/^[a-f0-9]{64}$/u.test(String(value?.[field] || "")))
      return value[field];
  return null;
}

function batchStatus(value) {
  if (value?.validation?.passed === true) return "PASS";
  return value?.status || value?.validation?.status || value?.summary?.status;
}

function batchExpectedUnits(value) {
  const ids =
    value?.expectedUnitIds ||
    value?.batch?.expectedUnitIds ||
    value?.request?.expectedUnitIds;
  return Array.isArray(ids)
    ? ids.length
    : value?.summary?.expectedUnits || value?.expectedUnits;
}

function writeJsonPrivate(filePath, value) {
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  assertNoPrivateKeyMaterial(serialized, filePath);
  fs.writeFileSync(filePath, serialized, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o400,
  });
}

function freezeArtifactSetDigest(payload) {
  return digest(
    Buffer.from(
      `${FREEZE_ARTIFACT_SET_CONTRACT_ID}\u0000${stableStringify(payload)}`,
      "utf8"
    )
  );
}

function requiredFreezeArtifactPaths(basis) {
  return new Set([BASIS_FILE, ...expectedFreezeArtifactBindings(basis).keys()]);
}

function expectedFreezeArtifactBindings(basis) {
  const bindings = new Map([
    [
      "inputs/dynamicManifest.json",
      basis.sourceBindings.dynamicManifestFileSha256,
    ],
    [
      "inputs/legacy-manifest.json",
      basis.sourceBindings.legacyManifestFileSha256,
    ],
  ]);
  for (const { relativePath, fileSha256 } of [
    ...Object.values(basis.classificationEvidence.artifacts),
    ...basis.classificationEvidence.batchResults,
    ...Object.values(basis.runProvenance.sourceArtifacts),
  ]) {
    if (bindings.has(relativePath) && bindings.get(relativePath) !== fileSha256)
      fail("LF_A_DOUBLE_REVIEW_FREEZE_BINDING_CONFLICT", relativePath);
    bindings.set(relativePath, fileSha256);
  }
  return bindings;
}

function freezeArtifactFiles(root) {
  const files = [];
  function visit(directory) {
    for (const entry of fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))) {
      const absolute = path.join(directory, entry.name);
      const relativePath = path.relative(root, absolute);
      if (relativePath === FREEZE_ARTIFACT_SET_FILE) continue;
      if (entry.isDirectory()) visit(absolute);
      else {
        const raw = readRawRegular(absolute);
        assertNoPrivateKeyMaterial(raw, absolute);
        files.push({ relativePath, fileSha256: digest(raw) });
      }
    }
  }
  visit(root);
  return files;
}

function materializeFreezeArtifactSetIndex({ basisRoot, basis }) {
  const file = path.join(basisRoot, FREEZE_ARTIFACT_SET_FILE);
  if (fs.existsSync(file))
    fail("LF_A_DOUBLE_REVIEW_FREEZE_ARTIFACT_SET_EXISTS", file);
  const files = freezeArtifactFiles(basisRoot);
  const present = new Set(files.map(({ relativePath }) => relativePath));
  if (
    [...requiredFreezeArtifactPaths(basis)].some((item) => !present.has(item))
  )
    fail("LF_A_DOUBLE_REVIEW_FREEZE_ARTIFACT_SET_INCOMPLETE");
  const payload = {
    schemaVersion: 1,
    contractId: FREEZE_ARTIFACT_SET_CONTRACT_ID,
    basisSha256: basis.basisSha256,
    files,
  };
  const artifactSet = {
    ...payload,
    artifactSetSha256: freezeArtifactSetDigest(payload),
  };
  writeJsonPrivate(file, artifactSet);
  return artifactSet;
}

function validateFreezeArtifactSet({ basisRoot, basis }) {
  const artifactSet = readRegular(
    path.join(basisRoot, FREEZE_ARTIFACT_SET_FILE)
  ).value;
  const { artifactSetSha256, ...payload } = artifactSet;
  if (
    artifactSet.contractId !== FREEZE_ARTIFACT_SET_CONTRACT_ID ||
    artifactSet.basisSha256 !== basis.basisSha256 ||
    artifactSetSha256 !== freezeArtifactSetDigest(payload) ||
    !Array.isArray(artifactSet.files)
  )
    fail("LF_A_DOUBLE_REVIEW_FREEZE_ARTIFACT_SET_INVALID");
  const currentFiles = freezeArtifactFiles(basisRoot);
  if (stableStringify(currentFiles) !== stableStringify(artifactSet.files))
    fail("LF_A_DOUBLE_REVIEW_FREEZE_ARTIFACT_SET_MUTATED");
  const present = new Set(currentFiles.map(({ relativePath }) => relativePath));
  if (
    [...requiredFreezeArtifactPaths(basis)].some((item) => !present.has(item))
  )
    fail("LF_A_DOUBLE_REVIEW_FREEZE_ARTIFACT_SET_INCOMPLETE");
  const currentByPath = new Map(
    currentFiles.map(({ relativePath, fileSha256 }) => [
      relativePath,
      fileSha256,
    ])
  );
  for (const [relativePath, expectedSha256] of expectedFreezeArtifactBindings(
    basis
  ))
    if (currentByPath.get(relativePath) !== expectedSha256)
      fail("LF_A_DOUBLE_REVIEW_FREEZE_SOURCE_BINDING_INVALID", relativePath);
  return artifactSet;
}

function makeTempTarget(target) {
  const parent = path.dirname(target);
  if (fs.existsSync(target)) fail("LF_A_DOUBLE_REVIEW_TARGET_EXISTS", target);
  fs.mkdirSync(parent, { recursive: true });
  return fs.mkdtempSync(path.join(parent, ".lf-a-double-review-"));
}

function lockTree(root) {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  for (const entry of entries) {
    const child = path.join(root, entry.name);
    if (entry.isDirectory()) lockTree(child);
    else fs.chmodSync(child, 0o400);
  }
  fs.chmodSync(root, 0o500);
}

function validateAndDescribeSourceChain({
  sourcePlan,
  dynamicManifest,
  legacyManifest,
  sourceReads,
  sourceRun,
}) {
  const sourcePdfSha256 = digest(sourceReads.sourcePdf.raw);
  const planDocuments = sourcePlan?.documents;
  const planDocument = Array.isArray(planDocuments) ? planDocuments[0] : null;
  const documentArtifact = sourceReads.documentArtifact.value;
  const sourceLedger = sourceReads.sourceLedger.value;
  const runContract = sourceReads.runContract.value;
  const inputManifest = sourceReads.inputManifest.value;
  const correctedAudit = sourceReads.correctedAStatusAudit.value;
  const runADocument = runContract?.documents?.filter(
    ({ side }) => side === "A"
  );
  const inputADocument = inputManifest?.documents?.filter(
    ({ side }) => side === "A"
  );
  const dynamicSpans = dynamicManifest.requirements.flatMap(
    ({ sourceSpans = [] }) => sourceSpans
  );
  if (
    planDocuments?.length !== 1 ||
    !planDocument ||
    planDocument.documentSha256 !== sourcePdfSha256 ||
    documentArtifact?.fingerprint !== sourcePdfSha256 ||
    documentArtifact?.document?.id !== sourcePdfSha256 ||
    sourceLedger?.contractId !== "SOURCE_BLOCK_LEDGER_V1" ||
    sourceLedger.sourceDocument?.fingerprint !== sourcePdfSha256 ||
    sourceLedger.ledgerSha256 !== planDocument.sourceBlockLedgerSha256 ||
    runADocument?.length !== 1 ||
    inputADocument?.length !== 1 ||
    runADocument[0].uuid !== planDocument.documentUuid ||
    inputADocument[0].uuid !== planDocument.documentUuid ||
    runADocument[0].sha256 !== sourcePdfSha256 ||
    inputADocument[0].sha256 !== sourcePdfSha256 ||
    runContract.releaseId !== sourceRun.releaseId ||
    runContract.comparisonMode !== inputManifest.comparisonMode ||
    dynamicSpans.some(
      (span) =>
        span.documentUuid !== planDocument.documentUuid ||
        span.documentSha256 !== sourcePdfSha256
    ) ||
    correctedAudit?.contractId !== "LF_A_DYNAMIC_STATUS_AUDIT_V2" ||
    correctedAudit.dynamicManifestSha256 !== dynamicManifest.manifestSha256 ||
    correctedAudit.legacyManifestSha256 !== legacyManifest.manifestSha256 ||
    correctedAudit.sourceUnitPlanSha256 !== sourcePlan.planSha256 ||
    correctedAudit.summary?.validBatchResults !== 59 ||
    correctedAudit.summary?.legacyRequirements !== 283 ||
    correctedAudit.summary?.legacyComponents !== 631 ||
    correctedAudit.summary?.semanticCrosswalkApproved !== false ||
    correctedAudit.summary?.acceptanceReady !== false
  )
    fail("LF_A_DOUBLE_REVIEW_SOURCE_CHAIN_INVALID");

  const contracts = {
    sourcePdf: "LF_SOURCE_PDF_BYTES_V1",
    documentArtifact: "POLICY_DOCUMENT_ARTIFACT_V1",
    sourceLedger: sourceLedger.contractId,
    runContract: "POLICY_COMPARISON_RUN_CONTRACT_V1",
    inputManifest: "POLICY_COMPARISON_INPUT_MANIFEST_V1",
    correctedAStatusAudit: correctedAudit.contractId,
    integrityLog: "LF_A_V12_INTEGRITY_LOG_V1",
  };
  return Object.fromEntries(
    Object.entries(sourceReads).map(([name, read]) => [
      name,
      {
        relativePath: `inputs/source/${name}${name === "sourcePdf" ? ".pdf" : name === "integrityLog" ? ".log" : ".json"}`,
        fileSha256: digest(read.raw),
        contractId: contracts[name],
        intrinsicSha256: intrinsicSha(read.value),
      },
    ])
  );
}

function materializeFreeze({
  runRoot,
  legacyManifestPath,
  inputMapPath,
  sourcePaths,
  target,
}) {
  if (
    !runRoot ||
    !legacyManifestPath ||
    !inputMapPath ||
    !target ||
    [
      "sourcePdf",
      "documentArtifact",
      "sourceLedger",
      "runContract",
      "inputManifest",
      "correctedAStatusAudit",
      "integrityLog",
    ].some((name) => !sourcePaths?.[name])
  )
    fail("LF_A_DOUBLE_REVIEW_FREEZE_ARGUMENT_REQUIRED");
  const mapRead = readRegular(inputMapPath);
  const map = mapRead.value;
  const campaignProfile = reviewCampaignProfile(
    map.reviewProfileId || CURRENT_V12_REVIEW_PROFILE.profileId
  );
  const required = [
    "dynamicManifest",
    "sourceUnitPlan",
    "classificationBatchPlan",
    "responses",
    "summary",
  ];
  if (
    required.some((name) => typeof map?.files?.[name] !== "string") ||
    (!Array.isArray(map?.files?.batchResults) &&
      typeof map?.files?.batchResultsDirectory !== "string")
  )
    fail("LF_A_DOUBLE_REVIEW_INPUT_MAP_INVALID");

  const sources = Object.fromEntries(
    required.map((name) => [name, resolveInside(runRoot, map.files[name])])
  );
  const reads = Object.fromEntries(
    Object.entries(sources).map(([name, source]) => [name, readRegular(source)])
  );
  const batchResultPaths = Array.isArray(map.files.batchResults)
    ? map.files.batchResults
    : reads.classificationBatchPlan.value.batches.map(
        ({ batchId, batchIndex }) =>
          `${map.files.batchResultsDirectory}/${String(batchIndex).padStart(
            4,
            "0"
          )}-${batchId}.private.json`
      );
  if (batchResultPaths.length !== 59)
    fail("LF_A_DOUBLE_REVIEW_INPUT_MAP_INVALID");
  const uniqueRelative = [
    ...required.map((name) => map.files[name]),
    ...batchResultPaths,
  ];
  if (new Set(uniqueRelative).size !== uniqueRelative.length)
    fail("LF_A_DOUBLE_REVIEW_INPUT_MAP_DUPLICATE");
  if (
    new Set(batchResultPaths.map((value) => path.basename(value))).size !==
    batchResultPaths.length
  )
    fail("LF_A_DOUBLE_REVIEW_BATCH_BASENAME_DUPLICATE");
  const batches = batchResultPaths.map((relativePath) => ({
    relativePath,
    source: resolveInside(runRoot, relativePath),
  }));
  const legacy = readRegular(legacyManifestPath);
  const batchReads = batches.map((entry) => ({
    ...entry,
    ...readRegular(entry.source),
  }));
  const sourceReads = Object.fromEntries(
    Object.entries(sourcePaths).map(([name, source]) => [
      name,
      ["sourcePdf", "integrityLog"].includes(name)
        ? { raw: readRawRegular(source), value: null }
        : readRegular(source),
    ])
  );
  const artifacts = Object.fromEntries(
    ["sourceUnitPlan", "classificationBatchPlan", "responses", "summary"].map(
      (name) => [
        name,
        {
          relativePath: `inputs/${name}.json`,
          fileSha256: reads[name].fileSha256,
          contractId:
            reads[name].value.contractId ||
            (name === "responses" ? "LF_A_V12_RESPONSES_ARRAY_V1" : null),
          intrinsicSha256: intrinsicSha(reads[name].value),
        },
      ]
    )
  );
  const chainValidation = validateClassificationChain({
    sourcePlan: reads.sourceUnitPlan.value,
    batchPlan: reads.classificationBatchPlan.value,
    batchResults: batchReads.map(({ value }) => value),
    responses: reads.responses.value,
    summary: reads.summary.value,
    dynamicManifest: reads.dynamicManifest.value,
    campaignProfile,
  });
  const evidence = createClassificationEvidence({
    artifacts,
    chainValidation,
    campaignProfile,
    batchResults: batchReads.map((entry) => ({
      batchId: entry.value.batchId,
      relativePath: `inputs/batches/${path.basename(entry.relativePath)}`,
      fileSha256: entry.fileSha256,
      status: batchStatus(entry.value),
      expectedUnits: batchExpectedUnits(entry.value),
    })),
  });
  const sourceArtifacts = validateAndDescribeSourceChain({
    sourcePlan: reads.sourceUnitPlan.value,
    dynamicManifest: reads.dynamicManifest.value,
    legacyManifest: legacy.value,
    sourceReads,
    sourceRun: map.sourceRun,
  });
  const provenance = createRunProvenance({
    implementationCommitSha: map.implementationCommitSha,
    sourceRun: map.sourceRun,
    sourceArtifacts,
    campaignProfile,
  });
  const basis = createReviewBasis({
    campaignProfile,
    dynamicManifest: reads.dynamicManifest.value,
    dynamicManifestFileSha256: reads.dynamicManifest.fileSha256,
    legacyManifest: legacy.value,
    legacyManifestFileSha256: legacy.fileSha256,
    classificationEvidence: evidence,
    runProvenance: provenance,
  });

  const temp = makeTempTarget(target);
  // On failure the temp root is retained for forensic inspection and is never
  // renamed into the requested immutable target.
  fs.mkdirSync(path.join(temp, "inputs", "batches"), {
    recursive: true,
    mode: 0o700,
  });
  fs.mkdirSync(path.join(temp, "inputs", "source"), {
    recursive: true,
    mode: 0o700,
  });
  copyRegularVerified(inputMapPath, path.join(temp, "input-map.json"));
  copyRegularVerified(
    legacyManifestPath,
    path.join(temp, "inputs", "legacy-manifest.json")
  );
  for (const [name, source] of Object.entries(sources))
    copyRegularVerified(source, path.join(temp, "inputs", `${name}.json`));
  for (const entry of batches)
    copyRegularVerified(
      entry.source,
      path.join(temp, "inputs", "batches", path.basename(entry.relativePath))
    );
  for (const [name, source] of Object.entries(sourcePaths))
    copyRegularVerified(
      source,
      path.join(temp, sourceArtifacts[name].relativePath)
    );
  writeJsonPrivate(path.join(temp, BASIS_FILE), basis);
  validateReviewBasis(readRegular(path.join(temp, BASIS_FILE)).value);
  materializeFreezeArtifactSetIndex({ basisRoot: temp, basis });
  validateFreezeArtifactSet({ basisRoot: temp, basis });
  lockTree(temp);
  fs.renameSync(temp, target);
  return basis;
}

function materializeDraft({ basisRoot, target }) {
  if (!basisRoot || !target) fail("LF_A_DOUBLE_REVIEW_DRAFT_ARGUMENT_REQUIRED");
  const basis = readRegular(path.join(basisRoot, BASIS_FILE)).value;
  validateReviewBasis(basis);
  validateFreezeArtifactSet({ basisRoot, basis });
  const draft = createCrosswalkDraft({ basis });
  const temp = makeTempTarget(target);
  writeJsonPrivate(path.join(temp, DRAFT_FILE), draft);
  validateCrosswalkDraft({
    basis,
    draft: readRegular(path.join(temp, DRAFT_FILE)).value,
  });
  lockTree(temp);
  fs.renameSync(temp, target);
  return draft;
}

function readReviewCampaign({ basisRoot, draftRoot }) {
  if (!basisRoot || !draftRoot)
    fail("LF_A_DOUBLE_REVIEW_CAMPAIGN_ARGUMENT_REQUIRED");
  const basis = readRegular(path.join(basisRoot, BASIS_FILE)).value;
  const draft = readRegular(path.join(draftRoot, DRAFT_FILE)).value;
  validateReviewBasis(basis);
  const freezeArtifactSet = validateFreezeArtifactSet({ basisRoot, basis });
  validateCrosswalkDraft({ basis, draft });
  return { basis, draft, freezeArtifactSet };
}

function materializeRegistry({
  basisRoot,
  draftRoot,
  authorityId,
  authorityPublicKeyPath,
  authorityPrivateKeyPath,
  trustedAuthorityPublicKeyFingerprintSha256,
  reviewersPath,
  target,
}) {
  if (
    !authorityId ||
    !authorityPublicKeyPath ||
    !authorityPrivateKeyPath ||
    !trustedAuthorityPublicKeyFingerprintSha256 ||
    !reviewersPath ||
    !target
  )
    fail("LF_A_DOUBLE_REVIEW_REGISTRY_ARGUMENT_REQUIRED");
  const { basis, draft, freezeArtifactSet } = readReviewCampaign({
    basisRoot,
    draftRoot,
  });
  const registry = createReviewerRegistry({
    basis,
    draft,
    authorityId,
    authorityPublicKeyPem: readRawRegular(authorityPublicKeyPath).toString(
      "utf8"
    ),
    authorityPrivateKeyPem: readRawRegular(authorityPrivateKeyPath).toString(
      "utf8"
    ),
    trustedAuthorityPublicKeyFingerprintSha256,
    freezeArtifactSetSha256: freezeArtifactSet.artifactSetSha256,
    reviewers: readRegular(reviewersPath).value.reviewers,
  });
  const temp = makeTempTarget(target);
  writeJsonPrivate(path.join(temp, REGISTRY_FILE), registry);
  validateReviewerRegistry({
    basis,
    draft,
    registry: readRegular(path.join(temp, REGISTRY_FILE)).value,
    authorityPublicKeyFingerprintSha256:
      registry.authorityPublicKeyFingerprintSha256,
  });
  lockTree(temp);
  fs.renameSync(temp, target);
  return registry;
}

function readRegisteredCampaign({
  basisRoot,
  draftRoot,
  registryRoot,
  authorityPublicKeyFingerprintSha256,
}) {
  if (!registryRoot || !authorityPublicKeyFingerprintSha256)
    fail("LF_A_DOUBLE_REVIEW_REGISTERED_CAMPAIGN_ARGUMENT_REQUIRED");
  const { basis, draft } = readReviewCampaign({ basisRoot, draftRoot });
  const freezeArtifactSet = validateFreezeArtifactSet({ basisRoot, basis });
  const registry = readRegular(path.join(registryRoot, REGISTRY_FILE)).value;
  validateReviewerRegistry({
    basis,
    draft,
    registry,
    authorityPublicKeyFingerprintSha256,
  });
  if (registry.freezeArtifactSetSha256 !== freezeArtifactSet.artifactSetSha256)
    fail("LF_A_DOUBLE_REVIEW_REGISTRY_FREEZE_BINDING_INVALID");
  return { basis, draft, registry };
}

function materializeReviewerTemplate({
  basisRoot,
  draftRoot,
  registryRoot,
  authorityPublicKeyFingerprintSha256,
  reviewerSlot,
  target,
}) {
  if (!reviewerSlot || !target)
    fail("LF_A_DOUBLE_REVIEW_TEMPLATE_ARGUMENT_REQUIRED");
  const campaign = readRegisteredCampaign({
    basisRoot,
    draftRoot,
    registryRoot,
    authorityPublicKeyFingerprintSha256,
  });
  const input = createReviewerTemplate({
    ...campaign,
    authorityPublicKeyFingerprintSha256,
    reviewerSlot,
  });
  const temp = makeTempTarget(target);
  const file = path.join(temp, `review-input-${reviewerSlot}.private.json`);
  writeJsonPrivate(file, input);
  if (stableJson(readRegular(file).value) !== stableJson(input))
    fail("LF_A_DOUBLE_REVIEW_TEMPLATE_COPY_INVALID");
  lockTree(temp);
  fs.renameSync(temp, target);
  return input;
}

function stableJson(value) {
  return JSON.stringify(value);
}

function materializeReviewerArtifact({
  basisRoot,
  draftRoot,
  registryRoot,
  authorityPublicKeyFingerprintSha256,
  reviewInputPath,
  reviewerPrivateKeyPath,
  target,
}) {
  if (!reviewInputPath || !reviewerPrivateKeyPath || !target)
    fail("LF_A_DOUBLE_REVIEW_SEAL_ARGUMENT_REQUIRED");
  const campaign = readRegisteredCampaign({
    basisRoot,
    draftRoot,
    registryRoot,
    authorityPublicKeyFingerprintSha256,
  });
  const input = readRegular(reviewInputPath).value;
  const review = sealReviewerArtifact({
    ...campaign,
    authorityPublicKeyFingerprintSha256,
    input,
    privateKeyPem: readRawRegular(reviewerPrivateKeyPath).toString("utf8"),
  });
  const temp = makeTempTarget(target);
  const file = path.join(temp, `review-${review.reviewerSlot}.private.json`);
  writeJsonPrivate(file, review);
  validateReviewerArtifact({
    ...campaign,
    authorityPublicKeyFingerprintSha256,
    review: readRegular(file).value,
  });
  lockTree(temp);
  fs.renameSync(temp, target);
  return review;
}

function materializeApprovedCrosswalk({
  basisRoot,
  draftRoot,
  registryRoot,
  authorityPublicKeyFingerprintSha256,
  reviewAPath,
  reviewBPath,
  target,
}) {
  if (!reviewAPath || !reviewBPath || !target)
    fail("LF_A_DOUBLE_REVIEW_RECONCILE_ARGUMENT_REQUIRED");
  const campaign = readRegisteredCampaign({
    basisRoot,
    draftRoot,
    registryRoot,
    authorityPublicKeyFingerprintSha256,
  });
  const reviewA = readRegular(reviewAPath).value;
  const reviewB = readRegular(reviewBPath).value;
  const approved = reconcileApprovedCrosswalk({
    ...campaign,
    authorityPublicKeyFingerprintSha256,
    reviewA,
    reviewB,
  });
  const temp = makeTempTarget(target);
  const file = path.join(temp, APPROVED_CROSSWALK_FILE);
  writeJsonPrivate(file, approved);
  const reopened = readRegular(file).value;
  const regenerated = reconcileApprovedCrosswalk({
    ...campaign,
    authorityPublicKeyFingerprintSha256,
    reviewA,
    reviewB,
  });
  if (stableJson(reopened) !== stableJson(regenerated))
    fail("LF_A_DOUBLE_REVIEW_APPROVED_CROSSWALK_COPY_INVALID");
  lockTree(temp);
  fs.renameSync(temp, target);
  return approved;
}

function readApprovedCampaign({
  basisRoot,
  draftRoot,
  registryRoot,
  authorityPublicKeyFingerprintSha256,
  reviewAPath,
  reviewBPath,
  approvedCrosswalkPath,
}) {
  if (!reviewAPath || !reviewBPath || !approvedCrosswalkPath)
    fail("LF_A_DYNAMIC_REMAINDER_APPROVED_CAMPAIGN_ARGUMENT_REQUIRED");
  const campaign = readRegisteredCampaign({
    basisRoot,
    draftRoot,
    registryRoot,
    authorityPublicKeyFingerprintSha256,
  });
  const reviewA = readRegular(reviewAPath).value;
  const reviewB = readRegular(reviewBPath).value;
  const approvedCrosswalk = readRegular(approvedCrosswalkPath).value;
  validateApprovedCrosswalk({
    ...campaign,
    authorityPublicKeyFingerprintSha256,
    reviewA,
    reviewB,
    approvedCrosswalk,
  });
  return { ...campaign, reviewA, reviewB, approvedCrosswalk };
}

function materializeDynamicRemainderDraft({
  basisRoot,
  draftRoot,
  registryRoot,
  authorityPublicKeyFingerprintSha256,
  reviewAPath,
  reviewBPath,
  approvedCrosswalkPath,
  target,
}) {
  if (!target) fail("LF_A_DYNAMIC_REMAINDER_DRAFT_ARGUMENT_REQUIRED");
  const campaign = readApprovedCampaign({
    basisRoot,
    draftRoot,
    registryRoot,
    authorityPublicKeyFingerprintSha256,
    reviewAPath,
    reviewBPath,
    approvedCrosswalkPath,
  });
  const remainderDraft = createDynamicRemainderDraft({
    ...campaign,
    authorityPublicKeyFingerprintSha256,
  });
  const temp = makeTempTarget(target);
  const file = path.join(temp, DYNAMIC_REMAINDER_DRAFT_FILE);
  writeJsonPrivate(file, remainderDraft);
  validateDynamicRemainderDraft({
    ...campaign,
    authorityPublicKeyFingerprintSha256,
    remainderDraft: readRegular(file).value,
  });
  lockTree(temp);
  fs.renameSync(temp, target);
  return remainderDraft;
}

function readDynamicRemainderCampaign({
  remainderDraftRoot,
  ...approvedCampaignArgs
}) {
  if (!remainderDraftRoot)
    fail("LF_A_DYNAMIC_REMAINDER_CAMPAIGN_ARGUMENT_REQUIRED");
  const campaign = readApprovedCampaign(approvedCampaignArgs);
  const remainderDraft = readRegular(
    path.join(remainderDraftRoot, DYNAMIC_REMAINDER_DRAFT_FILE)
  ).value;
  validateDynamicRemainderDraft({
    ...campaign,
    authorityPublicKeyFingerprintSha256:
      approvedCampaignArgs.authorityPublicKeyFingerprintSha256,
    remainderDraft,
  });
  return { ...campaign, remainderDraft };
}

function materializeDynamicRemainderReviewerTemplate({
  reviewerSlot,
  target,
  ...campaignArgs
}) {
  if (!reviewerSlot || !target)
    fail("LF_A_DYNAMIC_REMAINDER_TEMPLATE_ARGUMENT_REQUIRED");
  const campaign = readDynamicRemainderCampaign(campaignArgs);
  const input = createDynamicRemainderReviewerTemplate({
    ...campaign,
    authorityPublicKeyFingerprintSha256:
      campaignArgs.authorityPublicKeyFingerprintSha256,
    reviewerSlot,
  });
  const temp = makeTempTarget(target);
  const file = path.join(
    temp,
    `dynamic-remainder-review-input-${reviewerSlot}.private.json`
  );
  writeJsonPrivate(file, input);
  if (stableJson(readRegular(file).value) !== stableJson(input))
    fail("LF_A_DYNAMIC_REMAINDER_TEMPLATE_COPY_INVALID");
  lockTree(temp);
  fs.renameSync(temp, target);
  return input;
}

function materializeDynamicRemainderReviewerArtifact({
  reviewInputPath,
  reviewerPrivateKeyPath,
  target,
  ...campaignArgs
}) {
  if (!reviewInputPath || !reviewerPrivateKeyPath || !target)
    fail("LF_A_DYNAMIC_REMAINDER_SEAL_ARGUMENT_REQUIRED");
  const campaign = readDynamicRemainderCampaign(campaignArgs);
  const input = readRegular(reviewInputPath).value;
  const review = sealDynamicRemainderReviewerArtifact({
    ...campaign,
    authorityPublicKeyFingerprintSha256:
      campaignArgs.authorityPublicKeyFingerprintSha256,
    input,
    privateKeyPem: readRawRegular(reviewerPrivateKeyPath).toString("utf8"),
  });
  const temp = makeTempTarget(target);
  const file = path.join(
    temp,
    `dynamic-remainder-review-${review.reviewerSlot}.private.json`
  );
  writeJsonPrivate(file, review);
  validateDynamicRemainderReviewerArtifact({
    ...campaign,
    authorityPublicKeyFingerprintSha256:
      campaignArgs.authorityPublicKeyFingerprintSha256,
    review: readRegular(file).value,
  });
  lockTree(temp);
  fs.renameSync(temp, target);
  return review;
}

function materializeDynamicRemainderReconciliation({
  remainderReviewAPath,
  remainderReviewBPath,
  target,
  ...campaignArgs
}) {
  if (!remainderReviewAPath || !remainderReviewBPath || !target)
    fail("LF_A_DYNAMIC_REMAINDER_RECONCILE_ARGUMENT_REQUIRED");
  const campaign = readDynamicRemainderCampaign(campaignArgs);
  const remainderReviewA = readRegular(remainderReviewAPath).value;
  const remainderReviewB = readRegular(remainderReviewBPath).value;
  const reconciliation = reconcileDynamicRemainderReview({
    ...campaign,
    authorityPublicKeyFingerprintSha256:
      campaignArgs.authorityPublicKeyFingerprintSha256,
    remainderReviewA,
    remainderReviewB,
  });
  const temp = makeTempTarget(target);
  const file = path.join(temp, DYNAMIC_REMAINDER_RECONCILIATION_FILE);
  writeJsonPrivate(file, reconciliation);
  const reopened = readRegular(file).value;
  validateDynamicRemainderReconciliation({
    ...campaign,
    authorityPublicKeyFingerprintSha256:
      campaignArgs.authorityPublicKeyFingerprintSha256,
    remainderReviewA,
    remainderReviewB,
    reconciliation: reopened,
    expectedProfileId: campaign.basis.campaignProfile.profileId,
    expectedRunSignature: campaign.basis.runProvenance.sourceRun.runSignature,
    expectedBasisSha256: campaign.basis.basisSha256,
  });
  lockTree(temp);
  fs.renameSync(temp, target);
  return reconciliation;
}

function main(argv = process.argv.slice(2)) {
  const { command, values } = parseArgs(argv);
  if (command === "freeze") {
    const basis = materializeFreeze({
      runRoot: values["run-root"],
      legacyManifestPath: values["legacy-manifest"],
      inputMapPath: values["input-map"],
      sourcePaths: {
        sourcePdf: values["source-pdf"],
        documentArtifact: values["document-artifact"],
        sourceLedger: values["source-ledger"],
        runContract: values["run-contract"],
        inputManifest: values["input-manifest"],
        correctedAStatusAudit: values["corrected-a-status-audit"],
        integrityLog: values["integrity-log"],
      },
      target: values.target,
    });
    process.stdout.write(`${basis.basisSha256}\n`);
    return;
  }
  if (command === "draft") {
    const draft = materializeDraft({
      basisRoot: values["basis-root"],
      target: values.target,
    });
    process.stdout.write(`${draft.draftSha256}\n`);
    return;
  }
  if (command === "registry") {
    const registry = materializeRegistry({
      basisRoot: values["basis-root"],
      draftRoot: values["draft-root"],
      authorityId: values["authority-id"],
      authorityPublicKeyPath: values["authority-public-key"],
      authorityPrivateKeyPath: values["authority-private-key"],
      trustedAuthorityPublicKeyFingerprintSha256:
        values["trusted-authority-public-key-fingerprint"],
      reviewersPath: values.reviewers,
      target: values.target,
    });
    process.stdout.write(
      `${registry.registrySha256} ${registry.authorityPublicKeyFingerprintSha256}\n`
    );
    return;
  }
  if (command === "template") {
    const input = materializeReviewerTemplate({
      basisRoot: values["basis-root"],
      draftRoot: values["draft-root"],
      registryRoot: values["registry-root"],
      authorityPublicKeyFingerprintSha256:
        values["authority-public-key-fingerprint"],
      reviewerSlot: values.slot,
      target: values.target,
    });
    process.stdout.write(`${input.reviewerSlot} ${input.reviewerId}\n`);
    return;
  }
  if (command === "seal") {
    const review = materializeReviewerArtifact({
      basisRoot: values["basis-root"],
      draftRoot: values["draft-root"],
      registryRoot: values["registry-root"],
      authorityPublicKeyFingerprintSha256:
        values["authority-public-key-fingerprint"],
      reviewInputPath: values["review-input"],
      reviewerPrivateKeyPath: values["reviewer-private-key"],
      target: values.target,
    });
    process.stdout.write(`${review.reviewSha256}\n`);
    return;
  }
  if (command === "reconcile") {
    const approved = materializeApprovedCrosswalk({
      basisRoot: values["basis-root"],
      draftRoot: values["draft-root"],
      registryRoot: values["registry-root"],
      authorityPublicKeyFingerprintSha256:
        values["authority-public-key-fingerprint"],
      reviewAPath: values["review-a"],
      reviewBPath: values["review-b"],
      target: values.target,
    });
    process.stdout.write(`${approved.approvedCrosswalkSha256}\n`);
    return;
  }
  const approvedCampaignValues = {
    basisRoot: values["basis-root"],
    draftRoot: values["draft-root"],
    registryRoot: values["registry-root"],
    authorityPublicKeyFingerprintSha256:
      values["authority-public-key-fingerprint"],
    reviewAPath: values["review-a"],
    reviewBPath: values["review-b"],
    approvedCrosswalkPath: values["approved-crosswalk"],
  };
  if (command === "reverse-draft") {
    const remainderDraft = materializeDynamicRemainderDraft({
      ...approvedCampaignValues,
      target: values.target,
    });
    process.stdout.write(
      `${remainderDraft.remainderDraftSha256} ${remainderDraft.summary.remainderComponents}\n`
    );
    return;
  }
  const reverseCampaignValues = {
    ...approvedCampaignValues,
    remainderDraftRoot: values["remainder-draft-root"],
  };
  if (command === "reverse-template") {
    const input = materializeDynamicRemainderReviewerTemplate({
      ...reverseCampaignValues,
      reviewerSlot: values.slot,
      target: values.target,
    });
    process.stdout.write(`${input.reviewerSlot} ${input.reviewerId}\n`);
    return;
  }
  if (command === "reverse-seal") {
    const review = materializeDynamicRemainderReviewerArtifact({
      ...reverseCampaignValues,
      reviewInputPath: values["review-input"],
      reviewerPrivateKeyPath: values["reviewer-private-key"],
      target: values.target,
    });
    process.stdout.write(`${review.reviewSha256}\n`);
    return;
  }
  if (command === "reverse-reconcile") {
    const reconciliation = materializeDynamicRemainderReconciliation({
      ...reverseCampaignValues,
      remainderReviewAPath: values["remainder-review-a"],
      remainderReviewBPath: values["remainder-review-b"],
      target: values.target,
    });
    process.stdout.write(
      `${reconciliation.reconciliationSha256} ${reconciliation.status}\n`
    );
    return;
  }
  fail("LF_A_DOUBLE_REVIEW_COMMAND_INVALID", command);
}

if (require.main === module) main();

module.exports = {
  BASIS_FILE,
  DRAFT_FILE,
  DYNAMIC_REMAINDER_DRAFT_FILE,
  DYNAMIC_REMAINDER_RECONCILIATION_FILE,
  FREEZE_ARTIFACT_SET_FILE,
  REGISTRY_FILE,
  assertRegularSingleLink,
  assertNoPrivateKeyMaterial,
  copyRegularVerified,
  main,
  materializeApprovedCrosswalk,
  materializeDynamicRemainderDraft,
  materializeDynamicRemainderReconciliation,
  materializeDynamicRemainderReviewerArtifact,
  materializeDynamicRemainderReviewerTemplate,
  materializeDraft,
  materializeFreeze,
  materializeFreezeArtifactSetIndex,
  materializeRegistry,
  materializeReviewerArtifact,
  materializeReviewerTemplate,
  parseArgs,
  readRawRegular,
  readRegular,
  validateAndDescribeSourceChain,
  validateFreezeArtifactSet,
};

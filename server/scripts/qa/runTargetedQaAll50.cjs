#!/usr/bin/env node

process.umask(0o077);

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { performance } = require("perf_hooks");
const { spawnSync } = require("child_process");
const {
  CATEGORY_ORDER,
  fixedSourcePaths,
} = require("./ensureTargetedQaManifest.cjs");
const { derivedExecution } = require("./prepareTargetedQaWorksheets.cjs");
const {
  releaseIdentity,
  sha256,
} = require("../../utils/policyAnalysis/runIdentity");
const {
  assertTargetedQaManifest,
} = require("../../utils/policyAnalysis/targetedQaManifestContract");
const {
  selectionDigest,
} = require("../../utils/policyAnalysis/targetRequirementSelection");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../..");
const EXPECTED_PAIR_COUNT = 50;
const SUMMARY_FILENAME = "run-summary.private.json";
const ACCEPTED_STATUS = new Set(["PASS", "TECHNICAL_PASS_REVIEW_REQUIRED"]);

function runnerError(code, detail = "") {
  const error = new Error(detail ? `${code}: ${detail}` : code);
  error.code = code;
  return error;
}

function parseArguments(argv) {
  if (argv.length % 2 !== 0) throw runnerError("TARGETED_RUN_ARGUMENT_INVALID");
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value)
      throw runnerError("TARGETED_RUN_ARGUMENT_INVALID", key);
    const name = key.slice(2);
    if (Object.hasOwn(values, name))
      throw runnerError("TARGETED_RUN_ARGUMENT_DUPLICATE", name);
    values[name] = value;
  }
  const expected = [
    "baselineRoot",
    "manifest",
    "expectedManifestDigest",
    "preparedRoot",
    "output",
    "model",
    "modelTokenLimit",
  ];
  const unknown = Object.keys(values).filter((key) => !expected.includes(key));
  if (unknown.length)
    throw runnerError("TARGETED_RUN_ARGUMENT_UNKNOWN", unknown.join(","));
  for (const required of expected)
    if (!values[required])
      throw runnerError("TARGETED_RUN_ARGUMENT_REQUIRED", required);
  for (const absolute of [
    values.baselineRoot,
    values.manifest,
    values.preparedRoot,
    values.output,
  ])
    if (!path.isAbsolute(absolute))
      throw runnerError("TARGETED_RUN_ABSOLUTE_PATH_REQUIRED");
  if (!/^[a-f0-9]{64}$/u.test(values.expectedManifestDigest))
    throw runnerError("TARGETED_RUN_MANIFEST_DIGEST_INVALID");
  const modelTokenLimit = Number(values.modelTokenLimit);
  if (!Number.isInteger(modelTokenLimit) || modelTokenLimit < 1)
    throw runnerError("TARGETED_RUN_MODEL_TOKEN_LIMIT_INVALID");
  return { ...values, modelTokenLimit };
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
    throw runnerError(code, directory);
  return fsImpl.realpathSync(directory);
}

function fileBytes(file, code, fsImpl, scope = null) {
  if (
    !fsImpl.existsSync(file) ||
    fsImpl.lstatSync(file).isSymbolicLink() ||
    !fsImpl.statSync(file).isFile()
  )
    throw runnerError(code, file);
  const real = fsImpl.realpathSync(file);
  if (scope && !isWithin(scope, real)) throw runnerError(code, file);
  return fsImpl.readFileSync(real);
}

function readJson(file, code, fsImpl, scope = null) {
  try {
    return JSON.parse(fileBytes(file, code, fsImpl, scope).toString("utf8"));
  } catch (error) {
    if (error?.code) throw error;
    throw runnerError(code, file);
  }
}

function sha256File(file, fsImpl) {
  return sha256(fsImpl.readFileSync(file));
}

function pairRelative(documentIndex, documentUuid, categoryView) {
  return path.join(
    `DOC-${String(documentIndex + 1).padStart(2, "0")}-${documentUuid}`,
    categoryView
  );
}

function resolveDocumentArtifact({
  baseline,
  documentIndex,
  document,
  fsImpl,
}) {
  const documentDirectory = realDirectory(
    path.join(
      baseline,
      `DOC-${String(documentIndex + 1).padStart(2, "0")}-${document.uuid}`
    ),
    "TARGETED_RUN_BASELINE_DOCUMENT_INVALID",
    fsImpl
  );
  if (!isWithin(baseline, documentDirectory))
    throw runnerError(
      "TARGETED_RUN_BASELINE_DOCUMENT_SCOPE_INVALID",
      document.uuid
    );
  const requestedArtifact = path.join(
    documentDirectory,
    "document.private.json"
  );
  const bytes = fileBytes(
    requestedArtifact,
    "TARGETED_RUN_DOCUMENT_ARTIFACT_INVALID",
    fsImpl,
    documentDirectory
  );
  if (
    !/^[a-f0-9]{64}$/u.test(document.documentArtifactSha256 || "") ||
    sha256(bytes) !== document.documentArtifactSha256
  )
    throw runnerError(
      "TARGETED_RUN_DOCUMENT_ARTIFACT_SHA_MISMATCH",
      document.uuid
    );
  let artifact;
  try {
    artifact = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw runnerError("TARGETED_RUN_DOCUMENT_ARTIFACT_INVALID", document.uuid);
  }
  if (
    artifact?.schemaVersion !== 1 ||
    typeof artifact?.fingerprint !== "string" ||
    !artifact.fingerprint ||
    artifact.fingerprint !== document.sha256 ||
    artifact.document?.sourceDocumentId !== artifact.fingerprint
  )
    throw runnerError(
      "TARGETED_RUN_DOCUMENT_ARTIFACT_FINGERPRINT_MISMATCH",
      document.uuid
    );
  return {
    file: fsImpl.realpathSync(requestedArtifact),
    fingerprint: artifact.fingerprint,
    sha256: document.documentArtifactSha256,
  };
}

async function verifyRuntime({ baseUrl, model, modelTokenLimit, fetchFn }) {
  if (!/qwen/iu.test(model))
    throw runnerError("TARGETED_RUN_QWEN_MODEL_REQUIRED", model);
  const apiRoot = baseUrl.replace(/\/v1\/?$/u, "");
  const response = await fetchFn(`${apiRoot}/api/v0/models`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw runnerError("TARGETED_RUN_MODEL_LIST_FAILED", response.status);
  const body = await response.json();
  const loaded = (body?.data || []).filter(({ state }) => state === "loaded");
  if (loaded.some(({ type }) => type === "embeddings"))
    throw runnerError("TARGETED_RUN_EMBEDDING_MODEL_FORBIDDEN");
  if (
    loaded.length !== 1 ||
    loaded[0].id !== model ||
    loaded[0].type !== "llm" ||
    Number(loaded[0].loaded_context_length) !== Number(modelTokenLimit)
  )
    throw runnerError("TARGETED_RUN_MODEL_STATE_INVALID");
  return {
    id: loaded[0].id,
    type: loaded[0].type,
    context: Number(loaded[0].loaded_context_length),
  };
}

function defaultChildRunner({ script, args, env, repository }) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: repository,
    env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw runnerError(
      "TARGETED_RUN_CHILD_FAILED",
      `${path.basename(script)}:${result.status}`
    );
}

function assertTriage({
  directory,
  worksheet,
  prompt,
  digest,
  execution,
  fsImpl,
}) {
  const reportFile = path.join(directory, "report.json");
  const report = readJson(
    reportFile,
    "TARGETED_RUN_TRIAGE_REPORT_INVALID",
    fsImpl,
    directory
  );
  const materialized = path.join(directory, "materialized-triage.private.json");
  if (
    !ACCEPTED_STATUS.has(report.status) ||
    report.validation?.formalPass !== true ||
    report.controls?.pass !== true ||
    report.completion?.responseModelComplete !== true ||
    report.implementation?.releaseId !== execution.releaseId ||
    report.implementation?.nodeVersion !== execution.nodeVersion ||
    report.model?.id !== execution.model ||
    report.model?.declaredTokenLimit !== execution.modelTokenLimit ||
    report.contracts?.worksheetSha256 !== sha256File(worksheet, fsImpl) ||
    report.contracts?.systemPromptSha256 !== sha256File(prompt, fsImpl) ||
    report.contracts?.hybridSystemPromptPath !== null ||
    report.contracts?.hybridSystemPromptSha256 !== null ||
    report.contracts?.expectedTargetSelectionDigestSha256 !== digest ||
    report.contracts?.targetSelectionDigestSha256 !== digest ||
    report.contracts?.materializedTriageSha256 !==
      sha256File(materialized, fsImpl) ||
    report.contracts?.controlMode !== "technical-review" ||
    report.input?.hybridTargetCount !== 0 ||
    report.input?.maxAttemptsPerTarget !== 2
  )
    throw runnerError("TARGETED_RUN_TRIAGE_RESUME_INVALID");
  return { report, reportSha256: sha256File(reportFile, fsImpl) };
}

function assertEffects({
  directory,
  worksheet,
  triage,
  prompt,
  digest,
  documentStatus,
  documentArtifact,
  expectedDocumentArtifactSha256,
  documentFingerprint,
  execution,
  fsImpl,
}) {
  const reportFile = path.join(directory, "report.json");
  const report = readJson(
    reportFile,
    "TARGETED_RUN_EFFECTS_REPORT_INVALID",
    fsImpl,
    directory
  );
  const evidence = path.join(directory, "materialized.private.json");
  const sources = path.join(directory, "selected-sources.private.json");
  const targets = path.join(directory, "targets.private.json");
  const documentArtifactSha256 = sha256(
    fileBytes(
      documentArtifact,
      "TARGETED_RUN_DOCUMENT_ARTIFACT_INVALID",
      fsImpl
    )
  );
  const targetsSha256 = sha256(
    fileBytes(
      targets,
      "TARGETED_RUN_EFFECTS_TARGETS_INVALID",
      fsImpl,
      directory
    )
  );
  if (
    !ACCEPTED_STATUS.has(report.status) ||
    report.validation?.pass !== true ||
    report.controls?.pass !== true ||
    report.completion?.responseModelComplete !== true ||
    report.implementation?.releaseId !== execution.releaseId ||
    report.implementation?.nodeVersion !== execution.nodeVersion ||
    report.model?.id !== execution.model ||
    report.model?.declaredTokenLimit !== execution.modelTokenLimit ||
    report.contracts?.worksheetSha256 !== sha256File(worksheet, fsImpl) ||
    report.contracts?.systemPromptSha256 !== sha256File(prompt, fsImpl) ||
    report.contracts?.triageSha256 !== sha256File(triage, fsImpl) ||
    report.contracts?.documentStatus !== documentStatus ||
    documentArtifactSha256 !== expectedDocumentArtifactSha256 ||
    report.contracts?.documentArtifactSha256 !== documentArtifactSha256 ||
    report.contracts?.documentFingerprint !== documentFingerprint ||
    report.contracts?.targetsSha256 !== targetsSha256 ||
    report.contracts?.expectedTargetSelectionDigestSha256 !== digest ||
    report.contracts?.targetSelectionDigestSha256 !== digest ||
    report.contracts?.materializedEvidenceSha256 !==
      sha256File(evidence, fsImpl) ||
    report.contracts?.selectedSourcesSha256 !== sha256File(sources, fsImpl) ||
    report.contracts?.controlMode !== "technical-review" ||
    report.input?.allowUniqueCandidateIdRepair !== false ||
    report.input?.maxAttemptsPerTarget !== 2
  )
    throw runnerError("TARGETED_RUN_EFFECTS_RESUME_INVALID");
  return { report, reportSha256: sha256File(reportFile, fsImpl) };
}

function assertResult({
  directory,
  manifest,
  document,
  categoryTarget,
  worksheet,
  triageDirectory,
  effectsDirectory,
  fsImpl,
}) {
  const reportFile = path.join(directory, "report.private.json");
  const report = readJson(
    reportFile,
    "TARGETED_RUN_RESULT_REPORT_INVALID",
    fsImpl,
    directory
  );
  const rows = readJson(
    path.join(directory, "rows.private.json"),
    "TARGETED_RUN_ROWS_INVALID",
    fsImpl,
    directory
  );
  const requested = readJson(
    path.join(directory, "requested-fields.private.json"),
    "TARGETED_RUN_REQUESTED_FIELDS_INVALID",
    fsImpl,
    directory
  );
  const answer = fileBytes(
    path.join(directory, "answer.private.md"),
    "TARGETED_RUN_ANSWER_INVALID",
    fsImpl,
    directory
  );
  if (
    !ACCEPTED_STATUS.has(report.status) ||
    report.schemaVersion !== 1 ||
    report.contractId !== "TARGETED_QA_CATEGORY_RESULT_V1" ||
    report.runKind !== "TARGETED_QA_ONLY" ||
    report.customerMaterializationAllowed !== false ||
    report.publishable !== false ||
    report.deployable !== false ||
    report.manifestDigestSha256 !== manifest.manifestDigestSha256 ||
    report.document?.uuid !== document.uuid ||
    report.document?.sha256 !== document.sha256 ||
    report.document?.documentStatus !== document.documentStatus ||
    report.categoryView !== categoryTarget.categoryView ||
    JSON.stringify(report.requirementIds) !==
      JSON.stringify(categoryTarget.requirementIds) ||
    report.rowCount !== categoryTarget.requirementIds.length ||
    report.tableContract?.pass !== true ||
    report.inputArtifactHashes?.worksheetSha256 !==
      sha256File(worksheet, fsImpl) ||
    report.inputArtifactHashes?.materializedTriageSha256 !==
      sha256File(
        path.join(triageDirectory, "materialized-triage.private.json"),
        fsImpl
      ) ||
    report.inputArtifactHashes?.materializedEvidenceSha256 !==
      sha256File(
        path.join(effectsDirectory, "materialized.private.json"),
        fsImpl
      ) ||
    report.inputArtifactHashes?.selectedSourcesSha256 !==
      sha256File(
        path.join(effectsDirectory, "selected-sources.private.json"),
        fsImpl
      ) ||
    report.outputSemanticDigests?.rowsSha256 !== selectionDigest(rows) ||
    report.outputSemanticDigests?.requestedFieldsSha256 !==
      selectionDigest(requested) ||
    report.outputSemanticDigests?.answerSha256 !== sha256(answer) ||
    report.qualityGate?.pass !== false ||
    report.qualityGate?.status !== "REVIEW_REQUIRED" ||
    report.qualityGate?.reason !== "TARGETED_QA_ONLY"
  )
    throw runnerError("TARGETED_RUN_RESULT_RESUME_INVALID");
  return { report, reportSha256: sha256File(reportFile, fsImpl) };
}

function phaseMetrics(report, wallMs, resumed, reportSha256) {
  return {
    resumed,
    wallMs,
    reportSha256,
    callCount: report.completion?.callCount || 0,
    modelAttemptCount: report.input?.modelAttemptCount || 0,
    promptTokens: report.completion?.prompt_tokens || 0,
    completionTokens: report.completion?.completion_tokens || 0,
    totalTokens: report.completion?.total_tokens || 0,
    modelDuration: report.completion?.duration || 0,
  };
}

function runStagedPhase({ finalDirectory, child, validate, fsImpl }) {
  if (fsImpl.existsSync(finalDirectory)) {
    if (
      fsImpl.lstatSync(finalDirectory).isSymbolicLink() ||
      !fsImpl.statSync(finalDirectory).isDirectory() ||
      (fsImpl.statSync(finalDirectory).mode & 0o777) !== 0o700
    )
      throw runnerError("TARGETED_RUN_PHASE_DIRECTORY_INVALID", finalDirectory);
    const started = performance.now();
    const validated = validate(finalDirectory);
    return { ...validated, resumed: true, wallMs: performance.now() - started };
  }
  const parent = path.dirname(finalDirectory);
  const staging = path.join(
    parent,
    `.${path.basename(finalDirectory)}.staging-${process.pid}-${crypto.randomBytes(10).toString("hex")}`
  );
  fsImpl.mkdirSync(staging, { recursive: false, mode: 0o700 });
  const started = performance.now();
  child(staging);
  const validated = validate(staging);
  if (fsImpl.existsSync(finalDirectory))
    throw runnerError("TARGETED_RUN_PHASE_ALREADY_EXISTS");
  fsImpl.renameSync(staging, finalDirectory);
  return { ...validated, resumed: false, wallMs: performance.now() - started };
}

function writePrivate(file, value, fsImpl) {
  const bytes = Buffer.from(JSON.stringify(value, null, 2));
  const temporary = `${file}.tmp-${process.pid}-${crypto.randomBytes(8).toString("hex")}`;
  fsImpl.writeFileSync(temporary, bytes, { flag: "wx", mode: 0o600 });
  fsImpl.renameSync(temporary, file);
  fsImpl.chmodSync(file, 0o600);
}

async function run(
  args,
  {
    fsImpl = fs,
    fetchFn = fetch,
    childRunnerFn = defaultChildRunner,
    repositoryRoot = REPOSITORY_ROOT,
    releaseIdentityFn = releaseIdentity,
    nodeVersion = process.versions.node,
    assertManifestFn = assertTargetedQaManifest,
  } = {}
) {
  const repository = realDirectory(
    repositoryRoot,
    "TARGETED_RUN_REPOSITORY_INVALID",
    fsImpl
  );
  const baseline = realDirectory(
    args.baselineRoot,
    "TARGETED_RUN_BASELINE_INVALID",
    fsImpl
  );
  const prepared = realDirectory(
    args.preparedRoot,
    "TARGETED_RUN_PREPARED_INVALID",
    fsImpl
  );
  const requestedOutput = path.resolve(args.output);
  const outputParent = realDirectory(
    path.dirname(requestedOutput),
    "TARGETED_RUN_OUTPUT_PARENT_INVALID",
    fsImpl
  );
  const output = path.join(outputParent, path.basename(requestedOutput));
  if (
    isWithin(repository, output) ||
    isWithin(baseline, output) ||
    isWithin(prepared, output)
  )
    throw runnerError("TARGETED_RUN_OUTPUT_SCOPE_INVALID");
  const manifestBytes = fileBytes(
    args.manifest,
    "TARGETED_RUN_MANIFEST_INVALID",
    fsImpl
  );
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  const execution = derivedExecution({
    repository,
    model: args.model,
    modelTokenLimit: args.modelTokenLimit,
    fsImpl,
    releaseIdentityFn,
    nodeVersion,
  });
  assertManifestFn(manifest, {
    expectedManifestDigestSha256: args.expectedManifestDigest,
    expectedExecution: execution,
  });
  const preparedSummary = readJson(
    path.join(prepared, "summary.private.json"),
    "TARGETED_RUN_PREPARED_SUMMARY_INVALID",
    fsImpl,
    prepared
  );
  if (
    preparedSummary.pairCount !== EXPECTED_PAIR_COUNT ||
    preparedSummary.manifestDigestSha256 !== manifest.manifestDigestSha256 ||
    preparedSummary.manifestFileSha256 !== sha256(manifestBytes) ||
    JSON.stringify(preparedSummary.execution) !== JSON.stringify(execution)
  )
    throw runnerError("TARGETED_RUN_PREPARED_SUMMARY_MISMATCH");

  const scripts = {
    triage: path.join(repository, "server/scripts/qa/runVsCandidateTriage.cjs"),
    effects: path.join(
      repository,
      "server/scripts/qa/runPreparedEvidenceEvaluation.cjs"
    ),
    result: path.join(
      repository,
      "server/scripts/qa/materializeTargetedQaCategory.cjs"
    ),
  };
  for (const script of Object.values(scripts))
    fileBytes(script, "TARGETED_RUN_SCRIPT_MISSING", fsImpl, repository);
  const sources = fixedSourcePaths(repository);
  const baseUrl = process.env.LMSTUDIO_BASE_PATH || "http://127.0.0.1:1234/v1";
  const lock = path.join(
    path.dirname(baseline),
    ".all-categories-quality.lock"
  );
  fsImpl.mkdirSync(lock, { recursive: false, mode: 0o700 });
  writePrivate(
    path.join(lock, "owner.private.json"),
    { pid: process.pid, output },
    fsImpl
  );
  const startedAt = new Date().toISOString();
  const runStarted = performance.now();
  try {
    const runtimeStarted = performance.now();
    const runtime = await verifyRuntime({
      baseUrl,
      model: args.model,
      modelTokenLimit: args.modelTokenLimit,
      fetchFn,
    });
    const runtimeVerificationMs = performance.now() - runtimeStarted;
    if (!fsImpl.existsSync(output))
      fsImpl.mkdirSync(output, { recursive: false, mode: 0o700 });
    const outputScope = realDirectory(
      output,
      "TARGETED_RUN_OUTPUT_INVALID",
      fsImpl
    );
    if ((fsImpl.statSync(outputScope).mode & 0o777) !== 0o700)
      throw runnerError("TARGETED_RUN_OUTPUT_MODE_INVALID");
    const environment = {
      ...process.env,
      LMSTUDIO_BASE_PATH: baseUrl,
      LMSTUDIO_MODEL_PREF: args.model,
      LMSTUDIO_MODEL_TOKEN_LIMIT: String(args.modelTokenLimit),
    };
    const pairs = [];
    for (const [
      documentIndex,
      document,
    ] of manifest.documentMatrix.documents.entries()) {
      const documentArtifact = resolveDocumentArtifact({
        baseline,
        documentIndex,
        document,
        fsImpl,
      });
      for (const categoryView of CATEGORY_ORDER) {
        const categoryTarget = manifest.categoryTargets.find(
          (target) => target.categoryView === categoryView
        );
        const relative = pairRelative(
          documentIndex,
          document.uuid,
          categoryView
        );
        const preparedPair = realDirectory(
          path.join(prepared, relative),
          "TARGETED_RUN_PREPARED_PAIR_INVALID",
          fsImpl
        );
        const documentOutput = path.join(
          outputScope,
          `DOC-${String(documentIndex + 1).padStart(2, "0")}-${document.uuid}`
        );
        if (!fsImpl.existsSync(documentOutput))
          fsImpl.mkdirSync(documentOutput, { recursive: false, mode: 0o700 });
        const realDocumentOutput = realDirectory(
          documentOutput,
          "TARGETED_RUN_DOCUMENT_OUTPUT_INVALID",
          fsImpl
        );
        if (
          !isWithin(outputScope, realDocumentOutput) ||
          (fsImpl.statSync(realDocumentOutput).mode & 0o777) !== 0o700
        )
          throw runnerError(
            "TARGETED_RUN_DOCUMENT_OUTPUT_SCOPE_INVALID",
            relative
          );
        const requestedPairOutput = path.join(realDocumentOutput, categoryView);
        if (!fsImpl.existsSync(requestedPairOutput))
          fsImpl.mkdirSync(requestedPairOutput, {
            recursive: false,
            mode: 0o700,
          });
        const pairOutput = realDirectory(
          requestedPairOutput,
          "TARGETED_RUN_PAIR_OUTPUT_INVALID",
          fsImpl
        );
        if (
          !isWithin(outputScope, pairOutput) ||
          (fsImpl.statSync(pairOutput).mode & 0o777) !== 0o700
        )
          throw runnerError("TARGETED_RUN_PAIR_OUTPUT_SCOPE_INVALID", relative);
        const worksheet = path.join(pairOutput, "worksheet.private.json");
        const provenance = path.join(pairOutput, "provenance.private.json");
        const preparedPairSummary = preparedSummary.pairs?.find(
          (pair) =>
            pair.documentUuid === document.uuid &&
            pair.categoryView === categoryView
        );
        if (!preparedPairSummary)
          throw runnerError(
            "TARGETED_RUN_PREPARED_PAIR_SUMMARY_MISSING",
            relative
          );
        for (const [name, destination] of [
          ["worksheet.private.json", worksheet],
          ["provenance.private.json", provenance],
        ]) {
          const source = path.join(preparedPair, name);
          const bytes = fileBytes(
            source,
            "TARGETED_RUN_PREPARED_ARTIFACT_INVALID",
            fsImpl,
            preparedPair
          );
          const expectedSha256 =
            name === "worksheet.private.json"
              ? preparedPairSummary.worksheetSha256
              : preparedPairSummary.provenanceSha256;
          if (sha256(bytes) !== expectedSha256)
            throw runnerError(
              "TARGETED_RUN_PREPARED_ARTIFACT_SHA_MISMATCH",
              relative
            );
          if (fsImpl.existsSync(destination)) {
            if (
              fsImpl.lstatSync(destination).isSymbolicLink() ||
              (fsImpl.statSync(destination).mode & 0o777) !== 0o600 ||
              !fsImpl.readFileSync(destination).equals(bytes)
            )
              throw runnerError(
                "TARGETED_RUN_PREPARED_COPY_MISMATCH",
                relative
              );
          } else
            fsImpl.writeFileSync(destination, bytes, {
              flag: "wx",
              mode: 0o600,
            });
        }
        const digest = categoryTarget.expectedTargetSelectionDigestSha256;
        const triagePrompt = sources.prompts[categoryView].triage;
        const effectsPrompt = sources.prompts[categoryView].effects;
        const triageDirectory = path.join(pairOutput, "triage");
        const triagePhase = runStagedPhase({
          finalDirectory: triageDirectory,
          fsImpl,
          child: (staging) =>
            childRunnerFn({
              script: scripts.triage,
              repository,
              env: environment,
              args: [
                "--worksheet",
                worksheet,
                "--systemPromptFile",
                triagePrompt,
                "--controlMode",
                "technical-review",
                "--output",
                staging,
                "--model",
                args.model,
                "--modelTokenLimit",
                String(args.modelTokenLimit),
                "--maxAttemptsPerTarget",
                "2",
                "--expectedTargetSelectionDigestSha256",
                digest,
              ],
            }),
          validate: (directory) =>
            assertTriage({
              directory,
              worksheet,
              prompt: triagePrompt,
              digest,
              execution,
              fsImpl,
            }),
        });
        const materializedTriage = path.join(
          triageDirectory,
          "materialized-triage.private.json"
        );
        const effectsDirectory = path.join(pairOutput, "effects");
        const effectsPhase = runStagedPhase({
          finalDirectory: effectsDirectory,
          fsImpl,
          child: (staging) =>
            childRunnerFn({
              script: scripts.effects,
              repository,
              env: environment,
              args: [
                "--worksheet",
                worksheet,
                "--documentArtifact",
                documentArtifact.file,
                "--systemPromptFile",
                effectsPrompt,
                "--controlMode",
                "technical-review",
                "--triageFile",
                materializedTriage,
                "--output",
                staging,
                "--model",
                args.model,
                "--modelTokenLimit",
                String(args.modelTokenLimit),
                "--documentStatus",
                document.documentStatus,
                "--maxAttemptsPerTarget",
                "2",
                "--allowUniqueCandidateIdRepair",
                "false",
                "--expectedTargetSelectionDigestSha256",
                digest,
              ],
            }),
          validate: (directory) =>
            assertEffects({
              directory,
              worksheet,
              triage: materializedTriage,
              prompt: effectsPrompt,
              digest,
              documentStatus: document.documentStatus,
              documentArtifact: documentArtifact.file,
              expectedDocumentArtifactSha256: documentArtifact.sha256,
              documentFingerprint: documentArtifact.fingerprint,
              execution,
              fsImpl,
            }),
        });
        const resultDirectory = path.join(pairOutput, "result");
        const resultExisted = fsImpl.existsSync(resultDirectory);
        const resultStarted = performance.now();
        childRunnerFn({
          script: scripts.result,
          repository,
          env: environment,
          args: [
            "--baselineRoot",
            baseline,
            "--phaseRoot",
            output,
            "--manifest",
            args.manifest,
            "--expectedManifestDigestSha256",
            args.expectedManifestDigest,
            "--documentUuid",
            document.uuid,
            "--categoryView",
            categoryView,
            "--output",
            resultDirectory,
            "--model",
            args.model,
            "--modelTokenLimit",
            String(args.modelTokenLimit),
          ],
        });
        const resultPhase = assertResult({
          directory: resultDirectory,
          manifest,
          document,
          categoryTarget,
          worksheet,
          triageDirectory,
          effectsDirectory,
          fsImpl,
        });
        pairs.push({
          documentUuid: document.uuid,
          side: document.side,
          position: document.position,
          categoryView,
          triage: phaseMetrics(
            triagePhase.report,
            triagePhase.wallMs,
            triagePhase.resumed,
            triagePhase.reportSha256
          ),
          effects: phaseMetrics(
            effectsPhase.report,
            effectsPhase.wallMs,
            effectsPhase.resumed,
            effectsPhase.reportSha256
          ),
          result: {
            resumed: resultExisted,
            wallMs: performance.now() - resultStarted,
            reportSha256: resultPhase.reportSha256,
            callCount: 0,
          },
        });
      }
    }
    if (pairs.length !== EXPECTED_PAIR_COUNT)
      throw runnerError("TARGETED_RUN_PAIR_COUNT_INVALID");
    const totals = pairs.reduce(
      (sum, pair) => {
        for (const phase of [pair.triage, pair.effects, pair.result]) {
          sum.wallMs += phase.wallMs || 0;
          sum.callCount += phase.callCount || 0;
          sum.modelAttemptCount += phase.modelAttemptCount || 0;
          sum.promptTokens += phase.promptTokens || 0;
          sum.completionTokens += phase.completionTokens || 0;
          sum.totalTokens += phase.totalTokens || 0;
          sum.modelDuration += phase.modelDuration || 0;
        }
        return sum;
      },
      {
        wallMs: 0,
        callCount: 0,
        modelAttemptCount: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        modelDuration: 0,
      }
    );
    const summary = {
      schemaVersion: 1,
      contractId: "TARGETED_QA_ALL_50_RUN_V1",
      runKind: "TARGETED_QA_ONLY",
      customerMaterializationAllowed: false,
      publishable: false,
      deployable: false,
      startedAt,
      finishedAt: new Date().toISOString(),
      wallMs: performance.now() - runStarted,
      manifestDigestSha256: manifest.manifestDigestSha256,
      manifestFileSha256: sha256(manifestBytes),
      preparedSummarySha256: sha256File(
        path.join(prepared, "summary.private.json"),
        fsImpl
      ),
      execution,
      runtime: { ...runtime, verificationMs: runtimeVerificationMs },
      pairCount: pairs.length,
      totals,
      pairs,
    };
    const summaryFile = path.join(output, SUMMARY_FILENAME);
    if (fsImpl.existsSync(summaryFile)) {
      const existing = readJson(
        summaryFile,
        "TARGETED_RUN_EXISTING_SUMMARY_INVALID",
        fsImpl,
        output
      );
      if (
        existing.contractId !== summary.contractId ||
        existing.runKind !== "TARGETED_QA_ONLY" ||
        existing.customerMaterializationAllowed !== false ||
        existing.publishable !== false ||
        existing.deployable !== false ||
        existing.manifestDigestSha256 !== summary.manifestDigestSha256 ||
        existing.manifestFileSha256 !== summary.manifestFileSha256 ||
        existing.preparedSummarySha256 !== summary.preparedSummarySha256 ||
        JSON.stringify(existing.execution) !==
          JSON.stringify(summary.execution) ||
        existing.pairCount !== summary.pairCount ||
        !Array.isArray(existing.pairs) ||
        existing.pairs.length !== EXPECTED_PAIR_COUNT ||
        existing.pairs.some((pair, index) => {
          const observed = summary.pairs[index];
          return (
            pair.documentUuid !== observed?.documentUuid ||
            pair.side !== observed?.side ||
            pair.position !== observed?.position ||
            pair.categoryView !== observed?.categoryView ||
            ["triage", "effects", "result"].some(
              (phase) =>
                pair[phase]?.reportSha256 !== observed?.[phase]?.reportSha256
            )
          );
        })
      )
        throw runnerError("TARGETED_RUN_EXISTING_SUMMARY_MISMATCH");
      return { output, summary: existing, reused: true };
    }
    writePrivate(summaryFile, summary, fsImpl);
    return { output, summary, reused: false };
  } finally {
    const owner = path.join(lock, "owner.private.json");
    if (fsImpl.existsSync(owner)) fsImpl.unlinkSync(owner);
    if (fsImpl.existsSync(lock)) fsImpl.rmdirSync(lock);
  }
}

async function main(argv = process.argv.slice(2)) {
  return run(parseArguments(argv));
}

if (require.main === module) {
  main()
    .then((result) =>
      console.log(
        `[targeted-qa-all50] COMPLETE: ${result.summary.pairCount} Paare in ${result.output}`
      )
    )
    .catch((error) => {
      console.error(`[targeted-qa-all50] ${error.message}`);
      process.exit(1);
    });
}

module.exports = {
  EXPECTED_PAIR_COUNT,
  SUMMARY_FILENAME,
  parseArguments,
  run,
  verifyRuntime,
};

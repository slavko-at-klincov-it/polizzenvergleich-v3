#!/usr/bin/env node

process.umask(0o077);

const fs = require("fs");
const path = require("path");
const {
  AUDIT_CASE_CONTRACT_ID,
  SYSTEM_PROMPT,
  buildAuditCase,
  buildSourceChunks,
  canonicalJson,
  parseDocumentPages,
  rankCandidates,
  sha256,
} = require("../../utils/policyAnalysis/lfReferenceReviewAudit");

const INDEX_CONTRACT_ID = "LF_PARTIAL_COUNTERPART_AUDIT_INDEX_V1";

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value)
      throw new Error(`LF_REFERENCE_AUDIT_ARGUMENT_INVALID:${key || "-"}`);
    values[key.slice(2)] = value;
  }
  const allowed = new Set(["runRoot", "output", "sourceCommit", "expectedCount"]);
  const unknown = Object.keys(values).filter((key) => !allowed.has(key));
  if (unknown.length)
    throw new Error(`LF_REFERENCE_AUDIT_ARGUMENT_UNKNOWN:${unknown.join(",")}`);
  for (const required of ["runRoot", "output", "sourceCommit", "expectedCount"])
    if (!values[required])
      throw new Error(`LF_REFERENCE_AUDIT_ARGUMENT_REQUIRED:${required}`);
  if (!/^[a-f0-9]{40}$/u.test(values.sourceCommit))
    throw new Error("LF_REFERENCE_AUDIT_SOURCE_COMMIT_INVALID");
  const expectedCount = Number(values.expectedCount);
  if (!Number.isSafeInteger(expectedCount) || expectedCount < 1)
    throw new Error("LF_REFERENCE_AUDIT_EXPECTED_COUNT_INVALID");
  return {
    runRoot: path.resolve(values.runRoot),
    output: path.resolve(values.output),
    sourceCommit: values.sourceCommit,
    expectedCount,
  };
}

function readRegular(file, label, fsImpl = fs) {
  if (!fsImpl.existsSync(file))
    throw new Error(`LF_REFERENCE_AUDIT_${label}_MISSING`);
  const stat = fsImpl.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink())
    throw new Error(`LF_REFERENCE_AUDIT_${label}_INVALID`);
  return fsImpl.readFileSync(file);
}

function readJson(file, label, fsImpl = fs) {
  try {
    return JSON.parse(readRegular(file, label, fsImpl).toString("utf8"));
  } catch (error) {
    if (error.message.startsWith("LF_REFERENCE_AUDIT_")) throw error;
    throw new Error(`LF_REFERENCE_AUDIT_${label}_JSON_INVALID`);
  }
}

function requireDirectory(directory, label, fsImpl = fs) {
  if (!fsImpl.existsSync(directory))
    throw new Error(`LF_REFERENCE_AUDIT_${label}_MISSING`);
  const stat = fsImpl.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink())
    throw new Error(`LF_REFERENCE_AUDIT_${label}_INVALID`);
}

function writePrivateJson(file, value, fsImpl = fs) {
  fsImpl.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.tmp-${process.pid}`;
  fsImpl.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  fsImpl.renameSync(temporary, file);
  fsImpl.chmodSync(file, 0o600);
}

function resultBindings(runRoot, comparison, files, fsImpl = fs) {
  const bindingFiles = Object.fromEntries(
    Object.entries(files).map(([key, file]) => [
      key,
      { path: file, sha256: sha256(readRegular(file, key, fsImpl)) },
    ])
  );
  return {
    sourceRunRoot: runRoot,
    comparisonMode: comparison.comparisonMode,
    resultContractId: comparison.contractId,
    resultSchemaVersion: comparison.schemaVersion,
    runSignature: comparison.runSignature,
    productProfileId: comparison.productProfile?.id,
    semanticRequirementManifestSha256:
      comparison.template?.semanticRequirementManifestSha256,
    sourceBlockLedgerSha256: comparison.template?.sourceBlockLedgerSha256,
    files: bindingFiles,
  };
}

function findDocumentDirectory(runRoot, document, fsImpl = fs) {
  const expected = `B-${String(document.position + 1).padStart(2, "0")}-${
    document.uuid
  }`;
  const directory = path.join(runRoot, "documents", expected);
  requireDirectory(directory, "DOCUMENT_DIRECTORY", fsImpl);
  return directory;
}

function productionEvidenceForRow({
  documentDirectories,
  categoryView,
  analysisRowId,
  fsImpl = fs,
}) {
  return documentDirectories.map(({ document, directory }) => {
    const files = {
      rows: path.join(directory, categoryView, "result", "rows.private.json"),
      judgements: path.join(
        directory,
        categoryView,
        "effects",
        "materialized.private.json"
      ),
      selectedSources: path.join(
        directory,
        categoryView,
        "effects",
        "selected-sources.private.json"
      ),
      requestedFields: path.join(
        directory,
        categoryView,
        "result",
        "requested-fields.private.json"
      ),
    };
    const rows = readJson(files.rows, "ROWS", fsImpl);
    const materialized = readJson(files.judgements, "JUDGEMENTS", fsImpl);
    const selectedSources = readJson(
      files.selectedSources,
      "SELECTED_SOURCES",
      fsImpl
    );
    const requestedFields = readJson(
      files.requestedFields,
      "REQUESTED_FIELDS",
      fsImpl
    );
    const row = rows.find(({ categoryId }) => categoryId === analysisRowId);
    const judgements = (materialized.judgements ?? []).filter(
      ({ requirementId }) => requirementId === analysisRowId
    );
    if (!row || judgements.length === 0)
      throw new Error(
        `LF_REFERENCE_AUDIT_PRODUCTION_EVIDENCE_MISSING:${document.uuid}:${analysisRowId}`
      );
    return {
      documentUuid: document.uuid,
      documentName: document.originalName,
      documentRole: document.role,
      documentStatus: document.documentStatus,
      row,
      judgements,
      selectedSources: selectedSources.filter(
        ({ requirementId }) => requirementId === analysisRowId
      ),
      requestedFields: (requestedFields.requirements ?? []).find(
        ({ requirementId }) => requirementId === analysisRowId
      ),
      artifactSha256: Object.fromEntries(
        Object.entries(files).map(([key, file]) => [
          key,
          sha256(readRegular(file, key, fsImpl)),
        ])
      ),
    };
  });
}

function build(args, { fsImpl = fs } = {}) {
  requireDirectory(args.runRoot, "RUN_ROOT", fsImpl);
  const files = {
    comparison: path.join(args.runRoot, "result", "comparison.private.json"),
    resultArtifactSet: path.join(
      args.runRoot,
      "result",
      "artifact-set-manifest.private.json"
    ),
    inputManifest: path.join(args.runRoot, "input-manifest.private.json"),
    templateArtifactSet: path.join(
      args.runRoot,
      "reference-template",
      "artifact-set-manifest.private.json"
    ),
    semanticManifest: path.join(
      args.runRoot,
      "reference-template",
      "semantic-requirement-manifest.private.json"
    ),
    sourceLedger: path.join(
      args.runRoot,
      "reference-template",
      "source-block-ledger.private.json"
    ),
  };
  const comparison = readJson(files.comparison, "COMPARISON", fsImpl);
  const input = readJson(files.inputManifest, "INPUT_MANIFEST", fsImpl);
  const manifest = readJson(files.semanticManifest, "SEMANTIC_MANIFEST", fsImpl);
  const inputSideA = (input.documents ?? []).filter(({ side }) => side === "A");
  const inputSideB = (input.documents ?? []).filter(({ side }) => side === "B");
  if (
    comparison.contractId !== "LF_DYNAMIC_REFERENCE_A_TO_B_RESULT_V1" ||
    comparison.comparisonMode !== "LF_IMMO_REFERENCE_A_TO_B_V1" ||
    input.comparisonMode !== comparison.comparisonMode ||
    inputSideA.length !== 1 ||
    inputSideB.length < 1 ||
    inputSideB.length > 9 ||
    !Array.isArray(comparison.documents) ||
    comparison.documents.length !== input.documents.length ||
    input.documents.some((document) => {
      const resultDocument = comparison.documents.find(
        ({ uuid }) => uuid === document.uuid
      );
      return (
        !resultDocument ||
        resultDocument.side !== document.side ||
        resultDocument.sha256 !== document.sha256
      );
    }) ||
    comparison.template?.semanticRequirementManifestSha256 !==
      manifest.manifestSha256
  )
    throw new Error("LF_REFERENCE_AUDIT_BASE_CONTRACT_INVALID");

  const rows = comparison.categories.flatMap((category) =>
    category.rows.map((row) => ({ ...row, categoryView: category.categoryView }))
  );
  const recomputedOutcomes = Object.fromEntries(
    Object.keys(comparison.totals.outcomes).map((outcome) => [
      outcome,
      rows.filter((row) => row.outcome === outcome).length,
    ])
  );
  if (
    rows.length !== comparison.totals.rows ||
    canonicalJson(recomputedOutcomes) !== canonicalJson(comparison.totals.outcomes)
  )
    throw new Error("LF_REFERENCE_AUDIT_BASE_TOTALS_INVALID");
  const targets = rows
    .filter(({ outcome }) => outcome === "TEILWEISES_GEGENSTUECK")
    .sort((left, right) => left.sourceOrder - right.sourceOrder);
  if (
    targets.length !== args.expectedCount ||
    new Set(targets.map(({ analysisRowId }) => analysisRowId)).size !==
      targets.length
  )
    throw new Error(
      `LF_REFERENCE_AUDIT_TARGET_COUNT_INVALID:${targets.length}:${args.expectedCount}`
    );

  const inputByUuid = new Map(
    input.documents.map((document) => [document.uuid, document])
  );
  const bDocuments = input.documents
    .filter(({ side }) => side === "B")
    .sort((left, right) => left.position - right.position);
  if (bDocuments.length === 0)
    throw new Error("LF_REFERENCE_AUDIT_SIDE_B_EMPTY");
  const documentDirectories = bDocuments.map((document) => ({
    document,
    directory: findDocumentDirectory(args.runRoot, document, fsImpl),
  }));
  const documents = documentDirectories.map(({ document, directory }) => {
    if (inputByUuid.get(document.uuid) !== document)
      throw new Error("LF_REFERENCE_AUDIT_DOCUMENT_IDENTITY_INVALID");
    const artifactFile = path.join(directory, "document.private.json");
    const artifact = readJson(artifactFile, "DOCUMENT_ARTIFACT", fsImpl);
    if (
      artifact.fingerprint !== document.sha256 ||
      artifact.document?.sourceDocumentId !== document.sha256
    )
      throw new Error(
        `LF_REFERENCE_AUDIT_DOCUMENT_HASH_MISMATCH:${document.uuid}`
      );
    return {
      uuid: document.uuid,
      position: document.position,
      name: document.originalName,
      role: document.role,
      documentStatus: document.documentStatus,
      sha256: document.sha256,
      artifactSha256: sha256(readRegular(artifactFile, "DOCUMENT_ARTIFACT", fsImpl)),
      pages: parseDocumentPages(
        artifact.document.pageContent,
        artifact.document.pageMap
      ),
    };
  });
  const chunks = buildSourceChunks(documents);
  const sourceInventory = documents.map(({ pages, ...document }) => ({
    ...document,
    pageCount: pages.length,
  }));
  const requirementById = new Map(
    manifest.requirements.map((requirement) => [
      requirement.requirementId,
      requirement,
    ])
  );
  const bindings = {
    ...resultBindings(args.runRoot, comparison, files, fsImpl),
    sourceCommit: args.sourceCommit,
  };

  const cases = [];
  for (const row of targets) {
    const requirement = requirementById.get(row.categoryId);
    if (!requirement)
      throw new Error(`LF_REFERENCE_AUDIT_REQUIREMENT_MISSING:${row.categoryId}`);
    const retrieval = rankCandidates({ row, requirement, chunks });
    const productionEvidence = productionEvidenceForRow({
      documentDirectories,
      categoryView: row.categoryView,
      analysisRowId: row.analysisRowId,
      fsImpl,
    });
    const auditCase = buildAuditCase({
      row,
      requirement,
      retrieval,
      sourceInventory,
      productionEvidence,
      bindings,
    });
    cases.push(auditCase);
  }

  const targetIdentity = cases.map((auditCase) => ({
    sourceOrder: auditCase.sourceOrder,
    caseId: auditCase.caseId,
    requirementId: auditCase.requirementId,
    inputSha256: auditCase.inputSha256,
  }));
  const index = {
    schemaVersion: 1,
    contractId: INDEX_CONTRACT_ID,
    auditCaseContractId: AUDIT_CASE_CONTRACT_ID,
    createdAt: new Date().toISOString(),
    advisoryOnly: true,
    primaryResultMutationAllowed: false,
    targetOutcome: "TEILWEISES_GEGENSTUECK",
    expectedCaseCount: args.expectedCount,
    caseCount: cases.length,
    targetSetSha256: sha256(canonicalJson(targetIdentity)),
    systemPromptSha256: sha256(SYSTEM_PROMPT),
    sourceDocumentCount: sourceInventory.length,
    sourcePageCount: sourceInventory.reduce(
      (sum, document) => sum + document.pageCount,
      0
    ),
    sourceChunkCount: chunks.length,
    bindings,
    cases: targetIdentity,
  };
  index.indexSha256 = sha256(canonicalJson(index));

  writePrivateJson(
    path.join(args.output, "source-chunks.private.json"),
    chunks.map(({ normalizedText, tokenSet, ...chunk }) => chunk),
    fsImpl
  );
  for (const auditCase of cases)
    writePrivateJson(
      path.join(args.output, "cases", `${auditCase.caseId}.private.json`),
      auditCase,
      fsImpl
    );
  writePrivateJson(path.join(args.output, "index.private.json"), index, fsImpl);
  return { index, cases };
}

function run() {
  const args = parseArguments(process.argv.slice(2));
  const { index } = build(args);
  console.log(
    `[lf-partial-audit-build] PASS: ${index.caseCount} Fälle, ${index.sourceDocumentCount} B-Dokumente, ${index.sourcePageCount} Seiten`
  );
}

if (require.main === module) {
  try {
    run();
  } catch (error) {
    console.error(`[lf-partial-audit-build] ${error.stack || error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  INDEX_CONTRACT_ID,
  build,
  parseArguments,
  productionEvidenceForRow,
  readJson,
  run,
  writePrivateJson,
};

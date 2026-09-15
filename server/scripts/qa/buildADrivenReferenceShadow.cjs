#!/usr/bin/env node

process.umask(0o077);

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const {
  buildADrivenSourceUnitPlan,
  stableStringify,
} = require("../../utils/policyAnalysis/aDrivenSourceUnitPlan");
const {
  buildSourceBlockLedger,
} = require("../../utils/policyAnalysis/sourceBlockLedger");
const {
  buildADrivenClassificationBatches,
} = require("../../utils/policyAnalysis/aDrivenClassificationContract");
const {
  A_DYNAMIC_MANIFEST_CONTRACT_ID,
  A_DYNAMIC_MANIFEST_CONTRACT_ID_V13,
  buildADrivenSemanticManifest,
} = require("../../utils/policyAnalysis/aDrivenSemanticManifest");
const {
  buildLegacyOracleCrosswalkDraft,
} = require("../../utils/policyAnalysis/aDrivenLegacyOracleCrosswalk");

function fail(message) {
  console.error(`[lf-a-driven-shadow] ${message}`);
  process.exit(1);
}

function argumentsFrom(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value)
      fail(`Ungültiges Argument: ${key || "-"}`);
    const name = key.slice(2);
    if (Object.hasOwn(values, name)) fail(`Doppeltes Argument: ${name}`);
    values[name] = value;
  }
  const allowed = new Set(["runRoot", "responses", "output"]);
  const unknown = Object.keys(values).filter((key) => !allowed.has(key));
  if (unknown.length) fail(`Unbekannte Argumente: ${unknown.join(",")}`);
  for (const required of ["runRoot", "output"])
    if (!values[required]) fail(`--${required} ist erforderlich`);
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, path.resolve(value)])
  );
}

function readJson(file, code) {
  if (!fs.existsSync(file)) throw new Error(`${code}_MISSING`);
  const stat = fs.lstatSync(file);
  if (stat.isSymbolicLink() || !stat.isFile())
    throw new Error(`${code}_INVALID`);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    throw new Error(`${code}_INVALID`);
  }
}

function manifestDigest(manifest) {
  const { manifestSha256: _manifestSha256, ...payload } = manifest;
  return crypto
    .createHash("sha256")
    .update(`${manifest.contractId}\u0000${stableStringify(payload)}`)
    .digest("hex");
}

function compatiblePredecessorUnclassifiedManifest(existing, current) {
  if (
    existing?.contractId !== A_DYNAMIC_MANIFEST_CONTRACT_ID_V13 ||
    current?.contractId !== A_DYNAMIC_MANIFEST_CONTRACT_ID ||
    existing?.manifestSha256 !== manifestDigest(existing)
  )
    return false;
  const stripVersion = (manifest) => {
    const {
      contractId: _contractId,
      manifestSha256: _manifestSha256,
      ...payload
    } = manifest;
    return payload;
  };
  return (
    stableStringify(stripVersion(existing)) ===
    stableStringify(stripVersion(current))
  );
}

function compatiblePredecessorShadowSummary(
  existing,
  current,
  predecessorManifest
) {
  if (
    !predecessorManifest ||
    existing?.contractId !== current?.contractId ||
    existing?.sourceUnitPlanSha256 !== current?.sourceUnitPlanSha256 ||
    existing?.dynamicManifestSha256 !== predecessorManifest.manifestSha256
  )
    return false;
  const withoutManifestDigest = (summary) => {
    const { dynamicManifestSha256: _dynamicManifestSha256, ...payload } =
      summary;
    return payload;
  };
  return (
    stableStringify(withoutManifestDigest(existing)) ===
    stableStringify(withoutManifestDigest(current))
  );
}

function archivedCompatiblePredecessorManifest(archiveDirectory, current) {
  if (!fs.existsSync(archiveDirectory)) return null;
  const matches = fs
    .readdirSync(archiveDirectory)
    .filter((name) => name.startsWith("dynamic-semantic-manifest."))
    .map((name) => path.join(archiveDirectory, name))
    .filter((file) => {
      const stat = fs.lstatSync(file);
      return stat.isFile() && !stat.isSymbolicLink();
    })
    .map((file) => readJson(file, "LF_A_SHADOW_PREDECESSOR_MANIFEST"))
    .filter((existing) =>
      compatiblePredecessorUnclassifiedManifest(existing, current)
    );
  if (matches.length > 1)
    throw new Error("LF_A_SHADOW_PREDECESSOR_ARCHIVE_AMBIGUOUS");
  return matches[0] || null;
}

function writePrivateJson(
  file,
  value,
  { compatibleExisting = null, archiveDirectory = null } = {}
) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const bytes = `${JSON.stringify(value, null, 2)}\n`;
  if (fs.existsSync(file)) {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink())
      throw new Error(`LF_A_SHADOW_EXISTING_OUTPUT_INVALID:${file}`);
    const existingBytes = fs.readFileSync(file, "utf8");
    if (existingBytes === bytes)
      return { status: "REUSED_IDENTICAL", predecessor: null };
    let existing = null;
    try {
      existing = JSON.parse(existingBytes);
    } catch {
      // The regular fail-closed mismatch below intentionally handles this.
    }
    if (!compatibleExisting?.(existing, value) || !archiveDirectory)
      throw new Error(`LF_A_SHADOW_RESUME_MISMATCH:${file}`);
    fs.mkdirSync(archiveDirectory, { recursive: true, mode: 0o700 });
    const existingIdentity =
      existing.manifestSha256 ||
      crypto.createHash("sha256").update(existingBytes).digest("hex");
    const archiveFile = path.join(
      archiveDirectory,
      `${path.basename(file, ".private.json")}.${existing.contractId}.${existingIdentity}.private.json`
    );
    if (fs.existsSync(archiveFile))
      throw new Error(`LF_A_SHADOW_PREDECESSOR_ARCHIVE_EXISTS:${archiveFile}`);
    fs.renameSync(file, archiveFile);
    fs.chmodSync(archiveFile, 0o600);
    const temporary = `${file}.tmp-${process.pid}`;
    fs.writeFileSync(temporary, bytes, {
      encoding: "utf8",
      mode: 0o600,
    });
    fs.renameSync(temporary, file);
    fs.chmodSync(file, 0o600);
    return {
      status: "UPGRADED_COMPATIBLE_PREDECESSOR",
      predecessor: existing,
      archiveFile,
    };
  }
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, bytes, {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.renameSync(temporary, file);
  fs.chmodSync(file, 0o600);
  return { status: "WRITTEN_NEW", predecessor: null };
}

function documentDirectory(runRoot, document) {
  return path.join(
    runRoot,
    "documents",
    `${document.side}-${String(document.position + 1).padStart(2, "0")}-${document.uuid}`
  );
}

function loadADocuments(runRoot) {
  const manifest = readJson(
    path.join(runRoot, "input-manifest.private.json"),
    "LF_A_SHADOW_INPUT_MANIFEST"
  );
  const documents = manifest.documents
    .filter(({ side }) => side === "A")
    .sort((left, right) => left.position - right.position)
    .map((document) => {
      const artifact = readJson(
        path.join(
          documentDirectory(runRoot, document),
          "document.private.json"
        ),
        "LF_A_SHADOW_DOCUMENT_ARTIFACT"
      );
      return {
        document,
        artifact,
        ledger: buildSourceBlockLedger(artifact),
      };
    });
  if (!documents.length) throw new Error("LF_A_SHADOW_DOCUMENTS_MISSING");
  return documents;
}

function run() {
  const args = argumentsFrom(process.argv.slice(2));
  if (fs.existsSync(args.output)) {
    const stat = fs.lstatSync(args.output);
    if (!stat.isDirectory() || stat.isSymbolicLink())
      throw new Error("LF_A_SHADOW_EXISTING_OUTPUT_INVALID");
  }
  const sourceDocuments = loadADocuments(args.runRoot);
  const plan = buildADrivenSourceUnitPlan({ documents: sourceDocuments });
  const classificationBatches = buildADrivenClassificationBatches(plan);
  const responses = args.responses
    ? readJson(args.responses, "LF_A_SHADOW_RESPONSES")
    : [];
  if (!Array.isArray(responses))
    throw new Error("LF_A_SHADOW_RESPONSES_INVALID");
  const dynamicManifest = buildADrivenSemanticManifest({ plan, responses });
  const legacyManifestFile = path.join(
    args.runRoot,
    "reference-template",
    "semantic-requirement-manifest.private.json"
  );
  const legacyCrosswalkDraft = fs.existsSync(legacyManifestFile)
    ? buildLegacyOracleCrosswalkDraft({
        dynamicManifest,
        legacyManifest: readJson(
          legacyManifestFile,
          "LF_A_SHADOW_LEGACY_MANIFEST"
        ),
      })
    : null;
  fs.mkdirSync(args.output, { recursive: true, mode: 0o700 });
  for (const { document, ledger } of sourceDocuments)
    writePrivateJson(
      path.join(
        args.output,
        "source-ledgers",
        `A-${String(document.position + 1).padStart(2, "0")}-${document.uuid}.private.json`
      ),
      ledger
    );
  writePrivateJson(
    path.join(args.output, "source-unit-plan.private.json"),
    plan
  );
  writePrivateJson(
    path.join(args.output, "classification-batches.private.json"),
    classificationBatches
  );
  const dynamicManifestWrite = writePrivateJson(
    path.join(args.output, "dynamic-semantic-manifest.private.json"),
    dynamicManifest,
    {
      compatibleExisting: compatiblePredecessorUnclassifiedManifest,
      archiveDirectory: path.join(args.output, "superseded"),
    }
  );
  const predecessorManifest =
    dynamicManifestWrite.predecessor ||
    archivedCompatiblePredecessorManifest(
      path.join(args.output, "superseded"),
      dynamicManifest
    );
  if (legacyCrosswalkDraft)
    writePrivateJson(
      path.join(args.output, "legacy-283-crosswalk-draft.private.json"),
      legacyCrosswalkDraft
    );
  const summary = {
    contractId: "LF_REFERENCE_A_DRIVEN_SHADOW_V1",
    runContractId: plan.runContractId,
    sourceUnitPlanSha256: plan.planSha256,
    dynamicManifestSha256: dynamicManifest.manifestSha256,
    documents: plan.summary.documents,
    sourceBlocks: plan.summary.sourceBlocks,
    plannedUnits: plan.summary.plannedUnits,
    classificationBatches: classificationBatches.summary.batches,
    semanticRequirements: dynamicManifest.summary.semanticRequirements,
    semanticComponents: dynamicManifest.summary.semanticComponents,
    unresolvedUnits: dynamicManifest.summary.unresolvedUnits,
    reviewRequiredBlocks: dynamicManifest.summary.reviewRequiredBlocks,
    responseIntegrityStatus: dynamicManifest.summary.responseIntegrityStatus,
    legacyRequirements:
      legacyCrosswalkDraft?.summary.legacyRequirements ?? null,
    legacyComponents: legacyCrosswalkDraft?.summary.legacyComponents ?? null,
    legacyCoveredComponents:
      legacyCrosswalkDraft?.summary.coveredComponents ?? null,
    acceptanceReady: false,
    proofLimit:
      "Shadow-Artefakt. Ohne validierte bounded Modellantworten, getrennte A-Block-, Segmentierungs- und Atomizitätsgates, vollständige B-Suche und Gegenstückprüfung, Mutations-, symmetrische Nichtregressions- und Holdout-Gates keine Produkt- oder Vollständigkeitsfreigabe. Der 283/631-Crosswalk ist ausschließlich Regressionsevidenz.",
  };
  writePrivateJson(path.join(args.output, "summary.private.json"), summary, {
    compatibleExisting: (existing, current) =>
      compatiblePredecessorShadowSummary(
        existing,
        current,
        predecessorManifest
      ),
    archiveDirectory: path.join(args.output, "superseded"),
  });
  console.log(
    `[lf-a-driven-shadow] ${summary.sourceBlocks} Blöcke, ${summary.plannedUnits} Units, ${summary.semanticRequirements} Requirements, ${summary.unresolvedUnits} Units ungeklärt`
  );
}

if (require.main === module) {
  try {
    run();
  } catch (error) {
    fail(error.stack || error.message);
  }
}

module.exports = {
  archivedCompatiblePredecessorManifest,
  compatiblePredecessorShadowSummary,
  compatiblePredecessorUnclassifiedManifest,
  manifestDigest,
  writePrivateJson,
};

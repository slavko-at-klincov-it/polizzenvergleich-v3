#!/usr/bin/env node

process.umask(0o077);

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  loadHybridShadowContract,
  buildHybridShadowTargets,
} = require("../../utils/policyAnalysis/hybridShadowSearch");
const {
  loadHybridShadowPilot,
  pilotCasesForWorksheet,
} = require("../../utils/policyAnalysis/hybridShadowPilot");
const { releaseIdentity } = require("../../utils/policyAnalysis/runIdentity");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../..");

function fail(message) {
  console.error(`[hybrid-shadow-pilot-manifest] ${message}`);
  process.exit(1);
}

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value) fail(`Ungültiges Argument: ${key}`);
    values[key.slice(2)] = value;
  }
  return values;
}

function readJson(file, label) {
  if (!fs.existsSync(file)) fail(`${label} fehlt: ${file}`);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    fail(`${label} ist kein gültiges JSON: ${error.message}`);
  }
}

function sha256File(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function writePrivateJson(file, value) {
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.renameSync(temporary, file);
  fs.chmodSync(file, 0o600);
}

function run() {
  const args = parseArguments(process.argv.slice(2));
  const allowed = new Set([
    "pilotFile",
    "contractFile",
    "output",
    "model",
    "modelTokenLimit",
  ]);
  const unknown = Object.keys(args).filter((key) => !allowed.has(key));
  if (unknown.length) fail(`Unbekannte Argumente: ${unknown.join(",")}`);
  for (const required of allowed)
    if (!args[required]) fail(`--${required} ist erforderlich`);

  const pilotFile = path.resolve(args.pilotFile);
  const contractFile = path.resolve(args.contractFile);
  const output = path.resolve(args.output);
  const { pilot, identity: pilotIdentity } = loadHybridShadowPilot(pilotFile);
  const { contract, identity: contractIdentity } =
    loadHybridShadowContract(contractFile);
  if (!contract.enabled) fail("Der explizite Embeddingvertrag ist deaktiviert");
  if (
    output === REPOSITORY_ROOT ||
    output.startsWith(`${REPOSITORY_ROOT}${path.sep}`) ||
    pilot.documents.some(
      ({ primaryOutput }) =>
        output === primaryOutput ||
        output.startsWith(`${primaryOutput}${path.sep}`)
    )
  )
    fail("Pilot-Ausgabe muss außerhalb von Repository und Primärläufen liegen");
  if (fs.existsSync(output))
    fail(`Pilot-Ausgabe existiert bereits; Resume abgelehnt: ${output}`);

  const documents = pilot.documents.map((pilotDocument, documentIndex) => {
    const primaryOutput = pilotDocument.primaryOutput;
    const primaryManifestFile = path.join(
      primaryOutput,
      "manifest.private.json"
    );
    const documentArtifactFile = path.join(
      primaryOutput,
      "document.private.json"
    );
    const primaryManifest = readJson(
      primaryManifestFile,
      `Primärmanifest ${documentIndex + 1}`
    );
    const documentArtifact = readJson(
      documentArtifactFile,
      `Dokument-Artefakt ${documentIndex + 1}`
    );
    if (
      primaryManifest?.runKind !== "ALL_CATEGORIES_QUALITY" ||
      !new Set(["FRAMEWORK_TERMS", "PROPOSAL", "ACTIVE"]).has(
        primaryManifest.configuration?.documentStatus
      ) ||
      documentArtifact?.schemaVersion !== 1 ||
      documentArtifact.fingerprint !== pilotDocument.documentFingerprint ||
      primaryManifest.releaseId !== pilotDocument.primaryReleaseId ||
      sha256File(documentArtifactFile) !==
        pilotDocument.documentArtifactSha256
    )
      fail(`Primärlauf ${documentIndex + 1} ist nicht pilotfähig`);

    const categories = [
      ...new Set(pilotDocument.cases.map(({ categoryView }) => categoryView)),
    ].map((categoryView) => {
      const worksheetFile = path.join(
        primaryOutput,
        categoryView,
        "worksheet.private.json"
      );
      const resultReportFile = path.join(
        primaryOutput,
        categoryView,
        "result",
        "report.json"
      );
      const worksheet = readJson(
        worksheetFile,
        `${categoryView}-Primär-Worksheet`
      );
      readJson(resultReportFile, `${categoryView}-Primärergebnisreport`);
      const selectedCases = pilotCasesForWorksheet({
        pilotDocument,
        worksheet,
      });
      if (selectedCases.length === 0)
        fail(`${categoryView} enthält keinen Pilotfall`);
      if (
        selectedCases.some(
          ({ primaryWorksheetSha256 }) =>
            primaryWorksheetSha256 !== sha256File(worksheetFile)
        )
      )
        fail(`${categoryView}-Worksheet stimmt nicht mit dem Oracle überein`);
      for (const pilotCase of selectedCases) {
        for (const range of [
          ...pilotCase.acceptedSourceRanges,
          ...pilotCase.knownAdversarialSourceRanges,
        ]) {
          const page = documentArtifact.document?.pageMap?.find(
            ({ pageNumber }) => pageNumber === range.physicalPageNumber
          );
          const exactText = documentArtifact.document?.pageContent?.slice(
            range.documentStart,
            range.documentEnd
          );
          if (
            !page ||
            range.documentStart < page.start ||
            range.documentEnd > page.end ||
            sha256(exactText || "") !== range.exactQuoteSha256
          )
            fail(`Oracle-Quellbereich ist ungültig: ${pilotCase.caseId}`);
        }
      }
      buildHybridShadowTargets({
        worksheet,
        contract,
        allowedTargets: selectedCases,
      });
      return {
        categoryView,
        worksheetPath: worksheetFile,
        worksheetSha256: sha256File(worksheetFile),
        resultReportPath: resultReportFile,
        resultReportSha256: sha256File(resultReportFile),
        cases: selectedCases.map(
          ({ caseId, requirementId, componentId }) => ({
            caseId,
            requirementId,
            componentId,
          })
        ),
      };
    });
    return {
      documentIndex,
      documentFingerprint: pilotDocument.documentFingerprint,
      primaryOutput,
      primaryManifestPath: primaryManifestFile,
      primaryManifestSha256: sha256File(primaryManifestFile),
      primaryReleaseId: primaryManifest.releaseId,
      documentStatus: primaryManifest.configuration.documentStatus,
      documentArtifactPath: documentArtifactFile,
      documentArtifactSha256: sha256File(documentArtifactFile),
      categories,
    };
  });

  const modelTokenLimit = Number(args.modelTokenLimit);
  if (!Number.isInteger(modelTokenLimit) || modelTokenLimit < 1)
    fail("modelTokenLimit ist ungültig");
  const manifest = {
    schemaVersion: 1,
    runKind: "HYBRID_SHADOW_TWO_PHASE_PILOT_QA",
    status: "CREATED",
    shadowOnly: true,
    primaryMutationAllowed: false,
    customerMaterializationAllowed: false,
    resumeAllowed: false,
    createdAt: new Date().toISOString(),
    implementation: {
      repository: REPOSITORY_ROOT,
      releaseId: releaseIdentity(REPOSITORY_ROOT),
    },
    pilot: {
      ...pilotIdentity,
      pilotFile,
    },
    embeddingContract: {
      ...contractIdentity,
      contractFile,
    },
    qwen: {
      model: args.model,
      modelTokenLimit,
    },
    phaseOrder: ["EMBEDDING_SEARCH", "QWEN_REVIEW"],
    documents,
  };

  fs.mkdirSync(output, { recursive: false, mode: 0o700 });
  writePrivateJson(path.join(output, "manifest.private.json"), manifest);
  console.log(
    `[hybrid-shadow-pilot-manifest] ${pilot.caseCount} Fälle in ${documents.length} Dokument(en) gebunden`
  );
}

try {
  run();
} catch (error) {
  fail(error.stack || error.message);
}

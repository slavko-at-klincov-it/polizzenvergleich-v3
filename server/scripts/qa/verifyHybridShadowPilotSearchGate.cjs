#!/usr/bin/env node

process.umask(0o077);

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  loadHybridShadowPilot,
} = require("../../utils/policyAnalysis/hybridShadowPilot");
const {
  loadHybridShadowContract,
} = require("../../utils/policyAnalysis/hybridShadowSearch");

function fail(message) {
  console.error(`[hybrid-shadow-pilot-gate] ${message}`);
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
    "manifest",
    "pilotFile",
    "contractFile",
    "searchComplete",
    "output",
  ]);
  const unknown = Object.keys(args).filter((key) => !allowed.has(key));
  if (unknown.length) fail(`Unbekannte Argumente: ${unknown.join(",")}`);
  for (const required of allowed)
    if (!args[required]) fail(`--${required} ist erforderlich`);

  const files = Object.fromEntries(
    [...allowed].map((key) => [key, path.resolve(args[key])])
  );
  const manifest = readJson(files.manifest, "Pilot-Manifest");
  const completion = readJson(files.searchComplete, "Search-Completion");
  const { pilot, identity: pilotIdentity } = loadHybridShadowPilot(
    files.pilotFile
  );
  const { identity: contractIdentity } = loadHybridShadowContract(
    files.contractFile
  );
  if (
    manifest?.runKind !== "HYBRID_SHADOW_TWO_PHASE_PILOT_QA" ||
    manifest.shadowOnly !== true ||
    manifest.primaryMutationAllowed !== false ||
    manifest.pilot?.pilotSha256 !== pilotIdentity.pilotSha256 ||
    manifest.embeddingContract?.contractSha256 !==
      contractIdentity.contractSha256 ||
    completion?.artifactKind !== "HYBRID_SHADOW_PILOT_SEARCH_COMPLETE" ||
    completion.status !== "SEARCH_COMPLETE" ||
    completion.shadowOnly !== true ||
    completion.primaryMutationAllowed !== false ||
    completion.contracts?.pilotManifestSha256 !== sha256File(files.manifest) ||
    completion.contracts?.pilotSha256 !== pilotIdentity.pilotSha256 ||
    completion.contracts?.embeddingContractSha256 !==
      contractIdentity.contractSha256 ||
    !Array.isArray(completion.documents) ||
    completion.documents.length !== manifest.documents.length
  )
    fail("Search-Completion ist unvollständig oder identitätsfremd");

  const categories = [];
  const seenCases = new Set();
  for (const manifestDocument of manifest.documents) {
    const completedDocument = completion.documents.find(
      ({ documentIndex }) => documentIndex === manifestDocument.documentIndex
    );
    if (
      !completedDocument ||
      completedDocument.documentFingerprint !==
        manifestDocument.documentFingerprint ||
      !Array.isArray(completedDocument.categories) ||
      completedDocument.categories.length !== manifestDocument.categories.length
    )
      fail(`Dokument ${manifestDocument.documentIndex + 1} ist unvollständig`);
    for (const manifestCategory of manifestDocument.categories) {
      const completedCategory = completedDocument.categories.find(
        ({ categoryView }) =>
          categoryView === manifestCategory.categoryView
      );
      if (!completedCategory)
        fail(`${manifestCategory.categoryView} fehlt in Search-Completion`);
      if (
        sha256File(completedCategory.searchReportPath) !==
          completedCategory.searchReportSha256 ||
        sha256File(completedCategory.shadowWorksheetPath) !==
          completedCategory.shadowWorksheetSha256
      )
        fail(`${manifestCategory.categoryView} wurde nach Search verändert`);
      const report = readJson(
        completedCategory.searchReportPath,
        `${manifestCategory.categoryView}-Searchreport`
      );
      const worksheet = readJson(
        completedCategory.shadowWorksheetPath,
        `${manifestCategory.categoryView}-Shadow-Worksheet`
      );
      const expectedCaseIds = manifestCategory.cases
        .map(({ caseId }) => caseId)
        .sort();
      const reportedCaseIds = report.exactSpanRankings
        .map(({ caseId }) => caseId)
        .sort();
      if (
        report?.artifactKind !== "HYBRID_SHADOW_PILOT_SEARCH_REPORT" ||
        report.status !== "PASS" ||
        report.pilot?.pilotSha256 !== pilotIdentity.pilotSha256 ||
        report.contract?.contractSha256 !== contractIdentity.contractSha256 ||
        report.contracts?.shadowWorksheetSha256 !==
          completedCategory.shadowWorksheetSha256 ||
        worksheet?.shadowSearch?.shadowOnly !== true ||
        worksheet.shadowSearch?.pilot?.pilotSha256 !==
          pilotIdentity.pilotSha256 ||
        expectedCaseIds.length !== reportedCaseIds.length ||
        expectedCaseIds.some((caseId, index) => caseId !== reportedCaseIds[index])
      )
        fail(`${manifestCategory.categoryView} verletzt den Search-Vertrag`);
      for (const caseId of expectedCaseIds) {
        if (seenCases.has(caseId)) fail(`Pilotfall doppelt: ${caseId}`);
        seenCases.add(caseId);
      }
      categories.push({
        documentIndex: manifestDocument.documentIndex,
        documentFingerprint: manifestDocument.documentFingerprint,
        documentStatus: manifestDocument.documentStatus,
        categoryView: manifestCategory.categoryView,
        primaryWorksheetPath: manifestCategory.worksheetPath,
        primaryWorksheetSha256: manifestCategory.worksheetSha256,
        selectedCaseIds: expectedCaseIds,
        searchReportPath: completedCategory.searchReportPath,
        searchReportSha256: completedCategory.searchReportSha256,
        shadowWorksheetPath: completedCategory.shadowWorksheetPath,
        shadowWorksheetSha256: completedCategory.shadowWorksheetSha256,
      });
    }
  }
  if (seenCases.size !== pilot.caseCount)
    fail(`Pilotfallmenge unvollständig: ${seenCases.size}/${pilot.caseCount}`);

  const gate = {
    schemaVersion: 1,
    artifactKind: "HYBRID_SHADOW_PILOT_SEARCH_GATE",
    status: "PASS_QWEN_ALLOWED",
    shadowOnly: true,
    primaryMutationAllowed: false,
    createdAt: new Date().toISOString(),
    contracts: {
      manifestPath: files.manifest,
      manifestSha256: sha256File(files.manifest),
      searchCompletePath: files.searchComplete,
      searchCompleteSha256: sha256File(files.searchComplete),
      pilotSha256: pilotIdentity.pilotSha256,
      embeddingContractSha256: contractIdentity.contractSha256,
    },
    selectedCaseCount: seenCases.size,
    categories,
  };
  writePrivateJson(files.output, gate);
  console.log(
    `[hybrid-shadow-pilot-gate] PASS_QWEN_ALLOWED: ${seenCases.size} Fälle vollständig und hashgebunden`
  );
}

try {
  run();
} catch (error) {
  fail(error.stack || error.message);
}

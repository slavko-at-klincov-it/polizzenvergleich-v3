#!/usr/bin/env node

process.umask(0o077);

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

function fail(message) {
  console.error(`[hybrid-shadow-review] ${message}`);
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
  if (!file || !fs.existsSync(file)) fail(`${label} fehlt: ${file}`);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    fail(`${label} ist kein gültiges JSON: ${error.message}`);
  }
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function sha256File(file) {
  return sha256(fs.readFileSync(file));
}

function writePrivateJson(file, value) {
  const temporary = `${file}.tmp-${process.pid}`;
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
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
    "searchReport",
    "runManifest",
    "primaryWorksheet",
    "documentArtifact",
    "contractFile",
    "worksheet",
    "triage",
    "triageReport",
    "effects",
    "effectsReport",
    "output",
  ]);
  const unknown = Object.keys(args).filter((key) => !allowed.has(key));
  if (unknown.length) fail(`Unbekannte Argumente: ${unknown.join(",")}`);
  for (const required of allowed)
    if (!args[required]) fail(`--${required} ist erforderlich`);

  const files = Object.fromEntries(
    [...allowed]
      .filter((key) => key !== "output")
      .map((key) => [key, path.resolve(args[key])])
  );
  const searchReport = readJson(files.searchReport, "Shadow-Suchreport");
  const runManifest = readJson(files.runManifest, "Shadow-Laufmanifest");
  const primaryWorksheet = readJson(
    files.primaryWorksheet,
    "Primär-Worksheet"
  );
  const worksheet = readJson(files.worksheet, "Shadow-Worksheet");
  const triage = readJson(files.triage, "Shadow-Triage");
  const triageReport = readJson(files.triageReport, "Shadow-Triage-Report");
  const effects = readJson(files.effects, "Shadow-Wirkungsprüfung");
  const effectsReport = readJson(
    files.effectsReport,
    "Shadow-Wirkungsreport"
  );
  const worksheetSha256 = sha256File(files.worksheet);
  const primaryWorksheetSha256 = sha256File(files.primaryWorksheet);
  const documentArtifactSha256 = sha256File(files.documentArtifact);
  const triageSha256 = sha256File(files.triage);
  const effectsSha256 = sha256File(files.effects);
  const {
    identity: currentContractIdentity,
  } = require("../../utils/policyAnalysis/hybridShadowSearch").loadHybridShadowContract(
    files.contractFile
  );
  if (
    searchReport?.artifactKind !== "HYBRID_SHADOW_SEARCH_REPORT" ||
    searchReport.shadowOnly !== true ||
    searchReport.primaryMutationAllowed !== false ||
    runManifest?.runKind !== "HYBRID_SHADOW_RECALL_QA" ||
    runManifest.shadowOnly !== true ||
    runManifest.primaryMutationAllowed !== false ||
    runManifest.resumeAllowed !== false ||
    searchReport.contracts?.shadowRunManifestSha256 !==
      sha256File(files.runManifest) ||
    searchReport.runtimeVerification?.modelArtifactSha256 !==
      runManifest.contract?.provider?.modelArtifactSha256 ||
    searchReport.runtimeVerification?.modelIdReportedByEmbeddingResponse !==
      (searchReport.input?.eligibleZeroPrimaryComponentCount > 0
        ? runManifest.contract?.provider?.model
        : null) ||
    searchReport.runtimeVerification?.runtimeRevision !==
      runManifest.contract?.provider?.runtimeRevision ||
    searchReport.runtimeVerification?.runtimeArtifactSha256 !==
      runManifest.contract?.provider?.runtimeArtifactSha256 ||
    worksheet?.shadowSearch?.shadowOnly !== true ||
    currentContractIdentity.enabled !== true ||
    searchReport.contract?.contractSha256 !==
      currentContractIdentity.contractSha256 ||
    searchReport.contracts?.primaryWorksheetSha256 !==
      primaryWorksheetSha256 ||
    searchReport.contracts?.documentArtifactSha256 !==
      documentArtifactSha256 ||
    worksheet.shadowSearch.primaryWorksheetSha256 !==
      primaryWorksheetSha256 ||
    worksheet.shadowSearch.documentArtifactSha256 !==
      documentArtifactSha256 ||
    searchReport.contracts?.shadowWorksheetSha256 !== worksheetSha256 ||
    triageReport.contracts?.worksheetSha256 !== worksheetSha256 ||
    triageReport.contracts?.materializedTriageSha256 !== triageSha256 ||
    effectsReport.contracts?.worksheetSha256 !== worksheetSha256 ||
    effectsReport.contracts?.triageSha256 !== triageSha256 ||
    effectsReport.contracts?.materializedEvidenceSha256 !== effectsSha256 ||
    triageReport.model?.id !== runManifest.analysis?.model ||
    triageReport.model?.declaredTokenLimit !==
      runManifest.analysis?.modelTokenLimit ||
    effectsReport.model?.id !== runManifest.analysis?.model ||
    effectsReport.contracts?.documentStatus !==
      runManifest.analysis?.documentStatus ||
    new Set(["PASS", "TECHNICAL_PASS_REVIEW_REQUIRED"]).has(
      triageReport.status
    ) === false ||
    new Set(["PASS", "TECHNICAL_PASS_REVIEW_REQUIRED"]).has(
      effectsReport.status
    ) === false
  )
    fail("Shadow-Artefaktkette ist unvollständig oder identitätsfremd");

  const primaryComponentByKey = new Map();
  for (const requirement of primaryWorksheet.requirements || [])
    for (const component of requirement.components || [])
      primaryComponentByKey.set(`${requirement.id}:${component.id}`, component);

  const triageByCandidate = new Map(
    triage.map((candidate) => [candidate.candidateId, candidate])
  );
  const effectByComponent = new Map(
    effects.judgements.map((judgement) => [
      `${judgement.requirementId}:${judgement.componentId}`,
      judgement,
    ])
  );
  const candidates = [];
  const targetReviews = [];
  for (const requirement of worksheet.requirements) {
    for (const component of requirement.components) {
      const targetKey = `${requirement.id}:${component.id}`;
      const primaryComponent = primaryComponentByKey.get(targetKey);
      if (
        !primaryComponent ||
        primaryComponent.occurrenceCount !== 0 ||
        !Array.isArray(primaryComponent.occurrences) ||
        primaryComponent.occurrences.length !== 0 ||
        primaryComponent.terminalState !== "NO_CONTROLLED_CANDIDATE"
      )
        fail(`Primär-Nullvertrag fehlt: ${targetKey}`);
      const effect = effectByComponent.get(targetKey);
      if (!effect) fail(`Wirkung fehlt: ${requirement.id}:${component.id}`);
      targetReviews.push({
        requirementId: requirement.id,
        componentId: component.id,
        primaryCandidateCount: primaryComponent.occurrenceCount,
        shadowCandidateCount: component.occurrences.length,
        shadowSelectedCandidateCount: effect.selectedCandidateIds.length,
        labels: {
          groundTruth: "UNREVIEWED",
          primaryRecall: "UNREVIEWED",
          confusionClass: "UNREVIEWED",
          reviewerNote: null,
        },
      });
      for (const occurrence of component.occurrences) {
        const candidateTriage = triageByCandidate.get(occurrence.candidateId);
        if (!candidateTriage)
          fail(`Triage fehlt: ${occurrence.candidateId}`);
        if (
          occurrence.context?.text !== occurrence.exactText ||
          occurrence.context?.documentStart !== occurrence.documentStart ||
          occurrence.context?.documentEnd !== occurrence.documentEnd
        )
          fail(`Exakte Shadow-Quote ist inkonsistent: ${occurrence.candidateId}`);
        candidates.push({
          requirementId: requirement.id,
          componentId: component.id,
          candidateId: occurrence.candidateId,
          discoveryMethod: occurrence.discoveryMethod,
          source: {
            documentFingerprint: worksheet.document.fingerprint,
            documentTitle: worksheet.document.title,
            physicalPageNumber: occurrence.physicalPageNumber,
            pageStart: occurrence.pageStart,
            pageEnd: occurrence.pageEnd,
            documentStart: occurrence.documentStart,
            documentEnd: occurrence.documentEnd,
            exactQuote: occurrence.exactText,
            exactQuoteSha256: sha256(occurrence.exactText),
          },
          retrieval: occurrence.retrieval,
          triage: {
            binding: candidateTriage.binding,
          },
          evidence: {
            selected: effect.selectedCandidateIds.includes(
              occurrence.candidateId
            ),
            evidencePresence: effect.evidencePresence,
            coverageEffect: effect.coverageEffect,
            conflictState: effect.conflictState,
            documentApplicability: effect.documentApplicability,
          },
          reviewLabels: {
            relevance: "UNREVIEWED",
            reviewerNote: null,
          },
        });
      }
    }
  }
  if (candidates.length !== worksheet.summary.occurrenceCount)
    fail("Shadow-Kandidatenzahl ist inkonsistent");
  if (
    targetReviews.length !==
    searchReport.input?.eligibleZeroPrimaryComponentCount
  )
    fail("Shadow-Zielzahl ist inkonsistent");

  const review = {
    schemaVersion: 1,
    artifactKind: "HYBRID_SHADOW_RECALL_FPR_REVIEW",
    status: "REVIEW_REQUIRED",
    shadowOnly: true,
    primaryMutationAllowed: false,
    contract: searchReport.contract,
    documentStatus: effectsReport.contracts.documentStatus,
    contracts: {
      searchReportSha256: sha256File(files.searchReport),
      shadowRunManifestSha256: sha256File(files.runManifest),
      worksheetSha256,
      triageSha256,
      triageReportSha256: sha256File(files.triageReport),
      effectsSha256: sha256File(files.effects),
      effectsReportSha256: sha256File(files.effectsReport),
    },
    labelContract: {
      relevance: ["UNREVIEWED", "TRUE_POSITIVE", "FALSE_POSITIVE"],
      groundTruth: [
        "UNREVIEWED",
        "RELEVANT_EVIDENCE_EXISTS",
        "NO_RELEVANT_EVIDENCE_EXISTS",
      ],
      primaryRecall: [
        "UNREVIEWED",
        "PRIMARY_MISS",
        "PRIMARY_CORRECT_NULL",
      ],
      confusionClass: [
        "UNREVIEWED",
        "TRUE_POSITIVE",
        "FALSE_POSITIVE",
        "TRUE_NEGATIVE",
        "FALSE_NEGATIVE",
      ],
    },
    metricContract: {
      recoveredPrimaryMissCount:
        "Anzahl auf Komponentenebene review-gelabelter PRIMARY_MISS-Fälle, die der Shadow-Zweig als TRUE_POSITIVE wiederfindet.",
      reviewedCandidatePrecision:
        "TRUE_POSITIVE / (TRUE_POSITIVE + FALSE_POSITIVE) über die vom normalen Evidenzvertrag ausgewählten Shadow-Kandidaten.",
      shadowRecall:
        "TRUE_POSITIVE / (TRUE_POSITIVE + FALSE_NEGATIVE) über review-gelabelte Nulltreffer-Komponenten mit Ground Truth.",
      falsePositiveRate:
        "FALSE_POSITIVE / (FALSE_POSITIVE + TRUE_NEGATIVE) über review-gelabelte Nulltreffer-Komponenten nach normaler Triage und Evidenzauswahl. Bis Ground Truth und Confusion Class vollständig gelabelt sind, bleibt die Rate null.",
    },
    metrics: {
      reviewedCandidateCount: null,
      reviewedSelectedCandidateCount: null,
      truePositiveCandidateCount: null,
      falsePositiveCandidateCount: null,
      reviewedTargetCount: null,
      truePositiveTargetCount: null,
      falsePositiveTargetCount: null,
      trueNegativeTargetCount: null,
      falseNegativeTargetCount: null,
      recoveredPrimaryMissCount: null,
      reviewedCandidatePrecision: null,
      shadowRecall: null,
      falsePositiveRate: null,
    },
    targetReviews,
    candidates,
  };
  const outputFile = path.resolve(args.output);
  writePrivateJson(outputFile, review);
  console.log(
    `[hybrid-shadow-review] REVIEW_REQUIRED: ${candidates.length} Kandidaten ungelabelt`
  );
}

try {
  run();
} catch (error) {
  fail(error.stack || error.message);
}

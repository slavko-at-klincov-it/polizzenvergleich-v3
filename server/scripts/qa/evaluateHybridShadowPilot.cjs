#!/usr/bin/env node

process.umask(0o077);

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  calculateHybridShadowPilotRetrievalMetrics,
  loadHybridShadowPilot,
} = require("../../utils/policyAnalysis/hybridShadowPilot");

function fail(message) {
  console.error(`[hybrid-shadow-pilot-evaluation] ${message}`);
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
    "manifest",
    "pilotFile",
    "searchGate",
    "qwenOutput",
    "output",
  ]);
  const unknown = Object.keys(args).filter((key) => !allowed.has(key));
  if (unknown.length) fail(`Unbekannte Argumente: ${unknown.join(",")}`);
  for (const required of allowed)
    if (!args[required]) fail(`--${required} ist erforderlich`);

  const manifestFile = path.resolve(args.manifest);
  const pilotFile = path.resolve(args.pilotFile);
  const searchGateFile = path.resolve(args.searchGate);
  const qwenOutput = path.resolve(args.qwenOutput);
  const output = path.resolve(args.output);
  const manifest = readJson(manifestFile, "Pilot-Manifest");
  const gate = readJson(searchGateFile, "Search-Gate");
  const { pilot, identity: pilotIdentity } = loadHybridShadowPilot(pilotFile);
  if (
    manifest?.runKind !== "HYBRID_SHADOW_TWO_PHASE_PILOT_QA" ||
    gate?.artifactKind !== "HYBRID_SHADOW_PILOT_SEARCH_GATE" ||
    gate.status !== "PASS_QWEN_ALLOWED" ||
    gate.contracts?.manifestSha256 !== sha256File(manifestFile) ||
    gate.contracts?.pilotSha256 !== pilotIdentity.pilotSha256
  )
    fail("Pilot-Evaluation ist nicht an das vollständige Search-Gate gebunden");

  const searchReports = [];
  const casePipelineById = new Map();
  const qwenReports = [];
  for (const category of gate.categories) {
    if (sha256File(category.searchReportPath) !== category.searchReportSha256)
      fail(`${category.categoryView}-Searchreport wurde verändert`);
    if (
      sha256File(category.shadowWorksheetPath) !==
      category.shadowWorksheetSha256
    )
      fail(`${category.categoryView}-Shadow-Worksheet wurde verändert`);
    const searchReport = readJson(
      category.searchReportPath,
      `${category.categoryView}-Searchreport`
    );
    const worksheet = readJson(
      category.shadowWorksheetPath,
      `${category.categoryView}-Shadow-Worksheet`
    );
    searchReports.push(searchReport);
    const categoryOutput = path.join(
      qwenOutput,
      `document-${category.documentIndex + 1}`,
      category.categoryView
    );
    const triageFile = path.join(
      categoryOutput,
      "triage",
      "materialized-triage.private.json"
    );
    const triageReportFile = path.join(categoryOutput, "triage", "report.json");
    const effectsFile = path.join(
      categoryOutput,
      "effects",
      "materialized.private.json"
    );
    const effectsReportFile = path.join(categoryOutput, "effects", "report.json");
    const triage = readJson(triageFile, "Pilot-Triage");
    const triageReport = readJson(triageReportFile, "Pilot-Triage-Report");
    const effects = readJson(effectsFile, "Pilot-Wirkungsprüfung");
    const effectsReport = readJson(effectsReportFile, "Pilot-Wirkungsreport");
    if (
      triageReport.contracts?.worksheetSha256 !==
        category.shadowWorksheetSha256 ||
      triageReport.contracts?.materializedTriageSha256 !==
        sha256File(triageFile) ||
      effectsReport.contracts?.worksheetSha256 !==
        category.shadowWorksheetSha256 ||
      effectsReport.contracts?.triageSha256 !== sha256File(triageFile) ||
      effectsReport.contracts?.materializedEvidenceSha256 !==
        sha256File(effectsFile) ||
      !new Set(["PASS", "TECHNICAL_PASS_REVIEW_REQUIRED"]).has(
        triageReport.status
      ) ||
      !new Set(["PASS", "TECHNICAL_PASS_REVIEW_REQUIRED"]).has(
        effectsReport.status
      )
    )
      fail(`${category.categoryView}-Qwen-Artefaktkette ist ungültig`);

    const occurrenceById = new Map();
    for (const requirement of worksheet.requirements)
      for (const component of requirement.components)
        for (const occurrence of component.occurrences)
          occurrenceById.set(occurrence.candidateId, occurrence);
    const effectByKey = new Map(
      effects.judgements.map((judgement) => [
        `${judgement.requirementId}:${judgement.componentId}`,
        judgement,
      ])
    );
    for (const ranking of searchReport.exactSpanRankings) {
      const effect = effectByKey.get(
        `${ranking.requirementId}:${ranking.componentId}`
      );
      if (!effect) fail(`Wirkung fehlt für Pilotfall ${ranking.caseId}`);
      const selectedQuoteSha256 = effect.selectedCandidateIds.map(
        (candidateId) => {
          const occurrence = occurrenceById.get(candidateId);
          if (!occurrence)
            fail(`Ausgewählter Kandidat fehlt: ${candidateId}`);
          return sha256(occurrence.exactText);
        }
      );
      casePipelineById.set(ranking.caseId, {
        selectedCandidateCount: effect.selectedCandidateIds.length,
        selectedQuoteSha256,
        evidencePresence: effect.evidencePresence,
        coverageEffect: effect.coverageEffect,
      });
    }
    qwenReports.push({
      documentIndex: category.documentIndex,
      categoryView: category.categoryView,
      triageReportPath: triageReportFile,
      triageReportSha256: sha256File(triageReportFile),
      effectsReportPath: effectsReportFile,
      effectsReportSha256: sha256File(effectsReportFile),
      triageModelCalls: triageReport.input.modelAttemptCount,
      effectsModelCalls: effectsReport.input.modelAttemptCount,
      triageProviderDurationSeconds: triageReport.completion.duration,
      effectsProviderDurationSeconds: effectsReport.completion.duration,
      triageStartedAt: triageReport.startedAt,
      triageFinishedAt: triageReport.finishedAt,
      effectsStartedAt: effectsReport.startedAt,
      effectsFinishedAt: effectsReport.finishedAt,
    });
    if (!Array.isArray(triage)) fail("Pilot-Triage ist ungültig");
  }

  const retrieval = calculateHybridShadowPilotRetrievalMetrics({
    pilot,
    searchReports,
  });
  const cases = pilot.documents.flatMap((document) => document.cases);
  if (
    casePipelineById.size !== cases.length ||
    cases.some(({ caseId }) => !casePipelineById.has(caseId))
  )
    fail("Qwen-Pipeline enthält nicht alle Pilotfälle");
  const caseResults = cases.map((pilotCase) => {
    const pipeline = casePipelineById.get(pilotCase.caseId);
    const accepted = new Set(pilotCase.acceptedExactQuoteSha256);
    const selectedAcceptedQuote = pipeline.selectedQuoteSha256.some((digest) =>
      accepted.has(digest)
    );
    return {
      caseId: pilotCase.caseId,
      documentFingerprint: pilotCase.documentFingerprint,
      categoryView: pilotCase.categoryView,
      requirementId: pilotCase.requirementId,
      componentId: pilotCase.componentId,
      controlClass: pilotCase.controlClass,
      expectedCandidateDisposition: pilotCase.expectedCandidateDisposition,
      downstreamExpectation: pilotCase.downstreamExpectation,
      selectedCandidateCount: pipeline.selectedCandidateCount,
      selectedQuoteSha256: pipeline.selectedQuoteSha256,
      pipelineRecovered:
        pilotCase.controlClass === "POSITIVE" ? selectedAcceptedQuote : null,
      adversarialRejected:
        pilotCase.controlClass === "ADVERSARIAL"
          ? pipeline.selectedCandidateCount === 0
          : null,
      trueNullFalsePositive:
        pilotCase.controlClass === "TRUE_NULL"
          ? pipeline.selectedCandidateCount > 0
          : null,
      evidencePresence: pipeline.evidencePresence,
      coverageEffect: pipeline.coverageEffect,
    };
  });
  const positives = caseResults.filter(
    ({ controlClass }) => controlClass === "POSITIVE"
  );
  const adversarial = caseResults.filter(
    ({ controlClass }) => controlClass === "ADVERSARIAL"
  );
  const trueNull = caseResults.filter(
    ({ controlClass }) => controlClass === "TRUE_NULL"
  );
  const qwen = {
    pipelineRecall:
      positives.filter(({ pipelineRecovered }) => pipelineRecovered).length /
      positives.length,
    adversarialRejectionRate:
      adversarial.filter(({ adversarialRejected }) => adversarialRejected)
        .length / adversarial.length,
    selectionFalsePositiveRate:
      trueNull.filter(({ trueNullFalsePositive }) => trueNullFalsePositive)
        .length / trueNull.length,
    additionalQwenCalls: qwenReports.reduce(
      (sum, report) =>
        sum + report.triageModelCalls + report.effectsModelCalls,
      0
    ),
    providerDurationSeconds: qwenReports.reduce(
      (sum, report) =>
        sum +
        report.triageProviderDurationSeconds +
        report.effectsProviderDurationSeconds,
      0
    ),
  };
  const report = {
    schemaVersion: 1,
    artifactKind: "HYBRID_SHADOW_TWO_PHASE_PILOT_EVALUATION",
    status: "TECHNICAL_PILOT_COMPLETE_EXPERT_REVIEW_REQUIRED",
    shadowOnly: true,
    primaryMutationAllowed: false,
    customerResultChanged: false,
    createdAt: new Date().toISOString(),
    contracts: {
      manifestPath: manifestFile,
      manifestSha256: sha256File(manifestFile),
      pilotPath: pilotFile,
      pilotSha256: pilotIdentity.pilotSha256,
      searchGatePath: searchGateFile,
      searchGateSha256: sha256File(searchGateFile),
    },
    proofLimit:
      "Der additive Nullkomponenten-Shadow misst Qualitätsgewinn und Zusatzzeit. Er beweist keine Zeitersparnis des unveränderten Primärlaufs.",
    metrics: { retrieval, qwen },
    qwenReports,
    caseResults,
  };
  writePrivateJson(output, report);
  writePrivateJson(path.join(path.dirname(output), "summary.json"), {
    schemaVersion: 1,
    status: report.status,
    shadowOnly: true,
    customerResultChanged: false,
    proofLimit: report.proofLimit,
    metrics: {
      rawRecallAt1: retrieval.rawRecallAt1,
      rawRecallAt3: retrieval.rawRecallAt3,
      thresholdRecallAt1: retrieval.recallAt1,
      thresholdRecallAt3: retrieval.recallAt3,
      knownAdversarialRetrievalAt3:
        retrieval.knownAdversarialRetrievalAt3,
      retrievalFalsePositiveRate: retrieval.retrievalFalsePositiveRate,
      pipelineRecall: qwen.pipelineRecall,
      adversarialRejectionRate: qwen.adversarialRejectionRate,
      selectionFalsePositiveRate: qwen.selectionFalsePositiveRate,
      additionalQwenCalls: qwen.additionalQwenCalls,
      providerDurationSeconds: qwen.providerDurationSeconds,
    },
  });
  console.log(
    `[hybrid-shadow-pilot-evaluation] ${report.status}: Recall@3=${retrieval.recallAt3}, Pipeline=${qwen.pipelineRecall}, FPR=${qwen.selectionFalsePositiveRate}`
  );
}

try {
  run();
} catch (error) {
  fail(error.stack || error.message);
}

#!/usr/bin/env node

process.umask(0o077);

const fs = require("fs");
const path = require("path");
const {
  canonicalJson,
  sha256,
  validateAuditResultRecord,
} = require("../../utils/policyAnalysis/lfReferenceReviewAudit");
const {
  readJson,
  writePrivateJson,
} = require("./buildLfReferencePartialAuditCases.cjs");
const {
  summaryFromIndex,
  validateIndex,
} = require("./runLfReferencePartialAudit.cjs");

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value)
      throw new Error(`LF_REFERENCE_AUDIT_ARGUMENT_INVALID:${key || "-"}`);
    values[key.slice(2)] = value;
  }
  const allowed = new Set(["auditRoot", "model"]);
  const unknown = Object.keys(values).filter((key) => !allowed.has(key));
  if (unknown.length)
    throw new Error(`LF_REFERENCE_AUDIT_ARGUMENT_UNKNOWN:${unknown.join(",")}`);
  for (const required of allowed)
    if (!values[required])
      throw new Error(`LF_REFERENCE_AUDIT_ARGUMENT_REQUIRED:${required}`);
  return { auditRoot: path.resolve(values.auditRoot), model: values.model };
}

function privateJsonFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink())
    throw new Error("LF_REFERENCE_AUDIT_RESULT_DIRECTORY_INVALID");
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && !entry.isSymbolicLink())
    .map(({ name }) => name)
    .filter((name) => name.endsWith(".private.json"))
    .sort();
}

function oneLine(value) {
  return String(value ?? "")
    .replace(/[\t\r\n]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function buildReviewPacket(records) {
  const rows = records
    .map(({ auditCase, record }) => {
      const candidateById = new Map(
        auditCase.candidates.map((candidate) => [candidate.id, candidate])
      );
      return {
        sourceOrder: auditCase.sourceOrder,
        analysisRowId: auditCase.caseId,
        requirementId: auditCase.requirementId,
        categoryName: auditCase.categoryName,
        subcategoryName: auditCase.subcategoryName,
        baseOutcome: auditCase.originalDecision.outcome,
        baseRowSha256: auditCase.originalDecision.rowSha256,
        rowDisposition: record.result.rowDisposition,
        currentSourceAssessment: record.result.currentSourceAssessment,
        rootCause: record.result.rootCause,
        recommendedAction: record.result.recommendedAction,
        valueComparison: record.result.valueComparison,
        confidence: record.result.confidence,
        reasoning: record.result.reasoning,
        componentAssessments: record.result.componentAssessments.map(
          (assessment) => ({
            componentId: assessment.componentId,
            componentLabel:
              auditCase.semanticRequirement.components.find(
                ({ id }) => id === assessment.componentId
              )?.label ?? assessment.componentId,
            finding: assessment.finding,
            coverageEffect: assessment.coverageEffect,
            scopeRelation: assessment.scopeRelation,
            observedBValues: assessment.observedBValues,
            note: assessment.note,
            citations: assessment.exactQuotes.map((quote) => {
              const candidate = candidateById.get(quote.candidateId);
              return {
                candidateId: quote.candidateId,
                documentUuid: candidate.documentUuid,
                documentName: candidate.documentName,
                documentRole: candidate.documentRole,
                documentStatus: candidate.documentStatus,
                documentPosition: candidate.documentPosition,
                physicalPageNumber: candidate.pageNumber,
                pageOffsetStart: candidate.pageOffsetStart,
                pageOffsetEnd: candidate.pageOffsetEnd,
                exactText: quote.quote,
                exactTextSha256: sha256(quote.quote),
                candidateTextSha256: candidate.textSha256,
                validationStatus: "BOUND_TO_AUDIT_SOURCE_PAGE",
              };
            }),
          })
        ),
      };
    })
    .sort((left, right) => left.sourceOrder - right.sourceOrder);
  const packet = {
    schemaVersion: 1,
    contractId: "LF_PARTIAL_COUNTERPART_REVIEW_PACKET_V1",
    authority: "NON_AUTHORITATIVE",
    primaryResultMutationAllowed: false,
    rowCount: rows.length,
    rows,
  };
  packet.packetSha256 = sha256(canonicalJson(packet));
  return packet;
}

function reviewPacketTsv(packet) {
  const header = [
    "sourceOrder",
    "analysisRowId",
    "requirementId",
    "subcategory",
    "label",
    "rowDisposition",
    "currentSourceAssessment",
    "rootCause",
    "recommendedAction",
    "components",
    "citations",
    "reasoning",
    "confidence",
    "fachlicheBewertungManuell",
  ];
  const lines = packet.rows.map((row) =>
    [
      row.sourceOrder,
      row.analysisRowId,
      row.requirementId,
      row.subcategoryName,
      row.categoryName,
      row.rowDisposition,
      row.currentSourceAssessment,
      row.rootCause,
      row.recommendedAction,
      row.componentAssessments
        .map(
          (component) =>
            `${component.componentId}:${component.finding}:${component.note}`
        )
        .join(" | "),
      row.componentAssessments
        .flatMap((component) => component.citations)
        .map(
          (citation) =>
            `${citation.documentName} · PDF-Seite ${citation.physicalPageNumber}: „${oneLine(
              citation.exactText
            )}“`
        )
        .join(" | "),
      row.reasoning,
      row.confidence,
      "",
    ]
      .map(oneLine)
      .join("\t")
  );
  return `${header.join("\t")}\n${lines.join("\n")}\n`;
}

function validateAudit({ auditRoot, model }) {
  const index = validateIndex(
    readJson(path.join(auditRoot, "index.private.json"), "INDEX")
  );
  const expectedFiles = index.cases
    .map(({ caseId }) => `${caseId}.private.json`)
    .sort();
  const observedCaseFiles = privateJsonFiles(path.join(auditRoot, "cases"));
  const observedResultFiles = privateJsonFiles(path.join(auditRoot, "results"));
  if (
    canonicalJson(observedCaseFiles) !== canonicalJson(expectedFiles) ||
    canonicalJson(observedResultFiles) !== canonicalJson(expectedFiles)
  )
    throw new Error("LF_REFERENCE_AUDIT_FILE_SET_INVALID");
  const failureFiles = privateJsonFiles(path.join(auditRoot, "failures"));
  if (failureFiles.length > 0)
    throw new Error("LF_REFERENCE_AUDIT_HAS_FAILED_CASES");

  const records = [];
  const bindingDigest = sha256(canonicalJson(index.bindings));
  for (const item of index.cases) {
    const auditCase = readJson(
      path.join(auditRoot, "cases", `${item.caseId}.private.json`),
      "CASE"
    );
    const inputDigest = auditCase.inputSha256;
    const withoutDigest = { ...auditCase };
    delete withoutDigest.inputSha256;
    if (
      auditCase.caseId !== item.caseId ||
      inputDigest !== item.inputSha256 ||
      inputDigest !== sha256(canonicalJson(withoutDigest)) ||
      sha256(canonicalJson(auditCase.bindings)) !== bindingDigest ||
      auditCase.advisoryOnly !== true ||
      auditCase.primaryResultMutationAllowed !== false
    )
      throw new Error(`LF_REFERENCE_AUDIT_CASE_INVALID:${item.caseId}`);
    const record = readJson(
      path.join(auditRoot, "results", `${item.caseId}.private.json`),
      "RESULT"
    );
    validateAuditResultRecord(auditCase, record, { model });
    records.push({ auditCase, record });
  }

  const progress = summaryFromIndex({ auditRoot, index, model });
  if (
    progress.completedCaseCount !== index.caseCount ||
    progress.failedCaseCount !== 0 ||
    progress.pendingCaseCount !== 0 ||
    progress.completedCaseIds.length !== index.caseCount
  )
    throw new Error("LF_REFERENCE_AUDIT_SUMMARY_INVALID");
  const dispositions = Object.fromEntries(
    Object.entries(progress.rowDispositions).map(([disposition, count]) => [
      disposition,
      {
        count,
        caseIds: records
          .filter(({ record }) => record.result.rowDisposition === disposition)
          .map(({ auditCase }) => auditCase.caseId),
      },
    ])
  );
  const rootCauses = Object.fromEntries(
    [...new Set(records.map(({ record }) => record.result.rootCause))]
      .sort()
      .map((rootCause) => {
        const caseIds = records
          .filter(({ record }) => record.result.rootCause === rootCause)
          .map(({ auditCase }) => auditCase.caseId);
        return [rootCause, { count: caseIds.length, caseIds }];
      })
  );
  const summary = {
    schemaVersion: 1,
    contractId: "LF_PARTIAL_COUNTERPART_AUDIT_SUMMARY_V1",
    authority: "NON_AUTHORITATIVE",
    primaryResultMutationAllowed: false,
    indexSha256: index.indexSha256,
    sourceBindingsSha256: bindingDigest,
    model,
    caseCount: records.length,
    dispositions,
    rootCauses,
    proofLimit:
      "Der Audit betrifft nur die 79 Teiltreffer des gebundenen bekannten LF-/WEVIG-Laufs. Modellbefunde sind Prüfvorschläge, keine Fachfreigabe. NO_ADDITIONAL_MATCH_IN_CANDIDATES ist kein kontrollierter Paket-Nullfund und kein Holdout- oder 99-Prozent-Nachweis.",
  };
  summary.summarySha256 = sha256(canonicalJson(summary));
  const packet = buildReviewPacket(records);
  const validation = {
    schemaVersion: 1,
    contractId: "LF_PARTIAL_COUNTERPART_AUDIT_VALIDATION_V1",
    status: "PASS",
    validatedAt: new Date().toISOString(),
    indexSha256: index.indexSha256,
    sourceBindingsSha256: bindingDigest,
    summarySha256: summary.summarySha256,
    reviewPacketSha256: packet.packetSha256,
    expectedCaseCount: index.caseCount,
    validatedCaseCount: records.length,
    findingCount: 0,
  };
  validation.validationSha256 = sha256(canonicalJson(validation));
  writePrivateJson(
    path.join(auditRoot, "audit-summary.private.json"),
    summary
  );
  writePrivateJson(
    path.join(auditRoot, "review-packet.private.json"),
    packet
  );
  fs.writeFileSync(
    path.join(auditRoot, "review-packet.tsv"),
    reviewPacketTsv(packet),
    { encoding: "utf8", mode: 0o600 }
  );
  writePrivateJson(path.join(auditRoot, "validation.private.json"), validation);
  return { validation, summary, packet };
}

function run() {
  const args = parseArguments(process.argv.slice(2));
  const { validation } = validateAudit(args);
  console.log(
    `[lf-partial-audit-validate] PASS: ${validation.validatedCaseCount}/${validation.expectedCaseCount} Fälle, 0 Findings`
  );
}

if (require.main === module) {
  try {
    run();
  } catch (error) {
    console.error(
      `[lf-partial-audit-validate] ${error.stack || error.message}`
    );
    process.exitCode = 1;
  }
}

module.exports = {
  buildReviewPacket,
  parseArguments,
  reviewPacketTsv,
  validateAudit,
};

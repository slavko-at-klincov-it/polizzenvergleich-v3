#!/usr/bin/env node

process.umask(0o077);

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const POSITIVE_DECISIONS = new Set(["FOUND", "PARTIAL", "CONTRADICTED"]);

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalizeComparable(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("de-AT")
    .replace(/[^\p{L}\p{N}€%]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function candidateChannels(candidate) {
  return [
    ...new Set(
      (candidate?.channelProvenance?.channelTraces || [])
        .map(({ channel }) => channel)
        .filter(Boolean)
    ),
  ].sort();
}

function quoteMatch(quote, candidateText) {
  const normalizedQuote = normalizeComparable(quote);
  const normalizedCandidate = normalizeComparable(candidateText);
  if (normalizedQuote.length < 12 || normalizedCandidate.length < 12)
    return false;
  return (
    normalizedCandidate.includes(normalizedQuote) ||
    normalizedQuote.includes(normalizedCandidate)
  );
}

function currentOutcomeByRow(comparison) {
  const outcomes = new Map();
  function visit(value) {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== "object") return;
    if (
      typeof value.analysisRowId === "string" &&
      typeof value.outcome === "string" &&
      value.packageB
    )
      outcomes.set(value.analysisRowId, value.outcome);
    for (const child of Object.values(value)) visit(child);
  }
  visit(comparison);
  return outcomes;
}

function summarize(items, decisions) {
  const channelNames = ["CURRENT", "LEXICAL_BM25", "STRUCTURAL", "DINGHY"];
  const strategies = {
    CURRENT: ["CURRENT"],
    DETERMINISTIC_UNION: ["CURRENT", "LEXICAL_BM25", "STRUCTURAL"],
    DINGHY: ["DINGHY"],
    FULL_UNION: channelNames,
  };
  const relevant = items.filter((item) => decisions.has(item.decision));
  const rows = new Set(relevant.map(({ caseId }) => caseId));
  const recovered = relevant.filter(({ recoveredByUnion }) => recoveredByUnion);
  const allRecoveredRows = [...rows].filter((caseId) => {
    const rowItems = relevant.filter((item) => item.caseId === caseId);
    return (
      rowItems.length > 0 &&
      rowItems.every(({ recoveredByUnion }) => recoveredByUnion)
    );
  });
  return {
    rowCount: rows.size,
    exactEvidenceQuoteCount: relevant.length,
    unionRecoveredQuoteCount: recovered.length,
    unionExactQuoteRecall:
      relevant.length === 0
        ? null
        : Number((recovered.length / relevant.length).toFixed(6)),
    allEvidenceRecoveredRowCount: allRecoveredRows.length,
    byStrategy: Object.fromEntries(
      Object.entries(strategies).map(([strategy, channels]) => {
        const strategyRecovered = relevant.filter((item) =>
          item.channels.some((channel) => channels.includes(channel))
        );
        const allEvidenceRecoveredRows = [...rows].filter((caseId) => {
          const rowItems = relevant.filter((item) => item.caseId === caseId);
          return (
            rowItems.length > 0 &&
            rowItems.every((item) =>
              item.channels.some((channel) => channels.includes(channel))
            )
          );
        });
        return [
          strategy,
          {
            recoveredQuoteCount: strategyRecovered.length,
            exactQuoteRecall:
              relevant.length === 0
                ? null
                : Number(
                    (strategyRecovered.length / relevant.length).toFixed(6)
                  ),
            allEvidenceRecoveredRowCount: allEvidenceRecoveredRows.length,
          },
        ];
      })
    ),
    incrementalDinghyOverDeterministicQuoteCount: relevant.filter(
      ({ channels }) =>
        channels.includes("DINGHY") &&
        !channels.some((channel) =>
          ["CURRENT", "LEXICAL_BM25", "STRUCTURAL"].includes(channel)
        )
    ).length,
    incrementalDeterministicOverDinghyQuoteCount: relevant.filter(
      ({ channels }) =>
        !channels.includes("DINGHY") &&
        channels.some((channel) =>
          ["CURRENT", "LEXICAL_BM25", "STRUCTURAL"].includes(channel)
        )
    ).length,
    byChannel: Object.fromEntries(
      channelNames.map((channel) => [
        channel,
        {
          recoveredQuoteCount: relevant.filter(({ channels }) =>
            channels.includes(channel)
          ).length,
          exactQuoteRecall:
            relevant.length === 0
              ? null
              : Number(
                  (
                    relevant.filter(({ channels }) =>
                      channels.includes(channel)
                    ).length / relevant.length
                  ).toFixed(6)
                ),
        },
      ])
    ),
  };
}

function analyzeLegacyAudit({ candidatesArtifact, comparison, legacyCases }) {
  if (candidatesArtifact?.status !== "CHANNELS_COMPLETE_REVIEW_REQUIRED")
    throw new Error("LF_DISCOVERY_LEGACY_AUDIT_REQUIRES_COMPLETE_CHANNELS");
  const candidatesByRow = new Map();
  for (const candidate of candidatesArtifact.candidates || []) {
    if (!candidatesByRow.has(candidate.analysisRowId))
      candidatesByRow.set(candidate.analysisRowId, []);
    candidatesByRow.get(candidate.analysisRowId).push(candidate);
  }
  const outcomes = currentOutcomeByRow(comparison);
  const evidence = [];
  const rows = [];
  for (const legacyCase of legacyCases) {
    const caseId = legacyCase.caseId;
    const decision = legacyCase.result?.decision;
    const currentCandidates = candidatesByRow.get(caseId) || [];
    const exactQuotes = legacyCase.result?.exactQuotes || [];
    const rowEvidence = exactQuotes.map((exactQuote) => {
      const matches = currentCandidates.filter((candidate) =>
        quoteMatch(exactQuote.quote, candidate.source?.exactQuote)
      );
      const channels = [...new Set(matches.flatMap(candidateChannels))].sort();
      const item = {
        caseId,
        decision,
        legacyCandidateId: exactQuote.candidateId,
        exactQuoteSha256: sha256(exactQuote.quote),
        exactQuotePreview: String(exactQuote.quote).slice(0, 240),
        recoveredByUnion: matches.length > 0,
        channels,
        matchedCandidateIds: matches
          .sort((left, right) => left.rank - right.rank)
          .slice(0, 10)
          .map(({ candidateId }) => candidateId),
      };
      evidence.push(item);
      return item;
    });
    rows.push({
      caseId,
      legacyDecision: decision,
      currentOutcome: outcomes.get(caseId) || null,
      exactEvidenceQuoteCount: rowEvidence.length,
      recoveredEvidenceQuoteCount: rowEvidence.filter(
        ({ recoveredByUnion }) => recoveredByUnion
      ).length,
      allEvidenceRecovered:
        rowEvidence.length > 0 &&
        rowEvidence.every(({ recoveredByUnion }) => recoveredByUnion),
      recoveredChannels: [
        ...new Set(rowEvidence.flatMap(({ channels }) => channels)),
      ].sort(),
    });
  }
  const decisionNames = [
    "FOUND",
    "PARTIAL",
    "CONTRADICTED",
    "UNCLEAR",
    "NO_MATCH_IN_PACKET",
  ];
  return {
    schemaVersion: 1,
    artifactKind: "LF_REFERENCE_DISCOVERY_LEGACY_QWEN_RECALL_REPORT",
    status: "RETROSPECTIVE_NON_GOLD_EVIDENCE_ONLY",
    shadowOnly: true,
    primaryMutationAllowed: false,
    source: {
      benchmarkCandidatesCanonicalSha256: sha256(
        JSON.stringify(candidatesArtifact)
      ),
      benchmarkRunSignature: candidatesArtifact.runSignature,
      benchmarkStatus: candidatesArtifact.status,
    },
    summary: {
      auditedRowCount: rows.length,
      positiveEvidence: summarize(evidence, POSITIVE_DECISIONS),
      byLegacyDecision: Object.fromEntries(
        decisionNames.map((decision) => [
          decision,
          summarize(evidence, new Set([decision])),
        ])
      ),
      legacyDecisionCounts: Object.fromEntries(
        decisionNames.map((decision) => [
          decision,
          rows.filter(({ legacyDecision }) => legacyDecision === decision)
            .length,
        ])
      ),
    },
    rows,
    evidence,
    missedEvidence: evidence.filter(
      ({ recoveredByUnion }) => !recoveredByUnion
    ),
    proofLimit:
      "This report measures exact navigation-quote recovery against a historical Qwen audit. The historical audit is not an expert-approved gold oracle; retrieval of a cited quote does not prove semantic equivalence, and failure to recover it does not prove absence.",
  };
}

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value)
      throw new Error(`Ungültiges Argument: ${key || "-"}`);
    values[key.slice(2)] = value;
  }
  for (const required of ["benchmarkCandidates", "legacyAuditRoot", "output"])
    if (!values[required]) throw new Error(`--${required} ist erforderlich`);
  return values;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function sha256File(file) {
  return sha256(fs.readFileSync(file));
}

function run(argv) {
  const args = parseArguments(argv);
  for (const name of ["benchmarkCandidates", "legacyAuditRoot", "output"])
    if (!path.isAbsolute(args[name]))
      throw new Error(`--${name} muss absolut sein`);
  if (fs.existsSync(args.output))
    throw new Error(`Ausgabe existiert bereits: ${args.output}`);
  const candidatesArtifact = readJson(args.benchmarkCandidates);
  const comparisonFile = candidatesArtifact.source?.resultPath;
  if (!comparisonFile || !path.isAbsolute(comparisonFile))
    throw new Error("LF_DISCOVERY_SOURCE_COMPARISON_PATH_INVALID");
  const comparison = readJson(comparisonFile);
  const summaryFile = path.join(args.legacyAuditRoot, "qwen-summary.json");
  const summary = readJson(summaryFile);
  const legacyResultBindings = summary.results.map(({ caseId }) => {
    const file = path.join(
      args.legacyAuditRoot,
      "qwen-results",
      `${caseId}.json`
    );
    return { caseId, file, sha256: sha256File(file) };
  });
  const legacyCases = legacyResultBindings.map(({ file }) => readJson(file));
  const report = analyzeLegacyAudit({
    candidatesArtifact,
    comparison,
    legacyCases,
  });
  report.source = {
    ...report.source,
    benchmarkCandidatesPath: args.benchmarkCandidates,
    benchmarkCandidatesSha256: sha256File(args.benchmarkCandidates),
    comparisonPath: comparisonFile,
    comparisonSha256: sha256File(comparisonFile),
    legacyAuditRoot: args.legacyAuditRoot,
    legacySummaryPath: summaryFile,
    legacySummarySha256: sha256File(summaryFile),
    legacyResultCount: legacyResultBindings.length,
    legacyResultSetSha256: sha256(JSON.stringify(legacyResultBindings)),
  };
  const temporary = `${args.output}.tmp-${process.pid}`;
  fs.mkdirSync(path.dirname(args.output), { recursive: true, mode: 0o700 });
  fs.writeFileSync(temporary, `${JSON.stringify(report, null, 2)}\n`, {
    mode: 0o600,
  });
  fs.renameSync(temporary, args.output);
  fs.chmodSync(args.output, 0o600);
  console.log(
    `[lf-discovery-legacy-recall] ${report.summary.positiveEvidence.unionRecoveredQuoteCount}/${report.summary.positiveEvidence.exactEvidenceQuoteCount} historische positive Evidenzzitate wiedergefunden`
  );
}

if (require.main === module) {
  try {
    run(process.argv.slice(2));
  } catch (error) {
    console.error(
      `[lf-discovery-legacy-recall] ${error.stack || error.message}`
    );
    process.exit(1);
  }
}

module.exports = {
  analyzeLegacyAudit,
  candidateChannels,
  normalizeComparable,
  quoteMatch,
};

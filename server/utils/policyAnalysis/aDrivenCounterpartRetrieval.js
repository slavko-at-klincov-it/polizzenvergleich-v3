const crypto = require("crypto");
const {
  bm25Index,
  normalize,
  rankLexicalCandidates,
  tokens,
} = require("./lfReferenceDiscoveryBenchmark");
const {
  A_DRIVEN_COUNTERPART_SEARCH_PLAN_CONTRACT_ID,
  REQUIRED_SEARCH_CHANNELS,
} = require("./aDrivenCounterpartSearchPlan");
const { compactReferenceCandidates } = require("./referenceCandidateCompactor");

const A_DRIVEN_COUNTERPART_RETRIEVAL_CONTRACT_ID =
  "LF_A_DRIVEN_COUNTERPART_RETRIEVAL_V1";

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function retrievalError(code, detail) {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  return error;
}

function buildClauseBoundaries(document, maximumCharacters = 1_800) {
  if (
    typeof document?.pageContent !== "string" ||
    !Array.isArray(document.pageMap) ||
    sha256(document.pageContent) !== document.pageContentSha256
  )
    throw retrievalError("LF_A_DRIVEN_B_SOURCE_INVALID");
  const clauses = [];
  for (const page of document.pageMap) {
    const pageText = document.pageContent.slice(page.start, page.end);
    const paragraphs = [
      ...pageText.matchAll(/\S(?:[\s\S]*?\S)?(?=\n\s*\n|$)/gu),
    ];
    for (const paragraph of paragraphs) {
      const rawStart = paragraph.index;
      const rawText = paragraph[0];
      const lines = [...rawText.matchAll(/[^\r\n]+/gu)].filter(({ 0: line }) =>
        /\S/u.test(line)
      );
      let current = [];
      const flush = () => {
        if (!current.length) return;
        const start = page.start + rawStart + current[0].index;
        const last = current.at(-1);
        const end = page.start + rawStart + last.index + last[0].length;
        const exactText = document.pageContent.slice(start, end);
        const clauseBoundaryId = `BC-${sha256(
          `${document.uuid}:${document.sha256}:${page.pageNumber}:${start}:${end}`
        ).slice(0, 24)}`;
        clauses.push({
          clauseBoundaryId,
          physicalPageNumber: page.pageNumber,
          documentStart: start,
          documentEnd: end,
          exactText,
          normalizedText: normalize(exactText),
          tokenList: tokens(exactText),
        });
        current = [];
      };
      for (const line of lines) {
        const prospectiveStart = current[0]?.index ?? line.index;
        const prospectiveEnd = line.index + line[0].length;
        if (
          current.length &&
          prospectiveEnd - prospectiveStart > maximumCharacters
        )
          flush();
        current.push(line);
      }
      flush();
    }
  }
  return clauses;
}

function structuralCandidates(document, clauses) {
  return clauses.flatMap((clause) => {
    const matches = [...clause.exactText.matchAll(/[^\r\n]+/gu)].filter(
      ({ 0: line }) => /\S/u.test(line)
    );
    return matches.map((match) => {
      const documentStart = clause.documentStart + match.index;
      const documentEnd = documentStart + match[0].length;
      return {
        ...clause,
        documentStart,
        documentEnd,
        exactText: match[0],
        normalizedText: normalize(match[0]),
        tokenList: tokens(match[0]),
      };
    });
  });
}

function asCandidate(item, packageId, channel, rank) {
  return {
    candidateId: `ARC-${sha256(
      `${packageId}:${channel}:${item.clauseBoundaryId}:${item.documentStart}:${item.documentEnd}`
    ).slice(0, 24)}`,
    documentUuid: item.documentUuid,
    documentSha256: item.documentSha256,
    clauseBoundaryId: item.clauseBoundaryId,
    documentStart: item.documentStart,
    documentEnd: item.documentEnd,
    physicalPageNumber: item.physicalPageNumber,
    exactText: item.exactText,
    exactTextSha256: sha256(item.exactText),
    channels: [channel],
    channelRank: rank,
    channelScore: Number.isFinite(item.score) ? item.score : null,
  };
}

function mergedCandidates(candidates) {
  const bySpan = new Map();
  for (const candidate of candidates) {
    const key = [
      candidate.documentUuid,
      candidate.clauseBoundaryId,
      candidate.documentStart,
      candidate.documentEnd,
    ].join(":");
    if (!bySpan.has(key)) bySpan.set(key, { ...candidate });
    else
      bySpan.get(key).channels = [
        ...new Set([...bySpan.get(key).channels, ...candidate.channels]),
      ].sort();
  }
  return [...bySpan.values()].sort(
    (left, right) =>
      left.documentStart - right.documentStart ||
      left.documentEnd - right.documentEnd ||
      left.candidateId.localeCompare(right.candidateId)
  );
}

function valueRoleMatches(item, packageItem) {
  const component = packageItem.query.semanticComponent;
  const needles = [
    component.rawValue,
    component.unit,
    component.qualifier,
    component.coverageEffect,
  ]
    .filter(Boolean)
    .map(normalize);
  if (
    needles.length &&
    needles.some((needle) => item.normalizedText.includes(needle))
  )
    return true;
  const rolePatterns = {
    VALUE_AND_UNIT: /\b(?:eur|euro|%|prozent|summe|betrag|limit)\b/iu,
    LIMIT_BASIS: /\b(?:summe|limit|maximum|höchst|hoechst|anteil)\b/iu,
    DEDUCTIBLE: /\b(?:selbstbehalt|franchise|eigenbehalt)\b/iu,
    COVERAGE_EFFECT:
      /\b(?:versichert|gedeckt|ausgeschlossen|nicht versichert)\b/iu,
    PRECEDENCE_OR_REPLACEMENT: /\b(?:ersetzt|vorrang|nachtrag|abweichend)\b/iu,
  };
  return rolePatterns[packageItem.componentType]?.test(item.exactText) || false;
}

function retrieveADrivenCounterpartCandidates({
  plan,
  documents,
  dinghyRankings = new Map(),
  topK = 8,
} = {}) {
  if (
    plan?.contractId !== A_DRIVEN_COUNTERPART_SEARCH_PLAN_CONTRACT_ID ||
    !Array.isArray(plan.packages) ||
    !Array.isArray(documents) ||
    !Number.isInteger(topK) ||
    topK < 1
  )
    throw retrievalError("LF_A_DRIVEN_RETRIEVAL_INPUT_INVALID");
  const documentIndexes = new Map();
  for (const item of documents) {
    const document = {
      uuid: item?.document?.uuid,
      sha256: item?.document?.sha256,
      pageContent: item?.artifact?.document?.pageContent,
      pageContentSha256: sha256(item?.artifact?.document?.pageContent || ""),
      pageMap: item?.artifact?.document?.pageMap,
    };
    if (
      !document.uuid ||
      !/^[a-f0-9]{64}$/u.test(String(document.sha256 || "")) ||
      item.artifact?.fingerprint !== document.sha256 ||
      documentIndexes.has(document.uuid)
    )
      throw retrievalError("LF_A_DRIVEN_RETRIEVAL_DOCUMENT_INVALID");
    const clauses = buildClauseBoundaries(document).map((clause) => ({
      ...clause,
      documentUuid: document.uuid,
      documentSha256: document.sha256,
    }));
    const structures = structuralCandidates(document, clauses);
    documentIndexes.set(document.uuid, {
      document: {
        ...document,
        clauseBoundaries: clauses.map(
          ({ clauseBoundaryId, documentStart, documentEnd }) => ({
            clauseBoundaryId,
            documentStart,
            documentEnd,
          })
        ),
      },
      clauses,
      structures,
      clauseIndex: bm25Index(clauses),
      structureIndex: bm25Index(structures),
      clausesById: new Map(
        clauses.map((clause) => [clause.clauseBoundaryId, clause])
      ),
    });
  }
  const packageResults = plan.packages.map((packageItem) => {
    const index = documentIndexes.get(packageItem.documentUuid);
    if (!index || index.document.sha256 !== packageItem.documentSha256)
      throw retrievalError("LF_A_DRIVEN_RETRIEVAL_PLAN_DOCUMENT_MISMATCH");
    const target = {
      query: packageItem.query.contextText,
      queryTokens: packageItem.query.lexicalTerms,
      phrases: [normalize(packageItem.query.focalText)].filter(
        (value) => value.length >= 8
      ),
    };
    const current = index.clauses
      .filter(({ normalizedText }) =>
        normalizedText.includes(normalize(packageItem.query.focalText))
      )
      .slice(0, topK);
    const lexical = rankLexicalCandidates({
      target,
      candidates: index.clauses,
      index: index.clauseIndex,
      topK,
    });
    const structural = rankLexicalCandidates({
      target,
      candidates: index.structures,
      index: index.structureIndex,
      topK,
      structural: true,
    });
    const valueRole = index.clauses
      .filter((clause) => valueRoleMatches(clause, packageItem))
      .slice(0, topK);
    const hasDinghyResult = dinghyRankings.has(packageItem.packageId);
    const dinghy = hasDinghyResult
      ? dinghyRankings
          .get(packageItem.packageId)
          .slice(0, topK)
          .map(({ clauseBoundaryId, score }) => ({
            ...index.clausesById.get(clauseBoundaryId),
            score,
          }))
          .filter(({ clauseBoundaryId }) => clauseBoundaryId)
      : [];
    const channelLists = {
      CURRENT: current,
      LEXICAL_BM25: lexical,
      STRUCTURAL: structural,
      DINGHY: dinghy,
      VALUE_ROLE: valueRole,
    };
    const candidates = mergedCandidates(
      Object.entries(channelLists).flatMap(([channel, items]) =>
        items.map((item, rank) =>
          asCandidate(item, packageItem.packageId, channel, rank + 1)
        )
      )
    );
    const compacted = compactReferenceCandidates(candidates, {
      documents: [index.document],
    });
    return {
      packageId: packageItem.packageId,
      completedChannels: REQUIRED_SEARCH_CHANNELS.filter(
        (channel) => channel !== "DINGHY" || hasDinghyResult
      ),
      candidates: compacted,
      channelCandidateCounts: Object.fromEntries(
        Object.entries(channelLists).map(([channel, items]) => [
          channel,
          items.length,
        ])
      ),
    };
  });
  return {
    schemaVersion: 1,
    contractId: A_DRIVEN_COUNTERPART_RETRIEVAL_CONTRACT_ID,
    searchPlanSha256: plan.planSha256,
    packageResults,
    summary: {
      packages: packageResults.length,
      completeDinghyPackages: packageResults.filter(({ completedChannels }) =>
        completedChannels.includes("DINGHY")
      ).length,
      candidates: packageResults.reduce(
        (sum, { candidates }) => sum + candidates.length,
        0
      ),
      noGlobalTopN: true,
      perChannelTopK: topK,
    },
  };
}

module.exports = {
  A_DRIVEN_COUNTERPART_RETRIEVAL_CONTRACT_ID,
  buildClauseBoundaries,
  retrieveADrivenCounterpartCandidates,
};

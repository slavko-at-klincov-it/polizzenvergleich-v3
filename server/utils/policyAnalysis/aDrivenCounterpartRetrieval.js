const crypto = require("crypto");
const {
  bm25Index,
  normalize,
  rankLexicalCandidates,
  tokens,
} = require("./counterpartRetrievalPrimitives");
const {
  A_DRIVEN_COUNTERPART_RETRIEVAL_CONTRACT_ID,
  A_DRIVEN_COUNTERPART_SEARCH_PLAN_CONTRACT_ID,
  REQUIRED_SEARCH_CHANNELS,
  validateADrivenCounterpartSearchPlan,
} = require("./aDrivenCounterpartSearchPlan");
const { stableStringify } = require("./aDrivenSourceUnitPlan");
const { compactReferenceCandidates } = require("./referenceCandidateCompactor");

const DINGHY_RANKING_RESULT_CONTRACT_ID = "LF_DINGHY_RANKING_RESULT_V2";

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function retrievalError(code, detail) {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  return error;
}

function clauseCorpusSha256(clauses) {
  return sha256(
    stableStringify(
      clauses.map(
        ({ clauseBoundaryId, documentStart, documentEnd, exactText }) => ({
          clauseBoundaryId,
          documentStart,
          documentEnd,
          exactTextSha256: sha256(exactText),
        })
      )
    )
  );
}

function buildDinghyRankingResult({
  packageItem,
  clauses,
  modelId,
  embeddingContractSha256,
  rankedClauses,
} = {}) {
  const clauseIds = new Set(
    (clauses || []).map(({ clauseBoundaryId }) => clauseBoundaryId)
  );
  if (
    !packageItem?.packageId ||
    !Array.isArray(clauses) ||
    clauses.length === 0 ||
    typeof modelId !== "string" ||
    !modelId ||
    !/^[a-f0-9]{64}$/u.test(String(embeddingContractSha256 || "")) ||
    !Array.isArray(rankedClauses) ||
    rankedClauses.some(
      ({ clauseBoundaryId, score }) =>
        !clauseIds.has(clauseBoundaryId) || !Number.isFinite(score)
    ) ||
    new Set(rankedClauses.map(({ clauseBoundaryId }) => clauseBoundaryId))
      .size !== rankedClauses.length
  )
    throw retrievalError("LF_A_DRIVEN_DINGHY_RESULT_INPUT_INVALID");
  const payload = {
    schemaVersion: 1,
    contractId: DINGHY_RANKING_RESULT_CONTRACT_ID,
    packageId: packageItem.packageId,
    documentUuid: packageItem.documentUuid,
    documentSha256: packageItem.documentSha256,
    querySha256: sha256(stableStringify(packageItem.query)),
    clauseCorpusSha256: clauseCorpusSha256(clauses),
    embeddingContractSha256,
    modelId,
    rankedClauses,
  };
  return {
    ...payload,
    rankingSha256: sha256(
      `${DINGHY_RANKING_RESULT_CONTRACT_ID}\u0000${stableStringify(payload)}`
    ),
  };
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
    const lines = [...pageText.matchAll(/[^\r\n]+/gu)].filter(({ 0: line }) =>
      /\S/u.test(line)
    );
    const paragraphs = [];
    let paragraph = [];
    for (const line of lines) {
      const previous = paragraph.at(-1);
      if (
        previous &&
        /\r?\n\s*\r?\n/u.test(
          pageText.slice(previous.index + previous[0].length, line.index)
        )
      ) {
        paragraphs.push(paragraph);
        paragraph = [];
      }
      paragraph.push(line);
    }
    if (paragraph.length) paragraphs.push(paragraph);
    for (const paragraphLines of paragraphs) {
      let current = [];
      const flush = () => {
        if (!current.length) return;
        const start = page.start + current[0].index;
        const last = current.at(-1);
        const end = page.start + last.index + last[0].length;
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
      for (const line of paragraphLines) {
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
} = {}) {
  validateADrivenCounterpartSearchPlan(plan);
  const topK = plan.retrievalPolicy.perChannelTopK;
  if (
    plan?.contractId !== A_DRIVEN_COUNTERPART_SEARCH_PLAN_CONTRACT_ID ||
    !Array.isArray(plan.packages) ||
    !Array.isArray(documents) ||
    !(dinghyRankings instanceof Map)
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
    const dinghyResult = dinghyRankings.get(packageItem.packageId);
    const hasDinghyResult = Boolean(dinghyResult);
    const dinghyPayload = hasDinghyResult
      ? (({ rankingSha256: _rankingSha256, ...payload }) => payload)(
          dinghyResult
        )
      : null;
    if (
      hasDinghyResult &&
      (dinghyResult.contractId !== DINGHY_RANKING_RESULT_CONTRACT_ID ||
        dinghyResult.packageId !== packageItem.packageId ||
        dinghyResult.documentUuid !== packageItem.documentUuid ||
        dinghyResult.documentSha256 !== packageItem.documentSha256 ||
        dinghyResult.querySha256 !==
          sha256(stableStringify(packageItem.query)) ||
        dinghyResult.clauseCorpusSha256 !== clauseCorpusSha256(index.clauses) ||
        !/^[a-f0-9]{64}$/u.test(
          String(dinghyResult.embeddingContractSha256 || "")
        ) ||
        typeof dinghyResult.modelId !== "string" ||
        !dinghyResult.modelId ||
        !Array.isArray(dinghyResult.rankedClauses) ||
        dinghyResult.rankedClauses.some(
          ({ clauseBoundaryId, score }) =>
            !index.clausesById.has(clauseBoundaryId) || !Number.isFinite(score)
        ) ||
        new Set(
          dinghyResult.rankedClauses.map(
            ({ clauseBoundaryId }) => clauseBoundaryId
          )
        ).size !== dinghyResult.rankedClauses.length ||
        dinghyResult.rankingSha256 !==
          sha256(
            `${DINGHY_RANKING_RESULT_CONTRACT_ID}\u0000${stableStringify(
              dinghyPayload
            )}`
          ))
    )
      throw retrievalError("LF_A_DRIVEN_DINGHY_RESULT_INVALID");
    const dinghy = hasDinghyResult
      ? dinghyResult.rankedClauses
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
      candidates: compacted.compactCandidates,
      channelCandidateCounts: Object.fromEntries(
        Object.entries(channelLists).map(([channel, items]) => [
          channel,
          items.length,
        ])
      ),
      channelProvenance: {
        ...(hasDinghyResult
          ? {
              DINGHY: {
                contractId: dinghyResult.contractId,
                rankingSha256: dinghyResult.rankingSha256,
                embeddingContractSha256: dinghyResult.embeddingContractSha256,
                modelId: dinghyResult.modelId,
              },
            }
          : {}),
      },
    };
  });
  const payload = {
    schemaVersion: 2,
    contractId: A_DRIVEN_COUNTERPART_RETRIEVAL_CONTRACT_ID,
    searchPlanSha256: plan.planSha256,
    retrievalPolicy: plan.retrievalPolicy,
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
      channelExecutionComplete:
        packageResults.length === plan.packages.length &&
        packageResults.every(({ completedChannels }) =>
          REQUIRED_SEARCH_CHANNELS.every((channel) =>
            completedChannels.includes(channel)
          )
        ),
      absenceCertified: false,
    },
  };
  return {
    ...payload,
    retrievalSha256: sha256(
      `${A_DRIVEN_COUNTERPART_RETRIEVAL_CONTRACT_ID}\u0000${stableStringify(
        payload
      )}`
    ),
  };
}

module.exports = {
  A_DRIVEN_COUNTERPART_RETRIEVAL_CONTRACT_ID,
  DINGHY_RANKING_RESULT_CONTRACT_ID,
  buildDinghyRankingResult,
  buildClauseBoundaries,
  retrieveADrivenCounterpartCandidates,
};

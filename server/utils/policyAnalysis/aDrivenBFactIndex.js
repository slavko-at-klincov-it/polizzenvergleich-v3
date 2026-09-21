const crypto = require("crypto");
const {
  bm25Index,
  normalize,
  rankLexicalCandidates,
  tokens,
} = require("./counterpartRetrievalPrimitives");
const { validateADrivenCompleteBCorpus } = require("./aDrivenCompleteBCorpus");
const {
  validateADrivenRequirementDecisionArtifact,
  validateADrivenRequirementDecisionPlan,
} = require("./aDrivenRequirementCounterpartDecision");
const { stableStringify } = require("./aDrivenSourceUnitPlan");

// Shadow-only fast-path contracts. The index is complete over every source-
// bound B clause, but its deterministic signals are navigation hints only.
// Unselected facts stay visible as UNASSESSED and can never become NOT_FOUND.
const A_DRIVEN_B_FACT_INDEX_CONTRACT_ID = "LF_A_DRIVEN_B_FACT_INDEX_V1";
const A_DRIVEN_FAST_FALLBACK_PLAN_CONTRACT_ID =
  "LF_A_DRIVEN_FAST_FALLBACK_PLAN_V2";
const A_DRIVEN_FAST_FALLBACK_REPLAY_CONTRACT_ID =
  "LF_A_DRIVEN_FAST_FALLBACK_REPLAY_V2";
const A_DRIVEN_TERMINAL_EVIDENCE_REPLAY_CONTRACT_ID =
  "LF_A_DRIVEN_TERMINAL_EVIDENCE_REPLAY_V1";
const A_DRIVEN_B_RETRIEVAL_WINDOW_CONTRACT_ID =
  "LF_A_DRIVEN_B_RETRIEVAL_WINDOW_V1";

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function indexError(code, detail) {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  return error;
}

function sortedUnique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function numericSignals(value) {
  return sortedUnique(
    [
      ...String(value || "").matchAll(
        /(?:€|EUR|Euro)?\s*\d[\d.,]*(?:\s*(?:%|€|EUR|Euro|m(?:²|2)?|qm|Tage?|Monate?|Jahre?))?/giu
      ),
    ]
      .map(([match]) => normalize(match))
      .filter((match) => /\d/u.test(match))
  );
}

function roleSignals(value) {
  const text = String(value || "");
  const signals = [];
  const patterns = [
    [
      "EXCLUSION",
      /\b(?:ausgeschlossen|ausgenommen|nicht\s+(?:mit)?versichert|kein(?:e[snmr]?)?\s+(?:Deckung|Versicherungsschutz|Entschädigung))\b/iu,
    ],
    [
      "INCLUSION",
      /\b(?:(?:mit)?versichert|gedeckt|Versicherungsschutz\s+(?:besteht|gilt)|erstreckt\s+sich\s+auf|leistet\s+Ersatz)\b/iu,
    ],
    ["DEDUCTIBLE", /\b(?:Selbstbehalt|Eigenbehalt|Franchise)\b/iu],
    [
      "LIMIT",
      /\b(?:Höchst(?:betrag|entschädigung)|Limit|Versicherungssumme|Erstes\s+Risiko|maximal|höchstens|bis\s+zu)\b|%|€|\bEUR\b/iu,
    ],
    [
      "CONDITION",
      /\b(?:sofern|wenn|falls|vorausgesetzt|soweit|unter\s+der\s+Voraussetzung)\b/iu,
    ],
    [
      "TEMPORAL",
      /\b(?:Frist|Tage?|Monate?|Jahre?|Beginn|Ende|Dauer|Wartezeit)\b/iu,
    ],
    ["PRECEDENCE", /\b(?:ersetzt|vorrangig|Nachtrag|abweichend|subsidiär)\b/iu],
    [
      "DEFINITION",
      /\b(?:gilt|gelten|versteht\s+man|zu\s+verstehen|ist\s+definiert)\b/iu,
    ],
    ["COST", /\b(?:Kosten|Mehrkosten|Aufwendungen)\b/iu],
  ];
  for (const [signal, pattern] of patterns)
    if (pattern.test(text)) signals.push(signal);
  return signals;
}

function factIdentity(clause) {
  return {
    documentUuid: clause.documentUuid,
    documentSha256: clause.documentSha256,
    clauseBoundaryId: clause.clauseBoundaryId,
    documentStart: clause.documentStart,
    documentEnd: clause.documentEnd,
    exactTextSha256: clause.exactTextSha256,
  };
}

function buildADrivenBFactIndex({ completeCorpus } = {}) {
  validateADrivenCompleteBCorpus(completeCorpus);
  const facts = completeCorpus.clauses.map((clause) => {
    const identity = factIdentity(clause);
    return {
      factId: `BFI-${sha256(stableStringify(identity)).slice(0, 24)}`,
      ...identity,
      documentPosition: clause.documentPosition,
      documentRole: clause.documentRole,
      documentStatus: clause.documentStatus,
      physicalPageNumber: clause.physicalPageNumber,
      exactText: clause.exactText,
      normalizedText: normalize(clause.exactText),
      tokenList: tokens(clause.exactText),
      deterministicSignals: {
        roles: roleSignals(clause.exactText),
        numericValues: numericSignals(clause.exactText),
      },
      semanticStatus: "UNASSESSED",
    };
  });
  if (
    new Set(facts.map(({ factId }) => factId)).size !== facts.length ||
    facts.length !== completeCorpus.clauses.length
  )
    throw indexError("LF_A_DRIVEN_B_FACT_INDEX_COVERAGE_INVALID");
  const payload = {
    schemaVersion: 1,
    contractId: A_DRIVEN_B_FACT_INDEX_CONTRACT_ID,
    completeBCorpusSha256: completeCorpus.corpusSha256,
    documents: completeCorpus.documents,
    facts,
    summary: {
      documents: completeCorpus.documents.length,
      sourceClauses: completeCorpus.clauses.length,
      facts: facts.length,
      sourceCoverage: "ALL_EXTRACTED_B_CLAUSE_BOUNDARIES",
      semanticStatus: "UNASSESSED",
      customerNotFoundEligible: false,
    },
    proofLimit:
      "Die Ledger ist vollständig über alle extrahierten B-Klauselgrenzen. Deterministische Signale dienen ausschließlich der Navigation. Ohne terminale Disposition jedes potenziell kompatiblen Fakts darf kein NICHT GEFUNDEN entstehen.",
  };
  return {
    ...payload,
    indexSha256: sha256(
      `${A_DRIVEN_B_FACT_INDEX_CONTRACT_ID}\u0000${stableStringify(payload)}`
    ),
  };
}

function validateADrivenBFactIndex(index, { completeCorpus } = {}) {
  if (
    index?.contractId !== A_DRIVEN_B_FACT_INDEX_CONTRACT_ID ||
    !Array.isArray(index.documents) ||
    !Array.isArray(index.facts) ||
    index.summary?.facts !== index.facts.length ||
    index.summary?.sourceCoverage !== "ALL_EXTRACTED_B_CLAUSE_BOUNDARIES" ||
    index.summary?.customerNotFoundEligible !== false ||
    !/^[a-f0-9]{64}$/u.test(String(index.indexSha256 || ""))
  )
    throw indexError("LF_A_DRIVEN_B_FACT_INDEX_INVALID");
  const { indexSha256, ...payload } = index;
  if (
    indexSha256 !==
    sha256(
      `${A_DRIVEN_B_FACT_INDEX_CONTRACT_ID}\u0000${stableStringify(payload)}`
    )
  )
    throw indexError("LF_A_DRIVEN_B_FACT_INDEX_DIGEST_INVALID");
  if (completeCorpus) {
    validateADrivenCompleteBCorpus(completeCorpus);
    const sourceIdentities = completeCorpus.clauses.map(factIdentity);
    const indexedIdentities = index.facts.map(
      ({
        documentUuid,
        documentSha256,
        clauseBoundaryId,
        documentStart,
        documentEnd,
        exactTextSha256,
      }) => ({
        documentUuid,
        documentSha256,
        clauseBoundaryId,
        documentStart,
        documentEnd,
        exactTextSha256,
      })
    );
    if (
      index.completeBCorpusSha256 !== completeCorpus.corpusSha256 ||
      stableStringify(indexedIdentities) !== stableStringify(sourceIdentities)
    )
      throw indexError("LF_A_DRIVEN_B_FACT_INDEX_SOURCE_MISMATCH");
  }
  return true;
}

function requirementQuery(row, expansionPhrases = []) {
  const componentLabels = row.components.flatMap((component) => [
    component.dimension,
    component.label,
  ]);
  const sourceText = row.aSourceSpans.flatMap((span) => [
    span.exactText,
    span.quote,
  ]);
  const parts = [
    row.displayLabel,
    ...(row.structurePath || []),
    ...componentLabels,
    ...sourceText,
  ].filter(Boolean);
  const phrases = sortedUnique(
    row.components
      .map(({ label }) => normalize(label))
      .filter((value) => value.length >= 8)
  );
  return {
    text: parts.join("\n"),
    tokens: sortedUnique(parts.flatMap(tokens)),
    phrases,
    expansionPhrases: sortedUnique(expansionPhrases.map(normalize)),
    numericValues: numericSignals(parts.join("\n")),
    desiredRoles: sortedUnique(
      row.components.flatMap(({ dimension }) => {
        const mapping = {
          COVERAGE_EFFECT: ["EXCLUSION", "INCLUSION"],
          DEDUCTIBLE: ["DEDUCTIBLE"],
          VALUE_AND_UNIT: ["LIMIT", "DEDUCTIBLE"],
          LIMIT_BASIS: ["LIMIT"],
          CONDITION: ["CONDITION"],
          TEMPORAL_VALIDITY: ["TEMPORAL"],
          PRECEDENCE_OR_REPLACEMENT: ["PRECEDENCE"],
          FACT_ROLE: ["DEFINITION", "COST"],
        };
        return mapping[dimension] || [];
      })
    ),
  };
}

function sourceKey(item) {
  return [
    item.documentUuid,
    item.documentStart,
    item.documentEnd,
    item.exactTextSha256,
  ].join(":");
}

function clauseKey(item) {
  return [item.documentUuid, item.clauseBoundaryId].join(":");
}

// Long extracted clauses can contain several independent list or table rows.
// These overlapping windows are navigation units only: every window retains
// its immutable parent fact and exact source offsets, and semantic decisions
// continue to bind to the complete parent clause.
function buildADrivenBRetrievalWindows(
  facts,
  { maximumTokens = 48, overlapTokens = 12 } = {}
) {
  if (
    !Array.isArray(facts) ||
    facts.length === 0 ||
    !Number.isInteger(maximumTokens) ||
    maximumTokens < 8 ||
    !Number.isInteger(overlapTokens) ||
    overlapTokens < 0 ||
    overlapTokens >= maximumTokens
  )
    throw indexError("LF_A_DRIVEN_B_RETRIEVAL_WINDOW_INPUT_INVALID");
  const stride = maximumTokens - overlapTokens;
  const windows = [];
  for (const fact of facts) {
    const text = String(fact.exactText || "");
    const sourceTokens = [...text.matchAll(/\S+/gu)].map((match) => ({
      start: match.index,
      end: match.index + match[0].length,
    }));
    if (!sourceTokens.length)
      throw indexError(
        "LF_A_DRIVEN_B_RETRIEVAL_WINDOW_SOURCE_INVALID",
        fact.factId
      );
    const starts = [];
    if (sourceTokens.length <= maximumTokens) starts.push(0);
    else {
      for (let start = 0; start < sourceTokens.length; start += stride) {
        starts.push(start);
        if (start + maximumTokens >= sourceTokens.length) break;
      }
      const finalStart = Math.max(0, sourceTokens.length - maximumTokens);
      if (starts.at(-1) !== finalStart) starts.push(finalStart);
    }
    for (const tokenStart of starts) {
      const tokenEnd = Math.min(
        sourceTokens.length,
        tokenStart + maximumTokens
      );
      const localStart = sourceTokens[tokenStart].start;
      const localEnd = sourceTokens[tokenEnd - 1].end;
      const exactText = text.slice(localStart, localEnd);
      const identity = {
        parentFactId: fact.factId,
        localStart,
        localEnd,
        maximumTokens,
        overlapTokens,
      };
      windows.push({
        contractId: A_DRIVEN_B_RETRIEVAL_WINDOW_CONTRACT_ID,
        windowId: `BRW-${sha256(stableStringify(identity)).slice(0, 24)}`,
        parentFactId: fact.factId,
        documentUuid: fact.documentUuid,
        documentPosition: fact.documentPosition,
        documentRole: fact.documentRole,
        physicalPageNumber: fact.physicalPageNumber,
        clauseBoundaryId: fact.clauseBoundaryId,
        parentDocumentStart: fact.documentStart,
        parentDocumentEnd: fact.documentEnd,
        parentExactTextSha256: fact.exactTextSha256,
        localStart,
        localEnd,
        documentStart: fact.documentStart + localStart,
        documentEnd: fact.documentStart + localEnd,
        exactText,
        exactTextSha256: sha256(exactText),
        normalizedText: normalize(exactText),
        tokenList: tokens(exactText),
      });
    }
  }
  if (new Set(windows.map(({ windowId }) => windowId)).size !== windows.length)
    throw indexError("LF_A_DRIVEN_B_RETRIEVAL_WINDOW_ID_DUPLICATE");
  return windows;
}

function contextualRetrievalFacts(
  facts,
  { maximumStandaloneTokens = 20, maximumContextDistance = 1_200 } = {}
) {
  const ordered = [...facts].sort(
    (left, right) =>
      left.documentStart - right.documentStart ||
      left.documentEnd - right.documentEnd ||
      left.factId.localeCompare(right.factId)
  );
  return ordered.map((fact, factIndex) => {
    if (fact.tokenList.length > maximumStandaloneTokens) return { ...fact };
    const context = [];
    for (const direction of [-1, 1]) {
      for (
        let neighborIndex = factIndex + direction;
        neighborIndex >= 0 && neighborIndex < ordered.length;
        neighborIndex += direction
      ) {
        const neighbor = ordered[neighborIndex];
        const distance = Math.max(
          0,
          Math.max(fact.documentStart, neighbor.documentStart) -
            Math.min(fact.documentEnd, neighbor.documentEnd)
        );
        if (distance > maximumContextDistance) break;
        if (neighbor.tokenList.length <= maximumStandaloneTokens) continue;
        context.push(neighbor.exactText);
        break;
      }
    }
    if (!context.length) return { ...fact };
    const retrievalText = [fact.exactText, ...context].join("\n");
    return {
      ...fact,
      normalizedText: normalize(retrievalText),
      tokenList: tokens(retrievalText),
      retrievalContext: {
        source: "NEAREST_COMPLETE_CLAUSE",
        contextClauses: context.length,
        maximumContextDistance,
      },
    };
  });
}

function batchCandidates(requirementId, candidates, maximumBatchCharacters) {
  const batches = [];
  let current = [];
  const flush = () => {
    if (!current.length) return;
    const batchIndex = batches.length;
    const factIds = current.map(({ factId }) => factId);
    batches.push({
      batchId: `BFR-${sha256(
        stableStringify({ requirementId, batchIndex, factIds })
      ).slice(0, 24)}`,
      requirementId,
      batchIndex,
      factIds,
    });
    current = [];
  };
  for (const candidate of candidates) {
    const proposed = [...current, candidate];
    if (
      current.length &&
      JSON.stringify({ requirementId, candidates: proposed }).length >
        maximumBatchCharacters
    )
      flush();
    if (
      JSON.stringify({ requirementId, candidates: [candidate] }).length >
      maximumBatchCharacters
    )
      throw indexError(
        "LF_A_DRIVEN_FAST_FALLBACK_FACT_TOO_LARGE",
        candidate.factId
      );
    current.push(candidate);
  }
  flush();
  return batches;
}

function buildADrivenFastFallbackPlan({
  decisionPlan,
  preliminaryDecisions,
  completeCorpus,
  factIndex,
  lexicalTopKPerDocument = 12,
  maximumBatchCharacters = 70_000,
  retrievalScope = "PER_DOCUMENT",
  neighborRadius = 0,
  neighborAnchorLimit = 0,
  queryExpansionsByRequirement = {},
  retrievalUnitStrategy = "PARENT_FACTS",
  retrievalWindowMaximumTokens = 48,
  retrievalWindowOverlapTokens = 12,
} = {}) {
  validateADrivenRequirementDecisionPlan(decisionPlan);
  validateADrivenRequirementDecisionArtifact(
    preliminaryDecisions,
    decisionPlan
  );
  validateADrivenCompleteBCorpus(completeCorpus);
  validateADrivenBFactIndex(factIndex, { completeCorpus });
  if (
    decisionPlan.completeBCorpusSha256 !== completeCorpus.corpusSha256 ||
    !Number.isInteger(lexicalTopKPerDocument) ||
    lexicalTopKPerDocument < 1 ||
    !Number.isInteger(maximumBatchCharacters) ||
    maximumBatchCharacters < 10_000 ||
    !["PER_DOCUMENT", "GLOBAL"].includes(retrievalScope) ||
    !Number.isInteger(neighborRadius) ||
    neighborRadius < 0 ||
    neighborRadius > 10 ||
    !Number.isInteger(neighborAnchorLimit) ||
    neighborAnchorLimit < 0 ||
    neighborAnchorLimit > lexicalTopKPerDocument ||
    !["PARENT_FACTS", "SOURCE_WINDOWS"].includes(retrievalUnitStrategy) ||
    !queryExpansionsByRequirement ||
    typeof queryExpansionsByRequirement !== "object" ||
    Array.isArray(queryExpansionsByRequirement)
  )
    throw indexError("LF_A_DRIVEN_FAST_FALLBACK_INPUT_INVALID");

  const normalizedQueryExpansions = {};
  for (const [requirementId, phrases] of Object.entries(
    queryExpansionsByRequirement
  )) {
    if (
      !Array.isArray(phrases) ||
      phrases.length > 12 ||
      phrases.some(
        (phrase) =>
          typeof phrase !== "string" ||
          normalize(phrase).length < 3 ||
          normalize(phrase).length > 120
      )
    )
      throw indexError(
        "LF_A_DRIVEN_FAST_FALLBACK_QUERY_EXPANSION_INVALID",
        requirementId
      );
    normalizedQueryExpansions[requirementId] = sortedUnique(
      phrases.map(normalize)
    );
  }

  const preliminaryById = new Map(
    preliminaryDecisions.results.map((result) => [result.requirementId, result])
  );
  const factsByDocument = new Map();
  for (const fact of factIndex.facts) {
    const list = factsByDocument.get(fact.documentUuid) || [];
    list.push({ ...fact });
    factsByDocument.set(fact.documentUuid, list);
  }
  const indexesByDocument = new Map(
    [...factsByDocument].map(([documentUuid, facts]) => {
      const rawFacts = facts.map((fact) => ({ ...fact }));
      const contextualFacts = contextualRetrievalFacts(facts);
      return [
        documentUuid,
        {
          rawFacts,
          rawIndex: bm25Index(rawFacts),
          contextualFacts,
          contextualIndex: bm25Index(contextualFacts),
        },
      ];
    })
  );
  const canonicalFactById = new Map(
    factIndex.facts.map((fact) => [fact.factId, fact])
  );
  const retrievalUnits =
    retrievalUnitStrategy === "SOURCE_WINDOWS"
      ? buildADrivenBRetrievalWindows(factIndex.facts, {
          maximumTokens: retrievalWindowMaximumTokens,
          overlapTokens: retrievalWindowOverlapTokens,
        })
      : factIndex.facts.map((fact) => ({ ...fact }));
  const retrievalUnitsByDocument = new Map();
  for (const unit of retrievalUnits) {
    const list = retrievalUnitsByDocument.get(unit.documentUuid) || [];
    list.push(unit);
    retrievalUnitsByDocument.set(unit.documentUuid, list);
  }
  const retrievalIndexesByDocument = new Map(
    [...retrievalUnitsByDocument].map(([documentUuid, units]) => [
      documentUuid,
      { units, index: bm25Index(units) },
    ])
  );
  const globalRetrievalUnitIndex = bm25Index(retrievalUnits);
  const globalRawFacts = factIndex.facts.map((fact) => ({ ...fact }));
  const globalContextualFacts = [...indexesByDocument.values()].flatMap(
    ({ contextualFacts }) => contextualFacts
  );
  const globalRetrieval = {
    rawFacts: globalRawFacts,
    rawIndex: bm25Index(globalRawFacts),
    contextualFacts: globalContextualFacts,
    contextualIndex: bm25Index(globalContextualFacts),
  };
  const orderedFactsByDocument = new Map(
    [...factsByDocument].map(([documentUuid, facts]) => [
      documentUuid,
      [...facts].sort(
        (left, right) =>
          left.documentStart - right.documentStart ||
          left.documentEnd - right.documentEnd ||
          left.factId.localeCompare(right.factId)
      ),
    ])
  );
  const factPositionById = new Map();
  for (const [documentUuid, facts] of orderedFactsByDocument)
    facts.forEach((fact, index) =>
      factPositionById.set(fact.factId, { documentUuid, index })
    );
  const rows = [];
  const batches = [];
  for (const row of decisionPlan.rows.filter(
    ({ requirementId }) =>
      preliminaryById.get(requirementId)?.customerStatus === "FALLBACK_REQUIRED"
  )) {
    const query = requirementQuery(
      row,
      normalizedQueryExpansions[row.requirementId] || []
    );
    const selected = new Map();
    const neighborAnchors = new Set();
    const add = (fact, channel) => {
      const existing = selected.get(fact.factId);
      if (existing)
        existing.channels = sortedUnique([...existing.channels, channel]);
      else selected.set(fact.factId, { ...fact, channels: [channel] });
    };
    const factBySource = new Map(
      factIndex.facts.map((fact) => [sourceKey(fact), fact])
    );
    const factByClause = new Map(
      factIndex.facts.map((fact) => [clauseKey(fact), fact])
    );
    for (const candidate of row.candidates || []) {
      const fact =
        factBySource.get(sourceKey(candidate)) ||
        factByClause.get(clauseKey(candidate));
      if (fact) {
        add(fact, "PRIMARY_REUSE");
        if (neighborAnchorLimit > 0) neighborAnchors.add(fact.factId);
      }
    }
    const lexicalTarget = {
      query: query.text,
      queryTokens: query.tokens,
      phrases: query.phrases,
    };
    const expandedLexicalTarget = query.expansionPhrases.length
      ? {
          query: [query.text, ...query.expansionPhrases].join("\n"),
          queryTokens: sortedUnique([
            ...query.tokens,
            ...query.expansionPhrases.flatMap(tokens),
          ]),
          phrases: query.phrases,
        }
      : null;
    const addRanked = (ranked, channel) => {
      for (const unit of ranked) {
        const factId = unit.parentFactId || unit.factId;
        add(canonicalFactById.get(factId), channel);
      }
      for (const unit of ranked.slice(0, neighborAnchorLimit))
        neighborAnchors.add(unit.parentFactId || unit.factId);
    };
    if (retrievalScope === "GLOBAL") {
      if (retrievalUnitStrategy === "SOURCE_WINDOWS") {
        addRanked(
          rankLexicalCandidates({
            target: lexicalTarget,
            candidates: retrievalUnits,
            index: globalRetrievalUnitIndex,
            topK: lexicalTopKPerDocument,
          }),
          "LEXICAL_BM25_SOURCE_WINDOW_GLOBAL"
        );
        if (expandedLexicalTarget)
          addRanked(
            rankLexicalCandidates({
              target: expandedLexicalTarget,
              candidates: retrievalUnits,
              index: globalRetrievalUnitIndex,
              topK: lexicalTopKPerDocument,
            }),
            "LEXICAL_EXPANSION_BM25_SOURCE_WINDOW_GLOBAL"
          );
      } else {
        const rawRanked = rankLexicalCandidates({
          target: lexicalTarget,
          candidates: globalRetrieval.rawFacts,
          index: globalRetrieval.rawIndex,
          topK: lexicalTopKPerDocument,
        });
        addRanked(rawRanked, "LEXICAL_BM25_GLOBAL");
        const contextualRanked = rankLexicalCandidates({
          target: lexicalTarget,
          candidates: globalRetrieval.contextualFacts,
          index: globalRetrieval.contextualIndex,
          topK: lexicalTopKPerDocument,
        });
        addRanked(
          contextualRanked.filter((fact) => fact.retrievalContext),
          "LEXICAL_CONTEXT_BM25_GLOBAL"
        );
        if (expandedLexicalTarget) {
          addRanked(
            rankLexicalCandidates({
              target: expandedLexicalTarget,
              candidates: globalRetrieval.rawFacts,
              index: globalRetrieval.rawIndex,
              topK: lexicalTopKPerDocument,
            }),
            "LEXICAL_EXPANSION_BM25_GLOBAL"
          );
          addRanked(
            rankLexicalCandidates({
              target: expandedLexicalTarget,
              candidates: globalRetrieval.contextualFacts,
              index: globalRetrieval.contextualIndex,
              topK: lexicalTopKPerDocument,
            }).filter((fact) => fact.retrievalContext),
            "LEXICAL_EXPANSION_CONTEXT_BM25_GLOBAL"
          );
        }
      }
    } else {
      for (const document of factIndex.documents) {
        if (retrievalUnitStrategy === "SOURCE_WINDOWS") {
          const retrieval = retrievalIndexesByDocument.get(
            document.documentUuid
          );
          addRanked(
            rankLexicalCandidates({
              target: lexicalTarget,
              candidates: retrieval.units,
              index: retrieval.index,
              topK: lexicalTopKPerDocument,
            }),
            "LEXICAL_BM25_SOURCE_WINDOW"
          );
          if (expandedLexicalTarget)
            addRanked(
              rankLexicalCandidates({
                target: expandedLexicalTarget,
                candidates: retrieval.units,
                index: retrieval.index,
                topK: lexicalTopKPerDocument,
              }),
              "LEXICAL_EXPANSION_BM25_SOURCE_WINDOW"
            );
          continue;
        }
        const retrieval = indexesByDocument.get(document.documentUuid);
        const rawRanked = rankLexicalCandidates({
          target: lexicalTarget,
          candidates: retrieval.rawFacts,
          index: retrieval.rawIndex,
          topK: lexicalTopKPerDocument,
        });
        addRanked(rawRanked, "LEXICAL_BM25");
        const contextualRanked = rankLexicalCandidates({
          target: lexicalTarget,
          candidates: retrieval.contextualFacts,
          index: retrieval.contextualIndex,
          topK: lexicalTopKPerDocument,
        });
        addRanked(
          contextualRanked.filter((fact) => fact.retrievalContext),
          "LEXICAL_CONTEXT_BM25"
        );
        if (expandedLexicalTarget) {
          addRanked(
            rankLexicalCandidates({
              target: expandedLexicalTarget,
              candidates: retrieval.rawFacts,
              index: retrieval.rawIndex,
              topK: lexicalTopKPerDocument,
            }),
            "LEXICAL_EXPANSION_BM25"
          );
          addRanked(
            rankLexicalCandidates({
              target: expandedLexicalTarget,
              candidates: retrieval.contextualFacts,
              index: retrieval.contextualIndex,
              topK: lexicalTopKPerDocument,
            }).filter((fact) => fact.retrievalContext),
            "LEXICAL_EXPANSION_CONTEXT_BM25"
          );
        }
      }
    }
    for (const fact of factIndex.facts) {
      if (query.phrases.some((phrase) => fact.normalizedText.includes(phrase)))
        add(fact, "EXACT_COMPONENT_PHRASE");
      if (
        query.numericValues.length &&
        query.numericValues.some((value) =>
          fact.deterministicSignals.numericValues.includes(value)
        ) &&
        query.desiredRoles.some((role) =>
          fact.deterministicSignals.roles.includes(role)
        )
      )
        add(fact, "VALUE_ROLE");
    }
    if (neighborRadius > 0)
      for (const anchorFactId of neighborAnchors) {
        const position = factPositionById.get(anchorFactId);
        if (!position) continue;
        const facts = orderedFactsByDocument.get(position.documentUuid);
        const start = Math.max(0, position.index - neighborRadius);
        const end = Math.min(facts.length - 1, position.index + neighborRadius);
        for (let index = start; index <= end; index += 1)
          add(facts[index], "SOURCE_NEIGHBOR");
      }
    const candidates = [...selected.values()].sort(
      (left, right) =>
        left.documentPosition - right.documentPosition ||
        left.physicalPageNumber - right.physicalPageNumber ||
        left.documentStart - right.documentStart ||
        left.factId.localeCompare(right.factId)
    );
    const reviewBatches = batchCandidates(
      row.requirementId,
      candidates,
      maximumBatchCharacters
    );
    batches.push(...reviewBatches);
    rows.push({
      requirementId: row.requirementId,
      query,
      candidateFactIds: candidates.map(({ factId }) => factId),
      candidateSelections: candidates.map(({ factId, channels }) => ({
        factId,
        channels,
      })),
      unassessedFactIds: factIndex.facts
        .filter(({ factId }) => !selected.has(factId))
        .map(({ factId }) => factId),
      reviewBatchIds: reviewBatches.map(({ batchId }) => batchId),
      customerNotFoundEligible: false,
    });
  }
  const payload = {
    schemaVersion: 1,
    contractId: A_DRIVEN_FAST_FALLBACK_PLAN_CONTRACT_ID,
    decisionPlanSha256: decisionPlan.planSha256,
    preliminaryDecisionSha256: preliminaryDecisions.decisionSha256,
    completeBCorpusSha256: completeCorpus.corpusSha256,
    factIndexSha256: factIndex.indexSha256,
    lexicalTopKPerDocument,
    maximumBatchCharacters,
    retrievalScope,
    neighborRadius,
    neighborAnchorLimit,
    queryExpansionSha256: Object.keys(normalizedQueryExpansions).length
      ? sha256(stableStringify(normalizedQueryExpansions))
      : null,
    retrievalUnitStrategy,
    retrievalWindowMaximumTokens:
      retrievalUnitStrategy === "SOURCE_WINDOWS"
        ? retrievalWindowMaximumTokens
        : null,
    retrievalWindowOverlapTokens:
      retrievalUnitStrategy === "SOURCE_WINDOWS"
        ? retrievalWindowOverlapTokens
        : null,
    rows,
    batches,
    summary: {
      fallbackRequirements: rows.length,
      corpusFacts: factIndex.facts.length,
      selectedFactReviews: rows.reduce(
        (sum, row) => sum + row.candidateFactIds.length,
        0
      ),
      unassessedFactPairs: rows.reduce(
        (sum, row) => sum + row.unassessedFactIds.length,
        0
      ),
      reviewBatches: batches.length,
      retrievalScope,
      neighborRadius,
      neighborAnchorLimit,
      expandedRequirements: rows.filter(
        ({ query }) => query.expansionPhrases.length > 0
      ).length,
      retrievalUnitStrategy,
      retrievalUnits: retrievalUnits.length,
      customerNotFoundEligible: false,
    },
    proofLimit:
      "Shadow-Kandidatenplan. Er misst den Laufzeithebel und bekannte Rescue-Relevanz, zertifiziert aber keine Abwesenheit. Jedes unassessedFactId blockiert NICHT GEFUNDEN.",
  };
  return {
    ...payload,
    planSha256: sha256(
      `${A_DRIVEN_FAST_FALLBACK_PLAN_CONTRACT_ID}\u0000${stableStringify(
        payload
      )}`
    ),
  };
}

function buildADrivenFastFallbackReplay({
  fastPlan,
  factIndex,
  absencePlan,
  absenceDecisions,
} = {}) {
  if (
    fastPlan?.contractId !== A_DRIVEN_FAST_FALLBACK_PLAN_CONTRACT_ID ||
    factIndex?.contractId !== A_DRIVEN_B_FACT_INDEX_CONTRACT_ID ||
    absencePlan?.contractId !== "LF_A_DRIVEN_REQUIREMENT_ABSENCE_PLAN_V1" ||
    absenceDecisions?.contractId !==
      "LF_A_DRIVEN_REQUIREMENT_ABSENCE_DECISION_V1" ||
    absenceDecisions.absencePlanSha256 !== absencePlan.planSha256
  )
    throw indexError("LF_A_DRIVEN_FAST_FALLBACK_REPLAY_INPUT_INVALID");
  const factBySource = new Map(
    factIndex.facts.map((fact) => [sourceKey(fact), fact])
  );
  const absenceCandidateById = new Map(
    absencePlan.candidates.map((candidate) => [
      candidate.candidateId,
      candidate,
    ])
  );
  const rowByRequirement = new Map(
    fastPlan.rows.map((row) => [row.requirementId, row])
  );
  const cases = absenceDecisions.results
    .filter(({ customerStatus }) => customerStatus === "FALLBACK_REQUIRED")
    .map((result) => {
      const expectedFactIds = sortedUnique(
        (result.selectedCandidateIds || []).map((candidateId) => {
          const candidate = absenceCandidateById.get(candidateId);
          return candidate
            ? factBySource.get(sourceKey(candidate))?.factId
            : null;
        })
      );
      const selected = new Set(
        rowByRequirement.get(result.requirementId)?.candidateFactIds || []
      );
      const recoveredFactIds = expectedFactIds.filter((factId) =>
        selected.has(factId)
      );
      return {
        requirementId: result.requirementId,
        expectedPositiveFactIds: expectedFactIds,
        recoveredPositiveFactIds: recoveredFactIds,
        recoveredAnyPositive: recoveredFactIds.length > 0,
        recoveredAllPositives:
          expectedFactIds.length > 0 &&
          recoveredFactIds.length === expectedFactIds.length,
      };
    });
  const knownPositiveFacts = cases.reduce(
    (sum, item) => sum + item.expectedPositiveFactIds.length,
    0
  );
  const recoveredPositiveFacts = cases.reduce(
    (sum, item) => sum + item.recoveredPositiveFactIds.length,
    0
  );
  const payload = {
    schemaVersion: 1,
    contractId: A_DRIVEN_FAST_FALLBACK_REPLAY_CONTRACT_ID,
    fastPlanSha256: fastPlan.planSha256,
    factIndexSha256: factIndex.indexSha256,
    absenceDecisionSha256: absenceDecisions.decisionSha256,
    cases,
    summary: {
      knownPositiveRequirements: cases.length,
      recoveredAnyPositiveRequirements: cases.filter(
        ({ recoveredAnyPositive }) => recoveredAnyPositive
      ).length,
      recoveredAllPositiveRequirements: cases.filter(
        ({ recoveredAllPositives }) => recoveredAllPositives
      ).length,
      knownPositiveFacts,
      recoveredPositiveFacts,
      positiveFactRecall:
        knownPositiveFacts === 0
          ? null
          : recoveredPositiveFacts / knownPositiveFacts,
      baselineClauseReviews: absencePlan.summary.plannedClauseReviews,
      shadowFactReviews: fastPlan.summary.selectedFactReviews,
      baselineRequests: absencePlan.summary.partitions,
      shadowReviewBatches: fastPlan.summary.reviewBatches,
      customerNotFoundEligible: false,
    },
    proofLimit:
      "Replay gegen bekannte V3.9.15-Rescue-Treffer. Kein Beweis für unbekannte positive Stellen, echte Nullfunde, Holdout-Qualität oder Produktfreigabe.",
  };
  return {
    ...payload,
    replaySha256: sha256(
      `${A_DRIVEN_FAST_FALLBACK_REPLAY_CONTRACT_ID}\u0000${stableStringify(
        payload
      )}`
    ),
  };
}

function buildADrivenTerminalEvidenceReplay({
  fastPlan,
  factIndex,
  rescuePlan,
  rescueDecisions,
} = {}) {
  if (
    fastPlan?.contractId !== A_DRIVEN_FAST_FALLBACK_PLAN_CONTRACT_ID ||
    factIndex?.contractId !== A_DRIVEN_B_FACT_INDEX_CONTRACT_ID
  )
    throw indexError("LF_A_DRIVEN_TERMINAL_EVIDENCE_REPLAY_INPUT_INVALID");
  validateADrivenRequirementDecisionArtifact(rescueDecisions, rescuePlan);
  const factBySource = new Map(
    factIndex.facts.map((fact) => [sourceKey(fact), fact])
  );
  const rowByRequirement = new Map(
    fastPlan.rows.map((row) => [row.requirementId, row])
  );
  const rescueRowByRequirement = new Map(
    rescuePlan.rows.map((row) => [row.requirementId, row])
  );
  const cases = rescueDecisions.results
    .filter(
      ({ status, customerStatus, selectedCandidateIds }) =>
        status === "TERMINAL" &&
        customerStatus === "FOUND" &&
        selectedCandidateIds.length > 0
    )
    .map((result) => {
      const rescueRow = rescueRowByRequirement.get(result.requirementId);
      const rescueCandidatesById = new Map(
        rescueRow.candidates.map((candidate) => [
          candidate.candidateId,
          candidate,
        ])
      );
      const expectedFactIds = sortedUnique(
        result.selectedCandidateIds.map((candidateId) => {
          const candidate = rescueCandidatesById.get(candidateId);
          if (!candidate)
            throw indexError(
              "LF_A_DRIVEN_TERMINAL_EVIDENCE_CANDIDATE_UNKNOWN",
              candidateId
            );
          const fact = factBySource.get(sourceKey(candidate));
          if (!fact)
            throw indexError(
              "LF_A_DRIVEN_TERMINAL_EVIDENCE_SOURCE_UNKNOWN",
              candidateId
            );
          return fact.factId;
        })
      );
      const selected = new Set(
        rowByRequirement.get(result.requirementId)?.candidateFactIds || []
      );
      const recoveredFactIds = expectedFactIds.filter((factId) =>
        selected.has(factId)
      );
      return {
        requirementId: result.requirementId,
        expectedTerminalEvidenceFactIds: expectedFactIds,
        recoveredTerminalEvidenceFactIds: recoveredFactIds,
        recoveredAnyTerminalEvidence: recoveredFactIds.length > 0,
        recoveredAllTerminalEvidence:
          recoveredFactIds.length === expectedFactIds.length,
      };
    });
  const expectedTerminalEvidenceFacts = cases.reduce(
    (sum, item) => sum + item.expectedTerminalEvidenceFactIds.length,
    0
  );
  const recoveredTerminalEvidenceFacts = cases.reduce(
    (sum, item) => sum + item.recoveredTerminalEvidenceFactIds.length,
    0
  );
  const payload = {
    schemaVersion: 1,
    contractId: A_DRIVEN_TERMINAL_EVIDENCE_REPLAY_CONTRACT_ID,
    fastPlanSha256: fastPlan.planSha256 || null,
    factIndexSha256: factIndex.indexSha256,
    rescueDecisionSha256: rescueDecisions.decisionSha256,
    cases,
    summary: {
      terminalPositiveRequirements: cases.length,
      recoveredAnyTerminalPositiveRequirements: cases.filter(
        ({ recoveredAnyTerminalEvidence }) => recoveredAnyTerminalEvidence
      ).length,
      recoveredAllTerminalPositiveRequirements: cases.filter(
        ({ recoveredAllTerminalEvidence }) => recoveredAllTerminalEvidence
      ).length,
      expectedTerminalEvidenceFacts,
      recoveredTerminalEvidenceFacts,
      terminalEvidenceRecall:
        expectedTerminalEvidenceFacts === 0
          ? null
          : recoveredTerminalEvidenceFacts / expectedTerminalEvidenceFacts,
      shadowFactReviews: fastPlan.summary.selectedFactReviews,
      shadowReviewBatches: fastPlan.summary.reviewBatches,
      customerNotFoundEligible: false,
    },
    proofLimit:
      "Replay gegen die vom finalen V3.9.15-Rescue-Urteil tatsächlich referenzierte Evidenz. Kein Beweis für unbekannte positive Stellen, echte Nullfunde, Holdout-Qualität oder Produktfreigabe.",
  };
  return {
    ...payload,
    replaySha256: sha256(
      `${A_DRIVEN_TERMINAL_EVIDENCE_REPLAY_CONTRACT_ID}\u0000${stableStringify(
        payload
      )}`
    ),
  };
}

module.exports = {
  A_DRIVEN_B_FACT_INDEX_CONTRACT_ID,
  A_DRIVEN_FAST_FALLBACK_PLAN_CONTRACT_ID,
  A_DRIVEN_FAST_FALLBACK_REPLAY_CONTRACT_ID,
  A_DRIVEN_TERMINAL_EVIDENCE_REPLAY_CONTRACT_ID,
  A_DRIVEN_B_RETRIEVAL_WINDOW_CONTRACT_ID,
  buildADrivenBFactIndex,
  buildADrivenBRetrievalWindows,
  buildADrivenFastFallbackPlan,
  buildADrivenFastFallbackReplay,
  buildADrivenTerminalEvidenceReplay,
  contextualRetrievalFacts,
  validateADrivenBFactIndex,
};

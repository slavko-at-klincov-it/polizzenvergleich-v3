const crypto = require("crypto");

const SOURCE_REVIEW_PACKET_CONTRACT_ID = "LF_1PLUS9_SOURCE_REVIEW_PACKET_V6";
const SOURCE_REVIEW_RESPONSE_CONTRACT_ID =
  "LF_1PLUS9_SOURCE_REVIEW_RESPONSE_V5";
const REVIEW_OUTCOMES = new Set([
  "FULL_COUNTERPART",
  "PARTIAL_COUNTERPART",
  "NO_COUNTERPART_ESTABLISHED",
  "CONTRADICTED",
]);
const COMPONENT_OUTCOMES = new Set([
  "MATCH",
  "OPPOSITE",
  "RELATED_ONLY",
  "NOT_ESTABLISHED",
]);
const REVIEW_DIMENSIONS = new Set([
  "OBJECT",
  "PERIL_OR_CAUSE",
  "DAMAGE_OR_EFFECT",
  "COVERAGE_EFFECT",
  "SCOPE",
  "FACT_ROLE",
  "CONDITION",
  "VALUE_AND_UNIT",
  "LIMIT_BASIS",
  "DEDUCTIBLE",
  "TEMPORAL_VALIDITY",
  "DOCUMENT_ROLE",
  "PRECEDENCE_OR_REPLACEMENT",
]);
const STOP_WORDS = new Set([
  "aber",
  "alle",
  "als",
  "am",
  "an",
  "auf",
  "aus",
  "bei",
  "bis",
  "das",
  "dem",
  "den",
  "der",
  "des",
  "die",
  "durch",
  "ein",
  "eine",
  "einer",
  "eines",
  "für",
  "gegen",
  "im",
  "in",
  "ist",
  "mit",
  "nach",
  "nicht",
  "oder",
  "sind",
  "und",
  "von",
  "vor",
  "wenn",
  "werden",
  "wird",
  "zu",
  "zum",
  "zur",
]);

function reviewError(code, detail = "") {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  return error;
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function stableStringify(value) {
  if (Array.isArray(value))
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

function normalizedText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("de-AT")
    .replace(/[^\p{L}\p{N}%€]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function tokens(value) {
  return new Set(
    normalizedText(value)
      .split(" ")
      .filter(
        (token) =>
          token.length >= 3 && !STOP_WORDS.has(token) && !/^\d+$/u.test(token)
      )
  );
}

function overlapRatio(query, candidate) {
  if (!query.size) return 0;
  let common = 0;
  for (const token of query) if (candidate.has(token)) common += 1;
  return common / query.size;
}

function compoundOverlapRatio(query, candidate) {
  if (!query.size) return 0;
  let common = 0;
  for (const queryToken of query) {
    if (
      [...candidate].some(
        (candidateToken) =>
          queryToken === candidateToken ||
          (queryToken.length >= 6 &&
            candidateToken.length >= 6 &&
            (queryToken.includes(candidateToken) ||
              candidateToken.includes(queryToken)))
      )
    )
      common += 1;
  }
  return common / query.size;
}

function factRoleDimension(factRole) {
  const dimensions = {
    CONDITION: "CONDITION",
    PERIL: "PERIL_OR_CAUSE",
    BENEFIT: "DAMAGE_OR_EFFECT",
    LIMIT: "LIMIT_BASIS",
    INSURED_OBJECT: "OBJECT",
    DEFINITION: "SCOPE",
    EXCLUSION: "COVERAGE_EFFECT",
    COST: "VALUE_AND_UNIT",
    DEDUCTIBLE: "DEDUCTIBLE",
    DOCUMENT_STATUS: "DOCUMENT_ROLE",
  };
  const dimension = dimensions[factRole];
  if (!dimension)
    throw reviewError("LF_SOURCE_REVIEW_FACT_ROLE_UNKNOWN", factRole);
  return dimension;
}

function candidateScore(candidate, component, row) {
  const query = tokens(
    [
      row.point,
      row.system?.aContent,
      row.claude?.sourceQuote,
      component.label,
    ].join(" ")
  );
  const quote = tokens(candidate.range.exactQuote);
  const lexical = overlapRatio(query, quote);
  const componentBonus =
    candidate.componentId === component.componentId ? 0.25 : 0;
  const rankBonus = 1 / Math.max(1, Number(candidate.rank) || 1);
  const lengthPenalty =
    Math.min(candidate.range.exactQuote.length, 5000) / 50000;
  return lexical * 3 + componentBonus + rankBonus - lengthPenalty;
}

function excerptRange(candidate, queryText, maximumQuoteCharacters) {
  const source = candidate.range.exactQuote;
  if (source.length <= maximumQuoteCharacters)
    return {
      exactQuote: source,
      exactQuoteSha256: candidate.range.exactQuoteSha256,
      documentStart: candidate.range.documentStart,
      documentEnd: candidate.range.documentEnd,
      excerpted: false,
    };
  const lowered = source.toLocaleLowerCase("de-AT");
  const anchors = [...tokens(queryText)].sort(
    (left, right) => right.length - left.length || left.localeCompare(right)
  );
  const anchorIndex = anchors.reduce((found, anchor) => {
    if (found >= 0) return found;
    return lowered.indexOf(anchor.toLocaleLowerCase("de-AT"));
  }, -1);
  const center = anchorIndex >= 0 ? anchorIndex : 0;
  let start = Math.max(0, center - Math.floor(maximumQuoteCharacters / 3));
  let end = Math.min(source.length, start + maximumQuoteCharacters);
  if (end === source.length) start = Math.max(0, end - maximumQuoteCharacters);
  if (start > 0) {
    const boundary = source.indexOf(" ", start);
    if (boundary >= 0 && boundary < start + 80) start = boundary + 1;
  }
  if (end < source.length) {
    const boundary = source.lastIndexOf(" ", end);
    if (boundary > end - 80) end = boundary;
  }
  const exactQuote = source.slice(start, end);
  return {
    exactQuote,
    exactQuoteSha256: sha256(exactQuote),
    documentStart: candidate.range.documentStart + start,
    documentEnd: candidate.range.documentStart + end,
    excerpted: true,
  };
}

function compactCandidate(
  candidate,
  document,
  component,
  row,
  maximumQuoteCharacters
) {
  const excerpt = excerptRange(
    candidate,
    [
      row.point,
      row.system?.aContent,
      row.claude?.sourceQuote,
      component.label,
    ].join(" "),
    maximumQuoteCharacters
  );
  return {
    candidateId: candidate.candidateId,
    componentId: candidate.componentId,
    documentUuid: candidate.range.documentUuid,
    documentFingerprint: candidate.range.documentFingerprint,
    documentName: document.originalName,
    documentRole: document.role,
    documentStatus: document.documentStatus,
    physicalPageNumber: candidate.range.physicalPageNumber,
    documentStart: excerpt.documentStart,
    documentEnd: excerpt.documentEnd,
    exactQuote: excerpt.exactQuote,
    exactQuoteSha256: excerpt.exactQuoteSha256,
    excerpted: excerpt.excerpted,
    oracleExactQuoteSha256: candidate.range.exactQuoteSha256,
    rank: candidate.rank,
    score: candidate.score,
  };
}

function selectComponentCandidates({
  candidates,
  component,
  row,
  documentsByUuid,
  maximumPerComponent,
  maximumQuoteCharacters,
  allowAllComponents = false,
}) {
  const seenQuotes = new Set();
  const scored = candidates
    .filter(
      (candidate) =>
        allowAllComponents ||
        candidate.componentId === null ||
        candidate.componentId === component.componentId
    )
    .filter((candidate) => {
      const key = `${candidate.range.documentFingerprint}:${candidate.range.exactQuoteSha256}`;
      if (seenQuotes.has(key)) return false;
      seenQuotes.add(key);
      return true;
    })
    .map((candidate) => ({
      candidate,
      reviewScore: candidateScore(candidate, component, row),
      claudeOverlap: overlapRatio(
        tokens(row.claude?.sourceQuote),
        tokens(candidate.range.exactQuote)
      ),
    }))
    .sort(
      (left, right) =>
        right.reviewScore - left.reviewScore ||
        left.candidate.range.exactQuote.length -
          right.candidate.range.exactQuote.length ||
        left.candidate.rank - right.candidate.rank ||
        left.candidate.candidateId.localeCompare(right.candidate.candidateId)
    );
  const selected = [];
  const selectedIds = new Set();
  const selectedDocuments = new Set();
  const claudeRebind = scored
    .filter(
      ({ claudeOverlap }) =>
        row.claude?.foundStatus !== "Nein" && claudeOverlap > 0
    )
    .sort(
      (left, right) =>
        right.claudeOverlap - left.claudeOverlap ||
        left.candidate.range.exactQuote.length -
          right.candidate.range.exactQuote.length ||
        left.candidate.rank - right.candidate.rank
    )[0];
  if (claudeRebind) {
    selected.push(claudeRebind);
    selectedIds.add(claudeRebind.candidate.candidateId);
    selectedDocuments.add(claudeRebind.candidate.range.documentUuid);
  }
  for (const item of scored) {
    if (selected.length >= maximumPerComponent) break;
    const documentUuid = item.candidate.range.documentUuid;
    if (selectedDocuments.has(documentUuid)) continue;
    selected.push(item);
    selectedIds.add(item.candidate.candidateId);
    selectedDocuments.add(documentUuid);
  }
  for (const item of scored) {
    if (selected.length >= maximumPerComponent) break;
    if (selectedIds.has(item.candidate.candidateId)) continue;
    selected.push(item);
    selectedIds.add(item.candidate.candidateId);
  }
  return selected.map(({ candidate }) => {
    const document = documentsByUuid.get(candidate.range.documentUuid);
    if (!document)
      throw reviewError(
        "LF_SOURCE_REVIEW_CANDIDATE_DOCUMENT_MISSING",
        candidate.candidateId
      );
    return compactCandidate(
      candidate,
      document,
      component,
      row,
      maximumQuoteCharacters
    );
  });
}

function clippedText(value, maximumCharacters) {
  const text = String(value || "").trim();
  if (text.length <= maximumCharacters) return text || null;
  return `${text.slice(0, maximumCharacters).trim()} […]`;
}

function globalClaudeRebindCandidates({
  candidateIndex,
  existingCandidates,
  row,
  documentsByUuid,
  maximumQuoteCharacters,
  maximumCandidates = 3,
}) {
  if (row.claude?.foundStatus === "Nein") return [];
  const query = tokens(row.claude?.sourceQuote);
  if (!query.size) return [];
  const existingRanges = new Set(
    existingCandidates.map(
      ({ documentFingerprint, physicalPageNumber, oracleExactQuoteSha256 }) =>
        `${documentFingerprint}:${physicalPageNumber}:${oracleExactQuoteSha256}`
    )
  );
  const seenRanges = new Set();
  const scored = [];
  for (const { candidate, sourceTokens } of candidateIndex) {
    const rangeKey = `${candidate.range.documentFingerprint}:${candidate.range.physicalPageNumber}:${candidate.range.exactQuoteSha256}`;
    if (existingRanges.has(rangeKey) || seenRanges.has(rangeKey)) continue;
    const overlap = overlapRatio(query, sourceTokens);
    if (overlap <= 0) continue;
    seenRanges.add(rangeKey);
    scored.push({ candidate, overlap });
  }
  return scored
    .sort(
      (left, right) =>
        right.overlap - left.overlap ||
        left.candidate.range.exactQuote.length -
          right.candidate.range.exactQuote.length ||
        left.candidate.rank - right.candidate.rank ||
        left.candidate.candidateId.localeCompare(right.candidate.candidateId)
    )
    .slice(0, maximumCandidates)
    .map(({ candidate }) => {
      const document = documentsByUuid.get(candidate.range.documentUuid);
      if (!document)
        throw reviewError(
          "LF_SOURCE_REVIEW_CANDIDATE_DOCUMENT_MISSING",
          candidate.candidateId
        );
      return {
        ...compactCandidate(
          candidate,
          document,
          {
            componentId: `__global_claude_rebind__:${row.requirementId}`,
            label: row.claude.sourceQuote,
          },
          row,
          maximumQuoteCharacters
        ),
        evidenceOrigin: "GLOBAL_CLAUDE_QUOTE_REBIND",
        originalTargetRequirementId: candidate.requirementId,
        originalTargetComponentId: candidate.componentId,
      };
    });
}

function globalReferenceARebindCandidates({
  candidateIndex,
  existingCandidates,
  row,
  semanticChecks,
  documentsByUuid,
  maximumQuoteCharacters,
  maximumPerCheck = 3,
}) {
  const existingRanges = new Set(
    existingCandidates.map(
      ({ documentFingerprint, physicalPageNumber, oracleExactQuoteSha256 }) =>
        `${documentFingerprint}:${physicalPageNumber}:${oracleExactQuoteSha256}`
    )
  );
  const selectedByRange = new Map();
  for (const component of semanticChecks) {
    const focusedQuery = tokens([row.point, component.label].join(" "));
    const referenceQuery = tokens(row.system?.aContent);
    if (!focusedQuery.size && !referenceQuery.size) continue;
    const seenRanges = new Set();
    const scored = [];
    for (const { candidate, sourceTokens } of candidateIndex) {
      const rangeKey = `${candidate.range.documentFingerprint}:${candidate.range.physicalPageNumber}:${candidate.range.exactQuoteSha256}`;
      if (
        existingRanges.has(rangeKey) ||
        selectedByRange.has(rangeKey) ||
        seenRanges.has(rangeKey)
      )
        continue;
      const focusedOverlap = compoundOverlapRatio(focusedQuery, sourceTokens);
      const referenceOverlap = compoundOverlapRatio(
        referenceQuery,
        sourceTokens
      );
      if (focusedOverlap <= 0 && referenceOverlap <= 0) continue;
      seenRanges.add(rangeKey);
      scored.push({ candidate, focusedOverlap, referenceOverlap, rangeKey });
    }
    const selected = [];
    const selectedDocuments = new Set();
    const ranked = scored.sort(
      (left, right) =>
        right.focusedOverlap - left.focusedOverlap ||
        right.referenceOverlap - left.referenceOverlap ||
        left.candidate.range.exactQuote.length -
          right.candidate.range.exactQuote.length ||
        left.candidate.rank - right.candidate.rank ||
        left.candidate.candidateId.localeCompare(right.candidate.candidateId)
    );
    for (const item of ranked) {
      if (selected.length >= maximumPerCheck) break;
      if (selectedDocuments.has(item.candidate.range.documentUuid)) continue;
      selected.push(item);
      selectedDocuments.add(item.candidate.range.documentUuid);
    }
    for (const item of ranked) {
      if (selected.length >= maximumPerCheck) break;
      if (selected.includes(item)) continue;
      selected.push(item);
    }
    for (const { candidate, rangeKey } of selected) {
      const document = documentsByUuid.get(candidate.range.documentUuid);
      if (!document)
        throw reviewError(
          "LF_SOURCE_REVIEW_CANDIDATE_DOCUMENT_MISSING",
          candidate.candidateId
        );
      selectedByRange.set(rangeKey, {
        ...compactCandidate(
          candidate,
          document,
          component,
          row,
          maximumQuoteCharacters
        ),
        evidenceOrigin: "GLOBAL_REFERENCE_A_REBIND",
        targetComponentIds: [component.componentId],
        originalTargetRequirementId: candidate.requirementId,
        originalTargetComponentId: candidate.componentId,
      });
    }
  }
  return [...selectedByRange.values()];
}

function buildLfKnownFixtureSourceReviewPacket({
  goldCandidate,
  oracle,
  selection = "REPRESENTATIVE_30_V1",
  maximumPerComponent = 4,
  maximumQuoteCharacters = 1_200,
  createdAt = new Date().toISOString(),
} = {}) {
  const globalReferenceMaximumQuoteCharacters = Math.min(
    maximumQuoteCharacters,
    600
  );
  if (
    goldCandidate?.contractId !== "LF_1PLUS9_GOLD_CANDIDATE_V1" ||
    goldCandidate?.status !== "SOURCE_REVIEW_REQUIRED" ||
    !Array.isArray(goldCandidate.representativeReview) ||
    goldCandidate.representativeReview.length !== 30 ||
    !Array.isArray(goldCandidate.rows) ||
    goldCandidate.rows.length !== 283 ||
    oracle?.contractId !== "LF_COUNTERPART_GOLD_ORACLE_V1" ||
    !Array.isArray(oracle.benchmarkCandidates) ||
    !Array.isArray(oracle.documents) ||
    !Number.isInteger(maximumPerComponent) ||
    maximumPerComponent < 1 ||
    !Number.isInteger(maximumQuoteCharacters) ||
    maximumQuoteCharacters < 200
  )
    throw reviewError("LF_SOURCE_REVIEW_INPUT_INVALID");
  if (!new Set(["REPRESENTATIVE_30_V1", "ALL_283_V1"]).has(selection))
    throw reviewError("LF_SOURCE_REVIEW_SELECTION_INVALID", selection);
  const rowsByRequirement = new Map(
    goldCandidate.rows.map((row) => [row.requirementId, row])
  );
  const oracleRows = new Map(
    oracle.rows.map((row) => [row.requirementId, row])
  );
  const candidatesById = new Map(
    oracle.benchmarkCandidates.map((candidate) => [
      candidate.candidateId,
      candidate,
    ])
  );
  const bDocuments = oracle.documents.filter(({ side }) => side === "B");
  if (bDocuments.length !== 9)
    throw reviewError("LF_SOURCE_REVIEW_B_DOCUMENT_COUNT_INVALID");
  const documentsByUuid = new Map(
    bDocuments.map((document) => [document.uuid, document])
  );
  const globalCandidateIndex = oracle.benchmarkCandidates.map((candidate) => ({
    candidate,
    sourceTokens: tokens(candidate.range.exactQuote),
  }));
  const selectedReview =
    selection === "ALL_283_V1"
      ? goldCandidate.rows.map(
          ({ analysisRowId, requirementId, relation }) => ({
            analysisRowId,
            requirementId,
            relation,
          })
        )
      : goldCandidate.representativeReview;
  const rows = selectedReview.map(
    ({ requirementId, relation }, reviewIndex) => {
      const row = rowsByRequirement.get(requirementId);
      const oracleRow = oracleRows.get(requirementId);
      if (!row || !oracleRow || row.analysisRowId !== oracleRow.analysisRowId)
        throw reviewError(
          "LF_SOURCE_REVIEW_ROW_BINDING_INVALID",
          requirementId
        );
      const rowCandidates = oracleRow.benchmarkCandidateIds.map(
        (candidateId) => {
          const candidate = candidatesById.get(candidateId);
          if (!candidate)
            throw reviewError(
              "LF_SOURCE_REVIEW_CANDIDATE_MISSING",
              candidateId
            );
          return candidate;
        }
      );
      const components = row.components.map((component) => ({
        componentId: component.componentId,
        label: component.label,
        factRole: component.factRole,
        dimension: factRoleDimension(component.factRole),
        candidates: selectComponentCandidates({
          candidates: rowCandidates,
          component,
          row,
          documentsByUuid,
          maximumPerComponent,
          maximumQuoteCharacters,
        }),
      }));
      const rowContext = {
        componentId: `__row_context__:${requirementId}`,
        label: [row.category, row.subcategory, row.point].join(" > "),
        factRole: "ROW_CONTEXT",
        dimension: "SCOPE",
        contextOnly: true,
        candidates: selectComponentCandidates({
          candidates: rowCandidates,
          component: {
            componentId: `__row_context__:${requirementId}`,
            label: [row.category, row.subcategory, row.point].join(" "),
          },
          row,
          documentsByUuid,
          maximumPerComponent,
          maximumQuoteCharacters,
          allowAllComponents: true,
        }),
      };
      const semanticChecks = [rowContext, ...components];
      const selectedCandidates = semanticChecks.flatMap(
        ({ candidates }) => candidates
      );
      const globalClaudeRebind = globalClaudeRebindCandidates({
        candidateIndex: globalCandidateIndex,
        existingCandidates: selectedCandidates,
        row,
        documentsByUuid,
        maximumQuoteCharacters,
      });
      const globalReferenceARebind = globalReferenceARebindCandidates({
        candidateIndex: globalCandidateIndex,
        existingCandidates: [...selectedCandidates, ...globalClaudeRebind],
        row,
        semanticChecks,
        documentsByUuid,
        maximumQuoteCharacters: globalReferenceMaximumQuoteCharacters,
      });
      return {
        reviewIndex,
        analysisRowId: row.analysisRowId,
        requirementId,
        relation,
        category: row.category,
        subcategory: row.subcategory,
        point: row.point,
        referenceA: {
          content: row.system.aContent,
          values: row.system.aValues,
          source: row.system.aSource,
        },
        claudeClaim: {
          foundStatus: row.claude.foundStatus,
          coverageStatus: row.claude.coverageStatus,
          values: row.claude.values,
          sourceQuote: clippedText(row.claude.sourceQuote, 3_000),
          sourceFiles: row.claude.sourceFiles,
          note: clippedText(row.claude.note, 2_000),
        },
        systemClaim: {
          customerSearchStatus: row.system.customerSearchStatus,
          bCounterpart: clippedText(row.system.bCounterpart, 3_000),
          bCoverage: row.system.bCoverage,
          bValues: row.system.bValues,
          note: clippedText(row.system.note, 1_000),
        },
        searchedDocuments: bDocuments.map(
          ({ uuid, fingerprint, originalName, role, documentStatus }) => ({
            uuid,
            fingerprint,
            originalName,
            role,
            documentStatus,
          })
        ),
        retrieval: {
          exactCandidateCount: rowCandidates.length,
          selectedCandidateCount: semanticChecks.reduce(
            (sum, component) => sum + component.candidates.length,
            0
          ),
          absenceCertified: false,
          negativeMeaning:
            "NO_COUNTERPART_ESTABLISHED means no counterpart in the reviewed exact candidates, not certified global absence.",
        },
        globalClaudeRebind,
        globalReferenceARebind,
        actualComponents: components.length,
        components: semanticChecks,
      };
    }
  );
  const payload = {
    schemaVersion: 1,
    contractId: SOURCE_REVIEW_PACKET_CONTRACT_ID,
    status: "READY_FOR_SOURCE_REVIEW",
    qaOnly: true,
    productionRule: false,
    createdAt,
    authority:
      "EXACT_SOURCE_RANGES_ARE_EVIDENCE; MODEL_OUTPUT_REQUIRES_CODEX_ADJUDICATION",
    bindings: {
      goldCandidateSha256: goldCandidate.candidateSha256,
      oracleSha256: goldCandidate.bindings.oracleSha256,
      oracleId: oracle.oracleId,
    },
    selection: {
      sample: selection,
      maximumPerComponent,
      maximumQuoteCharacters,
      globalReferenceMaximumQuoteCharacters,
      candidatePolicy:
        "GLOBAL_POSITIVE_CLAUDE_QUOTE_REBIND_PLUS_LEXICAL_COMPONENT_RANK_WITH_DOCUMENT_DIVERSITY; NAVIGATION_ONLY",
    },
    rows,
    summary: {
      rows: rows.length,
      actualComponents: rows.reduce(
        (sum, row) => sum + row.actualComponents,
        0
      ),
      semanticChecks: rows.reduce((sum, row) => sum + row.components.length, 0),
      exactCandidatesAvailable: rows.reduce(
        (sum, row) => sum + row.retrieval.exactCandidateCount,
        0
      ),
      exactCandidatesSelected: rows.reduce(
        (sum, row) =>
          sum +
          row.retrieval.selectedCandidateCount +
          row.globalClaudeRebind.length +
          row.globalReferenceARebind.length,
        0
      ),
      globalClaudeRebindCandidates: rows.reduce(
        (sum, row) => sum + row.globalClaudeRebind.length,
        0
      ),
      globalReferenceARebindCandidates: rows.reduce(
        (sum, row) => sum + row.globalReferenceARebind.length,
        0
      ),
      searchedDocumentsPerRow: bDocuments.length,
      absenceCertifiedRows: 0,
    },
  };
  return {
    ...payload,
    packetSha256: sha256(
      `${SOURCE_REVIEW_PACKET_CONTRACT_ID}\u0000${stableStringify(payload)}`
    ),
  };
}

function validateSourceReviewResponse(row, response) {
  if (
    response?.contractId !== SOURCE_REVIEW_RESPONSE_CONTRACT_ID ||
    response.requirementId !== row?.requirementId ||
    (response.outcome !== undefined &&
      !REVIEW_OUTCOMES.has(response.outcome)) ||
    !Array.isArray(response.componentFindings) ||
    response.componentFindings.length !== row.components.length ||
    !Array.isArray(response.unmodeledDifferences) ||
    typeof response.rationale !== "string" ||
    !response.rationale.trim()
  )
    throw reviewError("LF_SOURCE_REVIEW_RESPONSE_INVALID");
  const componentById = new Map(
    row.components.map((component) => [component.componentId, component])
  );
  const rowCandidateIds = new Set([
    ...(row.globalClaudeRebind || []).map(({ candidateId }) => candidateId),
    ...(row.globalReferenceARebind || []).map(({ candidateId }) => candidateId),
    ...row.components.flatMap(({ candidates }) =>
      candidates.map(({ candidateId }) => candidateId)
    ),
  ]);
  const seen = new Set();
  for (const finding of response.componentFindings) {
    const component = componentById.get(finding?.componentId);
    if (
      !component ||
      seen.has(finding.componentId) ||
      finding.dimension !== component.dimension ||
      !COMPONENT_OUTCOMES.has(finding.outcome) ||
      !Array.isArray(finding.candidateIds)
    )
      throw reviewError("LF_SOURCE_REVIEW_COMPONENT_FINDING_INVALID");
    seen.add(finding.componentId);
    if (
      new Set(finding.candidateIds).size !== finding.candidateIds.length ||
      finding.candidateIds.some(
        (candidateId) => !rowCandidateIds.has(candidateId)
      ) ||
      (finding.outcome === "NOT_ESTABLISHED"
        ? finding.candidateIds.length !== 0
        : finding.candidateIds.length === 0)
    )
      throw reviewError("LF_SOURCE_REVIEW_COMPONENT_EVIDENCE_INVALID");
  }
  for (const difference of response.unmodeledDifferences) {
    if (
      !REVIEW_DIMENSIONS.has(difference?.dimension) ||
      typeof difference?.description !== "string" ||
      !difference.description.trim() ||
      !Array.isArray(difference.candidateIds) ||
      difference.candidateIds.length === 0 ||
      new Set(difference.candidateIds).size !==
        difference.candidateIds.length ||
      difference.candidateIds.some(
        (candidateId) => !rowCandidateIds.has(candidateId)
      )
    )
      throw reviewError("LF_SOURCE_REVIEW_UNMODELED_DIFFERENCE_INVALID");
  }
  const outcomes = response.componentFindings.map(({ outcome }) => outcome);
  const expectedOutcome =
    outcomes.every((outcome) => outcome === "MATCH") &&
    response.unmodeledDifferences.length === 0
      ? "FULL_COUNTERPART"
      : outcomes.includes("MATCH")
        ? "PARTIAL_COUNTERPART"
        : outcomes.includes("OPPOSITE")
          ? "CONTRADICTED"
          : "NO_COUNTERPART_ESTABLISHED";
  if (!REVIEW_OUTCOMES.has(expectedOutcome))
    throw reviewError("LF_SOURCE_REVIEW_ROW_OUTCOME_INVALID");
  if (response.outcome !== undefined && response.outcome !== expectedOutcome)
    throw reviewError("LF_SOURCE_REVIEW_ROW_OUTCOME_INVALID");
  return { ...response, outcome: expectedOutcome };
}

module.exports = {
  SOURCE_REVIEW_PACKET_CONTRACT_ID,
  SOURCE_REVIEW_RESPONSE_CONTRACT_ID,
  buildLfKnownFixtureSourceReviewPacket,
  compoundOverlapRatio,
  factRoleDimension,
  normalizedText,
  sha256,
  stableStringify,
  validateSourceReviewResponse,
};

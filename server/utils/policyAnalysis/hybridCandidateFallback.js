const crypto = require("crypto");
const { PageAwareTextSplitter } = require("../PageAwareTextSplitter");
const {
  buildControlledOccurrenceWorksheet,
  normalizeWithOffsetMap,
} = require("./controlledOccurrenceWorksheet");

const HYBRID_FALLBACK_SCHEMA_VERSION = 1;
const DEFAULT_CHUNK_SIZE = 3_000;
const DEFAULT_CHUNK_OVERLAP = 250;
const DEFAULT_TOP_K = 3;
const MAX_TOP_K = 3;
const MAX_EVIDENCE_CHARS = 900;
const ALLOWED_MODES = new Set(["ADDITIVE", "NO_CONTROLLED_CANDIDATE"]);
const ALLOWED_RELATIONS = new Set([
  "DIRECT_EXPLICIT",
  "PARTIAL_EXPLICIT",
  "RELATED_ONLY",
  "OTHER_SCOPE",
  "UNRESOLVED",
]);
const ACCEPTED_RELATIONS = new Set(["DIRECT_EXPLICIT", "PARTIAL_EXPLICIT"]);

function fallbackError(code, detail = "") {
  const error = new Error(detail ? `${code}: ${detail}` : code);
  error.code = code;
  return error;
}

function exactKeys(value, expectedKeys, code) {
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  )
    throw fallbackError(code, actual.join(","));
}

function requireString(value, code, detail) {
  if (typeof value !== "string" || value.trim().length === 0)
    throw fallbackError(code, detail);
  return value.trim();
}

function stripChunkHeader(text) {
  const marker = "</document_metadata>\n\n";
  const markerIndex = String(text || "").indexOf(marker);
  return markerIndex === -1
    ? String(text || "")
    : String(text || "").slice(markerIndex + marker.length);
}

function normalizeJsonResponse(responseText) {
  const response = String(responseText || "").trim();
  const fenced = response.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/iu);
  return fenced ? fenced[1].trim() : response;
}

function validateHybridFallbackCatalog({ catalog, worksheet }) {
  if (!catalog || typeof catalog !== "object" || Array.isArray(catalog))
    throw fallbackError("HYBRID_CATALOG_INVALID");
  exactKeys(
    catalog,
    ["schemaVersion", "catalogId", "categoryView", "targets"],
    "HYBRID_CATALOG_KEYS_INVALID"
  );
  if (catalog.schemaVersion !== HYBRID_FALLBACK_SCHEMA_VERSION)
    throw fallbackError(
      "HYBRID_CATALOG_SCHEMA_INVALID",
      String(catalog.schemaVersion)
    );
  const catalogId = requireString(
    catalog.catalogId,
    "HYBRID_CATALOG_ID_REQUIRED",
    "catalogId"
  );
  const categoryView = requireString(
    catalog.categoryView,
    "HYBRID_CATEGORY_REQUIRED",
    "categoryView"
  );
  if (categoryView !== worksheet?.catalog?.categoryView)
    throw fallbackError(
      "HYBRID_CATEGORY_MISMATCH",
      `${categoryView}:${worksheet?.catalog?.categoryView || "missing"}`
    );
  if (!Array.isArray(catalog.targets))
    throw fallbackError("HYBRID_TARGETS_INVALID");

  const requirementById = new Map(
    (worksheet.requirements || []).map((requirement) => [
      requirement.id,
      requirement,
    ])
  );
  const targetIds = new Set();
  const targets = catalog.targets.map((target, index) => {
    const detail = `targets[${index}]`;
    if (!target || typeof target !== "object" || Array.isArray(target))
      throw fallbackError("HYBRID_TARGET_INVALID", detail);
    exactKeys(
      target,
      [
        "id",
        "requirementId",
        "componentId",
        "query",
        "semanticContract",
        "requiredQuotePrefixes",
        "mode",
        "topK",
      ],
      "HYBRID_TARGET_KEYS_INVALID"
    );
    const id = requireString(target.id, "HYBRID_TARGET_ID_REQUIRED", detail);
    if (targetIds.has(id))
      throw fallbackError("HYBRID_TARGET_ID_DUPLICATE", id);
    targetIds.add(id);
    const requirementId = requireString(
      target.requirementId,
      "HYBRID_REQUIREMENT_ID_REQUIRED",
      detail
    );
    const componentId = requireString(
      target.componentId,
      "HYBRID_COMPONENT_ID_REQUIRED",
      detail
    );
    const requirement = requirementById.get(requirementId);
    const component = requirement?.components?.find(
      (candidate) => candidate.id === componentId
    );
    if (!requirement || !component)
      throw fallbackError(
        "HYBRID_TARGET_UNKNOWN",
        `${requirementId}:${componentId}`
      );
    const query = requireString(target.query, "HYBRID_QUERY_REQUIRED", detail);
    const semanticContract = requireString(
      target.semanticContract,
      "HYBRID_SEMANTIC_CONTRACT_REQUIRED",
      detail
    );
    if (
      !Array.isArray(target.requiredQuotePrefixes) ||
      target.requiredQuotePrefixes.length === 0
    )
      throw fallbackError("HYBRID_QUOTE_PREFIXES_REQUIRED", id);
    const requiredQuotePrefixes = [
      ...new Set(
        target.requiredQuotePrefixes.map((prefix, prefixIndex) =>
          normalizeWithOffsetMap(
            requireString(
              prefix,
              "HYBRID_QUOTE_PREFIX_REQUIRED",
              `${id}:${prefixIndex}`
            )
          ).normalized.replace(/\s+/gu, "")
        )
      ),
    ];
    if (requiredQuotePrefixes.some((prefix) => prefix.length < 4))
      throw fallbackError("HYBRID_QUOTE_PREFIX_TOO_SHORT", id);
    const mode = requireString(target.mode, "HYBRID_MODE_REQUIRED", detail);
    if (!ALLOWED_MODES.has(mode))
      throw fallbackError("HYBRID_MODE_INVALID", `${id}:${mode}`);
    const topK = Number(target.topK || DEFAULT_TOP_K);
    if (!Number.isInteger(topK) || topK < 1 || topK > MAX_TOP_K)
      throw fallbackError("HYBRID_TOP_K_INVALID", `${id}:${target.topK}`);
    return {
      id,
      requirementId,
      componentId,
      requirementLabel: requirement.label,
      componentLabel: component.label,
      factRole: component.factRole,
      query,
      semanticContract,
      requiredQuotePrefixes,
      mode,
      topK,
      eligible:
        mode === "ADDITIVE" || Number(component.occurrenceCount || 0) === 0,
    };
  });
  return { schemaVersion: 1, catalogId, categoryView, targets };
}

async function buildPageAwareRetrievalChunks({
  document,
  chunkSize = DEFAULT_CHUNK_SIZE,
  chunkOverlap = DEFAULT_CHUNK_OVERLAP,
}) {
  if (!Number.isInteger(chunkSize) || chunkSize < 500 || chunkSize > 6_000)
    throw fallbackError("HYBRID_CHUNK_SIZE_INVALID", String(chunkSize));
  if (
    !Number.isInteger(chunkOverlap) ||
    chunkOverlap < 0 ||
    chunkOverlap >= chunkSize ||
    chunkOverlap > 1_000
  )
    throw fallbackError("HYBRID_CHUNK_OVERLAP_INVALID", String(chunkOverlap));
  const sourceDocumentId = requireString(
    document?.sourceDocumentId || document?.id,
    "HYBRID_DOCUMENT_ID_REQUIRED",
    "document"
  );
  const preparedDocument = {
    ...document,
    id: document.id || sourceDocumentId,
    docId: document.docId || sourceDocumentId,
    sourceDocumentId,
  };
  const pages = PageAwareTextSplitter.pages(preparedDocument);
  const pageByNumber = new Map(pages.map((page) => [page.pageNumber, page]));
  const mappedPageByNumber = new Map(
    document.pageMap.map((page) => [page.pageNumber, page])
  );
  const chunks = await PageAwareTextSplitter.splitDocument({
    documentData: preparedDocument,
    chunkSize,
    chunkOverlap,
  });
  const lastStartByPage = new Map();

  return chunks.map((chunk) => {
    const pageNumber = chunk.metadata.pageNumber;
    const page = pageByNumber.get(pageNumber);
    const mappedPage = mappedPageByNumber.get(pageNumber);
    const text = stripChunkHeader(chunk.text);
    const searchStart = Math.max(
      0,
      (lastStartByPage.get(pageNumber) ?? -1) + 1
    );
    let pageStart = page.text.indexOf(text, searchStart);
    if (pageStart === -1) pageStart = page.text.indexOf(text);
    if (pageStart === -1)
      throw fallbackError(
        "HYBRID_CHUNK_OFFSET_NOT_FOUND",
        `${pageNumber}:${chunk.metadata.pageChunkIndex}`
      );
    lastStartByPage.set(pageNumber, pageStart);
    const pageEnd = pageStart + text.length;
    const documentStart = mappedPage.start + pageStart;
    const documentEnd = mappedPage.start + pageEnd;
    if (document.pageContent.slice(documentStart, documentEnd) !== text)
      throw fallbackError(
        "HYBRID_CHUNK_SOURCE_MISMATCH",
        `${pageNumber}:${chunk.metadata.pageChunkIndex}`
      );
    const id = `hybrid-chunk:${crypto
      .createHash("sha256")
      .update(
        [sourceDocumentId, pageNumber, documentStart, documentEnd].join(":"),
        "utf8"
      )
      .digest("hex")}`;
    return {
      id,
      pageNumber,
      physicalPageNumber: pageNumber,
      pageChunkIndex: chunk.metadata.pageChunkIndex,
      pageStart,
      pageEnd,
      documentStart,
      documentEnd,
      text,
    };
  });
}

function cosineSimilarity(left, right) {
  if (
    !Array.isArray(left) ||
    !Array.isArray(right) ||
    left.length === 0 ||
    left.length !== right.length
  )
    throw fallbackError("HYBRID_VECTOR_INVALID");
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }
  if (leftNorm === 0 || rightNorm === 0)
    throw fallbackError("HYBRID_VECTOR_ZERO_NORM");
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

function rankChunksForTargets({
  targets,
  chunks,
  targetVectors,
  chunkVectors,
}) {
  if (targetVectors.length !== targets.length)
    throw fallbackError("HYBRID_TARGET_VECTOR_COUNT_MISMATCH");
  if (chunkVectors.length !== chunks.length)
    throw fallbackError("HYBRID_CHUNK_VECTOR_COUNT_MISMATCH");
  return targets.map((target, targetIndex) => ({
    ...target,
    chunks: chunks
      .map((chunk, chunkIndex) => ({
        ...chunk,
        score: cosineSimilarity(
          targetVectors[targetIndex],
          chunkVectors[chunkIndex]
        ),
      }))
      .sort(
        (left, right) =>
          right.score - left.score ||
          left.pageNumber - right.pageNumber ||
          left.pageStart - right.pageStart
      )
      .slice(0, target.topK),
  }));
}

function parseAndValidateHybridSelection({
  responseText,
  target,
  invalidEvidencePolicy = "throw",
}) {
  if (!new Set(["throw", "downgrade"]).has(invalidEvidencePolicy))
    throw fallbackError(
      "HYBRID_INVALID_EVIDENCE_POLICY",
      invalidEvidencePolicy
    );
  let parsed;
  try {
    parsed = JSON.parse(normalizeJsonResponse(responseText));
  } catch (error) {
    throw fallbackError("HYBRID_SELECTION_JSON_INVALID", error.message);
  }
  exactKeys(
    parsed,
    ["schemaVersion", "selections"],
    "HYBRID_SELECTION_ROOT_KEYS_INVALID"
  );
  if (parsed.schemaVersion !== HYBRID_FALLBACK_SCHEMA_VERSION)
    throw fallbackError(
      "HYBRID_SELECTION_SCHEMA_INVALID",
      String(parsed.schemaVersion)
    );
  if (
    !Array.isArray(parsed.selections) ||
    parsed.selections.length !== target.chunks.length
  )
    throw fallbackError("HYBRID_SELECTION_COUNT_INVALID", target.id);
  const chunkById = new Map(target.chunks.map((chunk) => [chunk.id, chunk]));
  const seenChunkIds = new Set();
  const selections = parsed.selections.map((selection) => {
    exactKeys(
      selection,
      ["chunkId", "relation", "quote"],
      "HYBRID_SELECTION_KEYS_INVALID"
    );
    const expectedChunk = chunkById.get(selection.chunkId);
    if (!expectedChunk || seenChunkIds.has(selection.chunkId))
      throw fallbackError(
        "HYBRID_SELECTION_CHUNK_INVALID",
        String(selection.chunkId)
      );
    seenChunkIds.add(selection.chunkId);
    if (!ALLOWED_RELATIONS.has(selection.relation))
      throw fallbackError(
        "HYBRID_SELECTION_RELATION_INVALID",
        String(selection.relation)
      );
    const accepted = ACCEPTED_RELATIONS.has(selection.relation);
    if (!accepted && selection.quote !== null)
      throw fallbackError(
        "HYBRID_SELECTION_QUOTE_FORBIDDEN",
        selection.chunkId
      );
    if (accepted) {
      let evidenceError = null;
      if (typeof selection.quote !== "string" || !selection.quote.trim())
        evidenceError = fallbackError(
          "HYBRID_SELECTION_QUOTE_REQUIRED",
          selection.chunkId
        );
      else if (selection.quote.length > MAX_EVIDENCE_CHARS)
        evidenceError = fallbackError(
          "HYBRID_SELECTION_QUOTE_TOO_LONG",
          selection.chunkId
        );
      const first = evidenceError
        ? -1
        : expectedChunk.text.indexOf(selection.quote);
      const last = evidenceError
        ? -1
        : expectedChunk.text.lastIndexOf(selection.quote);
      if (!evidenceError && first === -1)
        evidenceError = fallbackError(
          "HYBRID_SELECTION_QUOTE_NOT_EXACT",
          selection.chunkId
        );
      if (!evidenceError && first !== last)
        evidenceError = fallbackError(
          "HYBRID_SELECTION_QUOTE_AMBIGUOUS",
          selection.chunkId
        );
      if (
        !evidenceError &&
        Array.isArray(target.requiredQuotePrefixes) &&
        !target.requiredQuotePrefixes.some((prefix) =>
          normalizeWithOffsetMap(selection.quote)
            .normalized.replace(/\s+/gu, "")
            .includes(prefix)
        )
      )
        evidenceError = fallbackError(
          "HYBRID_SELECTION_TARGET_ANCHOR_MISSING",
          selection.chunkId
        );
      if (evidenceError) {
        if (invalidEvidencePolicy === "throw") throw evidenceError;
        return {
          targetId: target.id,
          requirementId: target.requirementId,
          componentId: target.componentId,
          chunkId: selection.chunkId,
          relation: "UNRESOLVED",
          quote: null,
          score: expectedChunk.score,
          pageNumber: expectedChunk.pageNumber,
          documentStart: null,
          documentEnd: null,
          rejectedRelation: selection.relation,
          rejectionCode: evidenceError.code,
        };
      }
      const documentStart = expectedChunk.documentStart + first;
      const documentEnd = documentStart + selection.quote.length;
      return {
        targetId: target.id,
        requirementId: target.requirementId,
        componentId: target.componentId,
        semanticContract: target.semanticContract,
        chunkId: selection.chunkId,
        relation: selection.relation,
        quote: selection.quote,
        score: expectedChunk.score,
        pageNumber: expectedChunk.pageNumber,
        documentStart,
        documentEnd,
      };
    }
    return {
      targetId: target.id,
      requirementId: target.requirementId,
      componentId: target.componentId,
      semanticContract: target.semanticContract,
      chunkId: selection.chunkId,
      relation: selection.relation,
      quote: null,
      score: expectedChunk.score,
      pageNumber: expectedChunk.pageNumber,
      documentStart: null,
      documentEnd: null,
    };
  });
  const selectionByChunkId = new Map(
    selections.map((selection) => [selection.chunkId, selection])
  );
  return {
    schemaVersion: HYBRID_FALLBACK_SCHEMA_VERSION,
    selections: target.chunks.map((chunk) => selectionByChunkId.get(chunk.id)),
  };
}

function componentByIdentity(worksheet, requirementId, componentId) {
  return worksheet.requirements
    .find((requirement) => requirement.id === requirementId)
    ?.components.find((component) => component.id === componentId);
}

function exactCandidateId({
  documentFingerprint,
  requirementId,
  componentId,
  pageNumber,
  documentStart,
  documentEnd,
}) {
  return `candidate:${crypto
    .createHash("sha256")
    .update(
      [
        documentFingerprint,
        requirementId,
        componentId,
        pageNumber,
        documentStart,
        documentEnd,
      ].join(":")
    )
    .digest("hex")}`;
}

function mergeHybridSelections({ worksheet, document, selections }) {
  const acceptedSelections = selections.filter(
    (selection) =>
      ACCEPTED_RELATIONS.has(selection.relation) && selection.quote !== null
  );
  const merged = JSON.parse(JSON.stringify(worksheet));
  const added = [];
  for (const selection of acceptedSelections) {
    const sourceRequirement = merged.requirements.find(
      (requirement) => requirement.id === selection.requirementId
    );
    const sourceComponent = componentByIdentity(
      merged,
      selection.requirementId,
      selection.componentId
    );
    if (!sourceRequirement || !sourceComponent)
      throw fallbackError(
        "HYBRID_SELECTION_TARGET_MISSING",
        `${selection.requirementId}:${selection.componentId}`
      );
    if (
      document.pageContent.slice(
        selection.documentStart,
        selection.documentEnd
      ) !== selection.quote
    )
      throw fallbackError(
        "HYBRID_SELECTION_DOCUMENT_MISMATCH",
        selection.targetId
      );
    const temporaryWorksheet = buildControlledOccurrenceWorksheet({
      document,
      documentFingerprint: worksheet.document.fingerprint,
      catalog: {
        schemaVersion: 1,
        catalogId: `hybrid:${selection.targetId}`,
        categoryView: worksheet.catalog.categoryView,
        requirements: [
          {
            id: sourceRequirement.id,
            label: sourceRequirement.label,
            requestedFields: sourceRequirement.requestedFields,
            ...(sourceRequirement.optionalFields
              ? { optionalFields: sourceRequirement.optionalFields }
              : {}),
            scopeRules: sourceRequirement.scopeRules,
            scopePolicy: sourceRequirement.scopePolicy,
            componentSatisfactionPolicy:
              sourceRequirement.componentSatisfactionPolicy,
            coverageAggregationPolicy:
              sourceRequirement.coverageAggregationPolicy,
            components: [
              {
                id: sourceComponent.id,
                label: sourceComponent.label,
                factRole: sourceComponent.factRole,
                contextMode: sourceComponent.contextMode,
                aliases: [selection.quote],
              },
            ],
          },
        ],
      },
    });
    const normalizedQuote = normalizeWithOffsetMap(selection.quote).normalized;
    const occurrence =
      temporaryWorksheet.requirements[0].components[0].occurrences
        .filter(
          (candidate) =>
            candidate.pageNumber === selection.pageNumber &&
            candidate.documentStart < selection.documentEnd &&
            candidate.documentEnd > selection.documentStart &&
            normalizeWithOffsetMap(candidate.exactText).normalized ===
              normalizedQuote
        )
        .sort(
          (left, right) =>
            Math.abs(left.documentStart - selection.documentStart) +
            Math.abs(left.documentEnd - selection.documentEnd) -
            (Math.abs(right.documentStart - selection.documentStart) +
              Math.abs(right.documentEnd - selection.documentEnd))
        )[0];
    if (!occurrence)
      throw fallbackError(
        "HYBRID_SELECTION_OCCURRENCE_MISSING",
        selection.targetId
      );
    if (
      sourceComponent.occurrences.some(
        (candidate) =>
          candidate.pageNumber === selection.pageNumber &&
          candidate.documentStart === selection.documentStart &&
          candidate.documentEnd === selection.documentEnd
      )
    )
      continue;
    const hybridOccurrence = {
      ...occurrence,
      candidateId: exactCandidateId({
        documentFingerprint: worksheet.document.fingerprint,
        requirementId: selection.requirementId,
        componentId: selection.componentId,
        pageNumber: selection.pageNumber,
        documentStart: selection.documentStart,
        documentEnd: selection.documentEnd,
      }),
      matchedAlias: `HYBRID_CHUNK:${selection.targetId}`,
      discoveryMethod: "HYBRID_CHUNK_SEMANTIC",
      hybridSemanticContract: selection.semanticContract,
      hybridRelation: selection.relation,
      retrievalChunkId: selection.chunkId,
      retrievalScore: selection.score,
      pageStart:
        occurrence.pageStart +
        (selection.documentStart - occurrence.documentStart),
      pageEnd:
        occurrence.pageEnd + (selection.documentEnd - occurrence.documentEnd),
      documentStart: selection.documentStart,
      documentEnd: selection.documentEnd,
      exactText: selection.quote,
    };
    sourceComponent.occurrences.push(hybridOccurrence);
    sourceComponent.occurrences.sort(
      (left, right) =>
        left.documentStart - right.documentStart ||
        left.documentEnd - right.documentEnd
    );
    sourceComponent.occurrenceCount = sourceComponent.occurrences.length;
    sourceComponent.terminalState = "CONTROLLED_CANDIDATES_FOUND";
    added.push({
      targetId: selection.targetId,
      candidateId: hybridOccurrence.candidateId,
      requirementId: selection.requirementId,
      componentId: selection.componentId,
      relation: selection.relation,
      pageNumber: selection.pageNumber,
      documentStart: selection.documentStart,
      documentEnd: selection.documentEnd,
    });
  }
  const components = merged.requirements.flatMap(
    (requirement) => requirement.components
  );
  merged.summary = {
    ...merged.summary,
    componentsWithCandidates: components.filter(
      (component) => component.occurrenceCount > 0
    ).length,
    componentsWithoutCandidates: components.filter(
      (component) => component.occurrenceCount === 0
    ).length,
    occurrenceCount: components.reduce(
      (sum, component) => sum + component.occurrenceCount,
      0
    ),
  };
  merged.hybridFallback = {
    schemaVersion: HYBRID_FALLBACK_SCHEMA_VERSION,
    candidateOnly: true,
    evaluatedSelectionCount: selections.length,
    acceptedSelectionCount: acceptedSelections.length,
    addedCandidateCount: added.length,
  };
  return { worksheet: merged, added };
}

module.exports = {
  ACCEPTED_RELATIONS,
  ALLOWED_RELATIONS,
  DEFAULT_CHUNK_OVERLAP,
  DEFAULT_CHUNK_SIZE,
  DEFAULT_TOP_K,
  HYBRID_FALLBACK_SCHEMA_VERSION,
  MAX_EVIDENCE_CHARS,
  buildPageAwareRetrievalChunks,
  cosineSimilarity,
  mergeHybridSelections,
  parseAndValidateHybridSelection,
  rankChunksForTargets,
  stripChunkHeader,
  validateHybridFallbackCatalog,
};

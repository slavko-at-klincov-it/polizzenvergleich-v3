const crypto = require("crypto");

const COUNTERPART_STATUS = Object.freeze({
  DIRECT: "DIRECT_COUNTERPART",
  PARTIAL: "PARTIAL_COUNTERPART",
  RELATED: "RELATED_ONLY",
  NONE: "NO_COUNTERPART_IN_CANDIDATES",
  UNCLEAR: "UNCLEAR",
});

const STATUS_VALUES = new Set(Object.values(COUNTERPART_STATUS));

function pilotError(code, detail = "") {
  const error = new Error(detail ? `${code}: ${detail}` : code);
  error.code = code;
  return error;
}

function normalize(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[„“”]/gu, '"')
    .replace(/[–—]/gu, "-")
    .replace(/\s+/gu, " ")
    .trim()
    .toLocaleLowerCase("de-AT");
}

function requiredString(value, code) {
  if (typeof value !== "string" || value.trim().length === 0)
    throw pilotError(code);
  return value.trim();
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function validateCatalog(rawCatalog) {
  if (!rawCatalog || typeof rawCatalog !== "object" || Array.isArray(rawCatalog))
    throw pilotError("LF_REFERENCE_CATALOG_INVALID");
  if (rawCatalog.schemaVersion !== 1)
    throw pilotError("LF_REFERENCE_CATALOG_SCHEMA_INVALID");
  if (rawCatalog.qaOnly !== true)
    throw pilotError("LF_REFERENCE_CATALOG_MUST_BE_QA_ONLY");
  if (rawCatalog.comparisonPolicy?.productionRule !== false)
    throw pilotError("LF_REFERENCE_PRODUCTION_RULE_FORBIDDEN");
  if (rawCatalog.comparisonPolicy?.missingIsExclusion !== false)
    throw pilotError("LF_REFERENCE_MISSING_EXCLUSION_FORBIDDEN");
  if (rawCatalog.comparisonPolicy?.requireSourceCandidateIds !== true)
    throw pilotError("LF_REFERENCE_SOURCE_CANDIDATES_REQUIRED");
  const sourceProduct = rawCatalog.sourceProduct;
  if (!/^[a-f0-9]{64}$/u.test(sourceProduct?.documentSha256 || ""))
    throw pilotError("LF_REFERENCE_SOURCE_SHA_INVALID");
  if (!Number.isInteger(sourceProduct?.physicalPages) || sourceProduct.physicalPages < 1)
    throw pilotError("LF_REFERENCE_SOURCE_PAGES_INVALID");
  if (!Array.isArray(rawCatalog.categories) || rawCatalog.categories.length === 0)
    throw pilotError("LF_REFERENCE_CATEGORIES_REQUIRED");

  const categoryIds = new Set();
  const requirementIds = new Set();
  const categories = rawCatalog.categories.map((category) => {
    const categoryId = requiredString(category?.id, "LF_REFERENCE_CATEGORY_ID_REQUIRED");
    if (categoryIds.has(categoryId))
      throw pilotError("LF_REFERENCE_CATEGORY_ID_DUPLICATE", categoryId);
    categoryIds.add(categoryId);
    if (!Array.isArray(category.requirements) || category.requirements.length === 0)
      throw pilotError("LF_REFERENCE_REQUIREMENTS_REQUIRED", categoryId);
    return {
      id: categoryId,
      label: requiredString(category.label, "LF_REFERENCE_CATEGORY_LABEL_REQUIRED"),
      requirements: category.requirements.map((requirement) => {
        const id = requiredString(requirement?.id, "LF_REFERENCE_REQUIREMENT_ID_REQUIRED");
        if (requirementIds.has(id))
          throw pilotError("LF_REFERENCE_REQUIREMENT_ID_DUPLICATE", id);
        requirementIds.add(id);
        if (!Number.isInteger(requirement.reference?.page) || requirement.reference.page < 1)
          throw pilotError("LF_REFERENCE_PAGE_INVALID", id);
        if (requirement.reference.page > sourceProduct.physicalPages)
          throw pilotError("LF_REFERENCE_PAGE_OUT_OF_RANGE", id);
        if (!Array.isArray(requirement.aliases) || requirement.aliases.length === 0)
          throw pilotError("LF_REFERENCE_ALIASES_REQUIRED", id);
        return {
          id,
          label: requiredString(requirement.label, "LF_REFERENCE_REQUIREMENT_LABEL_REQUIRED"),
          factRole: requiredString(requirement.factRole, "LF_REFERENCE_FACT_ROLE_REQUIRED"),
          reference: {
            page: requirement.reference.page,
            needle: requiredString(requirement.reference.needle, "LF_REFERENCE_NEEDLE_REQUIRED"),
          },
          query: requiredString(requirement.query, "LF_REFERENCE_QUERY_REQUIRED"),
          aliases: requirement.aliases.map((alias) =>
            requiredString(alias, "LF_REFERENCE_ALIAS_INVALID")
          ),
          pilot: requirement.pilot === true,
        };
      }),
    };
  });
  if (!categories.some(({ requirements }) => requirements.some(({ pilot }) => pilot)))
    throw pilotError("LF_REFERENCE_PILOT_REQUIREMENTS_REQUIRED");

  return {
    schemaVersion: 1,
    contractId: requiredString(rawCatalog.contractId, "LF_REFERENCE_CONTRACT_ID_REQUIRED"),
    qaOnly: true,
    sourceProduct: {
      productId: requiredString(sourceProduct.productId, "LF_REFERENCE_PRODUCT_ID_REQUIRED"),
      version: requiredString(sourceProduct.version, "LF_REFERENCE_VERSION_REQUIRED"),
      documentSha256: sourceProduct.documentSha256,
      physicalPages: sourceProduct.physicalPages,
      role: requiredString(sourceProduct.role, "LF_REFERENCE_ROLE_REQUIRED"),
    },
    comparisonPolicy: {
      direction: requiredString(rawCatalog.comparisonPolicy.direction, "LF_REFERENCE_DIRECTION_REQUIRED"),
      noMatchMeaning: requiredString(rawCatalog.comparisonPolicy.noMatchMeaning, "LF_REFERENCE_NO_MATCH_MEANING_REQUIRED"),
      missingIsExclusion: false,
      allowMultipleDocuments: rawCatalog.comparisonPolicy.allowMultipleDocuments === true,
      requireSourceCandidateIds: true,
      productionRule: false,
    },
    categories,
  };
}

function pageText(documentArtifact, pageNumber) {
  const document = documentArtifact?.document;
  const page = document?.pageMap?.find((entry) => entry.pageNumber === pageNumber);
  if (!page || typeof document.pageContent !== "string") return null;
  return document.pageContent.slice(page.start, page.end);
}

function bindReferenceEvidence(catalog, documentArtifact) {
  const source = catalog.sourceProduct;
  if (
    documentArtifact?.schemaVersion !== 1 ||
    documentArtifact.fingerprint !== source.documentSha256 ||
    documentArtifact.document?.sourceDocumentId !== source.documentSha256
  )
    throw pilotError("LF_REFERENCE_SOURCE_ARTIFACT_MISMATCH");
  const extraction = documentArtifact.document?.pdfExtraction;
  if (
    extraction?.complete !== true ||
    extraction.totalPages !== source.physicalPages ||
    extraction.processedPages !== source.physicalPages ||
    extraction.pagesWithText !== source.physicalPages
  )
    throw pilotError("LF_REFERENCE_SOURCE_EXTRACTION_INCOMPLETE");

  const evidence = new Map();
  for (const category of catalog.categories)
    for (const requirement of category.requirements) {
      const text = pageText(documentArtifact, requirement.reference.page);
      if (!text || !normalize(text).includes(normalize(requirement.reference.needle)))
        throw pilotError("LF_REFERENCE_NEEDLE_NOT_FOUND", requirement.id);
      evidence.set(requirement.id, {
        physicalPageNumber: requirement.reference.page,
        exactNeedle: requirement.reference.needle,
        pageTextSha256: sha256(text),
      });
    }
  return evidence;
}

function splitPageIntoChunks({ documentUuid, documentName, pageNumber, text, chunkSize = 1800, overlap = 240 }) {
  const chunks = [];
  if (!String(text || "").trim()) return chunks;
  let start = 0;
  while (start < text.length) {
    let end = Math.min(text.length, start + chunkSize);
    if (end < text.length) {
      const boundary = Math.max(
        text.lastIndexOf("\n\n", end),
        text.lastIndexOf(". ", end),
        text.lastIndexOf("; ", end)
      );
      if (boundary > start + Math.floor(chunkSize * 0.55)) end = boundary + 1;
    }
    const exactText = text.slice(start, end).trim();
    if (exactText) {
      const candidateId = `B-${documentUuid.slice(0, 8)}-P${String(pageNumber).padStart(3, "0")}-${String(start).padStart(5, "0")}`;
      chunks.push({
        candidateId,
        documentUuid,
        documentName,
        physicalPageNumber: pageNumber,
        pageStart: start,
        pageEnd: end,
        exactText,
      });
    }
    if (end >= text.length) break;
    start = Math.max(start + 1, end - overlap);
  }
  return chunks;
}

function chunksFromArtifacts(documents, artifactsByUuid) {
  return documents.flatMap((document) => {
    const artifact = artifactsByUuid.get(document.uuid);
    if (
      artifact?.schemaVersion !== 1 ||
      artifact.fingerprint !== document.sha256 ||
      artifact.document?.pdfExtraction?.complete !== true
    )
      throw pilotError("LF_REFERENCE_COUNTERPART_ARTIFACT_INVALID", document.uuid);
    return artifact.document.pageMap.flatMap((page) =>
      splitPageIntoChunks({
        documentUuid: document.uuid,
        documentName: document.originalName,
        pageNumber: page.pageNumber,
        text: artifact.document.pageContent.slice(page.start, page.end),
      })
    );
  });
}

function queryText(requirement) {
  return [requirement.label, requirement.query, requirement.aliases.join("; ")].join("\n");
}

function lexicalScore(requirement, candidate) {
  const haystack = normalize(candidate.exactText);
  let score = 0;
  for (const alias of requirement.aliases) {
    const needle = normalize(alias);
    if (!needle) continue;
    if (haystack.includes(needle)) score += Math.max(2, needle.split(" ").length * 2);
    else {
      const tokens = needle.split(" ").filter((token) => token.length >= 4);
      score += tokens.filter((token) => haystack.includes(token)).length * 0.25;
    }
  }
  return score;
}

function cosineSimilarity(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length || left.length === 0)
    throw pilotError("LF_REFERENCE_EMBEDDING_DIMENSION_MISMATCH");
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }
  return leftNorm && rightNorm ? dot / Math.sqrt(leftNorm * rightNorm) : 0;
}

function selectCandidates({ requirement, chunks, queryEmbedding, chunkEmbeddings, topK = 5 }) {
  const ranked = chunks.map((chunk, index) => ({
    ...chunk,
    lexicalScore: lexicalScore(requirement, chunk),
    semanticScore: cosineSimilarity(queryEmbedding, chunkEmbeddings[index]),
  }));
  const semantic = [...ranked].sort((a, b) => b.semanticScore - a.semanticScore).slice(0, topK);
  const lexical = ranked
    .filter((candidate) => candidate.lexicalScore > 0)
    .sort((a, b) => b.lexicalScore - a.lexicalScore || b.semanticScore - a.semanticScore)
    .slice(0, topK);
  const selected = new Map();
  for (const candidate of [...lexical, ...semantic]) selected.set(candidate.candidateId, candidate);
  return [...selected.values()]
    .sort((a, b) => {
      const aLexical = a.lexicalScore > 0 ? 1 : 0;
      const bLexical = b.lexicalScore > 0 ? 1 : 0;
      return bLexical - aLexical || b.lexicalScore - a.lexicalScore || b.semanticScore - a.semanticScore;
    })
    .slice(0, topK);
}

function jsonFromModelText(value) {
  const withoutThinking = String(value || "").replace(/<think>[\s\S]*?<\/think>/giu, "").trim();
  const fenced = withoutThinking.match(/```(?:json)?\s*([\s\S]*?)```/iu);
  const text = fenced ? fenced[1].trim() : withoutThinking;
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end < start) throw pilotError("LF_REFERENCE_MODEL_JSON_MISSING");
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch (error) {
    throw pilotError("LF_REFERENCE_MODEL_JSON_INVALID", error.message);
  }
}

function validateModelResults(rawResults, requirements, candidatesByRequirement) {
  if (!Array.isArray(rawResults) || rawResults.length !== requirements.length)
    throw pilotError("LF_REFERENCE_MODEL_RESULT_COUNT_INVALID");
  const expected = new Set(requirements.map(({ id }) => id));
  const seen = new Set();
  return rawResults.map((result) => {
    const requirementId = requiredString(result?.requirementId, "LF_REFERENCE_MODEL_REQUIREMENT_ID_REQUIRED");
    if (!expected.has(requirementId) || seen.has(requirementId))
      throw pilotError("LF_REFERENCE_MODEL_REQUIREMENT_ID_INVALID", requirementId);
    seen.add(requirementId);
    if (!STATUS_VALUES.has(result.status))
      throw pilotError("LF_REFERENCE_MODEL_STATUS_INVALID", requirementId);
    if (!Array.isArray(result.candidateIds))
      throw pilotError("LF_REFERENCE_MODEL_CANDIDATE_IDS_INVALID", requirementId);
    const allowed = new Set((candidatesByRequirement.get(requirementId) || []).map(({ candidateId }) => candidateId));
    const candidateIds = [...new Set(result.candidateIds)];
    if (candidateIds.some((candidateId) => !allowed.has(candidateId)))
      throw pilotError("LF_REFERENCE_MODEL_CANDIDATE_ID_UNKNOWN", requirementId);
    if (
      new Set([COUNTERPART_STATUS.DIRECT, COUNTERPART_STATUS.PARTIAL, COUNTERPART_STATUS.RELATED]).has(result.status) &&
      candidateIds.length === 0
    )
      throw pilotError("LF_REFERENCE_MODEL_MATCH_WITHOUT_SOURCE", requirementId);
    if (result.status === COUNTERPART_STATUS.NONE && candidateIds.length > 0)
      throw pilotError("LF_REFERENCE_MODEL_NONE_WITH_SOURCE", requirementId);
    return {
      requirementId,
      status: result.status,
      candidateIds,
      matchSummary: requiredString(result.matchSummary, "LF_REFERENCE_MODEL_SUMMARY_REQUIRED"),
      unresolved: typeof result.unresolved === "string" ? result.unresolved.trim() : "",
    };
  });
}

module.exports = {
  COUNTERPART_STATUS,
  bindReferenceEvidence,
  chunksFromArtifacts,
  cosineSimilarity,
  jsonFromModelText,
  lexicalScore,
  normalize,
  queryText,
  selectCandidates,
  sha256,
  splitPageIntoChunks,
  validateCatalog,
  validateModelResults,
};

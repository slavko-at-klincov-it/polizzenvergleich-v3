const crypto = require("crypto");
const {
  validCertifiedCombinedInsuranceHeading,
} = require("./multiInsuranceHeadingContract");

const ARTIFACT_BACKED_SOURCE_SCOPE_CONTRACT_ID =
  "ARTIFACT_BACKED_SOURCE_SCOPE_V1";
const SOURCE_BOUND_MULTI_COMPARISON_SCOPE_SET_V1 =
  "SOURCE_BOUND_MULTI_COMPARISON_SCOPE_SET_V1";

function sourceScopeError(code, detail = "") {
  const error = new Error(detail ? `${code}: ${detail}` : code);
  error.code = code;
  return error;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])])
    );
  return value;
}

function canonicalEqual(left, right) {
  return (
    JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right))
  );
}

function artifactBinding({ worksheet, documentArtifact }) {
  const document = documentArtifact?.document;
  const worksheetDocument = worksheet?.document;
  if (
    documentArtifact?.schemaVersion !== 1 ||
    !/^[a-f0-9]{64}$/u.test(String(documentArtifact?.fingerprint || "")) ||
    documentArtifact.fingerprint !== document?.sourceDocumentId ||
    document?.pdfExtraction?.schemaVersion !== 1 ||
    document.pdfExtraction.complete !== true ||
    typeof document.pageContent !== "string" ||
    !Array.isArray(document.pageMap) ||
    document.pageMap.length === 0 ||
    document.pdfExtraction.totalPages !== document.pageMap.length ||
    document.pdfExtraction.processedPages !==
      document.pdfExtraction.totalPages ||
    worksheet?.candidateOnly !== true ||
    !Array.isArray(worksheet.requirements) ||
    worksheetDocument?.fingerprint !== documentArtifact.fingerprint ||
    worksheetDocument?.sourceDocumentId !== document.sourceDocumentId ||
    worksheetDocument?.physicalPages !== document.pageMap.length ||
    worksheetDocument?.pageContentLength !== document.pageContent.length ||
    worksheetDocument?.pageContentSha256 !== sha256(document.pageContent) ||
    !Array.isArray(worksheetDocument?.pageBoundaries) ||
    worksheetDocument.pageBoundaries.length !== document.pageMap.length
  )
    throw sourceScopeError("SOURCE_SCOPE_DOCUMENT_BINDING_INVALID");

  let previousEnd = 0;
  const pages = new Map();
  const boundaries = [];
  for (const [index, page] of document.pageMap.entries()) {
    const boundary = worksheetDocument.pageBoundaries[index];
    if (
      page?.pageNumber !== index + 1 ||
      !Number.isInteger(page.start) ||
      !Number.isInteger(page.end) ||
      page.start < previousEnd ||
      page.end <= page.start ||
      page.end > document.pageContent.length ||
      boundary?.physicalPageNumber !== page.pageNumber ||
      boundary?.documentStart !== page.start ||
      boundary?.documentEnd !== page.end
    )
      throw sourceScopeError(
        "SOURCE_SCOPE_DOCUMENT_PAGEMAP_INVALID",
        String(page?.pageNumber || index + 1)
      );
    previousEnd = page.end;
    pages.set(page.pageNumber, page);
    boundaries.push({
      physicalPageNumber: page.pageNumber,
      documentStart: page.start,
      documentEnd: page.end,
    });
  }
  if (!canonicalEqual(worksheetDocument.pageBoundaries, boundaries))
    throw sourceScopeError("SOURCE_SCOPE_WORKSHEET_BOUNDARIES_INVALID");

  const occurrences = new Map();
  for (const requirement of worksheet.requirements)
    for (const component of requirement?.components || [])
      for (const occurrence of component?.occurrences || []) {
        const candidateId = String(occurrence?.candidateId || "");
        if (!candidateId || occurrences.has(candidateId))
          throw sourceScopeError(
            "SOURCE_SCOPE_WORKSHEET_OCCURRENCE_INVALID",
            candidateId
          );
        occurrences.set(candidateId, occurrence);
      }

  return { document, pages, occurrences };
}

function assertOccurrenceSource({ occurrence, expected, document, pages }) {
  const candidateId = String(occurrence?.candidateId || "");
  if (!expected || !canonicalEqual(occurrence, expected))
    throw sourceScopeError(
      "SOURCE_SCOPE_OCCURRENCE_OWNERSHIP_INVALID",
      candidateId
    );
  const pageNumber = Number(occurrence?.physicalPageNumber);
  const page = pages.get(pageNumber);
  const start = Number(occurrence?.documentStart);
  const end = Number(occurrence?.documentEnd);
  const exactText = String(occurrence?.exactText || "");
  const contextStart = Number(occurrence?.context?.documentStart);
  const contextEnd = Number(occurrence?.context?.documentEnd);
  const contextText = String(occurrence?.context?.text || "");
  if (
    !page ||
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < page.start ||
    end <= start ||
    end > page.end ||
    exactText.length !== end - start ||
    document.pageContent.slice(start, end) !== exactText ||
    !Number.isInteger(contextStart) ||
    !Number.isInteger(contextEnd) ||
    contextStart < page.start ||
    contextEnd < contextStart ||
    contextEnd > page.end ||
    contextStart > start ||
    contextEnd < end ||
    contextText.length !== contextEnd - contextStart ||
    document.pageContent.slice(contextStart, contextEnd) !== contextText
  )
    throw sourceScopeError(
      "SOURCE_SCOPE_OCCURRENCE_RANGE_INVALID",
      candidateId
    );
  return page;
}

function verifiedPageScopeHints({ occurrence, page, document }) {
  if (occurrence?.pageScopeHints === undefined) return [];
  if (!Array.isArray(occurrence.pageScopeHints))
    throw sourceScopeError(
      "SOURCE_SCOPE_PAGE_HINTS_INVALID",
      String(occurrence?.candidateId || "")
    );
  return occurrence.pageScopeHints.map((hint) => {
    const start = Number(hint?.pageStart);
    const end = Number(hint?.pageEnd);
    const text = String(hint?.text || "");
    if (
      typeof hint?.scopeKey !== "string" ||
      !hint.scopeKey.trim() ||
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 0 ||
      end <= start ||
      page.start + end > page.end ||
      text.length !== end - start ||
      document.pageContent.slice(page.start + start, page.start + end) !== text
    )
      throw sourceScopeError(
        "SOURCE_SCOPE_PAGE_HINT_INVALID",
        String(occurrence?.candidateId || "")
      );
    return { ...hint };
  });
}

function verifiedSectionScopeHint({ occurrence, document, pages }) {
  const section = occurrence?.sectionScopeHint;
  if (section === null || section === undefined) return null;
  if (!section || typeof section !== "object" || Array.isArray(section))
    throw sourceScopeError(
      "SOURCE_SCOPE_SECTION_HINT_INVALID",
      String(occurrence?.candidateId || "")
    );
  const occurrencePage = Number(occurrence.physicalPageNumber);
  const sectionPageNumber = Number(section.physicalPageNumber);
  const page = pages.get(sectionPageNumber);
  const start = Number(section.pageStart);
  const end = Number(section.pageEnd);
  const text = String(section.text || "");
  const keys = [section.scopeKey, ...(section.scopeKeys || [])]
    .filter((key) => key !== null && key !== undefined)
    .map((key) => String(key).trim())
    .filter(Boolean);
  const currentPageRelation =
    section.source === "CURRENT_PAGE_HEADING" &&
    sectionPageNumber === occurrencePage;
  const precedingPageRelation =
    section.source === "PRECEDING_PAGE_HEADING" &&
    sectionPageNumber < occurrencePage;
  if (
    !page ||
    keys.length === 0 ||
    new Set(keys).size !== keys.length ||
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end <= start ||
    page.start + end > page.end ||
    text.length !== end - start ||
    text.trim().length === 0 ||
    (!currentPageRelation && !precedingPageRelation) ||
    document.pageContent.slice(page.start + start, page.start + end) !== text
  )
    throw sourceScopeError(
      "SOURCE_SCOPE_SECTION_HINT_INVALID",
      String(occurrence?.candidateId || "")
    );
  return { ...section };
}

/**
 * Validates the worksheet/document identity once and returns a resolver that
 * accepts only occurrences owned by that worksheet. Persisted source-scope
 * hints are retained exclusively when their exact spans occur in the bound
 * document PageMap. Any present but invalid hint fails closed.
 * Side effects: none. Role: validate/transform.
 */
function createArtifactBackedSourceScopeResolver({
  worksheet,
  documentArtifact,
}) {
  const { document, pages, occurrences } = artifactBinding({
    worksheet,
    documentArtifact,
  });
  return Object.freeze({
    contractId: ARTIFACT_BACKED_SOURCE_SCOPE_CONTRACT_ID,
    resolveOccurrence(occurrence) {
      const candidateId = String(occurrence?.candidateId || "");
      const page = assertOccurrenceSource({
        occurrence,
        expected: occurrences.get(candidateId),
        document,
        pages,
      });
      return {
        ...occurrence,
        pageScopeHints: verifiedPageScopeHints({
          occurrence,
          page,
          document,
        }),
        sectionScopeHint: verifiedSectionScopeHint({
          occurrence,
          document,
          pages,
        }),
      };
    },
  });
}

/**
 * Returns canonical section scope keys only when the heading is bound to the
 * occurrence page and its persisted text range is self-consistent. Untrusted
 * or incomplete hints deliberately produce no scope proof.
 * Side effects: none. Role: validate.
 */
function sourceBoundSectionScopeKeys(occurrence) {
  const section = occurrence?.sectionScopeHint;
  const occurrencePage = Number(occurrence?.physicalPageNumber);
  const sectionPage = Number(section?.physicalPageNumber);
  const sectionStart = Number(section?.pageStart);
  const sectionEnd = Number(section?.pageEnd);
  const sectionText = String(section?.text || "");
  const keys = [
    ...new Set(
      [section?.scopeKey, ...(section?.scopeKeys || [])]
        .map((key) => String(key || "").trim())
        .filter(Boolean)
    ),
  ].sort();
  const currentPageRelation =
    section?.source === "CURRENT_PAGE_HEADING" &&
    sectionPage === occurrencePage;
  const precedingPageRelation =
    section?.source === "PRECEDING_PAGE_HEADING" &&
    sectionPage < occurrencePage;
  const certifiedMultiScope = validCertifiedCombinedInsuranceHeading({
    text: sectionText,
    scopeKey: section?.scopeKey,
    scopeKeys: section?.scopeKeys,
    scopeResolution: section?.scopeResolution,
  });

  if (
    keys.length === 0 ||
    (!certifiedMultiScope &&
      !keys.includes(String(section?.scopeKey || "").trim())) ||
    !Number.isInteger(occurrencePage) ||
    occurrencePage <= 0 ||
    !Number.isInteger(sectionPage) ||
    sectionPage <= 0 ||
    (!currentPageRelation && !precedingPageRelation) ||
    !Number.isInteger(sectionStart) ||
    sectionStart < 0 ||
    !Number.isInteger(sectionEnd) ||
    sectionEnd - sectionStart !== sectionText.length ||
    sectionText.trim().length === 0
  )
    return [];
  return keys;
}

/**
 * Returns a plural comparison-scope set only for a fully certified combined
 * insurance heading. Ordinary legacy hints that merely carry more than one
 * key remain ambiguous and cannot enter the plural comparison contract.
 * Side effects: none. Role: validate.
 */
function sourceBoundCertifiedMultiSectionScopeKeys(occurrence) {
  const section = occurrence?.sectionScopeHint;
  if (
    !validCertifiedCombinedInsuranceHeading({
      text: section?.text,
      scopeKey: section?.scopeKey,
      scopeKeys: section?.scopeKeys,
      scopeResolution: section?.scopeResolution,
    })
  )
    return [];
  const keys = sourceBoundSectionScopeKeys(occurrence);
  return keys.length > 1 ? keys : [];
}

module.exports = {
  ARTIFACT_BACKED_SOURCE_SCOPE_CONTRACT_ID,
  SOURCE_BOUND_MULTI_COMPARISON_SCOPE_SET_V1,
  createArtifactBackedSourceScopeResolver,
  sourceBoundCertifiedMultiSectionScopeKeys,
  sourceBoundSectionScopeKeys,
};

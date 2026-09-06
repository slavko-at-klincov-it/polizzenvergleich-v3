const crypto = require("crypto");

const SOURCE_BLOCK_LEDGER_CONTRACT_ID = "SOURCE_BLOCK_LEDGER_V1";
const SEGMENTATION_CONTRACT_ID = "NONEMPTY_EXTRACTED_LINES_V1";

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])])
    );
  return value;
}

function stableStringify(value) {
  return JSON.stringify(canonical(value));
}

function domainDigest(domain, value) {
  return sha256(`${domain}\u0000${stableStringify(value)}`);
}

function normalizeStructuralText(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\b(?:EUR|EURO)\s*[+-]?[\d.,]+(?:\s*,-)?/giu, "<AMOUNT>")
    .replace(/€\s*[+-]?[\d.,]+(?:\s*,-)?/gu, "<AMOUNT>")
    .replace(/[+-]?[\d.,]+\s*%/gu, "<PERCENT>")
    .replace(/\b[+-]?\d[\d.,]*\b/gu, "<NUMBER>")
    .replace(/\s+/gu, " ")
    .trim()
    .toLocaleLowerCase("de-AT");
}

function assertDocumentArtifact(documentArtifact) {
  const fingerprint = documentArtifact?.fingerprint;
  const document = documentArtifact?.document;
  const pageMap = document?.pageMap;
  const extraction = document?.pdfExtraction;
  if (
    documentArtifact?.schemaVersion !== 1 ||
    !/^[a-f0-9]{64}$/u.test(String(fingerprint || "")) ||
    document?.sourceDocumentId !== fingerprint ||
    typeof document?.pageContent !== "string" ||
    !Array.isArray(pageMap) ||
    pageMap.length === 0 ||
    extraction?.complete !== true ||
    extraction.totalPages !== pageMap.length ||
    extraction.processedPages !== pageMap.length
  )
    throw new Error("SOURCE_BLOCK_LEDGER_DOCUMENT_ARTIFACT_INVALID");

  let previousEnd = 0;
  for (const [index, page] of pageMap.entries()) {
    if (
      page?.pageNumber !== index + 1 ||
      !Number.isInteger(page.start) ||
      !Number.isInteger(page.end) ||
      page.start < previousEnd ||
      page.end <= page.start ||
      page.end > document.pageContent.length
    )
      throw new Error("SOURCE_BLOCK_LEDGER_PAGE_MAP_INVALID");
    const gap = document.pageContent.slice(previousEnd, page.start);
    const expectedMarker = `[DOCUMENT_PAGE ${page.pageNumber}]`;
    if (gap.replace(expectedMarker, "").trim() !== "")
      throw new Error("SOURCE_BLOCK_LEDGER_PAGE_MAP_GAP_INVALID");
    previousEnd = page.end;
  }
  if (document.pageContent.slice(previousEnd).trim() !== "")
    throw new Error("SOURCE_BLOCK_LEDGER_PAGE_MAP_TRAILING_CONTENT");
  return { fingerprint, document, pageMap, extraction };
}

function structuralKind(exactText, pageNumber) {
  const trimmed = exactText.trim();
  if (trimmed === `Seite ${pageNumber}`) return "PAGE_FURNITURE";
  if (/^•\s+/u.test(trimmed)) return "LIST_GOVERNOR";
  if (/^[-–]\s+/u.test(trimmed)) return "LIST_ITEM";
  if (/^\d+(?:\.\d+)*\.?\s+\S/u.test(trimmed)) return "HEADING_CANDIDATE";
  if (
    trimmed.length <= 120 &&
    (/:$/u.test(trimmed) ||
      /^[\p{Lu}\d][\p{Lu}\d\s./&(),„“'-]+$/u.test(trimmed))
  )
    return "HEADING_CANDIDATE";
  return "BODY_LINE";
}

function pageBlocks({ text, page, fingerprint, firstOrdinal }) {
  const pageText = text.slice(page.start, page.end);
  const blocks = [];
  const lineExpression = /[^\r\n]+/gu;
  let match;
  while ((match = lineExpression.exec(pageText))) {
    if (!/\S/u.test(match[0])) continue;
    const exactText = match[0];
    const documentStart = page.start + match.index;
    const documentEnd = documentStart + exactText.length;
    const kind = structuralKind(exactText, page.pageNumber);
    const ordinal = firstOrdinal + blocks.length;
    const exactTextSha256 = sha256(exactText);
    blocks.push({
      blockId: domainDigest(SOURCE_BLOCK_LEDGER_CONTRACT_ID, {
        documentFingerprint: fingerprint,
        physicalPageNumber: page.pageNumber,
        documentStart,
        documentEnd,
        exactTextSha256,
      }),
      ordinal,
      physicalPageNumber: page.pageNumber,
      pageLineNumber: blocks.length + 1,
      pageStart: match.index,
      pageEnd: match.index + exactText.length,
      documentStart,
      documentEnd,
      exactText,
      exactTextSha256,
      structuralKind: kind,
      disposition:
        kind === "PAGE_FURNITURE" ? "FURNITURE" : "UNRESOLVED",
      classification: {
        status: kind === "PAGE_FURNITURE" ? "PROVEN" : "UNRESOLVED",
        ruleIds:
          kind === "PAGE_FURNITURE" ? ["EXACT_PHYSICAL_PAGE_LABEL_V1"] : [],
      },
      previousBlockId: null,
      nextBlockId: null,
    });
  }
  return blocks;
}

function ledgerPayload(documentArtifact) {
  const { fingerprint, document, pageMap, extraction } =
    assertDocumentArtifact(documentArtifact);
  const blocks = [];
  const pages = [];
  for (const page of pageMap) {
    const pageEntries = pageBlocks({
      text: document.pageContent,
      page,
      fingerprint,
      firstOrdinal: blocks.length,
    });
    blocks.push(...pageEntries);
    pages.push({
      physicalPageNumber: page.pageNumber,
      documentStart: page.start,
      documentEnd: page.end,
      exactTextSha256: sha256(
        document.pageContent.slice(page.start, page.end)
      ),
      blockIds: pageEntries.map(({ blockId }) => blockId),
    });
  }
  for (const [index, block] of blocks.entries()) {
    block.previousBlockId = blocks[index - 1]?.blockId || null;
    block.nextBlockId = blocks[index + 1]?.blockId || null;
  }
  const countsByStructuralKind = blocks.reduce((counts, block) => {
    counts[block.structuralKind] = (counts[block.structuralKind] || 0) + 1;
    return counts;
  }, {});
  const structureSignature = pages.map((page) => ({
    physicalPageNumber: page.physicalPageNumber,
    blocks: page.blockIds.map((blockId) => {
      const block = blocks.find((entry) => entry.blockId === blockId);
      return {
        structuralKind: block.structuralKind,
        normalizedText: normalizeStructuralText(block.exactText),
      };
    }),
  }));
  return {
    schemaVersion: 1,
    contractId: SOURCE_BLOCK_LEDGER_CONTRACT_ID,
    sourceDocument: {
      fingerprint,
      artifactSchemaVersion: documentArtifact.schemaVersion,
      sourceDocumentId: document.sourceDocumentId,
      physicalPages: pageMap.length,
      pageContentLength: document.pageContent.length,
      pageContentSha256: sha256(document.pageContent),
      pageMapSha256: domainDigest(
        `${SOURCE_BLOCK_LEDGER_CONTRACT_ID}:PAGE_MAP`,
        pageMap.map(({ pageNumber, start, end }) => ({
          pageNumber,
          start,
          end,
        }))
      ),
      extractionContract: {
        schemaVersion: extraction.schemaVersion,
        complete: extraction.complete,
        totalPages: extraction.totalPages,
        processedPages: extraction.processedPages,
        pagesWithText: extraction.pagesWithText,
      },
    },
    segmentationContract: {
      id: SEGMENTATION_CONTRACT_ID,
      baseUnit: "NONEMPTY_EXTRACTED_LINE",
      semanticAuthority: false,
      customerRows: false,
      absenceDecisions: false,
    },
    pages,
    blocks,
    relations: [],
    summary: {
      pageCount: pages.length,
      blockCount: blocks.length,
      relationCount: 0,
      countsByStructuralKind,
      unresolvedCount: blocks.filter(
        ({ disposition }) => disposition === "UNRESOLVED"
      ).length,
    },
    structureDigestSha256: domainDigest(
      `${SOURCE_BLOCK_LEDGER_CONTRACT_ID}:VALUE_INSENSITIVE_STRUCTURE`,
      structureSignature
    ),
  };
}

function buildSourceBlockLedger(documentArtifact) {
  const payload = ledgerPayload(documentArtifact);
  return {
    ...payload,
    ledgerSha256: domainDigest(SOURCE_BLOCK_LEDGER_CONTRACT_ID, payload),
  };
}

function canonicalSourceBlockLedgerBytes(ledger) {
  return `${stableStringify(ledger)}\n`;
}

function validateSourceBlockLedger(ledger, documentArtifact) {
  const rebuilt = buildSourceBlockLedger(documentArtifact);
  if (stableStringify(ledger) !== stableStringify(rebuilt))
    throw new Error("SOURCE_BLOCK_LEDGER_REBUILD_MISMATCH");
  return ledger;
}

module.exports = {
  SEGMENTATION_CONTRACT_ID,
  SOURCE_BLOCK_LEDGER_CONTRACT_ID,
  buildSourceBlockLedger,
  canonicalSourceBlockLedgerBytes,
  normalizeStructuralText,
  validateSourceBlockLedger,
};

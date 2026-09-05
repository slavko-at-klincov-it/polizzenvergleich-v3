const crypto = require("crypto");

const LF_REFERENCE_MANIFEST_SCHEMA_VERSION = 1;
const LF_REFERENCE_MANIFEST_CONTRACT_ID =
  "LF_REFERENCE_A_LINE_MANIFEST_SOURCE_BOUND_V1";
const LF_REFERENCE_FAMILY_CONTRACT_ID = "LF_IMMO_REFERENCE_FAMILY_STRUCTURE_V1";
const LF_REFERENCE_MANIFEST_FILE = "lf-reference-a-line-manifest.private.json";

const CATEGORY_DEFINITIONS = Object.freeze([
  Object.freeze({
    sourceCategoryId: "LF-PR",
    categoryView: "RP",
    label: "Produktgrundlage und Geltungsvoraussetzungen",
  }),
  Object.freeze({
    sourceCategoryId: "LF-VS",
    categoryView: "RV",
    label: "Versicherte Gebäude, Sachen und Grundstücksbestandteile",
  }),
  Object.freeze({
    sourceCategoryId: "LF-KO",
    categoryView: "RK",
    label: "Spartenübergreifende Kosten und Ertragsausfälle",
  }),
  Object.freeze({
    sourceCategoryId: "LF-FE",
    categoryView: "RF",
    label: "Feuerversicherung",
  }),
  Object.freeze({
    sourceCategoryId: "LF-ST",
    categoryView: "RS",
    label: "Sturm und Elementargefahren",
  }),
  Object.freeze({
    sourceCategoryId: "LF-LW",
    categoryView: "RW",
    label: "Leitungswasser und Deckungsvarianten",
  }),
  Object.freeze({
    sourceCategoryId: "LF-GL",
    categoryView: "RG",
    label: "Glasbruch",
  }),
  Object.freeze({
    sourceCategoryId: "LF-HP",
    categoryView: "RH",
    label: "Gebäude- und Grundstückshaftpflicht",
  }),
  Object.freeze({
    sourceCategoryId: "LF-OK",
    categoryView: "RO",
    label: "Ökoschutz, zeitliche und örtliche Geltung",
  }),
  Object.freeze({
    sourceCategoryId: "LF-AV",
    categoryView: "RA",
    label: "Allgemeine Entschädigungs- und Vertragsbestimmungen",
  }),
]);

const STRUCTURE_ANCHORS = Object.freeze([
  /praeambel/u,
  /besonderer teil/u,
  /versicherungsumfang/u,
  /feuerversicherung/u,
  /sturm(?:versicherung|sch[aä]den|definition)/u,
  /leitungswasserversicherung/u,
  /glasbruch/u,
  /haftpflicht/u,
  /allgemein(?:e|en|er) (?:bestimmungen|entsch[aä]digungs|teil)/u,
]);

function manifestError(code, detail = "") {
  const error = new Error(detail ? `${code}: ${detail}` : code);
  error.code = code;
  return error;
}

function normalizeStructureText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("de")
    .replace(/[ä]/gu, "ae")
    .replace(/[ö]/gu, "oe")
    .replace(/[ü]/gu, "ue")
    .replace(/[ß]/gu, "ss")
    .replace(/[^\p{L}\p{N}%]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
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

function validateDocumentArtifact(documentArtifact) {
  const document = documentArtifact?.document;
  if (
    documentArtifact?.schemaVersion !== 1 ||
    typeof documentArtifact?.fingerprint !== "string" ||
    !/^[a-f0-9]{64}$/u.test(documentArtifact.fingerprint) ||
    document?.sourceDocumentId !== documentArtifact.fingerprint ||
    typeof document?.pageContent !== "string" ||
    !Array.isArray(document?.pageMap) ||
    document.pageMap.length === 0 ||
    document?.pdfExtraction?.complete !== true ||
    document?.pdfExtraction?.totalPages !== document.pageMap.length
  )
    throw manifestError("LF_REFERENCE_DOCUMENT_ARTIFACT_INVALID");

  let previousEnd = 0;
  for (const [index, page] of document.pageMap.entries()) {
    if (
      page.pageNumber !== index + 1 ||
      !Number.isInteger(page.start) ||
      !Number.isInteger(page.end) ||
      page.start < previousEnd ||
      page.end <= page.start ||
      page.end > document.pageContent.length
    )
      throw manifestError("LF_REFERENCE_PAGE_MAP_INVALID", String(index + 1));
    previousEnd = page.end;
  }
  return document;
}

function sectionHeading(text) {
  const normalized = normalizeStructureText(text);
  if (!normalized) return false;
  return (
    /^(?:[a-z]|\d+)[.)]\s/u.test(String(text).trim()) ||
    /^(?:a\.|b\.|c\.|d\.)\s/u.test(String(text).trim()) ||
    (/^[\p{L}\s-]{3,80}$/u.test(String(text).trim()) &&
      String(text).trim().length > 3 &&
      String(text).trim() === String(text).trim().toLocaleUpperCase("de")) ||
    /(?:versicherung|deckung|haftpflicht|glasbruch|bestimmungen)/u.test(
      normalized
    )
  );
}

function lineRecords(text, startOffset, physicalPageNumber) {
  const records = [];
  let start = 0;
  while (start <= text.length) {
    const newline = text.indexOf("\n", start);
    const rawEnd = newline === -1 ? text.length : newline;
    const end =
      rawEnd > start && text[rawEnd - 1] === "\r" ? rawEnd - 1 : rawEnd;
    const line = text.slice(start, end);
    if (
      line.trim() &&
      !/^\s*Seite\s+\d+(?:\s+von\s+\d+)?\s*$/iu.test(line) &&
      !/^\s*\[DOCUMENT_PAGE\s+\d+\]\s*$/u.test(line)
    )
      records.push({
        start: startOffset + start,
        end: startOffset + end,
        physicalPageNumber,
        text: line,
      });
    if (newline === -1) break;
    start = newline + 1;
  }
  return records;
}

function isBullet(text) {
  return /^\s*(?:[-•·]|\d+[.)])\s*/u.test(String(text || ""));
}

function logicalBlocks(document) {
  const blocks = [];
  for (const page of document.pageMap) {
    const pageText = document.pageContent.slice(page.start, page.end);
    const records = lineRecords(pageText, page.start, page.pageNumber);
    let current = null;
    for (const record of records) {
      const startsNew =
        !current ||
        isBullet(record.text) ||
        sectionHeading(record.text) ||
        /^\s*(?:[-•·]|\d+[.)])\s*/u.test(record.text);
      if (startsNew) {
        if (current) blocks.push(current);
        current = { ...record };
      } else {
        current.end = record.end;
        current.text = document.pageContent.slice(current.start, current.end);
      }
    }
    if (current) blocks.push(current);
  }
  return blocks;
}

function structureMatches(document) {
  const title = normalizeStructureText(document.title);
  const content = normalizeStructureText(document.pageContent);
  const identityHits = [
    /lf immo/u.test(title) || /lf immo/u.test(content),
    /exklusivschutz/u.test(title) || /exklusivschutz/u.test(content),
    /wohnhausversicherung|gebaeudeversicherung/u.test(content),
  ].filter(Boolean).length;
  let anchorCursor = 0;
  const anchorIndexes = STRUCTURE_ANCHORS.map((anchor) => {
    const relativeIndex = content.slice(anchorCursor).search(anchor);
    if (relativeIndex < 0) return -1;
    const absoluteIndex = anchorCursor + relativeIndex;
    anchorCursor = absoluteIndex + 1;
    return absoluteIndex;
  });
  const matchedAnchors = anchorIndexes.filter((index) => index >= 0).length;
  const orderedAnchors = anchorIndexes.every(
    (index, position) =>
      index < 0 ||
      position === 0 ||
      anchorIndexes[position - 1] < 0 ||
      index > anchorIndexes[position - 1]
  );
  return {
    identityHits,
    matchedAnchors,
    anchorIndexes,
    orderedAnchors,
    pass:
      identityHits >= 2 &&
      matchedAnchors >= 8 &&
      orderedAnchors &&
      document.pageMap.length >= 20,
  };
}

function categoryForText(text, current) {
  const normalized = normalizeStructureText(text);
  if (/^1\s+versicherungsumfang\b/u.test(normalized)) return "RV";
  if (/^[23]\s+versicherungsumfang\b/u.test(normalized)) return "RK";
  if (/^4\s+feuerversicherung\b/u.test(normalized)) return "RF";
  if (/^5\s+sturmversicherung\b/u.test(normalized)) return "RS";
  if (/^6\s+leitungswasserversicherung\b/u.test(normalized)) return "RW";
  if (/^7\s+glasbruch\b/u.test(normalized)) return "RG";
  if (
    /^8\s+gebaeude und grundstueckshaftpflichtversicherung\b/u.test(normalized)
  )
    return "RH";
  if (/^9\s+oekoschutz\b/u.test(normalized)) return "RO";
  if (/^(?:b\s+)?allgemeiner teil\b/u.test(normalized)) return "RA";
  return current || "RP";
}

function categoryDefinition(categoryView) {
  return (
    CATEGORY_DEFINITIONS.find(
      (definition) => definition.categoryView === categoryView
    ) || CATEGORY_DEFINITIONS[0]
  );
}

function inferredFactRole(text) {
  const normalized = normalizeStructureText(text);
  if (/nicht versichert|ausgenommen|exklusive|ausgeschlossen/u.test(normalized))
    return "EXCLUSION";
  if (
    /%|eur|versicherungssumme|hoehe|limit|maximal|mindestens|hoechstens/u.test(
      normalized
    )
  )
    return "LIMIT";
  if (
    /sofern|voraussetzung|nur insoweit|subsidi[aä]r|gilt|vereinbart/u.test(
      normalized
    )
  )
    return "CONDITION";
  if (/kosten|mehrkosten|aufwand|entschaedigung/u.test(normalized))
    return "COST";
  if (
    /brand|explosion|blitz|sturm|hagel|wasser|frost|glasbruch/u.test(normalized)
  )
    return "PERIL";
  return "BENEFIT";
}

function sourceValues(text, documentStart) {
  const values = [];
  const pattern =
    /(?:\d+(?:[.,]\d+)?\s*%|(?:€|EUR)\s*[\d.]+(?:,\d+)?|[\d.]+(?:,\d+)?\s*(?:€|EUR))/giu;
  for (const match of String(text).matchAll(pattern)) {
    const exactText = match[0];
    values.push({
      kind: /%/u.test(exactText) ? "PERCENT" : "AMOUNT",
      exactText,
      documentStart: documentStart + match.index,
      documentEnd: documentStart + match.index + exactText.length,
      basisStatus: /%/u.test(exactText) ? "BASIS_NOT_FOUND" : "NOT_APPLICABLE",
      calculationBasis: null,
      formula: null,
      calculatedAmount: null,
      currency: /%/u.test(exactText) ? null : "EUR",
      roundingRule: null,
    });
  }
  return values;
}

function buildManifestPayload(document, structure, blocks) {
  const started = blocks.findIndex((block) =>
    /praeambel|deckungskonzept|besonderer teil/u.test(
      normalizeStructureText(block.text)
    )
  );
  if (started < 0) throw manifestError("LF_REFERENCE_OPERATIVE_START_MISSING");
  let currentCategory = "RP";
  let currentHeading = null;
  const lines = [];
  for (const [index, block] of blocks.slice(started).entries()) {
    if (sectionHeading(block.text)) currentHeading = block.text;
    currentCategory = categoryForText(block.text, currentCategory);
    const definition = categoryDefinition(currentCategory);
    const sourceText = document.pageContent.slice(block.start, block.end);
    const sourceValuesFound = sourceValues(sourceText, block.start);
    lines.push({
      lineId: `LF-LINE-${String(index + 1).padStart(4, "0")}`,
      sourceReferenceId: `LF-MAN-${String(index + 1).padStart(4, "0")}`,
      categoryView: definition.categoryView,
      sourceCategoryId: definition.sourceCategoryId,
      categoryName: definition.label,
      subcategory: currentHeading || definition.label,
      factRole: inferredFactRole(sourceText),
      scope: {
        kind: "SOURCE_BOUND_SECTION",
        categoryView: definition.categoryView,
        sectionHeading: currentHeading,
      },
      source: {
        documentFingerprint: null,
        physicalPageNumber: block.physicalPageNumber,
        physicalPageEnd: block.physicalPageNumber,
        documentStart: block.start,
        documentEnd: block.end,
        exactText: sourceText,
        sourceTextSha256: sha256(sourceText),
      },
      values: sourceValuesFound,
    });
  }
  if (lines.length < 1) throw manifestError("LF_REFERENCE_LINE_MANIFEST_EMPTY");
  return lines;
}

function buildLfReferenceLineManifest(documentArtifact) {
  const document = validateDocumentArtifact(documentArtifact);
  const structure = structureMatches(document);
  if (!structure.pass)
    throw manifestError(
      "LF_REFERENCE_NEW_PROFILE_REQUIRED",
      `neues LF-Profil erforderlich: ${JSON.stringify({
        familyContractId: LF_REFERENCE_FAMILY_CONTRACT_ID,
        identityHits: structure.identityHits,
        matchedAnchors: structure.matchedAnchors,
        requiredAnchors: STRUCTURE_ANCHORS.length,
        orderedAnchors: structure.orderedAnchors,
        physicalPages: document.pageMap.length,
      })}`
    );
  const lines = buildManifestPayload(
    document,
    structure,
    logicalBlocks(document)
  );
  const payload = {
    schemaVersion: LF_REFERENCE_MANIFEST_SCHEMA_VERSION,
    contractId: LF_REFERENCE_MANIFEST_CONTRACT_ID,
    familyContractId: LF_REFERENCE_FAMILY_CONTRACT_ID,
    profileStatus: "SUPPORTED_SOURCE_MANIFEST",
    sourceProduct: {
      productId: "LF_IMMO_EXKLUSIVSCHUTZ",
      version: "2023",
    },
    sourceDocument: {
      fingerprint: documentArtifact.fingerprint,
      physicalPages: document.pageMap.length,
      pageContentLength: document.pageContent.length,
    },
    structure: {
      identityHits: structure.identityHits,
      matchedAnchors: structure.matchedAnchors,
      anchorCount: STRUCTURE_ANCHORS.length,
      orderedAnchors: structure.orderedAnchors,
      minimumCoverage:
        "ALL_EXTRACTED_NONEMPTY_SOURCE_BLOCKS_AFTER_OPERATIVE_START",
    },
    lines: lines.map((line) => ({
      ...line,
      source: {
        ...line.source,
        documentFingerprint: documentArtifact.fingerprint,
      },
    })),
  };
  const manifestSha256 = sha256(JSON.stringify(stableValue(payload)));
  return Object.freeze({ ...payload, manifestSha256 });
}

function validateLfReferenceLineManifest(
  manifest,
  { documentArtifact = null } = {}
) {
  if (
    !manifest ||
    manifest.schemaVersion !== LF_REFERENCE_MANIFEST_SCHEMA_VERSION ||
    manifest.contractId !== LF_REFERENCE_MANIFEST_CONTRACT_ID ||
    manifest.familyContractId !== LF_REFERENCE_FAMILY_CONTRACT_ID ||
    manifest.profileStatus !== "SUPPORTED_SOURCE_MANIFEST" ||
    !Array.isArray(manifest.lines) ||
    manifest.lines.length === 0 ||
    !/^[a-f0-9]{64}$/u.test(manifest.manifestSha256 || "")
  )
    throw manifestError("LF_REFERENCE_LINE_MANIFEST_INVALID");
  const payload = { ...manifest };
  delete payload.manifestSha256;
  if (sha256(JSON.stringify(stableValue(payload))) !== manifest.manifestSha256)
    throw manifestError("LF_REFERENCE_LINE_MANIFEST_DIGEST_INVALID");
  const ids = new Set();
  for (const [index, line] of manifest.lines.entries()) {
    if (
      line.lineId !== `LF-LINE-${String(index + 1).padStart(4, "0")}` ||
      line.sourceReferenceId !==
        `LF-MAN-${String(index + 1).padStart(4, "0")}` ||
      ids.has(line.lineId) ||
      !line.source?.documentFingerprint ||
      !Number.isInteger(line.source.physicalPageNumber) ||
      !Number.isInteger(line.source.documentStart) ||
      !Number.isInteger(line.source.documentEnd) ||
      line.source.documentEnd <= line.source.documentStart ||
      typeof line.source.exactText !== "string" ||
      sha256(line.source.exactText) !== line.source.sourceTextSha256 ||
      !Array.isArray(line.values) ||
      line.values.some(
        (value) =>
          !["PERCENT", "AMOUNT"].includes(value.kind) ||
          typeof value.exactText !== "string" ||
          !Number.isInteger(value.documentStart) ||
          !Number.isInteger(value.documentEnd) ||
          value.documentStart < line.source.documentStart ||
          value.documentEnd > line.source.documentEnd ||
          value.documentEnd <= value.documentStart ||
          (value.kind === "PERCENT"
            ? value.basisStatus !== "BASIS_NOT_FOUND" ||
              value.calculationBasis !== null ||
              value.formula !== null ||
              value.calculatedAmount !== null
            : value.currency !== "EUR" ||
              value.calculationBasis !== null ||
              value.formula !== null ||
              value.calculatedAmount !== null)
      )
    )
      throw manifestError(
        "LF_REFERENCE_LINE_BINDING_INVALID",
        String(index + 1)
      );
    ids.add(line.lineId);
  }
  if (documentArtifact) {
    const document = validateDocumentArtifact(documentArtifact);
    if (
      manifest.sourceDocument.fingerprint !== documentArtifact.fingerprint ||
      manifest.lines.some((line) => {
        const sourcePage = document.pageMap.find(
          (page) =>
            page.pageNumber === line.source.physicalPageNumber &&
            line.source.documentStart >= page.start &&
            line.source.documentEnd <= page.end
        );
        return (
          line.source.documentFingerprint !== documentArtifact.fingerprint ||
          !sourcePage ||
          document.pageContent.slice(
            line.source.documentStart,
            line.source.documentEnd
          ) !== line.source.exactText ||
          line.values.some(
            (value) =>
              document.pageContent.slice(
                value.documentStart,
                value.documentEnd
              ) !== value.exactText
          )
        );
      })
    )
      throw manifestError("LF_REFERENCE_LINE_DOCUMENT_BINDING_INVALID");
  }
  return manifest;
}

function buildCatalogFromLineManifest(manifest) {
  validateLfReferenceLineManifest(manifest);
  return CATEGORY_DEFINITIONS.map((definition) => ({
    sourceCategoryId: definition.sourceCategoryId,
    label: definition.label,
    categoryView: definition.categoryView,
    catalog: {
      schemaVersion: 2,
      catalogId: `lf-immo-reference-source-manifest-v1:${manifest.manifestSha256}:${definition.categoryView}`,
      categoryView: definition.categoryView,
      requirements: manifest.lines
        .filter((line) => line.categoryView === definition.categoryView)
        .map((line, index) => {
          const componentId = `source_line_${String(index + 1).padStart(4, "0")}`;
          const hasPercent = line.values.some(({ kind }) => kind === "PERCENT");
          const requestedFields = [
            ...(hasPercent ? ["limit"] : []),
            ...(line.values.some(({ kind }) => kind === "AMOUNT")
              ? ["amount"]
              : []),
            ...(/monat|tage?|jahre?|stunden?/iu.test(line.source.exactText)
              ? ["duration"]
              : []),
          ];
          return {
            id: `${definition.categoryView}-${String(index + 1).padStart(4, "0")}`,
            sourceReferenceId: line.sourceReferenceId,
            label: `${definition.label} · Quelle ${line.lineId}`,
            stage: "K",
            requestedFields: [...new Set(requestedFields)],
            components: [
              {
                id: componentId,
                label: line.source.exactText.slice(0, 180),
                factRole: line.factRole,
                contextMode: "CLAUSE_SECTION",
                aliases: [line.source.exactText],
              },
            ],
            coverageAggregationPolicy: "ALL_COMPONENT_EFFECTS",
            componentSatisfactionPolicy: "ALL",
            negativeSearchPolicy: "REPORT_COMPLETE_ZERO_CONTROLLED_SEARCH_V2",
            absenceMeaning: "COVERAGE_MIXED",
            reference: {
              ...line.source,
              lineId: line.lineId,
              scope: line.scope,
              values: line.values,
            },
            sourceValues: line.values,
          };
        }),
    },
  }));
}

module.exports = {
  CATEGORY_DEFINITIONS,
  LF_REFERENCE_FAMILY_CONTRACT_ID,
  LF_REFERENCE_MANIFEST_CONTRACT_ID,
  LF_REFERENCE_MANIFEST_FILE,
  LF_REFERENCE_MANIFEST_SCHEMA_VERSION,
  buildCatalogFromLineManifest,
  buildLfReferenceLineManifest,
  normalizeStructureText,
  validateLfReferenceLineManifest,
};

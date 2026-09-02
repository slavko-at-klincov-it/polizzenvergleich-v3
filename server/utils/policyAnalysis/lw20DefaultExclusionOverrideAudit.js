const crypto = require("crypto");

const LW20_DEFAULT_EXCLUSION_OVERRIDE_AUDIT_SCHEMA_VERSION = 1;
const LW20_DEFAULT_EXCLUSION_OVERRIDE_AUDIT_CONTRACT_ID =
  "LW20_FULL_DOCUMENT_DEFAULT_EXCLUSION_OVERRIDE_AUDIT_V1";
const LW20_DEFAULT_EXCLUSION_OVERRIDE_PATTERN_CONTRACT_ID =
  "LW20_DEFAULT_EXCLUSION_OVERRIDE_PATTERN_FAMILIES_V1";
const LW20_DEFAULT_EXCLUSION_OVERRIDE_DECISION_BASIS =
  "FULL_DOCUMENT_LW20_DEFAULT_EXCLUSION_OVERRIDE_REFERENCE_SCAN";
const LW20_REQUIREMENT_ID = "LW-20";
const LW20_COMPONENT_ID = "ground_seepage_or_retained_water";
const NO_OVERRIDE_REFERENCE_FOUND = "NO_OVERRIDE_REFERENCE_FOUND";
const REVIEW_REQUIRED = "REVIEW_REQUIRED";

const WATER_TERM =
  "(?:Grundwasser|Sickerwasser|Stauwasser|dr(?:u|ü)ckendes\\s+Wasser|aufsteigend(?:es|em|en|er)\\s+Wasser|Wasser\\s+aus\\s+(?:dem\\s+)?(?:Erdreich|Untergrund|Boden))";
const POSITIVE_COVERAGE =
  "(?:mitversichert|mit\\s+versichert|mitgedeckt|mit\\s+gedeckt|gedeckt|eingeschlossen|Versicherungsschutz\\s+(?:ist|besteht|erstreckt\\s+sich|umfasst)|Deckung(?:sschutz)?\\s+(?:ist|besteht|umfasst)|(?:gilt|gelten)\\s+als\\s+(?:mit)?(?:versichert|gedeckt)|sind\\s+(?:versichert|gedeckt)|werden\\s+(?:versichert|gedeckt))";
const CODE_REFERENCE =
  "(?:(?:Klausel|Code|Deckungsbaustein|Baustein|Besondere\\s+Bedingung)\\s*(?:Nr\\.?\\s*)?[A-ZÄÖÜ]{0,8}[-./ ]?\\d{1,6}[A-Z0-9./-]*|(?:BB|BVB)\\s*[A-ZÄÖÜ]{0,6}[-./ ]?\\d{1,6}[A-Z0-9./-]*)";
const AWB_REFERENCE =
  "(?:AWB(?:\\s*[-/]?\\s*\\d{2,4})?|Allgemeine\\s+Versicherungsbedingungen)";
const LEITUNGSWASSER_REFERENCE =
  "(?:(?:Allgemeine|Besondere)\\s+Bedingungen\\s+für\\s+die\\s+Leitungswasserversicherung|Leitungswasser(?:versicherung)?s?bedingungen|Leitungswasserversicherung)";
const POINT_OR_ARTICLE_REFERENCE =
  "(?:(?:Art(?:ikel)?|Punkt|Ziffer|Abs(?:atz)?)\\.?\\s*\\d{1,4}(?:[.)/-]\\d{1,4})?(?:\\s*(?:lit(?:era)?\\.?\\s*[a-z]|Abs\\.?\\s*\\d{1,3}))?|lit(?:era)?\\.?\\s*[a-z])";
const STRONG_REFERENCE_OVERRIDE_CUE =
  "(?:abweichend(?:\\s+von)?|entgegen|unter\\s+Aufhebung|(?:wird|werden|ist|sind)\\s+(?:aufgehoben|gestrichen|außer\\s+Kraft\\s+gesetzt)|(?:findet|finden)\\s+keine\\s+Anwendung|nicht\\s+anzuwenden|ersetzt\\s+durch|in\\s+Erweiterung|über\\s+(?:den|die|das)\\s+[^.\\n]{0,80}?hinaus|zusätzlich\\s+(?:mitversichert|eingeschlossen|gedeckt)|(?:gilt|gelten|ist|sind|wird|werden)[^.\\n]{0,80}?(?:mitversichert|eingeschlossen|gedeckt))";

function bidirectional(left, right, distance) {
  return `(?:${left}[\\s\\S]{0,${distance}}?${right}|${right}[\\s\\S]{0,${distance}}?${left})`;
}

const PATTERN_FAMILIES = Object.freeze([
  Object.freeze({
    id: "DIRECT_LW20_POSITIVE_OVERRIDE_V1",
    source: bidirectional(WATER_TERM, POSITIVE_COVERAGE, 180),
    flags: "giu",
    matchPolicy: "UNNEGATED_POSITIVE_COVERAGE_V1",
  }),
  Object.freeze({
    id: "CODE_CROSS_REFERENCE_OVERRIDE_V1",
    source: bidirectional(CODE_REFERENCE, STRONG_REFERENCE_OVERRIDE_CUE, 260),
    flags: "giu",
    matchPolicy: "LOCAL_CROSS_REFERENCE_REVIEW_V1",
  }),
  Object.freeze({
    id: "AWB_CROSS_REFERENCE_OVERRIDE_V1",
    source: bidirectional(AWB_REFERENCE, STRONG_REFERENCE_OVERRIDE_CUE, 260),
    flags: "giu",
    matchPolicy: "LOCAL_CROSS_REFERENCE_REVIEW_V1",
  }),
  Object.freeze({
    id: "LEITUNGSWASSER_CROSS_REFERENCE_OVERRIDE_V1",
    source: bidirectional(
      LEITUNGSWASSER_REFERENCE,
      STRONG_REFERENCE_OVERRIDE_CUE,
      260
    ),
    flags: "giu",
    matchPolicy: "LOCAL_CROSS_REFERENCE_REVIEW_V1",
  }),
  Object.freeze({
    id: "POINT_OR_ARTICLE_CROSS_REFERENCE_OVERRIDE_V1",
    source: bidirectional(
      POINT_OR_ARTICLE_REFERENCE,
      STRONG_REFERENCE_OVERRIDE_CUE,
      260
    ),
    flags: "giu",
    matchPolicy: "LOCAL_CROSS_REFERENCE_REVIEW_V1",
  }),
]);

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonical(value[key])])
  );
}

function stableStringify(value) {
  return JSON.stringify(canonical(value));
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function domainDigest(domain, value) {
  return sha256(`${domain}\u0000${stableStringify(value)}`);
}

const PATTERN_FAMILY_PROJECTION = Object.freeze(
  PATTERN_FAMILIES.map(({ id, source, flags, matchPolicy }) =>
    Object.freeze({ id, source, flags, matchPolicy })
  )
);
const LW20_DEFAULT_EXCLUSION_OVERRIDE_PATTERN_FAMILY_DIGEST_SHA256 =
  domainDigest(
    LW20_DEFAULT_EXCLUSION_OVERRIDE_PATTERN_CONTRACT_ID,
    PATTERN_FAMILY_PROJECTION
  );

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value))
    return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function exactDocumentPages({ document, documentArtifact }) {
  const artifactDocument = documentArtifact?.document;
  const extraction = artifactDocument?.pdfExtraction;
  const pageContent = artifactDocument?.pageContent;
  const pageMap = artifactDocument?.pageMap;
  const documentUuid = String(document?.uuid || "").trim();
  const documentSha256 = String(document?.sha256 || "").trim();
  if (
    documentArtifact?.schemaVersion !== 1 ||
    !documentUuid ||
    !/^[a-f0-9]{64}$/u.test(documentSha256) ||
    documentArtifact?.fingerprint !== documentSha256 ||
    artifactDocument?.sourceDocumentId !== documentSha256 ||
    extraction?.complete !== true ||
    !Number.isInteger(extraction?.totalPages) ||
    extraction.totalPages < 1 ||
    extraction.processedPages !== extraction.totalPages ||
    extraction.pagesWithText !== extraction.totalPages ||
    typeof pageContent !== "string" ||
    !Array.isArray(pageMap) ||
    pageMap.length !== extraction.totalPages
  )
    return null;

  const pages = [];
  let previousEnd = 0;
  for (let index = 0; index < pageMap.length; index += 1) {
    const page = pageMap[index];
    if (
      page?.pageNumber !== index + 1 ||
      !Number.isInteger(page?.start) ||
      !Number.isInteger(page?.end) ||
      page.start < previousEnd ||
      page.end <= page.start ||
      page.end > pageContent.length ||
      !pageContent.slice(page.start, page.end).trim()
    )
      return null;
    pages.push({
      physicalPageNumber: page.pageNumber,
      documentStart: page.start,
      documentEnd: page.end,
      text: pageContent.slice(page.start, page.end),
    });
    previousEnd = page.end;
  }
  return {
    documentUuid,
    documentSha256,
    pageContent,
    pageMap: pageMap.map(({ pageNumber, start, end }) => ({
      pageNumber,
      start,
      end,
    })),
    pages,
  };
}

function hasUnnegatedPositiveCoverage(text) {
  const positive = new RegExp(POSITIVE_COVERAGE, "giu");
  for (const match of text.matchAll(positive)) {
    const prefix = text.slice(Math.max(0, match.index - 48), match.index);
    const suffix = text.slice(
      match.index + match[0].length,
      match.index + match[0].length + 32
    );
    if (
      !/(?:\bnicht\b|\bkeine[nmrs]?\b|\bohne\b|\bkeinesfalls\b)(?:\s+\p{L}+){0,2}\s*$/iu.test(
        prefix
      ) &&
      !/^\s*(?:nicht|keine[nmrs]?|keinesfalls)\b/iu.test(suffix)
    )
      return true;
  }
  return false;
}

function candidateProjection({ familyId, page, match, documentIdentity }) {
  const documentStart = page.documentStart + match.index;
  const exactText = match[0];
  const projection = {
    familyId,
    physicalPageNumber: page.physicalPageNumber,
    documentStart,
    documentEnd: documentStart + exactText.length,
    exactText,
    exactTextSha256: sha256(exactText),
  };
  const candidateDigestSha256 = domainDigest(
    "LW20_DEFAULT_EXCLUSION_OVERRIDE_CANDIDATE_V1",
    { document: documentIdentity, candidate: projection }
  );
  return {
    candidateId: `lw20-override:${candidateDigestSha256}`,
    ...projection,
    candidateDigestSha256,
  };
}

function scanCandidates(pages, documentIdentity) {
  const candidates = [];
  const identities = new Set();
  for (const page of pages) {
    for (const family of PATTERN_FAMILIES) {
      const pattern = new RegExp(family.source, family.flags);
      for (const match of page.text.matchAll(pattern)) {
        if (
          family.matchPolicy === "UNNEGATED_POSITIVE_COVERAGE_V1" &&
          !hasUnnegatedPositiveCoverage(match[0])
        )
          continue;
        const candidate = candidateProjection({
          familyId: family.id,
          page,
          match,
          documentIdentity,
        });
        const identity = `${candidate.familyId}\u0000${candidate.documentStart}\u0000${candidate.documentEnd}`;
        if (identities.has(identity)) continue;
        identities.add(identity);
        candidates.push(candidate);
      }
    }
  }
  return candidates.sort(
    (left, right) =>
      left.documentStart - right.documentStart ||
      left.documentEnd - right.documentEnd ||
      left.familyId.localeCompare(right.familyId, "en")
  );
}

/**
 * Scans one complete server-owned document artifact for wording or references
 * that could override the default LW-20 groundwater exclusion. A hit is only
 * a review signal; this contract never decides coverage or equivalence.
 * Role: deterministic evidence audit. Side effects: none.
 */
function buildLw20DefaultExclusionOverrideAudit({
  document,
  documentArtifact,
  requirementId,
  componentId,
}) {
  if (
    requirementId !== LW20_REQUIREMENT_ID ||
    componentId !== LW20_COMPONENT_ID
  )
    return null;
  const exactDocument = exactDocumentPages({ document, documentArtifact });
  if (!exactDocument) return null;

  const candidates = scanCandidates(exactDocument.pages, {
    uuid: exactDocument.documentUuid,
    sha256: exactDocument.documentSha256,
  });
  const status = candidates.length
    ? REVIEW_REQUIRED
    : NO_OVERRIDE_REFERENCE_FOUND;
  const base = {
    schemaVersion: LW20_DEFAULT_EXCLUSION_OVERRIDE_AUDIT_SCHEMA_VERSION,
    contractId: LW20_DEFAULT_EXCLUSION_OVERRIDE_AUDIT_CONTRACT_ID,
    requirementId: LW20_REQUIREMENT_ID,
    componentId: LW20_COMPONENT_ID,
    decisionOwner: "SERVER",
    decisionBasis: LW20_DEFAULT_EXCLUSION_OVERRIDE_DECISION_BASIS,
    status,
    document: {
      uuid: exactDocument.documentUuid,
      sha256: exactDocument.documentSha256,
      documentArtifactDigestSha256: domainDigest(
        "LW20_OVERRIDE_DOCUMENT_ARTIFACT_V1",
        documentArtifact
      ),
      physicalPagesChecked: exactDocument.pages.length,
      totalPhysicalPages: exactDocument.pages.length,
      pageContentSha256: domainDigest(
        "LW20_OVERRIDE_PAGE_CONTENT_V1",
        exactDocument.pageContent
      ),
      pageMapSha256: domainDigest(
        "LW20_OVERRIDE_PAGE_MAP_V1",
        exactDocument.pageMap
      ),
    },
    patternFamilyContract: {
      contractId: LW20_DEFAULT_EXCLUSION_OVERRIDE_PATTERN_CONTRACT_ID,
      familyIds: PATTERN_FAMILY_PROJECTION.map(({ id }) => id),
      digestSha256:
        LW20_DEFAULT_EXCLUSION_OVERRIDE_PATTERN_FAMILY_DIGEST_SHA256,
    },
    candidateCount: candidates.length,
    candidates,
    candidateSetDigestSha256: domainDigest(
      "LW20_DEFAULT_EXCLUSION_OVERRIDE_CANDIDATE_SET_V1",
      candidates
    ),
  };
  return deepFreeze({
    ...base,
    assessmentDigestSha256: domainDigest(
      LW20_DEFAULT_EXCLUSION_OVERRIDE_AUDIT_CONTRACT_ID,
      base
    ),
  });
}

function validateLw20DefaultExclusionOverrideAudit({
  audit,
  document,
  documentArtifact,
  requirementId = LW20_REQUIREMENT_ID,
  componentId = LW20_COMPONENT_ID,
}) {
  const expected = buildLw20DefaultExclusionOverrideAudit({
    document,
    documentArtifact,
    requirementId,
    componentId,
  });
  return Boolean(
    expected && stableStringify(audit) === stableStringify(expected)
  );
}

module.exports = {
  LW20_COMPONENT_ID,
  LW20_DEFAULT_EXCLUSION_OVERRIDE_AUDIT_CONTRACT_ID,
  LW20_DEFAULT_EXCLUSION_OVERRIDE_AUDIT_SCHEMA_VERSION,
  LW20_DEFAULT_EXCLUSION_OVERRIDE_DECISION_BASIS,
  LW20_DEFAULT_EXCLUSION_OVERRIDE_PATTERN_CONTRACT_ID,
  LW20_DEFAULT_EXCLUSION_OVERRIDE_PATTERN_FAMILY_DIGEST_SHA256,
  LW20_REQUIREMENT_ID,
  NO_OVERRIDE_REFERENCE_FOUND,
  REVIEW_REQUIRED,
  buildLw20DefaultExclusionOverrideAudit,
  validateLw20DefaultExclusionOverrideAudit,
};

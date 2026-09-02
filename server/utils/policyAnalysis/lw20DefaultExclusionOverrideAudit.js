const crypto = require("crypto");
const {
  structuralContext,
} = require("./controlledOccurrenceWorksheet");

const LW20_DEFAULT_EXCLUSION_OVERRIDE_AUDIT_SCHEMA_VERSION = 2;
const LW20_DEFAULT_EXCLUSION_OVERRIDE_AUDIT_CONTRACT_ID =
  "LW20_DEFAULT_EXCLUSION_ALIAS_FREE_OVERRIDE_AUDIT_V2";
const LW20_DEFAULT_EXCLUSION_OVERRIDE_PATTERN_CONTRACT_ID =
  "LW20_DEFAULT_EXCLUSION_ALIAS_FREE_REFERENCE_FAMILIES_V2";
const LW20_DEFAULT_EXCLUSION_OVERRIDE_DECISION_BASIS =
  "STRUCTURE_BOUND_ALIAS_FREE_LW20_DEFAULT_EXCLUSION_OVERRIDE_SCAN";
const LW20_REQUIREMENT_ID = "LW-20";
const LW20_COMPONENT_ID = "ground_seepage_or_retained_water";
const NO_OVERRIDE_REFERENCE_FOUND = "NO_OVERRIDE_REFERENCE_FOUND";
const REVIEW_REQUIRED = "REVIEW_REQUIRED";
const MAX_STRUCTURAL_UNIT_CHARS = 600;
const FALLBACK_WORDS_EACH_SIDE = 60;
const MAX_LOCATOR_ACTION_DISTANCE = 160;
const ALLOWED_UNIT_TYPES = new Set(["PARAGRAPH", "LIST_ITEM"]);

const LW_ANCHOR_SOURCE =
  "\\b(?:Leitungswasserversicherung|Leitungswasserbedingungen|Bedingungen\\s+f(?:u|ü)r\\s+die\\s+Leitungswasserversicherung)\\b";
const EXCLUSION_SOURCE =
  "\\b(?:Ausschluss|Ausschl(?:u|ü)sse|Ausschlussbestimmungen|nicht\\s+versicherte[nr]?\\s+Sch(?:a|ä)den)\\b";
const ITEM_C_SOURCE =
  "\\b(?:lit(?:era)?\\.?|Buchstabe|Punkt|Ziffer)\\s*c\\b";
const DEFAULT_HEADING_SOURCE =
  "\\bNicht\\s+versichert\\s+sind\\s+Sch(?:a|ä)den\\s*,?\\s*(?:sofern|so\\s+ferne?)\\s+nicht\\s+anders\\s+vereinbart\\b";
const COMPLETE_EXCLUSION_SOURCE =
  "\\b(?:s(?:a|ä)mtliche|alle)\\s+(?:Ausschl(?:u|ü)sse|Ausschlussbestimmungen)\\b";
const OVERRIDE_ACTION_SOURCE =
  "\\b(?:aufgehoben|gestrichen|au(?:ss|ß)er\\s+Kraft(?:\\s+gesetzt)?|findet\\s+keine\\s+Anwendung|nicht\\s+anzuwenden|ersetzt\\s+durch)\\b";

const PATTERN_FAMILIES = Object.freeze([
  Object.freeze({
    id: "LW20_ITEM_C_EXCLUSION_OVERRIDE_REFERENCE_V2",
    locatorSources: Object.freeze([EXCLUSION_SOURCE, ITEM_C_SOURCE]),
  }),
  Object.freeze({
    id: "LW20_DEFAULT_HEADING_OVERRIDE_REFERENCE_V2",
    locatorSources: Object.freeze([DEFAULT_HEADING_SOURCE]),
  }),
  Object.freeze({
    id: "LW20_COMPLETE_EXCLUSION_BLOCK_OVERRIDE_V2",
    locatorSources: Object.freeze([COMPLETE_EXCLUSION_SOURCE]),
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
  PATTERN_FAMILIES.map(({ id, locatorSources }) =>
    Object.freeze({
      id,
      locatorSources,
      anchorSource: LW_ANCHOR_SOURCE,
      actionSource: OVERRIDE_ACTION_SOURCE,
      maxStructuralUnitChars: MAX_STRUCTURAL_UNIT_CHARS,
      maxLocatorActionDistance: MAX_LOCATOR_ACTION_DISTANCE,
      allowedUnitTypes: [...ALLOWED_UNIT_TYPES].sort(),
    })
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

function allMatches(text, source) {
  return [...text.matchAll(new RegExp(source, "giu"))].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
    text: match[0],
  }));
}

function spanDistance(left, right) {
  if (left.end < right.start) return right.start - left.end;
  if (right.end < left.start) return left.start - right.end;
  return 0;
}

function negatedOverrideAction(unitText, action) {
  if (/^(?:nicht\s+anzuwenden|findet\s+keine\s+Anwendung)$/iu.test(action.text))
    return false;
  const prefix = unitText.slice(Math.max(0, action.start - 48), action.start);
  return /\b(?:nicht|keinesfalls)\s*$/iu.test(prefix);
}

function matchingFamily(unitText, action) {
  if (negatedOverrideAction(unitText, action)) return null;
  const anchors = allMatches(unitText, LW_ANCHOR_SOURCE);
  if (anchors.length === 0) return null;
  for (const family of PATTERN_FAMILIES) {
    const locatorGroups = family.locatorSources.map((source) =>
      allMatches(unitText, source)
    );
    if (locatorGroups.some((matches) => matches.length === 0)) continue;
    const locators = locatorGroups.map((matches) =>
      [...matches].sort(
        (left, right) => spanDistance(left, action) - spanDistance(right, action)
      )[0]
    );
    if (
      locators.every(
        (locator) =>
          spanDistance(locator, action) <= MAX_LOCATOR_ACTION_DISTANCE
      )
    )
      return { family, anchor: anchors[0], locators };
  }
  return null;
}

function candidateProjection({ page, action, context, match, documentIdentity }) {
  const unitDocumentStart = page.documentStart + context.pageStart;
  const unitDocumentEnd = page.documentStart + context.pageEnd;
  const relativeStarts = [
    match.anchor.start,
    ...match.locators.map(({ start }) => start),
    action.start,
  ];
  const relativeEnds = [
    match.anchor.end,
    ...match.locators.map(({ end }) => end),
    action.end,
  ];
  const matchStart = Math.min(...relativeStarts);
  const matchEnd = Math.max(...relativeEnds);
  const documentStart = unitDocumentStart + matchStart;
  const documentEnd = unitDocumentStart + matchEnd;
  const exactText = context.text.slice(matchStart, matchEnd);
  const projection = {
    familyId: match.family.id,
    physicalPageNumber: page.physicalPageNumber,
    unitType: context.unitType,
    unitDocumentStart,
    unitDocumentEnd,
    unitTextSha256: sha256(context.text),
    documentStart,
    documentEnd,
    exactText,
    exactTextSha256: sha256(exactText),
  };
  const candidateDigestSha256 = domainDigest(
    "LW20_DEFAULT_EXCLUSION_ALIAS_FREE_OVERRIDE_CANDIDATE_V2",
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
    for (const pageAction of allMatches(page.text, OVERRIDE_ACTION_SOURCE)) {
      const context = structuralContext({
        pageText: page.text,
        occurrenceStart: pageAction.start,
        occurrenceEnd: pageAction.end,
        maxChars: MAX_STRUCTURAL_UNIT_CHARS,
        fallbackWordsEachSide: FALLBACK_WORDS_EACH_SIDE,
        followingBoundaryLineStarts: new Set(),
      });
      if (!ALLOWED_UNIT_TYPES.has(context.unitType)) continue;
      const action = {
        ...pageAction,
        start: pageAction.start - context.pageStart,
        end: pageAction.end - context.pageStart,
      };
      const match = matchingFamily(context.text, action);
      if (!match) continue;
      const candidate = candidateProjection({
        page,
        action,
        context,
        match,
        documentIdentity,
      });
      const identity = `${candidate.familyId}\u0000${candidate.documentStart}\u0000${candidate.documentEnd}`;
      if (identities.has(identity)) continue;
      identities.add(identity);
      candidates.push(candidate);
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
 * Scans one complete server-owned document artifact for an alias-free,
 * structure-bound reference that could remove the default LW-20 exclusion.
 * Direct peril wording remains owned by the normal occurrence pipeline. A hit
 * is only a review signal; this contract never decides coverage or equality.
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
        "LW20_OVERRIDE_DOCUMENT_ARTIFACT_V2",
        documentArtifact
      ),
      physicalPagesChecked: exactDocument.pages.length,
      totalPhysicalPages: exactDocument.pages.length,
      pageContentSha256: domainDigest(
        "LW20_OVERRIDE_PAGE_CONTENT_V2",
        exactDocument.pageContent
      ),
      pageMapSha256: domainDigest(
        "LW20_OVERRIDE_PAGE_MAP_V2",
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
      "LW20_DEFAULT_EXCLUSION_ALIAS_FREE_OVERRIDE_CANDIDATE_SET_V2",
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

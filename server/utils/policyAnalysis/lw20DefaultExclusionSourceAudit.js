const crypto = require("crypto");

const LW20_DEFAULT_EXCLUSION_SOURCE_AUDIT_SCHEMA_VERSION = 1;
const LW20_DEFAULT_EXCLUSION_SOURCE_AUDIT_CONTRACT_ID =
  "LW20_DEFAULT_EXCLUSION_SOURCE_AUDIT_V1";
const LW20_DEFAULT_EXCLUSION_SOURCE_DECISION_BASIS =
  "ARTIFACT_BOUND_LW20_DEFAULT_EXCLUSION_ITEM_C";
const LW20_REQUIREMENT_ID = "LW-20";
const LW20_COMPONENT_ID = "ground_seepage_or_retained_water";
const LW_SCOPE_KEY = "LEITUNGSWASSER_INSURANCE";
const DEFAULT_EXCLUSION_HEADING =
  /^Nicht\s+versichert\s+sind\s+Sch(?:a|ä)den\s*,?\s*(?:sofern|so\s+ferne?)\s+nicht\s+anders\s+vereinbart\s*:?$/iu;
const WATER_TERM = /^(?:Grundwasser|Sickerwasser|Stauwasser)$/iu;
const WATER_ITEM =
  /^\s*c\s*[).]\s*(?:durch\s+)?[^;]*(?:Grundwasser|Sickerwasser|Stauwasser)\b/iu;
const ADDITIONAL_CONDITION =
  /\b(?:wenn|falls|soweit|vorausgesetzt|vorbehaltlich|optional|wahlweise|gegen\s+(?:eine?\s+)?(?:Mehrpr(?:a|ä)mie|Mehrbeitrag)|nur\s+bei\s+(?:gesonderter|besonderer|ausdr(?:u|ü)cklicher)\s+Vereinbarung)\b/iu;
const POSITIVE_OVERRIDE =
  /\b(?:mitversichert|eingeschlossen|nicht\s+ausgeschlossen|gilt\s+als\s+versichert|abweichend\b[\s\S]{0,80}\bversichert)\b/iu;

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
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function domainDigest(domain, value) {
  return sha256(`${domain}\u0000${stableStringify(value)}`);
}

function sameJson(left, right) {
  return stableStringify(left) === stableStringify(right);
}

function hasExactKeys(value, keys) {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      sameJson(Object.keys(value).sort(), [...keys].sort())
  );
}

function completeDocument({ document, documentArtifact }) {
  const artifact = documentArtifact?.document;
  const extraction = artifact?.pdfExtraction;
  if (
    documentArtifact?.schemaVersion !== 1 ||
    !String(document?.uuid || "").trim() ||
    !/^[a-f0-9]{64}$/u.test(String(document?.sha256 || "")) ||
    documentArtifact?.fingerprint !== document.sha256 ||
    artifact?.sourceDocumentId !== document.sha256 ||
    extraction?.complete !== true ||
    !Number.isInteger(extraction?.totalPages) ||
    extraction.totalPages < 1 ||
    extraction?.processedPages !== extraction.totalPages ||
    extraction?.pagesWithText !== extraction.totalPages ||
    typeof artifact?.pageContent !== "string" ||
    !Array.isArray(artifact?.pageMap) ||
    artifact.pageMap.length !== extraction.totalPages
  )
    return null;
  const pages = new Map();
  let previousEnd = 0;
  for (const [index, page] of artifact.pageMap.entries()) {
    if (
      page?.pageNumber !== index + 1 ||
      !Number.isInteger(page?.start) ||
      !Number.isInteger(page?.end) ||
      page.start < previousEnd ||
      page.end <= page.start ||
      page.end > artifact.pageContent.length ||
      pages.has(page.pageNumber)
    )
      return null;
    pages.set(page.pageNumber, page);
    previousEnd = page.end;
  }
  return { artifact, extraction, pages };
}

function boundPageHint({ hint, page, pageText, physicalPageNumber, pattern }) {
  if (
    hint?.physicalPageNumber !== physicalPageNumber ||
    !Number.isInteger(hint?.pageStart) ||
    !Number.isInteger(hint?.pageEnd) ||
    hint.pageStart < 0 ||
    hint.pageEnd <= hint.pageStart ||
    hint.pageEnd > page.end - page.start ||
    pageText.slice(hint.pageStart, hint.pageEnd) !== hint.text ||
    !pattern.test(String(hint.text || "").trim())
  )
    return null;
  return {
    pageStart: hint.pageStart,
    pageEnd: hint.pageEnd,
    text: hint.text,
  };
}

function targetItemC({ pageText, candidatePageStart, governorPageEnd }) {
  const markers = [...pageText.matchAll(/(?:^|\n)[ \t]*([a-z])\s*[).]/giu)].map(
    (match) => ({
      label: match[1].toLocaleLowerCase("de-AT"),
      start: match.index + (match[0].startsWith("\n") ? 1 : 0),
    })
  );
  const markerIndex = markers.findIndex(
    ({ label, start }, index) =>
      label === "c" &&
      start >= governorPageEnd &&
      start <= candidatePageStart &&
      (markers[index + 1]?.start ?? pageText.length) > candidatePageStart
  );
  if (markerIndex < 0) return null;
  const start = markers[markerIndex].start;
  const end = markers[markerIndex + 1]?.start ?? pageText.length;
  const text = pageText.slice(start, end).trimEnd();
  if (
    !WATER_ITEM.test(text) ||
    ADDITIONAL_CONDITION.test(text) ||
    POSITIVE_OVERRIDE.test(text)
  )
    return null;
  return { start, end: start + text.length, text };
}

function findWorksheetOccurrence({ requirement, component, candidateId }) {
  if (
    requirement?.id !== LW20_REQUIREMENT_ID ||
    requirement?.scopePolicy !== "GENERAL_REQUIRED" ||
    requirement?.componentSatisfactionPolicy !== "ALL" ||
    component?.id !== LW20_COMPONENT_ID ||
    component?.factRole !== "PERIL" ||
    !Array.isArray(component?.occurrences)
  )
    return null;
  const matches = component.occurrences.filter(
    (occurrence) => occurrence?.candidateId === candidateId
  );
  return matches.length === 1 ? matches[0] : null;
}

function buildLw20DefaultExclusionSourceAudit({
  document,
  documentArtifact,
  requirement,
  component,
  judgement,
  target,
}) {
  if (
    judgement?.requirementId !== LW20_REQUIREMENT_ID ||
    judgement?.componentId !== LW20_COMPONENT_ID ||
    judgement?.evidencePresence !== "FOUND" ||
    judgement?.coverageEffect !== "EXCLUDED" ||
    judgement?.conflictState !== "NONE" ||
    judgement?.selectedScopePicture !== "GENERAL" ||
    !Array.isArray(judgement?.selectedCandidateIds) ||
    judgement.selectedCandidateIds.length !== 1 ||
    !Array.isArray(judgement?.unresolvedCandidateIds) ||
    judgement.unresolvedCandidateIds.length !== 0 ||
    target?.requirementId !== LW20_REQUIREMENT_ID ||
    target?.componentId !== LW20_COMPONENT_ID ||
    target?.factRole !== "PERIL" ||
    !Array.isArray(target?.candidates)
  )
    return null;

  const candidateId = judgement.selectedCandidateIds[0];
  const candidates = target.candidates.filter(
    (candidate) => candidate?.candidateId === candidateId
  );
  const occurrence = findWorksheetOccurrence({
    requirement,
    component,
    candidateId,
  });
  const complete = completeDocument({ document, documentArtifact });
  if (!complete || candidates.length !== 1 || !occurrence) return null;
  const candidate = candidates[0];
  const physicalPageNumber = candidate?.physicalPageNumber;
  const page = complete.pages.get(physicalPageNumber);
  if (!page) return null;
  const pageText = complete.artifact.pageContent.slice(page.start, page.end);
  const exactText = String(candidate?.exactText || "");
  const contextText = String(candidate?.contextText || "");
  const contextDocumentStart = candidate?.contextDocumentStart;
  const contextDocumentEnd = contextDocumentStart + contextText.length;
  const candidatePageStart = candidate?.documentStart - page.start;
  if (
    candidate?.candidateBinding !== "DIRECT" ||
    candidate?.deterministicBindingBasis !==
      "EXPLICIT_NEGATIVE_CLAUSE_GOVERNOR" ||
    !WATER_TERM.test(exactText.trim()) ||
    !Number.isInteger(candidate?.documentStart) ||
    !Number.isInteger(candidate?.documentEnd) ||
    candidate.documentStart < page.start ||
    candidate.documentEnd <= candidate.documentStart ||
    candidate.documentEnd > page.end ||
    complete.artifact.pageContent.slice(
      candidate.documentStart,
      candidate.documentEnd
    ) !== exactText ||
    !Number.isInteger(contextDocumentStart) ||
    !contextText ||
    contextDocumentStart < page.start ||
    contextDocumentEnd > page.end ||
    complete.artifact.pageContent.slice(
      contextDocumentStart,
      contextDocumentEnd
    ) !== contextText ||
    occurrence?.physicalPageNumber !== physicalPageNumber ||
    occurrence?.documentStart !== candidate.documentStart ||
    occurrence?.documentEnd !== candidate.documentEnd ||
    occurrence?.exactText !== exactText ||
    occurrence?.context?.documentStart !== contextDocumentStart ||
    occurrence?.context?.text !== contextText
  )
    return null;

  const governor = boundPageHint({
    hint: occurrence.coverageGovernorHint,
    page,
    pageText,
    physicalPageNumber,
    pattern: DEFAULT_EXCLUSION_HEADING,
  });
  const section = boundPageHint({
    hint: occurrence.sectionScopeHint,
    page,
    pageText,
    physicalPageNumber,
    pattern: /Leitungswasserversicherung/iu,
  });
  if (
    !governor ||
    !section ||
    occurrence.sectionScopeHint?.scopeKey !== LW_SCOPE_KEY ||
    section.pageEnd > governor.pageStart ||
    governor.pageEnd > candidatePageStart
  )
    return null;
  const item = targetItemC({
    pageText,
    candidatePageStart,
    governorPageEnd: governor.pageEnd,
  });
  if (
    !item ||
    candidatePageStart < item.start ||
    candidatePageStart + exactText.length > item.end
  )
    return null;

  const base = {
    schemaVersion: LW20_DEFAULT_EXCLUSION_SOURCE_AUDIT_SCHEMA_VERSION,
    contractId: LW20_DEFAULT_EXCLUSION_SOURCE_AUDIT_CONTRACT_ID,
    requirementId: LW20_REQUIREMENT_ID,
    componentId: LW20_COMPONENT_ID,
    decisionOwner: "SERVER",
    decisionBasis: LW20_DEFAULT_EXCLUSION_SOURCE_DECISION_BASIS,
    document: {
      uuid: document.uuid,
      sha256: document.sha256,
      physicalPageNumber,
      totalPhysicalPages: complete.extraction.totalPages,
      pageDocumentStart: page.start,
      pageDocumentEnd: page.end,
      pageTextSha256: sha256(pageText),
      documentArtifactDigestSha256: domainDigest(
        "LW20_DEFAULT_EXCLUSION_SOURCE_DOCUMENT_ARTIFACT_V1",
        documentArtifact
      ),
    },
    source: {
      candidateId,
      exactText,
      documentStart: candidate.documentStart,
      documentEnd: candidate.documentEnd,
      exactTextSha256: sha256(exactText),
      contextDocumentStart,
      contextDocumentEnd,
      contextTextSha256: sha256(contextText),
      governorPageStart: governor.pageStart,
      governorPageEnd: governor.pageEnd,
      governorTextSha256: sha256(governor.text),
      itemPageStart: item.start,
      itemPageEnd: item.end,
      itemTextSha256: sha256(item.text),
      sectionScopeKey: LW_SCOPE_KEY,
      sectionPageStart: section.pageStart,
      sectionPageEnd: section.pageEnd,
      sectionTextSha256: sha256(section.text),
    },
  };
  return Object.freeze({
    ...base,
    assessmentDigestSha256: domainDigest(
      LW20_DEFAULT_EXCLUSION_SOURCE_AUDIT_CONTRACT_ID,
      base
    ),
  });
}

function validPersistedLw20DefaultExclusionSourceAudit(
  audit,
  { documentUuid, documentSha256, candidateId }
) {
  if (
    !hasExactKeys(audit, [
      "assessmentDigestSha256",
      "componentId",
      "contractId",
      "decisionBasis",
      "decisionOwner",
      "document",
      "requirementId",
      "schemaVersion",
      "source",
    ]) ||
    !hasExactKeys(audit?.document, [
      "documentArtifactDigestSha256",
      "pageDocumentEnd",
      "pageDocumentStart",
      "pageTextSha256",
      "physicalPageNumber",
      "sha256",
      "totalPhysicalPages",
      "uuid",
    ]) ||
    !hasExactKeys(audit?.source, [
      "candidateId",
      "contextDocumentEnd",
      "contextDocumentStart",
      "contextTextSha256",
      "documentEnd",
      "documentStart",
      "exactText",
      "exactTextSha256",
      "governorPageEnd",
      "governorPageStart",
      "governorTextSha256",
      "itemPageEnd",
      "itemPageStart",
      "itemTextSha256",
      "sectionPageEnd",
      "sectionPageStart",
      "sectionScopeKey",
      "sectionTextSha256",
    ]) ||
    audit.schemaVersion !==
      LW20_DEFAULT_EXCLUSION_SOURCE_AUDIT_SCHEMA_VERSION ||
    audit.contractId !== LW20_DEFAULT_EXCLUSION_SOURCE_AUDIT_CONTRACT_ID ||
    audit.requirementId !== LW20_REQUIREMENT_ID ||
    audit.componentId !== LW20_COMPONENT_ID ||
    audit.decisionOwner !== "SERVER" ||
    audit.decisionBasis !== LW20_DEFAULT_EXCLUSION_SOURCE_DECISION_BASIS ||
    audit.document.uuid !== documentUuid ||
    audit.document.sha256 !== documentSha256 ||
    audit.source.candidateId !== candidateId ||
    audit.source.sectionScopeKey !== LW_SCOPE_KEY ||
    !WATER_TERM.test(String(audit.source.exactText || "").trim()) ||
    ![
      audit.assessmentDigestSha256,
      audit.document.documentArtifactDigestSha256,
      audit.document.pageTextSha256,
      audit.source.exactTextSha256,
      audit.source.contextTextSha256,
      audit.source.governorTextSha256,
      audit.source.itemTextSha256,
      audit.source.sectionTextSha256,
    ].every((digest) => /^[a-f0-9]{64}$/u.test(String(digest || ""))) ||
    audit.source.exactTextSha256 !== sha256(audit.source.exactText) ||
    !Number.isInteger(audit.document.physicalPageNumber) ||
    audit.document.physicalPageNumber < 1 ||
    !Number.isInteger(audit.document.totalPhysicalPages) ||
    audit.document.totalPhysicalPages < audit.document.physicalPageNumber ||
    !Number.isInteger(audit.document.pageDocumentStart) ||
    !Number.isInteger(audit.document.pageDocumentEnd) ||
    audit.document.pageDocumentStart < 0 ||
    audit.document.pageDocumentEnd <= audit.document.pageDocumentStart ||
    !Number.isInteger(audit.source.documentStart) ||
    !Number.isInteger(audit.source.documentEnd) ||
    audit.source.documentEnd <= audit.source.documentStart ||
    audit.source.documentStart - audit.document.pageDocumentStart <
      audit.source.itemPageStart ||
    audit.source.documentEnd - audit.document.pageDocumentStart >
      audit.source.itemPageEnd ||
    !Number.isInteger(audit.source.contextDocumentStart) ||
    !Number.isInteger(audit.source.contextDocumentEnd) ||
    audit.source.contextDocumentStart > audit.source.documentStart ||
    audit.source.contextDocumentEnd < audit.source.documentEnd ||
    !Number.isInteger(audit.source.governorPageStart) ||
    !Number.isInteger(audit.source.governorPageEnd) ||
    audit.source.governorPageEnd <= audit.source.governorPageStart ||
    audit.source.sectionPageEnd > audit.source.governorPageStart ||
    audit.source.governorPageEnd > audit.source.itemPageStart ||
    !Number.isInteger(audit.source.itemPageStart) ||
    !Number.isInteger(audit.source.itemPageEnd) ||
    audit.source.itemPageEnd <= audit.source.itemPageStart ||
    !Number.isInteger(audit.source.sectionPageStart) ||
    !Number.isInteger(audit.source.sectionPageEnd) ||
    audit.source.sectionPageEnd <= audit.source.sectionPageStart
  )
    return false;
  const { assessmentDigestSha256, ...base } = audit;
  return (
    assessmentDigestSha256 ===
    domainDigest(LW20_DEFAULT_EXCLUSION_SOURCE_AUDIT_CONTRACT_ID, base)
  );
}

module.exports = {
  LW20_DEFAULT_EXCLUSION_SOURCE_AUDIT_CONTRACT_ID,
  LW20_DEFAULT_EXCLUSION_SOURCE_AUDIT_SCHEMA_VERSION,
  LW20_DEFAULT_EXCLUSION_SOURCE_DECISION_BASIS,
  buildLw20DefaultExclusionSourceAudit,
  validPersistedLw20DefaultExclusionSourceAudit,
};

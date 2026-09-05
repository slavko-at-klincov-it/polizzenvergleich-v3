const crypto = require("crypto");

const VS22_SOURCE_BOUND_LOCAL_NARROW_CONTINUATION_SCHEMA_VERSION = 1;
const VS22_SOURCE_BOUND_LOCAL_NARROW_CONTINUATION_CONTRACT_ID =
  "VS22_SOURCE_BOUND_LOCAL_NARROW_CONTINUATION_V1";
const VS22_REQUIREMENT_ID = "VS-22";
const VS22_COMPONENT_ID = "hazardous_waste";
const VS22_SCOPE_PICTURE = "GENERAL_AND_NARROW";
const DIRECT_BINDING = "DIRECT";
const NARROW_BINDING = "NARROW_SCOPE";
const DIRECT_BASIS = "EXPLICIT_HAZARDOUS_WASTE_COSTS";
const ASSERTION =
  "LOCAL_POSITIVE_NARROW_CONTINUATION_OF_GENERAL_HAZARDOUS_WASTE_CLAUSE";
const SHA256 = /^[a-f0-9]{64}$/u;
const PAGE_BRIDGE = /^\s*(?:\[DOCUMENT_PAGE\s+(\d+)\]\s*)?$/u;
const LOCAL_NARROW_SUBJECT =
  /\b(?:gef[aä]hrlich(?:e[mnrs]?|em)|sonder)\s*(?:abfall|m[uü]ll)\b/iu;
const LOCAL_NARROW_CAUSE =
  /\bdurch\s+(?:das\s+)?(?:eindringen|vermischen)\b[\s\S]*\bversicherter\s+sachen\b[\s\S]*\b(?:erdreich|wasser|luft)\b/iu;
const LOCAL_NARROW_INCLUDED = /\bgilt\s+als\s+mitversichert\b/iu;
const LOCAL_NARROW_DISALLOWED =
  /\b(?:optional|wahlweise|gegen\s+(?:mehr)?pr[aä]mie|nur\s+bei\s+(?:gesonderter|besonderer|ausdr[uü]cklicher)\s+vereinbarung|nicht\s+mitversichert|ausgeschlossen|haftpflicht|lager(?:ung|kosten))\b/iu;
const PREDECESSOR_END =
  /\b(?:behandlung|beseitigung|entsorgung)\s+von\s+(?:sonderm[uü]ll|sonderabfall|gef[aä]hrlichem\s+abfall)\s*,\s*$/iu;
const PREDECESSOR_TOPIC =
  /\b(?:kosten|aufwendungen|behandlung|beseitigung|entsorgung)\b[\s\S]*\b(?:sonderm[uü]ll|sonderabfall|gef[aä]hrlich(?:e[mnrs]?|em)\s+abfall)\b/iu;
const GENERAL_HAZARDOUS_WASTE_TOPIC =
  /\b(?:sonderm[uü]ll|sonderabfall|gef[aä]hrlich(?:e[mnrs]?|em)\s+abfall)\b/iu;
const GENERAL_DISALLOWED =
  /\b(?:nicht|kein(?:e|er|en|em|es)?|ausgeschlossen|optional|wahlweise|haftpflicht(?:versicherung)?|gegen\s+(?:zuschlag|mehrpr[aä]mie)|nur\s+bei\s+(?:gesonderter|besonderer|ausdr[uü]cklicher)\s+vereinbarung)\b/iu;
const GENERAL_INCLUDED_FORWARD =
  /\b(?:sonderm[uü]ll|sonderabfall|gef[aä]hrlich(?:e[mnrs]?|em)\s+abfall)\b(?:\s*(?:,|und|oder)\s*(?:sonderm[uü]ll|sonderabfall|gef[aä]hrlich(?:e[mnrs]?|em)\s+abfall)){0,3}\s+\b(?:ist|sind|gilt|gelten)\b(?:\s+(?:als|auch|zus[aä]tzlich|vollst[aä]ndig|unmittelbar|mit|auf|erstes|erster|risiko|im|rahmen|unter|den|folgenden|voraussetzungen|bis|zu|einer|einem|der|des)){0,12}\s+\b(?:mitversichert|eingeschlossen|gedeckt)\b/iu;
const GENERAL_INCLUDED_REVERSE =
  /\b(?:mitversichert|eingeschlossen|gedeckt)\b(?:\s+(?:ist|sind))?\s*:\s*(?:der|die|das|den|dem|des)?\s*(?:kosten\s+f[uü]r\s+)?\b(?:sonderm[uü]ll|sonderabfall|gef[aä]hrlich(?:e[mnrs]?|em)\s+abfall)\b/iu;

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

function sameJson(left, right) {
  return stableStringify(left) === stableStringify(right);
}

function sha256Text(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function domainDigest(domain, value) {
  return sha256Text(`${domain}\u0000${stableStringify(value)}`);
}

function sortedUniqueStrings(values) {
  if (!Array.isArray(values)) return null;
  const normalized = values.map((value) => String(value || ""));
  if (normalized.some((value) => !value)) return null;
  const result = [...new Set(normalized)].sort();
  return result.length === normalized.length ? result : null;
}

function exactSortedStrings(values) {
  const sorted = sortedUniqueStrings(values);
  return Boolean(sorted && sameJson(values, sorted));
}

function validRange(start, end, upperBound) {
  return Boolean(
    Number.isInteger(start) &&
      Number.isInteger(end) &&
      start >= 0 &&
      end > start &&
      end <= upperBound
  );
}

function completeArtifact(documentArtifact, documentFingerprint) {
  const artifact = documentArtifact?.document;
  const extraction = artifact?.pdfExtraction;
  if (
    documentArtifact?.schemaVersion !== 1 ||
    !SHA256.test(String(documentFingerprint || "")) ||
    documentArtifact?.fingerprint !== documentFingerprint ||
    artifact?.sourceDocumentId !== documentFingerprint ||
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
      !validRange(page?.start, page?.end, artifact.pageContent.length) ||
      page.start < previousEnd ||
      pages.has(page.pageNumber)
    )
      return null;
    pages.set(page.pageNumber, {
      pageNumber: page.pageNumber,
      start: page.start,
      end: page.end,
    });
    previousEnd = page.end;
  }
  return { artifact, pages };
}

function pageForRange(pages, start, end) {
  const matches = [...pages.values()].filter(
    (page) => start >= page.start && end <= page.end
  );
  return matches.length === 1 ? matches[0] : null;
}

function candidateContext(candidate, pageContent) {
  const text = String(candidate?.contextText || "");
  const start = candidate?.contextDocumentStart;
  const end = start + text.length;
  if (
    !text ||
    !validRange(start, end, pageContent.length) ||
    pageContent.slice(start, end) !== text
  )
    return null;
  return { start, end, text };
}

function locallyBindsVs22HazardousWasteInclusion(text) {
  const clauses = String(text || "")
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .split(/[.!?;]+/u)
    .map((clause) => clause.replace(/\s+/gu, " ").trim())
    .filter(Boolean);
  return clauses.some(
    (clause) =>
      clause.length <= 640 &&
      GENERAL_HAZARDOUS_WASTE_TOPIC.test(clause) &&
      (GENERAL_INCLUDED_FORWARD.test(clause) ||
        GENERAL_INCLUDED_REVERSE.test(clause)) &&
      !GENERAL_DISALLOWED.test(clause)
  );
}

function sourceProjection(source) {
  return {
    candidateId: source?.candidateId || null,
    physicalPageNumber: source?.physicalPageNumber ?? null,
    candidateIdentityPageNumber: source?.candidateIdentityPageNumber ?? null,
    documentFingerprint: source?.documentFingerprint || null,
    documentStart: source?.documentStart ?? null,
    documentEnd: source?.documentEnd ?? null,
    exactTextSha256: source?.exactTextSha256 || null,
    conditionCheckDocumentStart:
      source?.conditionCheckDocumentStart ?? null,
    conditionCheckDocumentEnd: source?.conditionCheckDocumentEnd ?? null,
    conditionCheckTextSha256: source?.conditionCheckTextSha256 || null,
    candidateBinding: source?.candidateBinding || null,
    deterministicBindingBasis: source?.deterministicBindingBasis || null,
    comparisonScopeKey: source?.comparisonScopeKey || null,
  };
}

function sourceSetDigest(sources) {
  const projections = (sources || [])
    .map(sourceProjection)
    .sort((left, right) => left.candidateId.localeCompare(right.candidateId));
  return domainDigest(
    `${VS22_SOURCE_BOUND_LOCAL_NARROW_CONTINUATION_CONTRACT_ID}:ATOM_SOURCES`,
    projections
  );
}

function exactCandidateSource({ candidate, source, complete, fingerprint }) {
  const { artifact, pages } = complete;
  const exactText = String(candidate?.exactText || "");
  const context = candidateContext(candidate, artifact.pageContent);
  const page = pageForRange(
    pages,
    candidate?.documentStart,
    candidate?.documentEnd
  );
  if (
    !candidate?.candidateId ||
    !exactText ||
    !validRange(
      candidate?.documentStart,
      candidate?.documentEnd,
      artifact.pageContent.length
    ) ||
    artifact.pageContent.slice(
      candidate.documentStart,
      candidate.documentEnd
    ) !== exactText ||
    !context ||
    !page ||
    context.start < page.start ||
    context.end > page.end ||
    candidate?.physicalPageNumber !== page.pageNumber ||
    source?.candidateId !== candidate.candidateId ||
    source?.physicalPageNumber !== page.pageNumber ||
    source?.candidateIdentityPageNumber !== page.pageNumber ||
    source?.documentFingerprint !== fingerprint ||
    source?.documentStart !== candidate.documentStart ||
    source?.documentEnd !== candidate.documentEnd ||
    source?.exactText !== exactText ||
    source?.exactTextSha256 !== sha256Text(exactText) ||
    source?.candidateBinding !== candidate?.candidateBinding ||
    (source?.deterministicBindingBasis || null) !==
      (candidate?.deterministicBindingBasis || null) ||
    (source?.comparisonScopeKey || null) !==
      (candidate?.comparisonScopeKey || null) ||
    !validRange(
      source?.conditionCheckDocumentStart,
      source?.conditionCheckDocumentEnd,
      artifact.pageContent.length
    ) ||
    source.conditionCheckDocumentStart > candidate.documentStart ||
    source.conditionCheckDocumentEnd < candidate.documentEnd ||
    source.conditionCheckDocumentStart < context.start ||
    source.conditionCheckDocumentEnd > context.end ||
    artifact.pageContent.slice(
      source.conditionCheckDocumentStart,
      source.conditionCheckDocumentEnd
    ) !== source?.conditionCheckText ||
    source?.conditionCheckTextSha256 !== sha256Text(source.conditionCheckText)
  )
    return null;
  return { candidate, source, page, context };
}

function localNarrowText(text) {
  const value = String(text || "");
  return Boolean(
    LOCAL_NARROW_SUBJECT.test(value) &&
      LOCAL_NARROW_CAUSE.test(value) &&
      LOCAL_NARROW_INCLUDED.test(value) &&
      !LOCAL_NARROW_DISALLOWED.test(value)
  );
}

function sourceRef(bound) {
  return {
    documentStart: bound.candidate.documentStart,
    documentEnd: bound.candidate.documentEnd,
    sha256: sha256Text(bound.candidate.exactText),
  };
}

function contextRef(bound) {
  return {
    documentStart: bound.context.start,
    documentEnd: bound.context.end,
    sha256: sha256Text(bound.context.text),
  };
}

function buildProofInternal({
  documentArtifact,
  documentFingerprint,
  requirementId,
  componentId,
  selectedScopePicture,
  selectedCandidateIds,
  selectedCandidates,
  sources,
}) {
  if (
    requirementId !== VS22_REQUIREMENT_ID ||
    componentId !== VS22_COMPONENT_ID ||
    selectedScopePicture !== VS22_SCOPE_PICTURE
  )
    return null;
  const selectedIds = sortedUniqueStrings(selectedCandidateIds);
  if (
    !selectedIds ||
    selectedIds.length < 2 ||
    !Array.isArray(selectedCandidates) ||
    !Array.isArray(sources) ||
    selectedCandidates.length !== selectedIds.length ||
    sources.length !== selectedIds.length
  )
    return null;
  const candidateIds = sortedUniqueStrings(
    selectedCandidates.map(({ candidateId }) => candidateId)
  );
  const sourceIds = sortedUniqueStrings(
    sources.map(({ candidateId }) => candidateId)
  );
  if (!sameJson(selectedIds, candidateIds) || !sameJson(selectedIds, sourceIds))
    return null;
  const complete = completeArtifact(documentArtifact, documentFingerprint);
  if (!complete) return null;
  const sourcesById = new Map(
    sources.map((source) => [source.candidateId, source])
  );
  const bound = selectedCandidates
    .map((candidate) =>
      exactCandidateSource({
        candidate,
        source: sourcesById.get(candidate.candidateId),
        complete,
        fingerprint: documentFingerprint,
      })
    )
    .filter(Boolean);
  if (bound.length !== selectedCandidates.length) return null;

  const directs = bound.filter(
    ({ candidate }) => candidate.candidateBinding === DIRECT_BINDING
  );
  const narrows = bound.filter(
    ({ candidate }) => candidate.candidateBinding === NARROW_BINDING
  );
  if (
    directs.length === 0 ||
    narrows.length !== 1 ||
    directs.length + narrows.length !== bound.length ||
    directs.some(
      ({ candidate }) =>
        candidate.deterministicBindingBasis !== DIRECT_BASIS
    )
  )
    return null;
  const continuation = narrows[0];
  if (
    continuation.candidate.deterministicBindingBasis ||
    continuation.candidate.comparisonScopeKey ||
    !LOCAL_NARROW_SUBJECT.test(continuation.candidate.exactText) ||
    !localNarrowText(continuation.context.text)
  )
    return null;
  const previousPage = complete.pages.get(continuation.page.pageNumber - 1);
  if (
    !previousPage ||
    continuation.context.start !== continuation.page.start
  )
    return null;
  const eligiblePredecessors = directs.filter(
    ({ page, context }) =>
      page.pageNumber === previousPage.pageNumber &&
      context.end === previousPage.end
  );
  if (eligiblePredecessors.length === 0) return null;
  const maximumEnd = Math.max(
    ...eligiblePredecessors.map(({ candidate }) => candidate.documentEnd)
  );
  const nearest = eligiblePredecessors.filter(
    ({ candidate }) => candidate.documentEnd === maximumEnd
  );
  if (nearest.length !== 1) return null;
  const predecessor = nearest[0];
  if (
    !PREDECESSOR_END.test(predecessor.context.text) ||
    !PREDECESSOR_TOPIC.test(predecessor.context.text)
  )
    return null;
  const positiveGeneral = directs.filter(
    ({ candidate, source }) =>
      candidate.candidateId !== predecessor.candidate.candidateId &&
      locallyBindsVs22HazardousWasteInclusion(source.conditionCheckText)
  );
  if (positiveGeneral.length === 0) return null;
  const bridgeText = complete.artifact.pageContent.slice(
    previousPage.end,
    continuation.page.start
  );
  const bridgeMatch = bridgeText.match(PAGE_BRIDGE);
  if (
    !bridgeMatch ||
    (bridgeMatch[1] && Number(bridgeMatch[1]) !== continuation.page.pageNumber)
  )
    return null;

  const proofWithoutDigest = {
    schemaVersion:
      VS22_SOURCE_BOUND_LOCAL_NARROW_CONTINUATION_SCHEMA_VERSION,
    contractId: VS22_SOURCE_BOUND_LOCAL_NARROW_CONTINUATION_CONTRACT_ID,
    requirementId: VS22_REQUIREMENT_ID,
    componentId: VS22_COMPONENT_ID,
    documentFingerprint,
    selectedScopePicture: VS22_SCOPE_PICTURE,
    selectedCandidateIds: selectedIds,
    atomSourceSetDigestSha256: sourceSetDigest(sources),
    directGeneralCandidateIds: directs
      .map(({ candidate }) => candidate.candidateId)
      .sort(),
    positiveGeneralCandidateIds: positiveGeneral
      .map(({ candidate }) => candidate.candidateId)
      .sort(),
    continuation: {
      predecessorCandidateId: predecessor.candidate.candidateId,
      continuationCandidateId: continuation.candidate.candidateId,
      fromPhysicalPageNumber: predecessor.page.pageNumber,
      toPhysicalPageNumber: continuation.page.pageNumber,
      predecessorSource: sourceRef(predecessor),
      continuationSource: sourceRef(continuation),
      predecessorContext: contextRef(predecessor),
      continuationContext: contextRef(continuation),
      previousPage,
      nextPage: continuation.page,
      bridge: {
        documentStart: previousPage.end,
        documentEnd: continuation.page.start,
        sha256: sha256Text(bridgeText),
      },
      assertion: ASSERTION,
    },
  };
  return {
    ...proofWithoutDigest,
    proofDigestSha256: domainDigest(
      VS22_SOURCE_BOUND_LOCAL_NARROW_CONTINUATION_CONTRACT_ID,
      proofWithoutDigest
    ),
  };
}

function buildVs22LocalNarrowContinuationProof(context) {
  try {
    return buildProofInternal(context || {});
  } catch (_error) {
    return null;
  }
}

function validProofShape(proof) {
  if (
    proof?.schemaVersion !==
      VS22_SOURCE_BOUND_LOCAL_NARROW_CONTINUATION_SCHEMA_VERSION ||
    proof?.contractId !==
      VS22_SOURCE_BOUND_LOCAL_NARROW_CONTINUATION_CONTRACT_ID ||
    proof?.requirementId !== VS22_REQUIREMENT_ID ||
    proof?.componentId !== VS22_COMPONENT_ID ||
    proof?.selectedScopePicture !== VS22_SCOPE_PICTURE ||
    !SHA256.test(String(proof?.documentFingerprint || "")) ||
    !SHA256.test(String(proof?.atomSourceSetDigestSha256 || "")) ||
    !SHA256.test(String(proof?.proofDigestSha256 || "")) ||
    !exactSortedStrings(proof?.selectedCandidateIds) ||
    !exactSortedStrings(proof?.directGeneralCandidateIds) ||
    !exactSortedStrings(proof?.positiveGeneralCandidateIds) ||
    proof.directGeneralCandidateIds.length < 1 ||
    proof.positiveGeneralCandidateIds.length < 1 ||
    proof.positiveGeneralCandidateIds.some(
      (candidateId) => !proof.directGeneralCandidateIds.includes(candidateId)
    ) ||
    proof.selectedCandidateIds.length !==
      proof.directGeneralCandidateIds.length + 1
  )
    return false;
  const continuation = proof?.continuation;
  const refs = [
    continuation?.predecessorSource,
    continuation?.continuationSource,
    continuation?.predecessorContext,
    continuation?.continuationContext,
    continuation?.bridge,
  ];
  if (
    continuation?.assertion !== ASSERTION ||
    !proof.directGeneralCandidateIds.includes(
      continuation?.predecessorCandidateId
    ) ||
    proof.positiveGeneralCandidateIds.includes(
      continuation?.predecessorCandidateId
    ) ||
    proof.directGeneralCandidateIds.includes(
      continuation?.continuationCandidateId
    ) ||
    !proof.selectedCandidateIds.includes(
      continuation?.continuationCandidateId
    ) ||
    continuation?.fromPhysicalPageNumber + 1 !==
      continuation?.toPhysicalPageNumber ||
    refs.some(
      (ref) =>
        !validRange(
          ref?.documentStart,
          ref?.documentEnd,
          Number.MAX_SAFE_INTEGER
        ) ||
        !SHA256.test(String(ref?.sha256 || ""))
    ) ||
    continuation?.previousPage?.pageNumber !==
      continuation.fromPhysicalPageNumber ||
    continuation?.nextPage?.pageNumber !== continuation.toPhysicalPageNumber ||
    continuation?.previousPage?.end !== continuation.bridge.documentStart ||
    continuation?.nextPage?.start !== continuation.bridge.documentEnd ||
    continuation?.predecessorContext?.documentEnd !==
      continuation.previousPage.end ||
    continuation?.continuationContext?.documentStart !==
      continuation.nextPage.start
  )
    return false;
  const withoutDigest = { ...proof };
  delete withoutDigest.proofDigestSha256;
  return (
    proof.proofDigestSha256 ===
    domainDigest(
      VS22_SOURCE_BOUND_LOCAL_NARROW_CONTINUATION_CONTRACT_ID,
      withoutDigest
    )
  );
}

function atomMatchesProof(atom, proof) {
  if (
    atom?.requirementId !== VS22_REQUIREMENT_ID ||
    atom?.componentId !== VS22_COMPONENT_ID ||
    atom?.selectedScopePicture !== VS22_SCOPE_PICTURE ||
    !sameJson(
      sortedUniqueStrings(atom?.selectedCandidateIds),
      proof.selectedCandidateIds
    ) ||
    !Array.isArray(atom?.sources) ||
    atom.sources.length !== proof.selectedCandidateIds.length ||
    sourceSetDigest(atom.sources) !== proof.atomSourceSetDigestSha256
  )
    return false;
  const sourceIds = sortedUniqueStrings(
    atom.sources.map(({ candidateId }) => candidateId)
  );
  if (!sameJson(sourceIds, proof.selectedCandidateIds)) return false;
  return atom.sources.every(
    (source) =>
      source?.documentFingerprint === proof.documentFingerprint &&
      validRange(
        source?.documentStart,
        source?.documentEnd,
        Number.MAX_SAFE_INTEGER
      ) &&
      source?.exactTextSha256 === sha256Text(source?.exactText) &&
      validRange(
        source?.conditionCheckDocumentStart,
        source?.conditionCheckDocumentEnd,
        Number.MAX_SAFE_INTEGER
      ) &&
      source.conditionCheckDocumentStart <= source.documentStart &&
      source.conditionCheckDocumentEnd >= source.documentEnd &&
      source?.conditionCheckTextSha256 === sha256Text(source?.conditionCheckText)
  );
}

function validateVs22LocalNarrowContinuationProof(proof, context = {}) {
  try {
    if (!validProofShape(proof)) return false;
    if (context?.atom && !atomMatchesProof(context.atom, proof)) return false;
    const hasBuildContext = [
      "documentArtifact",
      "documentFingerprint",
      "requirementId",
      "componentId",
      "selectedScopePicture",
      "selectedCandidateIds",
      "selectedCandidates",
      "sources",
    ].some((key) => Object.prototype.hasOwnProperty.call(context, key));
    if (hasBuildContext) {
      const rebuilt = buildProofInternal(context);
      if (!rebuilt || !sameJson(rebuilt, proof)) return false;
    }
    return true;
  } catch (_error) {
    return false;
  }
}

module.exports = {
  VS22_SOURCE_BOUND_LOCAL_NARROW_CONTINUATION_SCHEMA_VERSION,
  VS22_SOURCE_BOUND_LOCAL_NARROW_CONTINUATION_CONTRACT_ID,
  buildVs22LocalNarrowContinuationProof,
  locallyBindsVs22HazardousWasteInclusion,
  validateVs22LocalNarrowContinuationProof,
};

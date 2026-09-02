const ALLOWED_CANDIDATE_BINDINGS = new Set(["DIRECT", "NARROW_SCOPE"]);

function sourceError(code, detail = "") {
  const error = new Error(detail ? `${code}: ${detail}` : code);
  error.code = code;
  return error;
}

function requiredText(value, code, detail = "") {
  const text = String(value || "").trim();
  if (!text) throw sourceError(code, detail);
  return text;
}

function requiredSourceText(value, code, detail) {
  if (typeof value !== "string" || !value.trim())
    throw sourceError(code, detail);
  return value;
}

function documentPages(documentArtifact) {
  const document = documentArtifact?.document;
  if (
    documentArtifact?.schemaVersion !== 1 ||
    document?.pdfExtraction?.complete !== true ||
    typeof document?.pageContent !== "string" ||
    !Array.isArray(document?.pageMap) ||
    document.pageMap.length === 0
  )
    throw sourceError("TARGETED_SOURCES_DOCUMENT_ARTIFACT_INVALID");

  const pages = new Map();
  for (const page of document.pageMap) {
    if (
      !Number.isInteger(page?.pageNumber) ||
      page.pageNumber < 1 ||
      !Number.isInteger(page.start) ||
      !Number.isInteger(page.end) ||
      page.start < 0 ||
      page.end <= page.start ||
      page.end > document.pageContent.length
    )
      throw sourceError(
        "TARGETED_SOURCES_DOCUMENT_PAGE_INVALID",
        String(page?.pageNumber || "page")
      );
    if (pages.has(page.pageNumber))
      throw sourceError(
        "TARGETED_SOURCES_DOCUMENT_PAGE_DUPLICATE",
        String(page.pageNumber)
      );
    pages.set(page.pageNumber, page);
  }
  return { document, pages };
}

function indexTargets(targets) {
  if (!Array.isArray(targets))
    throw sourceError("TARGETED_SOURCES_TARGETS_INVALID");

  const targetById = new Map();
  const candidateById = new Map();
  for (const target of targets) {
    const targetId = requiredText(
      target?.targetId,
      "TARGETED_SOURCES_TARGET_ID_REQUIRED"
    );
    const requirementId = requiredText(
      target?.requirementId,
      "TARGETED_SOURCES_REQUIREMENT_ID_REQUIRED",
      targetId
    );
    const componentId = requiredText(
      target?.componentId,
      "TARGETED_SOURCES_COMPONENT_ID_REQUIRED",
      targetId
    );
    if (targetById.has(targetId))
      throw sourceError("TARGETED_SOURCES_TARGET_DUPLICATE", targetId);
    if (!Array.isArray(target.candidates))
      throw sourceError("TARGETED_SOURCES_CANDIDATES_INVALID", targetId);
    const indexedTarget = { target, targetId, requirementId, componentId };
    targetById.set(targetId, indexedTarget);

    for (const candidate of target.candidates) {
      const candidateId = requiredText(
        candidate?.candidateId,
        "TARGETED_SOURCES_CANDIDATE_ID_REQUIRED",
        targetId
      );
      if (candidateById.has(candidateId))
        throw sourceError(
          "TARGETED_SOURCES_CANDIDATE_OWNERSHIP_DUPLICATE",
          candidateId
        );
      candidateById.set(candidateId, { ...indexedTarget, candidate });
    }
  }
  return { targetById, candidateById };
}

function validateSelectedCandidate({ indexed, document, pages }) {
  const { candidate } = indexed;
  const candidateId = candidate.candidateId;
  const physicalPageNumber = candidate.physicalPageNumber;
  const page = pages.get(physicalPageNumber);
  if (!Number.isInteger(physicalPageNumber) || !page)
    throw sourceError("TARGETED_SOURCES_PHYSICAL_PAGE_INVALID", candidateId);

  const documentStart = candidate.documentStart;
  const documentEnd = candidate.documentEnd;
  const exactText = requiredSourceText(
    candidate.exactText,
    "TARGETED_SOURCES_EXACT_TEXT_REQUIRED",
    candidateId
  );
  if (
    !Number.isInteger(documentStart) ||
    !Number.isInteger(documentEnd) ||
    documentStart < page.start ||
    documentEnd <= documentStart ||
    documentEnd > page.end ||
    document.pageContent.slice(documentStart, documentEnd) !== exactText
  )
    throw sourceError("TARGETED_SOURCES_EXACT_RANGE_INVALID", candidateId);

  const contextText = requiredSourceText(
    candidate.contextText,
    "TARGETED_SOURCES_CONTEXT_TEXT_REQUIRED",
    candidateId
  );
  const contextDocumentStart = candidate.contextDocumentStart;
  const contextDocumentEnd = contextDocumentStart + contextText.length;
  if (
    !Number.isInteger(contextDocumentStart) ||
    contextDocumentStart < page.start ||
    contextDocumentEnd > page.end ||
    document.pageContent.slice(contextDocumentStart, contextDocumentEnd) !==
      contextText
  )
    throw sourceError("TARGETED_SOURCES_CONTEXT_RANGE_INVALID", candidateId);

  const candidateBinding = candidate.candidateBinding || null;
  if (
    candidateBinding !== null &&
    !ALLOWED_CANDIDATE_BINDINGS.has(candidateBinding)
  )
    throw sourceError("TARGETED_SOURCES_BINDING_INVALID", candidateId);
  if (
    candidate.printedPageLabel !== null &&
    candidate.printedPageLabel !== undefined &&
    typeof candidate.printedPageLabel !== "string"
  )
    throw sourceError(
      "TARGETED_SOURCES_PRINTED_PAGE_LABEL_INVALID",
      candidateId
    );

  return Object.freeze({
    requirementId: indexed.requirementId,
    componentId: indexed.componentId,
    candidateId,
    candidateBinding,
    physicalPageNumber,
    printedPageLabel: candidate.printedPageLabel || null,
    exactText,
    contextText,
    contextDocumentStart,
  });
}

/**
 * Reconstructs the selected-sources artifact exclusively from validated,
 * server-owned prepared targets. The materialized evidence may select opaque
 * candidate IDs, but it cannot author ownership, text, pages or offsets.
 * Role: QA boundary. Side effects: none.
 */
function rebuildTargetedSelectedSources({
  targets,
  materializedEvidence,
  documentArtifact,
}) {
  const { document, pages } = documentPages(documentArtifact);
  const { targetById, candidateById } = indexTargets(targets);
  if (!Array.isArray(materializedEvidence?.judgements))
    throw sourceError("TARGETED_SOURCES_JUDGEMENTS_INVALID");

  const judgementTargetIds = new Set();
  const selectedCandidateIds = new Set();
  const sources = [];
  for (const judgement of materializedEvidence.judgements) {
    const targetId = requiredText(
      judgement?.targetId,
      "TARGETED_SOURCES_JUDGEMENT_TARGET_ID_REQUIRED"
    );
    const indexedTarget = targetById.get(targetId);
    if (!indexedTarget)
      throw sourceError("TARGETED_SOURCES_JUDGEMENT_TARGET_UNKNOWN", targetId);
    if (judgementTargetIds.has(targetId))
      throw sourceError(
        "TARGETED_SOURCES_JUDGEMENT_TARGET_DUPLICATE",
        targetId
      );
    judgementTargetIds.add(targetId);
    if (
      judgement.requirementId !== indexedTarget.requirementId ||
      judgement.componentId !== indexedTarget.componentId
    )
      throw sourceError(
        "TARGETED_SOURCES_JUDGEMENT_OWNERSHIP_INVALID",
        targetId
      );
    if (!Array.isArray(judgement.selectedCandidateIds))
      throw sourceError("TARGETED_SOURCES_SELECTED_IDS_INVALID", targetId);

    for (const candidateId of judgement.selectedCandidateIds) {
      const indexed = candidateById.get(candidateId);
      if (!indexed)
        throw sourceError("TARGETED_SOURCES_SELECTED_ID_UNKNOWN", candidateId);
      if (selectedCandidateIds.has(candidateId))
        throw sourceError(
          "TARGETED_SOURCES_SELECTED_ID_DUPLICATE",
          candidateId
        );
      if (indexed.targetId !== targetId)
        throw sourceError(
          "TARGETED_SOURCES_SELECTED_ID_WRONG_TARGET",
          candidateId
        );
      selectedCandidateIds.add(candidateId);
      sources.push(validateSelectedCandidate({ indexed, document, pages }));
    }
  }

  const missingTargetIds = [...targetById.keys()].filter(
    (targetId) => !judgementTargetIds.has(targetId)
  );
  if (missingTargetIds.length)
    throw sourceError(
      "TARGETED_SOURCES_JUDGEMENT_TARGET_MISSING",
      missingTargetIds.join(",")
    );
  return Object.freeze(sources);
}

module.exports = {
  rebuildTargetedSelectedSources,
};

const crypto = require("crypto");
const {
  validNestedListContinuationProof,
} = require("./controlledOccurrenceWorksheet");
const {
  validSourceBoundObjectScopeProof,
} = require("./objectScopeEvidenceContract");
const {
  validSourceBoundObjectMembershipProof,
} = require("./objectMembershipEvidenceContract");

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

function privateCopy(value) {
  return JSON.parse(JSON.stringify(value));
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

function candidateCarriesObjectScopeProvenance(candidate) {
  return Boolean(
    candidate &&
      (Object.prototype.hasOwnProperty.call(candidate, "objectScopeProof") ||
        Object.prototype.hasOwnProperty.call(
          candidate,
          "nestedListContinuationProof"
        ))
  );
}

function candidateCarriesObjectMembershipProvenance(candidate) {
  return Boolean(
    candidate &&
      Object.prototype.hasOwnProperty.call(candidate, "objectMembershipProof")
  );
}

function worksheetDocumentMatchesArtifact(worksheet, documentArtifact) {
  const worksheetDocument = worksheet?.document;
  const document = documentArtifact.document;
  const expectedBoundaries = document.pageMap.map(
    ({ pageNumber, start, end }) => ({
      physicalPageNumber: pageNumber,
      documentStart: start,
      documentEnd: end,
    })
  );
  return Boolean(
    worksheet?.candidateOnly === true &&
      documentArtifact.fingerprint === document.sourceDocumentId &&
      worksheetDocument?.fingerprint === documentArtifact.fingerprint &&
      worksheetDocument?.sourceDocumentId === document.sourceDocumentId &&
      worksheetDocument?.physicalPages === document.pageMap.length &&
      worksheetDocument?.pageContentLength === document.pageContent.length &&
      worksheetDocument?.pageContentSha256 ===
        crypto
          .createHash("sha256")
          .update(document.pageContent)
          .digest("hex") &&
      canonicalEqual(worksheetDocument?.pageBoundaries, expectedBoundaries)
  );
}

function indexWorksheetProvenance({ worksheet, documentArtifact, targets }) {
  const targetHasProvenance = targets.some((target) =>
    (target.candidates || []).some(
      (candidate) =>
        candidateCarriesObjectScopeProvenance(candidate) ||
        candidateCarriesObjectMembershipProvenance(candidate)
    )
  );
  if (!worksheet && !targetHasProvenance) return null;
  if (
    !worksheet ||
    !Array.isArray(worksheet.requirements) ||
    !worksheetDocumentMatchesArtifact(worksheet, documentArtifact)
  )
    throw sourceError("TARGETED_SOURCES_PROVENANCE_WORKSHEET_INVALID");

  const componentByKey = new Map();
  for (const requirement of worksheet.requirements || [])
    for (const component of requirement.components || []) {
      const key = `${requirement.id}:${component.id}`;
      if (componentByKey.has(key))
        throw sourceError(
          "TARGETED_SOURCES_PROVENANCE_COMPONENT_DUPLICATE",
          key
        );
      const occurrenceById = new Map();
      for (const occurrence of component.occurrences || []) {
        const candidateId = requiredText(
          occurrence?.candidateId,
          "TARGETED_SOURCES_PROVENANCE_OCCURRENCE_ID_REQUIRED",
          key
        );
        if (occurrenceById.has(candidateId))
          throw sourceError(
            "TARGETED_SOURCES_PROVENANCE_OCCURRENCE_DUPLICATE",
            candidateId
          );
        occurrenceById.set(candidateId, occurrence);
      }
      componentByKey.set(key, { component, occurrenceById });
    }

  for (const target of targets)
    for (const candidate of target.candidates || []) {
      const key = `${target.requirementId}:${target.componentId}`;
      const indexedComponent = componentByKey.get(key);
      const occurrence = indexedComponent?.occurrenceById.get(
        candidate.candidateId
      );
      if (!occurrence)
        throw sourceError(
          "TARGETED_SOURCES_PROVENANCE_OWNERSHIP_INVALID",
          candidate.candidateId
        );
      const candidateHasObjectProof = Object.prototype.hasOwnProperty.call(
        candidate,
        "objectScopeProof"
      );
      const occurrenceHasObjectProof = Object.prototype.hasOwnProperty.call(
        occurrence,
        "objectScopeProof"
      );
      if (
        (candidateHasObjectProof || occurrenceHasObjectProof) &&
        !indexedComponent.component.objectScopeEvidenceContract
      )
        throw sourceError(
          "TARGETED_SOURCES_PROVENANCE_COMPONENT_CONTRACT_MISSING",
          candidate.candidateId
        );
      const candidateHasParentProof = Object.prototype.hasOwnProperty.call(
        candidate,
        "nestedListContinuationProof"
      );
      const occurrenceObjectProofNeedsParent = Boolean(
        occurrence.objectScopeProof?.assertions?.some(
          ({ sourceKind }) => sourceKind === "NESTED_LIST_CONTINUATION"
        )
      );
      if (
        candidateHasObjectProof !== occurrenceHasObjectProof ||
        candidateHasParentProof !== occurrenceObjectProofNeedsParent
      )
        throw sourceError(
          "TARGETED_SOURCES_PROVENANCE_PRESENCE_MISMATCH",
          candidate.candidateId
        );
      const candidateHasMembershipProof =
        candidateCarriesObjectMembershipProvenance(candidate);
      const occurrenceHasMembershipProof =
        candidateCarriesObjectMembershipProvenance(occurrence);
      if (
        candidateHasMembershipProof !== occurrenceHasMembershipProof ||
        (candidateHasMembershipProof &&
          !Array.isArray(
            indexedComponent.component.objectMembershipEvidenceContracts
          ))
      )
        throw sourceError(
          "TARGETED_SOURCES_PROVENANCE_MEMBERSHIP_PRESENCE_MISMATCH",
          candidate.candidateId
        );
    }
  return componentByKey;
}

function selectedObjectMembershipProvenance({
  indexed,
  worksheetComponents,
  documentArtifact,
}) {
  const { candidate, requirementId, componentId } = indexed;
  if (!candidateCarriesObjectMembershipProvenance(candidate)) return {};
  const candidateId = candidate.candidateId;
  const indexedComponent = worksheetComponents?.get(
    `${requirementId}:${componentId}`
  );
  const component = indexedComponent?.component;
  const occurrence = indexedComponent?.occurrenceById.get(candidateId);
  if (
    !occurrence?.objectMembershipProof ||
    !canonicalEqual(
      candidate.objectMembershipProof,
      occurrence.objectMembershipProof
    )
  )
    throw sourceError(
      "TARGETED_SOURCES_PROVENANCE_MEMBERSHIP_PROOF_INVALID",
      candidateId
    );
  const matchingContracts = (
    component?.objectMembershipEvidenceContracts || []
  ).filter((contract) =>
    validSourceBoundObjectMembershipProof({
      contract,
      occurrence,
      documentArtifact,
    })
  );
  if (matchingContracts.length !== 1)
    throw sourceError(
      "TARGETED_SOURCES_PROVENANCE_MEMBERSHIP_PROOF_INVALID",
      candidateId
    );
  return {
    objectMembershipProof: privateCopy(occurrence.objectMembershipProof),
  };
}

function validateProofMatchesDocument({ proof, document, pages, candidateId }) {
  for (const assertion of proof.assertions || [])
    for (const match of assertion.matches || []) {
      const page = pages.get(match.physicalPageNumber);
      if (
        !page ||
        !Number.isInteger(match.documentStart) ||
        !Number.isInteger(match.documentEnd) ||
        match.documentStart < page.start ||
        match.documentEnd <= match.documentStart ||
        match.documentEnd > page.end ||
        document.pageContent.slice(match.documentStart, match.documentEnd) !==
          match.exactText ||
        crypto.createHash("sha256").update(match.exactText).digest("hex") !==
          match.sha256
      )
        throw sourceError(
          "TARGETED_SOURCES_PROVENANCE_MATCH_INVALID",
          candidateId
        );
    }
}

function selectedObjectScopeProvenance({
  indexed,
  worksheetComponents,
  document,
  pages,
}) {
  const { candidate, requirementId, componentId } = indexed;
  if (!candidateCarriesObjectScopeProvenance(candidate)) return {};
  const candidateId = candidate.candidateId;
  const indexedComponent = worksheetComponents?.get(
    `${requirementId}:${componentId}`
  );
  const component = indexedComponent?.component;
  const occurrence = indexedComponent?.occurrenceById.get(candidateId);
  if (
    !component?.objectScopeEvidenceContract ||
    !occurrence?.objectScopeProof ||
    !canonicalEqual(candidate.objectScopeProof, occurrence.objectScopeProof)
  )
    throw sourceError(
      "TARGETED_SOURCES_PROVENANCE_OBJECT_PROOF_INVALID",
      candidateId
    );

  const nestedRequired = occurrence.objectScopeProof.assertions?.some(
    ({ sourceKind }) => sourceKind === "NESTED_LIST_CONTINUATION"
  );
  if (
    Boolean(candidate.nestedListContinuationProof) !==
      Boolean(nestedRequired) ||
    (nestedRequired &&
      (!canonicalEqual(
        candidate.nestedListContinuationProof,
        occurrence.nestedListContinuationProof
      ) ||
        !validNestedListContinuationProof(
          occurrence,
          document.pageContent,
          document.pageMap
        )))
  )
    throw sourceError(
      "TARGETED_SOURCES_PROVENANCE_PARENT_PROOF_INVALID",
      candidateId
    );
  if (
    !validSourceBoundObjectScopeProof({
      contract: component.objectScopeEvidenceContract,
      occurrence,
      nestedListContinuationValidated: Boolean(nestedRequired),
    })
  )
    throw sourceError(
      "TARGETED_SOURCES_PROVENANCE_OBJECT_PROOF_INVALID",
      candidateId
    );
  validateProofMatchesDocument({
    proof: occurrence.objectScopeProof,
    document,
    pages,
    candidateId,
  });
  return {
    objectScopeProof: privateCopy(occurrence.objectScopeProof),
    ...(nestedRequired
      ? {
          nestedListContinuationProof: privateCopy(
            occurrence.nestedListContinuationProof
          ),
        }
      : {}),
  };
}

function validateSelectedCandidate({
  indexed,
  document,
  pages,
  worksheetComponents,
}) {
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
    ...selectedObjectScopeProvenance({
      indexed,
      worksheetComponents,
      document,
      pages,
    }),
    ...selectedObjectMembershipProvenance({
      indexed,
      worksheetComponents,
      documentArtifact: {
        schemaVersion: 1,
        fingerprint: document.sourceDocumentId,
        document,
      },
    }),
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
  worksheet,
}) {
  const { document, pages } = documentPages(documentArtifact);
  const { targetById, candidateById } = indexTargets(targets);
  const worksheetComponents = indexWorksheetProvenance({
    worksheet,
    documentArtifact,
    targets,
  });
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
      sources.push(
        validateSelectedCandidate({
          indexed,
          document,
          pages,
          worksheetComponents,
        })
      );
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

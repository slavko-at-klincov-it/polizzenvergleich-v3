const BINDING_GROUP_FIELD_APPLICABILITY_CONTRACT_ID =
  "DECLARED_BINDING_GROUP_FIELD_APPLICABILITY_V1";
const SAME_CANDIDATE_BINDING = "SAME_CANDIDATE_BINDING";
const VALID_GROUP_TYPES = new Set([
  "SHARED_GOVERNOR",
  "SHARED_SPAN",
  "RIGHT_HEADED_COORDINATION",
]);

function strings(values) {
  return [...new Set((values || []).map(String).filter(Boolean))].sort();
}

function memberFor(candidateId, indexed) {
  const occurrence = indexed?.occurrence;
  const context = occurrence?.context;
  const physicalPageNumber = Number(
    occurrence?.physicalPageNumber || occurrence?.pageNumber
  );
  if (
    !indexed ||
    !String(indexed?.component?.id || "").trim() ||
    !Number.isInteger(physicalPageNumber) ||
    physicalPageNumber <= 0 ||
    !Number.isInteger(context?.documentStart) ||
    !Number.isInteger(context?.documentEnd) ||
    context.documentEnd <= context.documentStart ||
    context.documentEnd !== context.documentStart + String(context.text).length
  )
    return null;
  return {
    candidateId,
    componentId: indexed.component.id,
    physicalPageNumber,
    contextDocumentStart: context.documentStart,
    contextDocumentEnd: context.documentEnd,
  };
}

function buildBindingGroupFieldApplicability({
  group,
  candidateById,
  sourceCandidateId,
  fact,
}) {
  if (
    !group ||
    !String(group.id || "").startsWith("binding-group:") ||
    !String(group.requirementId || "").trim() ||
    !VALID_GROUP_TYPES.has(group.type) ||
    group.constraint !== SAME_CANDIDATE_BINDING ||
    !Array.isArray(group.candidateIds) ||
    strings(group.candidateIds).length !== group.candidateIds.length ||
    group.candidateIds.length < 2 ||
    !group.candidateIds.includes(sourceCandidateId) ||
    fact?.source?.candidateId !== sourceCandidateId
  )
    return null;
  const members = strings(group.candidateIds).map((candidateId) => {
    const indexed = candidateById.get(candidateId);
    if (
      indexed?.requirement?.id !== group.requirementId ||
      indexed?.occurrence?.bindingGroupId !== group.id
    )
      return null;
    return memberFor(candidateId, indexed);
  });
  if (
    members.some((member) => member === null) ||
    new Set(members.map(({ componentId }) => componentId)).size < 2
  )
    return null;
  const source = members.find(
    ({ candidateId }) => candidateId === sourceCandidateId
  );
  const fieldStart = Number(fact?.source?.documentStart);
  const fieldEnd = Number(fact?.source?.documentEnd);
  if (
    !source ||
    !Number.isInteger(fieldStart) ||
    !Number.isInteger(fieldEnd) ||
    fieldEnd <= fieldStart ||
    fact.source.physicalPageNumber !== source.physicalPageNumber ||
    members.some(
      (member) =>
        member.physicalPageNumber !== source.physicalPageNumber ||
        fieldStart < member.contextDocumentStart ||
        fieldEnd > member.contextDocumentEnd
    )
  )
    return null;
  return {
    schemaVersion: 1,
    contractId: BINDING_GROUP_FIELD_APPLICABILITY_CONTRACT_ID,
    bindingGroupId: group.id,
    requirementId: group.requirementId,
    type: group.type,
    constraint: group.constraint,
    sourceCandidateId,
    members,
  };
}

function projectedFieldFactAppliesToAtom({
  fact,
  requirementId,
  componentId,
  selectedCandidateIds,
}) {
  const selected = new Set(selectedCandidateIds || []);
  if (selected.has(fact?.source?.candidateId)) return true;
  const applicability = fact?.bindingGroupFieldApplicability;
  if (
    applicability?.schemaVersion !== 1 ||
    applicability?.contractId !==
      BINDING_GROUP_FIELD_APPLICABILITY_CONTRACT_ID ||
    !String(applicability?.bindingGroupId || "").startsWith("binding-group:") ||
    applicability?.requirementId !== requirementId ||
    !VALID_GROUP_TYPES.has(applicability?.type) ||
    applicability?.constraint !== SAME_CANDIDATE_BINDING ||
    applicability?.sourceCandidateId !== fact?.source?.candidateId ||
    !Array.isArray(applicability?.members) ||
    applicability.members.length < 2 ||
    strings(applicability.members.map(({ candidateId }) => candidateId))
      .length !== applicability.members.length
  )
    return false;
  const source = applicability.members.find(
    ({ candidateId }) => candidateId === applicability.sourceCandidateId
  );
  const fieldStart = Number(fact?.source?.documentStart);
  const fieldEnd = Number(fact?.source?.documentEnd);
  if (
    !source ||
    !Number.isInteger(fieldStart) ||
    !Number.isInteger(fieldEnd) ||
    fieldEnd <= fieldStart ||
    source.physicalPageNumber !== fact.source.physicalPageNumber ||
    fieldStart < source.contextDocumentStart ||
    fieldEnd > source.contextDocumentEnd
  )
    return false;
  return applicability.members.some(
    (member) =>
      member.componentId === componentId &&
      selected.has(member.candidateId) &&
      member.physicalPageNumber === source.physicalPageNumber &&
      fieldStart >= member.contextDocumentStart &&
      fieldEnd <= member.contextDocumentEnd
  );
}

module.exports = {
  BINDING_GROUP_FIELD_APPLICABILITY_CONTRACT_ID,
  buildBindingGroupFieldApplicability,
  projectedFieldFactAppliesToAtom,
};

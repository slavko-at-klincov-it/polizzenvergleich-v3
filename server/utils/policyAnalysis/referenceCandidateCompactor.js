const crypto = require("crypto");

// Compacts retrieval navigation spans without making a semantic decision.
// Inputs: server-owned candidates with document and clause-boundary identity.
// Output: deterministic compact groups preserving every member and channel.
// Side effects: none. Cross-document or cross-clause merges are impossible.
const REFERENCE_CANDIDATE_COMPACTION_CONTRACT_ID =
  "LF_COUNTERPART_COMPACT_CANDIDATES_V1";

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function compactionError(code, detail) {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  return error;
}

function validateCandidate(candidate, documentsByUuid) {
  if (
    !candidate ||
    typeof candidate.candidateId !== "string" ||
    !candidate.candidateId ||
    typeof candidate.documentUuid !== "string" ||
    !candidate.documentUuid ||
    typeof candidate.documentSha256 !== "string" ||
    !/^[a-f0-9]{64}$/u.test(candidate.documentSha256) ||
    typeof candidate.clauseBoundaryId !== "string" ||
    !candidate.clauseBoundaryId ||
    !Number.isInteger(candidate.documentStart) ||
    !Number.isInteger(candidate.documentEnd) ||
    candidate.documentEnd <= candidate.documentStart ||
    typeof candidate.exactText !== "string" ||
    !candidate.exactText ||
    !Number.isInteger(candidate.physicalPageNumber) ||
    !Array.isArray(candidate.channels) ||
    candidate.channels.length === 0
  )
    throw compactionError("LF_COUNTERPART_CANDIDATE_INVALID");
  const document = documentsByUuid.get(candidate.documentUuid);
  const page = document?.pageMap?.find(
    ({ pageNumber }) => pageNumber === candidate.physicalPageNumber
  );
  const clauseBoundary = document?.clauseBoundaries?.find(
    ({ clauseBoundaryId }) => clauseBoundaryId === candidate.clauseBoundaryId
  );
  if (
    !document ||
    document.sha256 !== candidate.documentSha256 ||
    typeof document.pageContent !== "string" ||
    document.pageContentSha256 !== sha256(document.pageContent) ||
    !page ||
    !clauseBoundary ||
    candidate.documentStart < page.start ||
    candidate.documentEnd > page.end ||
    candidate.documentStart < clauseBoundary.documentStart ||
    candidate.documentEnd > clauseBoundary.documentEnd ||
    document.pageContent.slice(
      candidate.documentStart,
      candidate.documentEnd
    ) !== candidate.exactText ||
    (candidate.exactTextSha256 &&
      candidate.exactTextSha256 !== sha256(candidate.exactText))
  )
    throw compactionError("LF_COUNTERPART_CANDIDATE_SOURCE_INVALID");
  return candidate;
}

function groupKey(candidate) {
  return [
    candidate.documentUuid,
    candidate.documentSha256,
    candidate.clauseBoundaryId,
  ].join(":");
}

function compactReferenceCandidates(
  candidates,
  { documents, maximumGap = 1 } = {}
) {
  if (
    !Array.isArray(candidates) ||
    !Array.isArray(documents) ||
    !Number.isInteger(maximumGap) ||
    maximumGap < 0
  )
    throw compactionError("LF_COUNTERPART_COMPACTION_INPUT_INVALID");
  const documentsByUuid = new Map();
  for (const document of documents) {
    if (
      typeof document?.uuid !== "string" ||
      !document.uuid ||
      documentsByUuid.has(document.uuid) ||
      !/^[a-f0-9]{64}$/u.test(String(document.sha256 || "")) ||
      typeof document.pageContent !== "string" ||
      !/^[a-f0-9]{64}$/u.test(String(document.pageContentSha256 || "")) ||
      !Array.isArray(document.pageMap) ||
      !Array.isArray(document.clauseBoundaries)
    )
      throw compactionError("LF_COUNTERPART_SOURCE_DOCUMENT_INVALID");
    documentsByUuid.set(document.uuid, document);
  }
  const ids = new Set();
  const grouped = new Map();
  for (const item of candidates) {
    const candidate = validateCandidate(item, documentsByUuid);
    if (ids.has(candidate.candidateId))
      throw compactionError(
        "LF_COUNTERPART_CANDIDATE_ID_DUPLICATE",
        candidate.candidateId
      );
    ids.add(candidate.candidateId);
    const key = groupKey(candidate);
    const list = grouped.get(key) || [];
    list.push(candidate);
    grouped.set(key, list);
  }

  const compacted = [];
  for (const [key, group] of [...grouped.entries()].sort(([left], [right]) =>
    left.localeCompare(right)
  )) {
    const ordered = [...group].sort(
      (left, right) =>
        left.documentStart - right.documentStart ||
        left.documentEnd - right.documentEnd ||
        left.candidateId.localeCompare(right.candidateId)
    );
    let active = null;
    const flush = () => {
      if (!active) return;
      const first = active.members[0];
      const last = active.members[active.members.length - 1];
      const memberIds = active.members.map(({ candidateId }) => candidateId);
      compacted.push({
        compactCandidateId: `CC-${sha256(
          `${REFERENCE_CANDIDATE_COMPACTION_CONTRACT_ID}:${key}:${memberIds.join(
            ","
          )}`
        ).slice(0, 24)}`,
        documentUuid: first.documentUuid,
        documentSha256: first.documentSha256,
        clauseBoundaryId: first.clauseBoundaryId,
        documentStart: Math.min(
          ...active.members.map(({ documentStart }) => documentStart)
        ),
        documentEnd: Math.max(
          ...active.members.map(({ documentEnd }) => documentEnd)
        ),
        physicalPages: [
          ...new Set(
            active.members.flatMap(
              ({ physicalPages = [], physicalPageNumber }) =>
                physicalPages.length ? physicalPages : [physicalPageNumber]
            )
          ),
        ].filter(Number.isInteger),
        memberCandidateIds: memberIds,
        channels: [
          ...new Set(active.members.flatMap(({ channels }) => channels)),
        ].sort(),
        sourceSpans: active.members.map(
          ({
            candidateId,
            documentStart,
            documentEnd,
            exactText,
            physicalPageNumber,
            physicalPages,
            channels,
          }) => ({
            candidateId,
            documentStart,
            documentEnd,
            exactText,
            exactTextSha256: sha256(exactText),
            ...(Number.isInteger(physicalPageNumber)
              ? { physicalPageNumber }
              : {}),
            ...(Array.isArray(physicalPages) ? { physicalPages } : {}),
            channels: [...channels].sort(),
          })
        ),
        firstCandidateId: first.candidateId,
        lastCandidateId: last.candidateId,
        semanticDecision: null,
      });
      active = null;
    };
    for (const candidate of ordered) {
      if (
        active &&
        candidate.documentStart <= active.documentEnd + maximumGap
      ) {
        active.members.push(candidate);
        active.documentEnd = Math.max(
          active.documentEnd,
          candidate.documentEnd
        );
      } else {
        flush();
        active = {
          documentEnd: candidate.documentEnd,
          members: [candidate],
        };
      }
    }
    flush();
  }
  return {
    schemaVersion: 1,
    contractId: REFERENCE_CANDIDATE_COMPACTION_CONTRACT_ID,
    inputCandidates: candidates.length,
    compactCandidates: compacted,
  };
}

module.exports = {
  REFERENCE_CANDIDATE_COMPACTION_CONTRACT_ID,
  compactReferenceCandidates,
};

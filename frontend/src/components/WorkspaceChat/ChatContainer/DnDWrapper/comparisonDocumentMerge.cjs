const transientStatuses = new Set(["reading", "indexing", "deleting"]);
const comparisonDocumentLimit = 2;
const statusPriority = {
  reading: 0,
  indexing: 1,
  failed: 2,
  deleting: 3,
  ready: 4,
};

function normalizedId(value) {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

function comparisonDocumentIdentity(item = {}) {
  const document = item.document || item;
  return {
    comparisonDocumentId: normalizedId(
      item.comparisonDocumentId ?? document.comparisonDocumentId ?? document.id
    ),
    fileId: normalizedId(
      item.fileId ??
        item.parsedFileId ??
        document.fileId ??
        document.parsedFileId
    ),
  };
}

function identitiesMatch(left, right) {
  const a = comparisonDocumentIdentity(left);
  const b = comparisonDocumentIdentity(right);
  return Boolean(
    (a.comparisonDocumentId &&
      a.comparisonDocumentId === b.comparisonDocumentId) ||
      (a.fileId && a.fileId === b.fileId)
  );
}

function dedupeComparisonDocuments(documents = []) {
  return documents.reduce((deduped, candidate) => {
    const duplicateIndex = deduped.findIndex((item) =>
      identitiesMatch(item, candidate)
    );
    if (duplicateIndex < 0) return [...deduped, candidate];

    const existing = deduped[duplicateIndex];
    if (
      (statusPriority[candidate.status] ?? -1) >
      (statusPriority[existing.status] ?? -1)
    )
      deduped[duplicateIndex] = candidate;
    return deduped;
  }, []);
}

function availableComparisonSlots(documents = [], reserved = 0) {
  const occupied = documents.filter(
    (item) => item.type === "comparison_document"
  ).length;
  return Math.max(0, comparisonDocumentLimit - occupied - reserved);
}

async function deleteParsedComparisonSource({
  workspaceSlug,
  threadSlug,
  parsedFileId,
  deleteParsedComparisonFile,
  deleteParsedFiles,
}) {
  if (!parsedFileId) return { success: true, error: null };
  try {
    const success = deleteParsedComparisonFile
      ? await deleteParsedComparisonFile(
          workspaceSlug,
          threadSlug,
          parsedFileId
        )
      : await deleteParsedFiles(workspaceSlug, [parsedFileId]);
    return success
      ? { success: true, error: null }
      : {
          success: false,
          error:
            "Die temporären Dokumentdaten konnten nicht entfernt werden. Bitte erneut versuchen.",
        };
  } catch (error) {
    return {
      success: false,
      error:
        error.message ||
        "Die temporären Dokumentdaten konnten nicht entfernt werden.",
    };
  }
}

function mergeHydratedComparisonDocuments(previous = [], hydrated = []) {
  const promptAttachments = previous.filter(
    (item) => item.type === "attachment"
  );
  const current = previous.filter(
    (item) => item.type === "comparison_document"
  );
  const remoteDocuments = dedupeComparisonDocuments(hydrated).slice(
    0,
    comparisonDocumentLimit
  );
  const consumedLocalIndexes = new Set();

  const mergedRemoteDocuments = remoteDocuments.map((remote) => {
    const localIndex = current.findIndex(
      (local, index) =>
        !consumedLocalIndexes.has(index) && identitiesMatch(local, remote)
    );
    if (localIndex < 0) return remote;
    consumedLocalIndexes.add(localIndex);
    const local = current[localIndex];
    return {
      ...remote,
      uid: local.uid,
      file: local.file || remote.file,
    };
  });

  const localOnly = current.filter((item) => {
    if (remoteDocuments.some((remote) => identitiesMatch(item, remote)))
      return false;
    return (
      transientStatuses.has(item.status) ||
      (item.status === "failed" && !item.document?.id)
    );
  });

  const availableLocalSlots = Math.max(
    0,
    comparisonDocumentLimit - mergedRemoteDocuments.length
  );
  return [
    ...promptAttachments,
    ...dedupeComparisonDocuments(localOnly).slice(0, availableLocalSlots),
    ...mergedRemoteDocuments,
  ];
}

function comparisonDocumentAttachment(document = {}, uid = null) {
  const filename =
    document.originalFilename ||
    document.name ||
    document.filename ||
    document.title ||
    "Dokument";
  const persistedStatus = ["indexing", "ready", "deleting", "failed"].includes(
    document.status
  )
    ? document.status
    : "ready";
  const inventoryStatus = document.inventoryStatus ?? null;
  const fileId = document.fileId ?? document.parsedFileId ?? null;
  return {
    uid: uid || `comparison-document-${document.id}`,
    file: { name: filename, type: document.mimeType || "" },
    contentString: null,
    status: persistedStatus,
    error: document.error ?? null,
    document,
    inventoryStatus,
    comparisonDocumentId: document.id ?? null,
    fileId,
    tokenCountEstimate:
      document.tokenCountEstimate ?? document.tokenCount ?? null,
    modelTokenCount: document.modelTokenCount ?? document.tokenCount ?? null,
    modelTokenLabel: document.modelTokenLabel ?? "Modell",
    qwenTokenCount: document.qwenTokenCount ?? null,
    parsedFileId: fileId,
    pageCount: document.pageCount ?? document.pages ?? null,
    type: "comparison_document",
  };
}

// eslint-disable-next-line no-undef
module.exports = {
  availableComparisonSlots,
  comparisonDocumentAttachment,
  comparisonDocumentIdentity,
  deleteParsedComparisonSource,
  dedupeComparisonDocuments,
  identitiesMatch,
  mergeHydratedComparisonDocuments,
};

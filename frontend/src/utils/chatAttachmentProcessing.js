export const ACTIVE_DOCUMENT_UPLOAD_STATUSES = new Set(["reading", "indexing"]);

/**
 * Counts only non-image document uploads that are still being parsed or
 * indexed. The result is the single source of truth for the chat send lock.
 */
export function countActiveDocumentUploads(files = []) {
  return files.filter(
    (file) =>
      file?.type === "upload" &&
      ACTIVE_DOCUMENT_UPLOAD_STATUSES.has(file?.status)
  ).length;
}

/**
 * Reads the absolute pending count emitted by the uploader. The fallback keeps
 * compatibility with older emitters that sent events without details.
 */
export function nextAttachmentProcessingCount(
  currentCount,
  event,
  fallbackDelta
) {
  const pendingCount = Number(event?.detail?.pendingCount);
  if (Number.isInteger(pendingCount) && pendingCount >= 0) return pendingCount;
  return Math.max(0, currentCount + fallbackDelta);
}

/**
 * Combines all parsed parts that belong to one dropped document. Exact model
 * counts are only reported when every part was counted by the same tokenizer.
 */
export function summarizeParsedDocumentTokens(parsedFiles = []) {
  const parts = parsedFiles
    .map((file) => {
      const exact =
        file?.documentTokenCountKind === "exact_model" &&
        Number.isFinite(file?.documentTokenCount);
      const count = exact
        ? file.documentTokenCount
        : Number.isFinite(file?.tokenCountEstimate)
          ? file.tokenCountEstimate
          : null;
      if (count === null) return null;
      return {
        count,
        kind: exact ? "exact_model" : "estimated",
        label: exact ? file.documentTokenLabel || "model" : null,
      };
    })
    .filter(Boolean);

  if (!parts.length) return null;
  const exactLabels = new Set(parts.map((part) => part.label).filter(Boolean));
  const allExact =
    parts.length === parsedFiles.length &&
    parts.every((part) => part.kind === "exact_model") &&
    exactLabels.size === 1;

  return {
    count: parts.reduce((sum, part) => sum + part.count, 0),
    kind: allExact ? "exact_model" : "estimated",
    label: allExact ? parts[0].label : null,
  };
}

export function formatDocumentTokenCount(
  tokenSummary,
  locale,
  labels = {
    exact: "document tokens",
    estimated: "approx. {{count}} document tokens",
  }
) {
  if (!Number.isFinite(tokenSummary?.count)) return null;
  const formattedCount = new Intl.NumberFormat(locale).format(
    tokenSummary.count
  );
  if (tokenSummary.kind === "exact_model") {
    return `${formattedCount} ${labels.exact} (${tokenSummary.label || "model"})`;
  }
  return `${labels.estimated.replace("{{count}}", formattedCount)}`;
}

/**
 * Embeds every parsed part of one dropped document. If only part of the batch
 * commits, already committed parts are rolled back so the UI never represents
 * a partial document as ready.
 */
export async function embedParsedDocumentParts({
  parsedFiles,
  embed,
  rollback,
}) {
  const settled = await Promise.allSettled(
    parsedFiles.map((file) => embed(file.id))
  );
  const committedDocuments = [];
  const failedIndexes = [];
  let firstError = null;

  settled.forEach((result, index) => {
    const value = result.status === "fulfilled" ? result.value : null;
    const document = value?.data?.document;
    const location = document?.location || document?.docpath;
    const committed =
      result.status === "fulfilled" &&
      value?.response?.ok &&
      value?.data?.success &&
      document &&
      location;
    if (committed) {
      committedDocuments.push(document);
      return;
    }

    failedIndexes.push(index);
    firstError ||=
      result.status === "rejected"
        ? result.reason?.message
        : value?.data?.error || "Document indexing failed";
  });

  if (!failedIndexes.length) {
    return {
      success: true,
      documents: committedDocuments,
      remainingParsedFileIds: [],
      error: null,
    };
  }

  await Promise.allSettled(
    committedDocuments.map((document) =>
      rollback(document.location || document.docpath)
    )
  );
  return {
    success: false,
    documents: [],
    remainingParsedFileIds: failedIndexes.map((index) => parsedFiles[index].id),
    error: firstError || "Document indexing failed",
  };
}

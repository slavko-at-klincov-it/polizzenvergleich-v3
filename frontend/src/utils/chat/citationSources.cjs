/* global module */

function omitChunkHeader(text = "") {
  if (typeof text !== "string" || !text.includes("<document_metadata>"))
    return text;
  return text
    .split("</document_metadata>")
    .slice(1)
    .join("</document_metadata>")
    .trim();
}

function sourceGroupKey(source = {}) {
  if (source.docId) return `doc:${source.docId}`;
  if (source.sourceDocumentId)
    return `source-document:${source.sourceDocumentId}`;
  return `legacy-title:${source.title || "Unknown document"}`;
}

function sourcePageNumbers(source = {}) {
  return [
    ...new Set(
      (source.chunks || [])
        .map(({ pageNumber }) => Number(pageNumber))
        .filter((pageNumber) => Number.isInteger(pageNumber) && pageNumber > 0)
    ),
  ].sort((left, right) => left - right);
}

function combineLikeSources(sources = []) {
  const combined = new Map();
  for (const source of Array.isArray(sources) ? sources : []) {
    const groupKey = sourceGroupKey(source);
    const chunk = {
      id: source.id,
      text: source.text,
      chunkSource: source.chunkSource || "",
      score: source.score ?? null,
      docId: source.docId || null,
      sourceDocumentId: source.sourceDocumentId || null,
      pageNumber: Number.isInteger(Number(source.pageNumber))
        ? Number(source.pageNumber)
        : 0,
      chunkIndex: Number.isInteger(Number(source.chunkIndex))
        ? Number(source.chunkIndex)
        : null,
      pageChunkIndex: Number.isInteger(Number(source.pageChunkIndex))
        ? Number(source.pageChunkIndex)
        : null,
    };

    if (combined.has(groupKey)) {
      const existing = combined.get(groupKey);
      existing.chunks.push(chunk);
      existing.references += 1;
      continue;
    }

    combined.set(groupKey, {
      groupKey,
      title: source.title || "Unknown document",
      docId: source.docId || null,
      sourceDocumentId: source.sourceDocumentId || null,
      chunkSource: source.chunkSource || "",
      chunks: [chunk],
      references: 1,
    });
  }

  return [...combined.values()];
}

module.exports = {
  combineLikeSources,
  omitChunkHeader,
  sourceGroupKey,
  sourcePageNumbers,
};

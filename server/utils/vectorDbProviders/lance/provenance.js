const PROVENANCE_SCHEMA_VERSION = 1;
const REQUIRED_LANCE_PROVENANCE_COLUMNS = [
  "provenanceSchemaVersion",
  "docId",
  "sourceDocumentId",
  "title",
  "pageNumber",
  "chunkIndex",
  "pageChunkIndex",
];

function schemaFieldNames(schema) {
  const fields = Array.isArray(schema?.fields) ? schema.fields : [];
  return new Set(fields.map((field) => field?.name).filter(Boolean));
}

function missingLanceProvenanceColumns(schema) {
  const names = schemaFieldNames(schema);
  return REQUIRED_LANCE_PROVENANCE_COLUMNS.filter((name) => !names.has(name));
}

async function assertLanceProvenanceSchema(table) {
  const missing = missingLanceProvenanceColumns(await table.schema());
  if (missing.length > 0)
    throw new Error(
      `LANCE_PROVENANCE_REINDEX_REQUIRED: missing ${missing.join(", ")}`
    );
}

function flattenCachedChunks(chunks) {
  if (!Array.isArray(chunks)) return [];
  return chunks.flatMap((batch) => (Array.isArray(batch) ? batch : []));
}

function validateCachedProvenance({ chunks, isPdf }) {
  const records = flattenCachedChunks(chunks);
  if (records.length === 0) return { valid: false, reason: "empty-cache" };

  for (const record of records) {
    const metadata = record?.metadata;
    if (
      !metadata ||
      metadata.provenanceSchemaVersion !== PROVENANCE_SCHEMA_VERSION
    )
      return { valid: false, reason: "missing-version" };
    if (
      typeof metadata.sourceDocumentId !== "string" ||
      metadata.sourceDocumentId.length === 0 ||
      typeof metadata.title !== "string" ||
      metadata.title.length === 0
    )
      return { valid: false, reason: "missing-document-identity" };
    if (
      !Number.isInteger(metadata.pageNumber) ||
      !Number.isInteger(metadata.chunkIndex) ||
      !Number.isInteger(metadata.pageChunkIndex)
    )
      return { valid: false, reason: "missing-chunk-provenance" };
    if (isPdf ? metadata.pageNumber < 1 : metadata.pageNumber !== 0)
      return { valid: false, reason: "invalid-page-number" };
    if (!Array.isArray(record.values) || record.values.length === 0)
      return { valid: false, reason: "missing-vector" };
  }

  return { valid: true, reason: null };
}

function materializeProvenance({
  metadata = {},
  documentData = {},
  docId,
  isPdf,
}) {
  const pageNumber = isPdf ? metadata.pageNumber : 0;
  return {
    ...metadata,
    provenanceSchemaVersion: PROVENANCE_SCHEMA_VERSION,
    docId: String(docId),
    sourceDocumentId: String(
      documentData.sourceDocumentId || documentData.id || docId
    ),
    title: String(
      documentData.title ||
        documentData.filename ||
        metadata.title ||
        "Unknown document"
    ),
    pageNumber,
    chunkIndex: Number(metadata.chunkIndex),
    pageChunkIndex: Number(metadata.pageChunkIndex),
  };
}

module.exports = {
  PROVENANCE_SCHEMA_VERSION,
  REQUIRED_LANCE_PROVENANCE_COLUMNS,
  assertLanceProvenanceSchema,
  flattenCachedChunks,
  materializeProvenance,
  missingLanceProvenanceColumns,
  validateCachedProvenance,
};

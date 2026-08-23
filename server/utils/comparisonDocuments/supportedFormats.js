const path = require("path");

const COMPARISON_DOCUMENT_FORMATS = Object.freeze({
  ".pdf": ["application/pdf"],
  ".docx": [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/zip",
    "application/x-zip-compressed",
  ],
  ".odt": [
    "application/vnd.oasis.opendocument.text",
    "application/zip",
    "application/x-zip-compressed",
  ],
  ".txt": ["text/plain"],
  ".md": ["text/markdown", "text/x-markdown", "text/plain"],
  ".csv": [
    "text/csv",
    "application/csv",
    "application/vnd.ms-excel",
    "text/plain",
  ],
  ".xlsx": [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/zip",
    "application/x-zip-compressed",
  ],
  ".pptx": [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/zip",
    "application/x-zip-compressed",
  ],
});

const COMPARISON_DOCUMENT_EXTENSIONS = Object.freeze(
  Object.keys(COMPARISON_DOCUMENT_FORMATS)
);

function comparisonDocumentExtension(filename = "") {
  return path.extname(String(filename)).toLowerCase();
}

function isSupportedComparisonDocument({ filename = "", mime = "" } = {}) {
  const extension = comparisonDocumentExtension(filename);
  if (!COMPARISON_DOCUMENT_EXTENSIONS.includes(extension)) return false;
  if (!mime || mime === "application/octet-stream") return true;
  return COMPARISON_DOCUMENT_FORMATS[extension].includes(
    String(mime).toLowerCase()
  );
}

module.exports = {
  COMPARISON_DOCUMENT_FORMATS,
  COMPARISON_DOCUMENT_EXTENSIONS,
  comparisonDocumentExtension,
  isSupportedComparisonDocument,
};

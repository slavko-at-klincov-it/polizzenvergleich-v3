const formatMimes = {
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
};

const supportedExtensions = Object.freeze(Object.keys(formatMimes));

function extensionFor(filename = "") {
  const match = String(filename)
    .toLowerCase()
    .match(/\.[^.]+$/u);
  return match?.[0] || "";
}

function isSupportedComparisonFile(file = {}) {
  const extension = extensionFor(file.name);
  if (!supportedExtensions.includes(extension)) return false;
  const mime = String(file.type || "").toLowerCase();
  if (!mime || mime === "application/octet-stream") return true;
  return formatMimes[extension].includes(mime);
}

// eslint-disable-next-line no-undef
module.exports = {
  formatMimes,
  supportedExtensions,
  isSupportedComparisonFile,
};

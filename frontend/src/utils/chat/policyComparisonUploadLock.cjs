/* global module */

const UNKNOWN_COMPARISON_DOCUMENT_COUNT = -1;

function isNormalChatUploadLocked(comparisonDocumentCount) {
  return comparisonDocumentCount !== 0;
}

module.exports = {
  UNKNOWN_COMPARISON_DOCUMENT_COUNT,
  isNormalChatUploadLocked,
};

/**
 * Returns canonical section scope keys only when the heading is bound to the
 * occurrence page and its persisted text range is self-consistent. Untrusted
 * or incomplete hints deliberately produce no scope proof.
 * Side effects: none. Role: validate.
 */
function sourceBoundSectionScopeKeys(occurrence) {
  const section = occurrence?.sectionScopeHint;
  const occurrencePage = Number(occurrence?.physicalPageNumber);
  const sectionPage = Number(section?.physicalPageNumber);
  const sectionStart = Number(section?.pageStart);
  const sectionEnd = Number(section?.pageEnd);
  const sectionText = String(section?.text || "");
  const keys = [
    ...new Set(
      [section?.scopeKey, ...(section?.scopeKeys || [])]
        .map((key) => String(key || "").trim())
        .filter(Boolean)
    ),
  ].sort();
  const currentPageRelation =
    section?.source === "CURRENT_PAGE_HEADING" &&
    sectionPage === occurrencePage;
  const precedingPageRelation =
    section?.source === "PRECEDING_PAGE_HEADING" &&
    sectionPage < occurrencePage;

  if (
    keys.length === 0 ||
    !keys.includes(String(section?.scopeKey || "").trim()) ||
    !Number.isInteger(occurrencePage) ||
    occurrencePage <= 0 ||
    !Number.isInteger(sectionPage) ||
    sectionPage <= 0 ||
    (!currentPageRelation && !precedingPageRelation) ||
    !Number.isInteger(sectionStart) ||
    sectionStart < 0 ||
    !Number.isInteger(sectionEnd) ||
    sectionEnd - sectionStart !== sectionText.length ||
    sectionText.trim().length === 0
  )
    return [];
  return keys;
}

module.exports = { sourceBoundSectionScopeKeys };

const DEFAULT_THRESHOLDS = Object.freeze({
  minimumCharacters: 24,
  minimumAlphaNumericCharacters: 12,
  minimumAlphaNumericRatio: 0.2,
  maximumReplacementCharacterRatio: 0.02,
  maximumControlCharacterRatio: 0.01,
});

/**
 * Deterministically assesses whether a PDF text layer is useful enough to be
 * trusted without OCR. The result is intentionally advisory: the assembler
 * still records both the native and OCR outcome for auditability.
 *
 * @param {string} text
 * @param {Partial<typeof DEFAULT_THRESHOLDS>} thresholds
 * @returns {{needsOcr:boolean, reason:string|null, metrics:object}}
 */
function assessPageText(text = "", thresholds = {}) {
  const config = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const value = typeof text === "string" ? text.trim() : "";
  const characters = Array.from(value);
  const characterCount = characters.length;
  const alphaNumericCount = (value.match(/[\p{L}\p{N}]/gu) || []).length;
  const replacementCharacterCount = (value.match(/\uFFFD/g) || []).length;
  const controlCharacterCount = characters.filter((character) => {
    const code = character.codePointAt(0);
    return (
      (code >= 0 && code <= 8) ||
      code === 11 ||
      code === 12 ||
      (code >= 14 && code <= 31)
    );
  }).length;
  const denominator = Math.max(characterCount, 1);
  const metrics = {
    characterCount,
    alphaNumericCount,
    alphaNumericRatio: alphaNumericCount / denominator,
    replacementCharacterRatio: replacementCharacterCount / denominator,
    controlCharacterRatio: controlCharacterCount / denominator,
  };

  if (characterCount === 0)
    return { needsOcr: true, reason: "empty_text_layer", metrics };
  if (
    metrics.replacementCharacterRatio > config.maximumReplacementCharacterRatio
  )
    return { needsOcr: true, reason: "replacement_characters", metrics };
  if (metrics.controlCharacterRatio > config.maximumControlCharacterRatio)
    return { needsOcr: true, reason: "control_characters", metrics };
  if (
    characterCount < config.minimumCharacters &&
    alphaNumericCount < config.minimumAlphaNumericCharacters
  )
    return { needsOcr: true, reason: "too_little_text", metrics };
  if (metrics.alphaNumericRatio < config.minimumAlphaNumericRatio)
    return { needsOcr: true, reason: "low_alphanumeric_ratio", metrics };

  return { needsOcr: false, reason: null, metrics };
}

module.exports = { assessPageText, DEFAULT_THRESHOLDS };

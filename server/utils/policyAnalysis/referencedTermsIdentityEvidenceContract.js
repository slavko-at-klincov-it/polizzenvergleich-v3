const crypto = require("crypto");

const SOURCE_BOUND_REFERENCED_TERMS_IDENTITY_EVIDENCE_CONTRACT_ID =
  "SOURCE_BOUND_REFERENCED_TERMS_IDENTITY_EVIDENCE_V1";
const ASSERTION_KIND = "REFERENCED_TERMS_DOCUMENT_IDENTITY";
const MAX_ALIASES = 24;
const MAX_HEADER_DISTANCE = 240;

function identityError(code, detail = "") {
  const error = new Error(detail ? `${code}: ${detail}` : code);
  error.code = code;
  return error;
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonical(value[key])])
  );
}

function digest(value) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
}

function textDigest(value) {
  return crypto
    .createHash("sha256")
    .update(String(value || ""))
    .digest("hex");
}

function normalizedText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("de")
    .replace(/ä/gu, "ae")
    .replace(/ö/gu, "oe")
    .replace(/ü/gu, "ue")
    .replace(/ß/gu, "ss")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function requiredString(value, code, detail) {
  const text = String(value || "").trim();
  if (!text) throw identityError(code, detail);
  return text;
}

function conceptKey(value, detail) {
  const key = requiredString(
    value,
    "TERMS_IDENTITY_CONCEPT_KEY_REQUIRED",
    detail
  );
  if (!/^[A-Z][A-Z0-9_]*$/u.test(key))
    throw identityError("TERMS_IDENTITY_CONCEPT_KEY_INVALID", detail);
  return key;
}

function aliases(values, detail) {
  if (
    !Array.isArray(values) ||
    values.length === 0 ||
    values.length > MAX_ALIASES
  )
    throw identityError("TERMS_IDENTITY_ALIASES_INVALID", detail);
  const result = values.map((value, index) =>
    requiredString(
      value,
      "TERMS_IDENTITY_ALIAS_REQUIRED",
      `${detail}[${index}]`
    )
  );
  const normalized = result.map(normalizedText);
  if (
    normalized.some((value) => value.length < 3) ||
    new Set(normalized).size !== normalized.length
  )
    throw identityError("TERMS_IDENTITY_ALIAS_INVALID", detail);
  return result.sort((left, right) =>
    normalizedText(left).localeCompare(normalizedText(right), "de-AT")
  );
}

function validateReferencedTermsIdentityEvidenceContract(
  contract,
  detail = "requirement"
) {
  const keys = [
    "contractId",
    "referenceFamilyKey",
    "referenceTitleAliases",
    "referenceCodeAliases",
  ];
  if (
    !contract ||
    typeof contract !== "object" ||
    Array.isArray(contract) ||
    JSON.stringify(Object.keys(contract).sort()) !== JSON.stringify(keys.sort())
  )
    throw identityError("TERMS_IDENTITY_CONTRACT_INVALID", detail);
  if (
    contract.contractId !==
    SOURCE_BOUND_REFERENCED_TERMS_IDENTITY_EVIDENCE_CONTRACT_ID
  )
    throw identityError("TERMS_IDENTITY_CONTRACT_ID_INVALID", detail);
  return {
    contractId: SOURCE_BOUND_REFERENCED_TERMS_IDENTITY_EVIDENCE_CONTRACT_ID,
    referenceFamilyKey: conceptKey(
      contract.referenceFamilyKey,
      `${detail}:referenceFamilyKey`
    ),
    referenceTitleAliases: aliases(
      contract.referenceTitleAliases,
      `${detail}:referenceTitleAliases`
    ),
    referenceCodeAliases: aliases(
      contract.referenceCodeAliases,
      `${detail}:referenceCodeAliases`
    ),
  };
}

function transliteratedCharacter(character) {
  const normalized = character.normalize("NFKC").toLocaleLowerCase("de");
  if (normalized === "ä") return "ae";
  if (normalized === "ö") return "oe";
  if (normalized === "ü") return "ue";
  if (normalized === "ß") return "ss";
  return normalized;
}

function normalizeWithOffsets(value) {
  const text = String(value || "");
  const characters = [];
  const offsets = [];
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === "\u00ad") continue;
    if (!/[\p{L}\p{N}]/u.test(character)) {
      if (characters.length > 0 && characters.at(-1) !== " ") {
        characters.push(" ");
        offsets.push(index);
      }
      continue;
    }
    for (const normalizedCharacter of transliteratedCharacter(character)) {
      characters.push(normalizedCharacter);
      offsets.push(index);
    }
  }
  while (characters[0] === " ") {
    characters.shift();
    offsets.shift();
  }
  while (characters.at(-1) === " ") {
    characters.pop();
    offsets.pop();
  }
  return { text: characters.join(""), offsets };
}

function aliasSpans(sourceText, values) {
  const source = normalizeWithOffsets(sourceText);
  const matches = [];
  values.forEach((alias, aliasIndex) => {
    const normalizedAlias = normalizeWithOffsets(alias).text;
    let start = source.text.indexOf(normalizedAlias);
    while (start !== -1) {
      const end = start + normalizedAlias.length;
      const before = source.text[start - 1] || "";
      const after = source.text[end] || "";
      if (!/[\p{L}\p{N}]/u.test(before) && !/[\p{L}\p{N}]/u.test(after))
        matches.push({
          matchedAlias: alias,
          aliasIndex,
          start: source.offsets[start],
          end: source.offsets[end - 1] + 1,
        });
      start = source.text.indexOf(normalizedAlias, start + 1);
    }
  });
  return matches.sort(
    (left, right) =>
      left.start - right.start || left.aliasIndex - right.aliasIndex
  );
}

function documentIdentity(documentArtifact) {
  const document = documentArtifact?.document;
  const extraction = document?.pdfExtraction;
  const pages = document?.pageMap;
  if (
    documentArtifact?.schemaVersion !== 1 ||
    !/^[a-f0-9]{64}$/u.test(String(documentArtifact?.fingerprint || "")) ||
    documentArtifact.fingerprint !== document?.sourceDocumentId ||
    typeof document?.pageContent !== "string" ||
    !Array.isArray(pages) ||
    pages.length === 0 ||
    extraction?.complete !== true ||
    extraction.totalPages !== pages.length ||
    extraction.processedPages !== extraction.totalPages
  )
    return null;
  let previousEnd = 0;
  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    if (
      page?.pageNumber !== index + 1 ||
      !Number.isInteger(page.start) ||
      !Number.isInteger(page.end) ||
      page.start < previousEnd ||
      page.end <= page.start ||
      page.end > document.pageContent.length
    )
      return null;
    previousEnd = page.end;
  }
  return {
    fingerprint: documentArtifact.fingerprint,
    text: document.pageContent,
    firstPage: pages[0],
  };
}

function exactSpan(identity, start, end, extra = {}) {
  const page = identity.firstPage;
  if (start < page.start || end > page.end || end <= start) return null;
  const exactText = identity.text.slice(start, end);
  return {
    ...extra,
    physicalPageNumber: 1,
    documentStart: start,
    documentEnd: end,
    exactText,
    sha256: textDigest(exactText),
  };
}

function identityCandidates(identity, contract) {
  const page = identity.firstPage;
  const pageText = identity.text.slice(page.start, page.end);
  const titles = aliasSpans(pageText, contract.referenceTitleAliases);
  if (titles.length !== 1) return [];
  const candidates = [];
  for (const title of titles) {
    const windowEnd = Math.min(
      pageText.length,
      title.end + MAX_HEADER_DISTANCE
    );
    const windowText = pageText.slice(title.end, windowEnd);
    const codes = aliasSpans(windowText, contract.referenceCodeAliases);
    if (codes.length !== 1) continue;
    const code = codes[0];
    const afterCodeStart = title.end + code.end;
    const editionWindow = pageText.slice(
      afterCodeStart,
      Math.min(pageText.length, afterCodeStart + 32)
    );
    const editions = [
      ...editionWindow.matchAll(/(?<!\d)(?:19|20)\d{2}(?!\d)/gu),
    ];
    if (editions.length !== 1) continue;
    const edition = editions[0];
    const titleStart = page.start + title.start;
    const titleEnd = page.start + title.end;
    const codeStart = page.start + title.end + code.start;
    const codeEnd = page.start + title.end + code.end;
    const editionStart = page.start + afterCodeStart + edition.index;
    const editionEnd = editionStart + edition[0].length;
    candidates.push({
      title,
      titleStart,
      titleEnd,
      code,
      codeStart,
      codeEnd,
      edition: edition[0],
      editionStart,
      editionEnd,
    });
  }
  return candidates;
}

/**
 * Identifies a referenced terms family and its source-derived edition from the
 * canonical title block on physical page one. It does not join another
 * document, assert applicability or produce a coverage/comparison effect.
 */
function buildSourceBoundReferencedTermsIdentityProofs({
  contract,
  documentArtifact,
}) {
  const validated = validateReferencedTermsIdentityEvidenceContract(contract);
  const identity = documentIdentity(documentArtifact);
  if (!identity) return [];
  const candidates = identityCandidates(identity, validated);
  if (candidates.length !== 1) return [];
  const candidate = candidates[0];
  const contextStart = candidate.titleStart;
  const followingNewline = identity.text.indexOf("\n", candidate.editionEnd);
  let contextEnd =
    followingNewline === -1
      ? identity.firstPage.end
      : Math.min(followingNewline, identity.firstPage.end);
  if (identity.text[contextEnd - 1] === "\r") contextEnd -= 1;
  const payload = {
    schemaVersion: 1,
    contractId: SOURCE_BOUND_REFERENCED_TERMS_IDENTITY_EVIDENCE_CONTRACT_ID,
    evidenceContractDigest: digest(validated),
    documentFingerprint: identity.fingerprint,
    assertionKind: ASSERTION_KIND,
    reference: {
      familyKey: validated.referenceFamilyKey,
      edition: candidate.edition,
      referenceKey: `${validated.referenceFamilyKey}@${candidate.edition}`,
    },
    spans: {
      titleSpan: exactSpan(identity, candidate.titleStart, candidate.titleEnd, {
        matchedAlias: candidate.title.matchedAlias,
      }),
      codeSpan: exactSpan(identity, candidate.codeStart, candidate.codeEnd, {
        matchedAlias: candidate.code.matchedAlias,
      }),
      editionSpan: exactSpan(
        identity,
        candidate.editionStart,
        candidate.editionEnd
      ),
      identityContextSpan: exactSpan(identity, contextStart, contextEnd),
    },
  };
  if (Object.values(payload.spans).some((span) => !span)) return [];
  return [{ ...payload, proofDigest: digest(payload) }];
}

function validSourceBoundReferencedTermsIdentityProofs({
  contract,
  proofs,
  documentArtifact,
}) {
  try {
    const expected = buildSourceBoundReferencedTermsIdentityProofs({
      contract,
      documentArtifact,
    });
    return (
      Array.isArray(proofs) &&
      JSON.stringify(canonical(proofs)) === JSON.stringify(canonical(expected))
    );
  } catch {
    return false;
  }
}

module.exports = {
  ASSERTION_KIND,
  SOURCE_BOUND_REFERENCED_TERMS_IDENTITY_EVIDENCE_CONTRACT_ID,
  buildSourceBoundReferencedTermsIdentityProofs,
  validSourceBoundReferencedTermsIdentityProofs,
  validateReferencedTermsIdentityEvidenceContract,
};

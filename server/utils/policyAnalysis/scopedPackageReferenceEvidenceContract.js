const crypto = require("crypto");

const SOURCE_BOUND_SCOPED_PACKAGE_REFERENCE_EVIDENCE_CONTRACT_ID =
  "SOURCE_BOUND_SCOPED_PACKAGE_REFERENCE_EVIDENCE_V1";
const ASSERTION_KIND = "SCOPED_COVERED_OBJECT_TERMS_REFERENCE";
const MAX_ALIASES = 24;
const NEGATIVE_OR_OPTIONAL =
  /\b(?:nicht|kein(?:e[rsnm]?)?|ausgeschlossen|ausgenommen|optional|wahlweise|mehrpr[aä]mie|mehrbeitrag|pr[aä]mienzuschlag|aufgehoben|gestrichen|au(?:ß|ss)er\s+kraft)\b/iu;
const TOP_LEVEL_INSURANCE_HEADING =
  /^\s*[A-ZÄÖÜ][A-ZÄÖÜ0-9 /-]*VERSICHERUNG\s*$/u;

function contractError(code, detail = "") {
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
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
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
  if (!text) throw contractError(code, detail);
  return text;
}

function conceptKey(value, detail) {
  const key = requiredString(
    value,
    "SCOPED_PACKAGE_REFERENCE_CONCEPT_KEY_REQUIRED",
    detail
  );
  if (!/^[A-Z][A-Z0-9_]*$/u.test(key))
    throw contractError("SCOPED_PACKAGE_REFERENCE_CONCEPT_KEY_INVALID", detail);
  return key;
}

function aliases(values, detail) {
  if (!Array.isArray(values) || values.length === 0 || values.length > MAX_ALIASES)
    throw contractError("SCOPED_PACKAGE_REFERENCE_ALIASES_INVALID", detail);
  const result = values.map((value, index) =>
    requiredString(
      value,
      "SCOPED_PACKAGE_REFERENCE_ALIAS_REQUIRED",
      `${detail}[${index}]`
    )
  );
  const normalized = result.map(normalizedText);
  if (
    normalized.some((value) => value.length < 3) ||
    new Set(normalized).size !== normalized.length
  )
    throw contractError("SCOPED_PACKAGE_REFERENCE_ALIAS_INVALID", detail);
  return result.sort((left, right) =>
    normalizedText(left).localeCompare(normalizedText(right), "de-AT")
  );
}

function validateScopedPackageReferenceEvidenceContract(
  contract,
  detail = "requirement"
) {
  const keys = [
    "contractId",
    "perilScopeKey",
    "perilHeadingAliases",
    "coveredObjectKey",
    "coveredObjectAliases",
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
    throw contractError("SCOPED_PACKAGE_REFERENCE_CONTRACT_INVALID", detail);
  if (
    contract.contractId !==
    SOURCE_BOUND_SCOPED_PACKAGE_REFERENCE_EVIDENCE_CONTRACT_ID
  )
    throw contractError("SCOPED_PACKAGE_REFERENCE_CONTRACT_ID_INVALID", detail);
  const perilScopeKey = conceptKey(contract.perilScopeKey, `${detail}:scope`);
  if (!perilScopeKey.endsWith("_INSURANCE"))
    throw contractError("SCOPED_PACKAGE_REFERENCE_SCOPE_INVALID", detail);
  return {
    contractId: SOURCE_BOUND_SCOPED_PACKAGE_REFERENCE_EVIDENCE_CONTRACT_ID,
    perilScopeKey,
    perilHeadingAliases: aliases(
      contract.perilHeadingAliases,
      `${detail}:perilHeadingAliases`
    ),
    coveredObjectKey: conceptKey(
      contract.coveredObjectKey,
      `${detail}:coveredObjectKey`
    ),
    coveredObjectAliases: aliases(
      contract.coveredObjectAliases,
      `${detail}:coveredObjectAliases`
    ),
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

function lineRecords(text) {
  const records = [];
  let start = 0;
  for (let index = 0; index <= text.length; index += 1) {
    if (index !== text.length && text[index] !== "\n") continue;
    const end = index > start && text[index - 1] === "\r" ? index - 1 : index;
    records.push({ start, end, text: text.slice(start, end) });
    start = index + 1;
  }
  return records;
}

function documentIdentity(documentArtifact) {
  const document = documentArtifact?.document;
  const extraction = document?.pdfExtraction;
  if (
    documentArtifact?.schemaVersion !== 1 ||
    !/^[a-f0-9]{64}$/u.test(String(documentArtifact?.fingerprint || "")) ||
    documentArtifact.fingerprint !== document?.sourceDocumentId ||
    typeof document?.pageContent !== "string" ||
    !Array.isArray(document?.pageMap) ||
    document.pageMap.length === 0 ||
    extraction?.complete !== true ||
    extraction.totalPages !== document.pageMap.length ||
    extraction.processedPages !== extraction.totalPages
  )
    return null;
  let previousEnd = 0;
  for (let index = 0; index < document.pageMap.length; index += 1) {
    const page = document.pageMap[index];
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
    pages: document.pageMap,
  };
}

function pageForOffset(identity, offset) {
  return identity.pages.find(
    ({ start, end }) => offset >= start && offset < end
  );
}

function exactSpan(identity, documentStart, documentEnd, extra = {}) {
  const page = pageForOffset(identity, documentStart);
  if (!page || documentEnd > page.end || documentEnd <= documentStart) return null;
  const exactText = identity.text.slice(documentStart, documentEnd);
  return {
    ...extra,
    physicalPageNumber: page.pageNumber,
    documentStart,
    documentEnd,
    exactText,
    sha256: textDigest(exactText),
  };
}

function allDocumentLines(identity) {
  return identity.pages.flatMap((page) =>
    lineRecords(identity.text.slice(page.start, page.end)).map((line) => ({
      ...line,
      physicalPageNumber: page.pageNumber,
      documentStart: page.start + line.start,
      documentEnd: page.start + line.end,
    }))
  );
}

function matchingLineSpans(line, values) {
  return aliasSpans(line.text, values).map((match) => ({
    ...match,
    documentStart: line.documentStart + match.start,
    documentEnd: line.documentStart + match.end,
  }));
}

function scopeHeadings(lines, contract) {
  return lines
    .filter((line) => TOP_LEVEL_INSURANCE_HEADING.test(line.text))
    .map((line) => ({
      line,
      match: matchingLineSpans(line, contract.perilHeadingAliases).find(
        ({ start, end }) =>
          normalizedText(line.text) === normalizedText(line.text.slice(start, end))
      ),
    }));
}

function referenceLineMatch(line, contract) {
  if (NEGATIVE_OR_OPTIONAL.test(line.text)) return null;
  const title = matchingLineSpans(line, contract.referenceTitleAliases)[0];
  const code = matchingLineSpans(line, contract.referenceCodeAliases)[0];
  if (!title || !code) return null;
  const editions = [...line.text.matchAll(/(?<!\d)(?:19|20)\d{2}(?!\d)/gu)];
  if (editions.length !== 1) return null;
  const editionMatch = editions[0];
  return {
    title,
    code,
    edition: {
      text: editionMatch[0],
      documentStart: line.documentStart + editionMatch.index,
      documentEnd: line.documentStart + editionMatch.index + editionMatch[0].length,
    },
  };
}

function proofForScope({ contract, identity, lines, headingIndex, nextHeadingIndex }) {
  const heading = lines[headingIndex];
  const endIndex = nextHeadingIndex === -1 ? lines.length : nextHeadingIndex;
  const scopedLines = lines.slice(headingIndex + 1, endIndex);
  const objectMatches = scopedLines.flatMap((line) =>
    NEGATIVE_OR_OPTIONAL.test(line.text)
      ? []
      : matchingLineSpans(line, contract.coveredObjectAliases).map((match) => ({
          line,
          match,
        }))
  );
  const referenceMatches = scopedLines
    .map((line) => ({ line, match: referenceLineMatch(line, contract) }))
    .filter(({ match }) => match);
  if (objectMatches.length !== 1 || referenceMatches.length !== 1) return null;

  const object = objectMatches[0];
  const reference = referenceMatches[0];
  const edition = reference.match.edition.text;
  const nextHeading = nextHeadingIndex === -1 ? null : lines[nextHeadingIndex];
  const scopeHeadingMatch = matchingLineSpans(
    heading,
    contract.perilHeadingAliases
  )[0];
  if (!scopeHeadingMatch) return null;
  const payload = {
    schemaVersion: 1,
    contractId: SOURCE_BOUND_SCOPED_PACKAGE_REFERENCE_EVIDENCE_CONTRACT_ID,
    evidenceContractDigest: digest(contract),
    documentFingerprint: identity.fingerprint,
    assertionKind: ASSERTION_KIND,
    perilScopeKey: contract.perilScopeKey,
    coveredObjectKey: contract.coveredObjectKey,
    reference: {
      familyKey: contract.referenceFamilyKey,
      edition,
      referenceKey: `${contract.referenceFamilyKey}@${edition}`,
    },
    scopeBoundary: {
      documentStart: heading.documentStart,
      documentEnd: nextHeading?.documentStart || identity.text.length,
      sha256: textDigest(
        identity.text.slice(
          heading.documentStart,
          nextHeading?.documentStart || identity.text.length
        )
      ),
    },
    spans: {
      scopeHeadingSpan: exactSpan(
        identity,
        scopeHeadingMatch.documentStart,
        scopeHeadingMatch.documentEnd,
        { matchedAlias: scopeHeadingMatch.matchedAlias }
      ),
      coveredObjectSpan: exactSpan(
        identity,
        object.match.documentStart,
        object.match.documentEnd,
        { matchedAlias: object.match.matchedAlias }
      ),
      coveredObjectContextSpan: exactSpan(
        identity,
        object.line.documentStart,
        object.line.documentEnd
      ),
      referenceTitleSpan: exactSpan(
        identity,
        reference.match.title.documentStart,
        reference.match.title.documentEnd,
        { matchedAlias: reference.match.title.matchedAlias }
      ),
      referenceCodeSpan: exactSpan(
        identity,
        reference.match.code.documentStart,
        reference.match.code.documentEnd,
        { matchedAlias: reference.match.code.matchedAlias }
      ),
      referenceEditionSpan: exactSpan(
        identity,
        reference.match.edition.documentStart,
        reference.match.edition.documentEnd
      ),
      referenceContextSpan: exactSpan(
        identity,
        reference.line.documentStart,
        reference.line.documentEnd
      ),
      ...(nextHeading
        ? {
            nextScopeHeadingSpan: exactSpan(
              identity,
              nextHeading.documentStart,
              nextHeading.documentEnd
            ),
          }
        : {}),
    },
  };
  if (Object.values(payload.spans).some((span) => !span)) return null;
  return { ...payload, proofDigest: digest(payload) };
}

/**
 * Proves only a same-section link between one insured object and one
 * source-versioned terms reference. It deliberately carries no coverage
 * effect, applicability, package status, document identity join or outcome.
 */
function buildSourceBoundScopedPackageReferenceProofs({
  contract,
  documentArtifact,
}) {
  const validated = validateScopedPackageReferenceEvidenceContract(contract);
  const identity = documentIdentity(documentArtifact);
  if (!identity) return [];
  const lines = allDocumentLines(identity);
  const headings = scopeHeadings(lines, validated);
  const proofs = [];
  for (const { line: heading, match } of headings) {
    if (!match) continue;
    const headingIndex = lines.indexOf(heading);
    const nextHeadingIndex = lines.findIndex(
      (line, index) =>
        index > headingIndex && TOP_LEVEL_INSURANCE_HEADING.test(line.text)
    );
    const proof = proofForScope({
      contract: validated,
      identity,
      lines,
      headingIndex,
      nextHeadingIndex,
    });
    if (proof) proofs.push(proof);
  }
  return proofs.sort((left, right) =>
    left.proofDigest.localeCompare(right.proofDigest)
  );
}

function validSourceBoundScopedPackageReferenceProofs({
  contract,
  proofs,
  documentArtifact,
}) {
  try {
    const expected = buildSourceBoundScopedPackageReferenceProofs({
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
  SOURCE_BOUND_SCOPED_PACKAGE_REFERENCE_EVIDENCE_CONTRACT_ID,
  buildSourceBoundScopedPackageReferenceProofs,
  validSourceBoundScopedPackageReferenceProofs,
  validateScopedPackageReferenceEvidenceContract,
};

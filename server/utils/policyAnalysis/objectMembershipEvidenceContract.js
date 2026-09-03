const crypto = require("crypto");

const SOURCE_BOUND_OBJECT_MEMBERSHIP_EVIDENCE_CONTRACT_ID =
  "SOURCE_BOUND_OBJECT_MEMBERSHIP_EVIDENCE_V3";
const OBJECT_MEMBERSHIP = Object.freeze({
  MEMBER_OF_CLASS: "MEMBER_OF_CLASS",
  EXCLUDED_FROM_CLASS: "EXCLUDED_FROM_CLASS",
});
const OBJECT_MEMBERSHIP_CLASSIFICATION_SOURCE = Object.freeze({
  CURRENT_PAGE: "CURRENT_PAGE_OBJECT_CLASSIFICATION",
  PRECEDING_PAGE: "PRECEDING_PAGE_OBJECT_CLASSIFICATION",
});
const ALLOWED_CLASSIFICATION_SOURCES = new Set(
  Object.values(OBJECT_MEMBERSHIP_CLASSIFICATION_SOURCE)
);
const MAX_ALIASES = 24;

function membershipError(code, detail = "") {
  const error = new Error(detail ? `${code}: ${detail}` : code);
  error.code = code;
  return error;
}

function exactKeys(value, expected, code, detail) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    JSON.stringify(Object.keys(value).sort()) !==
      JSON.stringify([...expected].sort())
  )
    throw membershipError(code, detail);
}

function requiredString(value, code, detail) {
  if (typeof value !== "string" || !value.trim())
    throw membershipError(code, detail);
  return value.trim();
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

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableValue(value[key])])
  );
}

function digest(value) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(stableValue(value)))
    .digest("hex");
}

function textDigest(value) {
  return crypto
    .createHash("sha256")
    .update(String(value || ""))
    .digest("hex");
}

function validateConceptKey(value, detail) {
  const key = requiredString(
    value,
    "OBJECT_MEMBERSHIP_CONCEPT_KEY_REQUIRED",
    detail
  );
  if (!/^[A-Z][A-Z0-9_]*$/u.test(key))
    throw membershipError("OBJECT_MEMBERSHIP_CONCEPT_KEY_INVALID", detail);
  return key;
}

function validateAliases(values, detail) {
  if (
    !Array.isArray(values) ||
    values.length === 0 ||
    values.length > MAX_ALIASES
  )
    throw membershipError("OBJECT_MEMBERSHIP_ALIASES_INVALID", detail);
  const aliases = values.map((value, index) =>
    requiredString(
      value,
      "OBJECT_MEMBERSHIP_ALIAS_REQUIRED",
      `${detail}[${index}]`
    )
  );
  const normalized = aliases.map(normalizedText);
  if (
    normalized.some((alias) => alias.length < 3) ||
    new Set(normalized).size !== normalized.length
  )
    throw membershipError("OBJECT_MEMBERSHIP_ALIAS_INVALID", detail);
  return aliases.sort((left, right) =>
    normalizedText(left).localeCompare(normalizedText(right), "de-AT")
  );
}

/**
 * Validates the catalog-owned direction and vocabulary for one object edge.
 * This contract classifies membership only; it never asserts coverage.
 */
function validateObjectMembershipEvidenceContract(
  contract,
  detail = "component"
) {
  exactKeys(
    contract,
    [
      "contractId",
      "membership",
      "memberObjectKey",
      "classObjectKey",
      "memberAliases",
      "classAliases",
      "allowedClassificationSources",
    ],
    "OBJECT_MEMBERSHIP_CONTRACT_INVALID",
    detail
  );
  if (
    contract.contractId !== SOURCE_BOUND_OBJECT_MEMBERSHIP_EVIDENCE_CONTRACT_ID
  )
    throw membershipError("OBJECT_MEMBERSHIP_CONTRACT_ID_INVALID", detail);
  if (!Object.values(OBJECT_MEMBERSHIP).includes(contract.membership))
    throw membershipError("OBJECT_MEMBERSHIP_RELATION_INVALID", detail);
  const memberObjectKey = validateConceptKey(
    contract.memberObjectKey,
    `${detail}:memberObjectKey`
  );
  const classObjectKey = validateConceptKey(
    contract.classObjectKey,
    `${detail}:classObjectKey`
  );
  if (memberObjectKey === classObjectKey)
    throw membershipError("OBJECT_MEMBERSHIP_SELF_EDGE_FORBIDDEN", detail);
  const allowedClassificationSources = contract.allowedClassificationSources;
  if (
    !Array.isArray(allowedClassificationSources) ||
    allowedClassificationSources.length === 0 ||
    new Set(allowedClassificationSources).size !==
      allowedClassificationSources.length ||
    allowedClassificationSources.some(
      (source) => !ALLOWED_CLASSIFICATION_SOURCES.has(source)
    )
  )
    throw membershipError("OBJECT_MEMBERSHIP_SOURCES_INVALID", detail);
  return {
    contractId: SOURCE_BOUND_OBJECT_MEMBERSHIP_EVIDENCE_CONTRACT_ID,
    membership: contract.membership,
    memberObjectKey,
    classObjectKey,
    memberAliases: validateAliases(
      contract.memberAliases,
      `${detail}:memberAliases`
    ),
    classAliases: validateAliases(
      contract.classAliases,
      `${detail}:classAliases`
    ),
    allowedClassificationSources: [...allowedClassificationSources].sort(),
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

function firstAliasSpan(sourceText, aliases) {
  const source = normalizeWithOffsets(sourceText);
  const matches = [];
  aliases.forEach((alias, aliasIndex) => {
    const normalizedAlias = normalizeWithOffsets(alias).text;
    let start = source.text.indexOf(normalizedAlias);
    while (start !== -1) {
      const end = start + normalizedAlias.length;
      const before = source.text[start - 1] || "";
      const after = source.text[end] || "";
      if (!/[\p{L}\p{N}]/u.test(before) && !/[\p{L}\p{N}]/u.test(after))
        matches.push({ alias, aliasIndex, start, end });
      start = source.text.indexOf(normalizedAlias, start + 1);
    }
  });
  const selected = matches.sort(
    (left, right) =>
      left.start - right.start || left.aliasIndex - right.aliasIndex
  )[0];
  if (!selected) return null;
  return {
    matchedAlias: selected.alias,
    start: source.offsets[selected.start],
    end: source.offsets[selected.end - 1] + 1,
  };
}

function documentIdentity(documentArtifact) {
  const document = documentArtifact?.document;
  if (
    documentArtifact?.schemaVersion !== 1 ||
    typeof documentArtifact.fingerprint !== "string" ||
    !documentArtifact.fingerprint ||
    documentArtifact.fingerprint !== document?.sourceDocumentId ||
    typeof document?.pageContent !== "string" ||
    !Array.isArray(document?.pageMap) ||
    document.pageMap.length === 0 ||
    document?.pdfExtraction?.complete !== true
  )
    return null;
  return {
    fingerprint: documentArtifact.fingerprint,
    text: document.pageContent,
    pages: document.pageMap,
  };
}

function sourceBoundSpan({
  identity,
  physicalPageNumber,
  documentStart,
  documentEnd,
  text,
}) {
  if (
    !Number.isInteger(physicalPageNumber) ||
    physicalPageNumber < 1 ||
    !Number.isInteger(documentStart) ||
    !Number.isInteger(documentEnd) ||
    documentEnd <= documentStart ||
    typeof text !== "string" ||
    text.length !== documentEnd - documentStart ||
    identity.text.slice(documentStart, documentEnd) !== text
  )
    return false;
  const page = identity.pages.find(
    ({ pageNumber }) => pageNumber === physicalPageNumber
  );
  return Boolean(
    page &&
      Number.isInteger(page.start) &&
      Number.isInteger(page.end) &&
      documentStart >= page.start &&
      documentEnd <= page.end
  );
}

function relationTextMatches({ membership, subjectText, headingText }) {
  const text = normalizedText(headingText);
  const subject = normalizedText(subjectText);
  if (membership === OBJECT_MEMBERSHIP.MEMBER_OF_CLASS)
    return text === `${subject} das sind`;
  return ["gelten", "gilt", "zaehlen", "zaehlt"].some(
    (verb) => text === `nicht als ${subject} ${verb}`
  );
}

/**
 * Builds one directed, source-exact member -> class edge. The proof is an
 * outcome-neutral classification artifact and deliberately has no coverage
 * effect, applicability, package status or comparison outcome.
 */
function buildSourceBoundObjectMembershipProof({
  contract,
  occurrence,
  documentArtifact,
}) {
  const validated = validateObjectMembershipEvidenceContract(contract);
  const identity = documentIdentity(documentArtifact);
  const hint = occurrence?.objectClassificationGovernorHint;
  if (!identity || !hint) return null;
  if (
    hint.contractId !== "CROSS_PAGE_OBJECT_CLASSIFICATION_CONTEXT_V1" ||
    hint.kind !== "OBJECT_CLASSIFICATION_BOUNDARY" ||
    hint.classificationKind !== "OBJECT" ||
    hint.membership !== validated.membership ||
    !validated.allowedClassificationSources.includes(hint.source) ||
    occurrence?.context?.unitType !== "LIST_ITEM" ||
    !String(occurrence?.candidateId || "").trim()
  )
    return null;

  const memberMatch = firstAliasSpan(
    occurrence.exactText,
    validated.memberAliases
  );
  const classAlias = validated.classAliases.find((alias) =>
    firstAliasSpan(hint.subject, [alias])
  );
  const classMatch = classAlias
    ? firstAliasSpan(hint.text, [classAlias])
    : null;
  if (
    !memberMatch ||
    !classAlias ||
    !classMatch ||
    !relationTextMatches({
      membership: validated.membership,
      subjectText: hint.subject,
      headingText: hint.text,
    }) ||
    !sourceBoundSpan({
      identity,
      physicalPageNumber: occurrence.physicalPageNumber,
      documentStart: occurrence.documentStart,
      documentEnd: occurrence.documentEnd,
      text: occurrence.exactText,
    }) ||
    !sourceBoundSpan({
      identity,
      physicalPageNumber: hint.physicalPageNumber,
      documentStart: hint.documentStart,
      documentEnd: hint.documentEnd,
      text: hint.text,
    }) ||
    !sourceBoundSpan({
      identity,
      physicalPageNumber: occurrence.physicalPageNumber,
      documentStart: occurrence.context?.documentStart,
      documentEnd: occurrence.context?.documentEnd,
      text: occurrence.context?.text,
    }) ||
    occurrence.documentStart < occurrence.context.documentStart ||
    occurrence.documentEnd > occurrence.context.documentEnd ||
    hint.documentEnd > occurrence.documentStart ||
    (hint.source === OBJECT_MEMBERSHIP_CLASSIFICATION_SOURCE.CURRENT_PAGE &&
      hint.physicalPageNumber !== occurrence.physicalPageNumber) ||
    (hint.source === OBJECT_MEMBERSHIP_CLASSIFICATION_SOURCE.PRECEDING_PAGE &&
      hint.physicalPageNumber + 1 !== occurrence.physicalPageNumber)
  )
    return null;

  const memberExactText = occurrence.exactText.slice(
    memberMatch.start,
    memberMatch.end
  );
  const classExactText = hint.text.slice(classMatch.start, classMatch.end);
  const payload = {
    schemaVersion: 1,
    contractId: SOURCE_BOUND_OBJECT_MEMBERSHIP_EVIDENCE_CONTRACT_ID,
    evidenceContractDigest: digest(validated),
    documentFingerprint: identity.fingerprint,
    edge: {
      relation: validated.membership,
      memberObjectKey: validated.memberObjectKey,
      classObjectKey: validated.classObjectKey,
      memberSpan: {
        candidateId: occurrence.candidateId,
        matchedAlias: memberMatch.matchedAlias,
        physicalPageNumber: occurrence.physicalPageNumber,
        documentStart: occurrence.documentStart + memberMatch.start,
        documentEnd: occurrence.documentStart + memberMatch.end,
        exactText: memberExactText,
        sha256: textDigest(memberExactText),
      },
      memberContextSpan: {
        source: "STRUCTURAL_LIST_ITEM",
        physicalPageNumber: occurrence.physicalPageNumber,
        documentStart: occurrence.context.documentStart,
        documentEnd: occurrence.context.documentEnd,
        exactText: occurrence.context.text,
        sha256: textDigest(occurrence.context.text),
      },
      classSpan: {
        source: hint.source,
        matchedAlias: classAlias,
        physicalPageNumber: hint.physicalPageNumber,
        documentStart: hint.documentStart + classMatch.start,
        documentEnd: hint.documentStart + classMatch.end,
        exactText: classExactText,
        sha256: textDigest(classExactText),
      },
      classificationSpan: {
        source: hint.source,
        physicalPageNumber: hint.physicalPageNumber,
        documentStart: hint.documentStart,
        documentEnd: hint.documentEnd,
        exactText: hint.text,
        sha256: textDigest(hint.text),
      },
    },
  };
  return { ...payload, proofDigest: digest(payload) };
}

function validSourceBoundObjectMembershipProof({
  contract,
  occurrence,
  documentArtifact,
  proof = occurrence?.objectMembershipProof,
}) {
  try {
    const expected = buildSourceBoundObjectMembershipProof({
      contract,
      occurrence,
      documentArtifact,
    });
    return Boolean(
      expected &&
        JSON.stringify(stableValue(expected)) ===
          JSON.stringify(stableValue(proof))
    );
  } catch {
    return false;
  }
}

module.exports = {
  OBJECT_MEMBERSHIP,
  OBJECT_MEMBERSHIP_CLASSIFICATION_SOURCE,
  SOURCE_BOUND_OBJECT_MEMBERSHIP_EVIDENCE_CONTRACT_ID,
  buildSourceBoundObjectMembershipProof,
  validateObjectMembershipEvidenceContract,
  validSourceBoundObjectMembershipProof,
};

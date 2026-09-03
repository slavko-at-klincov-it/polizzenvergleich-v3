const crypto = require("crypto");

const SOURCE_BOUND_OBJECT_SCOPE_EVIDENCE_CONTRACT_ID =
  "SOURCE_BOUND_OBJECT_SCOPE_EVIDENCE_V1";
const OBJECT_SCOPE_EVIDENCE_SOURCE = Object.freeze({
  STRUCTURAL_LOCAL_CONTEXT: "STRUCTURAL_LOCAL_CONTEXT",
  NESTED_LIST_CONTINUATION: "NESTED_LIST_CONTINUATION",
});
const ALLOWED_SOURCE_KINDS = new Set(
  Object.values(OBJECT_SCOPE_EVIDENCE_SOURCE)
);
const ALLOWED_LOCAL_CONTEXT_UNIT_TYPES = new Set(["LIST_ITEM", "PARAGRAPH"]);
const MAX_FAMILIES = 12;
const MAX_PATTERNS_PER_FAMILY = 8;
const MAX_GROUPS_PER_PATTERN = 4;
const MAX_ALIASES_PER_GROUP = 8;

function objectScopeError(code, detail = "") {
  const error = new Error(detail ? `${code}: ${detail}` : code);
  error.code = code;
  return error;
}

function nonEmptyString(value, code, detail) {
  if (typeof value !== "string" || value.trim().length === 0)
    throw objectScopeError(code, detail);
  return value.trim();
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])])
    );
  return value;
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

function exactKeys(value, expected, code, detail) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    JSON.stringify(Object.keys(value).sort()) !==
      JSON.stringify([...expected].sort())
  )
    throw objectScopeError(code, detail);
}

function normalizedAlias(value) {
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

function validateSourceKinds(sourceKinds, detail) {
  if (
    !Array.isArray(sourceKinds) ||
    sourceKinds.length === 0 ||
    sourceKinds.some((kind) => !ALLOWED_SOURCE_KINDS.has(kind)) ||
    new Set(sourceKinds).size !== sourceKinds.length
  )
    throw objectScopeError("OBJECT_SCOPE_SOURCE_KINDS_INVALID", detail);
  return [...sourceKinds].sort();
}

/**
 * Validates the catalog-owned, declarative object-scope matcher. Patterns use
 * AND across groups and OR within a group. They classify source-bound object
 * scope only; they do not assert coverage effect or comparison dominance.
 */
function validateObjectScopeEvidenceContract(contract, detail = "component") {
  exactKeys(
    contract,
    ["contractId", "allowedEvidenceSources", "families"],
    "OBJECT_SCOPE_CONTRACT_INVALID",
    detail
  );
  if (contract.contractId !== SOURCE_BOUND_OBJECT_SCOPE_EVIDENCE_CONTRACT_ID)
    throw objectScopeError(
      "OBJECT_SCOPE_CONTRACT_ID_INVALID",
      `${detail}:${String(contract.contractId || "")}`
    );
  const allowedEvidenceSources = validateSourceKinds(
    contract.allowedEvidenceSources,
    detail
  );
  if (
    JSON.stringify(allowedEvidenceSources) !==
    JSON.stringify([...ALLOWED_SOURCE_KINDS].sort())
  )
    throw objectScopeError("OBJECT_SCOPE_SOURCE_SET_INCOMPLETE", detail);
  if (
    !Array.isArray(contract.families) ||
    contract.families.length === 0 ||
    contract.families.length > MAX_FAMILIES
  )
    throw objectScopeError("OBJECT_SCOPE_FAMILIES_INVALID", detail);

  const observedKeys = new Set();
  const families = contract.families.map((family, familyIndex) => {
    const familyDetail = `${detail}:families[${familyIndex}]`;
    exactKeys(
      family,
      ["objectScopeKey", "patterns"],
      "OBJECT_SCOPE_FAMILY_INVALID",
      familyDetail
    );
    const objectScopeKey = nonEmptyString(
      family.objectScopeKey,
      "OBJECT_SCOPE_KEY_REQUIRED",
      familyDetail
    );
    if (!/^[A-Z][A-Z0-9_]*$/u.test(objectScopeKey))
      throw objectScopeError(
        "OBJECT_SCOPE_KEY_INVALID",
        `${familyDetail}:${objectScopeKey}`
      );
    if (observedKeys.has(objectScopeKey))
      throw objectScopeError("OBJECT_SCOPE_KEY_DUPLICATE", objectScopeKey);
    observedKeys.add(objectScopeKey);
    if (
      !Array.isArray(family.patterns) ||
      family.patterns.length === 0 ||
      family.patterns.length > MAX_PATTERNS_PER_FAMILY
    )
      throw objectScopeError("OBJECT_SCOPE_PATTERNS_INVALID", familyDetail);

    const patternDigests = new Set();
    const patterns = family.patterns.map((pattern, patternIndex) => {
      const patternDetail = `${familyDetail}:patterns[${patternIndex}]`;
      exactKeys(
        pattern,
        ["sourceKinds", "allOf"],
        "OBJECT_SCOPE_PATTERN_INVALID",
        patternDetail
      );
      const sourceKinds = validateSourceKinds(
        pattern.sourceKinds,
        patternDetail
      );
      if (sourceKinds.some((kind) => !allowedEvidenceSources.includes(kind)))
        throw objectScopeError(
          "OBJECT_SCOPE_PATTERN_SOURCE_NOT_DECLARED",
          patternDetail
        );
      if (
        !Array.isArray(pattern.allOf) ||
        pattern.allOf.length === 0 ||
        pattern.allOf.length > MAX_GROUPS_PER_PATTERN
      )
        throw objectScopeError("OBJECT_SCOPE_GROUPS_INVALID", patternDetail);
      const aliasesAcrossGroups = new Set();
      const allOf = pattern.allOf.map((group, groupIndex) => {
        const groupDetail = `${patternDetail}:allOf[${groupIndex}]`;
        if (
          !Array.isArray(group) ||
          group.length === 0 ||
          group.length > MAX_ALIASES_PER_GROUP
        )
          throw objectScopeError(
            "OBJECT_SCOPE_ALIAS_GROUP_INVALID",
            groupDetail
          );
        const aliases = group.map((alias) =>
          nonEmptyString(alias, "OBJECT_SCOPE_ALIAS_REQUIRED", groupDetail)
        );
        const normalized = aliases.map(normalizedAlias);
        if (
          normalized.some((alias) => alias.length < 4) ||
          new Set(normalized).size !== normalized.length ||
          normalized.some((alias) => aliasesAcrossGroups.has(alias))
        )
          throw objectScopeError("OBJECT_SCOPE_ALIAS_INVALID", groupDetail);
        normalized.forEach((alias) => aliasesAcrossGroups.add(alias));
        return aliases;
      });
      const validatedPattern = { sourceKinds, allOf };
      const patternDigest = digest(validatedPattern);
      if (patternDigests.has(patternDigest))
        throw objectScopeError("OBJECT_SCOPE_PATTERN_DUPLICATE", patternDetail);
      patternDigests.add(patternDigest);
      return validatedPattern;
    });
    return { objectScopeKey, patterns };
  });
  return {
    contractId: SOURCE_BOUND_OBJECT_SCOPE_EVIDENCE_CONTRACT_ID,
    allowedEvidenceSources,
    families,
  };
}

function transliterateCharacter(character) {
  const lower = character.normalize("NFKC").toLocaleLowerCase("de");
  if (lower === "ä") return "ae";
  if (lower === "ö") return "oe";
  if (lower === "ü") return "ue";
  if (lower === "ß") return "ss";
  return lower;
}

function hyphenatedLineBreakTarget(text, hyphenIndex) {
  if (text[hyphenIndex] !== "-" || !/\p{L}/u.test(text[hyphenIndex - 1] || ""))
    return null;
  let cursor = hyphenIndex + 1;
  let includesLineBreak = false;
  while (cursor < text.length && /\s/u.test(text[cursor])) {
    if (/[\n\r]/u.test(text[cursor])) includesLineBreak = true;
    cursor += 1;
  }
  if (!includesLineBreak || !/\p{L}/u.test(text[cursor] || "")) return null;
  const followingWord = String(text.slice(cursor).match(/^\p{L}+/u)?.[0] || "")
    .toLocaleLowerCase("de")
    .trim();
  return ["und", "oder"].includes(followingWord) ? null : cursor;
}

function normalizeWithOffsets(value) {
  const text = String(value || "");
  const characters = [];
  const originalOffsets = [];
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === "\u00ad") continue;
    const joinedAt = hyphenatedLineBreakTarget(text, index);
    if (joinedAt !== null) {
      index = joinedAt - 1;
      continue;
    }
    if (!/[\p{L}\p{N}]/u.test(character)) {
      if (characters.length > 0 && characters.at(-1) !== " ") {
        characters.push(" ");
        originalOffsets.push(index);
      }
      continue;
    }
    for (const normalizedCharacter of transliterateCharacter(character)) {
      characters.push(normalizedCharacter);
      originalOffsets.push(index);
    }
  }
  while (characters[0] === " ") {
    characters.shift();
    originalOffsets.shift();
  }
  while (characters.at(-1) === " ") {
    characters.pop();
    originalOffsets.pop();
  }
  return { normalized: characters.join(""), originalOffsets };
}

function firstExactAliasMatch(text, aliases) {
  const source = normalizeWithOffsets(text);
  const candidates = [];
  aliases.forEach((matchedAlias, aliasIndex) => {
    const alias = normalizeWithOffsets(matchedAlias).normalized;
    let start = source.normalized.indexOf(alias);
    while (start !== -1) {
      const end = start + alias.length;
      const before = source.normalized[start - 1] || "";
      const after = source.normalized[end] || "";
      if (!/[\p{L}\p{N}]/u.test(before) && !/[\p{L}\p{N}]/u.test(after))
        candidates.push({ start, end, matchedAlias, aliasIndex });
      start = source.normalized.indexOf(alias, start + 1);
    }
  });
  const selected = candidates.sort(
    (left, right) =>
      left.start - right.start || left.aliasIndex - right.aliasIndex
  )[0];
  if (!selected) return null;
  return {
    matchedAlias: selected.matchedAlias,
    start: source.originalOffsets[selected.start],
    end: source.originalOffsets[selected.end - 1] + 1,
  };
}

function validSourceContainer(container) {
  return Boolean(
    container &&
      ALLOWED_SOURCE_KINDS.has(container.sourceKind) &&
      Number.isInteger(container.physicalPageNumber) &&
      container.physicalPageNumber > 0 &&
      Number.isInteger(container.documentStart) &&
      Number.isInteger(container.documentEnd) &&
      container.documentEnd >= container.documentStart &&
      typeof container.text === "string" &&
      container.text.length === container.documentEnd - container.documentStart
  );
}

function validNestedListContinuationEnvelope(proof) {
  if (
    proof?.contractId !== "NESTED_LIST_CONTINUATION_PROOF_V1" ||
    !Array.isArray(proof.segments) ||
    proof.segments.length !== 2 ||
    proof.segments[0]?.kind !== "PARENT_WITH_SUBLIST" ||
    proof.segments[1]?.kind !== "CONTINUED_SUBLIST" ||
    proof.segments[1]?.physicalPageNumber !==
      proof.segments[0]?.physicalPageNumber + 1 ||
    proof.documentStart !== proof.segments[0]?.documentStart ||
    proof.documentEnd !== proof.segments[1]?.documentEnd
  )
    return false;
  for (const segment of proof.segments) {
    if (
      !Number.isInteger(segment?.physicalPageNumber) ||
      !Number.isInteger(segment?.documentStart) ||
      !Number.isInteger(segment?.documentEnd) ||
      typeof segment?.text !== "string" ||
      segment.text.length !== segment.documentEnd - segment.documentStart ||
      segment.sha256 !== textDigest(segment.text)
    )
      return false;
  }
  const gap = proof.gap;
  const pagePrelude = proof.pagePrelude;
  const boundary = proof.boundary;
  if (
    typeof gap?.text !== "string" ||
    gap.sha256 !== textDigest(gap.text) ||
    typeof pagePrelude?.text !== "string" ||
    pagePrelude.sha256 !== textDigest(pagePrelude.text) ||
    !boundary ||
    boundary.sha256 !==
      crypto
        .createHash("sha256")
        .update(
          JSON.stringify(
            Object.fromEntries(
              Object.entries(boundary).filter(([key]) => key !== "sha256")
            )
          )
        )
        .digest("hex")
  )
    return false;
  const digestPayload = {
    contractId: proof.contractId,
    segments: proof.segments.map(
      ({ kind, physicalPageNumber, documentStart, documentEnd, sha256 }) => ({
        kind,
        physicalPageNumber,
        documentStart,
        documentEnd,
        sha256,
      })
    ),
    gapSha256: gap.sha256,
    pagePreludeSha256: pagePrelude.sha256,
    boundarySha256: boundary.sha256,
  };
  return (
    proof.proofDigest ===
    crypto
      .createHash("sha256")
      .update(JSON.stringify(digestPayload))
      .digest("hex")
  );
}

function sourceContainers(occurrence, nestedListContinuationValidated) {
  const containers = [];
  const context = occurrence?.context;
  if (
    ALLOWED_LOCAL_CONTEXT_UNIT_TYPES.has(context?.unitType) &&
    validSourceContainer({
      sourceKind: OBJECT_SCOPE_EVIDENCE_SOURCE.STRUCTURAL_LOCAL_CONTEXT,
      physicalPageNumber: occurrence?.physicalPageNumber,
      documentStart: context?.documentStart,
      documentEnd: context?.documentEnd,
      text: context?.text,
    })
  )
    containers.push({
      sourceKind: OBJECT_SCOPE_EVIDENCE_SOURCE.STRUCTURAL_LOCAL_CONTEXT,
      physicalPageNumber: occurrence.physicalPageNumber,
      documentStart: context.documentStart,
      documentEnd: context.documentEnd,
      text: context.text,
    });

  const continuation = occurrence?.nestedListContinuationProof;
  if (
    nestedListContinuationValidated === true &&
    validNestedListContinuationEnvelope(continuation)
  )
    for (const segment of continuation.segments || []) {
      const container = {
        sourceKind: OBJECT_SCOPE_EVIDENCE_SOURCE.NESTED_LIST_CONTINUATION,
        physicalPageNumber: segment?.physicalPageNumber,
        documentStart: segment?.documentStart,
        documentEnd: segment?.documentEnd,
        text: segment?.text,
        continuationProofDigest: continuation.proofDigest,
      };
      if (
        validSourceContainer(container) &&
        segment?.sha256 === textDigest(segment.text)
      )
        containers.push(container);
    }
  return containers;
}

function assertionFor({ family, container }) {
  for (const pattern of family.patterns) {
    if (!pattern.sourceKinds.includes(container.sourceKind)) continue;
    const matches = pattern.allOf.map((aliases) =>
      firstExactAliasMatch(container.text, aliases)
    );
    if (matches.some((match) => !match)) continue;
    return {
      objectScopeKey: family.objectScopeKey,
      relation: "CLAUSE_OBJECT_SCOPE",
      sourceKind: container.sourceKind,
      matches: matches.map(({ matchedAlias, start, end }) => {
        const exactText = container.text.slice(start, end);
        return {
          matchedAlias,
          physicalPageNumber: container.physicalPageNumber,
          documentStart: container.documentStart + start,
          documentEnd: container.documentStart + end,
          exactText,
          sha256: textDigest(exactText),
        };
      }),
      ...(container.continuationProofDigest
        ? { continuationProofDigest: container.continuationProofDigest }
        : {}),
    };
  }
  return null;
}

/**
 * Materializes deterministic, source-exact object-scope assertions. A null
 * result means only that this optional diagnostic contract had no proof.
 */
function buildSourceBoundObjectScopeProof({
  contract,
  occurrence,
  nestedListContinuationValidated = false,
}) {
  const validated = validateObjectScopeEvidenceContract(contract);
  const containers = sourceContainers(
    occurrence,
    nestedListContinuationValidated
  );
  const assertions = validated.families
    .map((family) => {
      for (const container of containers) {
        const assertion = assertionFor({ family, container });
        if (assertion) return assertion;
      }
      return null;
    })
    .filter(Boolean);
  if (assertions.length === 0) return null;
  const objectScopeKeys = assertions
    .map(({ objectScopeKey }) => objectScopeKey)
    .sort();
  const payload = {
    contractId: SOURCE_BOUND_OBJECT_SCOPE_EVIDENCE_CONTRACT_ID,
    objectScopeEvidenceContractDigest: digest(validated),
    assertions,
    objectScopeKeys,
  };
  return { ...payload, proofDigest: digest(payload) };
}

function validSourceBoundObjectScopeProof({
  contract,
  occurrence,
  nestedListContinuationValidated = false,
}) {
  try {
    const expected = buildSourceBoundObjectScopeProof({
      contract,
      occurrence,
      nestedListContinuationValidated,
    });
    return Boolean(
      expected &&
        JSON.stringify(stableValue(expected)) ===
          JSON.stringify(stableValue(occurrence?.objectScopeProof))
    );
  } catch {
    return false;
  }
}

module.exports = {
  OBJECT_SCOPE_EVIDENCE_SOURCE,
  SOURCE_BOUND_OBJECT_SCOPE_EVIDENCE_CONTRACT_ID,
  buildSourceBoundObjectScopeProof,
  validateObjectScopeEvidenceContract,
  validSourceBoundObjectScopeProof,
};

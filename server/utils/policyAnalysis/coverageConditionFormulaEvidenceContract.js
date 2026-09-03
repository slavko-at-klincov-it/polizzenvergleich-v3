const crypto = require("crypto");

const SOURCE_BOUND_COVERAGE_CONDITION_FORMULA_CONTRACT_ID =
  "SOURCE_BOUND_COVERAGE_CONDITION_FORMULA_V1";
const SOURCE_POLICY = "GLOBAL_GOVERNOR_BEFORE_TARGETS_V1";
const TARGET_SCOPE_POLICY = "GENERAL_DIRECT_TARGET_V1";
const SATISFACTION = "NOT_EVALUATED";
const ALLOWED_OPERATORS = new Set(["AND", "OR"]);
const MAX_ALIASES = 24;
const MAX_GROUPS = 8;

function formulaError(code, detail = "") {
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
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function exactKeys(value, expected, code, detail = "") {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    JSON.stringify(Object.keys(value).sort()) !==
      JSON.stringify([...expected].sort())
  )
    throw formulaError(code, detail);
}

function requiredConceptKey(value, code, detail) {
  const key = String(value || "").trim();
  if (!/^[A-Z][A-Z0-9_]*$/u.test(key)) throw formulaError(code, detail);
  return key;
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

function validateAliases(values, detail) {
  if (!Array.isArray(values) || values.length === 0 || values.length > MAX_ALIASES)
    throw formulaError("COVERAGE_CONDITION_FORMULA_ALIASES_INVALID", detail);
  const aliases = values.map((value, index) => {
    if (typeof value !== "string" || normalizedText(value).length < 2)
      throw formulaError(
        "COVERAGE_CONDITION_FORMULA_ALIAS_INVALID",
        `${detail}[${index}]`
      );
    return value.trim();
  });
  const normalized = aliases.map(normalizedText);
  if (new Set(normalized).size !== normalized.length)
    throw formulaError("COVERAGE_CONDITION_FORMULA_ALIAS_INVALID", detail);
  return aliases.sort((left, right) =>
    normalizedText(left).localeCompare(normalizedText(right), "de-AT")
  );
}

function validateRequiredGroups(groups, detail) {
  if (!Array.isArray(groups) || groups.length < 2 || groups.length > MAX_GROUPS)
    throw formulaError("COVERAGE_CONDITION_FORMULA_GROUPS_INVALID", detail);
  return groups.map((aliases, index) =>
    validateAliases(aliases, `${detail}[${index}]`)
  );
}

function validateFormulaNode(node, detail, predicateKeys) {
  if (node?.kind === "PREDICATE") {
    exactKeys(
      node,
      [
        "kind",
        "predicateKey",
        "actorBinding",
        "actorCombination",
        "forbiddenAliases",
        "requiredGroups",
      ],
      "COVERAGE_CONDITION_FORMULA_PREDICATE_INVALID",
      detail
    );
    const predicateKey = requiredConceptKey(
      node.predicateKey,
      "COVERAGE_CONDITION_FORMULA_PREDICATE_KEY_INVALID",
      detail
    );
    if (predicateKeys.has(predicateKey))
      throw formulaError(
        "COVERAGE_CONDITION_FORMULA_PREDICATE_DUPLICATE",
        predicateKey
      );
    predicateKeys.add(predicateKey);
    const actorBinding =
      node.actorBinding === null
        ? null
        : requiredConceptKey(
            node.actorBinding,
            "COVERAGE_CONDITION_FORMULA_ACTOR_BINDING_INVALID",
            detail
          );
    const requiredGroups = validateRequiredGroups(
      node.requiredGroups,
      `${detail}:requiredGroups`
    );
    let actorCombination = null;
    if (node.actorCombination !== null) {
      exactKeys(
        node.actorCombination,
        ["operator", "operatorAliases", "leftGroupIndex", "rightGroupIndex"],
        "COVERAGE_CONDITION_FORMULA_ACTOR_COMBINATION_INVALID",
        detail
      );
      const { leftGroupIndex, rightGroupIndex } = node.actorCombination;
      if (
        actorBinding === null ||
        node.actorCombination.operator !== "OR" ||
        !Number.isInteger(leftGroupIndex) ||
        !Number.isInteger(rightGroupIndex) ||
        leftGroupIndex < 0 ||
        rightGroupIndex !== leftGroupIndex + 1 ||
        rightGroupIndex >= requiredGroups.length
      )
        throw formulaError(
          "COVERAGE_CONDITION_FORMULA_ACTOR_COMBINATION_INVALID",
          detail
        );
      actorCombination = {
        operator: "OR",
        operatorAliases: validateAliases(
          node.actorCombination.operatorAliases,
          `${detail}:actorCombination:operatorAliases`
        ),
        leftGroupIndex,
        rightGroupIndex,
      };
    }
    return {
      kind: "PREDICATE",
      predicateKey,
      actorBinding,
      actorCombination,
      forbiddenAliases: validateAliases(
        node.forbiddenAliases,
        `${detail}:forbiddenAliases`
      ),
      requiredGroups,
    };
  }
  exactKeys(
    node,
    ["kind", "operator", "operatorAliases", "operands"],
    "COVERAGE_CONDITION_FORMULA_OPERATOR_INVALID",
    detail
  );
  if (
    node.kind !== "OPERATOR" ||
    !ALLOWED_OPERATORS.has(node.operator) ||
    !Array.isArray(node.operands) ||
    node.operands.length !== 2
  )
    throw formulaError("COVERAGE_CONDITION_FORMULA_OPERATOR_INVALID", detail);
  return {
    kind: "OPERATOR",
    operator: node.operator,
    operatorAliases: validateAliases(
      node.operatorAliases,
      `${detail}:operatorAliases`
    ),
    operands: node.operands.map((operand, index) =>
      validateFormulaNode(operand, `${detail}:operands[${index}]`, predicateKeys)
    ),
  };
}

function validateCoverageConditionFormulaContract(contract, detail = "contract") {
  exactKeys(
    contract,
    [
      "contractId",
      "formulaKey",
      "sourcePolicy",
      "targetScopePolicy",
      "targetCoverageGovernorAliases",
      "governorRequiredGroups",
      "formula",
    ],
    "COVERAGE_CONDITION_FORMULA_CONTRACT_INVALID",
    detail
  );
  if (
    contract.contractId !==
      SOURCE_BOUND_COVERAGE_CONDITION_FORMULA_CONTRACT_ID ||
    contract.sourcePolicy !== SOURCE_POLICY ||
    contract.targetScopePolicy !== TARGET_SCOPE_POLICY
  )
    throw formulaError("COVERAGE_CONDITION_FORMULA_CONTRACT_INVALID", detail);
  const predicateKeys = new Set();
  const formula = validateFormulaNode(
    contract.formula,
    `${detail}:formula`,
    predicateKeys
  );
  if (formula.kind !== "OPERATOR" || formula.operator !== "AND")
    throw formulaError("COVERAGE_CONDITION_FORMULA_ROOT_INVALID", detail);
  return {
    contractId: SOURCE_BOUND_COVERAGE_CONDITION_FORMULA_CONTRACT_ID,
    formulaKey: requiredConceptKey(
      contract.formulaKey,
      "COVERAGE_CONDITION_FORMULA_KEY_INVALID",
      detail
    ),
    sourcePolicy: SOURCE_POLICY,
    targetScopePolicy: TARGET_SCOPE_POLICY,
    targetCoverageGovernorAliases: validateAliases(
      contract.targetCoverageGovernorAliases,
      `${detail}:targetCoverageGovernorAliases`
    ),
    governorRequiredGroups: validateRequiredGroups(
      contract.governorRequiredGroups,
      `${detail}:governorRequiredGroups`
    ),
    formula,
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

function allAliasSpans(sourceText, aliases) {
  const source = normalizeWithOffsets(sourceText);
  const matches = [];
  for (const alias of aliases) {
    const normalizedAlias = normalizeWithOffsets(alias).text;
    let start = source.text.indexOf(normalizedAlias);
    while (start !== -1) {
      const end = start + normalizedAlias.length;
      const before = source.text[start - 1] || "";
      const after = source.text[end] || "";
      if (!/[\p{L}\p{N}]/u.test(before) && !/[\p{L}\p{N}]/u.test(after))
        matches.push({
          matchedAlias: alias,
          start: source.offsets[start],
          end: source.offsets[end - 1] + 1,
        });
      start = source.text.indexOf(normalizedAlias, start + 1);
    }
  }
  return [
    ...new Map(
      matches.map((match) => [`${match.start}:${match.end}`, match])
    ).values(),
  ].sort((left, right) => left.start - right.start || left.end - right.end);
}

function orderedAliasSequences(groups, limit = 2) {
  let sequences = [[]];
  for (const matches of groups) {
    const next = [];
    for (const sequence of sequences) {
      const previous = sequence.at(-1);
      for (const match of matches) {
        if (previous && match.start < previous.end) continue;
        next.push([...sequence, match]);
        if (next.length >= limit) break;
      }
      if (next.length >= limit) break;
    }
    sequences = next;
    if (sequences.length === 0) break;
  }
  return sequences;
}

function nonContainedAliasSpans(text, aliases) {
  return allAliasSpans(text, aliases).filter(
    (match, _index, matches) =>
      !matches.some(
        (other) =>
          other !== match &&
          other.start <= match.start &&
          other.end >= match.end &&
          (other.start < match.start || other.end > match.end)
      )
  );
}

function completeDocumentIdentity(documentArtifact) {
  const document = documentArtifact?.document;
  const fingerprint = documentArtifact?.fingerprint;
  const extraction = document?.pdfExtraction;
  if (
    documentArtifact?.schemaVersion !== 1 ||
    !/^[a-f0-9]{64}$/u.test(String(fingerprint || "")) ||
    document?.sourceDocumentId !== fingerprint ||
    typeof document?.pageContent !== "string" ||
    document.pageContent.length === 0 ||
    !Array.isArray(document?.pageMap) ||
    document.pageMap.length === 0 ||
    extraction?.schemaVersion !== 1 ||
    extraction?.complete !== true ||
    extraction.totalPages !== document.pageMap.length ||
    extraction.processedPages !== extraction.totalPages ||
    extraction.pagesWithText !== extraction.totalPages
  )
    return null;
  let previousEnd = -1;
  for (let index = 0; index < document.pageMap.length; index += 1) {
    const page = document.pageMap[index];
    if (
      page?.pageNumber !== index + 1 ||
      !Number.isInteger(page.start) ||
      !Number.isInteger(page.end) ||
      page.start < 0 ||
      page.end <= page.start ||
      page.end > document.pageContent.length ||
      page.start < previousEnd
    )
      return null;
    previousEnd = page.end;
  }
  return {
    fingerprint,
    text: document.pageContent,
    pages: document.pageMap,
  };
}

function sourceBoundSpan(identity, span) {
  if (
    !Number.isInteger(span?.physicalPageNumber) ||
    span.physicalPageNumber < 1 ||
    !Number.isInteger(span?.documentStart) ||
    !Number.isInteger(span?.documentEnd) ||
    span.documentEnd <= span.documentStart ||
    typeof span?.exactText !== "string" ||
    span.exactText.length !== span.documentEnd - span.documentStart ||
    identity.text.slice(span.documentStart, span.documentEnd) !== span.exactText
  )
    return false;
  const page = identity.pages.find(
    ({ pageNumber }) => pageNumber === span.physicalPageNumber
  );
  return Boolean(
    page && span.documentStart >= page.start && span.documentEnd <= page.end
  );
}

function paragraphSpans(identity) {
  const paragraphs = [];
  for (const page of identity.pages) {
    const pageText = identity.text.slice(page.start, page.end);
    const separator = /\r?\n[\t ]*\r?\n/gu;
    let segmentStart = 0;
    const addSegment = (segmentEnd) => {
      let start = segmentStart;
      let end = segmentEnd;
      while (start < end && /\s/u.test(pageText[start])) start += 1;
      while (end > start && /\s/u.test(pageText[end - 1])) end -= 1;
      if (end > start)
        paragraphs.push({
          physicalPageNumber: page.pageNumber,
          documentStart: page.start + start,
          documentEnd: page.start + end,
          exactText: pageText.slice(start, end),
        });
    };
    for (const match of pageText.matchAll(separator)) {
      addSegment(match.index);
      segmentStart = match.index + match[0].length;
    }
    addSegment(pageText.length);
  }
  return paragraphs;
}

function uniqueOrderedMatches(text, requiredGroups) {
  const groups = requiredGroups.map((aliases) => allAliasSpans(text, aliases));
  if (groups.some((matches) => matches.length === 0)) return null;
  const sequences = orderedAliasSequences(groups);
  return sequences.length === 1 ? sequences[0] : null;
}

function evidenceSpan({ paragraph, localStart, localEnd, source }) {
  const exactText = paragraph.exactText.slice(localStart, localEnd);
  return {
    source,
    physicalPageNumber: paragraph.physicalPageNumber,
    documentStart: paragraph.documentStart + localStart,
    documentEnd: paragraph.documentStart + localEnd,
    exactText,
    sha256: textDigest(exactText),
  };
}

function predicateEvidence(node, paragraph) {
  const matches = uniqueOrderedMatches(
    paragraph.exactText,
    node.requiredGroups
  );
  if (!matches) return null;
  const start = matches[0].start;
  const end = matches.at(-1).end;
  const predicateText = paragraph.exactText.slice(start, end);
  if (allAliasSpans(predicateText, node.forbiddenAliases).length > 0)
    return null;
  const groupSpans = matches.map((match) =>
    evidenceSpan({
      paragraph,
      localStart: match.start,
      localEnd: match.end,
      source: "GOVERNOR_PREDICATE_GROUP",
    })
  );
  let actorCombination = null;
  if (node.actorCombination) {
    const left = matches[node.actorCombination.leftGroupIndex];
    const right = matches[node.actorCombination.rightGroupIndex];
    const between = paragraph.exactText.slice(left.end, right.start);
    const operators = nonContainedAliasSpans(
      between,
      node.actorCombination.operatorAliases
    );
    if (operators.length !== 1) return null;
    actorCombination = {
      operator: node.actorCombination.operator,
      operatorSpan: evidenceSpan({
        paragraph,
        localStart: left.end + operators[0].start,
        localEnd: left.end + operators[0].end,
        source: "GOVERNOR_ACTOR_OPERATOR",
      }),
    };
  }
  return {
    kind: "PREDICATE",
    predicateKey: node.predicateKey,
    actorBinding: node.actorBinding,
    actorCombination,
    span: evidenceSpan({
      paragraph,
      localStart: start,
      localEnd: end,
      source: "GOVERNOR_PREDICATE",
    }),
    groupSpans,
  };
}

function formulaLeaves(node) {
  if (node.kind === "PREDICATE") return [node];
  return node.operands.flatMap(formulaLeaves);
}

function materializeFormulaNode(node, predicateByKey, paragraph) {
  if (node.kind === "PREDICATE") return predicateByKey.get(node.predicateKey);
  const operands = node.operands.map((operand) =>
    materializeFormulaNode(operand, predicateByKey, paragraph)
  );
  if (operands.some((operand) => !operand)) return null;
  const leftEnd = operands[0].span.documentEnd - paragraph.documentStart;
  const rightStart = operands[1].span.documentStart - paragraph.documentStart;
  if (rightStart < leftEnd) return null;
  const between = paragraph.exactText.slice(leftEnd, rightStart);
  const operatorMatches = nonContainedAliasSpans(
    between,
    node.operatorAliases
  );
  if (operatorMatches.length !== 1) return null;
  const operatorMatch = operatorMatches[0];
  return {
    kind: "OPERATOR",
    operator: node.operator,
    operatorSpan: evidenceSpan({
      paragraph,
      localStart: leftEnd + operatorMatch.start,
      localEnd: leftEnd + operatorMatch.end,
      source: "GOVERNOR_FORMULA_OPERATOR",
    }),
    operands,
    span: evidenceSpan({
      paragraph,
      localStart: operands[0].span.documentStart - paragraph.documentStart,
      localEnd: operands[1].span.documentEnd - paragraph.documentStart,
      source: "GOVERNOR_FORMULA",
    }),
  };
}

function completeFormulaEvidence(contract, paragraph) {
  if (!uniqueOrderedMatches(paragraph.exactText, contract.governorRequiredGroups))
    return null;
  const leaves = formulaLeaves(contract.formula);
  const predicates = leaves.map((node) => predicateEvidence(node, paragraph));
  if (predicates.some((predicate) => !predicate)) return null;
  for (let index = 1; index < predicates.length; index += 1)
    if (predicates[index].span.documentStart < predicates[index - 1].span.documentEnd)
      return null;
  const predicateByKey = new Map(
    predicates.map((predicate) => [predicate.predicateKey, predicate])
  );
  return materializeFormulaNode(contract.formula, predicateByKey, paragraph);
}

function validatedTargetGovernor(identity, candidate, target) {
  const hint = candidate?.coverageGovernorHint;
  if (hint === null || hint === undefined)
    return { valid: true, span: null };
  const governorPageNumber = Number.isInteger(hint.physicalPageNumber)
    ? hint.physicalPageNumber
    : target.physicalPageNumber;
  const page = identity.pages.find(
    ({ pageNumber }) => pageNumber === governorPageNumber
  );
  if (
    !page ||
    !Number.isInteger(hint.pageStart) ||
    !Number.isInteger(hint.pageEnd) ||
    hint.pageStart < 0 ||
    hint.pageEnd <= hint.pageStart ||
    governorPageNumber > target.physicalPageNumber ||
    page.start + hint.pageEnd > target.documentStart ||
    page.start + hint.pageEnd > page.end ||
    typeof hint.text !== "string"
  )
    return { valid: false, span: null };
  const exactText = identity.text.slice(
    page.start + hint.pageStart,
    page.start + hint.pageEnd
  );
  if (exactText !== hint.text)
    return { valid: false, span: null };
  return {
    valid: true,
    span: {
      source: "TARGET_COVERAGE_GOVERNOR",
      physicalPageNumber: page.pageNumber,
      documentStart: page.start + hint.pageStart,
      documentEnd: page.start + hint.pageEnd,
      exactText,
      sha256: textDigest(exactText),
    },
  };
}

function validatedTargets(identity, targetCandidates, contract) {
  if (!Array.isArray(targetCandidates) || targetCandidates.length === 0)
    return null;
  const allTargets = [];
  const linkedTargets = [];
  const ids = new Set();
  for (const candidate of targetCandidates) {
    const candidateId = String(candidate?.candidateId || "").trim();
    const span = {
      physicalPageNumber: candidate?.physicalPageNumber,
      documentStart: candidate?.documentStart,
      documentEnd: candidate?.documentEnd,
      exactText: candidate?.exactText,
    };
    if (!candidateId || ids.has(candidateId) || !sourceBoundSpan(identity, span))
      return null;
    ids.add(candidateId);
    const target = {
      candidateId,
      ...span,
      sha256: textDigest(span.exactText),
    };
    allTargets.push(target);
    const governor = validatedTargetGovernor(identity, candidate, target);
    if (!governor.valid) return null;
    if (!governor.span) continue;
    const normalizedGovernor = normalizedText(governor.span.exactText);
    const matchingAliases = contract.targetCoverageGovernorAliases.filter(
      (alias) => normalizedText(alias) === normalizedGovernor
    );
    if (matchingAliases.length !== 1) continue;
    linkedTargets.push({
      ...target,
      coverageGovernorSpan: governor.span,
    });
  }
  if (linkedTargets.length === 0) return null;
  const sortTargets = (targets) =>
    targets.sort(
      (left, right) =>
        left.documentStart - right.documentStart ||
        left.candidateId.localeCompare(right.candidateId)
    );
  return {
    allTargets: sortTargets(allTargets),
    linkedTargets: sortTargets(linkedTargets),
  };
}

/**
 * Builds an outcome-neutral proof that a source-exact global prerequisite
 * formula governs the supplied source-exact target candidates.
 */
function buildSourceBoundCoverageConditionFormulaProof({
  contract,
  documentArtifact,
  targetCandidates,
}) {
  const validatedContract = validateCoverageConditionFormulaContract(contract);
  const identity = completeDocumentIdentity(documentArtifact);
  if (!identity) return null;
  const targetSelection = validatedTargets(
    identity,
    targetCandidates,
    validatedContract
  );
  if (!targetSelection) return null;
  const { allTargets, linkedTargets } = targetSelection;
  const matches = paragraphSpans(identity)
    .map((paragraph) => ({
      paragraph,
      formula: completeFormulaEvidence(validatedContract, paragraph),
    }))
    .filter(
      ({ paragraph, formula }) =>
        formula &&
        allTargets.every(
          (target) => target.documentStart > paragraph.documentEnd
        )
    );
  if (matches.length !== 1) return null;
  const [{ paragraph, formula }] = matches;
  const governorSpan = {
    source: SOURCE_POLICY,
    physicalPageNumber: paragraph.physicalPageNumber,
    documentStart: paragraph.documentStart,
    documentEnd: paragraph.documentEnd,
    exactText: paragraph.exactText,
    sha256: textDigest(paragraph.exactText),
  };
  const payload = {
    schemaVersion: 1,
    contractId: SOURCE_BOUND_COVERAGE_CONDITION_FORMULA_CONTRACT_ID,
    evidenceContractDigest: digest(validatedContract),
    documentFingerprint: identity.fingerprint,
    formulaKey: validatedContract.formulaKey,
    sourcePolicy: SOURCE_POLICY,
    targetScopePolicy: TARGET_SCOPE_POLICY,
    governorSpan,
    formula,
    targets: linkedTargets,
    satisfaction: SATISFACTION,
    readyForDecision: false,
  };
  return { ...payload, proofDigest: digest(payload) };
}

function validSourceBoundCoverageConditionFormulaProof({
  contract,
  documentArtifact,
  targetCandidates,
  proof,
}) {
  try {
    const expected = buildSourceBoundCoverageConditionFormulaProof({
      contract,
      documentArtifact,
      targetCandidates,
    });
    return Boolean(
      expected &&
        JSON.stringify(canonical(expected)) === JSON.stringify(canonical(proof))
    );
  } catch {
    return false;
  }
}

module.exports = {
  SATISFACTION,
  SOURCE_BOUND_COVERAGE_CONDITION_FORMULA_CONTRACT_ID,
  SOURCE_POLICY,
  TARGET_SCOPE_POLICY,
  buildSourceBoundCoverageConditionFormulaProof,
  validateCoverageConditionFormulaContract,
  validSourceBoundCoverageConditionFormulaProof,
};

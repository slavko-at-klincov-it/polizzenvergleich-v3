const REQUESTED_FIELD_STATUS = Object.freeze({
  NOT_REQUIRED: "NOT_REQUIRED",
  NOT_FOUND: "NOT_FOUND",
  PARTIAL: "PARTIAL",
  COMPLETE: "COMPLETE",
});

const FIELD_EVIDENCE_STATUS = Object.freeze({
  NOT_FOUND: "NOT_FOUND",
  FOUND: "FOUND",
});

const VALUE_BINDING = Object.freeze({
  DIRECT: "DIRECT",
  NARROW_SCOPE: "NARROW_SCOPE",
});

const ALLOWED_CANDIDATE_BINDINGS = new Set([
  ...Object.values(VALUE_BINDING),
  "MENTION_ONLY",
  "UNRESOLVED",
]);

function requestedFieldError(code, detail = "") {
  const error = new Error(detail ? `${code}: ${detail}` : code);
  error.code = code;
  return error;
}

function validateWorksheetAndIndexCandidates(worksheet) {
  if (
    worksheet?.candidateOnly !== true ||
    !Array.isArray(worksheet.requirements)
  )
    throw requestedFieldError("REQUESTED_FIELD_WORKSHEET_INVALID");

  const candidateById = new Map();
  for (const requirement of worksheet.requirements) {
    if (
      typeof requirement?.id !== "string" ||
      !Array.isArray(requirement.components)
    )
      throw requestedFieldError(
        "REQUESTED_FIELD_WORKSHEET_INVALID",
        String(requirement?.id || "requirement")
      );
    for (const component of requirement.components) {
      if (!Array.isArray(component?.occurrences))
        throw requestedFieldError(
          "REQUESTED_FIELD_WORKSHEET_INVALID",
          `${requirement.id}:${String(component?.id || "component")}`
        );
      for (const occurrence of component.occurrences) {
        const candidateId = String(occurrence?.candidateId || "");
        if (!candidateId.startsWith("candidate:"))
          throw requestedFieldError(
            "REQUESTED_FIELD_CANDIDATE_ID_INVALID",
            candidateId
          );
        if (candidateById.has(candidateId))
          throw requestedFieldError(
            "REQUESTED_FIELD_WORKSHEET_CANDIDATE_DUPLICATE",
            candidateId
          );
        candidateById.set(candidateId, { requirement, occurrence });
      }
    }
  }
  return candidateById;
}

function selectedCandidateBindings({ materializedCandidates, candidateById }) {
  if (!Array.isArray(materializedCandidates))
    throw requestedFieldError("REQUESTED_FIELD_CANDIDATES_INVALID");

  const bindingByCandidateId = new Map();
  for (const candidate of materializedCandidates) {
    const candidateId = String(candidate?.candidateId || "");
    if (!candidateById.has(candidateId))
      throw requestedFieldError(
        "REQUESTED_FIELD_CANDIDATE_UNKNOWN",
        candidateId
      );
    if (bindingByCandidateId.has(candidateId))
      throw requestedFieldError(
        "REQUESTED_FIELD_CANDIDATE_DUPLICATE",
        candidateId
      );
    if (!ALLOWED_CANDIDATE_BINDINGS.has(candidate.binding))
      throw requestedFieldError(
        "REQUESTED_FIELD_BINDING_INVALID",
        `${candidateId}:${String(candidate.binding)}`
      );
    bindingByCandidateId.set(candidateId, candidate.binding);
  }
  return bindingByCandidateId;
}

function validatedContext(occurrence) {
  const text = occurrence?.context?.text;
  const documentStart = Number(occurrence?.context?.documentStart);
  const documentEnd = Number(occurrence?.context?.documentEnd);
  if (
    typeof text !== "string" ||
    !Number.isInteger(documentStart) ||
    !Number.isInteger(documentEnd) ||
    documentStart < 0 ||
    documentEnd !== documentStart + text.length
  )
    throw requestedFieldError(
      "REQUESTED_FIELD_CONTEXT_INVALID",
      String(occurrence?.candidateId || "")
    );
  return { text, documentStart };
}

function sourceBoundFact({ occurrence, binding, match, value }) {
  const context = validatedContext(occurrence);
  const rawValue = context.text.slice(
    match.index,
    match.index + match[0].length
  );
  if (rawValue !== match[0])
    throw requestedFieldError(
      "REQUESTED_FIELD_SOURCE_RANGE_INVALID",
      occurrence.candidateId
    );
  return {
    rawValue,
    normalizedValue: value.normalizedValue,
    valueType: value.valueType,
    unit: value.unit,
    binding,
    source: {
      candidateId: occurrence.candidateId,
      pageNumber: occurrence.pageNumber,
      physicalPageNumber:
        occurrence.physicalPageNumber || occurrence.pageNumber,
      printedPageLabel: occurrence.printedPageLabel || null,
      documentStart: context.documentStart + match.index,
      documentEnd: context.documentStart + match.index + rawValue.length,
      exactText: rawValue,
    },
  };
}

function valueFollowsCandidate(occurrence, match) {
  const context = validatedContext(occurrence);
  const occurrenceStart = Number(occurrence?.documentStart);
  if (
    !Number.isInteger(occurrenceStart) ||
    occurrenceStart < context.documentStart ||
    occurrenceStart > context.documentStart + context.text.length
  )
    throw requestedFieldError(
      "REQUESTED_FIELD_OCCURRENCE_RANGE_INVALID",
      String(occurrence?.candidateId || "")
    );
  return match.index >= occurrenceStart - context.documentStart;
}

function extractLimitFacts({ occurrence, binding }) {
  const { text } = validatedContext(occurrence);
  const matches = [];
  const moneyPattern =
    /(?<![\p{L}\p{N}])EUR\s*\d+(?:\.\d{3})*(?:,\d{2})?(?![\p{L}\p{N}])/giu;
  for (const match of text.matchAll(moneyPattern)) {
    if (!valueFollowsCandidate(occurrence, match)) continue;
    const amount = match[0].replace(/^EUR\s*/iu, "");
    matches.push(
      sourceBoundFact({
        occurrence,
        binding,
        match,
        value: {
          normalizedValue: `EUR ${amount}`,
          valueType: "MONEY",
          unit: "EUR",
        },
      })
    );
  }

  const percentPattern =
    /(?<![\p{L}\p{N}])(?:\d{1,3}|[lI]0)\s*%(?![\p{L}\p{N}])/gu;
  for (const match of text.matchAll(percentPattern)) {
    if (!valueFollowsCandidate(occurrence, match)) continue;
    const compact = match[0].replace(/\s/gu, "");
    const numeric = /^[lI]0%$/u.test(compact) ? "10" : compact.slice(0, -1);
    matches.push(
      sourceBoundFact({
        occurrence,
        binding,
        match,
        value: {
          normalizedValue: `${numeric} %`,
          valueType: "PERCENT",
          unit: "%",
        },
      })
    );
  }
  return matches.sort(
    (left, right) => left.source.documentStart - right.source.documentStart
  );
}

const GERMAN_MONTH_NUMBERS = Object.freeze({
  ein: 1,
  eine: 1,
  einem: 1,
  einen: 1,
  einer: 1,
  eins: 1,
  zwei: 2,
  drei: 3,
  vier: 4,
  fuenf: 5,
  fünf: 5,
  sechs: 6,
  sieben: 7,
  acht: 8,
  neun: 9,
  zehn: 10,
  elf: 11,
  zwoelf: 12,
  zwölf: 12,
});

function extractDurationFacts({ occurrence, binding }) {
  const { text } = validatedContext(occurrence);
  const durationPattern =
    /(?<![\p{L}\p{N}])(?:\d{1,3}|ein(?:e[rmn]?)?|eins|zwei|drei|vier|f(?:ue|ü)nf|sechs|sieben|acht|neun|zehn|elf|zw(?:oe|ö)lf)\s+Monat(?:e|en)?(?![\p{L}\p{N}])/giu;
  return [...text.matchAll(durationPattern)]
    .filter((match) => valueFollowsCandidate(occurrence, match))
    .map((match) => {
      const rawNumber = match[0].trim().split(/\s+/u)[0];
      const normalizedWord = rawNumber
        .normalize("NFKC")
        .toLocaleLowerCase("de");
      const months = /^\d+$/u.test(normalizedWord)
        ? Number(normalizedWord)
        : GERMAN_MONTH_NUMBERS[normalizedWord];
      if (!Number.isInteger(months))
        throw requestedFieldError("REQUESTED_FIELD_DURATION_INVALID", match[0]);
      return sourceBoundFact({
        occurrence,
        binding,
        match,
        value: {
          normalizedValue: `${months} ${months === 1 ? "Monat" : "Monate"}`,
          valueType: "DURATION",
          unit: "MONTH",
        },
      });
    });
}

function extractorFor(requirementId, field) {
  if (requirementId === "VS-21" && field === "limit") return extractLimitFacts;
  if (requirementId === "VS-28" && field === "duration")
    return extractDurationFacts;
  return null;
}

function extractPreferredFacts({
  requirement,
  field,
  candidateById,
  bindingByCandidateId,
}) {
  const extractor = extractorFor(requirement.id, field);
  if (!extractor) return [];

  const factsByBinding = new Map(
    Object.values(VALUE_BINDING).map((binding) => [binding, []])
  );
  for (const [candidateId, binding] of bindingByCandidateId) {
    if (!factsByBinding.has(binding)) continue;
    const indexed = candidateById.get(candidateId);
    if (indexed.requirement.id !== requirement.id) continue;
    factsByBinding
      .get(binding)
      .push(...extractor({ occurrence: indexed.occurrence, binding }));
  }

  const directFacts = factsByBinding.get(VALUE_BINDING.DIRECT);
  return directFacts.length > 0
    ? directFacts
    : factsByBinding.get(VALUE_BINDING.NARROW_SCOPE);
}

function aggregateRequestedFieldStatus(fields) {
  if (fields.length === 0) return REQUESTED_FIELD_STATUS.NOT_REQUIRED;
  const foundCount = fields.filter(
    ({ status }) => status === FIELD_EVIDENCE_STATUS.FOUND
  ).length;
  if (foundCount === fields.length) return REQUESTED_FIELD_STATUS.COMPLETE;
  if (foundCount === 0) return REQUESTED_FIELD_STATUS.NOT_FOUND;
  return REQUESTED_FIELD_STATUS.PARTIAL;
}

/**
 * Binds deterministic VS pilot values to server-owned candidate sources.
 * Inputs: a controlled occurrence worksheet and materialized triage bindings.
 * Output: per-requirement limit/duration facts with exact source ranges.
 * Side effects: none. It never reads values or source metadata from the model.
 * Role: transform.
 */
function materializeRequestedFieldEvidence({
  worksheet,
  materializedCandidates,
}) {
  const candidateById = validateWorksheetAndIndexCandidates(worksheet);
  const bindingByCandidateId = selectedCandidateBindings({
    materializedCandidates,
    candidateById,
  });

  const requirements = worksheet.requirements.map((requirement) => {
    const requestedFields = Array.isArray(requirement.requestedFields)
      ? [...requirement.requestedFields]
      : [];
    const fields = requestedFields.map((field) => {
      const facts = extractPreferredFacts({
        requirement,
        field,
        candidateById,
        bindingByCandidateId,
      });
      return {
        field,
        status:
          facts.length > 0
            ? FIELD_EVIDENCE_STATUS.FOUND
            : FIELD_EVIDENCE_STATUS.NOT_FOUND,
        facts,
      };
    });
    return {
      requirementId: requirement.id,
      requestedFields,
      requestedFieldStatus: aggregateRequestedFieldStatus(fields),
      fields,
    };
  });
  return { requirements };
}

module.exports = {
  FIELD_EVIDENCE_STATUS,
  REQUESTED_FIELD_STATUS,
  VALUE_BINDING,
  materializeRequestedFieldEvidence,
};

const {
  CONFLICT_STATE,
  COVERAGE_EFFECT,
  COVERAGE_PICTURE,
  EVIDENCE_COMPLETENESS,
  EVIDENCE_PRESENCE,
  REVIEW_STATUS,
} = require("./categoryResultContract");
const { DOCUMENT_STATUS } = require("./preparedEvidenceContract");

const CATEGORY_TABLE_HEADERS = Object.freeze([
  "Kategorie-ID",
  "Stufe",
  "Kategorie-Name",
  "Belegter Vertragsinhalt",
  "Deckung",
  "Deckungssumme",
  "Quelle",
  "Prüfstatus",
]);
const MISSING_EVIDENCE = "keine belegte Fundstelle gefunden";
const NOT_DETERMINABLE = "Nicht feststellbar";

function rendererError(code, detail = "") {
  const error = new Error(detail ? `${code}: ${detail}` : code);
  error.code = code;
  return error;
}

function requireArray(value, code) {
  if (!Array.isArray(value)) throw rendererError(code);
  return value;
}

function escapeCell(value) {
  return String(value == null ? "" : value)
    .replace(/\r?\n/gu, " ")
    .replace(/\\/gu, "\\\\")
    .replace(/\|/gu, "\\|")
    .trim();
}

function unknownRow(definition) {
  return Object.freeze({
    categoryId: definition.id,
    stage: definition.stage,
    categoryName: definition.label,
    documentedContent: MISSING_EVIDENCE,
    coverage: NOT_DETERMINABLE,
    coverageAmount: NOT_DETERMINABLE,
    source: MISSING_EVIDENCE,
    reviewStatus: REVIEW_STATUS.UNGEKLAERT,
  });
}

function candidateIndex(worksheet) {
  const candidates = new Map();
  for (const requirement of requireArray(
    worksheet?.requirements,
    "RENDERER_WORKSHEET_INVALID"
  )) {
    for (const component of requireArray(
      requirement.components,
      "RENDERER_COMPONENTS_INVALID"
    )) {
      for (const occurrence of requireArray(
        component.occurrences,
        "RENDERER_OCCURRENCES_INVALID"
      )) {
        const candidateId = String(occurrence.candidateId || "").trim();
        if (!candidateId) throw rendererError("RENDERER_CANDIDATE_ID_REQUIRED");
        if (candidates.has(candidateId))
          throw rendererError("RENDERER_CANDIDATE_ID_DUPLICATE", candidateId);
        candidates.set(candidateId, {
          ...occurrence,
          requirementId: requirement.id,
          componentId: component.id,
        });
      }
    }
  }
  return candidates;
}

function requestedFieldRequirements(materialization) {
  if (Array.isArray(materialization)) return materialization;
  if (Array.isArray(materialization?.requirements))
    return materialization.requirements;
  return [];
}

function compactQuote(text, needle, maxChars = 260) {
  const normalizedText = String(text || "")
    .replace(/\s+/gu, " ")
    .trim();
  const normalizedNeedle = String(needle || "")
    .replace(/\s+/gu, " ")
    .trim();
  if (!normalizedText || normalizedText.length <= maxChars)
    return normalizedText;
  const matchIndex = normalizedNeedle
    ? normalizedText.indexOf(normalizedNeedle)
    : -1;
  const center = matchIndex >= 0 ? matchIndex : Math.floor(maxChars / 2);
  let start = Math.max(0, center - Math.floor(maxChars * 0.4));
  let end = Math.min(normalizedText.length, start + maxChars);
  if (end === normalizedText.length) start = Math.max(0, end - maxChars);
  while (start > 0 && normalizedText[start - 1] !== " ") start -= 1;
  while (end < normalizedText.length && normalizedText[end] !== " ") end += 1;
  return normalizedText.slice(start, end).trim();
}

function selectedSources({
  requirementId,
  judgements,
  fieldResult,
  candidates,
}) {
  const candidateIds = [];
  for (const judgement of judgements) {
    if (judgement.requirementId !== requirementId) continue;
    candidateIds.push(...(judgement.selectedCandidateIds || []));
  }
  for (const field of fieldResult?.fields || [])
    for (const fact of field.facts || [])
      if (fact.source?.candidateId) candidateIds.push(fact.source.candidateId);

  const sources = [];
  const seen = new Set();
  for (const candidateId of candidateIds) {
    if (seen.has(candidateId)) continue;
    seen.add(candidateId);
    const occurrence = candidates.get(candidateId);
    if (!occurrence || occurrence.requirementId !== requirementId) continue;
    const physicalPageNumber = Number(
      occurrence.physicalPageNumber || occurrence.pageNumber
    );
    const contextText = String(
      occurrence.context?.text || occurrence.exactText || ""
    ).trim();
    const quote = compactQuote(contextText, occurrence.exactText);
    if (
      !Number.isInteger(physicalPageNumber) ||
      physicalPageNumber < 1 ||
      !quote
    )
      continue;
    sources.push({ candidateId, physicalPageNumber, quote });

    const fieldFacts = (fieldResult?.fields || []).flatMap(
      ({ facts }) => facts || []
    );
    for (const fact of fieldFacts.filter(
      ({ source }) => source?.candidateId === candidateId
    )) {
      const factQuote = compactQuote(
        contextText,
        fact.rawValue || fact.source?.exactText
      );
      const factKey = `${physicalPageNumber}:${factQuote}`;
      if (!factQuote || seen.has(factKey)) continue;
      seen.add(factKey);
      sources.push({ candidateId, physicalPageNumber, quote: factQuote });
    }
  }
  const unique = [];
  const quoteKeys = new Set();
  for (const source of sources) {
    const key = `${source.physicalPageNumber}:${source.quote}`;
    if (quoteKeys.has(key)) continue;
    quoteKeys.add(key);
    unique.push(source);
  }
  return unique;
}

function componentDescription(requirement, judgements) {
  const judgementByComponent = new Map(
    judgements.map((judgement) => [judgement.componentId, judgement])
  );
  return requirement.components
    .map((component) => {
      const effect = judgementByComponent.get(component.id)?.coverageEffect;
      const suffix = {
        [COVERAGE_EFFECT.INCLUDED]: "eingeschlossen",
        [COVERAGE_EFFECT.EXCLUDED]: "ausgeschlossen",
        [COVERAGE_EFFECT.DEFINED]: "geregelt",
        [COVERAGE_EFFECT.CONDITIONAL]: "bedingt geregelt",
        [COVERAGE_EFFECT.OPTION_ONLY]: "nur als Option genannt",
        [COVERAGE_EFFECT.UNKNOWN]: "nicht feststellbar",
      }[effect];
      return `${component.label}: ${suffix || MISSING_EVIDENCE}`;
    })
    .join("; ");
}

function fieldFacts(fieldResult, fieldName, candidates, requirementId) {
  const field = (fieldResult?.fields || []).find(
    (candidate) => candidate.field === fieldName
  );
  if (field?.status !== "FOUND" || !Array.isArray(field.facts)) return [];
  return field.facts.filter((fact) => {
    const candidateId = fact.source?.candidateId;
    const source = candidates.get(candidateId);
    return (
      typeof fact.normalizedValue === "string" &&
      fact.normalizedValue.trim().length > 0 &&
      typeof candidateId === "string" &&
      candidateId.trim().length > 0 &&
      source?.requirementId === requirementId
    );
  });
}

function uniqueNormalizedValues(facts) {
  return [...new Set(facts.map(({ normalizedValue }) => normalizedValue))];
}

function fieldComplete(rollup, fieldResult, candidates) {
  if (
    !Array.isArray(rollup.requestedFields) ||
    rollup.requestedFields.length === 0
  )
    return true;
  return (
    fieldResult?.requestedFieldStatus === "COMPLETE" &&
    rollup.requestedFields.every((fieldName) => {
      const field = (fieldResult.fields || []).find(
        (candidate) => candidate.field === fieldName
      );
      const facts = Array.isArray(field?.facts) ? field.facts : [];
      const validFacts = fieldFacts(
        fieldResult,
        fieldName,
        candidates,
        rollup.categoryId
      );
      return facts.length > 0 && validFacts.length === facts.length;
    })
  );
}

function evidenceSourcesBound(requirement, judgements, candidates) {
  const judgementsByComponent = new Map();
  for (const judgement of judgements) {
    if (judgementsByComponent.has(judgement.componentId)) return false;
    judgementsByComponent.set(judgement.componentId, judgement);
  }
  return requirement.components.every((component) => {
    const judgement = judgementsByComponent.get(component.id);
    if (!judgement) return false;
    if (judgement.evidencePresence === EVIDENCE_PRESENCE.NOT_FOUND)
      return (judgement.selectedCandidateIds || []).length === 0;
    if (judgement.evidencePresence !== EVIDENCE_PRESENCE.FOUND) return false;
    const selectedIds = judgement.selectedCandidateIds || [];
    return (
      selectedIds.length > 0 &&
      selectedIds.every((candidateId) => {
        const source = candidates.get(candidateId);
        return (
          source?.requirementId === requirement.id &&
          source?.componentId === component.id
        );
      })
    );
  });
}

function coverageFor(rollup) {
  if (rollup.coveragePicture === COVERAGE_PICTURE.INCLUDED) return "Ja";
  if (rollup.coveragePicture === COVERAGE_PICTURE.EXCLUDED) return "Nein";
  return NOT_DETERMINABLE;
}

function reviewFor({ rollup, valuesComplete, scopeComplete }) {
  if (rollup.conflictState === CONFLICT_STATE.ACTIVE_SAME_SCOPE)
    return REVIEW_STATUS.WIDERSPRUCHLICH;
  if (
    rollup.conflictState === CONFLICT_STATE.UNRESOLVED_PRECEDENCE ||
    rollup.reviewStatus === REVIEW_STATUS.UNGEKLAERT
  )
    return REVIEW_STATUS.UNGEKLAERT;
  if (
    rollup.evidenceCompleteness !== EVIDENCE_COMPLETENESS.COMPLETE ||
    !valuesComplete ||
    !scopeComplete ||
    rollup.coveragePicture === COVERAGE_PICTURE.MIXED ||
    rollup.coveragePicture === COVERAGE_PICTURE.NOT_DETERMINABLE
  )
    return REVIEW_STATUS.TEILBELEGT;
  return REVIEW_STATUS.BELEGT;
}

function sourceCell(sources) {
  return sources
    .map(
      ({ physicalPageNumber, quote }) =>
        `PDF-Seite ${physicalPageNumber}: „${quote}“`
    )
    .join("<br>");
}

/**
 * Converts server-materialized decisions into the existing category table.
 * Sources are always resolved from the deterministic worksheet; model/value
 * payloads can select a candidate ID but cannot author a page or quotation.
 * Role: render. Side effects: none.
 */
function buildCategoryTableRows({
  definitions,
  worksheet,
  materializedEvidence,
  requestedFieldMaterialization = [],
  documentStatus,
}) {
  requireArray(definitions, "RENDERER_DEFINITIONS_REQUIRED");
  if (!Object.values(DOCUMENT_STATUS).includes(documentStatus))
    throw rendererError("RENDERER_DOCUMENT_STATUS_INVALID", documentStatus);
  const requirements = requireArray(
    worksheet?.requirements,
    "RENDERER_WORKSHEET_INVALID"
  );
  const rollups = requireArray(
    materializedEvidence?.rollups,
    "RENDERER_ROLLUPS_INVALID"
  );
  const judgements = requireArray(
    materializedEvidence?.judgements,
    "RENDERER_JUDGEMENTS_INVALID"
  );
  const candidates = candidateIndex(worksheet);
  const fieldsByRequirement = new Map(
    requestedFieldRequirements(requestedFieldMaterialization).map((result) => [
      result.requirementId,
      result,
    ])
  );
  const requirementsById = new Map(
    requirements.map((requirement) => [requirement.id, requirement])
  );
  const rollupsById = new Map(
    rollups.map((rollup) => [rollup.categoryId, rollup])
  );

  return Object.freeze(
    definitions.map((definition) => {
      const normalized = {
        id: String(definition?.id || "").trim(),
        stage: String(definition?.stage || "").trim(),
        label: String(definition?.label || "").trim(),
      };
      if (!normalized.id || !normalized.stage || !normalized.label)
        throw rendererError("RENDERER_DEFINITION_INVALID");
      const requirement = requirementsById.get(normalized.id);
      const rollup = rollupsById.get(normalized.id);
      if (!requirement || !rollup) return unknownRow(normalized);

      const rowJudgements = judgements.filter(
        (judgement) => judgement.requirementId === normalized.id
      );
      const fieldResult = fieldsByRequirement.get(normalized.id);
      const valuesComplete = fieldComplete(rollup, fieldResult, candidates);
      const scopeComplete = rowJudgements.every(
        ({ selectedScopePicture, unresolvedCandidateIds = [] }) =>
          selectedScopePicture !== "NARROW_ONLY" &&
          unresolvedCandidateIds.length === 0
      );
      const reviewStatus = reviewFor({
        rollup,
        valuesComplete,
        scopeComplete,
      });
      if (reviewStatus === REVIEW_STATUS.UNGEKLAERT)
        return unknownRow(normalized);
      if (!evidenceSourcesBound(requirement, rowJudgements, candidates))
        return unknownRow(normalized);

      const sources = selectedSources({
        requirementId: normalized.id,
        judgements: rowJudgements,
        fieldResult,
        candidates,
      });
      // A non-unknown assertion without a server-owned physical source is not
      // renderable. Closing to the exact unknown row prevents false certainty.
      if (sources.length === 0) return unknownRow(normalized);

      let documentedContent = componentDescription(requirement, rowJudgements);
      const durationFacts = fieldFacts(
        fieldResult,
        "duration",
        candidates,
        normalized.id
      );
      if (durationFacts.length > 0)
        documentedContent += `; Dauer: ${uniqueNormalizedValues(
          durationFacts
        ).join(", ")}`;
      if (documentStatus === DOCUMENT_STATUS.PROPOSAL)
        documentedContent = `Vorschlag (PROPOSED_ONLY): ${documentedContent}`;

      const completeAssertion = reviewStatus === REVIEW_STATUS.BELEGT;
      const limitFacts = fieldFacts(
        fieldResult,
        "limit",
        candidates,
        normalized.id
      );
      return Object.freeze({
        categoryId: normalized.id,
        stage: normalized.stage,
        categoryName: normalized.label,
        documentedContent,
        coverage: completeAssertion ? coverageFor(rollup) : NOT_DETERMINABLE,
        coverageAmount:
          completeAssertion && limitFacts.length > 0
            ? uniqueNormalizedValues(limitFacts).join(", ")
            : NOT_DETERMINABLE,
        source: sourceCell(sources),
        reviewStatus,
      });
    })
  );
}

function renderCategoryTableMarkdown(options) {
  const rows = buildCategoryTableRows(options);
  const lines = [
    `| ${CATEGORY_TABLE_HEADERS.join(" | ")} |`,
    `|${CATEGORY_TABLE_HEADERS.map(() => "---").join("|")}|`,
  ];
  for (const row of rows)
    lines.push(
      `| ${[
        row.categoryId,
        row.stage,
        row.categoryName,
        row.documentedContent,
        row.coverage,
        row.coverageAmount,
        row.source,
        row.reviewStatus,
      ]
        .map(escapeCell)
        .join(" | ")} |`
    );
  return lines.join("\n");
}

module.exports = {
  CATEGORY_TABLE_HEADERS,
  MISSING_EVIDENCE,
  NOT_DETERMINABLE,
  buildCategoryTableRows,
  renderCategoryTableMarkdown,
};

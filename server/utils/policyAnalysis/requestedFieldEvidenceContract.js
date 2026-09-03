const {
  deterministicCategoryCandidateBinding,
} = require("./deterministicCategoryEvidenceRules");
const {
  FE_C07_COMPONENT_ID,
  buildFeC07ConditionAbsenceAudit,
} = require("./feC07ConditionAbsenceAudit");
const {
  RESIDUAL_VALUE_THRESHOLD_QUALIFIER,
  residualValueThresholdForOccurrence,
} = require("./residualValueThresholdContract");
const {
  buildBindingGroupFieldApplicability,
} = require("./requestedFieldBindingGroupContract");
const {
  EXACT_CLAUSE_CODE_FIELD_GOVERNOR_CONTRACT_ID,
  EXACT_CLAUSE_CODE_FIELD_GOVERNOR_POLICY,
} = require("./controlledOccurrenceWorksheet");
const {
  vs36MaximumIndemnityLimitForOccurrence,
} = require("./vs36MaximumIndemnityLimitContract");

const REQUESTED_FIELD_STATUS = Object.freeze({
  NOT_REQUIRED: "NOT_REQUIRED",
  NOT_EVALUATED: "NOT_EVALUATED",
  NOT_FOUND: "NOT_FOUND",
  PARTIAL: "PARTIAL",
  COMPLETE: "COMPLETE",
});

const FIELD_EVIDENCE_STATUS = Object.freeze({
  NOT_EVALUATED: "NOT_EVALUATED",
  NOT_FOUND: "NOT_FOUND",
  PARTIAL: "PARTIAL",
  FOUND: "FOUND",
});

const LIMIT_KIND = Object.freeze({
  CAPPED: "CAPPED",
  UNBOUNDED: "UNBOUNDED",
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
        candidateById.set(candidateId, {
          requirement,
          component,
          occurrence,
        });
      }
    }
  }
  return candidateById;
}

function selectedCandidateBindings({
  worksheet,
  materializedCandidates,
  candidateById,
}) {
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
    const indexed = candidateById.get(candidateId);
    const deterministicBinding = deterministicCategoryCandidateBinding({
      worksheet,
      requirement: indexed.requirement,
      component: indexed.component,
      occurrence: indexed.occurrence,
    });
    bindingByCandidateId.set(
      candidateId,
      deterministicBinding?.authoritative
        ? deterministicBinding.binding
        : candidate.binding
    );
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
  const variantScope = occurrence?.variantScopeHint;
  return {
    rawValue,
    normalizedValue: value.normalizedValue,
    valueType: value.valueType,
    unit: value.unit,
    ...(value.limitKind ? { limitKind: value.limitKind } : {}),
    ...(value.qualifier ? { qualifier: value.qualifier } : {}),
    ...(value.comparisonBasis
      ? { comparisonBasis: value.comparisonBasis }
      : {}),
    ...(value.comparisonBasisEvidence
      ? {
          comparisonBasisSource: {
            candidateId: occurrence.candidateId,
            pageNumber: occurrence.pageNumber,
            physicalPageNumber:
              occurrence.physicalPageNumber || occurrence.pageNumber,
            printedPageLabel: occurrence.printedPageLabel || null,
            documentStart:
              context.documentStart + value.comparisonBasisEvidence.index,
            documentEnd:
              context.documentStart +
              value.comparisonBasisEvidence.index +
              value.comparisonBasisEvidence.exactText.length,
            exactText: value.comparisonBasisEvidence.exactText,
          },
        }
      : {}),
    ...(value.symbolicLimitType
      ? { symbolicLimitType: value.symbolicLimitType }
      : {}),
    ...(value.limitSemanticType
      ? { limitSemanticType: value.limitSemanticType }
      : {}),
    ...(value.eventScope ? { eventScope: value.eventScope } : {}),
    ...(value.semanticContractId
      ? { semanticContractId: value.semanticContractId }
      : {}),
    ...(variantScope?.key && variantScope?.label
      ? {
          variantScope: {
            key: variantScope.key,
            label: variantScope.label,
            source: variantScope.source,
          },
        }
      : {}),
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

function limitQualifier(text, match, occurrence) {
  const structuredUnit = ["LIST_ITEM", "PARAGRAPH"].includes(
    occurrence?.context?.unitType
  );
  const isBoundary = (index) => {
    const character = text[index];
    if (/[!?;]/u.test(character)) return true;
    if (character === ".")
      return (
        !/\d/u.test(text[index - 1] || "") || !/\d/u.test(text[index + 1] || "")
      );
    return !structuredUnit && /[\n\r]/u.test(character);
  };
  let sentenceStart = match.index;
  while (sentenceStart > 0 && !isBoundary(sentenceStart - 1))
    sentenceStart -= 1;
  let sentenceEnd = match.index + match[0].length;
  while (sentenceEnd < text.length && !isBoundary(sentenceEnd))
    sentenceEnd += 1;
  const start = Math.max(sentenceStart, match.index - 240);
  const end = Math.min(sentenceEnd, match.index + match[0].length + 240);
  const nearby = text.slice(start, end);
  const qualifiers = [];
  if (/auf\s+[„“"']*\s*Erstes\s+Risiko/iu.test(nearby))
    qualifiers.push("auf Erstes Risiko");
  if (/\b(?:je|pro)\s+Schadenfall\b/iu.test(nearby))
    qualifiers.push("je Schadenfall");
  if (/\b(?:je|pro)\s+(?:Schaden)?ereignis\b/iu.test(nearby))
    qualifiers.push("je Ereignis");
  if (
    /\b(?:Jahresh[oö]chst(?:entsch[aä]digung|grenze)|pro\s+Jahr|je\s+Jahr)\b/iu.test(
      nearby
    )
  )
    qualifiers.push("pro Jahr");
  if (
    /\bKumul(?:schaden)?(?:grenze|limit|h[oö]chstentsch[aä]digung)\b/iu.test(
      nearby
    )
  )
    qualifiers.push("Kumulschadengrenze");
  return qualifiers.join(", ");
}

function limitComparisonBasis(text, match) {
  const nearbyStart = Math.max(0, match.index - 180);
  const nearbyEnd = Math.min(text.length, match.index + match[0].length + 180);
  const nearby = text.slice(nearbyStart, nearbyEnd);
  const candidates = [
    {
      comparisonBasis: "BUILDING_NEW_VALUE_INSURANCE_SUM",
      match: nearby.match(/\b(?:des|vom)\s+(?:NBW|Neubauwert)\b/iu),
    },
    {
      comparisonBasis: "BUILDING_INSURANCE_SUM",
      match: nearby.match(/\bGebäudeversicherungssumme\b/iu),
    },
  ].filter(({ match: basisMatch }) => basisMatch);
  if (candidates.length !== 1) return null;
  const candidate = candidates[0];
  return {
    comparisonBasis: candidate.comparisonBasis,
    comparisonBasisEvidence: {
      index: nearbyStart + candidate.match.index,
      exactText: candidate.match[0],
    },
  };
}

function deductibleFact(occurrence, fact) {
  const context = validatedContext(occurrence);
  const relativeStart =
    Number(fact?.source?.documentStart) - context.documentStart;
  const relativeEnd = Number(fact?.source?.documentEnd) - context.documentStart;
  if (!Number.isInteger(relativeStart) || !Number.isInteger(relativeEnd))
    return false;
  const before = context.text.slice(
    Math.max(0, relativeStart - 100),
    relativeStart
  );
  const after = context.text.slice(relativeEnd, relativeEnd + 35);
  const markerPattern =
    /\b(?:Selbstbehalt|Selbstbeteiligung|SB|Eigenbehalt)\b/giu;
  const beforeMarkers = [...before.matchAll(markerPattern)];
  const afterMarker = after.match(
    /^[^.;:\n]{0,20}\b(?:Selbstbehalt|Selbstbeteiligung|SB|Eigenbehalt)\b/iu
  );
  if (afterMarker) return true;
  const lastMarker = beforeMarkers.at(-1);
  if (!lastMarker) return false;
  const between = before.slice(lastMarker.index + lastMarker[0].length);
  return (
    between.length <= 70 &&
    !/(?:EUR|€)\s*\d|\d{1,3}(?:[.,]\d+)?\s*%/iu.test(between)
  );
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
  const context = validatedContext(occurrence);
  const { text } = context;
  const matches = [];
  const moneyPattern =
    /(?<![\p{L}\p{N}])(?:EUR|€)\s*\d+(?:\.\d{3})*(?:,\d{2})?(?![\p{L}\p{N}])/giu;
  for (const match of text.matchAll(moneyPattern)) {
    if (!valueFollowsCandidate(occurrence, match)) continue;
    const amount = match[0].replace(/^(?:EUR|€)\s*/iu, "");
    matches.push(
      sourceBoundFact({
        occurrence,
        binding,
        match,
        value: {
          normalizedValue: `EUR ${amount}`,
          valueType: "MONEY",
          unit: "EUR",
          limitKind: LIMIT_KIND.CAPPED,
          qualifier: limitQualifier(text, match, occurrence),
          ...(limitComparisonBasis(text, match) || {}),
        },
      })
    );
  }
  const occurrenceEnd = Number(occurrence.documentEnd) - context.documentStart;
  if (Number.isInteger(occurrenceEnd) && occurrenceEnd >= 0) {
    const concatenatedMoney = text
      .slice(occurrenceEnd)
      .match(/^(?:EUR|€)\s*\d+(?:\.\d{3})*(?:,\d{2})?(?![\p{L}\p{N}])/iu);
    if (concatenatedMoney) {
      concatenatedMoney.index = occurrenceEnd;
      const amount = concatenatedMoney[0].replace(/^(?:EUR|€)\s*/iu, "");
      matches.push(
        sourceBoundFact({
          occurrence,
          binding,
          match: concatenatedMoney,
          value: {
            normalizedValue: `EUR ${amount}`,
            valueType: "MONEY",
            unit: "EUR",
            limitKind: LIMIT_KIND.CAPPED,
            qualifier: limitQualifier(text, concatenatedMoney, occurrence),
            ...(limitComparisonBasis(text, concatenatedMoney) || {}),
          },
        })
      );
    }
  }

  const percentPattern =
    /(?<![\p{L}\p{N}])(?:\d{1,3}(?:[.,]\d+)?|[lI]0)\s*%(?![\p{L}\p{N}])/gu;
  for (const match of text.matchAll(percentPattern)) {
    if (!valueFollowsCandidate(occurrence, match)) continue;
    const compact = match[0].replace(/\s/gu, "");
    const numeric = /^[lI]0%$/u.test(compact)
      ? "10"
      : compact.slice(0, -1).replace(".", ",");
    matches.push(
      sourceBoundFact({
        occurrence,
        binding,
        match,
        value: {
          normalizedValue: `${numeric} %`,
          valueType: "PERCENT",
          unit: "%",
          limitKind: LIMIT_KIND.CAPPED,
          qualifier: limitQualifier(text, match, occurrence),
          ...(limitComparisonBasis(text, match) || {}),
        },
      })
    );
  }
  const dimensionalPattern =
    /Einzelscheibengr[öo]ße\s+von\s+\d{1,4}(?:[.,]\d+)?\s*m(?:²|2)(?![\p{L}\p{N}])/giu;
  for (const match of text.matchAll(dimensionalPattern)) {
    if (!valueFollowsCandidate(occurrence, match)) continue;
    const dimension = match[0].match(/(\d{1,4}(?:[.,]\d+)?)\s*m(?:²|2)/iu);
    if (!dimension) continue;
    matches.push(
      sourceBoundFact({
        occurrence,
        binding,
        match,
        value: {
          normalizedValue: `Einzelscheibengröße bis ${dimension[1].replace(
            ".",
            ","
          )} m²`,
          valueType: "DIMENSION",
          unit: "m²",
          limitKind: LIMIT_KIND.CAPPED,
        },
      })
    );
  }
  return matches.sort(
    (left, right) => left.source.documentStart - right.source.documentStart
  );
}

function extractUnboundedLimitFacts({ occurrence, binding }) {
  const context = validatedContext(occurrence);
  const occurrenceEnd = Number(occurrence?.documentEnd);
  if (!Number.isInteger(occurrenceEnd)) return [];
  const pattern = /ohne\s+betragliche\s+Beschr[aä]nkung/giu;
  return [...context.text.matchAll(pattern)]
    .filter(
      (match) =>
        valueFollowsCandidate(occurrence, match) &&
        context.documentStart + match.index <= occurrenceEnd + 360
    )
    .map((match) =>
      sourceBoundFact({
        occurrence,
        binding,
        match,
        value: {
          normalizedValue: "ohne betragliche Beschränkung",
          valueType: "LIMIT",
          unit: null,
          limitKind: LIMIT_KIND.UNBOUNDED,
          qualifier: limitQualifier(context.text, match, occurrence),
        },
      })
    );
}

function extractFieldGovernorLimitFacts({ occurrence, binding }) {
  const governor = occurrence?.fieldGovernorHint;
  if (
    typeof governor?.text !== "string" ||
    !Number.isInteger(governor?.documentStart) ||
    governor.documentEnd !== governor.documentStart + governor.text.length
  )
    return [];
  return extractLimitFacts({
    occurrence: {
      ...occurrence,
      documentStart: governor.documentStart,
      documentEnd: governor.documentEnd,
      context: {
        text: governor.text,
        documentStart: governor.documentStart,
        documentEnd: governor.documentEnd,
      },
    },
    binding,
  });
}

function validatedExactClauseCodeGovernor({ occurrence, governor, worksheet }) {
  const clauseCode = String(occurrence?.sectionScopeHint?.clauseCode || "")
    .trim()
    .toLocaleUpperCase("de");
  const scopes = occurrence?.sectionScopeHint?.scopeKeys?.length
    ? occurrence.sectionScopeHint.scopeKeys
    : [occurrence?.sectionScopeHint?.scopeKey].filter(Boolean);
  const codePattern =
    /(?:Besondere\s+Bedingung\s*\n?\s*|\()\s*(\d{2}\p{Lu}{2}\d{4})\s*\)?/giu;
  const moneyPattern =
    /(?<![\p{L}\p{N}])(?:EUR|€)\s*\d+(?:\.\d{3})*(?:,\d{2})?(?![\p{L}\p{N}])/giu;
  const codes =
    typeof governor?.text === "string"
      ? [...governor.text.matchAll(codePattern)]
      : [];
  const amounts =
    typeof governor?.text === "string"
      ? [...governor.text.matchAll(moneyPattern)]
      : [];
  const canonicalPageBoundary = worksheet?.document?.pageBoundaries?.find(
    ({ physicalPageNumber }) =>
      physicalPageNumber === governor?.physicalPageNumber
  );
  if (
    governor?.contractId !== EXACT_CLAUSE_CODE_FIELD_GOVERNOR_CONTRACT_ID ||
    governor?.policy !== EXACT_CLAUSE_CODE_FIELD_GOVERNOR_POLICY ||
    governor?.documentFingerprint !== worksheet?.document?.fingerprint ||
    String(governor?.clauseCode || "").toLocaleUpperCase("de") !== clauseCode ||
    !scopes.includes(governor?.scopeKey) ||
    typeof governor?.text !== "string" ||
    !Number.isInteger(governor?.documentStart) ||
    governor.documentEnd !== governor.documentStart + governor.text.length ||
    !Number.isInteger(governor?.physicalPageNumber) ||
    governor.physicalPageNumber < 1 ||
    governor.physicalPageNumber > worksheet?.document?.physicalPages ||
    governor?.pageBoundaryPhysicalPageNumber !== governor.physicalPageNumber ||
    canonicalPageBoundary?.documentStart !== governor?.pageDocumentStart ||
    canonicalPageBoundary?.documentEnd !== governor?.pageDocumentEnd ||
    !Number.isInteger(governor?.pageDocumentStart) ||
    !Number.isInteger(governor?.pageDocumentEnd) ||
    governor.pageDocumentStart < 0 ||
    governor.pageDocumentEnd < governor.pageDocumentStart ||
    governor.pageDocumentEnd > worksheet?.document?.pageContentLength ||
    governor.documentStart < 0 ||
    governor.documentEnd > worksheet?.document?.pageContentLength ||
    governor.documentStart < governor.pageDocumentStart ||
    governor.documentEnd > governor.pageDocumentEnd ||
    codes.length !== 1 ||
    codes[0][1].toLocaleUpperCase("de") !== clauseCode ||
    amounts.length !== 1 ||
    governor.amountText !== amounts[0][0] ||
    governor.amountDocumentStart !==
      governor.documentStart + amounts[0].index ||
    governor.amountDocumentEnd !==
      governor.amountDocumentStart + governor.amountText.length ||
    !/\b(?:auf\s+Erstes\s+Risiko|Versicherungssumme|H[oö]chstentsch[aä]digung|Limit|Sublimit)\b/iu.test(
      governor.text
    ) ||
    /\b(?:kein(?:e[rsnm]?)?\s+Versicherungsschutz|nicht\s+(?:(?:mit)?versichert|gedeckt|eingeschlossen)|ausgeschlossen|ausgenommen|optional|wahlweise|gegen\s+(?:eine[nr]?\s+)?(?:Mehrpr[aä]mie|Mehrbeitrag|Pr[aä]mienzuschlag)|Selbstbehalt|Selbstbeteiligung|Eigenbehalt|Pr[aä]mie|entf[aä]llt|aufgehoben|ersetzt)\b/iu.test(
      governor.text
    )
  )
    return null;
  return governor;
}

function extractExactClauseCodeFieldGovernorLimitFacts({
  occurrence,
  binding,
  worksheet,
}) {
  const governors = (occurrence?.exactClauseCodeFieldGovernorHints || [])
    .map((governor) =>
      validatedExactClauseCodeGovernor({ occurrence, governor, worksheet })
    )
    .filter(Boolean);
  if (governors.length === 0) return [];

  const facts = governors.flatMap((governor) =>
    extractLimitFacts({
      occurrence: {
        ...occurrence,
        pageNumber: governor.physicalPageNumber,
        physicalPageNumber: governor.physicalPageNumber,
        printedPageLabel: governor.printedPageLabel,
        documentStart: governor.documentStart,
        documentEnd: governor.documentEnd,
        context: {
          unitType: "LIST_ITEM",
          text: governor.text,
          documentStart: governor.documentStart,
          documentEnd: governor.documentEnd,
        },
      },
      binding,
    }).map((fact) => ({
      ...fact,
      clauseActivationScope: {
        key: governor.scopeKey,
        label:
          {
            FEUER_INSURANCE: "Feuer",
            LEITUNGSWASSER_INSURANCE: "Leitungswasser",
            STURM_INSURANCE: "Sturm",
            GLASBRUCH_INSURANCE: "Glas",
          }[governor.scopeKey] || governor.scopeKey,
      },
      exactClauseCodeFieldGovernor: {
        contractId: governor.contractId,
        clauseCode: governor.clauseCode,
        documentFingerprint: governor.documentFingerprint,
        scopeKey: governor.scopeKey,
      },
    }))
  );
  const normalizedContracts = new Set(
    facts.map((fact) =>
      JSON.stringify([
        fact.normalizedValue,
        fact.qualifier || null,
        fact.limitKind || null,
        fact.unit || null,
      ])
    )
  );
  return normalizedContracts.size === 1 ? facts : [];
}

function extractBoundLimitFacts(options) {
  const occurrenceEnd = Number(options.occurrence?.documentEnd);
  if (!Number.isInteger(occurrenceEnd)) return [];
  return [
    ...extractLimitFacts(options).filter(
      (fact) => fact.source.documentStart <= occurrenceEnd + 360
    ),
    ...extractUnboundedLimitFacts(options),
    ...extractFieldGovernorLimitFacts(options),
  ];
}

function extractVs36MaximumIndemnityLimitFacts(options) {
  const limit = vs36MaximumIndemnityLimitForOccurrence(options.occurrence);
  return limit
    ? [
        sourceBoundFact({
          occurrence: options.occurrence,
          binding: options.binding,
          match: limit.match,
          value: limit.value,
        }),
      ]
    : [];
}

function extractCoverageLimitFacts(options) {
  return extractBoundLimitFacts(options).filter(
    (fact) => !deductibleFact(options.occurrence, fact)
  );
}

function extractScaffoldingCostLimitFacts(options) {
  const context = validatedContext(options.occurrence);
  const occurrenceStart = Number(options.occurrence?.documentStart);
  const occurrenceEnd = Number(options.occurrence?.documentEnd);
  if (
    !["LIST_ITEM", "PARAGRAPH"].includes(
      options.occurrence?.context?.unitType
    ) ||
    !Number.isInteger(occurrenceStart) ||
    !Number.isInteger(occurrenceEnd) ||
    occurrenceStart < context.documentStart ||
    occurrenceEnd <= occurrenceStart ||
    occurrenceEnd > context.documentEnd ||
    context.text.slice(
      occurrenceStart - context.documentStart,
      occurrenceEnd - context.documentStart
    ) !== String(options.occurrence?.exactText || "")
  )
    return [];

  return extractCoverageLimitFacts(options).filter((fact) => {
    const sourceStart = Number(fact?.source?.documentStart);
    if (
      !Number.isInteger(sourceStart) ||
      sourceStart < occurrenceEnd ||
      sourceStart - occurrenceEnd > 160
    )
      return false;
    const between = context.text.slice(
      occurrenceEnd - context.documentStart,
      sourceStart - context.documentStart
    );
    return (
      !/[.!?;\n\r]/u.test(between) &&
      !/\b(?:Kran\p{L}*|Notverglas\p{L}*|Folgesch\p{L}*|Selbstbehalt\p{L}*)\b/iu.test(
        between
      )
    );
  });
}

const FE_C07_LIMIT_QUALIFIER =
  "jeweils; auf Erstes Risiko; Bezugsgröße Gebäudeversicherungssumme";
const FE_C07_SCOPED_OBJECT =
  /(?:Gemeinschaftsr[aä]um(?:e|en)?[\s\S]{0,100}?(?:Saun\p{L}*|Infrarotkabin\p{L}*)|(?:Saun\p{L}*|Infrarotkabin\p{L}*)[\s\S]{0,100}?Gemeinschaftsr[aä]um(?:e|en)?)/iu;
const FE_C07_LIMIT =
  /bis\s+zu\s+jeweils\s+(?<percent>\d{1,3}(?:[.,]\d+)?\s*%)\s+der\s+Geb[aä]udeversicherungs-?\s*summe\s+auf\s+[,„“"']*Erstes\s+Risiko/iu;
const FE_C07_LOCAL_POSITIVE =
  /Mitversichert\s+sind\s+Gemeinschaftseinrichtungen/iu;
const FE_C07_LIST_POSITIVE = /Zus[aä]tzlich\s+sind\s+mitversichert,/iu;
const FE_C07_UNSAFE_CLAUSE =
  /(?:nicht\s+(?:mit)?versichert|ausgeschlossen|ausgenommen|gegen\s+(?:eine?\s+)?(?:Mehrpr[aä]mie|Mehrbeitrag|Pr[aä]mienzuschlag)|optional|wahlweise|kann[\s\S]{0,100}(?:mitversichert|eingeschlossen)\s+werden|Haftpflichtversicherung|Schadenersatzverpflichtungen|\bAHVB\b)/iu;
const FE_C07_LIST_CONDITION =
  /wenn\s+(?<condition>(?:der\s+)?Versicherungsnehmer\s+und\s*\/\s*oder\s+Geb[aä]udeeigent[uü]mer[\s\S]{0,180}?f[uü]r\s+den\s+eingetretenen\s+Schaden\s+ersatzpflichtig\s+ist\s+und\s+das\s+Geb[aä]ude\s+gegen\s+die\s+angef[uü]hrte\s+Gefahr\s+versichert\s+ist)\s*:/iu;

function validatedFeC07Unit(unit) {
  const text = unit?.text;
  const documentStart = Number(unit?.documentStart);
  const documentEnd = Number(unit?.documentEnd);
  return typeof text === "string" &&
    Number.isInteger(documentStart) &&
    Number.isInteger(documentEnd) &&
    documentStart >= 0 &&
    documentEnd === documentStart + text.length
    ? { text, documentStart, documentEnd }
    : null;
}

function feC07OccurrenceIsSourceExact(occurrence) {
  const context = validatedFeC07Unit(occurrence?.context);
  const documentStart = Number(occurrence?.documentStart);
  const documentEnd = Number(occurrence?.documentEnd);
  const exactText = String(occurrence?.exactText || "");
  if (
    !context ||
    !exactText ||
    !Number.isInteger(documentStart) ||
    !Number.isInteger(documentEnd) ||
    documentStart < context.documentStart ||
    documentEnd > context.documentEnd ||
    documentEnd !== documentStart + exactText.length
  )
    return false;
  return (
    context.text.slice(
      documentStart - context.documentStart,
      documentEnd - context.documentStart
    ) === exactText && FE_C07_SCOPED_OBJECT.test(exactText)
  );
}

function feC07PositiveIsAffirmative(text, index) {
  const prefix = text.slice(Math.max(0, index - 32), index);
  return !/(?:nicht(?:\s+mehr)?|weder|kein(?:e|en|er|es)?|optional|wahlweise|gegen\s+(?:eine?\s+)?(?:Mehrpr[aä]mie|Mehrbeitrag|Pr[aä]mienzuschlag))\s*$/iu.test(
    prefix
  );
}

function feC07SourceUnits(occurrence) {
  if (!feC07OccurrenceIsSourceExact(occurrence)) return [];
  const context = validatedFeC07Unit(occurrence.context);
  const units = [];
  if (occurrence.context.unitType === "PARAGRAPH") {
    const relativeOccurrenceEnd =
      occurrence.documentEnd - context.documentStart;
    const positive = [
      ...context.text.matchAll(new RegExp(FE_C07_LOCAL_POSITIVE, "giu")),
    ]
      .filter(
        (match) =>
          match.index < relativeOccurrenceEnd &&
          feC07PositiveIsAffirmative(context.text, match.index)
      )
      .at(-1);
    if (positive) {
      const text = context.text.slice(positive.index, relativeOccurrenceEnd);
      if (!FE_C07_UNSAFE_CLAUSE.test(text))
        units.push({
          text,
          documentStart: context.documentStart + positive.index,
          documentEnd: context.documentStart + relativeOccurrenceEnd,
          kind: "LOCAL_PARAGRAPH",
        });
    }
  }

  const scopeLead = validatedFeC07Unit(occurrence.scopeLead);
  if (
    occurrence.context.unitType === "LIST_ITEM" &&
    scopeLead &&
    scopeLead.documentEnd <= context.documentStart &&
    context.documentStart - scopeLead.documentEnd <= 512 &&
    FE_C07_LIST_POSITIVE.test(scopeLead.text) &&
    FE_C07_LIST_CONDITION.test(scopeLead.text)
  ) {
    const positives = [
      ...scopeLead.text.matchAll(new RegExp(FE_C07_LIST_POSITIVE, "giu")),
    ];
    const start = positives.at(-1)?.index;
    if (
      Number.isInteger(start) &&
      feC07PositiveIsAffirmative(scopeLead.text, start)
    ) {
      const text = scopeLead.text.slice(start);
      if (!FE_C07_UNSAFE_CLAUSE.test(text))
        units.push({
          text,
          documentStart: scopeLead.documentStart + start,
          documentEnd: scopeLead.documentEnd,
          kind: "LIST_GOVERNOR",
        });
    }
  }
  return units;
}

function sourceBoundFeC07Fact({ occurrence, binding, unit, match, value }) {
  return sourceBoundFact({
    occurrence: {
      ...occurrence,
      documentStart: unit.documentStart,
      documentEnd: unit.documentEnd,
      context: {
        unitType: unit.kind === "LIST_GOVERNOR" ? "LIST_ITEM" : "PARAGRAPH",
        text: unit.text,
        documentStart: unit.documentStart,
        documentEnd: unit.documentEnd,
      },
    },
    binding,
    match,
    value,
  });
}

function extractFeC07LimitFacts({ occurrence, binding }) {
  const facts = [];
  for (const unit of feC07SourceUnits(occurrence)) {
    const matches = [...unit.text.matchAll(new RegExp(FE_C07_LIMIT, "giu"))];
    if (matches.length !== 1) continue;
    const fullMatch = matches[0];
    const rawPercent = fullMatch.groups?.percent;
    if (!rawPercent) continue;
    const percentMatch = [rawPercent];
    percentMatch.index = fullMatch.index + fullMatch[0].indexOf(rawPercent);
    facts.push(
      sourceBoundFeC07Fact({
        occurrence,
        binding,
        unit,
        match: percentMatch,
        value: {
          normalizedValue: `${rawPercent
            .replace(/\s*%$/u, "")
            .replace(".", ",")} %`,
          valueType: "PERCENT",
          unit: "%",
          limitKind: LIMIT_KIND.CAPPED,
          qualifier: FE_C07_LIMIT_QUALIFIER,
        },
      })
    );
  }
  return facts.length === 1 ? facts : [];
}

function extractFeC07ConditionFacts({ occurrence, binding }) {
  const listGovernors = feC07SourceUnits(occurrence).filter(
    ({ kind }) => kind === "LIST_GOVERNOR"
  );
  if (listGovernors.length !== 1) return [];
  const [unit] = listGovernors;
  const matches = [
    ...unit.text.matchAll(new RegExp(FE_C07_LIST_CONDITION, "giu")),
  ];
  if (matches.length !== 1 || !matches[0].groups?.condition) return [];
  const rawCondition = matches[0].groups.condition;
  const conditionMatch = [rawCondition];
  conditionMatch.index = matches[0].index + matches[0][0].indexOf(rawCondition);
  return [
    sourceBoundFeC07Fact({
      occurrence,
      binding,
      unit,
      match: conditionMatch,
      value: {
        normalizedValue: conditionNormalized(rawCondition),
        valueType: "TEXT",
        unit: null,
      },
    }),
  ];
}

function factWithinOccurrenceSentence(occurrence, fact) {
  const range = occurrenceSentenceRange(occurrence);
  if (!range) return false;
  const start = Number(fact?.source?.documentStart) - range.documentStart;
  const end = Number(fact?.source?.documentEnd) - range.documentStart;
  return start >= range.start && end <= range.end;
}

function extractLocalCoverageLimitFacts(options) {
  return extractCoverageLimitFacts(options).filter((fact) =>
    factWithinOccurrenceSentence(options.occurrence, fact)
  );
}

function extractDeductibleFacts(options) {
  return extractBoundLimitFacts(options).filter(
    (fact) =>
      ["MONEY", "PERCENT"].includes(fact.valueType) &&
      deductibleFact(options.occurrence, fact)
  );
}

function extractOutbuildingLimitFacts(options) {
  const facts = extractBoundLimitFacts(options);
  const context = validatedContext(options.occurrence);
  const occurrenceEnd = Number(options.occurrence?.documentEnd);
  if (!Number.isInteger(occurrenceEnd)) return facts;
  const concatenatedPattern =
    /Erstes\s+Risiko(EUR\d+(?:\.\d{3})*(?:,\d{2})?)(?![\p{L}\p{N}])/giu;
  for (const match of context.text.matchAll(concatenatedPattern)) {
    const rawValue = match[1];
    const valueMatch = [rawValue];
    valueMatch.index = match.index + match[0].indexOf(rawValue);
    const sourceStart = context.documentStart + valueMatch.index;
    if (
      !valueFollowsCandidate(options.occurrence, valueMatch) ||
      sourceStart > occurrenceEnd + 360
    )
      continue;
    facts.push(
      sourceBoundFact({
        occurrence: options.occurrence,
        binding: options.binding,
        match: valueMatch,
        value: {
          normalizedValue: `EUR ${rawValue.replace(/^EUR/iu, "")}`,
          valueType: "MONEY",
          unit: "EUR",
        },
      })
    );
  }
  const unique = new Map();
  for (const fact of facts) {
    const key = `${fact.source.documentStart}:${fact.source.documentEnd}:${fact.normalizedValue}`;
    if (!unique.has(key)) unique.set(key, fact);
  }
  return [...unique.values()].sort(
    (left, right) => left.source.documentStart - right.source.documentStart
  );
}

function extractSectionGovernorLimitFacts({ occurrence, binding }) {
  const { text, documentStart } = validatedContext(occurrence);
  const occurrenceStart = Number(occurrence.documentStart) - documentStart;
  if (
    !Number.isInteger(occurrenceStart) ||
    occurrenceStart < 0 ||
    occurrenceStart > text.length
  )
    return [];
  const governorPattern =
    /bis\s+zu\s+jeweils\s+(?:10|[lI]0)\s*%\s+der\s+Gebäudeversicherungssumme\s+auf\s+[,„“"']*Erstes\s+Risiko/giu;
  const matches = [...text.slice(0, occurrenceStart).matchAll(governorPattern)];
  const match = matches.at(-1);
  if (!match) return [];
  const percent = match[0].match(/(?:10|[lI]0)\s*%/iu);
  const basis = match[0].match(/Gebäudeversicherungssumme/iu);
  if (!percent || !basis) return [];
  percent.index = match.index + match[0].indexOf(percent[0]);
  return [
    sourceBoundFact({
      occurrence,
      binding,
      match: percent,
      value: {
        normalizedValue: "10 %",
        valueType: "PERCENT",
        unit: "%",
        limitKind: LIMIT_KIND.CAPPED,
        qualifier: "auf Erstes Risiko",
        comparisonBasis: "BUILDING_INSURANCE_SUM",
        comparisonBasisEvidence: {
          index: match.index + match[0].indexOf(basis[0]),
          exactText: basis[0],
        },
      },
    }),
  ];
}

function extractBoundOrSectionGovernorLimitFacts(options) {
  return [
    ...extractBoundLimitFacts(options),
    ...extractSectionGovernorLimitFacts(options),
  ];
}

function extractInsuredNewValueFacts({ occurrence, binding }) {
  const context = validatedContext(occurrence);
  const occurrenceEnd = Number(occurrence.documentEnd) - context.documentStart;
  if (!Number.isInteger(occurrenceEnd) || occurrenceEnd < 0) return [];
  const adjacent = context.text
    .slice(occurrenceEnd)
    .match(/^\s*(EUR\s*\d+(?:\.\d{3})*(?:,\d{2})?)(?![\p{L}\p{N}])/iu);
  if (!adjacent) return [];
  const rawValue = adjacent[1];
  const match = [rawValue];
  match.index = occurrenceEnd + adjacent[0].indexOf(rawValue);
  return [
    sourceBoundFact({
      occurrence,
      binding,
      match,
      value: {
        normalizedValue: `EUR ${rawValue.replace(/^EUR\s*/iu, "")}`,
        valueType: "MONEY",
        unit: "EUR",
      },
    }),
  ];
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

function normalizedGermanCardinal(rawValue) {
  const normalized = String(rawValue || "")
    .normalize("NFKC")
    .toLocaleLowerCase("de");
  if (/^\d+$/u.test(normalized)) return Number(normalized);
  if (GERMAN_MONTH_NUMBERS[normalized]) return GERMAN_MONTH_NUMBERS[normalized];
  const inflected = normalized.match(
    /^(ein|zwei|drei|vier|fuenf|fünf|sechs|sieben|acht|neun|zehn|elf|zwoelf|zwölf)(?:e[rmn])?$/u
  );
  return inflected ? GERMAN_MONTH_NUMBERS[inflected[1]] : undefined;
}

function extractAnnualAggregateMultipleFacts({ occurrence, binding }) {
  const { text } = validatedContext(occurrence);
  if (
    !/(?:Versicherungsf[aä]lle\s+eines\s+Jahres|Jahresh[oö]chstleistung|Jahres(?:gesamt|aggregate))/iu.test(
      text
    ) ||
    !/(?:Deckungssumme|Pauschal(?:deckungs|versicherungs)summe)/iu.test(text)
  )
    return [];

  const cardinal =
    "(?:\\d{1,2}|ein(?:e[rmn]?)?|eins|zwei|drei|vier|f(?:ue|ü)nf|sechs|sieben|acht|neun|zehn|elf|zw(?:oe|ö)lf)";
  const multiplier = `${cardinal}\\s*(?:-?\\s*mal|-?\\s*fach(?:e[snrm]?)?)`;
  const patterns = [
    new RegExp(
      `(?:maximal|höchstens|bis\\s+zu)\\s+(?:das\\s+)?(?<value>${multiplier})`,
      "giu"
    ),
    new RegExp(
      `(?:beträgt|entspricht)\\s+(?:höchstens\\s+)?(?:dem|das)?\\s*(?<value>${multiplier})(?=\\s+der\\s+(?:Deckungs|Versicherungs|Pauschal))`,
      "giu"
    ),
  ];
  const facts = [];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const rawMultiplier = match.groups?.value;
      if (!rawMultiplier) continue;
      const numberMatch = rawMultiplier.match(
        new RegExp(`^(${cardinal})`, "iu")
      );
      if (!numberMatch) continue;
      const count = normalizedGermanCardinal(numberMatch[1]);
      if (!Number.isInteger(count) || count < 1) continue;
      const valueMatch = [rawMultiplier];
      valueMatch.index = match.index + match[0].lastIndexOf(rawMultiplier);
      if (!valueFollowsCandidate(occurrence, valueMatch)) continue;
      facts.push(
        sourceBoundFact({
          occurrence,
          binding,
          match: valueMatch,
          value: {
            normalizedValue: `${count}-fach`,
            valueType: "MULTIPLE",
            unit: "MULTIPLE",
            limitKind: LIMIT_KIND.CAPPED,
          },
        })
      );
    }
  }
  return facts;
}

/**
 * HP-08 asks for the admissible total construction cost, not the separate
 * liability coverage sublimit that can occur in the same product-summary
 * item. Bind only the amount grammatically governed by Gesamtbaukosten.
 */
function extractBuildersLiabilityConstructionSumFacts({ occurrence, binding }) {
  const { text } = validatedContext(occurrence);
  const pattern =
    /Gesamtbaukosten(?:summe)?(?:\s+des\s+Bauvorhabens)?\s*(?:bis\s+)?(?<money>(?:EUR|€)\s*\d+(?:\.\d{3})*(?:,\d{2})?)(?![\p{L}\p{N}])(?:[\s\S]{0,80}?\boder\s+(?<percent>\d{1,3}(?:[.,]\d+)?\s*%)(?:\s+des\s+Gebäudeneuwerts)?)?/giu;
  const facts = [];
  for (const match of text.matchAll(pattern)) {
    const rawMoney = match.groups?.money;
    if (!rawMoney) continue;
    const moneyMatch = [rawMoney];
    moneyMatch.index = match.index + match[0].indexOf(rawMoney);
    if (!valueFollowsCandidate(occurrence, moneyMatch)) continue;
    facts.push(
      sourceBoundFact({
        occurrence,
        binding,
        match: moneyMatch,
        value: {
          normalizedValue: `EUR ${rawMoney.replace(/^(?:EUR|€)\s*/iu, "")}`,
          valueType: "MONEY",
          unit: "EUR",
          limitKind: LIMIT_KIND.CAPPED,
        },
      })
    );
    const rawPercent = match.groups?.percent;
    if (!rawPercent) continue;
    const percentMatch = [rawPercent];
    percentMatch.index = match.index + match[0].indexOf(rawPercent);
    facts.push(
      sourceBoundFact({
        occurrence,
        binding,
        match: percentMatch,
        value: {
          normalizedValue: `${rawPercent
            .replace(/\s/gu, "")
            .slice(0, -1)
            .replace(".", ",")} %`,
          valueType: "PERCENT",
          unit: "%",
          limitKind: LIMIT_KIND.CAPPED,
          qualifier: "des Gebäudeneuwerts",
        },
      })
    );
  }
  return facts;
}

function extractDurationFacts({ occurrence, binding }) {
  const { text } = validatedContext(occurrence);
  const durationPattern =
    /(?<![\p{L}\p{N}])(?:\d{1,3}|ein(?:e[rmn]?)?|eins|zwei|drei|vier|f(?:ue|ü)nf|sechs|sieben|acht|neun|zehn|elf|zw(?:oe|ö)lf)\s+(Stunde(?:n)?|Tag(?:e|en)?|Woche(?:n)?|Monat(?:e|en)?|Jahr(?:e|en)?)(?![\p{L}\p{N}])/giu;
  return [...text.matchAll(durationPattern)]
    .filter((match) => valueFollowsCandidate(occurrence, match))
    .map((match) => {
      const rawNumber = match[0].trim().split(/\s+/u)[0];
      const normalizedWord = rawNumber
        .normalize("NFKC")
        .toLocaleLowerCase("de");
      const count = /^\d+$/u.test(normalizedWord)
        ? Number(normalizedWord)
        : GERMAN_MONTH_NUMBERS[normalizedWord];
      if (!Number.isInteger(count))
        throw requestedFieldError("REQUESTED_FIELD_DURATION_INVALID", match[0]);
      const unitText = match[1].toLocaleLowerCase("de");
      const unit = unitText.startsWith("stunde")
        ? "HOUR"
        : unitText.startsWith("tag")
          ? "DAY"
          : unitText.startsWith("woche")
            ? "WEEK"
            : unitText.startsWith("monat")
              ? "MONTH"
              : "YEAR";
      const labels = {
        HOUR: ["Stunde", "Stunden"],
        DAY: ["Tag", "Tage"],
        WEEK: ["Woche", "Wochen"],
        MONTH: ["Monat", "Monate"],
        YEAR: ["Jahr", "Jahre"],
      };
      return sourceBoundFact({
        occurrence,
        binding,
        match,
        value: {
          normalizedValue: `${count} ${labels[unit][count === 1 ? 0 : 1]}`,
          valueType: "DURATION",
          unit,
        },
      });
    });
}

function extractWaitingPeriodFacts(options) {
  const { occurrence, binding } = options;
  const { text } = validatedContext(occurrence);
  const duration =
    "(?<duration>(?:\\d{1,3}|ein(?:e[rmn]?)?|eins|zwei|drei|vier|f(?:ue|ü)nf|sechs|sieben|acht|neun|zehn|elf|zw(?:oe|ö)lf)\\s+(?:Stunde(?:n)?|Tag(?:e|en)?|Woche(?:n)?|Monat(?:e|en)?|Jahr(?:e|en)?))";
  const patterns = [
    new RegExp(
      `(?:Karenz(?:frist|zeit)?|Warte(?:frist|zeit))[^.;\\n]{0,80}?${duration}`,
      "giu"
    ),
    new RegExp(
      `Versicherungsschutz\\s+beginnt\\s+(?:erst\\s+)?nach\\s+${duration}`,
      "giu"
    ),
  ];
  const facts = [];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const rawDuration = match.groups?.duration;
      if (!rawDuration) continue;
      const durationMatch = [rawDuration];
      durationMatch.index = match.index + match[0].lastIndexOf(rawDuration);
      const fact = extractDurationFacts({
        occurrence: {
          ...occurrence,
          documentStart: occurrence.context.documentStart + durationMatch.index,
          documentEnd:
            occurrence.context.documentStart +
            durationMatch.index +
            rawDuration.length,
        },
        binding,
      }).find(({ source }) => source.exactText === rawDuration);
      if (fact) facts.push(fact);
    }
  }
  return facts;
}

function extractContractTermDurationFacts({ occurrence, binding }) {
  const { text } = validatedContext(occurrence);
  const pattern =
    /(?:Vertragslaufzeit|Laufzeit(?:\s+des\s+Vertrages)?)\s*(?:von\s+)?(mind(?:estens)?\.?\s+)?(\d{1,3})\s+Jahr(?:e|en)?/giu;
  return [...text.matchAll(pattern)]
    .filter((match) => valueFollowsCandidate(occurrence, match))
    .map((match) => {
      const count = Number(match[2]);
      if (!Number.isInteger(count))
        throw requestedFieldError("REQUESTED_FIELD_DURATION_INVALID", match[0]);
      return sourceBoundFact({
        occurrence,
        binding,
        match,
        value: {
          normalizedValue: `${match[1] ? "mindestens " : ""}${count} ${
            count === 1 ? "Jahr" : "Jahre"
          }`,
          valueType: "DURATION",
          unit: "YEAR",
        },
      });
    });
}

function extractExtensionPeriodDurationFacts({ occurrence, binding }) {
  const genericFacts = extractDurationFacts({ occurrence, binding });
  const { text } = validatedContext(occurrence);
  const additionalFacts = [
    ...text.matchAll(
      /(?<![\p{L}\p{N}])ein(?:e[rmn]?)?\s+weiter(?:e[snrm]?)?\s+Jahr(?:e|en)?(?![\p{L}\p{N}])/giu
    ),
  ]
    .filter((match) => valueFollowsCandidate(occurrence, match))
    .map((match) =>
      sourceBoundFact({
        occurrence,
        binding,
        match,
        value: {
          normalizedValue: "1 Jahr",
          valueType: "DURATION",
          unit: "YEAR",
        },
      })
    );
  return [...genericFacts, ...additionalFacts];
}

function extractTotalPremiumFacts({ occurrence, binding }) {
  const { text } = validatedContext(occurrence);
  const pattern =
    /Gesamtprämie(?:\s+(?:inkl\.?|inklusive)\s+Steuern)?(?:\s+\(Bruttoprämie\))?\s+(?:beträgt|beläuft\s+sich\s+auf)\s+(?:(monatlich|vierteljährlich|halbjährlich|jährlich)\s+)?((?:EUR|€)\s*\d+(?:\.\d{3})*(?:,\d{2})?)(?![\p{L}\p{N}])/giu;
  return [...text.matchAll(pattern)]
    .filter((match) => valueFollowsCandidate(occurrence, match))
    .map((match) => {
      const rawAmount = match[2];
      const amountMatch = [rawAmount];
      amountMatch.index = match.index + match[0].lastIndexOf(rawAmount);
      return sourceBoundFact({
        occurrence,
        binding,
        match: amountMatch,
        value: {
          normalizedValue: `EUR ${rawAmount.replace(/^(?:EUR|€)\s*/iu, "")}`,
          valueType: "MONEY",
          unit: "EUR",
          ...(match[1] ? { qualifier: match[1].toLocaleLowerCase("de") } : {}),
        },
      });
    });
}

function whitespaceNormalized(value) {
  return String(value || "")
    .replace(/\s+/gu, " ")
    .trim();
}

function conditionNormalized(value) {
  return whitespaceNormalized(value).replace(/[;.]+$/u, "");
}

function protectedSentencePeriod(text, index) {
  if (text[index] !== ".") return false;
  const prefix = text.slice(Math.max(0, index - 16), index + 1);
  if (/(?:\bAbs|\bArt|\blit|\bNr|\bPkt|\bPkte|\bZiff|\bca)\.$/iu.test(prefix))
    return true;
  const nextNonWhitespace = text.slice(index + 1).match(/\S/u)?.[0] || "";
  return /\d/u.test(text[index - 1] || "") && /\d/u.test(nextNonWhitespace);
}

function protectedSoftLineBreak(text, index) {
  if (!/[\n\r]/u.test(text[index])) return false;
  const prefix = text.slice(Math.max(0, index - 24), index).trimEnd();
  return /(?:\bund|\boder|\bsowie|\bzur|\bzum|\bder|\bdes|\bdie|\bdas|\bvon|\bim|\bin|\bmit|\bnach|\bgemäß|\bf[üu]r|\bbei|\bauf|\baus|\bdurch|\bgegen|\bohne|\bsofern|\bwenn|\bals)$/iu.test(
    prefix
  );
}

function sentenceBoundaryAt(text, index, { softLineBreaks = false } = {}) {
  const character = text[index];
  if (/[\n\r]/u.test(character))
    return !(softLineBreaks || protectedSoftLineBreak(text, index));
  if (/[!?;]/u.test(character)) return true;
  return character === "." && !protectedSentencePeriod(text, index);
}

function occurrenceSentenceRange(occurrence) {
  const { text, documentStart } = validatedContext(occurrence);
  const softLineBreaks = occurrence?.context?.unitType === "PARAGRAPH";
  const relativeStart = Number(occurrence.documentStart) - documentStart;
  const relativeEnd = Number(occurrence.documentEnd) - documentStart;
  if (
    !Number.isInteger(relativeStart) ||
    !Number.isInteger(relativeEnd) ||
    relativeStart < 0 ||
    relativeEnd <= relativeStart ||
    relativeEnd > text.length
  )
    return null;
  let start = relativeStart;
  while (start > 0 && !sentenceBoundaryAt(text, start - 1, { softLineBreaks }))
    start -= 1;
  let end = relativeEnd;
  while (
    end < text.length &&
    !sentenceBoundaryAt(text, end, { softLineBreaks })
  )
    end += 1;
  if (end < text.length) end += 1;
  while (start < end && /\s/u.test(text[start])) start += 1;
  while (end > start && /\s/u.test(text[end - 1])) end -= 1;
  return end > start ? { start, end, text, documentStart } : null;
}

function extractTextualOccurrenceFact({ occurrence, binding }) {
  const range = occurrenceSentenceRange(occurrence);
  if (!range) return [];
  const rawValue = range.text.slice(range.start, range.end);
  const match = [rawValue];
  match.index = range.start;
  return [
    sourceBoundFact({
      occurrence,
      binding,
      match,
      value: {
        normalizedValue: conditionNormalized(rawValue),
        valueType: "TEXT",
        unit: null,
      },
    }),
  ];
}

function extractDateFacts({ occurrence, binding }) {
  return extractPatternFacts({
    occurrence,
    binding,
    localToOccurrence: true,
    patterns: [
      {
        pattern:
          /(?<!\d)(?:0?[1-9]|[12]\d|3[01])[.]\s*(?:0?[1-9]|1[0-2])[.]\s*(?:19|20)\d{2}(?!\d)/gu,
        normalize: (value) => whitespaceNormalized(value),
      },
      {
        pattern:
          /(?<!\d)(?:Jänner|Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+(?:19|20)\d{2}(?!\d)/giu,
        normalize: (value) => whitespaceNormalized(value),
      },
    ],
  });
}

function extractCoverageStartDateFacts({ occurrence, binding }) {
  const { text } = validatedContext(occurrence);
  const pattern =
    /(?:Versicherungsbeginn|Beginn\s+der\s+Versicherung)\s*:?\s*((?:0?[1-9]|[12]\d|3[01])[.]\s*(?:0?[1-9]|1[0-2])[.]\s*(?:19|20)\d{2})(?!\d)/giu;
  const facts = [];
  for (const match of text.matchAll(pattern)) {
    const rawDate = match[1];
    const dateMatch = [rawDate];
    dateMatch.index = match.index + match[0].lastIndexOf(rawDate);
    facts.push(
      sourceBoundFact({
        occurrence,
        binding,
        match: dateMatch,
        value: {
          normalizedValue: rawDate.replace(/\s+/gu, ""),
          valueType: "DATE",
          unit: null,
        },
      })
    );
  }
  return facts;
}

function extractInsurancePeriodConditionFacts({ occurrence, binding }) {
  return extractPatternFacts({
    occurrence,
    binding,
    patterns: [
      {
        pattern:
          /Der\s+Versicherungsschutz\s+beginnt\s+(?:erst\s+)?(?:mit|nach)\s+(?:Zugang|Erhalt)\s+der\s+(?:Polizze|Police)[.]/giu,
        normalize: (value) => conditionNormalized(value),
      },
      {
        pattern:
          /(?:Versicherungsbeginn|Beginn\s+der\s+Versicherung)\s*:?\s*(?:0?[1-9]|[12]\d|3[01])[.]\s*(?:0?[1-9]|1[0-2])[.]\s*(?:19|20)\d{2}(?:,\s*\d{1,2}:\d{2}\s*Uhr)?(?:,\s*(?:Versicherungsablauf|Ablauf\s+der\s+Versicherung)\s*:?\s*(?:0?[1-9]|[12]\d|3[01])[.]\s*(?:0?[1-9]|1[0-2])[.]\s*(?:19|20)\d{2}(?:,\s*\d{1,2}:\d{2}\s*Uhr)?)?/giu,
        normalize: (value) => whitespaceNormalized(value),
      },
    ],
  });
}

function extractThresholdFacts({ occurrence, binding }) {
  return extractPatternFacts({
    occurrence,
    binding,
    localToOccurrence: true,
    patterns: [
      {
        pattern:
          /(?<![\p{L}\p{N}])\d{1,3}(?:[.,]\d+)?\s*km\s*\/\s*h(?![\p{L}\p{N}])/giu,
        normalize: (value) => whitespaceNormalized(value),
      },
      {
        pattern:
          /(?<![\p{L}\p{N}])\d{1,3}(?:[.,]\d+)?\s*(?:mm|cm|m)(?![\p{L}\p{N}])/giu,
        normalize: (value) => whitespaceNormalized(value),
      },
    ],
  });
}

function extractAnnualCountFacts({ occurrence, binding }) {
  return extractPatternFacts({
    occurrence,
    binding,
    localToOccurrence: true,
    patterns: [
      {
        pattern:
          /(?<![\p{L}\p{N}])(?:\d{1,3}|ein(?:e[rmn]?)?|zwei|drei|vier|f(?:ue|ü)nf|sechs|sieben|acht|neun|zehn)\s*(?:mal|Fälle?)\s+(?:pro|je)\s+(?:Jahr|Kalenderjahr)(?![\p{L}\p{N}])/giu,
        normalize: (value) => whitespaceNormalized(value),
      },
    ],
  });
}

function extractPatternFacts({
  occurrence,
  binding,
  patterns,
  localToOccurrence = false,
}) {
  const { text } = validatedContext(occurrence);
  const localRange = localToOccurrence
    ? occurrenceSentenceRange(occurrence)
    : null;
  const facts = [];
  for (const { pattern, normalize } of patterns) {
    for (const match of text.matchAll(pattern)) {
      if (
        localToOccurrence &&
        (!localRange ||
          match.index < localRange.start ||
          match.index + match[0].length > localRange.end)
      )
        continue;
      facts.push(
        sourceBoundFact({
          occurrence,
          binding,
          match,
          value: {
            normalizedValue: normalize(match[0]),
            valueType: "TEXT",
            unit: null,
          },
        })
      );
    }
  }
  return facts.sort(
    (left, right) => left.source.documentStart - right.source.documentStart
  );
}

function extractUnderinsuranceConditionTypeFacts({ occurrence, binding }) {
  return extractPatternFacts({
    occurrence,
    binding,
    patterns: [
      {
        pattern: /f[üu]r\s+alle\s+jene\s+Objekte,\s+f[üu]r\s+die/giu,
        normalize: () => "bedingt",
      },
      {
        pattern: /im\s+Schadenfall\s+nur\s+Anwendung,\s+wenn/giu,
        normalize: () => "bedingt",
      },
      {
        pattern:
          /bezieht\s+sich\s+der\s+Verzicht\s+auf\s+den\s+Einwand\s+der\s+Unterversicherung\s+nur/giu,
        normalize: () => "bedingt",
      },
      {
        pattern:
          /verzichtet[\s\S]{0,180}?auf\s+den\s+Einwand\s+(?:einer\s+)?Unterversicherung[\s\S]{0,220}?soweit[\s\S]{0,120}?Versicherungssumme[\s\S]{0,160}?um\s+nicht\s+mehr\s+als\s+\d+(?:[.,]\d+)?\s*%[\s\S]{0,80}?vom\s+Versicherungswert\s+abweich\w*/giu,
        normalize: () => "bedingt",
      },
    ],
  });
}

function extractCurrentValueDurationFacts({ occurrence, binding }) {
  return extractPatternFacts({
    occurrence,
    binding,
    patterns: [
      {
        pattern:
          /nicht\s+innerhalb\s+dreier\s+Jahre\s+ab\s+dem\s+Schadentag[\s\S]{0,180}?Entsch[äa]digung\s+nach\s+dem\s+Zeitwert/giu,
        normalize: () =>
          "Wiederherstellung oder Wiederbeschaffung nicht innerhalb von 3 Jahren: Entschädigung zum Zeitwert",
      },
    ],
  });
}

function extractResidualValueThresholdFacts({ occurrence, binding }) {
  const parsed = residualValueThresholdForOccurrence(occurrence);
  if (!parsed) return [];
  return [
    sourceBoundFact({
      occurrence,
      binding,
      match: { 0: parsed.rawValue, index: parsed.start },
      value: {
        normalizedValue: parsed.normalizedPercent,
        valueType: "PERCENT",
        unit: "%",
        qualifier: `${RESIDUAL_VALUE_THRESHOLD_QUALIFIER}:${parsed.referenceBase}`,
      },
    }),
  ];
}

function extractRestorationDurationFacts({ occurrence, binding }) {
  const { text } = validatedContext(occurrence);
  const durationPattern =
    /(?<![\p{L}\p{N}])(?:3|drei|dreier|dreien|dreiem)\s+Jahr(?:e|en)?(?![\p{L}\p{N}])/giu;
  return [...text.matchAll(durationPattern)]
    .filter((match) => valueFollowsCandidate(occurrence, match))
    .map((match) =>
      sourceBoundFact({
        occurrence,
        binding,
        match,
        value: {
          normalizedValue: "3 Jahre",
          valueType: "DURATION",
          unit: "YEAR",
        },
      })
    );
}

function extractReinstatementDeadlineDurationFacts({ occurrence, binding }) {
  const { text } = validatedContext(occurrence);
  const cardinal =
    "(?:\\d{1,3}|ein(?:e[rmn]?)?|eins|zwei(?:e[rmn])?|drei(?:e[rmn])?|vier(?:e[rmn])?|f(?:ue|ü)nf(?:e[rmn])?|sechs(?:e[rmn])?|sieben(?:e[rmn])?|acht(?:e[rmn])?|neun(?:e[rmn])?|zehn(?:e[rmn])?|elf(?:e[rmn])?|zw(?:oe|ö)lf(?:e[rmn])?)";
  const duration = `(?<value>${cardinal})\\s+(?<unit>Stunde(?:n)?|Tag(?:e|en)?|Woche(?:n)?|Monat(?:e|en)?|Jahr(?:e|en)?)`;
  const restorationSubject =
    "(?:Wiederbeschaffung(?:\\s+oder\\s+Wiederherstellung)?|Wiederherstellung(?:\\s+oder\\s+Wiederbeschaffung)?)(?:\\s+(?:versicherter\\s+Sachen|des\\s+Gebäudes|der\\s+versicherten\\s+Sache))?";
  const patterns = [
    new RegExp(
      `${restorationSubject}\\s+(?:(?:muss|hat)\\s+)?(?:innerhalb|binnen)\\s+(?:von\\s+)?${duration}`,
      "giu"
    ),
    new RegExp(
      `(?:innerhalb|binnen)\\s+(?:von\\s+)?${duration}(?:\\s+(?:nach\\s+dem\\s+Schadenfall|ab\\s+dem\\s+Schadentag))?\\s+(?:wiederbeschafft|wiederhergestellt)`,
      "giu"
    ),
  ];
  const facts = [];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const rawValue = match.groups?.value;
      const rawUnit = match.groups?.unit;
      const rawDuration = rawValue && rawUnit ? `${rawValue} ${rawUnit}` : null;
      if (!rawDuration) continue;
      const count = normalizedGermanCardinal(rawValue);
      if (!Number.isInteger(count) || count < 1) continue;
      const durationMatch = [rawDuration];
      durationMatch.index = match.index + match[0].indexOf(rawDuration);
      if (!valueFollowsCandidate(occurrence, durationMatch)) continue;
      const unitText = rawUnit.toLocaleLowerCase("de");
      const unit = unitText.startsWith("stunde")
        ? "HOUR"
        : unitText.startsWith("tag")
          ? "DAY"
          : unitText.startsWith("woche")
            ? "WEEK"
            : unitText.startsWith("monat")
              ? "MONTH"
              : "YEAR";
      const labels = {
        HOUR: ["Stunde", "Stunden"],
        DAY: ["Tag", "Tage"],
        WEEK: ["Woche", "Wochen"],
        MONTH: ["Monat", "Monate"],
        YEAR: ["Jahr", "Jahre"],
      };
      facts.push(
        sourceBoundFact({
          occurrence,
          binding,
          match: durationMatch,
          value: {
            normalizedValue: `${count} ${labels[unit][count === 1 ? 0 : 1]}`,
            valueType: "DURATION",
            unit,
          },
        })
      );
    }
  }
  return facts;
}

function extractRestorationConditionFacts({ occurrence, binding }) {
  return extractPatternFacts({
    occurrence,
    binding,
    patterns: [
      {
        pattern:
          /Verwendung\s+der\s+Entschädigung\s+zur\s+Wiederbeschaffung\s+oder\s+Wiederherstellung[\s\S]{0,180}?innerhalb\s+dreier\s+Jahre[\s\S]{0,100}?sichergestellt\s+ist/giu,
        normalize: () =>
          "Neuwertanteil nur bei gesicherter Wiederbeschaffung oder Wiederherstellung innerhalb von 3 Jahren",
      },
      {
        pattern:
          /nicht\s+innerhalb\s+dreier\s+Jahre[\s\S]{0,180}?Entschädigung\s+nach\s+dem\s+Zeitwert/giu,
        normalize: () =>
          "Keine Wiederherstellung oder Wiederbeschaffung innerhalb von 3 Jahren: Entschädigung zum Zeitwert",
      },
      {
        pattern:
          /Frist\s+f[üu]r\s+die\s+Wiederherstellung\s+um\s+die\s+Dauer\s+des\s+Deckungsprozesses\s+erstreckt/giu,
        normalize: () =>
          "Wiederherstellungsfrist verlängert sich um die Dauer eines Deckungsprozesses",
      },
      {
        pattern:
          /Wiederherstellung\s+(?:bzw\.?|oder)\s+Wiederbeschaffung\s+zur\s+Gänze\s+sichergestellt/giu,
        normalize: () =>
          "Gesamtentschädigung nur bei vollständig gesicherter Wiederherstellung oder Wiederbeschaffung",
      },
      {
        pattern:
          /gesichert\s+ist,?\s+dass\s+die\s+Entschädigung\s+zur\s+Gänze\s+f[üu]r\s+die\s+Wiederherstellung\s+(?:bzw\.?|oder)\s+Wiederbeschaffung\s+verwendet\s+wird/giu,
        normalize: () =>
          "Gesamtentschädigung nur bei vollständig gesicherter Wiederherstellung oder Wiederbeschaffung",
      },
      {
        pattern:
          /Wiederherstellung\s+(?:bzw\.?|oder)\s+Wiederbeschaffung\s+(?:binnen|innerhalb(?:\s+von)?)\s+(?:3|drei|dreier)\s+Jahren?\s+ab\s+dem\s+(?:Eintritt\s+des\s+Schadenereignisses|Schadendatum|Schadentag)\s+erfolgt/giu,
        normalize: () =>
          "Wiederherstellung oder Wiederbeschaffung innerhalb von 3 Jahren ab dem Schadenereignis",
      },
      {
        pattern:
          /Frist\s+gilt\s+auch\s+gewahrt,?\s+wenn[\s\S]{0,100}?bindende\s+Wiederherstellungs-?\s*(?:bzw\.?|oder)\s*Wiederbeschaffungsaufträge\s+erteilt\s+werden/giu,
        normalize: () =>
          "Wiederherstellungsfrist wird durch bindende Wiederherstellungs- oder Wiederbeschaffungsaufträge gewahrt",
      },
      {
        pattern:
          /Wiederherstellung\s+eines\s+Gebäudes[\s\S]{0,100}?innerhalb\s+der\s+Europäischen\s+Union\s+erfolgt/giu,
        normalize: () =>
          "Gebäudewiederherstellung an bisheriger oder anderer Stelle innerhalb der Europäischen Union",
      },
      {
        pattern:
          /wiederbeschafften\s+(?:bzw\.?|oder)\s+wiederhergestellten\s+Sachen\s+dem\s+gleichen\s+Betriebs-?\s*(?:bzw\.?|oder)\s*Verwendungszweck\s+dienen/giu,
        normalize: () =>
          "Wiederbeschaffte oder wiederhergestellte Sachen müssen dem gleichen Betriebs- oder Verwendungszweck dienen",
      },
      {
        pattern:
          /F[üu]r\s+die\s+Wiederherstellung\s+gen[üu]gt\s+es,?\s+wenn[\s\S]{0,160}?Gebäude\s+hergestellt\s+werden,?\s+die\s+dem\s+gleichen\s+Zweck\s+dienen/giu,
        normalize: () =>
          "Wiederbeschaffte oder wiederhergestellte Sachen müssen dem gleichen Betriebs- oder Verwendungszweck dienen",
      },
      {
        pattern:
          /Wiederaufbau\s+(?:bzw\.?|oder)\s+die\s+Wiederherstellung[\s\S]{0,160}?innerhalb\s+Österreichs\s+erfolgen/giu,
        normalize: () => "Gebäudewiederherstellung innerhalb Österreichs",
      },
      {
        pattern:
          /Entschädigungsleistung\s+ist\s+jedoch\s+mit\s+jenem\s+Betrag\s+begrenzt,?\s+der\s+sich\s+bei(?:m)?\s+Wiederaufbau\s+(?:bzw\.?|oder)\s+(?:der\s+)?Wiederherstellung\s+an\s+der(?:selben|\s+bisherigen)\s+Stelle\s+und\s+im\s+gleichen\s+Umfang\s+ergeben\s+(?:würde|hätte)/giu,
        normalize: () =>
          "Wiederherstellungsentschädigung ist auf den Betrag am bisherigen Ort und im gleichen Umfang begrenzt",
      },
      {
        pattern:
          /Gebäude,?\s+die\s+sich\s+(?:bei\s+Eintritt\s+des\s+Schadenfalles\s+)?in\s+Bau\s+befinden\s+oder\s+bereits\s+errichtet\s+sind,?\s+gelten\s+nicht\s+als\s+Wiederherstellung/giu,
        normalize: () =>
          "Bereits in Bau befindliche oder errichtete Gebäude gelten nicht als Wiederherstellung",
      },
      {
        pattern:
          /Verwendung\s+der\s+Entschädigung\s+für\s+Sachen,?\s+die[\s\S]{0,100}?bereits\s+vorhanden\s+oder\s+bestellt\s+waren\s+oder\s+sich\s+in\s+Herstellung\s+befanden,?\s+gilt\s+nicht\s+als\s+Wiederherstellung\s+(?:bzw\.?|oder)\s+Wiederbeschaffung/giu,
        normalize: () =>
          "Bereits vorhandene, bestellte oder in Herstellung befindliche Sachen gelten nicht als Wiederherstellung oder Wiederbeschaffung",
      },
      {
        pattern:
          /Im\s+Falle\s+eines\s+Deckungsprozesses\s+wird\s+diese\s+Frist\s+um\s+die\s+Dauer\s+dieses\s+Prozesses\s+erstreckt/giu,
        normalize: () =>
          "Wiederherstellungsfrist verlängert sich um die Dauer eines Deckungsprozesses",
      },
      {
        pattern:
          /Werden\s+die\s+angeführten\s+Voraussetzungen\s+nicht\s+erfüllt,[\s\S]{0,180}?für\s+Gebäude[\s\S]{0,180}?(?:Verkehrswertes|Zeitwert)/giu,
        normalize: () =>
          "Bei Nichterfüllung der Wiederherstellungsbedingungen gilt für Gebäude höchstens Verkehrs- oder Zeitwertentschädigung",
      },
    ],
  });
}

function extractUnderinsurancePrerequisiteFacts({ occurrence, binding }) {
  return extractPatternFacts({
    occurrence,
    binding,
    patterns: [
      {
        pattern: /f[üu]r\s+die\s+ein\s+Neuwertsch[äa]tzgutachten\s+besteht/giu,
        normalize: conditionNormalized,
      },
      {
        pattern:
          /die\s+Versicherungssumme\s+dem\s+Neuwert\s+des\s+Gutachtens\s+entspricht/giu,
        normalize: conditionNormalized,
      },
      {
        pattern:
          /f[üu]r\s+die\s+Dauer\s+von\s+ca\.\s*3\s+Jahren,\s+ab\s+der\s+letzten\s+Anpassung\s+an\s+den\s+Baukostenindex/giu,
        normalize: conditionNormalized,
      },
      {
        pattern:
          /zum\s+Zeitpunkt\s+der\s+Vereinbarung\s+dieser\s+Wertanpassungsklausel[\s\S]{0,300}?entsprochen\s+hat;/giu,
        normalize: conditionNormalized,
      },
      {
        pattern:
          /die\s+nach\s+dem\s+Zeitpunkt\s+der\s+Vereinbarung\s+dieser\s+Wertanpassungsklausel[\s\S]{0,400}?entsprochen\s+hat;/giu,
        normalize: conditionNormalized,
      },
      {
        pattern:
          /die\s+infolge\s+von\s+Ver[äa]nderungen\s+der\s+versicherten\s+Sachen[\s\S]{0,400}?Ber[üu]cksichtigung\s+fand\./giu,
        normalize: conditionNormalized,
      },
      {
        pattern:
          /Bei\s+Bestehen\s+mehrfacher\s+Versicherungen\s+f[üu]r\s+dasselbe\s+Interesse[\s\S]{0,500}?Versicherungswert\s+entspricht\./giu,
        normalize: conditionNormalized,
      },
    ],
  });
}

function extractIndexTypeFacts({ occurrence, binding }) {
  return extractPatternFacts({
    occurrence,
    binding,
    patterns: [
      {
        pattern:
          /BKI\s*2020\s*\(Baukostenindex\s+f[üu]r\s+den\s+Wohnhaus-\s+und\s+Siedlungsbau\s*-\s*Baumeisterarbeiten\s+2020\s*-\s*Insgesamt\)/giu,
        normalize: () =>
          "BKI 2020 (Baukostenindex für den Wohnhaus- und Siedlungsbau – Baumeisterarbeiten 2020 – Insgesamt)",
      },
      {
        pattern: /Baukostenindex\s*\(Baumeisterarbeiten\)/giu,
        normalize: () => "Baukostenindex (Baumeisterarbeiten)",
      },
      {
        pattern:
          /Baukostenindex\s+f[üu]r\s+den\s+Wohnungs-\s+und\s+Siedlungsbau/giu,
        normalize: () => "Baukostenindex für den Wohnungs- und Siedlungsbau",
      },
    ],
  });
}

function extractRentLossCalculationBasisFacts({ occurrence, binding }) {
  return extractPatternFacts({
    occurrence,
    binding,
    patterns: [
      {
        pattern: /auf\s+Erstes\s+Risiko/giu,
        normalize: () => "auf Erstes Risiko",
      },
      {
        pattern: /bis\s+zu\s+sechs\s+Monaten/giu,
        normalize: () => "bis zu 6 Monate",
      },
      {
        pattern:
          /nachweisliche[nr]?\s+Entgang\s+an\s+versicherten\s+Erträgen[\s\S]{0,180}?variable\s+Kosten[\s\S]{0,80}?(?:wegfallen|vermindert\s+werden)/giu,
        normalize: () =>
          "nachweislicher Ertragsentgang abzüglich ersparter variabler Kosten",
      },
      {
        pattern:
          /Bestandzins\s+kraft\s+Gesetz\s+oder\s+nach\s+dem\s+Bestandvertrag\s+ganz\s+oder\s+teilweise\s+verweigern\s+kann/giu,
        normalize: () =>
          "Bestandzins wird gesetzlich oder vertraglich ganz oder teilweise verweigert",
      },
    ],
  });
}

function extractorFor(requirement, field, component = null) {
  const requirementId = requirement.id;
  const componentId =
    typeof component === "string" ? component : component?.id || null;
  if (
    field === "limit" &&
    component?.fieldGovernorPolicy === EXACT_CLAUSE_CODE_FIELD_GOVERNOR_POLICY
  )
    return extractExactClauseCodeFieldGovernorLimitFacts;
  if (
    requirementId === "FE-C07" &&
    componentId === FE_C07_COMPONENT_ID &&
    field === "limit"
  )
    return extractFeC07LimitFacts;
  if (
    requirementId === "FE-C07" &&
    componentId === FE_C07_COMPONENT_ID &&
    field === "condition"
  )
    return extractFeC07ConditionFacts;
  if (requirementId === "FE-F05" && field === "condition")
    return extractInsurancePeriodConditionFacts;
  if (requirementId === "FE-F05" && field === "date")
    return extractCoverageStartDateFacts;
  if (requirementId === "HP-02" && field === "limit")
    return extractAnnualAggregateMultipleFacts;
  if (requirementId === "HP-08" && field === "limit")
    return extractBuildersLiabilityConstructionSumFacts;
  if (requirementId === "VB-01" && field === "duration")
    return extractContractTermDurationFacts;
  if (requirementId === "VB-04" && field === "duration")
    return extractExtensionPeriodDurationFacts;
  if (requirementId === "VB-26" && field === "duration")
    return extractReinstatementDeadlineDurationFacts;
  if (requirementId === "VB-27" && field === "amount")
    return extractTotalPremiumFacts;
  if (requirementId === "VS-01" && field === "limit")
    return extractInsuredNewValueFacts;
  if (
    requirementId === "VS-02" &&
    field === "condition" &&
    componentId === "current_value_clause"
  )
    return extractCurrentValueDurationFacts;
  if (
    requirementId === "VS-02" &&
    field === "condition" &&
    componentId === "residual_value_threshold"
  )
    return extractResidualValueThresholdFacts;
  if (requirementId === "VS-16" && field === "limit")
    return extractLocalCoverageLimitFacts;
  if (requirementId === "VS-21" && field === "limit") return extractLimitFacts;
  if (requirementId === "VS-24" && field === "limit")
    return extractScaffoldingCostLimitFacts;
  if (requirementId === "VS-28" && field === "duration")
    return extractDurationFacts;
  if (requirementId === "VS-08" && field === "condition")
    return extractUnderinsuranceConditionTypeFacts;
  if (requirementId === "VS-09" && field === "condition")
    return extractUnderinsurancePrerequisiteFacts;
  if (requirementId === "VS-11" && field === "index_type")
    return extractIndexTypeFacts;
  if (requirementId === "VS-15" && field === "limit")
    return extractOutbuildingLimitFacts;
  if (requirementId === "VS-36" && field === "limit")
    return extractVs36MaximumIndemnityLimitFacts;
  if (
    ["VS-19", "VS-20", "VS-22", "VS-23", "VS-29", "VS-31", "VS-34"].includes(
      requirementId
    ) &&
    field === "limit"
  )
    return extractBoundLimitFacts;
  if (["VS-25", "VS-33"].includes(requirementId) && field === "limit")
    return extractBoundOrSectionGovernorLimitFacts;
  if (requirementId === "VS-29" && field === "calculation_basis")
    return extractRentLossCalculationBasisFacts;
  if (requirementId === "VS-31" && field === "duration")
    return extractDurationFacts;
  if (requirementId === "VS-35" && field === "duration")
    return extractRestorationDurationFacts;
  if (requirementId === "VS-35" && field === "condition")
    return extractRestorationConditionFacts;
  // Keep the validated VS value contract stable. Other category views use
  // conservative field-type extractors until a narrower category oracle
  // promotes a specialised extractor.
  if (requirementId.startsWith("VS-")) return null;
  if (["limit", "limits"].includes(field)) return extractCoverageLimitFacts;
  if (field === "amount") {
    const roles = new Set(
      (requirement.components || []).map(({ factRole }) => factRole)
    );
    if (roles.size === 1 && roles.has("DEDUCTIBLE"))
      return extractDeductibleFacts;
    if (roles.has("DEDUCTIBLE")) return null;
    return extractCoverageLimitFacts;
  }
  if (field === "deductible") return extractDeductibleFacts;
  if (field === "waiting_period") return extractWaitingPeriodFacts;
  if (["duration", "interval"].includes(field)) return extractDurationFacts;
  if (field === "threshold") return extractThresholdFacts;
  if (field === "date") return extractDateFacts;
  if (field === "annual_count") return extractAnnualCountFacts;
  if (["condition", "scope", "calculation_basis"].includes(field))
    return extractTextualOccurrenceFact;
  return null;
}

function valueCoversRequirement({
  indexed,
  field,
  binding,
  candidateById,
  bindingByCandidateId,
}) {
  if (indexed.requirement.components.length <= 1) return true;
  if (
    indexed.requirement.componentSatisfactionPolicy === "ANY" &&
    ["limit", "limits", "amount", "deductible", "waiting_period"].includes(
      field
    )
  )
    return true;
  if (
    indexed.requirement.id === "FE-F05" &&
    field === "date" &&
    indexed.component.id === "coverage_start"
  )
    return true;
  if (indexed.requirement.id === "FE-F05" && field === "date") return false;
  if (
    indexed.requirement.id === "VB-27" &&
    field === "amount" &&
    indexed.component.id === "total_premium"
  )
    return true;
  if (indexed.requirement.id === "VB-04" && field === "duration")
    return indexed.component.id === "extension_period";
  if (
    indexed.requirement.id === "VS-02" &&
    field === "condition" &&
    ["current_value_clause", "residual_value_threshold"].includes(
      indexed.component.id
    )
  )
    return true;
  if (
    field === "limit" &&
    indexed.component.fieldGovernorPolicy ===
      EXACT_CLAUSE_CODE_FIELD_GOVERNOR_POLICY
  )
    return true;
  if (
    field === "limit" &&
    indexed.component.factRole === "LIMIT" &&
    ["VS-22", "VS-23", "VS-25", "VS-31", "VS-33"].includes(
      indexed.requirement.id
    )
  )
    return true;
  if (indexed.requirement.id === "VS-31" && field === "duration") return true;
  if (
    indexed.requirement.id === "VS-35" &&
    ["duration", "condition"].includes(field) &&
    ["restoration_clause", "reconstruction_period"].includes(
      indexed.component.id
    )
  )
    return true;
  if (
    field === "limit" &&
    indexed.component.factRole === "INSURED_OBJECT" &&
    ["VS-15", "VS-19", "VS-20", "VS-34"].includes(indexed.requirement.id)
  )
    return true;
  if (!indexed.requirement.id.startsWith("VS-")) {
    const role = indexed.component.factRole;
    const localListItemAmount =
      ["limit", "limits", "amount", "deductible"].includes(field) &&
      ["PERIL", "DAMAGE"].includes(role) &&
      indexed.occurrence?.context?.unitType === "LIST_ITEM" &&
      String(indexed.occurrence?.context?.text || "").includes(
        String(indexed.occurrence?.exactText || "")
      ) &&
      /(?:EUR|€)\s*\d|\d{1,3}(?:[.,]\d+)?\s*%|ohne\s+betragliche\s+Beschr[aä]nkung/iu.test(
        String(indexed.occurrence?.context?.text || "")
      );
    if (localListItemAmount) return true;
    if (
      ["limit", "limits", "amount", "deductible"].includes(field) &&
      ["LIMIT", "DEDUCTIBLE", "COST", "BENEFIT", "INSURED_OBJECT"].includes(
        role
      )
    )
      return true;
    if (
      ["condition", "date", "scope"].includes(field) &&
      ["CONDITION", "DEFINITION", "DOCUMENT_STATUS"].includes(role)
    )
      return true;
    if (
      ["duration", "interval"].includes(field) &&
      ["CONDITION", "BENEFIT", "LIMIT"].includes(role)
    )
      return true;
    if (field === "threshold" && role === "DEFINITION") return true;
    if (field === "annual_count" && ["LIMIT", "CONDITION"].includes(role))
      return true;
    if (
      field === "calculation_basis" &&
      ["BENEFIT", "CONDITION", "DEFINITION"].includes(role)
    )
      return true;
  }
  const bindingGroupId = indexed.occurrence.bindingGroupId;
  if (!bindingGroupId) return false;

  const coveredComponentIds = new Set();
  for (const [candidateId, candidateBinding] of bindingByCandidateId) {
    if (candidateBinding !== binding) continue;
    const grouped = candidateById.get(candidateId);
    if (
      grouped.requirement.id === indexed.requirement.id &&
      grouped.occurrence.bindingGroupId === bindingGroupId
    )
      coveredComponentIds.add(grouped.component.id);
  }
  return indexed.requirement.components.every(({ id }) =>
    coveredComponentIds.has(id)
  );
}

const PERIL_SOURCE_OWNED_FIELDS = new Set([
  "limit",
  "limits",
  "amount",
  "deductible",
  "waiting_period",
]);

function selectedPerilFieldOwner({ indexed, fact }) {
  if (indexed?.component?.factRole !== "PERIL") return null;
  const occurrence = indexed.occurrence;
  const context = occurrence?.context;
  const contextText = context?.text;
  const contextStart = Number(context?.documentStart);
  const contextEnd = Number(context?.documentEnd);
  const occurrenceStart = Number(occurrence?.documentStart);
  const occurrenceEnd = Number(occurrence?.documentEnd);
  const exactText = occurrence?.exactText;
  const sourceStart = Number(fact?.source?.documentStart);
  const sourceEnd = Number(fact?.source?.documentEnd);
  if (
    typeof contextText !== "string" ||
    typeof exactText !== "string" ||
    !Number.isInteger(contextStart) ||
    !Number.isInteger(contextEnd) ||
    contextStart < 0 ||
    contextEnd !== contextStart + contextText.length ||
    !Number.isInteger(occurrenceStart) ||
    !Number.isInteger(occurrenceEnd) ||
    occurrenceStart < contextStart ||
    occurrenceEnd !== occurrenceStart + exactText.length ||
    occurrenceEnd > contextEnd ||
    contextText.slice(
      occurrenceStart - contextStart,
      occurrenceEnd - contextStart
    ) !== exactText ||
    !Number.isInteger(sourceStart) ||
    !Number.isInteger(sourceEnd) ||
    sourceStart < contextStart ||
    sourceEnd <= sourceStart ||
    sourceEnd > contextEnd
  )
    return null;
  return {
    candidateId: occurrence.candidateId,
    requirementId: indexed.requirement.id,
    componentId: indexed.component.id,
    contextLength: contextEnd - contextStart,
  };
}

function factOwnedByCurrentSelectedPeril({
  fact,
  field,
  indexed,
  candidateById,
  bindingByCandidateId,
}) {
  if (
    indexed.component.factRole !== "PERIL" ||
    !PERIL_SOURCE_OWNED_FIELDS.has(field)
  )
    return true;

  const owners = [];
  for (const [candidateId, binding] of bindingByCandidateId) {
    if (![VALUE_BINDING.DIRECT, VALUE_BINDING.NARROW_SCOPE].includes(binding))
      continue;
    const owner = selectedPerilFieldOwner({
      indexed: candidateById.get(candidateId),
      fact,
    });
    if (owner) owners.push(owner);
  }

  // Field governors may intentionally bind a value outside the candidate's
  // own context. This ownership rule applies only when the selected source
  // candidate itself provides a valid containing peril context.
  if (
    !owners.some(({ candidateId }) => candidateId === fact.source.candidateId)
  )
    return true;

  const shortestContext = Math.min(
    ...owners.map(({ contextLength }) => contextLength)
  );
  return owners
    .filter(({ contextLength }) => contextLength === shortestContext)
    .every(
      ({ requirementId, componentId }) =>
        requirementId === indexed.requirement.id &&
        componentId === indexed.component.id
    );
}

function extractPreferredFacts({
  worksheet,
  requirement,
  field,
  candidateById,
  bindingByCandidateId,
  bindingGroupById,
}) {
  const factsByBinding = new Map(
    Object.values(VALUE_BINDING).map((binding) => [binding, []])
  );
  for (const [candidateId, binding] of bindingByCandidateId) {
    if (!factsByBinding.has(binding)) continue;
    const indexed = candidateById.get(candidateId);
    if (indexed.requirement.id !== requirement.id) continue;
    const extractor = extractorFor(requirement, field, indexed.component);
    if (!extractor) continue;
    if (
      !valueCoversRequirement({
        indexed,
        field,
        binding,
        candidateById,
        bindingByCandidateId,
      })
    )
      continue;
    const facts = extractor({
      occurrence: indexed.occurrence,
      binding,
      worksheet,
    })
      .filter((fact) =>
        factOwnedByCurrentSelectedPeril({
          fact,
          field,
          indexed,
          candidateById,
          bindingByCandidateId,
        })
      )
      .map((fact) => {
        const componentScopedFact =
          (indexed.component.factRole === "INSURED_OBJECT" ||
            indexed.component.fieldGovernorPolicy ===
              EXACT_CLAUSE_CODE_FIELD_GOVERNOR_POLICY) &&
          indexed.requirement.components.length > 1
            ? {
                ...fact,
                componentScope: {
                  id: indexed.component.id,
                  label: indexed.component.label,
                },
              }
            : fact;
        const bindingGroupFieldApplicability =
          buildBindingGroupFieldApplicability({
            group: bindingGroupById.get(indexed.occurrence.bindingGroupId),
            candidateById,
            sourceCandidateId: candidateId,
            fact: componentScopedFact,
          });
        return bindingGroupFieldApplicability
          ? { ...componentScopedFact, bindingGroupFieldApplicability }
          : componentScopedFact;
      });
    factsByBinding.get(binding).push(...facts);
  }

  const preferred = [
    ...factsByBinding.get(VALUE_BINDING.DIRECT),
    ...factsByBinding.get(VALUE_BINDING.NARROW_SCOPE),
  ];
  const unique = new Map();
  for (const fact of preferred) {
    const componentDeduplicationScope =
      requirement.id === "VS-35"
        ? candidateById.get(fact.source?.candidateId)?.component?.id || ""
        : "";
    const key = [
      fact.binding,
      fact.source.documentStart,
      fact.source.documentEnd,
      fact.normalizedValue,
      componentDeduplicationScope,
    ].join(":");
    if (!unique.has(key)) unique.set(key, fact);
  }
  return [...unique.values()];
}

function selectedVariantScopesForField({
  requirement,
  field,
  candidateById,
  bindingByCandidateId,
}) {
  const scopes = new Map();
  for (const [candidateId, binding] of bindingByCandidateId) {
    if (!Object.values(VALUE_BINDING).includes(binding)) continue;
    const indexed = candidateById.get(candidateId);
    if (indexed.requirement.id !== requirement.id) continue;
    if (
      !valueCoversRequirement({
        indexed,
        field,
        binding,
        candidateById,
        bindingByCandidateId,
      })
    )
      continue;
    const scope = indexed.occurrence.variantScopeHint;
    if (scope?.key && scope?.label && !scopes.has(scope.key))
      scopes.set(scope.key, { key: scope.key, label: scope.label });
  }
  return [...scopes.values()];
}

function requestedFieldAbsenceAudit({
  requirement,
  field,
  candidateById,
  bindingByCandidateId,
}) {
  if (requirement.id !== "FE-C07" || field !== "condition") return null;
  const audits = [];
  for (const [candidateId, binding] of bindingByCandidateId) {
    if (![VALUE_BINDING.DIRECT, VALUE_BINDING.NARROW_SCOPE].includes(binding))
      continue;
    const indexed = candidateById.get(candidateId);
    if (
      indexed?.requirement?.id !== requirement.id ||
      indexed?.component?.id !== FE_C07_COMPONENT_ID
    )
      continue;
    const audit = buildFeC07ConditionAbsenceAudit({
      occurrence: indexed.occurrence,
      binding,
    });
    if (audit) audits.push(audit);
  }
  return audits.length === 1 ? audits[0] : null;
}

function fieldEvidenceStatus({ facts, variantScopes }) {
  if (facts.length === 0) return FIELD_EVIDENCE_STATUS.NOT_FOUND;
  if (variantScopes.length < 2) return FIELD_EVIDENCE_STATUS.FOUND;
  const evidencedScopes = new Set(
    facts.map((fact) => fact.variantScope?.key).filter(Boolean)
  );
  return variantScopes.every(({ key }) => evidencedScopes.has(key))
    ? FIELD_EVIDENCE_STATUS.FOUND
    : FIELD_EVIDENCE_STATUS.PARTIAL;
}

function aggregateRequestedFieldStatus(fields) {
  if (fields.length === 0) return REQUESTED_FIELD_STATUS.NOT_REQUIRED;
  const evaluated = fields.filter(
    ({ status }) => status !== FIELD_EVIDENCE_STATUS.NOT_EVALUATED
  );
  if (evaluated.length === 0) return REQUESTED_FIELD_STATUS.NOT_EVALUATED;
  const foundCount = fields.filter(
    ({ status }) => status === FIELD_EVIDENCE_STATUS.FOUND
  ).length;
  if (foundCount === fields.length) return REQUESTED_FIELD_STATUS.COMPLETE;
  if (
    fields.some(({ status }) => status === FIELD_EVIDENCE_STATUS.PARTIAL) ||
    foundCount > 0
  )
    return REQUESTED_FIELD_STATUS.PARTIAL;
  if (evaluated.length < fields.length) return REQUESTED_FIELD_STATUS.PARTIAL;
  return REQUESTED_FIELD_STATUS.NOT_FOUND;
}

/**
 * Binds deterministic requested-field values to server-owned candidate
 * sources under requirement-specific extraction contracts.
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
    worksheet,
    materializedCandidates,
    candidateById,
  });
  const bindingGroupById = new Map(
    (worksheet.bindingGroups || []).map((group) => [group.id, group])
  );

  const requirements = worksheet.requirements.map((requirement) => {
    const requestedFields = Array.isArray(requirement.requestedFields)
      ? [...requirement.requestedFields]
      : [];
    const optionalFields = Array.isArray(requirement.optionalFields)
      ? requirement.optionalFields.filter(
          (field) => !requestedFields.includes(field)
        )
      : [];
    const fields = [...requestedFields, ...optionalFields].map((field) => {
      const extractors = requirement.components
        .map((component) => extractorFor(requirement, field, component))
        .filter(Boolean);
      if (extractors.length === 0)
        return {
          field,
          status: FIELD_EVIDENCE_STATUS.NOT_EVALUATED,
          facts: [],
        };
      const facts = extractPreferredFacts({
        worksheet,
        requirement,
        field,
        candidateById,
        bindingByCandidateId,
        bindingGroupById,
      });
      const variantScopes = selectedVariantScopesForField({
        requirement,
        field,
        candidateById,
        bindingByCandidateId,
      });
      const absenceAudit =
        facts.length === 0
          ? requestedFieldAbsenceAudit({
              requirement,
              field,
              candidateById,
              bindingByCandidateId,
            })
          : null;
      return {
        field,
        status: fieldEvidenceStatus({ facts, variantScopes }),
        ...(variantScopes.length > 0 ? { variantScopes } : {}),
        ...(absenceAudit ? { absenceAudit } : {}),
        facts,
      };
    });
    return {
      requirementId: requirement.id,
      requestedFields,
      ...(optionalFields.length > 0 ? { optionalFields } : {}),
      requestedFieldStatus: aggregateRequestedFieldStatus(
        fields.filter(({ field }) => requestedFields.includes(field))
      ),
      fields,
    };
  });
  return { requirements };
}

module.exports = {
  FIELD_EVIDENCE_STATUS,
  LIMIT_KIND,
  REQUESTED_FIELD_STATUS,
  VALUE_BINDING,
  materializeRequestedFieldEvidence,
  validatedExactClauseCodeGovernor,
};

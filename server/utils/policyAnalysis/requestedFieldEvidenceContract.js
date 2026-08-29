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
  const variantScope = occurrence?.variantScopeHint;
  return {
    rawValue,
    normalizedValue: value.normalizedValue,
    valueType: value.valueType,
    unit: value.unit,
    ...(value.limitKind ? { limitKind: value.limitKind } : {}),
    ...(value.qualifier ? { qualifier: value.qualifier } : {}),
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

function limitQualifier(text, match) {
  const start = Math.max(0, match.index - 100);
  const end = Math.min(text.length, match.index + match[0].length + 140);
  const nearby = text.slice(start, end);
  const qualifiers = [];
  if (/auf\s+[„“"']*\s*Erstes\s+Risiko/iu.test(nearby))
    qualifiers.push("auf Erstes Risiko");
  if (/\b(?:je|pro)\s+Schadenfall\b/iu.test(nearby))
    qualifiers.push("je Schadenfall");
  return qualifiers.join(", ");
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
          qualifier: limitQualifier(text, match),
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
            qualifier: limitQualifier(text, concatenatedMoney),
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
          qualifier: limitQualifier(text, match),
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
          qualifier: limitQualifier(context.text, match),
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
  if (!percent) return [];
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

function whitespaceNormalized(value) {
  return String(value || "")
    .replace(/\s+/gu, " ")
    .trim();
}

function conditionNormalized(value) {
  return whitespaceNormalized(value).replace(/[;.]+$/u, "");
}

function occurrenceSentenceRange(occurrence) {
  const { text, documentStart } = validatedContext(occurrence);
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
  while (start > 0 && !/[.!?;\n\r]/u.test(text[start - 1])) start -= 1;
  let end = relativeEnd;
  while (end < text.length && !/[.!?;\n\r]/u.test(text[end])) end += 1;
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
    ],
  });
}

function extractCurrentValueConditionFacts({ occurrence, binding }) {
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
      {
        pattern: /Zeitwert\s+von\s+mindestens\s+30\s*%/giu,
        normalize: () => "Zeitwert mindestens 30 %",
      },
    ],
  });
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

function extractorFor(requirement, field) {
  const requirementId = requirement.id;
  if (requirementId === "VS-01" && field === "limit")
    return extractInsuredNewValueFacts;
  if (requirementId === "VS-02" && field === "condition")
    return extractCurrentValueConditionFacts;
  if (requirementId === "VS-21" && field === "limit") return extractLimitFacts;
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
  if (
    [
      "VS-19",
      "VS-20",
      "VS-22",
      "VS-23",
      "VS-29",
      "VS-31",
      "VS-34",
      "VS-36",
    ].includes(requirementId) &&
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
  if (["limit", "limits", "amount", "deductible"].includes(field))
    return extractBoundLimitFacts;
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
    indexed.requirement.id === "VS-02" &&
    field === "condition" &&
    ["current_value_clause", "residual_value_threshold"].includes(
      indexed.component.id
    )
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

function extractPreferredFacts({
  requirement,
  field,
  candidateById,
  bindingByCandidateId,
}) {
  const extractor = extractorFor(requirement, field);
  if (!extractor) return [];

  const factsByBinding = new Map(
    Object.values(VALUE_BINDING).map((binding) => [binding, []])
  );
  for (const [candidateId, binding] of bindingByCandidateId) {
    if (!factsByBinding.has(binding)) continue;
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
    const facts = extractor({ occurrence: indexed.occurrence, binding }).map(
      (fact) =>
        indexed.component.factRole === "INSURED_OBJECT" &&
        indexed.requirement.components.length > 1
          ? {
              ...fact,
              componentScope: {
                id: indexed.component.id,
                label: indexed.component.label,
              },
            }
          : fact
    );
    factsByBinding.get(binding).push(...facts);
  }

  const preferred = [
    ...factsByBinding.get(VALUE_BINDING.DIRECT),
    ...factsByBinding.get(VALUE_BINDING.NARROW_SCOPE),
  ];
  const unique = new Map();
  for (const fact of preferred) {
    const key = [
      fact.binding,
      fact.source.documentStart,
      fact.source.documentEnd,
      fact.normalizedValue,
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
    const optionalFields = Array.isArray(requirement.optionalFields)
      ? requirement.optionalFields.filter(
          (field) => !requestedFields.includes(field)
        )
      : [];
    const fields = [...requestedFields, ...optionalFields].map((field) => {
      const extractor = extractorFor(requirement, field);
      if (!extractor)
        return {
          field,
          status: FIELD_EVIDENCE_STATUS.NOT_EVALUATED,
          facts: [],
        };
      const facts = extractPreferredFacts({
        requirement,
        field,
        candidateById,
        bindingByCandidateId,
      });
      const variantScopes = selectedVariantScopesForField({
        requirement,
        field,
        candidateById,
        bindingByCandidateId,
      });
      return {
        field,
        status: fieldEvidenceStatus({ facts, variantScopes }),
        ...(variantScopes.length > 0 ? { variantScopes } : {}),
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
};

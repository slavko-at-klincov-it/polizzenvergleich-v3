const crypto = require("crypto");
const {
  A_DRIVEN_RUN_CONTRACT_ID,
  A_SOURCE_UNIT_PLAN_CONTRACT_ID,
  stableStringify,
} = require("./aDrivenSourceUnitPlan");

// Validates bounded model output and materializes server-owned A requirements.
// Inputs: a deterministic source-unit plan and untrusted per-unit responses.
// Output: a source-bound manifest plus terminal status for every A block/unit.
// Side effects: none. Invalid/missing/duplicate IDs become visible UNRESOLVED.
const A_BLOCK_TERMINAL_CONTRACT_ID = "LF_A_SOURCE_BLOCK_TERMINAL_V1";
const A_DYNAMIC_MANIFEST_CONTRACT_ID =
  "LF_A_DYNAMIC_SEMANTIC_REQUIREMENT_MANIFEST_V11";
const A_SEMANTIC_SIGNAL_CONTRACT_ID =
  "LF_A_REQUIREMENT_ROLE_EVIDENCE_COMPLETENESS_V1";

const TERMINAL_CLASSES = Object.freeze([
  "OPERATIVE_COVERAGE_STATEMENT",
  "EXCLUSION",
  "INSURED_OBJECT",
  "PERIL_OR_DAMAGE",
  "DEFINITION",
  "CONDITION",
  "COST",
  "LIMIT",
  "DEDUCTIBLE",
  "OBLIGATION",
  "DURATION",
  "VARIANT",
  "DOCUMENT_PRECEDENCE_OR_REPLACEMENT",
  "STRUCTURE",
  "METADATA",
  "DUPLICATE",
  "UNRESOLVED",
]);

const NON_OPERATIVE_CLASSES = new Set(["STRUCTURE", "METADATA", "DUPLICATE"]);
const OPERATIVE_CLASSES = new Set(
  TERMINAL_CLASSES.filter(
    (value) => !NON_OPERATIVE_CLASSES.has(value) && value !== "UNRESOLVED"
  )
);
const COMPONENT_TYPES = new Set([
  "OBJECT",
  "PERIL_OR_CAUSE",
  "DAMAGE_OR_EFFECT",
  "COVERAGE_EFFECT",
  "SCOPE",
  "FACT_ROLE",
  "CONDITION",
  "VALUE_AND_UNIT",
  "LIMIT_BASIS",
  "DEDUCTIBLE",
  "TEMPORAL_VALIDITY",
  "DOCUMENT_ROLE",
  "PRECEDENCE_OR_REPLACEMENT",
]);
const COVERAGE_EFFECTS = new Set([
  "INCLUDED",
  "EXCLUDED",
  "CONDITIONAL",
  "OPTIONAL",
  "UNKNOWN",
]);
const COVERAGE_EFFECT_TEXT_PATTERN =
  /\b(?:ausgeschlossen|ausgenommen(?:\s+sind)?|exklusive|ein(?:geschlossen|bezogen)|(?:mit)?gedeckt|(?:mit)?versichert|nicht\s+(?:mit)?versichert|kein(?:e[snmr]?)?\s+(?:Deckung|Versicherungsschutz)|Versicherungsschutz\s+(?:besteht|gilt)|besteht\s+Versicherungsschutz|gilt\s+als\s+(?:mit)?versichert|(?:nicht\s+)?ersetz(?:t|en|ten)|erstatt(?:et|en)|Entschädigung\s+(?:wird|erfolgt)|erfolgt\s+die\s+Entschädigung|\w*entschädigung\s+geleistet\s+wird|Anspruch\s+auf\s+(?:Zahlung|Leistung)|zur\s+Leistung\s+verpflichtet|verzichtet\s+der\s+Versicherer\s+auf\s+(?:den\s+)?Einwand|erstreckt\s+sich(?:\s+dabei)?\s+nicht|bezieht\s+sich(?:\s+\S+){0,10}\s+auf)\b/iu;
const REQUIREMENT_ROLE_SIGNALS = Object.freeze([
  Object.freeze({
    signalId: "EXPLICIT_EXCLUSION",
    pattern:
      /\b(?:ausgenommen|exklusive|ausgeschlossen|nicht\s+(?:mit)?versichert|kein(?:e[snmr]?)?\s+(?:Deckung|Versicherungsschutz))\b/giu,
    requiredComponentTypes: Object.freeze(["COVERAGE_EFFECT"]),
    requiredCoverageEffect: "EXCLUDED",
  }),
  Object.freeze({
    signalId: "EXPLICIT_CONDITION",
    pattern:
      /\b(?:sofern|wenn|falls|vorausgesetzt|soweit|muss|müssen)\b|\bunter\s+der\s+voraussetzung\b/giu,
    requiredComponentTypes: Object.freeze(["CONDITION"]),
  }),
  Object.freeze({
    signalId: "EXPLICIT_DEFINITION",
    pattern:
      /\bunter\s+[^.;:]{1,120}?\b(?:versteht\s+man|(?:ist|sind)\s+[^.;:]{0,80}\bzu\s+verstehen)\b[^.;:]*|\bist\s+der\s+versicherungsfall\s+[^.;:]+|\b(?:gilt|gelten)\b[^.;:]{0,220}\bals\s+(?:eingetreten|zugegangen|gegeben)\b[^.;:]*/giu,
    requiredComponentTypes: Object.freeze(["FACT_ROLE"]),
  }),
  Object.freeze({
    signalId: "EXPLICIT_COPULAR_DEFINITION",
    pattern:
      /(?:(?<![\s\S])|(?<=[.!?]\s))\b(?!(?:\p{L}[\p{L}-]*\s+){0,3}(?:mit)?versichert\s+(?:ist|sind)\b)\p{Lu}[\p{L}-]*(?:\s+\p{L}[\p{L}-]*){0,3}\s+(?:ist|sind)\s+(?!\s*(?:mit)?versichert\b|\s*gedeckt\b|\s*ausgeschlossen\b|\s*verpflichtet\b|\s*berechtigt\b)[^.;:]{1,180}\b(?:Gebäude|Anbauten|Sachen|Personen|Unternehmen|Flächen|Anlagen)\b[^.;:]*/gu,
    requiredComponentTypes: Object.freeze(["FACT_ROLE"]),
  }),
  Object.freeze({
    signalId: "EXPLICIT_PERIL_OR_CAUSE",
    pattern:
      /\b(?:schäden?|beschädigung(?:en)?)\b[^.;:]{0,320}\bdurch\s+(?=\S)[^.;:]+|(?:^|[•-]\s*)(?:\p{L}[\p{L}-]*\s+){0,4}\p{L}[\p{L}-]*schäden\b[^.;:]*/gimu,
    requiredComponentTypes: Object.freeze(["PERIL_OR_CAUSE"]),
  }),
  Object.freeze({
    signalId: "EXPLICIT_DEDUCTIBLE",
    pattern:
      /\b(?:selbstbehalt|eigenbehalt)\p{L}*\b|\bin\s+(?:jedem|einem)\s+schadenfall\b[^.;:]{0,160}\b(?:betrag|entschädigung)\b[^.;:]{0,80}\bum\s+[0-9lI]+(?:[.,][0-9lI]+)?\s*%\s+gekürzt\b/giu,
    requiredComponentTypes: Object.freeze(["DEDUCTIBLE"]),
  }),
  Object.freeze({
    signalId: "EXPLICIT_QUANTIFIED_VALUE",
    pattern:
      /\b(?:bis(?:\s+zu)?|höchstens|maximal|max\.|mindestens|längstens|nicht\s+mehr\s+als|in\s+höhe\s+von|beträgt|versicherungssumme\s+von|ersetzt)\s+(?:voraussichtlich\s+)?(?:(?:€|EUR|Euro)\s*)?(?:[0-9lI]+(?:[.,][0-9lI]+)?)(?:\s*(?:%|€|EUR|Euro|m(?:²|2)?|qm|Tage?|Monate?|Jahre?))?(?=$|[\s,.;:)\]])|\b(?:selbstbehalt|eigenbehalt)\p{L}*(?:\s+(?:von|beträgt))?\s+(?:(?:€|EUR|Euro)\s*)?[0-9lI]+(?:[.,][0-9lI]+)?(?:\s*(?:%|€|EUR|Euro))?\b|(?:(?:€|EUR|Euro)\s*[0-9lI]+(?:[.,][0-9lI]+)?|[0-9lI]+(?:[.,][0-9lI]+)?\s*(?:%|€|EUR|Euro))\s*(?:pro|je)\s+(?:schadenfall|objekt|einheit)\b|\b[0-9lI]+(?:[.,][0-9lI]+)?\s*%\s+(?:auf\s+)?erstes\s+risiko\b|\b[0-9]+(?:[.,][0-9]+)?\s*(?:m(?:²|2)?|qm|Tage?|Monate?|Jahre?)(?=$|[\s,.;:)\]])/giu,
    requiredComponentTypes: Object.freeze(["VALUE_AND_UNIT"]),
  }),
  Object.freeze({
    signalId: "EXPLICIT_LIMIT_BASIS",
    pattern:
      /\b(?:[0-9lI]+(?:[.,][0-9]+)?\s*%|€\s*[0-9lI][0-9lI.,\s]*|(?:EUR|Euro)\s*[0-9lI][0-9lI.,\s]*)\s*(?:der\s+)?(?:gebäude(?:gesamt)?versicherungssumme|versicherungssumme|erstes\s+risiko)\b/giu,
    requiredComponentTypes: Object.freeze(["LIMIT_BASIS"]),
  }),
  Object.freeze({
    signalId: "EXPLICIT_COST_ROLE",
    pattern: /\b(?:kosten|mehrkosten|aufwendungen)\b(?!-)/giu,
    requiredComponentTypes: Object.freeze(["FACT_ROLE"]),
  }),
  Object.freeze({
    signalId: "EXPLICIT_NON_NUMERIC_LIMIT",
    pattern:
      /\b(?:versicherungssummen?\s+(?:werden\s+)?nicht\s+addiert|nur\s+einmal\s+pro\s+schadenfall|bis\s+zur\s+höhe\s+der\s+(?:jeweils\s+)?vereinbarten\s+versicherungssumme|bis\s+zu\s+(?:der|den)\s+(?:\p{L}+\s+){0,12}versicherungssummen?|auf\s+die\s+(?:pauschal)?versicherungssumme\s+angerechnet|mit\s+jenem\s+betrag\s+begrenzt|nicht\s+limitiert|bis\s+zu\s+(?:einem|einer|eines|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|elf|zwölf)\s+(?:tag(?:e|en)?|monat(?:e|en)?|jahr(?:e|en)?)|höchstens\s+(?:einem|einer|eines|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|elf|zwölf)(?:monatigen?|jährigen?|\s+(?:tag(?:e|en)?|monat(?:e|en)?|jahr(?:e|en)?)))\b/giu,
    requiredComponentTypes: Object.freeze(["LIMIT_BASIS"]),
  }),
]);

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function manifestError(code, detail) {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  return error;
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function comparableText(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[„“”«»]/gu, '"')
    .replace(/\s+/gu, " ")
    .trim()
    .replace(/(^| )[-–—•▪] (?=\S)/gu, "$1• ");
}

function layoutComparableText(value) {
  return comparableText(value).replace(/(\p{L})-\s+(?=\p{L})/gu, "$1-");
}

function selectedSourceText(sourceBlockIds, blocks) {
  return blocks
    .filter(({ blockId }) => sourceBlockIds.includes(blockId))
    .map(({ exactText }) => exactText)
    .join("\n")
    .trim();
}

function differsByOneEdit(left, right) {
  if (Math.abs(left.length - right.length) > 1 || left === right) return false;
  if (left.length === right.length) {
    let differences = 0;
    for (let index = 0; index < left.length; index += 1) {
      if (left[index] !== right[index]) differences += 1;
      if (differences > 1) return false;
    }
    return differences === 1;
  }
  const shorter = left.length < right.length ? left : right;
  const longer = left.length < right.length ? right : left;
  let shorterIndex = 0;
  let longerIndex = 0;
  let edits = 0;
  while (shorterIndex < shorter.length && longerIndex < longer.length) {
    if (shorter[shorterIndex] === longer[longerIndex]) {
      shorterIndex += 1;
      longerIndex += 1;
      continue;
    }
    edits += 1;
    longerIndex += 1;
    if (edits > 1) return false;
  }
  return true;
}

function uniqueSingleEditSourceSubstring(source, value) {
  if (value.length < 16) return null;
  const boundary = (character) =>
    character === undefined || /[\s,.;:!?()[\]{}]/u.test(character);
  const matches = new Set();
  for (const length of [value.length - 1, value.length, value.length + 1]) {
    if (length < 1 || length > source.length) continue;
    for (let start = 0; start + length <= source.length; start += 1) {
      if (!boundary(source[start - 1]) || !boundary(source[start + length]))
        continue;
      const candidate = source.slice(start, start + length);
      if (differsByOneEdit(candidate, value)) matches.add(candidate);
      if (matches.size > 1) return null;
    }
  }
  return matches.size === 1 ? [...matches][0] : null;
}

function canonicalExactSourceText(value, sourceBlockIds, blocks) {
  const exact = selectedSourceText(sourceBlockIds, blocks);
  const caseInsensitiveIndex = exact
    .toLocaleLowerCase("de-AT")
    .indexOf(value.toLocaleLowerCase("de-AT"));
  if (caseInsensitiveIndex >= 0)
    return exact.slice(
      caseInsensitiveIndex,
      caseInsensitiveIndex + value.length
    );
  if (!exact) return value;
  const comparableExact = comparableText(exact);
  const comparableValue = comparableText(value);
  if (comparableExact.includes(comparableValue)) return value;
  if (layoutComparableText(exact) === layoutComparableText(value)) return exact;
  const sourceCorrection = uniqueSingleEditSourceSubstring(
    comparableExact,
    comparableValue
  );
  if (sourceCorrection) return sourceCorrection;
  return value;
}

function uniqueStrings(values) {
  if (!Array.isArray(values) || values.some((value) => !text(value)))
    return null;
  const normalized = values.map(text);
  return new Set(normalized).size === normalized.length ? normalized : null;
}

function isLayoutOnlyBlock(block) {
  return /^[•▪◦‣]+$/u.test(String(block?.exactText || "").trim());
}

function matchesForPattern(pattern, value) {
  return [
    ...String(value || "").matchAll(
      new RegExp(
        pattern.source,
        pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`
      )
    ),
  ].map((match) => match[0]);
}

function comparableSignalText(value) {
  return comparableText(value).toLocaleLowerCase("de-AT");
}

function matchedEvidenceBlockIds(matchedEvidence) {
  return matchedEvidence.blockIds || [matchedEvidence.blockId];
}

function componentHasSignalSource(component, matchedEvidence) {
  return matchedEvidenceBlockIds(matchedEvidence).some((blockId) =>
    component.sourceBlockIds.includes(blockId)
  );
}

function quantifiedLiterals(value) {
  return [
    ...String(value || "").matchAll(
      /(?:€\s*)?[0-9lI]+(?:[.,][0-9lI]+)?\s*(?:%|€|EUR|Euro|Tage?|Monate?|Jahre?)?/giu
    ),
  ]
    .map(
      ([literal]) =>
        comparableSignalText(literal).match(/[0-9lI]+(?:[.,][0-9lI]+)?/iu)?.[0]
    )
    .filter(Boolean)
    .filter((literal) => /[0-9lI]/iu.test(literal));
}

function quantifiedComponent(signalMatch, sourceBlockIds) {
  const valueMatch = signalMatch.match(/[0-9]+(?:[.,][0-9]+)?/u);
  if (!valueMatch) return null;
  const beforeValue = signalMatch.slice(0, valueMatch.index);
  const afterValue = signalMatch.slice(valueMatch.index + valueMatch[0].length);
  const unitMatch =
    afterValue.match(
      /^\s*(%|€|EUR|Euro|m(?:²|2)?|qm|Tage?|Monate?|Jahre?)/iu
    ) || beforeValue.match(/(€|EUR|Euro)\s*$/iu);
  return {
    type: "VALUE_AND_UNIT",
    label: signalMatch,
    sourceBlockIds,
    rawValue: valueMatch[0],
    ...(unitMatch ? { unit: unitMatch[1] } : {}),
  };
}

function componentSupportsSignal(signal, component, matchedEvidence) {
  if (!componentHasSignalSource(component, matchedEvidence)) return false;
  if (signal.signalId === "EXPLICIT_EXCLUSION")
    return (
      component.type === "COVERAGE_EFFECT" &&
      component.coverageEffect === "EXCLUDED" &&
      matchesForPattern(signal.pattern, component.label).length > 0
    );
  if (signal.signalId === "EXPLICIT_QUANTIFIED_VALUE") {
    const literals = quantifiedLiterals(matchedEvidence.match);
    const componentValue = comparableSignalText(
      [component.rawValue, component.label].filter(Boolean).join(" ")
    );
    const carriesLiteral = literals.some((literal) =>
      componentValue.includes(literal)
    );
    return (
      carriesLiteral &&
      (component.type === "VALUE_AND_UNIT" || component.type === "DEDUCTIBLE")
    );
  }
  if (signal.signalId === "EXPLICIT_COST_ROLE")
    return (
      component.type === "FACT_ROLE" &&
      /\b(?:kosten|mehrkosten|aufwendungen)\b/iu.test(component.label)
    );
  return signal.requiredComponentTypes.includes(component.type);
}

function signalApplies(signal, matchedEvidence, unit) {
  const exactText = comparableSignalText(matchedEvidence.exactText);
  const matchedText = comparableSignalText(matchedEvidence.match);
  const governingText = comparableSignalText(
    (unit?.governingContext?.blocks || [])
      .map(({ exactText: blockText }) => blockText)
      .join("\n")
  );
  if (
    signal.signalId === "EXPLICIT_EXCLUSION" &&
    [
      /\bhaftung\s+für\s+eine\s+.+pflichtverletzung\b.+\bausgeschlossen\b/iu,
      /\bsoweit\b.+\bkeine\s+deckung\s+finden\b/iu,
      ...(matchedText.startsWith("ausgenommen")
        ? [
            /\b(?:nicht\s+(?:mit)?versichert|ausgeschlossen|kein(?:e[snmr]?)?\s+(?:deckung|versicherungsschutz))\b[^.;:]*\bausgenommen\b/iu,
          ]
        : []),
    ].some((pattern) => pattern.test(`${governingText}\n${exactText}`))
  )
    return false;
  return true;
}

function signalBelongsToRequirement(unit, requirement, signal, blockIds) {
  if (
    blockIds.some((blockId) =>
      (unit.governingContext?.blockIds || []).includes(blockId)
    )
  )
    return true;
  if (!requirement.displayLabel) return true;
  const localTexts = [
    requirement.displayLabel,
    ...requirement.components.flatMap((component) =>
      component.sourceBlockIds.some((blockId) => blockIds.includes(blockId))
        ? [component.label]
        : []
    ),
  ].filter(Boolean);
  if (localTexts.length > 1) localTexts.push(localTexts.join("\n"));
  return localTexts.some(
    (localText) => matchesForPattern(signal.pattern, localText).length > 0
  );
}

function requirementSignalEvidence(unit, requirement, signal) {
  const selectedBlockIds = new Set([
    ...(unit.governingContext?.blockIds || []),
    ...requirement.sourceBlockIds,
  ]);
  const selectedBlocks = evidenceBlocks(unit).filter(({ blockId }) =>
    selectedBlockIds.has(blockId)
  );
  const evidence = selectedBlocks.flatMap((block) =>
    matchesForPattern(signal.pattern, block.exactText).map((match) => ({
      blockId: block.blockId,
      blockIds: [block.blockId],
      exactText: block.exactText,
      match,
    }))
  );
  if (selectedBlocks.length > 1) {
    const combinedText = selectedBlocks
      .map(({ exactText }) => exactText)
      .join("\n");
    for (const match of matchesForPattern(signal.pattern, combinedText)) {
      const blockIds = minimalSourceRange(
        unit,
        match,
        [...selectedBlockIds],
        selectedBlocks
      );
      if (!blockIds?.length) continue;
      evidence.push({
        blockId: blockIds[0],
        blockIds,
        exactText: combinedText,
        match,
      });
    }
  }
  return [
    ...new Map(
      evidence
        .filter(({ blockIds }) =>
          signalBelongsToRequirement(unit, requirement, signal, blockIds)
        )
        .map((entry) => [
          stableStringify({ blockIds: entry.blockIds, match: entry.match }),
          entry,
        ])
    ).values(),
  ];
}

function requirementRoleEvidenceDiagnostics(unit, requirements) {
  return requirements.flatMap((requirement, requirementIndex) => {
    const observedComponentTypes = [
      ...new Set(requirement.components.map(({ type }) => type)),
    ].sort();
    return REQUIREMENT_ROLE_SIGNALS.flatMap((signal) => {
      const matchedEvidence = requirementSignalEvidence(
        unit,
        requirement,
        signal
      );
      if (!matchedEvidence.length) return [];
      return matchedEvidence.flatMap((evidence) => {
        if (!signalApplies(signal, evidence, unit)) return [];
        if (
          requirement.components.some((component) =>
            componentSupportsSignal(signal, component, evidence)
          )
        )
          return [];
        return [
          {
            code: "REQUIREMENT_ROLE_EVIDENCE_UNMAPPED",
            unitId: unit.unitId,
            requirementIndex,
            signalContractId: A_SEMANTIC_SIGNAL_CONTRACT_ID,
            signalId: signal.signalId,
            requiredComponentGroups: [signal.requiredComponentTypes],
            ...(signal.requiredCoverageEffect
              ? { requiredCoverageEffect: signal.requiredCoverageEffect }
              : {}),
            observedComponentTypes,
            matchedEvidence: [evidence],
          },
        ];
      });
    });
  });
}

function materializeSharedSignalComponents(unit, requirements) {
  const materialized = requirements.map((requirement) => ({
    ...requirement,
    components: [...requirement.components],
  }));
  const diagnostics = [];
  for (const [requirementIndex, requirement] of materialized.entries()) {
    for (const signal of REQUIREMENT_ROLE_SIGNALS) {
      const matchedEvidence = requirementSignalEvidence(
        unit,
        requirement,
        signal
      );
      for (const evidence of matchedEvidence) {
        if (
          !signalApplies(signal, evidence, unit) ||
          requirement.components.some((component) =>
            componentSupportsSignal(signal, component, evidence)
          )
        )
          continue;
        const candidates = materialized.flatMap(
          (sibling, siblingRequirementIndex) =>
            siblingRequirementIndex === requirementIndex
              ? []
              : sibling.components
                  .filter(
                    (component) =>
                      component.sourceBlockIds.every((blockId) =>
                        [
                          ...requirement.sourceBlockIds,
                          ...(unit.governingContext?.blockIds || []),
                        ].includes(blockId)
                      ) && componentSupportsSignal(signal, component, evidence)
                  )
                  .map((component) => ({
                    component,
                    siblingRequirementIndex,
                  }))
        );
        const uniqueCandidates = [
          ...new Map(
            candidates.map((candidate) => [
              stableStringify(candidate.component),
              candidate,
            ])
          ).values(),
        ];
        if (uniqueCandidates.length === 1) {
          const [{ component, siblingRequirementIndex }] = uniqueCandidates;
          requirement.components.push({ ...component });
          diagnostics.push({
            code: "SHARED_SIGNAL_COMPONENT_MATERIALIZED",
            unitId: unit.unitId,
            requirementIndex,
            sourceRequirementIndex: siblingRequirementIndex,
            signalContractId: A_SEMANTIC_SIGNAL_CONTRACT_ID,
            signalId: signal.signalId,
            componentType: component.type,
            sourceBlockIds: component.sourceBlockIds,
          });
          continue;
        }
        if (
          ![
            "EXPLICIT_CONDITION",
            "EXPLICIT_DEFINITION",
            "EXPLICIT_COPULAR_DEFINITION",
            "EXPLICIT_PERIL_OR_CAUSE",
            "EXPLICIT_COST_ROLE",
            "EXPLICIT_QUANTIFIED_VALUE",
            "EXPLICIT_LIMIT_BASIS",
            "EXPLICIT_NON_NUMERIC_LIMIT",
            "EXPLICIT_DEDUCTIBLE",
          ].includes(signal.signalId)
        )
          continue;
        const localCandidates = [
          ...new Map(
            requirement.components
              .filter(
                (component) =>
                  !signal.requiredComponentTypes.includes(component.type) &&
                  matchedEvidenceBlockIds(evidence).some((blockId) =>
                    component.sourceBlockIds.includes(blockId)
                  ) &&
                  matchesForPattern(signal.pattern, component.label).length > 0
              )
              .map((component) => [
                stableStringify({
                  label: component.label,
                  sourceBlockIds: component.sourceBlockIds,
                }),
                component,
              ])
          ).values(),
        ];
        const localComponent =
          localCandidates.length === 1 ? localCandidates[0] : null;
        const evidenceBackedSignal = [
          "EXPLICIT_DEFINITION",
          "EXPLICIT_COPULAR_DEFINITION",
          "EXPLICIT_PERIL_OR_CAUSE",
          "EXPLICIT_QUANTIFIED_VALUE",
        ].includes(signal.signalId);
        const localText =
          localComponent?.label ||
          (evidenceBackedSignal ? evidence.match : requirement.displayLabel);
        const localMatches = evidenceBackedSignal
          ? [evidence.match]
          : matchesForPattern(signal.pattern, localText);
        if (
          localCandidates.length > 1 ||
          localMatches.length === 0 ||
          (!localComponent &&
            ![
              "EXPLICIT_CONDITION",
              "EXPLICIT_DEFINITION",
              "EXPLICIT_COPULAR_DEFINITION",
              "EXPLICIT_PERIL_OR_CAUSE",
              "EXPLICIT_QUANTIFIED_VALUE",
            ].includes(signal.signalId))
        )
          continue;
        const matchIndex =
          signal.signalId === "EXPLICIT_PERIL_OR_CAUSE"
            ? 0
            : localText
                .toLocaleLowerCase("de-AT")
                .indexOf(localMatches[0].toLocaleLowerCase("de-AT"));
        if (matchIndex < 0) continue;
        const label =
          signal.signalId === "EXPLICIT_CONDITION"
            ? localText.slice(matchIndex).trim()
            : signal.signalId === "EXPLICIT_PERIL_OR_CAUSE"
              ? (
                  /(?:^|\s)durch\s+(.+)$/isu.exec(evidence.match)?.[1] ||
                  localMatches[0]
                ).trim()
              : signal.signalId === "EXPLICIT_COST_ROLE"
                ? localText
                : localMatches[0];
        const sourceBlockIds =
          minimalSourceRange(unit, label, requirement.sourceBlockIds) ||
          (localComponent ? [...localComponent.sourceBlockIds] : null);
        const allowedSourceBlockIds = new Set([
          ...requirement.sourceBlockIds,
          ...(unit.governingContext?.blockIds || []),
        ]);
        if (
          !sourceBlockIds?.length ||
          sourceBlockIds.some((blockId) => !allowedSourceBlockIds.has(blockId))
        )
          continue;
        const localRole =
          signal.signalId === "EXPLICIT_QUANTIFIED_VALUE"
            ? quantifiedComponent(label, sourceBlockIds)
            : {
                type:
                  signal.signalId === "EXPLICIT_CONDITION"
                    ? "CONDITION"
                    : [
                          "EXPLICIT_DEFINITION",
                          "EXPLICIT_COPULAR_DEFINITION",
                        ].includes(signal.signalId)
                      ? "FACT_ROLE"
                      : signal.signalId === "EXPLICIT_PERIL_OR_CAUSE"
                        ? "PERIL_OR_CAUSE"
                        : signal.signalId === "EXPLICIT_COST_ROLE"
                          ? "FACT_ROLE"
                          : signal.signalId === "EXPLICIT_DEDUCTIBLE"
                            ? "DEDUCTIBLE"
                            : "LIMIT_BASIS",
                label,
                sourceBlockIds,
              };
        if (!localRole) continue;
        requirement.components.push(localRole);
        diagnostics.push({
          code: "LOCAL_SIGNAL_COMPONENT_MATERIALIZED",
          unitId: unit.unitId,
          requirementIndex,
          sourceRequirementIndex: requirementIndex,
          signalContractId: A_SEMANTIC_SIGNAL_CONTRACT_ID,
          signalId: signal.signalId,
          componentType: localRole.type,
          sourceBlockIds: localRole.sourceBlockIds,
        });
      }
    }
  }
  return { requirements: materialized, diagnostics };
}

function responseIndex(responses, plannedIds) {
  const byId = new Map();
  const diagnostics = [];
  for (const [responseIndexValue, response] of (responses || []).entries()) {
    const unitId = text(response?.unitId);
    if (!plannedIds.has(unitId)) {
      diagnostics.push({
        code: "UNKNOWN_UNIT_ID",
        unitId: unitId || null,
        responseIndex: responseIndexValue,
      });
      continue;
    }
    const existing = byId.get(unitId) || [];
    existing.push(response);
    byId.set(unitId, existing);
  }
  return { byId, diagnostics };
}

function evidenceBlocks(unit) {
  const blocks = [
    ...(unit.governingContext?.blocks || []),
    ...unit.source.blocks,
  ];
  return blocks.filter(
    ({ blockId }, index) =>
      blocks.findIndex((candidate) => candidate.blockId === blockId) === index
  );
}

function sourceContains(
  unit,
  sourceBlockIds,
  value,
  blocks = evidenceBlocks(unit)
) {
  if (!value) return true;
  const sourceText = blocks
    .filter(({ blockId }) => sourceBlockIds.includes(blockId))
    .map(({ exactText }) => exactText)
    .join("\n");
  return comparableText(sourceText).includes(comparableText(value));
}

function minimalSourceRange(
  unit,
  value,
  declaredBlockIds,
  availableBlocks = evidenceBlocks(unit)
) {
  const needle = comparableText(value);
  if (!needle) return [];
  const matches = [];
  for (let start = 0; start < availableBlocks.length; start += 1) {
    for (let end = start; end < availableBlocks.length; end += 1) {
      const blocks = availableBlocks.slice(start, end + 1);
      if (
        comparableText(
          blocks.map(({ exactText }) => exactText).join("\n")
        ).includes(needle)
      ) {
        matches.push(blocks.map(({ blockId }) => blockId));
        break;
      }
    }
  }
  if (!matches.length) return null;
  const shortestLength = Math.min(...matches.map((ids) => ids.length));
  const shortest = matches.filter((ids) => ids.length === shortestLength);
  if (shortest.length === 1) return shortest[0];
  const hinted = shortest.filter((ids) =>
    declaredBlockIds.some((blockId) => ids.includes(blockId))
  );
  return hinted.length === 1 ? hinted[0] : null;
}

function canonicalComponentSourceBlockIds(unit, declaredBlockIds, values) {
  const derivedRanges = values.map((value) =>
    minimalSourceRange(unit, value, declaredBlockIds)
  );
  if (derivedRanges.some((ids) => !ids)) return null;
  const selected = new Set(declaredBlockIds);
  if (
    derivedRanges.some((ids) => ids.some((blockId) => !selected.has(blockId)))
  )
    return null;
  return evidenceBlocks(unit)
    .map(({ blockId }) => blockId)
    .filter((blockId) => selected.has(blockId));
}

function missingComponentSourceBlockIds(unit, declaredBlockIds, values) {
  const ranges = values.map((value) =>
    minimalSourceRange(unit, value, declaredBlockIds)
  );
  if (ranges.some((ids) => !ids)) return null;
  const declared = new Set(declaredBlockIds);
  return [
    ...new Set(
      ranges.flatMap((ids) => ids.filter((blockId) => !declared.has(blockId)))
    ),
  ];
}

function validateComponent(component, unit) {
  const type = text(component?.type);
  let label = text(component?.label);
  const sourceBlockIds = uniqueStrings(component?.sourceBlockIds);
  const allowedBlockIds = new Set(
    evidenceBlocks(unit).map(({ blockId }) => blockId)
  );
  if (!COMPONENT_TYPES.has(type))
    return { value: null, code: "COMPONENT_TYPE_INVALID" };
  if (!label) return { value: null, code: "COMPONENT_LABEL_MISSING" };
  if (!sourceBlockIds?.length)
    return { value: null, code: "COMPONENT_SOURCE_BLOCK_IDS_INVALID" };
  const rawValue = text(component?.rawValue);
  const unitValue = text(component?.unit);
  const qualifier = text(component?.qualifier);
  let componentValues = [label, rawValue, unitValue, qualifier].filter(Boolean);
  const outOfScopeBlockIds = sourceBlockIds.filter(
    (blockId) => !allowedBlockIds.has(blockId)
  );
  if (outOfScopeBlockIds.length) {
    const inScopeBlockIds = sourceBlockIds.filter((blockId) =>
      allowedBlockIds.has(blockId)
    );
    const missingSourceBlockIds = missingComponentSourceBlockIds(
      unit,
      inScopeBlockIds,
      componentValues
    );
    const requiredSourceBlockIds =
      missingSourceBlockIds === null
        ? null
        : (() => {
            const requiredBlockIds = new Set([
              ...inScopeBlockIds,
              ...missingSourceBlockIds,
            ]);
            return evidenceBlocks(unit)
              .map(({ blockId }) => blockId)
              .filter((blockId) => requiredBlockIds.has(blockId));
          })();
    return {
      value: null,
      code: "COMPONENT_SOURCE_BLOCK_ID_OUT_OF_SCOPE",
      declaredSourceBlockIds: sourceBlockIds,
      outOfScopeBlockIds,
      allowedSourceBlockIds: [...allowedBlockIds],
      ...(requiredSourceBlockIds?.length ? { requiredSourceBlockIds } : {}),
    };
  }
  label = canonicalExactSourceText(label, sourceBlockIds, evidenceBlocks(unit));
  componentValues = [label, rawValue, unitValue, qualifier].filter(Boolean);
  const missingSourceBlockIds = missingComponentSourceBlockIds(
    unit,
    sourceBlockIds,
    componentValues
  );
  if (missingSourceBlockIds === null)
    return {
      value: null,
      code: "COMPONENT_SOURCE_TEXT_INVALID",
      componentType: type,
      invalidLiteralValues: componentValues,
      declaredSourceBlockIds: sourceBlockIds,
      declaredSourceExactText: evidenceBlocks(unit)
        .filter(({ blockId }) => sourceBlockIds.includes(blockId))
        .map(({ exactText }) => exactText)
        .join("\n"),
      allowedEvidence: evidenceBlocks(unit).map(({ blockId, exactText }) => ({
        blockId,
        exactText,
      })),
    };
  if (missingSourceBlockIds.length) {
    const required = new Set([...sourceBlockIds, ...missingSourceBlockIds]);
    return {
      value: null,
      code: "COMPONENT_SOURCE_TEXT_INVALID",
      componentType: type,
      invalidLiteralValues: componentValues,
      blockIds: missingSourceBlockIds,
      declaredSourceBlockIds: sourceBlockIds,
      requiredSourceBlockIds: evidenceBlocks(unit)
        .map(({ blockId }) => blockId)
        .filter((blockId) => required.has(blockId)),
    };
  }
  const canonicalSourceBlockIds = canonicalComponentSourceBlockIds(
    unit,
    sourceBlockIds,
    componentValues
  );
  if (type === "VALUE_AND_UNIT" && !rawValue)
    return { value: null, code: "VALUE_AND_UNIT_RAW_VALUE_MISSING" };
  if (
    !canonicalSourceBlockIds ||
    !sourceContains(unit, canonicalSourceBlockIds, label) ||
    !sourceContains(unit, canonicalSourceBlockIds, rawValue) ||
    !sourceContains(unit, canonicalSourceBlockIds, unitValue) ||
    !sourceContains(unit, canonicalSourceBlockIds, qualifier)
  )
    return { value: null, code: "COMPONENT_SOURCE_TEXT_INVALID" };
  const effect = text(component?.coverageEffect);
  if (effect && type !== "COVERAGE_EFFECT")
    return { value: null, code: "COVERAGE_EFFECT_TYPE_INVALID" };
  if (effect && !COVERAGE_EFFECTS.has(effect))
    return { value: null, code: "COVERAGE_EFFECT_VALUE_INVALID" };
  if (type === "COVERAGE_EFFECT" && !effect)
    return { value: null, code: "COVERAGE_EFFECT_VALUE_MISSING" };
  if (type === "COVERAGE_EFFECT" && !COVERAGE_EFFECT_TEXT_PATTERN.test(label))
    return {
      value: null,
      code: "COVERAGE_EFFECT_LABEL_INVALID",
      invalidLiteralValue: label,
      allowedCoverageEffectEvidence: evidenceBlocks(unit)
        .filter(({ exactText }) => COVERAGE_EFFECT_TEXT_PATTERN.test(exactText))
        .map(({ blockId, exactText }) => ({ blockId, exactText })),
    };
  return {
    value: {
      type,
      label,
      sourceBlockIds: canonicalSourceBlockIds,
      ...(rawValue ? { rawValue } : {}),
      ...(unitValue ? { unit: unitValue } : {}),
      ...(effect ? { coverageEffect: effect } : {}),
      ...(qualifier ? { qualifier } : {}),
    },
    code: null,
  };
}

function validateRequirement(draft, unit, requirementIndex) {
  let displayLabel = canonicalExactSourceText(
    text(draft?.displayLabel),
    unit.source.blockIds,
    unit.source.blocks
  );
  const componentResults = Array.isArray(draft?.components)
    ? draft.components.map((component) => validateComponent(component, unit))
    : [];
  const diagnostics = componentResults.flatMap((result, componentIndex) => {
    if (!result.code) return [];
    const { value: _value, ...diagnostic } = result;
    return [{ ...diagnostic, requirementIndex, componentIndex }];
  });
  const components = componentResults.map(({ value }) => value);
  const displayLabelInOwnedSource =
    displayLabel &&
    sourceContains(
      unit,
      unit.source.blockIds,
      displayLabel,
      unit.source.blocks
    );
  if (
    !displayLabelInOwnedSource ||
    components.length === 0 ||
    components.some((item) => !item)
  )
    return {
      value: null,
      diagnostics: [
        ...(!displayLabel
          ? [{ code: "REQUIREMENT_DISPLAY_LABEL_MISSING", requirementIndex }]
          : !displayLabelInOwnedSource
            ? [
                {
                  code: "REQUIREMENT_DISPLAY_LABEL_OUTSIDE_OWNED_SOURCE",
                  requirementIndex,
                  invalidLiteralValue: displayLabel,
                  allowedEvidence: unit.source.blocks.map(
                    ({ blockId, exactText }) => ({ blockId, exactText })
                  ),
                },
              ]
            : []),
        ...(components.length === 0
          ? [{ code: "REQUIREMENT_COMPONENTS_MISSING", requirementIndex }]
          : []),
        ...diagnostics,
      ],
    };
  const componentKeys = components.map((component) =>
    stableStringify(component)
  );
  if (new Set(componentKeys).size !== components.length)
    return {
      value: null,
      diagnostics: [
        { code: "REQUIREMENT_COMPONENTS_DUPLICATE", requirementIndex },
      ],
    };
  const availableBlocks = evidenceBlocks(unit);
  const selectedBlockIds = new Set(
    components.flatMap((component) => component.sourceBlockIds)
  );
  const sourceBlockIds = availableBlocks
    .map(({ blockId }) => blockId)
    .filter((blockId) => selectedBlockIds.has(blockId));
  const sourceBlocks = sourceBlockIds.map((blockId) =>
    availableBlocks.find(({ blockId: id }) => id === blockId)
  );
  const articleTrimmedDisplayLabel = displayLabel.replace(
    /^(?:der|die|das|ein|eine|desgleichen)\s+/iu,
    ""
  );
  if (
    articleTrimmedDisplayLabel !== displayLabel &&
    !sourceContains(unit, sourceBlockIds, displayLabel) &&
    sourceContains(unit, sourceBlockIds, articleTrimmedDisplayLabel)
  )
    displayLabel = articleTrimmedDisplayLabel;
  const uncitedOwnedBlockIds = unit.source.blockIds.filter(
    (blockId) => !selectedBlockIds.has(blockId)
  );
  if (
    sourceBlocks.some((block) => !block) ||
    !sourceContains(unit, sourceBlockIds, displayLabel)
  ) {
    const requiredSourceBlockIds = minimalSourceRange(
      unit,
      displayLabel,
      sourceBlockIds
    );
    return {
      value: null,
      diagnostics: [
        {
          code: "REQUIREMENT_SOURCE_TEXT_INVALID",
          requirementIndex,
          invalidLiteralValue: displayLabel,
          selectedSourceBlockIds: sourceBlockIds,
          selectedSourceExactText: sourceBlocks
            .filter(Boolean)
            .map(({ exactText }) => exactText)
            .join("\n"),
          ...(requiredSourceBlockIds?.length ? { requiredSourceBlockIds } : {}),
        },
        ...(uncitedOwnedBlockIds.length
          ? [
              {
                code: "REQUIREMENT_OWNED_BLOCKS_UNCITED",
                requirementIndex,
                blockIds: uncitedOwnedBlockIds,
              },
            ]
          : []),
      ],
    };
  }
  return {
    value: {
      displayLabel,
      sourceTextOrder: comparableText(unit.source.combinedText).indexOf(
        comparableText(displayLabel)
      ),
      structurePath: [...unit.structurePath],
      sourceUnitIds: [
        ...new Set([...(unit.governingContext?.unitIds || []), unit.unitId]),
      ],
      sourceBlockIds,
      sourceSpans: sourceBlocks.map(
        ({
          blockId,
          physicalPageNumber,
          documentStart,
          documentEnd,
          exactText,
          exactTextSha256,
        }) => ({
          spanId: `AS-${sha256(
            `${unit.source.documentSha256}:${blockId}`
          ).slice(0, 24)}`,
          documentUuid: unit.source.documentUuid,
          documentSha256: unit.source.documentSha256,
          blockId,
          physicalPageNumber,
          documentStart,
          documentEnd,
          exactText,
          exactTextSha256,
        })
      ),
      atomizationStatus: "SOURCE_BOUND_TYPED",
      decisionEligibility: "ELIGIBLE",
      components,
      documentAuthority: {
        role: unit.source.documentRole,
        status: unit.source.documentStatus,
        precedence: "UNRESOLVED",
        replacement: "UNRESOLVED",
      },
    },
    diagnostics: [],
  };
}

function finalizeRequirements(unit, drafts) {
  const ordered = [...drafts].sort(
    (left, right) =>
      left.sourceTextOrder - right.sourceTextOrder ||
      stableStringify(left).localeCompare(stableStringify(right))
  );
  if (
    new Set(ordered.map((item) => stableStringify(item))).size !==
    ordered.length
  )
    return null;
  return ordered.map((draft, atomOrder) => {
    const requirementIdentity = {
      unitId: unit.unitId,
      displayLabel: draft.displayLabel,
      sourceBlockIds: draft.sourceBlockIds,
      components: draft.components,
    };
    const requirementId = `AR-${sha256(
      stableStringify(requirementIdentity)
    ).slice(0, 24)}`;
    const components = [...draft.components]
      .sort((left, right) =>
        stableStringify(left).localeCompare(stableStringify(right))
      )
      .map((component) => ({
        ...component,
        componentId: `AC-${sha256(
          `${requirementId}:${stableStringify(component)}`
        ).slice(0, 24)}`,
      }));
    const { sourceTextOrder: _sourceTextOrder, ...requirement } = draft;
    return {
      ...requirement,
      requirementId,
      sourceOrder: [...unit.packageOrder, atomOrder],
      components,
    };
  });
}

function requiredComponentGroups(semanticClasses) {
  const required = [];
  const mappings = {
    OPERATIVE_COVERAGE_STATEMENT: ["COVERAGE_EFFECT"],
    EXCLUSION: ["COVERAGE_EFFECT"],
    INSURED_OBJECT: ["OBJECT"],
    PERIL_OR_DAMAGE: ["PERIL_OR_CAUSE", "DAMAGE_OR_EFFECT"],
    DEFINITION: ["FACT_ROLE"],
    CONDITION: ["CONDITION"],
    COST: ["FACT_ROLE", "VALUE_AND_UNIT"],
    LIMIT: ["VALUE_AND_UNIT", "LIMIT_BASIS"],
    DEDUCTIBLE: ["DEDUCTIBLE"],
    OBLIGATION: ["CONDITION"],
    DURATION: ["TEMPORAL_VALIDITY"],
    VARIANT: ["SCOPE"],
    DOCUMENT_PRECEDENCE_OR_REPLACEMENT: ["PRECEDENCE_OR_REPLACEMENT"],
  };
  for (const semanticClass of semanticClasses) {
    const componentTypes = mappings[semanticClass];
    if (componentTypes) required.push(componentTypes);
  }
  return required;
}

function hasCoverageEffectEvidence(unit) {
  return evidenceBlocks(unit).some(({ exactText }) =>
    COVERAGE_EFFECT_TEXT_PATTERN.test(exactText)
  );
}

function logicalSegmentDiagnostics(unit, requirements) {
  const segments = unit.logicalSourceSegments || [];
  const ownedBlocksById = new Map(
    unit.source.blocks.map((block) => [block.blockId, block])
  );
  const segmentStartsWithStructuralKind = (segment, structuralKind) =>
    ownedBlocksById.get(segment.blockIds[0])?.structuralKind === structuralKind;
  // SOURCE_BLOCK_LEDGER_V1 calls every leading `•` line LIST_GOVERNOR.
  // It is only a shared governor inside one list unit when the following
  // logical segments are the typographically subordinate `-` list items.
  // Same-level `•` segments remain independent operative list items.
  const hasSubordinateItemSegments =
    segments.length > 1 &&
    segments
      .slice(1)
      .every((segment) =>
        segmentStartsWithStructuralKind(segment, "LIST_ITEM")
      );
  const sharedGovernorSegments = segments.filter(
    (segment, index) =>
      index === 0 &&
      hasSubordinateItemSegments &&
      segment.blockIds.every(
        (blockId) =>
          ownedBlocksById.get(blockId)?.structuralKind === "LIST_GOVERNOR"
      )
  );
  const sharedGovernorBlockIds = new Set(
    sharedGovernorSegments.flatMap(({ blockIds }) => blockIds)
  );
  const itemSegments = segments.filter(
    (segment) => !sharedGovernorSegments.includes(segment)
  );
  const segmentDiagnostics = itemSegments.flatMap((segment) => {
    const overlapping = requirements.filter(({ sourceBlockIds }) =>
      segment.blockIds.some((blockId) => sourceBlockIds.includes(blockId))
    );
    if (
      overlapping.length === 1 &&
      segment.blockIds.every((blockId) =>
        overlapping[0].sourceBlockIds.includes(blockId)
      )
    )
      return [];
    return [
      {
        code: "LIST_CONTINUATION_SEGMENT_SPLIT",
        unitId: unit.unitId,
        segmentId: segment.segmentId,
        blockIds: segment.blockIds,
        overlappingRequirementIds: overlapping.map(
          ({ requirementId }) => requirementId
        ),
      },
    ];
  });
  const mergeDiagnostics = requirements.flatMap((requirement) => {
    const overlappingSegments = itemSegments.filter(({ blockIds }) =>
      blockIds.some((blockId) => requirement.sourceBlockIds.includes(blockId))
    );
    if (overlappingSegments.length <= 1) return [];
    return [
      {
        code: "LIST_SOURCE_SEGMENTS_MERGED",
        unitId: unit.unitId,
        requirementId: requirement.requirementId,
        segmentIds: overlappingSegments.map(({ segmentId }) => segmentId),
      },
    ];
  });
  const standaloneGovernorDiagnostics = requirements.flatMap((requirement) => {
    if (
      sharedGovernorBlockIds.size === 0 ||
      !requirement.sourceBlockIds.some((blockId) =>
        sharedGovernorBlockIds.has(blockId)
      ) ||
      itemSegments.some(({ blockIds }) =>
        blockIds.some((blockId) => requirement.sourceBlockIds.includes(blockId))
      )
    )
      return [];
    return [
      {
        code: "LIST_GOVERNOR_REQUIREMENT_STANDALONE",
        unitId: unit.unitId,
        requirementId: requirement.requirementId,
        blockIds: requirement.sourceBlockIds,
      },
    ];
  });
  return [
    ...segmentDiagnostics,
    ...mergeDiagnostics,
    ...standaloneGovernorDiagnostics,
  ];
}

function classifyUnit(unit, records, semanticSignalContractId) {
  if (unit.initialDisposition === "NON_OPERATIVE_TERMINAL")
    return {
      terminalDisposition: "NON_OPERATIVE_TERMINAL",
      primaryClass: "METADATA",
      semanticClasses: ["METADATA"],
      requirements: [],
      diagnostics: records?.length
        ? [{ code: "UNEXPECTED_TERMINAL_RESPONSE", unitId: unit.unitId }]
        : [],
    };
  if (!records?.length)
    return {
      terminalDisposition: "UNRESOLVED_REVIEW_REQUIRED",
      primaryClass: "UNRESOLVED",
      semanticClasses: ["UNRESOLVED"],
      requirements: [],
      diagnostics: [{ code: "MISSING_UNIT_RESPONSE", unitId: unit.unitId }],
    };
  if (records.length !== 1)
    return {
      terminalDisposition: "UNRESOLVED_REVIEW_REQUIRED",
      primaryClass: "UNRESOLVED",
      semanticClasses: ["UNRESOLVED"],
      requirements: [],
      diagnostics: [{ code: "DUPLICATE_UNIT_RESPONSE", unitId: unit.unitId }],
    };

  const response = records[0];
  const primaryClass = text(response.primaryClass);
  const semanticClasses = uniqueStrings(response.semanticClasses);
  if (
    !TERMINAL_CLASSES.includes(primaryClass) ||
    !semanticClasses?.length ||
    semanticClasses.some((value) => !TERMINAL_CLASSES.includes(value)) ||
    !semanticClasses.includes(primaryClass)
  )
    return {
      terminalDisposition: "UNRESOLVED_REVIEW_REQUIRED",
      primaryClass: "UNRESOLVED",
      semanticClasses: ["UNRESOLVED"],
      requirements: [],
      diagnostics: [
        {
          code: "INVALID_UNIT_CLASSIFICATION",
          unitId: unit.unitId,
          primaryClass: primaryClass || null,
          semanticClasses: semanticClasses || [],
          reasons: [
            ...(!TERMINAL_CLASSES.includes(primaryClass)
              ? ["PRIMARY_CLASS_INVALID"]
              : []),
            ...(!semanticClasses?.length
              ? ["SEMANTIC_CLASSES_INVALID_OR_EMPTY"]
              : []),
            ...(semanticClasses?.some(
              (value) => !TERMINAL_CLASSES.includes(value)
            )
              ? ["SEMANTIC_CLASS_INVALID"]
              : []),
            ...(semanticClasses?.length &&
            !semanticClasses.includes(primaryClass)
              ? ["PRIMARY_CLASS_MISSING_FROM_SEMANTIC_CLASSES"]
              : []),
          ],
        },
      ],
    };
  if (primaryClass === "UNRESOLVED" || semanticClasses.includes("UNRESOLVED"))
    return {
      terminalDisposition: "UNRESOLVED_REVIEW_REQUIRED",
      primaryClass,
      semanticClasses,
      requirements: [],
      diagnostics: [{ code: "MODEL_UNIT_UNRESOLVED", unitId: unit.unitId }],
    };
  if (NON_OPERATIVE_CLASSES.has(primaryClass)) {
    if (
      semanticClasses.some((value) => OPERATIVE_CLASSES.has(value)) ||
      (Array.isArray(response.requirements) && response.requirements.length)
    )
      return {
        terminalDisposition: "UNRESOLVED_REVIEW_REQUIRED",
        primaryClass: "UNRESOLVED",
        semanticClasses: ["UNRESOLVED"],
        requirements: [],
        diagnostics: [
          { code: "NON_OPERATIVE_UNIT_HAS_REQUIREMENTS", unitId: unit.unitId },
        ],
      };
    return {
      terminalDisposition:
        primaryClass === "DUPLICATE"
          ? "DUPLICATE_TERMINAL"
          : "NON_OPERATIVE_TERMINAL",
      primaryClass,
      semanticClasses,
      requirements: [],
      diagnostics: [],
    };
  }

  const draftResults = Array.isArray(response.requirements)
    ? response.requirements.map((draft, requirementIndex) =>
        validateRequirement(draft, unit, requirementIndex)
      )
    : [];
  const drafts = draftResults.map(({ value }) => value);
  if (drafts.length === 0 || drafts.some((item) => !item))
    return {
      terminalDisposition: "UNRESOLVED_REVIEW_REQUIRED",
      primaryClass: "UNRESOLVED",
      semanticClasses: ["UNRESOLVED"],
      requirements: [],
      diagnostics: [
        { code: "INVALID_UNIT_ATOMIZATION", unitId: unit.unitId },
        ...draftResults.flatMap(({ diagnostics }) =>
          diagnostics.map((diagnostic) => ({
            ...diagnostic,
            unitId: unit.unitId,
          }))
        ),
      ],
    };
  const sharedSignalMaterialization =
    semanticSignalContractId === A_SEMANTIC_SIGNAL_CONTRACT_ID
      ? materializeSharedSignalComponents(unit, drafts)
      : { requirements: drafts, diagnostics: [] };
  const roleEvidenceDiagnostics =
    semanticSignalContractId === A_SEMANTIC_SIGNAL_CONTRACT_ID
      ? requirementRoleEvidenceDiagnostics(
          unit,
          sharedSignalMaterialization.requirements
        )
      : [];
  if (roleEvidenceDiagnostics.length)
    return {
      terminalDisposition: "UNRESOLVED_REVIEW_REQUIRED",
      primaryClass: "UNRESOLVED",
      semanticClasses: ["UNRESOLVED"],
      requirements: [],
      diagnostics: roleEvidenceDiagnostics,
    };
  const requirements = finalizeRequirements(
    unit,
    sharedSignalMaterialization.requirements
  );
  const segmentDiagnostics = requirements
    ? logicalSegmentDiagnostics(unit, requirements)
    : [];
  if (segmentDiagnostics.length)
    return {
      terminalDisposition: "UNRESOLVED_REVIEW_REQUIRED",
      primaryClass: "UNRESOLVED",
      semanticClasses: ["UNRESOLVED"],
      requirements: [],
      diagnostics: segmentDiagnostics,
    };
  const observedTypes = new Set(
    requirements?.flatMap(({ components }) =>
      components.map(({ type }) => type)
    ) || []
  );
  const missingRequiredGroups = requiredComponentGroups(semanticClasses).filter(
    (types) => !types.some((type) => observedTypes.has(type))
  );
  const exclusionEffects = requirements?.flatMap(({ components }) =>
    components
      .filter(({ type }) => type === "COVERAGE_EFFECT")
      .map(({ coverageEffect }) => coverageEffect)
  );
  const unsupportedSemanticClasses =
    missingRequiredGroups.some((types) => types.includes("COVERAGE_EFFECT")) &&
    !hasCoverageEffectEvidence(unit)
      ? semanticClasses.filter((semanticClass) =>
          ["EXCLUSION", "OPERATIVE_COVERAGE_STATEMENT"].includes(semanticClass)
        )
      : [];
  if (
    !requirements ||
    missingRequiredGroups.length > 0 ||
    (semanticClasses.includes("EXCLUSION") &&
      !exclusionEffects.includes("EXCLUDED"))
  )
    return {
      terminalDisposition: "UNRESOLVED_REVIEW_REQUIRED",
      primaryClass: "UNRESOLVED",
      semanticClasses: ["UNRESOLVED"],
      requirements: [],
      diagnostics: [
        {
          code: "UNIT_SEMANTIC_COMPONENTS_INCOMPLETE",
          unitId: unit.unitId,
          missingRequiredComponentGroups: missingRequiredGroups,
          observedComponentTypes: [...observedTypes].sort(),
          ...(unsupportedSemanticClasses.length
            ? { unsupportedSemanticClasses }
            : {}),
        },
      ],
    };
  const coveredBlockIds = new Set(
    requirements.flatMap(({ sourceBlockIds }) => sourceBlockIds)
  );
  const uncitedSemanticBlockIds = unit.source.blocks
    .filter((block) => !isLayoutOnlyBlock(block))
    .map(({ blockId }) => blockId)
    .filter((blockId) => !coveredBlockIds.has(blockId));
  if (uncitedSemanticBlockIds.length)
    return {
      terminalDisposition: "UNRESOLVED_REVIEW_REQUIRED",
      primaryClass: "UNRESOLVED",
      semanticClasses: ["UNRESOLVED"],
      requirements: [],
      diagnostics: [
        {
          code: "OPERATIVE_UNIT_BLOCK_COVERAGE_INCOMPLETE",
          unitId: unit.unitId,
          blockIds: uncitedSemanticBlockIds,
          uncoveredBlocks: unit.source.blocks
            .filter(({ blockId }) => uncitedSemanticBlockIds.includes(blockId))
            .map(({ blockId, structuralKind, exactText }) => ({
              blockId,
              structuralKind,
              exactText,
            })),
        },
      ],
    };
  return {
    terminalDisposition: "OPERATIVE_MAPPED",
    primaryClass,
    semanticClasses,
    requirements,
    diagnostics: sharedSignalMaterialization.diagnostics,
  };
}

function buildADrivenSemanticManifest({
  plan,
  responses = [],
  semanticSignalContractId = null,
} = {}) {
  if (
    plan?.contractId !== A_SOURCE_UNIT_PLAN_CONTRACT_ID ||
    plan?.runContractId !== A_DRIVEN_RUN_CONTRACT_ID ||
    !Array.isArray(plan.units) ||
    !Array.isArray(plan.documents)
  )
    throw manifestError("LF_A_SOURCE_UNIT_PLAN_INVALID");
  const plannedIds = new Set(plan.units.map(({ unitId }) => unitId));
  if (plannedIds.size !== plan.units.length)
    throw manifestError("LF_A_SOURCE_UNIT_IDS_DUPLICATE");
  const indexed = responseIndex(responses, plannedIds);
  if (
    semanticSignalContractId !== null &&
    semanticSignalContractId !== A_SEMANTIC_SIGNAL_CONTRACT_ID
  )
    throw manifestError("LF_A_SEMANTIC_SIGNAL_CONTRACT_INVALID");
  const classifications = plan.units.map((unit) => ({
    unit,
    classification: classifyUnit(
      unit,
      indexed.byId.get(unit.unitId),
      semanticSignalContractId
    ),
  }));
  const requirements = classifications.flatMap(
    ({ classification }) => classification.requirements
  );
  const unitTerminals = classifications.map(({ unit, classification }) => ({
    unitId: unit.unitId,
    packageOrder: unit.packageOrder,
    terminalDisposition: classification.terminalDisposition,
    primaryClass: classification.primaryClass,
    semanticClasses: classification.semanticClasses,
    requirementIds: classification.requirements.map(
      ({ requirementId }) => requirementId
    ),
    diagnostics: classification.diagnostics,
  }));
  const blockTerminals = classifications.flatMap(({ unit, classification }) =>
    unit.source.blocks.map((block) => {
      const layoutOnly = isLayoutOnlyBlock(block);
      return {
        blockId: block.blockId,
        documentUuid: unit.source.documentUuid,
        unitId: unit.unitId,
        terminalDisposition: layoutOnly
          ? "NON_OPERATIVE_TERMINAL"
          : classification.terminalDisposition,
        primaryClass: layoutOnly ? "STRUCTURE" : classification.primaryClass,
        requirementIds: layoutOnly
          ? []
          : classification.requirements
              .filter(({ sourceBlockIds }) =>
                sourceBlockIds.includes(block.blockId)
              )
              .map(({ requirementId }) => requirementId),
        reviewRequired:
          !layoutOnly &&
          classification.terminalDisposition === "UNRESOLVED_REVIEW_REQUIRED",
      };
    })
  );
  if (
    blockTerminals.length !== plan.summary.sourceBlocks ||
    new Set(
      blockTerminals.map(
        ({ documentUuid, blockId }) => `${documentUuid}:${blockId}`
      )
    ).size !== blockTerminals.length
  )
    throw manifestError("LF_A_BLOCK_TERMINAL_COVERAGE_INVALID");

  const diagnostics = [
    ...indexed.diagnostics,
    ...unitTerminals.flatMap(({ diagnostics: entries }) => entries),
  ];
  const responseIntegrityStatus = diagnostics.some(({ code }) =>
    ["UNKNOWN_UNIT_ID", "UNEXPECTED_TERMINAL_RESPONSE"].includes(code)
  )
    ? "UNRESOLVED"
    : "VALID";
  if (responseIntegrityStatus === "UNRESOLVED")
    for (const requirement of requirements)
      requirement.decisionEligibility = "INELIGIBLE_RESPONSE_ENVELOPE";
  const payload = {
    schemaVersion: 2,
    contractId: A_DYNAMIC_MANIFEST_CONTRACT_ID,
    runContractId: A_DRIVEN_RUN_CONTRACT_ID,
    sourceUnitPlanSha256: plan.planSha256,
    blockTerminalContractId: A_BLOCK_TERMINAL_CONTRACT_ID,
    ...(semanticSignalContractId ? { semanticSignalContractId } : {}),
    documents: plan.documents,
    requirements,
    unitTerminals,
    blockTerminals,
    diagnostics,
    summary: {
      documents: plan.documents.length,
      sourceBlocks: blockTerminals.length,
      plannedUnits: unitTerminals.length,
      terminalUnits: unitTerminals.length,
      operativeMappedUnits: unitTerminals.filter(
        ({ terminalDisposition }) => terminalDisposition === "OPERATIVE_MAPPED"
      ).length,
      unresolvedUnits: unitTerminals.filter(
        ({ terminalDisposition }) =>
          terminalDisposition === "UNRESOLVED_REVIEW_REQUIRED"
      ).length,
      semanticRequirements: requirements.length,
      semanticComponents: requirements.reduce(
        (sum, requirement) => sum + requirement.components.length,
        0
      ),
      reviewRequiredBlocks: blockTerminals.filter(
        ({ reviewRequired }) => reviewRequired
      ).length,
      allBlocksTerminal:
        blockTerminals.length === plan.summary.sourceBlocks &&
        blockTerminals.every(
          ({ terminalDisposition, requirementIds }) =>
            terminalDisposition !== "OPERATIVE_MAPPED" ||
            requirementIds.length > 0
        ),
      responseIntegrityStatus,
      acceptanceReady:
        responseIntegrityStatus === "VALID" &&
        unitTerminals.every(
          ({ terminalDisposition }) =>
            terminalDisposition !== "UNRESOLVED_REVIEW_REQUIRED"
        ),
    },
  };
  return {
    ...payload,
    manifestSha256: sha256(
      `${A_DYNAMIC_MANIFEST_CONTRACT_ID}\u0000${stableStringify(payload)}`
    ),
  };
}

function validateADrivenSemanticManifest(manifest) {
  if (
    manifest?.contractId !== A_DYNAMIC_MANIFEST_CONTRACT_ID ||
    !Array.isArray(manifest.requirements) ||
    !Array.isArray(manifest.unitTerminals) ||
    !Array.isArray(manifest.blockTerminals) ||
    !/^[a-f0-9]{64}$/u.test(String(manifest.manifestSha256 || ""))
  )
    throw manifestError("LF_A_DYNAMIC_MANIFEST_INVALID");
  const { manifestSha256, ...payload } = manifest;
  if (
    manifestSha256 !==
    sha256(`${A_DYNAMIC_MANIFEST_CONTRACT_ID}\u0000${stableStringify(payload)}`)
  )
    throw manifestError("LF_A_DYNAMIC_MANIFEST_DIGEST_INVALID");
  return manifest;
}

module.exports = {
  A_BLOCK_TERMINAL_CONTRACT_ID,
  A_DYNAMIC_MANIFEST_CONTRACT_ID,
  A_SEMANTIC_SIGNAL_CONTRACT_ID,
  COMPONENT_TYPES,
  TERMINAL_CLASSES,
  buildADrivenSemanticManifest,
  materializeSharedSignalComponents,
  requirementRoleEvidenceDiagnostics,
  validateADrivenSemanticManifest,
};

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

function uniqueStrings(values) {
  if (!Array.isArray(values) || values.some((value) => !text(value)))
    return null;
  const normalized = values.map(text);
  return new Set(normalized).size === normalized.length ? normalized : null;
}

function isLayoutOnlyBlock(block) {
  return /^[•▪◦‣]+$/u.test(String(block?.exactText || "").trim());
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

function minimalSourceRange(unit, value, declaredBlockIds) {
  const needle = comparableText(value);
  if (!needle) return [];
  const matches = [];
  const availableBlocks = evidenceBlocks(unit);
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
  const label = text(component?.label);
  const sourceBlockIds = uniqueStrings(component?.sourceBlockIds);
  const allowedBlockIds = new Set(
    evidenceBlocks(unit).map(({ blockId }) => blockId)
  );
  if (!COMPONENT_TYPES.has(type))
    return { value: null, code: "COMPONENT_TYPE_INVALID" };
  if (!label) return { value: null, code: "COMPONENT_LABEL_MISSING" };
  if (!sourceBlockIds?.length)
    return { value: null, code: "COMPONENT_SOURCE_BLOCK_IDS_INVALID" };
  const outOfScopeBlockIds = sourceBlockIds.filter(
    (blockId) => !allowedBlockIds.has(blockId)
  );
  if (outOfScopeBlockIds.length)
    return {
      value: null,
      code: "COMPONENT_SOURCE_BLOCK_ID_OUT_OF_SCOPE",
      declaredSourceBlockIds: sourceBlockIds,
      outOfScopeBlockIds,
      allowedSourceBlockIds: [...allowedBlockIds],
    };
  const rawValue = text(component?.rawValue);
  const unitValue = text(component?.unit);
  const qualifier = text(component?.qualifier);
  const componentValues = [label, rawValue, unitValue, qualifier].filter(
    Boolean
  );
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
  const displayLabel = text(draft?.displayLabel);
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
  const uncitedOwnedBlockIds = unit.source.blockIds.filter(
    (blockId) => !selectedBlockIds.has(blockId)
  );
  if (
    sourceBlocks.some((block) => !block) ||
    !sourceContains(unit, sourceBlockIds, displayLabel)
  )
    return {
      value: null,
      diagnostics: [
        { code: "REQUIREMENT_SOURCE_TEXT_INVALID", requirementIndex },
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
    /\b(?:ausgeschlossen|ein(?:geschlossen|bezogen)|(?:mit)?gedeckt|(?:mit)?versichert|nicht\s+(?:mit)?versichert|kein(?:e[snmr]?)?\s+(?:Deckung|Versicherungsschutz)|Versicherungsschutz\s+(?:besteht|gilt)|gilt\s+als\s+(?:mit)?versichert)\b/iu.test(
      exactText
    )
  );
}

function logicalSegmentDiagnostics(unit, requirements) {
  const segments = unit.logicalSourceSegments || [];
  const segmentDiagnostics = segments.flatMap((segment) => {
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
    const overlappingSegments = segments.filter(({ blockIds }) =>
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
  return [...segmentDiagnostics, ...mergeDiagnostics];
}

function classifyUnit(unit, records) {
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
  const requirements = finalizeRequirements(unit, drafts);
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
          ["EXCLUSION", "OPERATIVE_COVERAGE_STATEMENT"].includes(
            semanticClass
          )
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
        },
      ],
    };
  return {
    terminalDisposition: "OPERATIVE_MAPPED",
    primaryClass,
    semanticClasses,
    requirements,
    diagnostics: [],
  };
}

function buildADrivenSemanticManifest({ plan, responses = [] } = {}) {
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
  const classifications = plan.units.map((unit) => ({
    unit,
    classification: classifyUnit(unit, indexed.byId.get(unit.unitId)),
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
    unit.source.blockIds.map((blockId) => ({
      blockId,
      documentUuid: unit.source.documentUuid,
      unitId: unit.unitId,
      terminalDisposition: classification.terminalDisposition,
      primaryClass: classification.primaryClass,
      requirementIds: classification.requirements
        .filter(({ sourceBlockIds }) => sourceBlockIds.includes(blockId))
        .map(({ requirementId }) => requirementId),
      reviewRequired:
        classification.terminalDisposition === "UNRESOLVED_REVIEW_REQUIRED",
    }))
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
  COMPONENT_TYPES,
  TERMINAL_CLASSES,
  buildADrivenSemanticManifest,
  validateADrivenSemanticManifest,
};

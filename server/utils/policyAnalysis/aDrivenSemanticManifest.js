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
  "LF_A_DYNAMIC_SEMANTIC_REQUIREMENT_MANIFEST_V4";

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
    .replace(/\s+/gu, " ")
    .trim();
}

function uniqueStrings(values) {
  if (!Array.isArray(values) || values.some((value) => !text(value)))
    return null;
  const normalized = values.map(text);
  return new Set(normalized).size === normalized.length ? normalized : null;
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

function sourceContains(unit, sourceBlockIds, value) {
  if (!value) return true;
  const sourceText = unit.source.blocks
    .filter(({ blockId }) => sourceBlockIds.includes(blockId))
    .map(({ exactText }) => exactText)
    .join("\n");
  return comparableText(sourceText).includes(comparableText(value));
}

function minimalSourceRange(unit, value, declaredBlockIds) {
  const needle = comparableText(value);
  if (!needle) return [];
  const matches = [];
  for (let start = 0; start < unit.source.blocks.length; start += 1) {
    for (let end = start; end < unit.source.blocks.length; end += 1) {
      const blocks = unit.source.blocks.slice(start, end + 1);
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
  const selected = new Set([
    ...declaredBlockIds,
    ...derivedRanges.flatMap((ids) => ids),
  ]);
  return unit.source.blockIds.filter((blockId) => selected.has(blockId));
}

function validateComponent(component, unit) {
  const type = text(component?.type);
  const label = text(component?.label);
  const sourceBlockIds = uniqueStrings(component?.sourceBlockIds);
  const allowedBlockIds = new Set(unit.source.blockIds);
  if (
    !COMPONENT_TYPES.has(type) ||
    !label ||
    !sourceBlockIds?.length ||
    sourceBlockIds.some((blockId) => !allowedBlockIds.has(blockId))
  )
    return null;
  const rawValue = text(component?.rawValue);
  const unitValue = text(component?.unit);
  const qualifier = text(component?.qualifier);
  const canonicalSourceBlockIds = canonicalComponentSourceBlockIds(
    unit,
    sourceBlockIds,
    [label, rawValue, unitValue, qualifier].filter(Boolean)
  );
  if (
    !canonicalSourceBlockIds ||
    !sourceContains(unit, canonicalSourceBlockIds, label) ||
    !sourceContains(unit, canonicalSourceBlockIds, rawValue) ||
    !sourceContains(unit, canonicalSourceBlockIds, unitValue) ||
    !sourceContains(unit, canonicalSourceBlockIds, qualifier)
  )
    return null;
  const effect = text(component?.coverageEffect);
  if (
    (effect && !COVERAGE_EFFECTS.has(effect)) ||
    (effect && type !== "COVERAGE_EFFECT") ||
    (type === "COVERAGE_EFFECT" && !effect) ||
    (type === "VALUE_AND_UNIT" && !rawValue)
  )
    return null;
  return {
    type,
    label,
    sourceBlockIds: canonicalSourceBlockIds,
    ...(rawValue ? { rawValue } : {}),
    ...(unitValue ? { unit: unitValue } : {}),
    ...(effect ? { coverageEffect: effect } : {}),
    ...(qualifier ? { qualifier } : {}),
  };
}

function validateRequirement(draft, unit) {
  const displayLabel = text(draft?.displayLabel);
  const components = Array.isArray(draft?.components)
    ? draft.components.map((component) => validateComponent(component, unit))
    : [];
  if (
    !displayLabel ||
    !sourceContains(unit, unit.source.blockIds, displayLabel) ||
    components.length === 0 ||
    components.some((item) => !item)
  )
    return null;
  const componentKeys = components.map((component) =>
    stableStringify(component)
  );
  if (new Set(componentKeys).size !== components.length) return null;
  const sourceBlockIds = [
    ...new Set(components.flatMap((component) => component.sourceBlockIds)),
  ];
  const sourceBlocks = sourceBlockIds.map((blockId) =>
    unit.source.blocks.find(({ blockId: id }) => id === blockId)
  );
  if (
    sourceBlocks.some((block) => !block) ||
    !sourceContains(unit, sourceBlockIds, displayLabel)
  )
    return null;
  return {
    displayLabel,
    sourceTextOrder: comparableText(unit.source.combinedText).indexOf(
      comparableText(displayLabel)
    ),
    structurePath: [...unit.structurePath],
    sourceUnitIds: [unit.unitId],
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
        spanId: `AS-${sha256(`${unit.source.documentSha256}:${blockId}`).slice(
          0,
          24
        )}`,
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
        { code: "INVALID_UNIT_CLASSIFICATION", unitId: unit.unitId },
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

  const drafts = Array.isArray(response.requirements)
    ? response.requirements.map((draft) => validateRequirement(draft, unit))
    : [];
  if (drafts.length === 0 || drafts.some((item) => !item))
    return {
      terminalDisposition: "UNRESOLVED_REVIEW_REQUIRED",
      primaryClass: "UNRESOLVED",
      semanticClasses: ["UNRESOLVED"],
      requirements: [],
      diagnostics: [{ code: "INVALID_UNIT_ATOMIZATION", unitId: unit.unitId }],
    };
  const requirements = finalizeRequirements(unit, drafts);
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
        { code: "UNIT_SEMANTIC_COMPONENTS_INCOMPLETE", unitId: unit.unitId },
      ],
    };
  const coveredBlockIds = new Set(
    requirements.flatMap(({ sourceBlockIds }) => sourceBlockIds)
  );
  if (unit.source.blockIds.some((blockId) => !coveredBlockIds.has(blockId)))
    return {
      terminalDisposition: "UNRESOLVED_REVIEW_REQUIRED",
      primaryClass: "UNRESOLVED",
      semanticClasses: ["UNRESOLVED"],
      requirements: [],
      diagnostics: [
        {
          code: "OPERATIVE_UNIT_BLOCK_COVERAGE_INCOMPLETE",
          unitId: unit.unitId,
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

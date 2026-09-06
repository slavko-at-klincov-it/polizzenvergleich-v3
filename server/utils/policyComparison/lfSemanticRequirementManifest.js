const crypto = require("crypto");
const {
  buildSourceBlockLedger,
  validateSourceBlockLedger,
} = require("../policyAnalysis/sourceBlockLedger");
const { validateLfReferenceFamily } = require("./lfReferenceFamilyContract");

const LF_SEMANTIC_REQUIREMENT_MANIFEST_CONTRACT_ID =
  "LF_A_SEMANTIC_REQUIREMENT_MANIFEST_V1";
const LF_DYNAMIC_REFERENCE_PROFILE_ID =
  "LF_IMMO_REFERENCE_COMPLETE_V1_SOURCE_BOUND";
const ALLOWED_FACT_ROLES = new Set([
  "INSURED_OBJECT",
  "COST",
  "BENEFIT",
  "PERIL",
  "DEFINITION",
  "DAMAGE",
  "EXCLUSION",
  "LIMIT",
  "DEDUCTIBLE",
  "CONDITION",
  "DOCUMENT_STATUS",
]);
const FACT_ROLE_ALIASES = Object.freeze({
  AGGREGATION: "CONDITION",
  BASIS: "CONDITION",
  COVERAGE: "BENEFIT",
  CONFLICT: "DOCUMENT_STATUS",
  DURATION: "LIMIT",
  OBLIGATION: "CONDITION",
  PROCESS: "CONDITION",
  REVIEW: "DOCUMENT_STATUS",
  RIGHT: "BENEFIT",
  SCOPE: "CONDITION",
  TERMINATION: "CONDITION",
  VALUATION: "CONDITION",
});

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])])
    );
  return value;
}

function stableStringify(value) {
  return JSON.stringify(canonical(value));
}

function domainDigest(domain, value) {
  return sha256(`${domain}\u0000${stableStringify(value)}`);
}

function profileRequired(detail) {
  const error = new Error(`NEUES_LF_PROFIL_ERFORDERLICH:${detail}`);
  error.code = "NEUES_LF_PROFIL_ERFORDERLICH";
  return error;
}

function requiredString(value, detail) {
  if (typeof value !== "string" || value.trim().length === 0)
    throw profileRequired(detail);
  return value.trim();
}

function normalizeFactRole(value) {
  const role = FACT_ROLE_ALIASES[value] || value;
  if (!ALLOWED_FACT_ROLES.has(role))
    throw profileRequired(`UNSUPPORTED_FACT_ROLE:${value}`);
  return role;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function anchorExpression(anchor) {
  const pieces = String(anchor)
    .trim()
    .split(/\s+/gu)
    .map((piece) => {
      const numberPlaceholder = "LFNUMBERPLACEHOLDER";
      return escapeRegex(
        piece.replace(/\d[\d.,]*/gu, numberPlaceholder)
      )
        .replaceAll(numberPlaceholder, "[\\dIl][\\dIl.,]*")
        .replace(/-/gu, "-\\s*");
    });
  return new RegExp(pieces.join("\\s+"), "giu");
}

function pageRanges(documentArtifact, pages) {
  const pageMap = documentArtifact.document.pageMap;
  return pages.map((pageNumber) => {
    const page = pageMap.find(({ pageNumber: number }) => number === pageNumber);
    if (!page) throw profileRequired(`UNKNOWN_PHYSICAL_PAGE:${pageNumber}`);
    return page;
  });
}

function anchorMatches(documentArtifact, pages, anchor) {
  const text = documentArtifact.document.pageContent;
  const matches = [];
  for (const page of pageRanges(documentArtifact, pages)) {
    const pageText = text.slice(page.start, page.end);
    const expression = anchorExpression(anchor);
    let match;
    while ((match = expression.exec(pageText))) {
      matches.push({
        physicalPageNumber: page.pageNumber,
        documentStart: page.start + match.index,
        documentEnd: page.start + match.index + match[0].length,
      });
    }
  }
  return matches;
}

function chooseOrderedAnchorMatches(documentArtifact, requirement) {
  const candidates = requirement.anchors.map((anchor) => ({
    anchor,
    matches: anchorMatches(documentArtifact, requirement.pages, anchor),
  }));
  for (const { anchor, matches } of candidates) {
    if (matches.length === 0)
      throw profileRequired(
        `ANCHOR_NOT_FOUND:${requirement.id}:${String(anchor).slice(0, 80)}`
      );
  }
  candidates.sort((left, right) => left.matches.length - right.matches.length);
  const selected = [candidates[0].matches[0]];
  for (const { matches } of candidates.slice(1)) {
    const center =
      selected.reduce(
        (sum, match) => sum + (match.documentStart + match.documentEnd) / 2,
        0
      ) / selected.length;
    selected.push(
      matches.reduce((best, match) =>
        Math.abs((match.documentStart + match.documentEnd) / 2 - center) <
        Math.abs((best.documentStart + best.documentEnd) / 2 - center)
          ? match
          : best
      )
    );
  }
  return selected.sort((left, right) => left.documentStart - right.documentStart);
}

function diagnoseLfSemanticOracleAnchors(documentArtifact, oracle) {
  validateOracle(oracle);
  const diagnostics = [];
  for (const requirement of oracle.requirements) {
    try {
      chooseOrderedAnchorMatches(documentArtifact, requirement);
    } catch (error) {
      diagnostics.push({
        requirementId: requirement.id,
        code: error.code || "ANCHOR_VALIDATION_FAILED",
        message: error.message,
      });
    }
  }
  return diagnostics;
}

function lineBounds(text, start, end, page) {
  let lineStart = text.lastIndexOf("\n", start - 1);
  lineStart = Math.max(page.start, lineStart < 0 ? page.start : lineStart + 1);
  let lineEnd = text.indexOf("\n", end);
  lineEnd = Math.min(page.end, lineEnd < 0 ? page.end : lineEnd);
  return { documentStart: lineStart, documentEnd: lineEnd };
}

function sourceSpans(documentArtifact, ledger, requirement, matches) {
  const text = documentArtifact.document.pageContent;
  const byPage = new Map();
  for (const match of matches) {
    const current = byPage.get(match.physicalPageNumber) || {
      start: match.documentStart,
      end: match.documentEnd,
    };
    current.start = Math.min(current.start, match.documentStart);
    current.end = Math.max(current.end, match.documentEnd);
    byPage.set(match.physicalPageNumber, current);
  }
  return [...byPage.entries()].map(([physicalPageNumber, range]) => {
    const page = documentArtifact.document.pageMap.find(
      ({ pageNumber }) => pageNumber === physicalPageNumber
    );
    const bounds = lineBounds(text, range.start, range.end, page);
    const exactText = text.slice(bounds.documentStart, bounds.documentEnd);
    const blockIds = ledger.blocks
      .filter(
        (block) =>
          block.physicalPageNumber === physicalPageNumber &&
          block.documentEnd > bounds.documentStart &&
          block.documentStart < bounds.documentEnd
      )
      .map(({ blockId }) => blockId);
    const exactTextSha256 = sha256(exactText);
    return {
      spanId: domainDigest(
        `${LF_SEMANTIC_REQUIREMENT_MANIFEST_CONTRACT_ID}:SOURCE_SPAN`,
        {
          requirementId: requirement.id,
          physicalPageNumber,
          documentStart: bounds.documentStart,
          documentEnd: bounds.documentEnd,
          exactTextSha256,
        }
      ),
      physicalPageNumber,
      documentStart: bounds.documentStart,
      documentEnd: bounds.documentEnd,
      exactText,
      exactTextSha256,
      blockIds,
    };
  });
}

function extractedValues(requirement, spans) {
  const values = [];
  const patterns = [
    { type: "PERCENT", expression: /\b\d[\d.,]*\s*%/gu },
    {
      type: "AMOUNT",
      expression: /(?:\bEUR\s*|€\s*)\d[\d.,]*(?:\s*,-)?/giu,
    },
    {
      type: "DURATION",
      expression:
        /\b(?:\d+|ein(?:e|en|em|er|es)?|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|zwölf)\s+(?:Tag(?:e|en)?|Monat(?:e|en)?|Jahr(?:e|en)?)\b/giu,
    },
  ];
  for (const span of spans) {
    for (const { type, expression } of patterns) {
      let match;
      while ((match = expression.exec(span.exactText))) {
        const rawValue = match[0];
        const valueBindings = requirement.components
          .map(({ valueBinding }) => valueBinding)
          .filter((binding) => binding?.type === type);
        values.push({
          valueId: domainDigest(
            `${LF_SEMANTIC_REQUIREMENT_MANIFEST_CONTRACT_ID}:VALUE`,
            {
              requirementId: requirement.id,
              spanId: span.spanId,
              offset: match.index,
              type,
              rawValue,
            }
          ),
          type,
          rawValue,
          normalizedValue: rawValue.normalize("NFKC").replace(/\s+/gu, " "),
          physicalPageNumber: span.physicalPageNumber,
          documentStart: span.documentStart + match.index,
          documentEnd: span.documentStart + match.index + rawValue.length,
          sourceSpanId: span.spanId,
          basis: valueBindings[0]?.basisLabel
            ? {
                status: "SEMANTIC_ORACLE_DECLARED",
                label: valueBindings[0].basisLabel,
              }
            : { status: "UNRESOLVED", label: null },
          calculatedAmount: null,
        });
      }
    }
  }
  return values;
}

function validateOracle(oracle) {
  requiredString(oracle?.oracleId, "ORACLE_ID_MISSING");
  if (!Array.isArray(oracle.requirements) || oracle.requirements.length === 0)
    throw profileRequired("ORACLE_REQUIREMENTS_MISSING");
  const ids = new Set();
  for (const requirement of oracle.requirements) {
    const id = requiredString(requirement.id, "REQUIREMENT_ID_MISSING");
    if (ids.has(id)) throw profileRequired(`DUPLICATE_REQUIREMENT:${id}`);
    ids.add(id);
    for (const field of [
      "categoryId",
      "categoryLabel",
      "subcategoryId",
      "subcategoryLabel",
      "label",
    ])
      requiredString(requirement[field], `${id}:${field}`);
    if (!Array.isArray(requirement.pages) || requirement.pages.length === 0)
      throw profileRequired(`${id}:PAGES_MISSING`);
    if (!Array.isArray(requirement.anchors) || requirement.anchors.length === 0)
      throw profileRequired(`${id}:ANCHORS_MISSING`);
    if (!Array.isArray(requirement.components) || requirement.components.length === 0)
      throw profileRequired(`${id}:COMPONENTS_MISSING`);
  }
  return oracle;
}

function buildLfSemanticRequirementManifest({
  documentArtifact,
  oracle,
  ledger = buildSourceBlockLedger(documentArtifact),
  familyContract,
} = {}) {
  validateSourceBlockLedger(ledger, documentArtifact);
  const family = validateLfReferenceFamily({
    documentArtifact,
    ledger,
    ...(familyContract ? { contract: familyContract } : {}),
  });
  validateOracle(oracle);
  if (family.semanticOracleId !== oracle.oracleId)
    throw profileRequired("SEMANTIC_ORACLE_ID_MISMATCH");

  const requirements = oracle.requirements.map((definition, sourceOrder) => {
    const matches = chooseOrderedAnchorMatches(documentArtifact, definition);
    const spans = sourceSpans(documentArtifact, ledger, definition, matches);
    const components = definition.components.map((component) => ({
      id: requiredString(component.id, `${definition.id}:COMPONENT_ID_MISSING`),
      label: requiredString(
        component.label,
        `${definition.id}:${component.id}:COMPONENT_LABEL_MISSING`
      ),
      factRole: normalizeFactRole(component.factRole),
      aliases: Array.isArray(component.aliases)
        ? [...new Set(component.aliases.map((alias) => requiredString(alias)))]
        : [],
      ...(Array.isArray(component.requestedFields)
        ? { requestedFields: component.requestedFields }
        : {}),
      ...(component.valueBinding
        ? { valueBinding: { ...component.valueBinding } }
        : {}),
      sourceSpanIds: spans.map(({ spanId }) => spanId),
    }));
    const searchPlanStatus =
      definition.searchPlanStatus === "CERTIFIED_COMPLETE"
        ? "CERTIFIED_COMPLETE"
        : "EXPLORATORY_INCOMPLETE";
    const reviewRequired = definition.components.some(({ factRole }) =>
      ["CONFLICT", "REVIEW"].includes(factRole)
    );
    return {
      requirementId: definition.id,
      sourceOrder,
      categoryId: definition.categoryId,
      categoryLabel: definition.categoryLabel,
      subcategoryId: definition.subcategoryId,
      subcategoryLabel: definition.subcategoryLabel,
      displayLabel: definition.label,
      physicalPages: [...definition.pages],
      crossPage: definition.crossPage === true,
      atomizationStatus: reviewRequired
        ? "REVIEW_REQUIRED"
        : "SOURCE_BOUND_TYPED",
      decisionEligibility: reviewRequired ? "INELIGIBLE" : "ELIGIBLE",
      searchPlanStatus,
      components,
      sourceSpans: spans,
      values: extractedValues({ ...definition, components }, spans),
    };
  });

  const semanticBlockIds = new Map();
  for (const requirement of requirements)
    for (const span of requirement.sourceSpans)
      for (const blockId of span.blockIds) {
        const ids = semanticBlockIds.get(blockId) || [];
        ids.push(requirement.requirementId);
        semanticBlockIds.set(blockId, ids);
      }
  const structureLabels = new Set(
    oracle.requirements.flatMap((requirement) => [
      requirement.categoryLabel.trim().toLocaleLowerCase("de-AT"),
      requirement.subcategoryLabel.trim().toLocaleLowerCase("de-AT"),
    ])
  );
  const blockCrosswalk = ledger.blocks.map((block) => {
    const requirementIds = [...new Set(semanticBlockIds.get(block.blockId) || [])];
    if (requirementIds.length > 0)
      return {
        blockId: block.blockId,
        disposition: "SEMANTIC_REQUIREMENTS",
        requirementIds,
        ruleId: "SOURCE_SPAN_OVERLAP_V1",
      };
    if (block.structuralKind === "PAGE_FURNITURE")
      return {
        blockId: block.blockId,
        disposition: "LAYOUT_ONLY",
        requirementIds: [],
        ruleId: "EXACT_PHYSICAL_PAGE_LABEL_V1",
      };
    if (structureLabels.has(block.exactText.trim().toLocaleLowerCase("de-AT")))
      return {
        blockId: block.blockId,
        disposition: "STRUCTURE_ONLY",
        requirementIds: [],
        ruleId: "ORACLE_SECTION_LABEL_V1",
      };
    return {
      blockId: block.blockId,
      disposition: "REVIEW_REQUIRED",
      requirementIds: [],
      ruleId: "NO_PROVEN_SEMANTIC_CROSSWALK_V1",
    };
  });
  const categories = [];
  for (const requirement of requirements) {
    let category = categories.find(({ id }) => id === requirement.categoryId);
    if (!category) {
      category = { id: requirement.categoryId, label: requirement.categoryLabel, subcategories: [] };
      categories.push(category);
    }
    let subcategory = category.subcategories.find(
      ({ id }) => id === requirement.subcategoryId
    );
    if (!subcategory) {
      subcategory = {
        id: requirement.subcategoryId,
        label: requirement.subcategoryLabel,
        requirementIds: [],
      };
      category.subcategories.push(subcategory);
    }
    subcategory.requirementIds.push(requirement.requirementId);
  }
  const payload = {
    schemaVersion: 1,
    contractId: LF_SEMANTIC_REQUIREMENT_MANIFEST_CONTRACT_ID,
    productProfileId: LF_DYNAMIC_REFERENCE_PROFILE_ID,
    semanticOracleId: oracle.oracleId,
    source: {
      documentFingerprint: ledger.sourceDocument.fingerprint,
      sourceBlockLedgerSha256: ledger.ledgerSha256,
      sourceStructureDigestSha256: ledger.structureDigestSha256,
      familyContractId: family.contractId,
      familyStatus: family.status,
      sourceDeclaredVersion: family.sourceDeclaredVersion,
    },
    categories,
    requirements,
    blockCrosswalk,
    summary: {
      sourceBlocks: ledger.blocks.length,
      semanticRequirements: requirements.length,
      decisionEligibleRequirements: requirements.filter(
        ({ decisionEligibility }) => decisionEligibility === "ELIGIBLE"
      ).length,
      certifiedSearchRequirements: requirements.filter(
        ({ searchPlanStatus }) => searchPlanStatus === "CERTIFIED_COMPLETE"
      ).length,
      incompleteSearchRequirements: requirements.filter(
        ({ searchPlanStatus }) => searchPlanStatus !== "CERTIFIED_COMPLETE"
      ).length,
      reviewRequiredBlocks: blockCrosswalk.filter(
        ({ disposition }) => disposition === "REVIEW_REQUIRED"
      ).length,
    },
  };
  return {
    ...payload,
    manifestSha256: domainDigest(
      LF_SEMANTIC_REQUIREMENT_MANIFEST_CONTRACT_ID,
      payload
    ),
  };
}

function validateLfSemanticRequirementManifest(
  manifest,
  { documentArtifact, oracle, familyContract } = {}
) {
  const rebuilt = buildLfSemanticRequirementManifest({
    documentArtifact,
    oracle,
    familyContract,
  });
  if (stableStringify(manifest) !== stableStringify(rebuilt))
    throw new Error("LF_SEMANTIC_REQUIREMENT_MANIFEST_REBUILD_MISMATCH");
  return manifest;
}

module.exports = {
  LF_DYNAMIC_REFERENCE_PROFILE_ID,
  LF_SEMANTIC_REQUIREMENT_MANIFEST_CONTRACT_ID,
  buildLfSemanticRequirementManifest,
  diagnoseLfSemanticOracleAnchors,
  validateLfSemanticRequirementManifest,
};

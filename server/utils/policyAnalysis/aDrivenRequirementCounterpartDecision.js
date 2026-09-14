const crypto = require("crypto");
const {
  validateADrivenCounterpartSearchExecution,
  validateADrivenCounterpartSearchPlan,
} = require("./aDrivenCounterpartSearchPlan");
const {
  validateADrivenSemanticManifest,
} = require("./aDrivenSemanticManifest");
const { stableStringify } = require("./aDrivenSourceUnitPlan");

// The retrieval matrix remains component x B-document. Only the semantic
// decision unit is compacted to one complete A requirement so the model can
// decide identity, partial detail support and opposite effects coherently.
const A_DRIVEN_REQUIREMENT_DECISION_PLAN_CONTRACT_ID =
  "LF_A_DRIVEN_REQUIREMENT_DECISION_PLAN_V1";
const A_DRIVEN_REQUIREMENT_DECISION_CONTRACT_ID =
  "LF_A_DRIVEN_REQUIREMENT_DECISION_V1";
const COMPONENT_OUTCOMES = new Set([
  "MATCH",
  "COUNTERPART_WITH_DIFFERENCE",
  "OPPOSITE",
  "RELATED_ONLY",
  "NOT_ESTABLISHED",
]);
const DIFFERENCE_DIMENSIONS = new Set([
  "SCOPE",
  "CONDITION",
  "VALUE_AND_UNIT",
  "LIMIT_BASIS",
  "DEDUCTIBLE",
  "TEMPORAL_VALIDITY",
]);
const IDENTITY_CORE_TYPES = new Set([
  "OBJECT",
  "PERIL_OR_CAUSE",
  "DAMAGE_OR_EFFECT",
  "FACT_ROLE",
  "DOCUMENT_ROLE",
  "PRECEDENCE_OR_REPLACEMENT",
]);
const POSITIVE_COUNTERPART_OUTCOMES = new Set([
  "MATCH",
  "COUNTERPART_WITH_DIFFERENCE",
  "OPPOSITE",
]);
const STOP_WORDS = new Set(
  "aber alle als am an auf aus bei bis das dass dem den der des die durch ein eine einer eines für gegen im in ist mit nach nicht oder sind und von vor wenn werden wird zu zum zur".split(
    " "
  )
);
const CHANNEL_WEIGHTS = Object.freeze({
  CURRENT: 8,
  DINGHY: 5,
  LEXICAL_BM25: 4,
  VALUE_ROLE: 4,
  STRUCTURAL: 1,
});

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function decisionError(code, detail) {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  return error;
}

function normalizedText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("de-AT")
    .replace(/[^\p{L}\p{N}%€]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function tokens(value) {
  return new Set(
    normalizedText(value)
      .split(" ")
      .filter(
        (token) =>
          token.length >= 3 && !STOP_WORDS.has(token) && !/^\d+$/u.test(token)
      )
  );
}

function compoundOverlap(query, candidate) {
  if (!query.size) return 0;
  let matched = 0;
  for (const queryToken of query) {
    if (
      [...candidate].some(
        (candidateToken) =>
          queryToken === candidateToken ||
          (queryToken.length >= 6 &&
            candidateToken.length >= 6 &&
            (queryToken.includes(candidateToken) ||
              candidateToken.includes(queryToken)))
      )
    )
      matched += 1;
  }
  return matched / query.size;
}

function orderedRequirements(manifest) {
  return [...manifest.requirements].sort(
    (left, right) =>
      left.sourceOrder[0] - right.sourceOrder[0] ||
      left.sourceOrder[1] - right.sourceOrder[1] ||
      left.sourceOrder[2] - right.sourceOrder[2] ||
      left.requirementId.localeCompare(right.requirementId)
  );
}

function sourceCandidateId(requirementId, item, candidate, span) {
  return `RCE-${sha256(
    stableStringify({
      requirementId,
      documentUuid: item.documentUuid,
      documentSha256: item.documentSha256,
      clauseBoundaryId: candidate.clauseBoundaryId,
      documentStart: span.documentStart,
      documentEnd: span.documentEnd,
      exactTextSha256: span.exactTextSha256,
    })
  ).slice(0, 24)}`;
}

function candidateCatalog(requirement, packages, documentsByUuid) {
  const catalog = new Map();
  for (const item of packages) {
    const document = documentsByUuid.get(item.documentUuid);
    if (!document || document.documentSha256 !== item.documentSha256)
      throw decisionError("LF_A_DRIVEN_REQUIREMENT_DOCUMENT_BINDING_INVALID");
    for (const candidate of item.candidates) {
      for (const span of candidate.sourceSpans) {
        if (
          typeof span.exactText !== "string" ||
          !span.exactText ||
          sha256(span.exactText) !== span.exactTextSha256 ||
          !Number.isInteger(span.physicalPageNumber) ||
          span.physicalPageNumber < 1 ||
          !Number.isInteger(span.documentStart) ||
          !Number.isInteger(span.documentEnd) ||
          span.documentEnd <= span.documentStart
        )
          throw decisionError(
            "LF_A_DRIVEN_REQUIREMENT_SOURCE_CANDIDATE_INVALID"
          );
        const candidateId = sourceCandidateId(
          requirement.requirementId,
          item,
          candidate,
          span
        );
        const existing = catalog.get(candidateId);
        const channels = [
          ...new Set([...(candidate.channels || []), ...(span.channels || [])]),
        ].sort();
        if (existing) {
          existing.targetComponentIds = [
            ...new Set([...existing.targetComponentIds, item.componentId]),
          ].sort();
          existing.channels = [
            ...new Set([...existing.channels, ...channels]),
          ].sort();
          continue;
        }
        catalog.set(candidateId, {
          candidateId,
          documentUuid: item.documentUuid,
          documentSha256: item.documentSha256,
          documentPosition: document.documentPosition,
          documentRole: document.documentRole,
          documentStatus: document.documentStatus,
          originalName: document.originalName,
          physicalPageNumber: span.physicalPageNumber,
          clauseBoundaryId: candidate.clauseBoundaryId,
          documentStart: span.documentStart,
          documentEnd: span.documentEnd,
          exactText: span.exactText,
          exactTextSha256: span.exactTextSha256,
          channels,
          targetComponentIds: [item.componentId],
        });
      }
    }
  }
  return [...catalog.values()];
}

function candidateScore(candidate, component, requirement) {
  const candidateTokens = tokens(candidate.exactText);
  const componentTokens = tokens(
    [
      component.label,
      component.rawValue,
      component.unit,
      component.qualifier,
      component.coverageEffect,
    ].join(" ")
  );
  const requirementTokens = tokens(
    [
      requirement.displayLabel,
      ...(requirement.structurePath || []),
      ...(requirement.sourceSpans || []).map(({ exactText }) => exactText),
    ].join(" ")
  );
  const channelScore = candidate.channels.reduce(
    (sum, channel) => sum + (CHANNEL_WEIGHTS[channel] || 0),
    0
  );
  return (
    compoundOverlap(componentTokens, candidateTokens) * 20 +
    compoundOverlap(requirementTokens, candidateTokens) * 6 +
    channelScore +
    (candidate.targetComponentIds.includes(component.componentId) ? 6 : 0) -
    Math.min(candidate.exactText.length, 2_000) / 20_000
  );
}

function selectForComponent(
  candidates,
  component,
  requirement,
  maximumCandidates
) {
  const ranked = candidates
    .filter(({ targetComponentIds }) =>
      targetComponentIds.includes(component.componentId)
    )
    .map((candidate) => ({
      candidate,
      score: candidateScore(candidate, component, requirement),
    }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.candidate.documentPosition - right.candidate.documentPosition ||
        left.candidate.documentStart - right.candidate.documentStart ||
        left.candidate.candidateId.localeCompare(right.candidate.candidateId)
    );
  const selected = [];
  const selectedIds = new Set();
  const selectedDocuments = new Set();
  for (const item of ranked) {
    if (selected.length >= maximumCandidates) break;
    if (selectedDocuments.has(item.candidate.documentUuid)) continue;
    selected.push(item.candidate);
    selectedIds.add(item.candidate.candidateId);
    selectedDocuments.add(item.candidate.documentUuid);
  }
  for (const item of ranked) {
    if (selected.length >= maximumCandidates) break;
    if (selectedIds.has(item.candidate.candidateId)) continue;
    selected.push(item.candidate);
    selectedIds.add(item.candidate.candidateId);
  }
  return selected;
}

function modelCandidate(candidate) {
  return {
    candidateId: candidate.candidateId,
    documentUuid: candidate.documentUuid,
    documentSha256: candidate.documentSha256,
    documentPosition: candidate.documentPosition,
    documentRole: candidate.documentRole,
    documentStatus: candidate.documentStatus,
    originalName: candidate.originalName,
    physicalPageNumber: candidate.physicalPageNumber,
    clauseBoundaryId: candidate.clauseBoundaryId,
    documentStart: candidate.documentStart,
    documentEnd: candidate.documentEnd,
    exactText: candidate.exactText,
    exactTextSha256: candidate.exactTextSha256,
    channels: candidate.channels,
  };
}

function reviewRow(requirement, packages, documentsByUuid, maximumCandidates) {
  const catalog = candidateCatalog(requirement, packages, documentsByUuid);
  const components = requirement.components.map((component) => {
    const selected = selectForComponent(
      catalog,
      component,
      requirement,
      maximumCandidates
    );
    return {
      componentId: component.componentId,
      dimension: component.type,
      label: component.label,
      identityCore: IDENTITY_CORE_TYPES.has(component.type),
      ...(component.rawValue ? { rawValue: component.rawValue } : {}),
      ...(component.unit ? { unit: component.unit } : {}),
      ...(component.qualifier ? { qualifier: component.qualifier } : {}),
      ...(component.coverageEffect
        ? { coverageEffect: component.coverageEffect }
        : {}),
      navigationCandidateIds: selected.map(({ candidateId }) => candidateId),
    };
  });
  if (!components.some(({ identityCore }) => identityCore))
    for (const component of components) component.identityCore = true;
  const selectedIds = new Set(
    components.flatMap(({ navigationCandidateIds }) => navigationCandidateIds)
  );
  const candidates = catalog
    .filter(({ candidateId }) => selectedIds.has(candidateId))
    .sort(
      (left, right) =>
        left.documentPosition - right.documentPosition ||
        (left.physicalPageNumber || 0) - (right.physicalPageNumber || 0) ||
        left.documentStart - right.documentStart ||
        left.candidateId.localeCompare(right.candidateId)
    )
    .map(modelCandidate);
  const identity = {
    contractId: A_DRIVEN_REQUIREMENT_DECISION_PLAN_CONTRACT_ID,
    requirementId: requirement.requirementId,
    sourceOrder: requirement.sourceOrder,
    componentIds: components.map(({ componentId }) => componentId),
    candidateIds: candidates.map(({ candidateId }) => candidateId),
  };
  return {
    reviewId: `ADR-${sha256(stableStringify(identity)).slice(0, 24)}`,
    requirementId: requirement.requirementId,
    sourceOrder: [...requirement.sourceOrder],
    structurePath: [...requirement.structurePath],
    displayLabel: requirement.displayLabel,
    aSourceSpans: requirement.sourceSpans,
    components,
    candidates,
    searchCoverage: {
      componentDocumentPackages: packages.length,
      documents: new Set(packages.map(({ documentUuid }) => documentUuid)).size,
      requiredChannels: packages[0].searchCoverage.requiredChannels,
      channelsComplete: packages.every(
        ({ searchCoverage }) =>
          searchCoverage.channelExecutionStatus === "CHANNELS_COMPLETE"
      ),
      candidateSelection: "PER_COMPONENT_RANKED_WITH_DOCUMENT_DIVERSITY",
      maximumCandidatesPerComponent: maximumCandidates,
      sourceCandidatesAvailable: catalog.length,
      sourceCandidatesSelected: candidates.length,
      absenceCertified: false,
    },
  };
}

function buildADrivenRequirementDecisionPlan({
  manifest,
  searchPlan,
  searchExecution,
  maximumCandidatesPerComponent = 4,
  maximumRequirementsPerBatch = 2,
  maximumBatchCharacters = 160_000,
} = {}) {
  validateADrivenSemanticManifest(manifest);
  validateADrivenCounterpartSearchPlan(searchPlan, manifest);
  validateADrivenCounterpartSearchExecution(searchExecution, {
    plan: searchPlan,
  });
  if (
    searchExecution.searchPlanSha256 !== searchPlan.planSha256 ||
    !Number.isInteger(maximumCandidatesPerComponent) ||
    maximumCandidatesPerComponent < 1 ||
    !Number.isInteger(maximumRequirementsPerBatch) ||
    maximumRequirementsPerBatch < 1 ||
    !Number.isInteger(maximumBatchCharacters) ||
    maximumBatchCharacters < 10_000
  )
    throw decisionError("LF_A_DRIVEN_REQUIREMENT_PLAN_INPUT_INVALID");
  const documentsByUuid = new Map(
    searchPlan.documents.map((document) => [document.documentUuid, document])
  );
  const packagesByRequirement = new Map();
  for (const item of searchExecution.packages) {
    const list = packagesByRequirement.get(item.requirementId) || [];
    list.push(item);
    packagesByRequirement.set(item.requirementId, list);
  }
  const rows = orderedRequirements(manifest).map((requirement) => {
    const packages = packagesByRequirement.get(requirement.requirementId) || [];
    const expected =
      requirement.components.length * searchPlan.documents.length;
    if (
      packages.length !== expected ||
      new Set(packages.map(({ packageId }) => packageId)).size !== expected ||
      packages.some(
        ({ searchCoverage }) =>
          searchCoverage.channelExecutionStatus !== "CHANNELS_COMPLETE"
      )
    )
      throw decisionError("LF_A_DRIVEN_REQUIREMENT_SEARCH_MATRIX_INCOMPLETE");
    return reviewRow(
      requirement,
      packages,
      documentsByUuid,
      maximumCandidatesPerComponent
    );
  });
  const batches = [];
  let current = [];
  let characters = 0;
  const flush = () => {
    if (!current.length) return;
    const batchIndex = batches.length;
    const expectedRequirementIds = current.map(
      ({ requirementId }) => requirementId
    );
    batches.push({
      batchId: `ADRB-${sha256(
        `${searchExecution.executionSha256}:${batchIndex}:${expectedRequirementIds.join(",")}`
      ).slice(0, 24)}`,
      batchIndex,
      expectedRequirementIds,
      rows: current,
    });
    current = [];
    characters = 0;
  };
  for (const row of rows) {
    const rowCharacters = JSON.stringify(row).length;
    if (rowCharacters > maximumBatchCharacters)
      throw decisionError(
        "LF_A_DRIVEN_REQUIREMENT_REVIEW_ROW_TOO_LARGE",
        row.requirementId
      );
    if (
      current.length >= maximumRequirementsPerBatch ||
      characters + rowCharacters > maximumBatchCharacters
    )
      flush();
    current.push(row);
    characters += rowCharacters;
  }
  flush();
  const payload = {
    schemaVersion: 1,
    contractId: A_DRIVEN_REQUIREMENT_DECISION_PLAN_CONTRACT_ID,
    dynamicManifestSha256: manifest.manifestSha256,
    searchPlanSha256: searchPlan.planSha256,
    searchExecutionSha256: searchExecution.executionSha256,
    selection: {
      maximumCandidatesPerComponent,
      maximumRequirementsPerBatch,
      maximumBatchCharacters,
      characterClippingAllowed: false,
      candidateAuthority: "SERVER_BOUND_NAVIGATION_ONLY",
      goldInputsAllowed: false,
    },
    rows,
    batches,
    summary: {
      requirements: rows.length,
      components: rows.reduce((sum, row) => sum + row.components.length, 0),
      selectedCandidates: rows.reduce(
        (sum, row) => sum + row.candidates.length,
        0
      ),
      batches: batches.length,
      absenceCertifiedRequirements: 0,
    },
  };
  return {
    ...payload,
    planSha256: sha256(
      `${A_DRIVEN_REQUIREMENT_DECISION_PLAN_CONTRACT_ID}\u0000${stableStringify(
        payload
      )}`
    ),
  };
}

function responseIssues(row, response) {
  const issues = [];
  const componentsById = new Map(
    row.components.map((component) => [component.componentId, component])
  );
  const allowedCandidates = new Set(
    row.candidates.map(({ candidateId }) => candidateId)
  );
  const findings = Array.isArray(response?.componentFindings)
    ? response.componentFindings
    : [];
  if (response?.requirementId !== row.requirementId)
    issues.push({ code: "REQUIREMENT_ID_INVALID" });
  if (
    findings.length !== row.components.length ||
    new Set(findings.map(({ componentId }) => componentId)).size !==
      findings.length
  )
    issues.push({ code: "COMPONENT_FINDING_COVERAGE_INVALID" });
  for (const finding of findings) {
    const component = componentsById.get(finding?.componentId);
    if (
      !component ||
      finding.dimension !== component.dimension ||
      !COMPONENT_OUTCOMES.has(finding.outcome) ||
      !Array.isArray(finding.candidateIds) ||
      new Set(finding.candidateIds).size !== finding.candidateIds.length ||
      finding.candidateIds.some(
        (candidateId) => !allowedCandidates.has(candidateId)
      ) ||
      (finding.outcome === "NOT_ESTABLISHED"
        ? finding.candidateIds.length !== 0
        : finding.candidateIds.length === 0) ||
      (finding.outcome === "COUNTERPART_WITH_DIFFERENCE" &&
        !DIFFERENCE_DIMENSIONS.has(finding.dimension))
    )
      issues.push({
        code: "COMPONENT_FINDING_INVALID",
        componentId: finding?.componentId || null,
      });
  }
  if (
    !response?.contextFinding ||
    !COMPONENT_OUTCOMES.has(response.contextFinding.outcome) ||
    !Array.isArray(response.contextFinding.candidateIds) ||
    new Set(response.contextFinding.candidateIds).size !==
      response.contextFinding.candidateIds.length ||
    response.contextFinding.candidateIds.some(
      (candidateId) => !allowedCandidates.has(candidateId)
    ) ||
    (response.contextFinding.outcome === "NOT_ESTABLISHED"
      ? response.contextFinding.candidateIds.length !== 0
      : response.contextFinding.candidateIds.length === 0)
  )
    issues.push({ code: "CONTEXT_FINDING_INVALID" });
  if (!Array.isArray(response?.unmodeledDifferences))
    issues.push({ code: "UNMODELED_DIFFERENCES_INVALID" });
  else
    for (const difference of response.unmodeledDifferences) {
      if (
        typeof difference?.dimension !== "string" ||
        typeof difference?.description !== "string" ||
        !difference.description.trim() ||
        !Array.isArray(difference.candidateIds) ||
        difference.candidateIds.length === 0 ||
        difference.candidateIds.some(
          (candidateId) => !allowedCandidates.has(candidateId)
        )
      )
        issues.push({ code: "UNMODELED_DIFFERENCE_INVALID" });
    }
  if (typeof response?.rationale !== "string" || !response.rationale.trim())
    issues.push({ code: "RATIONALE_INVALID" });
  return issues;
}

function derivedDecision(row, response) {
  const componentsById = new Map(
    row.components.map((component) => [component.componentId, component])
  );
  const coreFindings = response.componentFindings.filter(
    ({ componentId }) => componentsById.get(componentId).identityCore
  );
  const contextCompatible = POSITIVE_COUNTERPART_OUTCOMES.has(
    response.contextFinding.outcome
  );
  const found =
    contextCompatible &&
    coreFindings.some(({ outcome }) =>
      POSITIVE_COUNTERPART_OUTCOMES.has(outcome)
    );
  const opposite = response.componentFindings.some(
    ({ outcome }) => outcome === "OPPOSITE"
  );
  const full =
    found &&
    response.contextFinding.outcome === "MATCH" &&
    response.componentFindings.every(({ outcome }) => outcome === "MATCH") &&
    response.unmodeledDifferences.length === 0;
  return {
    customerFound: found ? true : null,
    customerStatus: found ? "FOUND" : "FALLBACK_REQUIRED",
    counterpartOutcome: found
      ? opposite
        ? "CONTRADICTED"
        : full
          ? "FULL_COUNTERPART"
          : "PARTIAL_COUNTERPART"
      : null,
    absenceCertified: false,
  };
}

function validateADrivenRequirementDecisionResponses({
  plan,
  responses = [],
} = {}) {
  if (
    plan?.contractId !== A_DRIVEN_REQUIREMENT_DECISION_PLAN_CONTRACT_ID ||
    !Array.isArray(plan.rows) ||
    !/^[a-f0-9]{64}$/u.test(String(plan.planSha256 || ""))
  )
    throw decisionError("LF_A_DRIVEN_REQUIREMENT_PLAN_INVALID");
  const { planSha256, ...planPayload } = plan;
  if (
    planSha256 !==
    sha256(
      `${A_DRIVEN_REQUIREMENT_DECISION_PLAN_CONTRACT_ID}\u0000${stableStringify(
        planPayload
      )}`
    )
  )
    throw decisionError("LF_A_DRIVEN_REQUIREMENT_PLAN_DIGEST_INVALID");
  const responsesById = new Map();
  for (const response of responses) {
    const list = responsesById.get(response?.requirementId) || [];
    list.push(response);
    responsesById.set(response?.requirementId, list);
  }
  const diagnostics = [];
  const results = plan.rows.map((row) => {
    const records = responsesById.get(row.requirementId) || [];
    if (records.length !== 1) {
      const reasonCode = records.length
        ? "DUPLICATE_REQUIREMENT_RESPONSE"
        : "MISSING_REQUIREMENT_RESPONSE";
      diagnostics.push({ requirementId: row.requirementId, code: reasonCode });
      return {
        requirementId: row.requirementId,
        status: "UNRESOLVED",
        reasonCode,
      };
    }
    const response = records[0];
    const issues = responseIssues(row, response);
    if (issues.length) {
      diagnostics.push({
        requirementId: row.requirementId,
        code: "INVALID_REQUIREMENT_RESPONSE",
        issues,
      });
      return {
        requirementId: row.requirementId,
        status: "UNRESOLVED",
        reasonCode: "INVALID_REQUIREMENT_RESPONSE",
      };
    }
    const selectedCandidateIds = [
      ...new Set([
        ...response.contextFinding.candidateIds,
        ...response.componentFindings.flatMap(
          ({ candidateIds }) => candidateIds
        ),
        ...response.unmodeledDifferences.flatMap(
          ({ candidateIds }) => candidateIds
        ),
      ]),
    ].sort();
    const candidatesById = new Map(
      row.candidates.map((candidate) => [candidate.candidateId, candidate])
    );
    return {
      requirementId: row.requirementId,
      status: "TERMINAL",
      reasonCode: null,
      ...derivedDecision(row, response),
      contextFinding: response.contextFinding,
      componentFindings: response.componentFindings,
      unmodeledDifferences: response.unmodeledDifferences,
      rationale: response.rationale,
      selectedCandidateIds,
      bEvidence: selectedCandidateIds.map((candidateId) =>
        candidatesById.get(candidateId)
      ),
    };
  });
  for (const requirementId of responsesById.keys())
    if (!plan.rows.some((row) => row.requirementId === requirementId))
      diagnostics.push({ code: "UNKNOWN_REQUIREMENT_ID", requirementId });
  const payload = {
    schemaVersion: 1,
    contractId: A_DRIVEN_REQUIREMENT_DECISION_CONTRACT_ID,
    decisionPlanSha256: plan.planSha256,
    results,
    diagnostics,
    summary: {
      plannedRequirements: plan.rows.length,
      terminalRequirements: results.filter(
        ({ status }) => status === "TERMINAL"
      ).length,
      unresolvedRequirements: results.filter(
        ({ status }) => status === "UNRESOLVED"
      ).length,
      foundRequirements: results.filter(
        ({ customerStatus }) => customerStatus === "FOUND"
      ).length,
      fallbackRequiredRequirements: results.filter(
        ({ customerStatus }) => customerStatus === "FALLBACK_REQUIRED"
      ).length,
      absenceCertifiedRequirements: 0,
    },
  };
  return {
    ...payload,
    decisionSha256: sha256(
      `${A_DRIVEN_REQUIREMENT_DECISION_CONTRACT_ID}\u0000${stableStringify(
        payload
      )}`
    ),
  };
}

module.exports = {
  A_DRIVEN_REQUIREMENT_DECISION_CONTRACT_ID,
  A_DRIVEN_REQUIREMENT_DECISION_PLAN_CONTRACT_ID,
  COMPONENT_OUTCOMES,
  DIFFERENCE_DIMENSIONS,
  IDENTITY_CORE_TYPES,
  buildADrivenRequirementDecisionPlan,
  validateADrivenRequirementDecisionResponses,
};

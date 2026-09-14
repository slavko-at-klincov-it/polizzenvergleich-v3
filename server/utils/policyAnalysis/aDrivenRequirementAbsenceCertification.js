const crypto = require("crypto");
const { validateADrivenCompleteBCorpus } = require("./aDrivenCompleteBCorpus");
const {
  A_DRIVEN_REQUIREMENT_DECISION_PLAN_CONTRACT_ID,
  validateADrivenRequirementDecisionArtifact,
  validateADrivenRequirementDecisionPlan,
} = require("./aDrivenRequirementCounterpartDecision");
const { stableStringify } = require("./aDrivenSourceUnitPlan");

const A_DRIVEN_REQUIREMENT_ABSENCE_PLAN_CONTRACT_ID =
  "LF_A_DRIVEN_REQUIREMENT_ABSENCE_PLAN_V1";
const A_DRIVEN_REQUIREMENT_ABSENCE_DECISION_CONTRACT_ID =
  "LF_A_DRIVEN_REQUIREMENT_ABSENCE_DECISION_V1";
const A_DRIVEN_REQUIREMENT_RESCUE_REVIEW_STRATEGY =
  "FULL_CORPUS_POSITIVE_CANDIDATE_REVIEW";
const PARTITION_DECISIONS = new Set([
  "COUNTERPART_PRESENT",
  "NO_COUNTERPART_IN_PARTITION",
]);

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function absenceError(code, detail) {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  return error;
}

function corpusCandidate(corpus, clause) {
  const identity = {
    completeBCorpusSha256: corpus.corpusSha256,
    documentUuid: clause.documentUuid,
    documentSha256: clause.documentSha256,
    clauseBoundaryId: clause.clauseBoundaryId,
    documentStart: clause.documentStart,
    documentEnd: clause.documentEnd,
    exactTextSha256: clause.exactTextSha256,
  };
  return {
    candidateId: `ABC-${sha256(stableStringify(identity)).slice(0, 24)}`,
    documentUuid: clause.documentUuid,
    documentSha256: clause.documentSha256,
    documentPosition: clause.documentPosition,
    documentRole: clause.documentRole,
    documentStatus: clause.documentStatus,
    physicalPageNumber: clause.physicalPageNumber,
    clauseBoundaryId: clause.clauseBoundaryId,
    documentStart: clause.documentStart,
    documentEnd: clause.documentEnd,
    exactText: clause.exactText,
    exactTextSha256: clause.exactTextSha256,
  };
}

function absenceRequirement(row) {
  return {
    requirementId: row.requirementId,
    sourceOrder: row.sourceOrder,
    structurePath: row.structurePath,
    displayLabel: row.displayLabel,
    aSourceSpans: row.aSourceSpans,
    components: row.components.map(
      ({ navigationCandidateIds: _navigationCandidateIds, ...component }) =>
        component
    ),
  };
}

function partitionDocumentCandidates({
  requirement,
  document,
  candidates,
  maximumPartitionCharacters,
  completeBCorpusSha256,
}) {
  if (candidates.length === 0)
    throw absenceError(
      "LF_A_DRIVEN_REQUIREMENT_ABSENCE_DOCUMENT_EMPTY",
      document.documentUuid
    );
  const partitions = [];
  let current = [];
  const flush = () => {
    if (current.length === 0) return;
    const partitionIndex = partitions.length;
    const identity = {
      contractId: A_DRIVEN_REQUIREMENT_ABSENCE_PLAN_CONTRACT_ID,
      completeBCorpusSha256,
      requirementId: requirement.requirementId,
      documentUuid: document.documentUuid,
      partitionIndex,
      candidateIds: current.map(({ candidateId }) => candidateId),
    };
    partitions.push({
      partitionId: `ABP-${sha256(stableStringify(identity)).slice(0, 24)}`,
      requirementId: requirement.requirementId,
      documentUuid: document.documentUuid,
      documentSha256: document.documentSha256,
      documentPosition: document.documentPosition,
      partitionIndex,
      candidateIds: identity.candidateIds,
    });
    current = [];
  };
  for (const candidate of candidates) {
    const proposed = [...current, candidate];
    const characters = JSON.stringify({
      requirement,
      candidates: proposed,
    }).length;
    if (characters > maximumPartitionCharacters && current.length > 0) {
      flush();
      if (
        JSON.stringify({ requirement, candidates: [candidate] }).length >
        maximumPartitionCharacters
      )
        throw absenceError(
          "LF_A_DRIVEN_REQUIREMENT_ABSENCE_CLAUSE_TOO_LARGE",
          candidate.candidateId
        );
      current.push(candidate);
      continue;
    }
    if (characters > maximumPartitionCharacters)
      throw absenceError(
        "LF_A_DRIVEN_REQUIREMENT_ABSENCE_CLAUSE_TOO_LARGE",
        candidate.candidateId
      );
    current.push(candidate);
  }
  flush();
  return partitions;
}

function buildADrivenRequirementAbsencePlan({
  decisionPlan,
  preliminaryDecisions,
  completeCorpus,
  maximumPartitionCharacters = 80_000,
} = {}) {
  validateADrivenRequirementDecisionPlan(decisionPlan);
  validateADrivenRequirementDecisionArtifact(
    preliminaryDecisions,
    decisionPlan
  );
  validateADrivenCompleteBCorpus(completeCorpus);
  if (
    decisionPlan.completeBCorpusSha256 !== completeCorpus.corpusSha256 ||
    !Number.isInteger(maximumPartitionCharacters) ||
    maximumPartitionCharacters < 10_000
  )
    throw absenceError("LF_A_DRIVEN_REQUIREMENT_ABSENCE_INPUT_INVALID");
  const preliminaryById = new Map(
    preliminaryDecisions.results.map((result) => [result.requirementId, result])
  );
  const fallbackRows = decisionPlan.rows.filter(
    ({ requirementId }) =>
      preliminaryById.get(requirementId)?.customerStatus === "FALLBACK_REQUIRED"
  );
  const requirements = fallbackRows.map(absenceRequirement);
  const candidates = completeCorpus.clauses
    .map((clause) => corpusCandidate(completeCorpus, clause))
    .sort(
      (left, right) =>
        left.documentPosition - right.documentPosition ||
        left.physicalPageNumber - right.physicalPageNumber ||
        left.documentStart - right.documentStart ||
        left.candidateId.localeCompare(right.candidateId)
    );
  if (
    new Set(candidates.map(({ candidateId }) => candidateId)).size !==
    candidates.length
  )
    throw absenceError("LF_A_DRIVEN_REQUIREMENT_ABSENCE_CANDIDATES_DUPLICATE");
  const candidatesByDocument = new Map();
  for (const candidate of candidates) {
    const list = candidatesByDocument.get(candidate.documentUuid) || [];
    list.push(candidate);
    candidatesByDocument.set(candidate.documentUuid, list);
  }
  const partitions = [];
  const coverage = [];
  for (const requirement of requirements) {
    const requirementPartitions = [];
    for (const document of completeCorpus.documents) {
      const documentCandidates =
        candidatesByDocument.get(document.documentUuid) || [];
      const planned = partitionDocumentCandidates({
        requirement,
        document,
        candidates: documentCandidates,
        maximumPartitionCharacters,
        completeBCorpusSha256: completeCorpus.corpusSha256,
      });
      partitions.push(...planned);
      requirementPartitions.push(...planned);
    }
    coverage.push({
      requirementId: requirement.requirementId,
      documents: completeCorpus.documents.length,
      partitions: requirementPartitions.length,
      clauseReviews: requirementPartitions.reduce(
        (sum, partition) => sum + partition.candidateIds.length,
        0
      ),
    });
  }
  const payload = {
    schemaVersion: 1,
    contractId: A_DRIVEN_REQUIREMENT_ABSENCE_PLAN_CONTRACT_ID,
    decisionPlanSha256: decisionPlan.planSha256,
    preliminaryDecisionSha256: preliminaryDecisions.decisionSha256,
    completeBCorpusSha256: completeCorpus.corpusSha256,
    maximumPartitionCharacters,
    characterClippingAllowed: false,
    sourceBoundaryPolicy: "COMPLETE_EXTRACTED_B_CLAUSES_ONLY",
    requirements,
    candidates,
    partitions,
    coverage,
    summary: {
      fallbackRequirements: requirements.length,
      documents: completeCorpus.documents.length,
      corpusClauses: candidates.length,
      partitions: partitions.length,
      plannedClauseReviews: coverage.reduce(
        (sum, item) => sum + item.clauseReviews,
        0
      ),
      customerNotFoundEligible: false,
    },
    proofLimit:
      "Der Plan beweist die lückenlose technische Zuordnung jedes extrahierten B-Klauselblocks zu jeder Fallback-Anforderung. Erst terminal validierte semantische Antworten auf alle Partitionen können einen qualifizierten Vergleichs-Nullfund erzeugen; eine mathematische oder Holdout-Fehlerfreiheit wird nicht behauptet.",
  };
  return {
    ...payload,
    planSha256: sha256(
      `${A_DRIVEN_REQUIREMENT_ABSENCE_PLAN_CONTRACT_ID}\u0000${stableStringify(
        payload
      )}`
    ),
  };
}

function validateADrivenRequirementAbsencePlan(plan) {
  if (
    plan?.contractId !== A_DRIVEN_REQUIREMENT_ABSENCE_PLAN_CONTRACT_ID ||
    !Array.isArray(plan.requirements) ||
    !Array.isArray(plan.candidates) ||
    !Array.isArray(plan.partitions) ||
    !Array.isArray(plan.coverage) ||
    !/^[a-f0-9]{64}$/u.test(String(plan.planSha256 || ""))
  )
    throw absenceError("LF_A_DRIVEN_REQUIREMENT_ABSENCE_PLAN_INVALID");
  const { planSha256, ...payload } = plan;
  if (
    planSha256 !==
    sha256(
      `${A_DRIVEN_REQUIREMENT_ABSENCE_PLAN_CONTRACT_ID}\u0000${stableStringify(
        payload
      )}`
    )
  )
    throw absenceError("LF_A_DRIVEN_REQUIREMENT_ABSENCE_PLAN_DIGEST_INVALID");
  const candidateIds = new Set(
    plan.candidates.map(({ candidateId }) => candidateId)
  );
  const partitionIds = new Set(
    plan.partitions.map(({ partitionId }) => partitionId)
  );
  if (
    candidateIds.size !== plan.candidates.length ||
    partitionIds.size !== plan.partitions.length ||
    plan.partitions.some(
      ({ candidateIds: ids }) =>
        !Array.isArray(ids) ||
        ids.length === 0 ||
        new Set(ids).size !== ids.length ||
        ids.some((candidateId) => !candidateIds.has(candidateId))
    )
  )
    throw absenceError("LF_A_DRIVEN_REQUIREMENT_ABSENCE_PLAN_COVERAGE_INVALID");
  const plannedPairs = plan.partitions.flatMap((partition) =>
    partition.candidateIds.map(
      (candidateId) => `${partition.requirementId}:${candidateId}`
    )
  );
  if (
    new Set(plannedPairs).size !== plannedPairs.length ||
    plannedPairs.length !== plan.summary?.plannedClauseReviews ||
    plannedPairs.length !==
      plan.requirements.length * plan.summary?.corpusClauses
  )
    throw absenceError("LF_A_DRIVEN_REQUIREMENT_ABSENCE_PLAN_MATRIX_INVALID");
  return true;
}

function partitionResponseResult(partition, response) {
  const selected = response?.candidateIds;
  const allowed = new Set(partition.candidateIds);
  const valid =
    response?.partitionId === partition.partitionId &&
    PARTITION_DECISIONS.has(response.decision) &&
    Array.isArray(selected) &&
    new Set(selected).size === selected.length &&
    selected.every((candidateId) => allowed.has(candidateId)) &&
    (response.decision === "COUNTERPART_PRESENT"
      ? selected.length > 0
      : selected.length === 0) &&
    typeof response.rationale === "string" &&
    Boolean(response.rationale.trim());
  if (!valid)
    return {
      result: {
        partitionId: partition.partitionId,
        requirementId: partition.requirementId,
        status: "UNRESOLVED",
        reasonCode: "INVALID_PARTITION_RESPONSE",
      },
      diagnostic: {
        partitionId: partition.partitionId,
        code: "INVALID_PARTITION_RESPONSE",
      },
    };
  return {
    result: {
      partitionId: partition.partitionId,
      requirementId: partition.requirementId,
      documentUuid: partition.documentUuid,
      status: "TERMINAL",
      reasonCode: null,
      decision: response.decision,
      selectedCandidateIds: selected,
      rationale: response.rationale,
    },
    diagnostic: null,
  };
}

function validateADrivenRequirementAbsencePartitionResponse({
  plan,
  partitionId,
  response,
} = {}) {
  validateADrivenRequirementAbsencePlan(plan);
  const partition = plan.partitions.find(
    ({ partitionId: expected }) => expected === partitionId
  );
  if (!partition)
    throw absenceError("LF_A_DRIVEN_REQUIREMENT_ABSENCE_PARTITION_UNKNOWN");
  return partitionResponseResult(partition, response);
}

function validateADrivenRequirementAbsenceResponses({
  plan,
  responses = [],
} = {}) {
  validateADrivenRequirementAbsencePlan(plan);
  const candidatesById = new Map(
    plan.candidates.map((candidate) => [candidate.candidateId, candidate])
  );
  const partitionIds = new Set(
    plan.partitions.map(({ partitionId }) => partitionId)
  );
  const responsesByPartition = new Map();
  for (const response of responses) {
    const list = responsesByPartition.get(response?.partitionId) || [];
    list.push(response);
    responsesByPartition.set(response?.partitionId, list);
  }
  const diagnostics = [];
  const partitionResults = plan.partitions.map((partition) => {
    const records = responsesByPartition.get(partition.partitionId) || [];
    if (records.length !== 1) {
      const reasonCode = records.length
        ? "DUPLICATE_PARTITION_RESPONSE"
        : "MISSING_PARTITION_RESPONSE";
      diagnostics.push({
        partitionId: partition.partitionId,
        code: reasonCode,
      });
      return {
        partitionId: partition.partitionId,
        requirementId: partition.requirementId,
        status: "UNRESOLVED",
        reasonCode,
      };
    }
    const validated = partitionResponseResult(partition, records[0]);
    if (validated.diagnostic) diagnostics.push(validated.diagnostic);
    return validated.result;
  });
  for (const partitionId of responsesByPartition.keys())
    if (!partitionIds.has(partitionId))
      diagnostics.push({ code: "UNKNOWN_PARTITION_ID", partitionId });
  const results = plan.requirements.map((requirement) => {
    const expected = plan.partitions.filter(
      ({ requirementId }) => requirementId === requirement.requirementId
    );
    const observed = partitionResults.filter(
      ({ requirementId }) => requirementId === requirement.requirementId
    );
    if (
      observed.length !== expected.length ||
      observed.some(({ status }) => status !== "TERMINAL")
    )
      return {
        requirementId: requirement.requirementId,
        status: "UNRESOLVED",
        customerStatus: "FALLBACK_REQUIRED",
        absenceCertified: false,
        reasonCode: "ABSENCE_PARTITIONS_INCOMPLETE",
      };
    const selectedCandidateIds = [
      ...new Set(
        observed.flatMap(
          ({ selectedCandidateIds = [] }) => selectedCandidateIds
        )
      ),
    ].sort();
    if (selectedCandidateIds.length > 0)
      return {
        requirementId: requirement.requirementId,
        status: "COUNTERPART_REVIEW_REQUIRED",
        customerStatus: "FALLBACK_REQUIRED",
        absenceCertified: false,
        reasonCode: "FULL_CORPUS_COUNTERPART_CANDIDATE_FOUND",
        selectedCandidateIds,
        bEvidence: selectedCandidateIds.map((candidateId) =>
          candidatesById.get(candidateId)
        ),
      };
    return {
      requirementId: requirement.requirementId,
      status: "TERMINAL",
      customerStatus: "NOT_FOUND",
      absenceCertified: true,
      reasonCode: null,
      reviewedDocuments: plan.summary.documents,
      reviewedClauses: plan.summary.corpusClauses,
      reviewedPartitions: expected.length,
      selectedCandidateIds: [],
      bEvidence: [],
    };
  });
  const payload = {
    schemaVersion: 1,
    contractId: A_DRIVEN_REQUIREMENT_ABSENCE_DECISION_CONTRACT_ID,
    absencePlanSha256: plan.planSha256,
    partitionResults,
    results,
    diagnostics,
    summary: {
      requirements: results.length,
      terminalNotFound: results.filter(
        ({ customerStatus, absenceCertified }) =>
          customerStatus === "NOT_FOUND" && absenceCertified
      ).length,
      counterpartReviewRequired: results.filter(
        ({ status }) => status === "COUNTERPART_REVIEW_REQUIRED"
      ).length,
      unresolved: results.filter(({ status }) => status === "UNRESOLVED")
        .length,
      terminalPartitions: partitionResults.filter(
        ({ status }) => status === "TERMINAL"
      ).length,
      plannedPartitions: plan.partitions.length,
      customerNotFoundEligible:
        results.length > 0 &&
        results.every(
          ({ customerStatus, absenceCertified }) =>
            customerStatus === "NOT_FOUND" && absenceCertified
        ),
    },
  };
  return {
    ...payload,
    decisionSha256: sha256(
      `${A_DRIVEN_REQUIREMENT_ABSENCE_DECISION_CONTRACT_ID}\u0000${stableStringify(
        payload
      )}`
    ),
  };
}

function validateADrivenRequirementAbsenceDecisionArtifact(
  decisions,
  plan,
  { requireComplete = false } = {}
) {
  validateADrivenRequirementAbsencePlan(plan);
  if (
    decisions?.contractId !==
      A_DRIVEN_REQUIREMENT_ABSENCE_DECISION_CONTRACT_ID ||
    decisions.absencePlanSha256 !== plan.planSha256 ||
    !Array.isArray(decisions.partitionResults) ||
    !Array.isArray(decisions.results) ||
    !Array.isArray(decisions.diagnostics) ||
    !/^[a-f0-9]{64}$/u.test(String(decisions.decisionSha256 || ""))
  )
    throw absenceError(
      "LF_A_DRIVEN_REQUIREMENT_ABSENCE_DECISION_ARTIFACT_INVALID"
    );
  const terminalResponses = decisions.partitionResults
    .filter(({ status }) => status === "TERMINAL")
    .map(
      ({ partitionId, decision, selectedCandidateIds, rationale }) => ({
        partitionId,
        decision,
        candidateIds: selectedCandidateIds,
        rationale,
      })
    );
  const rebuilt = validateADrivenRequirementAbsenceResponses({
    plan,
    responses: terminalResponses,
  });
  if (stableStringify(rebuilt) !== stableStringify(decisions))
    throw absenceError(
      "LF_A_DRIVEN_REQUIREMENT_ABSENCE_DECISION_ARTIFACT_MISMATCH"
    );
  if (
    requireComplete &&
    (decisions.summary.unresolved !== 0 ||
      decisions.summary.terminalPartitions !== plan.partitions.length ||
      decisions.results.some(
        ({ status }) =>
          status !== "TERMINAL" && status !== "COUNTERPART_REVIEW_REQUIRED"
      ))
  )
    throw absenceError(
      "LF_A_DRIVEN_REQUIREMENT_ABSENCE_DECISION_ARTIFACT_INCOMPLETE"
    );
  return decisions;
}

function rescueCandidateId({
  absencePlanSha256,
  requirementId,
  absenceCandidateId,
}) {
  return `RCR-${sha256(
    stableStringify({
      absencePlanSha256,
      requirementId,
      absenceCandidateId,
    })
  ).slice(0, 24)}`;
}

function candidateSourceKey(candidate) {
  return stableStringify({
    documentUuid: candidate.documentUuid,
    documentSha256: candidate.documentSha256,
    clauseBoundaryId: candidate.clauseBoundaryId,
    documentStart: candidate.documentStart,
    documentEnd: candidate.documentEnd,
    exactTextSha256: candidate.exactTextSha256,
  });
}

function buildADrivenRequirementRescueReviewPlan({
  decisionPlan,
  preliminaryDecisions,
  absencePlan,
  absenceDecisions,
  completeCorpus,
  maximumRequirementsPerBatch = 1,
  maximumBatchCharacters = 160_000,
} = {}) {
  validateADrivenRequirementDecisionPlan(decisionPlan);
  validateADrivenRequirementDecisionArtifact(
    preliminaryDecisions,
    decisionPlan
  );
  validateADrivenRequirementAbsencePlan(absencePlan);
  validateADrivenRequirementAbsenceDecisionArtifact(
    absenceDecisions,
    absencePlan,
    { requireComplete: true }
  );
  validateADrivenCompleteBCorpus(completeCorpus);
  if (
    absencePlan.decisionPlanSha256 !== decisionPlan.planSha256 ||
    absencePlan.preliminaryDecisionSha256 !==
      preliminaryDecisions.decisionSha256 ||
    absencePlan.completeBCorpusSha256 !== completeCorpus.corpusSha256 ||
    decisionPlan.completeBCorpusSha256 !== completeCorpus.corpusSha256 ||
    !Number.isInteger(maximumRequirementsPerBatch) ||
    maximumRequirementsPerBatch < 1 ||
    !Number.isInteger(maximumBatchCharacters) ||
    maximumBatchCharacters < 10_000
  )
    throw absenceError("LF_A_DRIVEN_REQUIREMENT_RESCUE_INPUT_INVALID");

  const rowsByRequirement = new Map(
    decisionPlan.rows.map((row) => [row.requirementId, row])
  );
  const preliminaryByRequirement = new Map(
    preliminaryDecisions.results.map((result) => [
      result.requirementId,
      result,
    ])
  );
  const candidatesById = new Map(
    absencePlan.candidates.map((candidate) => [
      candidate.candidateId,
      candidate,
    ])
  );
  const documentsById = new Map(
    completeCorpus.documents.map((document) => [
      document.documentUuid,
      document,
    ])
  );
  const reviewResults = absenceDecisions.results.filter(
    ({ status }) => status === "COUNTERPART_REVIEW_REQUIRED"
  );
  if (reviewResults.length === 0)
    throw absenceError("LF_A_DRIVEN_REQUIREMENT_RESCUE_EMPTY");

  const rows = reviewResults
    .map((absenceResult) => {
      const row = rowsByRequirement.get(absenceResult.requirementId);
      const preliminary = preliminaryByRequirement.get(
        absenceResult.requirementId
      );
      if (
        !row ||
        preliminary?.customerStatus !== "FALLBACK_REQUIRED" ||
        !Array.isArray(absenceResult.selectedCandidateIds) ||
        absenceResult.selectedCandidateIds.length === 0
      )
        throw absenceError(
          "LF_A_DRIVEN_REQUIREMENT_RESCUE_REQUIREMENT_INVALID",
          absenceResult.requirementId
        );

      const candidates = row.candidates.map((candidate) => ({ ...candidate }));
      const candidateIdBySource = new Map(
        candidates.map((candidate) => [
          candidateSourceKey(candidate),
          candidate.candidateId,
        ])
      );
      const fullCorpusReviewCandidateIds = [];
      for (const absenceCandidateId of absenceResult.selectedCandidateIds) {
        const candidate = candidatesById.get(absenceCandidateId);
        const document = candidate
          ? documentsById.get(candidate.documentUuid)
          : null;
        if (
          !candidate ||
          !document ||
          document.documentSha256 !== candidate.documentSha256 ||
          document.documentPosition !== candidate.documentPosition
        )
          throw absenceError(
            "LF_A_DRIVEN_REQUIREMENT_RESCUE_CANDIDATE_INVALID",
            absenceCandidateId
          );
        const sourceKey = candidateSourceKey(candidate);
        let candidateId = candidateIdBySource.get(sourceKey);
        if (!candidateId) {
          candidateId = rescueCandidateId({
            absencePlanSha256: absencePlan.planSha256,
            requirementId: row.requirementId,
            absenceCandidateId,
          });
          candidates.push({
            candidateId,
            documentUuid: candidate.documentUuid,
            documentSha256: candidate.documentSha256,
            documentPosition: candidate.documentPosition,
            documentRole: candidate.documentRole,
            documentStatus: candidate.documentStatus,
            originalName: document.originalName,
            physicalPageNumber: candidate.physicalPageNumber,
            clauseBoundaryId: candidate.clauseBoundaryId,
            documentStart: candidate.documentStart,
            documentEnd: candidate.documentEnd,
            exactText: candidate.exactText,
            exactTextSha256: candidate.exactTextSha256,
            channels: ["COMPLETE_B_CORPUS_RESCUE"],
          });
          candidateIdBySource.set(sourceKey, candidateId);
        }
        fullCorpusReviewCandidateIds.push(candidateId);
      }
      const uniqueReviewCandidateIds = [
        ...new Set(fullCorpusReviewCandidateIds),
      ].sort();
      const components = row.components.map((component) => ({
        ...component,
        navigationCandidateIds: [
          ...new Set([
            ...component.navigationCandidateIds,
            ...uniqueReviewCandidateIds,
          ]),
        ].sort(),
      }));
      candidates.sort(
        (left, right) =>
          left.documentPosition - right.documentPosition ||
          left.physicalPageNumber - right.physicalPageNumber ||
          left.documentStart - right.documentStart ||
          left.candidateId.localeCompare(right.candidateId)
      );
      const reviewIdentity = {
        absenceDecisionSha256: absenceDecisions.decisionSha256,
        requirementId: row.requirementId,
        candidateIds: candidates.map(({ candidateId }) => candidateId),
        fullCorpusReviewCandidateIds: uniqueReviewCandidateIds,
      };
      return {
        ...row,
        reviewId: `ADR-${sha256(stableStringify(reviewIdentity)).slice(0, 24)}`,
        components,
        candidates,
        searchCoverage: {
          ...row.searchCoverage,
          candidateSelection: A_DRIVEN_REQUIREMENT_RESCUE_REVIEW_STRATEGY,
          absencePlanSha256: absencePlan.planSha256,
          absenceDecisionSha256: absenceDecisions.decisionSha256,
          fullCorpusReviewCandidateIds: uniqueReviewCandidateIds,
          fullCorpusReviewCandidates: uniqueReviewCandidateIds.length,
          absenceCertified: false,
        },
      };
    })
    .sort(
      (left, right) =>
        left.sourceOrder[0] - right.sourceOrder[0] ||
        left.sourceOrder[1] - right.sourceOrder[1] ||
        left.sourceOrder[2] - right.sourceOrder[2] ||
        left.requirementId.localeCompare(right.requirementId)
    );

  const batches = [];
  let current = [];
  let currentCharacters = 0;
  const flush = () => {
    if (current.length === 0) return;
    const batchIndex = batches.length;
    const expectedRequirementIds = current.map(
      ({ requirementId }) => requirementId
    );
    batches.push({
      batchId: `ADRRB-${sha256(
        stableStringify({
          absenceDecisionSha256: absenceDecisions.decisionSha256,
          batchIndex,
          expectedRequirementIds,
        })
      ).slice(0, 24)}`,
      batchIndex,
      expectedRequirementIds,
      rows: current,
    });
    current = [];
    currentCharacters = 0;
  };
  for (const row of rows) {
    const rowCharacters = JSON.stringify(row).length;
    if (rowCharacters > maximumBatchCharacters)
      throw absenceError(
        "LF_A_DRIVEN_REQUIREMENT_RESCUE_ROW_TOO_LARGE",
        row.requirementId
      );
    if (
      current.length >= maximumRequirementsPerBatch ||
      currentCharacters + rowCharacters > maximumBatchCharacters
    )
      flush();
    current.push(row);
    currentCharacters += rowCharacters;
  }
  flush();
  const payload = {
    schemaVersion: 3,
    contractId: A_DRIVEN_REQUIREMENT_DECISION_PLAN_CONTRACT_ID,
    dynamicManifestSha256: decisionPlan.dynamicManifestSha256,
    searchPlanSha256: decisionPlan.searchPlanSha256,
    searchExecutionSha256: decisionPlan.searchExecutionSha256,
    completeBCorpusSha256: decisionPlan.completeBCorpusSha256,
    selection: {
      strategy: A_DRIVEN_REQUIREMENT_RESCUE_REVIEW_STRATEGY,
      sourceDecisionPlanSha256: decisionPlan.planSha256,
      preliminaryDecisionSha256: preliminaryDecisions.decisionSha256,
      absencePlanSha256: absencePlan.planSha256,
      absenceDecisionSha256: absenceDecisions.decisionSha256,
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
      components: rows.reduce(
        (sum, row) => sum + row.components.length,
        0
      ),
      selectedCandidates: rows.reduce(
        (sum, row) => sum + row.candidates.length,
        0
      ),
      fullCorpusReviewCandidates: rows.reduce(
        (sum, row) =>
          sum + row.searchCoverage.fullCorpusReviewCandidates,
        0
      ),
      batches: batches.length,
      absenceCertifiedRequirements: 0,
    },
  };
  const plan = {
    ...payload,
    planSha256: sha256(
      `${A_DRIVEN_REQUIREMENT_DECISION_PLAN_CONTRACT_ID}\u0000${stableStringify(
        payload
      )}`
    ),
  };
  validateADrivenRequirementDecisionPlan(plan);
  return plan;
}

module.exports = {
  A_DRIVEN_REQUIREMENT_ABSENCE_DECISION_CONTRACT_ID,
  A_DRIVEN_REQUIREMENT_ABSENCE_PLAN_CONTRACT_ID,
  A_DRIVEN_REQUIREMENT_RESCUE_REVIEW_STRATEGY,
  PARTITION_DECISIONS,
  buildADrivenRequirementAbsencePlan,
  buildADrivenRequirementRescueReviewPlan,
  validateADrivenRequirementAbsenceDecisionArtifact,
  validateADrivenRequirementAbsencePlan,
  validateADrivenRequirementAbsencePartitionResponse,
  validateADrivenRequirementAbsenceResponses,
};

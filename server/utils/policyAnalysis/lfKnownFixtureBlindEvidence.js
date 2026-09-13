const crypto = require("crypto");
const {
  bm25Index,
  normalize,
  rankLexicalCandidates,
  tokens,
} = require("./counterpartRetrievalPrimitives");
const {
  buildSourceEvidenceBoundaryPlan,
  partitionCompleteEvidenceGroups,
} = require("./sourceEvidenceBoundaryContext");
const { factRoleDimension } = require("./lfKnownFixtureSourceReview");

const BLIND_EVIDENCE_PACKET_CONTRACT_ID =
  "LF_1PLUS9_BLIND_SOURCE_REVIEW_PACKET_V2";
const BLIND_EVIDENCE_ROW_INPUT_CONTRACT_ID =
  "LF_1PLUS9_BLIND_SOURCE_REVIEW_ROW_INPUT_V2";
const GERMAN_SEMANTIC_TOKEN_CONCEPTS = Object.freeze([
  {
    concept: "concept_favorable_precedence",
    stems: ["besser", "gunstig", "vorteilhaft"],
  },
  {
    concept: "concept_new_contract_application",
    stems: ["neuantrag", "neuvertrag", "neuabschluss"],
  },
  {
    concept: "concept_contract_conversion",
    stems: ["konvertier", "umdeck", "umstell"],
  },
  {
    concept: "concept_supplemental_coverage",
    stems: ["zusatzdeck", "deckungserweiter", "exklusivschutz"],
  },
]);

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function stableStringify(value) {
  if (Array.isArray(value))
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

function semanticTokens(value) {
  const lexical = tokens(value);
  const concepts = GERMAN_SEMANTIC_TOKEN_CONCEPTS.filter(({ stems }) =>
    lexical.some((token) => stems.some((stem) => token.startsWith(stem)))
  ).map(({ concept }) => concept);
  return [...lexical, ...concepts];
}

function blindError(code, detail = "") {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  throw error;
}

function validateSourceSpan(span) {
  if (
    typeof span?.spanId !== "string" ||
    !span.spanId ||
    !Number.isInteger(span.physicalPageNumber) ||
    span.physicalPageNumber < 1 ||
    !Number.isInteger(span.documentStart) ||
    span.documentStart < 0 ||
    !Number.isInteger(span.documentEnd) ||
    span.documentEnd <= span.documentStart ||
    typeof span.exactText !== "string" ||
    !span.exactText ||
    sha256(span.exactText) !== span.exactTextSha256
  )
    blindError("LF_BLIND_EVIDENCE_A_SOURCE_SPAN_INVALID");
}

function referenceRequirement(requirement) {
  if (
    typeof requirement?.requirementId !== "string" ||
    typeof requirement.displayLabel !== "string" ||
    !requirement.displayLabel ||
    !Array.isArray(requirement.components) ||
    requirement.components.length === 0 ||
    !Array.isArray(requirement.sourceSpans) ||
    requirement.sourceSpans.length === 0
  )
    blindError("LF_BLIND_EVIDENCE_A_REQUIREMENT_INVALID");
  requirement.sourceSpans.forEach(validateSourceSpan);
  const spanIds = new Set(requirement.sourceSpans.map(({ spanId }) => spanId));
  const componentIds = new Set();
  const components = requirement.components.map((component) => {
    const componentId = component.id || component.componentId;
    if (
      typeof componentId !== "string" ||
      !componentId ||
      componentIds.has(componentId) ||
      typeof component.label !== "string" ||
      !component.label ||
      typeof component.factRole !== "string" ||
      !Array.isArray(component.sourceSpanIds) ||
      component.sourceSpanIds.length === 0 ||
      component.sourceSpanIds.some((spanId) => !spanIds.has(spanId))
    )
      blindError(
        "LF_BLIND_EVIDENCE_A_COMPONENT_INVALID",
        requirement.requirementId
      );
    componentIds.add(componentId);
    return {
      componentId,
      label: component.label,
      aliases: Array.isArray(component.aliases) ? [...component.aliases] : [],
      factRole: component.factRole,
      dimension: factRoleDimension(component.factRole),
      sourceSpanIds: [...component.sourceSpanIds],
    };
  });
  return {
    requirementId: requirement.requirementId,
    sourceOrder: requirement.sourceOrder,
    category: {
      id: requirement.categoryId,
      label: requirement.categoryLabel,
    },
    subcategory: {
      id: requirement.subcategoryId,
      label: requirement.subcategoryLabel,
    },
    displayLabel: requirement.displayLabel,
    referenceA: {
      sourceSpans: requirement.sourceSpans.map(
        ({
          spanId,
          physicalPageNumber,
          documentStart,
          documentEnd,
          exactText,
          exactTextSha256,
          blockIds,
        }) => ({
          spanId,
          physicalPageNumber,
          documentStart,
          documentEnd,
          exactText,
          exactTextSha256,
          blockIds,
        })
      ),
      values: Array.isArray(requirement.values) ? requirement.values : [],
    },
    components,
  };
}

function groupCandidate(group) {
  return {
    evidenceGroupId: group.evidenceGroupId,
    exactText: group.exactText,
    documentStart: Math.min(
      ...group.sourceSpans.map(({ documentStart }) => documentStart)
    ),
    documentEnd: Math.max(
      ...group.sourceSpans.map(({ documentEnd }) => documentEnd)
    ),
    structuralKinds: [group.boundaryKind],
  };
}

function queryFor(requirement, component = null) {
  const sourceText = requirement.referenceA.sourceSpans
    .filter(
      ({ spanId }) => !component || component.sourceSpanIds.includes(spanId)
    )
    .map(({ exactText }) => exactText)
    .join(" ");
  const labels = component
    ? [component.label, ...component.aliases]
    : [
        requirement.category.label,
        requirement.subcategory.label,
        requirement.displayLabel,
      ];
  return {
    query: [...labels, sourceText].join(" "),
    phrases: labels.map(normalize).filter((value) => value.length >= 5),
  };
}

function rangesOverlap(left, right) {
  return (
    left.documentStart < right.documentEnd &&
    right.documentStart < left.documentEnd
  );
}

function validateNavigationRange(candidate, oracleDocument, artifact) {
  const range = candidate?.range;
  const page = artifact?.document?.pageMap?.find(
    ({ pageNumber }) => pageNumber === range?.physicalPageNumber
  );
  if (
    typeof candidate?.candidateId !== "string" ||
    !range ||
    range.documentUuid !== oracleDocument?.uuid ||
    range.documentFingerprint !== oracleDocument.fingerprint ||
    !Number.isInteger(range.documentStart) ||
    !Number.isInteger(range.documentEnd) ||
    range.documentEnd <= range.documentStart ||
    typeof range.exactQuote !== "string" ||
    !range.exactQuote ||
    sha256(range.exactQuote) !== range.exactQuoteSha256 ||
    !page ||
    range.documentStart < page.start ||
    range.documentEnd > page.end ||
    artifact.document.pageContent.slice(
      range.documentStart,
      range.documentEnd
    ) !== range.exactQuote
  )
    blindError(
      "LF_BLIND_EVIDENCE_NAVIGATION_RANGE_INVALID",
      candidate?.candidateId
    );
}

function navigationAnchors({
  oracleRow,
  candidatesById,
  groupsByDocument,
  query,
  maximumNavigationAnchors,
  maximumEvidenceGroupsPerAnchor,
}) {
  const candidates = oracleRow.benchmarkCandidateIds
    .map((candidateId) => candidatesById.get(candidateId))
    .filter(Boolean)
    .map((candidate) => ({
      candidate,
      candidateId: candidate.candidateId,
      exactText: candidate.range.exactQuote,
      documentStart: candidate.range.documentStart,
      documentEnd: candidate.range.documentEnd,
      structuralKinds: [candidate.candidateKind || "NAVIGATION_RANGE"],
    }));
  const ranked = rankLexicalCandidates({
    target: query,
    candidates,
    index: bm25Index(candidates),
    topK: maximumNavigationAnchors,
    structural: true,
  });
  return ranked.map(({ candidate, candidateId, matchedTokens }) => {
    const range = candidate.range;
    const overlappingGroups = (
      groupsByDocument.get(range.documentUuid) || []
    ).filter((group) =>
      rangesOverlap(range, {
        documentStart: Math.min(
          ...group.sourceSpans.map(({ documentStart }) => documentStart)
        ),
        documentEnd: Math.max(
          ...group.sourceSpans.map(({ documentEnd }) => documentEnd)
        ),
      })
    );
    const overlappingCandidates = overlappingGroups.map(groupCandidate);
    const evidenceGroupIds = rankLexicalCandidates({
      target: query,
      candidates: overlappingCandidates,
      index: bm25Index(overlappingCandidates),
      topK: maximumEvidenceGroupsPerAnchor,
      structural: true,
    }).map(({ evidenceGroupId }) => evidenceGroupId);
    return {
      navigationAnchorId: candidateId,
      documentUuid: range.documentUuid,
      documentFingerprint: range.documentFingerprint,
      physicalPageNumber: range.physicalPageNumber,
      documentStart: range.documentStart,
      documentEnd: range.documentEnd,
      exactQuoteSha256: range.exactQuoteSha256,
      matchedTokens,
      evidenceGroupIds,
    };
  });
}

function retrieveEvidence({
  requirement,
  component,
  groupCandidates,
  groupIndex,
  semanticGroupCandidates,
  semanticGroupIndex,
  groupsById,
  oracleRow,
  candidatesById,
  groupsByDocument,
  maximumEvidenceGroupsPerCheck,
  maximumNavigationAnchors,
  maximumEvidenceGroupsPerAnchor,
}) {
  const query = queryFor(requirement, component);
  const lexical = rankLexicalCandidates({
    target: query,
    candidates: groupCandidates,
    index: groupIndex,
    topK: maximumEvidenceGroupsPerCheck,
    structural: true,
  });
  const semantic = rankLexicalCandidates({
    target: { ...query, queryTokens: semanticTokens(query.query) },
    candidates: semanticGroupCandidates,
    index: semanticGroupIndex,
    topK: maximumEvidenceGroupsPerCheck,
    structural: true,
  });
  const anchors = navigationAnchors({
    oracleRow,
    candidatesById,
    groupsByDocument,
    query,
    maximumNavigationAnchors,
    maximumEvidenceGroupsPerAnchor,
  });
  const ids = [];
  const seen = new Set();
  for (const { evidenceGroupId } of lexical)
    if (!seen.has(evidenceGroupId)) {
      seen.add(evidenceGroupId);
      ids.push(evidenceGroupId);
    }
  for (const { evidenceGroupId } of semantic)
    if (!seen.has(evidenceGroupId)) {
      seen.add(evidenceGroupId);
      ids.push(evidenceGroupId);
    }
  for (const anchor of anchors)
    for (const evidenceGroupId of anchor.evidenceGroupIds)
      if (!seen.has(evidenceGroupId)) {
        seen.add(evidenceGroupId);
        ids.push(evidenceGroupId);
      }
  const unavailableAnchors = anchors.filter(
    ({ evidenceGroupIds }) => evidenceGroupIds.length === 0
  );
  return {
    queryContract: {
      source: "A_SEMANTIC_MANIFEST_ONLY",
      normalizedQuerySha256: sha256(normalize(query.query)),
      queryTokenCount: new Set(tokens(query.query)).size,
    },
    retrievalChannels: [
      "FULL_CORPUS_LEXICAL_BM25",
      "GENERALIZED_GERMAN_SEMANTIC_BM25",
      "STRUCTURAL_BOUNDARY_EXPANSION",
      "ORACLE_RANGE_NAVIGATION_WITHOUT_PRIOR_LABELS",
    ],
    evidenceGroupIds: ids.filter((id) => groupsById.has(id)),
    navigationAnchors: anchors,
    evidenceReadiness:
      unavailableAnchors.length === 0 ? "READY" : "BLOCKED_BOUNDARY_UNPROVEN",
    blockedReasons: unavailableAnchors.map(
      ({ navigationAnchorId }) =>
        `NAVIGATION_ANCHOR_WITHOUT_COMPLETE_BOUNDARY:${navigationAnchorId}`
    ),
    corpusSearch: {
      searchedEvidenceGroups: groupCandidates.length,
      positiveEvidenceGroups: ids.length,
      globalAbsenceCertified: false,
    },
    combinationPolicy:
      "MULTI_SOURCE_ALLOWED; REVIEWER_MAY_SELECT_MULTIPLE_COMPLETE_GROUPS_AS_ALL_OF_OR_ANY_OF",
  };
}

function buildLfKnownFixtureBlindEvidencePacket({
  semanticManifest,
  oracle,
  bDocuments,
  maximumEvidenceGroupsPerCheck = 12,
  maximumNavigationAnchors = 6,
  maximumEvidenceGroupsPerAnchor = 3,
  maximumEvidenceGroupCharacters = 12_000,
  createdAt = new Date().toISOString(),
} = {}) {
  if (
    !semanticManifest ||
    !Array.isArray(semanticManifest.requirements) ||
    !semanticManifest.requirements.length ||
    !Array.isArray(oracle?.rows) ||
    !Array.isArray(oracle?.benchmarkCandidates) ||
    !Array.isArray(oracle?.documents) ||
    !Array.isArray(bDocuments) ||
    bDocuments.length !== 9 ||
    !Number.isInteger(maximumEvidenceGroupsPerCheck) ||
    maximumEvidenceGroupsPerCheck < 1 ||
    !Number.isInteger(maximumNavigationAnchors) ||
    maximumNavigationAnchors < 0 ||
    !Number.isInteger(maximumEvidenceGroupsPerAnchor) ||
    maximumEvidenceGroupsPerAnchor < 1
  )
    blindError("LF_BLIND_EVIDENCE_INPUT_INVALID");
  const oracleBDocuments = oracle.documents.filter(({ side }) => side === "B");
  if (oracleBDocuments.length !== 9)
    blindError("LF_BLIND_EVIDENCE_B_DOCUMENT_COUNT_INVALID");
  const oracleDocumentByUuid = new Map(
    oracleBDocuments.map((document) => [document.uuid, document])
  );
  const artifactsByUuid = new Map();
  for (const { document, artifact } of bDocuments) {
    const expected = oracleDocumentByUuid.get(document?.uuid);
    if (
      !expected ||
      document.position < 0 ||
      document.sha256 !== expected.fingerprint ||
      artifact?.fingerprint !== expected.fingerprint ||
      artifact?.document?.sourceDocumentId !== expected.fingerprint ||
      artifact?.document?.pdfExtraction?.complete !== true
    )
      blindError("LF_BLIND_EVIDENCE_B_DOCUMENT_INVALID", document?.uuid);
    artifactsByUuid.set(document.uuid, artifact);
  }
  for (const candidate of oracle.benchmarkCandidates) {
    const oracleDocument = oracleDocumentByUuid.get(
      candidate?.range?.documentUuid
    );
    if (!oracleDocument) continue;
    validateNavigationRange(
      candidate,
      oracleDocument,
      artifactsByUuid.get(oracleDocument.uuid)
    );
  }
  const boundaryPlan = buildSourceEvidenceBoundaryPlan({
    documents: bDocuments,
    maximumEvidenceGroupCharacters,
  });
  const groupsById = new Map(
    boundaryPlan.evidenceGroups.map((group) => [group.evidenceGroupId, group])
  );
  const groupsByDocument = new Map();
  for (const group of boundaryPlan.evidenceGroups) {
    if (!groupsByDocument.has(group.document.uuid))
      groupsByDocument.set(group.document.uuid, []);
    groupsByDocument.get(group.document.uuid).push(group);
  }
  const groupCandidates = boundaryPlan.evidenceGroups.map(groupCandidate);
  const groupIndex = bm25Index(groupCandidates);
  const semanticGroupCandidates = boundaryPlan.evidenceGroups.map((group) => ({
    ...groupCandidate(group),
    tokenList: semanticTokens(group.exactText),
  }));
  const semanticGroupIndex = bm25Index(semanticGroupCandidates);
  const oracleRows = new Map(
    oracle.rows.map((row) => [row.requirementId, row])
  );
  const candidatesById = new Map(
    oracle.benchmarkCandidates.map((candidate) => [
      candidate.candidateId,
      {
        candidateId: candidate.candidateId,
        candidateKind: candidate.candidateKind,
        range: candidate.range,
      },
    ])
  );
  const rows = semanticManifest.requirements.map((rawRequirement) => {
    const requirement = referenceRequirement(rawRequirement);
    const oracleRow = oracleRows.get(requirement.requirementId);
    if (!oracleRow)
      blindError(
        "LF_BLIND_EVIDENCE_ORACLE_ROW_MISSING",
        requirement.requirementId
      );
    const rowContext = retrieveEvidence({
      requirement,
      component: null,
      groupCandidates,
      groupIndex,
      semanticGroupCandidates,
      semanticGroupIndex,
      groupsById,
      oracleRow,
      candidatesById,
      groupsByDocument,
      maximumEvidenceGroupsPerCheck,
      maximumNavigationAnchors,
      maximumEvidenceGroupsPerAnchor,
    });
    const components = requirement.components.map((component) => ({
      ...component,
      evidence: retrieveEvidence({
        requirement,
        component,
        groupCandidates,
        groupIndex,
        semanticGroupCandidates,
        semanticGroupIndex,
        groupsById,
        oracleRow,
        candidatesById,
        groupsByDocument,
        maximumEvidenceGroupsPerCheck,
        maximumNavigationAnchors,
        maximumEvidenceGroupsPerAnchor,
      }),
    }));
    const evidenceReadiness = [
      rowContext,
      ...components.map(({ evidence }) => evidence),
    ].every(({ evidenceReadiness: status }) => status === "READY")
      ? "READY"
      : "BLOCKED";
    return {
      analysisRowId: oracleRow.analysisRowId,
      ...requirement,
      searchedDocuments: oracleBDocuments.map(
        ({ uuid, fingerprint, originalName, role, documentStatus }) => ({
          uuid,
          fingerprint,
          originalName,
          role,
          documentStatus,
        })
      ),
      rowContextEvidence: rowContext,
      components,
      evidenceReadiness,
      absenceCertified: false,
    };
  });
  const allowedOracleProjection = {
    oracleId: oracle.oracleId,
    documents: oracleBDocuments.map(
      ({ uuid, fingerprint, artifactSha256, pageMapSha256 }) => ({
        uuid,
        fingerprint,
        artifactSha256,
        pageMapSha256,
      })
    ),
    rows: oracle.rows.map(
      ({ analysisRowId, requirementId, benchmarkCandidateIds }) => ({
        analysisRowId,
        requirementId,
        benchmarkCandidateIds,
      })
    ),
    benchmarkCandidates: oracle.benchmarkCandidates.map(
      ({ candidateId, candidateKind, range }) => ({
        candidateId,
        candidateKind,
        range,
      })
    ),
  };
  const payload = {
    schemaVersion: 2,
    contractId: BLIND_EVIDENCE_PACKET_CONTRACT_ID,
    status: rows.every(({ evidenceReadiness }) => evidenceReadiness === "READY")
      ? "READY_FOR_BLIND_SOURCE_REVIEW"
      : "BLOCKED_EVIDENCE_INCOMPLETE",
    qaOnly: true,
    productionRule: false,
    createdAt,
    authority:
      "SEMANTIC_A_MANIFEST_AND_HASH_BOUND_ORIGINAL_B_SOURCES_ONLY; NO_PRIOR_DECISION_LABELS",
    blindness: {
      status: "CONFIRMED_BY_ALLOWLIST_PROJECTION",
      requiredReviewerModel: "gpt-5.6-sol",
      requiredReasoningEffort: "high",
      excludedInputs: [
        "GOLD_DECISIONS",
        "CLAUDE_DECISIONS_AND_QUOTES",
        "QWEN_DECISIONS",
        "SYSTEM_B_DECISIONS_AND_LABELS",
        "RELATION_LABELS",
      ],
    },
    bindings: {
      semanticManifestSha256: semanticManifest.manifestSha256,
      allowedOracleProjectionSha256: sha256(
        stableStringify(allowedOracleProjection)
      ),
      boundaryPlanSha256: boundaryPlan.boundaryPlanSha256,
    },
    evidencePolicy: {
      characterClippingAllowed: false,
      selectionUnit: "COMPLETE_EVIDENCE_GROUP",
      promptBudgetPolicy:
        "PARTITION_COMPLETE_GROUPS_OR_FAIL_CLOSED; NEVER_TRUNCATE_SOURCE_TEXT",
      negativeDecisionScope:
        "NO_COUNTERPART_ESTABLISHED_IS_NOT_GLOBAL_ABSENCE_UNLESS_SEPARATELY_CERTIFIED",
      multiSourceSelectionAllowed: true,
    },
    sourceCatalog: boundaryPlan,
    rows,
    summary: {
      rows: rows.length,
      components: rows.reduce((sum, row) => sum + row.components.length, 0),
      searchedDocumentsPerRow: oracleBDocuments.length,
      evidenceGroups: boundaryPlan.summary.evidenceGroups,
      evidenceSpans: boundaryPlan.summary.evidenceSpans,
      readyRows: rows.filter(
        ({ evidenceReadiness }) => evidenceReadiness === "READY"
      ).length,
      blockedRows: rows.filter(
        ({ evidenceReadiness }) => evidenceReadiness !== "READY"
      ).length,
      absenceCertifiedRows: 0,
    },
  };
  return {
    ...payload,
    packetSha256: sha256(
      `${BLIND_EVIDENCE_PACKET_CONTRACT_ID}\u0000${stableStringify(payload)}`
    ),
  };
}

function buildBlindEvidenceRowInputs(
  packet,
  requirementId,
  { maximumPartitionCharacters = 80_000 } = {}
) {
  if (packet?.contractId !== BLIND_EVIDENCE_PACKET_CONTRACT_ID)
    blindError("LF_BLIND_EVIDENCE_PACKET_INVALID");
  const row = packet.rows.find(
    (candidate) => candidate.requirementId === requirementId
  );
  if (!row) blindError("LF_BLIND_EVIDENCE_ROW_MISSING", requirementId);
  if (row.evidenceReadiness !== "READY")
    blindError("LF_BLIND_EVIDENCE_ROW_NOT_READY", requirementId);
  const groupIds = new Set([
    ...row.rowContextEvidence.evidenceGroupIds,
    ...row.components.flatMap(({ evidence }) => evidence.evidenceGroupIds),
  ]);
  const groups = packet.sourceCatalog.evidenceGroups.filter(
    ({ evidenceGroupId }) => groupIds.has(evidenceGroupId)
  );
  if (groups.length !== groupIds.size)
    blindError("LF_BLIND_EVIDENCE_CATALOG_BINDING_INVALID", requirementId);
  const partitions = groups.length
    ? partitionCompleteEvidenceGroups(groups, maximumPartitionCharacters)
    : [[]];
  return partitions.map((evidenceGroups, partitionIndex) => {
    const payload = {
      schemaVersion: 2,
      contractId: BLIND_EVIDENCE_ROW_INPUT_CONTRACT_ID,
      packetSha256: packet.packetSha256,
      requirementId,
      partitionIndex,
      partitionCount: partitions.length,
      blind: true,
      referenceA: {
        category: row.category,
        subcategory: row.subcategory,
        displayLabel: row.displayLabel,
        sourceSpans: row.referenceA.sourceSpans,
        values: row.referenceA.values,
        components: row.components.map(
          ({
            componentId,
            label,
            aliases,
            factRole,
            dimension,
            sourceSpanIds,
            evidence,
          }) => ({
            componentId,
            label,
            aliases,
            factRole,
            dimension,
            sourceSpanIds,
            availableEvidenceGroupIds: evidence.evidenceGroupIds,
            combinationPolicy: evidence.combinationPolicy,
          })
        ),
      },
      searchedDocuments: row.searchedDocuments,
      evidenceGroups,
      decisionRule:
        "GEFUNDEN when B contains a source-bound counterpart to the same fachliche element; differing values, limits, conditions, scope, or an explicit exclusion remain counterpart differences; keyword-only or remotely related passages do not count.",
    };
    return {
      ...payload,
      rowInputSha256: sha256(
        `${BLIND_EVIDENCE_ROW_INPUT_CONTRACT_ID}\u0000${stableStringify(payload)}`
      ),
    };
  });
}

module.exports = {
  BLIND_EVIDENCE_PACKET_CONTRACT_ID,
  BLIND_EVIDENCE_ROW_INPUT_CONTRACT_ID,
  buildBlindEvidenceRowInputs,
  buildLfKnownFixtureBlindEvidencePacket,
};

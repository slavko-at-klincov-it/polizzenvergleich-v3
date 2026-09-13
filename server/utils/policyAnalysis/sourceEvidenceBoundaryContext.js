const crypto = require("crypto");
const { buildADrivenSourceUnitPlan } = require("./aDrivenSourceUnitPlan");

const SOURCE_EVIDENCE_BOUNDARY_PLAN_CONTRACT_ID =
  "SOURCE_EVIDENCE_BOUNDARY_PLAN_V1";
const DEFAULT_MAXIMUM_EVIDENCE_GROUP_CHARACTERS = 12_000;

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

function evidenceError(code, detail = "") {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  throw error;
}

function sourceSpan(document, block, role) {
  const payload = {
    documentUuid: document.uuid,
    documentFingerprint: document.sha256,
    documentName: document.originalName || document.name || null,
    documentRole: document.role || "OTHER",
    documentStatus: document.documentStatus || "ACTIVE",
    physicalPageNumber: block.physicalPageNumber,
    documentStart: block.documentStart,
    documentEnd: block.documentEnd,
    exactText: block.exactText,
    exactTextSha256: block.exactTextSha256,
    structuralKind: block.structuralKind,
    evidenceRole: role,
  };
  return {
    ...payload,
    evidenceSpanId: `BES-${sha256(
      `${SOURCE_EVIDENCE_BOUNDARY_PLAN_CONTRACT_ID}\u0000${stableStringify(
        payload
      )}`
    ).slice(0, 32)}`,
  };
}

function appendBlocks(target, seen, document, blocks, role) {
  for (const block of blocks || []) {
    const key = `${document.uuid}:${block.blockId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    target.push(sourceSpan(document, block, role));
  }
}

function evidenceGroup({
  unit,
  document,
  headingUnit,
  bodyBlocks = unit.source.blocks,
  additionalGovernorBlocks = [],
  groupDiscriminator = unit.unitId,
  maximumEvidenceGroupCharacters,
}) {
  const sourceSpans = [];
  const seen = new Set();
  if (headingUnit && unit.unitKind !== "HEADING")
    appendBlocks(
      sourceSpans,
      seen,
      document,
      headingUnit.source.blocks,
      "STRUCTURE_HEADING"
    );
  if (unit.governingContext)
    appendBlocks(
      sourceSpans,
      seen,
      document,
      unit.governingContext.blocks,
      "LIST_GOVERNOR"
    );
  appendBlocks(
    sourceSpans,
    seen,
    document,
    additionalGovernorBlocks,
    unit.unitKind === "TABLE" ? "TABLE_HEADER" : "LIST_GOVERNOR"
  );
  appendBlocks(
    sourceSpans,
    seen,
    document,
    bodyBlocks,
    unit.unitKind === "TABLE" ? "TABLE_BODY" : "DECISION_BODY"
  );
  const characterCount = sourceSpans.reduce(
    (sum, span) => sum + span.exactText.length,
    0
  );
  if (characterCount > maximumEvidenceGroupCharacters)
    evidenceError(
      "LF_BLIND_EVIDENCE_GROUP_TOO_LARGE",
      `${unit.unitId}:${characterCount}`
    );
  const payload = {
    boundaryKind: unit.unitKind,
    boundaryStatus: "PROVEN_BY_COMPLETE_SOURCE_UNIT",
    combinationOperator: "ALL_OF",
    structurePath: unit.structurePath,
    document: {
      uuid: document.uuid,
      fingerprint: document.sha256,
      originalName: document.originalName || document.name || null,
      role: document.role || "OTHER",
      documentStatus: document.documentStatus || "ACTIVE",
    },
    sourceSpans,
    characterCount,
  };
  return {
    ...payload,
    evidenceGroupId: `BEG-${sha256(
      `${SOURCE_EVIDENCE_BOUNDARY_PLAN_CONTRACT_ID}\u0000${groupDiscriminator}\u0000${stableStringify(
        payload
      )}`
    ).slice(0, 32)}`,
    sourceUnitId: unit.unitId,
    exactText: sourceSpans.map(({ exactText }) => exactText).join("\n"),
    exactTextSha256: sha256(
      sourceSpans.map(({ exactText }) => exactText).join("\n")
    ),
  };
}

function looksLikeOpenGovernor(blocks) {
  const text = blocks
    .map(({ exactText }) => exactText)
    .join(" ")
    .trim();
  return (
    /:$/u.test(text) ||
    /\b(?:an|auf|aus|bei|bis|durch|für|fuer|gegen|in|mit|nach|ohne|sowie|über|ueber|um|unter|von|vor|zu|zum|zur)$/iu.test(
      text
    )
  );
}

function unitEvidenceGroups({
  unit,
  document,
  headingUnit,
  maximumEvidenceGroupCharacters,
}) {
  if (unit.unitKind === "LIST" && unit.logicalSourceSegments.length > 1) {
    const blocksById = new Map(
      unit.source.blocks.map((block) => [block.blockId, block])
    );
    const groups = [];
    let internalGovernors = [];
    for (const [index, segment] of unit.logicalSourceSegments.entries()) {
      const bodyBlocks = segment.blockIds.map((blockId) =>
        blocksById.get(blockId)
      );
      if (bodyBlocks.some((block) => !block))
        evidenceError("LF_BLIND_EVIDENCE_LIST_SEGMENT_INVALID", unit.unitId);
      if (looksLikeOpenGovernor(bodyBlocks)) {
        internalGovernors = [...internalGovernors, ...bodyBlocks];
        continue;
      }
      groups.push(
        evidenceGroup({
          unit,
          document,
          headingUnit,
          bodyBlocks,
          additionalGovernorBlocks: internalGovernors,
          groupDiscriminator: `${unit.unitId}:LIST_SEGMENT:${index}`,
          maximumEvidenceGroupCharacters,
        })
      );
    }
    if (groups.length) return groups;
  }
  if (unit.unitKind === "TABLE" && unit.source.blocks.length > 1) {
    const [header, ...rows] = unit.source.blocks;
    return rows.map((row, index) =>
      evidenceGroup({
        unit,
        document,
        headingUnit,
        bodyBlocks: [row],
        additionalGovernorBlocks: [header],
        groupDiscriminator: `${unit.unitId}:TABLE_ROW:${index}`,
        maximumEvidenceGroupCharacters,
      })
    );
  }
  return [
    evidenceGroup({
      unit,
      document,
      headingUnit,
      maximumEvidenceGroupCharacters,
    }),
  ];
}

function buildSourceEvidenceBoundaryPlan({
  documents,
  maximumEvidenceGroupCharacters = DEFAULT_MAXIMUM_EVIDENCE_GROUP_CHARACTERS,
} = {}) {
  if (
    !Number.isInteger(maximumEvidenceGroupCharacters) ||
    maximumEvidenceGroupCharacters < 1
  )
    evidenceError("LF_BLIND_EVIDENCE_GROUP_BUDGET_INVALID");
  const sourcePlan = buildADrivenSourceUnitPlan({ documents });
  const documentsByUuid = new Map(
    documents.map(({ document }) => [document.uuid, document])
  );
  const headingByDocument = new Map();
  const groups = [];
  for (const unit of sourcePlan.units) {
    const document = documentsByUuid.get(unit.source.documentUuid);
    if (!document)
      evidenceError(
        "LF_BLIND_EVIDENCE_DOCUMENT_BINDING_MISSING",
        unit.source.documentUuid
      );
    if (unit.unitKind === "METADATA") continue;
    if (unit.unitKind === "HEADING") {
      headingByDocument.set(document.uuid, unit);
      continue;
    }
    groups.push(
      ...unitEvidenceGroups({
        unit,
        document,
        headingUnit: headingByDocument.get(document.uuid) || null,
        maximumEvidenceGroupCharacters,
      })
    );
  }
  const payload = {
    schemaVersion: 1,
    contractId: SOURCE_EVIDENCE_BOUNDARY_PLAN_CONTRACT_ID,
    sourcePlanContractId: sourcePlan.contractId,
    sourcePlanSha256: sourcePlan.planSha256,
    boundaryPolicy: {
      characterClippingAllowed: false,
      completeSentenceClauseListTableRequired: true,
      listGovernorClosureRequired: true,
      crossPageContinuationRequired: true,
      multiSourceCombinationAllowed: true,
      oversizedGroupPolicy: "FAIL_CLOSED_WITHOUT_MODEL_CALL",
      maximumEvidenceGroupCharacters,
    },
    documents: sourcePlan.documents,
    evidenceGroups: groups,
    summary: {
      documents: sourcePlan.documents.length,
      sourceBlocks: sourcePlan.summary.sourceBlocks,
      sourceUnits: sourcePlan.summary.plannedUnits,
      evidenceGroups: groups.length,
      evidenceSpans: groups.reduce(
        (sum, group) => sum + group.sourceSpans.length,
        0
      ),
    },
  };
  return {
    ...payload,
    boundaryPlanSha256: sha256(
      `${SOURCE_EVIDENCE_BOUNDARY_PLAN_CONTRACT_ID}\u0000${stableStringify(
        payload
      )}`
    ),
  };
}

function partitionCompleteEvidenceGroups(
  evidenceGroups,
  maximumPartitionCharacters
) {
  if (
    !Array.isArray(evidenceGroups) ||
    !Number.isInteger(maximumPartitionCharacters) ||
    maximumPartitionCharacters < 1
  )
    evidenceError("LF_BLIND_EVIDENCE_PARTITION_INPUT_INVALID");
  const partitions = [];
  let current = [];
  let characters = 0;
  for (const group of evidenceGroups) {
    if (group.characterCount > maximumPartitionCharacters)
      evidenceError(
        "LF_BLIND_EVIDENCE_GROUP_TOO_LARGE",
        `${group.evidenceGroupId}:${group.characterCount}`
      );
    if (
      current.length &&
      characters + group.characterCount > maximumPartitionCharacters
    ) {
      partitions.push(current);
      current = [];
      characters = 0;
    }
    current.push(group);
    characters += group.characterCount;
  }
  if (current.length) partitions.push(current);
  return partitions;
}

module.exports = {
  DEFAULT_MAXIMUM_EVIDENCE_GROUP_CHARACTERS,
  SOURCE_EVIDENCE_BOUNDARY_PLAN_CONTRACT_ID,
  buildSourceEvidenceBoundaryPlan,
  partitionCompleteEvidenceGroups,
};

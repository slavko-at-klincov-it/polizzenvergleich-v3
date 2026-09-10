const crypto = require("crypto");
const {
  buildSourceBlockLedger,
  validateSourceBlockLedger,
} = require("./sourceBlockLedger");

// Plans bounded, source-owned units for LF_REFERENCE_A_DRIVEN_V2.
// Inputs: ordered A document descriptors plus extracted document artifacts.
// Output: a deterministic package plan; it has no semantic or row authority.
// Side effects: none. Failures are explicit contract errors.
const A_DRIVEN_RUN_CONTRACT_ID = "LF_REFERENCE_A_DRIVEN_V2";
const A_SOURCE_UNIT_PLAN_CONTRACT_ID = "LF_A_SOURCE_UNIT_PLAN_V5";

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

function contractError(code, detail) {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  return error;
}

function normalizeLine(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim();
}

function isTableLike(text) {
  return /\t/u.test(text);
}

function isListLike(text, structuralKind) {
  return (
    ["LIST_GOVERNOR", "LIST_ITEM"].includes(structuralKind) ||
    /^\s*(?:[-–—•▪]|\d+[.)]|[A-Z][.)])\s+\S/u.test(text)
  );
}

function isContinuation(previous, current) {
  if (!previous || !current) return false;
  if (
    [previous.structuralKind, current.structuralKind].some((kind) =>
      ["HEADING_CANDIDATE", "PAGE_FURNITURE"].includes(kind)
    ) ||
    previous.physicalPageNumber === current.physicalPageNumber
  )
    return false;
  const previousText = normalizeLine(previous.exactText);
  const currentText = normalizeLine(current.exactText);
  if (!previousText || !currentText) return false;
  if (/[.!?][”"')\]]?$/u.test(previousText)) return false;
  return true;
}

function mergeCrossPageContentGroups(groups) {
  const merged = groups.map((blocks) => [...blocks]);
  for (let index = 0; index < merged.length; index += 1) {
    if (unitKind(merged[index]) === "METADATA") continue;
    let previousIndex = index - 1;
    while (previousIndex >= 0 && unitKind(merged[previousIndex]) === "METADATA")
      previousIndex -= 1;
    if (previousIndex < 0) continue;
    const previous = merged[previousIndex];
    const current = merged[index];
    if (
      previous.length + current.length <= 12 &&
      isContinuation(previous.at(-1), current[0])
    ) {
      previous.push(...current);
      merged.splice(index, 1);
      index -= 1;
    }
  }
  return merged;
}

function unitKind(blocks) {
  if (blocks.every(({ structuralKind }) => structuralKind === "PAGE_FURNITURE"))
    return "METADATA";
  if (blocks.some(({ exactText }) => isTableLike(exactText))) return "TABLE";
  if (
    blocks.some(({ exactText, structuralKind }) =>
      isListLike(exactText, structuralKind)
    )
  )
    return "LIST";
  if (
    blocks.every(({ structuralKind }) => structuralKind === "HEADING_CANDIDATE")
  )
    return "HEADING";
  return "CLAUSE";
}

function isOpenListGovernor(unit) {
  const value = normalizeLine(unit?.source?.combinedText);
  if (!value || /[.!?][”"')\]]?$/u.test(value)) return false;
  return (
    /:$/u.test(value) ||
    /\b(?:an|auf|aus|bei|bis|durch|für|fuer|gegen|in|mit|nach|ohne|sowie|über|ueber|um|unter|von|vor|zu|zum|zur)$/iu.test(
      value
    )
  );
}

function governingContext(governors) {
  if (!governors.length) return null;
  const blocks = [];
  const seen = new Set();
  for (const governor of governors)
    for (const block of governor.source.blocks)
      if (!seen.has(block.blockId)) {
        seen.add(block.blockId);
        blocks.push(block);
      }
  const combinedText = blocks.map(({ exactText }) => exactText).join("\n");
  return {
    relationType: "GOVERNS_FOLLOWING_LIST",
    unitIds: governors.map(({ unitId }) => unitId),
    blockIds: blocks.map(({ blockId }) => blockId),
    blocks,
    combinedText,
    combinedTextSha256: sha256(combinedText),
  };
}

function shouldJoin(previous, current, artifact, currentBlocks) {
  if (!previous || previous.structuralKind === "PAGE_FURNITURE") return false;
  if (current.structuralKind === "PAGE_FURNITURE") return false;
  const gap = artifact.document.pageContent.slice(
    previous.documentEnd,
    current.documentStart
  );
  const previousText = normalizeLine(previous.exactText);
  if (current.structuralKind === "HEADING_CANDIDATE") {
    const adjacentIncompleteSentence =
      previous.structuralKind !== "HEADING_CANDIDATE" &&
      previous.physicalPageNumber === current.physicalPageNumber &&
      !/\n\s*\n/u.test(gap) &&
      !/[.;!?][”"')\]]?$/u.test(previousText) &&
      currentBlocks.length < 12;
    return adjacentIncompleteSentence;
  }
  if (previous.structuralKind === "HEADING_CANDIDATE") return false;
  const previousList = isListLike(previous.exactText, previous.structuralKind);
  const currentList = isListLike(current.exactText, current.structuralKind);
  if (currentBlocks.length >= 12) return false;
  if (previousList || currentList) {
    if (previousList && currentList) return true;
    if (previousList && !currentList) {
      return !/[.;!?][”"')\]]?$/u.test(previousText);
    }
    return false;
  }
  const previousTable = isTableLike(previous.exactText);
  const currentTable = isTableLike(current.exactText);
  if (previousTable || currentTable) return previousTable && currentTable;
  const currentText = normalizeLine(current.exactText);
  if (
    /[.!?][”"')\]]?$/u.test(previousText) &&
    /^[\p{Lu}\d„“"'(]/u.test(currentText)
  )
    return false;
  if (previous.physicalPageNumber !== current.physicalPageNumber)
    return isContinuation(previous, current);
  if (/\n\s*\n/u.test(gap)) return false;
  return true;
}

function planDocumentUnits({ document, artifact, ledger }) {
  validateSourceBlockLedger(ledger, artifact);
  if (
    !document ||
    typeof document.uuid !== "string" ||
    !document.uuid ||
    !Number.isInteger(document.position) ||
    document.position < 0 ||
    document.sha256 !== artifact.fingerprint
  )
    throw contractError("LF_A_SOURCE_DOCUMENT_INVALID");

  const groups = [];
  let current = [];
  const flush = () => {
    if (current.length) groups.push(current);
    current = [];
  };

  for (const block of ledger.blocks) {
    if (block.structuralKind === "PAGE_FURNITURE") {
      flush();
      groups.push([block]);
      continue;
    }
    if (block.structuralKind === "HEADING_CANDIDATE") {
      if (
        current.length &&
        shouldJoin(current[current.length - 1], block, artifact, current)
      )
        current.push(block);
      else {
        flush();
        groups.push([block]);
      }
      continue;
    }
    if (
      current.length &&
      !shouldJoin(current[current.length - 1], block, artifact, current)
    )
      flush();
    current.push(block);
  }
  flush();

  const contentMergedGroups = mergeCrossPageContentGroups(groups);
  let activeStructurePath = [];
  const baseUnits = contentMergedGroups.map((blocks, unitOrder) => {
    const kind = unitKind(blocks);
    if (kind === "HEADING")
      activeStructurePath = [normalizeLine(blocks[0].exactText)];
    const combinedText = blocks.map(({ exactText }) => exactText).join("\n");
    const source = {
      documentUuid: document.uuid,
      documentSha256: document.sha256,
      documentPosition: document.position,
      documentRole: document.role || "OTHER",
      documentStatus: document.documentStatus || "ACTIVE",
      blockIds: blocks.map(({ blockId }) => blockId),
      blocks: blocks.map(
        ({
          blockId,
          ordinal,
          structuralKind,
          physicalPageNumber,
          documentStart,
          documentEnd,
          exactText,
          exactTextSha256,
        }) => ({
          blockId,
          ordinal,
          structuralKind,
          physicalPageNumber,
          documentStart,
          documentEnd,
          exactText,
          exactTextSha256,
        })
      ),
      physicalPages: [
        ...new Set(blocks.map(({ physicalPageNumber }) => physicalPageNumber)),
      ],
      documentStart: blocks[0].documentStart,
      documentEnd: blocks[blocks.length - 1].documentEnd,
      combinedText,
      combinedTextSha256: sha256(combinedText),
      contiguous:
        artifact.document.pageContent.slice(
          blocks[0].documentStart,
          blocks[blocks.length - 1].documentEnd
        ) === combinedText,
    };
    const unitId = `AU-${sha256(
      stableStringify({
        contractId: A_SOURCE_UNIT_PLAN_CONTRACT_ID,
        documentPosition: document.position,
        documentSha256: document.sha256,
        blockIds: source.blockIds,
      })
    ).slice(0, 24)}`;
    return {
      unitId,
      unitOrder,
      packageOrder: [document.position, unitOrder],
      unitKind: kind,
      structurePath: [...activeStructurePath],
      source,
      semanticAuthority: false,
      initialDisposition:
        kind === "METADATA"
          ? "NON_OPERATIVE_TERMINAL"
          : "PENDING_CLASSIFICATION",
    };
  });
  const relations = [];
  let activeGovernors = [];
  const units = baseUnits.map((unit) => {
    if (unit.unitKind === "METADATA") return unit;
    if (["HEADING", "TABLE"].includes(unit.unitKind)) {
      activeGovernors = [];
      return unit;
    }
    const context =
      unit.unitKind === "LIST" ? governingContext(activeGovernors) : null;
    if (context)
      for (const governorUnitId of context.unitIds)
        relations.push({
          relationId: `AUR-${sha256(
            `${A_SOURCE_UNIT_PLAN_CONTRACT_ID}:${governorUnitId}:${unit.unitId}:GOVERNS_FOLLOWING_LIST`
          ).slice(0, 24)}`,
          type: "GOVERNS_FOLLOWING_LIST",
          fromUnitId: governorUnitId,
          toUnitId: unit.unitId,
        });
    if (unit.unitKind !== "LIST")
      activeGovernors = isOpenListGovernor(unit) ? [unit] : [];
    else if (isOpenListGovernor(unit))
      activeGovernors = [...activeGovernors, unit].slice(-3);
    return context ? { ...unit, governingContext: context } : unit;
  });
  const contentUnits = units.filter(
    ({ unitKind: kind }) => kind !== "METADATA"
  );
  for (const unit of contentUnits)
    for (let index = 1; index < unit.source.blocks.length; index += 1) {
      const previousBlock = unit.source.blocks[index - 1];
      const currentBlock = unit.source.blocks[index];
      if (!isContinuation(previousBlock, currentBlock)) continue;
      relations.push({
        relationId: `AUR-${sha256(
          `${A_SOURCE_UNIT_PLAN_CONTRACT_ID}:${unit.unitId}:${previousBlock.blockId}:${currentBlock.blockId}:CONTINUES_ON_NEXT_PAGE`
        ).slice(0, 24)}`,
        type: "CONTINUES_ON_NEXT_PAGE",
        fromUnitId: unit.unitId,
        toUnitId: unit.unitId,
        fromBlockId: previousBlock.blockId,
        toBlockId: currentBlock.blockId,
      });
    }
  for (let index = 1; index < contentUnits.length; index += 1) {
    const previous = contentUnits[index - 1];
    const currentUnit = contentUnits[index];
    if (
      [previous.unitKind, currentUnit.unitKind].some((kind) =>
        ["HEADING", "METADATA"].includes(kind)
      )
    )
      continue;
    const previousBlock = previous.source.blocks.at(-1);
    const currentBlock = currentUnit.source.blocks[0];
    if (
      previousBlock.physicalPageNumber !== currentBlock.physicalPageNumber &&
      isContinuation(previousBlock, currentBlock)
    )
      relations.push({
        relationId: `AUR-${sha256(
          `${A_SOURCE_UNIT_PLAN_CONTRACT_ID}:${previous.unitId}:${currentUnit.unitId}:CONTINUES_ON_NEXT_PAGE`
        ).slice(0, 24)}`,
        type: "CONTINUES_ON_NEXT_PAGE",
        fromUnitId: previous.unitId,
        toUnitId: currentUnit.unitId,
      });
  }
  return { units, relations };
}

function buildADrivenSourceUnitPlan({ documents } = {}) {
  if (!Array.isArray(documents) || documents.length === 0)
    throw contractError("LF_A_SOURCE_DOCUMENTS_REQUIRED");
  const positions = documents.map(({ document }) => document?.position);
  if (
    new Set(positions).size !== positions.length ||
    positions.some((position, index) => position !== index)
  )
    throw contractError("LF_A_SOURCE_DOCUMENT_ORDER_INVALID");

  const plannedDocuments = documents.map(({ document, artifact, ledger }) => {
    const resolvedLedger = ledger || buildSourceBlockLedger(artifact);
    const planned = planDocumentUnits({
      document,
      artifact,
      ledger: resolvedLedger,
    });
    return {
      document,
      artifact,
      ledger: resolvedLedger,
      ...planned,
    };
  });
  const units = plannedDocuments.flatMap(({ units }) => units);
  const relations = plannedDocuments.flatMap(({ relations }) => relations);
  const blockIds = plannedDocuments.flatMap(({ document, ledger }) =>
    ledger.blocks.map(({ blockId }) => `${document.uuid}:${blockId}`)
  );
  const plannedBlockIds = units.flatMap(({ source }) =>
    source.blockIds.map((blockId) => `${source.documentUuid}:${blockId}`)
  );
  if (
    blockIds.length !== plannedBlockIds.length ||
    new Set(plannedBlockIds).size !== plannedBlockIds.length ||
    blockIds.some((blockId) => !plannedBlockIds.includes(blockId))
  )
    throw contractError("LF_A_SOURCE_BLOCK_COVERAGE_INVALID");

  const payload = {
    schemaVersion: 1,
    contractId: A_SOURCE_UNIT_PLAN_CONTRACT_ID,
    runContractId: A_DRIVEN_RUN_CONTRACT_ID,
    documents: plannedDocuments.map(({ document, ledger, units: list }) => ({
      documentUuid: document.uuid,
      documentSha256: document.sha256,
      documentPosition: document.position,
      documentRole: document.role || "OTHER",
      documentStatus: document.documentStatus || "ACTIVE",
      sourceBlockLedgerSha256: ledger.ledgerSha256,
      unitIds: list.map(({ unitId }) => unitId),
    })),
    units,
    relations,
    summary: {
      documents: plannedDocuments.length,
      sourceBlocks: blockIds.length,
      plannedUnits: units.length,
      continuationRelations: relations.filter(
        ({ type }) => type === "CONTINUES_ON_NEXT_PAGE"
      ).length,
      governingRelations: relations.filter(
        ({ type }) => type === "GOVERNS_FOLLOWING_LIST"
      ).length,
      pendingUnits: units.filter(
        ({ initialDisposition }) =>
          initialDisposition === "PENDING_CLASSIFICATION"
      ).length,
      terminalNonOperativeUnits: units.filter(
        ({ initialDisposition }) =>
          initialDisposition === "NON_OPERATIVE_TERMINAL"
      ).length,
    },
  };
  return {
    ...payload,
    planSha256: sha256(
      `${A_SOURCE_UNIT_PLAN_CONTRACT_ID}\u0000${stableStringify(payload)}`
    ),
  };
}

module.exports = {
  A_DRIVEN_RUN_CONTRACT_ID,
  A_SOURCE_UNIT_PLAN_CONTRACT_ID,
  buildADrivenSourceUnitPlan,
  stableStringify,
};

const crypto = require("crypto");
const prisma = require("../utils/prisma");
const {
  MANAGED_EMBEDDING_ENV,
  EXPECTED_EMBEDDING_DIMENSIONS,
} = require("../../shared/managedEmbeddingContract.cjs");

const INVENTORY_STATUSES = ["building", "ready", "failed"];
const SUCCESSFUL_BLOCK_STATUSES = new Set([
  "deterministic_facts",
  "technical_non_content",
  "model_validated_facts",
  "model_verified_no_fact",
]);

function requiredText(value, field) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${field} is required.`);
  return text;
}

function optionalText(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function positiveInteger(value, field) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0)
    throw new Error(`${field} must be a positive integer.`);
  return number;
}

function nonNegativeInteger(value, field) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0)
    throw new Error(`${field} must be a non-negative integer.`);
  return number;
}

function optionalNonNegativeInteger(value, field) {
  if (value == null) return null;
  return nonNegativeInteger(value, field);
}

function sortableJson(value, seen = new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      throw new Error("Inventory JSON must be finite.");
    return value;
  }
  if (Array.isArray(value))
    return value.map((item) => sortableJson(item, seen));
  if (typeof value !== "object")
    throw new Error("Inventory JSON contains an unsupported value.");
  if (seen.has(value)) throw new Error("Inventory JSON must not be circular.");
  seen.add(value);
  const result = {};
  for (const key of Object.keys(value).sort()) {
    if (value[key] === undefined) continue;
    result[key] = sortableJson(value[key], seen);
  }
  seen.delete(value);
  return result;
}

function stableJson(value) {
  if (value == null) return null;
  return JSON.stringify(sortableJson(value));
}

function parseJson(value) {
  if (value == null) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function sourceHash(value) {
  const hash = requiredText(value, "sourceSha256").toLowerCase();
  if (!/^[a-f0-9]{64}$/u.test(hash))
    throw new Error("sourceSha256 must be a 64 character SHA-256 hash.");
  return hash;
}

function normalizeAliases(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error("aliases must be an array.");
  const aliases = new Map();
  for (const alias of value) {
    const text = requiredText(alias, "alias").replace(/\s+/gu, " ");
    const key = text.normalize("NFKC").toLocaleLowerCase("de-AT");
    if (!aliases.has(key)) aliases.set(key, text);
  }
  return [...aliases.values()];
}

function normalizeItem(item = {}) {
  const label = requiredText(item.label, "label");
  const aliasesJson = stableJson(normalizeAliases(item.aliases));
  const evidenceText = requiredText(item.evidenceText, "evidenceText");
  const evidenceHash = sha256(
    evidenceText.normalize("NFKC").replace(/\s+/gu, " ")
  );
  const evidenceStart = optionalNonNegativeInteger(
    item.evidenceStart,
    "evidenceStart"
  );
  const evidenceEnd = optionalNonNegativeInteger(
    item.evidenceEnd,
    "evidenceEnd"
  );
  if (
    (evidenceStart == null) !== (evidenceEnd == null) ||
    (evidenceStart != null && evidenceEnd <= evidenceStart)
  )
    throw new Error("Evidence offsets must be a positive half-open range.");
  const pageNumber =
    item.pageNumber == null
      ? null
      : positiveInteger(item.pageNumber, "pageNumber");
  const facetKey = optionalText(item.facetKey);
  const factType = optionalText(item.factType);
  const polarity = optionalText(item.polarity);
  const valueJson = stableJson(item.value);
  const conditionsJson = stableJson(item.conditions);
  const unit = optionalText(item.unit);
  const factKey =
    optionalText(item.factKey) ||
    sha256(
      [
        factType,
        facetKey,
        polarity,
        valueJson,
        unit,
        conditionsJson,
        pageNumber,
        evidenceStart,
        evidenceEnd,
        evidenceHash,
      ]
        .map((value) => value ?? "")
        .join("\u0000")
    );
  const confidence = item.confidence == null ? null : Number(item.confidence);
  if (
    confidence != null &&
    (!Number.isFinite(confidence) || confidence < 0 || confidence > 1)
  )
    throw new Error("confidence must be between 0 and 1.");
  return {
    factKey,
    facetKey,
    label,
    aliasesJson,
    polarity,
    valueJson,
    unit,
    conditionsJson,
    pageNumber,
    evidenceText,
    evidenceHash,
    sourceMethod: optionalText(item.sourceMethod),
    confidence,
    unitKey: optionalText(item.unitKey || item.blockKey),
    factType,
    claimText: optionalText(item.claimText),
    evidenceStart,
    evidenceEnd,
    evidences: Array.isArray(item.evidences)
      ? item.evidences.map((evidence) => {
          const evidenceText = requiredText(
            evidence.evidenceText,
            "evidence.evidenceText"
          );
          const sourceStart = nonNegativeInteger(
            evidence.sourceStart,
            "evidence.sourceStart"
          );
          const sourceEnd = nonNegativeInteger(
            evidence.sourceEnd,
            "evidence.sourceEnd"
          );
          if (sourceEnd <= sourceStart)
            throw new Error(
              "Evidence offsets must be a positive half-open range."
            );
          return {
            blockKey: requiredText(
              evidence.blockKey || evidence.unitKey,
              "evidence.blockKey"
            ),
            pageNumber:
              evidence.pageNumber == null
                ? null
                : positiveInteger(evidence.pageNumber, "evidence.pageNumber"),
            sourceStart,
            sourceEnd,
            evidenceText,
            evidenceHash: sha256(
              evidenceText.normalize("NFKC").replace(/\s+/gu, " ")
            ),
          };
        })
      : [],
  };
}

function serializeItem(item = {}) {
  return {
    id: item.id ?? null,
    factKey: item.factKey,
    facetKey: item.facetKey ?? null,
    label: item.label,
    aliases: parseJson(item.aliasesJson) || [],
    polarity: item.polarity ?? null,
    value: parseJson(item.valueJson),
    unit: item.unit ?? null,
    conditions: parseJson(item.conditionsJson),
    pageNumber: item.pageNumber ?? null,
    evidenceText: item.evidenceText,
    evidenceHash: item.evidenceHash,
    sourceMethod: item.sourceMethod ?? null,
    confidence: item.confidence ?? null,
    unitKey: item.unitKey ?? null,
    factType: item.factType ?? null,
    claimText: item.claimText ?? null,
    evidenceStart: item.evidenceStart ?? null,
    evidenceEnd: item.evidenceEnd ?? null,
    evidences: Array.isArray(item.evidences)
      ? item.evidences.map((evidence) => ({
          blockId: evidence.blockId,
          pageNumber: evidence.pageNumber ?? null,
          sourceStart: evidence.sourceStart,
          sourceEnd: evidence.sourceEnd,
          evidenceText: evidence.evidenceText,
          evidenceHash: evidence.evidenceHash,
        }))
      : [],
  };
}

function serializeBlockContext(block = {}) {
  return {
    id: block.id ?? null,
    blockKey: block.blockKey ?? null,
    ordinal: block.ordinal ?? null,
    pageNumber: block.pageNumber ?? null,
    printedPageLabel: block.printedPageLabel ?? null,
    sourceStart: block.sourceStart ?? null,
    sourceEnd: block.sourceEnd ?? null,
    structureKind: block.structureKind ?? null,
    headingPath: parseJson(block.headingPathJson) || [],
  };
}

function serializeManifest(document = {}, run = null, items = [], blocks = []) {
  const blockContexts = blocks.map(serializeBlockContext);
  const blocksByKey = new Map(
    blockContexts.map((block) => [block.blockKey, block])
  );
  const blocksById = new Map(blockContexts.map((block) => [block.id, block]));
  return {
    comparisonDocumentId: document.id,
    analysisRunId: run?.id ?? null,
    status: document.inventoryStatus ?? null,
    version: run?.pipelineVersion ?? document.inventoryVersion ?? null,
    itemCount: run?.factCount ?? document.inventoryItemCount ?? 0,
    pageCount: run?.pageCount ?? document.inventoryPageCount ?? 0,
    sourceSha256: document.sourceSha256 ?? null,
    inventorySourceSha256:
      run?.sourceSha256 ?? document.inventorySourceSha256 ?? null,
    error: document.inventoryError ?? null,
    items: items.map((item) => {
      const serialized = serializeItem(item);
      return {
        ...serialized,
        sourceContext: blocksByKey.get(item.unitKey) || null,
        evidences: serialized.evidences.map((evidence) => ({
          ...evidence,
          sourceContext: blocksById.get(evidence.blockId) || null,
        })),
      };
    }),
    analysisBlocks: blockContexts,
    analysisCoverage:
      blocks.length > 0
        ? {
            unitCount: blocks.length,
            validatedUnitCount: blocks.filter((block) =>
              SUCCESSFUL_BLOCK_STATUSES.has(block.status)
            ).length,
          }
        : undefined,
  };
}

function normalizedBlock(unit, ordinal) {
  const blockKey = requiredText(unit.blockKey || unit.unitKey, "blockKey");
  const sourceStart = nonNegativeInteger(unit.sourceStart, "sourceStart");
  const sourceEnd = nonNegativeInteger(unit.sourceEnd, "sourceEnd");
  if (sourceEnd < sourceStart)
    throw new Error("Block source range is invalid.");
  const pageStart = nonNegativeInteger(unit.pageStart, "pageStart");
  const pageEnd = nonNegativeInteger(unit.pageEnd, "pageEnd");
  if (pageEnd < pageStart) throw new Error("Block page range is invalid.");
  return {
    blockKey,
    ordinal: nonNegativeInteger(unit.ordinal ?? ordinal, "ordinal"),
    pageNumber:
      unit.pageNumber == null
        ? null
        : positiveInteger(unit.pageNumber, "pageNumber"),
    printedPageLabel: optionalText(unit.printedPageLabel),
    pageStart,
    pageEnd,
    sourceStart,
    sourceEnd,
    textHash: requiredText(unit.textHash, "textHash"),
    text: String(unit.text ?? ""),
    sourceMethod: optionalText(unit.sourceMethod),
    structureKind: optionalText(unit.structureKind) || "unknown",
    headingPathJson: stableJson(unit.headingPath || []),
    layoutQuality: optionalText(unit.layoutQuality) || "text_only",
  };
}

async function publishedState(transaction, document) {
  if (!document?.publishedAnalysisRunId)
    return { run: null, items: [], blocks: [] };
  const run = await transaction.comparison_document_analysis_runs.findUnique({
    where: { id: document.publishedAnalysisRunId },
  });
  if (!run) return { run: null, items: [], blocks: [] };
  const [items, blocks] = await Promise.all([
    transaction.comparison_document_inventory_items.findMany({
      where: { analysisRunId: run.id },
      include: { evidences: { orderBy: [{ ordinal: "asc" }] } },
      orderBy: [{ pageNumber: "asc" }, { id: "asc" }],
    }),
    transaction.comparison_document_clause_blocks.findMany({
      where: { analysisRunId: run.id },
      select: {
        id: true,
        blockKey: true,
        ordinal: true,
        pageNumber: true,
        printedPageLabel: true,
        sourceStart: true,
        sourceEnd: true,
        structureKind: true,
        headingPathJson: true,
        status: true,
      },
      orderBy: [{ ordinal: "asc" }],
    }),
  ]);
  return { run, items, blocks };
}

const ComparisonDocumentInventory = {
  statuses: INVENTORY_STATUSES,
  successfulBlockStatuses: SUCCESSFUL_BLOCK_STATUSES,

  async get(comparisonDocumentId) {
    const id = positiveInteger(comparisonDocumentId, "comparisonDocumentId");
    const document = await prisma.comparison_documents.findUnique({
      where: { id },
    });
    if (!document) return null;
    if (!document.publishedAnalysisRunId) {
      const legacyItems =
        await prisma.comparison_document_inventory_items.findMany({
          where: { comparisonDocumentId: id, analysisRunId: null },
          orderBy: [{ pageNumber: "asc" }, { id: "asc" }],
        });
      return serializeManifest(document, null, legacyItems, []);
    }
    const state = await publishedState(prisma, document);
    return serializeManifest(document, state.run, state.items, state.blocks);
  },

  async analysisUnits(analysisRunId) {
    return prisma.comparison_document_clause_blocks.findMany({
      where: { analysisRunId: positiveInteger(analysisRunId, "analysisRunId") },
      orderBy: [{ ordinal: "asc" }, { id: "asc" }],
    });
  },

  async prepareAnalysis({
    comparisonDocumentId,
    version,
    sourceSha256,
    pageCount,
    units = [],
  }) {
    const id = positiveInteger(comparisonDocumentId, "comparisonDocumentId");
    const pipelineVersion = positiveInteger(version, "version");
    const hash = sourceHash(sourceSha256);
    const pages = positiveInteger(pageCount, "pageCount");
    if (!Array.isArray(units) || units.length === 0)
      throw new Error("At least one clause block is required.");
    const blocks = units.map(normalizedBlock);

    const run = await prisma.$transaction(async (transaction) => {
      const document = await transaction.comparison_documents.findUnique({
        where: { id },
      });
      if (!document) throw new Error("Comparison document was not found.");
      // A published run is immutable. Resume only the one active staged run;
      // otherwise create a fresh run even when source and pipeline version are
      // identical to the published snapshot.
      let current =
        await transaction.comparison_document_analysis_runs.findFirst({
          where: {
            comparisonDocumentId: id,
            pipelineVersion,
            sourceSha256: hash,
            status: { in: ["building", "retryable_failed"] },
            ...(document.publishedAnalysisRunId
              ? { id: { not: document.publishedAnalysisRunId } }
              : {}),
          },
          orderBy: [{ id: "desc" }],
        });
      if (!current) {
        current = await transaction.comparison_document_analysis_runs.create({
          data: {
            comparisonDocumentId: id,
            pipelineVersion,
            sourceSha256: hash,
            pageCount: pages,
            expectedBlockCount: blocks.length,
            status: "building",
          },
        });
      } else {
        current = await transaction.comparison_document_analysis_runs.update({
          where: { id: current.id },
          data: {
            pageCount: pages,
            expectedBlockCount: blocks.length,
            status: "building",
            error: null,
            lastUpdatedAt: new Date(),
          },
        });
      }
      // Prisma 5.3 exposes createMany for this SQLite model, but the query
      // engine cannot execute it. Run-scoped upserts retain existing block
      // checkpoints when an interrupted analysis is resumed.
      for (const block of blocks)
        await transaction.comparison_document_clause_blocks.upsert({
          where: {
            analysisRunId_blockKey: {
              analysisRunId: current.id,
              blockKey: block.blockKey,
            },
          },
          create: { analysisRunId: current.id, ...block },
          update: {},
        });
      const hasLegacyPublishedInventory =
        !document.publishedAnalysisRunId &&
        document.inventoryStatus === "ready" &&
        Number(document.inventoryItemCount) > 0;
      if (!document.publishedAnalysisRunId && !hasLegacyPublishedInventory)
        await transaction.comparison_documents.update({
          where: { id },
          data: {
            inventoryStatus: "building",
            inventoryVersion: pipelineVersion,
            inventoryPageCount: pages,
            inventorySourceSha256: hash,
            inventoryError: null,
            lastUpdatedAt: new Date(),
          },
        });
      return current;
    });
    return {
      analysisRunId: run.id,
      units: await this.analysisUnits(run.id),
    };
  },

  async markBlockAmbiguous({ analysisRunId, blockKey, reasonCode }) {
    const runId = positiveInteger(analysisRunId, "analysisRunId");
    const key = requiredText(blockKey, "blockKey");
    return prisma.comparison_document_clause_blocks.update({
      where: {
        analysisRunId_blockKey: { analysisRunId: runId, blockKey: key },
      },
      data: {
        status: "ambiguous_pending",
        reasonCode: requiredText(reasonCode, "reasonCode"),
        error: null,
        lastUpdatedAt: new Date(),
      },
    });
  },

  async persistBlockSignals({ analysisRunId, signalsByBlock = new Map() }) {
    const runId = positiveInteger(analysisRunId, "analysisRunId");
    const blocks = await prisma.comparison_document_clause_blocks.findMany({
      where: { analysisRunId: runId },
    });
    await prisma.$transaction(async (transaction) => {
      for (const block of blocks) {
        const signals = signalsByBlock.get(block.blockKey) || [];
        await transaction.comparison_document_block_signals.deleteMany({
          where: { blockId: block.id },
        });
        if (signals.length)
          for (const signal of signals)
            await transaction.comparison_document_block_signals.create({
              data: {
                analysisRunId: runId,
                blockId: block.id,
                signalKey: requiredText(signal.signalKey, "signalKey"),
                kind: requiredText(signal.kind, "signal kind"),
                normalizedValue: optionalText(signal.normalizedValue),
                valueJson: stableJson(signal.value),
                sourceStart: nonNegativeInteger(
                  signal.sourceStart,
                  "signal sourceStart"
                ),
                sourceEnd: nonNegativeInteger(
                  signal.sourceEnd,
                  "signal sourceEnd"
                ),
                evidenceText: requiredText(
                  signal.evidenceText,
                  "signal evidenceText"
                ),
                evidenceHash: requiredText(
                  signal.evidenceHash,
                  "signal evidenceHash"
                ),
                ruleVersion: positiveInteger(
                  signal.ruleVersion,
                  "signal ruleVersion"
                ),
              },
            });
      }
    });
    return blocks.length;
  },

  async completeAnalysisUnit({
    analysisRunId,
    unitKey,
    facts = [],
    reviewCount = 0,
    resultKind,
    noFactReason = null,
  }) {
    const runId = positiveInteger(analysisRunId, "analysisRunId");
    const blockKey = requiredText(unitKey, "blockKey");
    if (!Array.isArray(facts)) throw new Error("facts must be an array.");
    const normalizedFacts = facts.map(normalizeItem);
    const reviews = nonNegativeInteger(reviewCount, "reviewCount");
    const status =
      normalizedFacts.length > 0
        ? reviews > 0
          ? "model_validated_facts"
          : "deterministic_facts"
        : resultKind === "technical_non_content"
          ? "technical_non_content"
          : resultKind === "reviewed_no_fact" && reviews > 0
            ? "model_verified_no_fact"
            : null;
    if (!status)
      throw new Error(
        "A content block without deterministic facts must remain ambiguous until model review."
      );
    if (normalizedFacts.length === 0 && !noFactReason)
      throw new Error("A zero-fact terminal block requires a reason code.");

    await prisma.$transaction(async (transaction) => {
      const run =
        await transaction.comparison_document_analysis_runs.findUnique({
          where: { id: runId },
          select: { comparisonDocumentId: true },
        });
      if (!run) throw new Error("Analysis run was not found.");
      const block =
        await transaction.comparison_document_clause_blocks.findUnique({
          where: { analysisRunId_blockKey: { analysisRunId: runId, blockKey } },
        });
      if (!block)
        throw new Error("Clause block was not found in this analysis run.");
      for (const [index, fact] of normalizedFacts.entries()) {
        if (fact.unitKey && fact.unitKey !== blockKey)
          throw new Error("Fact blockKey does not match its analysis block.");
        if (
          fact.evidenceStart == null ||
          fact.evidenceEnd == null ||
          fact.evidenceStart < block.sourceStart ||
          fact.evidenceEnd > block.sourceEnd
        )
          throw new Error("Fact evidence is outside its analysis block.");
        const localStart = fact.evidenceStart - block.sourceStart;
        const localEnd = fact.evidenceEnd - block.sourceStart;
        if (block.text.slice(localStart, localEnd) !== fact.evidenceText)
          throw new Error(
            "Fact evidence does not match the persisted block text."
          );
        normalizedFacts[index] = { ...fact, unitKey: blockKey };
      }

      await transaction.comparison_document_inventory_items.deleteMany({
        where: { analysisRunId: runId, primaryBlockId: block.id },
      });
      for (const fact of normalizedFacts) {
        const { evidences: additionalEvidences, ...factData } = fact;
        const item =
          await transaction.comparison_document_inventory_items.create({
            data: {
              comparisonDocumentId: run.comparisonDocumentId,
              analysisRunId: runId,
              primaryBlockId: block.id,
              ...factData,
            },
          });
        const evidenceInputs = [
          {
            blockKey,
            block,
            pageNumber: fact.pageNumber,
            sourceStart: fact.evidenceStart,
            sourceEnd: fact.evidenceEnd,
            evidenceText: fact.evidenceText,
            evidenceHash: fact.evidenceHash,
          },
        ];
        for (const evidence of additionalEvidences) {
          const evidenceBlock =
            evidence.blockKey === blockKey
              ? block
              : await transaction.comparison_document_clause_blocks.findUnique({
                  where: {
                    analysisRunId_blockKey: {
                      analysisRunId: runId,
                      blockKey: evidence.blockKey,
                    },
                  },
                });
          if (!evidenceBlock)
            throw new Error("Fact evidence block was not found in this run.");
          const start = evidence.sourceStart - evidenceBlock.sourceStart;
          const end = evidence.sourceEnd - evidenceBlock.sourceStart;
          if (
            start < 0 ||
            end > evidenceBlock.text.length ||
            evidenceBlock.text.slice(start, end) !== evidence.evidenceText
          )
            throw new Error(
              "Additional fact evidence does not match its block."
            );
          evidenceInputs.push({ ...evidence, block: evidenceBlock });
        }
        const uniqueEvidences = [
          ...new Map(
            evidenceInputs.map((evidence) => [
              `${evidence.block.id}:${evidence.sourceStart}:${evidence.sourceEnd}`,
              evidence,
            ])
          ).values(),
        ];
        for (const [ordinal, evidence] of uniqueEvidences.entries())
          await transaction.comparison_document_fact_evidence.create({
            data: {
              analysisRunId: runId,
              inventoryItemId: item.id,
              blockId: evidence.block.id,
              ordinal,
              pageNumber: evidence.pageNumber,
              sourceStart: evidence.sourceStart,
              sourceEnd: evidence.sourceEnd,
              evidenceText: evidence.evidenceText,
              evidenceHash: evidence.evidenceHash,
            },
          });
      }
      await transaction.comparison_document_clause_blocks.update({
        where: { id: block.id },
        data: {
          status,
          reviewCount: reviews,
          factCount: normalizedFacts.length,
          reasonCode:
            normalizedFacts.length === 0
              ? requiredText(noFactReason, "noFactReason")
              : null,
          error: null,
          lastUpdatedAt: new Date(),
        },
      });
    });
    return true;
  },

  async finalizeAnalysis({
    analysisRunId,
    comparisonDocumentId,
    version,
    sourceSha256,
  }) {
    const runId = positiveInteger(analysisRunId, "analysisRunId");
    const documentId = positiveInteger(
      comparisonDocumentId,
      "comparisonDocumentId"
    );
    const pipelineVersion = positiveInteger(version, "version");
    const hash = sourceHash(sourceSha256);
    await prisma.$transaction(async (transaction) => {
      const run =
        await transaction.comparison_document_analysis_runs.findUnique({
          where: { id: runId },
        });
      if (
        !run ||
        run.comparisonDocumentId !== documentId ||
        run.pipelineVersion !== pipelineVersion ||
        run.sourceSha256 !== hash
      )
        throw new Error("Analysis run identity does not match the document.");
      const blocks =
        await transaction.comparison_document_clause_blocks.findMany({
          where: { analysisRunId: runId },
          orderBy: [{ ordinal: "asc" }],
        });
      if (
        blocks.length !== run.expectedBlockCount ||
        blocks.some((block) => !SUCCESSFUL_BLOCK_STATUSES.has(block.status))
      )
        throw new Error(
          "Analysis cannot be published before every primary block has a justified terminal status."
        );
      if (blocks.some((block) => block.ftsStatus !== "ready"))
        throw new Error(
          "Analysis cannot be published before every block is in FTS."
        );
      if (blocks.some((block) => block.embeddingStatus !== "ready"))
        throw new Error(
          "Analysis cannot be published before every block has a Dinghy embedding."
        );
      const ftsRows = await transaction.$queryRawUnsafe(
        `SELECT blockId FROM comparison_document_clause_blocks_fts
         WHERE analysisRunId = ?`,
        runId
      );
      const expectedBlockIds = new Set(blocks.map((block) => Number(block.id)));
      const ftsBlockIds = new Set(ftsRows.map((row) => Number(row.blockId)));
      if (
        ftsRows.length !== blocks.length ||
        ftsBlockIds.size !== expectedBlockIds.size ||
        [...expectedBlockIds].some((blockId) => !ftsBlockIds.has(blockId))
      )
        throw new Error(
          "Analysis cannot be published without exact run-scoped FTS coverage."
        );
      const embeddings =
        await transaction.comparison_document_block_embeddings.findMany({
          where: { analysisRunId: runId },
        });
      const embeddingsByBlock = new Map(
        embeddings.map((embedding) => [embedding.blockId, embedding])
      );
      if (
        embeddings.length !== blocks.length ||
        blocks.some((block) => {
          const embedding = embeddingsByBlock.get(block.id);
          return (
            !embedding ||
            embedding.status !== "ready" ||
            embedding.textHash !== block.textHash ||
            embedding.model !== MANAGED_EMBEDDING_ENV.EMBEDDING_MODEL_PREF ||
            embedding.dimensions !== EXPECTED_EMBEDDING_DIMENSIONS
          );
        })
      )
        throw new Error(
          "Analysis cannot be published without exact Dinghy ledger coverage."
        );
      const facts =
        await transaction.comparison_document_inventory_items.findMany({
          where: { analysisRunId: runId },
          include: { evidences: true },
        });
      const blocksById = new Map(blocks.map((block) => [block.id, block]));
      const factsByPrimaryBlock = new Map();
      for (const fact of facts) {
        const list = factsByPrimaryBlock.get(fact.primaryBlockId) || [];
        list.push(fact);
        factsByPrimaryBlock.set(fact.primaryBlockId, list);
      }
      for (const block of blocks) {
        const count = (factsByPrimaryBlock.get(block.id) || []).length;
        if (block.factCount !== count)
          throw new Error(
            "Analysis block fact counters do not match staged facts."
          );
        if (
          ["deterministic_facts", "model_validated_facts"].includes(
            block.status
          ) &&
          count === 0
        )
          throw new Error("A facts block cannot be published without facts.");
        if (
          ["technical_non_content", "model_verified_no_fact"].includes(
            block.status
          ) &&
          count !== 0
        )
          throw new Error("A no-fact block cannot publish staged facts.");
      }
      if (
        facts.some((fact) => {
          const primaryBlock = blocksById.get(fact.primaryBlockId);
          const primaryEvidence = fact.evidences?.find(
            (evidence) => evidence.ordinal === 0
          );
          if (
            fact.comparisonDocumentId !== documentId ||
            fact.analysisRunId !== runId ||
            !primaryBlock ||
            !fact.evidences?.length ||
            !primaryEvidence ||
            primaryEvidence.blockId !== fact.primaryBlockId ||
            fact.evidenceStart !== primaryEvidence.sourceStart ||
            fact.evidenceEnd !== primaryEvidence.sourceEnd ||
            fact.evidenceText !== primaryEvidence.evidenceText ||
            fact.evidenceHash !== primaryEvidence.evidenceHash ||
            fact.pageNumber !== primaryEvidence.pageNumber
          )
            return true;
          return fact.evidences.some((evidence) => {
            const evidenceBlock = blocksById.get(evidence.blockId);
            if (
              evidence.analysisRunId !== runId ||
              !evidenceBlock ||
              evidence.pageNumber !== evidenceBlock.pageNumber ||
              evidence.sourceStart < evidenceBlock.sourceStart ||
              evidence.sourceEnd > evidenceBlock.sourceEnd ||
              evidence.sourceEnd <= evidence.sourceStart
            )
              return true;
            const localStart = evidence.sourceStart - evidenceBlock.sourceStart;
            const localEnd = evidence.sourceEnd - evidenceBlock.sourceStart;
            return (
              evidenceBlock.text.slice(localStart, localEnd) !==
                evidence.evidenceText ||
              sha256(
                evidence.evidenceText.normalize("NFKC").replace(/\s+/gu, " ")
              ) !== evidence.evidenceHash
            );
          });
        })
      )
        throw new Error(
          "Every fact and evidence must belong to this analysis run."
        );
      const now = new Date();
      await transaction.comparison_document_analysis_runs.update({
        where: { id: runId },
        data: {
          status: "ready",
          terminalBlockCount: blocks.length,
          factCount: facts.length,
          error: null,
          completedAt: now,
          lastUpdatedAt: now,
        },
      });
      await transaction.comparison_documents.update({
        where: { id: documentId },
        data: {
          publishedAnalysisRunId: runId,
          inventoryStatus: "ready",
          inventoryVersion: pipelineVersion,
          inventoryItemCount: facts.length,
          inventoryPageCount: run.pageCount,
          inventorySourceSha256: hash,
          inventoryError: null,
          lastUpdatedAt: now,
        },
      });
    });
    return this.get(documentId);
  },

  async markAnalysisFailed({ analysisRunId, comparisonDocumentId, error }) {
    const runId = positiveInteger(analysisRunId, "analysisRunId");
    const documentId = positiveInteger(
      comparisonDocumentId,
      "comparisonDocumentId"
    );
    return prisma.$transaction(async (transaction) => {
      const run =
        await transaction.comparison_document_analysis_runs.findUnique({
          where: { id: runId },
          select: { comparisonDocumentId: true },
        });
      if (!run || run.comparisonDocumentId !== documentId)
        throw new Error(
          "Analysis run does not belong to this comparison document."
        );
      await transaction.comparison_document_analysis_runs.update({
        where: { id: runId },
        data: {
          status: "retryable_failed",
          error: requiredText(error, "error"),
          lastUpdatedAt: new Date(),
        },
      });
      const document = await transaction.comparison_documents.findUnique({
        where: { id: documentId },
      });
      const hasPublishedInventory =
        Boolean(document.publishedAnalysisRunId) ||
        (document.inventoryStatus === "ready" &&
          Number(document.inventoryItemCount) > 0);
      const data = hasPublishedInventory
        ? {
            inventoryError: requiredText(error, "error"),
            lastUpdatedAt: new Date(),
          }
        : {
            inventoryStatus: "failed",
            inventoryError: requiredText(error, "error"),
            lastUpdatedAt: new Date(),
          };
      await transaction.comparison_documents.update({
        where: { id: documentId },
        data,
      });
      return true;
    });
  },

  async interruptedRuns(comparisonDocumentId) {
    return prisma.comparison_document_analysis_runs.findMany({
      where: {
        comparisonDocumentId: positiveInteger(
          comparisonDocumentId,
          "comparisonDocumentId"
        ),
        status: "building",
      },
      orderBy: [{ id: "asc" }],
    });
  },

  async analysisArtifacts(comparisonDocumentId) {
    const id = positiveInteger(comparisonDocumentId, "comparisonDocumentId");
    const runs = await prisma.comparison_document_analysis_runs.findMany({
      where: { comparisonDocumentId: id },
      select: { id: true },
      orderBy: [{ id: "asc" }],
    });
    const runIds = runs.map((run) => run.id);
    const embeddings = runIds.length
      ? await prisma.comparison_document_block_embeddings.findMany({
          where: { analysisRunId: { in: runIds } },
          select: { vectorId: true },
        })
      : [];
    return {
      runIds,
      vectorIds: embeddings.map((embedding) => embedding.vectorId),
    };
  },

  async clear(comparisonDocumentId) {
    const id = positiveInteger(comparisonDocumentId, "comparisonDocumentId");
    await prisma.$transaction(async (transaction) => {
      const runIds = (
        await transaction.comparison_document_analysis_runs.findMany({
          where: { comparisonDocumentId: id },
          select: { id: true },
        })
      ).map((run) => run.id);
      await transaction.comparison_documents.update({
        where: { id },
        data: { publishedAnalysisRunId: null },
      });
      // The run graph contains both run-level cascades and fact-to-primary-
      // block references. Prisma 5.3/SQLite cannot delete that cyclic graph in
      // one parent cascade, so remove its run-scoped children explicitly.
      if (runIds.length) {
        const where = { analysisRunId: { in: runIds } };
        await transaction.comparison_document_fact_evidence.deleteMany({
          where,
        });
        await transaction.comparison_document_inventory_items.deleteMany({
          where,
        });
        await transaction.comparison_document_block_signals.deleteMany({
          where,
        });
        await transaction.comparison_document_block_embeddings.deleteMany({
          where,
        });
        await transaction.comparison_document_clause_blocks.deleteMany({
          where,
        });
        await transaction.comparison_document_analysis_runs.deleteMany({
          where: { id: { in: runIds } },
        });
      }
      await transaction.comparison_document_inventory_items.deleteMany({
        where: { comparisonDocumentId: id, analysisRunId: null },
      });
      await transaction.comparison_documents.update({
        where: { id },
        data: {
          inventoryStatus: null,
          inventoryVersion: null,
          inventoryItemCount: 0,
          inventoryPageCount: 0,
          inventorySourceSha256: null,
          inventoryError: null,
          lastUpdatedAt: new Date(),
        },
      });
    });
    return this.get(id);
  },

  normalizeItem,
  serializeItem,
};

module.exports = {
  ComparisonDocumentInventory,
  INVENTORY_STATUSES,
  SUCCESSFUL_BLOCK_STATUSES,
};

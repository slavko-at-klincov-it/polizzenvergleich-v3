const crypto = require("crypto");
const {
  ComparisonDocumentInventory,
} = require("../../models/comparisonDocumentInventory");
const {
  ComparisonClauseBlockBuilder,
} = require("./ComparisonAnalysisUnitBuilder");
const {
  ComparisonAmbiguousFactResolver,
  FACT_EXTRACTION_VERSION,
} = require("./ComparisonFactMapper");
const { ComparisonFactRiskSignals } = require("./ComparisonFactRiskSignals");
const {
  ComparisonDeterministicFactExtractor,
} = require("./ComparisonDeterministicFactExtractor");
const { ComparisonClauseBlockIndex } = require("./ComparisonClauseBlockIndex");
const {
  ComparisonClauseEmbeddingIndex,
} = require("./ComparisonClauseEmbeddingIndex");
const { FALLBACK_TOPICS } = require("./ComparisonTopicInventory");

const CURRENT_INVENTORY_VERSION = FACT_EXTRACTION_VERSION;
const rebuilds = new Map();
const ledgerBuilds = new Map();
const deletingDocuments = new Set();

class ComparisonInventoryError extends Error {
  constructor(message, code = "comparison_inventory_failed") {
    super(message);
    this.name = "ComparisonInventoryError";
    this.code = code;
  }
}

function normalize(value = "") {
  return String(value)
    .normalize("NFKC")
    .replace(/\u00ad/g, "")
    .replace(/([\p{L}\p{N}])-\s*\n\s*([\p{L}\p{N}])/gu, "$1$2")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("de-AT");
}

function stableId(value = "") {
  const slug = normalize(value)
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return (
    slug || crypto.createHash("sha256").update(String(value)).digest("hex")
  );
}

function uniqueStrings(values = []) {
  const result = [];
  const seen = new Set();
  for (const value of values) {
    const text = String(value || "")
      .replace(/\s+/g, " ")
      .trim();
    const key = normalize(text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }
  return result;
}

function documentSourceHash(documentData = {}) {
  return normalizedSourceHash(
    documentData?.pdfExtraction?.sourceSha256 ||
      documentData?.documentExtraction?.sourceSha256
  );
}

function extractionItems(extraction, documentData) {
  if (Array.isArray(extraction?.items)) return extraction.items;
  const items = [];
  for (const topic of extraction?.topics || []) {
    if (topic.origin === "fallback") continue;
    const occurrences = Array.isArray(topic.occurrences)
      ? topic.occurrences
      : topic.page && topic.evidence
        ? [{ page: topic.page, evidence: topic.evidence }]
        : [];
    for (const occurrence of occurrences) {
      items.push({
        factKey: crypto
          .createHash("sha256")
          .update(
            `${topic.id || stableId(topic.label)}\u0000${occurrence.page}\u0000${normalize(occurrence.evidence)}`
          )
          .digest("hex"),
        facetKey: topic.id || stableId(topic.label),
        label: topic.label,
        aliases: uniqueStrings(topic.aliases || topic.terms || []),
        pageNumber: occurrence.page,
        evidenceText: occurrence.evidence,
        sourceMethod: occurrence.sourceMethod || "native",
        confidence: occurrence.evidenceValidation === "exact" ? 1 : 0.9,
      });
    }
  }
  return items;
}

function normalizedSourceHash(value) {
  const hash = String(value || "")
    .trim()
    .toLowerCase();
  return /^[a-f0-9]{64}$/u.test(hash) ? hash : null;
}

function manifestCurrent(manifest, expectedSourceSha256 = null) {
  const expected = normalizedSourceHash(expectedSourceSha256);
  const source = normalizedSourceHash(manifest?.sourceSha256);
  const inventorySource = normalizedSourceHash(manifest?.inventorySourceSha256);
  return (
    manifest?.status === "ready" &&
    manifest.version === CURRENT_INVENTORY_VERSION &&
    manifest.itemCount === manifest.items.length &&
    manifest.analysisCoverage?.unitCount > 0 &&
    manifest.analysisCoverage.validatedUnitCount ===
      manifest.analysisCoverage.unitCount &&
    manifest.pageCount > 0 &&
    source != null &&
    inventorySource === source &&
    (!expected || source === expected)
  );
}

async function buildInventory({ comparisonDocument, documentData, Connector }) {
  if (!comparisonDocument?.id)
    throw new ComparisonInventoryError("Vergleichsdokument fehlt.");
  let analysisRunId = null;
  try {
    const ledger = await prepareDeterministicLedger({
      comparisonDocument,
      documentData,
      announceInventory: true,
      includeEmbeddings: true,
    });
    analysisRunId = ledger.analysisRunId;
    const { canonicalSource, deterministicResults, ambiguousUnits } = ledger;

    const extraction = await ComparisonAmbiguousFactResolver.extract({
      units: ambiguousUnits,
      Connector,
      analysisRunId,
      onUnitValidated: async (result) => {
        const deterministic = deterministicResults.get(result.unit.unitKey);
        const combined = [
          ...(deterministic?.facts || []),
          ...(result.facts || []),
        ];
        const facts = [
          ...new Map(combined.map((fact) => [fact.factKey, fact])).values(),
        ];
        await ComparisonDocumentInventory.completeAnalysisUnit({
          analysisRunId,
          comparisonDocumentId: comparisonDocument.id,
          unitKey: result.unit.unitKey,
          facts,
          reviewCount: result.reviewCount,
          resultKind: facts.length ? "facts" : result.resultKind,
          noFactReason: result.noFactReason,
        });
      },
    });
    const manifest = await ComparisonDocumentInventory.finalizeAnalysis({
      analysisRunId,
      comparisonDocumentId: comparisonDocument.id,
      version: CURRENT_INVENTORY_VERSION,
      sourceSha256: canonicalSource,
    });
    return { manifest, extraction };
  } catch (error) {
    // Validated unit checkpoints and the independent FTS/Lance basis index
    // survive. A retry resumes only units that did not validate.
    if (analysisRunId)
      await ComparisonDocumentInventory.markAnalysisFailed({
        analysisRunId,
        comparisonDocumentId: comparisonDocument.id,
        error: error.message,
      });
    throw new ComparisonInventoryError(
      `Das offene Klauselinventar für Dokument ${comparisonDocument.slot || "?"} konnte nicht erstellt werden: ${error.message}`
    );
  }
}

async function prepareDeterministicLedger({
  comparisonDocument,
  documentData,
  announceInventory = false,
  includeEmbeddings = true,
}) {
  const storedSource = normalizedSourceHash(comparisonDocument.sourceSha256);
  const canonicalSource = documentSourceHash(documentData);
  if (!canonicalSource)
    throw new Error("Canonical document source hash is missing or invalid.");
  if (storedSource && storedSource !== canonicalSource)
    throw new Error(
      "Canonical PDF source hash does not match the existing FTS/vector index."
    );
  const coverage = ComparisonClauseBlockBuilder.build({ documentData });
  const preparedUnits = coverage.units.map((unit) => ({
    ...unit,
    riskSignals: ComparisonFactRiskSignals.detect(unit.text, {
      sourceStart: unit.sourceStart,
    }),
  }));
  const deterministicResults = new Map(
    preparedUnits.map((unit) => [
      unit.blockKey,
      ComparisonDeterministicFactExtractor.extract(unit, unit.riskSignals),
    ])
  );
  const prepared = await ComparisonDocumentInventory.prepareAnalysis({
    comparisonDocumentId: comparisonDocument.id,
    version: CURRENT_INVENTORY_VERSION,
    sourceSha256: canonicalSource,
    pageCount: coverage.pageCount,
    units: preparedUnits,
    announceInventory,
  });
  const analysisRunId = prepared.analysisRunId;
  await ComparisonDocumentInventory.persistBlockSignals({
    analysisRunId,
    signalsByBlock: new Map(
      preparedUnits.map((unit) => [unit.blockKey, unit.riskSignals])
    ),
  });
  if (prepared.units.some((unit) => unit.ftsStatus !== "ready"))
    await ComparisonClauseBlockIndex.indexRun({
      analysisRunId,
      comparisonDocumentId: comparisonDocument.id,
    });
  if (
    includeEmbeddings &&
    prepared.units.some((unit) => unit.embeddingStatus !== "ready")
  )
    await ComparisonClauseEmbeddingIndex.indexRun({
      analysisRunId,
      comparisonDocument,
    });

  const successfulStatuses =
    ComparisonDocumentInventory.successfulBlockStatuses;
  const persistedByKey = new Map(
    prepared.units.map((unit) => [unit.blockKey, unit])
  );
  const pendingKeys = new Set(
    prepared.units
      .filter((unit) => !successfulStatuses.has(unit.status))
      .map((unit) => unit.blockKey)
  );
  const ambiguousUnits = [];
  for (const unit of preparedUnits.filter((item) =>
    pendingKeys.has(item.blockKey)
  )) {
    const deterministic = deterministicResults.get(unit.blockKey);
    if (!deterministic.requiresReview) {
      await ComparisonDocumentInventory.completeAnalysisUnit({
        analysisRunId,
        unitKey: unit.blockKey,
        facts: deterministic.facts,
        reviewCount: 0,
        resultKind:
          deterministic.terminalStatus === "technical_non_content"
            ? "technical_non_content"
            : "facts",
        noFactReason: deterministic.reasonCode,
      });
      continue;
    }
    await ComparisonDocumentInventory.markBlockAmbiguous({
      analysisRunId,
      blockKey: unit.blockKey,
      reasonCode: deterministic.reasonCode,
    });
    ambiguousUnits.push({
      ...unit,
      id: persistedByKey.get(unit.blockKey)?.id,
      unitKey: unit.blockKey,
    });
  }
  return {
    comparisonDocument,
    analysisRunId,
    canonicalSource,
    coverage,
    deterministicResults,
    ambiguousUnits,
    units: preparedUnits.map((unit) => ({
      ...unit,
      id: persistedByKey.get(unit.blockKey)?.id,
    })),
  };
}

function deterministicLedgerForDocument({ document, includeEmbeddings }) {
  if (deletingDocuments.has(document.id))
    throw new ComparisonInventoryError(
      "Das Vergleichsdokument wird gerade entfernt.",
      "comparison_inventory_document_deleting"
    );
  const existing = ledgerBuilds.get(document.id);
  if (existing) return existing;
  const operation = (async () => {
    const { fileData } = require("../files");
    const documentData = await fileData(document.docpath);
    if (!documentData)
      throw new ComparisonInventoryError(
        `Der gespeicherte Textbestand für Dokument ${document.slot} fehlt. Bitte dieses Dokument entfernen und erneut ablegen.`,
        "comparison_inventory_source_missing"
      );
    return prepareDeterministicLedger({
      comparisonDocument: document,
      documentData,
      announceInventory: false,
      includeEmbeddings,
    });
  })().finally(() => {
    if (ledgerBuilds.get(document.id) === operation)
      ledgerBuilds.delete(document.id);
  });
  ledgerBuilds.set(document.id, operation);
  return operation;
}

async function publishedDeterministicLedger(document, manifest) {
  const persistedUnits = await ComparisonDocumentInventory.analysisUnits(
    manifest.analysisRunId
  );
  const units = persistedUnits.map((unit) => {
    let headingPath = [];
    try {
      const parsed = JSON.parse(unit.headingPathJson || "[]");
      if (Array.isArray(parsed)) headingPath = parsed;
    } catch (_error) {
      headingPath = [];
    }
    return {
      ...unit,
      headingPath,
      riskSignals: ComparisonFactRiskSignals.detect(unit.text, {
        sourceStart: unit.sourceStart,
      }),
    };
  });
  return {
    comparisonDocument: document,
    analysisRunId: manifest.analysisRunId,
    canonicalSource: manifest.inventorySourceSha256,
    coverage: {
      pageCount: manifest.pageCount,
      unitCount: units.length,
    },
    units,
    deterministicResults: new Map(
      units.map((unit) => [
        unit.blockKey,
        ComparisonDeterministicFactExtractor.extract(unit, unit.riskSignals),
      ])
    ),
    ambiguousUnits: [],
  };
}

function rebuildForDocument({ document, Connector }) {
  if (deletingDocuments.has(document.id))
    throw new ComparisonInventoryError(
      "Das Vergleichsdokument wird gerade entfernt.",
      "comparison_inventory_document_deleting"
    );
  const existing = rebuilds.get(document.id);
  if (existing) return { operation: existing, started: false };

  const operation = (async () => {
    const { fileData } = require("../files");
    const documentData = await fileData(document.docpath);
    if (!documentData) {
      throw new ComparisonInventoryError(
        `Der gespeicherte Textbestand für Dokument ${document.slot} fehlt. Bitte dieses Dokument entfernen und erneut ablegen.`,
        "comparison_inventory_source_missing"
      );
    }
    return buildInventory({
      comparisonDocument: document,
      documentData,
      Connector,
    });
  })().finally(() => {
    if (rebuilds.get(document.id) === operation) rebuilds.delete(document.id);
  });
  rebuilds.set(document.id, operation);
  return { operation, started: true };
}

function fallbackTopic(topic) {
  return {
    id: topic.id,
    label: topic.label,
    terms: uniqueStrings(topic.terms || []),
    origins: [],
    anchors: [],
    origin: "fallback",
    score: -1,
  };
}

const ComparisonInventoryService = {
  version: CURRENT_INVENTORY_VERSION,
  manifestCurrent,

  fallbackTopics() {
    return FALLBACK_TOPICS.map(fallbackTopic);
  },

  buildForDocument: buildInventory,

  async ensureDeterministicLedgerForDocuments({
    documents = [],
    includeEmbeddings = true,
  }) {
    const ledgers = [];
    for (const document of documents) {
      const manifest = await ComparisonDocumentInventory.get(document.id);
      if (
        manifestCurrent(manifest, document.sourceSha256) &&
        manifest.analysisRunId
      ) {
        ledgers.push(await publishedDeterministicLedger(document, manifest));
        continue;
      }
      ledgers.push(
        await deterministicLedgerForDocument({ document, includeEmbeddings })
      );
    }
    return ledgers;
  },

  async readyForDocuments({ documents = [] }) {
    const inventories = [];
    for (const document of documents) {
      const manifest = await ComparisonDocumentInventory.get(document.id);
      if (!manifestCurrent(manifest, document.sourceSha256)) return null;
      inventories.push({ document, manifest });
    }
    return inventories;
  },

  async startForDocuments({ documents = [], Connector }) {
    const operations = [];
    let started = false;
    for (const document of documents) {
      const manifest = await ComparisonDocumentInventory.get(document.id);
      if (manifestCurrent(manifest, document.sourceSha256)) continue;
      const rebuild = rebuildForDocument({ document, Connector });
      operations.push(rebuild.operation);
      started = started || rebuild.started;
    }
    for (const operation of operations)
      void operation.catch((error) =>
        console.error(
          "[PolicyComparison] Optionale Tiefenanalyse fehlgeschlagen:",
          error.message
        )
      );
    return { started, pending: operations.length > 0 };
  },

  async reconcileInterrupted({ documents = [] }) {
    let changed = false;
    for (const document of documents) {
      if (rebuilds.has(document.id)) continue;
      const interrupted = await ComparisonDocumentInventory.interruptedRuns(
        document.id
      );
      for (const run of interrupted) {
        await ComparisonDocumentInventory.markAnalysisFailed({
          analysisRunId: run.id,
          comparisonDocumentId: document.id,
          error:
            "Die Tiefenanalyse wurde durch einen Serverneustart unterbrochen und kann fortgesetzt werden.",
        });
        changed = true;
      }
    }
    return changed;
  },

  async ensureForDocuments({ documents = [], Connector }) {
    const manifests = [];
    for (const document of documents) {
      let manifest = await ComparisonDocumentInventory.get(document.id);
      if (manifestCurrent(manifest, document.sourceSha256)) {
        manifests.push({ document, manifest });
        continue;
      }

      const { operation } = rebuildForDocument({ document, Connector });
      await operation;
      manifest = await ComparisonDocumentInventory.get(document.id);
      if (!manifestCurrent(manifest, document.sourceSha256))
        throw new ComparisonInventoryError(
          `Das Klauselinventar für Dokument ${document.slot} ist nicht vollständig. Bitte dieses Dokument entfernen und erneut ablegen.`
        );
      manifests.push({ document, manifest });
    }
    return manifests;
  },

  unionTopics(inventories = []) {
    const union = new Map();
    for (const { document, manifest } of inventories) {
      for (const item of manifest.items || []) {
        const id = item.facetKey || stableId(item.label);
        const previous = union.get(id) || {
          id,
          label: item.label,
          terms: [],
          origins: [],
          anchors: [],
          origin: "inventory",
          score: 1,
        };
        previous.terms = uniqueStrings([
          ...previous.terms,
          item.label,
          ...(item.aliases || []),
        ]);
        if (!previous.origins.includes(document.slot))
          previous.origins.push(document.slot);
        previous.anchors.push({
          slot: document.slot,
          pageNumber: item.pageNumber,
          evidenceHash: item.evidenceHash,
          evidenceText: item.evidenceText,
          docId: document.docId,
          title: document.originalFilename,
        });
        union.set(id, previous);
      }
    }

    // Additive recovery anchors only. They never suppress open model topics and
    // never prove that a clause exists in either document.
    for (const topic of FALLBACK_TOPICS) {
      const existing = union.get(topic.id);
      if (!existing) union.set(topic.id, fallbackTopic(topic));
      else existing.terms = uniqueStrings([...existing.terms, ...topic.terms]);
    }
    return [...union.values()].sort(
      (a, b) => b.score - a.score || a.label.localeCompare(b.label, "de")
    );
  },

  async clear(comparisonDocumentId) {
    const documentId = Number(comparisonDocumentId);
    deletingDocuments.add(documentId);
    try {
      // A provider call is not assumed cancellable. Wait for its real
      // settlement, then take a fresh artifact snapshot so no late vector or
      // FTS write can escape scoped cleanup.
      const active = rebuilds.get(documentId);
      if (active) await active.catch(() => null);
      const activeLedger = ledgerBuilds.get(documentId);
      if (activeLedger) await activeLedger.catch(() => null);
      const artifacts =
        await ComparisonDocumentInventory.analysisArtifacts(documentId);
      for (const runId of artifacts.runIds)
        await ComparisonClauseBlockIndex.removeRun(runId);
      await ComparisonClauseEmbeddingIndex.removeVectorIds(artifacts.vectorIds);
      return ComparisonDocumentInventory.clear(documentId);
    } finally {
      deletingDocuments.delete(documentId);
    }
  },
};

module.exports = {
  ComparisonInventoryService,
  ComparisonInventoryError,
  CURRENT_INVENTORY_VERSION,
};

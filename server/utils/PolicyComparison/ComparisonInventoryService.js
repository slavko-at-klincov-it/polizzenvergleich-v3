const crypto = require("crypto");
const {
  ComparisonDocumentInventory,
} = require("../../models/comparisonDocumentInventory");
const { PageAwareTextSplitter } = require("../PageAwareTextSplitter");
const {
  ComparisonInventoryExtractor,
  EXTRACTION_VERSION,
} = require("./ComparisonInventoryExtractor");
const { FALLBACK_TOPICS } = require("./ComparisonTopicInventory");

const CURRENT_INVENTORY_VERSION = EXTRACTION_VERSION;
const rebuilds = new Map();

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

function pageMethods(documentData = {}) {
  const pages = PageAwareTextSplitter.extractionPages(documentData) || [];
  return new Map(
    pages.map((page) => [page.pageNumber, page.extractionMethod || "native"])
  );
}

function documentSourceHash(documentData = {}) {
  return normalizedSourceHash(
    documentData?.pdfExtraction?.sourceSha256 ||
      documentData?.documentExtraction?.sourceSha256
  );
}

function extractionItems(extraction, documentData) {
  if (Array.isArray(extraction?.items)) return extraction.items;
  const methods = pageMethods(documentData);
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
        sourceMethod: methods.get(occurrence.page) || "native",
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
    manifest.itemCount > 0 &&
    manifest.itemCount === manifest.items.length &&
    manifest.pageCount > 0 &&
    source != null &&
    inventorySource === source &&
    (!expected || source === expected)
  );
}

async function buildInventory({ comparisonDocument, documentData, Connector }) {
  if (!comparisonDocument?.id)
    throw new ComparisonInventoryError("Vergleichsdokument fehlt.");
  const existing = await ComparisonDocumentInventory.get(comparisonDocument.id);
  try {
    const storedSource = normalizedSourceHash(comparisonDocument.sourceSha256);
    const canonicalSource = documentSourceHash(documentData);
    if (!canonicalSource)
      throw new Error("Canonical document source hash is missing or invalid.");
    if (storedSource && storedSource !== canonicalSource)
      throw new Error(
        "Canonical PDF source hash does not match the existing FTS/vector index."
      );
    await ComparisonDocumentInventory.markBuilding({
      comparisonDocumentId: comparisonDocument.id,
      version: CURRENT_INVENTORY_VERSION,
    });
    const extraction = await ComparisonInventoryExtractor.extract({
      documentData,
      Connector,
    });
    const items = extractionItems(extraction, documentData);
    const manifest = await ComparisonDocumentInventory.replace({
      comparisonDocumentId: comparisonDocument.id,
      version: CURRENT_INVENTORY_VERSION,
      pageCount: extraction.pageCount,
      sourceSha256: canonicalSource,
      items,
    });
    return { manifest, extraction };
  } catch (error) {
    // A failed regeneration must never destroy a previously usable inventory.
    await ComparisonDocumentInventory.markFailed({
      comparisonDocumentId: comparisonDocument.id,
      version: CURRENT_INVENTORY_VERSION,
      pageCount: existing?.pageCount || 0,
      error: error.message,
    });
    throw new ComparisonInventoryError(
      `Das offene Klauselinventar für Dokument ${comparisonDocument.slot || "?"} konnte nicht erstellt werden: ${error.message}`
    );
  }
}

function rebuildForDocument({ document, Connector }) {
  const existing = rebuilds.get(document.id);
  if (existing) return { operation: existing, started: false };

  const operation = (async () => {
    const { fileData } = require("../files");
    const documentData = await fileData(document.docpath);
    if (!documentData) {
      await ComparisonDocumentInventory.markFailed({
        comparisonDocumentId: document.id,
        version: CURRENT_INVENTORY_VERSION,
        pageCount: document.inventoryPageCount || 0,
        error: `Der gespeicherte Textbestand für Dokument ${document.slot} fehlt. Bitte dieses Dokument entfernen und erneut ablegen.`,
      });
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
      if (document.inventoryStatus !== "building" || rebuilds.has(document.id))
        continue;
      await ComparisonDocumentInventory.markFailed({
        comparisonDocumentId: document.id,
        version: CURRENT_INVENTORY_VERSION,
        pageCount: document.inventoryPageCount || 0,
        error:
          "Die Tiefenanalyse wurde durch einen Serverneustart unterbrochen und kann erneut gestartet werden.",
      });
      changed = true;
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
    return ComparisonDocumentInventory.clear(comparisonDocumentId);
  },
};

module.exports = {
  ComparisonInventoryService,
  ComparisonInventoryError,
  CURRENT_INVENTORY_VERSION,
};

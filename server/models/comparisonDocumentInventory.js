const crypto = require("crypto");
const prisma = require("../utils/prisma");

const INVENTORY_STATUSES = ["building", "ready", "failed"];

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
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalizedEvidence(value) {
  return requiredText(value, "evidenceText")
    .normalize("NFKC")
    .replace(/\s+/g, " ");
}

function normalizeAliases(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error("aliases must be an array.");
  const aliases = new Map();
  for (const alias of value) {
    const text = requiredText(alias, "alias").replace(/\s+/g, " ");
    const key = text.normalize("NFKC").toLocaleLowerCase("de-AT");
    if (!aliases.has(key)) aliases.set(key, text);
  }
  return [...aliases.values()];
}

function normalizeItem(item = {}) {
  const label = requiredText(item.label, "label");
  const aliasesJson = stableJson(normalizeAliases(item.aliases));
  const evidenceText = requiredText(item.evidenceText, "evidenceText");
  const evidenceHash = sha256(normalizedEvidence(evidenceText));
  const facetKey = optionalText(item.facetKey);
  const polarity = optionalText(item.polarity);
  const valueJson = stableJson(item.value);
  const unit = optionalText(item.unit);
  const conditionsJson = stableJson(item.conditions);
  const pageNumber =
    item.pageNumber == null
      ? null
      : positiveInteger(item.pageNumber, "pageNumber");
  const sourceMethod = optionalText(item.sourceMethod);
  const confidence = item.confidence == null ? null : Number(item.confidence);
  if (
    confidence != null &&
    (!Number.isFinite(confidence) || confidence < 0 || confidence > 1)
  )
    throw new Error("confidence must be between 0 and 1.");

  const factKey =
    optionalText(item.factKey) ||
    sha256(
      [
        facetKey,
        label,
        aliasesJson,
        polarity,
        valueJson,
        unit,
        conditionsJson,
        pageNumber,
        evidenceHash,
      ]
        .map((value) => value ?? "")
        .join("\u0000")
    );

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
    sourceMethod,
    confidence,
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
    pageNumber: item.pageNumber,
    evidenceText: item.evidenceText,
    evidenceHash: item.evidenceHash,
    sourceMethod: item.sourceMethod ?? null,
    confidence: item.confidence ?? null,
  };
}

function serializeManifest(document = {}, items = []) {
  return {
    comparisonDocumentId: document.id,
    status: document.inventoryStatus ?? null,
    version: document.inventoryVersion ?? null,
    itemCount: document.inventoryItemCount ?? 0,
    pageCount: document.inventoryPageCount ?? 0,
    sourceSha256: document.sourceSha256 ?? null,
    inventorySourceSha256: document.inventorySourceSha256 ?? null,
    error: document.inventoryError ?? null,
    items: items.map(serializeItem),
  };
}

function versionNumber(value) {
  return positiveInteger(value, "version");
}

function documentId(value) {
  return positiveInteger(value, "comparisonDocumentId");
}

const ComparisonDocumentInventory = {
  statuses: INVENTORY_STATUSES,

  get: async function (comparisonDocumentId) {
    const document = await prisma.comparison_documents.findUnique({
      where: { id: documentId(comparisonDocumentId) },
      include: {
        inventoryItems: {
          orderBy: [{ pageNumber: "asc" }, { id: "asc" }],
        },
      },
    });
    if (!document) return null;
    return serializeManifest(document, document.inventoryItems || []);
  },

  markBuilding: async function ({ comparisonDocumentId, version }) {
    const id = documentId(comparisonDocumentId);
    const inventoryVersion = versionNumber(version);
    const updated = await prisma.$transaction(async (transaction) => {
      const current = await transaction.comparison_documents.findUnique({
        where: { id },
      });
      if (current?.inventoryStatus === "ready") return current;
      await transaction.comparison_document_inventory_items.deleteMany({
        where: { comparisonDocumentId: id },
      });
      return transaction.comparison_documents.update({
        where: { id },
        data: {
          inventoryStatus: "building",
          inventoryVersion,
          inventoryItemCount: 0,
          inventoryPageCount: 0,
          inventorySourceSha256: null,
          inventoryError: null,
          lastUpdatedAt: new Date(),
        },
      });
    });
    return serializeManifest(updated);
  },

  replace: async function ({
    comparisonDocumentId,
    version,
    pageCount,
    sourceSha256,
    items = [],
  }) {
    const id = documentId(comparisonDocumentId);
    const inventoryVersion = versionNumber(version);
    const inventoryPageCount = positiveInteger(pageCount, "pageCount");
    const normalizedSourceSha256 = requiredText(
      sourceSha256,
      "sourceSha256"
    ).toLowerCase();
    if (!/^[a-f0-9]{64}$/u.test(normalizedSourceSha256))
      throw new Error("sourceSha256 must be a 64 character SHA-256 hash.");
    if (!Array.isArray(items)) throw new Error("items must be an array.");

    const normalized = items.map(normalizeItem);
    const uniqueItems = [
      ...new Map(normalized.map((item) => [item.factKey, item])).values(),
    ];
    if (uniqueItems.length === 0)
      throw new Error(
        "A ready comparison inventory requires at least one grounded item."
      );
    if (
      uniqueItems.some(
        (item) =>
          item.pageNumber != null && item.pageNumber > inventoryPageCount
      )
    )
      throw new Error("An inventory item points beyond the processed pages.");

    await prisma.$transaction(async (transaction) => {
      await transaction.comparison_document_inventory_items.deleteMany({
        where: { comparisonDocumentId: id },
      });
      if (uniqueItems.length > 0) {
        await transaction.comparison_document_inventory_items.createMany({
          data: uniqueItems.map((item) => ({
            comparisonDocumentId: id,
            ...item,
          })),
        });
      }
      await transaction.comparison_documents.update({
        where: { id },
        data: {
          inventoryStatus: "ready",
          inventoryVersion,
          inventoryItemCount: uniqueItems.length,
          inventoryPageCount,
          sourceSha256: normalizedSourceSha256,
          inventorySourceSha256: normalizedSourceSha256,
          inventoryError: null,
          lastUpdatedAt: new Date(),
        },
      });
    });

    return ComparisonDocumentInventory.get(id);
  },

  markFailed: async function ({
    comparisonDocumentId,
    version,
    pageCount = 0,
    error,
  }) {
    const id = documentId(comparisonDocumentId);
    const inventoryVersion = versionNumber(version);
    const inventoryPageCount = nonNegativeInteger(pageCount, "pageCount");
    const inventoryError = requiredText(error, "error");
    const updated = await prisma.$transaction(async (transaction) => {
      const current = await transaction.comparison_documents.findUnique({
        where: { id },
      });
      if (current?.inventoryStatus === "ready") {
        return transaction.comparison_documents.update({
          where: { id },
          data: { inventoryError, lastUpdatedAt: new Date() },
        });
      }
      await transaction.comparison_document_inventory_items.deleteMany({
        where: { comparisonDocumentId: id },
      });
      return transaction.comparison_documents.update({
        where: { id },
        data: {
          inventoryStatus: "failed",
          inventoryVersion,
          inventoryItemCount: 0,
          inventoryPageCount,
          inventorySourceSha256: null,
          inventoryError,
          lastUpdatedAt: new Date(),
        },
      });
    });
    return serializeManifest(updated);
  },

  clear: async function (comparisonDocumentId) {
    const id = documentId(comparisonDocumentId);
    const updated = await prisma.$transaction(async (transaction) => {
      await transaction.comparison_document_inventory_items.deleteMany({
        where: { comparisonDocumentId: id },
      });
      return transaction.comparison_documents.update({
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
    return serializeManifest(updated);
  },

  normalizeItem,
  serializeItem,
};

module.exports = {
  ComparisonDocumentInventory,
  INVENTORY_STATUSES,
};

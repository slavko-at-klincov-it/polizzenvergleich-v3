import test from "node:test";
import assert from "node:assert/strict";
import {
  countActiveDocumentUploads,
  embedParsedDocumentParts,
  formatDocumentTokenCount,
  nextAttachmentProcessingCount,
  summarizeParsedDocumentTokens,
} from "./chatAttachmentProcessing.js";

test("counts every active document upload independently of batch size", () => {
  const files = [
    { type: "upload", status: "reading" },
    { type: "upload", status: "indexing" },
    { type: "upload", status: "ready" },
    { type: "attachment", status: "reading" },
  ];

  assert.equal(countActiveDocumentUploads(files), 2);
  assert.equal(
    countActiveDocumentUploads([{ ...files[0], status: "ready" }, files[1]]),
    1
  );
  assert.equal(
    countActiveDocumentUploads([{ ...files[1], status: "failed" }]),
    0
  );
});

test("absolute event counts prevent an earlier batch from unlocking a later one", () => {
  assert.equal(
    nextAttachmentProcessingCount(2, { detail: { pendingCount: 1 } }, -1),
    1
  );
  assert.equal(
    nextAttachmentProcessingCount(1, { detail: { pendingCount: 0 } }, -1),
    0
  );
});

test("labels exact document tokens only when every parsed part is exact", () => {
  const exact = summarizeParsedDocumentTokens([
    {
      documentTokenCount: 1_000,
      documentTokenCountKind: "exact_model",
      documentTokenLabel: "LocalModel",
      tokenCountEstimate: 900,
    },
    {
      documentTokenCount: 250,
      documentTokenCountKind: "exact_model",
      documentTokenLabel: "LocalModel",
      tokenCountEstimate: 220,
    },
  ]);
  assert.deepEqual(exact, {
    count: 1_250,
    kind: "exact_model",
    label: "LocalModel",
  });
  assert.equal(
    formatDocumentTokenCount(exact, "en-US", {
      exact: "Dokument-Tokens",
      estimated: "ca. {{count}} Dokument-Tokens",
    }),
    "1,250 Dokument-Tokens (LocalModel)"
  );

  const fallback = summarizeParsedDocumentTokens([
    {
      documentTokenCount: 1_000,
      documentTokenCountKind: "exact_model",
      documentTokenLabel: "LocalModel",
      tokenCountEstimate: 900,
    },
    { tokenCountEstimate: 300 },
  ]);
  assert.deepEqual(fallback, { count: 1_300, kind: "estimated", label: null });
  assert.equal(
    formatDocumentTokenCount(fallback, "en-US", {
      exact: "Dokument-Tokens",
      estimated: "ca. {{count}} Dokument-Tokens",
    }),
    "ca. 1,300 Dokument-Tokens"
  );
});

test("rolls back committed parts and keeps only failed parsed ids", async () => {
  const rolledBack = [];
  const result = await embedParsedDocumentParts({
    parsedFiles: [{ id: 10 }, { id: 20 }, { id: 30 }],
    embed: async (id) => {
      if (id === 20)
        return {
          response: { ok: false },
          data: { success: false, error: "vector failed" },
        };
      return {
        response: { ok: true },
        data: {
          success: true,
          document: { id, docpath: `custom-documents/${id}.json` },
        },
      };
    },
    rollback: async (location) => rolledBack.push(location),
  });

  assert.deepEqual(result, {
    success: false,
    documents: [],
    remainingParsedFileIds: [20],
    error: "vector failed",
  });
  assert.deepEqual(rolledBack.sort(), [
    "custom-documents/10.json",
    "custom-documents/30.json",
  ]);
});

test("reports ready only when every part has a committed document", async () => {
  const result = await embedParsedDocumentParts({
    parsedFiles: [{ id: 1 }, { id: 2 }],
    embed: async (id) => ({
      response: { ok: true },
      data: {
        success: true,
        document: { id, location: `custom-documents/${id}.json` },
      },
    }),
    rollback: async () => assert.fail("rollback should not run"),
  });

  assert.equal(result.success, true);
  assert.deepEqual(result.remainingParsedFileIds, []);
  assert.equal(result.documents.length, 2);
});

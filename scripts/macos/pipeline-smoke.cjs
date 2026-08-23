#!/usr/bin/env node

// Deterministic, customer-data-free acceptance of the failure path that
// motivated this fork: page provenance -> isolated A/B FTS -> Selbstbehalt.
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const repo = path.resolve(
  process.env.POLICY_REPO_DIR || path.resolve(__dirname, "../..")
);
const { PrismaClient } = require(
  path.join(repo, "server/node_modules/@prisma/client")
);
const { assemblePdfExtraction } = require(
  path.join(
    repo,
    "collector/processSingleFile/convert/asPDF/PdfExtractionAssembler"
  )
);
const { ComparisonChunkIndex } = require(
  path.join(repo, "server/utils/PolicyComparison/ComparisonChunkIndex")
);

function documentData(filename, amount, secondPageMethod) {
  const extraction = assemblePdfExtraction({
    totalPages: 2,
    sourceSha256: "0".repeat(64),
    pages: [
      {
        pageNumber: 1,
        text: "Allgemeine Vertragsinformationen.",
        method: "native",
        status: "ok",
      },
      {
        pageNumber: 2,
        text: `Der Selbstbehalt beträgt EUR ${amount} je Schadenfall.`,
        method: secondPageMethod,
        status: "ok",
        ocrConfidence: secondPageMethod === "ocr" ? 92 : null,
      },
    ],
  });
  return { title: filename, ...extraction };
}

async function main() {
  const tempDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "policy-pipeline-smoke-")
  );
  const db = new PrismaClient({
    datasources: {
      db: { url: `file:${path.join(tempDirectory, "comparison.db")}` },
    },
  });
  ComparisonChunkIndex._schemaPromise = null;
  try {
    const fixtures = [
      {
        id: 101,
        slot: "A",
        docId: "smoke-a",
        filename: "Polizze A.pdf",
        amount: 350,
        method: "native",
      },
      {
        id: 102,
        slot: "B",
        docId: "smoke-b",
        filename: "Polizze B.pdf",
        amount: 500,
        method: "ocr",
      },
    ];
    for (const fixture of fixtures) {
      await ComparisonChunkIndex.indexDocument({
        comparisonDocument: {
          id: fixture.id,
          workspaceId: 1,
          threadId: 77,
          workspaceDocumentId: fixture.id + 100,
          docId: fixture.docId,
          slot: fixture.slot,
          originalFilename: fixture.filename,
        },
        documentData: documentData(
          fixture.filename,
          fixture.amount,
          fixture.method
        ),
        db,
      });
    }

    for (const fixture of fixtures) {
      const hits = await ComparisonChunkIndex.searchDocument({
        threadId: 77,
        comparisonDocumentId: fixture.id,
        query: "Wo unterscheiden sich Selbstbehalt und Franchise?",
        db,
      });
      assert.equal(hits.length, 1);
      assert.equal(hits[0].slot, fixture.slot);
      assert.equal(hits[0].pageNumber, 2);
      assert.equal(hits[0].exactMatch, true);
      assert.match(hits[0].text, new RegExp(`EUR ${fixture.amount}`));
    }

    await ComparisonChunkIndex.removeThread(77, db);
    const removed = await ComparisonChunkIndex.searchDocument({
      threadId: 77,
      comparisonDocumentId: 101,
      query: "Selbstbehalt",
      db,
    });
    assert.deepEqual(removed, []);
    console.log(
      JSON.stringify({
        success: true,
        documents: 2,
        exactTerm: "Selbstbehalt",
        pageEvidence: true,
        ocrProvenance: true,
        threadCleanup: true,
      })
    );
  } finally {
    await db.$disconnect();
    ComparisonChunkIndex._schemaPromise = null;
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`Pipeline-Smoke-Test fehlgeschlagen: ${error.message}`);
  process.exit(1);
});

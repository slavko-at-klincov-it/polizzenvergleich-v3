const crypto = require("crypto");
const {
  buildCatalogFromLineManifest,
  buildLfReferenceLineManifest,
  validateLfReferenceLineManifest,
} = require("../../utils/policyComparison/lfReferenceManifest");

function artifact() {
  const pages = Array.from({ length: 20 }, (_, index) => {
    const page = index + 1;
    const anchors =
      page === 1
        ? [
            "LF-IMMO EXKLUSIVSCHUTZ 2023",
            "Präambel",
            "A. BESONDERER TEIL",
            "Versicherungsumfang",
            "Feuerversicherung",
            "Sturmversicherung",
            "Leitungswasserversicherung",
            "Glasbruch",
            "Gebäudehaftpflicht",
            "Allgemeine Bestimmungen",
          ]
        : [];
    return [
      ...anchors,
      `Dokumentabschnitt ${page}`,
      `- Operative Vertragszeile ${page} mit 5 % Limit`,
      `- Weitere operative Vertragszeile ${page}`,
    ].join("\n");
  });
  const pageMap = [];
  let start = 0;
  for (const [index, page] of pages.entries()) {
    pageMap.push({ pageNumber: index + 1, start, end: start + page.length });
    start += page.length + (index < pages.length - 1 ? 2 : 0);
  }
  const pageContent = pages.join("\n\n");
  const fingerprint = crypto
    .createHash("sha256")
    .update("synthetic-lf-revision")
    .digest("hex");
  return {
    schemaVersion: 1,
    fingerprint,
    document: {
      sourceDocumentId: fingerprint,
      title: "synthetic-lf-revision.pdf",
      pageContent,
      pageMap,
      pdfExtraction: {
        complete: true,
        totalPages: pages.length,
        processedPages: pages.length,
        pagesWithText: pages.length,
      },
    },
  };
}

describe("source-bound LF reference line manifest", () => {
  test("enumerates the runtime A document instead of the 35-row seed", () => {
    const documentArtifact = artifact();
    const manifest = buildLfReferenceLineManifest(documentArtifact);
    expect(manifest.lines.length).toBeGreaterThan(35);
    expect(manifest.sourceDocument.fingerprint).toBe(
      documentArtifact.fingerprint
    );
    expect(manifest.lines[0].source.exactText).toContain("LF-IMMO");
    expect(
      manifest.lines.every(({ source }) => source.documentFingerprint)
    ).toBe(true);

    const definitions = buildCatalogFromLineManifest(manifest);
    expect(
      definitions.flatMap(({ catalog }) => catalog.requirements)
    ).toHaveLength(manifest.lines.length);
    expect(
      definitions
        .flatMap(({ catalog }) => catalog.requirements)
        .some(({ sourceReferenceId }) => sourceReferenceId === "LF-MAN-0001")
    ).toBe(true);
  });

  test("accepts a structurally compatible revision with a different hash", () => {
    const documentArtifact = artifact();
    const manifest = buildLfReferenceLineManifest(documentArtifact);
    const revision = {
      ...documentArtifact,
      fingerprint: "a".repeat(64),
      document: {
        ...documentArtifact.document,
        sourceDocumentId: "a".repeat(64),
      },
    };
    expect(() => buildLfReferenceLineManifest(revision)).not.toThrow();
    expect(manifest.sourceDocument.fingerprint).not.toBe(revision.fingerprint);
  });

  test("fails closed when a persisted manifest source span is changed", () => {
    const documentArtifact = artifact();
    const manifest = buildLfReferenceLineManifest(documentArtifact);
    const changed = JSON.parse(JSON.stringify(manifest));
    changed.lines[0].source.exactText = "tampered";
    expect(() =>
      validateLfReferenceLineManifest(changed, { documentArtifact })
    ).toThrow("LF_REFERENCE_LINE_MANIFEST_DIGEST_INVALID");
  });
});

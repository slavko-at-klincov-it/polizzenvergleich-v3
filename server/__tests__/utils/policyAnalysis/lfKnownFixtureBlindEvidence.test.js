const crypto = require("crypto");
const {
  BLIND_EVIDENCE_PACKET_CONTRACT_ID,
  buildBlindEvidenceRowInputs,
  buildLfKnownFixtureBlindEvidencePacket,
} = require("../../../utils/policyAnalysis/lfKnownFixtureBlindEvidence");
const {
  buildSourceEvidenceBoundaryPlan,
  partitionCompleteEvidenceGroups,
} = require("../../../utils/policyAnalysis/sourceEvidenceBoundaryContext");

const sha256 = (value) =>
  crypto.createHash("sha256").update(String(value)).digest("hex");

function artifact(text, fingerprint) {
  return {
    schemaVersion: 1,
    fingerprint,
    document: {
      sourceDocumentId: fingerprint,
      pageContent: text,
      pageMap: [{ pageNumber: 1, start: 0, end: text.length }],
      pdfExtraction: {
        schemaVersion: 1,
        complete: true,
        totalPages: 1,
        processedPages: 1,
        pagesWithText: 1,
      },
    },
  };
}

function fixture(primaryText) {
  const documents = Array.from({ length: 9 }, (_, index) => {
    const fingerprint = sha256(`document-${index}`);
    const text = index === 0 ? primaryText : `Unabhängige Klausel ${index}.`;
    return {
      document: {
        uuid: `doc-${index}`,
        position: index,
        sha256: fingerprint,
        originalName: `B-${index}.pdf`,
        role: index ? "TERMS" : "MAIN_POLICY",
        documentStatus: "ACTIVE",
      },
      artifact: artifact(text, fingerprint),
    };
  });
  const aText =
    "Der Premiumschutz gilt für Neu- und Konvertierungsanträge sowie günstigere Regelungen.";
  const aSpan = {
    spanId: "a-span",
    physicalPageNumber: 2,
    documentStart: 10,
    documentEnd: 10 + aText.length,
    exactText: aText,
    exactTextSha256: sha256(aText),
    blockIds: ["a-block"],
  };
  const exactQuote = primaryText;
  const candidate = {
    candidateId: "navigation-1",
    candidateKind: "STRUCTURAL",
    semanticDecision: "MUST_NOT_LEAK",
    range: {
      documentUuid: "doc-0",
      documentFingerprint: documents[0].document.sha256,
      physicalPageNumber: 1,
      documentStart: 0,
      documentEnd: exactQuote.length,
      exactQuote,
      exactQuoteSha256: sha256(exactQuote),
    },
  };
  return {
    semanticManifest: {
      contractId: "LF_SEMANTIC_REQUIREMENT_MANIFEST_V2",
      manifestSha256: sha256("manifest"),
      requirements: [
        {
          requirementId: "PR-01",
          sourceOrder: 0,
          categoryId: "PR",
          categoryLabel: "Präambel",
          subcategoryId: "PR-00",
          subcategoryLabel: "Geltung",
          displayLabel: "Anwendung des Premiumschutzes",
          sourceSpans: [aSpan],
          values: [],
          components: [
            {
              id: "applicability",
              label: "Neu- und Konvertierungsanträge",
              aliases: ["Neuverträge", "Konvertierungen"],
              factRole: "CONDITION",
              sourceSpanIds: ["a-span"],
            },
          ],
        },
      ],
    },
    oracle: {
      oracleId: "oracle",
      priorGoldDecision: "MUST_NOT_LEAK",
      documents: documents.map(({ document }, index) => ({
        uuid: document.uuid,
        side: "B",
        fingerprint: document.sha256,
        originalName: document.originalName,
        role: document.role,
        documentStatus: document.documentStatus,
        artifactSha256: sha256(`artifact-${index}`),
        pageMapSha256: sha256(`page-map-${index}`),
      })),
      rows: [
        {
          analysisRowId: "LR01-001",
          requirementId: "PR-01",
          baseline: { customerSearchStatus: "MUST_NOT_LEAK" },
          benchmarkCandidateIds: ["navigation-1"],
        },
      ],
      benchmarkCandidates: [candidate],
    },
    bDocuments: documents,
  };
}

describe("LF blind evidence V2", () => {
  it("keeps the complete clause when decisive evidence occurs after character 600", () => {
    const prefix = "Diese vollständige Klausel enthält Kontext. ".repeat(18);
    const decisive =
      "Sie gilt ausdrücklich für Neuverträge und für Konvertierungen.";
    const input = fixture(`${prefix}${decisive}`);
    const packet = buildLfKnownFixtureBlindEvidencePacket({
      ...input,
      createdAt: "2026-09-13T00:00:00.000Z",
    });
    const rowInputs = buildBlindEvidenceRowInputs(packet, "PR-01");
    const serialized = JSON.stringify(rowInputs);
    expect(serialized).toContain(decisive);
    expect(serialized).toContain(prefix.trim());
    expect(serialized).not.toContain("excerpted");
    expect(packet.evidencePolicy.characterClippingAllowed).toBe(false);
  });

  it("keeps list governor and target item but does not merge a sibling item", () => {
    const document = {
      uuid: "doc-list",
      position: 0,
      sha256: sha256("list"),
      originalName: "Liste.pdf",
      role: "TERMS",
      documentStatus: "ACTIVE",
    };
    const source = [
      "• Versichert sind:",
      "- Neu- und Konvertierungsanträge.",
      "- Ein unabhängiger Geschwisterpunkt.",
    ].join("\n");
    const plan = buildSourceEvidenceBoundaryPlan({
      documents: [{ document, artifact: artifact(source, document.sha256) }],
    });
    const target = plan.evidenceGroups.find(({ exactText }) =>
      exactText.includes("Neu- und Konvertierungsanträge")
    );
    expect(target.exactText).toContain("Versichert sind:");
    expect(target.exactText).not.toContain("Geschwisterpunkt");
    expect(target.combinationOperator).toBe("ALL_OF");
  });

  it("keeps repeated equal text at different offsets as distinct evidence", () => {
    const text = [
      "1 Erste Klausel",
      "Gleicher Wortlaut gilt.",
      "2 Zweite Klausel",
      "Gleicher Wortlaut gilt.",
    ].join("\n\n");
    const document = {
      uuid: "doc-repeat",
      position: 0,
      sha256: sha256("repeat"),
      originalName: "Wiederholung.pdf",
    };
    const plan = buildSourceEvidenceBoundaryPlan({
      documents: [{ document, artifact: artifact(text, document.sha256) }],
    });
    const repeated = plan.evidenceGroups.filter(({ exactText }) =>
      exactText.includes("Gleicher Wortlaut gilt.")
    );
    expect(repeated).toHaveLength(2);
    expect(repeated[0].evidenceGroupId).not.toBe(repeated[1].evidenceGroupId);
  });

  it("allows multiple complete sources for one component without document deduplication", () => {
    const source = [
      "1 Versicherungsnehmer",
      "Der Versicherungsnehmer ist die Familienwohnbau GmbH.",
      "2 Rahmenvereinbarung",
      "RV WEVIG/Familienwohnbau gilt für Neu- und Konvertierungsanträge.",
    ].join("\n\n");
    const input = fixture(source);
    const packet = buildLfKnownFixtureBlindEvidencePacket({
      ...input,
      maximumEvidenceGroupsPerCheck: 12,
      createdAt: "2026-09-13T00:00:00.000Z",
    });
    const ids = packet.rows[0].components[0].evidence.evidenceGroupIds;
    const groups = packet.sourceCatalog.evidenceGroups.filter(({ evidenceGroupId }) =>
      ids.includes(evidenceGroupId)
    );
    expect(groups.some(({ exactText }) => exactText.includes("Versicherungsnehmer"))).toBe(true);
    expect(groups.some(({ exactText }) => exactText.includes("RV WEVIG"))).toBe(true);
    expect(packet.rows[0].components[0].evidence.combinationPolicy).toContain(
      "MULTI_SOURCE_ALLOWED"
    );
  });

  it("is independent of prior decision labels and gold-candidate input", () => {
    const source =
      "Der Premiumschutz gilt für Neuverträge und Konvertierungen.";
    const firstInput = fixture(source);
    const secondInput = fixture(source);
    secondInput.oracle.priorGoldDecision = "ABSICHTLICH_GEAENDERT";
    secondInput.oracle.rows[0].baseline.customerSearchStatus =
      "ABSICHTLICH_GEAENDERT";
    secondInput.oracle.benchmarkCandidates[0].semanticDecision =
      "ABSICHTLICH_GEAENDERT";
    const options = { createdAt: "2026-09-13T00:00:00.000Z" };
    const first = buildLfKnownFixtureBlindEvidencePacket({
      ...firstInput,
      ...options,
    });
    const second = buildLfKnownFixtureBlindEvidencePacket({
      ...secondInput,
      ...options,
    });
    expect(first).toEqual(second);
    expect(first.contractId).toBe(BLIND_EVIDENCE_PACKET_CONTRACT_ID);
    expect(JSON.stringify(first)).not.toContain("MUST_NOT_LEAK");
  });

  it("fails closed on a tampered navigation range", () => {
    const input = fixture(
      "Der Premiumschutz gilt für Neuverträge und Konvertierungen."
    );
    input.oracle.benchmarkCandidates[0].range.documentEnd -= 1;
    expect(() => buildLfKnownFixtureBlindEvidencePacket(input)).toThrow(
      "LF_BLIND_EVIDENCE_NAVIGATION_RANGE_INVALID"
    );
  });

  it("partitions only whole evidence groups and fails on an oversized group", () => {
    const groups = [
      { evidenceGroupId: "one", characterCount: 40 },
      { evidenceGroupId: "two", characterCount: 40 },
    ];
    expect(partitionCompleteEvidenceGroups(groups, 50)).toEqual([
      [groups[0]],
      [groups[1]],
    ]);
    expect(() => partitionCompleteEvidenceGroups(groups, 30)).toThrow(
      "LF_BLIND_EVIDENCE_GROUP_TOO_LARGE"
    );
  });
});

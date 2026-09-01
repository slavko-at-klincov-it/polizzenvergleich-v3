const fs = require("fs");
const os = require("os");
const path = require("path");
const ExcelJS = require("exceljs");
const {
  CATEGORY_ORDER,
  buildComparisonResult,
  comparePackages,
  summarizePackage,
  writeComparisonArtifacts,
} = require("../../utils/policyComparison/resultBuilder");

function row(categoryId, overrides = {}) {
  return {
    categoryId,
    stage: "Basis",
    categoryName: `Kategorie ${categoryId}`,
    documentedContent: "keine belegte Fundstelle gefunden",
    coverage: "Nicht feststellbar",
    coverageAmount: "Nicht feststellbar",
    source: "keine belegte Fundstelle gefunden",
    reviewStatus: "UNGEKLÄRT",
    ...overrides,
  };
}

function document(uuid, side, role = "MAIN_POLICY") {
  return {
    uuid,
    side,
    role,
    documentStatus: "ACTIVE",
    originalName: `${uuid}.pdf`,
    sha256: uuid.repeat(64).slice(0, 64),
  };
}

function writeRun(root, sourceDocument, rowOverrides = {}) {
  const outputDirectory = path.join(root, sourceDocument.uuid);
  for (const categoryView of CATEGORY_ORDER) {
    const resultDirectory = path.join(outputDirectory, categoryView, "result");
    fs.mkdirSync(resultDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(resultDirectory, "rows.private.json"),
      JSON.stringify([
        row(`${categoryView}-01`, rowOverrides[categoryView] || {}),
      ])
    );
  }
  return { document: sourceDocument, outputDirectory };
}

function writeAtomicCategory(
  run,
  categoryView,
  coverageEffect,
  candidateOverrides = {},
  { certified = false } = {}
) {
  const categoryDirectory = path.join(run.outputDirectory, categoryView);
  const requirementId = `${categoryView}-01`;
  const candidateId = `candidate-${run.document.uuid}-${categoryView}`;
  fs.writeFileSync(
    path.join(categoryDirectory, "worksheet.private.json"),
    JSON.stringify({
      catalog: { id: "synthetic-catalog-v1", categoryView },
      requirements: [
        {
          id: requirementId,
          label: "Versicherter Gegenstand",
          requestedFields: [],
          componentSatisfactionPolicy: "ALL",
          negativeSearchPolicy: certified
            ? "CERTIFY_COMPLETE_ZERO_OCCURRENCE_V1"
            : "REPORT_COMPLETE_ZERO_CONTROLLED_SEARCH_V1",
          absenceMeaning: "COVERAGE_ONLY",
          ...(certified
            ? {
                absenceComparisonPolicy:
                  "ASSUME_NOT_INCLUDED_AFTER_COMPLETE_ZERO_OCCURRENCE_V1",
                absenceCertification: {
                  certificationId: "synthetic-certification-v1",
                  registryId: "synthetic-registry-v1",
                  requirementDigest: "a".repeat(64),
                },
              }
            : {}),
          components: [
            {
              id: "insured_subject",
              label: "Versicherter Gegenstand",
              factRole: "INSURED_OBJECT",
              aliases: ["Versicherter Gegenstand"],
            },
          ],
        },
      ],
    })
  );
  fs.mkdirSync(path.join(categoryDirectory, "effects"), { recursive: true });
  fs.writeFileSync(
    path.join(categoryDirectory, "effects", "materialized.private.json"),
    JSON.stringify({
      judgements: [
        {
          targetId: `target-${requirementId}`,
          requirementId,
          componentId: "insured_subject",
          selectedCandidateIds: [candidateId],
          unresolvedCandidateIds: [],
          evidencePresence: "FOUND",
          coverageEffect,
          conflictState: "NONE",
          selectedScopePicture: "GENERAL",
          documentApplicability: "ACTIVE",
        },
      ],
    })
  );
  fs.writeFileSync(
    path.join(categoryDirectory, "effects", "targets.private.json"),
    JSON.stringify([
      {
        targetId: `target-${requirementId}`,
        factRole: "INSURED_OBJECT",
        candidates: [
          {
            candidateId,
            physicalPageNumber: 1,
            exactText: "Versicherter Gegenstand",
            ...candidateOverrides,
          },
        ],
      },
    ])
  );
  fs.writeFileSync(
    path.join(categoryDirectory, "result", "requested-fields.private.json"),
    JSON.stringify({
      requirements: [
        {
          requirementId,
          requestedFields: [],
          requestedFieldStatus: "NOT_REQUIRED",
          fields: [],
        },
      ],
    })
  );
}

function writeCompleteAbsenceCategory(
  run,
  categoryView,
  { certified = true } = {}
) {
  const categoryDirectory = path.join(run.outputDirectory, categoryView);
  const requirementId = `${categoryView}-01`;
  const componentId = "insured_subject";
  const targetId = `prepared-target:${requirementId}:${componentId}`;
  fs.writeFileSync(
    path.join(run.outputDirectory, "document.private.json"),
    JSON.stringify({
      schemaVersion: 1,
      fingerprint: run.document.sha256,
      document: {
        sourceDocumentId: run.document.sha256,
        pdfExtraction: {
          schemaVersion: 1,
          totalPages: 1,
          processedPages: 1,
          pagesWithText: 1,
          complete: true,
        },
      },
    })
  );
  fs.writeFileSync(
    path.join(categoryDirectory, "worksheet.private.json"),
    JSON.stringify({
      catalog: { id: "synthetic-catalog-v1", categoryView },
      document: { physicalPages: 1 },
      summary: { componentCount: 1 },
      requirements: [
        {
          id: requirementId,
          label: "Versicherter Gegenstand",
          requestedFields: [],
          componentSatisfactionPolicy: "ALL",
          negativeSearchPolicy: certified
            ? "CERTIFY_COMPLETE_ZERO_OCCURRENCE_V1"
            : "REPORT_COMPLETE_ZERO_CONTROLLED_SEARCH_V1",
          absenceMeaning: "COVERAGE_ONLY",
          ...(certified
            ? {
                absenceComparisonPolicy:
                  "ASSUME_NOT_INCLUDED_AFTER_COMPLETE_ZERO_OCCURRENCE_V1",
                absenceCertification: {
                  certificationId: "synthetic-certification-v1",
                  registryId: "synthetic-registry-v1",
                  requirementDigest: "a".repeat(64),
                },
              }
            : {}),
          components: [
            {
              id: componentId,
              label: "Versicherter Gegenstand",
              factRole: "INSURED_OBJECT",
              aliases: ["Versicherter Gegenstand"],
              terminalState: "NO_CONTROLLED_CANDIDATE",
              occurrenceCount: 0,
              occurrences: [],
            },
          ],
        },
      ],
    })
  );
  fs.mkdirSync(path.join(categoryDirectory, "effects"), { recursive: true });
  fs.writeFileSync(
    path.join(categoryDirectory, "effects", "materialized.private.json"),
    JSON.stringify({
      judgements: [
        {
          targetId,
          requirementId,
          componentId,
          selectedCandidateIds: [],
          unresolvedCandidateIds: [],
          evidencePresence: "NOT_FOUND",
          coverageEffect: "UNKNOWN",
          conflictState: "NONE",
          selectedScopePicture: "UNKNOWN",
          documentApplicability: "UNKNOWN",
          decisionOwner: "SERVER",
        },
      ],
    })
  );
  fs.writeFileSync(
    path.join(categoryDirectory, "effects", "targets.private.json"),
    JSON.stringify([
      {
        targetId,
        requirementId,
        componentId,
        factRole: "INSURED_OBJECT",
        candidates: [],
        serverRejectedCandidates: [],
        unresolvedCandidateIds: [],
      },
    ])
  );
  fs.writeFileSync(
    path.join(categoryDirectory, "result", "requested-fields.private.json"),
    JSON.stringify({
      requirements: [
        {
          requirementId,
          requestedFields: [],
          requestedFieldStatus: "NOT_REQUIRED",
          fields: [],
        },
      ],
    })
  );
  fs.writeFileSync(
    path.join(categoryDirectory, "result", "report.json"),
    JSON.stringify({
      status: "TECHNICAL_PASS_REVIEW_REQUIRED",
      rowCount: 1,
      expectedRowCount: 1,
      gates: {
        documentArtifact: true,
        worksheetCatalog: true,
        triage: true,
        effects: true,
        artifactIdentity: true,
        tableContract: true,
      },
    })
  );
}

describe("policy comparison result builder", () => {
  let root;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "policy-comparison-"));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  test("keeps simultaneous object facts separate instead of inventing a contradiction", () => {
    const packageSummary = summarizePackage([
      {
        document: document("a", "A", "MAIN_POLICY"),
        row: row("EL-16", {
          documentedContent: "Wintergärten sind eingeschlossen",
          coverage: "Ja",
          source: "PDF-Seite 12",
          reviewStatus: "BELEGT",
        }),
      },
      {
        document: document("b", "A", "SUPPLEMENT"),
        row: row("EL-16", {
          documentedContent: "Vitrinen sind ausgeschlossen",
          coverage: "Nein",
          source: "PDF-Seite 3",
          reviewStatus: "BELEGT",
        }),
      },
    ]);

    expect(packageSummary.documentedContent).toContain("Wintergärten");
    expect(packageSummary.documentedContent).toContain("Vitrinen");
    expect(packageSummary.reviewStatus).toBe("RANGFOLGE_PRÜFEN");
    expect(packageSummary.reviewStatus).not.toBe("WIDERSPRÜCHLICH");
    expect(packageSummary.facts).toHaveLength(2);
  });

  test("does not call one-sided evidence an automatic advantage", () => {
    const withEvidence = summarizePackage([
      {
        document: document("a", "A"),
        row: row("VS-01", {
          documentedContent: "Gebäudeversicherungssumme 2 Mio. EUR",
          coverage: "Ja",
          coverageAmount: "2 Mio. EUR",
          source: "PDF-Seite 1",
          reviewStatus: "BELEGT",
        }),
      },
    ]);
    const withoutEvidence = summarizePackage([
      { document: document("b", "B"), row: row("VS-01") },
    ]);
    const comparison = comparePackages(withEvidence, withoutEvidence);

    expect(comparison.outcome).toBe("NUR_A_BELEGT");
    expect(comparison.difference).toContain("automatischer Vorteilsschluss");
    expect(comparison.difference).toContain("nicht zulässig");
  });

  test("does not invent precedence for equivalent EUR formatting", () => {
    const packageSummary = summarizePackage([
      {
        document: document("a", "B", "MAIN_POLICY"),
        row: row("VB-14", {
          documentedContent: "Betragsgrenze grobe Fahrlässigkeit",
          coverage: "Ja",
          coverageAmount: "EUR 5.000.000,00 auf Erstes Risiko",
          source: "PDF-Seite 1: Besondere Bedingung 10PA0460",
          reviewStatus: "BELEGT",
        }),
      },
      {
        document: document("b", "B", "SUPPLEMENT"),
        row: row("VB-14", {
          documentedContent: "Betragsgrenze grobe Fahrlässigkeit",
          coverage: "Ja",
          coverageAmount: "EUR 5.000.000",
          source: "PDF-Seite 6: gemäß 10PA0460",
          reviewStatus: "BELEGT",
        }),
      },
    ]);

    expect(packageSummary.reviewStatus).toBe("BELEGT");
    expect(packageSummary.coverageAmount).toBe(
      "EUR 5.000.000,00 auf Erstes Risiko"
    );
  });

  test("keeps genuinely different EUR limits review-required", () => {
    const packageSummary = summarizePackage([
      {
        document: document("a", "B"),
        row: row("VB-14", {
          documentedContent: "Betragsgrenze grobe Fahrlässigkeit",
          coverage: "Ja",
          coverageAmount: "EUR 5.000.000",
          source: "PDF-Seite 1",
          reviewStatus: "BELEGT",
        }),
      },
      {
        document: document("b", "B"),
        row: row("VB-14", {
          documentedContent: "Betragsgrenze grobe Fahrlässigkeit",
          coverage: "Ja",
          coverageAmount: "EUR 4.000.000",
          source: "PDF-Seite 2",
          reviewStatus: "BELEGT",
        }),
      },
    ]);

    expect(packageSummary.reviewStatus).toBe("RANGFOLGE_PRÜFEN");
  });

  test("keeps equal numbers with different limit periods review-required", () => {
    const packageSummary = summarizePackage([
      {
        document: document("a", "B"),
        row: row("HP-01", {
          documentedContent: "Limit pro Ereignis",
          coverage: "Ja",
          coverageAmount: "EUR 5.000.000 je Ereignis",
          source: "PDF-Seite 1",
          reviewStatus: "BELEGT",
        }),
      },
      {
        document: document("b", "B"),
        row: row("HP-01", {
          documentedContent: "Jahreshöchstlimit",
          coverage: "Ja",
          coverageAmount: "EUR 5.000.000 je Versicherungsjahr",
          source: "PDF-Seite 2",
          reviewStatus: "BELEGT",
        }),
      },
    ]);

    expect(packageSummary.reviewStatus).toBe("RANGFOLGE_PRÜFEN");
  });

  test("keeps equal numbers with a shared clause but different periods review-required", () => {
    const packageSummary = summarizePackage([
      {
        document: document("a", "B"),
        row: row("HP-01", {
          documentedContent: "Limit pro Ereignis",
          coverage: "Ja",
          coverageAmount: "EUR 5.000.000 je Ereignis",
          source: "PDF-Seite 1: gemäß 81PW0031",
          reviewStatus: "BELEGT",
        }),
      },
      {
        document: document("b", "B"),
        row: row("HP-01", {
          documentedContent: "Jahreshöchstlimit",
          coverage: "Ja",
          coverageAmount: "EUR 5.000.000 je Versicherungsjahr",
          source: "PDF-Seite 2: gemäß 81PW0031",
          reviewStatus: "BELEGT",
        }),
      },
    ]);

    expect(packageSummary.reviewStatus).toBe("RANGFOLGE_PRÜFEN");
  });

  test("reconciles an NBW percentage only with an exact package base", () => {
    const absolute = {
      document: document("a", "B", "MAIN_POLICY"),
      row: row("VS-25", {
        documentedContent: "Behördliche Mehrkosten",
        coverage: "Ja",
        coverageAmount: "EUR 1.530.400,00 auf Erstes Risiko",
        source: "PDF-Seite 1: Besondere Bedingung 10PA0130",
        reviewStatus: "BELEGT",
      }),
    };
    const percentage = {
      document: document("b", "B", "SUPPLEMENT"),
      row: row("VS-25", {
        documentedContent: "Behördliche Mehrkosten bis 5 % des NBW",
        coverage: "Ja",
        coverageAmount: "5 %",
        source: "PDF-Seite 6: bis 5 % des NBW gemäß 10PA0130",
        reviewStatus: "BELEGT",
      }),
    };
    const base = {
      document: document("a", "B", "MAIN_POLICY"),
      row: row("VS-01", {
        documentedContent: "Wohngebäude zum Neuwert",
        coverage: "Ja",
        coverageAmount: "EUR 30.608.000,00",
        source: "PDF-Seite 1: Wohngebäude zum Neuwert",
        reviewStatus: "BELEGT",
      }),
    };

    expect(
      summarizePackage([absolute, percentage], {
        referenceEntries: [absolute, percentage, base],
      }).reviewStatus
    ).toBe("BELEGT");
    expect(
      summarizePackage([absolute, percentage], {
        referenceEntries: [absolute, percentage],
      }).reviewStatus
    ).toBe("RANGFOLGE_PRÜFEN");
    expect(
      summarizePackage([absolute, percentage], {
        referenceEntries: [
          absolute,
          percentage,
          {
            ...base,
            row: { ...base.row, reviewStatus: "TEILBELEGT" },
          },
        ],
      }).reviewStatus
    ).toBe("RANGFOLGE_PRÜFEN");
    expect(
      summarizePackage([absolute, percentage], {
        referenceEntries: [
          absolute,
          percentage,
          {
            ...base,
            row: {
              ...base.row,
              categoryId: "VS-25",
            },
          },
        ],
      }).reviewStatus
    ).toBe("RANGFOLGE_PRÜFEN");
  });

  test("counts one-sided evidence as a review-required difference", () => {
    const runA = writeRun(root, document("a", "A"), {
      VS: {
        documentedContent: "Gebäudeversicherungssumme 2 Mio. EUR",
        coverage: "Ja",
        coverageAmount: "2 Mio. EUR",
        source: "PDF-Seite 1",
        reviewStatus: "BELEGT",
      },
    });
    const runB = writeRun(root, document("b", "B"));

    const result = buildComparisonResult([runA, runB]);

    expect(result.categories[0].rows[0].outcome).toBe("NUR_A_BELEGT");
    expect(result.totals.customerReviewRequired).toBe(1);
  });

  test("builds the five-category customer profile with document-level provenance", async () => {
    const runA = writeRun(root, document("a", "A"), {
      VS: {
        stage: "V",
        documentedContent: "Versicherungssumme A",
        coverage: "Ja",
        source: "PDF-Seite 1",
        reviewStatus: "BELEGT",
      },
      FE: { stage: "K" },
      LW: { stage: "S" },
      ST: { stage: "S" },
      EL: { stage: "V" },
    });
    const runB = writeRun(root, document("b", "B"), {
      VS: {
        stage: "V",
        documentedContent: "Versicherungssumme B",
        coverage: "Ja",
        source: "PDF-Seite 2",
        reviewStatus: "BELEGT",
      },
      FE: { stage: "K" },
      LW: { stage: "S" },
      ST: { stage: "S" },
      EL: { stage: "V" },
    });

    const result = buildComparisonResult([runA, runB], {
      sessionUuid: "session-1",
    });
    expect(result.categories.map(({ categoryView }) => categoryView)).toEqual(
      CATEGORY_ORDER
    );
    expect(result.totals.rows).toBe(5);
    expect(result.productProfile).toMatchObject({
      id: "CUSTOMER_CORE_5_V7",
      comparisonContractId: "CERTIFIED_COVERAGE_ONLY_TYPED_V2",
      categoryViews: ["VS", "FE", "LW", "ST", "EL"],
      expectedRowCount: 224,
    });
    expect(result.categories[0].rows[0].packageA.facts[0]).toMatchObject({
      documentUuid: "a",
      source: "PDF-Seite 1",
    });

    const outputDirectory = path.join(root, "result");
    const artifacts = await writeComparisonArtifacts({
      documentRuns: [runA, runB],
      outputDirectory,
      metadata: { sessionUuid: "session-1" },
    });
    expect(fs.existsSync(artifacts.jsonFile)).toBe(true);
    expect(fs.existsSync(artifacts.markdownFile)).toBe(true);
    expect(fs.existsSync(artifacts.workbookFile)).toBe(true);
    expect(fs.statSync(artifacts.workbookFile).mode & 0o077).toBe(0);
    const markdown = fs.readFileSync(artifacts.markdownFile, "utf8");
    expect(markdown).toContain("A-Prüfstatus");
    expect(markdown).toContain("A-Quellen");
    expect(markdown).toContain("Punktentscheidung");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(artifacts.workbookFile);
    expect(workbook.worksheets).toHaveLength(1);
    const sheet = workbook.getWorksheet("Gesamtvergleich");
    const headers = sheet.getRow(1).values.slice(1);
    expect(headers).toEqual([
      "A_Kategorie-ID",
      "A_Stufe",
      "A_Kategorie-Name",
      "A_Vertragsinhalt",
      "A_Deckung",
      "A_Deckungssumme",
      "A_Quelle",
      "A_Prüfstatus",
      "B_Kategorie-ID",
      "B_Stufe",
      "B_Kategorie-Name",
      "B_Vertragsinhalt",
      "B_Deckung",
      "B_Deckungssumme",
      "B_Quelle",
      "B_Prüfstatus",
      "KI-Ergebnis",
    ]);
    expect(sheet.rowCount).toBe(6);
    expect(sheet.autoFilter).toEqual("A1:Q6");
    expect(sheet.getColumn("A").values.slice(2)).toEqual([
      "FE-01",
      "LW-01",
      "ST-01",
      "VS-01",
      "EL-01",
    ]);
    expect(sheet.getCell("A2").value).toBe(sheet.getCell("I2").value);
    expect(sheet.getCell("B2").value).toBe(sheet.getCell("J2").value);
    expect(sheet.getCell("C2").value).toBe(sheet.getCell("K2").value);
    expect(sheet.getCell("Q2").value).toContain("Kein klarer Vorteil:");
    expect(sheet.getRow(1).height).toBe(17);
    expect(sheet.getRow(2).height).toBeGreaterThanOrEqual(34);
    expect(sheet.getRow(2).height % 17).toBe(0);
    expect(headers).not.toContain("Entscheidungsregel");
    expect(headers).not.toContain("Dokumentbefund");
  });

  test("builds a point advantage from atomic evidence without replacing the technical diff", () => {
    const runA = writeRun(root, document("a", "A"), {
      VS: {
        documentedContent: "Versicherter Gegenstand ausgeschlossen",
        coverage: "Nein",
        source: "PDF-Seite 1",
        reviewStatus: "BELEGT",
      },
    });
    const runB = writeRun(root, document("b", "B"), {
      VS: {
        documentedContent: "Versicherter Gegenstand eingeschlossen",
        coverage: "Ja",
        source: "PDF-Seite 2",
        reviewStatus: "BELEGT",
      },
    });
    writeAtomicCategory(runA, "VS", "EXCLUDED");
    writeAtomicCategory(runB, "VS", "INCLUDED");

    const result = buildComparisonResult([runA, runB]);
    const comparisonRow = result.categories[0].rows[0];

    expect(result.schemaVersion).toBe(6);
    expect(comparisonRow.outcome).toBe("UNTERSCHIED_FACHLICH_PRÜFEN");
    expect(comparisonRow.pointDecision).toMatchObject({
      outcome: "VORTEIL_B",
      ruleId: "INCLUDED_OVER_EXCLUDED_V1",
      reviewRequired: false,
    });
    expect(result.totals.pointDecisions.VORTEIL_B).toBe(1);
    expect(result.totals.pointDecisions.UNKLAR).toBe(4);
    expect(result.totals).toMatchObject({
      customerReviewRequired: 4,
      noCustomerReviewRequired: 1,
      legacyTechnicalDifferences: 1,
    });
    expect(
      Object.values(result.totals.pointDecisions).reduce(
        (sum, count) => sum + count,
        0
      )
    ).toBe(result.totals.rows);
  });

  test("rejects a productive export when the profile row count is incomplete", async () => {
    const runA = writeRun(root, document("a", "A"));
    const runB = writeRun(root, document("b", "B"));

    await expect(
      writeComparisonArtifacts({
        documentRuns: [runA, runB],
        outputDirectory: path.join(root, "incomplete-result"),
        enforceProductProfile: true,
      })
    ).rejects.toThrow("COMPARISON_CATEGORY_ROW_COUNT_MISMATCH:VS:1:36");
  });

  test("turns an approved complete zero-occurrence search into an explicit comparison assumption", () => {
    const runA = writeRun(root, document("a", "A"), {
      VS: {
        documentedContent: "Versicherter Gegenstand eingeschlossen",
        coverage: "Ja",
        source: "PDF-Seite 1",
        reviewStatus: "BELEGT",
      },
    });
    const runB = writeRun(root, document("b", "B"));
    writeAtomicCategory(runA, "VS", "INCLUDED", {}, { certified: true });
    writeCompleteAbsenceCategory(runB, "VS");

    const result = buildComparisonResult([runA, runB]);
    const comparisonRow = result.categories[0].rows[0];

    expect(comparisonRow.packageB).toMatchObject({
      evidenceFound: false,
      searchDisposition: "NOT_FOUND_AFTER_COMPLETE_SEARCH",
      comparisonTreatment: "ASSUMED_NOT_INCLUDED_V1",
      reviewStatus: "NICHT_GEFUNDEN_NACH_VOLLSTÄNDIGER_PRÜFUNG",
    });
    expect(comparisonRow.packageB.documentedContent).toContain(
      "IM VOLLSTÄNDIG GEPRÜFTEN BEREITGESTELLTEN PAKET NICHT GEFUNDEN"
    );
    expect(comparisonRow.pointDecision).toMatchObject({
      outcome: "VORTEIL_A",
      ruleId: "INCLUDED_OVER_ASSUMED_NOT_INCLUDED_V1",
    });
    expect(comparisonRow.pointDecision.reason).toContain(
      "ausdrücklicher Ausschluss in Paket B ist damit nicht belegt"
    );
  });

  test("keeps a zero-occurrence search incomplete when one physical page has no text", () => {
    const runA = writeRun(root, document("a", "A"), {
      VS: {
        documentedContent: "Versicherter Gegenstand eingeschlossen",
        coverage: "Ja",
        source: "PDF-Seite 1",
        reviewStatus: "BELEGT",
      },
    });
    const runB = writeRun(root, document("b", "B"));
    writeAtomicCategory(runA, "VS", "INCLUDED", {}, { certified: true });
    writeCompleteAbsenceCategory(runB, "VS");
    const documentArtifactFile = path.join(
      runB.outputDirectory,
      "document.private.json"
    );
    const documentArtifact = JSON.parse(
      fs.readFileSync(documentArtifactFile, "utf8")
    );
    documentArtifact.document.pdfExtraction.totalPages = 2;
    documentArtifact.document.pdfExtraction.processedPages = 2;
    documentArtifact.document.pdfExtraction.pagesWithText = 1;
    documentArtifact.document.pageMap = [{ pageNumber: 1 }, { pageNumber: 2 }];
    fs.writeFileSync(documentArtifactFile, JSON.stringify(documentArtifact));

    const result = buildComparisonResult([runA, runB]);
    const comparisonRow = result.categories[0].rows[0];

    expect(comparisonRow.packageB.searchDisposition).toBe("SEARCH_INCOMPLETE");
    expect(comparisonRow.pointDecision).toMatchObject({
      outcome: "UNKLAR",
      reasonCode: "MISSING_ONE_SIDE",
    });
  });

  test("reports a general controlled zero match as a documentation difference without inventing coverage", () => {
    const runA = writeRun(root, document("a", "A"), {
      VS: {
        documentedContent: "Versicherter Gegenstand eingeschlossen",
        coverage: "Ja",
        source: "PDF-Seite 1",
        reviewStatus: "BELEGT",
      },
    });
    const runB = writeRun(root, document("b", "B"));
    writeAtomicCategory(runA, "VS", "INCLUDED");
    writeCompleteAbsenceCategory(runB, "VS", { certified: false });

    const result = buildComparisonResult([runA, runB]);
    const comparisonRow = result.categories[0].rows[0];

    expect(comparisonRow.packageB).toMatchObject({
      searchDisposition: "NO_MATCH_AFTER_COMPLETE_CONTROLLED_SEARCH",
      comparisonTreatment: "DOCUMENTATION_ONLY_V1",
      coverage: "Nicht feststellbar",
      reviewStatus: "KEIN_TREFFER_NACH_VOLLSTÄNDIGER_KONTROLLIERTER_SUCHE",
    });
    expect(comparisonRow.pointDecision).toMatchObject({
      schemaVersion: 3,
      outcome: "DOKUMENTATIONSUNTERSCHIED",
      ruleId: "QUALIFIED_ABSENCE_DOCUMENTATION_DIFFERENCE_V1",
      reviewRequired: false,
    });
    expect(result.totals.customerReviewRequired).toBe(
      result.totals.pointDecisions.UNKLAR
    );
    expect(result.totals).not.toHaveProperty("reviewRequired");
  });

  test("does not verify policy strings without persisted certification metadata", () => {
    const runA = writeRun(root, document("a", "A"), {
      VS: {
        documentedContent: "Versicherter Gegenstand eingeschlossen",
        coverage: "Ja",
        source: "PDF-Seite 1",
        reviewStatus: "BELEGT",
      },
    });
    const runB = writeRun(root, document("b", "B"));
    writeAtomicCategory(runA, "VS", "INCLUDED", {}, { certified: true });
    writeCompleteAbsenceCategory(runB, "VS");
    const worksheetFile = path.join(
      runB.outputDirectory,
      "VS",
      "worksheet.private.json"
    );
    const worksheet = JSON.parse(fs.readFileSync(worksheetFile, "utf8"));
    delete worksheet.requirements[0].absenceCertification;
    fs.writeFileSync(worksheetFile, JSON.stringify(worksheet));

    const comparisonRow = buildComparisonResult([runA, runB]).categories[0]
      .rows[0];
    expect(comparisonRow.packageB).toMatchObject({
      searchDisposition: "NO_MATCH_AFTER_COMPLETE_CONTROLLED_SEARCH",
      comparisonTreatment: "DOCUMENTATION_ONLY_V1",
    });
    expect(comparisonRow.pointDecision).toMatchObject({
      outcome: "DOKUMENTATIONSUNTERSCHIED",
      ruleId: "QUALIFIED_ABSENCE_DOCUMENTATION_DIFFERENCE_V1",
    });
  });

  test("checks only local bound-clause context for coverage conditions", () => {
    const evidencedRow = {
      VS: {
        documentedContent: "Versicherter Gegenstand",
        coverage: "Ja",
        source: "PDF-Seite 1",
        reviewStatus: "BELEGT",
      },
    };
    const runA = writeRun(root, document("a", "A"), evidencedRow);
    const runB = writeRun(root, document("b", "B"), evidencedRow);
    const unrelatedPrefix =
      "außer eine andere, weit entfernte Klausel ist betroffen; " +
      "neutraler Kontext ".repeat(30);
    const exactText = "Versicherter Gegenstand";
    const contextText = `${unrelatedPrefix}${exactText}`;
    const candidate = {
      exactText,
      contextText,
      contextDocumentStart: 100,
      documentStart: 100 + unrelatedPrefix.length,
      documentEnd: 100 + contextText.length,
    };
    writeAtomicCategory(runA, "VS", "INCLUDED", candidate);
    writeAtomicCategory(runB, "VS", "INCLUDED", candidate);

    const result = buildComparisonResult([runA, runB]);
    expect(result.categories[0].rows[0].pointDecision).toMatchObject({
      outcome: "GLEICHWERTIG",
      ruleId: "ATOMIC_COVERAGE_EQUALITY_V1",
    });
  });

  test("keeps an exception adjacent to a short evidence span fail-closed", () => {
    const evidencedRow = {
      VS: {
        documentedContent: "Versicherter Gegenstand",
        coverage: "Ja",
        source: "PDF-Seite 1",
        reviewStatus: "BELEGT",
      },
    };
    const runA = writeRun(root, document("a", "A"), evidencedRow);
    const runB = writeRun(root, document("b", "B"), evidencedRow);
    writeAtomicCategory(runA, "VS", "INCLUDED");
    writeAtomicCategory(runB, "VS", "INCLUDED", {
      contextText:
        "Versicherter Gegenstand, außer die besondere Voraussetzung fehlt",
      contextDocumentStart: 100,
      documentStart: 100,
      documentEnd: 122,
    });

    const result = buildComparisonResult([runA, runB]);
    expect(result.categories[0].rows[0].pointDecision).toMatchObject({
      outcome: "UNKLAR",
      reasonCode: "CONDITIONAL_OR_EXCEPTION_SCOPE",
      ruleId: "FAIL_CLOSED_CONDITIONAL_SOURCE_V1",
    });
  });
});

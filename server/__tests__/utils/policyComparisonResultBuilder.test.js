const fs = require("fs");
const os = require("os");
const path = require("path");
const ExcelJS = require("exceljs");
const {
  CATEGORY_ORDER,
  buildComparisonResult,
  comparePackages,
  materializeAtomicFacts,
  summarizePackage,
  writeComparisonArtifacts,
} = require("../../utils/policyComparison/resultBuilder");
const {
  buildFeC07ConditionAbsenceAudit,
} = require("../../utils/policyAnalysis/feC07ConditionAbsenceAudit");
const {
  validateCustomerComparison,
} = require("../../utils/policyComparison/customerMetricContract");
const {
  DETERMINISTIC_LW20_NON_TARGET_OCCURRENCE_TERMINAL_CONTRACT_ID,
  DETERMINISTIC_POST_LOSS_SCAFFOLDING_COST_TERMINAL_CONTRACT_ID,
  FE_C12_POST_LOSS_SCAFFOLDING_COST_DECISION_BASIS,
  FE_C12_POST_LOSS_SCAFFOLDING_COST_SCOPE_PROOF_MODE,
  OCCURRENCE_LOCAL_CLAUSE_SCOPE_SOURCE,
  LW20_NON_TARGET_OCCURRENCE_DECISION_BASIS,
  LW20_NON_TARGET_OCCURRENCE_SCOPE_PROOF_MODE,
  TERMINAL_OCCURRENCE_DIGEST_CONTRACT_ID,
  TERMINAL_REJECTION_SET_DIGEST_CONTRACT_ID,
  terminalOccurrenceDigest,
} = require("../../utils/policyAnalysis/deterministicTerminalRejectionContract");

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
  const documentApplicability = {
    ACTIVE: "ACTIVE",
    FRAMEWORK_TERMS: "CONDITIONAL",
    PROPOSAL: "PROPOSED_ONLY",
  }[run.document.documentStatus];
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
          scopePolicy: "GENERAL_REQUIRED",
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
          documentApplicability,
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

function writeFoundSearchSupport(run, categoryView) {
  const categoryDirectory = path.join(run.outputDirectory, categoryView);
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
  const worksheetFile = path.join(categoryDirectory, "worksheet.private.json");
  const worksheet = JSON.parse(fs.readFileSync(worksheetFile, "utf8"));
  worksheet.document = { physicalPages: 1 };
  worksheet.summary = { componentCount: 1 };
  fs.writeFileSync(worksheetFile, JSON.stringify(worksheet));
  fs.writeFileSync(
    path.join(categoryDirectory, "result", "report.json"),
    JSON.stringify({
      status: "PASS",
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

function writeScopeLimitCategory(run, selectedScopePicture) {
  const categoryView = "FE";
  const categoryDirectory = path.join(run.outputDirectory, categoryView);
  const requirementId = "FE-01";
  const componentId = "indirect_lightning_limit";
  const candidateId = `candidate-${run.document.uuid}-${categoryView}`;
  const documentApplicability = {
    ACTIVE: "ACTIVE",
    FRAMEWORK_TERMS: "CONDITIONAL",
    PROPOSAL: "PROPOSED_ONLY",
  }[run.document.documentStatus];
  fs.writeFileSync(
    path.join(categoryDirectory, "worksheet.private.json"),
    JSON.stringify({
      catalog: { id: "synthetic-scope-catalog-v1", categoryView },
      requirements: [
        {
          id: requirementId,
          label: "Betragsgrenze für Überspannungsschäden",
          requestedFields: ["limit"],
          componentSatisfactionPolicy: "ALL",
          scopePolicy: "GENERAL_REQUIRED",
          negativeSearchPolicy: "REPORT_COMPLETE_ZERO_CONTROLLED_SEARCH_V1",
          absenceMeaning: "VALUE_TERM",
          components: [
            {
              id: componentId,
              label: "Limit indirekter Blitzschlag",
              factRole: "LIMIT",
              aliases: ["indirekter Blitzschlag"],
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
          componentId,
          selectedCandidateIds: [candidateId],
          unresolvedCandidateIds: [],
          evidencePresence: "FOUND",
          coverageEffect: "DEFINED",
          conflictState: "NONE",
          selectedScopePicture,
          documentApplicability,
        },
      ],
    })
  );
  fs.writeFileSync(
    path.join(categoryDirectory, "effects", "targets.private.json"),
    JSON.stringify([
      {
        targetId: `target-${requirementId}`,
        factRole: "LIMIT",
        candidates: [
          {
            candidateId,
            physicalPageNumber: 1,
            exactText: "Indirekter Blitzschlag bis EUR 5.000 je Schadenfall",
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
          requestedFields: ["limit"],
          requestedFieldStatus: "COMPLETE",
          fields: [
            {
              field: "limit",
              status: "FOUND",
              facts: [
                {
                  normalizedValue: "EUR 5.000",
                  valueType: "MONEY",
                  unit: "EUR",
                  limitKind: "CAPPED",
                  qualifier: "je Schadenfall",
                  source: {
                    candidateId,
                    physicalPageNumber: 1,
                    exactText: "EUR 5.000",
                  },
                },
              ],
            },
          ],
        },
      ],
    })
  );
}

function writeScopeLimitNotFoundCategory(run) {
  const categoryView = "FE";
  const categoryDirectory = path.join(run.outputDirectory, categoryView);
  const requirementId = "FE-01";
  const componentId = "indirect_lightning_limit";
  fs.writeFileSync(
    path.join(categoryDirectory, "worksheet.private.json"),
    JSON.stringify({
      catalog: { id: "synthetic-scope-catalog-v1", categoryView },
      requirements: [
        {
          id: requirementId,
          label: "Betragsgrenze für Überspannungsschäden",
          requestedFields: ["limit"],
          componentSatisfactionPolicy: "ALL",
          scopePolicy: "GENERAL_REQUIRED",
          negativeSearchPolicy: "REPORT_COMPLETE_ZERO_CONTROLLED_SEARCH_V1",
          absenceMeaning: "VALUE_TERM",
          components: [
            {
              id: componentId,
              label: "Limit indirekter Blitzschlag",
              factRole: "LIMIT",
              aliases: ["indirekter Blitzschlag"],
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
          componentId,
          selectedCandidateIds: [],
          unresolvedCandidateIds: [],
          evidencePresence: "NOT_FOUND",
          coverageEffect: "UNKNOWN",
          conflictState: "NONE",
          selectedScopePicture: "UNKNOWN",
          documentApplicability: "UNKNOWN",
        },
      ],
    })
  );
  fs.writeFileSync(
    path.join(categoryDirectory, "effects", "targets.private.json"),
    JSON.stringify([
      {
        targetId: `target-${requirementId}`,
        factRole: "LIMIT",
        candidates: [],
      },
    ])
  );
  fs.writeFileSync(
    path.join(categoryDirectory, "result", "requested-fields.private.json"),
    JSON.stringify({
      requirements: [
        {
          requirementId,
          requestedFields: ["limit"],
          requestedFieldStatus: "NOT_FOUND",
          fields: [{ field: "limit", status: "NOT_FOUND", facts: [] }],
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

function writeEl12AbsenceCategory(run, { riskInformation = false } = {}) {
  const categoryView = "EL";
  const categoryDirectory = path.join(run.outputDirectory, categoryView);
  const requirementId = "EL-12";
  const componentId = "flood_zone_exclusion_or_surcharge";
  const targetId = `prepared-target:${requirementId}:${componentId}`;
  const occurrence = {
    candidateId: `candidate:el12-risk-information:${run.document.uuid}`,
    matchedAlias: "CONCEPT_SEARCH:flood-risk-zone",
    pageNumber: 3,
    physicalPageNumber: 3,
    documentStart: 4_120,
    documentEnd: 4_154,
    exactText: "Hochwasser-Risiko-Zone: unbekannt",
    context: {
      unitType: "LIST_ITEM",
      documentStart: 4_000,
      documentEnd: 4_200,
      text: "- Risikoinformation zum Versicherungsort\nAnzahl Vorschäden Hochwasser, Überschwemmungen, Lawinen oder Muren: keine Vorschäden\nHochwasser-Risiko-Zone: unbekannt",
      followingStructuralBoundaryProof: {
        contractId: "FOLLOWING_STRUCTURAL_BOUNDARY_PROOF_V1",
        origin: {
          physicalPageNumber: 3,
          documentStart: 4_000,
          documentEnd: 4_200,
        },
        kind: "EOF",
        physicalPageNumber: 3,
        documentStart: 4_200,
        documentEnd: 4_200,
        text: "",
        skippedRaw: {
          documentStart: 4_200,
          documentEnd: 4_200,
          complete: true,
          text: "",
        },
      },
    },
    scopeLead: {
      text: "STURMVERSICHERUNG\nVersicherte Variante: Premiumschutz",
    },
    pageScopeHints: [
      {
        scopeKey: "LEITUNGSWASSER_INSURANCE",
        text: "Die Leitungswasserversicherung",
      },
    ],
    sectionScopeHint: {
      scopeKey: "STURM_INSURANCE",
      text: "STURMVERSICHERUNG",
      physicalPageNumber: 3,
      source: "CURRENT_PAGE_HEADING",
    },
  };
  const scopeProofMode = "CURRENT_RISK_INFORMATION_WITH_STRUCTURAL_BOUNDARY_V2";
  const serverRejectedCandidates = riskInformation
    ? [
        {
          candidateId: occurrence.candidateId,
          reason: "TRIAGE_MENTION_ONLY",
          terminalRejectionContractId:
            "DETERMINISTIC_NON_CONTRACTUAL_RISK_INFORMATION_TERMINAL_V2",
          occurrenceDigestContractId: TERMINAL_OCCURRENCE_DIGEST_CONTRACT_ID,
          decisionOwner: "SERVER",
          decisionBasis: "EXPLICIT_NON_CONTRACTUAL_RISK_INFORMATION",
          physicalPageNumber: 3,
          sectionScopeSource: "CURRENT_PAGE_HEADING",
          observedScopeKeys: ["LEITUNGSWASSER_INSURANCE", "STURM_INSURANCE"],
          scopeProofMode,
          occurrenceDigestSha256: terminalOccurrenceDigest({
            ...occurrence,
            scopeProofMode,
          }),
        },
      ]
    : [];
  fs.writeFileSync(
    path.join(run.outputDirectory, "document.private.json"),
    JSON.stringify({
      schemaVersion: 1,
      fingerprint: run.document.sha256,
      document: {
        sourceDocumentId: run.document.sha256,
        pdfExtraction: {
          schemaVersion: 1,
          totalPages: 3,
          processedPages: 3,
          pagesWithText: 3,
          complete: true,
        },
      },
    })
  );
  fs.writeFileSync(
    path.join(categoryDirectory, "worksheet.private.json"),
    JSON.stringify({
      catalog: { id: "el-occurrence-full-draft-v0.8", categoryView },
      document: { physicalPages: 3 },
      summary: { componentCount: 1 },
      requirements: [
        {
          id: requirementId,
          label: "Hochwasserzone: Ausschluss oder Zuschlag",
          requestedFields: [],
          componentSatisfactionPolicy: "ALL",
          negativeSearchPolicy: "REPORT_COMPLETE_ZERO_CONTROLLED_SEARCH_V1",
          absenceMeaning: "CONDITION_ONLY",
          components: [
            {
              id: componentId,
              label: "Hochwasserzone: Ausschluss oder Zuschlag",
              factRole: "CONDITION",
              followingStructuralBoundaryProofContractId:
                "FOLLOWING_STRUCTURAL_BOUNDARY_PROOF_V1",
              aliases: ["Hochwasser-Risiko-Zone"],
              conceptSearches: [{ id: "flood-risk-zone" }],
              terminalState: riskInformation
                ? "CONTROLLED_CANDIDATES_FOUND"
                : "NO_CONTROLLED_CANDIDATE",
              occurrenceCount: riskInformation ? 1 : 0,
              occurrences: riskInformation ? [occurrence] : [],
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
        factRole: "CONDITION",
        candidates: [],
        serverRejectedCandidates,
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
    path.join(categoryDirectory, "result", "rows.private.json"),
    JSON.stringify([row(requirementId)])
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

function writeFeC12AbsenceCategory(run, { postLossCost = false } = {}) {
  const categoryView = "FE";
  const categoryDirectory = path.join(run.outputDirectory, categoryView);
  const requirementId = "FE-C12";
  const componentIds = ["scaffolding", "site_equipment", "renovation_scope"];
  const contextText =
    "9.1.10 Für versicherte Gläser werden Reparaturkosten, Kosten für notwendige Gerüste und Notverglasung ersetzt.\n9.1.11 Besonders vereinbarte Leistungen";
  const exactText = "Gerüste";
  const relativeStart = contextText.indexOf(exactText);
  const contextStart = 7_000;
  const occurrence = {
    candidateId: `candidate:fe-c12-post-loss:${run.document.uuid}`,
    matchedAlias: exactText,
    pageNumber: 7,
    physicalPageNumber: 7,
    documentStart: contextStart + relativeStart,
    documentEnd: contextStart + relativeStart + exactText.length,
    exactText,
    context: {
      unitType: "PARAGRAPH",
      documentStart: contextStart,
      documentEnd: contextStart + contextText.length,
      text: contextText,
    },
    scopeLead: null,
    pageScopeHints: [],
    sectionScopeHint: null,
  };
  const rejection = {
    candidateId: occurrence.candidateId,
    reason: "TRIAGE_MENTION_ONLY",
    terminalRejectionContractId:
      DETERMINISTIC_POST_LOSS_SCAFFOLDING_COST_TERMINAL_CONTRACT_ID,
    occurrenceDigestContractId: TERMINAL_OCCURRENCE_DIGEST_CONTRACT_ID,
    decisionOwner: "SERVER",
    decisionBasis: FE_C12_POST_LOSS_SCAFFOLDING_COST_DECISION_BASIS,
    physicalPageNumber: 7,
    sectionScopeSource: OCCURRENCE_LOCAL_CLAUSE_SCOPE_SOURCE,
    observedScopeKeys: [],
    scopeProofMode: FE_C12_POST_LOSS_SCAFFOLDING_COST_SCOPE_PROOF_MODE,
    occurrenceDigestSha256: terminalOccurrenceDigest({
      ...occurrence,
      scopeProofMode: FE_C12_POST_LOSS_SCAFFOLDING_COST_SCOPE_PROOF_MODE,
    }),
  };

  fs.writeFileSync(
    path.join(run.outputDirectory, "document.private.json"),
    JSON.stringify({
      schemaVersion: 1,
      fingerprint: run.document.sha256,
      document: {
        sourceDocumentId: run.document.sha256,
        pdfExtraction: {
          schemaVersion: 1,
          totalPages: 7,
          processedPages: 7,
          pagesWithText: 7,
          complete: true,
        },
      },
    })
  );
  fs.writeFileSync(
    path.join(categoryDirectory, "worksheet.private.json"),
    JSON.stringify({
      catalog: { id: "fe-occurrence-full-draft-v0.7", categoryView },
      document: { physicalPages: 7 },
      summary: { componentCount: componentIds.length },
      requirements: [
        {
          id: requirementId,
          label: "Gerüste und Baustelleneinrichtung",
          requestedFields: [],
          componentSatisfactionPolicy: "ALL",
          negativeSearchPolicy: "REPORT_COMPLETE_ZERO_CONTROLLED_SEARCH_V1",
          absenceMeaning: "COVERAGE_MIXED",
          components: componentIds.map((componentId) => ({
            id: componentId,
            label: componentId,
            factRole:
              componentId === "renovation_scope"
                ? "CONDITION"
                : "INSURED_OBJECT",
            aliases: [componentId === "scaffolding" ? "Gerüste" : componentId],
            terminalState:
              postLossCost && componentId === "scaffolding"
                ? "CONTROLLED_CANDIDATES_FOUND"
                : "NO_CONTROLLED_CANDIDATE",
            occurrenceCount:
              postLossCost && componentId === "scaffolding" ? 1 : 0,
            occurrences:
              postLossCost && componentId === "scaffolding" ? [occurrence] : [],
          })),
        },
      ],
    })
  );
  fs.mkdirSync(path.join(categoryDirectory, "effects"), { recursive: true });
  fs.writeFileSync(
    path.join(categoryDirectory, "effects", "materialized.private.json"),
    JSON.stringify({
      judgements: componentIds.map((componentId) => ({
        targetId: `prepared-target:${requirementId}:${componentId}`,
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
      })),
    })
  );
  fs.writeFileSync(
    path.join(categoryDirectory, "effects", "targets.private.json"),
    JSON.stringify(
      componentIds.map((componentId) => ({
        targetId: `prepared-target:${requirementId}:${componentId}`,
        requirementId,
        componentId,
        factRole:
          componentId === "renovation_scope" ? "CONDITION" : "INSURED_OBJECT",
        candidates: [],
        serverRejectedCandidates:
          postLossCost && componentId === "scaffolding" ? [rejection] : [],
        unresolvedCandidateIds: [],
      }))
    )
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
    path.join(categoryDirectory, "result", "rows.private.json"),
    JSON.stringify([row(requirementId)])
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

function writeLw20AbsenceCategory(
  run,
  { treatmentCost = false, excluded = false } = {}
) {
  const categoryView = "LW";
  const categoryDirectory = path.join(run.outputDirectory, categoryView);
  const requirementId = "LW-20";
  const componentId = "ground_seepage_or_retained_water";
  const contextText = excluded
    ? "Nicht versichert sind Schäden durch Grundwasser, Sickerwasser oder Stauwasser."
    : "Die Kosten für die Behandlung von nicht versicherten Sachen, z.B. Wasser (inkl. Grundwasser), Luft und Erdreich, werden nicht ersetzt, auch dann nicht, wenn sie mit versicherten Sachen vermischt werden.";
  const exactText = "Grundwasser";
  const contextStart = 46_775;
  const relativeStart = contextText.indexOf(exactText);
  const occurrence = {
    candidateId: `candidate:lw20-${excluded ? "excluded" : "treatment-cost"}:${run.document.uuid}`,
    matchedAlias: exactText,
    pageNumber: 22,
    physicalPageNumber: 22,
    documentStart: contextStart + relativeStart,
    documentEnd: contextStart + relativeStart + exactText.length,
    exactText,
    context: {
      unitType: "PARAGRAPH",
      documentStart: contextStart,
      documentEnd: contextStart + contextText.length,
      text: contextText,
    },
    scopeLead: { text: contextText.slice(0, relativeStart) },
    pageScopeHints: excluded
      ? [
          {
            scopeKey: "LEITUNGSWASSER_INSURANCE",
            text: "Allgemeine Bedingungen für die Leitungswasserversicherung",
          },
        ]
      : [],
    sectionScopeHint: excluded
      ? {
          scopeKey: "LEITUNGSWASSER_INSURANCE",
          text: "Allgemeine Bedingungen für die Leitungswasserversicherung",
          source: "CURRENT_PAGE_HEADING",
          physicalPageNumber: 22,
        }
      : null,
  };
  const rejection = {
    candidateId: occurrence.candidateId,
    reason: "TRIAGE_MENTION_ONLY",
    terminalRejectionContractId:
      DETERMINISTIC_LW20_NON_TARGET_OCCURRENCE_TERMINAL_CONTRACT_ID,
    occurrenceDigestContractId: TERMINAL_OCCURRENCE_DIGEST_CONTRACT_ID,
    decisionOwner: "SERVER",
    decisionBasis: LW20_NON_TARGET_OCCURRENCE_DECISION_BASIS,
    physicalPageNumber: 22,
    sectionScopeSource: OCCURRENCE_LOCAL_CLAUSE_SCOPE_SOURCE,
    observedScopeKeys: [],
    scopeProofMode: LW20_NON_TARGET_OCCURRENCE_SCOPE_PROOF_MODE,
    occurrenceDigestSha256: terminalOccurrenceDigest({
      ...occurrence,
      scopeProofMode: LW20_NON_TARGET_OCCURRENCE_SCOPE_PROOF_MODE,
    }),
  };

  const artifactPageTexts = Array.from({ length: 22 }, (_, index) =>
    index === 21 ? contextText : `Dokumentseite ${index + 1}`
  );
  let pageContent = "";
  const pageMap = artifactPageTexts.map((text, index) => {
    if (pageContent) pageContent += "\n\f\n";
    const start = pageContent.length;
    pageContent += text;
    return { pageNumber: index + 1, start, end: pageContent.length };
  });

  fs.writeFileSync(
    path.join(run.outputDirectory, "document.private.json"),
    JSON.stringify({
      schemaVersion: 1,
      fingerprint: run.document.sha256,
      document: {
        sourceDocumentId: run.document.sha256,
        pageContent,
        pageMap,
        pdfExtraction: {
          schemaVersion: 1,
          totalPages: 22,
          processedPages: 22,
          pagesWithText: 22,
          complete: true,
        },
      },
    })
  );
  fs.writeFileSync(
    path.join(categoryDirectory, "worksheet.private.json"),
    JSON.stringify({
      catalog: { id: "lw-occurrence-full-draft-v0.8", categoryView },
      document: { physicalPages: 22 },
      summary: { componentCount: 1 },
      requirements: [
        {
          id: requirementId,
          label: "Grundwasser, Sickerwasser oder Stauwasser",
          requestedFields: [],
          componentSatisfactionPolicy: "ALL",
          negativeSearchPolicy: "REPORT_COMPLETE_ZERO_CONTROLLED_SEARCH_V1",
          absenceMeaning: "COVERAGE_ONLY",
          components: [
            {
              id: componentId,
              label: "Grundwasser, Sickerwasser oder Stauwasser",
              factRole: "PERIL",
              aliases: ["Grundwasser", "Sickerwasser", "Stauwasser"],
              terminalState:
                treatmentCost || excluded
                  ? "CONTROLLED_CANDIDATES_FOUND"
                  : "NO_CONTROLLED_CANDIDATE",
              occurrenceCount: treatmentCost || excluded ? 1 : 0,
              occurrences: treatmentCost || excluded ? [occurrence] : [],
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
          targetId: `prepared-target:${requirementId}:${componentId}`,
          requirementId,
          componentId,
          selectedCandidateIds: excluded ? [occurrence.candidateId] : [],
          unresolvedCandidateIds: [],
          evidencePresence: excluded ? "FOUND" : "NOT_FOUND",
          coverageEffect: excluded ? "EXCLUDED" : "UNKNOWN",
          conflictState: "NONE",
          selectedScopePicture: excluded ? "GENERAL" : "UNKNOWN",
          documentApplicability: excluded ? "ACTIVE" : "UNKNOWN",
          decisionOwner: "SERVER",
        },
      ],
    })
  );
  fs.writeFileSync(
    path.join(categoryDirectory, "effects", "targets.private.json"),
    JSON.stringify([
      {
        targetId: `prepared-target:${requirementId}:${componentId}`,
        requirementId,
        componentId,
        factRole: "PERIL",
        candidates: excluded
          ? [
              {
                ...occurrence,
                binding: "DIRECT",
                role: "COVERAGE",
                scopePicture: "GENERAL",
                effect: "EXCLUDED",
              },
            ]
          : [],
        serverRejectedCandidates: treatmentCost ? [rejection] : [],
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
    path.join(categoryDirectory, "result", "rows.private.json"),
    JSON.stringify([
      row(
        requirementId,
        excluded
          ? {
              documentedContent: contextText,
              coverage: "Nein",
              source: `S. ${occurrence.physicalPageNumber}: ${contextText}`,
              reviewStatus: "BELEGT",
            }
          : {}
      ),
    ])
  );
  fs.writeFileSync(
    path.join(categoryDirectory, "result", "report.json"),
    JSON.stringify({
      status: excluded ? "PASS" : "TECHNICAL_PASS_REVIEW_REQUIRED",
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
  test("preserves only a valid selected FE-C07 condition-absence audit in the comparison atom", () => {
    const candidateId = "candidate:fe-c07-result-builder";
    const clause =
      "AW03 Gemeinschaftseinrichtungen Mitversichert sind Gemeinschaftseinrichtungen bis zu jeweils 10% der Gebäudeversicherungssumme auf Erstes Risiko. Das sind Gemeinschaftsräume wie Saunen und Fitnessräume.";
    const occurrenceExactText = "Gemeinschaftsräume wie Saunen";
    const occurrenceStart = clause.indexOf(occurrenceExactText);
    const absenceAudit = buildFeC07ConditionAbsenceAudit({
      binding: "DIRECT",
      occurrence: {
        candidateId,
        physicalPageNumber: 4,
        exactText: occurrenceExactText,
        documentStart: 10_000 + occurrenceStart,
        documentEnd: 10_000 + occurrenceStart + occurrenceExactText.length,
        context: {
          unitType: "PARAGRAPH",
          text: clause,
          documentStart: 10_000,
          documentEnd: 10_000 + clause.length,
        },
      },
    });
    const worksheet = {
      catalog: { id: "fe-occurrence-full-draft-v0.7" },
      requirements: [
        {
          id: "FE-C07",
          requestedFields: ["limit"],
          optionalFields: ["condition"],
          componentSatisfactionPolicy: "ALL",
          components: [
            {
              id: "sauna_or_infrared_cabin_in_common_room",
              label: "Sauna im Gemeinschaftsraum",
              factRole: "INSURED_OBJECT",
            },
          ],
        },
      ],
    };
    const materializedEvidence = {
      judgements: [
        {
          targetId: "target:fe-c07",
          requirementId: "FE-C07",
          componentId: "sauna_or_infrared_cabin_in_common_room",
          evidencePresence: "FOUND",
          coverageEffect: "INCLUDED",
          conflictState: "NONE",
          selectedScopePicture: "GENERAL",
          documentApplicability: "CONDITIONAL",
          selectedCandidateIds: [candidateId],
          unresolvedCandidateIds: [],
        },
      ],
    };
    const requestedFields = {
      requirements: [
        {
          requirementId: "FE-C07",
          requestedFieldStatus: "COMPLETE",
          fields: [
            {
              field: "limit",
              status: "FOUND",
              facts: [
                {
                  normalizedValue: "10 %",
                  valueType: "PERCENT",
                  unit: "%",
                  limitKind: "CAPPED",
                  qualifier:
                    "jeweils; auf Erstes Risiko; Bezugsgröße Gebäudeversicherungssumme",
                  source: {
                    candidateId,
                    physicalPageNumber: 4,
                    exactText: "10%",
                    documentStart: 10_000 + clause.indexOf("10%"),
                    documentEnd: 10_000 + clause.indexOf("10%") + "10%".length,
                  },
                },
              ],
            },
            {
              field: "condition",
              status: "NOT_FOUND",
              facts: [],
              absenceAudit,
            },
          ],
        },
      ],
    };
    const targets = [
      {
        targetId: "target:fe-c07",
        candidates: [
          {
            candidateId,
            physicalPageNumber: 4,
            exactText: occurrenceExactText,
            contextText: clause,
            contextDocumentStart: 10_000,
            documentStart: 10_000 + occurrenceStart,
            documentEnd: 10_000 + occurrenceStart + occurrenceExactText.length,
          },
        ],
      },
    ];
    const input = {
      document: {
        uuid: "document-fe-c07",
        role: "SUPPLEMENTAL_CONTRACT",
        documentStatus: "FRAMEWORK_TERMS",
      },
      worksheet,
      materializedEvidence,
      requestedFields,
      targets,
      documentArtifact: null,
      report: null,
    };

    const [atom] = materializeAtomicFacts(input);
    expect(atom.fields[1].absenceAudit).toEqual(absenceAudit);

    const tamperedRequestedFields = JSON.parse(JSON.stringify(requestedFields));
    tamperedRequestedFields.requirements[0].fields[1].absenceAudit.source.exactTextSha256 =
      "0".repeat(64);
    const [tamperedAtom] = materializeAtomicFacts({
      ...input,
      requestedFields: tamperedRequestedFields,
    });
    expect(tamperedAtom.fields[1]).not.toHaveProperty("absenceAudit");
  });
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

  test("neutralizes only matching server status prefixes in the derived legacy comparison", () => {
    const packageA = {
      evidenceFound: true,
      reviewStatus: "BELEGT",
      facts: [
        {
          documentedContent: "Gebäudeschutz ist eingeschlossen",
          coverage: "Ja",
          coverageAmount: "EUR 5.000",
          documentStatus: "ACTIVE",
        },
      ],
    };
    const packageB = {
      evidenceFound: true,
      reviewStatus: "BELEGT",
      facts: [
        {
          documentedContent:
            "Vorschlag (PROPOSED_ONLY): Gebäudeschutz ist eingeschlossen",
          coverage: "Ja",
          coverageAmount: "EUR 5.000",
          documentStatus: "PROPOSAL",
        },
        {
          documentedContent:
            "Rahmenbedingung (FRAMEWORK_TERMS): Gebäudeschutz ist eingeschlossen",
          coverage: "Ja",
          coverageAmount: "EUR 5.000",
          documentStatus: "FRAMEWORK_TERMS",
        },
      ],
    };
    const rawBefore = JSON.stringify(packageB.facts);
    expect(comparePackages(packageA, packageB).outcome).toBe(
      "INHALTLICH_GLEICH"
    );
    expect(JSON.stringify(packageB.facts)).toBe(rawBefore);

    expect(
      comparePackages(packageA, {
        ...packageB,
        reviewStatus: "TEILBELEGT",
      }).outcome
    ).toBe("UNTERSCHIED_FACHLICH_PRÜFEN");

    expect(
      comparePackages(packageA, {
        evidenceFound: true,
        reviewStatus: "BELEGT",
        facts: [packageA.facts[0], { ...packageA.facts[0] }],
      }).outcome
    ).toBe("UNTERSCHIED_FACHLICH_PRÜFEN");

    const mismatchedPrefix = {
      evidenceFound: true,
      reviewStatus: "BELEGT",
      facts: [
        {
          ...packageB.facts[0],
          documentStatus: "ACTIVE",
        },
      ],
    };
    expect(comparePackages(packageA, mismatchedPrefix).outcome).toBe(
      "UNTERSCHIED_FACHLICH_PRÜFEN"
    );
  });

  test("materializes active, framework and proposal facts as one BELEGT package-member comparison", () => {
    const rowOverrides = (prefix = "") =>
      Object.fromEntries(
        CATEGORY_ORDER.map((categoryView) => [
          categoryView,
          {
            documentedContent: `${prefix}Versicherter Gegenstand`,
            coverage: "Ja",
            source: "PDF-Seite 1",
            reviewStatus: "BELEGT",
          },
        ])
      );
    const activeRun = writeRun(root, document("active", "A"), rowOverrides());
    const proposalRun = writeRun(
      root,
      {
        ...document("proposal", "B", "OTHER"),
        documentStatus: "PROPOSAL",
      },
      rowOverrides("Vorschlag (PROPOSED_ONLY): ")
    );
    const frameworkRun = writeRun(
      root,
      {
        ...document("framework", "B", "TERMS"),
        documentStatus: "FRAMEWORK_TERMS",
      },
      rowOverrides("Rahmenbedingung (FRAMEWORK_TERMS): ")
    );
    for (const run of [activeRun, proposalRun, frameworkRun])
      for (const categoryView of CATEGORY_ORDER)
        writeAtomicCategory(run, categoryView, "INCLUDED");

    for (const run of [activeRun, proposalRun, frameworkRun]) {
      const worksheetFile = path.join(
        run.outputDirectory,
        "VS",
        "worksheet.private.json"
      );
      const worksheet = JSON.parse(fs.readFileSync(worksheetFile, "utf8"));
      worksheet.requirements[0].optionalFields = ["limit"];
      fs.writeFileSync(worksheetFile, JSON.stringify(worksheet));
      const requestedFieldsFile = path.join(
        run.outputDirectory,
        "VS",
        "result",
        "requested-fields.private.json"
      );
      const requested = JSON.parse(
        fs.readFileSync(requestedFieldsFile, "utf8")
      );
      requested.requirements[0].optionalFields = ["limit"];
      requested.requirements[0].fields = [
        { field: "limit", status: "NOT_FOUND", facts: [] },
      ];
      fs.writeFileSync(requestedFieldsFile, JSON.stringify(requested));
    }

    const result = buildComparisonResult([
      activeRun,
      proposalRun,
      frameworkRun,
    ]);
    expect(validateCustomerComparison(result)).toMatchObject({
      rows: 5,
      customerReviewRequired: 0,
    });
    for (const row of result.categories.flatMap(({ rows }) => rows)) {
      expect(row).toMatchObject({
        outcome: "INHALTLICH_GLEICH",
        packageA: { reviewStatus: "BELEGT" },
        packageB: { reviewStatus: "BELEGT" },
        pointDecision: {
          outcome: "GLEICHWERTIG",
          reviewRequired: false,
        },
      });
      expect(row.pointDecision.dimensions[0].b.contributors).toHaveLength(2);
      expect(
        row.pointDecision.dimensions[0].b.contributors.map(
          ({ documentStatus }) => documentStatus
        )
      ).toEqual(["FRAMEWORK_TERMS", "PROPOSAL"]);
    }
    expect(
      result.categories.find(({ categoryView }) => categoryView === "VS")
        .rows[0].pointDecision.dimensions[0].b.contributors[0]
    ).toMatchObject({
      optionalFields: ["limit"],
      fields: [{ field: "limit", status: "NOT_FOUND", facts: [] }],
    });
    expect(
      result.categories[0].rows[0].packageB.facts[0].documentedContent
    ).toMatch(/^(?:Vorschlag|Rahmenbedingung)/u);
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
    expect(result.totals.customerReviewRequired).toBe(5);
    expect(result.totals.customerReviewRequired).toBe(
      result.totals.pointDecisions.UNKLAR
    );
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
      id: "CUSTOMER_CORE_5_V25_LW20_ALIAS_FREE_OVERRIDE_AUDIT",
      comparisonContractId: "PACKAGE_FIRST_QUALIFIED_INCLUSION_ABSENCE_V1",
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

    expect(result.schemaVersion).toBe(11);
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

  test("persists schema V8 package review diagnostics without changing the customer outcome", () => {
    const runA = writeRun(root, document("a", "A"), {
      VS: {
        documentedContent: "Teilweise belegter Gegenstand",
        coverage: "Nicht feststellbar",
        source: "PDF-Seite 1",
        reviewStatus: "TEILBELEGT",
      },
    });
    const runB = writeRun(root, document("b", "B"), {
      VS: {
        documentedContent: "Versicherter Gegenstand eingeschlossen",
        coverage: "Ja",
        source: "PDF-Seite 1",
        reviewStatus: "BELEGT",
      },
    });
    writeAtomicCategory(runA, "VS", "INCLUDED");
    writeAtomicCategory(runB, "VS", "INCLUDED");
    const worksheetFile = path.join(
      runA.outputDirectory,
      "VS",
      "worksheet.private.json"
    );
    const worksheet = JSON.parse(fs.readFileSync(worksheetFile, "utf8"));
    worksheet.requirements[0].scopePolicy = "GENERAL_REQUIRED";
    fs.writeFileSync(worksheetFile, JSON.stringify(worksheet));

    const result = buildComparisonResult([runA, runB]);
    const comparisonRow = result.categories[0].rows[0];

    expect(result.schemaVersion).toBe(11);
    expect(comparisonRow.pointDecision).toMatchObject({
      outcome: "UNKLAR",
      reasonCode: "PACKAGE_REVIEW_STATUS_BLOCKS_DECISION",
      reviewRequired: true,
      packageReviewAudit: {
        schemaVersion: 2,
        contractId: "PACKAGE_REVIEW_BLOCKERS_V2",
        packageStatuses: { A: "TEILBELEGT", B: "BELEGT" },
      },
    });
    expect(comparisonRow.pointDecision.packageReviewAudit.blockers).toEqual([
      expect.objectContaining({
        code: "UNCLASSIFIED_DOCUMENT_REVIEW_BLOCKER",
        side: "A",
        documentUuids: ["a"],
      }),
    ]);
    expect(result.totals).toMatchObject({
      rows: 5,
      customerReviewRequired: 5,
    });
  });

  test("materializes a sole scope blocker as a validated V8 non-comparable result", () => {
    const runA = writeRun(root, document("a", "A"), {
      FE: {
        documentedContent: "Allgemeines Limit für indirekten Blitzschlag",
        coverage: "Ja",
        coverageAmount: "EUR 5.000",
        source: "PDF-Seite 1",
        reviewStatus: "BELEGT",
      },
    });
    const runB = writeRun(root, document("b", "B", "SUPPLEMENT"), {
      FE: {
        documentedContent: "Limit nur für Erdkabel",
        coverage: "Nicht feststellbar",
        coverageAmount: "Nicht feststellbar",
        source: "PDF-Seite 1",
        reviewStatus: "TEILBELEGT",
      },
    });
    writeScopeLimitCategory(runA, "GENERAL");
    writeScopeLimitCategory(runB, "NARROW_ONLY");
    const nullRuns = Array.from({ length: 8 }, (_, index) => {
      const run = writeRun(root, document(`n${index + 1}`, "B", "TERMS"));
      writeScopeLimitNotFoundCategory(run);
      return run;
    });

    const result = buildComparisonResult([runA, runB, ...nullRuns]);
    const comparisonRow = result.categories.find(
      ({ categoryView }) => categoryView === "FE"
    ).rows[0];

    expect(comparisonRow.pointDecision).toMatchObject({
      outcome: "NICHT_VERGLEICHBAR",
      reasonCode: "COMPARABILITY_GATE_FAILED",
      ruleId: "SOLE_SCOPE_REVIEW_BLOCKER_TO_ATOMIC_NONCOMPARABLE_V1",
      reviewRequired: false,
    });
    expect(comparisonRow.pointDecision).not.toHaveProperty(
      "packageReviewAudit"
    );
    expect(result.totals).toMatchObject({
      rows: 5,
      customerReviewRequired: 4,
      noCustomerReviewRequired: 1,
    });
    expect(validateCustomerComparison(result)).toMatchObject({
      rows: 5,
      customerReviewRequired: 4,
    });
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
    writeFoundSearchSupport(runA, "VS");
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
      ruleId: "INCLUDED_OVER_QUALIFIED_ABSENCE_V1",
    });
    expect(comparisonRow.pointDecision.reason).toContain(
      "ausdrücklicher Ausschluss in Polizze B ist damit nicht belegt"
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

  test("reports a qualified pure inclusion over controlled absence as a documented advantage", () => {
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
    writeFoundSearchSupport(runA, "VS");
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
      schemaVersion: 5,
      outcome: "VORTEIL_A",
      ruleId: "INCLUDED_OVER_QUALIFIED_ABSENCE_V1",
      reasonCode: "INCLUDED_OVER_QUALIFIED_ABSENCE",
      reviewRequired: false,
      unilateralCoverageAbsenceAudit: {
        schemaVersion: 1,
        contractId: "QUALIFIED_COVERAGE_OVER_ABSENCE_AUDIT_V1",
        eligible: true,
        evidencedSide: "A",
        absentSide: "B",
      },
    });
    expect(comparisonRow.pointDecision.reason).toContain(
      "keine entsprechende Regelung gefunden"
    );
    expect(comparisonRow.pointDecision.reason).toContain(
      "ausdrücklicher Ausschluss in Polizze B ist damit nicht belegt"
    );
    for (const mutate of [
      (tampered) =>
        delete tampered.categories[0].rows[0].pointDecision
          .unilateralCoverageAbsenceAudit,
      (tampered) =>
        (tampered.categories[0].rows[0].pointDecision.unilateralCoverageAbsenceAudit.eligible =
          false),
      (tampered) =>
        (tampered.categories[0].rows[0].pointDecision.ruleId =
          "QUALIFIED_ABSENCE_DOCUMENTATION_DIFFERENCE_V2"),
      (tampered) =>
        (tampered.categories[0].rows[0].pointDecision.unilateralCoverageAbsenceAudit.absence.physicalPagesChecked += 1),
    ]) {
      const tampered = JSON.parse(JSON.stringify(result));
      mutate(tampered);
      expect(() => validateCustomerComparison(tampered)).toThrow(
        /^COMPARISON_UNILATERAL_/u
      );
    }
    expect(result.totals.customerReviewRequired).toBe(
      result.totals.pointDecisions.UNKLAR
    );
    expect(result.totals).not.toHaveProperty("reviewRequired");
  });

  test("materializes bilateral complete controlled absence as comparison equality with an audit", () => {
    const runA = writeRun(root, document("a", "A"));
    const runB = writeRun(root, document("b", "B"));
    writeCompleteAbsenceCategory(runA, "VS", { certified: false });
    writeCompleteAbsenceCategory(runB, "VS", { certified: false });

    const result = buildComparisonResult([runA, runB]);
    const comparisonRow = result.categories[0].rows[0];

    expect(result.schemaVersion).toBe(11);
    expect(comparisonRow).toMatchObject({
      outcome: "BEIDSEITIG_VOLLSTÄNDIG_NICHT_GEFUNDEN",
      pointDecision: {
        schemaVersion: 4,
        outcome: "GLEICHWERTIG",
        reasonCode: "EQUAL_COMPLETE_CONTROLLED_ABSENCE_BOTH",
        ruleId: "EQUAL_COMPLETE_CONTROLLED_ABSENCE_BOTH_V1",
        comparisonTreatment: "EQUAL_COMPLETE_CONTROLLED_ABSENCE_BOTH_V1",
        reviewRequired: false,
      },
    });
    expect(comparisonRow.pointDecision.bilateralAbsenceAudit).toMatchObject({
      schemaVersion: 1,
      contractId: "BILATERAL_QUALIFIED_ABSENCE_AUDIT_V1",
      categoryId: "VS-01",
    });
    expect(comparisonRow.packageA.coverage).toBe("Nicht feststellbar");
    expect(comparisonRow.packageB.coverage).toBe("Nicht feststellbar");

    for (const mutate of [
      (tampered) =>
        delete tampered.categories[0].rows[0].pointDecision
          .bilateralAbsenceAudit,
      (tampered) =>
        (tampered.categories[0].rows[0].pointDecision.ruleId =
          "ATOMIC_COVERAGE_EQUALITY_V1"),
      (tampered) =>
        (tampered.categories[0].rows[0].pointDecision.bilateralAbsenceAudit.sides[0].physicalPagesChecked += 1),
      (tampered) =>
        (tampered.categories[0].rows[0].packageA.searchAudit.components[0].gates.completeTextExtraction =
          false),
      (tampered) => {
        const decision = tampered.categories[0].rows[0].pointDecision;
        decision.outcome = "KEIN_DOKUMENTIERTER_VORTEIL";
        decision.reasonCode = "VERIFIED_ABSENCE_BOTH";
        decision.ruleId = "COMPLETE_SEARCH_ABSENCE_BOTH_V1";
        decision.comparisonTreatment = "DOCUMENTATION_ONLY_V1";
        delete decision.bilateralAbsenceAudit;
      },
      (tampered) =>
        tampered.documents.push({
          ...tampered.documents.find(({ side }) => side === "B"),
          uuid: "unrepresented-package-document",
        }),
    ]) {
      const tampered = JSON.parse(JSON.stringify(result));
      mutate(tampered);
      expect(() => validateCustomerComparison(tampered)).toThrow(
        /^COMPARISON_BILATERAL_ABSENCE_/u
      );
    }
  });

  test("revalidates an occurrence-bound FE-C12 post-loss-cost terminal audit from files", () => {
    const runA = writeRun(root, document("a", "A"));
    const runB = writeRun(root, document("b", "B"));
    writeFeC12AbsenceCategory(runA);
    writeFeC12AbsenceCategory(runB, { postLossCost: true });

    const result = buildComparisonResult([runA, runB]);
    const comparisonRow = result.categories
      .find(({ categoryView }) => categoryView === "FE")
      .rows.find(({ categoryId }) => categoryId === "FE-C12");
    const componentAudit = comparisonRow.packageB.searchAudit.components.find(
      ({ searchPlanId }) => searchPlanId.endsWith("/scaffolding")
    );
    expect(componentAudit).toMatchObject({
      disposition: "NO_MATCH_AFTER_COMPLETE_CONTROLLED_SEARCH",
      gates: {
        zeroOccurrenceTerminal: false,
        zeroCandidateTerminal: false,
        deterministicPostLossScaffoldingCostTerminal: true,
      },
      terminalRejectionAudit: {
        schemaVersion: 3,
        contractId:
          DETERMINISTIC_POST_LOSS_SCAFFOLDING_COST_TERMINAL_CONTRACT_ID,
        requirementId: "FE-C12",
        componentId: "scaffolding",
        decisionOwner: "SERVER",
        decisionBasis: FE_C12_POST_LOSS_SCAFFOLDING_COST_DECISION_BASIS,
        proofMode:
          "ALL_OCCURRENCES_DETERMINISTICALLY_POST_LOSS_SCAFFOLDING_COSTS",
        rejectedOccurrenceCount: 1,
        rejectionDigestContractId: TERMINAL_REJECTION_SET_DIGEST_CONTRACT_ID,
        rejections: [
          expect.objectContaining({
            occurrenceDigestContractId: TERMINAL_OCCURRENCE_DIGEST_CONTRACT_ID,
            sectionScopeSource: OCCURRENCE_LOCAL_CLAUSE_SCOPE_SOURCE,
            observedScopeKeys: [],
            scopeProofMode: FE_C12_POST_LOSS_SCAFFOLDING_COST_SCOPE_PROOF_MODE,
          }),
        ],
      },
    });
    expect(componentAudit).not.toHaveProperty(
      "lw20DefaultExclusionOverrideAudit"
    );
    expect(comparisonRow.pointDecision).toMatchObject({
      outcome: "GLEICHWERTIG",
      reasonCode: "EQUAL_COMPLETE_CONTROLLED_ABSENCE_BOTH",
      reviewRequired: false,
    });

    const targetsFile = path.join(
      runB.outputDirectory,
      "FE",
      "effects",
      "targets.private.json"
    );
    const worksheetFile = path.join(
      runB.outputDirectory,
      "FE",
      "worksheet.private.json"
    );
    const targets = JSON.parse(fs.readFileSync(targetsFile, "utf8"));
    const worksheet = JSON.parse(fs.readFileSync(worksheetFile, "utf8"));
    const occurrence = worksheet.requirements[0].components.find(
      ({ id }) => id === "scaffolding"
    ).occurrences[0];
    occurrence.context.text = occurrence.context.text.replace(
      "Gerüste und Notverglasung",
      "Gerüste bei Sanierungsarbeiten und Notverglasung"
    );
    occurrence.context.documentEnd =
      occurrence.context.documentStart + occurrence.context.text.length;
    const rejection = targets.find(
      ({ componentId }) => componentId === "scaffolding"
    ).serverRejectedCandidates[0];
    rejection.occurrenceDigestSha256 = terminalOccurrenceDigest({
      ...occurrence,
      scopeProofMode: FE_C12_POST_LOSS_SCAFFOLDING_COST_SCOPE_PROOF_MODE,
    });
    fs.writeFileSync(targetsFile, JSON.stringify(targets));
    fs.writeFileSync(worksheetFile, JSON.stringify(worksheet));

    const tamperedResult = buildComparisonResult([runA, runB]);
    const tamperedRow = tamperedResult.categories
      .find(({ categoryView }) => categoryView === "FE")
      .rows.find(({ categoryId }) => categoryId === "FE-C12");
    const tamperedComponent = tamperedRow.packageB.searchAudit.components.find(
      ({ searchPlanId }) => searchPlanId.endsWith("/scaffolding")
    );
    expect(tamperedComponent.disposition).toBe("SEARCH_INCOMPLETE");
    expect(tamperedComponent.gates).not.toHaveProperty(
      "deterministicPostLossScaffoldingCostTerminal"
    );
    expect(tamperedComponent).not.toHaveProperty("terminalRejectionAudit");
    expect(tamperedRow.pointDecision).toMatchObject({
      outcome: "UNKLAR",
      reasonCode: "MISSING_BOTH",
    });
  });

  test("revalidates LW-20 non-target terminals and reports the excluded counterpart as a documentation difference", () => {
    const runA = writeRun(root, document("a", "A"));
    const runB = writeRun(root, document("b", "B"));
    writeLw20AbsenceCategory(runA, { treatmentCost: true });
    writeLw20AbsenceCategory(runB, { excluded: true });

    const result = buildComparisonResult([runA, runB]);
    const comparisonRow = result.categories
      .find(({ categoryView }) => categoryView === "LW")
      .rows.find(({ categoryId }) => categoryId === "LW-20");
    const componentAudit = comparisonRow.packageA.searchAudit.components[0];

    expect(componentAudit).toMatchObject({
      disposition: "NO_MATCH_AFTER_COMPLETE_CONTROLLED_SEARCH",
      lw20DefaultExclusionOverrideAudit: {
        schemaVersion: 2,
        contractId: "LW20_DEFAULT_EXCLUSION_ALIAS_FREE_OVERRIDE_AUDIT_V2",
        requirementId: "LW-20",
        componentId: "ground_seepage_or_retained_water",
        decisionOwner: "SERVER",
        status: "NO_OVERRIDE_REFERENCE_FOUND",
        document: {
          uuid: "a",
          sha256: runA.document.sha256,
          documentArtifactDigestSha256:
            expect.stringMatching(/^[a-f0-9]{64}$/u),
          physicalPagesChecked: 22,
          totalPhysicalPages: 22,
        },
        candidateCount: 0,
        candidates: [],
      },
      gates: {
        zeroOccurrenceTerminal: false,
        zeroCandidateTerminal: false,
        deterministicLw20NonTargetOccurrenceTerminal: true,
      },
      terminalRejectionAudit: {
        schemaVersion: 3,
        contractId:
          DETERMINISTIC_LW20_NON_TARGET_OCCURRENCE_TERMINAL_CONTRACT_ID,
        requirementId: "LW-20",
        componentId: "ground_seepage_or_retained_water",
        decisionOwner: "SERVER",
        decisionBasis: LW20_NON_TARGET_OCCURRENCE_DECISION_BASIS,
        proofMode: "ALL_OCCURRENCES_DETERMINISTICALLY_NON_TARGET_GROUNDWATER",
        rejectedOccurrenceCount: 1,
        rejectionDigestContractId: TERMINAL_REJECTION_SET_DIGEST_CONTRACT_ID,
        rejections: [
          expect.objectContaining({
            occurrenceDigestContractId: TERMINAL_OCCURRENCE_DIGEST_CONTRACT_ID,
            sectionScopeSource: OCCURRENCE_LOCAL_CLAUSE_SCOPE_SOURCE,
            observedScopeKeys: [],
            scopeProofMode: LW20_NON_TARGET_OCCURRENCE_SCOPE_PROOF_MODE,
          }),
        ],
      },
    });
    expect(comparisonRow.packageB).toMatchObject({
      evidenceFound: true,
      coverage: "Nein",
    });
    expect(
      comparisonRow.packageB.searchAudit.components[0]
        .lw20DefaultExclusionOverrideAudit
    ).toMatchObject({
      status: "NO_OVERRIDE_REFERENCE_FOUND",
      document: { uuid: "b", sha256: runB.document.sha256 },
      candidateCount: 0,
    });
    expect(comparisonRow.pointDecision).toMatchObject({
      outcome: "DOKUMENTATIONSUNTERSCHIED",
      reasonCode: "QUALIFIED_SEARCH_DOCUMENTATION_DIFFERENCE",
      ruleId: "QUALIFIED_ABSENCE_DOCUMENTATION_DIFFERENCE_V2",
      reviewRequired: false,
      unilateralCoverageAbsenceAudit: {
        eligible: false,
        absentSide: "A",
        evidencedSide: "B",
      },
    });
    expect(() => validateCustomerComparison(result)).not.toThrow();

    const targetsFile = path.join(
      runA.outputDirectory,
      "LW",
      "effects",
      "targets.private.json"
    );
    const worksheetFile = path.join(
      runA.outputDirectory,
      "LW",
      "worksheet.private.json"
    );
    const targets = JSON.parse(fs.readFileSync(targetsFile, "utf8"));
    const worksheet = JSON.parse(fs.readFileSync(worksheetFile, "utf8"));
    const occurrence = worksheet.requirements[0].components[0].occurrences[0];
    occurrence.context.text = occurrence.context.text.replace(
      "nicht versicherten Sachen",
      "versicherten Sachen"
    );
    occurrence.context.documentEnd =
      occurrence.context.documentStart + occurrence.context.text.length;
    const rejection = targets[0].serverRejectedCandidates[0];
    rejection.occurrenceDigestSha256 = terminalOccurrenceDigest({
      ...occurrence,
      scopeProofMode: LW20_NON_TARGET_OCCURRENCE_SCOPE_PROOF_MODE,
    });
    fs.writeFileSync(targetsFile, JSON.stringify(targets));
    fs.writeFileSync(worksheetFile, JSON.stringify(worksheet));

    const tamperedResult = buildComparisonResult([runA, runB]);
    const tamperedRow = tamperedResult.categories
      .find(({ categoryView }) => categoryView === "LW")
      .rows.find(({ categoryId }) => categoryId === "LW-20");
    expect(tamperedRow.packageA.searchAudit.components[0]).toMatchObject({
      disposition: "SEARCH_INCOMPLETE",
      gates: {
        zeroOccurrenceTerminal: false,
        zeroCandidateTerminal: false,
      },
    });
    expect(
      tamperedRow.packageA.searchAudit.components[0].gates
    ).not.toHaveProperty("deterministicLw20NonTargetOccurrenceTerminal");
    expect(tamperedRow.packageA.searchAudit.components[0]).not.toHaveProperty(
      "terminalRejectionAudit"
    );
    expect(tamperedRow.pointDecision).toMatchObject({
      outcome: "UNKLAR",
      reasonCode: "MISSING_ONE_SIDE",
      reviewRequired: true,
    });
  });

  test("materializes only an occurrence-bound EL-12 risk-information terminal audit", () => {
    const runA = writeRun(root, document("a", "A"));
    const runB = writeRun(root, document("b", "B"));
    writeEl12AbsenceCategory(runA);
    writeEl12AbsenceCategory(runB, { riskInformation: true });

    const result = buildComparisonResult([runA, runB]);
    const comparisonRow = result.categories
      .find(({ categoryView }) => categoryView === "EL")
      .rows.find(({ categoryId }) => categoryId === "EL-12");
    const componentAudit = comparisonRow.packageB.searchAudit.components[0];
    expect(componentAudit).toMatchObject({
      disposition: "NO_MATCH_AFTER_COMPLETE_CONTROLLED_SEARCH",
      gates: {
        zeroOccurrenceTerminal: false,
        zeroCandidateTerminal: false,
        deterministicNonContractualRiskInformationTerminal: true,
      },
      terminalRejectionAudit: {
        schemaVersion: 3,
        contractId:
          "DETERMINISTIC_NON_CONTRACTUAL_RISK_INFORMATION_TERMINAL_V2",
        requirementId: "EL-12",
        componentId: "flood_zone_exclusion_or_surcharge",
        decisionOwner: "SERVER",
        decisionBasis: "EXPLICIT_NON_CONTRACTUAL_RISK_INFORMATION",
        proofMode:
          "ALL_OCCURRENCES_DETERMINISTICALLY_NON_CONTRACTUAL_RISK_INFORMATION",
        rejectedOccurrenceCount: 1,
        rejectionDigestContractId: TERMINAL_REJECTION_SET_DIGEST_CONTRACT_ID,
        rejections: [
          expect.objectContaining({
            occurrenceDigestContractId: TERMINAL_OCCURRENCE_DIGEST_CONTRACT_ID,
            sectionScopeSource: "CURRENT_PAGE_HEADING",
            observedScopeKeys: ["LEITUNGSWASSER_INSURANCE", "STURM_INSURANCE"],
            scopeProofMode:
              "CURRENT_RISK_INFORMATION_WITH_STRUCTURAL_BOUNDARY_V2",
          }),
        ],
      },
    });
    expect(componentAudit.gates).not.toHaveProperty(
      "deterministicOutOfCategoryTerminal"
    );
    expect(comparisonRow.pointDecision).toMatchObject({
      outcome: "GLEICHWERTIG",
      reasonCode: "EQUAL_COMPLETE_CONTROLLED_ABSENCE_BOTH",
      reviewRequired: false,
    });

    const targetsFile = path.join(
      runB.outputDirectory,
      "EL",
      "effects",
      "targets.private.json"
    );
    const worksheetFile = path.join(
      runB.outputDirectory,
      "EL",
      "worksheet.private.json"
    );
    const originalTargets = JSON.parse(fs.readFileSync(targetsFile, "utf8"));
    const originalWorksheet = JSON.parse(
      fs.readFileSync(worksheetFile, "utf8")
    );
    const expectTamperingToFailClosed = (mutate) => {
      const targets = JSON.parse(JSON.stringify(originalTargets));
      const worksheet = JSON.parse(JSON.stringify(originalWorksheet));
      mutate({ targets, worksheet });
      fs.writeFileSync(targetsFile, JSON.stringify(targets));
      fs.writeFileSync(worksheetFile, JSON.stringify(worksheet));
      const tamperedResult = buildComparisonResult([runA, runB]);
      const tamperedRow = tamperedResult.categories
        .find(({ categoryView }) => categoryView === "EL")
        .rows.find(({ categoryId }) => categoryId === "EL-12");
      expect(tamperedRow.packageB.searchAudit.components[0].disposition).toBe(
        "SEARCH_INCOMPLETE"
      );
      expect(
        tamperedRow.packageB.searchAudit.components[0].gates
      ).not.toHaveProperty(
        "deterministicNonContractualRiskInformationTerminal"
      );
      expect(tamperedRow.packageB.searchAudit.components[0]).not.toHaveProperty(
        "terminalRejectionAudit"
      );
      expect(tamperedRow.pointDecision).toMatchObject({
        outcome: "UNKLAR",
        reasonCode: "MISSING_BOTH",
      });
    };

    expectTamperingToFailClosed(({ targets }) => {
      targets[0].serverRejectedCandidates[0].occurrenceDigestSha256 =
        "0".repeat(64);
    });
    expectTamperingToFailClosed(({ targets }) => {
      targets[0].serverRejectedCandidates[0].physicalPageNumber = 2;
    });
    expectTamperingToFailClosed(({ targets, worksheet }) => {
      const occurrence = worksheet.requirements[0].components[0].occurrences[0];
      occurrence.sectionScopeHint.source = "PRECEDING_PAGE_HEADING";
      targets[0].serverRejectedCandidates[0].occurrenceDigestSha256 =
        terminalOccurrenceDigest({
          ...occurrence,
          scopeProofMode:
            "CURRENT_RISK_INFORMATION_WITH_STRUCTURAL_BOUNDARY_V2",
        });
    });
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
      ruleId: "QUALIFIED_ABSENCE_DOCUMENTATION_DIFFERENCE_V2",
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

  test("keeps a bound karenz clause fail-closed through the result builder", () => {
    const evidencedRow = {
      VS: {
        documentedContent: "Versicherte Gefahr",
        coverage: "Ja",
        source: "PDF-Seite 1",
        reviewStatus: "BELEGT",
      },
    };
    const runA = writeRun(root, document("a", "A"), evidencedRow);
    const runB = writeRun(root, document("b", "B"), evidencedRow);
    writeAtomicCategory(runA, "VS", "INCLUDED", {
      exactText: "Die Gefahr ist versichert.",
    });
    writeAtomicCategory(runB, "VS", "INCLUDED", {
      exactText: "Die Gefahr ist versichert.",
      contextText:
        "Die Gefahr ist versichert. Der Versicherungsschutz beginnt frühestens nach Ablauf der Karenzfrist.",
      contextDocumentStart: 100,
      documentStart: 100,
      documentEnd: 125,
    });

    const result = buildComparisonResult([runA, runB]);
    expect(result.categories[0].rows[0].pointDecision).toMatchObject({
      outcome: "UNKLAR",
      reasonCode: "CONDITIONAL_OR_EXCEPTION_SCOPE",
      ruleId: "FAIL_CLOSED_CONDITIONAL_SOURCE_V1",
    });
  });

  test("keeps different operational event modes non-comparable through the result builder", () => {
    const evidencedRow = {
      VS: {
        documentedContent: "Sprinklerereignis",
        coverage: "Ja",
        source: "PDF-Seite 1",
        reviewStatus: "BELEGT",
      },
    };
    const runA = writeRun(root, document("a", "A"), evidencedRow);
    const runB = writeRun(root, document("b", "B"), evidencedRow);
    writeAtomicCategory(runA, "VS", "INCLUDED", {
      exactText: "Bestimmungsgemäße Auslösung der Sprinkleranlage.",
    });
    writeAtomicCategory(runB, "VS", "INCLUDED", {
      exactText: "Löschmittel tritt bestimmungswidrig aus der Anlage aus.",
    });

    const result = buildComparisonResult([runA, runB]);
    expect(result.categories[0].rows[0].pointDecision).toMatchObject({
      outcome: "NICHT_VERGLEICHBAR",
      reasonCode: "COMPARABILITY_GATE_FAILED",
      ruleId: "ATOMIC_COMPARABILITY_GATE_V1",
      dimensions: [
        {
          a: { operationalEventMode: "INTENDED_OPERATION" },
          b: { operationalEventMode: "UNINTENDED_EVENT" },
        },
      ],
    });
  });
});

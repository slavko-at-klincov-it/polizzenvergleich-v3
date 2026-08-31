const catalog = require("../../../resources/policyAnalysis/hp-occurrence-full-draft.v0.2.json");
const {
  buildControlledOccurrenceWorksheet,
} = require("../../../utils/policyAnalysis/controlledOccurrenceWorksheet");
const {
  CONFLICT_STATE,
  COVERAGE_EFFECT,
} = require("../../../utils/policyAnalysis/categoryResultContract");
const {
  DOCUMENT_STATUS,
  buildPreparedEvidenceTargets,
  materializePreparedEvidence,
  parseAndValidatePreparedEvidenceResponse,
} = require("../../../utils/policyAnalysis/preparedEvidenceContract");
const {
  materializeRequestedFieldEvidence,
} = require("../../../utils/policyAnalysis/requestedFieldEvidenceContract");
const {
  buildCategoryTableRows,
} = require("../../../utils/policyAnalysis/categoryTableRenderer");

function documentFromText(text, id) {
  return {
    id,
    sourceDocumentId: id,
    title: `${id}.pdf`,
    documentType: "pdf",
    pageContent: text,
    pageMap: [{ pageNumber: 1, start: 0, end: text.length }],
    pdfExtraction: {
      schemaVersion: 1,
      totalPages: 1,
      processedPages: 1,
      pagesWithText: 1,
      complete: true,
    },
  };
}

function response(target, coverageEffect) {
  return JSON.stringify({
    schemaVersion: 1,
    componentId: target.componentId,
    selectedCandidateIds: target.candidates.map(
      ({ candidateId }) => candidateId
    ),
    coverageEffect,
    conflictState: CONFLICT_STATE.NONE,
  });
}

function materializeHp25({ text, foreignEffect, hp25Binding = "DIRECT" }) {
  const worksheet = buildControlledOccurrenceWorksheet({
    document: documentFromText(text, "hp25-worldwide-downstream"),
    documentFingerprint: "hp25-worldwide-downstream",
    catalog,
  });
  const candidateTriage = worksheet.requirements.flatMap((requirement) =>
    requirement.components.flatMap((component) =>
      component.occurrences.map((occurrence) => ({
        requirementId: requirement.id,
        componentId: component.id,
        candidateId: occurrence.candidateId,
        binding: requirement.id === "HP-25" ? hp25Binding : "MENTION_ONLY",
      }))
    )
  );
  const targets = buildPreparedEvidenceTargets({
    worksheet,
    documentStatus: DOCUMENT_STATUS.ACTIVE,
    candidateTriage,
  });
  const judgements = targets
    .filter(({ candidates }) => candidates.length > 0)
    .map((target) =>
      parseAndValidatePreparedEvidenceResponse({
        target,
        responseText: response(
          target,
          target.componentId === "territorial_scope"
            ? COVERAGE_EFFECT.DEFINED
            : foreignEffect
        ),
      })
    );
  const materializedEvidence = materializePreparedEvidence({
    worksheet,
    targets,
    judgements,
  });
  const requestedFieldMaterialization = materializeRequestedFieldEvidence({
    worksheet,
    materializedCandidates: candidateTriage,
  });
  const definition = {
    id: "HP-25",
    stage: "V",
    label: "Räumlicher Geltungsbereich und Auslandsdeckung",
  };
  const [row] = buildCategoryTableRows({
    definitions: [definition],
    worksheet,
    materializedEvidence,
    requestedFieldMaterialization,
    documentStatus: DOCUMENT_STATUS.ACTIVE,
  });

  return { worksheet, targets, materializedEvidence, row };
}

describe("HP-25 worldwide coverage downstream contract", () => {
  test("materializes a worldwide inclusion as complete, source-bound coverage", () => {
    const text =
      "Der Versicherungsschutz bezieht sich auf weltweit eingetretene Schadenereignisse.";
    const result = materializeHp25({
      text,
      foreignEffect: COVERAGE_EFFECT.INCLUDED,
    });
    const rollup = result.materializedEvidence.rollups.find(
      ({ categoryId }) => categoryId === "HP-25"
    );

    expect(rollup).toMatchObject({
      evidenceCompleteness: "COMPLETE",
      coveragePicture: "INCLUDED",
      reviewStatus: "BELEGT",
      requestedFieldStatus: "NOT_EVALUATED",
    });
    expect(result.row).toMatchObject({
      categoryId: "HP-25",
      coverage: "Ja",
      reviewStatus: "BELEGT",
      source: `PDF-Seite 1: „${text}“`,
    });
    expect(result.row.documentedContent).toContain(
      "Geltungsbereich: Der Versicherungsschutz bezieht sich auf weltweit eingetretene Schadenereignisse"
    );
  });

  test("keeps an explicit worldwide exclusion source-bound and renders Nein", () => {
    const text =
      "Der Versicherungsschutz bezieht sich nicht auf weltweit eingetretene Schadenereignisse.";
    const result = materializeHp25({
      text,
      foreignEffect: COVERAGE_EFFECT.EXCLUDED,
    });

    expect(result.row).toMatchObject({
      coverage: "Nein",
      reviewStatus: "BELEGT",
      source: `PDF-Seite 1: „${text}“`,
    });
  });

  test("does not turn a worldwide loss-event mention into downstream coverage", () => {
    const result = materializeHp25({
      text: "Ein weltweit vertriebener Bericht erwähnt Schadenereignisse ohne Vertragsregelung.",
      foreignEffect: COVERAGE_EFFECT.INCLUDED,
      hp25Binding: "MENTION_ONLY",
    });

    expect(result.targets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          requirementId: "HP-25",
          componentId: "territorial_scope",
          candidates: [],
          serverRejectedCandidates: expect.arrayContaining([
            expect.objectContaining({ reason: "TRIAGE_MENTION_ONLY" }),
          ]),
        }),
        expect.objectContaining({
          requirementId: "HP-25",
          componentId: "foreign_coverage",
          candidates: [],
          serverRejectedCandidates: expect.arrayContaining([
            expect.objectContaining({ reason: "TRIAGE_MENTION_ONLY" }),
          ]),
        }),
      ])
    );
    expect(result.row).toMatchObject({
      coverage: "Nicht feststellbar",
      reviewStatus: "UNGEKLÄRT",
      source: "keine belegte Fundstelle gefunden",
    });
  });
});

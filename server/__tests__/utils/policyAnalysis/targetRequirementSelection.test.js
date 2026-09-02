const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const {
  buildCandidateTriagePayload,
  buildSingleBindingTargetPayload,
} = require("../../../utils/policyAnalysis/candidateTriageContract");
const {
  buildControlledOccurrenceWorksheet,
} = require("../../../utils/policyAnalysis/controlledOccurrenceWorksheet");
const {
  DOCUMENT_STATUS,
  buildPreparedEvidenceTargets,
  buildSinglePreparedEvidencePayload,
} = require("../../../utils/policyAnalysis/preparedEvidenceContract");
const {
  TARGET_REQUIREMENT_SELECTION_CONTRACT_ID,
  assertTargetRequirementSelection,
  selectTargetRequirements,
  selectionDigest,
} = require("../../../utils/policyAnalysis/targetRequirementSelection");
const {
  assertCoverageOnlyCertification,
  requirementSearchContractDigest,
} = require("../../../utils/policyAnalysis/coverageOnlyCertificationContract");
const certificationRegistry = require("../../../resources/policyAnalysis/coverage-only-certifications.v0.1.json");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../../..");
const CATEGORY_BUILDER = path.join(
  REPOSITORY_ROOT,
  "server/scripts/qa/buildCategoryOccurrenceWorksheet.cjs"
);
const VS_BUILDER = path.join(
  REPOSITORY_ROOT,
  "server/scripts/qa/buildVsOccurrenceWorksheet.cjs"
);
const VS_CATALOG = path.join(
  REPOSITORY_ROOT,
  "server/resources/policyAnalysis/vs-occurrence-full-draft.v0.2.json"
);

function requirement(id, alias) {
  return {
    id,
    label: `Requirement ${id}`,
    requestedFields: [],
    components: [
      {
        id: `${id.toLowerCase()}_component`,
        label: `Component ${id}`,
        factRole: "INSURED_OBJECT",
        aliases: [alias],
      },
    ],
  };
}

function catalog() {
  return {
    schemaVersion: 1,
    catalogId: "target-selection-catalog-v1",
    categoryView: "ST",
    requirements: [
      requirement("ST-01", "Sturmdeckung"),
      requirement("ST-02", "Hageldeckung"),
      requirement("ST-03", "Schneedruckdeckung"),
    ],
  };
}

function document() {
  const pageContent = [
    "Sturmdeckung ist versichert.",
    "Hageldeckung ist versichert.",
    "Schneedruckdeckung ist versichert.",
  ].join("\n");
  return {
    id: "target-selection-document",
    sourceDocumentId: "target-selection-document",
    title: "target-selection.pdf",
    documentType: "pdf",
    pageContent,
    pageMap: [{ pageNumber: 1, start: 0, end: pageContent.length }],
    pdfExtraction: {
      schemaVersion: 1,
      totalPages: 1,
      processedPages: 1,
      pagesWithText: 1,
      complete: true,
    },
  };
}

function documentWithText(pageContent) {
  return {
    ...document(),
    pageContent,
    pageMap: [{ pageNumber: 1, start: 0, end: pageContent.length }],
  };
}

function targetWorksheet(sourceCatalog, requirementIds) {
  const selected = selectTargetRequirements({
    catalog: sourceCatalog,
    requirementIds,
  });
  return buildControlledOccurrenceWorksheet({
    document: document(),
    documentFingerprint: "target-selection-fingerprint",
    catalog: selected.catalog,
  });
}

describe("target requirement selection", () => {
  test("preserves canonical catalog identity and original requirement objects", () => {
    const sourceCatalog = catalog();
    const original = JSON.parse(JSON.stringify(sourceCatalog));

    const selected = selectTargetRequirements({
      catalog: sourceCatalog,
      requirementIds: "ST-03, ST-01",
    });

    expect(selected.catalog.catalogId).toBe(sourceCatalog.catalogId);
    expect(selected.catalog.requirements.map(({ id }) => id)).toEqual([
      "ST-01",
      "ST-03",
    ]);
    expect(selected.catalog.requirements[0]).toBe(
      sourceCatalog.requirements[0]
    );
    expect(selected.catalog.requirements[1]).toBe(
      sourceCatalog.requirements[2]
    );
    expect(sourceCatalog).toEqual(original);
    expect(selected.selection).toMatchObject({
      schemaVersion: 1,
      contractId: TARGET_REQUIREMENT_SELECTION_CONTRACT_ID,
      catalogId: sourceCatalog.catalogId,
      categoryView: sourceCatalog.categoryView,
      requirementIds: ["ST-01", "ST-03"],
      requirementContracts: [
        {
          requirementId: "ST-01",
          searchContractDigestSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
        },
        {
          requirementId: "ST-03",
          searchContractDigestSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
        },
      ],
      requirementCount: 2,
      selectionDigestSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
  });

  test("is deterministic across input order and whitespace", () => {
    const sourceCatalog = catalog();
    const left = selectTargetRequirements({
      catalog: sourceCatalog,
      requirementIds: " ST-03,ST-01 ",
    });
    const right = selectTargetRequirements({
      catalog: sourceCatalog,
      requirementIds: ["ST-01", " ST-03 "],
    });

    expect(left.selection).toEqual(right.selection);
    const { selectionDigestSha256, requirementCount, ...digestContract } =
      left.selection;
    expect(requirementCount).toBe(2);
    expect(selectionDigestSha256).toBe(selectionDigest(digestContract));
    expect(selectionDigest(digestContract)).toBe(
      selectionDigest({
        requirementContracts: digestContract.requirementContracts,
        requirementIds: digestContract.requirementIds,
        categoryView: digestContract.categoryView,
        catalogId: digestContract.catalogId,
        contractId: digestContract.contractId,
        schemaVersion: digestContract.schemaVersion,
      })
    );
  });

  test.each([undefined, null, "", "  ,  ", []])(
    "rejects an empty target selection: %p",
    (requirementIds) => {
      expect(() =>
        selectTargetRequirements({ catalog: catalog(), requirementIds })
      ).toThrow("TARGET_REQUIREMENT_SELECTION_EMPTY");
    }
  );

  test.each(["ST-01,", ",ST-01", ["ST-01", " "]])(
    "rejects an empty ID inside a non-empty target selection: %p",
    (requirementIds) => {
      expect(() =>
        selectTargetRequirements({ catalog: catalog(), requirementIds })
      ).toThrow("TARGET_REQUIREMENT_SELECTION_EMPTY_ID");
    }
  );

  test("rejects unknown IDs without partially selecting known requirements", () => {
    expect(() =>
      selectTargetRequirements({
        catalog: catalog(),
        requirementIds: "ST-01,ST-99",
      })
    ).toThrow("TARGET_REQUIREMENT_SELECTION_UNKNOWN_IDS: ST-99");
  });

  test("rejects duplicate target IDs and category-mismatched catalogs", () => {
    expect(() =>
      selectTargetRequirements({
        catalog: catalog(),
        requirementIds: "ST-01,ST-01",
      })
    ).toThrow("TARGET_REQUIREMENT_SELECTION_DUPLICATE_IDS: ST-01");

    const mismatchedCatalog = catalog();
    mismatchedCatalog.requirements[1].id = "FE-A01";
    expect(() =>
      selectTargetRequirements({
        catalog: mismatchedCatalog,
        requirementIds: "ST-01",
      })
    ).toThrow("TARGET_REQUIREMENT_CATEGORY_MISMATCH: ST:FE-A01");
  });

  test("keeps selected worksheet requirements and single-target payloads equal to the full run", () => {
    const sourceCatalog = catalog();
    const fullWorksheet = buildControlledOccurrenceWorksheet({
      document: document(),
      documentFingerprint: "target-selection-fingerprint",
      catalog: sourceCatalog,
    });
    const selectedWorksheet = targetWorksheet(sourceCatalog, "ST-02,ST-03");
    const selectedIds = new Set(["ST-02", "ST-03"]);

    expect(selectedWorksheet.catalog).toEqual(fullWorksheet.catalog);
    expect(selectedWorksheet.requirements).toEqual(
      fullWorksheet.requirements.filter(({ id }) => selectedIds.has(id))
    );

    const fullTriagePayload = buildCandidateTriagePayload(fullWorksheet);
    const selectedTriagePayload =
      buildCandidateTriagePayload(selectedWorksheet);
    for (const target of selectedTriagePayload.bindingTargets) {
      expect(
        buildSingleBindingTargetPayload({
          payload: selectedTriagePayload,
          targetId: target.targetId,
        })
      ).toEqual(
        buildSingleBindingTargetPayload({
          payload: fullTriagePayload,
          targetId: target.targetId,
        })
      );
    }

    const fullPreparedTargets = buildPreparedEvidenceTargets({
      worksheet: fullWorksheet,
      documentStatus: DOCUMENT_STATUS.ACTIVE,
    });
    const selectedPreparedTargets = buildPreparedEvidenceTargets({
      worksheet: selectedWorksheet,
      documentStatus: DOCUMENT_STATUS.ACTIVE,
    });
    const fullPreparedById = new Map(
      fullPreparedTargets.map((target) => [target.targetId, target])
    );
    for (const target of selectedPreparedTargets)
      expect(buildSinglePreparedEvidencePayload({ target })).toEqual(
        buildSinglePreparedEvidencePayload({
          target: fullPreparedById.get(target.targetId),
        })
      );
  });

  test("preserves real ANY, binding-group and search-contract identities", () => {
    const sourceCatalog = JSON.parse(fs.readFileSync(VS_CATALOG, "utf8"));
    const selected = selectTargetRequirements({
      catalog: sourceCatalog,
      requirementIds: "VS-23,VS-16,VS-21",
    });

    expect(selected.catalog.requirements.map(({ id }) => id)).toEqual([
      "VS-16",
      "VS-21",
      "VS-23",
    ]);
    for (const selectedRequirement of selected.catalog.requirements) {
      const sourceRequirement = sourceCatalog.requirements.find(
        ({ id }) => id === selectedRequirement.id
      );
      expect(selectedRequirement).toBe(sourceRequirement);
      expect(
        requirementSearchContractDigest({
          catalogId: selected.catalog.catalogId,
          requirement: selectedRequirement,
        })
      ).toBe(
        requirementSearchContractDigest({
          catalogId: sourceCatalog.catalogId,
          requirement: sourceRequirement,
        })
      );
      if (["VS-16", "VS-23"].includes(selectedRequirement.id))
        expect(selectedRequirement.componentSatisfactionPolicy).toBe("ANY");
    }

    const sourceDocument = documentWithText(
      "Kosten für Aufräumung und Abbruch sind versichert."
    );
    const fullWorksheet = buildControlledOccurrenceWorksheet({
      document: sourceDocument,
      documentFingerprint: "target-selection-vs-fingerprint",
      catalog: sourceCatalog,
    });
    const selectedWorksheet = buildControlledOccurrenceWorksheet({
      document: sourceDocument,
      documentFingerprint: "target-selection-vs-fingerprint",
      catalog: selected.catalog,
    });
    const selectedIds = new Set(["VS-16", "VS-21", "VS-23"]);
    expect(selectedWorksheet.requirements).toEqual(
      fullWorksheet.requirements.filter(({ id }) => selectedIds.has(id))
    );
    expect(selectedWorksheet.bindingGroups.length).toBeGreaterThan(0);
    expect(selectedWorksheet.bindingGroups).toEqual(
      fullWorksheet.bindingGroups.filter(({ requirementId }) =>
        selectedIds.has(requirementId)
      )
    );
  });

  test("keeps an approved certified requirement bound to the canonical catalog ID", () => {
    const certifiedRequirement = {
      id: "VS-17",
      label: "Zertifizierte reine Deckungszeile",
      requestedFields: [],
      optionalFields: [],
      absenceMeaning: "COVERAGE_ONLY",
      negativeSearchPolicy: "CERTIFY_COMPLETE_ZERO_OCCURRENCE_V1",
      absenceComparisonPolicy:
        "ASSUME_NOT_INCLUDED_AFTER_COMPLETE_ZERO_OCCURRENCE_V1",
      absenceCertificationId: "VS-17-v1",
      components: [
        {
          id: "room",
          label: "Raum",
          factRole: "INSURED_OBJECT",
          aliases: ["Raum"],
        },
      ],
    };
    const certifiedCatalog = {
      schemaVersion: 2,
      catalogId: "vs-certified-target-fixture-v1",
      categoryView: "VS",
      requirements: [certifiedRequirement],
    };
    const approvedRegistry = {
      ...certificationRegistry,
      certifications: [
        {
          certificationId: "VS-17-v1",
          categoryView: "VS",
          requirementId: "VS-17",
          catalogId: certifiedCatalog.catalogId,
          requirementDigest: requirementSearchContractDigest({
            catalogId: certifiedCatalog.catalogId,
            requirement: certifiedRequirement,
          }),
          status: "APPROVED",
          gateEvidence: Object.fromEntries(
            certificationRegistry.requiredGateIds.map((gateId) => [
              gateId,
              {
                passed: true,
                artifacts: [
                  { artifactId: `artifact:${gateId}`, sha256: "a".repeat(64) },
                ],
              },
            ])
          ),
        },
      ],
    };
    const selected = selectTargetRequirements({
      catalog: certifiedCatalog,
      requirementIds: "VS-17",
    });

    expect(
      assertCoverageOnlyCertification({
        categoryView: selected.catalog.categoryView,
        catalogId: selected.catalog.catalogId,
        requirement: selected.catalog.requirements[0],
        registry: approvedRegistry,
      })
    ).toMatchObject({ certificationId: "VS-17-v1" });
    expect(() =>
      assertCoverageOnlyCertification({
        categoryView: selected.catalog.categoryView,
        catalogId: `${selected.catalog.catalogId}:subset:VS-17`,
        requirement: selected.catalog.requirements[0],
        registry: approvedRegistry,
      })
    ).toThrow("COVERAGE_CERTIFICATION_REFERENCE_INVALID");
  });

  test("validates persisted target provenance before triage and evidence", () => {
    const sourceCatalog = catalog();
    const selected = selectTargetRequirements({
      catalog: sourceCatalog,
      requirementIds: "ST-01,ST-03",
    });
    const worksheet = {
      ...buildControlledOccurrenceWorksheet({
        document: document(),
        documentFingerprint: "target-selection-validation-fingerprint",
        catalog: selected.catalog,
      }),
      targetRequirementSelection: selected.selection,
    };

    expect(assertTargetRequirementSelection(worksheet)).toBe(
      worksheet.targetRequirementSelection
    );
    const expectedTargetSelectionDigestSha256 =
      worksheet.targetRequirementSelection.selectionDigestSha256;
    expect(() =>
      buildCandidateTriagePayload(worksheet, {
        expectedTargetSelectionDigestSha256,
      })
    ).not.toThrow();
    expect(() =>
      buildPreparedEvidenceTargets({
        worksheet,
        documentStatus: DOCUMENT_STATUS.ACTIVE,
        expectedTargetSelectionDigestSha256,
      })
    ).not.toThrow();

    const mutations = [
      (copy) => {
        copy.targetRequirementSelection.selectionDigestSha256 = "0".repeat(64);
      },
      (copy) => {
        copy.targetRequirementSelection.requirementCount = 1;
      },
      (copy) => {
        copy.targetRequirementSelection.requirementIds = ["ST-03", "ST-01"];
      },
      (copy) => {
        copy.targetRequirementSelection.requirementContracts[0].searchContractDigestSha256 =
          "1".repeat(64);
      },
      (copy) => {
        copy.catalog.id = "other-catalog";
      },
      (copy) => {
        copy.catalog.categoryView = "FE";
      },
    ];
    for (const mutate of mutations) {
      const copy = JSON.parse(JSON.stringify(worksheet));
      mutate(copy);
      expect(() => buildCandidateTriagePayload(copy)).toThrow(
        /^TARGET_REQUIREMENT_SELECTION_/u
      );
      expect(() =>
        buildPreparedEvidenceTargets({
          worksheet: copy,
          documentStatus: DOCUMENT_STATUS.ACTIVE,
        })
      ).toThrow(/^TARGET_REQUIREMENT_SELECTION_/u);
    }

    const missingProvenance = JSON.parse(JSON.stringify(worksheet));
    delete missingProvenance.targetRequirementSelection;
    expect(() =>
      buildCandidateTriagePayload(missingProvenance, {
        expectedTargetSelectionDigestSha256,
      })
    ).toThrow("TARGET_REQUIREMENT_SELECTION_REQUIRED");
    expect(() =>
      buildPreparedEvidenceTargets({
        worksheet: missingProvenance,
        documentStatus: DOCUMENT_STATUS.ACTIVE,
        expectedTargetSelectionDigestSha256,
      })
    ).toThrow("TARGET_REQUIREMENT_SELECTION_REQUIRED");
    expect(() =>
      buildCandidateTriagePayload(worksheet, {
        expectedTargetSelectionDigestSha256: "f".repeat(64),
      })
    ).toThrow("TARGET_REQUIREMENT_SELECTION_EXPECTED_DIGEST_MISMATCH");
  });

  test("category builder writes selection separately without changing catalog ID", () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "target-selection-cli-")
    );
    try {
      const sourceCatalog = catalog();
      const catalogFile = path.join(root, "catalog.json");
      const artifactFile = path.join(root, "document.private.json");
      const fullOutputFile = path.join(root, "worksheet-full.private.json");
      const outputFile = path.join(root, "worksheet.private.json");
      const sourceDocument = document();
      fs.writeFileSync(catalogFile, JSON.stringify(sourceCatalog));
      fs.writeFileSync(
        artifactFile,
        JSON.stringify({
          schemaVersion: 1,
          fingerprint: sourceDocument.sourceDocumentId,
          document: sourceDocument,
        })
      );

      const fullResult = spawnSync(
        process.execPath,
        [
          CATEGORY_BUILDER,
          "--documentArtifact",
          artifactFile,
          "--catalogFile",
          catalogFile,
          "--output",
          fullOutputFile,
        ],
        { cwd: REPOSITORY_ROOT, encoding: "utf8" }
      );
      expect(fullResult.status).toBe(0);
      expect(JSON.parse(fs.readFileSync(fullOutputFile, "utf8"))).toEqual(
        buildControlledOccurrenceWorksheet({
          document: sourceDocument,
          documentFingerprint: sourceDocument.sourceDocumentId,
          catalog: sourceCatalog,
        })
      );

      const result = spawnSync(
        process.execPath,
        [
          CATEGORY_BUILDER,
          "--documentArtifact",
          artifactFile,
          "--catalogFile",
          catalogFile,
          "--requirementIds",
          "ST-03,ST-01",
          "--output",
          outputFile,
        ],
        { cwd: REPOSITORY_ROOT, encoding: "utf8" }
      );

      expect(result.status).toBe(0);
      const worksheet = JSON.parse(fs.readFileSync(outputFile, "utf8"));
      expect(worksheet.catalog.id).toBe(sourceCatalog.catalogId);
      expect(worksheet.requirements.map(({ id }) => id)).toEqual([
        "ST-01",
        "ST-03",
      ]);
      expect(worksheet.targetRequirementSelection).toMatchObject({
        contractId: TARGET_REQUIREMENT_SELECTION_CONTRACT_ID,
        catalogId: sourceCatalog.catalogId,
        requirementIds: ["ST-01", "ST-03"],
      });

      for (const invalidIds of ["ST-99", "ST-01,ST-01"]) {
        const invalid = spawnSync(
          process.execPath,
          [
            CATEGORY_BUILDER,
            "--documentArtifact",
            artifactFile,
            "--catalogFile",
            catalogFile,
            "--requirementIds",
            invalidIds,
            "--output",
            outputFile,
          ],
          { cwd: REPOSITORY_ROOT, encoding: "utf8" }
        );
        expect(invalid.status).toBe(1);
        expect(invalid.stderr).toMatch(/^\[category-worksheet\]/u);
        expect(invalid.stderr).toContain("TARGET_REQUIREMENT_SELECTION_");
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("both worksheet builders share the canonical selection helper", () => {
    for (const builder of [CATEGORY_BUILDER, VS_BUILDER]) {
      const source = fs.readFileSync(builder, "utf8");
      expect(source).toContain("selectTargetRequirements");
      expect(source).not.toContain(":subset:");
    }
  });
});

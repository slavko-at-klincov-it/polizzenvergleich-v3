const crypto = require("crypto");
const {
  ASSERTION_KIND,
  SOURCE_BOUND_SCOPED_PACKAGE_REFERENCE_EVIDENCE_CONTRACT_ID,
  buildSourceBoundScopedPackageReferenceProofs,
  validSourceBoundScopedPackageReferenceProofs,
  validateScopedPackageReferenceEvidenceContract,
} = require("../../../utils/policyAnalysis/scopedPackageReferenceEvidenceContract");
const {
  buildControlledOccurrenceWorksheet,
} = require("../../../utils/policyAnalysis/controlledOccurrenceWorksheet");
const {
  materializeAtomicFacts,
} = require("../../../utils/policyComparison/resultBuilder");

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function contract() {
  return {
    contractId: SOURCE_BOUND_SCOPED_PACKAGE_REFERENCE_EVIDENCE_CONTRACT_ID,
    perilScopeKey: "FEUER_INSURANCE",
    perilHeadingAliases: ["Feuerversicherung", "Feuer-Versicherung"],
    coveredObjectKey: "BUILDING",
    coveredObjectAliases: ["Wohngebäude zum Neuwert", "Gebäude zum Neuwert"],
    referenceFamilyKey: "EABS",
    referenceTitleAliases: [
      "Ergänzende allgemeine Bedingungen für die Sachversicherung",
    ],
    referenceCodeAliases: ["EABS"],
  };
}

function artifact(pages) {
  let pageContent = "";
  const pageMap = pages.map((text, index) => {
    const start = pageContent.length;
    pageContent += text;
    const end = pageContent.length;
    if (index < pages.length - 1) pageContent += "\n";
    return { pageNumber: index + 1, start, end };
  });
  const fingerprint = sha256(pageContent);
  return {
    schemaVersion: 1,
    fingerprint,
    document: {
      sourceDocumentId: fingerprint,
      pageContent,
      pageMap,
      pdfExtraction: {
        schemaVersion: 1,
        complete: true,
        totalPages: pages.length,
        processedPages: pages.length,
      },
    },
  };
}

function positiveArtifact() {
  return artifact([
    [
      "FEUERVERSICHERUNG",
      "Versicherte Variante: Premiumschutz",
      "-Wohngebäude zum NeuwertEUR30.608.000,00",
    ].join("\n"),
    [
      "Allgemeine Bedingungen",
      "-Ergänzende allgemeine Bedingungen für die Sachversicherung (EABS 2023)",
      "LEITUNGSWASSERVERSICHERUNG",
      "-Wohngebäude zum Neuwert EUR 30.608.000,00",
      "-Ergänzende allgemeine Bedingungen für die Sachversicherung (EABS 2024)",
    ].join("\n"),
  ]);
}

describe("source-bound scoped package-reference evidence", () => {
  test("binds one covered object and source-derived terms edition to the same peril section", () => {
    const documentArtifact = positiveArtifact();
    const [proof] = buildSourceBoundScopedPackageReferenceProofs({
      contract: contract(),
      documentArtifact,
    });

    expect(proof).toMatchObject({
      schemaVersion: 1,
      contractId: SOURCE_BOUND_SCOPED_PACKAGE_REFERENCE_EVIDENCE_CONTRACT_ID,
      documentFingerprint: documentArtifact.fingerprint,
      assertionKind: ASSERTION_KIND,
      perilScopeKey: "FEUER_INSURANCE",
      coveredObjectKey: "BUILDING",
      reference: {
        familyKey: "EABS",
        edition: "2023",
        referenceKey: "EABS@2023",
      },
      spans: {
        scopeHeadingSpan: { exactText: "FEUERVERSICHERUNG" },
        coveredObjectSpan: { exactText: "Wohngebäude zum Neuwert" },
        referenceTitleSpan: {
          exactText:
            "Ergänzende allgemeine Bedingungen für die Sachversicherung",
        },
        referenceCodeSpan: { exactText: "EABS" },
        referenceEditionSpan: { exactText: "2023" },
        nextScopeHeadingSpan: { exactText: "LEITUNGSWASSERVERSICHERUNG" },
      },
    });
    expect(proof.spans.referenceContextSpan.physicalPageNumber).toBe(2);
    expect(proof.proofDigest).toMatch(/^[a-f0-9]{64}$/u);
    expect(proof).not.toHaveProperty("coverageEffect");
    expect(
      validSourceBoundScopedPackageReferenceProofs({
        contract: contract(),
        proofs: [proof],
        documentArtifact,
      })
    ).toBe(true);
  });

  test.each([
    [
      "reference outside the fire section",
      [
        "FEUERVERSICHERUNG\n-Wohngebäude zum Neuwert",
        "LEITUNGSWASSERVERSICHERUNG\n-Ergänzende allgemeine Bedingungen für die Sachversicherung (EABS 2023)",
      ],
    ],
    [
      "negative covered object",
      [
        "FEUERVERSICHERUNG\n-Wohngebäude zum Neuwert nicht versichert\n-Ergänzende allgemeine Bedingungen für die Sachversicherung (EABS 2023)",
      ],
    ],
    [
      "ambiguous reference edition",
      [
        "FEUERVERSICHERUNG\n-Wohngebäude zum Neuwert\n-Ergänzende allgemeine Bedingungen für die Sachversicherung (EABS 2023 ersetzt EABS 2024)",
      ],
    ],
    [
      "arbitrary joined object suffix",
      [
        "FEUERVERSICHERUNG\n-Wohngebäude zum Neuwertig\n-Ergänzende allgemeine Bedingungen für die Sachversicherung (EABS 2023)",
      ],
    ],
  ])("fails closed for %s", (_label, pages) => {
    expect(
      buildSourceBoundScopedPackageReferenceProofs({
        contract: contract(),
        documentArtifact: artifact(pages),
      })
    ).toEqual([]);
  });

  test("detects proof and original-byte manipulation", () => {
    const documentArtifact = positiveArtifact();
    const proofs = buildSourceBoundScopedPackageReferenceProofs({
      contract: contract(),
      documentArtifact,
    });
    proofs[0].reference.edition = "2024";
    expect(
      validSourceBoundScopedPackageReferenceProofs({
        contract: contract(),
        proofs,
        documentArtifact,
      })
    ).toBe(false);

    const changed = positiveArtifact();
    const original = buildSourceBoundScopedPackageReferenceProofs({
      contract: contract(),
      documentArtifact: changed,
    });
    changed.document.pageContent = changed.document.pageContent.replace(
      "EABS 2023",
      "EABS 2024"
    );
    expect(
      validSourceBoundScopedPackageReferenceProofs({
        contract: contract(),
        proofs: original,
        documentArtifact: changed,
      })
    ).toBe(false);
  });

  test("persists only a document-replayed support proof on the atomic fact", () => {
    const documentArtifact = positiveArtifact();
    const worksheet = buildControlledOccurrenceWorksheet({
      document: documentArtifact.document,
      documentFingerprint: documentArtifact.fingerprint,
      catalog: {
        schemaVersion: 1,
        catalogId: "fe-scoped-reference-test-v1",
        categoryView: "FE",
        requirements: [
          {
            id: "FE-C02",
            label: "Photovoltaikanlage als Brandobjekt",
            requestedFields: [],
            supportingScopedPackageReferenceEvidenceContracts: [contract()],
            components: [
              {
                id: "photovoltaic_as_damaged_object",
                label: "Photovoltaikanlage",
                factRole: "INSURED_OBJECT",
                aliases: ["Photovoltaikanlagen"],
              },
            ],
          },
        ],
      },
    });
    const [proof] =
      worksheet.requirements[0].supportingScopedPackageReferenceProofs;
    const input = {
      document: {
        uuid: "document-proposal",
        role: "PROPOSAL",
        documentStatus: "PROPOSAL",
      },
      worksheet,
      materializedEvidence: {
        judgements: [
          {
            targetId: "target:fe-c02",
            requirementId: "FE-C02",
            componentId: "photovoltaic_as_damaged_object",
            evidencePresence: "NOT_FOUND",
            coverageEffect: "NOT_STATED",
            conflictState: "NONE",
            selectedScopePicture: "GENERAL",
            documentApplicability: "CONDITIONAL",
            selectedCandidateIds: [],
            unresolvedCandidateIds: [],
          },
        ],
      },
      requestedFields: {
        requirements: [
          {
            requirementId: "FE-C02",
            requestedFieldStatus: "NOT_REQUIRED",
            fields: [],
          },
        ],
      },
      targets: [{ targetId: "target:fe-c02", candidates: [] }],
      documentArtifact,
      report: null,
    };
    const [atom] = materializeAtomicFacts(input);
    expect(atom.supportingScopedPackageReferenceProofs).toEqual([proof]);
    expect(atom.supportingScopedPackageReferenceProofs[0]).not.toBe(proof);

    const tampered = JSON.parse(JSON.stringify(worksheet));
    tampered.requirements[0].supportingScopedPackageReferenceProofs[0].reference.edition =
      "2024";
    expect(() =>
      materializeAtomicFacts({ ...input, worksheet: tampered })
    ).toThrow("SCOPED_PACKAGE_REFERENCE_PROOF_REPLAY_INVALID");
  });

  test("rejects unsafe or ambiguous catalog vocabulary", () => {
    const duplicate = contract();
    duplicate.coveredObjectAliases.push("WOHNGEBÄUDE ZUM NEUWERT");
    expect(() =>
      validateScopedPackageReferenceEvidenceContract(duplicate)
    ).toThrow("SCOPED_PACKAGE_REFERENCE_ALIAS_INVALID");

    const fixedEdition = { ...contract(), edition: "2023" };
    expect(() =>
      validateScopedPackageReferenceEvidenceContract(fixedEdition)
    ).toThrow("SCOPED_PACKAGE_REFERENCE_CONTRACT_INVALID");
  });
});

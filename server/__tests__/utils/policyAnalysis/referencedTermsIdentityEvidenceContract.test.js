const crypto = require("crypto");
const {
  ASSERTION_KIND,
  SOURCE_BOUND_REFERENCED_TERMS_IDENTITY_EVIDENCE_CONTRACT_ID,
  buildSourceBoundReferencedTermsIdentityProofs,
  validSourceBoundReferencedTermsIdentityProofs,
  validateReferencedTermsIdentityEvidenceContract,
} = require("../../../utils/policyAnalysis/referencedTermsIdentityEvidenceContract");
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
    contractId: SOURCE_BOUND_REFERENCED_TERMS_IDENTITY_EVIDENCE_CONTRACT_ID,
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
      "09.2024 Seite 1 von 12",
      "Ergänzende allgemeine Bedingungen für die",
      "Sachversicherung",
      "(EABS 2023)",
      "Vertragspartner",
      "Diese Vertragsgrundlagen gelten für Verträge.",
    ].join("\n"),
    "Ergänzende allgemeine Bedingungen für die Sachversicherung\nEABS 2023",
  ]);
}

describe("source-bound referenced-terms identity evidence", () => {
  test("derives the reference key from the canonical first-page title block", () => {
    const documentArtifact = positiveArtifact();
    const [proof] = buildSourceBoundReferencedTermsIdentityProofs({
      contract: contract(),
      documentArtifact,
    });

    expect(proof).toMatchObject({
      schemaVersion: 1,
      contractId: SOURCE_BOUND_REFERENCED_TERMS_IDENTITY_EVIDENCE_CONTRACT_ID,
      documentFingerprint: documentArtifact.fingerprint,
      assertionKind: ASSERTION_KIND,
      reference: {
        familyKey: "EABS",
        edition: "2023",
        referenceKey: "EABS@2023",
      },
      spans: {
        titleSpan: {
          physicalPageNumber: 1,
          exactText:
            "Ergänzende allgemeine Bedingungen für die\nSachversicherung",
        },
        codeSpan: { physicalPageNumber: 1, exactText: "EABS" },
        editionSpan: { physicalPageNumber: 1, exactText: "2023" },
      },
    });
    expect(proof.spans.identityContextSpan.exactText).toBe(
      "Ergänzende allgemeine Bedingungen für die\nSachversicherung\n(EABS 2023)"
    );
    expect(proof).not.toHaveProperty("coverageEffect");
    expect(
      validSourceBoundReferencedTermsIdentityProofs({
        contract: contract(),
        proofs: [proof],
        documentArtifact,
      })
    ).toBe(true);
  });

  test.each([
    [
      "identity only on a later page",
      [
        "Deckblatt ohne Bedingungsidentität",
        "Ergänzende allgemeine Bedingungen für die Sachversicherung\n(EABS 2023)",
      ],
    ],
    [
      "missing edition",
      ["Ergänzende allgemeine Bedingungen für die Sachversicherung\n(EABS)"],
    ],
    [
      "wrong family code",
      [
        "Ergänzende allgemeine Bedingungen für die Sachversicherung\n(ABS 2023)",
      ],
    ],
    [
      "ambiguous title blocks",
      [
        "Ergänzende allgemeine Bedingungen für die Sachversicherung\n(EABS 2023)\nErgänzende allgemeine Bedingungen für die Sachversicherung\n(EABS 2024)",
      ],
    ],
  ])("fails closed for %s", (_label, pages) => {
    expect(
      buildSourceBoundReferencedTermsIdentityProofs({
        contract: contract(),
        documentArtifact: artifact(pages),
      })
    ).toEqual([]);
  });

  test("replays original bytes before an atomic fact can retain the proof", () => {
    const documentArtifact = positiveArtifact();
    const worksheet = buildControlledOccurrenceWorksheet({
      document: documentArtifact.document,
      documentFingerprint: documentArtifact.fingerprint,
      catalog: {
        schemaVersion: 1,
        catalogId: "fe-terms-identity-test-v1",
        categoryView: "FE",
        requirements: [
          {
            id: "FE-C02",
            label: "Photovoltaikanlage als Brandobjekt",
            requestedFields: [],
            supportingReferencedTermsIdentityEvidenceContracts: [contract()],
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
    const [proof] = worksheet.requirements[0].supportingReferencedTermsIdentityProofs;
    const input = {
      document: {
        uuid: "document-eabs",
        role: "TERMS",
        documentStatus: "FRAMEWORK_TERMS",
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
    expect(atom.supportingReferencedTermsIdentityProofs).toEqual([proof]);
    expect(atom.supportingReferencedTermsIdentityProofs[0]).not.toBe(proof);

    const tampered = JSON.parse(JSON.stringify(worksheet));
    tampered.requirements[0].supportingReferencedTermsIdentityProofs[0].reference.edition =
      "2024";
    expect(() => materializeAtomicFacts({ ...input, worksheet: tampered })).toThrow(
      "REFERENCED_TERMS_IDENTITY_PROOF_REPLAY_INVALID"
    );
  });

  test("rejects a fixed edition or duplicate aliases in the catalog", () => {
    expect(() =>
      validateReferencedTermsIdentityEvidenceContract({
        ...contract(),
        edition: "2023",
      })
    ).toThrow("TERMS_IDENTITY_CONTRACT_INVALID");
    const duplicate = contract();
    duplicate.referenceCodeAliases.push("eabs");
    expect(() =>
      validateReferencedTermsIdentityEvidenceContract(duplicate)
    ).toThrow("TERMS_IDENTITY_ALIAS_INVALID");
  });
});

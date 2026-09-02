const crypto = require("crypto");
const {
  LW20_DEFAULT_EXCLUSION_OVERRIDE_AUDIT_CONTRACT_ID,
  LW20_DEFAULT_EXCLUSION_OVERRIDE_PATTERN_CONTRACT_ID,
  NO_OVERRIDE_REFERENCE_FOUND,
  REVIEW_REQUIRED,
  buildLw20DefaultExclusionOverrideAudit,
  validateLw20DefaultExclusionOverrideAudit,
} = require("../../../utils/policyAnalysis/lw20DefaultExclusionOverrideAudit");

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function fixture(pages) {
  const documentSha = sha256("lw20-override-audit-document");
  let pageContent = "";
  const pageMap = [];
  pages.forEach((text, index) => {
    if (pageContent) pageContent += "\n\f\n";
    const start = pageContent.length;
    pageContent += text;
    pageMap.push({ pageNumber: index + 1, start, end: pageContent.length });
  });
  return {
    document: { uuid: "document-lw20-audit", sha256: documentSha },
    documentArtifact: {
      schemaVersion: 1,
      fingerprint: documentSha,
      document: {
        sourceDocumentId: documentSha,
        pageContent,
        pageMap,
        pdfExtraction: {
          schemaVersion: 1,
          totalPages: pages.length,
          processedPages: pages.length,
          pagesWithText: pages.length,
          complete: true,
        },
      },
    },
    requirementId: "LW-20",
    componentId: "ground_seepage_or_retained_water",
  };
}

describe("LW-20 default-exclusion override audit", () => {
  test("flags direct, code, AWB, Leitungswasser and point cross-reference forms for review", () => {
    const input = fixture([
      "Abweichend vom Ausschluss sind Schäden durch Grundwasser mitversichert.",
      "In Erweiterung der Klausel LW 123 gilt ein zusätzlicher Deckungsbaustein.",
      "Abweichend von den AWB 2024 wird der Deckungsumfang erweitert.",
      "In Erweiterung der Allgemeinen Bedingungen für die Leitungswasserversicherung gilt dieser Zusatzbaustein.",
      "Abweichend von Punkt 2 lit. c gelten Schäden durch aufsteigendes Wasser als mitversichert.",
      "Der Ausschluss nach Artikel 7 Absatz 3 findet keine Anwendung.",
      "Entgegen Ziffer 4.2 sind Schäden durch Wasser aus dem Erdreich gedeckt.",
    ]);

    const audit = buildLw20DefaultExclusionOverrideAudit(input);

    expect(audit).toMatchObject({
      schemaVersion: 1,
      contractId: LW20_DEFAULT_EXCLUSION_OVERRIDE_AUDIT_CONTRACT_ID,
      requirementId: "LW-20",
      componentId: "ground_seepage_or_retained_water",
      decisionOwner: "SERVER",
      status: REVIEW_REQUIRED,
      document: {
        uuid: input.document.uuid,
        sha256: input.document.sha256,
        documentArtifactDigestSha256: expect.stringMatching(
          /^[a-f0-9]{64}$/u
        ),
        physicalPagesChecked: 5,
        totalPhysicalPages: 5,
      },
      patternFamilyContract: {
        contractId: LW20_DEFAULT_EXCLUSION_OVERRIDE_PATTERN_CONTRACT_ID,
        digestSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      },
    });
    expect(new Set(audit.candidates.map(({ familyId }) => familyId))).toEqual(
      new Set([
        "DIRECT_LW20_POSITIVE_OVERRIDE_V1",
        "CODE_CROSS_REFERENCE_OVERRIDE_V1",
        "AWB_CROSS_REFERENCE_OVERRIDE_V1",
        "LEITUNGSWASSER_CROSS_REFERENCE_OVERRIDE_V1",
        "POINT_OR_ARTICLE_CROSS_REFERENCE_OVERRIDE_V1",
      ])
    );
    expect(audit.candidateCount).toBe(audit.candidates.length);
    for (const candidate of audit.candidates) {
      expect(candidate.physicalPageNumber).toBeGreaterThanOrEqual(1);
      expect(
        input.documentArtifact.document.pageContent.slice(
          candidate.documentStart,
          candidate.documentEnd
        )
      ).toBe(candidate.exactText);
      expect(candidate.candidateDigestSha256).toMatch(/^[a-f0-9]{64}$/u);
    }
    expect(validateLw20DefaultExclusionOverrideAudit({ audit, ...input })).toBe(
      true
    );
  });

  test("certifies zero candidates for an exclusion and unrelated references", () => {
    const input = fixture([
      "Nicht versichert sind Schäden durch Grundwasser, Sickerwasser oder Stauwasser.",
      "Versicherungsschutz besteht nicht für Grundwasser.",
      "Behandlungskosten für Wasser inklusive Grundwasser, Luft und Erdreich werden nicht ersetzt.",
      "Die AWB 2024 gelten für diesen Vertrag.",
      "Allgemeine Bedingungen für die Leitungswasserversicherung.",
    ]);

    const audit = buildLw20DefaultExclusionOverrideAudit(input);

    expect(audit).toMatchObject({
      status: NO_OVERRIDE_REFERENCE_FOUND,
      candidateCount: 0,
      candidates: [],
    });
    expect(validateLw20DefaultExclusionOverrideAudit({ audit, ...input })).toBe(
      true
    );
  });

  test("does not join negated or cross-page fragments into a positive override", () => {
    const input = fixture([
      "Grundwasser ist keinesfalls mitversichert. Schäden durch Grundwasser",
      "sind mitversichert.",
    ]);

    expect(buildLw20DefaultExclusionOverrideAudit(input)).toMatchObject({
      status: NO_OVERRIDE_REFERENCE_FOUND,
      candidateCount: 0,
    });
  });

  test("flags alias-free replacement and non-application references", () => {
    const input = fixture([
      "Punkt 2 lit. c wird ersetzt durch eine besondere Vereinbarung.",
      "Der Ausschluss gemäß Art. 4 findet keine Anwendung.",
    ]);

    expect(buildLw20DefaultExclusionOverrideAudit(input)).toMatchObject({
      status: REVIEW_REQUIRED,
      candidateCount: 2,
      candidates: [
        { familyId: "POINT_OR_ARTICLE_CROSS_REFERENCE_OVERRIDE_V1" },
        { familyId: "POINT_OR_ARTICLE_CROSS_REFERENCE_OVERRIDE_V1" },
      ],
    });
  });

  test("is target-bound and refuses incomplete document artifacts", () => {
    const input = fixture(["Schäden durch Grundwasser sind mitversichert."]);
    expect(
      buildLw20DefaultExclusionOverrideAudit({
        ...input,
        requirementId: "LW-19",
      })
    ).toBeNull();
    expect(
      buildLw20DefaultExclusionOverrideAudit({
        ...input,
        requirementId: "FE-C07",
      })
    ).toBeNull();
    expect(
      buildLw20DefaultExclusionOverrideAudit({
        ...input,
        componentId: "other_component",
      })
    ).toBeNull();

    const incomplete = JSON.parse(JSON.stringify(input));
    delete incomplete.documentArtifact.document.pageMap;
    expect(buildLw20DefaultExclusionOverrideAudit(incomplete)).toBeNull();
  });

  test("strict validation rejects status, offset, digest and shape tampering", () => {
    const input = fixture(["Grundwasser ist mitversichert."]);
    const audit = buildLw20DefaultExclusionOverrideAudit(input);
    const tamper = (mutate) => {
      const changed = JSON.parse(JSON.stringify(audit));
      mutate(changed);
      return validateLw20DefaultExclusionOverrideAudit({
        audit: changed,
        ...input,
      });
    };

    expect(
      tamper((changed) => (changed.status = NO_OVERRIDE_REFERENCE_FOUND))
    ).toBe(false);
    expect(tamper((changed) => (changed.candidates[0].documentStart += 1))).toBe(
      false
    );
    expect(
      tamper((changed) => (changed.candidateSetDigestSha256 = "a".repeat(64)))
    ).toBe(false);
    expect(tamper((changed) => (changed.untrusted = true))).toBe(false);
  });
});

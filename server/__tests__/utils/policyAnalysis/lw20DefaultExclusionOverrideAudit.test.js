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
  test("flags only structure-bound alias-free references for review", () => {
    const input = fixture([
      "In den Leitungswasserbedingungen wird der Ausschluss gemäß lit. c aufgehoben.",
      'Die Regel "Nicht versichert sind Schäden, sofern nicht anders vereinbart" der Leitungswasserversicherung wird gestrichen.',
      "Sämtliche Ausschlussbestimmungen der Leitungswasserversicherung werden außer Kraft gesetzt.",
      "Punkt c der nicht versicherten Schäden in der Leitungswasserversicherung findet keine Anwendung.",
    ]);

    const audit = buildLw20DefaultExclusionOverrideAudit(input);

    expect(audit).toMatchObject({
      schemaVersion: 2,
      contractId: LW20_DEFAULT_EXCLUSION_OVERRIDE_AUDIT_CONTRACT_ID,
      requirementId: "LW-20",
      componentId: "ground_seepage_or_retained_water",
      decisionOwner: "SERVER",
      status: REVIEW_REQUIRED,
      document: {
        uuid: input.document.uuid,
        sha256: input.document.sha256,
        documentArtifactDigestSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
        physicalPagesChecked: 4,
        totalPhysicalPages: 4,
      },
      patternFamilyContract: {
        contractId: LW20_DEFAULT_EXCLUSION_OVERRIDE_PATTERN_CONTRACT_ID,
        digestSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      },
      candidateCount: 4,
    });
    expect(new Set(audit.candidates.map(({ familyId }) => familyId))).toEqual(
      new Set([
        "LW20_ITEM_C_EXCLUSION_OVERRIDE_REFERENCE_V2",
        "LW20_DEFAULT_HEADING_OVERRIDE_REFERENCE_V2",
        "LW20_COMPLETE_EXCLUSION_BLOCK_OVERRIDE_V2",
      ])
    );
    for (const candidate of audit.candidates) {
      expect(["PARAGRAPH", "LIST_ITEM"]).toContain(candidate.unitType);
      expect(candidate.unitDocumentStart).toBeLessThanOrEqual(
        candidate.documentStart
      );
      expect(candidate.unitDocumentEnd).toBeGreaterThanOrEqual(
        candidate.documentEnd
      );
      expect(
        input.documentArtifact.document.pageContent.slice(
          candidate.documentStart,
          candidate.documentEnd
        )
      ).toBe(candidate.exactText);
      expect(candidate.unitTextSha256).toMatch(/^[a-f0-9]{64}$/u);
      expect(candidate.candidateDigestSha256).toMatch(/^[a-f0-9]{64}$/u);
    }
    expect(validateLw20DefaultExclusionOverrideAudit({ audit, ...input })).toBe(
      true
    );
  });

  test("does not duplicate direct LW-20 occurrence analysis", () => {
    const input = fixture([
      "Schäden durch Grundwasser sind mitversichert.",
      "Nicht versichert sind Schäden durch Grundwasser, Sickerwasser oder Stauwasser.",
      "Im Sturmbaustein sind Schäden durch Grundwasser gedeckt.",
    ]);

    expect(buildLw20DefaultExclusionOverrideAudit(input)).toMatchObject({
      status: NO_OVERRIDE_REFERENCE_FOUND,
      candidateCount: 0,
      candidates: [],
    });
  });

  test("dismisses generic references and the former Facility false positive", () => {
    const input = fixture([
      "Abweichend von Art. 7 gelten Umweltschäden als mitversichert.",
      "In Erweiterung der AWB sind Rohrbruchschäden gedeckt.",
      "In Erweiterung der Leitungswasserversicherung sind Silikonfugen mitversichert.",
      "Mitversichert sind Pflichten des Facility Managements.",
      "Abs. 1 Satz 1 ist nicht anzuwenden.",
      "Punkt c wird ersetzt durch eine besondere Vereinbarung.",
    ]);

    expect(buildLw20DefaultExclusionOverrideAudit(input)).toMatchObject({
      status: NO_OVERRIDE_REFERENCE_FOUND,
      candidateCount: 0,
    });
  });

  test("does not join anchors, locators and actions across structural boundaries", () => {
    const input = fixture([
      "Leitungswasserbedingungen und Ausschluss gemäß lit. c.\n\nDer Ausschluss wird aufgehoben.",
      "Leitungswasserversicherung und Ausschluss gemäß lit. c.",
      "Dieser Ausschluss wird aufgehoben.",
    ]);

    expect(buildLw20DefaultExclusionOverrideAudit(input)).toMatchObject({
      status: NO_OVERRIDE_REFERENCE_FOUND,
      candidateCount: 0,
    });
  });

  test("rejects negated removal wording", () => {
    const input = fixture([
      "Der Ausschluss gemäß lit. c der Leitungswasserbedingungen wird nicht aufgehoben.",
      "Der Ausschluss gemäß lit. c der Leitungswasserbedingungen wird keinesfalls gestrichen.",
      "Der Ausschluss gemäß lit. c der Leitungswasserbedingungen gilt unverändert und bleibt aufrecht.",
    ]);

    expect(buildLw20DefaultExclusionOverrideAudit(input)).toMatchObject({
      status: NO_OVERRIDE_REFERENCE_FOUND,
      candidateCount: 0,
    });
  });

  test("is target-bound and refuses incomplete document artifacts", () => {
    const input = fixture([
      "Der Ausschluss gemäß lit. c der Leitungswasserbedingungen wird aufgehoben.",
    ]);
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

  test("strict validation rejects status, unit, offset, digest and shape tampering", () => {
    const input = fixture([
      "Der Ausschluss gemäß lit. c der Leitungswasserbedingungen wird aufgehoben.",
    ]);
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
    expect(tamper((changed) => (changed.candidates[0].unitType = "PAGE"))).toBe(
      false
    );
    expect(tamper((changed) => (changed.candidates[0].documentStart += 1))).toBe(
      false
    );
    expect(
      tamper((changed) => (changed.candidateSetDigestSha256 = "a".repeat(64)))
    ).toBe(false);
    expect(tamper((changed) => (changed.untrusted = true))).toBe(false);
  });
});

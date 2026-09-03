const crypto = require("crypto");
const {
  OBJECT_MEMBERSHIP,
  OBJECT_MEMBERSHIP_CLASSIFICATION_SOURCE,
  SOURCE_BOUND_OBJECT_MEMBERSHIP_EVIDENCE_CONTRACT_ID,
  buildSourceBoundObjectMembershipProof,
  validateObjectMembershipEvidenceContract,
  validSourceBoundObjectMembershipProof,
} = require("../../../utils/policyAnalysis/objectMembershipEvidenceContract");

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function contract(membership = OBJECT_MEMBERSHIP.MEMBER_OF_CLASS) {
  return {
    contractId: SOURCE_BOUND_OBJECT_MEMBERSHIP_EVIDENCE_CONTRACT_ID,
    membership,
    memberObjectKey: "PHOTOVOLTAIC_INSTALLATION",
    classObjectKey: "BUILDING_TECHNICAL_INSTALLATION",
    memberAliases: ["Photovoltaikanlagen", "Fotovoltaikanlagen"],
    classAliases: ["Haustechnische Anlagen und Adaptierungen"],
    allowedClassificationSources: Object.values(
      OBJECT_MEMBERSHIP_CLASSIFICATION_SOURCE
    ),
  };
}

function fixture({
  membership = OBJECT_MEMBERSHIP.MEMBER_OF_CLASS,
  precedingPage = false,
} = {}) {
  const heading =
    membership === OBJECT_MEMBERSHIP.MEMBER_OF_CLASS
      ? "1.3Haustechnische Anlagen und Adaptierungen\ndas sind:"
      : "Nicht als Haustechnische Anlagen und Adaptierungen gelten:";
  const item = "·Solar- und Photovoltaikanlagen;";
  const pages = precedingPage ? [heading, item] : [`${heading}\n${item}`];
  let pageContent = "";
  const pageMap = pages.map((text, index) => {
    const start = pageContent.length;
    pageContent += text;
    const end = pageContent.length;
    if (index < pages.length - 1) pageContent += "\n";
    return { pageNumber: index + 1, start, end };
  });
  const fingerprint = sha256(pageContent);
  const headingStart = pageContent.indexOf(heading);
  const itemStart = pageContent.indexOf(item);
  const memberPage = precedingPage ? 2 : 1;
  const occurrence = {
    candidateId: "candidate:fe-c02:pv",
    physicalPageNumber: memberPage,
    documentStart: itemStart,
    documentEnd: itemStart + item.length,
    exactText: item,
    context: {
      unitType: "LIST_ITEM",
      documentStart: itemStart,
      documentEnd: itemStart + item.length,
      text: item,
    },
    objectClassificationGovernorHint: {
      contractId: "CROSS_PAGE_OBJECT_CLASSIFICATION_CONTEXT_V1",
      text: heading,
      subject: "1.3Haustechnische Anlagen und Adaptierungen",
      kind: "OBJECT_CLASSIFICATION_BOUNDARY",
      classificationKind: "OBJECT",
      membership,
      physicalPageNumber: 1,
      documentStart: headingStart,
      documentEnd: headingStart + heading.length,
      source: precedingPage
        ? OBJECT_MEMBERSHIP_CLASSIFICATION_SOURCE.PRECEDING_PAGE
        : OBJECT_MEMBERSHIP_CLASSIFICATION_SOURCE.CURRENT_PAGE,
    },
  };
  return {
    occurrence,
    documentArtifact: {
      schemaVersion: 1,
      fingerprint,
      document: {
        sourceDocumentId: fingerprint,
        pageContent,
        pageMap,
        pdfExtraction: { complete: true },
      },
    },
  };
}

describe("source-bound object-membership evidence contract", () => {
  test.each([
    [OBJECT_MEMBERSHIP.MEMBER_OF_CLASS, false],
    [OBJECT_MEMBERSHIP.MEMBER_OF_CLASS, true],
    [OBJECT_MEMBERSHIP.EXCLUDED_FROM_CLASS, false],
  ])(
    "builds a directed %s edge from exact source spans",
    (membership, precedingPage) => {
      const value = fixture({ membership, precedingPage });
      const proof = buildSourceBoundObjectMembershipProof({
        contract: contract(membership),
        ...value,
      });

      expect(proof).toMatchObject({
        schemaVersion: 1,
        contractId: SOURCE_BOUND_OBJECT_MEMBERSHIP_EVIDENCE_CONTRACT_ID,
        documentFingerprint: value.documentArtifact.fingerprint,
        edge: {
          relation: membership,
          memberObjectKey: "PHOTOVOLTAIC_INSTALLATION",
          classObjectKey: "BUILDING_TECHNICAL_INSTALLATION",
          memberSpan: {
            candidateId: value.occurrence.candidateId,
            exactText: "Photovoltaikanlagen",
          },
          classSpan: {
            source: value.occurrence.objectClassificationGovernorHint.source,
            exactText: "Haustechnische Anlagen und Adaptierungen",
          },
          classificationSpan: {
            exactText: value.occurrence.objectClassificationGovernorHint.text,
          },
        },
      });
      expect(proof).not.toHaveProperty("coverageEffect");
      expect(proof.edge).not.toHaveProperty("coverageEffect");
      expect(proof.proofDigest).toMatch(/^[a-f0-9]{64}$/u);
    }
  );

  test("binds catalog vocabulary and direction into the proof digest", () => {
    const value = fixture();
    const original = buildSourceBoundObjectMembershipProof({
      contract: contract(),
      ...value,
    });
    const extendedContract = contract();
    extendedContract.memberAliases.push("PV-Anlagen");
    const extended = buildSourceBoundObjectMembershipProof({
      contract: extendedContract,
      ...value,
    });

    expect(extended.edge).toEqual(original.edge);
    expect(extended.evidenceContractDigest).not.toBe(
      original.evidenceContractDigest
    );
    expect(extended.proofDigest).not.toBe(original.proofDigest);
  });

  test("rejects reverse, undeclared and structurally unbound edges", () => {
    const value = fixture();
    const reverse = contract();
    [reverse.memberObjectKey, reverse.classObjectKey] = [
      reverse.classObjectKey,
      reverse.memberObjectKey,
    ];
    [reverse.memberAliases, reverse.classAliases] = [
      reverse.classAliases,
      reverse.memberAliases,
    ];
    expect(
      buildSourceBoundObjectMembershipProof({ contract: reverse, ...value })
    ).toBeNull();

    const wrongRelation = contract(OBJECT_MEMBERSHIP.EXCLUDED_FROM_CLASS);
    expect(
      buildSourceBoundObjectMembershipProof({
        contract: wrongRelation,
        ...value,
      })
    ).toBeNull();

    const wrongSource = fixture();
    wrongSource.occurrence.objectClassificationGovernorHint.source =
      "ARBITRARY_DOCUMENT_CONTEXT";
    expect(
      buildSourceBoundObjectMembershipProof({
        contract: contract(),
        ...wrongSource,
      })
    ).toBeNull();

    const prose = fixture();
    prose.occurrence.context.unitType = "PARAGRAPH";
    expect(
      buildSourceBoundObjectMembershipProof({
        contract: contract(),
        ...prose,
      })
    ).toBeNull();
  });

  test("detects proof and original-document manipulation fail closed", () => {
    const value = fixture();
    const proof = buildSourceBoundObjectMembershipProof({
      contract: contract(),
      ...value,
    });
    value.occurrence.objectMembershipProof = proof;
    expect(
      validSourceBoundObjectMembershipProof({
        contract: contract(),
        ...value,
      })
    ).toBe(true);

    value.occurrence.objectMembershipProof.edge.memberObjectKey =
      "BUILDING_TECHNICAL_INSTALLATION";
    expect(
      validSourceBoundObjectMembershipProof({
        contract: contract(),
        ...value,
      })
    ).toBe(false);

    const sourceTamper = fixture();
    sourceTamper.documentArtifact.document.pageContent =
      sourceTamper.documentArtifact.document.pageContent.replace(
        "Photovoltaikanlagen",
        "Windkraftanlagen"
      );
    expect(
      buildSourceBoundObjectMembershipProof({
        contract: contract(),
        ...sourceTamper,
      })
    ).toBeNull();
  });

  test("rejects invalid catalog contracts before inspecting evidence", () => {
    const duplicateAlias = contract();
    duplicateAlias.memberAliases.push("PHOTOVOLTAIKANLAGEN");
    expect(() =>
      validateObjectMembershipEvidenceContract(duplicateAlias)
    ).toThrow("OBJECT_MEMBERSHIP_ALIAS_INVALID");

    const selfEdge = contract();
    selfEdge.classObjectKey = selfEdge.memberObjectKey;
    expect(() => validateObjectMembershipEvidenceContract(selfEdge)).toThrow(
      "OBJECT_MEMBERSHIP_SELF_EDGE_FORBIDDEN"
    );

    const unknownSource = contract();
    unknownSource.allowedClassificationSources = ["PAGE_WIDE_TEXT"];
    expect(() =>
      validateObjectMembershipEvidenceContract(unknownSource)
    ).toThrow("OBJECT_MEMBERSHIP_SOURCES_INVALID");
  });
});

jest.mock("../../../utils/policyAnalysis/aDrivenSemanticManifest", () => ({
  A_DYNAMIC_MANIFEST_CONTRACT_ID:
    "LF_A_DYNAMIC_SEMANTIC_REQUIREMENT_MANIFEST_V11",
  buildADrivenSemanticManifest: jest.fn(),
  validateADrivenSemanticManifest: jest.fn(),
}));
jest.mock("../../../scripts/qa/runADrivenReferenceClassification.cjs", () => ({
  classificationBatch: (plan, batch) => ({
    ...batch,
    units: batch.expectedUnitIds.map((unitId) =>
      plan.units.find((unit) => unit.unitId === unitId)
    ),
  }),
  deriveClassificationEvidencePlan: (plan) => plan,
  prompt: (batch) => [{ expectedUnitIds: batch.expectedUnitIds }],
  validateBatchResponses: () => ({ passed: true }),
}));

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  CURRENT_V12_REVIEW_PROFILE,
  createClassificationEvidence,
  createCrosswalkDraft,
  createReviewBasis,
  createReviewerRegistry,
  createReviewerTemplate,
  createRunProvenance,
  reconcileApprovedCrosswalk,
  sealReviewerArtifact,
  validateClassificationChain,
  validateCrosswalkDraft,
} = require("../../../utils/policyAnalysis/aDrivenLegacyDoubleReview");
const {
  assertRegularSingleLink,
  copyRegularVerified,
} = require("../../../scripts/qa/materializeADrivenLegacyDoubleReview.cjs");

const sourcePlanSha = "1".repeat(64);

function evidence() {
  const chainPayload = {
    schemaVersion: 1,
    contractId: "LF_A_V12_CLASSIFICATION_CHAIN_VALIDATION_V1",
    status: "DETERMINISTICALLY_REVALIDATED",
    sourceUnitPlanSha256: sourcePlanSha,
    batchPlanCanonicalSha256: "3".repeat(64),
    batchResultCanonicalSha256: Array.from({ length: 59 }, () =>
      "4".repeat(64)
    ),
    responsesCanonicalSha256: "5".repeat(64),
    summaryCanonicalSha256: "6".repeat(64),
    dynamicManifestSha256: CURRENT_V12_REVIEW_PROFILE.dynamicManifestSha256,
    summary: {
      batches: 59,
      responses: 349,
      semanticRequirements: 364,
      semanticComponents: 755,
    },
  };
  const {
    stableStringify,
  } = require("../../../utils/policyAnalysis/aDrivenSourceUnitPlan");
  const chainValidation = {
    ...chainPayload,
    chainSha256: crypto
      .createHash("sha256")
      .update(
        `LF_A_V12_CLASSIFICATION_CHAIN_VALIDATION_V1\u0000${stableStringify(
          chainPayload
        )}`
      )
      .digest("hex"),
  };
  return createClassificationEvidence({
    chainValidation,
    artifacts: Object.fromEntries(
      ["sourceUnitPlan", "classificationBatchPlan", "responses", "summary"].map(
        (name) => [
          name,
          {
            relativePath: `inputs/${name}.json`,
            fileSha256: "2".repeat(64),
            contractId: `TEST_${name}`,
            intrinsicSha256: name === "sourceUnitPlan" ? sourcePlanSha : null,
          },
        ]
      )
    ),
    batchResults: Array.from({ length: 59 }, (_, index) => ({
      batchId: `batch-${String(index + 1).padStart(2, "0")}`,
      relativePath: `inputs/batches/${index + 1}.json`,
      fileSha256: crypto
        .createHash("sha256")
        .update(String(index))
        .digest("hex"),
      status: "PASS",
      expectedUnits: 1,
    })),
  });
}

function legacyManifest() {
  const requirements = Array.from({ length: 283 }, (_, index) => {
    const requirementId = `PR-${String(index + 1).padStart(3, "0")}`;
    const componentCount = index < 65 ? 3 : 2;
    return {
      requirementId,
      displayLabel: `Legacy ${index + 1}`,
      sourceSpans: [
        {
          spanId: `${requirementId}-span`,
          blockIds: [`block-${index + 1}`],
          documentUuid: "doc-a",
          documentFingerprint: "fingerprint-a",
          physicalPageNumber: index + 1,
          pageStart: 0,
          pageEnd: 10,
          exactText: `Source ${index + 1}`,
        },
      ],
      components: Array.from(
        { length: componentCount },
        (_, componentIndex) => ({
          id: `${requirementId}-C${componentIndex + 1}`,
          label: `Component ${componentIndex + 1}`,
          factRole: "CONDITION",
          sourceSpanIds: [`${requirementId}-span`],
        })
      ),
    };
  });
  return {
    contractId: "LEGACY_TEST",
    manifestSha256: CURRENT_V12_REVIEW_PROFILE.legacyManifestSha256,
    categories: [
      {
        subcategories: [
          {
            requirementIds: requirements.map(
              ({ requirementId }) => requirementId
            ),
          },
        ],
      },
    ],
    requirements,
  };
}

function dynamicManifest() {
  let componentNumber = 0;
  const requirements = Array.from({ length: 364 }, (_, index) => {
    const count = index < 27 ? 3 : 2;
    const blockId =
      index < 283 ? `block-${index + 1}` : `dynamic-only-${index + 1}`;
    const requirementId = `D-${String(index + 1).padStart(3, "0")}`;
    const components = Array.from({ length: count }, () => {
      componentNumber += 1;
      return {
        componentId: `DC-${String(componentNumber).padStart(4, "0")}`,
        type: "CONDITION",
        label: `Dynamic component ${componentNumber}`,
        sourceBlockIds: [blockId],
      };
    });
    return {
      requirementId,
      displayLabel: `Dynamic ${index + 1}`,
      components,
      sourceSpans: [
        {
          spanId: `${requirementId}-span`,
          blockId,
          documentUuid: "doc-a",
          documentSha256: "f".repeat(64),
          physicalPageNumber: index + 1,
          documentStart: 20,
          documentEnd: 40,
          exactText: `Dynamic source ${index + 1}`,
        },
      ],
    };
  });
  return {
    schemaVersion: 2,
    contractId: "LF_A_DYNAMIC_SEMANTIC_REQUIREMENT_MANIFEST_V11",
    runContractId: "LF_REFERENCE_A_DRIVEN_V2",
    sourceUnitPlanSha256: sourcePlanSha,
    manifestSha256: CURRENT_V12_REVIEW_PROFILE.dynamicManifestSha256,
    requirements,
    unitTerminals: [],
    blockTerminals: [],
    summary: {
      unresolvedUnits: 0,
      responseIntegrityStatus: "VALID",
      allBlocksTerminal: true,
      acceptanceReady: true,
      semanticRequirements: 364,
      semanticComponents: 755,
    },
  };
}

function basis({ firstRequirementComponentType } = {}) {
  const sourceArtifacts = Object.fromEntries(
    [
      "sourcePdf",
      "documentArtifact",
      "sourceLedger",
      "runContract",
      "inputManifest",
      "correctedAStatusAudit",
      "integrityLog",
    ].map((name) => [
      name,
      {
        relativePath: `inputs/source/${name}`,
        fileSha256: crypto.createHash("sha256").update(name).digest("hex"),
        contractId: `TEST_${name}`,
        intrinsicSha256: null,
      },
    ])
  );
  const manifest = dynamicManifest();
  if (firstRequirementComponentType)
    for (const component of manifest.requirements[0].components)
      component.type = firstRequirementComponentType;
  return createReviewBasis({
    dynamicManifest: manifest,
    dynamicManifestFileSha256:
      CURRENT_V12_REVIEW_PROFILE.dynamicManifestFileSha256,
    legacyManifest: legacyManifest(),
    legacyManifestFileSha256:
      CURRENT_V12_REVIEW_PROFILE.legacyManifestFileSha256,
    classificationEvidence: evidence(),
    runProvenance: createRunProvenance({
      implementationCommitSha: "9836216b9db6fc0b83bc65177f69f9fa6a938acc",
      sourceArtifacts,
      sourceRun: {
        runContractId: "LF_REFERENCE_A_DRIVEN_V2",
        classificationRunContractId: "LF_A_BOUNDED_CLASSIFICATION_RUN_V12",
        manifestCompletionCommitSha: "bd051b23f1facb15943ca0de5312e387aa2dd10a",
        releaseId: "e8e9e94862acf1e48a7f8110382af084e5d37439",
        runSignature:
          "df7d7179-1c49-412b-b2ff-0ec6b1fdc52f/resume-eb1202f45007d9995ddd60a9",
        modelId: "qwen/qwen3.6-35b-a3b",
        qwenModelKey: "qwen3.6-35b-a3b-mlx-text",
        promptContractId: "LF_A_BOUNDED_CLASSIFICATION_PROMPT_V14",
        transportContractId: "LF_A_CLASSIFICATION_TRANSPORT_V1",
        contextLength: 42496,
        maximumAttempts: 8,
        requestTimeoutMs: 180000,
        abortSettlementTimeoutMs: 15000,
        modelRecoveryTimeoutMs: 180000,
      },
    }),
  });
}

test("revalidates the exact 349-unit Plan -> Batch -> response -> manifest chain", () => {
  const units = Array.from({ length: 349 }, (_, index) => ({
    unitId: `unit-${index + 1}`,
    initialDisposition: "PENDING_CLASSIFICATION",
  }));
  const sourcePlan = { planSha256: sourcePlanSha, units };
  let offset = 0;
  const batches = Array.from({ length: 59 }, (_, batchIndex) => {
    const size = batchIndex < 54 ? 6 : 5;
    const expectedUnitIds = units
      .slice(offset, offset + size)
      .map(({ unitId }) => unitId);
    offset += size;
    return { batchId: `batch-${batchIndex + 1}`, batchIndex, expectedUnitIds };
  });
  const batchPlan = { sourceUnitPlanSha256: sourcePlanSha, batches };
  const batchResults = batches.map((batch) => {
    const rawResponse = JSON.stringify(batch.expectedUnitIds);
    return {
      contractId: "LF_A_BOUNDED_CLASSIFICATION_RUN_V12",
      sourceUnitPlanSha256: sourcePlanSha,
      promptContractId: "LF_A_BOUNDED_CLASSIFICATION_PROMPT_V14",
      promptSha256: crypto
        .createHash("sha256")
        .update(JSON.stringify([{ expectedUnitIds: batch.expectedUnitIds }]))
        .digest("hex"),
      validatorContractId: "LF_A_DYNAMIC_SEMANTIC_REQUIREMENT_MANIFEST_V11",
      requestedModel: "qwen/qwen3.6-35b-a3b",
      modelContext: 42496,
      batchId: batch.batchId,
      batchIndex: batch.batchIndex,
      expectedUnitIds: batch.expectedUnitIds,
      responses: batch.expectedUnitIds.map((unitId) => ({ unitId })),
      validation: { passed: true },
      rawResponse,
      rawResponseSha256: crypto
        .createHash("sha256")
        .update(rawResponse)
        .digest("hex"),
    };
  });
  const responses = batchResults.flatMap((result) => result.responses);
  const manifest = {
    manifestSha256: CURRENT_V12_REVIEW_PROFILE.dynamicManifestSha256,
    summary: {
      semanticRequirements: 364,
      semanticComponents: 755,
      unresolvedUnits: 0,
      reviewRequiredBlocks: 0,
      allBlocksTerminal: true,
      responseIntegrityStatus: "VALID",
    },
  };
  require("../../../utils/policyAnalysis/aDrivenSemanticManifest").buildADrivenSemanticManifest.mockReturnValueOnce(
    manifest
  );
  const summary = {
    sourceUnitPlanSha256: sourcePlanSha,
    promptContractId: "LF_A_BOUNDED_CLASSIFICATION_PROMPT_V14",
    validatorContractId: "LF_A_DYNAMIC_SEMANTIC_REQUIREMENT_MANIFEST_V11",
    classificationBatchesSha256: crypto
      .createHash("sha256")
      .update(JSON.stringify(batchPlan))
      .digest("hex"),
    model: { id: "qwen/qwen3.6-35b-a3b", loadedContextLength: 42496 },
    transport: {
      contractId: "LF_A_CLASSIFICATION_TRANSPORT_V1",
      requestTimeoutMs: 180000,
      abortSettlementTimeoutMs: 15000,
      modelRecoveryTimeoutMs: 180000,
    },
    batches: 59,
    validBatches: 59,
    unresolvedBatches: 0,
    semanticRequirements: 364,
    semanticComponents: 755,
    unresolvedUnits: 0,
    reviewRequiredBlocks: 0,
    allBlocksTerminal: true,
    responseIntegrityStatus: "VALID",
  };
  expect(
    validateClassificationChain({
      sourcePlan,
      batchPlan,
      batchResults,
      responses,
      summary,
      dynamicManifest: manifest,
    }).status
  ).toBe("DETERMINISTICALLY_REVALIDATED");
  batchResults[0].validation.passed = false;
  expect(() =>
    validateClassificationChain({
      sourcePlan,
      batchPlan,
      batchResults,
      responses,
      summary,
      dynamicManifest: manifest,
    })
  ).toThrow("LF_A_DOUBLE_REVIEW_BATCH_RESULT_BINDING_INVALID");
});

describe("V12 283/631 double-review contract", () => {
  test("uses only the final V12 and correct V3.7.4 legacy hashes", () => {
    expect(CURRENT_V12_REVIEW_PROFILE).toMatchObject({
      dynamicManifestSha256:
        "5fcb889c0352f3808afeffda9f6801d987b61e0cccb18899c97ba90d0eacab6a",
      legacyManifestSha256:
        "3697afe4a18760bd893d50e0c3f8dadf48ff0106447829d32f1cb7845011efb0",
      legacyRequirements: 283,
      legacyComponents: 631,
    });
  });

  test("regenerates the full 631-record draft and rejects a rehashed mutation", () => {
    const frozen = basis();
    const draft = createCrosswalkDraft({ basis: frozen });
    expect(draft.records).toHaveLength(631);
    expect(draft.summary.dynamicComponents).toBe(755);
    expect(draft.records[0].candidates[0].sourceEvidence[0]).toMatchObject({
      blockIds: ["block-1"],
      documentFingerprint: "f".repeat(64),
      pageStart: 20,
      pageEnd: 40,
    });
    expect(draft.reverseAudit.dynamicManifestSemanticCompletenessApproved).toBe(
      false
    );
    const mutated = JSON.parse(JSON.stringify(draft));
    mutated.records[0].legacyFactRole = "LIMIT";
    const {
      stableStringify,
    } = require("../../../utils/policyAnalysis/aDrivenSourceUnitPlan");
    mutated.draftSha256 = crypto
      .createHash("sha256")
      .update(
        `LF_A_V12_283_631_CROSSWALK_DRAFT_V2\u0000${stableStringify(
          Object.fromEntries(
            Object.entries(mutated).filter(([key]) => key !== "draftSha256")
          )
        )}`
      )
      .digest("hex");
    expect(() =>
      validateCrosswalkDraft({ basis: frozen, draft: mutated })
    ).toThrow("LF_A_DOUBLE_REVIEW_DRAFT_NOT_DETERMINISTIC");
  });

  test("requires two distinct registered human principals and exact agreement", () => {
    const frozen = basis();
    const draft = createCrosswalkDraft({ basis: frozen });
    const keys = [
      crypto.generateKeyPairSync("ed25519"),
      crypto.generateKeyPairSync("ed25519"),
    ];
    const authorityKeys = crypto.generateKeyPairSync("ed25519");
    const authorityPublicKeyPem = authorityKeys.publicKey.export({
      type: "spki",
      format: "pem",
    });
    const authorityPublicKeyFingerprintSha256 = crypto
      .createHash("sha256")
      .update(authorityKeys.publicKey.export({ type: "spki", format: "der" }))
      .digest("hex");
    const registry = createReviewerRegistry({
      basis: frozen,
      draft,
      authorityId: "acceptance-owner",
      authorityPublicKeyPem,
      authorityPrivateKeyPem: authorityKeys.privateKey.export({
        type: "pkcs8",
        format: "pem",
      }),
      reviewers: keys.map(({ publicKey }, index) => ({
        reviewerId: `reviewer-${index + 1}`,
        reviewerSlot: index === 0 ? "A" : "B",
        credentialId: `credential-${index + 1}`,
        publicKeyPem: publicKey.export({ type: "spki", format: "pem" }),
      })),
    });
    const artifacts = ["A", "B"].map((slot, index) => {
      const input = createReviewerTemplate({
        basis: frozen,
        draft,
        registry,
        authorityPublicKeyFingerprintSha256,
        reviewerSlot: slot,
      });
      input.independenceAttestation.reviewPerformedIndependently = true;
      input.decisions = draft.records.map((record) => ({
        recordId: record.recordId,
        relation: "EQUIVALENT",
        dynamicTargets: [record.candidates[0].dynamicComponentId],
        mergeGroupId: null,
        rootCauseDisposition: "NO_UPSTREAM_DEFECT",
        rationale: "Independent source and semantic review.",
      }));
      return sealReviewerArtifact({
        basis: frozen,
        draft,
        registry,
        authorityPublicKeyFingerprintSha256,
        input,
        privateKeyPem: keys[index].privateKey.export({
          type: "pkcs8",
          format: "pem",
        }),
      });
    });
    expect(
      reconcileApprovedCrosswalk({
        basis: frozen,
        draft,
        registry,
        authorityPublicKeyFingerprintSha256,
        reviewA: artifacts[0],
        reviewB: artifacts[1],
      }).summary
    ).toMatchObject({ records: 631, semanticCrosswalkApproved: true });
    const unresolvedArtifacts = ["A", "B"].map((slot, index) => {
      const input = createReviewerTemplate({
        basis: frozen,
        draft,
        registry,
        authorityPublicKeyFingerprintSha256,
        reviewerSlot: slot,
      });
      input.independenceAttestation.reviewPerformedIndependently = true;
      input.decisions = draft.records.map((record) => ({
        recordId: record.recordId,
        relation: "EQUIVALENT",
        dynamicTargets: [record.candidates[0].dynamicComponentId],
        mergeGroupId: null,
        rootCauseDisposition: "UNDETERMINED",
        rationale: "Root cause still requires a final determination.",
      }));
      return sealReviewerArtifact({
        basis: frozen,
        draft,
        registry,
        authorityPublicKeyFingerprintSha256,
        input,
        privateKeyPem: keys[index].privateKey.export({
          type: "pkcs8",
          format: "pem",
        }),
      });
    });
    expect(() =>
      reconcileApprovedCrosswalk({
        basis: frozen,
        draft,
        registry,
        authorityPublicKeyFingerprintSha256,
        reviewA: unresolvedArtifacts[0],
        reviewB: unresolvedArtifacts[1],
      })
    ).toThrow("LF_A_DOUBLE_REVIEW_ROOT_CAUSE_UNDETERMINED");
    artifacts[1].decisions[0].relation = "MISSING";
    expect(() =>
      reconcileApprovedCrosswalk({
        basis: frozen,
        draft,
        registry,
        authorityPublicKeyFingerprintSha256,
        reviewA: artifacts[0],
        reviewB: artifacts[1],
      })
    ).toThrow();
  });

  test("marks role-incompatible records and requires a determined mismatch cause", () => {
    const frozen = basis({ firstRequirementComponentType: "OBJECT" });
    const draft = createCrosswalkDraft({ basis: frozen });
    const record = draft.records[0];
    expect(record.mechanicalRoleReview).toEqual({
      disposition: "ROLE_INCOMPATIBLE",
      exactCandidateCount: 3,
      compatibleCandidateCount: 0,
    });
    const keys = [
      crypto.generateKeyPairSync("ed25519"),
      crypto.generateKeyPairSync("ed25519"),
    ];
    const authorityKeys = crypto.generateKeyPairSync("ed25519");
    const authorityPublicKeyPem = authorityKeys.publicKey.export({
      type: "spki",
      format: "pem",
    });
    const authorityPublicKeyFingerprintSha256 = crypto
      .createHash("sha256")
      .update(authorityKeys.publicKey.export({ type: "spki", format: "der" }))
      .digest("hex");
    const registry = createReviewerRegistry({
      basis: frozen,
      draft,
      authorityId: "acceptance-owner",
      authorityPublicKeyPem,
      authorityPrivateKeyPem: authorityKeys.privateKey.export({
        type: "pkcs8",
        format: "pem",
      }),
      reviewers: keys.map(({ publicKey }, index) => ({
        reviewerId: `reviewer-${index + 1}`,
        reviewerSlot: index === 0 ? "A" : "B",
        credentialId: `credential-${index + 1}`,
        publicKeyPem: publicKey.export({ type: "spki", format: "pem" }),
      })),
    });
    const input = createReviewerTemplate({
      basis: frozen,
      draft,
      registry,
      authorityPublicKeyFingerprintSha256,
      reviewerSlot: "A",
    });
    input.independenceAttestation.reviewPerformedIndependently = true;
    input.decisions = draft.records.map((entry) => ({
      recordId: entry.recordId,
      relation: "EQUIVALENT",
      dynamicTargets: [entry.candidates[0].dynamicComponentId],
      mergeGroupId: null,
      rootCauseDisposition: "NO_UPSTREAM_DEFECT",
      rationale: "Independent source and semantic review.",
    }));
    expect(() =>
      sealReviewerArtifact({
        basis: frozen,
        draft,
        registry,
        authorityPublicKeyFingerprintSha256,
        input,
        privateKeyPem: keys[0].privateKey.export({
          type: "pkcs8",
          format: "pem",
        }),
      })
    ).toThrow("LF_A_DOUBLE_REVIEW_DECISION_INVALID");
    input.decisions[0].rootCauseDisposition = "ROLE_MAPPING_TOO_NARROW";
    expect(
      sealReviewerArtifact({
        basis: frozen,
        draft,
        registry,
        authorityPublicKeyFingerprintSha256,
        input,
        privateKeyPem: keys[0].privateKey.export({
          type: "pkcs8",
          format: "pem",
        }),
      }).status
    ).toBe("SUBMITTED");
  });
});

describe("write-once freeze primitives", () => {
  test("copies bytes, preserves original mode and rejects symlinks/hardlinks", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "lf-review-test-"));
    const source = path.join(root, "source.json");
    const destination = path.join(root, "copy.json");
    fs.writeFileSync(source, "{}", { mode: 0o600 });
    copyRegularVerified(source, destination);
    expect(fs.statSync(source).mode & 0o777).toBe(0o600);
    expect(fs.statSync(destination).mode & 0o777).toBe(0o400);
    const symlink = path.join(root, "symbolic.json");
    fs.symlinkSync(source, symlink);
    expect(() => assertRegularSingleLink(symlink)).toThrow(
      "LF_A_DOUBLE_REVIEW_SOURCE_NOT_REGULAR_SINGLE_LINK"
    );
    const hardlink = path.join(root, "hard.json");
    fs.linkSync(source, hardlink);
    expect(() => assertRegularSingleLink(source)).toThrow(
      "LF_A_DOUBLE_REVIEW_SOURCE_NOT_REGULAR_SINGLE_LINK"
    );
  });
});

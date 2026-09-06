const fs = require("fs");
const os = require("os");
const path = require("path");
const { sha256 } = require("../../utils/policyAnalysis/runIdentity");
const {
  buildSourceBlockLedger,
  canonicalSourceBlockLedgerBytes,
} = require("../../utils/policyAnalysis/sourceBlockLedger");
const {
  buildLfSemanticRequirementManifest,
} = require("../../utils/policyComparison/lfSemanticRequirementManifest");
const {
  DYNAMIC_REFERENCE_TEMPLATE_CONTRACT_ID,
  DYNAMIC_REFERENCE_TEMPLATE_FILES,
  validateDynamicReferenceTemplateArtifacts,
} = require("../../utils/policyComparison/dynamicReferenceRunner");

function documentArtifact(fingerprint = "a".repeat(64)) {
  const marker = "[DOCUMENT_PAGE 1]\n";
  const page =
    "Seite 1\nFeuerversicherung\nNeubauwert mit Limit 15 % der Versicherungssumme\n";
  return {
    schemaVersion: 1,
    fingerprint,
    document: {
      sourceDocumentId: fingerprint,
      pageContent: `${marker}${page}`,
      pageMap: [
        {
          pageNumber: 1,
          start: marker.length,
          end: marker.length + page.length,
        },
      ],
      pdfExtraction: {
        schemaVersion: 1,
        complete: true,
        totalPages: 1,
        processedPages: 1,
        pagesWithText: 1,
      },
    },
  };
}

function semanticOracle() {
  return {
    oracleId: "TEST_ORACLE_V1",
    requirements: [
      {
        id: "FE-01",
        categoryId: "FE",
        categoryLabel: "Feuerversicherung",
        subcategoryId: "FE-WERT",
        subcategoryLabel: "Wert",
        label: "Neubauwert und Prozentlimit",
        pages: [1],
        anchors: ["Neubauwert", "15 % der Versicherungssumme"],
        components: [
          {
            id: "valuation",
            label: "Neubauwert",
            factRole: "VALUATION",
            aliases: ["Neuwert"],
          },
          {
            id: "limit",
            label: "Prozentlimit",
            factRole: "LIMIT",
            aliases: ["Prozentlimit"],
            requestedFields: ["limit"],
            valueBinding: {
              type: "PERCENT",
              basisLabel: "Versicherungssumme",
            },
          },
        ],
        searchPlanStatus: "EXPLORATORY",
      },
    ],
  };
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function fixture(root) {
  const artifact = documentArtifact();
  const ledger = buildSourceBlockLedger(artifact);
  const oracle = semanticOracle();
  const familyContract = {
    schemaVersion: 1,
    contractId: "TEST_FAMILY_V1",
    familyId: "TEST",
    semanticOracleId: oracle.oracleId,
    expectedPhysicalPages: 1,
    expectedStructureDigestSha256: ledger.structureDigestSha256,
    requiredNormalizedAnchors: ["feuerversicherung"],
  };
  const manifest = buildLfSemanticRequirementManifest({
    documentArtifact: artifact,
    ledger,
    oracle,
    familyContract,
  });
  const templateRoot = path.join(root, "reference-template");
  const documentRoot = path.join(root, "documents", "A-01-source-a");
  fs.mkdirSync(templateRoot, { recursive: true });
  fs.mkdirSync(documentRoot, { recursive: true });
  const documentArtifactFile = path.join(documentRoot, "document.private.json");
  writeJson(documentArtifactFile, artifact);
  const ledgerFile = path.join(
    templateRoot,
    DYNAMIC_REFERENCE_TEMPLATE_FILES.ledger
  );
  const manifestFile = path.join(
    templateRoot,
    DYNAMIC_REFERENCE_TEMPLATE_FILES.manifest
  );
  fs.writeFileSync(ledgerFile, canonicalSourceBlockLedgerBytes(ledger));
  writeJson(manifestFile, manifest);
  const sourceDocument = {
    uuid: "source-a",
    side: "A",
    sha256: artifact.fingerprint,
  };
  const templateIdentity = {
    schemaVersion: 1,
    contractId: DYNAMIC_REFERENCE_TEMPLATE_CONTRACT_ID,
    sourceDocumentUuid: sourceDocument.uuid,
    sourceDocumentSha256: sourceDocument.sha256,
    sourceBlockLedgerSha256: ledger.ledgerSha256,
    semanticRequirementManifestSha256: manifest.manifestSha256,
    files: {
      [DYNAMIC_REFERENCE_TEMPLATE_FILES.ledger]: sha256(
        fs.readFileSync(ledgerFile)
      ),
      [DYNAMIC_REFERENCE_TEMPLATE_FILES.manifest]: sha256(
        fs.readFileSync(manifestFile)
      ),
    },
  };
  const identityFile = path.join(
    templateRoot,
    DYNAMIC_REFERENCE_TEMPLATE_FILES.identity
  );
  writeJson(identityFile, templateIdentity);
  return {
    documentArtifactFile,
    familyContract,
    identityFile,
    ledgerFile,
    manifestFile,
    oracle,
    sourceDocument,
    templateDigest: sha256(fs.readFileSync(identityFile)),
    templateIdentity,
    templateRoot,
  };
}

function validate(input) {
  return validateDynamicReferenceTemplateArtifacts(
    {
      templateRoot: input.templateRoot,
      documentArtifactFile: input.documentArtifactFile,
      sourceDocument: input.sourceDocument,
      templateDigest: input.templateDigest,
    },
    { semanticOracle: input.oracle, familyContract: input.familyContract }
  );
}

function rewriteIdentity(input) {
  writeJson(input.identityFile, input.templateIdentity);
  input.templateDigest = sha256(fs.readFileSync(input.identityFile));
}

describe("dynamic LF reference template readback", () => {
  let root;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "dynamic-template-readback-"));
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  test("validates the complete persisted identity and regenerated manifests", () => {
    const input = fixture(root);
    expect(validate(input)).toMatchObject({
      templateDigest: input.templateDigest,
      templateIdentity: input.templateIdentity,
    });
  });

  test("requires every declared template artifact", () => {
    const missingLedger = fixture(path.join(root, "ledger"));
    fs.unlinkSync(missingLedger.ledgerFile);
    expect(() => validate(missingLedger)).toThrow(
      "LF_DYNAMIC_REFERENCE_TEMPLATE_LEDGER_MISSING"
    );

    const missingManifest = fixture(path.join(root, "manifest"));
    fs.unlinkSync(missingManifest.manifestFile);
    expect(() => validate(missingManifest)).toThrow(
      "LF_DYNAMIC_REFERENCE_TEMPLATE_MANIFEST_MISSING"
    );

    const missingIdentity = fixture(path.join(root, "identity"));
    fs.unlinkSync(missingIdentity.identityFile);
    expect(() => validate(missingIdentity)).toThrow(
      "LF_DYNAMIC_REFERENCE_TEMPLATE_ARTIFACT_SET_MISSING"
    );
  });

  test("rejects source UUID, source SHA and document fingerprint divergence", () => {
    const uuidMismatch = fixture(path.join(root, "uuid"));
    uuidMismatch.sourceDocument.uuid = "other-source";
    expect(() => validate(uuidMismatch)).toThrow(
      "LF_DYNAMIC_REFERENCE_SOURCE_IDENTITY_MISMATCH"
    );

    const shaMismatch = fixture(path.join(root, "sha"));
    shaMismatch.sourceDocument.sha256 = "b".repeat(64);
    expect(() => validate(shaMismatch)).toThrow(
      "LF_DYNAMIC_REFERENCE_SOURCE_IDENTITY_MISMATCH"
    );

    const artifactMismatch = fixture(path.join(root, "artifact"));
    const artifact = JSON.parse(
      fs.readFileSync(artifactMismatch.documentArtifactFile, "utf8")
    );
    artifact.fingerprint = "c".repeat(64);
    artifact.document.sourceDocumentId = artifact.fingerprint;
    writeJson(artifactMismatch.documentArtifactFile, artifact);
    expect(() => validate(artifactMismatch)).toThrow(
      "LF_DYNAMIC_REFERENCE_SOURCE_IDENTITY_MISMATCH"
    );
  });

  test("rejects byte-level template file tampering", () => {
    const input = fixture(root);
    fs.appendFileSync(input.ledgerFile, " \n");
    expect(() => validate(input)).toThrow(
      "LF_DYNAMIC_REFERENCE_TEMPLATE_FILE_HASH_MISMATCH"
    );
  });

  test("rejects a changed or missing result templateDigest", () => {
    const changed = fixture(path.join(root, "changed"));
    changed.templateDigest = "d".repeat(64);
    expect(() => validate(changed)).toThrow(
      "LF_DYNAMIC_REFERENCE_TEMPLATE_DIGEST_MISMATCH"
    );

    const missing = fixture(path.join(root, "missing"));
    delete missing.templateDigest;
    expect(() => validate(missing)).toThrow(
      "LF_DYNAMIC_REFERENCE_TEMPLATE_DIGEST_MISMATCH"
    );
  });

  test("regenerates and rejects a self-consistently rehashed ledger mutation", () => {
    const input = fixture(root);
    const ledger = JSON.parse(fs.readFileSync(input.ledgerFile, "utf8"));
    ledger.blocks[1].exactText = "Manipulierter Inhalt";
    ledger.ledgerSha256 = "e".repeat(64);
    fs.writeFileSync(input.ledgerFile, canonicalSourceBlockLedgerBytes(ledger));
    input.templateIdentity.sourceBlockLedgerSha256 = ledger.ledgerSha256;
    input.templateIdentity.files[DYNAMIC_REFERENCE_TEMPLATE_FILES.ledger] =
      sha256(fs.readFileSync(input.ledgerFile));
    rewriteIdentity(input);
    expect(() => validate(input)).toThrow(
      "SOURCE_BLOCK_LEDGER_REBUILD_MISMATCH"
    );
  });

  test("regenerates and rejects a self-consistently rehashed semantic mutation", () => {
    const input = fixture(root);
    const manifest = JSON.parse(fs.readFileSync(input.manifestFile, "utf8"));
    manifest.requirements[0].displayLabel = "Manipulierte Aussage";
    manifest.manifestSha256 = "f".repeat(64);
    writeJson(input.manifestFile, manifest);
    input.templateIdentity.semanticRequirementManifestSha256 =
      manifest.manifestSha256;
    input.templateIdentity.files[DYNAMIC_REFERENCE_TEMPLATE_FILES.manifest] =
      sha256(fs.readFileSync(input.manifestFile));
    rewriteIdentity(input);
    expect(() => validate(input)).toThrow(
      "LF_SEMANTIC_REQUIREMENT_MANIFEST_REBUILD_MISMATCH"
    );
  });
});

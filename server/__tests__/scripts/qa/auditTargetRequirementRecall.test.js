const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  buildControlledOccurrenceWorksheet,
} = require("../../../utils/policyAnalysis/controlledOccurrenceWorksheet");
const currentCatalog = require("../../../resources/policyAnalysis/st-occurrence-full-draft.v0.1.json");
const {
  parseArguments,
  run,
} = require("../../../scripts/qa/auditTargetRequirementRecall.cjs");

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function documentArtifact(text, id) {
  return {
    schemaVersion: 1,
    fingerprint: id,
    document: {
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
    },
  };
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "target-recall-audit-"));
  const baselineRoot = path.join(root, "baseline");
  const output = path.join(root, "audit", "report.private.json");
  const oldCatalog = JSON.parse(JSON.stringify(currentCatalog));
  oldCatalog.catalogId = "st-occurrence-full-draft-v0.4";
  oldCatalog.requirements
    .find(({ id }) => id === "ST-13")
    .components.find(({ id }) => id === "chimney_head").aliases = [
    "Kamin-",
    "Kaminkopf",
    "Kaminköpfe",
  ];
  const specs = [
    {
      uuid: "11111111-1111-4111-8111-111111111111",
      side: "A",
      text: "STURMVERSICHERUNG\nKeine Regelung zu Dachfenstern.",
    },
    {
      uuid: "22222222-2222-4222-8222-222222222222",
      side: "B",
      text: "FEUERVERSICHERUNG\nFE08 Kaminbrand\nVersichert sind Schäden am Kamin durch einen Brand.",
    },
  ];
  const documents = specs.map((spec, position) => {
    const fingerprint = sha256(spec.text);
    const directory = path.join(
      baselineRoot,
      `DOC-0${position + 1}-${spec.uuid}`
    );
    const artifact = documentArtifact(spec.text, fingerprint);
    const manifest = { schemaVersion: 1, uuid: spec.uuid };
    writeJson(path.join(directory, "document.private.json"), artifact);
    writeJson(path.join(directory, "manifest.private.json"), manifest);
    const worksheet = buildControlledOccurrenceWorksheet({
      document: artifact.document,
      documentFingerprint: fingerprint,
      catalog: oldCatalog,
    });
    writeJson(path.join(directory, "ST", "worksheet.private.json"), worksheet);
    return {
      uuid: spec.uuid,
      side: spec.side,
      position,
      role: position === 0 ? "MAIN_POLICY" : "TERMS",
      documentStatus: "FRAMEWORK_TERMS",
      originalName: `${spec.uuid}.pdf`,
      sha256: fingerprint,
      primaryManifestSha256: sha256(
        fs.readFileSync(path.join(directory, "manifest.private.json"))
      ),
    };
  });
  const packageContract = {
    schemaVersion: 1,
    runKind: "fixture",
    releaseId: "baseline-release",
    runSignature: "baseline-signature",
    productProfile: { id: "historical-profile" },
    documents,
  };
  const packageFile = path.join(
    baselineRoot,
    "PACKAGE-COMPARISON",
    "package-contract.private.json"
  );
  writeJson(packageFile, packageContract);
  return {
    root,
    args: {
      baselineRoot,
      categoryView: "ST",
      requirementId: "ST-13",
      expectedBaselinePackageSha256: sha256(fs.readFileSync(packageFile)),
      expectedDocumentCount: 2,
      output,
    },
  };
}

describe("auditTargetRequirementRecall", () => {
  test("parses a fully bound absolute invocation and rejects unknown arguments", () => {
    const parsed = parseArguments([
      "--baselineRoot",
      "/baseline",
      "--categoryView",
      "ST",
      "--requirementId",
      "ST-13",
      "--expectedBaselinePackageSha256",
      "a".repeat(64),
      "--expectedDocumentCount",
      "10",
      "--output",
      "/output/report.private.json",
    ]);
    expect(parsed).toMatchObject({ expectedDocumentCount: 10 });
    expect(() => parseArguments(["--unknown", "x"])).toThrow(
      "TARGET_RECALL_ARGUMENT_UNKNOWN"
    );
  });

  test("audits only ST-13 and proves the old false occurrence disappears", () => {
    const value = fixture();
    try {
      const report = run(value.args, {
        repositoryRoot: path.resolve(__dirname, "../../../.."),
        releaseIdentityFn: () => "fixture-release",
      });
      expect(report).toMatchObject({
        contractId: "TARGET_REQUIREMENT_RECALL_AUDIT_V1",
        status: "TECHNICAL_PASS_REVIEW_REQUIRED",
        customerMaterializationAllowed: false,
        publishable: false,
        deployable: false,
        releaseId: "fixture-release",
        target: {
          categoryView: "ST",
          requirementId: "ST-13",
          currentCatalogId: "st-occurrence-full-draft-v0.5",
        },
        counts: {
          documents: 2,
          sides: { A: 1, B: 1 },
          physicalPages: 2,
          baselineOccurrences: 1,
          currentOccurrences: 0,
        },
        gates: {
          onlySelectedRequirementChanged: true,
          allCurrentComponentsTerminalZero: true,
        },
        candidateConclusion: "CONTROLLED_OCCURRENCE_ZERO_ON_BOTH_SIDES",
      });
      expect(report.documents).toHaveLength(2);
      expect(
        report.documents.flatMap(
          ({ changedRequirementIds }) => changedRequirementIds
        )
      ).toEqual(["ST-13", "ST-13"]);
      expect(report.reportDigestSha256).toMatch(/^[a-f0-9]{64}$/u);
      expect(fs.statSync(value.args.output).mode & 0o777).toBe(0o600);
      expect(() =>
        run(value.args, {
          repositoryRoot: path.resolve(__dirname, "../../../.."),
          releaseIdentityFn: () => "fixture-release",
        })
      ).toThrow("TARGET_RECALL_OUTPUT_EXISTS");
    } finally {
      fs.rmSync(value.root, { recursive: true, force: true });
    }
  });

  test("fails closed when the bound package hash is wrong", () => {
    const value = fixture();
    try {
      expect(() =>
        run(
          { ...value.args, expectedBaselinePackageSha256: "0".repeat(64) },
          {
            repositoryRoot: path.resolve(__dirname, "../../../.."),
            releaseIdentityFn: () => "fixture-release",
          }
        )
      ).toThrow("TARGET_RECALL_BASELINE_PACKAGE_HASH_MISMATCH");
    } finally {
      fs.rmSync(value.root, { recursive: true, force: true });
    }
  });
});

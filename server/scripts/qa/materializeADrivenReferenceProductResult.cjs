#!/usr/bin/env node

process.umask(0o077);

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  validateADrivenCompleteBCorpus,
} = require("../../utils/policyAnalysis/aDrivenCompleteBCorpus");
const {
  buildADrivenReferenceProductResult,
  productMarkdown,
  validateADrivenReferenceProductResult,
  writeADrivenReferenceProductArtifacts,
} = require("../../utils/policyComparison/aDrivenReferenceResultBuilder");
const {
  validatePublishedComparisonArtifactSet,
} = require("../../utils/policyComparison/artifactSetPublisher");
const {
  validateADrivenRequirementReviewWorkbook,
} = require("../../utils/policyAnalysis/aDrivenRequirementReviewWorkbook");
const {
  presentReferenceCustomerResult,
  validateReferenceCustomerResult,
} = require("../../utils/policyComparison/referenceCustomerPresentation");

function fail(message) {
  console.error(`[lf-a-driven-product-result] ${message}`);
  process.exit(1);
}

function argumentsFrom(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value)
      fail(`Ungültiges Argument: ${key || "-"}`);
    const name = key.slice(2);
    if (Object.hasOwn(values, name)) fail(`Doppeltes Argument: ${name}`);
    values[name] = value;
  }
  const fileArguments = [
    "manifest",
    "decisionPlan",
    "preliminaryDecisions",
    "absencePlan",
    "absenceDecisions",
    "rescuePlan",
    "rescueDecisions",
    "finalDecisions",
    "binaryResult",
    "completeBCorpus",
    "sourceInputManifest",
  ];
  const required = [
    ...fileArguments,
    "outputDirectory",
    "generatedAt",
    "sessionUuid",
    "runSignature",
  ];
  const optional = ["artifactOutputDirectory"];
  const unknown = Object.keys(values).filter(
    (name) => !required.includes(name) && !optional.includes(name)
  );
  if (unknown.length) fail(`Unbekannte Argumente: ${unknown.join(",")}`);
  for (const name of required)
    if (!values[name]) fail(`--${name} ist erforderlich`);
  if (Number.isNaN(Date.parse(values.generatedAt)))
    fail("--generatedAt muss ein ISO-Zeitpunkt sein");
  return {
    ...values,
    ...Object.fromEntries(
      [...fileArguments, "outputDirectory", ...optional]
        .filter((name) => values[name])
        .map((name) => [name, path.resolve(values[name])])
    ),
  };
}

function readRegularFile(file, code) {
  let stat;
  try {
    stat = fs.lstatSync(file);
  } catch {
    throw new Error(`${code}_MISSING`);
  }
  if (!stat.isFile() || stat.isSymbolicLink())
    throw new Error(`${code}_INVALID`);
  return fs.readFileSync(file);
}

function readJson(file, code) {
  try {
    return JSON.parse(readRegularFile(file, code).toString("utf8"));
  } catch (error) {
    if (error.message.startsWith(code)) throw error;
    throw new Error(`${code}_INVALID`);
  }
}

function sha256Bytes(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeOrVerify(file, bytes, mismatchCode) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.chmodSync(path.dirname(file), 0o700);
  if (fs.existsSync(file)) {
    const stat = fs.lstatSync(file);
    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      !fs.readFileSync(file).equals(bytes)
    )
      throw new Error(mismatchCode);
    return;
  }
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, bytes, { mode: 0o600 });
  fs.renameSync(temporary, file);
  fs.chmodSync(file, 0o600);
}

function productDocuments({ manifest, completeBCorpus, sourceInputManifest }) {
  const sourceCandidates = sourceInputManifest.documents || [];
  const sourceDocuments = manifest.documents.map((document) => {
    const candidates = sourceCandidates.filter(
      (candidate) =>
        candidate.side === "A" && candidate.sha256 === document.documentSha256
    );
    if (candidates.length !== 1)
      throw new Error("LF_A_DRIVEN_PRODUCT_A_NAME_BINDING_INVALID");
    return {
      uuid: document.documentUuid,
      side: "A",
      position: document.documentPosition,
      role: document.documentRole,
      documentStatus: document.documentStatus,
      originalName: candidates[0].originalName,
      sha256: document.documentSha256,
    };
  });
  const counterpartDocuments = completeBCorpus.documents.map((document) => ({
    uuid: document.documentUuid,
    side: "B",
    position: document.documentPosition,
    role: document.documentRole,
    documentStatus: document.documentStatus,
    originalName: document.originalName,
    sha256: document.documentSha256,
  }));
  return [...sourceDocuments, ...counterpartDocuments];
}

async function materializeOrValidateArtifactSet({
  artifactOutputDirectory,
  productInputs,
}) {
  if (!artifactOutputDirectory) return null;
  if (!fs.existsSync(artifactOutputDirectory)) {
    const artifacts = await writeADrivenReferenceProductArtifacts({
      ...productInputs,
      outputDirectory: artifactOutputDirectory,
    });
    return {
      outputDirectory: artifactOutputDirectory,
      reused: false,
      manifestSha256: artifacts.artifactSetManifest.manifestDigestSha256,
      comparisonSha256: sha256Bytes(
        readRegularFile(artifacts.jsonFile, "LF_A_DRIVEN_PRODUCT_ARTIFACT_JSON")
      ),
      workbookSha256: sha256Bytes(
        readRegularFile(
          artifacts.workbookFile,
          "LF_A_DRIVEN_PRODUCT_ARTIFACT_WORKBOOK"
        )
      ),
    };
  }

  const published = validatePublishedComparisonArtifactSet(
    artifactOutputDirectory
  );
  const persisted = readJson(
    published.files["comparison.private.json"],
    "LF_A_DRIVEN_PRODUCT_ARTIFACT_JSON"
  );
  validateADrivenReferenceProductResult(persisted, productInputs);
  presentReferenceCustomerResult(persisted);
  if (
    fs.readFileSync(published.files["comparison.md"], "utf8") !==
    productMarkdown(persisted)
  )
    throw new Error("LF_A_DRIVEN_PRODUCT_ARTIFACT_MARKDOWN_MISMATCH");
  await validateADrivenRequirementReviewWorkbook(
    productInputs.binaryResult,
    published.files["polizzenvergleich.xlsx"]
  );
  return {
    outputDirectory: artifactOutputDirectory,
    reused: true,
    manifestSha256: published.manifest.manifestDigestSha256,
    comparisonSha256: sha256Bytes(
      readRegularFile(
        published.files["comparison.private.json"],
        "LF_A_DRIVEN_PRODUCT_ARTIFACT_JSON"
      )
    ),
    workbookSha256: sha256Bytes(
      readRegularFile(
        published.files["polizzenvergleich.xlsx"],
        "LF_A_DRIVEN_PRODUCT_ARTIFACT_WORKBOOK"
      )
    ),
  };
}

async function main() {
  const args = argumentsFrom(process.argv.slice(2));
  const inputFiles = {
    manifest: args.manifest,
    decisionPlan: args.decisionPlan,
    preliminaryDecisions: args.preliminaryDecisions,
    absencePlan: args.absencePlan,
    absenceDecisions: args.absenceDecisions,
    rescuePlan: args.rescuePlan,
    rescueDecisions: args.rescueDecisions,
    finalDecisions: args.finalDecisions,
    binaryResult: args.binaryResult,
    completeBCorpus: args.completeBCorpus,
    sourceInputManifest: args.sourceInputManifest,
  };
  const inputs = Object.fromEntries(
    Object.entries(inputFiles).map(([name, file]) => [
      name,
      readJson(file, `LF_A_DRIVEN_PRODUCT_${name.toUpperCase()}`),
    ])
  );
  validateADrivenCompleteBCorpus(inputs.completeBCorpus);
  const lineageInputs = {
    manifest: inputs.manifest,
    decisionPlan: inputs.decisionPlan,
    preliminaryDecisions: inputs.preliminaryDecisions,
    absencePlan: inputs.absencePlan,
    absenceDecisions: inputs.absenceDecisions,
    rescuePlan: inputs.rescuePlan,
    rescueDecisions: inputs.rescueDecisions,
    finalDecisions: inputs.finalDecisions,
  };
  const productInputs = {
    binaryResult: inputs.binaryResult,
    manifest: inputs.manifest,
    lineageInputs,
    documents: productDocuments({
      manifest: inputs.manifest,
      completeBCorpus: inputs.completeBCorpus,
      sourceInputManifest: inputs.sourceInputManifest,
    }),
    metadata: {
      generatedAt: new Date(args.generatedAt).toISOString(),
      sessionUuid: args.sessionUuid,
      runSignature: args.runSignature,
    },
  };
  const productResult = buildADrivenReferenceProductResult(productInputs);
  validateADrivenReferenceProductResult(productResult, productInputs);
  const customerResult = presentReferenceCustomerResult(productResult);
  validateReferenceCustomerResult(customerResult);
  const artifactSet = await materializeOrValidateArtifactSet({
    artifactOutputDirectory: args.artifactOutputDirectory,
    productInputs,
  });

  const productFile = path.join(
    args.outputDirectory,
    "comparison.private.json"
  );
  const customerFile = path.join(
    args.outputDirectory,
    "comparison.customer.private.json"
  );
  const productBytes = jsonBytes(productResult);
  const customerBytes = jsonBytes(customerResult);
  writeOrVerify(
    productFile,
    productBytes,
    "LF_A_DRIVEN_PRODUCT_RESULT_RESUME_MISMATCH"
  );
  writeOrVerify(
    customerFile,
    customerBytes,
    "LF_A_DRIVEN_PRODUCT_CUSTOMER_VIEW_RESUME_MISMATCH"
  );
  const summary = {
    schemaVersion: 1,
    contractId: "LF_A_DRIVEN_REFERENCE_PRODUCT_RUN_V1",
    runContractId: inputs.manifest.runContractId,
    generatedAt: productResult.generatedAt,
    sessionUuid: productResult.sessionUuid,
    runSignature: productResult.runSignature,
    inputFileSha256: Object.fromEntries(
      Object.entries(inputFiles).map(([name, file]) => [
        name,
        sha256Bytes(readRegularFile(file, "LF_A_DRIVEN_PRODUCT_INPUT")),
      ])
    ),
    dynamicManifestSha256: inputs.manifest.manifestSha256,
    binaryResultSha256: inputs.binaryResult.resultSha256,
    productResultSha256: productResult.resultSha256,
    productFileSha256: sha256Bytes(productBytes),
    customerFileSha256: sha256Bytes(customerBytes),
    rows: productResult.totals.rows,
    found: productResult.totals.found,
    notFound: productResult.totals.notFound,
    unresolved: productResult.totals.unresolved,
    sideBOnlyRows: productResult.totals.sideBOnlyRows,
    sourceDocuments: productResult.template.sourceDocuments,
    counterpartDocuments: productResult.documents.filter(
      ({ side }) => side === "B"
    ).length,
    goldDefinesProductionRows: false,
    customerWorkbookCreated: Boolean(artifactSet),
    deploymentPerformed: false,
  };
  const summaryFile = path.join(args.outputDirectory, "summary.private.json");
  writeOrVerify(
    summaryFile,
    jsonBytes(summary),
    "LF_A_DRIVEN_PRODUCT_SUMMARY_RESUME_MISMATCH"
  );
  console.log(JSON.stringify({ ...summary, artifactSet }));
}

main().catch((error) => {
  fail(error.stack || error.message);
});

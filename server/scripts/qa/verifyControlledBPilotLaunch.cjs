#!/usr/bin/env node

process.umask(0o077);

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  createControlledBPilotLaunchReceipt,
} = require("../../utils/policyAnalysis/aDrivenLegacyDoubleReview");
const {
  stableStringify,
} = require("../../utils/policyAnalysis/aDrivenSourceUnitPlan");

const RUN_CONTRACT_ID = "LF_A_CONTROLLED_B_PILOT_LAUNCH_RUN_V1";

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function fail(message) {
  console.error(`[lf-a-controlled-b-pilot-launch] ${message}`);
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
    "request",
    "authorization",
    "trustAnchor",
    "expectedTrustAnchorFile",
    "gate",
    "dynamicManifest",
    "inputManifest",
    "output",
  ];
  const allowed = new Set(fileArguments);
  const unknown = Object.keys(values).filter((key) => !allowed.has(key));
  if (unknown.length) fail(`Unbekannte Argumente: ${unknown.join(",")}`);
  for (const required of allowed)
    if (!values[required]) fail(`--${required} ist erforderlich`);
  return Object.fromEntries(
    fileArguments.map((name) => [name, path.resolve(values[name])])
  );
}

function readJson(file, code) {
  let stat;
  try {
    stat = fs.lstatSync(file);
  } catch {
    throw new Error(`${code}_MISSING`);
  }
  if (!stat.isFile() || stat.isSymbolicLink())
    throw new Error(`${code}_INVALID`);
  const bytes = fs.readFileSync(file);
  try {
    return { value: JSON.parse(bytes.toString("utf8")), bytes };
  } catch {
    throw new Error(`${code}_INVALID`);
  }
}

function writePrivateJson(file, value) {
  if (fs.existsSync(file))
    throw new Error(`LF_A_CONTROLLED_B_PILOT_LAUNCH_OUTPUT_EXISTS:${file}`);
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.renameSync(temporary, file);
  fs.chmodSync(file, 0o600);
}

function readTrustAnchorPin(file) {
  let stat;
  try {
    stat = fs.lstatSync(file);
  } catch {
    throw new Error("LF_A_CONTROLLED_B_PILOT_TRUST_ANCHOR_PIN_MISSING");
  }
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    stat.nlink !== 1 ||
    (stat.mode & 0o022) !== 0
  )
    throw new Error("LF_A_CONTROLLED_B_PILOT_TRUST_ANCHOR_PIN_INVALID");
  const expectedTrustAnchorSha256 = fs.readFileSync(file, "utf8").trim();
  if (!/^[a-f0-9]{64}$/u.test(expectedTrustAnchorSha256))
    throw new Error("LF_A_CONTROLLED_B_PILOT_TRUST_ANCHOR_PIN_INVALID");
  return expectedTrustAnchorSha256;
}

function validateInputManifestBinding({ inputManifest, dynamicManifest }) {
  if (!Array.isArray(inputManifest?.documents))
    throw new Error("LF_A_CONTROLLED_B_PILOT_INPUT_MANIFEST_INVALID");
  const aDocuments = inputManifest.documents
    .filter(({ side }) => side === "A")
    .sort((left, right) => left.position - right.position);
  const bDocuments = inputManifest.documents
    .filter(({ side }) => side === "B")
    .sort((left, right) => left.position - right.position);
  const manifestDocuments = [...(dynamicManifest?.documents || [])].sort(
    (left, right) => left.documentPosition - right.documentPosition
  );
  if (
    aDocuments.length !== manifestDocuments.length ||
    aDocuments.length < 1 ||
    bDocuments.length < 1 ||
    inputManifest.documents.length !== aDocuments.length + bDocuments.length
  )
    throw new Error("LF_A_CONTROLLED_B_PILOT_DOCUMENT_SCOPE_INVALID");
  for (let index = 0; index < aDocuments.length; index += 1) {
    const input = aDocuments[index];
    const manifest = manifestDocuments[index];
    if (
      input.uuid !== manifest.documentUuid ||
      input.sha256 !== manifest.documentSha256 ||
      input.position !== manifest.documentPosition
    )
      throw new Error("LF_A_CONTROLLED_B_PILOT_A_DOCUMENT_MISMATCH");
  }
  const uuids = new Set();
  const positions = new Set();
  for (const [index, document] of bDocuments.entries()) {
    if (
      typeof document.uuid !== "string" ||
      !/^[a-f0-9]{64}$/u.test(document.sha256 || "") ||
      !Number.isInteger(document.position) ||
      document.position !== index ||
      uuids.has(document.uuid) ||
      positions.has(document.position)
    )
      throw new Error("LF_A_CONTROLLED_B_PILOT_B_DOCUMENT_INVALID");
    uuids.add(document.uuid);
    positions.add(document.position);
  }
  return bDocuments.map(({ uuid, sha256: documentSha256, position }) => ({
    uuid,
    documentSha256,
    position,
  }));
}

function createLaunchRunReceipt({
  launch,
  inputManifest,
  inputManifestBytes,
  dynamicManifest,
}) {
  const bDocuments = validateInputManifestBinding({
    inputManifest,
    dynamicManifest,
  });
  const payload = {
    schemaVersion: 1,
    contractId: RUN_CONTRACT_ID,
    launchSha256: launch.launchSha256,
    gateSha256: launch.gateSha256,
    dynamicManifestSha256: dynamicManifest.manifestSha256,
    inputManifestFileSha256: sha256(inputManifestBytes),
    bDocuments,
    bDocumentCount: bDocuments.length,
    status: "CONTROLLED_B_PILOT_LAUNCH_VALIDATED",
    bPilotAllowed: true,
    fullOnePlusNineAllowed: false,
    productRoutingAllowed: false,
    resultMutationAllowed: false,
    customerWorkbookAllowed: false,
    deploymentAllowed: false,
  };
  return {
    ...payload,
    runLaunchSha256: sha256(
      `${RUN_CONTRACT_ID}\u0000${stableStringify(payload)}`
    ),
  };
}

function main(argv = process.argv.slice(2)) {
  const args = argumentsFrom(argv);
  const request = readJson(
    args.request,
    "LF_A_CONTROLLED_B_PILOT_AUTHORIZATION_REQUEST"
  ).value;
  const authorization = readJson(
    args.authorization,
    "LF_A_CONTROLLED_B_PILOT_AUTHORIZATION"
  ).value;
  const trustAnchor = readJson(
    args.trustAnchor,
    "LF_A_CONTROLLED_B_PILOT_TRUST_ANCHOR"
  ).value;
  const gate = readJson(args.gate, "LF_A_CONTROLLED_B_PILOT_GATE").value;
  const dynamicManifest = readJson(
    args.dynamicManifest,
    "LF_A_CONTROLLED_B_PILOT_DYNAMIC_MANIFEST"
  ).value;
  const input = readJson(
    args.inputManifest,
    "LF_A_CONTROLLED_B_PILOT_INPUT_MANIFEST"
  );
  const expectedTrustAnchorSha256 = readTrustAnchorPin(
    args.expectedTrustAnchorFile
  );
  const launch = createControlledBPilotLaunchReceipt({
    request,
    authorization,
    trustAnchor,
    expectedTrustAnchorSha256,
    gate,
    dynamicManifest,
  });
  const receipt = createLaunchRunReceipt({
    launch,
    inputManifest: input.value,
    inputManifestBytes: input.bytes,
    dynamicManifest,
  });
  writePrivateJson(args.output, receipt);
  process.stdout.write(`${receipt.runLaunchSha256}\n`);
  return receipt;
}

if (require.main === module)
  try {
    main();
  } catch (error) {
    fail(error.stack || error.message);
  }

module.exports = {
  RUN_CONTRACT_ID,
  argumentsFrom,
  createLaunchRunReceipt,
  main,
  readTrustAnchorPin,
  validateInputManifestBinding,
};

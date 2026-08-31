const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const DEFAULT_COMPARISON_EXPORT_DIRECTORY = path.join(
  os.homedir(),
  "Downloads",
  "Projekt Lokale KI",
  "Vergleiche"
);

function sha256File(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function configuredExportDirectory() {
  const configured = String(
    process.env.POLICY_COMPARISON_EXPORT_DIR || ""
  ).trim();
  if (configured) return configured;
  return process.platform === "darwin"
    ? DEFAULT_COMPARISON_EXPORT_DIRECTORY
    : null;
}

function archiveComparisonWorkbook({
  workbookFile,
  exportDirectory = configuredExportDirectory(),
  sessionUuid,
  runSignature,
}) {
  if (!exportDirectory) throw new Error("COMPARISON_EXPORT_DIRECTORY_REQUIRED");
  if (!path.isAbsolute(exportDirectory))
    throw new Error("COMPARISON_EXPORT_DIRECTORY_MUST_BE_ABSOLUTE");
  if (!/^[0-9a-f-]{36}$/iu.test(String(sessionUuid || "")))
    throw new Error("COMPARISON_EXPORT_SESSION_UUID_INVALID");
  if (!/^[0-9a-f]{64}$/u.test(String(runSignature || "")))
    throw new Error("COMPARISON_EXPORT_RUN_SIGNATURE_INVALID");

  const source = path.resolve(workbookFile);
  if (!fs.existsSync(source) || !fs.statSync(source).isFile())
    throw new Error("COMPARISON_EXPORT_WORKBOOK_MISSING");

  const targetDirectory = path.resolve(exportDirectory);
  fs.mkdirSync(targetDirectory, { recursive: true, mode: 0o700 });
  const directoryStat = fs.lstatSync(targetDirectory);
  if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink())
    throw new Error("COMPARISON_EXPORT_DIRECTORY_INVALID");

  const filename = `Gesamtvergleich-${sessionUuid}-${runSignature.slice(0, 12)}.xlsx`;
  const target = path.join(targetDirectory, filename);
  const sourceSha256 = sha256File(source);
  if (fs.existsSync(target)) {
    if (!fs.statSync(target).isFile() || sha256File(target) !== sourceSha256)
      throw new Error("COMPARISON_EXPORT_CONFLICT");
    return { file: target, sha256: sourceSha256, reused: true };
  }

  const temporary = path.join(
    targetDirectory,
    `.${filename}.tmp-${process.pid}-${crypto.randomBytes(6).toString("hex")}`
  );
  try {
    fs.copyFileSync(source, temporary, fs.constants.COPYFILE_EXCL);
    fs.chmodSync(temporary, 0o600);
    try {
      fs.linkSync(temporary, target);
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      if (!fs.statSync(target).isFile() || sha256File(target) !== sourceSha256)
        throw new Error("COMPARISON_EXPORT_CONFLICT");
      return { file: target, sha256: sourceSha256, reused: true };
    }
    fs.chmodSync(target, 0o600);
    return { file: target, sha256: sourceSha256, reused: false };
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

module.exports = {
  DEFAULT_COMPARISON_EXPORT_DIRECTORY,
  archiveComparisonWorkbook,
  configuredExportDirectory,
};

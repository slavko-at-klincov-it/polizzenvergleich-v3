#!/usr/bin/env node

process.umask(0o077);

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const {
  calculateHybridShadowMetrics,
} = require("../../utils/policyAnalysis/hybridShadowSearch");

function fail(message) {
  console.error(`[hybrid-shadow-evaluation] ${message}`);
  process.exit(1);
}

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value) fail(`Ungültiges Argument: ${key}`);
    values[key.slice(2)] = value;
  }
  return values;
}

function writePrivateJson(file, value) {
  const temporary = `${file}.tmp-${process.pid}`;
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.renameSync(temporary, file);
  fs.chmodSync(file, 0o600);
}

try {
  const args = parseArguments(process.argv.slice(2));
  const allowed = new Set(["review", "output", "reviewerId", "oracleVersion"]);
  const unknown = Object.keys(args).filter((key) => !allowed.has(key));
  if (unknown.length) fail(`Unbekannte Argumente: ${unknown.join(",")}`);
  for (const required of allowed)
    if (!args[required]) fail(`--${required} ist erforderlich`);
  const reviewFile = path.resolve(args.review);
  const outputFile = path.resolve(args.output);
  if (!fs.existsSync(reviewFile)) fail(`Review fehlt: ${reviewFile}`);
  if (outputFile === reviewFile)
    fail("Das gelabelte Quellreview darf nicht überschrieben werden");
  if (fs.existsSync(outputFile))
    fail(`Auswertungsartefakt existiert bereits: ${outputFile}`);
  const reviewBytes = fs.readFileSync(reviewFile);
  const sourceReviewSha256 = crypto
    .createHash("sha256")
    .update(reviewBytes)
    .digest("hex");
  const review = JSON.parse(reviewBytes.toString("utf8"));
  if (
    review.status !== "REVIEW_REQUIRED" ||
    !args.reviewerId.trim() ||
    !args.oracleVersion.trim()
  )
    fail("Reviewstatus, Reviewer oder Oracle-Version ist ungültig");
  const evaluated = {
    ...review,
    status: "REVIEWED",
    evaluation: {
      sourceReviewPath: reviewFile,
      sourceReviewSha256,
      reviewerId: args.reviewerId.trim(),
      oracleVersion: args.oracleVersion.trim(),
      evaluatedAt: new Date().toISOString(),
    },
    metrics: calculateHybridShadowMetrics(review),
  };
  writePrivateJson(outputFile, evaluated);
  console.log(
    `[hybrid-shadow-evaluation] REVIEWED: Recall ${evaluated.metrics.shadowRecall ?? "n/a"}, FPR ${evaluated.metrics.falsePositiveRate ?? "n/a"}`
  );
} catch (error) {
  fail(error.stack || error.message);
}

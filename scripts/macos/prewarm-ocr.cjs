#!/usr/bin/env node

// Downloads and initializes the exact OCR language data during installation,
// so the broker's first scanned policy does not become an implicit setup step.
const path = require("path");

const repo = path.resolve(
  process.env.POLICY_REPO_DIR || path.resolve(__dirname, "../..")
);
require(path.join(repo, "collector/node_modules/dotenv")).config({
  path: path.join(repo, "collector/.env"),
});
const fs = require("fs");
const { createWorker, OEM } = require(
  path.join(repo, "collector/node_modules/tesseract.js")
);

const cachePath = path.resolve(
  process.env.STORAGE_DIR || path.join(repo, "server/storage"),
  "models/tesseract"
);
fs.mkdirSync(cachePath, { recursive: true, mode: 0o700 });

(async () => {
  const worker = await createWorker(["deu", "eng"], OEM.LSTM_ONLY, {
    cachePath,
  });
  await worker.terminate();
  fs.chmodSync(cachePath, 0o700);
  console.log(
    JSON.stringify({ success: true, languages: ["deu", "eng"], cachePath })
  );
})().catch((error) => {
  console.error(
    `OCR-Sprachdaten konnten nicht vorbereitet werden: ${error.message}`
  );
  process.exit(1);
});

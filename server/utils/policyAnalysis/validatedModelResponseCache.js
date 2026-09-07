const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const CACHE_SCHEMA_VERSION = 1;
const CACHE_PROVIDER = "LMStudioLLM";
const MAX_SEED_FILES = 50_000;

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function privateDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.chmodSync(directory, 0o700);
}

function exactKeys(value, expectedKeys) {
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function responseCacheIdentity({ phase, model, modelTokenLimit, messages }) {
  if (
    !["TRIAGE", "PREPARED_EVIDENCE"].includes(phase) ||
    typeof model !== "string" ||
    !model ||
    !Number.isInteger(Number(modelTokenLimit)) ||
    Number(modelTokenLimit) < 1 ||
    !Array.isArray(messages) ||
    messages.length === 0
  )
    throw new Error("MODEL_RESPONSE_CACHE_IDENTITY_INVALID");
  const messagesSha256 = sha256(JSON.stringify(messages));
  const identity = {
    schemaVersion: CACHE_SCHEMA_VERSION,
    provider: CACHE_PROVIDER,
    phase,
    model,
    modelTokenLimit: Number(modelTokenLimit),
    temperature: 0,
    messagesSha256,
  };
  return {
    ...identity,
    cacheKey: sha256(JSON.stringify(identity)),
  };
}

function cacheEntryFile(cacheDirectory, cacheKey) {
  if (!/^[a-f0-9]{64}$/u.test(cacheKey))
    throw new Error("MODEL_RESPONSE_CACHE_KEY_INVALID");
  return path.join(cacheDirectory, `${cacheKey}.private.json`);
}

function quarantineCacheEntry(cacheDirectory, file) {
  try {
    const quarantineDirectory = path.join(cacheDirectory, "rejected");
    privateDirectory(quarantineDirectory);
    fs.renameSync(
      file,
      path.join(
        quarantineDirectory,
        `${path.basename(file)}.${crypto.randomUUID()}.rejected`
      )
    );
  } catch {
    // A cache miss must never block the primary model path.
  }
}

function validEntry(entry, identity) {
  if (
    !entry ||
    typeof entry !== "object" ||
    Array.isArray(entry) ||
    !exactKeys(entry, [
      "schemaVersion",
      "provider",
      "phase",
      "model",
      "modelTokenLimit",
      "temperature",
      "messagesSha256",
      "cacheKey",
      "responseModel",
      "responseSha256",
      "responseText",
    ])
  )
    return false;
  return (
    entry.schemaVersion === identity.schemaVersion &&
    entry.provider === identity.provider &&
    entry.phase === identity.phase &&
    entry.model === identity.model &&
    entry.modelTokenLimit === identity.modelTokenLimit &&
    entry.temperature === identity.temperature &&
    entry.messagesSha256 === identity.messagesSha256 &&
    entry.cacheKey === identity.cacheKey &&
    entry.responseModel === identity.model &&
    typeof entry.responseText === "string" &&
    entry.responseText.length > 0 &&
    entry.responseSha256 === sha256(entry.responseText)
  );
}

function readValidatedCachedResponse({
  cacheDirectory,
  phase,
  model,
  modelTokenLimit,
  messages,
  validateResponse,
}) {
  if (!cacheDirectory) return null;
  if (typeof validateResponse !== "function")
    throw new Error("MODEL_RESPONSE_CACHE_VALIDATOR_REQUIRED");
  const identity = responseCacheIdentity({
    phase,
    model,
    modelTokenLimit,
    messages,
  });
  const file = cacheEntryFile(cacheDirectory, identity.cacheKey);
  let stat;
  try {
    stat = fs.lstatSync(file);
  } catch {
    return null;
  }
  if (stat.isSymbolicLink() || !stat.isFile() || stat.size > 2_000_000)
    return null;
  let entry;
  try {
    entry = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    quarantineCacheEntry(cacheDirectory, file);
    return null;
  }
  if (!validEntry(entry, identity)) {
    quarantineCacheEntry(cacheDirectory, file);
    return null;
  }
  try {
    return {
      cacheKey: identity.cacheKey,
      responseText: entry.responseText,
      validated: validateResponse(entry.responseText),
    };
  } catch {
    quarantineCacheEntry(cacheDirectory, file);
    return null;
  }
}

function publishCachedResponse({
  cacheDirectory,
  phase,
  model,
  modelTokenLimit,
  messages,
  responseText,
  responseModel,
}) {
  if (!cacheDirectory) return null;
  if (!responseText || responseModel !== model)
    throw new Error("MODEL_RESPONSE_CACHE_PUBLICATION_INVALID");
  privateDirectory(cacheDirectory);
  const identity = responseCacheIdentity({
    phase,
    model,
    modelTokenLimit,
    messages,
  });
  const file = cacheEntryFile(cacheDirectory, identity.cacheKey);
  const entry = {
    ...identity,
    responseModel,
    responseSha256: sha256(responseText),
    responseText,
  };
  const temporary = path.join(
    cacheDirectory,
    `.${identity.cacheKey}.${process.pid}.${crypto.randomUUID()}.tmp`
  );
  fs.writeFileSync(temporary, JSON.stringify(entry), {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });
  try {
    fs.linkSync(temporary, file);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  } finally {
    fs.unlinkSync(temporary);
  }
  return identity.cacheKey;
}

function walkRegularFiles(root, visitor) {
  let count = 0;
  const pending = [root];
  while (pending.length > 0) {
    const current = pending.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (count >= MAX_SEED_FILES) return count;
      const target = path.join(current, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (entry.name !== "response-cache-v1") pending.push(target);
        continue;
      }
      if (!entry.isFile()) continue;
      count += 1;
      visitor(target);
    }
  }
  return count;
}

function safeJson(file) {
  try {
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink() || !stat.isFile() || stat.size > 50_000_000)
      return null;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function seedResponseCacheFromRunHistory({ sessionRunsRoot, cacheDirectory }) {
  privateDirectory(cacheDirectory);
  const stats = {
    completedRunRoots: 0,
    scannedFiles: 0,
    answerFiles: 0,
    candidateResponses: 0,
    published: 0,
  };
  if (!fs.existsSync(sessionRunsRoot)) return stats;
  const completedRunRoots = fs
    .readdirSync(sessionRunsRoot, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        entry.name.startsWith("resume-") &&
        [
          "artifact-set-manifest.private.json",
          "comparison.private.json",
          "export.private.json",
          "polizzenvergleich.xlsx",
        ].every((name) =>
          fs.existsSync(path.join(sessionRunsRoot, entry.name, "result", name))
        )
    )
    .map((entry) => path.join(sessionRunsRoot, entry.name))
    .sort(
      (left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs
    );
  stats.completedRunRoots = completedRunRoots.length;

  const visitAnswerFile = (file) => {
    if (path.basename(file) !== "answers.private.json") return;
    const phase = file.includes(`${path.sep}triage${path.sep}`)
      ? "TRIAGE"
      : file.includes(`${path.sep}effects${path.sep}`)
        ? "PREPARED_EVIDENCE"
        : null;
    if (!phase) return;
    stats.answerFiles += 1;
    const directory = path.dirname(file);
    const answers = safeJson(file);
    const messageCalls = safeJson(
      path.join(directory, "messages.private.json")
    );
    const report = safeJson(path.join(directory, "report.json"));
    if (
      !Array.isArray(answers) ||
      !Array.isArray(messageCalls) ||
      answers.length !== messageCalls.length ||
      !["PASS", "TECHNICAL_PASS_REVIEW_REQUIRED"].includes(report?.status) ||
      report?.model?.provider !== CACHE_PROVIDER ||
      report.model.temperature !== 0 ||
      typeof report.model.id !== "string" ||
      !Number.isInteger(report.model.declaredTokenLimit)
    )
      return;
    answers.forEach((answer, index) => {
      const messageCall = messageCalls[index];
      if (
        !answer?.targetId ||
        answer.targetId !== messageCall?.targetId ||
        answer.attempt !== messageCall.attempt ||
        !Array.isArray(messageCall.messages) ||
        !answer.responseText ||
        answer.metrics?.responseModel !== report.model.id
      )
        return;
      stats.candidateResponses += 1;
      const identity = responseCacheIdentity({
        phase,
        model: report.model.id,
        modelTokenLimit: report.model.declaredTokenLimit,
        messages: messageCall.messages,
      });
      const destination = cacheEntryFile(cacheDirectory, identity.cacheKey);
      const existed = fs.existsSync(destination);
      publishCachedResponse({
        cacheDirectory,
        phase,
        model: report.model.id,
        modelTokenLimit: report.model.declaredTokenLimit,
        messages: messageCall.messages,
        responseText: answer.responseText,
        responseModel: answer.metrics.responseModel,
      });
      if (!existed && fs.existsSync(destination)) stats.published += 1;
    });
  };
  for (const runRoot of completedRunRoots)
    stats.scannedFiles += walkRegularFiles(runRoot, visitAnswerFile);
  return stats;
}

module.exports = {
  CACHE_SCHEMA_VERSION,
  publishCachedResponse,
  readValidatedCachedResponse,
  responseCacheIdentity,
  seedResponseCacheFromRunHistory,
};

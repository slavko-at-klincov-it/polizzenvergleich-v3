const fs = require("fs");
const path = require("path");

function defaultRepositoryRoot() {
  return path.resolve(__dirname, "..");
}

function chatModelStatePath(repositoryRoot = defaultRepositoryRoot()) {
  const runtimeDirectory =
    process.env.POLICY_RUNTIME_DIR || path.join(repositoryRoot, ".runtime");
  return path.join(runtimeDirectory, "models.json");
}

function readChatModelState(repositoryRoot = defaultRepositoryRoot()) {
  const statePath = chatModelStatePath(repositoryRoot);
  if (!fs.existsSync(statePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(statePath, "utf8"));
  } catch {
    return {};
  }
}

function writeChatModelState(
  nextState = {},
  repositoryRoot = defaultRepositoryRoot()
) {
  const statePath = chatModelStatePath(repositoryRoot);
  const runtimeDirectory = path.dirname(statePath);
  fs.mkdirSync(runtimeDirectory, { recursive: true, mode: 0o700 });

  const state = {
    ...readChatModelState(repositoryRoot),
    ...nextState,
  };
  const temporaryPath = `${statePath}.tmp-${process.pid}`;
  fs.writeFileSync(temporaryPath, JSON.stringify(state, null, 2), {
    mode: 0o600,
  });
  fs.renameSync(temporaryPath, statePath);
  fs.chmodSync(statePath, 0o600);
  return state;
}

function pendingChatIdentifiers(state = {}) {
  return [
    ...(Array.isArray(state.previousChatIdentifiers)
      ? state.previousChatIdentifiers
      : []),
    state.previousChatIdentifier,
  ]
    .map((identifier) => String(identifier || "").trim())
    .filter(
      (identifier, index, values) =>
        Boolean(identifier) && values.indexOf(identifier) === index
    );
}

module.exports = {
  chatModelStatePath,
  pendingChatIdentifiers,
  readChatModelState,
  writeChatModelState,
};

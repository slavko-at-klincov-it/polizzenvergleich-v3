#!/usr/bin/env node

// Idempotently provisions the minimum product topology. It deliberately uses
// AnythingLLM's model validation/hashing rather than writing password rows itself.
const fs = require("fs");
const path = require("path");
const {
  MANAGED_EMBEDDING_ENV,
} = require("../../shared/managedEmbeddingContract.cjs");

const repo = path.resolve(
  process.env.POLICY_REPO_DIR || path.resolve(__dirname, "../..")
);
require(path.join(repo, "server/node_modules/dotenv")).config({
  path: path.join(repo, "server/.env"),
});

const prisma = require(path.join(repo, "server/utils/prisma"));
const { User } = require(path.join(repo, "server/models/user"));
const { Workspace } = require(path.join(repo, "server/models/workspace"));
const { SystemSettings } = require(
  path.join(repo, "server/models/systemSettings")
);

const adminUsername = process.env.POLICY_ADMIN_USERNAME || "admin";
const brokerUsername = process.env.POLICY_BROKER_USERNAME || "makler";
const command = process.argv[2] || "apply";
const workspaceSlug = "polizzenvergleich";
const installationMarker = "policy_comparison_installation_version";
const installationState = "policy_comparison_installation_state";
const installationVersion = "1";

function expectedPrompt() {
  return fs
    .readFileSync(
      process.env.POLICY_SYSTEM_PROMPT_PATH ||
        path.join(__dirname, "policy-system-prompt.txt"),
      "utf8"
    )
    .trim();
}

async function status() {
  const [admin, broker, workspace, marker, state, multiUser, onboarding] =
    await Promise.all([
      prisma.users.findUnique({ where: { username: adminUsername } }),
      prisma.users.findUnique({ where: { username: brokerUsername } }),
      prisma.workspaces.findUnique({ where: { slug: workspaceSlug } }),
      prisma.system_settings.findUnique({
        where: { label: installationMarker },
      }),
      prisma.system_settings.findUnique({
        where: { label: installationState },
      }),
      prisma.system_settings.findUnique({
        where: { label: "multi_user_mode" },
      }),
      prisma.system_settings.findUnique({
        where: { label: "onboarding_complete" },
      }),
    ]);
  const membership =
    broker && workspace
      ? await prisma.workspace_users.findFirst({
          where: { user_id: broker.id, workspace_id: workspace.id },
        })
      : null;
  const problems = [];
  if (marker?.value !== installationVersion)
    problems.push("Installationsmarkierung fehlt oder ist veraltet.");
  if (state?.value !== `complete:${installationVersion}`)
    problems.push("Installation ist nicht vollständig abgeschlossen.");
  if (!admin) problems.push(`Admin '${adminUsername}' fehlt.`);
  else if (admin.role !== "admin")
    problems.push(`'${adminUsername}' ist kein Admin.`);
  else if (admin.suspended)
    problems.push(`Admin '${adminUsername}' ist gesperrt.`);
  if (!broker) problems.push(`Makler '${brokerUsername}' fehlt.`);
  else if (broker.role !== "default")
    problems.push(`'${brokerUsername}' hat nicht die Rolle default.`);
  else if (broker.suspended)
    problems.push(`Makler '${brokerUsername}' ist gesperrt.`);
  if (!workspace) problems.push("Workspace 'polizzenvergleich' fehlt.");
  if (workspace) {
    if (workspace.chatMode !== "chat")
      problems.push("Workspace-Chatmodus ist nicht chat.");
    if (workspace.chatProvider !== "lmstudio")
      problems.push("Workspace nutzt nicht LM Studio.");
    if (workspace.chatModel !== null)
      problems.push("Workspace überschreibt das global konfigurierte Chatmodell.");
    if (workspace.topN !== 8) problems.push("Workspace topN ist nicht 8.");
    if (workspace.similarityThreshold !== 0.2)
      problems.push("Workspace Similarity Threshold ist nicht 0.2.");
    if (workspace.vectorSearchMode !== "default")
      problems.push("Workspace-Suchmodus ist unerwartet.");
    if (workspace.openAiPrompt !== expectedPrompt())
      problems.push("Workspace-Systemprompt weicht ab.");
  }
  if (!membership) problems.push("Makler ist dem Workspace nicht zugeordnet.");
  if (multiUser?.value !== "true")
    problems.push("Multi-User-Modus ist nicht aktiv.");
  if (onboarding?.value !== "true")
    problems.push("Onboarding ist nicht abgeschlossen.");
  const expectedEnv = {
    LLM_PROVIDER: "lmstudio",
    LMSTUDIO_BASE_PATH: "http://127.0.0.1:1234/v1",
    LMSTUDIO_MODEL_TOKEN_LIMIT: "32768",
    ...MANAGED_EMBEDDING_ENV,
    TARGET_OCR_LANG: "deu,eng",
  };
  for (const [key, value] of Object.entries(expectedEnv)) {
    if (process.env[key] !== value)
      problems.push(`${key} ist nicht '${value}'.`);
  }
  if (!String(process.env.LMSTUDIO_MODEL_PREF || "").trim())
    problems.push("LMSTUDIO_MODEL_PREF enthält kein konfiguriertes Chatmodell.");
  return {
    adminExists: Boolean(admin),
    brokerExists: Boolean(broker),
    workspaceExists: Boolean(workspace),
    needsAdminPassword: !admin,
    needsBrokerPassword: !broker,
    ready: problems.length === 0,
    problems,
  };
}

async function guardFirstProvisioning() {
  const [marker, state] = await Promise.all([
    prisma.system_settings.findUnique({ where: { label: installationMarker } }),
    prisma.system_settings.findUnique({ where: { label: installationState } }),
  ]);
  if (
    marker?.value === installationVersion &&
    state?.value === `complete:${installationVersion}`
  )
    return;

  const pending = state?.value === `pending:${installationVersion}`;
  const [users, workspaces, documents, chats, threads] = await Promise.all([
    pending
      ? prisma.users.count({
          where: { username: { notIn: [adminUsername, brokerUsername] } },
        })
      : prisma.users.count(),
    pending
      ? prisma.workspaces.count({ where: { slug: { not: workspaceSlug } } })
      : prisma.workspaces.count(),
    prisma.workspace_documents.count(),
    prisma.workspace_chats.count(),
    prisma.workspace_threads.count(),
  ]);
  if (
    process.env.POLICY_ADOPT_EXISTING !== "1" &&
    (users || workspaces || documents || chats || threads)
  ) {
    throw new Error(
      "Bestehende fremde AnythingLLM-Daten erkannt. Installation abgebrochen; für eine bewusste Übernahme POLICY_ADOPT_EXISTING=1 setzen."
    );
  }
  const pendingResult = await SystemSettings._updateSettings({
    [installationState]: `pending:${installationVersion}`,
  });
  if (!pendingResult.success)
    throw new Error(
      pendingResult.error || "Installationsstatus konnte nicht angelegt werden."
    );
}

async function ensureUser(username, password, role) {
  const bcrypt = require(path.join(repo, "server/node_modules/bcryptjs"));
  const existing = await prisma.users.findUnique({ where: { username } });
  if (existing) {
    if (existing.role !== role) {
      throw new Error(
        `Benutzer '${username}' existiert mit unerwarteter Rolle '${existing.role}'.`
      );
    }
    if (password && !bcrypt.compareSync(String(password), existing.password))
      throw new Error(`Passwortprüfung für '${username}' ist fehlgeschlagen.`);
    return existing;
  }
  if (!password)
    throw new Error(`Passwort für neuen Benutzer '${username}' fehlt.`);
  const { user, error } = await User.create({ username, password, role });
  if (error || !user)
    throw new Error(
      error || `Benutzer '${username}' konnte nicht angelegt werden.`
    );
  const createdRecord = await prisma.users.findUnique({ where: { username } });
  if (
    !createdRecord ||
    !bcrypt.compareSync(String(password), createdRecord.password)
  )
    throw new Error(`Passwortprüfung für '${username}' ist fehlgeschlagen.`);
  return user;
}

async function apply() {
  if (adminUsername === brokerUsername)
    throw new Error(
      "Admin und Makler benötigen unterschiedliche Benutzernamen."
    );
  await guardFirstProvisioning();
  const admin = await ensureUser(
    adminUsername,
    process.env.POLICY_ADMIN_PASSWORD,
    "admin"
  );
  const broker = await ensureUser(
    brokerUsername,
    process.env.POLICY_BROKER_PASSWORD,
    "default"
  );
  const prompt = expectedPrompt();

  let workspace = await prisma.workspaces.findUnique({
    where: { slug: workspaceSlug },
  });
  if (!workspace) {
    const created = await Workspace.new("Polizzenvergleich", broker.id, {
      chatMode: "chat",
      chatProvider: "lmstudio",
      chatModel: null,
      openAiPrompt: prompt,
      topN: 8,
      similarityThreshold: 0.2,
      vectorSearchMode: "default",
    });
    if (!created.workspace)
      throw new Error(
        created.message || "Workspace konnte nicht angelegt werden."
      );
    workspace = created.workspace;
  } else {
    const updated = await Workspace.update(workspace.id, {
      name: "Polizzenvergleich",
      chatMode: "chat",
      chatProvider: "lmstudio",
      chatModel: null,
      openAiPrompt: prompt,
      topN: 8,
      similarityThreshold: 0.2,
      vectorSearchMode: "default",
    });
    if (updated.message && !updated.workspace) throw new Error(updated.message);
    workspace = updated.workspace || workspace;
  }

  const membership = await prisma.workspace_users.findFirst({
    where: { user_id: broker.id, workspace_id: workspace.id },
  });
  if (!membership) {
    await prisma.workspace_users.create({
      data: { user_id: broker.id, workspace_id: workspace.id },
    });
  }

  const settings = await SystemSettings._updateSettings({
    multi_user_mode: true,
    onboarding_complete: true,
  });
  if (!settings.success)
    throw new Error(
      settings.error || "Systemeinstellungen konnten nicht gesetzt werden."
    );
  const markerResult = await SystemSettings._updateSettings({
    [installationMarker]: installationVersion,
  });
  if (!markerResult.success)
    throw new Error(
      markerResult.error ||
        "Installationsmarkierung konnte nicht gesetzt werden."
    );
  const completed = await SystemSettings._updateSettings({
    [installationState]: `complete:${installationVersion}`,
  });
  if (!completed.success)
    throw new Error(
      completed.error ||
        "Installationsstatus konnte nicht abgeschlossen werden."
    );

  return {
    success: true,
    admin: admin.username,
    broker: broker.username,
    workspace: workspace.slug,
  };
}

async function main() {
  try {
    const result = command === "status" ? await status() : await apply();
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) main();

module.exports = {
  status,
  guardFirstProvisioning,
  ensureUser,
  apply,
};

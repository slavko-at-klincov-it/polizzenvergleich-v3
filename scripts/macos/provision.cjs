#!/usr/bin/env node

// Idempotently provisions the local single-user product topology. Existing
// managed multi-user installations are migrated without deleting user rows or
// customer content.
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
const { Workspace } = require(path.join(repo, "server/models/workspace"));
const { SystemSettings } = require(
  path.join(repo, "server/models/systemSettings")
);

const command = process.argv[2] || "apply";
const workspaceSlug = "polizzenvergleich";
const installationMarker = "policy_comparison_installation_version";
const installationState = "policy_comparison_installation_state";
const installationVersion = "2";
const legacyInstallationVersion = "1";

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
  const [workspace, marker, state, multiUser, onboarding, noAuth] =
    await Promise.all([
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
      prisma.system_settings.findUnique({
        where: { label: "policy_no_auth_mode" },
      }),
    ]);
  const problems = [];
  if (marker?.value !== installationVersion)
    problems.push("Installationsmarkierung fehlt oder ist veraltet.");
  if (state?.value !== `complete:${installationVersion}`)
    problems.push("Installation ist nicht vollständig abgeschlossen.");
  if (!workspace) problems.push("Workspace 'polizzenvergleich' fehlt.");
  if (workspace) {
    if (workspace.chatMode !== "chat")
      problems.push("Workspace-Chatmodus ist nicht chat.");
    if (workspace.chatProvider !== "lmstudio")
      problems.push("Workspace nutzt nicht LM Studio.");
    if (workspace.chatModel !== null)
      problems.push(
        "Workspace überschreibt das global konfigurierte Chatmodell."
      );
    if (workspace.topN !== 8) problems.push("Workspace topN ist nicht 8.");
    if (workspace.similarityThreshold !== 0.2)
      problems.push("Workspace Similarity Threshold ist nicht 0.2.");
    if (workspace.vectorSearchMode !== "default")
      problems.push("Workspace-Suchmodus ist unerwartet.");
    if (workspace.openAiPrompt !== expectedPrompt())
      problems.push("Workspace-Systemprompt weicht ab.");
  }
  if (multiUser?.value !== "false")
    problems.push("Lokaler Single-User-Modus ist nicht aktiv.");
  if (onboarding?.value !== "true")
    problems.push("Onboarding ist nicht abgeschlossen.");
  if (noAuth?.value !== "true")
    problems.push("Die Datenbank-Login-Sperre ist nicht aktiv.");
  if (String(process.env.AUTH_TOKEN || "").trim())
    problems.push("Der lokale Passwortschutz ist noch aktiv.");
  if (process.env.POLICY_SINGLE_USER_NO_AUTH !== "true")
    problems.push("Die verwaltete Login-Sperre ist nicht aktiv.");
  const expectedEnv = {
    LLM_PROVIDER: "lmstudio",
    LMSTUDIO_BASE_PATH: "http://127.0.0.1:1234/v1",
    ...MANAGED_EMBEDDING_ENV,
    TARGET_OCR_LANG: "deu,eng",
  };
  for (const [key, value] of Object.entries(expectedEnv)) {
    if (process.env[key] !== value)
      problems.push(`${key} ist nicht '${value}'.`);
  }
  if (!String(process.env.LMSTUDIO_MODEL_PREF || "").trim())
    problems.push(
      "LMSTUDIO_MODEL_PREF enthält kein konfiguriertes Chatmodell."
    );
  const configuredChatContext = Number(process.env.LMSTUDIO_MODEL_TOKEN_LIMIT);
  if (!Number.isInteger(configuredChatContext) || configuredChatContext < 4096)
    problems.push(
      "LMSTUDIO_MODEL_TOKEN_LIMIT ist kein gültiges Kontextfenster ab 4096."
    );
  return {
    workspaceExists: Boolean(workspace),
    needsAdminPassword: false,
    needsBrokerPassword: false,
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
  if (
    marker?.value === legacyInstallationVersion &&
    state?.value === `complete:${legacyInstallationVersion}`
  ) {
    if (process.env.POLICY_ADOPT_EXISTING !== "1") {
      const [foreignUsers, foreignWorkspaces] = await Promise.all([
        prisma.users.count({
          where: { username: { notIn: ["admin", "makler"] } },
        }),
        prisma.workspaces.count({ where: { slug: { not: workspaceSlug } } }),
      ]);
      if (foreignUsers || foreignWorkspaces) {
        throw new Error(
          "Unerwartete Benutzer oder Workspaces in der alten Installation erkannt. Login-Migration abgebrochen."
        );
      }
    }
    return;
  }

  const legacyPending =
    state?.value === `pending:${legacyInstallationVersion}` &&
    (!marker?.value || marker.value === legacyInstallationVersion);
  if (legacyPending && process.env.POLICY_ADOPT_EXISTING !== "1") {
    const [foreignUsers, foreignWorkspaces, documents, chats, threads] =
      await Promise.all([
        prisma.users.count({
          where: { username: { notIn: ["admin", "makler"] } },
        }),
        prisma.workspaces.count({ where: { slug: { not: workspaceSlug } } }),
        prisma.workspace_documents.count(),
        prisma.workspace_chats.count(),
        prisma.workspace_threads.count(),
      ]);
    if (foreignUsers || foreignWorkspaces || documents || chats || threads) {
      throw new Error(
        "Unerwartete Daten in der unvollständigen alten Installation erkannt. Login-Migration abgebrochen."
      );
    }
    return;
  }

  const pending = state?.value === `pending:${installationVersion}`;
  const [users, workspaces, documents, chats, threads] = await Promise.all([
    prisma.users.count(),
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

async function migrateManagedWorkspaceOwnership(
  tx,
  workspaceId,
  legacyBrokerId = null
) {
  await tx.workspace_threads.updateMany({
    where: { workspace_id: workspaceId },
    data: { user_id: null },
  });
  await tx.workspace_chats.updateMany({
    where: { workspaceId },
    data: { user_id: null },
  });
  await tx.workspace_agent_invocations.updateMany({
    where: { workspace_id: workspaceId },
    data: { user_id: null },
  });
  await tx.workspace_parsed_files.updateMany({
    where: { workspaceId },
    data: { userId: null },
  });
  await tx.comparison_documents.updateMany({
    where: { workspaceId },
    data: { userId: null },
  });
  await tx.memories.updateMany({
    where: { workspaceId },
    data: { userId: null },
  });
  if (!legacyBrokerId) return;

  await tx.memories.updateMany({
    where: { workspaceId: null, userId: legacyBrokerId },
    data: { userId: null },
  });
  await tx.browser_extension_api_keys.updateMany({
    where: { user_id: legacyBrokerId },
    data: { user_id: null },
  });
  await tx.desktop_mobile_devices.updateMany({
    where: { userId: legacyBrokerId },
    data: { userId: null },
  });
  await tx.system_prompt_variables.updateMany({
    where: { userId: legacyBrokerId },
    data: { userId: null },
  });

  const presets = await tx.slash_command_presets.findMany({
    where: { userId: legacyBrokerId },
  });
  for (const preset of presets) {
    const singleUserPreset = await tx.slash_command_presets.findUnique({
      where: { uid_command: { uid: 0, command: preset.command } },
    });
    if (singleUserPreset) {
      await tx.slash_command_presets.update({
        where: { id: singleUserPreset.id },
        data: {
          prompt: preset.prompt,
          description: preset.description,
        },
      });
      continue;
    }
    await tx.slash_command_presets.update({
      where: { id: preset.id },
      data: { uid: 0, userId: null },
    });
  }
}

async function migrateManagedWorkspaceToSingleUser(
  workspaceId,
  legacyBrokerId = null
) {
  await prisma.$transaction((tx) =>
    migrateManagedWorkspaceOwnership(tx, workspaceId, legacyBrokerId)
  );
}

async function apply() {
  await guardFirstProvisioning();
  const prompt = expectedPrompt();

  let workspace = await prisma.workspaces.findUnique({
    where: { slug: workspaceSlug },
  });
  if (!workspace) {
    const created = await Workspace.new("Polizzenvergleich", null, {
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

  const legacyBroker = await prisma.users.findUnique({
    where: { username: "makler" },
  });
  await prisma.$transaction(async (tx) => {
    await migrateManagedWorkspaceOwnership(tx, workspace.id, legacyBroker?.id);
    const settings = {
      multi_user_mode: "false",
      onboarding_complete: "true",
      policy_no_auth_mode: "true",
      [installationMarker]: installationVersion,
      [installationState]: `complete:${installationVersion}`,
    };
    for (const [label, value] of Object.entries(settings)) {
      await tx.system_settings.upsert({
        where: { label },
        update: { value },
        create: { label, value },
      });
    }
  });

  return {
    success: true,
    loginRequired: false,
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
  migrateManagedWorkspaceOwnership,
  migrateManagedWorkspaceToSingleUser,
  apply,
};

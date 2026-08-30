-- CreateTable
CREATE TABLE "policy_comparison_sessions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uuid" TEXT NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "userId" INTEGER,
    "threadId" INTEGER,
    "ownerKey" TEXT NOT NULL,
    "conversationKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "progress" TEXT,
    "inputManifest" TEXT,
    "resultPath" TEXT,
    "error" TEXT,
    "workerPid" INTEGER,
    "cancelRequested" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "policy_comparison_sessions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "policy_comparison_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "policy_comparison_sessions_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "workspace_threads" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "policy_comparison_documents" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uuid" TEXT NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "side" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "documentStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "originalName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "policy_comparison_documents_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "policy_comparison_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "policy_comparison_sessions_uuid_key" ON "policy_comparison_sessions"("uuid");
CREATE UNIQUE INDEX "policy_comparison_sessions_workspaceId_ownerKey_conversationKey_key" ON "policy_comparison_sessions"("workspaceId", "ownerKey", "conversationKey");
CREATE INDEX "policy_comparison_sessions_workspaceId_idx" ON "policy_comparison_sessions"("workspaceId");
CREATE INDEX "policy_comparison_sessions_userId_idx" ON "policy_comparison_sessions"("userId");
CREATE INDEX "policy_comparison_sessions_threadId_idx" ON "policy_comparison_sessions"("threadId");
CREATE UNIQUE INDEX "policy_comparison_documents_uuid_key" ON "policy_comparison_documents"("uuid");
CREATE UNIQUE INDEX "policy_comparison_documents_storedName_key" ON "policy_comparison_documents"("storedName");
CREATE UNIQUE INDEX "policy_comparison_documents_sessionId_side_sha256_key" ON "policy_comparison_documents"("sessionId", "side", "sha256");
CREATE INDEX "policy_comparison_documents_sessionId_side_position_idx" ON "policy_comparison_documents"("sessionId", "side", "position");

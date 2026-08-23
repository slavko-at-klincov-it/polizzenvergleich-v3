-- CreateTable
CREATE TABLE "comparison_documents" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workspaceId" INTEGER NOT NULL,
    "threadId" INTEGER NOT NULL,
    "userId" INTEGER,
    "slot" TEXT NOT NULL CHECK ("slot" IN ('A', 'B')),
    "status" TEXT NOT NULL DEFAULT 'indexing' CHECK ("status" IN ('indexing', 'ready', 'failed', 'deleting')),
    "originalFilename" TEXT NOT NULL,
    "tokenCount" INTEGER DEFAULT 0,
    "pageCount" INTEGER,
    "parsedFileId" INTEGER,
    "workspaceDocumentId" INTEGER,
    "docId" TEXT,
    "docpath" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "comparison_documents_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "comparison_documents_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "workspace_threads" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "comparison_documents_parsedFileId_fkey" FOREIGN KEY ("parsedFileId") REFERENCES "workspace_parsed_files" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "comparison_documents_workspaceDocumentId_fkey" FOREIGN KEY ("workspaceDocumentId") REFERENCES "workspace_documents" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "comparison_documents_parsedFileId_key" ON "comparison_documents"("parsedFileId");

-- CreateIndex
CREATE UNIQUE INDEX "comparison_documents_workspaceDocumentId_key" ON "comparison_documents"("workspaceDocumentId");

-- CreateIndex
CREATE UNIQUE INDEX "comparison_documents_threadId_slot_key" ON "comparison_documents"("threadId", "slot");

-- CreateIndex
CREATE INDEX "comparison_documents_workspaceId_threadId_status_idx" ON "comparison_documents"("workspaceId", "threadId", "status");

-- CreateIndex
CREATE INDEX "comparison_documents_userId_idx" ON "comparison_documents"("userId");

-- Durable request identity prevents a browser retry or server restart from
-- creating a second chat row and a second local-model generation.
ALTER TABLE "workspace_chats" ADD COLUMN "generationId" TEXT;
CREATE UNIQUE INDEX "workspace_chats_generationId_key"
ON "workspace_chats"("generationId");

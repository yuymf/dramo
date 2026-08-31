-- Phase 2 remainder: knowledge, advisor hire, cold start.

ALTER TABLE "Project" ADD COLUMN "advisorId" TEXT;

ALTER TABLE "Episode" ADD COLUMN "coldStart" JSONB NOT NULL DEFAULT '{}';

CREATE TABLE "KnowledgeFile" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime" TEXT NOT NULL DEFAULT 'text/plain',
    "text" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeFile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "KnowledgeFile_projectId_createdAt_idx" ON "KnowledgeFile"("projectId", "createdAt");

ALTER TABLE "KnowledgeFile" ADD CONSTRAINT "KnowledgeFile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

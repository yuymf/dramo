-- Phase 1: replace live-script models with screenplay workspace.
-- No data preserve.

DROP TABLE IF EXISTS "StoryboardFrameImage" CASCADE;
DROP TABLE IF EXISTS "StoryboardShot" CASCADE;
DROP TABLE IF EXISTS "Storyboard" CASCADE;
DROP TABLE IF EXISTS "CharacterRelation" CASCADE;
DROP TABLE IF EXISTS "CharacterAsset" CASCADE;
DROP TABLE IF EXISTS "LocationAsset" CASCADE;
DROP TABLE IF EXISTS "ScriptVersion" CASCADE;
DROP TABLE IF EXISTS "ScriptScene" CASCADE;
DROP TABLE IF EXISTS "Script" CASCADE;
DROP TABLE IF EXISTS "Inspiration" CASCADE;
DROP TABLE IF EXISTS "PipelineRun" CASCADE;
DROP TABLE IF EXISTS "Task" CASCADE;
DROP TABLE IF EXISTS "GenerationJob" CASCADE;
DROP TABLE IF EXISTS "ChatMessage" CASCADE;
DROP TABLE IF EXISTS "ChatSession" CASCADE;

ALTER TABLE "Project" DROP CONSTRAINT IF EXISTS "Project_userId_fkey";
ALTER TABLE "UserLLMConfig" DROP CONSTRAINT IF EXISTS "UserLLMConfig_userId_fkey";

-- Recreate chat + workspace tables
CREATE TYPE "ProjectType" AS ENUM ('script', 'cinema', 'spoken');
CREATE TYPE "ScreenplayFormat" AS ENUM ('hollywood', 'asian');
CREATE TYPE "MemberRole" AS ENUM ('OWNER', 'ADMIN', 'EDITOR', 'VIEWER');

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;
UPDATE "User" SET "passwordHash" = '' WHERE "passwordHash" IS NULL;
ALTER TABLE "User" ALTER COLUMN "passwordHash" SET NOT NULL;
ALTER TABLE "User" DROP COLUMN IF EXISTS "password";

ALTER TABLE "UserLLMConfig" ADD CONSTRAINT "UserLLMConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Session_token_key" ON "Session"("token");
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");
CREATE INDEX IF NOT EXISTS "Session_expiresAt_idx" ON "Session"("expiresAt");

ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "type" "ProjectType" NOT NULL DEFAULT 'script';
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "format" "ScreenplayFormat" NOT NULL DEFAULT 'hollywood';
ALTER TABLE "Project" DROP COLUMN IF EXISTS "userId";

CREATE TABLE IF NOT EXISTS "ProjectMember" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL DEFAULT 'OWNER',
    "craft" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProjectMember_projectId_userId_key" ON "ProjectMember"("projectId", "userId");
CREATE INDEX IF NOT EXISTS "ProjectMember_userId_idx" ON "ProjectMember"("userId");

CREATE TABLE IF NOT EXISTS "Episode" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Episode_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Episode_projectId_sortOrder_idx" ON "Episode"("projectId", "sortOrder");

CREATE TABLE IF NOT EXISTS "Screenplay" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "cover" JSONB NOT NULL DEFAULT '{}',
    "nodes" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Screenplay_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Screenplay_episodeId_key" ON "Screenplay"("episodeId");

CREATE TABLE IF NOT EXISTS "ScreenplayVersion" (
    "id" TEXT NOT NULL,
    "screenplayId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "summary" TEXT,
    "cover" JSONB NOT NULL,
    "nodes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScreenplayVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ScreenplayVersion_screenplayId_version_key" ON "ScreenplayVersion"("screenplayId", "version");
CREATE INDEX IF NOT EXISTS "ScreenplayVersion_screenplayId_createdAt_idx" ON "ScreenplayVersion"("screenplayId", "createdAt");

CREATE TABLE IF NOT EXISTS "Character" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "images" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Character_projectId_name_key" ON "Character"("projectId", "name");
CREATE INDEX IF NOT EXISTS "Character_projectId_idx" ON "Character"("projectId");

CREATE TABLE IF NOT EXISTS "Location" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "images" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Location_projectId_name_key" ON "Location"("projectId", "name");
CREATE INDEX IF NOT EXISTS "Location_projectId_idx" ON "Location"("projectId");

CREATE TABLE IF NOT EXISTS "Asset" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "url" TEXT NOT NULL,
    "taskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Asset_projectId_kind_idx" ON "Asset"("projectId", "kind");
CREATE INDEX IF NOT EXISTS "Asset_entityType_entityId_idx" ON "Asset"("entityType", "entityId");

CREATE TABLE IF NOT EXISTS "GenerationTask" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "prompt" TEXT NOT NULL,
    "aspectRatio" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "workerId" TEXT,
    "resultUrl" TEXT,
    "error" JSONB,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GenerationTask_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GenerationTask_userId_status_idx" ON "GenerationTask"("userId", "status");
CREATE INDEX IF NOT EXISTS "GenerationTask_projectId_idx" ON "GenerationTask"("projectId");
CREATE INDEX IF NOT EXISTS "GenerationTask_status_createdAt_idx" ON "GenerationTask"("status", "createdAt");

CREATE TABLE IF NOT EXISTS "ChatSession" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '新对话',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ChatSession_projectId_updatedAt_idx" ON "ChatSession"("projectId", "updatedAt");

CREATE TABLE IF NOT EXISTS "ChatMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "messageType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ChatMessage_sessionId_createdAt_idx" ON "ChatMessage"("sessionId", "createdAt");

-- FKs
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Episode" ADD CONSTRAINT "Episode_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Screenplay" ADD CONSTRAINT "Screenplay_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScreenplayVersion" ADD CONSTRAINT "ScreenplayVersion_screenplayId_fkey" FOREIGN KEY ("screenplayId") REFERENCES "Screenplay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Character" ADD CONSTRAINT "Character_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Location" ADD CONSTRAINT "Location_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GenerationTask" ADD CONSTRAINT "GenerationTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GenerationTask" ADD CONSTRAINT "GenerationTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

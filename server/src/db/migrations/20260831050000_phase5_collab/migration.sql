-- Phase 5: share links, comments, snapshots, public library, CRDT blob.

CREATE TYPE "ShareMode" AS ENUM ('invite', 'anyone_view', 'anyone_edit');

ALTER TABLE "Project" ADD COLUMN "shareToken" TEXT;
ALTER TABLE "Project" ADD COLUMN "shareMode" "ShareMode" NOT NULL DEFAULT 'invite';
ALTER TABLE "Project" ADD COLUMN "published" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Project" ADD COLUMN "publishedAt" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN "allowCopy" BOOLEAN NOT NULL DEFAULT true;

UPDATE "Project" SET "shareToken" = md5(random()::text || "id") WHERE "shareToken" IS NULL;

ALTER TABLE "Project" ALTER COLUMN "shareToken" SET NOT NULL;
CREATE UNIQUE INDEX "Project_shareToken_key" ON "Project"("shareToken");

ALTER TABLE "Screenplay" ADD COLUMN "crdt" TEXT NOT NULL DEFAULT '';

CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "episodeId" TEXT,
    "anchorType" TEXT NOT NULL,
    "anchorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Comment_projectId_anchorType_anchorId_idx" ON "Comment"("projectId", "anchorType", "anchorId");
CREATE INDEX "Comment_projectId_createdAt_idx" ON "Comment"("projectId", "createdAt");

ALTER TABLE "Comment" ADD CONSTRAINT "Comment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ProjectVersion" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT,
    "automatic" BOOLEAN NOT NULL DEFAULT false,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectVersion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProjectVersion_projectId_createdAt_idx" ON "ProjectVersion"("projectId", "createdAt");

ALTER TABLE "ProjectVersion" ADD CONSTRAINT "ProjectVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "LibraryDiscussion" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LibraryDiscussion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LibraryDiscussion_projectId_createdAt_idx" ON "LibraryDiscussion"("projectId", "createdAt");

ALTER TABLE "LibraryDiscussion" ADD CONSTRAINT "LibraryDiscussion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LibraryDiscussion" ADD CONSTRAINT "LibraryDiscussion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

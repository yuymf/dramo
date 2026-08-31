-- Phase 2 planning: outline, beats, props, worldview, casting/scout notes.

CREATE TABLE "Outline" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "markdown" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Outline_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Outline_episodeId_key" ON "Outline"("episodeId");

ALTER TABLE "Outline" ADD CONSTRAINT "Outline_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Beat" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "action" TEXT NOT NULL DEFAULT '',
    "intent" TEXT NOT NULL DEFAULT '',
    "outcome" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Beat_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Beat_episodeId_sortOrder_idx" ON "Beat"("episodeId", "sortOrder");

ALTER TABLE "Beat" ADD CONSTRAINT "Beat_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Prop" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "holder" TEXT,
    "continuity" TEXT,
    "images" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prop_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Prop_projectId_name_key" ON "Prop"("projectId", "name");
CREATE INDEX "Prop_projectId_idx" ON "Prop"("projectId");

ALTER TABLE "Prop" ADD CONSTRAINT "Prop_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WorldviewRule" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorldviewRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorldviewRule_projectId_key_key" ON "WorldviewRule"("projectId", "key");
CREATE INDEX "WorldviewRule_projectId_idx" ON "WorldviewRule"("projectId");

ALTER TABLE "WorldviewRule" ADD CONSTRAINT "WorldviewRule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Character" ADD COLUMN "castingNotes" TEXT;
ALTER TABLE "Location" ADD COLUMN "storyPlace" TEXT;
ALTER TABLE "Location" ADD COLUMN "shootPlace" TEXT;

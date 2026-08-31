-- Phase 4: Cinema reels and project-level production settings.

ALTER TABLE "Project" ADD COLUMN "cinemaSettings" JSONB NOT NULL DEFAULT '{}';

CREATE TABLE "Reel" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "sceneText" TEXT NOT NULL DEFAULT '',
    "performance" TEXT NOT NULL DEFAULT '',
    "shots" JSONB NOT NULL DEFAULT '[]',
    "images" JSONB NOT NULL DEFAULT '[]',
    "lastFrameUrl" TEXT,
    "previousReelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reel_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Reel_episodeId_sortOrder_idx" ON "Reel"("episodeId", "sortOrder");

ALTER TABLE "Reel" ADD CONSTRAINT "Reel_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ReelFilm" (
    "id" TEXT NOT NULL,
    "reelId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "durationSec" INTEGER NOT NULL DEFAULT 15,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReelFilm_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReelFilm_reelId_createdAt_idx" ON "ReelFilm"("reelId", "createdAt");

ALTER TABLE "ReelFilm" ADD CONSTRAINT "ReelFilm_reelId_fkey" FOREIGN KEY ("reelId") REFERENCES "Reel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

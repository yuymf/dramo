-- CreateTable
CREATE TABLE "CharacterAsset" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "images" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CharacterAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocationAsset" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "images" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LocationAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryboardFrameImage" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "frameId" TEXT NOT NULL,
    "image" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryboardFrameImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CharacterAsset_projectId_idx" ON "CharacterAsset"("projectId");

-- CreateIndex
CREATE INDEX "LocationAsset_projectId_idx" ON "LocationAsset"("projectId");

-- CreateIndex
CREATE INDEX "StoryboardFrameImage_projectId_idx" ON "StoryboardFrameImage"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "StoryboardFrameImage_projectId_frameId_key" ON "StoryboardFrameImage"("projectId", "frameId");


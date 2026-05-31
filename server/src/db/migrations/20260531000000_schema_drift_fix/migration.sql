-- Schema drift fix: align database with schema.prisma
-- Adds CharacterAsset.alias, drops User.password (auth removed),
-- creates PipelineRun table.

-- AlterTable
ALTER TABLE "CharacterAsset" ADD COLUMN "alias" TEXT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN IF EXISTS "password";

-- CreateTable
CREATE TABLE "PipelineRun" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "requirements" JSONB NOT NULL,
    "currentStep" TEXT,
    "stepResults" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PipelineRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PipelineRun_projectId_idx" ON "PipelineRun"("projectId");

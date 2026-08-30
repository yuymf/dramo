-- AlterTable
ALTER TABLE "GenerationJob" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'image';
ALTER TABLE "GenerationJob" ADD COLUMN "result" JSONB;

-- CreateIndex
CREATE INDEX "GenerationJob_type_status_idx" ON "GenerationJob"("type", "status");

-- DropTable
DROP TABLE IF EXISTS "Task";

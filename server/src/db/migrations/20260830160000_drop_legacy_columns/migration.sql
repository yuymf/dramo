-- AlterTable
ALTER TABLE "Script" DROP COLUMN IF EXISTS "type";
ALTER TABLE "Script" DROP COLUMN IF EXISTS "style";

-- AlterTable
ALTER TABLE "ChatMessage" DROP COLUMN IF EXISTS "blocks";

-- AlterTable
ALTER TABLE "GenerationJob" DROP COLUMN IF EXISTS "storyboardId";
ALTER TABLE "GenerationJob" DROP COLUMN IF EXISTS "retryCount";

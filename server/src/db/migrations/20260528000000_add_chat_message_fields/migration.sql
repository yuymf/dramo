-- AlterTable: Add messageType, options, selectedOption to ChatMessage
ALTER TABLE "ChatMessage" ADD COLUMN "messageType" TEXT;
ALTER TABLE "ChatMessage" ADD COLUMN "options" JSONB;
ALTER TABLE "ChatMessage" ADD COLUMN "selectedOption" JSONB;

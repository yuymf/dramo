-- Drop orphan chat messages that were never bound to a session
DELETE FROM "ChatMessage" WHERE "sessionId" IS NULL;

-- Require sessionId on every chat message
ALTER TABLE "ChatMessage" ALTER COLUMN "sessionId" SET NOT NULL;

-- Persist relation-graph node coordinates on the character asset
ALTER TABLE "CharacterAsset" ADD COLUMN IF NOT EXISTS "position" JSONB;

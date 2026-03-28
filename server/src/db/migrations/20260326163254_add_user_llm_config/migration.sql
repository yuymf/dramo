-- CreateEnum
CREATE TYPE "LLMConfigType" AS ENUM ('TEXT_LLM', 'IMAGE_GEN');

-- CreateTable
CREATE TABLE "UserLLMConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "LLMConfigType" NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserLLMConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserLLMConfig_userId_name_key" ON "UserLLMConfig"("userId", "name");

-- CreateIndex
CREATE INDEX "UserLLMConfig_userId_type_isDefault_idx" ON "UserLLMConfig"("userId", "type", "isDefault");

-- AddForeignKey
ALTER TABLE "UserLLMConfig" ADD CONSTRAINT "UserLLMConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

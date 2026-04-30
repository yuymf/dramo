-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "UsageRecordType" AS ENUM ('SCRIPT_GENERATION', 'CHARACTER_EXTRACTION', 'LOCATION_EXTRACTION', 'STORYBOARD_IMPORT', 'IMAGE_GENERATION');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE "UsageRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "type" "UsageRecordType" NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UsageRecord_userId_month_type_key" ON "UsageRecord"("userId", "month", "type");

-- AddForeignKey
ALTER TABLE "UsageRecord" ADD CONSTRAINT "UsageRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddCheckConstraint
DO $$ BEGIN
    ALTER TABLE "UsageRecord" ADD CONSTRAINT "UsageRecord_month_format_check" CHECK ("month" ~ '^\d{4}-\d{2}$');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

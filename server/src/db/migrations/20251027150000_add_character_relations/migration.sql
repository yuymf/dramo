-- CreateTable
CREATE TABLE "CharacterRelation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "nodeAId" TEXT NOT NULL,
    "nodeBId" TEXT NOT NULL,
    "type" TEXT,
    "weight" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterRelation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CharacterRelation_projectId_idx" ON "CharacterRelation"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterRelation_projectId_nodeAId_nodeBId_type_key" ON "CharacterRelation"("projectId", "nodeAId", "nodeBId", "type");

-- AddForeignKey
ALTER TABLE "CharacterRelation" ADD CONSTRAINT "CharacterRelation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterRelation" ADD CONSTRAINT "CharacterRelation_nodeAId_fkey" FOREIGN KEY ("nodeAId") REFERENCES "CharacterAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterRelation" ADD CONSTRAINT "CharacterRelation_nodeBId_fkey" FOREIGN KEY ("nodeBId") REFERENCES "CharacterAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddCheck (ensure nodeAId < nodeBId for undirected normalization)
ALTER TABLE "CharacterRelation" ADD CONSTRAINT "CharacterRelation_nodeAId_lt_nodeBId_check" CHECK ("nodeAId" < "nodeBId");


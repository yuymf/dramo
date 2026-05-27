-- AddRelation: Project -> Storyboard (1:1 back-reference, no DDL needed — FK lives on Storyboard)

-- AddRelation: Storyboard -> Project (adds FK constraint on Storyboard.projectId)
DO $$ BEGIN
  ALTER TABLE "Storyboard" ADD CONSTRAINT "Storyboard_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable: StoryboardShot
CREATE TABLE "StoryboardShot" (
    "id" TEXT NOT NULL,
    "storyboardId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "imageUrl" TEXT,
    "dialogue" TEXT,
    "action" TEXT,
    "cameraAngle" TEXT,
    "generatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryboardShot_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ScriptScene
CREATE TABLE "ScriptScene" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "actIndex" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "parentSceneId" TEXT,
    "branchLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScriptScene_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: StoryboardShot(storyboardId, order)
CREATE INDEX "StoryboardShot_storyboardId_order_idx" ON "StoryboardShot"("storyboardId", "order");

-- CreateIndex: ScriptScene(scriptId, actIndex, order)
CREATE INDEX "ScriptScene_scriptId_actIndex_order_idx" ON "ScriptScene"("scriptId", "actIndex", "order");

-- AddForeignKey: StoryboardShot -> Storyboard
ALTER TABLE "StoryboardShot" ADD CONSTRAINT "StoryboardShot_storyboardId_fkey" FOREIGN KEY ("storyboardId") REFERENCES "Storyboard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: ScriptScene -> Script
ALTER TABLE "ScriptScene" ADD CONSTRAINT "ScriptScene_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "Script"("id") ON DELETE CASCADE ON UPDATE CASCADE;

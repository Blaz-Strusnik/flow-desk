-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityLog_boardId_createdAt_idx" ON "ActivityLog"("boardId", "createdAt");

-- The prior failed attempt at this migration's auto-generated diff dropped
-- these GIN indexes (it misread the Unsupported tsvector columns as needing
-- an ALTER); recreate them since Prisma's diff engine doesn't manage
-- Unsupported-typed columns/indexes and won't know to on its own.
CREATE INDEX IF NOT EXISTS "Card_searchVector_idx" ON "Card" USING GIN ("searchVector");
CREATE INDEX IF NOT EXISTS "Message_searchVector_idx" ON "Message" USING GIN ("searchVector");

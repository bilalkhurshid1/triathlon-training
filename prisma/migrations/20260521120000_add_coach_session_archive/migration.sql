-- AlterTable
ALTER TABLE "CoachSession" ADD COLUMN "archivedAt" DATETIME;

-- CreateIndex
CREATE INDEX "CoachSession_archivedAt_updatedAt_idx" ON "CoachSession"("archivedAt", "updatedAt");

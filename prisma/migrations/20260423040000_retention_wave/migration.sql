-- User onboarding tracking
ALTER TABLE "User" ADD COLUMN "onboardedAt" TIMESTAMP(3);

-- Weather + moon phase on all trace kinds
ALTER TABLE "Pairing" ADD COLUMN "weatherTemp" DOUBLE PRECISION;
ALTER TABLE "Pairing" ADD COLUMN "weatherCode" INTEGER;
ALTER TABLE "Pairing" ADD COLUMN "weatherLabel" TEXT;
ALTER TABLE "Pairing" ADD COLUMN "moonPhase" DOUBLE PRECISION;
ALTER TABLE "Pairing" ADD COLUMN "shareSlug" TEXT;

ALTER TABLE "Experience" ADD COLUMN "weatherTemp" DOUBLE PRECISION;
ALTER TABLE "Experience" ADD COLUMN "weatherCode" INTEGER;
ALTER TABLE "Experience" ADD COLUMN "weatherLabel" TEXT;
ALTER TABLE "Experience" ADD COLUMN "moonPhase" DOUBLE PRECISION;
ALTER TABLE "Experience" ADD COLUMN "shareSlug" TEXT;

ALTER TABLE "Mark" ADD COLUMN "weatherTemp" DOUBLE PRECISION;
ALTER TABLE "Mark" ADD COLUMN "weatherCode" INTEGER;
ALTER TABLE "Mark" ADD COLUMN "weatherLabel" TEXT;
ALTER TABLE "Mark" ADD COLUMN "moonPhase" DOUBLE PRECISION;
ALTER TABLE "Mark" ADD COLUMN "audioUrl" TEXT;
ALTER TABLE "Mark" ADD COLUMN "shareSlug" TEXT;

ALTER TABLE "Encounter" ADD COLUMN "shareSlug" TEXT;

-- Unique indexes on share slugs
CREATE UNIQUE INDEX "Pairing_shareSlug_key" ON "Pairing"("shareSlug");
CREATE UNIQUE INDEX "Experience_shareSlug_key" ON "Experience"("shareSlug");
CREATE UNIQUE INDEX "Mark_shareSlug_key" ON "Mark"("shareSlug");
CREATE UNIQUE INDEX "Encounter_shareSlug_key" ON "Encounter"("shareSlug");

-- Range indexes for "on this day" + search filters
CREATE INDEX "Pairing_userId_createdAt_idx" ON "Pairing"("userId", "createdAt");
CREATE INDEX "Experience_userId_date_idx" ON "Experience"("userId", "date");
CREATE INDEX "Experience_userId_createdAt_idx" ON "Experience"("userId", "createdAt");
CREATE INDEX "Mark_userId_createdAt_idx" ON "Mark"("userId", "createdAt");
CREATE INDEX "Encounter_userId_date_idx" ON "Encounter"("userId", "date");

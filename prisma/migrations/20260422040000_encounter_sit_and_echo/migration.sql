-- Encounter: sit-with-it state + question threading to a past encounter
ALTER TABLE "Encounter" ADD COLUMN "sittingWith" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Encounter" ADD COLUMN "echoOfId" TEXT;

-- Add boundary polygon for state/country experiences
ALTER TABLE "Experience" ADD COLUMN "boundary" JSONB;

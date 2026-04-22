-- Add photo mood (luminance + warmth) to Pairing, Experience, Mark
-- Values in [0,1]; null = not yet analyzed (backfill will fill it in).

ALTER TABLE "Pairing"
  ADD COLUMN IF NOT EXISTS "photoLum" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "photoWarmth" DOUBLE PRECISION;

ALTER TABLE "Experience"
  ADD COLUMN IF NOT EXISTS "photoLum" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "photoWarmth" DOUBLE PRECISION;

ALTER TABLE "Mark"
  ADD COLUMN IF NOT EXISTS "photoLum" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "photoWarmth" DOUBLE PRECISION;

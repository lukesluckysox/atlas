-- Pairing: store genres (for pairings-only music tree) + optional caption
ALTER TABLE "Pairing" ADD COLUMN "genres" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "Pairing" ADD COLUMN "caption" TEXT;
ALTER TABLE "Pairing" ADD COLUMN "captionDismissed" BOOLEAN NOT NULL DEFAULT false;

-- Mark: optional AI-generated keyword/summary
ALTER TABLE "Mark" ADD COLUMN "summary" TEXT;
ALTER TABLE "Mark" ADD COLUMN "keyword" TEXT;

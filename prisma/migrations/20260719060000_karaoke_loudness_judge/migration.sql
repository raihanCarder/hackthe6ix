-- Replace the Gemini judge with client-measured mic loudness: whoever sings
-- along louder wins. Table has no rows to backfill (test data only).

-- AlterTable
ALTER TABLE "KaraokeDuel"
  ADD COLUMN "player1LoudnessScore" DOUBLE PRECISION,
  ADD COLUMN "player2LoudnessScore" DOUBLE PRECISION;

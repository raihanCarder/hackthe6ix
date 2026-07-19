-- Bonus karaoke rounds now require an explicit accept/decline from the
-- invited player before either side can pick a hotel. Table has no rows to
-- backfill (test data only).

-- AlterTable
ALTER TABLE "KaraokeDuel" ADD COLUMN "invitedById" TEXT NOT NULL;

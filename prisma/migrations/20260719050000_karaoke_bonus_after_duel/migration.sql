-- Karaoke duels are now scoped to the PvP Duel that unlocked them, with both
-- players known immediately (no more open matchmaking) and cards picked in-room.
-- Table has no rows yet in any environment this has shipped to, so no backfill needed.

-- AlterTable
ALTER TABLE "KaraokeDuel"
  ADD COLUMN "sourceDuelId" TEXT NOT NULL,
  ALTER COLUMN "player1CardId" DROP NOT NULL,
  ALTER COLUMN "player2Id" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "KaraokeDuel_sourceDuelId_key" ON "KaraokeDuel"("sourceDuelId");

-- AddForeignKey
ALTER TABLE "KaraokeDuel" ADD CONSTRAINT "KaraokeDuel_sourceDuelId_fkey" FOREIGN KEY ("sourceDuelId") REFERENCES "Duel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "Duel" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "player1Id" TEXT NOT NULL,
    "player1CardIds" JSONB NOT NULL,
    "player2Id" TEXT,
    "player2CardIds" JSONB,
    "turnPlayerId" TEXT,
    "rounds" JSONB NOT NULL DEFAULT '[]',
    "player1Wins" INTEGER NOT NULL DEFAULT 0,
    "player2Wins" INTEGER NOT NULL DEFAULT 0,
    "winnerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Duel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Duel_status_createdAt_idx" ON "Duel"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "Duel" ADD CONSTRAINT "Duel_player1Id_fkey" FOREIGN KEY ("player1Id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Duel" ADD CONSTRAINT "Duel_player2Id_fkey" FOREIGN KEY ("player2Id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

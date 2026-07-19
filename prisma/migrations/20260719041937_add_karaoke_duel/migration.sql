-- CreateTable
CREATE TABLE "KaraokeDuel" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "player1Id" TEXT NOT NULL,
    "player1CardId" TEXT NOT NULL,
    "player2Id" TEXT,
    "player2CardId" TEXT,
    "player1Lyrics" TEXT,
    "player2Lyrics" TEXT,
    "player1AudioCacheKey" TEXT,
    "player2AudioCacheKey" TEXT,
    "winnerId" TEXT,
    "verdict" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KaraokeDuel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KaraokeSongAudio" (
    "cacheKey" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "outputFormat" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "audio" BYTEA NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KaraokeSongAudio_pkey" PRIMARY KEY ("cacheKey")
);

-- CreateTable
CREATE TABLE "KaraokeUsage" (
    "period" TEXT NOT NULL,
    "generationCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KaraokeUsage_pkey" PRIMARY KEY ("period")
);

-- CreateIndex
CREATE INDEX "KaraokeDuel_status_createdAt_idx" ON "KaraokeDuel"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "KaraokeDuel" ADD CONSTRAINT "KaraokeDuel_player1Id_fkey" FOREIGN KEY ("player1Id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KaraokeDuel" ADD CONSTRAINT "KaraokeDuel_player2Id_fkey" FOREIGN KEY ("player2Id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

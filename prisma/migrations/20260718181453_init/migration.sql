-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "auth0Sub" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "avatarUrl" TEXT,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "currentWinStreak" INTEGER NOT NULL DEFAULT 0,
    "bestWinStreak" INTEGER NOT NULL DEFAULT 0,
    "currency" INTEGER NOT NULL DEFAULT 500,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "packsOpened" INTEGER NOT NULL DEFAULT 0,
    "matchesPlayed" INTEGER NOT NULL DEFAULT 0,
    "mvpCount" INTEGER NOT NULL DEFAULT 0,
    "lastLoginAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stay22ApiCall" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "endpoint" TEXT NOT NULL,
    "requestParams" JSONB NOT NULL,
    "responseBody" JSONB NOT NULL,
    "status" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Stay22ApiCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotelSnapshot" (
    "id" TEXT NOT NULL,
    "stay22PropertyId" TEXT NOT NULL,
    "sourceApiCallId" TEXT NOT NULL,
    "normalizedData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HotelSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackOpen" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "searchApiCallId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "cost" INTEGER NOT NULL,
    "seed" TEXT NOT NULL,
    "generatedCardIds" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackOpen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CityPackClaim" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "normalizedCity" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CityPackClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedCard" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stay22PropertyId" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "rarity" TEXT NOT NULL,
    "cosmeticSeed" TEXT NOT NULL,
    "acquiredScope" TEXT NOT NULL,
    "acquiredCity" TEXT NOT NULL,
    "edition" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "trophies" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "timesMvp" INTEGER NOT NULL DEFAULT 0,
    "dateAcquired" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tournament" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "searchApiCallId" TEXT NOT NULL,
    "contenderPropertyIds" JSONB NOT NULL,
    "userCardIds" JSONB NOT NULL,
    "questionnaireAnswers" JSONB NOT NULL,
    "engineResult" JSONB NOT NULL,
    "seed" TEXT NOT NULL,
    "championPropertyId" TEXT NOT NULL,
    "bracket" JSONB NOT NULL,
    "rewards" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_auth0Sub_key" ON "User"("auth0Sub");

-- CreateIndex
CREATE INDEX "HotelSnapshot_stay22PropertyId_idx" ON "HotelSnapshot"("stay22PropertyId");

-- CreateIndex
CREATE INDEX "HotelSnapshot_sourceApiCallId_idx" ON "HotelSnapshot"("sourceApiCallId");

-- CreateIndex
CREATE UNIQUE INDEX "CityPackClaim_userId_normalizedCity_key" ON "CityPackClaim"("userId", "normalizedCity");

-- CreateIndex
CREATE UNIQUE INDEX "SavedCard_userId_stay22PropertyId_key" ON "SavedCard"("userId", "stay22PropertyId");

-- AddForeignKey
ALTER TABLE "Stay22ApiCall" ADD CONSTRAINT "Stay22ApiCall_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelSnapshot" ADD CONSTRAINT "HotelSnapshot_sourceApiCallId_fkey" FOREIGN KEY ("sourceApiCallId") REFERENCES "Stay22ApiCall"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackOpen" ADD CONSTRAINT "PackOpen_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackOpen" ADD CONSTRAINT "PackOpen_searchApiCallId_fkey" FOREIGN KEY ("searchApiCallId") REFERENCES "Stay22ApiCall"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CityPackClaim" ADD CONSTRAINT "CityPackClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedCard" ADD CONSTRAINT "SavedCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedCard" ADD CONSTRAINT "SavedCard_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "HotelSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_searchApiCallId_fkey" FOREIGN KEY ("searchApiCallId") REFERENCES "Stay22ApiCall"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "PresentationRecap" (
    "tournamentId" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PresentationRecap_pkey" PRIMARY KEY ("tournamentId")
);

-- AddForeignKey
ALTER TABLE "PresentationRecap" ADD CONSTRAINT "PresentationRecap_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

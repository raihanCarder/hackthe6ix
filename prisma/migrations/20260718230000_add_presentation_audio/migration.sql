CREATE TABLE "PresentationAudio" (
    "cacheKey" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "voiceId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "outputFormat" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "audio" BYTEA NOT NULL,
    "characterCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PresentationAudio_pkey" PRIMARY KEY ("cacheKey")
);

CREATE TABLE "PresentationUsage" (
    "period" TEXT NOT NULL,
    "characterCount" INTEGER NOT NULL DEFAULT 0,
    "generationCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PresentationUsage_pkey" PRIMARY KEY ("period")
);

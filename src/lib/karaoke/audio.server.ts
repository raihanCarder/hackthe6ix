import "server-only";
import { createHash } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getKaraokeMusicConfig } from "./musicConfig";
import { composeSong } from "./music";

export type KaraokeAudioPreparation =
  | { status: "ready"; cacheKey: string }
  | { status: "disabled" | "quota" | "unavailable"; cacheKey: null };

function usagePeriod(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function songCacheKey(prompt: string, modelId: string, lengthMs: number, outputFormat: string): string {
  return createHash("sha256")
    .update(JSON.stringify({ prompt, modelId, lengthMs, outputFormat }))
    .digest("hex");
}

/**
 * Composes (and caches) one player's karaoke song. Mirrors
 * src/lib/presentation/audio.server.ts's caching discipline, but the quota is
 * a monthly generation count rather than a character budget — ElevenLabs
 * Music isn't billed per character.
 */
export async function prepareKaraokeSongAudio(prompt: string): Promise<KaraokeAudioPreparation> {
  let config;
  try {
    config = getKaraokeMusicConfig();
  } catch (error) {
    console.error("Invalid ElevenLabs music configuration", error);
    return { status: "unavailable", cacheKey: null };
  }
  if (!config) return { status: "disabled", cacheKey: null };

  const cacheKey = songCacheKey(prompt, config.modelId, config.lengthMs, config.outputFormat);
  try {
    const cached = await prisma.karaokeSongAudio.findUnique({
      where: { cacheKey },
      select: { cacheKey: true },
    });
    if (cached) return { status: "ready", cacheKey };

    const period = usagePeriod();
    const usage = await prisma.karaokeUsage.findUnique({ where: { period } });
    if ((usage?.generationCount ?? 0) >= config.monthlyGenerationLimit) {
      return { status: "quota", cacheKey: null };
    }

    const audio = await composeSong(config, prompt);
    await prisma.$transaction([
      prisma.karaokeSongAudio.create({
        data: {
          cacheKey,
          prompt,
          modelId: config.modelId,
          outputFormat: config.outputFormat,
          mimeType: "audio/mpeg",
          audio: Uint8Array.from(audio),
          durationMs: config.lengthMs,
        },
      }),
      prisma.karaokeUsage.upsert({
        where: { period },
        create: { period, generationCount: 1 },
        update: { generationCount: { increment: 1 } },
      }),
    ]);
    return { status: "ready", cacheKey };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { status: "ready", cacheKey };
    }
    console.error("ElevenLabs karaoke song generation failed; falling back to lyrics-only", error);
    return { status: "unavailable", cacheKey: null };
  }
}

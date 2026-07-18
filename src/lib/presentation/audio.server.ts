import "server-only";
import { createHash } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getElevenLabsConfig } from "@/lib/elevenlabs/config";
import { getSubscriptionAllowance, synthesizeSpeech } from "@/lib/elevenlabs/client";
import { commentaryTemplateVersion } from "./commentary";

export type AudioPreparation =
  | { status: "ready"; cacheKey: string }
  | { status: "disabled" | "quota" | "unavailable"; cacheKey: null };

function usagePeriod(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function audioCacheKey(text: string, voiceId: string, modelId: string, outputFormat: string): string {
  return createHash("sha256")
    .update(JSON.stringify({ template: commentaryTemplateVersion(), text, voiceId, modelId, outputFormat }))
    .digest("hex");
}

export async function prepareCommentaryAudio(
  eventType: string,
  text: string,
): Promise<AudioPreparation> {
  let config;
  try {
    config = getElevenLabsConfig();
  } catch (error) {
    console.error("Invalid ElevenLabs configuration", error);
    return { status: "unavailable", cacheKey: null };
  }
  if (!config) return { status: "disabled", cacheKey: null };

  const cacheKey = audioCacheKey(text, config.voiceId, config.modelId, config.outputFormat);
  try {
    const cached = await prisma.presentationAudio.findUnique({
      where: { cacheKey },
      select: { cacheKey: true },
    });
    if (cached) return { status: "ready", cacheKey };

    const period = usagePeriod();
    const usage = await prisma.presentationUsage.findUnique({ where: { period } });
    if ((usage?.characterCount ?? 0) + text.length > config.monthlyCharacterLimit) {
      return { status: "quota", cacheKey: null };
    }

    const accountAllowance = await getSubscriptionAllowance(config);
    if (accountAllowance - text.length < config.accountCreditReserve) {
      return { status: "quota", cacheKey: null };
    }

    const audio = await synthesizeSpeech(config, text);
    await prisma.$transaction([
      prisma.presentationAudio.create({
        data: {
          cacheKey,
          eventType,
          text,
          voiceId: config.voiceId,
          modelId: config.modelId,
          outputFormat: config.outputFormat,
          mimeType: "audio/mpeg",
          audio: Uint8Array.from(audio),
          characterCount: text.length,
        },
      }),
      prisma.presentationUsage.upsert({
        where: { period },
        create: { period, characterCount: text.length, generationCount: 1 },
        update: { characterCount: { increment: text.length }, generationCount: { increment: 1 } },
      }),
    ]);
    return { status: "ready", cacheKey };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { status: "ready", cacheKey };
    }
    console.error("ElevenLabs commentary fell back to captions", error);
    return { status: "unavailable", cacheKey: null };
  }
}

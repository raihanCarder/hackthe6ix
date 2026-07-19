import "server-only";
import { chooseCommentaryCandidate } from "@/lib/gemini/commentary";
import { generateTournamentRecap } from "@/lib/gemini/recap";
import { prisma } from "@/lib/db";
import { commentaryCandidates, renderCommentary } from "./commentary";
import type { TournamentRecapEvent } from "./recap";
import type { PresentationEvent } from "./types";

export interface RenderedPresentationCommentary {
  caption: string;
  source: "gemini" | "deterministic";
}

const globalRecapGeneration = globalThis as unknown as {
  recapGeneration?: Map<string, Promise<RenderedPresentationCommentary>>;
};
const recapGeneration = globalRecapGeneration.recapGeneration
  ?? new Map<string, Promise<RenderedPresentationCommentary>>();
globalRecapGeneration.recapGeneration = recapGeneration;

export async function renderPresentationCommentary(
  event: PresentationEvent,
): Promise<RenderedPresentationCommentary> {
  if (event.kind === "competition.recap") return renderTournamentRecap(event);
  // Goal calls need to reach the live broadcast quickly; deterministic
  // variants avoid adding an LLM round trip before text-to-speech.
  if (event.kind === "match.goal") {
    return { caption: renderCommentary(event), source: "deterministic" };
  }
  const choices = commentaryCandidates(event);
  const selectedIndex = await chooseCommentaryCandidate(event.id, choices);
  return {
    caption: renderCommentary(event, selectedIndex ?? undefined),
    source: "deterministic",
  };
}

async function renderTournamentRecap(
  event: TournamentRecapEvent,
): Promise<RenderedPresentationCommentary> {
  try {
    const cached = await prisma.presentationRecap.findUnique({
      where: { tournamentId: event.tournamentId },
      select: { caption: true, source: true },
    });
    if (cached) {
      return {
        caption: cached.caption,
        source: cached.source === "gemini" ? "gemini" : "deterministic",
      };
    }
  } catch (error) {
    console.error("Tournament recap cache read failed", error);
  }

  const pending = recapGeneration.get(event.tournamentId);
  if (pending) return pending;

  const generation = generateAndCacheTournamentRecap(event).finally(() => {
    recapGeneration.delete(event.tournamentId);
  });
  recapGeneration.set(event.tournamentId, generation);
  return generation;
}

async function generateAndCacheTournamentRecap(
  event: TournamentRecapEvent,
): Promise<RenderedPresentationCommentary> {
  const generated = await generateTournamentRecap(event);
  if (!generated) {
    return { caption: renderCommentary(event), source: "deterministic" };
  }

  try {
    await prisma.presentationRecap.upsert({
      where: { tournamentId: event.tournamentId },
      create: { tournamentId: event.tournamentId, caption: generated, source: "gemini" },
      update: {},
    });
    const cached = await prisma.presentationRecap.findUnique({
      where: { tournamentId: event.tournamentId },
      select: { caption: true, source: true },
    });
    if (cached) {
      return {
        caption: cached.caption,
        source: cached.source === "gemini" ? "gemini" : "deterministic",
      };
    }
  } catch (error) {
    console.error("Tournament recap cache write failed", error);
  }
  return { caption: generated, source: "gemini" };
}

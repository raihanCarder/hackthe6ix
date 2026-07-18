import "server-only";
import { chooseCommentaryCandidate } from "@/lib/gemini/commentary";
import { commentaryCandidates, renderCommentary } from "./commentary";
import type { PresentationEvent } from "./types";

export async function renderPresentationCommentary(event: PresentationEvent): Promise<string> {
  const choices = commentaryCandidates(event);
  const selectedIndex = await chooseCommentaryCandidate(event.id, choices);
  return renderCommentary(event, selectedIndex ?? undefined);
}

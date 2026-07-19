import "server-only";
import { chooseCommentaryCandidate } from "@/lib/gemini/commentary";
import { commentaryCandidates, renderCommentary } from "./commentary";
import type { PresentationEvent } from "./types";

export async function renderPresentationCommentary(event: PresentationEvent): Promise<string> {
  // Goal calls need to reach the live broadcast quickly; deterministic
  // variants avoid adding an LLM round trip before text-to-speech.
  if (event.kind === "match.goal") return renderCommentary(event);
  const choices = commentaryCandidates(event);
  const selectedIndex = await chooseCommentaryCandidate(event.id, choices);
  return renderCommentary(event, selectedIndex ?? undefined);
}

import { NextRequest, NextResponse } from "next/server";
import { handleApiError, requireUser } from "@/lib/api";
import { prepareCommentaryAudio } from "@/lib/presentation/audio.server";
import { renderPresentationCommentary } from "@/lib/presentation/commentary.server";
import { commentaryRequestSchema } from "@/lib/presentation/cues";
import {
  resolveCardSelectionEvent,
  resolveJourneyEvent,
  resolvePresentationEvent,
} from "@/lib/presentation/events.server";

export async function POST(request: NextRequest) {
  try {
    const body = commentaryRequestSchema.parse(await request.json());
    const event = body.source === "journey"
      ? resolveJourneyEvent(body.cue.moment)
      : body.source === "card"
        ? await resolveCardSelectionEvent(await requireUser(), body.cardId)
        : await resolvePresentationEvent(await requireUser(), body.tournamentId, body.cue);
    const caption = await renderPresentationCommentary(event);
    const audioRequested = body.audio;
    const audio = audioRequested
      ? await prepareCommentaryAudio(event.kind, caption)
      : { status: "not_requested" as const, cacheKey: null };
    return NextResponse.json({
      event,
      caption,
      audioUrl: audio.cacheKey ? `/api/presentation/audio/${audio.cacheKey}` : null,
      audioStatus: audio.status,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

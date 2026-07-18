import { NextRequest, NextResponse } from "next/server";
import { handleApiError, requireUser } from "@/lib/api";
import { prepareCommentaryAudio } from "@/lib/presentation/audio.server";
import { renderCommentary } from "@/lib/presentation/commentary";
import { commentaryRequestSchema } from "@/lib/presentation/cues";
import { resolvePresentationEvent } from "@/lib/presentation/events.server";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const { tournamentId, cue, audio: audioRequested } = commentaryRequestSchema.parse(await request.json());
    const event = await resolvePresentationEvent(user, tournamentId, cue);
    const caption = renderCommentary(event);
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

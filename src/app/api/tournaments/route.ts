import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { answersSchema, handleApiError, loadSearch, requireUser } from "@/lib/api";
import { createTournament } from "@/lib/tournament";

const schema = z.object({
  searchId: z.string().min(1),
  answers: answersSchema,
});

/** Create and fully simulate a tournament in one request (demo-safe, replayable). */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = schema.parse(await request.json());
    const search = await loadSearch(body.searchId, user.id);

    const { tournament } = await createTournament({
      user,
      searchApiCallId: search.apiCallId,
      trip: search.trip,
      pool: search.pool,
      answers: body.answers,
    });

    return NextResponse.json({ tournamentId: tournament.id });
  } catch (error) {
    return handleApiError(error);
  }
}

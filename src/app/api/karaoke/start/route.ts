import { NextResponse, type NextRequest } from "next/server";
import { handleApiError, requireUser, startKaraokeDuel, startKaraokeDuelSchema } from "@/lib/api";

/** Find-or-create the bonus karaoke duel unlocked by a completed PvP duel. */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = startKaraokeDuelSchema.parse(await request.json());
    return NextResponse.json(await startKaraokeDuel(user, body));
  } catch (error) {
    return handleApiError(error);
  }
}

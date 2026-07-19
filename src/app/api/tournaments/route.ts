import { NextResponse, type NextRequest } from "next/server";
import {
  createTournamentForCard,
  createTournamentSchema,
  handleApiError,
  listTournaments,
  requireUser,
} from "@/lib/api";

/** Tournament history — every tournament the user has played, newest first. */
export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json({ tournaments: await listTournaments(user) });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Create and fully simulate a tournament in one request (demo-safe, replayable). */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = createTournamentSchema.parse(await request.json());
    return NextResponse.json(await createTournamentForCard(user, body));
  } catch (error) {
    return handleApiError(error);
  }
}

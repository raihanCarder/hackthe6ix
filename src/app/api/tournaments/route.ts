import { NextResponse, type NextRequest } from "next/server";
import {
  createTournamentForCard,
  createTournamentSchema,
  handleApiError,
  requireUser,
} from "@/lib/api";

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

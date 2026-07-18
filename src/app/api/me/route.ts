import { NextResponse } from "next/server";
import { getSessionUser, isAuth0Mode } from "@/lib/auth";
import { syncUser } from "@/lib/userSync";
import { handleApiError } from "@/lib/api";

export async function GET() {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ user: null, authMode: isAuth0Mode() ? "auth0" : "dev" });
    }
    const user = await syncUser(session);
    return NextResponse.json({
      authMode: isAuth0Mode() ? "auth0" : "dev",
      user: {
        id: user.id,
        username: user.username,
        avatarUrl: user.avatarUrl,
        wins: user.wins,
        losses: user.losses,
        currentWinStreak: user.currentWinStreak,
        bestWinStreak: user.bestWinStreak,
        currency: user.currency,
        xp: user.xp,
        level: user.level,
        packsOpened: user.packsOpened,
        matchesPlayed: user.matchesPlayed,
        mvpCount: user.mvpCount,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

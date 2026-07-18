import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { DEV_SESSION_COOKIE, getSessionUser, isAuth0Mode } from "@/lib/auth";
import { syncUser } from "@/lib/userSync";

export const devLoginSchema = z.object({ username: z.string().trim().min(2).max(32) });

export async function getCurrentUserPayload() {
  const session = await getSessionUser();
  if (!session) {
    return { user: null, authMode: isAuth0Mode() ? "auth0" : "dev" };
  }

  const user = await syncUser(session);
  return {
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
  };
}

export function createDevLoginResponse(username: string) {
  if (isAuth0Mode()) {
    return NextResponse.json({ error: "Auth0 is configured; use /auth/login" }, { status: 404 });
  }

  const slug = username.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const payload = Buffer.from(
    JSON.stringify({ sub: `dev|${slug}`, name: username }),
    "utf8",
  ).toString("base64url");

  const response = NextResponse.json({ ok: true });
  response.cookies.set(DEV_SESSION_COOKIE, payload, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}

export function createDevLogoutResponse() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(DEV_SESSION_COOKIE);
  return response;
}

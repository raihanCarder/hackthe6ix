import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { User } from "@/generated/prisma/client";
import { DEV_SESSION_COOKIE, getSessionUser, isAuth0Mode } from "@/lib/auth";
import { isKnownCity } from "@/lib/cities";
import { prisma } from "@/lib/db";
import { syncUser } from "@/lib/userSync";
import { ApiError } from "./core";

export const devLoginSchema = z.object({ username: z.string().trim().min(2).max(32) });

export const updateSettingsSchema = z.object({
  numberOfKids: z.number().int().min(0).max(20),
  homeCity: z.string().trim().max(80).nullable(),
  defaultAdults: z.number().int().min(1).max(16),
});

export function getUserSettings(user: User) {
  return {
    numberOfKids: user.numberOfKids,
    homeCity: user.homeCity,
    defaultAdults: user.defaultAdults,
  };
}

export async function updateUserSettings(
  userId: string,
  data: z.infer<typeof updateSettingsSchema>,
) {
  const homeCity = data.homeCity && data.homeCity.length > 0 ? data.homeCity : null;
  if (homeCity && !(await isKnownCity(homeCity))) {
    throw new ApiError(422, "That doesn't look like a real city — pick one from the suggestions");
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      numberOfKids: data.numberOfKids,
      homeCity,
      defaultAdults: data.defaultAdults,
    },
  });
  return getUserSettings(user);
}

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

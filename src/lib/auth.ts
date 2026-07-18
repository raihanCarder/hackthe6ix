import "server-only";
import { cookies } from "next/headers";
import { auth0 } from "./auth0";

export interface SessionUser {
  sub: string;
  name: string;
  email: string | null;
  picture: string | null;
}

export const DEV_SESSION_COOKIE = "cic_dev_session";

/**
 * Session lookup: Auth0 when configured, otherwise the local dev session
 * cookie set by POST /api/dev/login. Local users never have passwords —
 * dev mode is for offline demos only.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  if (auth0) {
    const session = await auth0.getSession();
    if (!session) return null;
    return {
      sub: session.user.sub,
      name: session.user.name ?? session.user.nickname ?? "Traveler",
      email: session.user.email ?? null,
      picture: session.user.picture ?? null,
    };
  }

  const jar = await cookies();
  const raw = jar.get(DEV_SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (typeof parsed.sub !== "string" || !parsed.sub.startsWith("dev|")) return null;
    return {
      sub: parsed.sub,
      name: typeof parsed.name === "string" ? parsed.name : "Traveler",
      email: null,
      picture: null,
    };
  } catch {
    return null;
  }
}

export function isAuth0Mode(): boolean {
  return auth0 !== null;
}

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { DEV_SESSION_COOKIE, isAuth0Mode } from "@/lib/auth";
import { handleApiError } from "@/lib/api";

const schema = z.object({ username: z.string().trim().min(2).max(32) });

/** Local dev sign-in — only exists when Auth0 is not configured. */
export async function POST(request: NextRequest) {
  try {
    if (isAuth0Mode()) {
      return NextResponse.json({ error: "Auth0 is configured; use /auth/login" }, { status: 404 });
    }
    const { username } = schema.parse(await request.json());
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
  } catch (error) {
    return handleApiError(error);
  }
}

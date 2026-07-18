import type { NextRequest } from "next/server";
import { createDevLoginResponse, devLoginSchema, handleApiError } from "@/lib/api";

/** Local dev sign-in — only exists when Auth0 is not configured. */
export async function POST(request: NextRequest) {
  try {
    const { username } = devLoginSchema.parse(await request.json());
    return createDevLoginResponse(username);
  } catch (error) {
    return handleApiError(error);
  }
}

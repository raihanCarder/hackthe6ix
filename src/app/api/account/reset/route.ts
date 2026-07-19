import { NextResponse } from "next/server";
import { DEV_SESSION_COOKIE, isAuth0Mode } from "@/lib/auth";
import { handleApiError, requireUser, resetUserAccount } from "@/lib/api";

export async function POST() {
  try {
    const user = await requireUser();
    await resetUserAccount(user);

    const response = NextResponse.json({
      ok: true,
      redirectTo: isAuth0Mode() ? "/auth/logout" : "/",
    });
    if (!isAuth0Mode()) {
      response.cookies.delete(DEV_SESSION_COOKIE);
    }
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}

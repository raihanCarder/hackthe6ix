import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const { auth0 } = await import("@/lib/auth0");
  if (!auth0) return NextResponse.next();
  return auth0.middleware(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"],
};

import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma, User } from "@/generated/prisma/client";
import { getSessionUser } from "@/lib/auth";
import { syncUser } from "@/lib/userSync";

export { PACK_COST } from "@/lib/game/economy";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function requireUser(): Promise<User> {
  const session = await getSessionUser();
  if (!session) throw new ApiError(401, "Sign in to play");
  return syncUser(session);
}

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: "Invalid request", issues: error.issues },
      { status: 400 },
    );
  }
  console.error(error);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}

export function asJson<T>(value: T): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

import "server-only";
import { prisma } from "./db";
import type { SessionUser } from "./auth";
import type { User } from "@/generated/prisma/client";

/** Upsert the local game profile keyed by auth0Sub (documentation/ideas/IDEA.md "Auth0 + User Model"). */
export async function syncUser(session: SessionUser): Promise<User> {
  return prisma.user.upsert({
    where: { auth0Sub: session.sub },
    create: {
      auth0Sub: session.sub,
      username: session.name,
      email: session.email,
      avatarUrl: session.picture,
    },
    update: {
      email: session.email ?? undefined,
      avatarUrl: session.picture ?? undefined,
      lastLoginAt: new Date(),
    },
  });
}

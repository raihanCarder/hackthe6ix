import { Auth0Client } from "@auth0/nextjs-auth0/server";

/**
 * Auth0 is the identity source of truth when configured (documentation/ideas/IDEA.md). Without
 * tenant credentials the app falls back to a local dev session so the demo
 * runs with zero external setup — see src/lib/auth.ts.
 */
export const auth0Configured = Boolean(
  process.env.AUTH0_DOMAIN &&
    process.env.AUTH0_CLIENT_ID &&
    process.env.AUTH0_CLIENT_SECRET &&
    process.env.AUTH0_SECRET,
);

export const auth0 = auth0Configured ? new Auth0Client() : null;

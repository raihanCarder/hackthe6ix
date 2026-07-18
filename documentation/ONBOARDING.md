# Contributor Onboarding

This guide gets a new contributor from a clean checkout to a working local demo and points them at the main parts of the codebase.

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Start local Postgres:

```bash
docker run -d --name cic-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=cic \
  -p 54329:5432 postgres:16-alpine
```

3. Create `.env` from `.env.example`.

For the offline demo, keep `STAY22_API_KEY` empty and use:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:54329/cic"
APP_BASE_URL="http://localhost:3000"
```

4. Apply the database migration:

```bash
npx prisma migrate dev
```

5. Start the app:

```bash
npm run dev
```

Open http://localhost:3000. With no Stay22 or Auth0 credentials, the app uses deterministic mock hotel data and local dev sign-in.

## Demo Walkthrough

1. Sign in with any manager name.
2. Go to `New trip`.
3. Search a city such as Toronto with valid check-in and checkout dates.
4. Open the free Trip Pack.
5. Flip the five cards.
6. Answer the adaptive questions.
7. Run the tournament.
8. Review the champion recommendation and booking evidence.

## Code Map

- `src/app/`: Next.js App Router pages and API route entrypoints.
- `src/app/api/**/route.ts`: thin HTTP wrappers for API endpoints.
- `src/lib/api/`: grouped API service logic for users, searches, packs, cards, and tournaments.
- `src/lib/stay22/`: Stay22 access, mock data, normalization, and dedupe.
- `src/lib/engine/`: pure deterministic recommendation engine.
- `src/lib/game/`: cards, rarity, bracket simulation, highlights, and rewards.
- `prisma/schema.prisma`: database schema.
- `documentation/ARCHITECTURE.md`: product and system architecture.
- `documentation/ideas/ALGORITHM_DESIGN.md`: recommendation algorithm details.

## Development Rules

- Keep `src/lib/engine/` pure: no database calls, network calls, cosmetics, or rarity logic.
- Keep Stay22 credentials server-only. Do not expose API keys in client code or responses.
- Preserve API response shapes unless changing the frontend at the same time.
- Add shared API behavior to `src/lib/api/` instead of growing route files.
- Use deterministic seeds for game and recommendation behavior so demos are replayable.

## Verification

Run these before handing off meaningful changes:

```bash
npm test
npm run lint
npm run build
```

For the browser demo path, run the production server and then the e2e script:

```bash
npm run build
npm run start
node scripts/e2e.mjs
```

## Live Integrations

To test real integrations, fill in `.env`:

- `STAY22_API_KEY`, `STAY22_AFFILIATE_ID`, and `STAY22_CAMPAIGN` for live inventory and tracked booking links.
- `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, and `AUTH0_SECRET` for Auth0 sign-in.
- `DATABASE_URL` with the deployment database connection string for hosted environments.

When `AUTH0_*` is configured, local dev sign-in disables itself automatically.

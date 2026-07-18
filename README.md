# Check-In Champions ⚽🏨

**Hotels compete for your booking.** Search a real trip, open a pack of live bookable hotel
cards, run a 16-team World Cup bracket, and book the champion — a genuine, auditable
recommendation backed by a deterministic engine and Monte Carlo simulation.

Built at Hack the 6ix. Architecture in
[`documentation/ARCHITECTURE.md`](./documentation/ARCHITECTURE.md), engine math in
[`documentation/ideas/ALGORITHM_DESIGN.md`](./documentation/ideas/ALGORITHM_DESIGN.md), contributor setup in
[`documentation/ONBOARDING.md`](./documentation/ONBOARDING.md), and optional voice setup in
[`documentation/ELEVENLABS.md`](./documentation/ELEVENLABS.md).

## The one rule

`src/lib/engine/` (pure, deterministic recommendation engine) decides the champion.
`src/lib/game/` (cards, rarity, bracket, highlights) may only animate that decision — the
engine's #1 always wins the tournament, and a unit test enforces it across 50 seeds.
`src/lib/presentation/` turns trusted results into captions and optional audio but cannot feed
anything back into either layer.

## Quick start

```bash
npm install
docker run -d --name cic-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=cic \
  -p 54329:5432 postgres:16-alpine
npx prisma migrate dev
npm run dev
```

Open http://localhost:3000 — with no external credentials the app runs fully offline:
deterministic mock Stay22 data and a local dev sign-in.

## Going live

Copy `.env.example` to `.env` and fill in:

- `STAY22_API_KEY` (+ affiliate ID / campaign) → real live inventory and tracked booking links.
  Verify the response schema in `src/lib/stay22/normalize.ts` against the actual integration.
- `AUTH0_*` → real authentication (dev sign-in disables itself automatically).
- `DATABASE_URL` → Supabase Postgres for deployment.
- `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID` → optional sports-style voice commentary.
  Without them, deterministic captions remain fully functional.

## Tests

```bash
npm test              # 44 unit tests: engine determinism, shrinkage, Haversine,
                      # pairwise symmetry, champion invariant, rarity, rewards
node scripts/e2e.mjs  # full browser demo path (needs `npm run start` + Chromium)
```

## Demo path

Sign in → search Toronto → open the free Trip Pack → flip five cards → answer 3–5 adaptive
questions → watch groups + knockouts → champion screen with first-place probability, weight
bars, decisive-edge evidence, and the **Book the champion** link.

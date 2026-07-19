# Check-In Champions — Final Architecture Plan

## Context

This document consolidates `ideas/IDEA.md`, `ideas/ALGORITHM_DESIGN.md`, `ideas/GAMEPLAY_PACK_IDEAS.md`, and `ideas/ideas_dana.md` into one buildable architecture. Where those docs conflicted, the conflicts have been resolved as follows:

| Decision | Resolution |
| --- | --- |
| Primary game format | **16-team group + knockout tournament**, individual hotel matchups (per `ideas/GAMEPLAY_PACK_IDEAS.md`). The 3-card squad quick-match from `ideas/IDEA.md` is dropped from the MVP. |
| Winner determination | **Hybrid**: the recommendation engine (per `ideas/ALGORITHM_DESIGN.md`) always determines the tournament champion / final recommendation; early-round match drama uses seeded RNG for spectacle. |
| Database | **Supabase Postgres** via Prisma. |
| Presentation audio | **Optional ElevenLabs adapter** — deterministic templates narrate trusted stored results; captions and text-only fallback are always available. Backboard.io and Unifold remain out of scope. |

Product in one line: *hotels compete for your booking* — live Stay22 search results become collectible cards, battle in a World Cup-style bracket, and the champion is a real, auditable recommendation with a tracked Stay22 booking link.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS + Framer Motion
- Prisma → Supabase Postgres
- Auth0 (`@auth0/nextjs-auth0`) — Auth0 is the identity source of truth; no local passwords
- Stay22 API called **server-side only** (key never reaches the client)
- ElevenLabs text-to-speech called **server-side only** as an optional presentation adapter
- Deploy target: Vercel
- Default currency: CAD

## Repository layout

```
src/
  app/
    (marketing)/page.tsx            # landing
    proxy.ts                        # Auth0 SDK middleware routes under /auth/*
    api/search/route.ts             # POST trip search → Stay22 fetch + snapshot
    api/packs/open/route.ts         # POST open Trip Pack
    api/tournaments/route.ts        # POST create+run tournament
    api/tournaments/[id]/route.ts   # GET replay a tournament
    api/cards/route.ts              # GET collection, POST save
    api/cards/[id]/rehydrate/route.ts # GET live refresh for booking CTA
    search/page.tsx                 # trip input form
    pack/[id]/page.tsx              # pack reveal animation
    collection/page.tsx
    tournament/[id]/page.tsx        # bracket UI + match playback
    profile/page.tsx
  lib/
    stay22/
      client.ts                     # server-only fetch wrapper (key, aid, campaign)
      normalize.ts                  # RawStay22Accommodation → NormalizedAccommodation
      dedupe.ts                     # conservative duplicate merging
    engine/                         # pure, framework-free — implements ideas/ALGORITHM_DESIGN.md
      constraints.ts                # hard filters + machine-readable exclusion reasons
      metrics.ts                    # quality, location, groupFit, flexibility, dataConfidence, (value)
      questionnaire.ts              # question bank + adaptive selection + answer→points→weights
      simulate.ts                   # deterministic utility + seeded Dirichlet Monte Carlo
      rank.ts                       # full-pool ranking, regret, stability
      explain.ts                    # structured contribution explanations
      seed.ts                       # canonical payload → hash → PRNG seed
      types.ts                      # interfaces from ideas/ALGORITHM_DESIGN.md §15
    game/                           # presentation layer — consumes engine output, never alters it
      cardStats.ts                  # Stay22 attrs → VIBE/LEGACY/VALUE/FLEX/SQUAD/CHAOS + rarity
      bracket.ts                    # 16-team selection, stratified sampling, group seeding
      matchSim.ts                   # hybrid match outcomes + highlight generation
      rewards.ts                    # XP, currency, streaks
    presentation/                   # structured facts → deterministic captions + cached optional audio
    elevenlabs/                     # server-only TTS client and account-limit checks
    db.ts                           # Prisma client singleton
    userSync.ts                     # upsert local User by auth0Sub
  prisma/schema.prisma
```

**Load-bearing rule** (from `ideas/ALGORITHM_DESIGN.md`): `lib/engine/` is pure and deterministic — no DB, no fetch, no rarity, no cosmetics. `lib/game/` may read engine output but can never change metrics, weights, rankings, or the champion.

## Data model (Prisma)

Models follow `ideas/IDEA.md` with the Match model generalized to tournaments:

- **User** — `auth0Sub` (unique), username, email, avatarUrl, wins/losses/streaks, currency, xp, level, packsOpened, matchesPlayed, mvpCount
- **Stay22ApiCall** — endpoint, requestParams, responseBody, status (audit + history replay)
- **HotelSnapshot** — stay22PropertyId, sourceApiCallId, normalizedData (the `NormalizedAccommodation` JSON)
- **PackOpen** — userId, scope (`trip`|`global`), city, cost, seed, generatedCardIds
- **CityPackClaim** — userId + normalizedCity unique (first city pack free once)
- **SavedCard** — userId, stay22PropertyId, snapshotId, rarity, cosmeticSeed, acquiredScope/City, edition, xp, trophies, wins/losses, timesMvp
- **Tournament** — userId, mode (`trip`|`world`), searchApiCallId, contenderPropertyIds (16), userCardIds, questionnaireAnswers, engineResult (JSON: weights, ranking, regret, explanations, engine version), seed, championPropertyId, bracket (JSON: groups, fixtures, scores, highlights), rewards
- **TournamentMatch** is embedded in `Tournament.bracket` JSON — matches are generated in one deterministic run, so no separate table is needed for the MVP

Never persist: API keys, raw dumps without request context.

## Core flow (the demo path)

1. **Sign in** — Auth0; `userSync.ts` upserts the local User by `auth0Sub` on session.
2. **Trip search** — destination, check-in/out, adults, children, rooms, optional min/max nightly price. (Map picker is a polish item, not MVP — plain destination input first.) Server fetches Stay22, stores `Stay22ApiCall` + `HotelSnapshot`s, runs normalize → dedupe → hard filters.
3. **Open Trip Pack** — 5 cards drawn from the eligible pool (first pack per normalized city free). Card stats via `cardStats.ts` mapping (guest rating→VIBE, review count→LEGACY, relative price→VALUE, cancellation/instant-book/suppliers→FLEX, capacity→SQUAD, type rarity+seed→CHAOS). Rarity is deterministic from `stay22PropertyId + cosmeticSeed`. Foil reveal animation with Framer Motion.
4. **Questionnaire** — 3–5 adaptive questions from the approved bank (`ideas/ALGORITHM_DESIGN.md` §3), selected deterministically based on metric coverage/variation in this pool (e.g., no price question when value is inactive). Answers → points → normalized weights. Skipped → named fallback profile ("Best overall").
5. **Engine run** — deterministic utilities + 5,000-sample seeded Dirichlet Monte Carlo over the full eligible pool → first-place probabilities, ranks, regret, stability, structured explanations. Seed derived from canonical payload hash (§14).
6. **Tournament construction** (`bracket.ts`) — 16 contenders = the user's 5 pack cards + 11 opponents stratified-sampled from the same live search (price bands × property types × rating bands). Seed by engine deterministic score; snake-distribute into 4 groups of 4.
7. **Hybrid match simulation** (`matchSim.ts`) —
   - **Invariant: the engine's #1 recommendation always wins the tournament.** Non-champion matchups: winner = higher engine utility + small bounded seeded noise (noise magnitude capped below the utility gap needed to flip large mismatches). Any fixture involving the engine champion: champion wins.
   - Group stage: round-robin points table per group; top 2 advance to quarterfinals; knockout to the final.
   - 5–7 highlight events per match generated from real attributes only (templates from `ideas/IDEA.md`: Cancellation Shield, Transfer Window, First-Touch Finish, LEGACY attack…). Rarity/cosmetics affect visuals only.
8. **Champion = recommendation** — champion screen shows engine evidence (win probability, main advantages, caveats from the structured explanation), then **rehydrates live** from Stay22 for current price, policies, supplier, and the tracked **Book MVP** CTA. Unavailable → themed "Transfer Pending" state.
9. **Optional commentary** — a global provider narrates approved events from landing through the champion screen. Trusted stored results become structured presentation events and deterministic captions. ElevenLabs synthesizes cached speech; Gemini may select only among approved lines. Neither receives authority to choose or invent facts.
10. **Rewards + history** — update user stats, card XP/trophies; tournament fully replayable from stored `engineResult` + `bracket` JSON.

## API surface

All Stay22, engine, and ElevenLabs access happens in route handlers (server). Routes validate inputs with zod, check the Auth0 session, and never echo credentials. `POST /api/tournaments` executes steps 5–7 in one request and persists the complete result — the bracket UI then plays it back client-side. Presentation routes resolve lightweight cues against that stored replay before rendering captions or audio.

Authentication setup, routes, and dashboard callback URLs are documented in [`AUTH.md`](./AUTH.md).

## Build phases (hackathon order)

1. **Scaffold** — `create-next-app`, Tailwind, Prisma + Supabase, Auth0 wiring, User sync, deploy skeleton to Vercel early.
2. **Stay22 vertical slice** — client, normalize, dedupe, hard filters against the real API; verify the actual response schema (rating scale, price field presence, radius units — flagged as unverified in `ideas/ALGORITHM_DESIGN.md`). This gates metric design, do it early.
3. **Engine** — metrics → weights → utilities → Monte Carlo → ranking/regret/explanations, with unit tests from `ideas/ALGORITHM_DESIGN.md` §18 (shrinkage, Haversine, determinism with fixed seed, pairwise symmetry).
4. **Pack + collection UI** — search form, pack reveal, card component, save/collection.
5. **Questionnaire + tournament** — question flow, bracket construction, hybrid sim, bracket UI with match playback and highlights.
6. **Champion + booking** — recommendation screen with evidence, live rehydration, Book CTA, rewards.
7. **Polish** — animations, map-based destination picker, Global Pack, profile/leaderboard (only if time remains).

## Verification

- **Unit** (vitest): engine determinism (same inputs+seed → identical outputs), rarity determinism, champion invariant (engine #1 always wins the bracket across many seeds), stat mapping, reward math.
- **API**: search params validated; Stay22 key absent from every response body; snapshots persisted.
- **E2E happy path** (Playwright): sign in → search Toronto, 2 adults → open pack → answer questionnaire → run tournament → champion shown with live data → Book CTA opens tracked supplier link.
- **E2E unavailable path**: saved card that fails rehydration stays visible with a "Transfer Pending" state.

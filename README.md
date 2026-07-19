# Check-In Champions

Live hotel inventory, turned into collectible cards, tournament drama, and bookable recommendations.

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)
![React](https://img.shields.io/badge/React-19-149ECA?style=for-the-badge&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Auth0](https://img.shields.io/badge/Auth0-Identity-EB5424?style=for-the-badge&logo=auth0&logoColor=white)
![Stripe](https://img.shields.io/badge/Stripe-Checkout-635BFF?style=for-the-badge&logo=stripe&logoColor=white)
![Framer Motion](https://img.shields.io/badge/Framer_Motion-Animation-0055FF?style=for-the-badge&logo=framer&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-Tested-6E9F18?style=for-the-badge&logo=vitest&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-E2E-2EAD33?style=for-the-badge&logo=playwright&logoColor=white)
![Stay22](https://img.shields.io/badge/Stay22-Live_Inventory-00AEEF?style=for-the-badge)
![ElevenLabs](https://img.shields.io/badge/ElevenLabs-Voice_Optional-111111?style=for-the-badge)
![Gemini](https://img.shields.io/badge/Gemini-AI_Optional-8E75B2?style=for-the-badge&logo=google-gemini&logoColor=white)

Built at Hack the 6ix.

## Screenshots

| Landing | Dashboard |
| ------- | --------- |
| ![Landing page with hero copy and collectible hotel cards](documentation/screenshots/landing.png) | ![Dashboard with profile, stats, quick trip pack, and top pull](documentation/screenshots/dashboard.png) |

| Pack Selection | Pack Reveal |
| -------------- | ----------- |
| ![Pack selection screen with Trip Pack and Global Pack options](documentation/screenshots/pack-selection.png) | ![Pack reveal screen with five unopened hotel cards](documentation/screenshots/pack-reveal.png) |

| Collection | Tournament Broadcast |
| ---------- | -------------------- |
| ![Collection grid with owned hotel cards and filters](documentation/screenshots/collection.png) | ![Tournament broadcast screen with scorebug, pitch, momentum, and hotel cards](documentation/screenshots/tournament-broadcast.png) |

| Play Mode Selection | Coin Shop |
| ------------------- | --------- |
| ![Play mode selection screen with Trip Cup, Global Cup, and Duel tiles](documentation/screenshots/play-mode.png) | ![Coin shop screen with three coin pack purchase options](documentation/screenshots/coin-shop.png) |

## What It Does

Check-In Champions makes hotel booking feel like opening a pack, building a squad, and watching a tournament play out. A traveler searches a real trip, the app turns Stay22 inventory into hotel cards, and those cards compete in a World Cup style bracket. The champion is not just a fun winner. It is a real recommendation backed by a deterministic engine, stored evidence, and a live booking link.

The product is designed for people who do not want another flat list of hotel cards. It gives them a story, a collection, a reason to compare options, and a clear path to book.

## Why It Stands Out

- **Live bookable inventory:** Trip Packs are built from Stay22 search results for real dates, party size, and destination.
- **Game mechanics with a real recommendation underneath:** Cards, rarities, highlights, cups, coins, and duels make discovery fun without letting cosmetics decide the booking pick.
- **Deterministic engine:** The recommendation layer is replayable, testable, and separate from presentation logic.
- **Auditable results:** Searches, snapshots, tournaments, brackets, rewards, and explanations are stored so a result can be replayed.
- **Offline demo mode:** With no external keys, the app runs locally with mock Stay22 data and dev sign-in.
- **Optional presentation layer:** Captions always work. ElevenLabs voice and Gemini commentary selection can be enabled without changing recommendation authority.

## Core Features

- **Trip Packs:** Search a destination and dates, then mint five collectible hotel cards from live or mock inventory.
- **Global Packs:** Draw from a surprise destination around the world.
- **Hotel cards:** Cards show rarity, country flags, price, property details, and stats for Comfort, Amenities, Luxury, Value, Location, and Service.
- **Trip Cup:** Enter a card into a 16-team bracket against options from the same search. Adaptive questions shape the recommendation.
- **Global Cup:** A casual world tournament where one card faces hotels from different countries.
- **Duel Mode:** Real-time 1v1 squad duels with three-card lineups.
- **Champion results:** The winner screen shows booking evidence, match results, highlights, probabilities, and the Stay22 booking link.
- **Collection and dashboard:** Track cards owned, top pulls, pack count, bookable value, stats, and profile progress.
- **Coins and packs:** Stripe Checkout supports sandbox coin purchases for pack economy demos.
- **Authentication:** Auth0 is supported for production. Local dev sign-in works automatically when Auth0 is not configured.
- **Account reset:** Users can reset local app data while keeping their Auth0 identity.

## Tech Stack

| Area         | Technology                                                              |
| ------------ | ----------------------------------------------------------------------- |
| Frontend     | Next.js App Router, React 19, TypeScript, Tailwind CSS, Framer Motion   |
| Backend      | Next.js route handlers, server-only service modules, Zod validation     |
| Data         | Prisma 7, PostgreSQL, Supabase-ready schema                             |
| Auth         | Auth0 with local dev fallback sessions                                  |
| Inventory    | Stay22 server-side integration with deterministic mock mode             |
| Payments     | Stripe Checkout and signed webhooks                                     |
| AI and audio | Optional Gemini question/commentary support, optional ElevenLabs speech |
| Testing      | Vitest, Playwright, ESLint, TypeScript build checks                     |
| Deployment   | Vercel target, Postgres database, server-side secrets                   |

## Architecture

The most important design choice is separation of authority.

- `src/lib/engine/` decides recommendations. It is pure, deterministic, and framework-free.
- `src/lib/game/` turns engine output into cards, brackets, rewards, duels, and match highlights.
- `src/lib/presentation/` turns trusted events into captions and optional voice. It cannot change outcomes.
- `src/lib/api/` contains service logic used by thin API route handlers.
- `src/lib/stay22/` owns inventory fetching, mock data, normalization, and dedupe.

That split keeps the fun parts honest. The game can make the journey dramatic, but the recommendation remains explainable and testable.

## Project Structure

```text
src/
  app/
    api/                 Next.js route handlers
    coins/               Coin shop and checkout success
    collection/          Owned hotel cards
    dashboard/           Account summary and quick trip pack
    duel/                Live 1v1 squad duels
    pack/                Pack reveal experience
    packs/               Trip and global pack builder
    play/                Cup mode selection and card entry
    settings/            Personal settings and account reset
    tournament/          Broadcast, champion, and results views
  components/            Shared UI, cards, chrome, auth, commentary controls
  lib/
    api/                 Server-side application services
    data/                Country, flag, and city helpers
    engine/              Deterministic recommendation engine
    game/                Card stats, brackets, match sim, rewards, duels
    presentation/        Commentary events, captions, audio cache
    stay22/              Stay22 client, mock data, normalization, dedupe
prisma/
  schema.prisma          Application data model
documentation/           Architecture, auth, Stripe, ElevenLabs, onboarding, algorithm notes
scripts/
  e2e.mjs                Browser demo smoke test
```

## Quick Start

Install dependencies:

```bash
npm install
```

Start a local Postgres database:

```bash
docker run -d --name cic-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=cic \
  -p 54329:5432 postgres:16-alpine
```

Create `.env` from `.env.example`, then use the local database URL:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:54329/cic"
APP_BASE_URL="http://localhost:3000"
```

Apply migrations and start the app:

```bash
npx prisma migrate dev
npm run dev
```

Open http://localhost:3000. If no external credentials are configured, the app uses mock Stay22 inventory and local dev sign-in.

## Environment Variables

| Variable                | Purpose                                           | Required for local demo |
| ----------------------- | ------------------------------------------------- | ----------------------- |
| `DATABASE_URL`          | PostgreSQL connection string                      | Yes                     |
| `APP_BASE_URL`          | Base URL for auth redirects                       | Yes                     |
| `STAY22_API_KEY`        | Live Stay22 inventory                             | No                      |
| `STAY22_AFFILIATE_ID`   | Tracked Stay22 booking links                      | No                      |
| `STAY22_CAMPAIGN`       | Stay22 campaign label                             | No                      |
| `AUTH0_DOMAIN`          | Auth0 tenant domain                               | No                      |
| `AUTH0_CLIENT_ID`       | Auth0 app client id                               | No                      |
| `AUTH0_CLIENT_SECRET`   | Auth0 app client secret                           | No                      |
| `AUTH0_SECRET`          | Auth0 session secret                              | No                      |
| `STRIPE_SECRET_KEY`     | Stripe Checkout sessions                          | No                      |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook verification                       | No                      |
| `ELEVENLABS_API_KEY`    | Optional speech generation                        | No                      |
| `ELEVENLABS_VOICE_ID`   | Optional voice selection                          | No                      |
| `GEMINI_API_KEY`        | Optional adaptive questions, commentary, and final recap | No                  |

See `.env.example` for every supported setting.

## Scripts

| Command                | Description                                              |
| ---------------------- | -------------------------------------------------------- |
| `npm run dev`          | Start the Next.js development server                     |
| `npm run build`        | Create a production build                                |
| `npm run start`        | Run the production server                                |
| `npm run lint`         | Run ESLint                                               |
| `npm run test`         | Run the Vitest suite                                     |
| `npm run db:studio`    | Open Prisma Studio                                       |
| `node scripts/e2e.mjs` | Run the browser demo smoke test against a running server |

## Demo Flow

1. Sign in with Auth0 or use the local dev sign-in.
2. Create a Trip Pack for a city such as Toronto.
3. Open the pack and reveal five hotel cards.
4. Pick a card for Trip Cup.
5. Answer the adaptive travel questions.
6. Watch the tournament broadcast.
7. Review the champion, evidence, bracket, and booking link.
8. Visit the dashboard and collection to see saved progress.

For the Stripe sandbox demo, open **Buy Coins**, choose a tier, and use test card `4242 4242 4242 4242` with any future expiry, CVC, and postal code.

## Testing

Current automated coverage:

- Vitest: 71 tests across 10 files.
- Engine tests for determinism, shrinkage, Haversine distance, ranking, questionnaire behavior, and champion invariants.
- Game tests for cards, rarity, rewards, bracket behavior, and match simulation.
- Presentation tests for safe commentary and match playback.
- Playwright smoke script for the main browser demo path.

Recommended handoff check:

```bash
npm run lint
npm run test
npm run build
```

For the browser path:

```bash
npm run build
npm run start
node scripts/e2e.mjs
```

## Contributors

- Raihan C
- Alberto Montero
- Dana Yuan
- Patrick Lee

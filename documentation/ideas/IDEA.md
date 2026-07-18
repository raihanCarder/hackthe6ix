# Check-In Champions

## Core Pitch

**Check-In Champions turns live, bookable hotels into collectible football cards.**

Users search for a real trip, open a pack of hotel cards, build a three-card squad, and watch the hotels battle using real listing attributes like rating, value, capacity, booking flexibility, and supplier availability. Standard matches and bracket tournaments are the main combat formats. The match MVP becomes the trip recommendation and can be booked through a tracked Stay22 supplier link.

The judge-friendly framing is:

> Hotels compete for your booking.

This should feel like a strange but useful booking decision engine disguised as a card game, not a generic card game with hotel photos attached.

## Why Stay22 Matters

The app should depend on live Stay22 data in ways that are visible to users:

- Search results must come from real destination, date, guest, room, and budget inputs.
- Card stats must be derived from live hotel attributes.
- Match highlights should reference real listing features.
- The final booking CTA should use the live supplier link returned by Stay22.

Stay22 data should drive the game mechanics, recommendation, and booking path.

## MVP Flow

1. User signs in with Auth0.
2. User enters a destination, check-in date, checkout date, guest count, room count, and optional max nightly budget.
3. The server fetches live Stay22 accommodation results.
4. User opens a five-card trip pack.
5. Each hotel result becomes a football-style collectible card.
6. User saves cards to their collection.
7. User selects three saved cards for a squad.
8. The app creates a city or world opponent squad from live hotel results.
9. A deterministic auto-match runs and shows five to seven highlight moments.
10. The app records wins, losses, streaks, XP, currency, and card progression.
11. Bracket tournaments provide the longer-form competitive mode, with separate tournament details defined in their own planning docs.
12. The Match MVP is shown with live price, rating, policies, supplier, trip dates, and a booking CTA.

## MVP Stack

- Next.js with App Router
- TypeScript
- Tailwind CSS
- Framer Motion for pack and card animations
- Prisma
- Postgres
- Auth0 for authentication
- Stay22 API integration from server-only routes

The Stay22 API key must never be exposed client-side.

## Auth0 + User Model

Use Auth0 for signup, login, password handling, sessions, and identity provider support. Auth0 is the source of truth for authentication.

The app database should not store user passwords. If username/password login is offered, Auth0 manages the password. The local database stores only profile and game state.

Recommended local user model:

```text
User
- id
- auth0Sub
- username
- email
- avatarUrl
- cards
- wins
- losses
- currentWinStreak
- bestWinStreak
- currency
- xp
- level
- packsOpened
- matchesPlayed
- mvpCount
- lastLoginAt
- createdAt
- updatedAt
```

Recommended behavior:

- `auth0Sub` uniquely links the local user to Auth0.
- `username` is the public display name.
- `email` can be synced from Auth0.
- `avatarUrl` can come from Auth0 or a later profile customization feature.
- `wins`, `losses`, `currentWinStreak`, and `bestWinStreak` update after every completed match.
- `currency`, `xp`, and `level` support pack rewards and progression.
- `packsOpened`, `matchesPlayed`, and `mvpCount` make profiles and leaderboards more interesting.

## Stay22 Integration

Add server-only API handling for accommodation search.

Expected search inputs:

```text
address
checkin
checkout
adults
children
rooms
max
currency
```

Expected server behavior:

- Call Stay22 accommodation search with the API key, affiliate ID, campaign, and page size.
- Normalize the response into a temporary card input shape for the current request.
- Save API responses and normalized hotel snapshots to the database so users can revisit previous packs, matches, and bracket runs.
- Re-fetch live Stay22 data when showing current booking CTAs or refreshing old card details.

Default currency should be CAD.

## Card Model

Saved cards should persist game metadata, Stay22 references, and the snapshot needed to show previous card pulls and match history.

Recommended saved card model:

```text
SavedCard
- id
- userId
- stay22PropertyId
- rarity
- cosmeticSeed
- acquiredScope
- acquiredCity
- edition
- xp
- trophies
- wins
- losses
- timesMvp
- dateAcquired
- createdAt
- updatedAt
```

Do not persist unsafe or unnecessary data such as:

- raw unbounded API dumps without request context
- API keys or private integration credentials
- anything not needed for card display, replay, analytics, or booking history

When a saved card is viewed from history, show the stored snapshot. When the user wants current booking availability or live pricing, rehydrate it from Stay22. If the property is unavailable, show a themed unavailable state such as **Unavailable for Selection** or **Transfer Pending**.

## Card Stats

Convert live Stay22 attributes into football-card stats:

| Stay22 Attribute | Card Stat |
| --- | --- |
| Guest rating | VIBE |
| Review count | LEGACY |
| Relative trip price | VALUE |
| Free cancellation, instant booking, supplier count | FLEX |
| Guests, bedrooms, beds | SQUAD |
| Property type rarity and cosmetic seed | CHAOS |

Rarity levels:

- Common
- Rare
- Epic
- Legendary

Rarity should affect visual treatment and small match modifiers, but the strongest recommendation should still come from real hotel quality and value.

## Pack Rules

- Pack size is five cards.
- First city pack is free once per user per normalized city.
- Later city or world packs cost currency.
- Pack openings should be recorded for audit and progression.
- Cards should reveal with a foil-style animation, rating count-up, property image, rarity treatment, and destination context.

Recommended pack model:

```text
PackOpen
- id
- userId
- scope
- city
- cost
- seed
- generatedCardIds
- createdAt
```

Recommended city claim model:

```text
CityPackClaim
- id
- userId
- normalizedCity
- createdAt
```

`userId + normalizedCity` should be unique.

## Match Rules

The match should be deterministic for the same cards, opponents, and seed.

Recommended match model:

```text
Match
- id
- userId
- selectedSquadCardIds
- opponentPropertyIds
- mode
- score
- winner
- mvpCardId
- mvpPropertyId
- rewards
- seed
- highlights
- createdAt
```

Match behavior:

- User selects three saved cards.
- City mode fetches opponent hotels from the same trip search.
- World mode fetches opponent hotels from a curated destination list.
- Simulation compares weighted team stats with seeded randomness.
- Five to seven highlight events are generated from real attributes.
- Rewards update user currency, XP, card XP, wins, losses, and streaks.
- Bracket tournaments are a main combat format and should reuse the same card stats, deterministic simulation, rewards, and match-history storage.

Example highlight templates:

```text
Free Cancellation Shield blocks a dangerous commitment.
Three supplier offers open the Transfer Window for +8 FLEX.
Instant Book triggers a First-Touch Finish.
The veteran hotel's review count powers a LEGACY attack.
The best-value card starts a counterattack.
```

## Collection

The collection should show saved cards as collectible tiles.

Card detail view should re-fetch live Stay22 data and show:

- property image
- live price
- rating
- policies
- capacity
- supplier options
- booking CTA
- card XP and trophies
- card match record

If the Stay22 result cannot be rehydrated, keep the saved card visible but mark it unavailable for current play or booking.

## History Storage

Users should be able to revisit previous packs, matches, and tournaments. Store enough request, response, and normalized snapshot data to reconstruct those screens without depending on the same live API result still being available.

Recommended history records:

```text
Stay22ApiCall
- id
- userId
- endpoint
- requestParams
- responseBody
- status
- createdAt
```

```text
HotelSnapshot
- id
- stay22PropertyId
- sourceApiCallId
- normalizedData
- createdAt
```

Use stored snapshots for historical display and match replay. Use fresh Stay22 calls for current availability, pricing, and booking links.

## Booking

The Match MVP view should include:

- hotel name from the live Stay22 response
- total price or nightly price from the live response
- guest rating
- cancellation or instant-booking status when available
- supplier name
- selected trip dates
- **Book MVP** CTA using the tracked Stay22 supplier link

The app should not build a separate checkout flow. Booking should happen through Stay22 supplier links.

## Demo Sequence

1. Search a real trip, such as Toronto or Montreal for two guests.
2. Open a five-card trip pack.
3. Show that each card stat came from live listing data.
4. Save the cards.
5. Draft a three-card squad.
6. Run a fast auto-match with visible hotel-data highlights.
7. Show that bracket tournaments are the larger competitive mode.
8. Reveal the Match MVP.
9. Click **Book MVP** and show the tracked supplier destination.

## Test Plan

- Unit test Auth0 user sync creates or updates the local user by `auth0Sub`.
- Unit test rarity assignment is deterministic from `stay22PropertyId` and `cosmeticSeed`.
- Unit test card stat calculation from normalized Stay22 response data.
- Unit test match simulation is deterministic for the same card IDs, opponent IDs, and seed.
- Unit test reward calculation updates wins, losses, streaks, XP, currency, and card stats correctly.
- API tests verify Stay22 calls are server-side and required search params are validated.
- API tests verify the Stay22 API key is never returned to the client.
- Persistence tests verify Stay22 API calls and normalized snapshots are stored for history while credentials are excluded.
- E2E test the happy path: sign in, search trip, open free city pack, save cards, view collection, build squad, play match, earn rewards, book MVP.
- E2E test unavailable rehydration: saved card remains visible but shows an unavailable state.

## Assumptions

- App name is **Check-In Champions**.
- Auth0 is the authentication provider.
- Username/password login is supported through Auth0, not through locally stored passwords.
- The local database stores user profile, game state, saved API responses, and normalized hotel snapshots.
- Stay22 data is used for live rendering, history, card rehydration, match setup, and booking.
- Stay22 API responses and normalized snapshots are saved so previous packs, matches, and tournaments can be revisited.
- Pack size is five cards.
- First city pack is free once per user per normalized city.
- V1 prioritizes the live trip pack over random daily packs.

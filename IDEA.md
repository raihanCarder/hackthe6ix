## Verdict: **yes—this is strongly on brief**

It absolutely qualifies as **“hotel data somewhere it has no business being.”** A pack-opening, collectible-card auto-battler is surprising, visual, immediately understandable, and much more memorable than another accommodation interface.

As currently described, I would score it:

| Dimension                    |    Score |
| ---------------------------- | -------: |
| “WTF?” novelty               |     9/10 |
| Demo spectacle               |     9/10 |
| Stay22 integration           |     7/10 |
| Booking/commission potential |     5/10 |
| Hackathon feasibility        |     7/10 |
| **Overall**                  | **8/10** |

With a few changes, it could become a **9.5/10 track submission**.

The key is making the pitch:

> **“Hotels compete for your booking.”**

Not merely:

> “We put hotel pictures on trading cards.”

---

# The biggest question the judges will ask

They may implicitly wonder:

> **Could this project work exactly the same way with a random hotel dataset instead of Stay22?**

Your answer must be **no**.

Make Stay22’s live data drive the cards, abilities, matchup, and final booking decision. The current API can return live property results with supplier prices and tracked links, property type, rating and review count, capacity, cancellation and instant-booking policies, location, and a thumbnail. That gives you enough material to make every card mechanically distinct. ([Stay22 Developer Docs][1])

## The stronger version of your concept

### **Check-In Champions**

The user enters:

- A real destination
- Real travel dates
- Number of guests
- Optional budget

Then:

1. Stay22 returns hotels that are actually bookable for that trip.
2. The user opens a pack containing three or five of those properties.
3. Each property becomes a football-style collectible card.
4. The user drafts a three-card lineup.
5. The hotels play a 30–60 second automated match.
6. The winning card becomes the trip recommendation.
7. The user clicks **Book the MVP** through the tracked Stay22 link.

That converts the game from a disconnected collectible toy into a bizarre but functional travel recommendation engine.

> **“Most booking sites make you compare 50 listings. We make the listings fight for your booking.”**

That is an excellent judge pitch.

---

# Translate hotel data into football-card language

Do not use arbitrary numbers. Let judges see that the Stay22 response materially shapes each card.

| Hotel information         | Card presentation        |
| ------------------------- | ------------------------ |
| Property type             | Position or player class |
| Guest rating              | Form                     |
| Review count              | Career appearances       |
| Total trip price          | Transfer value           |
| Capacity                  | Squad strength           |
| Supplier count            | Market reach             |
| Free cancellation         | Cancellation Shield      |
| Instant booking           | First-Touch Finish       |
| Multiple beds/bedrooms    | Formation flexibility    |
| Distance from destination | Away-game penalty        |
| Unusual property type     | Special trait            |
| Thumbnail                 | Player portrait          |

Possible card statistics:

- **VIBE** — derived from guest rating
- **LEGACY** — logarithmic score based on review count
- **VALUE** — rating relative to the current search’s prices
- **FLEX** — cancellation, instant booking, and supplier options
- **SQUAD** — guest and bedroom capacity
- **CHAOS** — property-type rarity and cosmetic randomness

Avoid making the most expensive property automatically the most powerful. That would make the game recommend bad-value bookings. A highly rated affordable hotel should be capable of beating a luxury property through its **VALUE** stat.

## Example cards

### The Boutique Playmaker

```text
VIBE       91
VALUE      84
FLEX       72
LEGACY     67
SQUAD      55
CHAOS      88
```

Special ability:

> **Lobby Through-Ball:** Gains momentum against large chain hotels.

### The Resort Tank

```text
VIBE       86
VALUE      63
FLEX       78
LEGACY     94
SQUAD      92
CHAOS      51
```

Special ability:

> **All-Inclusive Fortress:** Blocks the opponent’s first attack.

### The Cabin Wildcard

```text
VIBE       89
VALUE      81
FLEX       60
LEGACY     42
SQUAD      76
CHAOS      99
```

Special ability:

> **Remote Counterattack:** Doubles CHAOS during the final minute.

The Stay22 API supports a broad set of property types, including hotels, cabins, cottages, villas, ryokans, resorts, hostels, farm stays, chalets, private homes, and others. Those can become meaningful card archetypes rather than cosmetic labels. ([Stay22 Developer Docs][1])

---

# Make the match visibly use hotel attributes

A purely random animation would weaken the integration. Give each dramatic moment a recognizable connection to the listing data.

For example:

> **12′ — The Grand Hotel activates Veteran Aura! Its 4,218 reviews overwhelm the rookie villa.**

> **27′ — Free Cancellation Shield! The Boutique Playmaker survives a dangerous commitment.**

> **41′ — Three supplier offers open the Transfer Window. The resort gains +8 FLEX.**

> **58′ — Instant Book executes a First-Touch Finish!**

Then reveal:

> **MATCH MVP: The Junction Hotel**
> CAD $487 total · Rated 9.1 · Free cancellation
> **BOOK THE MVP**

This makes the match feel absurd, but it also communicates real travel information.

---

# Your current concept’s weakest point: booking intent

A globally random daily hotel pack is entertaining, but it may produce almost no bookings. Someone pulling a hotel in Tokyo when they have no Tokyo trip planned is unlikely to convert.

The strongest structure is:

## Primary mode: **Trip Pack**

The user supplies a destination and dates. Every pulled card is currently relevant and bookable.

This should be the mode shown to the judges.

## Secondary mode: **Daily World Pack**

The user pulls a surprise property from a featured destination for collecting and sharing.

This provides retention and spectacle, but it should not be the core monetization story.

## Optional mode: **Weekend League**

Use nearby or driveable destinations for an upcoming weekend. This maintains the surprise of a daily pack while producing more realistic travel intent.

The API accepts destinations or points of interest, coordinates and radius, dates, party size, budget filters, ratings, and property types. Dates and guest counts affect availability and pricing, so using real trip details makes the “live inventory” claim substantial rather than decorative. ([Stay22 Developer Docs][1])

---

# There is one important technical constraint

Stay22’s documentation says you may not hard- or cold-store its listings in your database or use the inventory as a historical data-analysis dataset. The inventory is intended for immediate, consumer-facing use. ([Stay22 Developer Docs][2])

That creates tension with a permanent collectible-card collection.

## Safer architecture

Persist only lightweight game information such as:

```text
Stay22 property reference ID
random cosmetic seed
date acquired
user nickname
card edition
match history
XP or trophies
```

Do **not** permanently copy:

```text
hotel name
current price
address
rating
review count
supplier links
thumbnail
availability
cancellation policy
```

When the user opens their collection, re-fetch the current property through Stay22 and rebuild the card from the current response. The API supports direct lookup using returned hotel or Stay22 IDs, so “rehydrating” a card is technically possible. ([Stay22 Developer Docs][1])

If the property is unavailable for the requested dates, turn that into part of the game:

- **On International Duty**
- **Unavailable for Selection**
- **Injury Reserve**
- **Retired Legend**
- **Transfer Pending**

For the hackathon, the simplest compliant implementation is a **session collection**: users open a pack, build a lineup, play, and share the result without maintaining a permanent database of hotel records.

Because storing even reference IDs is not explicitly addressed in the public restriction language, confirm that particular approach with the Stay22 team before turning it into a production collection system.

---

# Card art is achievable without overbuilding it

Stay22 results include a property thumbnail, so use that as the card’s “player portrait” and create the spectacle around it:

- Animated foil border
- Rarity glow
- Property-type icon
- Moving particle background
- Dramatic rating count-up
- Flag or destination reveal
- Silhouette before the card flips
- Confetti for a legendary pull

You do not need to generate entirely new hotel art. In fact, the authentic property image helps establish that the card represents a real place.

The public API documentation exposes a thumbnail URL, but the pages I reviewed do not provide detailed long-term image-storage or derivative-art terms. The conservative approach is to display the live thumbnail transiently rather than saving or training on it, and confirm with the sponsor before generating image derivatives. ([Stay22 Developer Docs][1])

---

# Cut the scope aggressively

Your full vision includes packs, collections, customization, matches, trading, comparisons, friends, CPU opponents, and sharing. That is too much for the strongest hackathon build.

## Build these four things

1. **Live Trip Pack**
2. **Excellent card-reveal animation**
3. **Three-card lineup and automated match**
4. **Book the MVP through Stay22**

## Add only one social feature

Generate a shareable result card:

> **My cottage beat your resort 3–2.**
> Challenge this lineup.

Do not build real trading, a marketplace, chat, authentication-heavy multiplayer, or an eleven-card roster. A three-card squad is enough to communicate the entire concept.

A deterministic simulation will be easier to debug than an LLM-controlled match. Use a seeded random number generator, card statistics, and templated commentary. An LLM could generate one flavor line when a card is pulled, but it should not sit in the critical match path.

---

# Recommended demo sequence

## 0:00–0:15 — Establish real travel intent

Say:

> “The judges are going to Montreal next weekend. Two guests, under $300 per night.”

Enter those values.

## 0:15–0:40 — Open the pack

Display:

> **MONTREAL WEEKEND PACK**
> Five currently bookable players. One possible champion.

Reveal three cards with strong animation.

## 0:40–0:55 — Draft the lineup

Choose:

- Boutique Playmaker
- Apartment Utility
- Resort Tank

Show that their statistics came from real ratings, prices, policies, capacity, and supplier availability.

## 0:55–1:35 — Run the match

Use four or five dramatic commentary moments. Keep it fast.

## 1:35–1:50 — Reveal the MVP

Show:

- Live total price
- Rating
- Free-cancellation status
- Supplier
- Dates
- Booking action

## 1:50–2:00 — Close

> “Stay22 gives us live hotel inventory. We turned it into a transfer market where hotels compete for your trip—and the winner is immediately bookable.”

Then click **Book the MVP** and show the tracked supplier destination. Stay22’s API is explicitly designed to return supplier links and allow commission attribution when users complete reservations. ([Stay22 Developer Docs][2])

---

# Positioning and naming

Call it a **football collectible-card experience** or **hotel auto-battler**, rather than using FIFA in the public product name or copying its exact branding.

Strong names include:

- **Check-In Champions**
- **Stay XI**
- **Suite League**
- **Hotel Ultimate**
- **Room Roster**
- **Booking Ballers**
- **The Accommodation League**

My pick is **Check-In Champions**.

## Final pitch

> **Check-In Champions turns live, bookable hotels into collectible football cards. Search a real trip, open a pack, draft a three-hotel squad, and watch the properties battle using their ratings, value, capacity, and booking policies. The match MVP becomes your trip recommendation—and you can book it immediately through Stay22.**

That concept matches the judge’s request extremely well. The winning adjustment is to make it **a strange booking decision engine disguised as a card game**, rather than a card game that happens to contain hotels.

[1]: https://dev.stay22.com/docs/api/accommodations/search?utm_source=chatgpt.com "Search Accommodation | Stay22 Developer Docs"
[2]: https://dev.stay22.com/docs/api?utm_source=chatgpt.com "Overview | Stay22 Developer Docs"

# PLAN

# Check-In Champions MVP Plan

## Summary

Build a Next.js full-stack MVP where live Stay22 hotel results become collectible football-style cards. The core demo flow is: user searches a real
trip, opens a free 5-card city pack, saves cards to their collection, builds a 3-card squad, runs a seeded 5,000-iteration auto-match against city
or world hotels, earns currency, and can book the Match MVP through a tracked Stay22 supplier link.

Use Stay22 data only for live rendering and booking decisions. Persist reference-only card records to avoid cold-storing listing data, since Stay22
docs say the API is for live consumer use and listings may not be hard/cold-stored. References: Stay22 overview (https://dev.stay22.com/docs/api),
accommodation search (https://dev.stay22.com/docs/api/accommodations/search).

## Key Changes

- Create a greenfield Next.js + TypeScript app with App Router, Tailwind, Framer Motion, Prisma, Postgres, and Auth.js.
- Add server-only Stay22 integration:
  - GET /api/accommodations/search
  - Inputs: address, checkin, checkout, adults, children, rooms, max, currency.
  - Calls Stay22 GET /v2/accommodations with X-API-KEY, aid, campaign, and pageSize.
  - Never expose the Stay22 API key client-side.

- Add persisted user game data:
  - User: auth identity, currency balance.
  - SavedCard: userId, stay22PropertyId, optional supplier IDs, rarity, cosmeticSeed, acquiredScope, acquiredCity, edition, xp, trophies,
    timestamps.

  - CityPackClaim: unique userId + normalizedCity so the first city pack is free once.
  - PackOpen: audit record for pack scope, city/world, cost, generated card IDs.
  - Match: selected squad card IDs, opponent hotel reference IDs, mode, score, MVP card/property ID, rewards, seed, highlights.

- Do not persist hotel name, price, address, rating, review count, thumbnail, policies, or supplier links. Re-fetch by hotelids when viewing
  collection, match details, or booking.

## Product Flow

- First screen: Trip Pack.
  - User enters destination, check-in/out dates, guests, rooms, optional max nightly budget.
  - Default currency: CAD.
  - First pack for a normalized city is free; later city/world packs cost currency.

- Pack opening:
  - Fetch live Stay22 results for the trip.
  - Select 5 properties from the result pool using a seeded random picker.
  - Convert each result into a card with a rarity and stats.
  - Reveal cards with FIFA-like flip/count-up/foil animation.

- Collection:
  - Show saved cards as collectible card tiles.
  - On click, rehydrate the card from Stay22 and show an Expedia-style detail panel: image, live price, rating, policies, capacity, suppliers,
    and booking CTA.

  - If unavailable, show a themed unavailable state like Unavailable for Selection.

- Matchup:
  - User selects 3 saved cards.
  - Opponent mode:
    - City: fetch 3 opponent hotels from the same destination/trip.
    - World: fetch from a curated random destination list and same date/guest defaults where possible.

  - Run a deterministic 5,000-iteration sim using a seed stored on Match.
  - Show 5-7 templated highlights tied to real attributes.
  - Award currency and XP after match.
  - Show Match MVP with live booking CTA.

## Card and Simulation Rules

- Card stats derived from current Stay22 response:
  - VIBE: guest rating.
  - LEGACY: logarithmic review count.
  - VALUE: relative value within current search result prices.
  - FLEX: free cancellation, instant booking, supplier count.
  - SQUAD: capacity, bedrooms, beds.
  - CHAOS: property-type rarity plus cosmetic seed.

- Rarity:
  - Common, Rare, Epic, Legendary.
  - Rarity affects visual treatment and small match modifiers, but raw hotel value must still matter.

- Match engine:
  - Each simulated possession compares weighted team stats plus seeded randomness.
  - City mode applies a small distance/location relevance modifier.
  - Highlights use templates like Free Cancellation Shield, Transfer Window, and First-Touch Finish.
  - Results are deterministic for the same card IDs, opponent IDs, and seed.

## Test Plan

- Unit test rarity assignment is deterministic from stay22PropertyId + cosmeticSeed.
- Unit test match simulation determinism and reward calculation.
- API tests verify Stay22 calls are server-side, required params are validated, and no API key leaks.
- Persistence tests verify saved cards store only reference/game fields, not listing snapshots.
- E2E happy path:
  - Sign in.
  - Search Toronto or Montreal trip.
  - Open first free city pack.
  - Save 5 cards.
  - View collection and card detail.
  - Build 3-card lineup.
  - Play city match.
  - Earn currency.
  - Click Book MVP.

- E2E unavailable path: rehydrated saved card is missing/unavailable and renders the themed unavailable state.

## Assumptions

- App name is Check-In Champions.
- V1 includes packs, collection, 3v3 city/world matchups, rewards, and booking CTA.
- V1 excludes bracket tournaments, trading, gambling, friends, marketplace, chat, and multiplayer.
- Saved cards are database-backed but reference-only for Stay22 compliance.
- Auth is required in v1 so free city packs, currency, and collections are tied to users.
- Pack size is 5 cards.
- First city pack is free once per user per normalized city.
- Demo booking uses Stay22 supplier links returned from live rehydration.

import { ProtectedLink } from "@/components/ProtectedLink";
import { LandingStats } from "@/app/LandingStats";
import { HotelCard } from "@/components/HotelCard";
import type { NormalizedAccommodation } from "@/lib/engine/types";
import type { CardStats, Rarity } from "@/lib/game/cardStats";

const SHOWCASE: Array<{ hotel: NormalizedAccommodation; stats: CardStats; overall: number; rarity: Rarity }> = [
  {
    overall: 54,
    rarity: "common",
    stats: { comfort: 70, amenities: 76, luxury: 70, value: 80, location: 88, service: 78 },
    hotel: sample("Card Hotel", "London, UK", 220),
  },
  {
    overall: 66,
    rarity: "rare",
    stats: { comfort: 78, amenities: 80, luxury: 83, value: 82, location: 91, service: 84 },
    hotel: sample("Ace Hotel New York", "New York, USA", 310),
  },
  {
    overall: 82,
    rarity: "epic",
    stats: { comfort: 89, amenities: 86, luxury: 87, value: 80, location: 92, service: 90 },
    hotel: sample("Fairmont Royal York", "Toronto, Canada", 420),
  },
  {
    overall: 95,
    rarity: "legendary",
    stats: { comfort: 95, amenities: 94, luxury: 91, value: 78, location: 90, service: 96 },
    hotel: sample("The Ritz-Carlton Toronto", "Toronto, Canada", 540),
  },
];

function sample(name: string, address: string, nightlyPrice: number): NormalizedAccommodation {
  return {
    id: name,
    bookingUrl: null,
    supplierIds: [],
    supplierLinks: [],
    supplierCount: 1,
    name,
    propertyType: "hotel",
    address,
    latitude: null,
    longitude: null,
    distanceKm: null,
    guestRating: null,
    stars: null,
    reviewCount: null,
    capacity: null,
    bedrooms: null,
    beds: null,
    bathrooms: null,
    freeCancellation: null,
    instantBooking: null,
    thumbnailUrl: null,
    nightlyPrice,
    provenance: {},
  };
}

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <section className="grid gap-10 py-14 sm:py-20 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="eyebrow">Stay22 live inventory</p>
          <h1 className="font-display mt-4 text-4xl leading-[1.05] text-chalk sm:text-6xl">
            Hotel data, turned into a game people book from.
          </h1>
          <p className="mt-6 max-w-xl text-base text-chalk-dim sm:text-lg">
            Anyone can build a booking prompt. This turns Stay22 inventory into hotel cards, trip
            packs, and recommendations that can earn real commission.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <ProtectedLink href="/packs" className="btn-primary rounded-lg px-8 py-3 text-lg">
              Kick off a trip
            </ProtectedLink>
            <ProtectedLink href="/collection" className="btn-chalk rounded-lg px-6 py-3">
              View cards
            </ProtectedLink>
          </div>

          <LandingStats />
        </div>

        <div className="relative mx-auto h-72 w-full max-w-xs sm:h-80">
          {SHOWCASE.map((card, i) => (
            <div
              key={card.hotel.id}
              className="absolute top-0 w-40 sm:w-44"
              style={{
                left: `${i * 15}%`,
                zIndex: i,
                transform: `rotate(${(i - 1.5) * 4}deg)`,
              }}
            >
              <HotelCard hotel={card.hotel} stats={card.stats} overall={card.overall} rarity={card.rarity} cosmeticSeed={card.hotel.id} compact />
            </div>
          ))}
        </div>
      </section>

      <div className="chalk-line" />

      <section className="grid gap-8 py-14 sm:grid-cols-3">
        {[
          {
            step: "1",
            title: "Kick off a trip",
            body: "Search a destination and dates. The trip pack builder turns the live Stay22 results for that search into a set of collectible hotel cards.",
          },
          {
            step: "2",
            title: "Mint your pack",
            body: "Open the pack to reveal five cards, each scored on Luxury, Amenities, Comfort, Value, Location, and Service — pulled straight from the listing data.",
          },
          {
            step: "3",
            title: "Book the winner",
            body: "Run your cards through the recommendation engine or just browse your collection — every card carries a live, bookable link back to Stay22.",
          },
        ].map((item) => (
          <div key={item.title} className="panel rounded-xl p-6">
            <p className="eyebrow">Step {item.step}</p>
            <h2 className="font-display mt-2 text-lg text-chalk">{item.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-chalk-dim">{item.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

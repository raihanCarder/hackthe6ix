"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { resolveHotelFlag } from "@/lib/data/hotelFlags";
import type { NormalizedAccommodation } from "@/lib/engine/types";
import type { CardStats, Rarity } from "@/lib/game/cardStats";

const RARITY_LABEL: Record<Rarity, string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
};

export const STAT_META: {
  key: keyof CardStats;
  label: string;
  color: string;
}[] = [
  { key: "luxury", label: "Luxury", color: "var(--stat-luxury)" },
  { key: "amenities", label: "Amenities", color: "var(--stat-amenities)" },
  { key: "comfort", label: "Comfort", color: "var(--stat-comfort)" },
  { key: "value", label: "Value", color: "var(--stat-value)" },
  { key: "location", label: "Location", color: "var(--stat-location)" },
  { key: "service", label: "Service", color: "var(--stat-service)" },
];

interface DisplayStat {
  label: string;
  value: number;
}

function displayStats(
  stats: CardStats,
): DisplayStat[] {
  return [
    { label: "Luxury", value: stats.luxury },
    { label: "Amenities", value: stats.amenities },
    { label: "Comfort", value: stats.comfort },
    { label: "Value", value: stats.value },
    { label: "Location", value: stats.location },
    { label: "Service", value: stats.service },
  ];
}

function hotelName(hotel: NormalizedAccommodation): string {
  return hotel.name ?? "Hotel Card";
}

function compactLocation(address: string | null): string {
  if (!address) return "Location unavailable";
  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 2) return parts.slice(-2).join(", ");
  return address;
}

function seededHue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}

function artStyle(
  hotel: NormalizedAccommodation,
  cosmeticSeed: string,
): CSSProperties {
  const hue = seededHue(`${hotel.id}:${cosmeticSeed}`);
  const fallback =
    `linear-gradient(180deg, hsla(${hue}, 48%, 55%, 0.42), hsla(${hue + 36}, 46%, 15%, 0.84)), ` +
    "linear-gradient(90deg, rgba(3, 45, 35, 0.75), rgba(7, 21, 16, 0.9))";

  if (!hotel.thumbnailUrl) {
    return { backgroundImage: fallback };
  }

  return {
    backgroundImage: `url(${JSON.stringify(hotel.thumbnailUrl)}), ${fallback}`,
  };
}

function priceLabel(hotel: NormalizedAccommodation): string {
  return hotel.nightlyPrice !== null
    ? `$${hotel.nightlyPrice}/night`
    : "Price at booking";
}

export function HotelCard({
  hotel,
  stats,
  overall,
  rarity,
  cosmeticSeed,
  compact = false,
}: {
  hotel: NormalizedAccommodation;
  stats: CardStats;
  overall: number;
  rarity: Rarity;
  cosmeticSeed: string;
  compact?: boolean;
}) {
  const name = hotelName(hotel);
  const statRows = displayStats(stats);
  const location = compact
    ? compactLocation(hotel.address)
    : (hotel.address ?? compactLocation(hotel.address));
  const hasThumbnail = Boolean(hotel.thumbnailUrl);
  const countryFlag = resolveHotelFlag(hotel);

  return (
    <article
      className={`hotel-card hotel-card-${rarity} card-face relative w-full select-none`}
    >
      <div
        className="card-sheen pointer-events-none absolute inset-0 z-20"
        aria-hidden
      />
      <div className="hotel-card-frame">
        <div className="hotel-card-inner">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 leading-none">
              <div className="hotel-overall font-score font-bold text-card-primary">
                {overall}
              </div>
              <div className="hotel-overall-label font-display text-chalk">
                OVR
              </div>
            </div>
            <div className="hotel-card-nationality flex shrink-0 flex-col items-end gap-2">
              <span className="hotel-rarity-pill font-score truncate px-4 py-1 text-[10px] font-bold uppercase">
                {RARITY_LABEL[rarity]}
              </span>
              {countryFlag && (
                <Image
                  src={countryFlag.src}
                  alt={countryFlag.alt}
                  className="hotel-country-flag"
                  width={32}
                  height={21}
                  loading="lazy"
                  unoptimized
                />
              )}
            </div>
          </div>

          <div
            className={`hotel-art ${hasThumbnail ? "hotel-art-photo" : "hotel-art-generated"}`}
            style={artStyle(hotel, cosmeticSeed)}
          >
            {!hasThumbnail && (
              <div className="hotel-art-skyline" aria-hidden>
                <span className="building building-a" />
                <span className="building building-b" />
                <span className="building building-c" />
                <span className="building building-d" />
              </div>
            )}
          </div>

          <div className="hotel-divider" />

          <div className="hotel-name-wrap text-center">
            <h3 className="hotel-name font-display line-clamp-2 text-balance text-chalk">
              {name}
            </h3>
          </div>

          <div className="hotel-meta flex items-end justify-between gap-2 border-b border-card-line">
            <p className="min-w-0 truncate font-bold text-chalk-dim">
              {location}
            </p>
            <p className="font-score shrink-0 whitespace-nowrap font-bold text-card-primary">
              {priceLabel(hotel)}
            </p>
          </div>

          <dl className="hotel-stats grid grid-cols-2">
            {statRows.map((stat) => (
              <div
                key={stat.label}
                className="hotel-stat-row grid items-baseline"
              >
                <dt className="font-score text-right font-bold leading-none text-card-primary">
                  {stat.value}
                </dt>
                <dd className="truncate font-bold uppercase leading-none text-chalk">
                  {stat.label}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </article>
  );
}

export function CardBack() {
  return (
    <div className="hotel-card hotel-card-back card-back relative w-full overflow-hidden select-none">
      <div
        className="card-sheen pointer-events-none absolute inset-0 z-20"
        aria-hidden
      />
      <div className="hotel-card-frame">
        <div className="hotel-card-inner flex flex-col items-center justify-center gap-4 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-card-line bg-black/25 shadow-[0_0_24px_rgba(232,179,59,0.24)]">
            <span className="font-display text-2xl text-card-primary">CC</span>
          </div>
          <div>
            <p className="font-display text-lg leading-none text-chalk">
              Check-In
            </p>
            <p className="font-display text-lg leading-none text-chalk">
              Champions
            </p>
            <p className="eyebrow mt-3 !text-[10px]">Trip pack</p>
          </div>
        </div>
      </div>
    </div>
  );
}

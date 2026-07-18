"use client";

import { useState } from "react";
import type { NormalizedAccommodation } from "@/lib/engine/types";
import type { CardStats, Rarity } from "@/lib/game/cardStats";

const RARITY_LABEL: Record<Rarity, string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
};

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

interface StatMeta {
  key: keyof CardStats;
  symbol: string;
  name: string;
  blurb: string;
  color: string;
  detail: (hotel: NormalizedAccommodation) => string[];
}

const STAT_META: StatMeta[] = [
  {
    key: "vibe",
    symbol: "★",
    name: "Vibe",
    blurb: "Guest rating",
    color: "var(--stat-vibe)",
    detail: (hotel) =>
      hotel.guestRating !== null
        ? [`${hotel.guestRating.toFixed(1)} / 10 average`, `${plural(hotel.reviewCount ?? 0, "review")} on file`]
        : ["No guest rating yet — starts neutral at 50"],
  },
  {
    key: "legacy",
    symbol: "◆",
    name: "Legacy",
    blurb: "Review count",
    color: "var(--stat-legacy)",
    detail: (hotel) =>
      hotel.reviewCount !== null
        ? [`${hotel.reviewCount.toLocaleString()} reviews`, "Scales on a log curve — each extra review counts for a little less"]
        : ["No review count on file — starts at 40"],
  },
  {
    key: "value",
    symbol: "$",
    name: "Value",
    blurb: "Price for what you get",
    color: "var(--stat-value)",
    detail: (hotel) =>
      hotel.nightlyPrice !== null
        ? [`$${hotel.nightlyPrice}/night`, "Cheaper stays in the same pack score higher"]
        : ["No live price — starts neutral at 50"],
  },
  {
    key: "flex",
    symbol: "↯",
    name: "Flex",
    blurb: "Cancellation & booking terms",
    color: "var(--stat-flex)",
    detail: (hotel) => [
      hotel.freeCancellation ? "Free cancellation" : "Standard cancellation policy",
      hotel.instantBooking ? "Instant booking available" : "Request-to-book",
      `${plural(hotel.supplierCount ?? 1, "supplier")} listing this stay`,
    ],
  },
  {
    key: "squad",
    symbol: "⌂",
    name: "Squad",
    blurb: "Capacity",
    color: "var(--stat-squad)",
    detail: (hotel) => [
      `Sleeps ${hotel.capacity ?? 2}`,
      plural(hotel.bedrooms ?? 1, "bedroom"),
      plural(hotel.beds ?? 1, "bed"),
    ],
  },
  {
    key: "chaos",
    symbol: "⚂",
    name: "Chaos",
    blurb: "Wildcard",
    color: "var(--stat-chaos)",
    detail: (hotel) => [
      `Property type: ${hotel.propertyType ?? "hotel"}`,
      "Randomized per pack — the same hotel can roll differently next time",
    ],
  },
];

/** Deterministic art hue from the cosmetic seed — no external images needed. */
function seedHue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}

function initials(name: string | null): string {
  if (!name) return "??";
  return name
    .split(/\s+/)
    .filter((w) => /[a-z0-9]/i.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
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
  const hue = seedHue(cosmeticSeed);
  const [activeStat, setActiveStat] = useState<keyof CardStats | null>(null);
  const active = STAT_META.find((m) => m.key === activeStat) ?? null;
  return (
    <div
      className={`foil-${rarity} card-face relative w-full overflow-hidden rounded-2xl select-none`}
      style={{ aspectRatio: "5 / 7" }}
    >
      <div className="card-sheen pointer-events-none absolute inset-0 z-10" aria-hidden />

      {/* Header: jersey number + rarity */}
      <div className="flex items-start justify-between px-3 pt-3">
        <div className="leading-none">
          <div className="font-score text-4xl font-semibold text-gold-bright">{overall}</div>
          <div className="eyebrow mt-1">{hotel.propertyType ?? "stay"}</div>
        </div>
        <span
          className="font-score rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest"
          style={{ border: "1px solid var(--foil-ring)", color: "var(--chalk)" }}
        >
          {RARITY_LABEL[rarity]}
        </span>
      </div>

      {/* Art: seeded kit colors + crest monogram */}
      <div className="relative mx-3 mt-2 overflow-hidden rounded-lg" style={{ aspectRatio: "16/9" }}>
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at 30% 20%, hsl(${hue} 45% 34%), hsl(${(hue + 40) % 360} 55% 16%) 70%)`,
          }}
        />
        <div
          className="absolute inset-0 opacity-25"
          style={{
            background:
              "repeating-linear-gradient(90deg, transparent 0 14px, rgba(255,255,255,0.35) 14px 15px)",
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-display text-4xl text-chalk/90 drop-shadow-lg">
            {initials(hotel.name)}
          </span>
        </div>
        {hotel.guestRating !== null && (
          <span className="font-score absolute bottom-1 right-1.5 rounded bg-black/50 px-1.5 py-0.5 text-[11px] text-gold-bright">
            ★ {hotel.guestRating.toFixed(1)}
          </span>
        )}
      </div>

      {/* Name */}
      <div className="px-3 pt-2">
        <p className="font-display truncate text-sm leading-tight text-chalk">{hotel.name}</p>
        {!compact && (
          <p className="truncate text-[11px] text-chalk-dim">{hotel.address}</p>
        )}
      </div>

      {/* Stats */}
      <div className="relative grid grid-cols-2 gap-x-3 gap-y-1 px-3 pb-2 pt-1.5">
        {STAT_META.map(({ key, symbol, name, blurb, color }) => (
          <div
            key={key}
            role="button"
            tabIndex={0}
            className="group/stat relative flex items-center gap-1.5 focus:outline-none"
            onClick={(e) => {
              e.stopPropagation();
              setActiveStat((cur) => (cur === key ? null : key));
            }}
            onKeyDown={(e) => {
              if (e.key !== "Enter" && e.key !== " ") return;
              e.preventDefault();
              e.stopPropagation();
              setActiveStat((cur) => (cur === key ? null : key));
            }}
          >
            <span
              className="w-4 shrink-0 text-center text-[12px] leading-none font-semibold"
              style={{ color }}
              aria-hidden
            >
              {symbol}
            </span>
            <div className="stat-bar h-1.5 flex-1 overflow-hidden rounded-full">
              <div className="h-full rounded-full" style={{ width: `${stats[key]}%`, background: color }} />
            </div>
            <span className="font-score w-5 shrink-0 text-right text-[11px] text-chalk">
              {stats[key]}
            </span>

            {/* Hover: name + one-liner */}
            <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 w-max max-w-[130px] -translate-x-1/2 rounded-md bg-black/90 px-2 py-1 text-center text-[9px] leading-tight text-chalk opacity-0 shadow-lg transition-opacity duration-150 group-hover/stat:opacity-100 group-focus/stat:opacity-100">
              <span className="font-semibold" style={{ color }}>
                {name}
              </span>
              <br />
              {blurb}
            </div>
          </div>
        ))}

        {/* Click: full breakdown */}
        {active && (
          <div
            className="absolute inset-0 z-30 flex flex-col justify-between gap-1 rounded-lg bg-black/90 p-2.5"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="font-score text-sm font-semibold" style={{ color: active.color }}>
                  {active.symbol} {active.name}
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="Close"
                  className="font-score cursor-pointer px-1 text-xs text-chalk-dim hover:text-chalk"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveStat(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter" && e.key !== " ") return;
                    e.preventDefault();
                    e.stopPropagation();
                    setActiveStat(null);
                  }}
                >
                  ✕
                </span>
              </div>
              <p className="eyebrow !text-[8px]">
                {active.blurb} · score {stats[active.key]}
              </p>
            </div>
            <ul className="space-y-0.5">
              {active.detail(hotel).map((line, i) => (
                <li key={i} className="text-[10px] leading-snug text-chalk-dim">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Footer: live facts */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between border-t border-white/10 bg-black/30 px-3 py-1.5">
        <span className="font-score text-xs text-chalk">
          {hotel.nightlyPrice !== null ? `$${hotel.nightlyPrice}/night` : "price on booking"}
        </span>
        <span className="text-[10px] text-chalk-dim">
          {hotel.freeCancellation ? "free cancel" : hotel.instantBooking ? "instant book" : `${hotel.supplierCount ?? 1} suppliers`}
        </span>
      </div>
    </div>
  );
}

export function CardBack() {
  return (
    <div className="card-back relative w-full overflow-hidden rounded-2xl" style={{ aspectRatio: "5 / 7" }}>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-gold/60">
          <span className="font-display text-xl text-gold-bright">CC</span>
        </div>
        <p className="eyebrow !text-[10px]">Trip pack</p>
      </div>
    </div>
  );
}

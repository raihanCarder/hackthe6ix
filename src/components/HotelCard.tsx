"use client";

import type { NormalizedAccommodation } from "@/lib/engine/types";
import type { CardStats, Rarity } from "@/lib/game/cardStats";

const RARITY_LABEL: Record<Rarity, string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
};

const STAT_LABELS: Array<{ key: keyof CardStats; label: string }> = [
  { key: "vibe", label: "VIB" },
  { key: "legacy", label: "LEG" },
  { key: "value", label: "VAL" },
  { key: "flex", label: "FLX" },
  { key: "squad", label: "SQD" },
  { key: "chaos", label: "CHS" },
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
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 px-3 pb-2 pt-1.5">
        {STAT_LABELS.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className="eyebrow w-7 shrink-0 !text-[9px]">{label}</span>
            <div className="stat-bar h-1.5 flex-1 overflow-hidden rounded-full">
              <div className="h-full rounded-full" style={{ width: `${stats[key]}%` }} />
            </div>
            <span className="font-score w-5 shrink-0 text-right text-[11px] text-chalk">
              {stats[key]}
            </span>
          </div>
        ))}
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

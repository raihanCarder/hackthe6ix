import { Skyline } from "@/components/Skyline";
import type { NormalizedAccommodation } from "@/lib/engine/types";
import type { CardStats, Rarity } from "@/lib/game/cardStats";

const RARITY_LABEL: Record<Rarity, string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
};

export interface StatMeta {
  key: keyof CardStats;
  label: string;
  color: string;
}

export const STAT_META: StatMeta[] = [
  { key: "luxury", label: "Luxury", color: "var(--stat-luxury)" },
  { key: "amenities", label: "Amenities", color: "var(--stat-amenities)" },
  { key: "comfort", label: "Comfort", color: "var(--stat-comfort)" },
  { key: "value", label: "Value", color: "var(--stat-value)" },
  { key: "location", label: "Location", color: "var(--stat-location)" },
  { key: "service", label: "Service", color: "var(--stat-service)" },
];

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
  return (
    <div
      className={`foil-${rarity} card-face card-cut relative w-full select-none`}
      style={{ aspectRatio: "5 / 7" }}
    >
      <div className="card-sheen pointer-events-none absolute inset-0 z-10" aria-hidden />

      {rarity === "legendary" && (
        <div className="card-accent-bar absolute inset-x-0 top-0 z-20 mx-auto mt-1.5 h-1 w-10 rounded-full" aria-hidden />
      )}

      {/* Header: OVR + rarity */}
      <div className="flex items-start justify-between px-3 pt-3">
        <div className="leading-none">
          <div className="font-score text-4xl font-semibold text-chalk">{overall}</div>
          <div className="eyebrow mt-1">OVR</div>
        </div>
        <span className="rarity-pill font-score rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest">
          {RARITY_LABEL[rarity]}
        </span>
      </div>

      {/* Art: seeded skyline */}
      <div className="relative mx-3 mt-2 overflow-hidden rounded-md border border-white/10" style={{ aspectRatio: "16/9" }}>
        <Skyline seed={cosmeticSeed} className="h-full w-full" />
      </div>

      {/* Name + location/price */}
      <div className="border-b border-white/10 px-3 pb-2 pt-2">
        <p className="font-display truncate text-sm leading-tight text-chalk">{hotel.name}</p>
        <p className="mt-0.5 flex items-baseline justify-between gap-2 text-[11px] text-chalk-dim">
          {!compact && <span className="truncate">{hotel.address ?? "—"}</span>}
          <span className="ml-auto shrink-0 text-chalk">
            {hotel.nightlyPrice !== null ? `$${hotel.nightlyPrice}/night` : "—"}
          </span>
        </p>
      </div>

      {/* Stats: number then label, two columns */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 px-3 pb-3 pt-2">
        {STAT_META.map(({ key, label }) => (
          <div key={key} className="stat-row">
            <span className="stat-value text-chalk">{stats[key]}</span>
            <span className="stat-label">{label}</span>
          </div>
        ))}
      </div>

      {rarity === "legendary" && (
        <div className="card-accent-bar absolute inset-x-0 bottom-1.5 z-20 mx-auto h-1 w-10 rounded-full" aria-hidden />
      )}
    </div>
  );
}

export function CardBack() {
  return (
    <div className="card-back card-cut relative w-full" style={{ aspectRatio: "5 / 7" }}>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-cyan-bright/60">
          <span className="font-display text-xl text-cyan-bright">CC</span>
        </div>
        <p className="eyebrow !text-[10px]">Trip pack</p>
      </div>
    </div>
  );
}

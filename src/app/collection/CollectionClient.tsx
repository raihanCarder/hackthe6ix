"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { artStyle, HotelCard, RARITY_LABEL, STAT_META } from "@/components/HotelCard";
import type { CardPayload } from "@/components/types";
import { resolveHotelFlag } from "@/lib/data/hotelFlags";
import type { NormalizedAccommodation } from "@/lib/engine/types";
import type { Rarity } from "@/lib/game/cardStats";

const PAGE_SIZE = 20;

type SortKey = "recent" | "rating" | "price-asc" | "price-desc";
type RarityFilter = Rarity | "all";

const RARITY_ORDER: Rarity[] = ["common", "rare", "epic", "legendary"];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "recent", label: "Most recent" },
  { value: "rating", label: "Guest rating" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
];

// Nullable numbers always sort to the end regardless of direction.
function compareNullableDesc(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

function compareNullableAsc(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

export function CollectionClient() {
  const [cards, setCards] = useState<CardPayload[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CardPayload | null>(null);
  const [live, setLive] = useState<{
    loading: boolean;
    available?: boolean;
    hotel?: NormalizedAccommodation;
  }>({ loading: false });

  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [rarityFilter, setRarityFilter] = useState<RarityFilter>("all");
  const [sortBy, setSortBy] = useState<SortKey>("recent");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/me")
      .then((response) => (response.ok ? response.json() : null))
      .then(
        (data: { user: unknown | null; authMode: "auth0" | "dev" } | null) => {
          if (!cancelled && data?.authMode === "auth0" && !data.user) {
            window.location.assign(
              `/auth/login?returnTo=${encodeURIComponent("/collection")}`,
            );
          }
        },
      );

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    fetch("/api/cards")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Could not load collection");
        setCards(data.cards);
      })
      .catch((e) => setError(e.message));
  }, []);

  // Distinct countries present in the collection, for the filter dropdown.
  const countryOptions = useMemo(() => {
    if (!cards) return [];
    const byCode = new Map<string, string>();
    for (const card of cards) {
      const code = card.hotel.countryCode;
      if (!code) continue;
      byCode.set(code, card.hotel.countryName ?? code);
    }
    return [...byCode.entries()]
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [cards]);

  const filteredSorted = useMemo(() => {
    if (!cards) return [];
    const filtered = cards.filter(
      (card) =>
        (countryFilter === "all" ||
          card.hotel.countryCode === countryFilter) &&
        (rarityFilter === "all" || card.rarity === rarityFilter),
    );

    if (sortBy === "recent") return filtered;

    const sorted = [...filtered];
    if (sortBy === "rating") {
      sorted.sort((a, b) =>
        compareNullableDesc(a.hotel.guestRating, b.hotel.guestRating),
      );
    } else if (sortBy === "price-asc") {
      sorted.sort((a, b) =>
        compareNullableAsc(a.hotel.nightlyPrice, b.hotel.nightlyPrice),
      );
    } else if (sortBy === "price-desc") {
      sorted.sort((a, b) =>
        compareNullableDesc(a.hotel.nightlyPrice, b.hotel.nightlyPrice),
      );
    }
    return sorted;
  }, [cards, countryFilter, rarityFilter, sortBy]);

  const visibleCards = filteredSorted.slice(0, visibleCount);

  // Reset paging to the first page whenever a filter or sort changes.
  function resetPaging() {
    setVisibleCount(PAGE_SIZE);
  }

  async function openCard(card: CardPayload) {
    setSelected(card);
    setLive({ loading: true });
    try {
      const response = await fetch(`/api/cards/${card.id}/rehydrate`);
      const data = await response.json();
      if (!response.ok) throw new Error();
      setLive({ loading: false, available: data.available, hotel: data.hotel });
    } catch {
      setLive({ loading: false, available: false });
    }
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <p className="font-display text-xl text-chalk">{error}</p>
        <p className="mt-2 text-sm text-chalk-dim">Try refreshing the page.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <p className="eyebrow">Collection</p>
      <h1 className="font-display mt-2 text-3xl text-chalk">Your collection</h1>
      {cards !== null && (
        <p className="mt-1 text-sm text-chalk-dim">
          {cards.length} {cards.length === 1 ? "card" : "cards"} collected
        </p>
      )}

      {cards === null ? (
        <p className="mt-8 text-chalk-dim">Loading your collection…</p>
      ) : cards.length === 0 ? (
        <div className="panel mt-8 rounded-xl p-10 text-center">
          <p className="font-display text-lg text-chalk">No cards yet.</p>
          <p className="mt-2 text-sm text-chalk-dim">
            Mint your first Trip Pack — the first one in every city is free.
          </p>
          <Link
            href="/packs"
            className="btn-primary mt-5 inline-block rounded-lg px-6 py-2.5"
          >
            Kick off a trip
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-end gap-3">
            {countryOptions.length >= 2 && (
              <label className="flex flex-col gap-1">
                <span className="eyebrow !text-[9px]">Country</span>
                <select
                  value={countryFilter}
                  onChange={(e) => {
                    setCountryFilter(e.target.value);
                    resetPaging();
                  }}
                  className="rounded-lg bg-pitch-950/60 px-3 py-2 text-sm text-chalk"
                >
                  <option value="all">All countries</option>
                  {countryOptions.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="flex flex-col gap-1">
              <span className="eyebrow !text-[9px]">Rarity</span>
              <select
                value={rarityFilter}
                onChange={(e) => {
                  setRarityFilter(e.target.value as RarityFilter);
                  resetPaging();
                }}
                className="rounded-lg bg-pitch-950/60 px-3 py-2 text-sm text-chalk"
              >
                <option value="all">All rarities</option>
                {RARITY_ORDER.map((r) => (
                  <option key={r} value={r}>
                    {RARITY_LABEL[r]}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="eyebrow !text-[9px]">Sort by</span>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as SortKey);
                  resetPaging();
                }}
                className="rounded-lg bg-pitch-950/60 px-3 py-2 text-sm text-chalk"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <p className="ml-auto text-xs text-chalk-dim">
              Showing {visibleCards.length} of {filteredSorted.length}
            </p>
          </div>

          {filteredSorted.length === 0 ? (
            <div className="panel mt-6 rounded-xl p-10 text-center">
              <p className="font-display text-lg text-chalk">
                No cards match these filters.
              </p>
              <button
                onClick={() => {
                  setCountryFilter("all");
                  setRarityFilter("all");
                  resetPaging();
                }}
                className="btn-chalk mt-4 rounded-lg px-5 py-2"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <>
              <div className="hotel-card-grid mt-6">
                {visibleCards.map((card) => (
                  <button
                    key={card.id}
                    onClick={() => openCard(card)}
                    className="text-left transition hover:-translate-y-1"
                  >
                    <HotelCard
                      hotel={card.hotel}
                      stats={card.stats}
                      overall={card.overall}
                      rarity={card.rarity}
                      cosmeticSeed={card.cosmeticSeed}
                      compact
                    />
                    <p className="font-score mt-1.5 px-1 text-[11px] text-chalk-dim">
                      {card.wins ?? 0}W–{card.losses ?? 0}L
                      {(card.timesMvp ?? 0) > 0 && (
                        <span className="text-gold-bright">
                          {" "}
                          · {card.timesMvp}× MVP
                        </span>
                      )}
                    </p>
                  </button>
                ))}
              </div>

              {visibleCount < filteredSorted.length && (
                <div className="mt-8 text-center">
                  <button
                    onClick={() =>
                      setVisibleCount((n) => n + PAGE_SIZE)
                    }
                    className="btn-chalk rounded-lg px-6 py-2.5"
                  >
                    Show more
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
            onClick={() => setSelected(null)}
          >
            <motion.div
              initial={{ y: 24 }}
              animate={{ y: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="panel flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl sm:flex-row"
            >
              <CardImage hotel={selected.hotel} cosmeticSeed={selected.cosmeticSeed} />

              <div className="flex-1 overflow-y-auto p-6 sm:min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-display text-lg text-chalk">
                    {selected.hotel.name}
                  </h3>
                  <p className="text-xs text-chalk-dim">
                    {selected.hotel.address}
                  </p>
                </div>
                <CountryFlag hotel={selected.hotel} />
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-chalk-dim">
                <span className="font-score rounded-full bg-pitch-950/60 px-2.5 py-0.5 uppercase text-card-primary">
                  {RARITY_LABEL[selected.rarity]}
                </span>
                {selected.hotel.countryName && (
                  <span>{selected.hotel.countryName}</span>
                )}
                {selected.hotel.propertyType && (
                  <span>· {selected.hotel.propertyType}</span>
                )}
              </div>

              <div className="mt-4 rounded-lg bg-pitch-950/60 p-4 text-sm">
                {live.loading ? (
                  <p className="text-chalk-dim">Checking live availability…</p>
                ) : live.available && live.hotel ? (
                  <>
                    <p className="eyebrow !text-[9px]">Live right now</p>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="font-score text-2xl text-chalk">
                        {live.hotel.nightlyPrice !== null
                          ? `$${live.hotel.nightlyPrice}/night`
                          : "Price at booking"}
                      </span>
                      <span className="text-xs text-chalk-dim">
                        {live.hotel.freeCancellation
                          ? "free cancellation"
                          : "standard policy"}{" "}
                        · {live.hotel.supplierCount ?? 1} suppliers
                      </span>
                    </div>
                    {live.hotel.bookingUrl && (
                      <a
                        href={live.hotel.bookingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-primary mt-3 block rounded-lg px-4 py-2.5 text-center"
                      >
                        Book this stay →
                      </a>
                    )}
                  </>
                ) : (
                  <>
                    <p className="font-display text-sm text-whistle">
                      Transfer pending
                    </p>
                    <p className="mt-1 text-xs text-chalk-dim">
                      This property isn&apos;t currently available for its
                      original dates. The card stays in your collection.
                    </p>
                  </>
                )}
              </div>

              <QualityRow hotel={selected.hotel} />
              <RoomsRow hotel={selected.hotel} />

              <div className="mt-4">
                <div className="flex items-baseline justify-between">
                  <p className="eyebrow !text-[9px]">Card stats</p>
                  <p className="font-score text-sm text-card-primary">
                    {selected.overall} OVR
                  </p>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {STAT_META.map((meta) => (
                    <div
                      key={meta.key}
                      className="flex items-center justify-between rounded-lg bg-pitch-950/60 px-3 py-1.5"
                    >
                      <span className="text-xs uppercase text-chalk-dim">
                        {meta.label}
                      </span>
                      <span
                        className="font-score text-sm font-bold"
                        style={{ color: meta.color }}
                      >
                        {selected.stats[meta.key]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <Stat
                  label="Record"
                  value={`${selected.wins ?? 0}W–${selected.losses ?? 0}L`}
                />
                <Stat label="Card XP" value={String(selected.xp ?? 0)} />
                <Stat label="Trophies" value={String(selected.trophies ?? 0)} />
              </div>

              <button
                onClick={() => setSelected(null)}
                className="btn-chalk mt-4 w-full rounded-lg px-4 py-2"
              >
                Close
              </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Left-hand image panel. Shows the real accommodation photo when the snapshot
// has one; otherwise falls back to the card's seeded generated art so it always
// looks intentional (thumbnailUrl is null in offline/mock mode).
function CardImage({
  hotel,
  cosmeticSeed,
}: {
  hotel: NormalizedAccommodation;
  cosmeticSeed: string;
}) {
  const hasPhoto = Boolean(hotel.thumbnailUrl);
  return (
    <div
      className="relative h-48 w-full shrink-0 bg-cover bg-center sm:h-auto sm:w-2/5"
      style={artStyle(hotel, cosmeticSeed)}
      aria-label={
        hasPhoto ? `Photo of ${hotel.name ?? "the accommodation"}` : undefined
      }
      role={hasPhoto ? "img" : undefined}
    >
      {!hasPhoto && (
        <div className="hotel-art-skyline" aria-hidden>
          <span className="building building-a" />
          <span className="building building-b" />
          <span className="building building-c" />
          <span className="building building-d" />
        </div>
      )}
    </div>
  );
}

function CountryFlag({ hotel }: { hotel: NormalizedAccommodation }) {
  const flag = resolveHotelFlag(hotel);
  if (!flag) return null;
  return (
    <Image
      src={flag.src}
      alt={flag.alt}
      width={32}
      height={21}
      unoptimized
      className="mt-1 shrink-0 rounded-sm"
    />
  );
}

// Guest rating / stars / reviews. Renders nothing if no signals are present.
function QualityRow({ hotel }: { hotel: NormalizedAccommodation }) {
  const cells: { label: string; value: string }[] = [];
  if (hotel.guestRating !== null) {
    cells.push({ label: "Guest rating", value: `${hotel.guestRating}/10` });
  }
  if (hotel.stars !== null) {
    cells.push({ label: "Stars", value: "★".repeat(Math.round(hotel.stars)) });
  }
  if (hotel.reviewCount !== null) {
    cells.push({
      label: "Reviews",
      value: hotel.reviewCount.toLocaleString(),
    });
  }
  if (cells.length === 0) return null;
  return (
    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
      {cells.map((c) => (
        <Stat key={c.label} label={c.label} value={c.value} />
      ))}
    </div>
  );
}

// Rooms & capacity. Renders nothing if no details are present.
function RoomsRow({ hotel }: { hotel: NormalizedAccommodation }) {
  const cells: { label: string; value: string }[] = [];
  if (hotel.capacity !== null) {
    cells.push({ label: "Sleeps", value: String(hotel.capacity) });
  }
  if (hotel.bedrooms !== null) {
    cells.push({ label: "Bedrooms", value: String(hotel.bedrooms) });
  }
  if (hotel.beds !== null) {
    cells.push({ label: "Beds", value: String(hotel.beds) });
  }
  if (hotel.bathrooms !== null) {
    cells.push({ label: "Baths", value: String(hotel.bathrooms) });
  }
  if (cells.length === 0) return null;
  return (
    <div className="mt-2 grid grid-cols-4 gap-2 text-center">
      {cells.map((c) => (
        <Stat key={c.label} label={c.label} value={c.value} />
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-pitch-950/60 p-2">
      <p className="eyebrow !text-[8px]">{label}</p>
      <p className="font-score text-lg text-chalk">{value}</p>
    </div>
  );
}

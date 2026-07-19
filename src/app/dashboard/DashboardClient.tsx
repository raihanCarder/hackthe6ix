"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HotelCard, STAT_META } from "@/components/HotelCard";
import type { CardPayload } from "@/components/types";
import { useCurrentUser } from "@/lib/useCurrentUser";

function addDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
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

function priceLabel(price: number | null): string {
  return price !== null ? `$${price}/night` : "Price at booking";
}

export function DashboardClient() {
  const router = useRouter();
  const { profile, authMode, loaded } = useCurrentUser();
  const [cards, setCards] = useState<CardPayload[] | null>(null);
  const today = new Date();
  const [quickTrip, setQuickTrip] = useState({
    destination: "",
    checkin: addDays(today, 21),
    checkout: addDays(today, 24),
  });

  useEffect(() => {
    if (!loaded) return;
    if (authMode === "auth0" && !profile) {
      window.location.assign(
        `/auth/login?returnTo=${encodeURIComponent("/dashboard")}`,
      );
    }
  }, [loaded, authMode, profile]);

  useEffect(() => {
    if (!profile) return;
    fetch("/api/cards")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { cards: CardPayload[] } | null) =>
        setCards(data?.cards ?? []),
      )
      .catch(() => setCards([]));
  }, [profile]);

  function mintQuickTrip(event: React.FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams({
      destination: quickTrip.destination,
      checkin: quickTrip.checkin,
      checkout: quickTrip.checkout,
    });
    router.push(`/packs?${params.toString()}`);
  }

  if (!loaded) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-14 text-center text-chalk-dim sm:px-6">
        Loading dashboard…
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <p className="font-display text-xl text-chalk">
          Sign in to see your dashboard.
        </p>
        <p className="mt-2 text-sm text-chalk-dim">
          Use the sign in button in the sidebar to get started.
        </p>
      </div>
    );
  }

  const bestCard =
    cards && cards.length > 0
      ? [...cards].sort((a, b) => b.overall - a.overall)[0]
      : null;
  const bookableValue =
    cards?.reduce((sum, c) => sum + (c.hotel.nightlyPrice ?? 0), 0) ?? null;
  const scoreBoard = cards
    ? [...cards].sort((a, b) => b.overall - a.overall).slice(0, 8)
    : [];
  const maxScore =
    scoreBoard.length > 0 ? Math.max(...scoreBoard.map((c) => c.overall)) : 1;

  const tiles = [
    {
      label: "Cards owned",
      value: cards === null ? "…" : String(cards.length),
    },
    { label: "Best pull", value: bestCard ? String(bestCard.overall) : "—" },
    { label: "Packs opened", value: String(profile.packsOpened) },
    {
      label: "Bookable value",
      value:
        bookableValue !== null ? `$${bookableValue.toLocaleString()}` : "—",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-12">
      <h1 className="font-display mt-2 max-w-4xl text-2xl text-chalk sm:text-3xl">
        Check-in Champions Dashboard
      </h1>

      <div className="mt-7 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="panel stat-tile">
            <p className="eyebrow !text-[9px]">{tile.label}</p>
            <p className="font-score mt-1 text-2xl text-chalk sm:text-3xl">
              {tile.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-7 grid gap-5 lg:grid-cols-2">
        <div className="panel rounded-xl p-6">
          <h2 className="font-display text-sm text-chalk">Quick trip pack</h2>
          <form
            onSubmit={mintQuickTrip}
            className="mt-5 grid gap-5 sm:grid-cols-2"
          >
            <label className="sm:col-span-2">
              <span className="eyebrow">Destination</span>
              <input
                required
                minLength={2}
                value={quickTrip.destination}
                onChange={(e) =>
                  setQuickTrip({ ...quickTrip, destination: e.target.value })
                }
                placeholder="Toronto, Montréal, Tokyo…"
                className="mt-1 input-field"
              />
            </label>
            <label>
              <span className="eyebrow">Check-in</span>
              <input
                type="date"
                value={quickTrip.checkin}
                onChange={(e) =>
                  setQuickTrip({ ...quickTrip, checkin: e.target.value })
                }
                className="mt-1 input-field"
              />
            </label>
            <label>
              <span className="eyebrow">Check-out</span>
              <input
                type="date"
                value={quickTrip.checkout}
                onChange={(e) =>
                  setQuickTrip({ ...quickTrip, checkout: e.target.value })
                }
                className="mt-1 input-field"
              />
            </label>
            <button
              type="submit"
              className="btn-primary mt-1 w-full rounded-lg px-4 py-3 text-sm sm:col-span-2"
            >
              Mint trip pack
            </button>
          </form>
        </div>

        <div className="panel rounded-xl p-6">
          <h2 className="font-display text-sm text-chalk">
            Top pull from your collection
          </h2>
          {bestCard ? (
            <div className="mt-4 flex gap-5">
              <div className="w-32 shrink-0 sm:w-36 lg:w-40">
                <HotelCard
                  hotel={bestCard.hotel}
                  stats={bestCard.stats}
                  overall={bestCard.overall}
                  rarity={bestCard.rarity}
                  cosmeticSeed={bestCard.cosmeticSeed}
                  compact
                />
              </div>
              <div className="flex flex-1 flex-col">
                <div>
                  <p className="font-display text-lg leading-tight text-chalk">
                    {bestCard.hotel.name ?? "Top card"}
                  </p>
                  <p className="mt-1 truncate text-sm text-chalk-dim">
                    {compactLocation(bestCard.hotel.address)}
                  </p>
                  <p className="mt-1 font-score text-sm font-bold text-card-primary">
                    {priceLabel(bestCard.hotel.nightlyPrice)}
                  </p>
                </div>
                <div className="mt-auto pt-4">
                  <p className="eyebrow mb-2 !text-[9px]">Stats</p>
                  <div className="space-y-2">
                    {STAT_META.map(({ key, label, color }) => (
                      <div
                        key={key}
                        className="flex items-center gap-2 text-xs"
                      >
                        <span className="w-20 shrink-0 text-chalk-dim">
                          {label}
                        </span>
                        <div className="stat-bar h-2 flex-1 overflow-hidden rounded-full">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${bestCard.stats[key]}%`,
                              background: color,
                            }}
                          />
                        </div>
                        <span className="font-score w-6 text-right text-chalk">
                          {bestCard.stats[key]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-chalk-dim">
              No cards yet — kick off a trip to mint your first pack.
            </p>
          )}
        </div>
      </div>

      {scoreBoard.length > 0 && (
        <div className="panel mt-5 rounded-xl p-6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-sm text-chalk">
                Your Top 8 Cards
              </h2>
              <p className="mt-1 text-xs text-chalk-dim">
                Buy packs to get more cards!
              </p>
            </div>
            <span className="eyebrow hidden !text-[9px] sm:block">OVR</span>
          </div>
          <div className="mt-4 space-y-3">
            {scoreBoard.map((card) => (
              <div
                key={card.id}
                className="grid grid-cols-[minmax(0,12rem)_1fr_2rem] items-center gap-3 text-xs sm:grid-cols-[minmax(0,18rem)_1fr_2rem]"
              >
                <span className="truncate text-chalk-dim">
                  {card.hotel.name}
                </span>
                <div className="stat-bar h-2.5 overflow-hidden rounded-full">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(card.overall / maxScore) * 100}%`,
                      background: "var(--cyan-bright)",
                    }}
                  />
                </div>
                <span className="font-score w-6 text-right text-chalk">
                  {card.overall}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

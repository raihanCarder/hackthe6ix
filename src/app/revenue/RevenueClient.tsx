"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CardPayload } from "@/components/types";
import { useCurrentUser } from "@/lib/useCurrentUser";

export function RevenueClient() {
  const { profile, authMode, loaded } = useCurrentUser();
  const [cards, setCards] = useState<CardPayload[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded) return;
    if (authMode === "auth0" && !profile) {
      window.location.assign(`/auth/login?returnTo=${encodeURIComponent("/revenue")}`);
    }
  }, [loaded, authMode, profile]);

  useEffect(() => {
    if (!profile) return;
    fetch("/api/cards")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Could not load your collection");
        setCards(data.cards);
      })
      .catch((e) => setError(e.message));
  }, [profile]);

  if (!loaded) {
    return <div className="mx-auto max-w-4xl px-4 py-14 text-center text-chalk-dim sm:px-6">Loading revenue…</div>;
  }
  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <p className="font-display text-xl text-chalk">Sign in to see bookable value.</p>
      </div>
    );
  }
  if (error) {
    return <div className="mx-auto max-w-2xl px-4 py-20 text-center text-chalk-dim sm:px-6">{error}</div>;
  }

  const priced = (cards ?? []).filter((c) => c.hotel.nightlyPrice !== null);
  const totalNightly = priced.reduce((sum, c) => sum + (c.hotel.nightlyPrice ?? 0), 0);
  const avgNightly = priced.length > 0 ? Math.round(totalNightly / priced.length) : null;
  const ranked = [...(cards ?? [])].sort(
    (a, b) => (b.hotel.nightlyPrice ?? -1) - (a.hotel.nightlyPrice ?? -1),
  );

  const tiles = [
    { label: "Bookable value / night", value: `$${totalNightly.toLocaleString()}` },
    { label: "Avg. nightly price", value: avgNightly !== null ? `$${avgNightly}` : "—" },
    { label: "Live-priced cards", value: `${priced.length} / ${cards?.length ?? 0}` },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <p className="eyebrow">Revenue</p>
      <h1 className="font-display mt-2 text-3xl text-chalk">Bookable value</h1>
      <p className="mt-2 max-w-xl text-sm text-chalk-dim">
        The real nightly value sitting in your collection, straight from each card&apos;s live
        Stay22 price — no fabricated commission math, just what the data supports.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {tiles.map((tile) => (
          <div key={tile.label} className="panel stat-tile">
            <p className="eyebrow !text-[9px]">{tile.label}</p>
            <p className="font-score mt-1 text-2xl text-chalk sm:text-3xl">{tile.value}</p>
          </div>
        ))}
      </div>

      {cards === null ? (
        <p className="mt-8 text-chalk-dim">Loading your cards…</p>
      ) : cards.length === 0 ? (
        <div className="panel mt-8 rounded-xl p-10 text-center">
          <p className="font-display text-lg text-chalk">No cards yet.</p>
          <p className="mt-2 text-sm text-chalk-dim">Kick off a trip to start building bookable value.</p>
          <Link href="/packs" className="btn-primary mt-5 inline-block rounded-lg px-6 py-2.5">
            Kick off a trip
          </Link>
        </div>
      ) : (
        <div className="panel mt-6 rounded-xl p-5">
          <h2 className="font-display text-sm text-chalk">Per-card breakdown</h2>
          <div className="mt-3 divide-y divide-chalk/10">
            {ranked.map((card) => (
              <div key={card.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate text-chalk">{card.hotel.name}</span>
                <span className="font-score shrink-0 text-chalk-dim">
                  {card.hotel.nightlyPrice !== null ? `$${card.hotel.nightlyPrice}/night` : "no live price"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

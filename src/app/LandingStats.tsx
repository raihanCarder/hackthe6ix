"use client";

import { useEffect, useState } from "react";
import type { CardPayload } from "@/components/types";
import { useCurrentUser } from "@/lib/useCurrentUser";

export function LandingStats() {
  const { profile, loaded } = useCurrentUser();
  const [cards, setCards] = useState<CardPayload[] | null>(null);

  useEffect(() => {
    if (!profile) return;
    fetch("/api/cards")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { cards: CardPayload[] } | null) => setCards(data?.cards ?? []))
      .catch(() => setCards([]));
  }, [profile]);

  if (!loaded || !profile) {
    return (
      <p className="mt-8 text-xs text-chalk-dim">
        Sign in to see your live collection stats — best pull, bookable value, and more.
      </p>
    );
  }

  const bestPull = cards && cards.length > 0 ? Math.max(...cards.map((c) => c.overall)) : null;
  const bookableValue =
    cards?.reduce((sum, c) => sum + (c.hotel.nightlyPrice ?? 0), 0) ?? null;

  const tiles = [
    { label: "Cards owned", value: cards === null ? "…" : String(cards.length) },
    { label: "Best pull", value: bestPull === null ? "—" : String(bestPull) },
    {
      label: "Bookable value",
      value: bookableValue === null ? "—" : `$${bookableValue.toLocaleString()}`,
    },
  ];

  return (
    <div className="mt-8 grid grid-cols-3 gap-3">
      {tiles.map((tile) => (
        <div key={tile.label} className="panel stat-tile">
          <p className="eyebrow !text-[9px]">{tile.label}</p>
          <p className="font-score mt-1 text-2xl text-chalk">{tile.value}</p>
        </div>
      ))}
    </div>
  );
}

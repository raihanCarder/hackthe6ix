"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CardBack, HotelCard } from "@/components/HotelCard";
import type { CardPayload } from "@/components/types";

interface PackPayload {
  packId: string;
  searchId: string;
  scope: "trip" | "global";
  city: string;
  cost: number;
  cards: CardPayload[];
  trip: { destinationLabel: string; checkin: string; checkout: string };
}

export default function PackPage() {
  const { id } = useParams<{ id: string }>();
  const [pack, setPack] = useState<PackPayload | null>(null);
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/packs/${id}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Pack not found");
        setPack(data);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  const allFlipped = pack !== null && flipped.size >= pack.cards.length;

  function flip(index: number) {
    setFlipped((prev) => new Set(prev).add(index));
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <p className="font-display text-xl text-chalk">{error}</p>
      </div>
    );
  }
  if (!pack) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center text-chalk-dim">
        Unwrapping the pack…
      </div>
    );
  }

  const packLabel = pack.scope === "global" ? "Global pack" : "Trip pack";

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="eyebrow">
        {packLabel} · {pack.trip.destinationLabel} · {pack.trip.checkin} → {pack.trip.checkout}
      </p>
      <h1 className="font-display mt-2 text-3xl text-chalk">
        {allFlipped ? "Your squad is in." : "Tap to reveal your signings"}
      </h1>
      <p className="mt-1 text-sm text-chalk-dim">
        Every card is a real property, bookable for these dates.
        {pack.cost > 0 ? ` Pack cost: ${pack.cost} coins.` : " First pack in this city — free."}
      </p>

      <div className="hotel-card-grid mt-8">
        {pack.cards.map((card, index) => (
          <motion.button
            key={card.id}
            onClick={() => flip(index)}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.12, type: "spring", stiffness: 120 }}
            className="relative text-left transition hover:-translate-y-1"
            style={{ perspective: 1200 }}
            aria-label={flipped.has(index) ? card.hotel.name ?? "card" : "Reveal card"}
          >
            <motion.div
              animate={{ rotateY: flipped.has(index) ? 180 : 0 }}
              transition={{ duration: 0.6, type: "spring", stiffness: 140, damping: 16 }}
              style={{ transformStyle: "preserve-3d" }}
              className="relative"
            >
              <div style={{ backfaceVisibility: "hidden" }}>
                <CardBack />
              </div>
              <div
                className="absolute inset-0"
                style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
              >
                <HotelCard
                  hotel={card.hotel}
                  stats={card.stats}
                  overall={card.overall}
                  rarity={card.rarity}
                  cosmeticSeed={card.cosmeticSeed}
                  compact
                />
              </div>
            </motion.div>
          </motion.button>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        {!allFlipped && (
          <button
            onClick={() => setFlipped(new Set(pack.cards.map((_, i) => i)))}
            className="btn-chalk rounded-lg px-5 py-2.5"
          >
            Reveal all
          </button>
        )}
        {allFlipped && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-wrap gap-3"
          >
            <Link href="/collection" className="btn-chalk rounded-lg px-6 py-3">
              View collection
            </Link>
            <Link href="/play" className="btn-gold rounded-lg px-8 py-3 text-lg">
              Play a match
            </Link>
          </motion.div>
        )}
      </div>
    </div>
  );
}

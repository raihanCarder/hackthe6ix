"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CardBack, HotelCard } from "@/components/HotelCard";
import { usePresentation } from "@/components/PresentationCommentary";
import type { CardPayload } from "@/components/types";
import { useCurrentUser } from "@/lib/useCurrentUser";

interface PackPayload {
  packId: string;
  searchId: string;
  scope: "trip" | "global";
  city: string;
  cost: number;
  repeatPackCost: number;
  cards: CardPayload[];
  trip: { destinationLabel: string; checkin: string; checkout: string };
}

export default function PackPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const foundCount = searchParams.get("found");
  const totalCount = searchParams.get("total");
  const { announce } = usePresentation();
  const { loaded, profile, refresh } = useCurrentUser();
  const [pack, setPack] = useState<PackPayload | null>(null);
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [buyingAgain, setBuyingAgain] = useState(false);
  const [repeatError, setRepeatError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/packs/${id}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Pack not found");
        setPack(data);
        setFlipped(new Set());
        setError(null);
        setRepeatError(null);
        setBuyingAgain(false);
        announce({ source: "journey", cue: { kind: "journey.moment", moment: "pack.opening" } });
      })
      .catch((e) => setError(e.message));
  }, [announce, id]);

  const allFlipped = pack !== null && flipped.size >= pack.cards.length;

  function flip(index: number) {
    if (flipped.has(index) || !pack) return;
    const moment = flipped.size + 1 >= pack.cards.length ? "pack.complete" : "pack.reveal";
    announce({ source: "journey", cue: { kind: "journey.moment", moment } });
    setFlipped((prev) => new Set(prev).add(index));
  }

  function revealAll() {
    if (!pack) return;
    announce({ source: "journey", cue: { kind: "journey.moment", moment: "pack.complete" } });
    setFlipped(new Set(pack.cards.map((_, index) => index)));
  }

  async function buyAnotherPack() {
    if (!pack) return;
    setBuyingAgain(true);
    setRepeatError(null);
    announce({ source: "journey", cue: { kind: "journey.moment", moment: "pack.opening" } });

    try {
      const response = await fetch(`/api/packs/${pack.packId}/repeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Pack opening failed");
      void refresh();
      setPack(null);
      setFlipped(new Set());
      router.push(`/pack/${data.packId}`);
    } catch (caught) {
      setRepeatError(caught instanceof Error ? caught.message : "Pack opening failed");
      setBuyingAgain(false);
    }
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
  const repeatLabel = pack.scope === "global" ? "Buy another Global Pack" : "Buy another Trip Pack";
  const canBuyAnother = loaded && profile !== null && profile.currency >= pack.repeatPackCost;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <p className="eyebrow">
        {packLabel} · {pack.trip.destinationLabel} · {pack.trip.checkin} → {pack.trip.checkout}
      </p>
      <h1 className="font-display mt-2 text-3xl text-chalk">
        {allFlipped ? "Your trip pack is live." : "Tap to reveal your cards"}
      </h1>
      <p className="mt-1 text-sm text-chalk-dim">
        Every card is a real property, bookable for these dates.
        {pack.cost > 0 ? ` Pack cost: ${pack.cost} coins.` : " First pack in this city — free."}
        {foundCount ? ` Drawn from ${foundCount} bookable contenders${totalCount ? ` of ${totalCount} found` : ""}.` : ""}
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
            onClick={revealAll}
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
            <Link href="/pack-history" className="btn-chalk rounded-lg px-6 py-3">
              Back to Pack History
            </Link>
            <Link href="/collection" className="btn-chalk rounded-lg px-6 py-3">
              View collection
            </Link>
            <Link href="/play" className="btn-primary rounded-lg px-8 py-3 text-lg">
              Play a match
            </Link>
            {canBuyAnother && (
              <button
                type="button"
                onClick={buyAnotherPack}
                disabled={buyingAgain}
                className={`${pack.scope === "global" ? "btn-gold" : "btn-primary"} rounded-lg px-6 py-3 text-lg disabled:opacity-60`}
              >
                {buyingAgain ? "Opening..." : repeatLabel}
              </button>
            )}
          </motion.div>
        )}
        {repeatError && (
          <div className="w-full rounded-lg border border-whistle/50 bg-whistle/10 px-4 py-3 text-sm text-chalk">
            {repeatError}
          </div>
        )}
      </div>
    </div>
  );
}

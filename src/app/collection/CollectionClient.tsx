"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import { HotelCard } from "@/components/HotelCard";
import type { CardPayload } from "@/components/types";
import type { NormalizedAccommodation } from "@/lib/engine/types";

export function CollectionClient() {
  const [cards, setCards] = useState<CardPayload[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CardPayload | null>(null);
  const [live, setLive] = useState<{ loading: boolean; available?: boolean; hotel?: NormalizedAccommodation }>({ loading: false });

  useEffect(() => {
    let cancelled = false;

    fetch("/api/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { user: unknown | null; authMode: "auth0" | "dev" } | null) => {
        if (!cancelled && data?.authMode === "auth0" && !data.user) {
          window.location.assign(`/auth/login?returnTo=${encodeURIComponent("/collection")}`);
        }
      });

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
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="eyebrow">Clubhouse</p>
      <h1 className="font-display mt-2 text-3xl text-chalk">Your collection</h1>

      {cards === null ? (
        <p className="mt-8 text-chalk-dim">Polishing the trophy cabinet…</p>
      ) : cards.length === 0 ? (
        <div className="panel mt-8 rounded-xl p-10 text-center">
          <p className="font-display text-lg text-chalk">No signings yet.</p>
          <p className="mt-2 text-sm text-chalk-dim">
            Open your first Trip Pack — the first one in every city is free.
          </p>
          <Link href="/packs" className="btn-gold mt-5 inline-block rounded-lg px-6 py-2.5">
            Open a pack
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {cards.map((card) => (
            <button key={card.id} onClick={() => openCard(card)} className="text-left transition hover:-translate-y-1">
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
                {(card.timesMvp ?? 0) > 0 && <span className="text-gold-bright"> · {card.timesMvp}× MVP</span>}
              </p>
            </button>
          ))}
        </div>
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
              className="panel max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl p-6"
            >
              <h3 className="font-display text-lg text-chalk">{selected.hotel.name}</h3>
              <p className="text-xs text-chalk-dim">{selected.hotel.address}</p>

              <div className="mt-4 rounded-lg bg-pitch-950/60 p-4 text-sm">
                {live.loading ? (
                  <p className="text-chalk-dim">Checking live availability…</p>
                ) : live.available && live.hotel ? (
                  <>
                    <p className="eyebrow !text-[9px]">Live right now</p>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="font-score text-2xl text-chalk">
                        {live.hotel.nightlyPrice !== null ? `$${live.hotel.nightlyPrice}/night` : "Price at booking"}
                      </span>
                      <span className="text-xs text-chalk-dim">
                        {live.hotel.freeCancellation ? "free cancellation" : "standard policy"} ·{" "}
                        {live.hotel.supplierCount ?? 1} suppliers
                      </span>
                    </div>
                    {live.hotel.bookingUrl && (
                      <a
                        href={live.hotel.bookingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-gold mt-3 block rounded-lg px-4 py-2.5 text-center"
                      >
                        Book this stay →
                      </a>
                    )}
                  </>
                ) : (
                  <>
                    <p className="font-display text-sm text-whistle">Transfer pending</p>
                    <p className="mt-1 text-xs text-chalk-dim">
                      This property isn&apos;t currently available for its original dates. The card
                      stays in your collection.
                    </p>
                  </>
                )}
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <Stat label="Record" value={`${selected.wins ?? 0}W–${selected.losses ?? 0}L`} />
                <Stat label="Card XP" value={String(selected.xp ?? 0)} />
                <Stat label="Trophies" value={String(selected.trophies ?? 0)} />
              </div>

              <button onClick={() => setSelected(null)} className="btn-chalk mt-4 w-full rounded-lg px-4 py-2">
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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

"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { HotelCard } from "@/components/HotelCard";
import type { CardPayload } from "@/components/types";

const SQUAD_SIZE = 3;
const POLL_INTERVAL_MS = 2000;
type Step = "squad" | "waiting";

export function DuelClient() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("squad");
  const [cards, setCards] = useState<CardPayload[] | null>(null);
  const [squad, setSquad] = useState<string[]>([]);
  const [duelId, setDuelId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { user: unknown | null; authMode: "auth0" | "dev" } | null) => {
        if (!cancelled && data?.authMode === "auth0" && !data.user) {
          window.location.assign(`/auth/login?returnTo=${encodeURIComponent("/duel")}`);
        }
      });

    fetch("/api/cards")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Could not load your collection");
        if (!cancelled) setCards(data.cards);
      })
      .catch((e) => !cancelled && setError(e.message));

    return () => {
      cancelled = true;
    };
  }, []);

  // Waiting room: retry matchmaking (not just read status) so two waiting
  // rows created by a start-search race can still find each other.
  useEffect(() => {
    if (step !== "waiting" || !duelId) return;
    cancelledRef.current = false;

    async function checkStatus() {
      const response = await fetch("/api/duel/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardIds: squad }),
      });
      if (!response.ok || cancelledRef.current) return;
      const data = await response.json();
      if (data.matched && !cancelledRef.current) {
        router.push(`/duel/${data.duelId}`);
      }
    }

    checkStatus();
    const interval = setInterval(checkStatus, POLL_INTERVAL_MS);
    return () => {
      cancelledRef.current = true;
      clearInterval(interval);
    };
  }, [step, duelId, squad, router]);

  function toggleCard(id: string) {
    setSquad((prev) => {
      if (prev.includes(id)) return prev.filter((c) => c !== id);
      if (prev.length >= SQUAD_SIZE) return prev;
      return [...prev, id];
    });
  }

  async function startMatch() {
    if (squad.length !== SQUAD_SIZE) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/duel/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardIds: squad }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not start a match");
      if (data.matched) {
        router.push(`/duel/${data.duelId}`);
        return;
      }
      setDuelId(data.duelId);
      setStep("waiting");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start a match");
    } finally {
      setBusy(false);
    }
  }

  async function cancelWaiting() {
    if (!duelId) return;
    setBusy(true);
    try {
      await fetch(`/api/duel/${duelId}/cancel`, { method: "POST" });
    } finally {
      setDuelId(null);
      setStep("squad");
      setBusy(false);
    }
  }

  if (step === "waiting") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="panel rounded-2xl p-10 text-center"
        >
          <p className="eyebrow">Waiting room</p>
          <h1 className="font-display mt-3 text-2xl text-chalk">Looking for an opponent…</h1>
          <p className="mt-2 text-sm text-chalk-dim">
            You will jump straight into the duel the moment someone else starts a match.
          </p>
          <div className="mx-auto mt-6 h-10 w-10 animate-spin rounded-full border-2 border-cyan-bright border-t-transparent" />
          <button
            onClick={cancelWaiting}
            disabled={busy}
            className="btn-chalk mt-8 rounded-lg px-6 py-2.5 disabled:opacity-40"
          >
            Cancel
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="eyebrow">1v1 duel · squad selection</p>
      <h1 className="font-display mt-2 text-3xl text-chalk">Pick your 3-card squad</h1>
      <p className="mt-2 text-sm text-chalk-dim">
        Each round you or your opponent calls a stat on your next card — best of 3 rounds takes
        the duel. Pick your cards in the order you want to play them.
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-whistle/50 bg-whistle/10 px-4 py-3 text-sm text-chalk">
          {error}
        </div>
      )}

      {cards === null ? (
        <p className="mt-8 text-chalk-dim">Loading your collection…</p>
      ) : cards.length === 0 ? (
        <div className="panel mt-8 rounded-xl p-10 text-center">
          <p className="font-display text-lg text-chalk">No cards yet.</p>
          <p className="mt-2 text-sm text-chalk-dim">Open a pack to build your squad first.</p>
          <Link href="/packs" className="btn-primary mt-5 inline-block rounded-lg px-6 py-2.5">
            Open a pack
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {cards.map((card) => {
              const order = squad.indexOf(card.id);
              const isSelected = order !== -1;
              return (
                <button
                  key={card.id}
                  onClick={() => toggleCard(card.id)}
                  className={`relative rounded-xl text-left transition ${
                    isSelected ? "ring-2 ring-cyan-bright" : "hover:-translate-y-1"
                  }`}
                >
                  {isSelected && (
                    <span className="font-score absolute -left-2 -top-2 z-30 flex h-7 w-7 items-center justify-center rounded-full bg-cyan-bright text-sm font-semibold text-black">
                      {order + 1}
                    </span>
                  )}
                  <HotelCard
                    hotel={card.hotel}
                    stats={card.stats}
                    overall={card.overall}
                    rarity={card.rarity}
                    cosmeticSeed={card.cosmeticSeed}
                    compact
                  />
                </button>
              );
            })}
          </div>

          <button
            onClick={startMatch}
            disabled={squad.length !== SQUAD_SIZE || busy}
            className="btn-primary mt-6 w-full rounded-lg px-6 py-3 text-lg disabled:opacity-40"
          >
            {squad.length === SQUAD_SIZE
              ? "Start Match"
              : `Select ${SQUAD_SIZE - squad.length} more card${
                  SQUAD_SIZE - squad.length === 1 ? "" : "s"
                }`}
          </button>
        </>
      )}
    </div>
  );
}

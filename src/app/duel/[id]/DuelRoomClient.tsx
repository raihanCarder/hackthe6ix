"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CardBack, HotelCard, STAT_META } from "@/components/HotelCard";
import type { CardStats, Rarity } from "@/lib/game/cardStats";
import type { NormalizedAccommodation } from "@/lib/engine/types";
import { useCurrentUser } from "@/lib/useCurrentUser";

const POLL_INTERVAL_MS = 2000;

interface DuelCardView {
  id: string;
  hotel: NormalizedAccommodation;
  stats: CardStats;
  overall: number;
  rarity: Rarity;
  cosmeticSeed: string;
}

interface DuelRoundView {
  round: number;
  stat: keyof CardStats;
  myValue: number;
  opponentValue: number;
  myCardId: string;
  opponentCardId: string;
  iWon: boolean;
  tieBroken: boolean;
}

interface DuelRewardsView {
  userXp: number;
  userCurrency: number;
  userWon: boolean;
}

interface DuelView {
  id: string;
  status: "waiting" | "active" | "complete";
  isPlayer1: boolean;
  myUsername?: string;
  opponent: { id: string; username?: string } | null;
  myCardIds: string[];
  opponentCardCount: number;
  isMyTurn: boolean;
  myWins: number;
  opponentWins: number;
  winnerId: string | null;
  iWon: boolean | null;
  rounds: DuelRoundView[];
  cards: Record<string, DuelCardView>;
  rewards: DuelRewardsView | null;
}

export function DuelRoomClient({ duelId }: { duelId: string }) {
  const [view, setView] = useState<DuelView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [calling, setCalling] = useState(false);
  const { refresh } = useCurrentUser();
  const rewardedRef = useRef(false);

  useEffect(() => {
    if (view?.status === "complete" && view.rewards && !rewardedRef.current) {
      rewardedRef.current = true;
      void refresh();
    }
  }, [view, refresh]);

  const refetch = useCallback(async () => {
    const response = await fetch(`/api/duel/${duelId}`);
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Could not load this duel");
      return;
    }
    setView(data);
  }, [duelId]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/duel/${duelId}`)
      .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (!ok) setError(data.error ?? "Could not load this duel");
        else setView(data);
      });
    const interval = setInterval(refetch, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [duelId, refetch]);

  async function call(stat: keyof CardStats) {
    setCalling(true);
    setError(null);
    try {
      const response = await fetch(`/api/duel/${duelId}/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stat }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not call that stat");
      setView(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not call that stat");
    } finally {
      setCalling(false);
    }
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <p className="font-display text-xl text-chalk">{error}</p>
        <Link href="/duel" className="btn-chalk mt-4 inline-block rounded-lg px-5 py-2.5">
          Back to squad selection
        </Link>
      </div>
    );
  }

  if (!view) {
    return <div className="mx-auto max-w-2xl px-4 py-20 text-center text-chalk-dim">Loading duel…</div>;
  }

  const activeRoundIndex = view.rounds.length;
  const myActiveCardId = view.myCardIds[activeRoundIndex] ?? null;
  const myActiveCard = myActiveCardId ? view.cards[myActiveCardId] : null;
  const opponentLabel = view.opponent?.username ?? "Opponent";

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="eyebrow text-center">1v1 duel · best of 3</p>
      <h1 className="font-display mt-2 text-center text-3xl text-chalk">
        {view.myUsername ?? "You"} {view.myWins} — {view.opponentWins} {opponentLabel}
      </h1>

      {view.status === "complete" ? (
        <MatchComplete view={view} />
      ) : (
        <p className="mt-2 text-center text-sm text-chalk-dim">
          {view.status === "waiting"
            ? "Waiting for an opponent…"
            : view.isMyTurn
              ? "Your turn — call a stat on your active card"
              : `Waiting for ${opponentLabel} to call a stat…`}
        </p>
      )}

      <div className="mt-10 grid gap-8 md:grid-cols-2">
        <div>
          <p className="eyebrow mb-3">Your squad</p>
          <div className="grid grid-cols-3 gap-3">
            {view.myCardIds.map((cardId, index) => {
              const card = view.cards[cardId];
              const played = index < activeRoundIndex;
              const active = index === activeRoundIndex;
              if (!card) return <CardBack key={cardId} />;
              return (
                <div
                  key={cardId}
                  className={`rounded-xl transition ${active ? "ring-2 ring-cyan-bright" : ""} ${
                    played ? "opacity-50" : ""
                  }`}
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
              );
            })}
          </div>
        </div>

        <div>
          <p className="eyebrow mb-3">{opponentLabel} squad</p>
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: view.opponentCardCount }).map((_, index) => {
              const round = view.rounds.find((r) => r.round === index);
              const card = round ? view.cards[round.opponentCardId] : null;
              if (!card) return <CardBack key={index} />;
              return (
                <div key={index} className={index < activeRoundIndex ? "opacity-50" : ""}>
                  <HotelCard
                    hotel={card.hotel}
                    stats={card.stats}
                    overall={card.overall}
                    rarity={card.rarity}
                    cosmeticSeed={card.cosmeticSeed}
                    compact
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {view.status === "active" && view.isMyTurn && myActiveCard && (
        <div className="panel mt-8 rounded-2xl p-6">
          <p className="font-display text-lg text-chalk">Call a stat on {myActiveCard.hotel.name}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {STAT_META.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => call(key)}
                disabled={calling}
                className="btn-chalk rounded-lg px-4 py-3 text-left disabled:opacity-40"
              >
                <span className="font-score block text-2xl text-chalk">
                  {myActiveCard.stats[key]}
                </span>
                <span className="stat-label">{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {view.rounds.length > 0 && (
        <div className="mt-8">
          <p className="eyebrow mb-3">Round history</p>
          <AnimatePresence initial={false}>
            {view.rounds.map((round) => (
              <motion.div
                key={round.round}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="panel mb-2 flex items-center justify-between rounded-lg px-4 py-2.5 text-sm"
              >
                <span className="text-chalk-dim">
                  Round {round.round + 1} ·{" "}
                  {STAT_META.find((s) => s.key === round.stat)?.label ?? round.stat}
                </span>
                <span className="text-chalk">
                  {round.myValue} – {round.opponentValue}
                </span>
                <span className={round.iWon ? "text-cyan-bright" : "text-whistle"}>
                  {round.iWon ? "Won" : "Lost"}
                  {round.tieBroken ? " (tiebreak)" : ""}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function MatchComplete({ view }: { view: DuelView }) {
  return (
    <div className="panel mt-6 rounded-2xl p-8 text-center">
      <p className="eyebrow">{view.iWon ? "Victory" : "Defeat"}</p>
      <h2 className="font-display mt-2 text-2xl text-chalk">
        {view.iWon ? "You won the duel!" : "You lost this duel."}
      </h2>
      {view.rewards && (
        <p className="mt-2 text-sm text-chalk-dim">
          +{view.rewards.userXp} XP · +{view.rewards.userCurrency} currency
        </p>
      )}
      <div className="mt-6 flex justify-center gap-3">
        <Link href="/duel" className="btn-primary rounded-lg px-6 py-2.5">
          Rematch
        </Link>
        <Link href="/collection" className="btn-chalk rounded-lg px-6 py-2.5">
          Back to collection
        </Link>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { TrophyLift } from "@/components/ChampionTrophy";
import { HotelCard } from "@/components/HotelCard";
import { useCurrentUser } from "@/lib/useCurrentUser";
import type { TournamentPayload } from "@/app/tournament/[id]/types";

function formattedDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

export function TournamentHistoryDetailClient() {
  const { id } = useParams<{ id: string }>();
  const { profile, authMode, loaded } = useCurrentUser();
  const [data, setData] = useState<TournamentPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded) return;
    if (authMode === "auth0" && !profile) {
      const returnTo = `/tournament-history/${id}`;
      window.location.assign(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
    }
  }, [authMode, id, loaded, profile]);

  useEffect(() => {
    if (!profile) return;
    fetch(`/api/tournaments/${id}`)
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Tournament not found");
        setData(payload);
      })
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : "Tournament not found"),
      );
  }, [id, profile]);

  const championCard = useMemo(
    () => data?.contenders.find((contender) => contender.propertyId === data.championId),
    [data],
  );

  if (!loaded || (profile && !data && !error)) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center text-chalk-dim sm:px-6">
        Loading tournament details…
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <p className="font-display text-xl text-chalk">Sign in to see this tournament.</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <p className="font-display text-xl text-chalk">{error ?? "Tournament not found"}</p>
        <Link href="/tournament-history" className="btn-chalk mt-5 inline-block rounded-lg px-5 py-2.5">
          Back to tournament history
        </Link>
      </div>
    );
  }

  const isWorld = data.mode === "world";
  const userWon = data.rewards.userWon;
  const winnerName = data.champion?.hotel.name ?? championCard?.hotel.name ?? "Champion";

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Link
        href="/tournament-history"
        className="text-sm text-chalk-dim transition hover:text-chalk"
      >
        ← Tournament history
      </Link>

      <header className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">
            {isWorld ? "Global Cup" : "Trip Cup"} · {formattedDate(data.createdAt)}
          </p>
          <h1 className="font-display mt-2 max-w-3xl text-3xl leading-tight text-chalk sm:text-4xl">
            {winnerName} lifted the cup
          </h1>
        </div>
        <span
          className={`w-fit rounded-full border px-3 py-1.5 font-score text-xs uppercase tracking-wide ${
            userWon
              ? "border-gold/60 bg-gold/15 text-gold-bright"
              : "border-chalk/15 bg-pitch-850 text-chalk-dim"
          }`}
        >
          {userWon ? "Your cup win" : "Tournament complete"}
        </span>
      </header>

      <section
        className={`mt-8 grid gap-8 rounded-2xl border p-5 sm:p-8 lg:grid-cols-[minmax(0,360px)_1fr] ${
          userWon
            ? "border-gold/45 bg-[radial-gradient(circle_at_18%_18%,rgba(255,210,94,0.14),transparent_36%),rgba(11,16,19,0.9)]"
            : "border-chalk/10 bg-pitch-850/80"
        }`}
      >
        <div className="mx-auto w-full max-w-[360px]">
          {championCard ? (
            <HotelCard
              hotel={championCard.hotel}
              stats={championCard.stats}
              overall={championCard.overall}
              rarity={championCard.rarity ?? "legendary"}
              cosmeticSeed={`history:${data.seed}`}
            />
          ) : (
            <div className="flex aspect-[3/4] items-center justify-center rounded-2xl border border-chalk/10 bg-pitch-950 text-sm text-chalk-dim">
              Champion card unavailable
            </div>
          )}
        </div>

        <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
          <p className="eyebrow text-gold-bright">Champion</p>
          <TrophyLift className="mt-4 w-28 [&_svg]:h-auto [&_svg]:w-full sm:w-36" />
          <h2 className="font-display mt-5 text-2xl text-chalk">{winnerName}</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-chalk-dim">
            {userWon
              ? `Your card won the ${isWorld ? "Global Cup" : "Trip Cup"} and earned ${data.rewards.userXp} XP plus ${data.rewards.userCurrency} coins.`
              : `The ${isWorld ? "Global Cup" : "Trip Cup"} finished with ${winnerName} as champion. Open the replay to revisit every match.`}
          </p>

          <div className="mt-7 flex flex-wrap justify-center gap-3 lg:justify-start">
            <Link href={`/tournament/${data.id}`} className="btn-gold rounded-lg px-6 py-3">
              Watch full replay →
            </Link>
            {data.champion?.hotel.bookingUrl ? (
              <a
                href={data.champion.hotel.bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary rounded-lg px-6 py-3"
              >
                Book the champion
              </a>
            ) : (
              <span className="btn-chalk cursor-not-allowed rounded-lg px-6 py-3 opacity-50">
                Booking unavailable
              </span>
            )}
            <Link href="/play" className="btn-chalk rounded-lg px-5 py-3">
              Play again
            </Link>
            <Link href="/packs" className="btn-chalk rounded-lg px-5 py-3">
              Open another pack
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

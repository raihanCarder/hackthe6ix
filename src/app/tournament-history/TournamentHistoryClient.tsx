"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TrophyLift } from "@/components/ChampionTrophy";
import { HotelCard } from "@/components/HotelCard";
import { useCurrentUser } from "@/lib/useCurrentUser";
import type { NormalizedAccommodation } from "@/lib/engine/types";
import type { CardStats, Rarity } from "@/lib/game/cardStats";

interface TournamentChampion {
  hotel: NormalizedAccommodation;
  stats: CardStats;
  overall: number;
  rarity: Rarity;
  cosmeticSeed: string;
}

interface TournamentHistoryItem {
  tournamentId: string;
  mode: "trip" | "world";
  createdAt: string;
  userWon: boolean;
  champion: TournamentChampion | null;
}

export function TournamentHistoryClient() {
  const { profile, authMode, loaded } = useCurrentUser();
  const [tournaments, setTournaments] = useState<TournamentHistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded) return;
    if (authMode === "auth0" && !profile) {
      window.location.assign(
        `/auth/login?returnTo=${encodeURIComponent("/tournament-history")}`,
      );
    }
  }, [loaded, authMode, profile]);

  useEffect(() => {
    if (!profile) return;
    fetch("/api/tournaments")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Could not load tournament history");
        setTournaments(data.tournaments);
      })
      .catch((e) => setError(e.message));
  }, [profile]);

  if (!loaded || (profile && tournaments === null && !error)) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-14 text-center text-chalk-dim sm:px-6">
        Loading Tournament History…
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <p className="font-display text-xl text-chalk">
          Sign in to see your Tournament History.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <p className="eyebrow">Tournament History</p>
      <h1 className="font-display mt-2 text-3xl text-chalk">
        Every cup you&apos;ve competed in.
      </h1>
      <p className="mt-2 text-sm text-chalk-dim">
        Relive who lifted the trophy, then book the champion or replay the full broadcast.
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-whistle/50 bg-whistle/10 px-4 py-3 text-sm text-chalk">
          {error}
        </div>
      )}

      {tournaments && tournaments.length === 0 ? (
        <div className="panel mt-8 rounded-xl p-10 text-center">
          <p className="font-display text-lg text-chalk">
            No tournaments played yet.
          </p>
          <p className="mt-2 text-sm text-chalk-dim">
            Enter a card into a Trip Cup or World Cup to get started.
          </p>
          <Link
            href="/play"
            className="btn-primary mt-5 inline-block rounded-lg px-6 py-2.5"
          >
            Enter a tournament
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-3">
          {tournaments?.map((tournament) => (
            <div
              key={tournament.tournamentId}
              className="panel flex flex-col gap-4 rounded-xl p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-end gap-4">
                {tournament.champion ? (
                  <>
                    <div className="w-24 shrink-0 sm:w-28">
                      <HotelCard
                        hotel={tournament.champion.hotel}
                        stats={tournament.champion.stats}
                        overall={tournament.champion.overall}
                        rarity={tournament.champion.rarity}
                        cosmeticSeed={tournament.champion.cosmeticSeed}
                        compact
                      />
                    </div>
                    <TrophyLift className="mb-2 w-16 shrink-0 sm:w-20 [&_svg]:h-auto [&_svg]:w-full" />
                  </>
                ) : (
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border border-chalk/10 text-center text-xs text-chalk-dim">
                    Champion unavailable
                  </div>
                )}
              </div>

              <div className="flex flex-1 flex-col gap-2">
                <div>
                  <p className="font-display text-sm text-chalk">
                    {tournament.mode === "world" ? "World Cup" : "Trip Cup"}
                  </p>
                  <p className="mt-0.5 text-xs text-chalk-dim">
                    {new Date(tournament.createdAt).toLocaleDateString()}
                  </p>
                  <p className="mt-1 text-xs">
                    {tournament.userWon ? (
                      <span className="text-gold-bright">Your card lifted the cup 🏆</span>
                    ) : (
                      <span className="text-chalk-dim">
                        {tournament.champion?.hotel.name ?? "Champion"} lifted the cup
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {tournament.champion?.hotel.bookingUrl ? (
                    <a
                      href={tournament.champion.hotel.bookingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary rounded-lg px-4 py-2 text-xs"
                    >
                      Book the champion
                    </a>
                  ) : (
                    <span className="btn-primary cursor-not-allowed rounded-lg px-4 py-2 text-xs opacity-50">
                      Booking link unavailable
                    </span>
                  )}
                  <Link
                    href={`/tournament/${tournament.tournamentId}`}
                    className="btn-chalk rounded-lg px-4 py-2 text-xs"
                  >
                    Watch replay →
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Link
        href="/play"
        className="btn-primary mt-6 inline-block rounded-lg px-6 py-3"
      >
        Enter another tournament
      </Link>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCurrentUser } from "@/lib/useCurrentUser";

interface TournamentHistoryItem {
  tournamentId: string;
  mode: "trip" | "world";
  createdAt: string;
  userWon: boolean;
  winner: string;
}

function cupName(mode: TournamentHistoryItem["mode"]): string {
  return mode === "world" ? "Global Cup" : "Trip Cup";
}

function formatTournamentDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
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
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Could not load tournament history");
        setTournaments(data.tournaments);
      })
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : "Could not load tournament history"),
      );
  }, [profile]);

  if (!loaded || (profile && tournaments === null && !error)) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-14 text-center text-chalk-dim sm:px-6">
        Loading tournament history…
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <p className="font-display text-xl text-chalk">Sign in to see your tournament history.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <p className="eyebrow">Tournament history</p>
      <h1 className="font-display mt-2 text-3xl text-chalk">Your cup record</h1>
      <p className="mt-2 text-sm text-chalk-dim">
        Select a tournament to see its champion card, trophy, and full match details.
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-whistle/50 bg-whistle/10 px-4 py-3 text-sm text-chalk">
          {error}
        </div>
      )}

      {tournaments && tournaments.length === 0 ? (
        <div className="panel mt-8 rounded-xl p-10 text-center">
          <p className="font-display text-lg text-chalk">No tournaments played yet.</p>
          <p className="mt-2 text-sm text-chalk-dim">
            Enter a card into a Trip Cup or Global Cup to get started.
          </p>
          <Link href="/play" className="btn-primary mt-5 inline-block rounded-lg px-6 py-2.5">
            Enter a tournament
          </Link>
        </div>
      ) : (
        <section className="mt-8" aria-label="Played tournaments">
          <div className="eyebrow hidden grid-cols-[8rem_9rem_minmax(0,1fr)_auto] gap-4 px-5 pb-2 !text-[9px] sm:grid">
            <span>Cup</span>
            <span>Date</span>
            <span>Winner</span>
            <span className="sr-only">Result</span>
          </div>
          <div className="grid gap-2.5">
            {tournaments?.map((tournament) => (
              <Link
                key={tournament.tournamentId}
                href={`/tournament-history/${tournament.tournamentId}`}
                className={`group relative grid gap-3 overflow-hidden rounded-xl border px-4 py-4 transition sm:grid-cols-[8rem_9rem_minmax(0,1fr)_auto] sm:items-center sm:gap-4 sm:px-5 ${
                  tournament.userWon
                    ? "border-gold/55 bg-[linear-gradient(100deg,rgba(232,179,59,0.18),rgba(16,23,27,0.92)_55%)] shadow-[0_0_24px_-16px_rgba(255,210,94,0.9)] hover:border-gold-bright/80"
                    : "border-chalk/10 bg-pitch-850/75 hover:border-cyan-bright/40 hover:bg-pitch-800/90"
                }`}
              >
                {tournament.userWon && (
                  <span className="absolute inset-y-0 left-0 w-1 bg-gold-bright" aria-hidden="true" />
                )}

                <div>
                  <span className="eyebrow sm:hidden">Cup</span>
                  <p className={`font-display text-sm ${tournament.userWon ? "text-gold-bright" : "text-chalk"}`}>
                    {cupName(tournament.mode)}
                  </p>
                </div>
                <div>
                  <span className="eyebrow sm:hidden">Date</span>
                  <p className="font-score text-sm text-chalk-dim">
                    {formatTournamentDate(tournament.createdAt)}
                  </p>
                </div>
                <div className="min-w-0">
                  <span className="eyebrow sm:hidden">Winner</span>
                  <p className="truncate text-sm text-chalk" title={tournament.winner}>
                    {tournament.winner}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  {tournament.userWon ? (
                    <span className="rounded-full border border-gold/50 bg-gold/15 px-2.5 py-1 font-score text-[11px] uppercase tracking-wide text-gold-bright">
                      Your win
                    </span>
                  ) : (
                    <span className="font-score text-[11px] uppercase tracking-wide text-chalk-dim">
                      Completed
                    </span>
                  )}
                  <span className="text-lg text-chalk-dim transition group-hover:translate-x-0.5 group-hover:text-chalk" aria-hidden="true">
                    →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <Link href="/play" className="btn-primary mt-6 inline-block rounded-lg px-6 py-3">
        Enter another tournament
      </Link>
    </div>
  );
}

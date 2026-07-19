"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { usePresentation } from "@/components/PresentationCommentary";
import { TournamentBroadcast } from "./TournamentBroadcast";
import { TournamentResults } from "./TournamentResults";
import type { TournamentPayload } from "./types";

/**
 * Orchestrator: loads the tournament, then hands off to the broadcast (the
 * default, match-by-match experience) or the full results page. The broadcast's
 * "View full results" button flips the view; results offers a rewatch.
 */
export default function TournamentPage() {
  const { id } = useParams<{ id: string }>();
  const { announce } = usePresentation();
  const [data, setData] = useState<TournamentPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"broadcast" | "results">("broadcast");

  useEffect(() => {
    fetch(`/api/tournaments/${id}`)
      .then(async (r) => {
        const payload = await r.json();
        if (!r.ok) throw new Error(payload.error ?? "Tournament not found");
        setData(payload);
        announce({ source: "tournament", tournamentId: id, cue: { kind: "competition.intro" } });
      })
      .catch((e) => setError(e.message));
  }, [announce, id]);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <p className="font-display text-xl text-chalk">{error}</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center text-chalk-dim">
        Walking out of the tunnel…
      </div>
    );
  }

  return view === "broadcast" ? (
    <TournamentBroadcast data={data} onFinish={() => setView("results")} />
  ) : (
    <TournamentResults data={data} onRewatch={() => setView("broadcast")} />
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCurrentUser } from "@/lib/useCurrentUser";

interface PackHistoryItem {
  packId: string;
  scope: "trip" | "global";
  city: string;
  cost: number;
  cardCount: number;
  createdAt: string;
}

export function PackLabClient() {
  const { profile, authMode, loaded } = useCurrentUser();
  const [packs, setPacks] = useState<PackHistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded) return;
    if (authMode === "auth0" && !profile) {
      window.location.assign(
        `/auth/login?returnTo=${encodeURIComponent("/pack-lab")}`,
      );
    }
  }, [loaded, authMode, profile]);

  useEffect(() => {
    if (!profile) return;
    fetch("/api/packs")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Could not load pack history");
        setPacks(data.packs);
      })
      .catch((e) => setError(e.message));
  }, [profile]);

  if (!loaded || (profile && packs === null && !error)) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-14 text-center text-chalk-dim sm:px-6">
        Loading Pack Lab…
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <p className="font-display text-xl text-chalk">
          Sign in to see your Pack Lab.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <p className="eyebrow">Pack Lab</p>
      <h1 className="font-display mt-2 text-3xl text-chalk">
        Relive that dopamine hit without spending Coins!
      </h1>
      <p className="mt-2 text-sm text-chalk-dim">
        Every pack you&apos;ve opened! Reopen any of them to replay the reveal.
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-whistle/50 bg-whistle/10 px-4 py-3 text-sm text-chalk">
          {error}
        </div>
      )}

      {packs && packs.length === 0 ? (
        <div className="panel mt-8 rounded-xl p-10 text-center">
          <p className="font-display text-lg text-chalk">
            No packs minted yet.
          </p>
          <p className="mt-2 text-sm text-chalk-dim">
            Kick off a trip to mint your first pack.
          </p>
          <Link
            href="/packs"
            className="btn-primary mt-5 inline-block rounded-lg px-6 py-2.5"
          >
            Kick off a trip
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-3">
          {packs?.map((pack) => (
            <Link
              key={pack.packId}
              href={`/pack/${pack.packId}`}
              className="panel flex items-center justify-between rounded-xl p-4 transition hover:border-cyan-bright/40"
            >
              <div>
                <p className="font-display text-sm text-chalk">
                  {pack.scope === "global" ? "Global Pack" : "Trip Pack"} ·{" "}
                  {pack.city}
                </p>
                <p className="mt-0.5 text-xs text-chalk-dim">
                  {new Date(pack.createdAt).toLocaleDateString()} ·{" "}
                  {pack.cardCount} cards
                  {pack.cost > 0 ? ` · ${pack.cost} coins` : " · free"}
                </p>
              </div>
              <span className="btn-chalk rounded-lg px-4 py-2 text-xs">
                Replay
              </span>
            </Link>
          ))}
        </div>
      )}

      <Link
        href="/packs"
        className="btn-primary mt-6 inline-block rounded-lg px-6 py-3"
      >
        Kick off another trip
      </Link>
    </div>
  );
}

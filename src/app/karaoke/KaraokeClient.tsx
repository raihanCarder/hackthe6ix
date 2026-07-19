"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export function KaraokeClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromDuel = searchParams.get("fromDuel");
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!fromDuel || startedRef.current) return;
    startedRef.current = true;

    fetch("/api/karaoke/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceDuelId: fromDuel }),
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Could not start the bonus round");
        router.push(`/karaoke/${data.duelId}`);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not start the bonus round"));
  }, [fromDuel, router]);

  if (!fromDuel) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <p className="eyebrow">Bonus mode · karaoke duel</p>
        <h1 className="font-display mt-2 text-2xl text-chalk">Finish a PvP duel first</h1>
        <p className="mt-2 text-sm text-chalk-dim">
          The karaoke duel is a bonus round offered after a 1v1 card duel — beat someone in Duel
          Mode and you&apos;ll get the chance to challenge them to one.
        </p>
        <Link href="/duel" className="btn-primary mt-6 inline-block rounded-lg px-6 py-2.5">
          Play a duel
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <p className="font-display text-xl text-chalk">{error}</p>
        <Link href="/duel" className="btn-chalk mt-4 inline-block rounded-lg px-5 py-2.5">
          Back to duels
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center text-chalk-dim">
      Warming up the mics…
    </div>
  );
}

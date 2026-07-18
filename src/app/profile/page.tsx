"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Profile } from "@/components/Nav";

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((data) => setProfile(data.user))
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) {
    return <div className="mx-auto max-w-2xl px-6 py-20 text-center text-chalk-dim">Reading the team sheet…</div>;
  }
  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <p className="font-display text-xl text-chalk">You&apos;re not on the team sheet yet.</p>
        <p className="mt-2 text-sm text-chalk-dim">Sign in from the top bar to start your career.</p>
      </div>
    );
  }

  const winRate =
    profile.wins + profile.losses > 0
      ? Math.round((profile.wins / (profile.wins + profile.losses)) * 100)
      : null;

  const stats: Array<{ label: string; value: string; hint?: string }> = [
    { label: "Level", value: String(profile.level), hint: `${profile.xp} XP` },
    { label: "Coins", value: String(profile.currency) },
    { label: "Tournaments", value: String(profile.matchesPlayed) },
    {
      label: "Record",
      value: `${profile.wins}W–${profile.losses}L`,
      hint: winRate !== null ? `${winRate}% win rate` : undefined,
    },
    { label: "Win streak", value: String(profile.currentWinStreak), hint: `best ${profile.bestWinStreak}` },
    { label: "MVP trophies", value: String(profile.mvpCount) },
    { label: "Packs opened", value: String(profile.packsOpened) },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <p className="eyebrow">Manager profile</p>
      <h1 className="font-display mt-2 text-3xl text-chalk">{profile.username}</h1>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="panel rounded-xl p-4">
            <p className="eyebrow !text-[9px]">{stat.label}</p>
            <p className="font-score mt-1 text-3xl text-gold-bright">{stat.value}</p>
            {stat.hint && <p className="mt-0.5 text-[11px] text-chalk-dim">{stat.hint}</p>}
          </div>
        ))}
      </div>

      <div className="mt-8 flex gap-3">
        <Link href="/packs" className="btn-gold rounded-lg px-6 py-2.5">
          Open a pack
        </Link>
        <Link href="/play" className="btn-chalk rounded-lg px-6 py-2.5">
          Play
        </Link>
        <Link href="/collection" className="btn-chalk rounded-lg px-6 py-2.5">
          Collection
        </Link>
      </div>
    </div>
  );
}

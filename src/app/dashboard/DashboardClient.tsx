"use client";

import { Avatar, Style } from "@dicebear/core";
import thumbs from "@dicebear/styles/thumbs.json";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { HotelCard, STAT_META } from "@/components/HotelCard";
import type { CardPayload } from "@/components/types";
import { useCurrentUser } from "@/lib/useCurrentUser";

const thumbsAvatarStyle = new Style(thumbs);
const DEFAULT_PROFILE_BIO = "Looking for a hotel for my next trip!";

function addDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function compactLocation(address: string | null): string {
  if (!address) return "Location unavailable";
  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 2) return parts.slice(-2).join(", ");
  return address;
}

function priceLabel(price: number | null): string {
  return price !== null ? `$${price}/night` : "Price at booking";
}

function FlameIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M34.4 5.7c2.3 8.5-1.9 12.7-6.3 17.4-4.1 4.4-8.4 9-8.4 16.6 0 10.1 7.4 18.6 18.2 18.6 10.2 0 18-7.8 18-18.1 0-8-4.6-14.7-10.3-19.7.4 5.2-1 8.9-4.7 11.7.4-10.1-2.8-19.5-6.5-26.5Z"
        fill="url(#dashboard-flame-outer)"
      />
      <path
        d="M31.9 54.1c-5.6 0-10-4.2-10-9.9 0-4.7 2.5-7.4 5.1-10.1 2.8-2.9 5.6-5.9 4.4-11.4 4.7 4.6 8.6 10.7 8.1 17.4 2.6-1.3 4.2-3.7 4.5-6.9 3.3 3.1 5.1 6.9 5.1 11 0 5.7-4.2 9.9-9.8 9.9h-7.4Z"
        fill="url(#dashboard-flame-inner)"
      />
      <defs>
        <linearGradient
          id="dashboard-flame-outer"
          x1="21"
          x2="51"
          y1="9"
          y2="56"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#FFD25E" />
          <stop offset=".45" stopColor="#FF8A22" />
          <stop offset="1" stopColor="#E5533C" />
        </linearGradient>
        <linearGradient
          id="dashboard-flame-inner"
          x1="29"
          x2="44"
          y1="25"
          y2="55"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#FFF6B7" />
          <stop offset=".55" stopColor="#FFD25E" />
          <stop offset="1" stopColor="#FF8A22" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function DashboardClient() {
  const router = useRouter();
  const { profile, authMode, loaded, setProfile } = useCurrentUser();
  const [cards, setCards] = useState<CardPayload[] | null>(null);
  const today = new Date();
  const [quickTrip, setQuickTrip] = useState({
    destination: "",
    checkin: addDays(today, 21),
    checkout: addDays(today, 24),
  });
  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState(DEFAULT_PROFILE_BIO);
  const [bioSaving, setBioSaving] = useState(false);
  const [bioError, setBioError] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded) return;
    if (authMode === "auth0" && !profile) {
      window.location.assign(
        `/auth/login?returnTo=${encodeURIComponent("/dashboard")}`,
      );
    }
  }, [loaded, authMode, profile]);

  useEffect(() => {
    if (!profile) return;
    fetch("/api/cards")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { cards: CardPayload[] } | null) =>
        setCards(data?.cards ?? []),
      )
      .catch(() => setCards([]));
  }, [profile]);

  const avatarSrc = useMemo(() => {
    if (!profile) return "";
    if (profile.avatarUrl) return profile.avatarUrl;
    return new Avatar(thumbsAvatarStyle, {
      seed: profile.id || profile.username,
      size: 96,
    }).toDataUri();
  }, [profile]);

  function mintQuickTrip(event: React.FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams({
      destination: quickTrip.destination,
      checkin: quickTrip.checkin,
      checkout: quickTrip.checkout,
    });
    router.push(`/packs?${params.toString()}`);
  }

  async function saveBio() {
    if (!profile) return;
    setBioSaving(true);
    setBioError(null);
    try {
      const response = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio: bioDraft }),
      });
      const data = (await response.json()) as { bio?: string; error?: string };
      if (!response.ok || !data.bio) {
        throw new Error(data.error ?? "Could not save bio");
      }
      setProfile({ ...profile, bio: data.bio });
      setBioDraft(data.bio);
      setEditingBio(false);
    } catch (error) {
      setBioError(
        error instanceof Error ? error.message : "Could not save bio",
      );
    } finally {
      setBioSaving(false);
    }
  }

  if (!loaded) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-14 text-center text-chalk-dim sm:px-6">
        Loading dashboard…
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <p className="font-display text-xl text-chalk">
          Sign in to see your dashboard.
        </p>
        <p className="mt-2 text-sm text-chalk-dim">
          Use the sign in button in the sidebar to get started.
        </p>
      </div>
    );
  }

  const bestCard =
    cards && cards.length > 0
      ? [...cards].sort((a, b) => b.overall - a.overall)[0]
      : null;
  const bookableValue =
    cards?.reduce((sum, c) => sum + (c.hotel.nightlyPrice ?? 0), 0) ?? null;
  const scoreBoard = cards
    ? [...cards].sort((a, b) => b.overall - a.overall).slice(0, 8)
    : [];
  const maxScore =
    scoreBoard.length > 0 ? Math.max(...scoreBoard.map((c) => c.overall)) : 1;
  const profileBio = profile.bio ?? DEFAULT_PROFILE_BIO;

  const tiles = [
    {
      label: "Cards owned",
      value: cards === null ? "…" : String(cards.length),
    },
    { label: "Best pull", value: bestCard ? String(bestCard.overall) : "—" },
    { label: "Packs opened", value: String(profile.packsOpened) },
    {
      label: "Bookable value",
      value:
        bookableValue !== null ? `$${bookableValue.toLocaleString()}` : "—",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-12">
      <div className="mt-2">
        <h1 className="font-display max-w-4xl text-2xl text-chalk sm:text-3xl">
          Check-in Champions Dashboard
        </h1>
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <section className="panel rounded-lg p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <Image
                src={avatarSrc}
                alt=""
                width={80}
                height={80}
                unoptimized
                className="h-20 w-20 shrink-0 rounded-full border border-chalk/15 bg-pitch-950 object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display truncate text-xl text-chalk">
                    {profile.username}
                  </h2>
                  <span className="font-score rounded bg-pitch-800 px-2 py-1 text-xs text-gold-bright">
                    LV {profile.level}
                  </span>
                  {!editingBio && (
                    <button
                      type="button"
                      onClick={() => {
                        setBioDraft(profileBio);
                        setBioError(null);
                        setEditingBio(true);
                      }}
                      className="ml-auto rounded border border-chalk/15 px-3 py-1 text-xs font-bold uppercase text-chalk-dim transition hover:border-cyan-bright/50 hover:text-chalk"
                    >
                      Edit
                    </button>
                  )}
                </div>

                {editingBio ? (
                  <div className="mt-3">
                    <textarea
                      value={bioDraft}
                      onChange={(event) => {
                        setBioDraft(event.target.value);
                        setBioError(null);
                      }}
                      maxLength={160}
                      rows={3}
                      className="input-field resize-none"
                    />
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={saveBio}
                        disabled={bioSaving}
                        className="btn-primary rounded-lg px-4 py-2 text-xs"
                      >
                        {bioSaving ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setBioDraft(profileBio);
                          setBioError(null);
                          setEditingBio(false);
                        }}
                        disabled={bioSaving}
                        className="rounded-lg border border-chalk/15 px-4 py-2 text-xs font-bold text-chalk-dim transition hover:border-chalk/30 hover:text-chalk disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <span className="ml-auto font-score text-xs text-chalk-dim">
                        {bioDraft.length}/160
                      </span>
                    </div>
                    {bioError && (
                      <p className="mt-2 text-sm text-whistle">{bioError}</p>
                    )}
                  </div>
                ) : (
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-chalk-dim">
                    {profileBio}
                  </p>
                )}
              </div>
            </div>
          </section>

          <div className="panel relative flex w-full items-center gap-4 overflow-hidden rounded-lg border-gold/40 bg-[radial-gradient(circle_at_20%_20%,rgba(255,210,94,0.18),transparent_34%),linear-gradient(135deg,rgba(229,83,60,0.18),rgba(16,23,27,0.92)_58%)] p-4">
            <FlameIcon className="relative h-16 w-16 shrink-0 drop-shadow-[0_0_18px_rgba(255,138,34,0.8)] sm:h-20 sm:w-20" />
            <div className="relative min-w-0">
              <p className="eyebrow !text-[9px] text-gold-bright">
                Current win streak
              </p>
              <div className="mt-1 flex items-end gap-2">
                <p className="font-score text-5xl leading-none text-chalk sm:text-6xl">
                  {profile.currentWinStreak}
                </p>
                <p className="pb-1 font-display text-sm uppercase text-gold-bright">
                  wins
                </p>
              </div>
              <p className="font-score mt-2 text-sm text-chalk-dim">
                Best{" "}
                <span className="text-gold-bright">
                  {profile.bestWinStreak}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-7 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="panel stat-tile">
            <p className="eyebrow !text-[9px]">{tile.label}</p>
            <p className="font-score mt-1 text-2xl text-chalk sm:text-3xl">
              {tile.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-7 grid gap-5 lg:grid-cols-2">
        <div className="panel rounded-xl p-6">
          <h2 className="font-display text-sm text-chalk">Quick trip pack</h2>
          <form
            onSubmit={mintQuickTrip}
            className="mt-5 grid gap-5 sm:grid-cols-2"
          >
            <label className="sm:col-span-2">
              <span className="eyebrow">Destination</span>
              <input
                required
                minLength={2}
                value={quickTrip.destination}
                onChange={(e) =>
                  setQuickTrip({ ...quickTrip, destination: e.target.value })
                }
                placeholder="Toronto, Montréal, Tokyo…"
                className="mt-1 input-field"
              />
            </label>
            <label>
              <span className="eyebrow">Check-in</span>
              <input
                type="date"
                value={quickTrip.checkin}
                onChange={(e) =>
                  setQuickTrip({ ...quickTrip, checkin: e.target.value })
                }
                className="mt-1 input-field"
              />
            </label>
            <label>
              <span className="eyebrow">Check-out</span>
              <input
                type="date"
                value={quickTrip.checkout}
                onChange={(e) =>
                  setQuickTrip({ ...quickTrip, checkout: e.target.value })
                }
                className="mt-1 input-field"
              />
            </label>
            <button
              type="submit"
              className="btn-primary mt-1 w-full rounded-lg px-4 py-3 text-sm sm:col-span-2"
            >
              Mint trip pack
            </button>
          </form>
        </div>

        <div className="panel rounded-xl p-6">
          <h2 className="font-display text-sm text-chalk">
            Top pull from your collection
          </h2>
          {bestCard ? (
            <div className="mt-4 flex gap-5">
              <div className="w-32 shrink-0 sm:w-36 lg:w-40">
                <HotelCard
                  hotel={bestCard.hotel}
                  stats={bestCard.stats}
                  overall={bestCard.overall}
                  rarity={bestCard.rarity}
                  cosmeticSeed={bestCard.cosmeticSeed}
                  compact
                />
              </div>
              <div className="flex flex-1 flex-col">
                <div>
                  <p className="font-display text-lg leading-tight text-chalk">
                    {bestCard.hotel.name ?? "Top card"}
                  </p>
                  <p className="mt-1 truncate text-sm text-chalk-dim">
                    {compactLocation(bestCard.hotel.address)}
                  </p>
                  <p className="mt-1 font-score text-sm font-bold text-card-primary">
                    {priceLabel(bestCard.hotel.nightlyPrice)}
                  </p>
                </div>
                <div className="mt-auto pt-4">
                  <p className="eyebrow mb-2 !text-[9px]">Stats</p>
                  <div className="space-y-2">
                    {STAT_META.map(({ key, label, color }) => (
                      <div
                        key={key}
                        className="flex items-center gap-2 text-xs"
                      >
                        <span className="w-20 shrink-0 text-chalk-dim">
                          {label}
                        </span>
                        <div className="stat-bar h-2 flex-1 overflow-hidden rounded-full">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${bestCard.stats[key]}%`,
                              background: color,
                            }}
                          />
                        </div>
                        <span className="font-score w-6 text-right text-chalk">
                          {bestCard.stats[key]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-chalk-dim">
              No cards yet — kick off a trip to mint your first pack.
            </p>
          )}
        </div>
      </div>

      {scoreBoard.length > 0 && (
        <div className="panel mt-5 rounded-xl p-6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-sm text-chalk">
                Your Top 8 Cards
              </h2>
              <p className="mt-1 text-xs text-chalk-dim">
                Buy packs to get more cards!
              </p>
            </div>
            <span className="eyebrow hidden !text-[9px] sm:block">OVR</span>
          </div>
          <div className="mt-4 space-y-3">
            {scoreBoard.map((card) => (
              <div
                key={card.id}
                className="grid grid-cols-[minmax(0,12rem)_1fr_2rem] items-center gap-3 text-xs sm:grid-cols-[minmax(0,18rem)_1fr_2rem]"
              >
                <span className="truncate text-chalk-dim">
                  {card.hotel.name}
                </span>
                <div className="stat-bar h-2.5 overflow-hidden rounded-full">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(card.overall / maxScore) * 100}%`,
                      background: "var(--cyan-bright)",
                    }}
                  />
                </div>
                <span className="font-score w-6 text-right text-chalk">
                  {card.overall}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

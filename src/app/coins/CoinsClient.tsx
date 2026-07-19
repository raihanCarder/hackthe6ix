"use client";

import { useEffect, useState } from "react";
import { COIN_TIERS } from "@/lib/coins";
import { useCurrentUser } from "@/lib/useCurrentUser";

const COINS = [
  { left: 22, top: 55, size: 42, rotate: -14 },
  { left: 40, top: 45, size: 52, rotate: 7 },
  { left: 57, top: 57, size: 46, rotate: -3 },
  { left: 70, top: 43, size: 34, rotate: 18 },
] as const;

function CoinArt({ featured = false }: { featured?: boolean }) {
  return (
    <div
      className={`relative mx-auto h-40 w-full max-w-64 overflow-hidden rounded-lg border ${
        featured
          ? "border-gold-bright/35 bg-gold/10"
          : "border-cyan-bright/20 bg-cyan-bright/10"
      }`}
      aria-hidden="true"
    >
      <div className="absolute inset-x-6 bottom-6 h-5 rounded-full bg-black/30 blur-sm" />
      {featured && (
        <div className="absolute right-9 top-8 h-12 w-20 rounded-md border border-gold-bright/50 bg-pitch-950/80 shadow-[0_0_24px_rgba(255,210,94,0.18)]">
          <div className="mx-auto mt-2 h-2 w-12 rounded-full bg-gold-bright/70" />
          <div className="mx-auto mt-2 h-2 w-8 rounded-full bg-gold/60" />
        </div>
      )}
      {COINS.map((coin, index) => (
        <span
          key={`${coin.left}-${coin.top}`}
          className={`absolute grid place-items-center rounded-full border-2 ${
            featured
              ? "border-gold-bright bg-gold text-pitch-950"
              : "border-cyan-bright bg-chalk text-pitch-950"
          } shadow-[0_8px_18px_rgba(0,0,0,0.32)]`}
          style={{
            left: `${coin.left}%`,
            top: `${coin.top - (featured && index === 3 ? 18 : 0)}%`,
            width: coin.size,
            height: coin.size,
            transform: `translate(-50%, -50%) rotate(${coin.rotate}deg)`,
          }}
        >
          <span className="grid h-[72%] w-[72%] place-items-center rounded-full border border-pitch-950/25 font-display text-xs">
            C
          </span>
        </span>
      ))}
    </div>
  );
}

export function CoinsClient() {
  const { profile, authMode, loaded } = useCurrentUser();
  const [busyTier, setBusyTier] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded) return;
    if (authMode === "auth0" && !profile) {
      window.location.assign(
        `/auth/login?returnTo=${encodeURIComponent("/coins")}`,
      );
    }
  }, [loaded, authMode, profile]);

  async function buyCoins(tierId: string) {
    setBusyTier(tierId);
    setError(null);
    try {
      const response = await fetch("/api/coins/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tierId }),
      });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not start checkout");
      if (!data.url) throw new Error("Stripe did not return a checkout URL");
      window.location.assign(data.url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start checkout");
      setBusyTier(null);
    }
  }

  if (!loaded) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-14 text-center text-chalk-dim sm:px-6">
        Loading coin shop...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <p className="font-display text-xl text-chalk">Sign in to buy coins.</p>
        <p className="mt-2 text-sm text-chalk-dim">
          Use the sign in button in the sidebar to open the coin shop.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Coin shop</p>
          <h1 className="font-display mt-2 text-3xl text-chalk sm:text-4xl">
            Buy coins
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-chalk-dim">
            Buy coins to pull better hotels! Gain coins by playing matches!
          </p>
        </div>
        <div className="rounded-lg border border-gold-bright/25 bg-pitch-800 px-4 py-3">
          <p className="eyebrow !text-[9px]">Current balance</p>
          <p className="font-score mt-1 text-2xl text-gold-bright">
            {profile.currency.toLocaleString()} coins
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-6 rounded-lg border border-whistle/50 bg-whistle/10 px-4 py-3 text-sm text-chalk">
          {error}
        </div>
      )}

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {COIN_TIERS.map((pack) => {
          const featured = Boolean(pack.badge);
          const busy = busyTier === pack.id;

          return (
            <section
              key={pack.id}
              className={`panel relative overflow-hidden rounded-lg p-5 ${
                featured
                  ? "border-gold-bright/45 shadow-[0_18px_42px_-28px_rgba(255,210,94,0.7)]"
                  : ""
              }`}
            >
              {pack.badge && (
                <span className="absolute right-4 top-4 rounded bg-gold-bright px-2.5 py-1 font-display text-[10px] uppercase text-pitch-950">
                  {pack.badge}
                </span>
              )}

              <div className="pr-20">
                <p className="eyebrow !text-[9px]">{pack.label}</p>
                <p className="font-score mt-2 text-4xl text-chalk">
                  {pack.coins.toLocaleString()}
                </p>
                <p className="font-display mt-1 text-sm text-gold-bright">
                  coins
                </p>
              </div>

              <div className="mt-5">
                <CoinArt featured={featured} />
              </div>

              <div className="mt-5 flex items-center justify-between gap-3">
                <div>
                  <p className="eyebrow !text-[9px]">Price</p>
                  <p className="font-score text-3xl text-chalk">{pack.priceLabel}</p>
                </div>
                <button
                  type="button"
                  onClick={() => buyCoins(pack.id)}
                  disabled={busyTier !== null}
                  className={`${featured ? "btn-gold" : "btn-primary"} rounded-lg px-5 py-2.5 text-sm`}
                  aria-label={`Buy ${pack.coins.toLocaleString()} coins for ${pack.priceLabel}`}
                >
                  {busy ? "Opening..." : "Buy"}
                </button>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

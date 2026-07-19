"use client";

import { useEffect, useState } from "react";
import { COIN_TIERS, type CoinTierId } from "@/lib/coins";
import { useCurrentUser } from "@/lib/useCurrentUser";

interface CoinPosition {
  left: number;
  top: number;
  size: number;
  rotate: number;
  depth: number;
}

const COIN_PILES: Record<CoinTierId, CoinPosition[]> = {
  starter: [
    { left: 35, top: 60, size: 58, rotate: -12, depth: 2 },
    { left: 51, top: 46, size: 76, rotate: 4, depth: 3 },
    { left: 68, top: 61, size: 62, rotate: 11, depth: 4 },
  ],
  "pack-night": [
    { left: 25, top: 63, size: 52, rotate: -18, depth: 2 },
    { left: 39, top: 49, size: 68, rotate: -5, depth: 4 },
    { left: 55, top: 62, size: 62, rotate: 10, depth: 5 },
    { left: 68, top: 42, size: 74, rotate: 4, depth: 3 },
    { left: 79, top: 66, size: 48, rotate: 17, depth: 6 },
  ],
  "champion-vault": [
    { left: 21, top: 67, size: 48, rotate: -15, depth: 4 },
    { left: 34, top: 50, size: 66, rotate: -6, depth: 5 },
    { left: 48, top: 68, size: 72, rotate: 6, depth: 7 },
    { left: 61, top: 48, size: 62, rotate: 13, depth: 6 },
    { left: 73, top: 65, size: 54, rotate: -9, depth: 8 },
    { left: 83, top: 39, size: 44, rotate: 14, depth: 9 },
  ],
};

const TIER_VISUALS: Record<
  CoinTierId,
  {
    kicker: string;
    description: string;
    artClass: string;
    cardClass: string;
    coinTone: "silver" | "gold";
  }
> = {
  starter: {
    kicker: "Quick top-up",
    description: "A small boost when your next pack is just out of reach.",
    artClass:
      "border-cyan-bright/20 bg-[radial-gradient(circle_at_50%_42%,rgba(34,211,238,0.17),transparent_44%),linear-gradient(145deg,rgba(16,35,42,0.92),rgba(4,7,10,0.98))]",
    cardClass: "border-cyan-bright/15 hover:border-cyan-bright/40",
    coinTone: "silver",
  },
  "pack-night": {
    kicker: "Matchday fund",
    description: "A deeper balance for pack openings and longer play sessions.",
    artClass:
      "border-turf-bright/25 bg-[radial-gradient(circle_at_50%_42%,rgba(23,155,114,0.24),transparent_44%),linear-gradient(145deg,rgba(12,47,37,0.94),rgba(4,7,10,0.98))]",
    cardClass: "border-turf-bright/25 hover:border-turf-bright/55",
    coinTone: "gold",
  },
  "champion-vault": {
    kicker: "Premium reserve",
    description: "The largest balance and the strongest coin value in the shop.",
    artClass:
      "border-gold-bright/35 bg-[radial-gradient(circle_at_48%_38%,rgba(255,210,94,0.25),transparent_45%),linear-gradient(145deg,rgba(62,46,12,0.94),rgba(7,9,8,0.99))]",
    cardClass:
      "border-gold-bright/50 shadow-[0_24px_70px_-36px_rgba(255,210,94,0.95)] hover:border-gold-bright/80",
    coinTone: "gold",
  },
};

function CoinToken({ coin, tone }: { coin: CoinPosition; tone: "silver" | "gold" }) {
  const gold = tone === "gold";

  return (
    <span
      className={`absolute grid place-items-center rounded-full border-[3px] shadow-[0_12px_22px_rgba(0,0,0,0.48)] ${
        gold
          ? "border-[#ffe58a] bg-[radial-gradient(circle_at_36%_28%,#ffe999_0%,#f6c443_38%,#c98212_100%)] text-[#211604]"
          : "border-[#f3fbfa] bg-[radial-gradient(circle_at_36%_28%,#ffffff_0%,#dfe9e8_42%,#8ca09d_100%)] text-[#10191a]"
      }`}
      style={{
        left: `${coin.left}%`,
        top: `${coin.top}%`,
        width: coin.size,
        height: coin.size,
        zIndex: coin.depth,
        transform: `translate(-50%, -50%) rotate(${coin.rotate}deg)`,
      }}
    >
      <span
        className={`grid h-[72%] w-[72%] place-items-center rounded-full border-2 font-display text-[clamp(0.7rem,2vw,1rem)] ${
          gold ? "border-[#9f6910]/70" : "border-[#657673]/55"
        }`}
      >
        C
      </span>
    </span>
  );
}

function Vault() {
  return (
    <div className="absolute right-[9%] top-[14%] z-[1] h-[43%] w-[34%]" aria-hidden="true">
      <div className="absolute inset-x-0 top-0 h-[38%] rounded-t-xl border border-gold-bright/55 bg-[linear-gradient(180deg,#5b461b,#201b0f)] shadow-[0_0_32px_rgba(255,210,94,0.2)]" />
      <div className="absolute inset-x-0 bottom-0 h-[68%] rounded-b-xl border border-gold-bright/55 bg-[linear-gradient(145deg,#332914,#11120e)]">
        <div className="absolute left-1/2 top-[34%] h-7 w-7 -translate-x-1/2 rounded-full border-2 border-gold-bright/70 bg-pitch-950">
          <span className="absolute left-1/2 top-1/2 h-3 w-1 -translate-x-1/2 -translate-y-[10%] rounded-full bg-gold-bright" />
        </div>
      </div>
    </div>
  );
}

function CoinArt({ tierId }: { tierId: CoinTierId }) {
  const visual = TIER_VISUALS[tierId];

  return (
    <div
      className={`relative h-52 overflow-hidden rounded-xl border ${visual.artClass}`}
      aria-hidden="true"
    >
      <div className="absolute inset-x-[8%] top-[12%] h-[76%] rounded-[50%] border border-white/5" />
      <div className="absolute left-1/2 top-1/2 h-24 w-56 -translate-x-1/2 rounded-full bg-black/45 blur-2xl" />
      <div className="absolute inset-x-6 bottom-5 h-6 rounded-full bg-black/45 blur-md" />
      {tierId === "champion-vault" && <Vault />}
      {COIN_PILES[tierId].map((coin, index) => (
        <CoinToken key={`${tierId}-${index}`} coin={coin} tone={visual.coinTone} />
      ))}
      <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent_30%,rgba(255,255,255,0.08)_48%,transparent_62%)] opacity-60" />
    </div>
  );
}

function BalanceCoin() {
  return (
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-gold-bright bg-[radial-gradient(circle_at_35%_28%,#ffe999,#e8b33b_55%,#a56c0f)] text-pitch-950 shadow-[0_0_24px_rgba(255,210,94,0.25)]">
      <span className="font-display text-sm">C</span>
    </span>
  );
}

export function CoinsClient() {
  const { profile, authMode, loaded } = useCurrentUser();
  const [busyTier, setBusyTier] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const baseTier = COIN_TIERS[0];
  const baseRate = baseTier.coins / (baseTier.amountCents / 100);

  useEffect(() => {
    if (!loaded) return;
    if (authMode === "auth0" && !profile) {
      window.location.assign(`/auth/login?returnTo=${encodeURIComponent("/coins")}`);
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
      <div className="mx-auto max-w-6xl px-4 py-14 text-center text-chalk-dim sm:px-6">
        Loading coin shop…
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
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-12">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Club store · coin shop</p>
          <h1 className="font-display mt-2 text-3xl text-chalk sm:text-4xl">Build your balance</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-chalk-dim">
            Stock up for pack openings and tournament nights. Your coins arrive after secure
            checkout.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-gold-bright/25 bg-[linear-gradient(120deg,rgba(232,179,59,0.12),rgba(16,23,27,0.92))] px-4 py-3 shadow-[0_14px_35px_-24px_rgba(255,210,94,0.8)]">
          <BalanceCoin />
          <div>
            <p className="eyebrow !text-[9px]">Current balance</p>
            <p className="font-score mt-0.5 text-2xl text-gold-bright">
              {profile.currency.toLocaleString()} <span className="text-base">coins</span>
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-6 rounded-lg border border-whistle/50 bg-whistle/10 px-4 py-3 text-sm text-chalk">
          {error}
        </div>
      )}

      <div className="mt-9 grid gap-5 lg:grid-cols-3 lg:items-stretch">
        {COIN_TIERS.map((pack) => {
          const tierId = pack.id as CoinTierId;
          const visual = TIER_VISUALS[tierId];
          const featured = Boolean(pack.badge);
          const busy = busyTier === pack.id;
          const rate = pack.coins / (pack.amountCents / 100);
          const valueBoost = Math.round((rate / baseRate - 1) * 100);

          return (
            <section
              key={pack.id}
              className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-pitch-850/90 p-5 transition duration-300 hover:-translate-y-1 sm:p-6 ${visual.cardClass}`}
            >
              <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full border border-white/5" />
              <div className="flex min-h-12 items-start justify-between gap-3">
                <div>
                  <p className="eyebrow !text-[9px]">{visual.kicker}</p>
                  <h2 className="font-display mt-1 text-base text-chalk">{pack.label}</h2>
                </div>
                {pack.badge && (
                  <span className="rounded-full bg-gold-bright px-3 py-1.5 font-display text-[9px] uppercase tracking-wide text-pitch-950 shadow-[0_0_22px_rgba(255,210,94,0.3)]">
                    {pack.badge}
                  </span>
                )}
              </div>

              <div className="mt-5 flex items-end justify-between gap-4">
                <div>
                  <p className="font-score text-5xl leading-none text-chalk sm:text-6xl">
                    {pack.coins.toLocaleString()}
                  </p>
                  <p className="font-display mt-1 text-sm text-gold-bright">coins</p>
                </div>
                <span
                  className={`rounded-lg border px-2.5 py-1.5 font-score text-[11px] uppercase tracking-wide ${
                    valueBoost > 0
                      ? "border-turf-bright/40 bg-turf-bright/10 text-turf-bright"
                      : "border-chalk/10 bg-chalk/5 text-chalk-dim"
                  }`}
                >
                  {valueBoost > 0 ? `+${valueBoost}% value` : "Base value"}
                </span>
              </div>

              <div className="mt-5">
                <CoinArt tierId={tierId} />
              </div>

              <p className="mt-5 min-h-12 text-sm leading-6 text-chalk-dim">{visual.description}</p>

              <div className="mt-auto border-t border-chalk/10 pt-5">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="eyebrow !text-[9px]">One-time purchase</p>
                    <p className="font-score mt-1 text-4xl leading-none text-chalk">
                      {pack.priceLabel}
                    </p>
                    <p className="mt-1 text-[11px] text-chalk-dim">
                      {Math.round(rate)} coins per $1
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => buyCoins(pack.id)}
                    disabled={busyTier !== null}
                    className={`${featured ? "btn-gold" : "btn-primary"} min-w-36 rounded-lg px-5 py-3 text-sm shadow-lg transition disabled:cursor-not-allowed disabled:opacity-50`}
                    aria-label={`Buy ${pack.coins.toLocaleString()} coins for ${pack.priceLabel}`}
                  >
                    {busy ? "Opening…" : `Get ${pack.coins.toLocaleString()}`}
                  </button>
                </div>
                <p className="mt-4 text-center text-[10px] uppercase tracking-[0.16em] text-chalk-dim/70">
                  Secure checkout powered by Stripe
                </p>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

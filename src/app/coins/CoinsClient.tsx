"use client";

import { useEffect, useState } from "react";
import { COIN_TIERS, type CoinTierId } from "@/lib/coins";
import { useCurrentUser } from "@/lib/useCurrentUser";

interface StackSpec {
  x: number;
  y: number;
  levels: number;
  scale: number;
}

const STACK_LAYOUTS: Record<CoinTierId, StackSpec[]> = {
  starter: [
    { x: 158, y: 194, levels: 3, scale: 0.82 },
    { x: 270, y: 194, levels: 5, scale: 1 },
  ],
  "pack-night": [
    { x: 116, y: 198, levels: 4, scale: 0.72 },
    { x: 220, y: 194, levels: 7, scale: 0.9 },
    { x: 335, y: 194, levels: 5, scale: 1.02 },
  ],
  "champion-vault": [
    { x: 105, y: 202, levels: 5, scale: 0.68 },
    { x: 205, y: 198, levels: 8, scale: 0.86 },
    { x: 322, y: 197, levels: 6, scale: 0.98 },
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

function CoinStack({
  stack,
  faceId,
  edgeId,
  rimColor,
}: {
  stack: StackSpec;
  faceId: string;
  edgeId: string;
  rimColor: string;
}) {
  const topY = -(stack.levels - 1) * 12;

  return (
    <g transform={`translate(${stack.x} ${stack.y}) scale(${stack.scale})`}>
      {Array.from({ length: stack.levels }, (_, level) => {
        const y = -level * 12;
        return (
          <g key={level}>
            <rect x="-49" y={y} width="98" height="13" fill={`url(#${edgeId})`} />
            <ellipse cx="0" cy={y + 13} rx="49" ry="16" fill={`url(#${edgeId})`} />
            <ellipse
              cx="0"
              cy={y}
              rx="49"
              ry="16"
              fill={`url(#${faceId})`}
              stroke={rimColor}
              strokeWidth="2"
            />
            <path
              d={`M-39 ${y + 2} C-15 ${y + 12}, 15 ${y + 12}, 39 ${y + 2}`}
              fill="none"
              stroke="rgba(255,255,255,0.22)"
              strokeWidth="1.4"
            />
          </g>
        );
      })}
      <ellipse
        cx="0"
        cy={topY}
        rx="34"
        ry="10"
        fill="none"
        stroke={rimColor}
        strokeWidth="2"
        opacity="0.72"
      />
      <path
        d={`M-8 ${topY - 1} L0 ${topY - 6} L8 ${topY - 1} L5 ${topY + 6} L-5 ${topY + 6} Z`}
        fill={rimColor}
        opacity="0.9"
      />
    </g>
  );
}

function TrophyStamp({ fill }: { fill: string }) {
  return (
    <g fill={fill}>
      <path d="M-18-18H18V-3C18 12 10 22 0 22S-18 12-18-3V-18Z" />
      <path d="M-18-13H-29V-5C-29 6-21 11-12 11V4C-18 4-22 1-22-5V-7H-18V-13ZM18-13H29V-5C29 6 21 11 12 11V4C18 4 22 1 22-5V-7H18V-13Z" />
      <rect x="-4" y="20" width="8" height="13" rx="2" />
      <rect x="-15" y="31" width="30" height="7" rx="3" />
    </g>
  );
}

function HeroMedallion({
  tierId,
  faceId,
  edgeId,
  rimColor,
}: {
  tierId: CoinTierId;
  faceId: string;
  edgeId: string;
  rimColor: string;
}) {
  const transform =
    tierId === "starter"
      ? "translate(375 105) rotate(8)"
      : tierId === "pack-night"
        ? "translate(407 98) rotate(10)"
        : "translate(420 88) rotate(8)";
  const radius = tierId === "starter" ? 55 : 61;

  return (
    <g transform={transform} filter="url(#coin-shadow)">
      <circle cx="7" cy="8" r={radius} fill={`url(#${edgeId})`} opacity="0.92" />
      <circle cx="0" cy="0" r={radius} fill={`url(#${faceId})`} stroke={rimColor} strokeWidth="4" />
      <circle cx="0" cy="0" r={radius - 12} fill="none" stroke={rimColor} strokeWidth="2" opacity="0.72" />
      <circle cx="-17" cy="-19" r="15" fill="rgba(255,255,255,0.18)" />
      <g transform="scale(.72)">
        <TrophyStamp fill={rimColor} />
      </g>
    </g>
  );
}

function SvgVault() {
  return (
    <g transform="translate(320 30)" opacity="0.92">
      <path
        d="M18 54V31C18 13 34 0 54 0H130C150 0 166 13 166 31V54"
        fill="#2d2616"
        stroke="#e8b33b"
        strokeWidth="3"
      />
      <rect x="6" y="51" width="172" height="112" rx="14" fill="#14140f" stroke="#e8b33b" strokeWidth="3" />
      <rect x="22" y="68" width="140" height="78" rx="9" fill="#242015" stroke="#75591e" strokeWidth="2" />
      <circle cx="92" cy="106" r="21" fill="#080b0b" stroke="#ffd25e" strokeWidth="3" />
      <circle cx="92" cy="106" r="5" fill="#ffd25e" />
      <path d="M92 110V126" stroke="#ffd25e" strokeWidth="5" strokeLinecap="round" />
    </g>
  );
}

function CoinArt({ tierId }: { tierId: CoinTierId }) {
  const visual = TIER_VISUALS[tierId];
  const gold = visual.coinTone === "gold";
  const faceId = `coin-face-${tierId}`;
  const edgeId = `coin-edge-${tierId}`;
  const rimColor = gold ? "#8d5d0d" : "#5d7472";

  return (
    <div
      className={`coin-shop-art relative overflow-hidden rounded-xl border ${visual.artClass}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 520 240" className="absolute inset-0 h-full w-full" role="presentation">
        <defs>
          <linearGradient id={faceId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={gold ? "#fff0a6" : "#f7ffff"} />
            <stop offset="0.48" stopColor={gold ? "#f3bf3e" : "#cfdddb"} />
            <stop offset="1" stopColor={gold ? "#b7710d" : "#809593"} />
          </linearGradient>
          <linearGradient id={edgeId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={gold ? "#d49319" : "#a9bcba"} />
            <stop offset="1" stopColor={gold ? "#754607" : "#4d6361"} />
          </linearGradient>
          <filter id="coin-shadow" x="-50%" y="-50%" width="220%" height="240%">
            <feDropShadow dx="0" dy="14" stdDeviation="12" floodColor="#000000" floodOpacity="0.52" />
          </filter>
          <radialGradient id={`spot-${tierId}`}>
            <stop offset="0" stopColor={gold ? "#ffd25e" : "#a7f3f5"} stopOpacity="0.22" />
            <stop offset="1" stopColor="#000000" stopOpacity="0" />
          </radialGradient>
        </defs>

        <ellipse cx="270" cy="202" rx="210" ry="28" fill="#000" opacity="0.42" />
        <ellipse cx="280" cy="105" rx="235" ry="135" fill={`url(#spot-${tierId})`} />
        {tierId === "champion-vault" && <SvgVault />}
        {STACK_LAYOUTS[tierId].map((stack, index) => (
          <CoinStack
            key={`${tierId}-${index}`}
            stack={stack}
            faceId={faceId}
            edgeId={edgeId}
            rimColor={rimColor}
          />
        ))}
        <HeroMedallion
          tierId={tierId}
          faceId={faceId}
          edgeId={edgeId}
          rimColor={rimColor}
        />
      </svg>
    </div>
  );
}

function BalanceCoin() {
  return (
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-gold-bright bg-[radial-gradient(circle_at_35%_28%,#ffe999,#e8b33b_55%,#a56c0f)] text-pitch-950 shadow-[0_0_24px_rgba(255,210,94,0.25)]">
      <svg viewBox="0 0 48 48" className="h-6 w-6" aria-hidden="true">
        <path d="M13 8H35V19C35 28 30 34 24 34S13 28 13 19V8Z" fill="currentColor" />
        <path d="M13 12H7V17C7 23 11 26 16 26V21C13 21 11 19 11 16H13V12ZM35 12H41V17C41 23 37 26 32 26V21C35 21 37 19 37 16H35V12Z" fill="currentColor" />
        <path d="M22 33H26V39H34V43H14V39H22V33Z" fill="currentColor" />
      </svg>
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
    <div className="coin-shop-screen">
      <div className="coin-shop-heading flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
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

      <div className="coin-shop-grid">
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
              className={`coin-shop-card group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-pitch-850/90 transition duration-300 hover:-translate-y-1 ${visual.cardClass}`}
            >
              <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full border border-white/5" />
              <div className="coin-shop-card-head flex items-start justify-between gap-3">
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

              <div className="coin-shop-amount-row flex items-end justify-between gap-4">
                <div>
                  <p className="coin-shop-amount font-score leading-none text-chalk">
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

              <div className="coin-shop-art-wrap">
                <CoinArt tierId={tierId} />
              </div>

              <p className="coin-shop-description text-sm leading-6 text-chalk-dim">{visual.description}</p>

              <div className="coin-shop-purchase mt-auto border-t border-chalk/10">
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

"use client";

import { motion, useReducedMotion } from "framer-motion";
import { HotelCard } from "@/components/HotelCard";
import { usePresentation } from "@/components/PresentationCommentary";
import type { ContenderPayload } from "@/components/types";
import type { TournamentPayload } from "./types";

/**
 * Full-time celebration: the champion card lifts a UEFA-style trophy in a looping
 * animation, then offers the way through to the full results.
 */
export function ChampionCelebration({
  data,
  champion,
  onViewResults,
}: {
  data: TournamentPayload;
  champion?: ContenderPayload;
  onViewResults: () => void;
}) {
  const reduce = useReducedMotion();
  const { commentary, loading, enabled, announce, replayAudio } = usePresentation();
  const isWorld = data.mode === "world";
  const recap = commentary?.event.kind === "competition.recap"
    && commentary.event.tournamentId === data.id
    ? commentary
    : null;
  const lift = reduce
    ? {}
    : {
        animate: { y: [6, -10, 6], rotate: [-1.5, 1.5, -1.5] },
        transition: {
          duration: 3.4,
          repeat: Infinity,
          repeatType: "mirror" as const,
          ease: "easeInOut" as const,
        },
      };

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-10 text-center">
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="eyebrow text-gold-bright"
      >
        Full time · {isWorld ? "World champion" : "Trip champion"}
      </motion.p>
      <motion.h1
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 90 }}
        className="font-display mt-2 text-3xl text-chalk sm:text-4xl"
      >
        {champion?.hotel.name ?? "Champion"} lifts the cup
      </motion.h1>

      <div className="mt-8 flex items-end justify-center gap-6 sm:gap-10">
        {champion && (
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
            className="w-40 sm:w-48"
          >
            <HotelCard
              hotel={champion.hotel}
              stats={champion.stats}
              overall={champion.overall}
              rarity={champion.rarity ?? "legendary"}
              cosmeticSeed={`champ:${data.seed}`}
              compact
            />
          </motion.div>
        )}

        <motion.div {...lift} className="trophy-glow mb-6">
          <Trophy />
        </motion.div>
      </div>

      {/* Confetti */}
      {!reduce && <Confetti seed={data.seed} />}

      <section className="panel relative z-10 mt-8 w-full max-w-2xl rounded-2xl border-gold/30 p-5 text-left">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="eyebrow text-gold-bright">Full-time report</p>
            <p className="mt-1 text-[11px] text-chalk-dim">
              {recap?.captionSource === "gemini"
                ? "AI-written from verified tournament facts"
                : "Verified tournament recap"}
            </p>
          </div>
          {recap?.audioUrl && enabled && (
            <button onClick={replayAudio} className="btn-chalk rounded-lg px-4 py-2 text-xs">
              ↺ Replay voice recap
            </button>
          )}
          {recap && enabled && !recap.audioUrl && recap.audioStatus === "not_requested" && (
            <button
              onClick={() =>
                announce({
                  source: "tournament",
                  tournamentId: data.id,
                  cue: { kind: "competition.recap" },
                })
              }
              className="btn-chalk rounded-lg px-4 py-2 text-xs"
            >
              Play voice recap
            </button>
          )}
        </div>
        <p className="mt-3 text-sm leading-6 text-chalk">
          {recap?.caption ?? (loading ? "Preparing the full-time report…" : "The report is coming in from the commentary desk…")}
        </p>
        {recap && !recap.audioUrl && recap.audioStatus !== "not_requested" && (
          <p className="mt-2 text-[11px] text-chalk-dim">Voice unavailable — the verified recap remains active.</p>
        )}
      </section>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <button onClick={onViewResults} className="btn-gold rounded-lg px-7 py-3 text-lg">
          View full results →
        </button>
        {data.champion?.hotel.bookingUrl && (
          <a
            href={data.champion.hotel.bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-chalk rounded-lg px-5 py-3"
          >
            Book the champion
          </a>
        )}
      </div>
      <p className="mt-4 text-xs text-chalk-dim">
        {data.rewards.userWon
          ? `Your card lifted the trophy! +${data.rewards.userXp} XP, +${data.rewards.userCurrency} coins.`
          : `+${data.rewards.userXp} XP, +${data.rewards.userCurrency} coins.`}
      </p>
    </div>
  );
}

/** Inline UEFA-style trophy — big handles, tall bowl, stepped plinth. */
function Trophy() {
  return (
    <svg width="128" height="176" viewBox="0 0 128 176" fill="none" aria-label="Champions trophy">
      <defs>
        <linearGradient id="cup-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe79c" />
          <stop offset="0.5" stopColor="#ffd25e" />
          <stop offset="1" stopColor="#c8912b" />
        </linearGradient>
      </defs>
      <g stroke="#8a5f18" strokeWidth="1.5">
        {/* handles */}
        <path d="M40 44C18 44 14 74 40 92" fill="none" stroke="url(#cup-gold)" strokeWidth="7" />
        <path d="M88 44C110 44 114 74 88 92" fill="none" stroke="url(#cup-gold)" strokeWidth="7" />
        {/* bowl */}
        <path d="M34 30H94V64C94 92 80 108 64 108C48 108 34 92 34 64V30Z" fill="url(#cup-gold)" />
        {/* rim */}
        <rect x="30" y="24" width="68" height="10" rx="3" fill="url(#cup-gold)" />
        {/* stem */}
        <rect x="58" y="108" width="12" height="20" fill="url(#cup-gold)" />
        {/* base */}
        <rect x="44" y="128" width="40" height="10" rx="2" fill="url(#cup-gold)" />
        <rect x="36" y="138" width="56" height="14" rx="2" fill="url(#cup-gold)" />
        <rect x="30" y="152" width="68" height="14" rx="3" fill="#1b130a" stroke="#8a5f18" />
      </g>
      <ellipse cx="54" cy="52" rx="6" ry="18" fill="#fff3cf" opacity="0.5" />
    </svg>
  );
}

function Confetti({ seed }: { seed: string }) {
  // Deterministic-ish scatter derived from the seed's char codes.
  const pieces = Array.from({ length: 28 }, (_, i) => {
    const c = seed.charCodeAt(i % seed.length) || i;
    const left = (c * 37 + i * 53) % 100;
    const delay = ((c % 10) + i) * 0.08;
    const colors = ["#ffd25e", "#179b72", "#22d3ee", "#eef4f2"];
    return { left, delay, color: colors[i % colors.length], key: i };
  });
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-[60vh] overflow-hidden">
      {pieces.map((p) => (
        <motion.span
          key={p.key}
          className="absolute top-0 h-2 w-1.5 rounded-sm"
          style={{ left: `${p.left}%`, background: p.color }}
          initial={{ y: -20, opacity: 0, rotate: 0 }}
          animate={{ y: "60vh", opacity: [0, 1, 1, 0], rotate: 360 }}
          transition={{ duration: 3.2, repeat: Infinity, delay: p.delay, ease: "easeIn" }}
        />
      ))}
    </div>
  );
}

"use client";

import {
  animate,
  motion,
  useAnimationControls,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { HotelCard } from "@/components/HotelCard";
import type { ContenderPayload } from "@/components/types";
import type { MatchResult } from "@/lib/game/matchSim";
import {
  buildPlaybackTimeline,
  clubAbbrev,
  type PlaybackEvent,
  type Side,
} from "@/lib/presentation/matchPlayback";

/** How long the final score lingers before the scene reports it is finished. */
const HOLD_MS = 1500;

const clampUnit = (v: number) => Math.max(-1, Math.min(1, v));

interface PitchSceneProps {
  match: MatchResult;
  home?: ContenderPayload;
  away?: ContenderPayload;
  roundLabel: string;
  contextLabel: string;
  durationMs: number;
  paused: boolean;
  speed: number;
  seed: string;
  onFinished: () => void;
}

export function PitchScene({
  match,
  home,
  away,
  roundLabel,
  contextLabel,
  durationMs,
  paused,
  speed,
  seed,
  onFinished,
}: PitchSceneProps) {
  const reduce = useReducedMotion();
  const timeline = useMemo(
    () => buildPlaybackTimeline(match, { durationMs, seed }),
    [match, durationMs, seed],
  );

  const momentum = useMotionValue(0);
  const [clockMin, setClockMin] = useState(0);
  const [firedCount, setFiredCount] = useState(0);
  const [ticker, setTicker] = useState<{ key: number; event: PlaybackEvent }[]>([]);
  const [burst, setBurst] = useState<{ side: Side; key: number } | null>(null);
  const [netFlash, setNetFlash] = useState<{ side: Side; key: number } | null>(null);

  // Ball position along the midline, in % (0 = left goal, 100 = right goal).
  const ballLeft = useMotionValue(50);
  const ballLeftPct = useMotionTemplate`${ballLeft}%`;

  const elapsedRef = useRef(0);
  const firedRef = useRef(0);
  const clockRef = useRef(0);
  const shootingRef = useRef(false);
  const shotRef = useRef<ReturnType<typeof animate> | null>(null);
  const homeCtrl = useAnimationControls();
  const awayCtrl = useAnimationControls();

  const homeName = home?.hotel.name ?? "Home";
  const awayName = away?.hotel.name ?? "Away";

  // Under reduced motion the match is shown already finished.
  const shownCount = reduce ? timeline.events.length : firedCount;
  const shown = timeline.events.slice(0, shownCount);
  const last = shown[shown.length - 1];
  const homeScore = last?.homeScore ?? 0;
  const awayScore = last?.awayScore ?? 0;
  const displayClock = reduce ? 90 : clockMin;
  const displayTicker = reduce
    ? timeline.events.slice(-3).map((event, i) => ({ key: i, event }))
    : ticker;

  // Momentum fills grow from the centre line toward the dominant side.
  const homeFill = useTransform(momentum, (m) => `${Math.max(0, -m) * 50}%`);
  const awayFill = useTransform(momentum, (m) => `${Math.max(0, m) * 50}%`);

  const nudge = (side: Side) => {
    const ctrl = side === "home" ? homeCtrl : awayCtrl;
    ctrl.start({ x: side === "home" ? [0, 8, 0] : [0, -8, 0], transition: { duration: 0.45 } });
  };
  const celebrate = (side: Side) => {
    const ctrl = side === "home" ? homeCtrl : awayCtrl;
    ctrl.start({
      scale: [1, 1.14, 1],
      y: [0, -12, 0],
      rotate: side === "home" ? [0, -5, 0] : [0, 5, 0],
      transition: { duration: 0.75, ease: "easeOut" },
    });
  };

  // A goal: drive the ball into the opponents' net, then fire the goal beat
  // (burst + net flash + scorer celebration) and return the ball to the centre.
  const shootBall = (side: Side) => {
    shootingRef.current = true;
    shotRef.current?.stop();
    const target = side === "home" ? 96 : 4; // into the net: home scores right, away left
    const key = Date.now() + Math.random();
    shotRef.current = animate(ballLeft, target, { duration: 0.32, ease: "easeIn" });
    shotRef.current.then(() => {
      setBurst({ side, key });
      setNetFlash({ side, key });
      celebrate(side);
      window.setTimeout(() => {
        shotRef.current = animate(ballLeft, 50, { duration: 0.45, ease: "easeOut" });
        shotRef.current.then(() => {
          shootingRef.current = false;
        });
      }, 700);
    });
  };

  // Clear a goal burst shortly after it fires.
  useEffect(() => {
    if (!burst) return;
    const t = setTimeout(() => setBurst(null), 1200);
    return () => clearTimeout(t);
  }, [burst]);

  // Clear the net flash after its pulse.
  useEffect(() => {
    if (!netFlash) return;
    const t = setTimeout(() => setNetFlash(null), 650);
    return () => clearTimeout(t);
  }, [netFlash]);

  // Reduced motion: no animation loop — the finished match is derived at render;
  // just settle the momentum bar and move on after a brief pause.
  useEffect(() => {
    if (!reduce) return;
    const m = timeline.momentumAt(durationMs);
    momentum.set(m);
    ballLeft.set(50 + clampUnit(m) * 38);
    const t = setTimeout(onFinished, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce, timeline, durationMs]);

  // Playback clock (animated path).
  useEffect(() => {
    if (reduce || paused) return;
    const events = timeline.events;

    const handleFired = (from: number, to: number) => {
      const newlyFired = events.slice(from, to);
      for (const event of newlyFired) {
        if (event.kind === "goal") {
          shootBall(event.side); // burst + celebration fire when the ball hits the net
        } else {
          nudge(event.side);
        }
      }
      setTicker((prev) => {
        const additions = newlyFired.map((event, i) => ({ key: from + i, event }));
        return [...prev, ...additions].slice(-3);
      });
    };

    let raf = 0;
    const startedAt = performance.now() - elapsedRef.current / speed;
    const loop = (now: number) => {
      const e = (now - startedAt) * speed;
      elapsedRef.current = e;
      const play = Math.min(e, durationMs);
      const m = timeline.momentumAt(play);
      momentum.set(m);
      // Ball drifts toward the side with the momentum (unless mid-shot).
      if (!shootingRef.current) ballLeft.set(50 + clampUnit(m) * 38);

      const min = Math.min(90, Math.floor((play / durationMs) * 90));
      if (min !== clockRef.current) {
        clockRef.current = min;
        setClockMin(min);
      }

      let fired = 0;
      while (fired < events.length && events[fired].atMs <= play) fired++;
      if (fired !== firedRef.current) {
        handleFired(firedRef.current, fired);
        firedRef.current = fired;
        setFiredCount(fired);
      }

      if (e >= durationMs + HOLD_MS) {
        setClockMin(90);
        onFinished();
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, speed, reduce, timeline, durationMs]);

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow">{roundLabel}</p>
          <p className="mt-0.5 text-xs text-chalk-dim">{contextLabel}</p>
        </div>
      </div>

      {/* Scorebug */}
      <div className="scorebug mt-3 flex items-stretch overflow-hidden rounded-xl">
        <TeamPlate side="home" name={homeName} isUser={home?.isUserCard} align="left" />
        <div className="flex flex-col items-center justify-center bg-black/40 px-4 py-2">
          <div className="font-score flex items-center gap-2 text-3xl leading-none text-chalk">
            <span>{homeScore}</span>
            <span className="text-chalk-dim">–</span>
            <span>{awayScore}</span>
          </div>
          <div className="font-score mt-1 flex items-center gap-1 text-[11px] text-gold-bright">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-whistle" />
            {displayClock}&apos;
          </div>
        </div>
        <TeamPlate side="away" name={awayName} isUser={away?.isUserCard} align="right" />
      </div>

      {/* Momentum */}
      <div className="mt-2">
        <div className="momentum-track h-2 w-full rounded-full">
          <motion.div
            className="absolute right-1/2 top-0 h-full rounded-l-full bg-turf-bright"
            style={{ width: homeFill }}
          />
          <motion.div
            className="absolute left-1/2 top-0 h-full rounded-r-full bg-gold-bright"
            style={{ width: awayFill }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[9px] uppercase tracking-[0.18em] text-chalk-dim">
          <span>{clubAbbrev(homeName)} momentum</span>
          <span>{clubAbbrev(awayName)} momentum</span>
        </div>
      </div>

      {/* Pitch */}
      <div className="pitch mt-3 aspect-[16/9] w-full sm:aspect-[2/1]">
        <PitchMarkings />

        <PitchCard controls={homeCtrl} contender={home} seed={seed} position="left" />
        <PitchCard controls={awayCtrl} contender={away} seed={seed} position="right" />

        {/* Net flash on the scoring side's goal */}
        {netFlash && (
          <motion.div
            key={netFlash.key}
            className="net-flash pointer-events-none absolute top-1/2 -translate-y-1/2"
            style={{ [netFlash.side === "home" ? "right" : "left"]: "0.5%" }}
            initial={{ opacity: 0, scale: 0.75 }}
            animate={{ opacity: [0, 0.95, 0], scale: [0.75, 1.12, 1] }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        )}

        {/* Soccer ball — rides the midline, position tracks momentum */}
        <motion.div
          data-testid="soccer-ball"
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2"
          style={{ left: ballLeftPct, top: "50%", width: "clamp(1rem, 4.4%, 1.9rem)" }}
        >
          <SoccerBall spinning={!reduce} />
        </motion.div>

        {/* Goal burst */}
        {burst && (
          <motion.div
            key={burst.key}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: [0, 1, 1, 0], scale: [0.6, 1.15, 1.1, 1] }}
            transition={{ duration: 1.1, times: [0, 0.2, 0.7, 1] }}
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <div className="text-center">
              <p className="goal-flash text-5xl sm:text-6xl">GOAL!</p>
              <p className="font-score mt-1 text-sm text-chalk">
                {burst.side === "home" ? clubAbbrev(homeName) : clubAbbrev(awayName)} scores
              </p>
            </div>
          </motion.div>
        )}
      </div>

      {/* Ticker */}
      <div className="mt-3 min-h-[3.5rem] space-y-1">
        {displayTicker.map(({ key, event }) => (
          <motion.div
            key={key}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 text-sm"
          >
            <span
              className={`font-score w-8 shrink-0 text-right ${
                event.kind === "goal" ? "text-turf-bright" : "text-gold-bright"
              }`}
            >
              {event.minute}&apos;
            </span>
            {event.kind === "goal" && (
              <span className="rounded bg-turf-bright/20 px-1 text-[9px] font-semibold uppercase text-turf-bright">
                goal
              </span>
            )}
            <span className={event.kind === "goal" ? "text-chalk" : "text-chalk-dim"}>
              {event.text}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function TeamPlate({
  name,
  isUser,
  align,
}: {
  side: Side;
  name: string;
  isUser?: boolean;
  align: "left" | "right";
}) {
  return (
    <div
      className={`flex flex-1 items-center gap-2 px-3 py-2 ${
        align === "right" ? "flex-row-reverse text-right" : ""
      }`}
    >
      <span
        className={`scorebug-crest inline-block h-6 w-1.5 shrink-0 rounded-full ${
          align === "left" ? "bg-turf-bright" : "bg-gold-bright"
        }`}
      />
      <div className="min-w-0">
        <p className="truncate text-sm text-chalk">{name}</p>
        {isUser && (
          <span className="text-[9px] uppercase tracking-[0.16em] text-gold-bright">your card</span>
        )}
      </div>
    </div>
  );
}

function PitchCard({
  controls,
  contender,
  seed,
  position,
}: {
  controls: ReturnType<typeof useAnimationControls>;
  contender?: ContenderPayload;
  seed: string;
  position: "left" | "right";
}) {
  if (!contender) return null;
  return (
    <motion.div
      animate={controls}
      className="absolute top-1/2 -translate-y-1/2"
      style={{
        [position]: "5%",
        width: "clamp(6.25rem, 21%, 9rem)",
      }}
    >
      <HotelCard
        hotel={contender.hotel}
        stats={contender.stats}
        overall={contender.overall}
        rarity={contender.rarity ?? "legendary"}
        cosmeticSeed={`pitch:${seed}:${contender.propertyId}`}
        compact
        minimal
      />
    </motion.div>
  );
}

/** A stylized soccer ball; the inner group spins continuously via CSS. */
function SoccerBall({ spinning }: { spinning: boolean }) {
  return (
    <svg viewBox="0 0 32 32" className="soccer-ball block w-full" aria-hidden>
      <defs>
        <radialGradient id="ball-shade" cx="38%" cy="34%" r="72%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.68" stopColor="#eef2f4" />
          <stop offset="1" stopColor="#b7c1c6" />
        </radialGradient>
      </defs>
      <circle cx="16" cy="16" r="15" fill="url(#ball-shade)" stroke="#0b0f12" strokeWidth="1.2" />
      <g className={spinning ? "soccer-ball-spin" : undefined}>
        {/* seams from the central pentagon to the rim patches */}
        <g stroke="#0b0f12" strokeWidth="1" strokeLinecap="round">
          <line x1="16" y1="10.8" x2="16" y2="3.2" />
          <line x1="20.95" y1="14.39" x2="28.17" y2="12.05" />
          <line x1="19.06" y1="20.21" x2="23.53" y2="26.68" />
          <line x1="12.94" y1="20.21" x2="8.47" y2="26.68" />
          <line x1="11.05" y1="14.39" x2="3.83" y2="12.05" />
        </g>
        {/* central pentagon */}
        <path d="M16 10.8 L20.95 14.39 L19.06 20.21 L12.94 20.21 L11.05 14.39 Z" fill="#0b0f12" />
        {/* rim patches */}
        <g fill="#0b0f12">
          <circle cx="16" cy="3.2" r="2.1" />
          <circle cx="28.17" cy="12.05" r="2.1" />
          <circle cx="23.53" cy="26.68" r="2.1" />
          <circle cx="8.47" cy="26.68" r="2.1" />
          <circle cx="3.83" cy="12.05" r="2.1" />
        </g>
      </g>
    </svg>
  );
}

/** Chalk pitch markings + goal nets, stretched to fill the pitch. */
function PitchMarkings() {
  return (
    <svg className="pitch-markings" viewBox="0 0 300 180" preserveAspectRatio="none" aria-hidden>
      <defs>
        <pattern id="goal-net" width="7" height="7" patternUnits="userSpaceOnUse">
          <path d="M7 0 L0 7 M0 0 L7 7" stroke="currentColor" strokeWidth="0.5" opacity="0.55" />
        </pattern>
      </defs>
      <g fill="none" stroke="currentColor" strokeWidth={1.4}>
        <rect x={6} y={6} width={288} height={168} rx={4} />
        <line x1={150} y1={6} x2={150} y2={174} />
        <circle cx={150} cy={90} r={26} />
        <circle cx={150} cy={90} r={1.6} fill="currentColor" stroke="none" />
        {/* penalty boxes */}
        <rect x={6} y={54} width={40} height={72} />
        <rect x={254} y={54} width={40} height={72} />
        {/* six-yard boxes */}
        <rect x={6} y={74} width={16} height={32} />
        <rect x={278} y={74} width={16} height={32} />
      </g>
      {/* goal nets at each mouth */}
      <g stroke="currentColor" strokeWidth={1.2}>
        <rect x={1} y={66} width={5} height={48} fill="url(#goal-net)" />
        <rect x={294} y={66} width={5} height={48} fill="url(#goal-net)" />
      </g>
    </svg>
  );
}

"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { HotelCard } from "@/components/HotelCard";
import type { CardPayload } from "@/components/types";
import type { CardStats, Rarity } from "@/lib/game/cardStats";
import type { NormalizedAccommodation } from "@/lib/engine/types";
import { useCurrentUser } from "@/lib/useCurrentUser";

const POLL_INTERVAL_MS = 2000;
/** How long to linger on a performer's lyrics when they have no audio (ElevenLabs unavailable). */
const NO_AUDIO_ADVANCE_MS = 6000;
const MIC_SAMPLE_INTERVAL_MS = 100;

interface KaraokeCardView {
  id: string;
  hotel: NormalizedAccommodation;
  stats: CardStats;
  overall: number;
  rarity: Rarity;
  cosmeticSeed: string;
}

interface KaraokeRewardsView {
  xp: number;
  currency: number;
  won: boolean;
}

interface KaraokeView {
  id: string;
  status: "pending" | "declined" | "picking" | "generating" | "judging" | "complete";
  isPlayer1: boolean;
  invitedByMe: boolean;
  myUsername?: string;
  opponent: { id: string; username?: string };
  myCardId: string | null;
  opponentCardId: string | null;
  myLyrics: string | null;
  opponentLyrics: string | null;
  myAudioCacheKey: string | null;
  opponentAudioCacheKey: string | null;
  myScore: number | null;
  opponentScore: number | null;
  reasoning: string | null;
  winnerId: string | null;
  iWon: boolean | null;
  cards: Record<string, KaraokeCardView>;
  rewards: KaraokeRewardsView | null;
}

interface Performer {
  label: string;
  card: KaraokeCardView | null;
  lyrics: string;
  audioCacheKey: string | null;
  score: number | null;
}

const STATUS_MESSAGE: Record<Exclude<KaraokeView["status"], "pending" | "declined" | "picking">, string> = {
  generating: "Gemini is writing lyrics and ElevenLabs is composing your songs…",
  judging: "Lining up the show…",
  complete: "Lining up the show…",
};

export function KaraokeRoomClient({ duelId }: { duelId: string }) {
  const [view, setView] = useState<KaraokeView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [cards, setCards] = useState<CardPayload[] | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  // Browsers block autoplay-with-sound outright, but muted autoplay is always
  // allowed — so the song always starts, and this just toggles whether you
  // can hear it (no visual scrubber/meter).
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const [micStatus, setMicStatus] = useState<"idle" | "recording" | "denied" | "unsupported">("idle");
  const [micModalOpen, setMicModalOpen] = useState(false);
  const { refresh } = useCurrentUser();
  const rewardedRef = useRef(false);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sampleIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loudnessSamplesRef = useRef<number[]>([]);
  const scoredIndexRef = useRef(-1);

  const stopMicCapture = useCallback(() => {
    if (sampleIntervalRef.current) {
      clearInterval(sampleIntervalRef.current);
      sampleIntervalRef.current = null;
    }
    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      void audioContextRef.current.close();
    }
    audioContextRef.current = null;
  }, []);

  const startMicCapture = useCallback(async () => {
    loudnessSamplesRef.current = [];
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setMicStatus("unsupported");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const AudioContextCtor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) {
        setMicStatus("unsupported");
        return;
      }
      const audioContext = new AudioContextCtor();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);

      const buffer = new Uint8Array(analyser.fftSize);
      sampleIntervalRef.current = setInterval(() => {
        analyser.getByteTimeDomainData(buffer);
        let sumSquares = 0;
        for (let i = 0; i < buffer.length; i++) {
          const normalized = (buffer[i] - 128) / 128;
          sumSquares += normalized * normalized;
        }
        loudnessSamplesRef.current.push(Math.sqrt(sumSquares / buffer.length));
      }, MIC_SAMPLE_INTERVAL_MS);
      setMicStatus("recording");
    } catch {
      setMicStatus("denied");
    }
  }, []);

  /** Average mic RMS while singing along, scaled up so normal singing volume fills 0-100. */
  const computeLoudnessScore = useCallback((): number => {
    const samples = loudnessSamplesRef.current;
    if (samples.length === 0) return 50;
    const avg = samples.reduce((sum, value) => sum + value, 0) / samples.length;
    return Math.max(0, Math.min(100, Math.round(avg * 400)));
  }, []);

  const submitScore = useCallback(
    async (score: number) => {
      try {
        const response = await fetch(`/api/karaoke/${duelId}/score`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ score }),
        });
        const data = await response.json();
        if (response.ok) setView(data);
      } catch {
        // Best-effort — polling will reconcile state either way.
      }
    },
    [duelId],
  );

  useEffect(() => {
    if (view?.status === "complete" && view.rewards && !rewardedRef.current) {
      rewardedRef.current = true;
      void refresh();
    }
  }, [view, refresh]);

  const refetch = useCallback(async () => {
    const response = await fetch(`/api/karaoke/${duelId}`);
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Could not load this karaoke duel");
      return;
    }
    setView(data);
  }, [duelId]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/karaoke/${duelId}`)
      .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (!ok) setError(data.error ?? "Could not load this karaoke duel");
        else setView(data);
      });
    const interval = setInterval(refetch, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [duelId, refetch]);

  // Once matched, if I haven't picked a hotel yet, load my collection to pick from.
  useEffect(() => {
    if (!view || view.status !== "picking" || view.myCardId || cards !== null) return;
    fetch("/api/cards")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Could not load your collection");
        setCards(data.cards);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load your collection"));
  }, [view, cards]);

  async function respond(accept: boolean) {
    setPicking(true);
    setError(null);
    try {
      const response = await fetch(`/api/karaoke/${duelId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accept }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not respond to that invite");
      setView(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not respond to that invite");
    } finally {
      setPicking(false);
    }
  }

  async function confirmPick() {
    if (!pickedId) return;
    setPicking(true);
    setError(null);
    try {
      const response = await fetch(`/api/karaoke/${duelId}/pick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: pickedId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not pick that hotel");
      setView(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not pick that hotel");
    } finally {
      setPicking(false);
    }
  }

  const opponentLabel = view?.opponent?.username ?? "Opponent";
  // The player who was waiting first (player1) always leads — both here and
  // in the performance order below — that's "the earlier hotel."
  const myCard = view && view.myCardId ? view.cards[view.myCardId] : null;
  const opponentCard = view && view.opponentCardId ? view.cards[view.opponentCardId] : null;
  const orderedCards: [KaraokeCardView | null, KaraokeCardView | null] = view?.isPlayer1
    ? [myCard, opponentCard]
    : [opponentCard, myCard];
  const orderedLabels: [string, string] = view?.isPlayer1
    ? [view.myUsername ?? "You", opponentLabel]
    : [opponentLabel, view?.myUsername ?? "You"];

  const performers: Performer[] | null =
    view && view.myLyrics && view.opponentLyrics
      ? (() => {
          const mine: Performer = {
            label: view.myUsername ?? "You",
            card: view.myCardId ? view.cards[view.myCardId] : null,
            lyrics: view.myLyrics,
            audioCacheKey: view.myAudioCacheKey,
            score: view.myScore,
          };
          const theirs: Performer = {
            label: opponentLabel,
            card: view.opponentCardId ? view.cards[view.opponentCardId] : null,
            lyrics: view.opponentLyrics,
            audioCacheKey: view.opponentAudioCacheKey,
            score: view.opponentScore,
          };
          return view.isPlayer1 ? [mine, theirs] : [theirs, mine];
        })()
      : null;

  const currentPerformer = performers?.[activeIndex] ?? null;
  const showComplete = view?.status === "complete" && Boolean(performers) && activeIndex >= (performers?.length ?? 0);
  const myTurnIndex = view ? (view.isPlayer1 ? 0 : 1) : null;
  const isMyTurn = myTurnIndex !== null && activeIndex === myTurnIndex;

  const advance = useCallback(() => {
    setActiveIndex((i) => i + 1);
  }, []);

  // The judge is just a mic: on your own turn, measure your sing-along
  // loudness and submit it when the song ends — no AI judging involved.
  const finishTurn = useCallback(() => {
    if (isMyTurn && scoredIndexRef.current !== activeIndex) {
      scoredIndexRef.current = activeIndex;
      const score = computeLoudnessScore();
      stopMicCapture();
      void submitScore(score);
    }
    advance();
  }, [isMyTurn, activeIndex, computeLoudnessScore, stopMicCapture, submitScore, advance]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted;
  }, [muted, activeIndex]);

  // Each new song is a fresh <audio> element (remounted via the key below),
  // which always starts playing — so the pause toggle shouldn't carry over.
  useEffect(() => {
    setPaused(false);
  }, [activeIndex]);

  function togglePlayback() {
    if (muted) {
      setMuted(false);
      return;
    }
    const audio = audioRef.current;
    if (!audio) return;
    if (paused) {
      void audio.play();
      setPaused(false);
    } else {
      audio.pause();
      setPaused(true);
    }
  }

  // Start listening the moment it's my turn to perform; stop if I navigate
  // away mid-song (finishTurn already stops it on the normal end-of-song path).
  useEffect(() => {
    if (!isMyTurn || scoredIndexRef.current === activeIndex) return;
    setMicStatus("idle");
    setMicModalOpen(true);
    void startMicCapture();
    return () => stopMicCapture();
  }, [isMyTurn, activeIndex, startMicCapture, stopMicCapture]);

  // The popup's job is done once the mic is actually capturing.
  useEffect(() => {
    if (micStatus === "recording") setMicModalOpen(false);
  }, [micStatus]);

  // Drive the show: play the current performer's song, or — if ElevenLabs
  // never produced audio for them — linger on their lyrics for a beat before
  // auto-advancing, so the sequence always finishes on its own.
  useEffect(() => {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    if (!currentPerformer || currentPerformer.audioCacheKey) return;
    advanceTimerRef.current = setTimeout(finishTurn, NO_AUDIO_ADVANCE_MS);
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, [currentPerformer, finishTurn]);

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

  if (!view) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center text-chalk-dim">
        Loading karaoke duel…
      </div>
    );
  }

  if (view.status === "pending") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <p className="eyebrow">1v1 · bonus mode · karaoke duel</p>
        {view.invitedByMe ? (
          <>
            <h1 className="font-display mt-2 text-2xl text-chalk">
              Waiting for {opponentLabel} to accept…
            </h1>
            <p className="mt-2 text-sm text-chalk-dim">
              You challenged {opponentLabel} to a bonus karaoke round. We&apos;ll jump in the
              moment they accept.
            </p>
            <div className="mx-auto mt-6 h-10 w-10 animate-spin rounded-full border-2 border-cyan-bright border-t-transparent" />
          </>
        ) : (
          <>
            <h1 className="font-display mt-2 text-2xl text-chalk">
              {opponentLabel} challenged you to a karaoke duel!
            </h1>
            <p className="mt-2 text-sm text-chalk-dim">
              One hotel each, Gemini writes the songs, ElevenLabs performs them — then you both
              sing along and whoever&apos;s loudest wins.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                onClick={() => respond(true)}
                disabled={picking}
                className="btn-primary rounded-lg px-6 py-2.5 disabled:opacity-40"
              >
                Accept
              </button>
              <button
                onClick={() => respond(false)}
                disabled={picking}
                className="btn-chalk rounded-lg px-6 py-2.5 disabled:opacity-40"
              >
                Decline
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  if (view.status === "declined") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <p className="font-display text-xl text-chalk">
          {view.invitedByMe ? `${opponentLabel} declined the karaoke duel.` : "Invite declined."}
        </p>
        <Link href="/collection" className="btn-chalk mt-4 inline-block rounded-lg px-5 py-2.5">
          Back to collection
        </Link>
      </div>
    );
  }

  if (view.status === "picking" && !view.myCardId) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <p className="eyebrow">1v1 · bonus mode · karaoke duel</p>
        <h1 className="font-display mt-2 text-3xl text-chalk">Pick the hotel you&apos;ll sing about</h1>
        <p className="mt-2 text-sm text-chalk-dim">
          You&apos;re up against {opponentLabel}. Gemini writes a song about your hotel, ElevenLabs
          performs it — then whoever sings along loudest wins.
        </p>

        {cards === null ? (
          <p className="mt-8 text-chalk-dim">Loading your collection…</p>
        ) : (
          <>
            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {cards.map((card) => {
                const isSelected = pickedId === card.id;
                return (
                  <button
                    key={card.id}
                    onClick={() => setPickedId(card.id)}
                    className={`relative rounded-xl text-left transition ${
                      isSelected ? "ring-2 ring-cyan-bright" : "hover:-translate-y-1"
                    }`}
                  >
                    <HotelCard
                      hotel={card.hotel}
                      stats={card.stats}
                      overall={card.overall}
                      rarity={card.rarity}
                      cosmeticSeed={card.cosmeticSeed}
                      compact
                    />
                  </button>
                );
              })}
            </div>

            <button
              onClick={confirmPick}
              disabled={!pickedId || picking}
              className="btn-primary mt-6 w-full rounded-lg px-6 py-3 text-lg disabled:opacity-40"
            >
              {pickedId ? "Confirm Song Choice" : "Select a hotel to sing about"}
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      {micModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="panel max-w-sm rounded-2xl p-6 text-center">
            <p className="font-display text-xl text-chalk">🎤 It&apos;s your turn to sing!</p>
            <p className="mt-2 text-sm text-chalk-dim">
              The loudest singer wins the karaoke duel — enable your microphone so we can score
              your performance.
            </p>
            {micStatus === "denied" && (
              <p className="mt-3 text-xs text-whistle">
                Microphone access is blocked. Enable microphone permissions for this site in your
                browser settings, then try again.
              </p>
            )}
            {micStatus === "unsupported" ? (
              <button
                onClick={() => setMicModalOpen(false)}
                className="btn-chalk mt-5 rounded-lg px-6 py-2.5"
              >
                Continue without mic
              </button>
            ) : (
              <button
                onClick={() => void startMicCapture()}
                disabled={micStatus === "idle"}
                className="btn-primary mt-5 rounded-lg px-6 py-2.5 disabled:opacity-40"
              >
                {micStatus === "denied" ? "Try again" : "Requesting microphone…"}
              </button>
            )}
          </div>
        </div>
      )}
      <p className="eyebrow text-center">1v1 · bonus mode · karaoke duel</p>
      <h1 className="font-display mt-2 text-center text-3xl text-chalk">
        {view.myUsername ?? "You"} vs {opponentLabel}
      </h1>

      {showComplete ? (
        <MatchComplete view={view} opponentLabel={opponentLabel} />
      ) : (
        <div className="mt-4 flex items-center justify-center gap-3 text-center text-sm text-chalk-dim">
          {(view.status !== "picking" || !performers) && (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-bright border-t-transparent" />
          )}
          {view.status === "picking"
            ? `Waiting for ${opponentLabel} to pick their hotel…`
            : performers
              ? STATUS_MESSAGE.judging
              : STATUS_MESSAGE[view.status]}
        </div>
      )}

      {performers && currentPerformer && !showComplete && (
        <motion.div
          key={activeIndex}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="panel mt-6 rounded-2xl p-6 sm:p-8"
        >
          <p className="eyebrow text-center">
            Now performing · song {activeIndex + 1} of {performers.length}
          </p>
          <h2 className="font-display mt-2 text-center text-2xl text-chalk">{currentPerformer.label}</h2>

          {isMyTurn && (
            <p className="mt-3 text-center text-xs text-chalk-dim">
              {micStatus === "recording" && "🎤 Sing along — we're listening!"}
              {micStatus === "denied" && "Mic access denied — submitting a default score."}
              {micStatus === "unsupported" && "Mic capture isn't supported here — submitting a default score."}
              {micStatus === "idle" && "🎤 Get ready to sing along…"}
            </p>
          )}

          {currentPerformer.audioCacheKey && (
            <div className="mt-5 flex justify-center">
              <audio
                key={`${duelId}-${activeIndex}`}
                ref={audioRef}
                autoPlay
                muted={muted}
                playsInline
                src={`/api/karaoke/audio/${currentPerformer.audioCacheKey}`}
                onEnded={finishTurn}
              />
              <button onClick={togglePlayback} className="btn-chalk rounded-lg px-4 py-2 text-sm">
                {muted ? "▶️ Start" : paused ? "▶️ Play" : "⏸ Pause"}
              </button>
            </div>
          )}

          <FloatingLyrics lyrics={currentPerformer.lyrics} />
        </motion.div>
      )}

      <div className="mt-10 grid gap-8 md:grid-cols-2">
        <HotelPanel
          label={orderedLabels[0]}
          card={orderedCards[0]}
          performer={performers?.[0] ?? null}
          state={!performers ? "pending" : activeIndex > 0 ? "done" : activeIndex === 0 ? "performing" : "upcoming"}
          dimmed={Boolean(performers) && activeIndex < (performers?.length ?? 0) && activeIndex !== 0}
        />
        <HotelPanel
          label={orderedLabels[1]}
          card={orderedCards[1]}
          performer={performers?.[1] ?? null}
          state={!performers ? "pending" : activeIndex > 1 ? "done" : activeIndex === 1 ? "performing" : "upcoming"}
          dimmed={Boolean(performers) && activeIndex < (performers?.length ?? 0) && activeIndex !== 1}
        />
      </div>

      {showComplete && view.reasoning && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="panel mt-8 rounded-2xl p-6 text-center"
        >
          <p className="eyebrow">The verdict</p>
          <p className="mt-2 text-chalk">{view.reasoning}</p>
        </motion.div>
      )}
    </div>
  );
}

/** Karaoke-caption style: lines fade in staggered, then bob gently at slightly offset periods. */
function FloatingLyrics({ lyrics }: { lyrics: string }) {
  const lines = lyrics
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("["));

  return (
    <div className="relative mt-6 flex min-h-28 flex-col items-center justify-center gap-3">
      {lines.map((line, index) => (
        <motion.p
          key={`${index}-${line}`}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: [0, -6, 0] }}
          transition={{
            opacity: { duration: 0.5, delay: index * 0.15 },
            y: {
              duration: 3 + index * 0.3,
              repeat: Infinity,
              ease: "easeInOut",
              delay: index * 0.15,
            },
          }}
          className="text-center font-sans text-lg text-chalk"
        >
          {line}
        </motion.p>
      ))}
    </div>
  );
}

function HotelPanel({
  label,
  card,
  performer,
  state,
  dimmed,
}: {
  label: string;
  card: KaraokeCardView | null;
  performer: Performer | null;
  state: "pending" | "upcoming" | "performing" | "done";
  dimmed: boolean;
}) {
  return (
    <div className={`transition-opacity duration-300 ${dimmed ? "opacity-35 grayscale" : "opacity-100"}`}>
      <p className="eyebrow mb-3 flex items-center justify-between">
        <span>{card ? `${label}'s hotel` : "Loading…"}</span>
        {state === "done" && performer?.score !== null && performer?.score !== undefined && (
          <span className="font-score text-chalk">{performer.score}/100</span>
        )}
      </p>
      <div className={`rounded-xl transition ${state === "performing" ? "ring-2 ring-cyan-bright" : ""}`}>
        {card ? (
          <HotelCard
            hotel={card.hotel}
            stats={card.stats}
            overall={card.overall}
            rarity={card.rarity}
            cosmeticSeed={card.cosmeticSeed}
            compact
          />
        ) : (
          <div className="panel rounded-xl p-6 text-center text-sm text-chalk-dim">
            {state === "pending" ? "Waiting for their pick…" : "Loading hotel…"}
          </div>
        )}
      </div>

      {state === "done" ? (
        <div className="panel mt-4 rounded-xl p-4 text-center text-sm text-chalk-dim">Performed</div>
      ) : state === "performing" ? (
        <div className="panel mt-4 rounded-xl p-4 text-center text-sm text-cyan-bright">Performing now…</div>
      ) : state === "upcoming" ? (
        <div className="panel mt-4 rounded-xl p-4 text-center text-sm text-chalk-dim">Up next…</div>
      ) : card ? (
        <div className="panel mt-4 rounded-xl p-4 text-center text-sm text-chalk-dim">Composing their song…</div>
      ) : null}
    </div>
  );
}

function MatchComplete({ view, opponentLabel }: { view: KaraokeView; opponentLabel: string }) {
  return (
    <div className="panel mt-6 rounded-2xl p-8 text-center">
      <p className="eyebrow">{view.iWon ? "Showstopper" : "Better luck next verse"}</p>
      <h2 className="font-display mt-2 text-2xl text-chalk">
        {view.iWon ? "You won the karaoke duel!" : `${opponentLabel} stole the show.`}
      </h2>
      {view.rewards && (
        <p className="mt-2 text-sm text-chalk-dim">
          +{view.rewards.xp} XP{view.rewards.currency > 0 ? ` · +${view.rewards.currency} currency` : ""}
        </p>
      )}
      <div className="mt-6 flex justify-center gap-3">
        <Link href="/duel" className="btn-primary rounded-lg px-6 py-2.5">
          Play another duel
        </Link>
        <Link href="/collection" className="btn-chalk rounded-lg px-6 py-2.5">
          Back to collection
        </Link>
      </div>
    </div>
  );
}

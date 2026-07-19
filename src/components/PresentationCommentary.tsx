"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  CommentaryRequest,
  CommentaryResponse,
  JourneyMoment,
} from "@/lib/presentation/types";

type MusicCue = "intro" | "final" | "victory";

const MUSIC_URLS: Record<MusicCue, string | undefined> = {
  intro: process.env.NEXT_PUBLIC_PRESENTATION_INTRO_MUSIC_URL,
  final: process.env.NEXT_PUBLIC_PRESENTATION_FINAL_MUSIC_URL,
  victory: process.env.NEXT_PUBLIC_PRESENTATION_VICTORY_MUSIC_URL,
};

interface PresentationContextValue {
  announce: (request: CommentaryRequest) => void;
}

const PresentationContext = createContext<PresentationContextValue | null>(null);

export function usePresentation(): PresentationContextValue {
  const context = useContext(PresentationContext);
  if (!context) throw new Error("usePresentation must be used inside PresentationProvider");
  return context;
}

export function PresentationProvider({ children }: { children: React.ReactNode }) {
  const [announcement, setAnnouncement] = useState<{
    request: CommentaryRequest;
    nonce: number;
  } | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [commentary, setCommentary] = useState<CommentaryResponse | null>(null);
  const [commentaryError, setCommentaryError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [playbackBlocked, setPlaybackBlocked] = useState(false);
  const [playNonce, setPlayNonce] = useState(0);
  const voiceRef = useRef<HTMLAudioElement | null>(null);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const requestSequence = useRef(0);

  const announce = useCallback((request: CommentaryRequest) => {
    setAnnouncement((previous) => ({ request, nonce: (previous?.nonce ?? 0) + 1 }));
  }, []);

  const loadAnnouncement = useCallback(
    async (current: { request: CommentaryRequest; nonce: number }, requestAudio: boolean) => {
      const sequence = ++requestSequence.current;
      setLoading(true);
      setCommentaryError(null);
      try {
        const response = await fetch("/api/presentation/commentary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...current.request, audio: requestAudio }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Commentary is unavailable");
        if (sequence !== requestSequence.current) return;
        setCommentary(payload as CommentaryResponse);
        setPlayNonce(current.nonce);
      } catch (error) {
        if (sequence === requestSequence.current) {
          setCommentary(null);
          setCommentaryError(
            error instanceof Error ? error.message : "Commentary is unavailable",
          );
          setPlaybackBlocked(false);
        }
      } finally {
        if (sequence === requestSequence.current) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!announcement) return;
    const timer = window.setTimeout(
      () => void loadAnnouncement(announcement, enabled),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [announcement, enabled, loadAnnouncement]);

  useEffect(() => {
    const voice = voiceRef.current;
    if (!voice || !commentary?.audioUrl || !enabled) return;
    voice.src = commentary.audioUrl;
    voice.currentTime = 0;
    void voice.play()
      .then(() => setPlaybackBlocked(false))
      .catch(() => {
        setPlaying(false);
        setPlaybackBlocked(true);
      });
  }, [commentary?.audioUrl, enabled, playNonce]);

  useEffect(() => {
    const music = musicRef.current;
    if (!music) return;
    const musicCue = musicCueFor(commentary);
    const url = musicCue ? MUSIC_URLS[musicCue] : undefined;
    if (!enabled || !url) {
      music.pause();
      return;
    }
    let resolvedUrl: string;
    try {
      resolvedUrl = new URL(url, window.location.href).href;
    } catch {
      music.pause();
      return;
    }
    if (music.src !== resolvedUrl) music.src = url;
    music.volume = 0.12;
    music.loop = musicCue !== "victory";
    void music.play().catch(() => undefined);
  }, [commentary, enabled]);

  function toggleAudio() {
    const next = !enabled;
    setEnabled(next);
    if (!next) {
      voiceRef.current?.pause();
      musicRef.current?.pause();
      setPlaying(false);
      setPlaybackBlocked(false);
    }
  }

  function togglePlayback() {
    const voice = voiceRef.current;
    if (!commentary?.audioUrl) {
      if (announcement && enabled && !loading) {
        void loadAnnouncement(announcement, true);
      }
      return;
    }
    if (!voice) return;
    if (voice.paused) {
      void voice.play().then(() => setPlaybackBlocked(false)).catch(() => setPlaybackBlocked(true));
    } else {
      voice.pause();
    }
  }

  const fallback =
    enabled && commentary && commentary.audioStatus !== "ready"
      ? commentary.audioStatus === "quota"
        ? "Voice budget reached — captions remain active."
        : "Voice unavailable — captions remain active."
      : null;
  const voiceButtonLabel = loading
    ? "Loading voice"
    : commentary?.audioUrl
      ? playing
        ? "Pause"
        : playbackBlocked
          ? "Play voice"
          : "Replay"
      : commentaryError || fallback
        ? "Retry voice"
        : announcement
          ? "Voice pending"
          : "Awaiting cue";
  const voiceActionDisabled = loading || !announcement;

  return (
    <PresentationContext.Provider value={{ announce }}>
      {children}
      <aside className="panel fixed inset-x-4 bottom-4 z-[60] mx-auto max-w-2xl rounded-xl p-3 shadow-2xl shadow-black/50">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1" aria-live="polite">
              <p className="eyebrow !text-[9px]">Matchday commentary</p>
              <p className="mt-0.5 text-sm text-chalk-dim">
                {loading
                  ? "The commentator is checking the team sheet…"
                  : commentary?.caption ?? commentaryError ?? "Voice commentary is ready."}
              </p>
              {fallback && <p className="mt-0.5 text-[10px] text-gold-bright">{fallback}</p>}
              {playbackBlocked && (
                <p className="mt-0.5 text-[10px] text-gold-bright">
                  Your browser blocked autoplay — press Play voice once.
                </p>
              )}
            </div>
            {enabled && (
              <button
                onClick={togglePlayback}
                disabled={voiceActionDisabled}
                className="btn-chalk shrink-0 rounded px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
              >
                {voiceButtonLabel}
              </button>
            )}
            <button onClick={toggleAudio} className="btn-gold shrink-0 rounded px-3 py-1.5 text-xs">
              Voice {enabled ? "on" : "off"}
            </button>
          </div>
          <audio
            ref={voiceRef}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
          />
          <audio ref={musicRef} />
        </aside>
    </PresentationContext.Provider>
  );
}

export function JourneyCommentaryCue({ moment }: { moment: JourneyMoment }) {
  const { announce } = usePresentation();
  useEffect(() => {
    const timer = window.setTimeout(
      () => announce({ source: "journey", cue: { kind: "journey.moment", moment } }),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [announce, moment]);
  return null;
}

function musicCueFor(commentary: CommentaryResponse | null): MusicCue | null {
  if (!commentary) return null;
  if (commentary.event.kind === "competition.champion") return "victory";
  if (commentary.event.kind === "competition.intro") return "final";
  if (commentary.event.kind !== "journey.moment") return null;
  if (commentary.event.moment === "welcome" || commentary.event.moment === "pack.selection") {
    return "intro";
  }
  if (commentary.event.moment === "tournament.simulating") return "final";
  return null;
}

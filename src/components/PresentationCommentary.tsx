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
const AUDIO_PREFERENCE_KEY = "check-in-champions:commentary-audio";

const MUSIC_URLS: Record<MusicCue, string | undefined> = {
  intro: process.env.NEXT_PUBLIC_PRESENTATION_INTRO_MUSIC_URL,
  final: process.env.NEXT_PUBLIC_PRESENTATION_FINAL_MUSIC_URL,
  victory: process.env.NEXT_PUBLIC_PRESENTATION_VICTORY_MUSIC_URL,
};

interface PresentationContextValue {
  announce: (request: CommentaryRequest) => void;
  enabled: boolean;
  playbackBlocked: boolean;
  toggleAudio: () => void;
  togglePlayback: () => void;
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
  const [enabled, setEnabled] = useState(() =>
    typeof window === "undefined"
      ? true
      : window.localStorage.getItem(AUDIO_PREFERENCE_KEY) !== "muted",
  );
  const [commentary, setCommentary] = useState<CommentaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
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
      } catch {
        if (sequence === requestSequence.current) {
          setCommentary(null);
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
    window.localStorage.setItem(AUDIO_PREFERENCE_KEY, next ? "on" : "muted");
    if (!next) {
      voiceRef.current?.pause();
      musicRef.current?.pause();
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

  return (
    <PresentationContext.Provider
      value={{
        announce,
        enabled,
        playbackBlocked,
        toggleAudio,
        togglePlayback,
      }}
    >
      {children}
      <audio ref={voiceRef} />
      <audio ref={musicRef} />
    </PresentationContext.Provider>
  );
}

export function PresentationMuteButton({ compact = false }: { compact?: boolean }) {
  const { enabled, playbackBlocked, toggleAudio, togglePlayback } = usePresentation();
  const needsPlayback = enabled && playbackBlocked;
  const Icon = enabled || needsPlayback ? IconVolumeOn : IconVolumeMuted;
  return (
    <button
      onClick={needsPlayback ? togglePlayback : toggleAudio}
      aria-pressed={needsPlayback ? undefined : !enabled}
      aria-label={
        needsPlayback
          ? "Play voice commentary"
          : enabled
            ? "Mute voice commentary"
            : "Unmute voice commentary"
      }
      title={
        needsPlayback
          ? "Play voice commentary"
          : enabled
            ? "Mute voice commentary"
            : "Unmute voice commentary"
      }
      className={`${needsPlayback ? "btn-gold" : "btn-chalk"} inline-flex shrink-0 items-center justify-center rounded-lg ${
        compact ? "h-8 w-8" : "h-9 w-9"
      }`}
    >
      <Icon className={compact ? "h-4 w-4" : "h-5 w-5"} />
    </button>
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

function IconVolumeOn({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 8v4h3.2L10 15.2V4.8L6.2 8H3Z" />
      <path d="M13 7.2a4 4 0 0 1 0 5.6" />
      <path d="M15.6 4.8a7.5 7.5 0 0 1 0 10.4" />
    </svg>
  );
}

function IconVolumeMuted({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 8v4h3.2L10 15.2V4.8L6.2 8H3Z" />
      <path d="m13.2 7.8 4 4" />
      <path d="m17.2 7.8-4 4" />
    </svg>
  );
}

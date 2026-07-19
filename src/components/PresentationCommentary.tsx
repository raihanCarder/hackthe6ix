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
  type QueuedAnnouncement = { request: CommentaryRequest; nonce: number };
  const [announcement, setAnnouncement] = useState<{
    request: CommentaryRequest;
    nonce: number;
  } | null>(null);
  // A fresh login/page session always starts with commentary enabled. The
  // provider persists across client-side navigation, so mute still applies
  // throughout the current journey without becoming a hidden permanent state.
  const [enabled, setEnabled] = useState(true);
  const [commentary, setCommentary] = useState<CommentaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [playbackBlocked, setPlaybackBlocked] = useState(false);
  const [playNonce, setPlayNonce] = useState(0);
  const voiceRef = useRef<HTMLAudioElement | null>(null);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const requestSequence = useRef(0);
  const announcementNonce = useRef(0);
  const activeAnnouncement = useRef<QueuedAnnouncement | null>(null);
  const announcementQueue = useRef<QueuedAnnouncement[]>([]);
  const enabledRef = useRef(enabled);

  const finishAnnouncement = useCallback(() => {
    const next = announcementQueue.current.shift() ?? null;
    activeAnnouncement.current = next;
    setAnnouncement(next);
  }, []);

  const announce = useCallback((request: CommentaryRequest) => {
    if (!enabledRef.current) return;
    const queued = { request, nonce: ++announcementNonce.current };
    const active = activeAnnouncement.current;
    if (active && isGoalRequest(request) && !isGoalRequest(active.request)) {
      voiceRef.current?.pause();
      requestSequence.current++;
      announcementQueue.current = announcementQueue.current.filter(({ request: pending }) =>
        isGoalRequest(pending),
      );
      activeAnnouncement.current = queued;
      setAnnouncement(queued);
      setCommentary(null);
      setLoading(false);
      setPlaybackBlocked(false);
      return;
    }
    if (active) {
      announcementQueue.current.push(queued);
      return;
    }
    activeAnnouncement.current = queued;
    setAnnouncement(queued);
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
        const nextCommentary = payload as CommentaryResponse;
        setCommentary(nextCommentary);
        setPlayNonce(current.nonce);
        if (!requestAudio || !nextCommentary.audioUrl) finishAnnouncement();
      } catch {
        if (sequence === requestSequence.current) {
          setCommentary(null);
          setPlaybackBlocked(false);
          finishAnnouncement();
        }
      } finally {
        if (sequence === requestSequence.current) setLoading(false);
      }
    },
    [finishAnnouncement],
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
    const currentNonce = playNonce;
    voice.src = commentary.audioUrl;
    voice.currentTime = 0;
    void voice.play()
      .then(() => setPlaybackBlocked(false))
      .catch(() => {
        if (activeAnnouncement.current?.nonce === currentNonce) {
          setPlaybackBlocked(true);
        }
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
    enabledRef.current = next;
    setEnabled(next);
    if (!next) {
      voiceRef.current?.pause();
      musicRef.current?.pause();
      requestSequence.current++;
      announcementQueue.current = [];
      activeAnnouncement.current = null;
      setAnnouncement(null);
      setCommentary(null);
      setLoading(false);
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
      <audio
        ref={voiceRef}
        onEnded={finishAnnouncement}
        onError={() => {
          setPlaybackBlocked(false);
          finishAnnouncement();
        }}
      />
      <audio ref={musicRef} />
    </PresentationContext.Provider>
  );
}

function isGoalRequest(request: CommentaryRequest): boolean {
  return request.source === "tournament" && request.cue.kind === "match.goal";
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
      className={`${needsPlayback ? "btn-gold" : "btn-chalk"} inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg ${
        compact ? "h-8 px-2.5 text-xs" : "h-9 px-3 text-sm"
      }`}
    >
      <Icon className={compact ? "h-4 w-4" : "h-5 w-5"} />
      <span>{needsPlayback ? "Play voice" : enabled ? "Mute voice" : "Unmute voice"}</span>
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

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CommentaryResponse, PresentationCue } from "@/lib/presentation/types";

type MusicCue = "intro" | "final" | "victory";

const MUSIC_URLS: Record<MusicCue, string | undefined> = {
  intro: process.env.NEXT_PUBLIC_PRESENTATION_INTRO_MUSIC_URL,
  final: process.env.NEXT_PUBLIC_PRESENTATION_FINAL_MUSIC_URL,
  victory: process.env.NEXT_PUBLIC_PRESENTATION_VICTORY_MUSIC_URL,
};

export function PresentationCommentary({
  tournamentId,
  cue,
  musicCue,
}: {
  tournamentId: string;
  cue: PresentationCue | null;
  musicCue: MusicCue;
}) {
  const [enabled, setEnabled] = useState(false);
  const [commentary, setCommentary] = useState<CommentaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const voiceRef = useRef<HTMLAudioElement | null>(null);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const requestSequence = useRef(0);

  const loadCue = useCallback(
    async (nextCue: PresentationCue, requestAudio: boolean) => {
      const sequence = ++requestSequence.current;
      setLoading(true);
      try {
        const response = await fetch("/api/presentation/commentary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tournamentId, cue: nextCue, audio: requestAudio }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Commentary is unavailable");
        if (sequence !== requestSequence.current) return;
        setCommentary(payload as CommentaryResponse);
      } catch {
        if (sequence === requestSequence.current) setCommentary(null);
      } finally {
        if (sequence === requestSequence.current) setLoading(false);
      }
    },
    [tournamentId],
  );

  useEffect(() => {
    if (!cue) return;
    const timer = window.setTimeout(() => void loadCue(cue, enabled), 0);
    return () => window.clearTimeout(timer);
  }, [cue, enabled, loadCue]);

  useEffect(() => {
    const voice = voiceRef.current;
    if (!voice || !commentary?.audioUrl || !enabled) return;
    voice.src = commentary.audioUrl;
    voice.currentTime = 0;
    void voice.play().catch(() => setPlaying(false));
  }, [commentary?.audioUrl, enabled]);

  useEffect(() => {
    const music = musicRef.current;
    const url = MUSIC_URLS[musicCue];
    if (!music) return;
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
  }, [enabled, musicCue]);

  function toggleAudio() {
    const next = !enabled;
    setEnabled(next);
    if (!next) {
      voiceRef.current?.pause();
      musicRef.current?.pause();
      setPlaying(false);
    }
  }

  function togglePlayback() {
    const voice = voiceRef.current;
    if (!voice || !commentary?.audioUrl) return;
    if (voice.paused) {
      void voice.play().catch(() => setPlaying(false));
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

  return (
    <aside className="panel fixed inset-x-4 bottom-4 z-[60] mx-auto max-w-2xl rounded-xl p-3 shadow-2xl shadow-black/50">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1" aria-live="polite">
          <p className="eyebrow !text-[9px]">Matchday commentary</p>
          <p className="mt-0.5 text-sm text-chalk-dim">
            {loading ? "The commentator is checking the team sheet…" : commentary?.caption ?? "Captions ready."}
          </p>
          {fallback && <p className="mt-0.5 text-[10px] text-gold-bright">{fallback}</p>}
        </div>
        {commentary?.audioUrl && enabled && (
          <button onClick={togglePlayback} className="btn-chalk shrink-0 rounded px-3 py-1.5 text-xs">
            {playing ? "Pause" : "Replay"}
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
  );
}

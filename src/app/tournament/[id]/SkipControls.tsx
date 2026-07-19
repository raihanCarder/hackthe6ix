"use client";

export interface JumpTarget {
  label: string;
  index: number;
}

/**
 * Sticky broadcast controls: play/pause, speed, skip the current beat, and
 * context-aware jumps to any result still ahead (a group result, the whole group
 * stage, a knockout round, or straight to the champion).
 */
export function SkipControls({
  paused,
  onTogglePause,
  speed,
  onCycleSpeed,
  onSkipSegment,
  jumps,
  onJump,
  atEnd,
}: {
  paused: boolean;
  onTogglePause: () => void;
  speed: number;
  onCycleSpeed: () => void;
  onSkipSegment: () => void;
  jumps: JumpTarget[];
  onJump: (index: number) => void;
  atEnd: boolean;
}) {
  return (
    <div className="sticky bottom-0 z-20 mt-6 border-t border-white/10 bg-pitch-950/85 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-4 py-3">
        {!atEnd && (
          <>
            <button
              onClick={onTogglePause}
              className="btn-chalk rounded-lg px-4 py-2 text-sm"
              aria-pressed={paused}
            >
              {paused ? "▶ Play" : "❚❚ Pause"}
            </button>
            <button onClick={onCycleSpeed} className="btn-chalk rounded-lg px-3 py-2 text-sm">
              {speed}× speed
            </button>
            <button onClick={onSkipSegment} className="btn-chalk rounded-lg px-3 py-2 text-sm">
              Skip ›
            </button>

            <span className="mx-1 hidden h-6 w-px bg-white/10 sm:block" />

            <div className="flex flex-wrap items-center gap-2">
              {jumps.map((jump) => (
                <button
                  key={`${jump.index}-${jump.label}`}
                  onClick={() => onJump(jump.index)}
                  className="btn-chalk rounded-lg px-3 py-2 text-xs"
                >
                  {jump.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

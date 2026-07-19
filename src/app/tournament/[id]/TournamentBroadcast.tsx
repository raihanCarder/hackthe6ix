"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePresentation } from "@/components/PresentationCommentary";
import type { ContenderPayload } from "@/components/types";
import type { GroupResult, MatchResult } from "@/lib/game/matchSim";
import { ChampionCelebration } from "./ChampionCelebration";
import { PitchScene } from "./PitchScene";
import { GroupResultView, GroupStageSummary, RoundResultView } from "./SegmentSummary";
import { SkipControls, type JumpTarget } from "./SkipControls";
import { ROUND_LABELS, type TournamentPayload } from "./types";

const MATCH_DURATION_MS = 8500;
const DWELL_MS: Record<string, number> = {
  "group-result": 3200,
  "group-stage-summary": 4400,
  "round-result": 3200,
};
const SPEEDS = [1, 2, 3];

type Segment =
  | { kind: "match"; match: MatchResult; roundLabel: string; contextLabel: string }
  | { kind: "group-result"; group: GroupResult }
  | { kind: "group-stage-summary" }
  | { kind: "round-result"; round: { round: string; matches: MatchResult[] } }
  | { kind: "champion" };

export function TournamentBroadcast({
  data,
  onFinish,
}: {
  data: TournamentPayload;
  onFinish: () => void;
}) {
  const { announce } = usePresentation();
  const [cursor, setCursor] = useState(0);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);

  const byId = useMemo(
    () => new Map<string, ContenderPayload>(data.contenders.map((c) => [c.propertyId, c])),
    [data],
  );

  const segments = useMemo<Segment[]>(() => {
    const list: Segment[] = [];
    data.groups.forEach((group) => {
      group.matches.forEach((match, mi) => {
        list.push({
          kind: "match",
          match,
          roundLabel: `Group ${group.name}`,
          contextLabel: `Match ${mi + 1} of ${group.matches.length}`,
        });
      });
      list.push({ kind: "group-result", group });
    });
    if (data.groups.length) list.push({ kind: "group-stage-summary" });
    data.knockout.forEach((round, ri) => {
      const label = ROUND_LABELS[round.round] ?? round.round;
      round.matches.forEach((match, mi) => {
        list.push({
          kind: "match",
          match,
          roundLabel: label,
          contextLabel: round.matches.length > 1 ? `Match ${mi + 1} of ${round.matches.length}` : "Winner takes it",
        });
      });
      if (ri < data.knockout.length - 1) list.push({ kind: "round-result", round });
    });
    list.push({ kind: "champion" });
    return list;
  }, [data]);

  const allTargets = useMemo<JumpTarget[]>(() => {
    const targets: JumpTarget[] = [];
    segments.forEach((seg, idx) => {
      if (seg.kind === "group-result") targets.push({ label: `Group ${seg.group.name} result`, index: idx });
      else if (seg.kind === "group-stage-summary") targets.push({ label: "Group stage result", index: idx });
      else if (seg.kind === "round-result")
        targets.push({ label: `${ROUND_LABELS[seg.round.round] ?? seg.round.round} result`, index: idx });
    });
    targets.push({ label: "Skip to champion", index: segments.length - 1 });
    return targets;
  }, [segments]);

  const current = segments[cursor];
  const atEnd = current?.kind === "champion";

  const advance = useCallback(() => {
    setCursor((c) => Math.min(c + 1, segments.length - 1));
  }, [segments.length]);

  // Auto-advance non-match beats after a short dwell.
  useEffect(() => {
    if (!current || current.kind === "match" || current.kind === "champion" || paused) return;
    const t = setTimeout(advance, (DWELL_MS[current.kind] ?? 3000) / speed);
    return () => clearTimeout(t);
  }, [current, paused, speed, advance]);

  // Commentary cues at the dramatic beats (kept sparse to avoid audio overlap).
  useEffect(() => {
    if (!current) return;
    if (current.kind === "match" && current.match.round !== "group") {
      announce({
        source: "tournament",
        tournamentId: data.id,
        cue: { kind: "matchup.introduction", homeId: current.match.homeId, awayId: current.match.awayId },
      });
    } else if (current.kind === "champion") {
      announce({ source: "tournament", tournamentId: data.id, cue: { kind: "competition.champion" } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor]);

  const jumps = allTargets.filter((t) => t.index > cursor);
  const champion = byId.get(data.championId);

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col">
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 pt-8 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow">
            {data.mode === "world" ? "Global cup · live" : `Trip cup · ${data.trip.destinationLabel}`}
          </p>
          {!atEnd && (
            <button
              onClick={onFinish}
              className="text-xs text-chalk-dim underline-offset-2 hover:text-chalk hover:underline"
            >
              Skip to full results ⏭
            </button>
          )}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={cursor}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="mt-4"
          >
            {current?.kind === "match" && (
              <PitchScene
                match={current.match}
                home={byId.get(current.match.homeId)}
                away={byId.get(current.match.awayId)}
                roundLabel={current.roundLabel}
                contextLabel={current.contextLabel}
                durationMs={MATCH_DURATION_MS}
                paused={paused}
                speed={speed}
                seed={data.seed}
                onFinished={advance}
                onGoal={(_, goalIndex) => {
                  announce({
                    source: "tournament",
                    tournamentId: data.id,
                    cue: {
                      kind: "match.goal",
                      homeId: current.match.homeId,
                      awayId: current.match.awayId,
                      goalIndex,
                    },
                  });
                }}
              />
            )}
            {current?.kind === "group-result" && <GroupResultView group={current.group} byId={byId} />}
            {current?.kind === "group-stage-summary" && (
              <GroupStageSummary groups={data.groups} byId={byId} />
            )}
            {current?.kind === "round-result" && <RoundResultView round={current.round} byId={byId} />}
            {current?.kind === "champion" && (
              <ChampionCelebration data={data} champion={champion} onViewResults={onFinish} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <SkipControls
        paused={paused}
        onTogglePause={() => setPaused((p) => !p)}
        speed={speed}
        onCycleSpeed={() => setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length])}
        onSkipSegment={advance}
        jumps={jumps}
        onJump={(index) => setCursor(index)}
        atEnd={atEnd}
      />
    </div>
  );
}

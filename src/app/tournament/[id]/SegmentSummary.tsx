"use client";

import { motion } from "framer-motion";
import type { ContenderPayload } from "@/components/types";
import type { GroupResult, MatchResult } from "@/lib/game/matchSim";
import { ROUND_LABELS } from "./types";

type ById = Map<string, ContenderPayload>;

const fade = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

function StandingsTable({ group, byId }: { group: GroupResult; byId: ById }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="eyebrow !text-[9px]">
          <th className="pb-1 text-left font-normal">Club</th>
          <th className="pb-1 text-right font-normal">W</th>
          <th className="pb-1 text-right font-normal">L</th>
          <th className="pb-1 text-right font-normal">GD</th>
          <th className="pb-1 text-right font-normal">Pts</th>
        </tr>
      </thead>
      <tbody className="font-score">
        {group.table.map((row, i) => {
          const contender = byId.get(row.propertyId);
          return (
            <tr
              key={row.propertyId}
              className={`border-t border-white/5 ${i < 2 ? "text-chalk" : "text-chalk-dim"}`}
            >
              <td className="max-w-[180px] truncate py-1.5 pr-2">
                {i < 2 && <span className="mr-1 text-turf-bright">▸</span>}
                {contender?.hotel.name}
                {contender?.isUserCard && (
                  <span className="ml-1.5 rounded bg-gold/20 px-1 text-[9px] uppercase text-gold-bright">
                    yours
                  </span>
                )}
              </td>
              <td className="py-1.5 text-right">{row.won}</td>
              <td className="py-1.5 text-right">{row.lost}</td>
              <td className="py-1.5 text-right">{row.goalsFor - row.goalsAgainst}</td>
              <td className="py-1.5 text-right font-semibold">{row.points}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function GroupResultView({ group, byId }: { group: GroupResult; byId: ById }) {
  return (
    <motion.div {...fade} className="mx-auto max-w-xl">
      <p className="eyebrow text-center">Group {group.name} · final standings</p>
      <h2 className="font-display mt-1 text-center text-2xl text-chalk">Group {group.name} decided</h2>
      <div className="panel mt-5 rounded-2xl p-5">
        <StandingsTable group={group} byId={byId} />
        <p className="mt-3 text-center text-[11px] text-chalk-dim">Top two advance to the knockouts.</p>
      </div>
    </motion.div>
  );
}

export function GroupStageSummary({ groups, byId }: { groups: GroupResult[]; byId: ById }) {
  return (
    <motion.div {...fade} className="mx-auto max-w-4xl">
      <p className="eyebrow text-center">Group stage complete</p>
      <h2 className="font-display mt-1 text-center text-2xl text-chalk">Into the knockouts</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {groups.map((group) => (
          <div key={group.name} className="panel rounded-xl p-4">
            <h3 className="font-display text-lg text-gold-bright">Group {group.name}</h3>
            <div className="mt-2">
              <StandingsTable group={group} byId={byId} />
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export function RoundResultView({
  round,
  byId,
}: {
  round: { round: string; matches: MatchResult[] };
  byId: ById;
}) {
  const name = (id: string) => byId.get(id)?.hotel.name ?? "Unknown";
  return (
    <motion.div {...fade} className="mx-auto max-w-xl">
      <p className="eyebrow text-center">{ROUND_LABELS[round.round] ?? round.round} · results</p>
      <h2 className="font-display mt-1 text-center text-2xl text-chalk">
        {ROUND_LABELS[round.round] ?? round.round} decided
      </h2>
      <div className="mt-5 grid gap-2">
        {round.matches.map((match: MatchResult, i: number) => (
          <div key={i} className="panel rounded-lg p-3">
            {[
              { id: match.homeId, goals: match.homeGoals },
              { id: match.awayId, goals: match.awayGoals },
            ].map((side) => (
              <div
                key={side.id}
                className={`flex items-center justify-between gap-2 py-0.5 text-sm ${
                  match.winnerId === side.id
                    ? "text-chalk"
                    : "text-chalk-dim line-through decoration-white/30"
                }`}
              >
                <span className="truncate">{name(side.id)}</span>
                <span className="font-score">{side.goals}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

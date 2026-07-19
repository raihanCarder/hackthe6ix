"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useMemo, useState } from "react";
import { HotelCard } from "@/components/HotelCard";
import { usePresentation } from "@/components/PresentationCommentary";
import type { MatchResult } from "@/lib/game/matchSim";
import { METRIC_LABELS, ROUND_LABELS, shortName, type TournamentPayload } from "./types";

/**
 * The full, all-at-once results page: group tables, the knockout bracket, the
 * champion dossier, and a per-match highlight modal. Reached from the broadcast's
 * "View full results" button once the tournament has played out.
 */
export function TournamentResults({
  data,
  onRewatch,
}: {
  data: TournamentPayload;
  onRewatch?: () => void;
}) {
  const { announce } = usePresentation();
  const [openMatch, setOpenMatch] = useState<MatchResult | null>(null);

  const byId = useMemo(
    () => new Map(data.contenders.map((c) => [c.propertyId, c])),
    [data],
  );
  const name = (propertyId: string) => byId.get(propertyId)?.hotel.name ?? "Unknown";

  function showMatch(match: MatchResult) {
    setOpenMatch(match);
    announce({
      source: "tournament",
      tournamentId: data.id,
      cue: { kind: "matchup.introduction", homeId: match.homeId, awayId: match.awayId },
    });
  }

  const champion = data.champion;
  const championContender = byId.get(data.championId);
  const isWorld = data.mode === "world";

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">
            {isWorld
              ? "Global cup · casual play"
              : `Trip cup · ${data.trip.destinationLabel} · ${data.trip.checkin} → ${data.trip.checkout}`}
          </p>
          <h1 className="font-display mt-2 text-3xl text-chalk">
            {data.contenders.length} hotels. One booking.
          </h1>
          <p className="mt-1 text-sm text-chalk-dim">
            {isWorld
              ? "Group stage → knockouts → champion. This one's just for fun — the champion is whichever card rates highest, from anywhere in the world."
              : "Group stage → knockouts → champion. Match drama is seeded animation; the winner is the recommendation engine's verdict, evidence below."}
          </p>
        </div>
        {onRewatch && (
          <button
            onClick={onRewatch}
            className="btn-chalk shrink-0 rounded-lg px-4 py-2 text-xs"
          >
            ↺ Rewatch broadcast
          </button>
        )}
      </div>

      {/* Group stage */}
      <section className="mt-8">
        <h2 className="eyebrow">Group stage</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {data.groups.map((group) => (
            <div key={group.name} className="panel rounded-xl p-4">
              <div className="flex items-baseline justify-between">
                <h3 className="font-display text-lg text-gold-bright">Group {group.name}</h3>
                <span className="text-[11px] text-chalk-dim">top 2 advance</span>
              </div>
              <table className="mt-2 w-full text-sm">
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
              <div className="mt-2 flex flex-wrap gap-1.5">
                {group.matches.map((match, i) => (
                  <button
                    key={i}
                    onClick={() => showMatch(match)}
                    className="btn-chalk font-score rounded px-2 py-1 text-[11px]"
                    title={`${name(match.homeId)} vs ${name(match.awayId)}`}
                  >
                    {shortName(name(match.homeId))} {match.homeGoals}–{match.awayGoals}{" "}
                    {shortName(name(match.awayId))}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Knockout */}
      <section className="mt-10">
        <h2 className="eyebrow">Knockout</h2>
        <div
          className="mt-3 grid gap-4"
          style={{ gridTemplateColumns: `repeat(${data.knockout.length}, minmax(0, 1fr))` }}
        >
          {data.knockout.map((round) => (
            <div key={round.round} className="flex flex-col justify-around gap-3">
              <p className="font-display text-center text-sm text-chalk-dim">
                {ROUND_LABELS[round.round] ?? round.round}
              </p>
              {round.matches.map((match, i) => (
                <button
                  key={i}
                  onClick={() => showMatch(match)}
                  className="panel rounded-lg p-3 text-left transition hover:border-gold/40"
                >
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
                </button>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* Champion */}
      {champion && (
        <section className="mt-12">
          <div className="chalk-line" />
          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,340px)_1fr]">
            <div>
              <p className="eyebrow text-gold-bright">🏆 {isWorld ? "World champion" : "Trip champion"}</p>
              {championContender && (
                <div className="mt-3 max-w-[360px]">
                  <HotelCard
                    hotel={championContender.hotel}
                    stats={championContender.stats}
                    overall={championContender.overall}
                    rarity={championContender.rarity ?? "legendary"}
                    cosmeticSeed={`champ:${data.seed}`}
                  />
                </div>
              )}
            </div>

            <div className="panel rounded-2xl p-6">
              <h2 className="font-display text-2xl text-chalk">{champion.hotel.name}</h2>
              <p className="mt-1 text-sm text-chalk-dim">{champion.hotel.address}</p>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <Fact
                  label="First-place probability"
                  value={`${Math.round(champion.winProbability * 100)}%`}
                  hint={
                    isWorld
                      ? `share of combined OVERALL rating across the bracket (gap to runner-up ${Math.round(champion.explanation.stability.gap)} pts)`
                      : `across 5,000 simulated preference profiles (gap to runner-up ${Math.round(champion.explanation.stability.gap * 100)} pts)`
                  }
                />
                <Fact
                  label="Tonight's price"
                  value={champion.hotel.nightlyPrice !== null ? `$${champion.hotel.nightlyPrice} CAD` : "See booking"}
                  hint={champion.hotel.freeCancellation ? "free cancellation" : "check policy at booking"}
                />
                <Fact
                  label="Guest rating"
                  value={champion.hotel.guestRating !== null ? `${champion.hotel.guestRating.toFixed(1)} / 10` : "—"}
                  hint={`${champion.hotel.reviewCount ?? 0} reviews`}
                />
              </div>

              {/* Why it won */}
              <div className="mt-6">
                <p className="eyebrow">{isWorld ? "Why it won" : "Why it won — your weights"}</p>
                {isWorld ? (
                  <p className="mt-2 text-sm text-chalk-dim">
                    Highest OVERALL rating in the bracket — casual play, no personalized weights.
                  </p>
                ) : (
                  <div className="mt-2 grid gap-1.5">
                    {Object.entries(champion.weights)
                      .sort(([, a], [, b]) => b - a)
                      .map(([metric, weight]) => (
                        <div key={metric} className="flex items-center gap-2 text-xs">
                          <span className="w-28 shrink-0 text-chalk-dim">{METRIC_LABELS[metric] ?? metric}</span>
                          <div className="stat-bar h-2 flex-1 overflow-hidden rounded-full">
                            <div className="h-full rounded-full" style={{ width: `${weight * 100}%` }} />
                          </div>
                          <span className="font-score w-10 text-right text-chalk">
                            {(weight * 100).toFixed(0)}%
                          </span>
                        </div>
                      ))}
                  </div>
                )}
                {!isWorld && champion.evidence && champion.evidence.mainAdvantages.length > 0 && (
                  <div className="mt-3 text-sm text-chalk-dim">
                    <p>
                      Decisive edge over the runner-up:{" "}
                      <span className="text-chalk">
                        {champion.evidence.mainAdvantages
                          .map((a) => METRIC_LABELS[a.metric] ?? a.metric)
                          .join(", ")}
                      </span>
                      {champion.safestAlternative?.name && (
                        <> · Safest alternative: <span className="text-chalk">{champion.safestAlternative.name}</span></>
                      )}
                    </p>
                    <button
                      onClick={() =>
                        announce({
                          source: "tournament",
                          tournamentId: data.id,
                          cue: { kind: "hotel.advantage", advantageIndex: 0 },
                        })
                      }
                      className="mt-2 text-xs text-gold-bright underline-offset-2 hover:underline"
                    >
                      Commentate the leading advantage
                    </button>
                  </div>
                )}
                {champion.explanation.caveats.length > 0 && (
                  <p className="mt-2 text-[11px] text-chalk-dim">
                    Caveats: {champion.explanation.caveats.slice(0, 2).join(" ")}
                  </p>
                )}
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                {champion.hotel.bookingUrl ? (
                  <a
                    href={champion.hotel.bookingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary rounded-lg px-8 py-3 text-lg"
                  >
                    Book the champion →
                  </a>
                ) : (
                  <span className="btn-chalk rounded-lg px-6 py-3 text-chalk-dim">
                    Transfer pending — booking link unavailable
                  </span>
                )}
                <Link href="/play" className="btn-chalk rounded-lg px-5 py-3">
                  Play again
                </Link>
                <Link href="/packs" className="btn-chalk rounded-lg px-5 py-3">
                  Open another pack
                </Link>
              </div>

              <p className="mt-4 rounded-lg bg-pitch-950/60 px-3 py-2 text-[11px] text-chalk-dim">
                {data.rewards.userWon
                  ? `Your card lifted the trophy! +${data.rewards.userXp} XP, +${data.rewards.userCurrency} coins.`
                  : `Full-time rewards: +${data.rewards.userXp} XP, +${data.rewards.userCurrency} coins.`}{" "}
                Engine {champion.engineVersion} · seed {data.seed.slice(0, 12)}…{" "}
                {isWorld
                  ? "— same cards, same seed, same result."
                  : "— same trip, same answers, same result."}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Match highlight modal */}
      <AnimatePresence>
        {openMatch && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
            onClick={() => setOpenMatch(null)}
          >
            <motion.div
              initial={{ y: 24 }}
              animate={{ y: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="panel max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl p-6"
            >
              <p className="eyebrow">
                {openMatch.group ? `Group ${openMatch.group}` : ROUND_LABELS[openMatch.round] ?? openMatch.round}
              </p>
              <h3 className="font-display mt-1 text-lg leading-snug text-chalk">
                {name(openMatch.homeId)} {openMatch.homeGoals}–{openMatch.awayGoals} {name(openMatch.awayId)}
              </h3>
              <div className="mt-4 grid gap-2">
                {openMatch.highlights.map((h, i) => (
                  <div key={i} className="flex gap-3 text-sm">
                    <span
                      className={`font-score w-8 shrink-0 text-right ${
                        h.kind === "goal" ? "text-turf-bright" : "text-gold-bright"
                      }`}
                    >
                      {h.minute}&apos;
                    </span>
                    <span className={h.kind === "goal" ? "text-chalk" : "text-chalk-dim"}>{h.text}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() =>
                  announce({
                    source: "tournament",
                    tournamentId: data.id,
                    cue: { kind: "match.winner", homeId: openMatch.homeId, awayId: openMatch.awayId },
                  })
                }
                className="btn-gold mt-5 w-full rounded-lg px-4 py-2"
              >
                Announce the winner
              </button>
              <button onClick={() => setOpenMatch(null)} className="btn-chalk mt-2 w-full rounded-lg px-4 py-2">
                Back to the bracket
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg bg-pitch-950/60 p-3">
      <p className="eyebrow !text-[9px]">{label}</p>
      <p className="font-score mt-1 text-xl text-chalk">{value}</p>
      {hint && <p className="mt-0.5 text-[10px] leading-snug text-chalk-dim">{hint}</p>}
    </div>
  );
}

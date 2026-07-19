"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { HotelCard, RARITY_LABEL } from "@/components/HotelCard";
import {
  JourneyCommentaryCue,
  usePresentation,
} from "@/components/PresentationCommentary";
import type { CardPayload } from "@/components/types";
import {
  filterAndSortCards,
  getCountryOptions,
  RARITY_ORDER,
  SORT_OPTIONS,
  type CardFilterState,
  type RarityFilter,
  type SortKey,
} from "@/lib/cards/cardFilters";
import type { PreferenceQuestion, TravelerAnswer } from "@/lib/engine/types";
import { useCurrentUser } from "@/lib/useCurrentUser";

type Mode = "trip" | "world";
type Step = "mode" | "card" | "questions" | "simulating";
const CARD_PICK_PAGE_SIZE = 8;

interface ModeTileProps {
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  image: string;
  accent: "trip" | "world" | "duel";
  className?: string;
  onClick: () => void;
}

export function PlayClient() {
  const router = useRouter();
  const { announce } = usePresentation();
  const { refresh } = useCurrentUser();
  const [step, setStep] = useState<Step>("mode");
  const [mode, setMode] = useState<Mode | null>(null);
  const [cards, setCards] = useState<CardPayload[] | null>(null);
  const [selected, setSelected] = useState<CardPayload | null>(null);
  const [visibleCount, setVisibleCount] = useState(CARD_PICK_PAGE_SIZE);
  const [error, setError] = useState<string | null>(null);
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [rarityFilter, setRarityFilter] = useState<RarityFilter>("all");
  const [sortBy, setSortBy] = useState<SortKey>("recent");

  // Trip Cup questionnaire state
  const [currentQuestion, setCurrentQuestion] =
    useState<PreferenceQuestion | null>(null);
  const [answers, setAnswers] = useState<TravelerAnswer[]>([]);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [maxQuestions, setMaxQuestions] = useState(5);
  const [questionSource, setQuestionSource] = useState<
    "gemini" | "deterministic" | null
  >(null);
  const [questionBusy, setQuestionBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/me")
      .then((response) => (response.ok ? response.json() : null))
      .then(
        (data: { user: unknown | null; authMode: "auth0" | "dev" } | null) => {
          if (!cancelled && data?.authMode === "auth0" && !data.user) {
            window.location.assign(
              `/auth/login?returnTo=${encodeURIComponent("/play")}`,
            );
          }
        },
      );

    return () => {
      cancelled = true;
    };
  }, []);

  const countryOptions = useMemo(() => {
    if (!cards) return [];
    return getCountryOptions(cards);
  }, [cards]);

  const filteredSortedCards = useMemo(() => {
    if (!cards) return [];
    return filterAndSortCards(cards, { countryFilter, rarityFilter, sortBy });
  }, [cards, countryFilter, rarityFilter, sortBy]);

  const visibleCards = filteredSortedCards.slice(0, visibleCount);

  function resetCardPickerPaging() {
    setVisibleCount(CARD_PICK_PAGE_SIZE);
  }

  function updateCardFilters(nextFilters: Partial<CardFilterState>) {
    const nextState: CardFilterState = {
      countryFilter,
      rarityFilter,
      sortBy,
      ...nextFilters,
    };
    setCountryFilter(nextState.countryFilter);
    setRarityFilter(nextState.rarityFilter);
    setSortBy(nextState.sortBy);
    resetCardPickerPaging();
    if (
      selected &&
      cards &&
      !filterAndSortCards(cards, nextState).some((card) => card.id === selected.id)
    ) {
      setSelected(null);
    }
  }

  function clearCardFilters() {
    updateCardFilters({ countryFilter: "all", rarityFilter: "all" });
  }

  function chooseMode(next: Mode) {
    setMode(next);
    setStep("card");
    setSelected(null);
    resetCardPickerPaging();
    setError(null);
    announce({
      source: "journey",
      cue: {
        kind: "journey.moment",
        moment: next === "trip" ? "play.trip_selected" : "play.global_selected",
      },
    });
    if (cards === null) {
      fetch("/api/cards")
        .then(async (r) => {
          const data = await r.json();
          if (!r.ok)
            throw new Error(data.error ?? "Could not load your collection");
          setCards(data.cards);
        })
        .catch((e) => setError(e.message));
    }
  }

  function backToMode() {
    setStep("mode");
    setMode(null);
    setSelected(null);
    setError(null);
  }

  function backToCards() {
    setStep("card");
    setCurrentQuestion(null);
    setAnswers([]);
    setError(null);
  }

  async function enterTournament() {
    if (!selected || !mode) return;
    setError(null);
    if (mode === "world") {
      await kickOff([]);
      return;
    }
    setStep("questions");
    announce({
      source: "journey",
      cue: { kind: "journey.moment", moment: "questionnaire.started" },
    });
    await fetchNextQuestion([]);
  }

  async function fetchNextQuestion(nextAnswers: TravelerAnswer[]) {
    if (!selected?.sourceApiCallId) return;
    setQuestionBusy(true);
    setCurrentQuestion(null);
    try {
      const response = await fetch(
        `/api/search/${selected.sourceApiCallId}/questions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: nextAnswers }),
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "Could not load the next question");
      if (data.complete) {
        await kickOff(nextAnswers);
        return;
      }
      setCurrentQuestion(data.question);
      setQuestionNumber(data.questionNumber);
      setMaxQuestions(data.maxQuestions);
      setQuestionSource(data.source);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not load the next question",
      );
    } finally {
      setQuestionBusy(false);
    }
  }

  async function answerAndAdvance(
    question: PreferenceQuestion,
    optionId: string,
  ) {
    const next = [
      ...answers.filter((a) => a.questionId !== question.id),
      { questionId: question.id, optionIds: [optionId] },
    ];
    setAnswers(next);
    announce({
      source: "journey",
      cue: { kind: "journey.moment", moment: "questionnaire.answer" },
    });
    await fetchNextQuestion(next);
  }

  function selectCard(card: CardPayload) {
    setSelected(card);
    announce({
      source: "card",
      cardId: card.id,
      cue: { kind: "card.selection" },
    });
  }

  async function kickOff(finalAnswers: TravelerAnswer[]) {
    if (!selected || !mode) return;
    setStep("simulating");
    announce({
      source: "journey",
      cue: { kind: "journey.moment", moment: "tournament.simulating" },
    });
    try {
      const response = await fetch("/api/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          cardId: selected.id,
          answers: finalAnswers,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Tournament failed");
      void refresh();
      router.push(`/tournament/${data.tournamentId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tournament failed");
      setStep(mode === "world" ? "card" : "questions");
    }
  }

  if (step === "mode") {
    return (
      <div className="play-mode-screen">
        <JourneyCommentaryCue moment="play.mode_selection" />
        <div className="play-mode-heading">
          <p className="eyebrow text-center">Matchday · gamemode selection</p>
          <h1 className="font-display mt-2 text-center text-3xl text-chalk sm:text-4xl">
            Pick your competition
          </h1>
        </div>
        <div className="play-mode-board">
          <ModeTile
            eyebrow="Real recommendations"
            title="Trip Cup Mode"
            body="Your card faces opponents from the same live search that produced it. A pre-match interview drives a real recommendation engine."
            cta="Play Trip Cup"
            image="/play/trip-cup.png"
            accent="trip"
            className="lg:row-span-3"
            onClick={() => chooseMode("trip")}
          />
          <ModeTile
            eyebrow="Casual · for fun"
            title="Global Cup Mode"
            body="Your card takes on 15 opponents from 15 countries around the world. No interview, no wait."
            cta="Play Global Cup"
            image="/play/global-cup.png"
            accent="world"
            className="lg:row-span-2"
            onClick={() => chooseMode("world")}
          />
          <ModeTile
            eyebrow="1v1 · live matchmaking"
            title="Duel Mode"
            body="Pick a squad of three and go head-to-head against another traveler in real time."
            cta="Play Duel"
            image="/play/duel.png"
            accent="duel"
            onClick={() => router.push("/duel")}
          />
        </div>
      </div>
    );
  }

  if (step === "card") {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <button
          onClick={backToMode}
          className="text-xs text-chalk-dim underline-offset-2 hover:underline"
        >
          ← Back to gamemode selection
        </button>

        <p className="eyebrow mt-4">
          {mode === "trip" ? "Trip Cup" : "Global Cup"} · squad selection
        </p>
        <h1 className="font-display mt-2 text-3xl text-chalk">
          Pick your card
        </h1>
        <p className="mt-2 text-sm text-chalk-dim">
          {mode === "trip"
            ? "This card's original search supplies the opponents — every match-up is bookable."
            : "This card will face 15 hotels from 15 different countries."}
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-whistle/50 bg-whistle/10 px-4 py-3 text-sm text-chalk">
            {error}
          </div>
        )}

        {cards === null ? (
          <p className="mt-8 text-chalk-dim">Loading your collection…</p>
        ) : cards.length === 0 ? (
          <div className="panel mt-8 rounded-xl p-10 text-center">
            <p className="font-display text-lg text-chalk">No cards yet.</p>
            <p className="mt-2 text-sm text-chalk-dim">
              Open a pack to build your squad first.
            </p>
            <Link
              href="/packs"
              className="btn-primary mt-5 inline-block rounded-lg px-6 py-2.5"
            >
              Open a pack
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-6 flex flex-wrap items-end gap-3">
              {countryOptions.length >= 2 && (
                <label className="flex flex-col gap-1">
                  <span className="eyebrow !text-[9px]">Country</span>
                  <select
                    value={countryFilter}
                    onChange={(e) => {
                      updateCardFilters({ countryFilter: e.target.value });
                    }}
                    className="rounded-lg bg-pitch-950/60 px-3 py-2 text-sm text-chalk"
                  >
                    <option value="all">All countries</option>
                    {countryOptions.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="flex flex-col gap-1">
                <span className="eyebrow !text-[9px]">Rarity</span>
                <select
                  value={rarityFilter}
                  onChange={(e) => {
                    updateCardFilters({
                      rarityFilter: e.target.value as RarityFilter,
                    });
                  }}
                  className="rounded-lg bg-pitch-950/60 px-3 py-2 text-sm text-chalk"
                >
                  <option value="all">All rarities</option>
                  {RARITY_ORDER.map((r) => (
                    <option key={r} value={r}>
                      {RARITY_LABEL[r]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="eyebrow !text-[9px]">Sort by</span>
                <select
                  value={sortBy}
                  onChange={(e) => {
                    updateCardFilters({ sortBy: e.target.value as SortKey });
                  }}
                  className="rounded-lg bg-pitch-950/60 px-3 py-2 text-sm text-chalk"
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>

              <p className="ml-auto text-xs text-chalk-dim">
                Showing {visibleCards.length} of {filteredSortedCards.length}
              </p>
            </div>

            {filteredSortedCards.length === 0 ? (
              <div className="panel mt-6 rounded-xl p-10 text-center">
                <p className="font-display text-lg text-chalk">
                  No cards match these filters.
                </p>
                <button
                  onClick={clearCardFilters}
                  className="btn-chalk mt-4 rounded-lg px-5 py-2"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <>
                <div className="hotel-card-grid mt-6">
                  {visibleCards.map((card) => {
                    const isSelected = selected?.id === card.id;
                    return (
                      <motion.button
                        key={card.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => selectCard(card)}
                        className={`rounded-xl text-left transition ${
                          isSelected
                            ? "ring-2 ring-cyan-bright"
                            : "hover:-translate-y-1"
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
                      </motion.button>
                    );
                  })}
                </div>

                {visibleCount < filteredSortedCards.length && (
                  <button
                    onClick={() =>
                      setVisibleCount((c) => c + CARD_PICK_PAGE_SIZE)
                    }
                    className="btn-chalk mt-6 w-full rounded-lg px-6 py-3 text-sm"
                  >
                    Show more ({filteredSortedCards.length - visibleCount} more)
                  </button>
                )}
              </>
            )}

            <button
              onClick={enterTournament}
              disabled={!selected}
              className="btn-primary mt-4 w-full rounded-lg px-6 py-3 text-lg disabled:opacity-40"
            >
              {selected
                ? `Enter ${selected.hotel.name} into the tournament`
                : "Select a card to continue"}
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-20">
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="panel rounded-2xl p-6"
        >
          {error ? (
            <div className="py-6 text-center">
              <p className="font-display text-xl text-chalk">{error}</p>
              <button
                onClick={backToCards}
                className="btn-chalk mt-4 rounded-lg px-5 py-2.5"
              >
                Back to squad selection
              </button>
            </div>
          ) : step === "simulating" ? (
            <div className="py-10 text-center">
              <p className="eyebrow">Simulating</p>
              <p className="font-display mt-3 text-2xl text-chalk">
                5,000 seasons in progress…
              </p>
              <p className="mt-2 text-sm text-chalk-dim">
                Group stage. Knockouts. One champion.
              </p>
            </div>
          ) : currentQuestion ? (
            <div>
              <p className="eyebrow">
                Pre-match interview · {questionNumber} of up to {maxQuestions}
                {questionSource === "gemini" ? " · AI personalized" : ""}
              </p>
              <h2 className="font-display mt-2 text-xl text-chalk">
                {currentQuestion.text}
              </h2>
              <div className="mt-4 grid gap-2">
                {currentQuestion.options.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => answerAndAdvance(currentQuestion, option.id)}
                    disabled={questionBusy}
                    className="btn-chalk rounded-lg px-4 py-3 text-left text-sm"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => kickOff(answers)}
                className="mt-4 text-xs text-chalk-dim underline-offset-2 hover:underline"
              >
                Skip the rest — use a balanced profile
              </button>
            </div>
          ) : (
            <div className="py-6 text-center text-chalk-dim">
              {questionBusy
                ? "Personalizing your next question…"
                : "Loading question…"}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function ModeTile({
  eyebrow,
  title,
  body,
  cta,
  image,
  accent,
  className = "",
  onClick,
}: ModeTileProps) {
  const buttonClass =
    accent === "world"
      ? "btn-gold"
      : accent === "duel"
        ? "btn-cyan"
        : "btn-primary";

  return (
    <motion.button
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={`play-mode-tile play-mode-tile-${accent} ${className}`}
    >
      <span
        className="play-mode-tile-art"
        style={{ backgroundImage: `url(${image})` }}
        aria-hidden
      />
      <span className="play-mode-tile-shade" aria-hidden />
      <span className="play-mode-tile-content">
        <span className="eyebrow !text-[0.62rem]">{eyebrow}</span>
        <span className="font-display mt-2 max-w-[20rem] text-2xl leading-none text-chalk sm:text-3xl">
          {title}
        </span>
        <span className="play-mode-tile-body">
          {body}
        </span>
        <span
          className={`${buttonClass} mt-5 inline-block rounded-lg px-5 py-2 text-sm`}
        >
          {cta}
        </span>
      </span>
    </motion.button>
  );
}

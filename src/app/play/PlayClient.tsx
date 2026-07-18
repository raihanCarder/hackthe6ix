"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { HotelCard } from "@/components/HotelCard";
import { JourneyCommentaryCue, usePresentation } from "@/components/PresentationCommentary";
import type { CardPayload } from "@/components/types";
import type { PreferenceQuestion, TravelerAnswer } from "@/lib/engine/types";

type Mode = "trip" | "world";
type Step = "mode" | "card" | "questions" | "simulating";

export function PlayClient() {
  const router = useRouter();
  const { announce } = usePresentation();
  const [step, setStep] = useState<Step>("mode");
  const [mode, setMode] = useState<Mode | null>(null);
  const [cards, setCards] = useState<CardPayload[] | null>(null);
  const [selected, setSelected] = useState<CardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Trip Cup questionnaire state
  const [currentQuestion, setCurrentQuestion] = useState<PreferenceQuestion | null>(null);
  const [answers, setAnswers] = useState<TravelerAnswer[]>([]);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [maxQuestions, setMaxQuestions] = useState(5);
  const [questionSource, setQuestionSource] = useState<"gemini" | "deterministic" | null>(null);
  const [questionBusy, setQuestionBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { user: unknown | null; authMode: "auth0" | "dev" } | null) => {
        if (!cancelled && data?.authMode === "auth0" && !data.user) {
          window.location.assign(`/auth/login?returnTo=${encodeURIComponent("/play")}`);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function chooseMode(next: Mode) {
    setMode(next);
    setStep("card");
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
          if (!r.ok) throw new Error(data.error ?? "Could not load your collection");
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
      const response = await fetch(`/api/search/${selected.sourceApiCallId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: nextAnswers }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load the next question");
      if (data.complete) {
        await kickOff(nextAnswers);
        return;
      }
      setCurrentQuestion(data.question);
      setQuestionNumber(data.questionNumber);
      setMaxQuestions(data.maxQuestions);
      setQuestionSource(data.source);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the next question");
    } finally {
      setQuestionBusy(false);
    }
  }

  async function answerAndAdvance(question: PreferenceQuestion, optionId: string) {
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
    announce({ source: "card", cardId: card.id, cue: { kind: "card.selection" } });
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
        body: JSON.stringify({ mode, cardId: selected.id, answers: finalAnswers }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Tournament failed");
      router.push(`/tournament/${data.tournamentId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tournament failed");
      setStep(mode === "world" ? "card" : "questions");
    }
  }

  if (step === "mode") {
    return (
      <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
        <JourneyCommentaryCue moment="play.mode_selection" />
        <p className="eyebrow text-center">Matchday · gamemode selection</p>
        <h1 className="font-display mt-2 text-center text-3xl text-chalk sm:text-4xl">
          Pick your competition
        </h1>
        <p className="mx-auto mt-2 max-w-lg text-center text-sm text-chalk-dim">
          Enter one of your cards into a 16-team bracket. Cards can be reused across as many
          matches as you like.
        </p>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <motion.button
            whileHover={{ y: -4 }}
            onClick={() => chooseMode("trip")}
            className="panel rounded-2xl border-2 border-turf-bright/40 p-8 text-left transition hover:border-turf-bright"
          >
            <p className="eyebrow">Real recommendations</p>
            <h2 className="font-display mt-2 text-2xl text-chalk">Trip Cup Mode</h2>
            <p className="mt-3 text-sm text-chalk-dim">
              Your card faces opponents from the same live search that produced it. A pre-match
              interview drives a real recommendation engine — the winner is a genuine pick for
              your trip.
            </p>
            <span className="btn-primary mt-6 inline-block rounded-lg px-6 py-2.5">Play Trip Cup</span>
          </motion.button>

          <motion.button
            whileHover={{ y: -4 }}
            onClick={() => chooseMode("world")}
            className="panel rounded-2xl border-2 border-gold-bright/40 p-8 text-left transition hover:border-gold-bright"
          >
            <p className="eyebrow">Casual · for fun</p>
            <h2 className="font-display mt-2 text-2xl text-chalk">Global Cup Mode</h2>
            <p className="mt-3 text-sm text-chalk-dim">
              Your card takes on 15 opponents from 15 different countries around the world. No
              interview, no wait — just bragging rights.
            </p>
            <span className="btn-primary mt-6 inline-block rounded-lg px-6 py-2.5">Play Global Cup</span>
          </motion.button>
        </div>
      </div>
    );
  }

  if (step === "card") {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <button onClick={backToMode} className="text-xs text-chalk-dim underline-offset-2 hover:underline">
          ← Back to gamemode selection
        </button>

        <p className="eyebrow mt-4">{mode === "trip" ? "Trip Cup" : "Global Cup"} · squad selection</p>
        <h1 className="font-display mt-2 text-3xl text-chalk">Pick your card</h1>
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
            <p className="mt-2 text-sm text-chalk-dim">Open a pack to build your squad first.</p>
            <Link href="/packs" className="btn-primary mt-5 inline-block rounded-lg px-6 py-2.5">
              Open a pack
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {cards.map((card) => {
                const isSelected = selected?.id === card.id;
                return (
                  <button
                    key={card.id}
                    onClick={() => selectCard(card)}
                    className={`rounded-xl text-left transition ${
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
              onClick={enterTournament}
              disabled={!selected}
              className="btn-primary mt-6 w-full rounded-lg px-6 py-3 text-lg disabled:opacity-40"
            >
              {selected ? `Enter ${selected.hotel.name} into the tournament` : "Select a card to continue"}
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
              <button onClick={backToCards} className="btn-chalk mt-4 rounded-lg px-5 py-2.5">
                Back to squad selection
              </button>
            </div>
          ) : step === "simulating" ? (
            <div className="py-10 text-center">
              <p className="eyebrow">Simulating</p>
              <p className="font-display mt-3 text-2xl text-chalk">5,000 seasons in progress…</p>
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
              <h2 className="font-display mt-2 text-xl text-chalk">{currentQuestion.text}</h2>
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
              {questionBusy ? "Personalizing your next question…" : "Loading question…"}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

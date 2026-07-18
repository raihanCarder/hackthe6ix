"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CardBack, HotelCard } from "@/components/HotelCard";
import type { CardPayload } from "@/components/types";
import type { PreferenceQuestion, TravelerAnswer } from "@/lib/engine/types";

interface PackPayload {
  packId: string;
  searchId: string;
  city: string;
  cost: number;
  cards: CardPayload[];
  trip: { destinationLabel: string; checkin: string; checkout: string };
}

export default function PackPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [pack, setPack] = useState<PackPayload | null>(null);
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"reveal" | "questions" | "simulating">("reveal");

  // Questionnaire state
  const [currentQuestion, setCurrentQuestion] = useState<PreferenceQuestion | null>(null);
  const [answers, setAnswers] = useState<TravelerAnswer[]>([]);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [maxQuestions, setMaxQuestions] = useState(5);
  const [questionSource, setQuestionSource] = useState<"gemini" | "deterministic" | null>(null);
  const [questionBusy, setQuestionBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/packs/${id}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Pack not found");
        setPack(data);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  const allFlipped = pack !== null && flipped.size >= pack.cards.length;

  function flip(index: number) {
    setFlipped((prev) => new Set(prev).add(index));
  }

  async function startQuestions() {
    if (!pack) return;
    setPhase("questions");
    await fetchNextQuestion([]);
  }

  async function fetchNextQuestion(nextAnswers: TravelerAnswer[]) {
    if (!pack) return;
    setQuestionBusy(true);
    setCurrentQuestion(null);
    try {
      const response = await fetch(`/api/search/${pack.searchId}/questions`, {
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
    const next = [...answers.filter((a) => a.questionId !== question.id), { questionId: question.id, optionIds: [optionId] }];
    setAnswers(next);
    await fetchNextQuestion(next);
  }

  async function kickOff(finalAnswers: TravelerAnswer[]) {
    if (!pack) return;
    setPhase("simulating");
    try {
      const response = await fetch("/api/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ searchId: pack.searchId, answers: finalAnswers }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Tournament failed");
      router.push(`/tournament/${data.tournamentId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tournament failed");
      setPhase("questions");
    }
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <p className="font-display text-xl text-chalk">{error}</p>
      </div>
    );
  }
  if (!pack) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center text-chalk-dim">
        Unwrapping the pack…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="eyebrow">
        Trip pack · {pack.trip.destinationLabel} · {pack.trip.checkin} → {pack.trip.checkout}
      </p>
      <h1 className="font-display mt-2 text-3xl text-chalk">
        {allFlipped ? "Your squad is in." : "Tap to reveal your signings"}
      </h1>
      <p className="mt-1 text-sm text-chalk-dim">
        Every card is a real property, bookable for these dates.
        {pack.cost > 0 ? ` Pack cost: ${pack.cost} coins.` : " First pack in this city — free."}
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {pack.cards.map((card, index) => (
          <motion.button
            key={card.id}
            onClick={() => flip(index)}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.12, type: "spring", stiffness: 120 }}
            className="relative text-left"
            style={{ perspective: 1200 }}
            aria-label={flipped.has(index) ? card.hotel.name ?? "card" : "Reveal card"}
          >
            <motion.div
              animate={{ rotateY: flipped.has(index) ? 180 : 0 }}
              transition={{ duration: 0.6, type: "spring", stiffness: 140, damping: 16 }}
              style={{ transformStyle: "preserve-3d" }}
              className="relative"
            >
              <div style={{ backfaceVisibility: "hidden" }}>
                <CardBack />
              </div>
              <div
                className="absolute inset-0"
                style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
              >
                <HotelCard
                  hotel={card.hotel}
                  stats={card.stats}
                  overall={card.overall}
                  rarity={card.rarity}
                  cosmeticSeed={card.cosmeticSeed}
                  compact
                />
              </div>
            </motion.div>
          </motion.button>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        {!allFlipped && (
          <button
            onClick={() => setFlipped(new Set(pack.cards.map((_, i) => i)))}
            className="btn-chalk rounded-lg px-5 py-2.5"
          >
            Reveal all
          </button>
        )}
        {allFlipped && phase === "reveal" && (
          <motion.button
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={startQuestions}
            className="btn-gold rounded-lg px-8 py-3 text-lg"
          >
            Set up the tournament
          </motion.button>
        )}
      </div>

      <AnimatePresence>
        {phase !== "reveal" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          >
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="panel w-full max-w-lg rounded-2xl p-6"
            >
              {phase === "simulating" ? (
                <div className="py-10 text-center">
                  <p className="eyebrow">Simulating</p>
                  <p className="font-display mt-3 text-2xl text-chalk">
                    5,000 seasons in progress…
                  </p>
                  <p className="mt-2 text-sm text-chalk-dim">
                    Monte Carlo over your preferences. Group stage. Knockouts. One champion.
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

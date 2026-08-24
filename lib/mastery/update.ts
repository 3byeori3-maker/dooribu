import type { SupabaseClient } from "@supabase/supabase-js";
import { masteryLevel, normalizeConceptKey, type ConceptMastery, type MasteryUpdate } from "./types";

const SCORE_DELTA: Record<MasteryUpdate["outcome"], number> = {
  correct: 12,
  partial: 4,
  incorrect: -10,
  unclear: 0,
};

const REVIEW_DAYS: Record<MasteryUpdate["outcome"], number> = {
  correct: 7,
  partial: 3,
  incorrect: 1,
  unclear: 1,
};

export async function recordMastery(
  supabase: SupabaseClient,
  userId: string,
  update: MasteryUpdate,
) {
  const conceptName = update.conceptName.trim().slice(0, 120) || "미분류 개념";
  const conceptKey = normalizeConceptKey(conceptName);
  const { data: current } = await supabase
    .from("concept_mastery")
    .select("mastery_score, attempts, correct_attempts")
    .eq("user_id", userId)
    .eq("concept_key", conceptKey)
    .maybeSingle();

  const delta = SCORE_DELTA[update.outcome];
  const masteryScore = Math.max(0, Math.min(100, (current?.mastery_score ?? 50) + delta));
  const attempts = (current?.attempts ?? 0) + 1;
  const correctAttempts = (current?.correct_attempts ?? 0) + (update.outcome === "correct" ? 1 : 0);
  const now = new Date();
  const reviewDueAt = new Date(now);
  reviewDueAt.setDate(reviewDueAt.getDate() + REVIEW_DAYS[update.outcome]);

  const mistakeCategory = update.mistakeCategory ?? "none";
  const { error: masteryError } = await supabase.from("concept_mastery").upsert({
    user_id: userId,
    concept_key: conceptKey,
    concept_name: conceptName,
    mastery_score: masteryScore,
    attempts,
    correct_attempts: correctAttempts,
    last_mistake_category: mistakeCategory,
    review_due_at: reviewDueAt.toISOString(),
    last_practiced_at: now.toISOString(),
  }, { onConflict: "user_id,concept_key" });
  if (masteryError) throw masteryError;

  const { error: eventError } = await supabase.from("learning_events").insert({
    user_id: userId,
    concept_key: conceptKey,
    concept_name: conceptName,
    source: update.source,
    outcome: update.outcome,
    mistake_category: mistakeCategory,
    score_delta: delta,
    metadata: update.metadata ?? {},
  });
  if (eventError) throw eventError;

  return { masteryScore, level: masteryLevel(masteryScore), reviewDueAt: reviewDueAt.toISOString() };
}

export function mapMasteryRow(row: Record<string, unknown>): ConceptMastery {
  const score = Number(row.mastery_score ?? 0);
  return {
    conceptKey: String(row.concept_key ?? ""),
    conceptName: String(row.concept_name ?? ""),
    masteryScore: score,
    attempts: Number(row.attempts ?? 0),
    correctAttempts: Number(row.correct_attempts ?? 0),
    lastMistakeCategory: row.last_mistake_category as ConceptMastery["lastMistakeCategory"],
    reviewDueAt: String(row.review_due_at ?? ""),
    lastPracticedAt: String(row.last_practiced_at ?? ""),
    level: masteryLevel(score),
  };
}

export type MistakeCategory =
  | "none"
  | "concept_gap"
  | "setup_error"
  | "calculation_error"
  | "sign_error"
  | "notation_error"
  | "reading_error"
  | "incomplete_reasoning"
  | "careless_error"
  | "unclear";

export type MasteryLevel = "strong" | "developing" | "review";

export type ConceptMastery = {
  conceptKey: string;
  conceptName: string;
  masteryScore: number;
  attempts: number;
  correctAttempts: number;
  lastMistakeCategory: MistakeCategory;
  reviewDueAt: string;
  lastPracticedAt: string;
  level: MasteryLevel;
};

export type MasteryUpdate = {
  conceptName: string;
  source: "concept_check" | "solution_analysis" | "tutor_chat" | "review";
  outcome: "correct" | "partial" | "incorrect" | "unclear";
  mistakeCategory?: MistakeCategory;
  metadata?: Record<string, unknown>;
};

export const MISTAKE_LABELS: Record<MistakeCategory, string> = {
  none: "오류 없음",
  concept_gap: "개념 이해 부족",
  setup_error: "식 세우기 오류",
  calculation_error: "계산 오류",
  sign_error: "부호 오류",
  notation_error: "기호·표기 오류",
  reading_error: "문제 해석 오류",
  incomplete_reasoning: "풀이 근거 부족",
  careless_error: "단순 실수",
  unclear: "판독 불가",
};

export function normalizeConceptKey(value: string) {
  return value.trim().toLocaleLowerCase("ko-KR").replace(/\s+/g, "-").slice(0, 120) || "미분류";
}

export function masteryLevel(score: number): MasteryLevel {
  if (score >= 75) return "strong";
  if (score >= 50) return "developing";
  return "review";
}

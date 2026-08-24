"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2, CircleHelp, Lightbulb, RotateCcw, Sparkles, TriangleAlert } from "lucide-react";
import type { ConceptCheck } from "@/lib/concept-check/types";

export function ConceptCheckCard({ conceptCheck, onContinue, onAnswered }: {
  conceptCheck: ConceptCheck;
  onContinue: () => void;
  onAnswered?: (correct: boolean) => void;
}) {
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const answered = selectedChoice !== null;
  const isCorrect = selectedChoice === conceptCheck.diagnostic.correctChoiceIndex;

  return (
    <section className="concept-check-card" aria-labelledby="concept-check-title">
      <div className="concept-check-topline"><span><Sparkles size={15} /> 풀이 전 1분 개념 체크</span><em>{conceptCheck.topic}</em></div>
      <h2 id="concept-check-title">이 개념부터 확인해볼까?</h2>
      <p className="concept-why">{conceptCheck.whyItMatters}</p>

      {conceptCheck.prerequisites.length > 0 && (
        <div className="concept-prerequisites" aria-label="필요한 선수 개념">
          {conceptCheck.prerequisites.slice(0, 3).map((item, index) => <span key={`${index}-${item}`}>{item}</span>)}
        </div>
      )}

      <div className="concept-question">
        <strong><CircleHelp size={18} /> {conceptCheck.diagnostic.question}</strong>
        <div className="concept-choices">
          {conceptCheck.diagnostic.choices.map((choice, index) => {
            const choiceState = answered
              ? index === conceptCheck.diagnostic.correctChoiceIndex
                ? "correct"
                : index === selectedChoice ? "incorrect" : "muted"
              : "";
            return (
              <button
                key={`${index}-${choice}`}
                type="button"
                className={choiceState}
                disabled={answered}
                aria-pressed={selectedChoice === index}
                onClick={() => {
                  setSelectedChoice(index);
                  onAnswered?.(index === conceptCheck.diagnostic.correctChoiceIndex);
                }}
              >
                <span>{index + 1}</span>{choice}
              </button>
            );
          })}
        </div>
      </div>

      {answered && (
        <div className={`concept-feedback ${isCorrect ? "correct" : "incorrect"}`} aria-live="polite">
          <strong>{isCorrect ? <><CheckCircle2 size={18} /> 정확히 알고 있어!</> : <><RotateCcw size={18} /> 여기만 다시 잡으면 돼</>}</strong>
          <p>{conceptCheck.conceptSummary}</p>
          <div><Lightbulb size={17} /><span><b>쉬운 예시</b>{conceptCheck.miniExample}</span></div>
          <div><TriangleAlert size={17} /><span><b>자주 하는 실수</b>{conceptCheck.commonMistake}</span></div>
          <button type="button" onClick={onContinue}>이제 문제 풀기 <ArrowRight size={17} /></button>
        </div>
      )}
    </section>
  );
}

export function ConceptCheckLoading() {
  return (
    <div className="concept-check-loading" role="status">
      <span className="spin"><Sparkles size={21} /></span>
      <div><strong>필요한 개념을 찾고 있어…</strong><p>문제의 정답은 보여주지 않고, 먼저 알아야 할 개념만 확인할게.</p></div>
    </div>
  );
}

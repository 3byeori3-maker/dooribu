"use client";

import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  ChevronRight,
  ImagePlus,
  LoaderCircle,
  MessageCircle,
  RefreshCw,
  SearchCheck,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import { ChangeEvent, useRef, useState } from "react";
import type { SolutionAnalysis } from "@/lib/solution-analysis/types";
import { optimizeImage } from "@/lib/images/optimize";
import { MISTAKE_LABELS } from "@/lib/mastery/types";

type AnalysisFocus = "first_error" | "full_review" | "easier_method";

type LearningContext = {
  grade: string;
  curriculum: string;
  textbook: string;
  currentUnit: string;
};

type SolutionAnalysisScreenProps = {
  learningContext: LearningContext;
  onBack: () => void;
  onContinue: (solutionImage: string, followUpQuestion: string) => void;
};

const focusOptions: Array<{ id: AnalysisFocus; label: string }> = [
  { id: "first_error", label: "처음 틀린 곳" },
  { id: "full_review", label: "풀이 전체 검토" },
  { id: "easier_method", label: "더 쉬운 방법" },
];

const statusLabels: Record<SolutionAnalysis["status"], string> = {
  correct: "풀이가 맞아요",
  partially_correct: "거의 다 왔어요",
  incorrect: "고칠 부분이 있어요",
  unclear: "사진 확인이 필요해요",
};

const confidenceLabels: Record<SolutionAnalysis["confidence"], string> = {
  high: "높음",
  medium: "보통",
  low: "낮음",
};

export default function SolutionAnalysisScreen({
  learningContext,
  onBack,
  onContinue,
}: SolutionAnalysisScreenProps) {
  const problemInputRef = useRef<HTMLInputElement>(null);
  const solutionInputRef = useRef<HTMLInputElement>(null);
  const [problemImage, setProblemImage] = useState<string | null>(null);
  const [solutionImage, setSolutionImage] = useState<string | null>(null);
  const [focus, setFocus] = useState<AnalysisFocus>("first_error");
  const [analysis, setAnalysis] = useState<SolutionAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState("");

  const handleFile = async (event: ChangeEvent<HTMLInputElement>, target: "problem" | "solution") => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const optimized = await optimizeImage(file);
      if (target === "problem") setProblemImage(optimized);
      else setSolutionImage(optimized);
      setAnalysis(null);
      setError("");
    } catch (imageError) {
      setError(imageError instanceof Error ? imageError.message : "사진을 처리하지 못했어요.");
    }
  };

  const analyzeSolution = async () => {
    if (!solutionImage || isAnalyzing) return;
    setIsAnalyzing(true);
    setAnalysis(null);
    setError("");

    try {
      const response = await fetch("/api/analyze-solution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problemImageDataUrl: problemImage,
          solutionImageDataUrl: solutionImage,
          focus,
          learningContext,
        }),
      });
      const data = (await response.json()) as { analysis?: SolutionAnalysis; error?: string };
      if (!response.ok || !data.analysis) throw new Error(data.error || "풀이를 분석하지 못했어요.");
      setAnalysis(data.analysis);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "풀이를 분석하지 못했어요.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const resetAnalysis = () => {
    setAnalysis(null);
    setProblemImage(null);
    setSolutionImage(null);
    setError("");
  };

  return (
    <section className="solution-analysis-screen">
      <button className="solution-back" onClick={onBack}><ArrowLeft size={17} /> 질문하기로</button>

      <div className="solution-analysis-heading">
        <span className="eyebrow"><SearchCheck size={16} /> 풀이 사진 전용 분석</span>
        <h1>풀이를 어디서<br />고쳐야 할까?</h1>
        <p>두리가 맞게 푼 부분부터 확인하고, 처음 틀린 한 단계만 정확히 알려줄게.</p>
      </div>

      {!analysis ? (
        <div className="solution-workspace">
          <div className="solution-upload-grid">
            <PhotoSlot
              index="1"
              title="문제 사진"
              description="선택 · 문제와 풀이가 한 장이면 생략 가능"
              image={problemImage}
              onAdd={() => problemInputRef.current?.click()}
              onClear={() => setProblemImage(null)}
            />
            <PhotoSlot
              index="2"
              title="내 풀이 사진"
              description="필수 · 계산 과정이 모두 보이게 촬영"
              image={solutionImage}
              required
              onAdd={() => solutionInputRef.current?.click()}
              onClear={() => setSolutionImage(null)}
            />
          </div>

          <div className="analysis-focus-card">
            <div><Sparkles size={18} /><strong>어떻게 봐줄까?</strong></div>
            <div className="analysis-focus-options">
              {focusOptions.map((option) => (
                <button
                  key={option.id}
                  className={focus === option.id ? "selected" : ""}
                  onClick={() => setFocus(option.id)}
                  aria-pressed={focus === option.id}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="solution-error" role="alert"><TriangleAlert size={16} /> {error}</p>}

          <button className="analyze-solution-button" onClick={() => void analyzeSolution()} disabled={!solutionImage || isAnalyzing}>
            {isAnalyzing ? <><span className="spin"><LoaderCircle size={20} /></span> 풀이를 한 줄씩 보고 있어…</> : <><SearchCheck size={20} /> 내 풀이 분석하기</>}
          </button>
          <p className="analysis-privacy">사진은 분석에만 사용하며 앱에 별도로 저장하지 않아요.</p>
        </div>
      ) : (
        <AnalysisResult
          analysis={analysis}
          solutionImage={solutionImage as string}
          onReset={resetAnalysis}
          onContinue={onContinue}
        />
      )}

      <input ref={problemInputRef} className="visually-hidden" type="file" accept="image/*" capture="environment" onChange={(event) => void handleFile(event, "problem")} />
      <input ref={solutionInputRef} className="visually-hidden" type="file" accept="image/*" capture="environment" onChange={(event) => void handleFile(event, "solution")} />
    </section>
  );
}

function PhotoSlot({
  index,
  title,
  description,
  image,
  required = false,
  onAdd,
  onClear,
}: {
  index: string;
  title: string;
  description: string;
  image: string | null;
  required?: boolean;
  onAdd: () => void;
  onClear: () => void;
}) {
  return (
    <div className={`solution-photo-slot ${image ? "has-image" : ""}`}>
      <div className="photo-slot-heading">
        <span>{index}</span>
        <div><strong>{title}</strong><small>{description}</small></div>
        {required && <em>필수</em>}
      </div>
      {image ? (
        <div className="solution-photo-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt={`${title} 미리보기`} />
          <button onClick={onClear} aria-label={`${title} 지우기`}><X size={18} /></button>
          <button className="replace-photo" onClick={onAdd}><RefreshCw size={15} /> 다시 찍기</button>
        </div>
      ) : (
        <button className="solution-photo-add" onClick={onAdd}>
          {required ? <Camera size={27} /> : <ImagePlus size={27} />}
          <strong>{required ? "풀이 사진 찍기" : "문제 사진 추가"}</strong>
          <span>흔들리지 않게 위에서 찍어주세요</span>
        </button>
      )}
    </div>
  );
}

function AnalysisResult({
  analysis,
  solutionImage,
  onReset,
  onContinue,
}: {
  analysis: SolutionAnalysis;
  solutionImage: string;
  onReset: () => void;
  onContinue: (solutionImage: string, followUpQuestion: string) => void;
}) {
  return (
    <div className="analysis-result" aria-live="polite">
      <div className={`analysis-summary ${analysis.status}`}>
        <div className="analysis-status-icon">{analysis.status === "correct" ? <CheckCircle2 size={25} /> : <SearchCheck size={25} />}</div>
        <div><small>분석 완료 · 신뢰도 {confidenceLabels[analysis.confidence]}</small><h2>{statusLabels[analysis.status]}</h2><p>{analysis.summary}</p></div>
      </div>

      {analysis.correctSteps.length > 0 && (
        <div className="feedback-card correct-feedback">
          <div className="feedback-title"><CheckCircle2 size={19} /><strong>잘한 부분</strong></div>
          <ul>{analysis.correctSteps.map((step, index) => <li key={`${index}-${step}`}>{step}</li>)}</ul>
        </div>
      )}

      <div className={`feedback-card ${analysis.firstError.found ? "error-feedback" : "clear-feedback"}`}>
        <div className="feedback-title"><TriangleAlert size={19} /><strong>{analysis.firstError.found ? "처음 고칠 부분" : "첫 오류를 찾지 못했어요"}</strong></div>
        {analysis.firstError.found ? (
          <>
            <p className="error-step">{analysis.firstError.step}</p>
            <p>{analysis.firstError.explanation}</p>
            <div className="hint-box"><Sparkles size={17} /><span><small>힌트</small>{analysis.firstError.hint}</span></div>
          </>
        ) : <p>{analysis.firstError.explanation || "현재 사진에서 명확한 풀이 오류는 보이지 않아요."}</p>}
      </div>

      <div className="mistake-classification" aria-label="오답 원인 분석">
        <span><SearchCheck size={17} /> 오답 원인</span>
        <strong>{analysis.mistakeLabel || MISTAKE_LABELS[analysis.mistakeCategory]}</strong>
        <p>{analysis.primaryConcept} 이해도에 자동 반영했어요.</p>
      </div>

      <div className="feedback-card next-feedback">
        <div className="feedback-title"><ChevronRight size={19} /><strong>이제 이렇게 해봐</strong></div>
        <p>{analysis.nextAction}</p>
      </div>

      {analysis.recognizedWork.length > 0 && (
        <details className="recognized-work">
          <summary>AI가 읽은 풀이 확인</summary>
          <ol>{analysis.recognizedWork.map((line, index) => <li key={`${index}-${line}`}>{line}</li>)}</ol>
        </details>
      )}

      <div className="analysis-result-actions">
        <button className="continue-chat" onClick={() => onContinue(solutionImage, analysis.followUpQuestion)}><MessageCircle size={18} /> 이어서 물어보기</button>
        <button className="analyze-again" onClick={onReset}><RefreshCw size={17} /> 다른 풀이 분석</button>
      </div>
    </div>
  );
}

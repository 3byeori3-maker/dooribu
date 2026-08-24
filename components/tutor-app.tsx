"use client";

import {
  ArrowUp,
  AlertTriangle,
  BookOpen,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  Home,
  LockKeyhole,
  LoaderCircle,
  LogOut,
  MapPin,
  MessageCircleQuestion,
  Mic,
  Paperclip,
  PencilLine,
  RotateCcw,
  School,
  SlidersHorizontal,
  Sparkles,
  Target,
  TrendingUp,
  UserRound,
  WandSparkles,
  X,
} from "lucide-react";
import { ChangeEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { generateStudyPlan } from "@/lib/planning/generate-plan";
import type { GeneratedPlan, PlanInput, WeeklyAvailability } from "@/lib/planning/types";
import SolutionAnalysisScreen from "@/components/solution-analysis-screen";
import Scratchpad from "@/components/scratchpad";
import { ConceptCheckCard, ConceptCheckLoading } from "@/components/concept-check-card";
import { optimizeImage } from "@/lib/images/optimize";
import { EMPTY_TEXTBOOK, type LearningProfile, type TextbookMetadata } from "@/lib/learning-profile/types";
import { createClient } from "@/lib/supabase/client";
import type { ConceptCheck } from "@/lib/concept-check/types";
import { MISTAKE_LABELS, type ConceptMastery } from "@/lib/mastery/types";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  hintLevel?: number;
};

const starterQuestions = ["문제 뜻을 모르겠어", "식을 못 세우겠어", "계산하다 막혔어", "어디서부터 할지 모르겠어"];

const DEFAULT_LEARNING_CONTEXT = {
  grade: "중1",
  curriculum: "2022 개정",
  textbook: "학교 지정 수학 1",
  currentUnit: "문자와 식",
  schoolProgress: "2단원 3차시",
  nextExam: "중간고사까지 28일",
};

const makeId = () => Math.random().toString(36).slice(2);
const LEGACY_PERSONAL_STORAGE_KEYS = ["doori:study-plan:v1", "doori:learning-profile:v1"];
const TRAILING_QUICK_REPLY_GROUP = /(?:\s*\[[^\[\]\r\n]{1,40}\]){2,}\s*$/u;
const QUICK_REPLY_ITEM = /\[([^\[\]\r\n]{1,40})\]/gu;

const parseQuickReplies = (content: string) => {
  const group = TRAILING_QUICK_REPLY_GROUP.exec(content);
  if (!group || group.index === undefined) return { body: content, replies: [] as string[] };

  const replies = Array.from(group[0].matchAll(QUICK_REPLY_ITEM), (match) => match[1].trim())
    .filter((reply, index, all) => reply.length > 0 && all.indexOf(reply) === index)
    .slice(0, 4);

  if (replies.length < 2) return { body: content, replies: [] as string[] };
  return { body: content.slice(0, group.index).trimEnd(), replies };
};

const WEEKDAYS = [
  { value: 1, label: "월" },
  { value: 2, label: "화" },
  { value: 3, label: "수" },
  { value: 4, label: "목" },
  { value: 5, label: "금" },
  { value: 6, label: "토" },
  { value: 0, label: "일" },
];

const formatPlanDate = (dateKey: string) => {
  const date = new Date(`${dateKey}T12:00:00`);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (date.toDateString() === today.toDateString()) return "오늘";
  if (date.toDateString() === tomorrow.toDateString()) return "내일";
  return `${date.getMonth() + 1}/${date.getDate()} ${["일", "월", "화", "수", "목", "금", "토"][date.getDay()]}`;
};

export default function TutorApp() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<"ask" | "solution" | "plan" | "profile">("ask");
  const [mode, setMode] = useState<"home" | "chat">("home");
  const [question, setQuestion] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConceptLoading, setIsConceptLoading] = useState(false);
  const [conceptFirst, setConceptFirst] = useState(false);
  const [conceptCheck, setConceptCheck] = useState<ConceptCheck | null>(null);
  const [conceptSourceQuestion, setConceptSourceQuestion] = useState("");
  const [error, setError] = useState("");
  const [scratchpadOpen, setScratchpadOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [learningProfile, setLearningProfile] = useState<LearningProfile | null>(null);

  useEffect(() => {
    LEGACY_PERSONAL_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
    let cancelled = false;
    void fetch("/api/learning-profile")
      .then(async (response) => response.ok ? response.json() as Promise<{ profile: LearningProfile | null }> : null)
      .then((data) => {
        if (!cancelled) setLearningProfile(data?.profile ?? null);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const saveLearningProfile = async (profile: LearningProfile) => {
    const response = await fetch("/api/learning-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile }),
    });
    const data = (await response.json()) as { profile?: LearningProfile; error?: string };
    if (!response.ok) throw new Error(data.error || "학습 정보를 저장하지 못했어요.");
    setLearningProfile(data.profile ?? profile);
    navigateTo("plan");
  };

  const learningContext = {
    ...DEFAULT_LEARNING_CONTEXT,
    grade: learningProfile?.textbook.gradeLevel || DEFAULT_LEARNING_CONTEXT.grade,
    curriculum: learningProfile?.textbook.curriculum || DEFAULT_LEARNING_CONTEXT.curriculum,
    textbook: learningProfile?.textbook.title || DEFAULT_LEARNING_CONTEXT.textbook,
  };

  const navigateTo = (section: "ask" | "solution" | "plan" | "profile") => {
    setActiveSection(section);
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  };

  useEffect(() => {
    const messageContainer = chatEndRef.current?.parentElement;
    messageContainer?.scrollTo({ top: messageContainer.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  const handleImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 6 * 1024 * 1024) {
      setError("사진은 6MB 이하로 올려주세요.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImageDataUrl(String(reader.result));
      setConceptCheck(null);
      setConceptSourceQuestion("");
      setMessages([]);
      setMode("chat");
      setError("");
    };
    reader.readAsDataURL(file);
  };

  const startConceptCheck = async (questionOverride?: string, imageOverride?: string) => {
    const sourceQuestion = (questionOverride ?? question).trim();
    const attachedImage = imageOverride ?? imageDataUrl;
    if ((!sourceQuestion && !attachedImage) || isConceptLoading) {
      if (!sourceQuestion && !attachedImage) setError("확인할 문제를 입력하거나 사진을 올려주세요.");
      return;
    }

    setMode("chat");
    setMessages([]);
    setConceptCheck(null);
    setConceptSourceQuestion(sourceQuestion);
    setQuestion("");
    setError("");
    setIsConceptLoading(true);

    try {
      const response = await fetch("/api/concept-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: sourceQuestion, imageDataUrl: attachedImage, learningContext }),
      });
      const data = (await response.json()) as { conceptCheck?: ConceptCheck; error?: string };
      if (!response.ok || !data.conceptCheck) throw new Error(data.error || "개념 확인 응답 오류");
      setConceptCheck(data.conceptCheck);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "개념을 확인하지 못했어요.");
    } finally {
      setIsConceptLoading(false);
    }
  };

  const sendQuestion = async (preset?: string, imageOverride?: string, hintLevelOverride?: number) => {
    const text = (preset ?? question).trim();
    const attachedImage = imageOverride ?? imageDataUrl;
    if ((!text && !attachedImage) || isLoading) return;

    const userMessage: Message = {
      id: makeId(),
      role: "user",
      content: text || "이 문제, 어디서부터 시작하면 돼?",
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setQuestion("");
    setMode("chat");
    setError("");
    setIsLoading(true);

    const userTurnCount = nextMessages.filter((message) => message.role === "user").length;
    const hintLevel = hintLevelOverride ?? Math.min(3, 1 + Math.floor((userTurnCount - 1) / 2));

    try {
      const response = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: userMessage.content,
          imageDataUrl: attachedImage,
          history: messages.map(({ role, content }) => ({ role, content })),
          learningContext,
          hintLevel,
        }),
      });
      const data = (await response.json()) as { answer?: string; hintLevel?: number; error?: string };
      if (!response.ok || !data.answer) throw new Error(data.error || "응답 오류");

      setMessages((current) => [
        ...current,
        { id: makeId(), role: "assistant", content: data.answer as string, hintLevel: data.hintLevel ?? hintLevel },
      ]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "AI 선생님과 연결하지 못했어요.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && event.ctrlKey) {
      event.preventDefault();
      if (mode === "home" && conceptFirst) void startConceptCheck();
      else void sendQuestion();
    }
  };

  const resetSession = () => {
    setMessages([]);
    setImageDataUrl(null);
    setQuestion("");
    setError("");
    setConceptCheck(null);
    setConceptSourceQuestion("");
    setConceptFirst(false);
    setMode("home");
    setActiveSection("ask");
  };

  const handleSignOut = async () => {
    LEGACY_PERSONAL_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
    const { error: signOutError } = await createClient().auth.signOut();
    if (signOutError) {
      setError("로그아웃하지 못했어요. 잠시 후 다시 시도해주세요.");
      return;
    }
    router.replace("/login");
    router.refresh();
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={resetSession} aria-label="두리 홈">
          <span className="brand-mark">두</span>
          <span>
            <strong>두리</strong>
            <small>AI 수학 선생님</small>
          </span>
        </button>
        <div className="level-pill"><BookOpen size={15} /> 중1 · 1학기</div>
        <button className="icon-button" onClick={() => void handleSignOut()} aria-label="로그아웃">
          <LogOut size={18} />
        </button>
        {mode === "chat" && (
          <button className="icon-button" onClick={resetSession} aria-label="새 질문">
            <RotateCcw size={19} />
          </button>
        )}
      </header>

      {activeSection === "solution" ? (
        <SolutionAnalysisScreen
          learningContext={learningContext}
          onBack={() => navigateTo("ask")}
          onContinue={(solutionImage, followUpQuestion) => {
            setImageDataUrl(solutionImage);
            setQuestion(followUpQuestion);
            setMessages([]);
            setMode("chat");
            navigateTo("ask");
          }}
        />
      ) : activeSection === "plan" ? (
        <StudyPlanScreen learningProfile={learningProfile} learningContext={learningContext} onConnectTextbook={() => navigateTo("profile")} />
      ) : activeSection === "profile" ? (
        <LearningProfileScreen
          key={learningProfile?.updatedAt ?? "empty-profile"}
          profile={learningProfile}
          onBack={() => navigateTo("plan")}
          onSave={saveLearningProfile}
        />
      ) : mode === "home" ? (
        <HomeScreen
          question={question}
          setQuestion={setQuestion}
          handleKeyDown={handleKeyDown}
          submitQuestion={() => conceptFirst ? void startConceptCheck() : void sendQuestion()}
          conceptFirst={conceptFirst}
          toggleConceptFirst={() => setConceptFirst((current) => !current)}
          openCamera={() => fileInputRef.current?.click()}
          openSolutionAnalysis={() => navigateTo("solution")}
          error={error}
        />
      ) : (
        <section className="study-layout">
          <ProblemPanel
            imageDataUrl={imageDataUrl}
            openCamera={() => fileInputRef.current?.click()}
            openScratchpad={() => setScratchpadOpen(true)}
            clearImage={() => {
              setImageDataUrl(null);
              setConceptCheck(null);
              setConceptSourceQuestion("");
            }}
          />
          <ChatPanel
            messages={messages}
            question={question}
            setQuestion={setQuestion}
            handleKeyDown={handleKeyDown}
            sendQuestion={sendQuestion}
            openCamera={() => fileInputRef.current?.click()}
            openScratchpad={() => setScratchpadOpen(true)}
            hasProblemContext={Boolean(imageDataUrl || conceptSourceQuestion)}
            conceptCheck={conceptCheck}
            isConceptLoading={isConceptLoading}
            startConceptCheck={() => void startConceptCheck()}
            skipConceptCheck={() => void sendQuestion(conceptSourceQuestion || "이 문제를 어디서부터 시작할지 첫 단계만 알려줘.")}
            continueAfterConcept={() => void sendQuestion(`${conceptCheck?.bridgePrompt ?? "첫 단계를 스스로 찾도록 질문해줘."}${conceptSourceQuestion ? `\n원래 질문: ${conceptSourceQuestion}` : ""}`)}
            isLoading={isLoading}
            error={error}
            chatEndRef={chatEndRef}
          />
        </section>
      )}

      <input
        ref={fileInputRef}
        className="visually-hidden"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleImage}
      />

      <Scratchpad
        open={scratchpadOpen}
        onClose={() => setScratchpadOpen(false)}
        onSubmit={(drawing) => {
          setScratchpadOpen(false);
          setImageDataUrl(drawing);
          void sendQuestion("내 풀이를 보고, 맞게 한 부분과 처음 고칠 부분을 알려줘.", drawing);
        }}
      />

      <nav className="bottom-nav" aria-label="주요 메뉴">
        <button className={activeSection === "ask" || activeSection === "solution" ? "active" : ""} onClick={() => navigateTo("ask")}><Home size={20} /><span>질문하기</span></button>
        <button className={activeSection === "plan" ? "active" : ""} onClick={() => navigateTo("plan")}><CalendarDays size={20} /><span>학습계획</span></button>
        <button className={activeSection === "profile" ? "active" : ""} onClick={() => navigateTo("profile")}><UserRound size={20} /><span>내 학습</span></button>
      </nav>
    </main>
  );
}

function StudyPlanScreen({ learningProfile, learningContext, onConnectTextbook }: {
  learningProfile: LearningProfile | null;
  learningContext: typeof DEFAULT_LEARNING_CONTEXT;
  onConnectTextbook: () => void;
}) {
  const [isPlannerOpen, setIsPlannerOpen] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<GeneratedPlan | null>(null);
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [mastery, setMastery] = useState<ConceptMastery[]>([]);

  useEffect(() => {
    void fetch("/api/study-plans")
      .then(async (response) => response.ok ? response.json() as Promise<{ plan: GeneratedPlan | null }> : null)
      .then((data) => {
        setGeneratedPlan(data?.plan ?? null);
      })
      .catch(() => undefined);

    void fetch("/api/mastery")
      .then(async (response) => response.ok ? response.json() as Promise<{ concepts: ConceptMastery[] }> : null)
      .then((data) => setMastery(data?.concepts ?? []))
      .catch(() => undefined);
  }, []);
  const fallbackItems = [
    { id: "fallback-1", day: "오늘", title: "문자와 식 · 교과서 개념", meta: "p.54~57 · 15분", state: "current" },
    { id: "fallback-2", day: "오늘", title: "학교 진도 확인 문제", meta: "기본 5문제 · 10분", state: "next" },
    { id: "fallback-3", day: "내일", title: "분배법칙 오답 복습", meta: "취약 개념 · 8분", state: "next" },
    { id: "fallback-4", day: "목요일", title: "교과서 2단원 마무리", meta: "단원평가 · 20분", state: "next" },
  ];
  const planItems = generatedPlan
    ? (showAllSessions ? generatedPlan.sessions : generatedPlan.sessions.slice(0, 6)).map((session, index) => ({
        id: session.id,
        day: formatPlanDate(session.date),
        title: session.title,
        meta: `${session.pageRange ? `${session.pageRange} · ` : ""}${session.durationMinutes}분`,
        state: index === 0 ? "current" : "next",
      }))
    : fallbackItems;
  const todayMinutes = generatedPlan
    ? generatedPlan.sessions
        .filter((session) => formatPlanDate(session.date) === "오늘")
        .reduce((sum, session) => sum + session.durationMinutes, 0)
    : 25;

  return (
    <section className="plan-screen">
      <div className="plan-hero">
        <div>
          <span className="eyebrow"><CalendarDays size={15} /> 학교 진도에 맞춘 계획</span>
          <h1>이번 주 학습계획</h1>
          <p>못한 날은 자동으로 다시 배치하고, 시험이 가까워지면 취약 개념을 먼저 공부해요.</p>
          <button className="planner-open-button" onClick={() => setIsPlannerOpen(true)}>
            <WandSparkles size={17} /> {generatedPlan ? "시험 계획 다시 만들기" : "시험 범위로 계획 만들기"}
          </button>
        </div>
        <div className="plan-score">
          <span>{generatedPlan ? "시험 범위" : "이번 주"}</span>
          <strong>{generatedPlan ? generatedPlan.coveragePercent : 4}<small>{generatedPlan ? "%" : "/6"}</small></strong>
          <em>{generatedPlan ? "계획 커버리지" : "학습 완료"}</em>
        </div>
      </div>

      {generatedPlan?.warning && (
        <div className={`plan-warning ${generatedPlan.status}`}>
          <AlertTriangle size={18} />
          <div><strong>{generatedPlan.status === "overloaded" ? "시간이 조금 부족해요" : "일정이 빠듯해요"}</strong><p>{generatedPlan.warning}</p></div>
          <button onClick={() => setIsPlannerOpen(true)}>조정</button>
        </div>
      )}

      {generatedPlan && !generatedPlan.warning && (
        <div className="plan-ready-banner">
          <CheckCircle2 size={18} /> 총 {generatedPlan.studyDayCount}일 · {generatedPlan.scheduledMinutes}분 계획이 준비됐어요.
        </div>
      )}

      {generatedPlan && (generatedPlan.weakConceptCount ?? 0) > 0 && (
        <div className="weak-review-banner">
          <Target size={18} /> 취약 개념 {generatedPlan.weakConceptCount}개를 시험 계획 앞부분에 자동 배치했어요.
        </div>
      )}

      <div className="plan-grid">
        <div className="plan-main-card">
          <div className="card-title-row">
            <div><Target size={19} /><strong>{generatedPlan ? "전체 학습 일정" : "오늘 할 일"}</strong></div>
            <span>{generatedPlan ? `총 ${generatedPlan.sessions.length}회` : `약 ${todayMinutes}분`}</span>
          </div>
          <div className="plan-timeline">
            {planItems.map((item) => (
              <div className={`plan-item ${item.state}`} key={item.id}>
                <span className="plan-dot">{item.state === "current" ? <CheckCircle2 size={18} /> : <Circle size={17} />}</span>
                <div><small>{item.day}</small><strong>{item.title}</strong><p>{item.meta}</p></div>
                <ChevronRight size={18} />
              </div>
            ))}
          </div>
          {generatedPlan && generatedPlan.sessions.length > 6 && (
            <button className="show-all-plan" onClick={() => setShowAllSessions((current) => !current)}>
              {showAllSessions ? "간단히 보기" : `전체 ${generatedPlan.sessions.length}개 일정 보기`}
              <ChevronRight size={16} />
            </button>
          )}
        </div>

        <aside className="plan-side">
          <div className="textbook-card">
            <div className="textbook-icon"><BookOpen size={24} /></div>
            <div className="textbook-copy">
              <small>내 학교 교과서</small>
              <strong>{learningContext.textbook}</strong>
              <p>{learningProfile?.schoolName ? `${learningProfile.schoolName} · ` : ""}{learningContext.grade} · {learningContext.curriculum}</p>
            </div>
            <span className={`connection-badge ${learningProfile ? "confirmed" : ""}`}>{learningProfile ? "메타데이터 확인" : "확인 필요"}</span>
            <button onClick={onConnectTextbook}>{learningProfile ? "학교·교과서 정보 수정" : "학교·교과서 확인"} <ChevronRight size={17} /></button>
          </div>

          <div className="progress-card">
            <div className="card-title-row"><div><TrendingUp size={19} /><strong>학교 진도</strong></div><span>{learningContext.schoolProgress}</span></div>
            <div className="progress-track"><span style={{ width: "46%" }} /></div>
            <div className="progress-labels"><span>문자와 식</span><span>46%</span></div>
            <div className="exam-pill"><Clock3 size={16} /> {learningContext.nextExam}</div>
          </div>
        </aside>
      </div>

      {isPlannerOpen && (
        <PlannerWizard
          currentPlan={generatedPlan}
          textbookTitle={learningProfile?.textbook.title || ""}
          weakConcepts={mastery.map(({ conceptName, masteryScore }) => ({ conceptName, masteryScore }))}
          onClose={() => setIsPlannerOpen(false)}
          onGenerate={(plan, input) => {
            setGeneratedPlan(plan);
            void fetch("/api/study-plans", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ plan, input }),
            }).catch(() => undefined);
            setShowAllSessions(false);
            setIsPlannerOpen(false);
            requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
          }}
        />
      )}
    </section>
  );
}

function PlannerWizard({
  currentPlan,
  textbookTitle,
  weakConcepts,
  onClose,
  onGenerate,
}: {
  currentPlan: GeneratedPlan | null;
  textbookTitle: string;
  weakConcepts: Array<{ conceptName: string; masteryScore: number }>;
  onClose: () => void;
  onGenerate: (plan: GeneratedPlan, input: PlanInput) => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [examDate, setExamDate] = useState("");
  const [rangeTitle, setRangeTitle] = useState("문자와 식");
  const [pageFrom, setPageFrom] = useState(1);
  const [pageTo, setPageTo] = useState(20);
  const [availability, setAvailability] = useState<WeeklyAvailability>({
    0: 0,
    1: 30,
    2: 0,
    3: 30,
    4: 0,
    5: 30,
    6: 45,
  });

  useEffect(() => {
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 28);
    setExamDate(defaultDate.toISOString().slice(0, 10));
  }, []);

  const toggleDay = (day: number) => {
    setAvailability((current) => ({ ...current, [day]: current[day] > 0 ? 0 : 30 }));
  };

  const totalWeeklyMinutes = Object.values(availability).reduce((sum, minutes) => sum + minutes, 0);
  const pageCount = Math.max(0, pageTo - pageFrom + 1);
  const estimatedMinutes = Math.max(60, pageCount * 7);
  const canContinue = Boolean(examDate && rangeTitle.trim()) && pageFrom > 0 && pageTo >= pageFrom;
  const canGenerate = totalWeeklyMinutes > 0;

  const handleGenerate = () => {
    if (!canGenerate) return;
    const unitId = "student-entered-range";
    const input = { examDate, selectedUnitIds: [unitId], availability, weakConcepts };
    const studentRange = [{
      id: unitId,
      order: 1,
      title: rangeTitle.trim(),
      pageFrom,
      pageTo,
      estimatedMinutes,
      concepts: [`${rangeTitle.trim()} 기본 원리`, `${rangeTitle.trim()} 대표 유형`],
    }];
    onGenerate(generateStudyPlan(input, studentRange), input);
  };

  return (
    <div className="planner-overlay" role="dialog" aria-modal="true" aria-labelledby="planner-title">
      <div className="planner-dialog">
        <div className="planner-header">
          <div><span>STEP {step} / 2</span><h2 id="planner-title">{step === 1 ? "시험 범위를 알려줘" : "공부할 수 있는 시간을 알려줘"}</h2></div>
          <button onClick={onClose} aria-label="계획 만들기 닫기"><X size={21} /></button>
        </div>
        <div className="planner-progress"><span style={{ width: step === 1 ? "50%" : "100%" }} /></div>

        {step === 1 ? (
          <div className="planner-body">
            <label className="field-label" htmlFor="exam-date">시험일</label>
            <input id="exam-date" className="date-input" type="date" value={examDate} onChange={(event) => setExamDate(event.target.value)} />

            <div className="field-title-row"><span className="field-label">시험 범위 직접 입력</span><small>{pageCount}쪽 · 예상 {estimatedMinutes}분</small></div>
            <div className="exam-range-fields">
              <label><span>단원 또는 범위 이름</span><input value={rangeTitle} onChange={(event) => setRangeTitle(event.target.value)} placeholder="예: 문자와 식" /></label>
              <div>
                <label><span>시작 페이지</span><input type="number" min="1" value={pageFrom} onChange={(event) => setPageFrom(Math.max(1, Number(event.target.value)))} /></label>
                <label><span>끝 페이지</span><input type="number" min={pageFrom} value={pageTo} onChange={(event) => setPageTo(Math.max(1, Number(event.target.value)))} /></label>
              </div>
            </div>
            <p className="temporary-data-note">{textbookTitle ? `${textbookTitle}에서 ` : "교과서에서 "}학교가 안내한 범위를 직접 확인해 입력해주세요. 본문은 복제하거나 저장하지 않아요.</p>
          </div>
        ) : (
          <div className="planner-body">
            <div className="availability-summary">
              <Clock3 size={20} />
              <div><small>일주일에 공부 가능한 시간</small><strong>{totalWeeklyMinutes}분</strong></div>
            </div>
            <p className="availability-help">공부할 수 있는 요일을 누르고, 하루 시간을 조절해주세요.</p>
            <div className="availability-grid">
              {WEEKDAYS.map((day) => {
                const minutes = availability[day.value] ?? 0;
                const active = minutes > 0;
                return (
                  <div className={`availability-day ${active ? "active" : ""}`} key={day.value}>
                    <button onClick={() => toggleDay(day.value)}>{day.label}</button>
                    {active ? (
                      <label><input type="number" min="10" max="180" step="5" value={minutes} onChange={(event) => setAvailability((current) => ({ ...current, [day.value]: Math.max(0, Number(event.target.value)) }))} /><span>분</span></label>
                    ) : <small>쉬는 날</small>}
                  </div>
                );
              })}
            </div>
            {currentPlan && <p className="regenerate-note"><SlidersHorizontal size={15} /> 새 설정으로 기존 계획을 안전하게 다시 만들어요.</p>}
          </div>
        )}

        <div className="planner-footer">
          {step === 2 && <button className="secondary" onClick={() => setStep(1)}>이전</button>}
          <button
            className="primary"
            onClick={() => step === 1 ? setStep(2) : handleGenerate()}
            disabled={step === 1 ? !canContinue : !canGenerate}
          >
            {step === 1 ? "학습 시간 입력" : "자동 계획 생성"} <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

function LearningProfileScreen({ profile, onBack, onSave }: {
  profile: LearningProfile | null;
  onBack: () => void;
  onSave: (profile: LearningProfile) => Promise<void>;
}) {
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [region, setRegion] = useState(profile?.region ?? "서울");
  const [schoolName, setSchoolName] = useState(profile?.schoolName ?? "");
  const [schoolConfirmed, setSchoolConfirmed] = useState(profile?.schoolConfirmedByUser ?? false);
  const [textbook, setTextbook] = useState<TextbookMetadata>(profile?.textbook ?? EMPTY_TEXTBOOK);
  const [textbookConfirmed, setTextbookConfirmed] = useState(profile?.textbookConfirmedByUser ?? false);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [isAnalyzingCover, setIsAnalyzingCover] = useState(false);
  const [error, setError] = useState("");
  const [mastery, setMastery] = useState<ConceptMastery[]>([]);
  const [isMasteryLoading, setIsMasteryLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void fetch("/api/mastery")
      .then(async (response) => response.ok ? response.json() as Promise<{ concepts: ConceptMastery[] }> : null)
      .then((data) => setMastery(data?.concepts ?? []))
      .catch(() => undefined)
      .finally(() => setIsMasteryLoading(false));
  }, []);

  const updateTextbook = (patch: Partial<TextbookMetadata>) => {
    setTextbook((current) => ({ ...current, ...patch }));
    setTextbookConfirmed(false);
  };

  const handleCover = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      setCoverImage(await optimizeImage(file, 1800));
      setError("");
    } catch (coverError) {
      setError(coverError instanceof Error ? coverError.message : "표지를 읽지 못했어요.");
    }
  };

  const analyzeCover = async () => {
    if (!coverImage || isAnalyzingCover) return;
    setIsAnalyzingCover(true);
    setError("");
    try {
      const response = await fetch("/api/identify-textbook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: coverImage }),
      });
      const data = (await response.json()) as { metadata?: TextbookMetadata; error?: string };
      if (!response.ok || !data.metadata) throw new Error(data.error || "표지를 분석하지 못했어요.");
      const candidate = data.metadata;
      const gradeMatch = candidate.gradeLevel.match(/[123]/)?.[0];
      const normalizedGrade = gradeMatch ? `중${gradeMatch}` : textbook.gradeLevel;
      const normalizedSemester = candidate.semester.includes("2")
        ? "2학기"
        : candidate.semester.includes("1") ? "1학기" : textbook.semester;
      setTextbook((current) => ({
        ...current,
        ...candidate,
        title: candidate.title || current.title,
        publisher: candidate.publisher || current.publisher,
        authors: candidate.authors.length > 0 ? candidate.authors : current.authors,
        subject: candidate.subject || current.subject,
        gradeLevel: normalizedGrade,
        semester: normalizedSemester,
        curriculum: candidate.curriculum || current.curriculum,
        isbn: candidate.isbn || current.isbn,
      }));
      setTextbookConfirmed(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "표지를 분석하지 못했어요.");
    } finally {
      setIsAnalyzingCover(false);
    }
  };

  const canSave = schoolConfirmed && textbookConfirmed && Boolean(textbook.title.trim() && textbook.publisher.trim());

  const handleSave = async () => {
    if (!canSave || isSaving) return;
    setIsSaving(true);
    setError("");
    try {
      await onSave({
        region,
        schoolName: schoolName.trim(),
        schoolConfirmedByUser: true,
        textbook: { ...textbook, title: textbook.title.trim(), publisher: textbook.publisher.trim() },
        textbookConfirmedByUser: true,
        updatedAt: new Date().toISOString(),
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "학습 정보를 저장하지 못했어요.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="profile-screen">
      <button className="back-link" onClick={onBack}>‹ 학습계획으로</button>
      <div className="profile-heading">
        <span className="eyebrow"><TrendingUp size={15} /> 내 학습 데이터</span>
        <h1>개념별 이해도 지도</h1>
        <p>개념 체크와 풀이 분석 결과가 쌓일수록 취약 개념과 복습 시점을 더 정확히 알려줘요.</p>
      </div>

      <section className="mastery-map" aria-labelledby="mastery-map-title">
        <div className="mastery-map-heading">
          <div><Target size={19} /><strong id="mastery-map-title">개념 이해도</strong></div>
          <span>강함 75점 이상 · 복습 필요 50점 미만</span>
        </div>
        {isMasteryLoading ? (
          <div className="mastery-empty"><LoaderCircle className="spin" size={20} /> 이해도 기록을 불러오는 중…</div>
        ) : mastery.length === 0 ? (
          <div className="mastery-empty"><Sparkles size={20} /> 개념 체크나 풀이 분석을 한 번 완료하면 지도가 시작돼요.</div>
        ) : (
          <div className="mastery-grid">
            {mastery.map((concept) => (
              <article className={`mastery-item ${concept.level}`} key={concept.conceptKey}>
                <div><span>{concept.level === "strong" ? "잘 알아요" : concept.level === "developing" ? "연습 중" : "복습 필요"}</span><strong>{concept.masteryScore}</strong></div>
                <h2>{concept.conceptName}</h2>
                <div className="mastery-track"><i style={{ width: `${concept.masteryScore}%` }} /></div>
                <p>{concept.attempts}회 학습 · {MISTAKE_LABELS[concept.lastMistakeCategory]}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="profile-subheading"><School size={18} /><div><strong>학교와 교과서 정보</strong><p>계획에 표시할 메타데이터만 관리해요.</p></div></div>

      <div className="profile-form-grid">
        <section className="metadata-form-card">
          <div className="metadata-card-title"><span>1</span><div><strong>학교 정보</strong><small>학생이 직접 확인</small></div></div>
          <div className="school-fields">
            <label><span>지역</span><select value={region} onChange={(event) => { setRegion(event.target.value); setSchoolConfirmed(false); }}><option>서울</option><option>부산</option><option>대구</option><option>인천</option><option>광주</option><option>대전</option><option>울산</option><option>세종</option><option>경기</option><option>강원</option><option>충북</option><option>충남</option><option>전북</option><option>전남</option><option>경북</option><option>경남</option><option>제주</option></select></label>
            <label><span>학교명</span><div><MapPin size={17} /><input value={schoolName} onChange={(event) => { setSchoolName(event.target.value); setSchoolConfirmed(false); }} placeholder="예: 두리중학교" /></div></label>
          </div>
          <button className={`confirm-metadata-button ${schoolConfirmed ? "confirmed" : ""}`} disabled={!schoolName.trim()} onClick={() => setSchoolConfirmed(true)}>{schoolConfirmed ? <><CheckCircle2 size={17} /> 학교 정보 확인됨</> : "입력한 학교 정보 확인"}</button>
          <p className="metadata-caution">현재는 공식 학교 재학 인증이 아니라 사용자가 입력 내용을 확인하는 단계입니다.</p>
        </section>

        <section className="metadata-form-card">
          <div className="metadata-card-title"><span>2</span><div><strong>교과서 메타데이터</strong><small>표지 AI 후보 + 사용자 최종 확인</small></div></div>
          <div className="cover-identification">
            {coverImage ? <div className="cover-preview"><img src={coverImage} alt="교과서 표지 미리보기" /><button onClick={() => setCoverImage(null)} aria-label="표지 사진 지우기"><X size={16} /></button></div> : <button className="cover-upload" onClick={() => coverInputRef.current?.click()}><Camera size={24} /><strong>표지 사진 추가</strong><small>제목과 출판사가 보이게 촬영</small></button>}
            <button className="analyze-cover-button" disabled={!coverImage || isAnalyzingCover} onClick={() => void analyzeCover()}>{isAnalyzingCover ? <><span className="spin"><LoaderCircle size={18} /></span> 표지 읽는 중…</> : <><Sparkles size={18} /> AI로 정보 후보 채우기</>}</button>
          </div>

          <div className="textbook-metadata-fields">
            <label><span>교과서명 *</span><input value={textbook.title} onChange={(event) => updateTextbook({ title: event.target.value })} placeholder="예: 중학교 수학 1" /></label>
            <label><span>출판사 *</span><input value={textbook.publisher} onChange={(event) => updateTextbook({ publisher: event.target.value })} placeholder="표지의 출판사명" /></label>
            <label><span>저자</span><input value={textbook.authors.join(", ")} onChange={(event) => updateTextbook({ authors: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} placeholder="쉼표로 구분" /></label>
            <label><span>ISBN</span><input value={textbook.isbn} onChange={(event) => updateTextbook({ isbn: event.target.value })} inputMode="numeric" placeholder="선택 입력" /></label>
            <label><span>교육과정</span><input value={textbook.curriculum} onChange={(event) => updateTextbook({ curriculum: event.target.value })} placeholder="예: 2022 개정 교육과정" /></label>
            <div><label><span>학년</span><select value={textbook.gradeLevel} onChange={(event) => updateTextbook({ gradeLevel: event.target.value })}><option>중1</option><option>중2</option><option>중3</option></select></label><label><span>학기</span><select value={textbook.semester} onChange={(event) => updateTextbook({ semester: event.target.value })}><option>1학기</option><option>2학기</option><option>공통</option></select></label></div>
          </div>
          {textbook.notes && <p className="ai-metadata-note"><Sparkles size={14} /> AI 안내: {textbook.notes}</p>}
          <label className="metadata-confirm-check"><input type="checkbox" checked={textbookConfirmed} onChange={(event) => setTextbookConfirmed(event.target.checked)} /><span>표지와 대조했으며 위 정보가 맞습니다.</span></label>
          <input ref={coverInputRef} className="visually-hidden" type="file" accept="image/*" capture="environment" onChange={(event) => void handleCover(event)} />
        </section>
      </div>

      {error && <p className="solution-error" role="alert"><AlertTriangle size={16} /> {error}</p>}
      <button className="save-profile-button" disabled={!canSave || isSaving} onClick={() => void handleSave()}>{isSaving ? <><LoaderCircle className="spin" size={18} /> 저장 중…</> : <><CheckCircle2 size={18} /> 확인 정보 저장하고 계획 만들기</>}</button>

      <div className="rights-note">
        <LockKeyhole size={20} />
        <div><strong>‘확인’은 교과서 전문 이용권 연결이 아니에요</strong><p>저장되는 것은 제목·출판사·학년 같은 식별 정보뿐입니다. 전문 기반 학습은 출판사와 정식 계약된 교과서에만 별도로 제공합니다.</p></div>
      </div>
    </section>
  );
}

function HomeScreen({
  question,
  setQuestion,
  handleKeyDown,
  submitQuestion,
  conceptFirst,
  toggleConceptFirst,
  openCamera,
  openSolutionAnalysis,
  error,
}: {
  question: string;
  setQuestion: (value: string) => void;
  handleKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  submitQuestion: () => void;
  conceptFirst: boolean;
  toggleConceptFirst: () => void;
  openCamera: () => void;
  openSolutionAnalysis: () => void;
  error: string;
}) {
  return (
    <section className="home-screen">
      <div className="welcome-copy">
        <span className="eyebrow"><Sparkles size={15} /> 바로 물어봐도 괜찮아</span>
        <h1>어디가 막혔어?</h1>
        <p>문제를 찍으면 두리가 한 단계씩 같이 풀어줄게.</p>
      </div>

      <button className="camera-card" onClick={openCamera}>
        <span className="camera-orbit"><Camera size={34} strokeWidth={2.2} /></span>
        <span><strong>문제 찍어서 물어보기</strong><small>교과서, 문제집, 손으로 쓴 풀이까지</small></span>
        <ChevronRight size={23} />
      </button>

      <div className="quick-actions">
        <button onClick={openSolutionAnalysis}><PencilLine size={21} /><span>풀이 분석</span></button>
        <button onClick={() => setQuestion("말로 질문하고 싶어요")}><Mic size={21} /><span>말로 질문</span></button>
        <button onClick={() => document.querySelector<HTMLTextAreaElement>(".home-composer textarea")?.focus()}><PencilLine size={21} /><span>직접 입력</span></button>
      </div>

      <button
        type="button"
        className={`concept-first-toggle ${conceptFirst ? "active" : ""}`}
        aria-pressed={conceptFirst}
        onClick={toggleConceptFirst}
      >
        <Sparkles size={17} />
        <span><strong>풀이 전에 개념부터 확인</strong><small>{conceptFirst ? "켜짐 · 짧은 진단 후 문제를 풀어요" : "필요한 개념을 먼저 점검해요"}</small></span>
        <i />
      </button>

      <div className="home-composer">
        <MessageCircleQuestion size={20} />
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="예: 왜 이항하면 부호가 바뀌어?"
          rows={1}
        />
        <button onClick={submitQuestion} disabled={!question.trim()} aria-label={conceptFirst ? "개념 확인 시작" : "질문 보내기"}>
          <ArrowUp size={20} />
        </button>
      </div>
      <p className="input-hint">Enter 줄바꿈 · Ctrl+Enter 보내기</p>
      {error && <p className="error-message">{error}</p>}

      <div className="recent-card">
        <div className="recent-icon"><CheckCircle2 size={20} /></div>
        <span><small>최근에 이해한 개념</small><strong>일차방정식에서 이항하기</strong></span>
        <ChevronRight size={20} />
      </div>
    </section>
  );
}

function ProblemPanel({
  imageDataUrl,
  openCamera,
  openScratchpad,
  clearImage,
}: {
  imageDataUrl: string | null;
  openCamera: () => void;
  openScratchpad: () => void;
  clearImage: () => void;
}) {
  return (
    <aside className="problem-panel">
      <div className="section-heading">
        <span><BookOpen size={18} /> 내 문제</span>
        {imageDataUrl && <button onClick={clearImage}><X size={17} /> 지우기</button>}
      </div>
      {imageDataUrl ? (
        <div className="problem-image-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageDataUrl} alt="학생이 촬영한 수학 문제" />
        </div>
      ) : (
        <button className="empty-problem" onClick={openCamera}>
          <Camera size={28} />
          <strong>문제 사진 추가</strong>
          <span>사진 없이 질문해도 괜찮아</span>
        </button>
      )}
      <div className="scratch-card">
        <div><PencilLine size={18} /><strong>내 풀이</strong></div>
        <p>펜·손가락·마우스로 직접 풀 수 있어요.</p>
        <button onClick={openScratchpad}>풀이판 열기 <ChevronRight size={16} /></button>
      </div>
    </aside>
  );
}

function ChatPanel({
  messages,
  question,
  setQuestion,
  handleKeyDown,
  sendQuestion,
  openCamera,
  openScratchpad,
  hasProblemContext,
  conceptCheck,
  isConceptLoading,
  startConceptCheck,
  skipConceptCheck,
  continueAfterConcept,
  isLoading,
  error,
  chatEndRef,
}: {
  messages: Message[];
  question: string;
  setQuestion: (value: string) => void;
  handleKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  sendQuestion: (preset?: string, imageOverride?: string, hintLevelOverride?: number) => Promise<void>;
  openCamera: () => void;
  openScratchpad: () => void;
  hasProblemContext: boolean;
  conceptCheck: ConceptCheck | null;
  isConceptLoading: boolean;
  startConceptCheck: () => void;
  skipConceptCheck: () => void;
  continueAfterConcept: () => void;
  isLoading: boolean;
  error: string;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
}) {
  const latestAssistantMessageId = messages.findLast((message) => message.role === "assistant")?.id;

  return (
    <section className="chat-panel">
      <div className="chat-heading">
        <div className="tutor-avatar"><Sparkles size={20} /></div>
        <div><strong>두리 선생님</strong><span><i /> 지금 바로 답할 수 있어</span></div>
      </div>

      <div className="messages">
        {messages.length === 0 && isConceptLoading && <ConceptCheckLoading />}
        {messages.length === 0 && !isConceptLoading && conceptCheck && (
          <ConceptCheckCard
            key={conceptCheck.diagnostic.question}
            conceptCheck={conceptCheck}
            onContinue={continueAfterConcept}
            onAnswered={(correct) => {
              void fetch("/api/mastery", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  conceptName: conceptCheck.topic,
                  source: "concept_check",
                  outcome: correct ? "correct" : "incorrect",
                  mistakeCategory: correct ? "none" : "concept_gap",
                }),
              }).catch(() => undefined);
            }}
          />
        )}
        {messages.length === 0 && !isConceptLoading && !conceptCheck && hasProblemContext && (
          <div className="pre-solve-choice">
            <span className="mini-avatar">두</span>
            <div>
              <strong>바로 풀기 전에 필요한 개념부터 볼까?</strong>
              <p>1분만 확인하면 어디서 시작해야 할지 더 쉽게 보여.</p>
              <div><button className="primary" onClick={startConceptCheck}><Sparkles size={16} /> 개념부터 확인</button><button onClick={skipConceptCheck}>바로 문제 풀기</button></div>
            </div>
          </div>
        )}
        {messages.length === 0 && !isConceptLoading && !conceptCheck && !hasProblemContext && (
          <div className="starter-message">
            <span className="mini-avatar">두</span>
            <div>
              <p>문제를 잘 받았어. 어디가 가장 어려운지 알려줄래?</p>
              <div className="choice-chips">
                {starterQuestions.map((item) => (
                  <button key={item} onClick={() => void sendQuestion(item)}>{item}</button>
                ))}
              </div>
            </div>
          </div>
        )}
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.role}`}>
            {message.role === "assistant" && <span className="mini-avatar">두</span>}
            {message.role === "assistant" ? (
              <AssistantMessageContent
                content={message.content}
                hintLevel={message.hintLevel}
                choicesEnabled={message.id === latestAssistantMessageId && !isLoading}
                onChoose={(choice) => void sendQuestion(choice)}
                onHintLevel={(level) => void sendQuestion(
                  level === 4 ? "전체 풀이를 단계별로 확인하고 싶어." : `${level}단계 힌트를 더 알려줘.`,
                  undefined,
                  level,
                )}
              />
            ) : (
              <div className="message-bubble">{message.content}</div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="message assistant">
            <span className="mini-avatar">두</span>
            <div className="thinking"><span /><span /><span /> 생각 중이야</div>
          </div>
        )}
        {error && <p className="error-message in-chat">{error}</p>}
        <div ref={chatEndRef} />
      </div>

      <div className="composer-wrap">
        <div className="composer">
          <button onClick={openCamera} aria-label="사진 첨부"><Paperclip size={21} /></button>
          <button onClick={openScratchpad} aria-label="풀이판 열기"><PencilLine size={20} /></button>
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="궁금한 걸 편하게 물어봐…"
            rows={1}
          />
          <button className="voice-button" aria-label="음성 질문"><Mic size={21} /></button>
          <button
            className="send-button"
            onClick={() => void sendQuestion()}
            disabled={!question.trim() || isLoading}
            aria-label="질문 보내기"
          >
            <ArrowUp size={20} />
          </button>
        </div>
        <small>Enter 줄바꿈 · Ctrl+Enter 보내기</small>
      </div>
    </section>
  );
}

function AssistantMessageContent({
  content,
  hintLevel,
  choicesEnabled,
  onChoose,
  onHintLevel,
}: {
  content: string;
  hintLevel?: number;
  choicesEnabled: boolean;
  onChoose: (choice: string) => void;
  onHintLevel: (level: number) => void;
}) {
  const { body, replies } = parseQuickReplies(content);

  return (
    <div className="message-bubble assistant-message-content">
      {body && <span className="message-copy">{body}</span>}
      {replies.length > 0 && (
        <div className="message-quick-replies" aria-label="빠른 답변 선택">
          {replies.map((reply) => (
            <button
              key={reply}
              type="button"
              disabled={!choicesEnabled}
              onClick={() => onChoose(reply)}
            >
              {reply}
            </button>
          ))}
        </div>
      )}
      {choicesEnabled && (
        <div className="hint-level-picker" aria-label="힌트 단계 선택">
          <small>지금 {hintLevel ?? 1}단계 · 필요한 만큼만 열어봐</small>
          <div>
            <button type="button" onClick={() => onHintLevel(1)}>방향만</button>
            <button type="button" onClick={() => onHintLevel(2)}>핵심 힌트</button>
            <button type="button" onClick={() => onHintLevel(3)}>다음 단계</button>
            <button type="button" className="full" onClick={() => onHintLevel(4)}>풀이 확인</button>
          </div>
        </div>
      )}
    </div>
  );
}

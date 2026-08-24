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
import { generateStudyPlan } from "@/lib/planning/generate-plan";
import { TEMP_TEXTBOOK_UNITS } from "@/lib/planning/mock-textbook";
import type { GeneratedPlan, PlanInput, WeeklyAvailability } from "@/lib/planning/types";
import SolutionAnalysisScreen from "@/components/solution-analysis-screen";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const starterQuestions = ["문제 뜻을 모르겠어", "식을 못 세우겠어", "계산하다 막혔어", "어디서부터 할지 모르겠어"];

const learningContext = {
  grade: "중1",
  curriculum: "2022 개정",
  textbook: "학교 지정 수학 1",
  currentUnit: "문자와 식",
  schoolProgress: "2단원 3차시",
  nextExam: "중간고사까지 28일",
};

const makeId = () => Math.random().toString(36).slice(2);
const STUDY_PLAN_STORAGE_KEY = "doori:study-plan:v1";

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
  const [activeSection, setActiveSection] = useState<"ask" | "solution" | "plan" | "profile">("ask");
  const [mode, setMode] = useState<"home" | "chat">("home");
  const [question, setQuestion] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

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
      setMode("chat");
      setError("");
    };
    reader.readAsDataURL(file);
  };

  const sendQuestion = async (preset?: string) => {
    const text = (preset ?? question).trim();
    if ((!text && !imageDataUrl) || isLoading) return;

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

    try {
      const response = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: userMessage.content,
          imageDataUrl,
          history: messages.map(({ role, content }) => ({ role, content })),
          learningContext,
        }),
      });
      const data = (await response.json()) as { answer?: string; error?: string };
      if (!response.ok || !data.answer) throw new Error(data.error || "응답 오류");

      setMessages((current) => [
        ...current,
        { id: makeId(), role: "assistant", content: data.answer as string },
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
      void sendQuestion();
    }
  };

  const resetSession = () => {
    setMessages([]);
    setImageDataUrl(null);
    setQuestion("");
    setError("");
    setMode("home");
    setActiveSection("ask");
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
        <StudyPlanScreen onConnectTextbook={() => navigateTo("profile")} />
      ) : activeSection === "profile" ? (
        <LearningProfileScreen onBack={() => navigateTo("plan")} />
      ) : mode === "home" ? (
        <HomeScreen
          question={question}
          setQuestion={setQuestion}
          handleKeyDown={handleKeyDown}
          sendQuestion={sendQuestion}
          openCamera={() => fileInputRef.current?.click()}
          openSolutionAnalysis={() => navigateTo("solution")}
          error={error}
        />
      ) : (
        <section className="study-layout">
          <ProblemPanel
            imageDataUrl={imageDataUrl}
            openCamera={() => fileInputRef.current?.click()}
            clearImage={() => setImageDataUrl(null)}
          />
          <ChatPanel
            messages={messages}
            question={question}
            setQuestion={setQuestion}
            handleKeyDown={handleKeyDown}
            sendQuestion={sendQuestion}
            openCamera={() => fileInputRef.current?.click()}
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

      <nav className="bottom-nav" aria-label="주요 메뉴">
        <button className={activeSection === "ask" || activeSection === "solution" ? "active" : ""} onClick={() => navigateTo("ask")}><Home size={20} /><span>질문하기</span></button>
        <button className={activeSection === "plan" ? "active" : ""} onClick={() => navigateTo("plan")}><CalendarDays size={20} /><span>학습계획</span></button>
        <button className={activeSection === "profile" ? "active" : ""} onClick={() => navigateTo("profile")}><UserRound size={20} /><span>내 학습</span></button>
      </nav>
    </main>
  );
}

function StudyPlanScreen({ onConnectTextbook }: { onConnectTextbook: () => void }) {
  const [isPlannerOpen, setIsPlannerOpen] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<GeneratedPlan | null>(null);
  const [showAllSessions, setShowAllSessions] = useState(false);

  useEffect(() => {
    try {
      const savedPlan = window.localStorage.getItem(STUDY_PLAN_STORAGE_KEY);
      if (savedPlan) setGeneratedPlan(JSON.parse(savedPlan) as GeneratedPlan);
    } catch {
      window.localStorage.removeItem(STUDY_PLAN_STORAGE_KEY);
    }

    void fetch("/api/study-plans")
      .then(async (response) => response.ok ? response.json() as Promise<{ plan: GeneratedPlan | null }> : null)
      .then((data) => {
        if (!data?.plan) return;
        setGeneratedPlan(data.plan);
        window.localStorage.setItem(STUDY_PLAN_STORAGE_KEY, JSON.stringify(data.plan));
      })
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
              <p>{learningContext.grade} · {learningContext.curriculum}</p>
            </div>
            <span className="connection-badge">연결 필요</span>
            <button onClick={onConnectTextbook}>학교·교과서 연결 <ChevronRight size={17} /></button>
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
          onClose={() => setIsPlannerOpen(false)}
          onGenerate={(plan, input) => {
            setGeneratedPlan(plan);
            window.localStorage.setItem(STUDY_PLAN_STORAGE_KEY, JSON.stringify(plan));
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
  onClose,
  onGenerate,
}: {
  currentPlan: GeneratedPlan | null;
  onClose: () => void;
  onGenerate: (plan: GeneratedPlan, input: PlanInput) => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [examDate, setExamDate] = useState("");
  const [selectedUnits, setSelectedUnits] = useState<string[]>(["expressions"]);
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

  const toggleUnit = (unitId: string) => {
    setSelectedUnits((current) =>
      current.includes(unitId) ? current.filter((id) => id !== unitId) : [...current, unitId],
    );
  };

  const toggleDay = (day: number) => {
    setAvailability((current) => ({ ...current, [day]: current[day] > 0 ? 0 : 30 }));
  };

  const totalWeeklyMinutes = Object.values(availability).reduce((sum, minutes) => sum + minutes, 0);
  const canContinue = Boolean(examDate) && selectedUnits.length > 0;
  const canGenerate = totalWeeklyMinutes > 0;

  const handleGenerate = () => {
    if (!canGenerate) return;
    const input = { examDate, selectedUnitIds: selectedUnits, availability };
    onGenerate(generateStudyPlan(input, TEMP_TEXTBOOK_UNITS), input);
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

            <div className="field-title-row"><span className="field-label">시험 범위</span><small>{selectedUnits.length}개 단원 선택</small></div>
            <div className="unit-selector">
              {TEMP_TEXTBOOK_UNITS.map((unit) => {
                const selected = selectedUnits.includes(unit.id);
                return (
                  <button key={unit.id} className={selected ? "selected" : ""} onClick={() => toggleUnit(unit.id)}>
                    <span>{selected ? <CheckCircle2 size={19} /> : <Circle size={19} />}</span>
                    <div><small>{unit.order}단원 · p.{unit.pageFrom}~{unit.pageTo}</small><strong>{unit.title}</strong><p>예상 {unit.estimatedMinutes}분</p></div>
                  </button>
                );
              })}
            </div>
            <p className="temporary-data-note">현재 단원 목록은 임시 데이터이며, 교과서 DB 연결 후 학교 지정 교과서 기준으로 자동 교체됩니다.</p>
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

function LearningProfileScreen({ onBack }: { onBack: () => void }) {
  return (
    <section className="profile-screen">
      <button className="back-link" onClick={onBack}>‹ 학습계획으로</button>
      <div className="profile-heading">
        <span className="eyebrow"><School size={15} /> 처음 한 번만 설정하면 돼</span>
        <h1>학교와 교과서 연결</h1>
        <p>학교에서 사용하는 교과서를 확인하면 단원·페이지·시험 범위에 맞춰 계획을 만들 수 있어요.</p>
      </div>

      <div className="setup-steps">
        <div className="setup-card active">
          <span>1</span>
          <div><small>학교</small><strong>학교 이름 검색</strong><p>지역과 학교명을 입력해 정확히 찾아요.</p></div>
          <button>학교 찾기</button>
        </div>
        <div className="setup-card">
          <span>2</span>
          <div><small>교과서 확인</small><strong>표지 또는 ISBN 촬영</strong><p>출판사·저자·교육과정을 자동으로 확인해요.</p></div>
          <button>표지 촬영</button>
        </div>
        <div className="setup-card">
          <span>3</span>
          <div><small>학습 일정</small><strong>시험일과 공부 가능한 날</strong><p>계획은 언제든 자동으로 다시 조정돼요.</p></div>
          <button>일정 입력</button>
        </div>
      </div>

      <div className="rights-note">
        <LockKeyhole size={20} />
        <div><strong>교과서 콘텐츠는 안전하게 사용해요</strong><p>출판사와 정식 계약된 교과서만 전문 기반 학습에 사용하고, 학생에게는 필요한 범위만 보여줍니다.</p></div>
      </div>
    </section>
  );
}

function HomeScreen({
  question,
  setQuestion,
  handleKeyDown,
  sendQuestion,
  openCamera,
  openSolutionAnalysis,
  error,
}: {
  question: string;
  setQuestion: (value: string) => void;
  handleKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  sendQuestion: (preset?: string) => Promise<void>;
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

      <div className="home-composer">
        <MessageCircleQuestion size={20} />
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="예: 왜 이항하면 부호가 바뀌어?"
          rows={1}
        />
        <button onClick={() => void sendQuestion()} disabled={!question.trim()} aria-label="질문 보내기">
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
  clearImage,
}: {
  imageDataUrl: string | null;
  openCamera: () => void;
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
        <p>태블릿에서는 이곳에 직접 풀 수 있어요.</p>
        <button>풀이판 열기 <ChevronRight size={16} /></button>
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
  isLoading,
  error,
  chatEndRef,
}: {
  messages: Message[];
  question: string;
  setQuestion: (value: string) => void;
  handleKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  sendQuestion: (preset?: string) => Promise<void>;
  openCamera: () => void;
  isLoading: boolean;
  error: string;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <section className="chat-panel">
      <div className="chat-heading">
        <div className="tutor-avatar"><Sparkles size={20} /></div>
        <div><strong>두리 선생님</strong><span><i /> 지금 바로 답할 수 있어</span></div>
      </div>

      <div className="messages">
        {messages.length === 0 && (
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
            <div className="message-bubble">{message.content}</div>
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

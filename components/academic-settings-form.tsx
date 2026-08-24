"use client";

import { useState } from "react";
import { BookOpen, CalendarDays, CheckCircle2, LoaderCircle, Target } from "lucide-react";
import {
  EXAM_TYPE_LABELS,
  EXAM_TYPES,
  GRADE_LEVELS,
  SEMESTERS,
  type AcademicSettings,
  type ExamType,
  type GradeLevel,
  type Semester,
} from "@/lib/academic-settings/types";

export default function AcademicSettingsForm({
  settings,
  onboarding = false,
  onSave,
}: {
  settings: AcademicSettings | null;
  onboarding?: boolean;
  onSave: (settings: AcademicSettings) => Promise<void>;
}) {
  const [gradeLevel, setGradeLevel] = useState<GradeLevel>(settings?.gradeLevel ?? "중1");
  const [semester, setSemester] = useState<Semester>(settings?.semester ?? "1학기");
  const [examType, setExamType] = useState<ExamType>(settings?.examType ?? "none");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setError("");
    try {
      await onSave({ gradeLevel, semester, examType });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "설정을 저장하지 못했어요.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className={`academic-settings-card ${onboarding ? "onboarding" : ""}`} aria-labelledby="academic-settings-title">
      <div className="academic-settings-heading">
        <span><BookOpen size={20} /></span>
        <div>
          <small>{onboarding ? "첫 학습 설정" : "학습 기본설정"}</small>
          <h1 id="academic-settings-title">{onboarding ? "지금 공부하는 과정을 알려줘" : "학년·학기·시험 설정"}</h1>
          <p>AI 설명 난이도와 학습계획을 현재 과정에 맞춰 조정해요.</p>
        </div>
      </div>

      <div className="academic-setting-group">
        <div className="academic-setting-label"><BookOpen size={17} /><strong>학년</strong><span>필수</span></div>
        <div className="option-chip-grid grades" role="radiogroup" aria-label="학년 선택">
          {GRADE_LEVELS.map((grade) => (
            <button key={grade} type="button" role="radio" aria-checked={gradeLevel === grade} className={gradeLevel === grade ? "selected" : ""} onClick={() => setGradeLevel(grade)}>{grade}</button>
          ))}
        </div>
      </div>

      <div className="academic-setting-group">
        <div className="academic-setting-label"><CalendarDays size={17} /><strong>학기</strong><span>필수</span></div>
        <div className="option-chip-grid semesters" role="radiogroup" aria-label="학기 선택">
          {SEMESTERS.map((item) => (
            <button key={item} type="button" role="radio" aria-checked={semester === item} className={semester === item ? "selected" : ""} onClick={() => setSemester(item)}>{item}</button>
          ))}
        </div>
      </div>

      <div className="academic-setting-group">
        <div className="academic-setting-label"><Target size={17} /><strong>시험</strong><span className="optional">선택</span></div>
        <div className="option-chip-grid exams" role="radiogroup" aria-label="시험 선택">
          {EXAM_TYPES.map((item) => (
            <button key={item} type="button" role="radio" aria-checked={examType === item} className={examType === item ? "selected" : ""} onClick={() => setExamType(item)}>{EXAM_TYPE_LABELS[item]}</button>
          ))}
        </div>
      </div>

      {error && <p className="academic-settings-error" role="alert">{error}</p>}
      <button className="academic-settings-save" type="button" disabled={isSaving} onClick={() => void handleSave()}>
        {isSaving ? <><LoaderCircle className="spin" size={18} /> 저장 중…</> : <><CheckCircle2 size={18} /> {onboarding ? "설정하고 시작하기" : "설정 저장"}</>}
      </button>
    </section>
  );
}

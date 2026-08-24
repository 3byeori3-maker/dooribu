import { NextResponse } from "next/server";
import {
  EXAM_TYPES,
  GRADE_LEVELS,
  SEMESTERS,
  type AcademicSettings,
  type ExamType,
  type GradeLevel,
  type Semester,
} from "@/lib/academic-settings/types";
import { getRequestAuth } from "@/lib/supabase/auth";

const gradeLevels = new Set<string>(GRADE_LEVELS);
const semesters = new Set<string>(SEMESTERS);
const examTypes = new Set<string>(EXAM_TYPES);

function sanitizeSettings(value: unknown): AcademicSettings | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (!gradeLevels.has(String(candidate.gradeLevel))) return null;
  if (!semesters.has(String(candidate.semester))) return null;
  if (!examTypes.has(String(candidate.examType))) return null;
  return {
    gradeLevel: candidate.gradeLevel as GradeLevel,
    semester: candidate.semester as Semester,
    examType: candidate.examType as ExamType,
  };
}

export async function GET() {
  const auth = await getRequestAuth();
  if (!auth.configured) return NextResponse.json({ settings: null, source: "local" });
  if (!auth.userId || !auth.supabase) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const { data, error } = await auth.supabase
    .from("student_profiles")
    .select("grade_level, semester, exam_type")
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "학년 설정을 불러오지 못했어요." }, { status: 500 });
  }

  const settings = data?.grade_level && data?.semester
    ? sanitizeSettings({
        gradeLevel: data.grade_level,
        semester: data.semester,
        examType: data.exam_type ?? "none",
      })
    : null;
  return NextResponse.json({ settings, source: "supabase" });
}

export async function POST(request: Request) {
  const auth = await getRequestAuth();
  if (!auth.configured) return NextResponse.json({ saved: false, source: "local" });
  if (!auth.userId || !auth.supabase) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "설정 정보 형식이 올바르지 않아요." }, { status: 400 });
  }

  const settings = sanitizeSettings((body as { settings?: unknown })?.settings);
  if (!settings) {
    return NextResponse.json({ error: "학년과 학기를 다시 선택해주세요." }, { status: 400 });
  }

  const { error } = await auth.supabase.from("student_profiles").upsert({
    user_id: auth.userId,
    grade_level: settings.gradeLevel,
    semester: settings.semester,
    exam_type: settings.examType,
  }, { onConflict: "user_id" });

  if (error) {
    return NextResponse.json({ error: "학년 설정을 저장하지 못했어요." }, { status: 500 });
  }
  return NextResponse.json({ saved: true, settings, source: "supabase" });
}

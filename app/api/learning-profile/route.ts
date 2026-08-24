import { NextResponse } from "next/server";
import type { LearningProfile, TextbookConfidence } from "@/lib/learning-profile/types";
import { getRequestAuth } from "@/lib/supabase/auth";

const CONFIDENCE_VALUES = new Set<TextbookConfidence>(["high", "medium", "low"]);

const cleanText = (value: unknown, maxLength: number) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

function sanitizeProfile(value: unknown): LearningProfile | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const rawTextbook = candidate.textbook;
  if (!rawTextbook || typeof rawTextbook !== "object") return null;
  const textbook = rawTextbook as Record<string, unknown>;
  const title = cleanText(textbook.title, 120);
  const publisher = cleanText(textbook.publisher, 80);
  const schoolName = cleanText(candidate.schoolName, 100);
  if (!title || !publisher || !schoolName) return null;

  const confidence = CONFIDENCE_VALUES.has(textbook.confidence as TextbookConfidence)
    ? textbook.confidence as TextbookConfidence
    : "low";
  const authors = Array.isArray(textbook.authors)
    ? textbook.authors.map((author) => cleanText(author, 80)).filter(Boolean).slice(0, 12)
    : [];

  return {
    region: cleanText(candidate.region, 30),
    schoolName,
    schoolConfirmedByUser: candidate.schoolConfirmedByUser === true,
    textbook: {
      title,
      publisher,
      authors,
      subject: cleanText(textbook.subject, 40) || "수학",
      gradeLevel: cleanText(textbook.gradeLevel, 20) || "중1",
      semester: cleanText(textbook.semester, 20) || "1학기",
      curriculum: cleanText(textbook.curriculum, 80),
      isbn: cleanText(textbook.isbn, 30),
      confidence,
      notes: cleanText(textbook.notes, 500),
    },
    textbookConfirmedByUser: candidate.textbookConfirmedByUser === true,
    updatedAt: new Date().toISOString(),
  };
}

export async function GET() {
  const auth = await getRequestAuth();
  if (!auth.configured) return NextResponse.json({ profile: null, source: "local" });
  if (!auth.userId || !auth.supabase) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const { data, error } = await auth.supabase
    .from("student_profiles")
    .select("learning_profile")
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "학습 정보를 불러오지 못했어요." }, { status: 500 });
  }

  return NextResponse.json({
    profile: sanitizeProfile(data?.learning_profile) ?? null,
    source: "supabase",
  });
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
    return NextResponse.json({ error: "학습 정보 형식이 올바르지 않아요." }, { status: 400 });
  }

  const profile = sanitizeProfile((body as { profile?: unknown })?.profile);
  if (!profile || !profile.schoolConfirmedByUser || !profile.textbookConfirmedByUser) {
    return NextResponse.json({ error: "학교와 교과서 정보를 다시 확인해주세요." }, { status: 400 });
  }

  const grade = Number(profile.textbook.gradeLevel.match(/[123]/)?.[0] ?? 1);
  const { error } = await auth.supabase.from("student_profiles").upsert({
    user_id: auth.userId,
    grade,
    school_name: profile.schoolName,
    textbook_label: `${profile.textbook.title} · ${profile.textbook.publisher}`,
    learning_profile: profile,
  }, { onConflict: "user_id" });

  if (error) {
    return NextResponse.json({ error: "학습 정보를 저장하지 못했어요." }, { status: 500 });
  }

  return NextResponse.json({ saved: true, profile, source: "supabase" });
}

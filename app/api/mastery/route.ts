import { NextResponse } from "next/server";
import { getRequestAuth } from "@/lib/supabase/auth";
import { mapMasteryRow, recordMastery } from "@/lib/mastery/update";
import type { MasteryUpdate } from "@/lib/mastery/types";

export async function GET() {
  const auth = await getRequestAuth();
  if (!auth.configured) return NextResponse.json({ concepts: [] });
  if (!auth.userId || !auth.supabase) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  const { data, error } = await auth.supabase
    .from("concept_mastery")
    .select("concept_key, concept_name, mastery_score, attempts, correct_attempts, last_mistake_category, review_due_at, last_practiced_at")
    .eq("user_id", auth.userId)
    .order("mastery_score", { ascending: true });

  if (error) return NextResponse.json({ error: "이해도 기록을 불러오지 못했어요." }, { status: 500 });
  return NextResponse.json({ concepts: (data ?? []).map((row) => mapMasteryRow(row)) });
}

export async function POST(request: Request) {
  const auth = await getRequestAuth();
  if (!auth.configured) return NextResponse.json({ saved: false, source: "local" });
  if (!auth.userId || !auth.supabase) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  const body = (await request.json()) as Partial<MasteryUpdate>;
  const validOutcomes = new Set(["correct", "partial", "incorrect", "unclear"]);
  if (!body.conceptName?.trim() || !body.outcome || !validOutcomes.has(body.outcome)) {
    return NextResponse.json({ error: "학습 결과 정보가 올바르지 않아요." }, { status: 400 });
  }

  try {
    const result = await recordMastery(auth.supabase, auth.userId, {
      conceptName: body.conceptName,
      source: body.source ?? "concept_check",
      outcome: body.outcome,
      mistakeCategory: body.mistakeCategory,
      metadata: body.metadata,
    });
    return NextResponse.json({ saved: true, ...result });
  } catch (error) {
    console.error("Mastery save error", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "학습 결과를 저장하지 못했어요." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getRequestAuth } from "@/lib/supabase/auth";
import type { GeneratedPlan, PlanInput } from "@/lib/planning/types";

type SavePlanRequest = {
  input?: PlanInput;
  plan?: GeneratedPlan;
};

export async function GET() {
  const auth = await getRequestAuth();
  if (!auth.configured) return NextResponse.json({ plan: null, source: "local" });
  if (!auth.userId || !auth.supabase) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  const { data, error } = await auth.supabase
    .from("study_plans")
    .select("generated_plan")
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "저장된 계획을 불러오지 못했어요." }, { status: 500 });
  return NextResponse.json({ plan: (data?.generated_plan as GeneratedPlan | undefined) ?? null, source: "supabase" });
}

export async function POST(request: Request) {
  const auth = await getRequestAuth();
  if (!auth.configured) return NextResponse.json({ saved: false, source: "local" });
  if (!auth.userId || !auth.supabase) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  const body = (await request.json()) as SavePlanRequest;
  if (!body.input?.examDate || !body.input.selectedUnitIds?.length || !body.plan?.sessions) {
    return NextResponse.json({ error: "학습계획 정보가 올바르지 않아요." }, { status: 400 });
  }

  const { error } = await auth.supabase.from("study_plans").insert({
    user_id: auth.userId,
    exam_date: body.input.examDate,
    selected_unit_ids: body.input.selectedUnitIds,
    weekly_availability: body.input.availability,
    generated_plan: body.plan,
    status: body.plan.status,
  });

  if (error) return NextResponse.json({ error: "학습계획을 저장하지 못했어요." }, { status: 500 });
  return NextResponse.json({ saved: true, source: "supabase" });
}

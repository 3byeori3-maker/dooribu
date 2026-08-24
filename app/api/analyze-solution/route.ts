import OpenAI from "openai";
import { NextResponse } from "next/server";
import type { SolutionAnalysis } from "@/lib/solution-analysis/types";
import { getRequestAuth } from "@/lib/supabase/auth";
import { recordMastery } from "@/lib/mastery/update";

export const runtime = "nodejs";

type AnalyzeSolutionRequest = {
  problemImageDataUrl?: string | null;
  solutionImageDataUrl?: string | null;
  focus?: "first_error" | "full_review" | "easier_method";
  learningContext?: {
    grade?: string;
    curriculum?: string;
    textbook?: string;
    currentUnit?: string;
  };
};

const analysisSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "status",
    "confidence",
    "recognizedProblem",
    "recognizedWork",
    "summary",
    "primaryConcept",
    "mistakeCategory",
    "mistakeLabel",
    "correctSteps",
    "firstError",
    "nextAction",
    "followUpQuestion",
  ],
  properties: {
    status: { type: "string", enum: ["correct", "partially_correct", "incorrect", "unclear"] },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    recognizedProblem: { type: "string", description: "문제 사진에서 실제로 읽은 문제. 읽지 못하면 빈 문자열." },
    recognizedWork: {
      type: "array",
      description: "학생 풀이 사진에서 실제로 읽은 줄만 원문 순서대로 전사한 배열.",
      items: { type: "string" },
    },
    summary: { type: "string" },
    primaryConcept: { type: "string", description: "이 풀이에서 평가한 핵심 수학 개념 하나." },
    mistakeCategory: {
      type: "string",
      enum: ["none", "concept_gap", "setup_error", "calculation_error", "sign_error", "notation_error", "reading_error", "incomplete_reasoning", "careless_error", "unclear"],
    },
    mistakeLabel: { type: "string", description: "학생에게 보여줄 짧고 쉬운 한국어 오답 원인 이름." },
    correctSteps: {
      type: "array",
      description: "학생 사진에 실제로 적혀 있고 맞는 풀이 줄만 그대로 넣는다. 정정 풀이와 모범 답안은 절대 넣지 않는다.",
      items: { type: "string" },
    },
    firstError: {
      type: "object",
      additionalProperties: false,
      required: ["found", "step", "explanation", "hint"],
      properties: {
        found: { type: "boolean" },
        step: { type: "string" },
        explanation: { type: "string" },
        hint: { type: "string" },
      },
    },
    nextAction: { type: "string" },
    followUpQuestion: { type: "string" },
  },
} as const;

const instructions = `
너는 한국 중학생의 손글씨 수학 풀이를 검토하는 전문 과외교사다.
제공된 문제 사진과 학생 풀이 사진을 줄 단위로 비교한다.

분석 원칙:
- 학생이 맞게 푼 부분을 먼저 구체적으로 찾는다.
- 결과만 틀린지 보지 말고 처음 논리가 어긋난 단계를 찾는다.
- 첫 오류 이후 단계는 연쇄 오류일 수 있으므로 핵심 오류로 중복 지적하지 않는다.
- 글씨나 기호가 불명확하면 추측하지 말고 unclear 또는 낮은 신뢰도로 표시한다.
- 문제 사진이 없으면 풀이 사진에서 확인 가능한 범위만 분석하고 자신 있게 문제를 지어내지 않는다.
- 정답 전체를 바로 제공하지 말고 학생이 다음 한 단계를 직접 할 수 있는 힌트를 준다.
- 학생에게 보여줄 문장은 짧고 쉬운 한국어로 작성한다.
- 마크다운, LaTeX 구분자, 장황한 풀이, 내부 추론 과정은 출력하지 않는다.
- recognizedWork에는 사진에서 실제로 읽힌 풀이 줄만 순서대로 넣는다.
- correctSteps에는 recognizedWork에 실제로 존재하는 줄 중 맞는 줄만 그대로 복사한다.
- correctSteps에 학생이 쓰지 않은 정정식, 모범 풀이, 정답을 새로 만들지 않는다.
- primaryConcept에는 사진으로 판단 가능한 핵심 개념 하나만 짧게 쓴다.
- mistakeCategory는 첫 오류의 원인 하나만 고른다. 풀이가 맞으면 none, 판독 불가면 unclear로 쓴다.
- mistakeLabel은 예: 개념 이해 부족, 식 세우기 오류, 계산 오류처럼 학생이 이해할 말로 쓴다.
`;

const isImageDataUrl = (value: unknown): value is string =>
  typeof value === "string" && /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(value);

export async function POST(request: Request) {
  try {
    const auth = await getRequestAuth();
    if (auth.configured && !auth.userId) {
      return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
    }

    const body = (await request.json()) as AnalyzeSolutionRequest;

    if (!isImageDataUrl(body.solutionImageDataUrl)) {
      return NextResponse.json({ error: "학생 풀이 사진을 올려주세요." }, { status: 400 });
    }
    if (body.problemImageDataUrl && !isImageDataUrl(body.problemImageDataUrl)) {
      return NextResponse.json({ error: "문제 사진 형식이 올바르지 않아요." }, { status: 400 });
    }

    const totalImageLength = body.solutionImageDataUrl.length + (body.problemImageDataUrl?.length ?? 0);
    if (totalImageLength > 18_000_000) {
      return NextResponse.json({ error: "사진 용량이 너무 커요. 더 작은 사진으로 다시 시도해주세요." }, { status: 413 });
    }

    const focusLabel = {
      first_error: "처음 틀린 단계 찾기",
      full_review: "풀이 전체 검토",
      easier_method: "더 쉬운 풀이 방법 안내",
    }[body.focus ?? "first_error"];
    const context = body.learningContext;
    const contextText = context
      ? `${context.grade ?? "중학생"}, ${context.curriculum ?? "교육과정 미확인"}, ${context.textbook ?? "교과서 미확인"}, 현재 단원 ${context.currentUnit ?? "미확인"}`
      : "중학생, 학습 맥락 미확인";

    const content: OpenAI.Responses.ResponseInputContent[] = [
      {
        type: "input_text",
        text: `학습 맥락: ${contextText}\n분석 초점: ${focusLabel}\n첫 번째 이미지가 있으면 문제 사진이고, 마지막 이미지는 반드시 학생 풀이 사진이다.`,
      },
    ];

    if (body.problemImageDataUrl) {
      content.push({ type: "input_image", image_url: body.problemImageDataUrl, detail: "high" });
    }
    content.push({ type: "input_image", image_url: body.solutionImageDataUrl, detail: "high" });

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: "gpt-5.4-mini",
      instructions,
      input: [{ role: "user", content }],
      reasoning: { effort: "low" },
      max_output_tokens: 1200,
      store: false,
      text: {
        format: {
          type: "json_schema",
          name: "student_solution_analysis",
          description: "Structured feedback for a middle-school student's handwritten math solution.",
          strict: true,
          schema: analysisSchema,
        },
      },
    });

    const analysis = JSON.parse(response.output_text) as SolutionAnalysis;

    if (auth.userId && auth.supabase) {
      const { error: saveError } = await auth.supabase.from("solution_analyses").insert({
        user_id: auth.userId,
        status: analysis.status,
        confidence: analysis.confidence,
        recognized_problem: analysis.recognizedProblem,
        primary_concept: analysis.primaryConcept,
        mistake_category: analysis.mistakeCategory,
        feedback: analysis,
      });
      if (saveError) console.error("Solution analysis metadata save error", saveError.message);

      try {
        await recordMastery(auth.supabase, auth.userId, {
          conceptName: analysis.primaryConcept || body.learningContext?.currentUnit || "미분류 개념",
          source: "solution_analysis",
          outcome: analysis.status === "partially_correct" ? "partial" : analysis.status,
          mistakeCategory: analysis.mistakeCategory,
          metadata: { confidence: analysis.confidence, focus: body.focus ?? "first_error" },
        });
      } catch (masteryError) {
        console.error("Mastery update error", masteryError instanceof Error ? masteryError.message : "unknown error");
      }
    }

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("Solution analysis API error", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json(
      { error: "풀이를 분석하지 못했어요. 사진을 확인하고 다시 시도해주세요." },
      { status: 500 },
    );
  }
}

import OpenAI from "openai";
import { NextResponse } from "next/server";
import type { ConceptCheck } from "@/lib/concept-check/types";
import { getRequestAuth } from "@/lib/supabase/auth";

export const runtime = "nodejs";

type ConceptCheckRequest = {
  question?: string;
  imageDataUrl?: string | null;
  learningContext?: {
    grade?: string;
    curriculum?: string;
    textbook?: string;
    currentUnit?: string;
  };
};

const conceptCheckSchema = {
  type: "object",
  additionalProperties: false,
  required: ["topic", "whyItMatters", "prerequisites", "diagnostic", "conceptSummary", "miniExample", "commonMistake", "bridgePrompt"],
  properties: {
    topic: { type: "string" },
    whyItMatters: { type: "string" },
    prerequisites: { type: "array", items: { type: "string" } },
    diagnostic: {
      type: "object",
      additionalProperties: false,
      required: ["question", "choices", "correctChoiceIndex"],
      properties: {
        question: { type: "string" },
        choices: { type: "array", items: { type: "string" } },
        correctChoiceIndex: { type: "integer" },
      },
    },
    conceptSummary: { type: "string" },
    miniExample: { type: "string" },
    commonMistake: { type: "string" },
    bridgePrompt: { type: "string" },
  },
} as const;

const instructions = `
너는 한국 중학생을 위한 교과서 중심 수학 과외교사다.
학생이 문제를 풀기 전에 꼭 필요한 핵심 개념 하나를 짧게 진단한다.

작성 원칙:
- 문제를 풀거나 정답을 공개하지 않는다.
- 사진에 없는 문제 문구나 교과서 내용을 지어내지 않는다.
- 핵심 개념은 가장 중요한 하나만 고른다.
- 선수 개념은 최대 3개, 각각 짧은 표현으로 쓴다.
- 진단 질문은 계산이 짧고 한 번에 답할 수 있는 객관식으로 만든다.
- 선택지는 정확히 3개 만들고 correctChoiceIndex는 0부터 시작한다.
- 개념 설명은 중학생이 한 화면에서 읽을 수 있도록 2문장 이내로 쓴다.
- miniExample은 원래 문제의 정답이 아닌 더 쉬운 별도 예시를 사용한다.
- commonMistake는 학생이 자주 혼동하는 점 하나만 알려준다.
- bridgePrompt는 원래 문제의 첫 단계를 학생 스스로 찾게 하는 짧은 질문으로 쓴다.
- 마크다운, LaTeX 구분자, 장황한 풀이를 사용하지 않는다.
`;

const isImageDataUrl = (value: unknown): value is string =>
  typeof value === "string" && /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(value);

export async function POST(request: Request) {
  try {
    const auth = await getRequestAuth();
    if (auth.configured && !auth.userId) {
      return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
    }

    const body = (await request.json()) as ConceptCheckRequest;
    const question = body.question?.trim() ?? "";
    if (!question && !body.imageDataUrl) {
      return NextResponse.json({ error: "확인할 문제나 질문을 알려주세요." }, { status: 400 });
    }
    if (body.imageDataUrl && !isImageDataUrl(body.imageDataUrl)) {
      return NextResponse.json({ error: "문제 사진 형식이 올바르지 않아요." }, { status: 400 });
    }
    if ((body.imageDataUrl?.length ?? 0) > 10_000_000) {
      return NextResponse.json({ error: "사진 용량이 너무 커요. 더 작은 사진으로 다시 시도해주세요." }, { status: 413 });
    }

    const context = body.learningContext;
    const contextText = context
      ? `${context.grade ?? "중학생"}, ${context.curriculum ?? "교육과정 미확인"}, ${context.textbook ?? "교과서 미확인"}, 현재 단원 ${context.currentUnit ?? "미확인"}`
      : "중학생, 학습 맥락 미확인";
    const content: OpenAI.Responses.ResponseInputContent[] = [{
      type: "input_text",
      text: `학습 맥락: ${contextText}\n학생 질문: ${question || "사진 속 문제를 풀기 전에 필요한 개념을 확인하고 싶어요."}`,
    }];
    if (body.imageDataUrl) {
      content.push({ type: "input_image", image_url: body.imageDataUrl, detail: "high" });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: "gpt-5.4-mini",
      instructions,
      input: [{ role: "user", content }],
      reasoning: { effort: "low" },
      max_output_tokens: 800,
      store: false,
      text: {
        format: {
          type: "json_schema",
          name: "pre_solution_concept_check",
          description: "A short concept diagnosis before solving a middle-school math problem.",
          strict: true,
          schema: conceptCheckSchema,
        },
      },
    });

    const conceptCheck = JSON.parse(response.output_text) as ConceptCheck;
    const choiceCount = conceptCheck.diagnostic.choices.length;
    if (choiceCount !== 3 || conceptCheck.diagnostic.correctChoiceIndex < 0 || conceptCheck.diagnostic.correctChoiceIndex >= choiceCount) {
      throw new Error("Invalid concept check choices");
    }

    return NextResponse.json({ conceptCheck });
  } catch (error) {
    console.error("Concept check API error", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "개념을 확인하지 못했어요. 잠시 후 다시 시도해주세요." }, { status: 500 });
  }
}

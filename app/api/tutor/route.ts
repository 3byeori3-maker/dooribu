import OpenAI from "openai";
import { NextResponse } from "next/server";
import { getRequestAuth } from "@/lib/supabase/auth";

export const runtime = "nodejs";

const tutorInstructions = `
너는 한국 중학생을 위한 친절하고 정확한 수학 과외 선생님이다.
학생이 정답을 베끼는 대신 스스로 이해하도록 돕는다.

응답 규칙:
- 한국어로 답한다.
- 첫 답변은 3~5문장, 한 화면 안에 들어올 만큼 짧게 쓴다.
- 학생이 맞게 한 부분을 먼저 구체적으로 짚는다.
- 한 번에 오류나 핵심 개념 하나만 설명한다.
- 정답 전체를 바로 공개하지 말고 다음 한 단계의 힌트나 질문을 준다.
- 학생이 명시적으로 전체 풀이를 요청하면 풀이를 제공하되 마지막에 확인 문제를 제안한다.
- 수식은 읽기 쉽도록 줄을 나눠 표현한다.
- 사진이 불명확하면 추측하지 말고 어느 부분을 다시 찍어야 하는지 말한다.
- 마크다운 굵게 표시(**), 제목 기호(#), LaTeX 구분자(\\(, \\[)를 사용하지 않는다.
- 수식은 중학생이 바로 읽을 수 있는 일반 텍스트로 쓴다. 예: x + 3 = 8
- 마지막 줄에는 학생이 바로 누를 수 있는 짧은 선택지 2~3개를 [선택지] 형식으로 쓴다.
`;

const hintLevelInstructions = {
  1: "힌트 1단계: 답을 드러내지 말고 시작 방향을 찾는 질문 하나만 준다.",
  2: "힌트 2단계: 써야 할 개념이나 식의 일부를 구체적으로 알려주되 계산 결과는 숨긴다.",
  3: "힌트 3단계: 다음 계산 단계와 이유를 보여주고, 마지막 계산은 학생이 하게 한다.",
  4: "풀이 확인 단계: 전체 풀이를 짧게 단계별로 보여주고 끝에 비슷한 확인 질문을 준다.",
} as const;

type TutorRequest = {
  question?: string;
  imageDataUrl?: string | null;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  hintLevel?: number;
  learningContext?: {
    grade?: string;
    curriculum?: string;
    textbook?: string;
    currentUnit?: string;
    schoolProgress?: string;
    nextExam?: string;
  };
};

export async function POST(request: Request) {
  try {
    const auth = await getRequestAuth();
    if (auth.configured && !auth.userId) {
      return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
    }

    const body = (await request.json()) as TutorRequest;
    const question = body.question?.trim();
    const hintLevel = Math.max(1, Math.min(4, Math.round(body.hintLevel ?? 1))) as 1 | 2 | 3 | 4;

    if (!question && !body.imageDataUrl) {
      return NextResponse.json({ error: "질문이나 문제 사진을 보내주세요." }, { status: 400 });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const recentHistory = (body.history ?? []).slice(-6).map((item) => ({
      role: item.role,
      content: item.content,
    }));

    const context = body.learningContext;
    const contextText = context
      ? `현재 학습 맥락: ${context.grade ?? ""}, ${context.curriculum ?? ""}, 교과서 ${context.textbook ?? "미확인"}, 현재 단원 ${context.currentUnit ?? "미확인"}, 학교 진도 ${context.schoolProgress ?? "미확인"}, ${context.nextExam ?? "시험 일정 미확인"}. 교과서 전문이나 발췌문이 실제로 제공되지 않았다면 해당 교과서의 정확한 문구나 문제를 알고 있다고 주장하지 마.`
      : "";

    const currentContent: OpenAI.Responses.ResponseInputContent[] = [
      {
        type: "input_text",
        text: `${contextText}\n\n학생 질문: ${question || "이 문제를 읽고, 어디서부터 생각하면 좋을지 첫 힌트를 줘."}`,
      },
    ];

    if (body.imageDataUrl) {
      currentContent.unshift({
        type: "input_image",
        image_url: body.imageDataUrl,
        detail: "auto",
      });
    }

    const response = await client.responses.create({
      model: "gpt-5.4-mini",
      instructions: `${tutorInstructions}\n현재 응답 규칙: ${hintLevelInstructions[hintLevel]}`,
      input: [
        ...recentHistory.map((item) => ({
          role: item.role,
          content: item.content,
        })),
        { role: "user", content: currentContent },
      ],
      max_output_tokens: 600,
      reasoning: { effort: "low" },
    });

    return NextResponse.json({ answer: response.output_text, hintLevel });
  } catch (error) {
    console.error("Tutor API error", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json(
      { error: "AI 선생님과 연결하지 못했어요. 잠시 후 다시 시도해주세요." },
      { status: 500 },
    );
  }
}

import OpenAI from "openai";
import { NextResponse } from "next/server";
import { getRequestAuth } from "@/lib/supabase/auth";
import type { TextbookMetadata } from "@/lib/learning-profile/types";

export const runtime = "nodejs";

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "publisher", "authors", "subject", "gradeLevel", "semester", "curriculum", "isbn", "confidence", "notes"],
  properties: {
    title: { type: "string" },
    publisher: { type: "string" },
    authors: { type: "array", items: { type: "string" } },
    subject: { type: "string" },
    gradeLevel: { type: "string" },
    semester: { type: "string" },
    curriculum: { type: "string" },
    isbn: { type: "string" },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    notes: { type: "string" },
  },
} as const;

const isImageDataUrl = (value: unknown): value is string =>
  typeof value === "string" && /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(value);

export async function POST(request: Request) {
  try {
    const auth = await getRequestAuth();
    if (auth.configured && !auth.userId) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

    const body = (await request.json()) as { imageDataUrl?: string };
    if (!isImageDataUrl(body.imageDataUrl)) return NextResponse.json({ error: "교과서 표지 사진을 올려주세요." }, { status: 400 });
    if (body.imageDataUrl.length > 10_000_000) return NextResponse.json({ error: "사진 용량이 너무 커요." }, { status: 413 });

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: "gpt-5.4-mini",
      instructions: `한국 중학교 교과서 표지에서 눈으로 확인되는 메타데이터 후보만 추출한다.
- 보이지 않는 출판사, 저자, ISBN을 추측하지 말고 빈 문자열 또는 빈 배열로 둔다.
- 표지의 제목, 과목, 학년, 학기, 교육과정, 출판사, 저자, ISBN만 읽는다.
- 문제나 본문 내용을 전사하지 않는다.
- confidence는 글자가 명확하고 핵심 항목이 보일 때만 high로 둔다.
- notes에는 사용자가 직접 다시 확인해야 할 항목을 짧은 한국어로 쓴다.`,
      input: [{ role: "user", content: [
        { type: "input_text", text: "이 사진에서 교과서 식별용 메타데이터 후보를 추출해줘. 결과는 사용자가 직접 수정하고 확정할 예정이다." },
        { type: "input_image", image_url: body.imageDataUrl, detail: "high" },
      ] }],
      reasoning: { effort: "low" },
      max_output_tokens: 500,
      store: false,
      text: { format: { type: "json_schema", name: "textbook_metadata_candidate", strict: true, schema } },
    });

    return NextResponse.json({ metadata: JSON.parse(response.output_text) as TextbookMetadata });
  } catch (error) {
    console.error("Textbook identification error", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "표지 정보를 읽지 못했어요. 직접 입력해도 괜찮아요." }, { status: 500 });
  }
}

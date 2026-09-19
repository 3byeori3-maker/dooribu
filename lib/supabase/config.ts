const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// 테스트 공개 버전: 정식 계정 기능을 다시 열 때 false로 변경합니다.
export const isTestMode = true;

export function isSupabaseConfigured() {
  return Boolean(
    supabaseUrl?.startsWith("https://") &&
    supabaseUrl.endsWith(".supabase.co") &&
    supabasePublishableKey?.startsWith("sb_publishable_"),
  );
}

export function getSupabaseConfig() {
  if (!isSupabaseConfigured()) {
    throw new Error("두리 전용 Supabase 환경변수가 설정되지 않았습니다.");
  }

  return {
    url: supabaseUrl as string,
    publishableKey: supabasePublishableKey as string,
  };
}

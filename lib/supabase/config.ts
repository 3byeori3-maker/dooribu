const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

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

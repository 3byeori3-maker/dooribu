import { isSupabaseConfigured, isTestMode } from "./config";
import { createClient } from "./server";

export async function getRequestAuth() {
  if (isTestMode || !isSupabaseConfigured()) {
    return { configured: false as const, userId: null, supabase: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const subject = data?.claims?.sub;

  return {
    configured: true as const,
    userId: !error && typeof subject === "string" ? subject : null,
    supabase,
  };
}

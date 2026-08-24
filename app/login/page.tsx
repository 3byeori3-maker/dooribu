"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, BookOpen, Mail, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  const configured = isSupabaseConfigured();

  const sendMagicLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!configured || status === "sending") return;
    setStatus("sending");
    setError("");

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    if (signInError) {
      setError("로그인 메일을 보내지 못했어요. 잠시 후 다시 시도해주세요.");
      setStatus("idle");
      return;
    }
    setStatus("sent");
  };

  return (
    <main className="login-screen">
      <section className="login-card">
        <div className="login-brand"><span>두</span><div><strong>두리</strong><small>AI 수학 선생님</small></div></div>
        <div className="login-heading">
          <span><ShieldCheck size={16} /> 내 학습 기록을 안전하게</span>
          <h1>이메일로 시작하기</h1>
          <p>비밀번호 없이 이메일로 받은 링크를 눌러 로그인해요.</p>
        </div>

        {!configured ? (
          <div className="login-notice">두리 전용 Supabase 프로젝트 연결이 완료되면 로그인을 사용할 수 있어요.</div>
        ) : status === "sent" ? (
          <div className="login-sent"><Mail size={28} /><strong>메일을 확인해주세요</strong><p>{email} 주소로 로그인 링크를 보냈어요.</p></div>
        ) : (
          <form className="login-form" onSubmit={(event) => void sendMagicLink(event)}>
            <label htmlFor="login-email">이메일</label>
            <div><Mail size={19} /><input id="login-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="student@example.com" autoComplete="email" required /></div>
            {error && <p role="alert">{error}</p>}
            <button disabled={status === "sending"}>{status === "sending" ? "메일 보내는 중…" : "로그인 링크 받기"}<ArrowRight size={18} /></button>
          </form>
        )}

        <div className="login-benefit"><BookOpen size={19} /><span><strong>학습계획과 풀이 기록이 이어져요</strong><small>휴대폰과 태블릿에서 같은 기록을 확인할 수 있어요.</small></span></div>
      </section>
    </main>
  );
}

"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type AuthMode = "login" | "signup";

const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{3,19}$/;

function toInternalEmail(username: string) {
  return `${username}@users.dooribu.local`;
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const configured = isSupabaseConfigured();

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setPassword("");
    setPasswordConfirm("");
    setError("");
  };

  const submitAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!configured || submitting) return;

    const normalizedUsername = username.trim().toLowerCase();
    if (!USERNAME_PATTERN.test(normalizedUsername)) {
      setError("아이디는 영문 소문자나 숫자로 시작해 4~20자로 입력해주세요.");
      return;
    }
    if (password.length < 8) {
      setError("비밀번호는 8자 이상으로 입력해주세요.");
      return;
    }
    if (mode === "signup" && password !== passwordConfirm) {
      setError("비밀번호가 서로 같지 않아요.");
      return;
    }

    setSubmitting(true);
    setError("");
    const supabase = createClient();
    const email = toInternalEmail(normalizedUsername);

    const result = mode === "signup"
      ? await supabase.auth.signUp({
          email,
          password,
          options: { data: { username: normalizedUsername } },
        })
      : await supabase.auth.signInWithPassword({ email, password });

    if (result.error) {
      if (mode === "signup" && result.error.code === "user_already_exists") {
        setError("이미 사용 중인 아이디예요. 다른 아이디를 입력해주세요.");
      } else if (mode === "login") {
        setError("아이디 또는 비밀번호를 확인해주세요.");
      } else {
        setError("회원가입을 완료하지 못했어요. 잠시 후 다시 시도해주세요.");
      }
      setSubmitting(false);
      return;
    }

    if (!result.data.session) {
      setError("로그인 설정을 확인하고 있어요. 관리자에게 문의해주세요.");
      setSubmitting(false);
      return;
    }

    router.replace("/");
    router.refresh();
  };

  return (
    <main className="login-screen">
      <section className="login-card">
        <div className="login-brand"><span>두</span><div><strong>두리</strong><small>AI 수학 선생님</small></div></div>
        <div className="login-heading">
          <span><ShieldCheck size={16} /> 내 학습 기록을 안전하게</span>
          <h1>{mode === "login" ? "다시 만나서 반가워요" : "두리를 시작해볼까요?"}</h1>
          <p>이메일 인증 없이 아이디와 비밀번호로 바로 시작해요.</p>
        </div>

        {!configured ? (
          <div className="login-notice">두리 전용 Supabase 프로젝트 연결이 완료되면 로그인을 사용할 수 있어요.</div>
        ) : (
          <>
            <div className="login-tabs" role="tablist" aria-label="로그인 방식">
              <button type="button" role="tab" aria-selected={mode === "login"} onClick={() => changeMode("login")}>로그인</button>
              <button type="button" role="tab" aria-selected={mode === "signup"} onClick={() => changeMode("signup")}>회원가입</button>
            </div>
            <form className="login-form" onSubmit={(event) => void submitAuth(event)}>
              <label htmlFor="login-username">아이디</label>
              <div><UserRound size={19} /><input id="login-username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="영문·숫자 4~20자" autoComplete="username" autoCapitalize="none" required /></div>
              <label htmlFor="login-password">비밀번호</label>
              <div><LockKeyhole size={19} /><input id="login-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="8자 이상" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={8} required /></div>
              {mode === "signup" && (
                <>
                  <label htmlFor="login-password-confirm">비밀번호 확인</label>
                  <div><LockKeyhole size={19} /><input id="login-password-confirm" type="password" value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} placeholder="비밀번호를 다시 입력" autoComplete="new-password" minLength={8} required /></div>
                </>
              )}
              {error && <p role="alert">{error}</p>}
              <button disabled={submitting}>{submitting ? "처리 중…" : mode === "login" ? "로그인" : "회원가입하고 시작하기"}<ArrowRight size={18} /></button>
            </form>
          </>
        )}

        <div className="login-benefit"><BookOpen size={19} /><span><strong>학습계획과 풀이 기록이 이어져요</strong><small>휴대폰과 태블릿에서 같은 아이디로 이어서 공부할 수 있어요.</small></span></div>
      </section>
    </main>
  );
}

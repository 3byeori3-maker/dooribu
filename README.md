# 두리 — 중학생 AI 수학 과외교사

두리는 문제·풀이 사진을 분석하고, 학교 교과서와 시험 범위에 맞춰 학습계획을 만드는 모바일·태블릿 중심 Next.js 앱입니다.

## 운영 구성

- GitHub: 소스 코드, 코드 리뷰, CI
- Vercel: Next.js 웹과 서버 API 배포
- Supabase: 이메일 인증, 학생 프로필, 학습계획, 풀이 분석 메타데이터
- OpenAI API: 수학 질문과 풀이 사진 분석

풀이 원본 사진은 OpenAI 분석 요청에만 일시적으로 사용하고 Supabase Storage나 데이터베이스에 저장하지 않습니다. Supabase에는 분석 결과와 학습 기록만 저장합니다.

## 계정 분리 원칙

이 저장소는 `3byeori3@gmail.com`이 소유하는 두리 전용 GitHub·Supabase·Vercel 계정만 사용합니다. 기존 Verywell 조직, 프로젝트, 키 또는 연결을 재사용하지 않습니다.

배포 전 아래 환경변수를 실제 두리 전용 식별자로 채우고 경계 검사를 통과해야 합니다.

```powershell
npm run verify:accounts
```

## 로컬 실행

```powershell
Copy-Item .env.example .env.local
npm install
npm run dev -- -p 3001
```

필수 환경변수는 `.env.example`을 참고합니다. 비밀키가 포함된 `.env.local`과 `.vercel`은 Git에 커밋되지 않습니다.

## Supabase

스키마는 `supabase/migrations`에서 관리합니다. 모든 학생 테이블은 RLS가 활성화되어 있으며 로그인한 사용자는 자신의 행만 조회·변경할 수 있습니다.

두리 전용 프로젝트에 로그인하고 연결한 후에만 다음 명령을 실행합니다.

```powershell
npx supabase link --project-ref <doori-project-ref>
npx supabase db push
```

## 배포

1. 두리 전용 GitHub 저장소에 `main` 브랜치를 푸시합니다.
2. 두리 전용 Vercel 계정에서 저장소를 Import합니다.
3. Vercel에 `.env.example`의 런타임 환경변수를 등록합니다.
4. `npm run verify:accounts`로 연결 경계를 확인합니다.
5. Preview 검증 후 Production으로 승격합니다.

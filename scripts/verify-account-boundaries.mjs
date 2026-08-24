import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
if (existsSync(".env.development.local")) process.loadEnvFile(".env.development.local");

const expectedEmail = process.env.DOORI_ACCOUNT_EMAIL;
const expectedSupabaseRef = process.env.DOORI_SUPABASE_PROJECT_REF;
const expectedVercelOrg = process.env.DOORI_VERCEL_ORG_ID;
const expectedVercelProject = process.env.DOORI_VERCEL_PROJECT_ID;
const expectedGithubRepository = process.env.DOORI_GITHUB_REPOSITORY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const failures = [];

if (expectedEmail !== "3byeori3@gmail.com") {
  failures.push("DOORI_ACCOUNT_EMAIL이 두리 전용 계정과 일치하지 않습니다.");
}

if (!expectedSupabaseRef || !supabaseUrl?.includes(`https://${expectedSupabaseRef}.supabase.co`)) {
  failures.push("Supabase URL과 허용된 두리 프로젝트 ref가 일치하지 않습니다.");
}

if (!expectedGithubRepository) {
  failures.push("DOORI_GITHUB_REPOSITORY가 설정되지 않았습니다.");
} else {
  try {
    const origin = execFileSync("git", ["remote", "get-url", "origin"], { encoding: "utf8" }).trim();
    if (!origin.toLowerCase().includes(expectedGithubRepository.toLowerCase())) {
      failures.push("Git origin이 허용된 두리 저장소와 일치하지 않습니다.");
    }
  } catch {
    failures.push("Git origin을 확인할 수 없습니다.");
  }
}

if (!existsSync(".vercel/project.json")) {
  failures.push("Vercel 프로젝트가 아직 연결되지 않았습니다.");
} else {
  const linked = JSON.parse(readFileSync(".vercel/project.json", "utf8"));
  if (!expectedVercelOrg || linked.orgId !== expectedVercelOrg) {
    failures.push("Vercel 조직이 허용된 두리 조직과 일치하지 않습니다.");
  }
  if (!expectedVercelProject || linked.projectId !== expectedVercelProject) {
    failures.push("Vercel 프로젝트가 허용된 두리 프로젝트와 일치하지 않습니다.");
  }
}

if (failures.length > 0) {
  console.error("계정 경계 검사 실패:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("계정 경계 검사 통과: GitHub, Supabase, Vercel이 두리 전용 리소스로 확인됐습니다.");

alter table public.student_profiles
  add column if not exists learning_profile jsonb;

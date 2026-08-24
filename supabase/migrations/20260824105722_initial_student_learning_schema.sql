create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.student_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  grade smallint check (grade between 1 and 3),
  school_name text,
  textbook_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exam_date date not null,
  selected_unit_ids text[] not null default '{}',
  weekly_availability jsonb not null default '{}'::jsonb,
  generated_plan jsonb not null,
  status text not null check (status in ('balanced', 'tight', 'overloaded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.solution_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('correct', 'partially_correct', 'incorrect', 'unclear')),
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  recognized_problem text not null default '',
  feedback jsonb not null,
  created_at timestamptz not null default now()
);

create index study_plans_user_created_idx
  on public.study_plans (user_id, created_at desc);
create index solution_analyses_user_created_idx
  on public.solution_analyses (user_id, created_at desc);

alter table public.student_profiles enable row level security;
alter table public.study_plans enable row level security;
alter table public.solution_analyses enable row level security;

grant select, insert, update, delete on public.student_profiles to authenticated;
grant select, insert, update, delete on public.study_plans to authenticated;
grant select, insert, delete on public.solution_analyses to authenticated;

create policy "students_select_own_profile"
  on public.student_profiles for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "students_insert_own_profile"
  on public.student_profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "students_update_own_profile"
  on public.student_profiles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "students_delete_own_profile"
  on public.student_profiles for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "students_select_own_plans"
  on public.study_plans for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "students_insert_own_plans"
  on public.study_plans for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "students_update_own_plans"
  on public.study_plans for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "students_delete_own_plans"
  on public.study_plans for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "students_select_own_analyses"
  on public.solution_analyses for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "students_insert_own_analyses"
  on public.solution_analyses for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "students_delete_own_analyses"
  on public.solution_analyses for delete to authenticated
  using ((select auth.uid()) = user_id);

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;

create trigger student_profiles_set_updated_at
  before update on public.student_profiles
  for each row execute function private.set_updated_at();
create trigger study_plans_set_updated_at
  before update on public.study_plans
  for each row execute function private.set_updated_at();

create function private.handle_new_student()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.student_profiles (user_id, display_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'display_name', ''));
  return new;
end;
$$;

revoke all on function private.handle_new_student() from public, anon, authenticated;

create trigger on_auth_student_created
  after insert on auth.users
  for each row execute function private.handle_new_student();

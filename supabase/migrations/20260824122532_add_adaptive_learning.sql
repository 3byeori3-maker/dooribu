alter table public.solution_analyses
  add column primary_concept text not null default '',
  add column mistake_category text not null default 'none'
    check (mistake_category in (
      'none', 'concept_gap', 'setup_error', 'calculation_error', 'sign_error',
      'notation_error', 'reading_error', 'incomplete_reasoning', 'careless_error', 'unclear'
    ));

create table public.concept_mastery (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  concept_key text not null,
  concept_name text not null,
  mastery_score smallint not null default 50 check (mastery_score between 0 and 100),
  attempts integer not null default 0 check (attempts >= 0),
  correct_attempts integer not null default 0 check (correct_attempts between 0 and attempts),
  last_mistake_category text not null default 'none'
    check (last_mistake_category in (
      'none', 'concept_gap', 'setup_error', 'calculation_error', 'sign_error',
      'notation_error', 'reading_error', 'incomplete_reasoning', 'careless_error', 'unclear'
    )),
  review_due_at timestamptz not null default now(),
  last_practiced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, concept_key)
);

create table public.learning_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  concept_key text not null,
  concept_name text not null,
  source text not null check (source in ('concept_check', 'solution_analysis', 'tutor_chat', 'review')),
  outcome text not null check (outcome in ('correct', 'partial', 'incorrect', 'unclear')),
  mistake_category text not null default 'none',
  score_delta smallint not null default 0 check (score_delta between -30 and 30),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index concept_mastery_user_score_idx
  on public.concept_mastery (user_id, mastery_score, review_due_at);
create index learning_events_user_created_idx
  on public.learning_events (user_id, created_at desc);

alter table public.concept_mastery enable row level security;
alter table public.learning_events enable row level security;

grant select, insert, update, delete on public.concept_mastery to authenticated;
grant select, insert, delete on public.learning_events to authenticated;

create policy "students_select_own_mastery"
  on public.concept_mastery for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "students_insert_own_mastery"
  on public.concept_mastery for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "students_update_own_mastery"
  on public.concept_mastery for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "students_delete_own_mastery"
  on public.concept_mastery for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "students_select_own_learning_events"
  on public.learning_events for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "students_insert_own_learning_events"
  on public.learning_events for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "students_delete_own_learning_events"
  on public.learning_events for delete to authenticated
  using ((select auth.uid()) = user_id);

create trigger concept_mastery_set_updated_at
  before update on public.concept_mastery
  for each row execute function private.set_updated_at();

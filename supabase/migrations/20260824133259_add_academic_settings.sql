alter table public.student_profiles
  add column if not exists grade_level text
    check (grade_level in ('초6', '중1', '중2', '중3', '고1', '고2', '고3')),
  add column if not exists semester text
    check (semester in ('1학기', '2학기')),
  add column if not exists exam_type text
    check (exam_type in ('none', 'midterm', 'final'));

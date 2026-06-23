-- =============================================================================
-- Per-trainee note on a class enrollment.
--
-- The session roster's "Notes" button (Classes · Calendar → a session → a
-- trainee) writes a free-text note for that specific enrolment. It previously
-- only fired a toast; this column gives it a real home. RLS on class_enrollments
-- (gym-scoped) already protects it; the server action filters by gym_id too.
-- =============================================================================
alter table public.class_enrollments
  add column if not exists notes text;

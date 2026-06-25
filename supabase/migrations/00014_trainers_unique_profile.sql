-- =============================================================================
-- One bridged trainer per staff profile per gym.
--
-- Trainers are auto-created from staff (role 'trainer') by listTrainerOptions().
-- With no uniqueness on (gym_id, profile_id), parallel page loads could each
-- insert a trainer row for the same profile → duplicate "ghost" trainers.
--
-- profile_id is nullable, and Postgres treats NULLs as DISTINCT in a unique
-- index, so standalone trainers (profile_id IS NULL) can still coexist — only
-- the auto-bridged rows are constrained.
--
-- ⚠️  PRE-REQUISITE: collapse any existing duplicates FIRST (run the dedup script
--     — scripts/dedup-trainers.sql) or this index creation will fail with a
--     "could not create unique index … duplicate key" error.
-- =============================================================================
create unique index if not exists trainers_gym_profile_uidx
  on public.trainers (gym_id, profile_id);

-- =============================================================================
-- Collapse duplicate auto-bridged trainers to ONE row per (gym_id, profile_id).
--
-- Run this in the Supabase SQL editor BEFORE applying migration 00014 (the
-- unique index), otherwise the index creation fails on the existing duplicates.
--
-- It is SAFE: every reference to a duplicate trainer (classes, class_sessions,
-- workout_plans, staff_shifts) is first re-pointed to the surviving row, so no
-- class loses its trainer and no staff_shift gets cascade-deleted. Only the
-- redundant trainer rows are removed. Wrapped in a transaction — all or nothing.
-- =============================================================================
begin;

-- Survivor = the OLDEST trainer row for each (gym_id, profile_id); the rest are
-- duplicates. Only bridged rows (profile_id IS NOT NULL) are considered.
create temporary table _trainer_dedup on commit drop as
select
  id as dup_id,
  first_value(id) over (
    partition by gym_id, profile_id
    order by created_at asc, id asc
  ) as keep_id
from public.trainers
where profile_id is not null;

-- Re-point every reference from a duplicate → its survivor.
update public.classes        x set trainer_id = d.keep_id from _trainer_dedup d where x.trainer_id = d.dup_id and d.dup_id <> d.keep_id;
update public.class_sessions x set trainer_id = d.keep_id from _trainer_dedup d where x.trainer_id = d.dup_id and d.dup_id <> d.keep_id;
update public.workout_plans  x set trainer_id = d.keep_id from _trainer_dedup d where x.trainer_id = d.dup_id and d.dup_id <> d.keep_id;
update public.staff_shifts   x set trainer_id = d.keep_id from _trainer_dedup d where x.trainer_id = d.dup_id and d.dup_id <> d.keep_id;

-- Now the duplicates are unreferenced — delete them.
delete from public.trainers t using _trainer_dedup d
where t.id = d.dup_id and d.dup_id <> d.keep_id;

commit;

-- Verify: this should return ZERO rows afterwards.
select gym_id, profile_id, count(*)
from public.trainers
where profile_id is not null
group by gym_id, profile_id
having count(*) > 1;

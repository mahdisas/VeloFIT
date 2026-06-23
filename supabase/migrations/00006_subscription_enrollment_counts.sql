-- =============================================================================
-- 00006 — Perf: aggregate enrollment counts per subscription in SQL.
--
-- The Subscriptions Balance and No-Enrollments reports previously fetched EVERY
-- class_enrollments row and counted them per subscription in Node. This RPC does
-- the GROUP BY in Postgres, returning one row per subscription — so it scales to
-- 100k+ enrollments. SECURITY INVOKER: RLS applies, and the explicit gym filter
-- keeps it tenant-scoped (mirrors report_finance_charges in 00003).
-- Idempotent / safe to re-run.
-- =============================================================================

-- Supports the grouped scan within a gym.
create index if not exists class_enrollments_gym_sub_idx
  on public.class_enrollments (gym_id, subscription_id);

create or replace function public.subscription_enrollment_counts()
returns table (subscription_id uuid, cnt bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select e.subscription_id, count(*)::bigint as cnt
  from public.class_enrollments e
  where e.gym_id = (select public.auth_gym_id())
    and e.subscription_id is not null
    and e.status in ('booked', 'attended')
  group by e.subscription_id;
$$;

revoke execute on function public.subscription_enrollment_counts() from public, anon;
grant  execute on function public.subscription_enrollment_counts() to authenticated, service_role;

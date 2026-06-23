-- =============================================================================
-- 00007 — Perf: latest attendance (check-in) per client, in SQL.
--
-- The Classes-Absence report previously fetched EVERY attendances row for the
-- gym and kept the latest per client in Node. This RPC does it with DISTINCT ON
-- in Postgres, returning one row per client. Scales to large attendance logs.
-- SECURITY INVOKER + explicit gym filter (RLS also applies). Idempotent.
-- =============================================================================

-- Supports the per-client "latest" scan within a gym.
create index if not exists attendances_gym_client_checked_idx
  on public.attendances (gym_id, client_id, checked_in_at desc);

create or replace function public.latest_attendance_per_client()
returns table (client_id uuid, last_at date)
language sql
stable
security invoker
set search_path = public
as $$
  select distinct on (a.client_id)
         a.client_id,
         a.checked_in_at::date as last_at
  from public.attendances a
  where a.gym_id = (select public.auth_gym_id())
  order by a.client_id, a.checked_in_at desc;
$$;

revoke execute on function public.latest_attendance_per_client() from public, anon;
grant  execute on function public.latest_attendance_per_client() to authenticated, service_role;

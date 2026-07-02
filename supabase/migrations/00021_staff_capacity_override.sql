-- =============================================================================
-- 00021 — Role-based capacity override for class bookings.
--
-- Two booking paths hit the enforce_session_capacity trigger, and they are
-- distinguishable by the caller's identity:
--
--   • STAFF (dashboard / staff portal / owner mobile roster): every staff
--     action runs on the cookie-scoped AUTHENTICATED client, so auth.uid() is
--     set and public.auth_role() returns their staff role. Staff deliberately
--     overbook (walk-ins, VIPs, approving a waitlist over capacity) — the
--     capacity check is skipped ENTIRELY and the enrollment lands as 'booked'.
--
--   • MEMBERS (veloFIT app self-booking): members have no Supabase auth
--     session — booking-actions.ts runs on the SERVICE ROLE, where auth.uid()
--     is null and auth_role() returns null. The strict check still applies:
--     a full class raises 23514 and the app places them on the waiting list.
--
-- Same function name/trigger as 00001 → CREATE OR REPLACE swaps it in place.
-- Idempotent.
-- =============================================================================

create or replace function public.enforce_session_capacity()
returns trigger language plpgsql set search_path = public as $$
declare session_capacity integer;
begin
  if new.status not in ('booked','attended') then return new; end if;

  -- Staff override: an authenticated user with a profiles row (owner, admin,
  -- manager, trainer, receptionist) bypasses the capacity limit on purpose.
  if (select public.auth_role()) is not null then return new; end if;

  -- Member / non-staff path: row-lock the session, re-count, fail if full.
  select capacity into session_capacity from public.class_sessions where id = new.session_id for update;
  if (select count(*) from public.class_enrollments
        where session_id = new.session_id and status in ('booked','attended')
          and id is distinct from new.id) >= session_capacity then
    raise exception 'class session % is full', new.session_id using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

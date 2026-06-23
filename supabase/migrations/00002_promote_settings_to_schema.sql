-- =============================================================================
-- 00002 — Promote interim gyms.settings JSON into real columns / tables.
--
-- The five items below were stored in gyms.settings jsonb because the original
-- schema lacked columns for them. This migration adds proper schema + RLS
-- (mirroring 00001's `gym_id = (select public.auth_gym_id())` pattern) and
-- backfills any existing JSON data. Safe to re-run: uses IF NOT EXISTS / ON
-- CONFLICT DO NOTHING.
--
-- ⚠️ Schema only changes the DB. The app code still reads/writes gyms.settings
--    for these — after running this, the server code must be updated to use the
--    new columns/tables (see the chat for the follow-up).
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Business profile extras  (was gyms.settings->'business')
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.gyms
  add column if not exists whatsapp      text,
  add column if not exists facebook_url  text,
  add column if not exists instagram_url text,
  add column if not exists tiktok_url    text,
  add column if not exists description   text;

update public.gyms set
  whatsapp      = coalesce(whatsapp,      settings->'business'->>'whatsapp'),
  facebook_url  = coalesce(facebook_url,  settings->'business'->>'facebookUrl'),
  instagram_url = coalesce(instagram_url, settings->'business'->>'instagramUrl'),
  tiktok_url    = coalesce(tiktok_url,    settings->'business'->>'tiktokUrl'),
  description   = coalesce(description,   settings->'business'->>'description')
where settings ? 'business';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Per-session notes  (was gyms.settings->'sessionNotes'[sessionId])
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.class_sessions add column if not exists notes text;

update public.class_sessions cs
   set notes = g.settings->'sessionNotes'->>cs.id::text
  from public.gyms g
 where g.id = cs.gym_id
   and coalesce(g.settings->'sessionNotes', '{}'::jsonb) ? cs.id::text;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Per-subscription caps  (was gyms.settings->'subscriptionLimits'[subId])
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.subscriptions
  add column if not exists max_per_day          integer       not null default 0,
  add column if not exists max_per_week         integer       not null default 0,
  add column if not exists max_per_month        integer       not null default 0,
  add column if not exists max_total            integer       not null default 0,
  add column if not exists cancellation_balance numeric(10,2) not null default 0,
  add column if not exists auto_enroll          boolean       not null default false;

update public.subscriptions s
   set max_per_day          = coalesce((g.settings->'subscriptionLimits'->s.id::text->>'maxPerDay')::int, 0),
       max_per_week         = coalesce((g.settings->'subscriptionLimits'->s.id::text->>'maxPerWeek')::int, 0),
       max_per_month        = coalesce((g.settings->'subscriptionLimits'->s.id::text->>'maxPerMonth')::int, 0),
       max_total            = coalesce((g.settings->'subscriptionLimits'->s.id::text->>'maxTotal')::int, 0),
       cancellation_balance = coalesce((g.settings->'subscriptionLimits'->s.id::text->>'cancellationBalance')::numeric, 0),
       auto_enroll          = coalesce((g.settings->'subscriptionLimits'->s.id::text->>'autoEnroll')::boolean, false)
  from public.gyms g
 where g.id = s.gym_id
   and coalesce(g.settings->'subscriptionLimits', '{}'::jsonb) ? s.id::text;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Class settings  (was gyms.settings->'classes') → table mirroring sms_settings
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.class_settings (
  gym_id                                      uuid primary key references public.gyms (id) on delete cascade,
  convert_waiting_to_approved                 boolean not null default false,
  notify_on_cancellation                      boolean not null default false,
  reminder_minutes_before                     integer not null default 0,
  show_classes_every_week                     boolean not null default false,
  schedule_next_days                          integer not null default 14,
  apply_enrollment_limit_across_subscriptions boolean not null default false,
  block_clients_for_absences                  boolean not null default false,
  updated_at                                  timestamptz not null default now()
);
alter table public.class_settings enable row level security;
create policy class_settings_select on public.class_settings for select to authenticated using (gym_id = (select public.auth_gym_id()));
create policy class_settings_insert on public.class_settings for insert to authenticated with check (gym_id = (select public.auth_gym_id()));
create policy class_settings_update on public.class_settings for update to authenticated using (gym_id = (select public.auth_gym_id())) with check (gym_id = (select public.auth_gym_id()));
create policy class_settings_delete on public.class_settings for delete to authenticated using (gym_id = (select public.auth_gym_id()));
create trigger class_settings_set_updated_at before update on public.class_settings
  for each row execute function public.set_updated_at();

insert into public.class_settings (
  gym_id, convert_waiting_to_approved, notify_on_cancellation, reminder_minutes_before,
  show_classes_every_week, schedule_next_days, apply_enrollment_limit_across_subscriptions, block_clients_for_absences)
select g.id,
  coalesce((g.settings->'classes'->>'convertWaitingToApproved')::boolean, false),
  coalesce((g.settings->'classes'->>'notifyOnCancellation')::boolean, false),
  coalesce((g.settings->'classes'->>'reminderMinutesBefore')::int, 0),
  coalesce((g.settings->'classes'->>'showClassesEveryWeek')::boolean, false),
  coalesce((g.settings->'classes'->>'scheduleNextDays')::int, 14),
  coalesce((g.settings->'classes'->>'applyEnrollmentLimitAcrossSubscriptions')::boolean, false),
  coalesce((g.settings->'classes'->>'blockClientsForAbsences')::boolean, false)
from public.gyms g
where g.settings ? 'classes'
on conflict (gym_id) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Family links  (was gyms.settings->'family' { clientId: [memberId,...] })
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.family_members (
  gym_id           uuid not null references public.gyms (id) on delete cascade,
  client_id        uuid not null references public.clients (id) on delete cascade,
  member_client_id uuid not null references public.clients (id) on delete cascade,
  created_at       timestamptz not null default now(),
  primary key (client_id, member_client_id),
  check (client_id <> member_client_id)
);
create index if not exists family_members_gym_idx on public.family_members (gym_id);
alter table public.family_members enable row level security;
create policy family_members_select on public.family_members for select to authenticated using (gym_id = (select public.auth_gym_id()));
create policy family_members_insert on public.family_members for insert to authenticated with check (gym_id = (select public.auth_gym_id()));
create policy family_members_delete on public.family_members for delete to authenticated using (gym_id = (select public.auth_gym_id()));

insert into public.family_members (gym_id, client_id, member_client_id)
select g.id, fam.key::uuid, mem.value::uuid
from public.gyms g,
     lateral jsonb_each(coalesce(g.settings->'family', '{}'::jsonb)) as fam(key, members),
     lateral jsonb_array_elements_text(fam.members) as mem(value)
where g.settings ? 'family'
on conflict do nothing;

-- =============================================================================
-- OPTIONAL cleanup — only after you've confirmed the app reads the new schema.
-- Strips the now-duplicated JSON keys so gyms.settings stays lean:
--
--   update public.gyms set settings =
--     settings - 'business' - 'classes' - 'family' - 'sessionNotes' - 'subscriptionLimits';
-- =============================================================================

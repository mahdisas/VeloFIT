-- =============================================================================
-- 00018 — Gym active/suspended flag for the platform (super-admin) console.
--
-- A suspended gym stays in the database (data + config intact) but nobody in it
-- can sign in — enforced at the auth gates (getAuthedProfile, staff login,
-- member phone login). The operator console can toggle this and still manage a
-- suspended gym. Idempotent; defaults to active so existing gyms are unaffected.
-- =============================================================================

alter table public.gyms
  add column if not exists is_active boolean not null default true;

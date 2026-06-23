-- =============================================================================
-- FITX — Gym Management SaaS · Complete database schema (consolidated baseline)
--
-- One coherent, production-grade schema for a fresh Supabase project. It
-- replaces the earlier incremental drafts (00001/00002/00003) and folds in:
--   • the multi-tenant core (gyms, staff, clients, classes, subscriptions),
--   • the audit-hardening pass (InitPlan RLS, privilege guard, overbooking
--     guard, date-aware subscription status, FK indexes),
--   • every app module (Classes wizard + groups + calendar, Finance, Marketing,
--     Leads, Tasks, Messages, Workout Plans, Reports, Settings, Archive),
--   • and the fixes from the schema review (see "Review fixes" notes inline).
--
-- Multi-tenancy: `gyms` is the tenant table; every business row carries a
-- `gym_id`. Staff authenticate via Supabase Auth; their `profiles` row pins the
-- tenant. RLS on every table enforces `gym_id = (select auth_gym_id())`, so a
-- gym's staff can never read or write another gym's data — even via PostgREST.
--
-- Conventions: every FK used in a join/filter/cascade is indexed; mutable
-- entities get updated_at + a trigger; enums are snake_case; "cancel" is spelled
-- `canceled` everywhere (one L) for consistency.
-- =============================================================================

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.user_role          as enum ('owner', 'admin', 'manager', 'trainer', 'receptionist');
create type public.gender_type        as enum ('male', 'female', 'other');
create type public.client_status      as enum ('active', 'inactive', 'frozen', 'archived');
create type public.subscription_status as enum ('pending', 'active', 'frozen', 'expired', 'canceled');
create type public.session_status     as enum ('scheduled', 'completed', 'canceled');
create type public.enrollment_status  as enum ('booked', 'attended', 'no_show', 'canceled', 'waitlisted');
create type public.lead_status        as enum ('new', 'contacted', 'converted', 'lost');
create type public.task_status        as enum ('new', 'in_progress', 'canceled', 'finished');
create type public.payment_method     as enum ('cash', 'credit_card', 'cheque', 'bank_transfer', 'direct_debit');
create type public.document_type      as enum ('tax_invoice', 'receipt', 'receipt_tax_invoice', 'refund', 'non_formal_transaction', 'informal', 'bid');
create type public.order_status       as enum ('completed', 'pending', 'canceled');   -- one-L spelling, unified project-wide
create type public.txn_status         as enum ('approved', 'declined', 'refunded');
create type public.mandate_status     as enum ('active', 'paused', 'canceled');       -- one-L spelling, unified project-wide
create type public.workout_goal       as enum ('strength', 'hypertrophy', 'weight_loss', 'endurance', 'mobility', 'general');
create type public.workout_level      as enum ('beginner', 'intermediate', 'advanced');
create type public.shift_status       as enum ('active', 'completed');

-- =============================================================================
-- Tenants + staff
-- =============================================================================
create table public.gyms (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  slug             text not null unique,             -- used in URLs / subdomains
  logo_url         text,
  email            text,
  phone            text,
  address          text,
  timezone         text not null default 'UTC',
  messages_balance integer not null default 0 check (messages_balance >= 0),
  -- Per-gym config: currency, locale, class rules (settings->'classes'),
  -- business profile (settings->'business': whatsapp + social URLs + description).
  settings         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- 1:1 with auth.users. The row's gym_id is the tenant claim. `role` drives
-- coarse-grained RLS (owners/admins); `permissions` is the fine-grained UI
-- feature-flag layer edited in Settings · Users (the two are complementary).
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  gym_id      uuid not null references public.gyms (id) on delete cascade,
  role        public.user_role not null default 'receptionist',
  full_name   text not null,
  username    text,
  first_name  text,
  last_name   text,
  avatar_url  text,
  phone       text,
  hourly_rate numeric(10, 2) not null default 0 check (hourly_rate >= 0),
  permissions jsonb not null default '{}'::jsonb,    -- {classesManagement, trainer, secretary, addUpdate, delete, memberApplication, financeReports, reports}
  is_active   boolean not null default true,
  is_archived boolean not null default false,        -- feeds Archive · Users
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index profiles_gym_id_idx on public.profiles (gym_id);
create index profiles_gym_archived_idx on public.profiles (gym_id, is_archived);
create unique index profiles_gym_username_uidx on public.profiles (gym_id, lower(username)) where username is not null;

-- Tenant-claim helpers. SECURITY DEFINER so they read `profiles` from inside RLS
-- policies without recursing; STABLE + PARALLEL SAFE so they plan as InitPlans.
create or replace function public.auth_gym_id()
returns uuid language sql stable security definer parallel safe set search_path = public as $$
  select gym_id from public.profiles where id = auth.uid();
$$;

create or replace function public.auth_role()
returns public.user_role language sql stable security definer parallel safe set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

revoke execute on function public.auth_gym_id() from public, anon;
revoke execute on function public.auth_role()   from public, anon;
grant  execute on function public.auth_gym_id() to authenticated, service_role;
grant  execute on function public.auth_role()   to authenticated, service_role;

-- Shared updated_at trigger function.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- Trainers. Separate from profiles: a trainer may or may not have a login.
create table public.trainers (
  id          uuid primary key default gen_random_uuid(),
  gym_id      uuid not null references public.gyms (id) on delete cascade,
  profile_id  uuid references public.profiles (id) on delete set null,
  full_name   text not null,
  email       text,
  phone       text,
  avatar_url  text,
  bio         text,
  specialties text[] not null default '{}',
  color       text not null default '#3b82f6',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index trainers_gym_id_idx on public.trainers (gym_id);

-- Locations (Settings · Locations) — source of truth for the wizard's picker.
create table public.locations (
  id          uuid primary key default gen_random_uuid(),
  gym_id      uuid not null references public.gyms (id) on delete cascade,
  name        text not null,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index locations_gym_id_idx on public.locations (gym_id);
create unique index locations_gym_name_uidx on public.locations (gym_id, lower(name));

-- =============================================================================
-- Clients
-- =============================================================================
create table public.clients (
  id            uuid primary key default gen_random_uuid(),
  gym_id        uuid not null references public.gyms (id) on delete cascade,
  client_number bigint,                               -- per-gym human serial (assigned by trigger)
  full_name     text not null,
  email         text,
  phone         text,
  phone2        text,
  national_id   text,
  gender        public.gender_type,
  birth_date    date,
  avatar_url    text,
  address       text,
  city          text,
  messaging_opt boolean not null default true,
  status        public.client_status not null default 'active',  -- 'archived' → Archive · Clients
  notes         text,
  joined_at     date not null default current_date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index clients_gym_id_idx on public.clients (gym_id);
create index clients_gym_name_idx on public.clients (gym_id, lower(full_name) text_pattern_ops); -- top-bar search
create index clients_gym_status_idx on public.clients (gym_id, status);
create unique index clients_gym_number_uidx on public.clients (gym_id, client_number) where client_number is not null;
-- Review fix: no duplicate national IDs per gym (receptionist double-entry guard).
create unique index clients_gym_national_id_uidx on public.clients (gym_id, national_id) where national_id is not null;

-- =============================================================================
-- Classes — kinds, recurring template + weekly slots, groups, calendar
-- =============================================================================

-- Catalog entry ("Yoga Flow", "אימון כוח") with participant limits + image.
create table public.class_kinds (
  id               uuid primary key default gen_random_uuid(),
  gym_id           uuid not null references public.gyms (id) on delete cascade,
  name             text not null,
  description      text,
  color            text not null default '#ec4899',  -- calendar accent
  min_participants integer not null default 0 check (min_participants >= 0),
  max_participants integer check (max_participants is null or max_participants >= min_participants),
  image_url        text,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index class_kinds_gym_id_idx on public.class_kinds (gym_id);

-- Recurring class template (the wizard). The weekly schedule lives in
-- class_time_slots (one row per "From → To" slot) — the single source of truth.
-- starts_on/ends_on bound the template's validity (the wizard's start/expire).
create table public.classes (
  id                        uuid primary key default gen_random_uuid(),
  gym_id                    uuid not null references public.gyms (id) on delete cascade,
  kind_id                   uuid not null references public.class_kinds (id) on delete restrict,
  trainer_id                uuid references public.trainers (id) on delete set null,
  location_id               uuid references public.locations (id) on delete set null,
  name                      text,                     -- optional override of kind name
  color                     text,                     -- optional override of kind color
  description               text,
  is_free                   boolean not null default false,
  notify_trainer            boolean not null default false,
  hourly_rate               numeric(10, 2) not null default 0 check (hourly_rate >= 0),
  min_participants          integer not null default 0 check (min_participants >= 0),
  max_participants          integer check (max_participants is null or max_participants >= min_participants), -- the capacity; null = no cap
  enroll_before_hours       integer,
  close_registration_hours  integer,
  cancel_before_hours       integer,
  allow_late_cancellation   boolean not null default false,
  waiting_list_by_default   boolean not null default false,
  show_enroll_list          boolean not null default false,
  show_max_participants     boolean not null default true,
  allow_waiting_list        boolean not null default false,
  cancel_if_below_min       boolean not null default false,
  starts_on                 date not null default current_date,
  ends_on                   date,                     -- null = repeats indefinitely
  is_active                 boolean not null default true,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create index classes_gym_id_idx on public.classes (gym_id);
create index classes_kind_id_idx on public.classes (kind_id);
create index classes_trainer_id_idx on public.classes (trainer_id);
create index classes_location_id_idx on public.classes (location_id);

-- Weekly slots. ISO day_of_week (1 = Mon … 7 = Sun, matches extract(isodow)).
-- No (end_time > start_time) check: overnight classes are valid (e.g. 23:30 →
-- 00:30); a slot with end_time <= start_time is read as crossing midnight.
create table public.class_time_slots (
  id          uuid primary key default gen_random_uuid(),
  gym_id      uuid not null references public.gyms (id) on delete cascade,
  class_id    uuid not null references public.classes (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  start_time  time not null,
  end_time    time not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index class_time_slots_gym_id_idx on public.class_time_slots (gym_id);
create index class_time_slots_class_idx  on public.class_time_slots (class_id);

create table public.class_equipments (
  id         uuid primary key default gen_random_uuid(),
  gym_id     uuid not null references public.gyms (id) on delete cascade,
  class_id   uuid not null references public.classes (id) on delete cascade,
  name       text not null,
  quantity   integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index class_equipments_gym_id_idx on public.class_equipments (gym_id);
create index class_equipments_class_idx  on public.class_equipments (class_id);

-- Groups Management: a tiered price card bundling classes.
create table public.class_groups (
  id           uuid primary key default gen_random_uuid(),
  gym_id       uuid not null references public.gyms (id) on delete cascade,
  name         text not null,
  notes        text,
  price_1m     numeric(10, 2) not null default 0 check (price_1m >= 0),
  price_2m     numeric(10, 2) not null default 0 check (price_2m >= 0),
  price_3m     numeric(10, 2) not null default 0 check (price_3m >= 0),
  price_4m     numeric(10, 2) not null default 0 check (price_4m >= 0),
  price_6m     numeric(10, 2) not null default 0 check (price_6m >= 0),
  price_yearly numeric(10, 2) not null default 0 check (price_yearly >= 0),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index class_groups_gym_id_idx on public.class_groups (gym_id);
create unique index class_groups_gym_name_uidx on public.class_groups (gym_id, lower(name));

create table public.class_group_classes (
  gym_id   uuid not null references public.gyms (id) on delete cascade,
  group_id uuid not null references public.class_groups (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  primary key (group_id, class_id)
);
create index class_group_classes_gym_id_idx on public.class_group_classes (gym_id);
create index class_group_classes_class_idx  on public.class_group_classes (class_id);

-- =============================================================================
-- Subscription packages + subscriptions
--   subscription_plans IS the Finance · Subscription Packages catalog.
-- =============================================================================
create table public.subscription_plans (
  id              uuid primary key default gen_random_uuid(),
  gym_id          uuid not null references public.gyms (id) on delete cascade,
  group_id        uuid references public.class_groups (id) on delete set null,
  name            text not null,
  description     text,
  price           numeric(10, 2) not null default 0 check (price >= 0),
  color           text not null default '#ec1c79',
  period_months   integer not null default 1 check (period_months >= 1),  -- billing cadence + length
  max_payments    integer not null default 1 check (max_payments >= 1),   -- installments
  max_purchases   integer not null default 0 check (max_purchases >= 0),  -- 0 = unlimited
  is_trial_lesson boolean not null default false,
  show_in_app     boolean not null default true,
  -- Review fix: these were NOT NULL and blocked package inserts. Now optional —
  -- populate only for fixed-day / entrance-limited / class-credit passes.
  duration_days   integer check (duration_days is null or duration_days > 0),
  entrances_limit integer check (entrances_limit is null or entrances_limit > 0),
  classes_limit   integer check (classes_limit is null or classes_limit > 0),
  is_class_plan   boolean not null default false,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index subscription_plans_gym_id_idx on public.subscription_plans (gym_id);
create index subscription_plans_group_id_idx on public.subscription_plans (group_id);

create table public.subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  gym_id             uuid not null references public.gyms (id) on delete cascade,
  client_id          uuid not null references public.clients (id) on delete cascade,
  plan_id            uuid not null references public.subscription_plans (id) on delete restrict,
  status             public.subscription_status not null default 'active',
  start_date         date not null default current_date,
  end_date           date not null,
  price_paid         numeric(10, 2) not null default 0 check (price_paid >= 0),
  entrances_used     integer not null default 0 check (entrances_used >= 0),
  classes_used       integer not null default 0 check (classes_used >= 0),
  installments_total integer check (installments_total is null or installments_total >= 1),
  installments_paid  integer not null default 0 check (installments_paid >= 0),
  is_direct_debit    boolean not null default false,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (end_date >= start_date)
);
create index subscriptions_gym_id_idx on public.subscriptions (gym_id);
create index subscriptions_client_idx on public.subscriptions (client_id);
create index subscriptions_plan_id_idx on public.subscriptions (plan_id);
create index subscriptions_gym_status_end_idx on public.subscriptions (gym_id, status, end_date);

-- Direct-debit / standing-order mandates (Direct Debit report). Store only
-- masked account hints — never raw card numbers or IBANs.
create table public.billing_mandates (
  id                 uuid primary key default gen_random_uuid(),
  gym_id             uuid not null references public.gyms (id) on delete cascade,
  client_id          uuid not null references public.clients (id) on delete cascade,
  subscription_id    uuid references public.subscriptions (id) on delete set null,
  method             public.payment_method not null default 'direct_debit',
  masked_account     text,
  status             public.mandate_status not null default 'active',
  installments_total integer check (installments_total is null or installments_total >= 1),
  installments_paid  integer not null default 0 check (installments_paid >= 0),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index billing_mandates_gym_id_idx on public.billing_mandates (gym_id);
create index billing_mandates_client_idx on public.billing_mandates (client_id);
create index billing_mandates_subscription_idx on public.billing_mandates (subscription_id);

-- =============================================================================
-- Calendar: concrete dated sessions + enrollments + door attendance
-- =============================================================================
create table public.class_sessions (
  id            uuid primary key default gen_random_uuid(),
  gym_id        uuid not null references public.gyms (id) on delete cascade,
  class_id      uuid not null references public.classes (id) on delete cascade,
  trainer_id    uuid references public.trainers (id) on delete set null,  -- per-date substitute
  session_date  date not null,
  start_time    time not null,
  end_time      time not null,                       -- < start_time ⇒ crosses midnight
  capacity      integer not null check (capacity > 0),  -- snapshot of class.max_participants at generation
  status        public.session_status not null default 'scheduled',
  cancel_reason text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (class_id, session_date, start_time)
);
create index class_sessions_gym_date_idx on public.class_sessions (gym_id, session_date);
create index class_sessions_class_idx on public.class_sessions (class_id);

create table public.class_enrollments (
  id              uuid primary key default gen_random_uuid(),
  gym_id          uuid not null references public.gyms (id) on delete cascade,
  session_id      uuid not null references public.class_sessions (id) on delete cascade,
  client_id       uuid not null references public.clients (id) on delete cascade,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  -- App roster labels map here: Approved → booked, Waiting → waitlisted, Rejected → canceled.
  status          public.enrollment_status not null default 'booked',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (session_id, client_id)
);
create index class_enrollments_gym_id_idx on public.class_enrollments (gym_id);
create index class_enrollments_session_status_idx on public.class_enrollments (session_id, status);
create index class_enrollments_client_idx on public.class_enrollments (client_id);
create index class_enrollments_subscription_idx on public.class_enrollments (subscription_id);

create table public.attendances (
  id              uuid primary key default gen_random_uuid(),
  gym_id          uuid not null references public.gyms (id) on delete cascade,
  client_id       uuid not null references public.clients (id) on delete cascade,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  session_id      uuid references public.class_sessions (id) on delete set null,
  checked_in_at   timestamptz not null default now(),
  checked_out_at  timestamptz,
  created_at      timestamptz not null default now()
);
create index attendances_gym_checkin_idx on public.attendances (gym_id, checked_in_at);
create index attendances_client_idx on public.attendances (client_id);
create index attendances_subscription_idx on public.attendances (subscription_id);
create index attendances_session_idx on public.attendances (session_id);

-- =============================================================================
-- Finance — catalog + ledger
-- =============================================================================
create table public.product_categories (
  id          uuid primary key default gen_random_uuid(),
  gym_id      uuid not null references public.gyms (id) on delete cascade,
  name        text not null,
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index product_categories_gym_id_idx on public.product_categories (gym_id);
create unique index product_categories_gym_name_uidx on public.product_categories (gym_id, lower(name));

create table public.products (
  id          uuid primary key default gen_random_uuid(),
  gym_id      uuid not null references public.gyms (id) on delete cascade,
  category_id uuid references public.product_categories (id) on delete set null,
  name        text not null,
  description text,
  price       numeric(10, 2) not null default 0 check (price >= 0),
  show_in_app boolean not null default true,
  image_url   text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index products_gym_id_idx on public.products (gym_id);
create index products_category_id_idx on public.products (category_id);

create table public.accounting_documents (
  id         uuid primary key default gen_random_uuid(),
  gym_id     uuid not null references public.gyms (id) on delete cascade,
  client_id  uuid references public.clients (id) on delete set null,
  doc_type   public.document_type not null,
  doc_number text not null default '0',
  issued_on  date not null default current_date,
  subtotal   numeric(10, 2) not null default 0,
  vat        numeric(10, 2) not null default 0,
  total      numeric(10, 2) not null default 0,
  notes      text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index accounting_documents_gym_issued_idx on public.accounting_documents (gym_id, issued_on);
create index accounting_documents_client_idx on public.accounting_documents (client_id);

-- Payment ledger (append-only). Card/gateway columns only for method = credit_card.
create table public.payments (
  id              uuid primary key default gen_random_uuid(),
  gym_id          uuid not null references public.gyms (id) on delete cascade,
  client_id       uuid references public.clients (id) on delete set null,
  document_id     uuid references public.accounting_documents (id) on delete set null,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  method          public.payment_method not null,
  amount          numeric(10, 2) not null check (amount >= 0),
  paid_at         timestamptz not null default now(),
  reference       text,
  card_last4      text check (card_last4 is null or card_last4 ~ '^[0-9]{4}$'),
  gateway_txn_id  text,
  status          public.txn_status,
  original_txn_id text,
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now()
);
create index payments_gym_paid_idx on public.payments (gym_id, paid_at);
create index payments_gym_method_idx on public.payments (gym_id, method);
create index payments_client_idx on public.payments (client_id);
create index payments_document_idx on public.payments (document_id);
create index payments_subscription_idx on public.payments (subscription_id);

create table public.orders (
  id           uuid primary key default gen_random_uuid(),
  gym_id       uuid not null references public.gyms (id) on delete cascade,
  client_id    uuid references public.clients (id) on delete set null,
  order_number text not null,
  status       public.order_status not null default 'pending',
  ordered_on   date not null default current_date,
  total        numeric(10, 2) not null default 0 check (total >= 0),
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index orders_gym_status_idx on public.orders (gym_id, status);
create index orders_client_idx on public.orders (client_id);

create table public.order_items (
  id          uuid primary key default gen_random_uuid(),
  gym_id      uuid not null references public.gyms (id) on delete cascade,
  order_id    uuid not null references public.orders (id) on delete cascade,
  product_id  uuid references public.products (id) on delete set null,
  plan_id     uuid references public.subscription_plans (id) on delete set null,
  description text not null,
  quantity    integer not null default 1 check (quantity > 0),
  unit_price  numeric(10, 2) not null default 0 check (unit_price >= 0),
  line_total  numeric(10, 2) not null default 0 check (line_total >= 0),
  created_at  timestamptz not null default now(),
  check (num_nonnulls(product_id, plan_id) <= 1)
);
create index order_items_gym_id_idx on public.order_items (gym_id);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);
create index order_items_plan_idx on public.order_items (plan_id);

-- =============================================================================
-- Marketing + Leads
-- =============================================================================
create table public.campaigns (
  id            uuid primary key default gen_random_uuid(),
  gym_id        uuid not null references public.gyms (id) on delete cascade,
  name          text not null,
  platform_type text not null,   -- instagram | facebook | tiktok | web | general | other
  campaign_type text not null,   -- paid_ad | organic_growth | promotion | ...
  url           text,
  description   text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index campaigns_gym_id_idx on public.campaigns (gym_id);

create table public.leads (
  id                  uuid primary key default gen_random_uuid(),
  gym_id              uuid not null references public.gyms (id) on delete cascade,
  campaign_id         uuid references public.campaigns (id) on delete set null,
  full_name           text not null,
  national_id         text,
  birth_date          date,
  phone               text,
  phone2              text,
  email               text,
  gender              public.gender_type,
  city                text,
  address             text,
  avatar_url          text,                          -- review fix: was missing
  notes               text,
  messaging_opt       boolean not null default true,
  blocked             boolean not null default false,
  status              public.lead_status not null default 'new',
  converted_client_id uuid references public.clients (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index leads_gym_status_idx on public.leads (gym_id, status);
create index leads_campaign_idx on public.leads (campaign_id);
create index leads_converted_idx on public.leads (converted_client_id);

-- =============================================================================
-- CRM — tasks, messages, audit, measurements, files
-- =============================================================================
create table public.tasks (
  id             uuid primary key default gen_random_uuid(),
  gym_id         uuid not null references public.gyms (id) on delete cascade,
  client_id      uuid references public.clients (id) on delete cascade,
  title          text not null,
  description    text,
  status         public.task_status not null default 'new',
  task_date      date not null default current_date,
  reminder_at    timestamptz,                        -- review fix: was 'date'; precise-hour reminders
  blocking_entry boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index tasks_gym_status_date_idx on public.tasks (gym_id, status, task_date);
create index tasks_client_idx on public.tasks (client_id);

create table public.message_templates (
  id         uuid primary key default gen_random_uuid(),
  gym_id     uuid not null references public.gyms (id) on delete cascade,
  title      text not null,
  content    text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index message_templates_gym_id_idx on public.message_templates (gym_id);

create table public.messages (
  id          uuid primary key default gen_random_uuid(),
  gym_id      uuid not null references public.gyms (id) on delete cascade,
  client_id   uuid references public.clients (id) on delete set null,
  template_id uuid references public.message_templates (id) on delete set null,
  channel     text not null default 'sms' check (channel in ('sms', 'app')),
  content     text not null,
  segments    integer not null default 1 check (segments >= 0),
  status      text not null default 'queued' check (status in ('queued', 'sent', 'delivered', 'failed')),
  sent_at     timestamptz,
  sent_by     uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index messages_gym_created_idx on public.messages (gym_id, created_at);
create index messages_client_idx on public.messages (client_id);

create table public.activity_logs (
  id          uuid primary key default gen_random_uuid(),
  gym_id      uuid not null references public.gyms (id) on delete cascade,
  client_id   uuid references public.clients (id) on delete set null,
  actor_id    uuid references public.profiles (id) on delete set null,
  action      text not null check (action in ('create', 'update', 'delete')),
  entity_type text not null,
  entity_name text,
  created_at  timestamptz not null default now()
);
create index activity_logs_gym_created_idx on public.activity_logs (gym_id, created_at);
create index activity_logs_client_idx on public.activity_logs (client_id);

-- Configurable body-measurement fields (Settings · Measurement Types) + the
-- per-client long-format readings that drive the client Measurements tab.
create table public.measurement_types (
  id         uuid primary key default gen_random_uuid(),
  gym_id     uuid not null references public.gyms (id) on delete cascade,
  name       text not null,
  unit       text,                                   -- cm | Meter | kg | gr | % | (blank)
  notes      text,
  sort_order integer not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index measurement_types_gym_id_idx on public.measurement_types (gym_id);

create table public.client_measurements (
  id          uuid primary key default gen_random_uuid(),
  gym_id      uuid not null references public.gyms (id) on delete cascade,
  client_id   uuid not null references public.clients (id) on delete cascade,
  measured_on date not null default current_date,
  recorded_by uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index client_measurements_gym_id_idx on public.client_measurements (gym_id);
create index client_measurements_client_idx on public.client_measurements (client_id);

create table public.client_measurement_values (
  id                  uuid primary key default gen_random_uuid(),
  gym_id              uuid not null references public.gyms (id) on delete cascade,
  measurement_id      uuid not null references public.client_measurements (id) on delete cascade,
  measurement_type_id uuid not null references public.measurement_types (id) on delete cascade,
  value               numeric(10, 2) not null,
  unique (measurement_id, measurement_type_id)
);
create index client_measurement_values_gym_id_idx on public.client_measurement_values (gym_id);
create index client_measurement_values_meas_idx on public.client_measurement_values (measurement_id);
create index client_measurement_values_type_idx on public.client_measurement_values (measurement_type_id);

create table public.client_files (
  id           uuid primary key default gen_random_uuid(),
  gym_id       uuid not null references public.gyms (id) on delete cascade,
  client_id    uuid not null references public.clients (id) on delete cascade,
  file_name    text not null,
  storage_path text not null,
  mime_type    text,
  size_bytes   bigint check (size_bytes is null or size_bytes >= 0),
  uploaded_by  uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index client_files_gym_id_idx on public.client_files (gym_id);
create index client_files_client_idx on public.client_files (client_id);

-- =============================================================================
-- Workout Plans
-- =============================================================================
create table public.workout_plans (
  id             uuid primary key default gen_random_uuid(),
  gym_id         uuid not null references public.gyms (id) on delete cascade,
  trainer_id     uuid references public.trainers (id) on delete set null,
  name           text not null,
  goal           public.workout_goal not null,       -- app 'weight-loss' maps to 'weight_loss'
  level          public.workout_level not null,
  duration_weeks integer not null check (duration_weeks > 0),
  description    text,
  color          text not null default '#3b82f6',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index workout_plans_gym_id_idx on public.workout_plans (gym_id);
create index workout_plans_trainer_id_idx on public.workout_plans (trainer_id);

create table public.workout_days (
  id         uuid primary key default gen_random_uuid(),
  gym_id     uuid not null references public.gyms (id) on delete cascade,
  plan_id    uuid not null references public.workout_plans (id) on delete cascade,
  position   integer not null,
  name       text not null,
  focus      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workout_days_gym_id_idx on public.workout_days (gym_id);
create index workout_days_plan_idx on public.workout_days (plan_id);

create table public.workout_exercises (
  id         uuid primary key default gen_random_uuid(),
  gym_id     uuid not null references public.gyms (id) on delete cascade,
  day_id     uuid not null references public.workout_days (id) on delete cascade,
  position   integer not null,
  name       text not null,
  sets       integer not null default 1 check (sets > 0),
  reps       text not null,                          -- "5", "8-10", "AMRAP", "30s"
  rest_sec   integer not null default 60 check (rest_sec >= 0),
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workout_exercises_gym_id_idx on public.workout_exercises (gym_id);
create index workout_exercises_day_idx on public.workout_exercises (day_id);

create table public.workout_plan_assignments (
  gym_id      uuid not null references public.gyms (id) on delete cascade,
  plan_id     uuid not null references public.workout_plans (id) on delete cascade,
  client_id   uuid not null references public.clients (id) on delete cascade,
  assigned_by uuid references public.profiles (id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (plan_id, client_id)
);
create index workout_plan_assignments_gym_id_idx on public.workout_plan_assignments (gym_id);
create index workout_plan_assignments_client_idx on public.workout_plan_assignments (client_id);

-- =============================================================================
-- Staff shifts (Employee Presence) + SMS settings
-- =============================================================================
create table public.staff_shifts (
  id          uuid primary key default gen_random_uuid(),
  gym_id      uuid not null references public.gyms (id) on delete cascade,
  trainer_id  uuid not null references public.trainers (id) on delete cascade,
  started_at  timestamptz not null,
  ended_at    timestamptz,
  hourly_rate numeric(10, 2) not null default 0 check (hourly_rate >= 0),
  status      public.shift_status not null default 'active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);
create index staff_shifts_gym_started_idx on public.staff_shifts (gym_id, started_at);
create index staff_shifts_trainer_idx on public.staff_shifts (trainer_id);

-- One row per gym (PK = gym_id). {{1}} in a template interpolates the client name.
create table public.sms_settings (
  gym_id                  uuid primary key references public.gyms (id) on delete cascade,
  send_at                 time not null default '16:00',
  birthday_enabled        boolean not null default false,
  birthday_message        text not null default '',
  expiry_same_day_enabled boolean not null default false,
  expiry_same_day_message text not null default '',
  expiry_before_enabled   boolean not null default false,
  expiry_before_days      integer not null default 3 check (expiry_before_days >= 1),
  expiry_before_message   text not null default '',
  entrances_left_enabled  boolean not null default false,
  entrances_left_count    integer not null default 3 check (entrances_left_count >= 1),
  entrances_left_message  text not null default '',
  joining_enabled         boolean not null default false,
  joining_message         text not null default '',
  updated_at              timestamptz not null default now()
);

-- =============================================================================
-- Triggers
-- =============================================================================

-- updated_at on every mutable entity.
do $$
declare t text;
begin
  foreach t in array array[
    'gyms','profiles','trainers','clients','locations','class_kinds','classes',
    'class_time_slots','class_equipments','class_groups','subscription_plans',
    'subscriptions','billing_mandates','class_sessions','class_enrollments',
    'product_categories','products','accounting_documents','orders','campaigns',
    'leads','tasks','message_templates','measurement_types','client_measurements',
    'workout_plans','workout_days','workout_exercises','staff_shifts','sms_settings'
  ]
  loop
    execute format('create trigger %I before update on public.%I
      for each row execute function public.set_updated_at()', t || '_set_updated_at', t);
  end loop;
end;
$$;

-- Block in-tenant privilege escalation: gym_id immutable; role changes need
-- owner/admin; granting/revoking 'owner' needs an owner. Service-role bypasses.
create or replace function public.protect_profile_privileges()
returns trigger language plpgsql set search_path = public as $$
declare actor_role public.user_role;
begin
  if auth.uid() is null then return new; end if;
  if new.gym_id is distinct from old.gym_id then
    raise exception 'profiles.gym_id is immutable' using errcode = 'insufficient_privilege';
  end if;
  if new.role is distinct from old.role then
    actor_role := public.auth_role();
    if actor_role not in ('owner','admin') then
      raise exception 'only owners or admins can change staff roles' using errcode = 'insufficient_privilege';
    end if;
    if (new.role = 'owner' or old.role = 'owner') and actor_role <> 'owner' then
      raise exception 'only an owner can grant or revoke ownership' using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;
create trigger profiles_protect_privileges
  before update on public.profiles
  for each row execute function public.protect_profile_privileges();

-- Per-gym client serial. Advisory lock (full 64-bit key) serializes numbering
-- per gym so concurrent inserts cannot collide.
create or replace function public.assign_client_number()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.client_number is null then
    perform pg_advisory_xact_lock(hashtextextended('client_number:' || new.gym_id::text, 0));
    select coalesce(max(client_number), 0) + 1 into new.client_number
      from public.clients where gym_id = new.gym_id;
  end if;
  return new;
end;
$$;
create trigger clients_assign_number
  before insert on public.clients
  for each row execute function public.assign_client_number();

-- Overbooking guard: row-lock the session, re-count, fail if full.
create or replace function public.enforce_session_capacity()
returns trigger language plpgsql set search_path = public as $$
declare session_capacity integer;
begin
  if new.status not in ('booked','attended') then return new; end if;
  select capacity into session_capacity from public.class_sessions where id = new.session_id for update;
  if (select count(*) from public.class_enrollments
        where session_id = new.session_id and status in ('booked','attended')
          and id is distinct from new.id) >= session_capacity then
    raise exception 'class session % is full', new.session_id using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger class_enrollments_capacity
  before insert or update of status on public.class_enrollments
  for each row execute function public.enforce_session_capacity();

-- Date-aware subscription status (computed; PostgREST exposes it as a field).
-- Stored status holds administrative states; active subs outside their window
-- read as expired/pending. App report labels: expired→"inactive", pending→"future".
create or replace function public.effective_status(s public.subscriptions)
returns text language sql stable as $$
  select case
    when s.status = 'active' and s.end_date   < current_date then 'expired'
    when s.status = 'active' and s.start_date > current_date then 'pending'
    else s.status::text
  end;
$$;

-- =============================================================================
-- Row Level Security — tenant isolation on every table
-- =============================================================================
alter table public.gyms     enable row level security;
alter table public.profiles enable row level security;

create policy "gyms: members read own gym" on public.gyms
  for select to authenticated using (id = (select public.auth_gym_id()));
create policy "gyms: owners update own gym" on public.gyms
  for update to authenticated
  using (id = (select public.auth_gym_id()) and (select public.auth_role()) in ('owner','admin'))
  with check (id = (select public.auth_gym_id()));

create policy "profiles: read same gym" on public.profiles
  for select to authenticated using (gym_id = (select public.auth_gym_id()));
create policy "profiles: update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()) and gym_id = (select public.auth_gym_id()));
create policy "profiles: admins manage staff" on public.profiles
  for all to authenticated
  using (gym_id = (select public.auth_gym_id()) and (select public.auth_role()) in ('owner','admin'))
  with check (gym_id = (select public.auth_gym_id()));

-- Every other tenant table shares the standard four policies, generated in a loop.
do $$
declare t text;
begin
  foreach t in array array[
    'trainers','locations','clients','class_kinds','classes','class_time_slots',
    'class_equipments','class_groups','class_group_classes','subscription_plans',
    'subscriptions','billing_mandates','class_sessions','class_enrollments',
    'attendances','product_categories','products','accounting_documents','payments',
    'orders','order_items','campaigns','leads','tasks','message_templates','messages',
    'activity_logs','measurement_types','client_measurements','client_measurement_values',
    'client_files','workout_plans','workout_days','workout_exercises',
    'workout_plan_assignments','staff_shifts','sms_settings'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%1$s: select own gym" on public.%1$I
      for select to authenticated using (gym_id = (select public.auth_gym_id()))', t);
    execute format('create policy "%1$s: insert own gym" on public.%1$I
      for insert to authenticated with check (gym_id = (select public.auth_gym_id()))', t);
    execute format('create policy "%1$s: update own gym" on public.%1$I
      for update to authenticated using (gym_id = (select public.auth_gym_id()))
      with check (gym_id = (select public.auth_gym_id()))', t);
    execute format('create policy "%1$s: delete own gym" on public.%1$I
      for delete to authenticated using (gym_id = (select public.auth_gym_id()))', t);
  end loop;
end;
$$;

-- =============================================================================
-- Calendar view: one row per session with resolved name/color/trainer + live
-- enrolled count. security_invoker → runs under the caller's RLS.
-- =============================================================================
create or replace view public.calendar_sessions
with (security_invoker = true) as
select
  s.id, s.gym_id, s.session_date, s.start_time, s.end_time, s.status, s.capacity,
  s.class_id,                          -- needed by the calendar detail/edit dialog
  c.kind_id,                           -- needed by the calendar's Class-Kind filter
  coalesce(c.name, k.name)             as class_name,
  k.name                               as class_kind,
  coalesce(c.color, k.color)           as color,
  t.full_name                          as trainer_name,
  coalesce(s.trainer_id, c.trainer_id) as trainer_id,
  l.name                               as location_name,
  coalesce((select count(*) from public.class_enrollments e
            where e.session_id = s.id and e.status in ('booked','attended')), 0) as enrolled_count
from public.class_sessions s
join public.classes c     on c.id = s.class_id
join public.class_kinds k on k.id = c.kind_id
left join public.trainers t on t.id = coalesce(s.trainer_id, c.trainer_id)
left join public.locations l on l.id = c.location_id;

-- =============================================================================
-- Key documentation
-- =============================================================================
comment on table public.subscription_plans is
  'Membership plans = the Finance · Subscription Packages catalog. subscriptions.plan_id references it; period_months is the cadence/length, duration_days/entrances_limit/classes_limit are optional for fixed-day or class-credit passes.';
comment on column public.profiles.permissions is
  'Fine-grained UI feature flags: classesManagement, trainer, secretary, addUpdate, delete, memberApplication, financeReports, reports. Coarse RLS still uses profiles.role.';
comment on function public.effective_status(public.subscriptions) is
  'Date-aware subscription state. Report labels map expired→Inactive, pending→Future.';
comment on table public.billing_mandates is
  'Direct-debit mandates. Store only masked account hints — never raw PAN/IBAN.';

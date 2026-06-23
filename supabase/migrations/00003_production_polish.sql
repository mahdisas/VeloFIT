-- =============================================================================
-- 00003 — Production polish: real notes column, gapless doc numbering, and a
-- SQL-side finance report. All statements are idempotent (IF NOT EXISTS /
-- ON CONFLICT / CREATE OR REPLACE) and safe to re-run. Run in Supabase →
-- SQL Editor (or `supabase db push`).
--
-- RLS pattern mirrors 00001: gym_id = (select public.auth_gym_id()).
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Task 3 — Per-session notes on a real column (was gyms.settings->'sessionNotes')
-- (Also added by 00002; repeated here so 00003 is self-sufficient.)
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.class_sessions add column if not exists notes text;

-- One-time backfill of any notes still in the interim JSON store.
update public.class_sessions cs
   set notes = g.settings->'sessionNotes'->>cs.id::text
  from public.gyms g
 where g.id = cs.gym_id
   and cs.notes is null
   and coalesce(g.settings->'sessionNotes', '{}'::jsonb) ? cs.id::text;

-- ─────────────────────────────────────────────────────────────────────────────
-- Task 4 — Gapless, collision-free document numbering.
--
-- A dedicated per-(gym, doc_type) counter. Numbers are allocated by atomically
-- bumping the counter row inside generate_next_doc_number(); ON CONFLICT DO
-- UPDATE takes a row lock, so concurrent callers serialize and can never read
-- the same "last + 1" (the bug in the old JS implementation).
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.document_counters (
  gym_id      uuid not null references public.gyms (id) on delete cascade,
  doc_type    public.document_type not null,
  last_number bigint not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (gym_id, doc_type)
);

alter table public.document_counters enable row level security;

-- Read-only visibility for the owning gym; all writes go through the RPC below
-- (which is SECURITY DEFINER and bypasses RLS, guarded by an auth_gym_id check).
drop policy if exists document_counters_select on public.document_counters;
create policy document_counters_select on public.document_counters
  for select to authenticated
  using (gym_id = (select public.auth_gym_id()));

-- Seed each (gym, type) counter from the highest numeric doc_number already
-- issued, so the new per-type sequence continues without reusing old numbers.
insert into public.document_counters (gym_id, doc_type, last_number)
select gym_id, doc_type, max((doc_number)::bigint)
from public.accounting_documents
where doc_number ~ '^[0-9]+$'
group by gym_id, doc_type
on conflict (gym_id, doc_type)
  do update set last_number = greatest(document_counters.last_number, excluded.last_number);

-- Atomically allocate and return the next number for (gym, doc_type).
create or replace function public.generate_next_doc_number(p_gym_id uuid, p_doc_type text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next bigint;
begin
  -- Tenant guard: a caller may only draw numbers for their own gym.
  if p_gym_id is null or p_gym_id is distinct from public.auth_gym_id() then
    raise exception 'forbidden: gym mismatch' using errcode = '42501';
  end if;

  insert into public.document_counters as dc (gym_id, doc_type, last_number)
  values (p_gym_id, p_doc_type::public.document_type, 1)
  on conflict (gym_id, doc_type)
    do update set last_number = dc.last_number + 1,
                  updated_at  = now()
  returning dc.last_number into v_next;

  return v_next::text;
end;
$$;

revoke execute on function public.generate_next_doc_number(uuid, text) from public, anon;
grant  execute on function public.generate_next_doc_number(uuid, text) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Task 5 — Finance Charges aggregated in SQL (was a full-table fetch + JS reduce).
--
-- Returns one row per client carrying an outstanding balance
-- (Σ invoiced documents − Σ payments). Grouping/summing happen in Postgres, so
-- only the in-debt clients cross the wire — scales to 100k+ docs/payments.
-- SECURITY INVOKER: RLS still applies, and the explicit gym filter keeps the
-- aggregation correct and tenant-scoped.
-- ─────────────────────────────────────────────────────────────────────────────

-- Supporting indexes for the per-client grouping within a gym.
create index if not exists accounting_documents_gym_client_idx on public.accounting_documents (gym_id, client_id);
create index if not exists payments_gym_client_idx              on public.payments (gym_id, client_id);

create or replace function public.report_finance_charges()
returns table (
  client_id   uuid,
  full_name   text,
  national_id text,
  phone       text,
  gender      text,
  birth_date  date,
  balance     numeric,
  last_date   date
)
language sql
stable
security invoker
set search_path = public
as $$
  with invoiced as (
    select d.client_id,
           sum(d.total)     as invoiced,
           max(d.issued_on) as last_date
    from public.accounting_documents d
    where d.gym_id = (select public.auth_gym_id())
      and d.client_id is not null
      and d.doc_type in ('tax_invoice', 'receipt_tax_invoice', 'receipt')
    group by d.client_id
  ),
  paid as (
    select p.client_id, sum(p.amount) as paid
    from public.payments p
    where p.gym_id = (select public.auth_gym_id())
      and p.client_id is not null
    group by p.client_id
  )
  select c.id,
         c.full_name,
         c.national_id,
         c.phone,
         c.gender::text,
         c.birth_date,
         coalesce(i.invoiced, 0) - coalesce(pd.paid, 0) as balance,
         i.last_date
  from public.clients c
  left join invoiced i  on i.client_id  = c.id
  left join paid     pd on pd.client_id = c.id
  where c.gym_id = (select public.auth_gym_id())
    and c.status <> 'archived'
    and coalesce(i.invoiced, 0) - coalesce(pd.paid, 0) > 0;
$$;

revoke execute on function public.report_finance_charges() from public, anon;
grant  execute on function public.report_finance_charges() to authenticated, service_role;

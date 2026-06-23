-- =============================================================================
-- 00005 — Count "informal" documents as charges in the Finance Charges report.
--
-- balance = Σ charge documents − Σ payments. "informal" documents can carry a
-- payment (DOC_HAS_PAYMENT), so their amount must also count as a charge —
-- otherwise recording a payment on one pushes the client's balance negative
-- (a phantom credit). This mirrors getClientBalance() in lib/clients-server.ts.
-- Idempotent: CREATE OR REPLACE.
-- =============================================================================

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
      and d.doc_type in ('tax_invoice', 'receipt_tax_invoice', 'receipt', 'informal')
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

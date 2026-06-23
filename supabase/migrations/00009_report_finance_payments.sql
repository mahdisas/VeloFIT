-- =============================================================================
-- 00009 — Server-side Finance Payments report (same pattern as 00008).
--
-- One round-trip returns the filtered + sorted + paginated payment rows, the
-- total count, and the per-method card sums (cash / credit card / cheques /
-- bank transfer) — all in Postgres. The whole payments table never leaves the
-- database. SECURITY INVOKER + explicit gym filter; static-SQL whitelist sort.
-- Idempotent (CREATE OR REPLACE).
-- =============================================================================

create index if not exists payments_gym_paid_method_idx
  on public.payments (gym_id, paid_at, method);

create or replace function public.report_finance_payments(
  p_search  text   default '',
  p_methods text[] default null,   -- payment_method enum values; null = all
  p_from    date   default null,
  p_to      date   default null,
  p_sort    text   default 'date',
  p_dir     text   default 'desc',
  p_limit   int    default 10,
  p_offset  int    default 0
)
returns json
language sql
stable
security invoker
set search_path = public
as $$
  with base as (
    select p.id,
           p.client_id,
           coalesce(c.full_name, '—') as full_name,
           p.method,
           d.doc_type,
           d.doc_number,
           p.paid_at,
           p.amount
    from public.payments p
    left join public.clients c             on c.id = p.client_id
    left join public.accounting_documents d on d.id = p.document_id
    where p.gym_id = (select public.auth_gym_id())
      and (p_methods is null or p.method = any (p_methods::public.payment_method[]))
      and (p_from is null or p.paid_at::date >= p_from)
      and (p_to   is null or p.paid_at::date <= p_to)
      and (
        coalesce(p_search, '') = ''
        or c.full_name  ilike '%' || p_search || '%'
        or d.doc_number ilike '%' || p_search || '%'
      )
  ),
  ranked as (
    select base.*,
           row_number() over (
             order by
               case when p_sort = 'fullName'  and lower(p_dir) =  'asc' then full_name      end asc,
               case when p_sort = 'fullName'  and lower(p_dir) <> 'asc' then full_name      end desc,
               case when p_sort = 'docNumber' and lower(p_dir) =  'asc' then doc_number     end asc,
               case when p_sort = 'docNumber' and lower(p_dir) <> 'asc' then doc_number     end desc,
               case when p_sort = 'docType'   and lower(p_dir) =  'asc' then doc_type::text end asc,
               case when p_sort = 'docType'   and lower(p_dir) <> 'asc' then doc_type::text end desc,
               case when p_sort = 'method'    and lower(p_dir) =  'asc' then method::text   end asc,
               case when p_sort = 'method'    and lower(p_dir) <> 'asc' then method::text   end desc,
               case when p_sort = 'sum'       and lower(p_dir) =  'asc' then amount         end asc,
               case when p_sort = 'sum'       and lower(p_dir) <> 'asc' then amount         end desc,
               case when p_sort = 'date'      and lower(p_dir) =  'asc' then paid_at        end asc,
               case when p_sort = 'date'      and lower(p_dir) <> 'asc' then paid_at        end desc,
               paid_at desc, id
           ) as rn
    from base
  )
  select json_build_object(
    'total', (select count(*) from base),
    'cards', json_build_object(
      'cash',         coalesce((select sum(amount) from base where method = 'cash'), 0),
      'creditCard',   coalesce((select sum(amount) from base where method = 'credit_card'), 0),
      'cheques',      coalesce((select sum(amount) from base where method = 'cheque'), 0),
      'bankTransfer', coalesce((select sum(amount) from base where method in ('bank_transfer', 'direct_debit')), 0),
      'grandTotal',   coalesce((select sum(amount) from base), 0)
    ),
    'rows', coalesce((
      select json_agg(
        json_build_object(
          'id', id,
          'clientId', client_id,
          'fullName', full_name,
          'method', method,
          'docType', doc_type,
          'docNumber', doc_number,
          'date', to_char(paid_at, 'YYYY-MM-DD HH24:MI:SS'),
          'sum', amount
        ) order by rn
      )
      from ranked
      where rn > greatest(p_offset, 0) and rn <= greatest(p_offset, 0) + greatest(p_limit, 1)
    ), '[]'::json)
  );
$$;

revoke execute on function public.report_finance_payments(text, text[], date, date, text, text, int, int) from public, anon;
grant  execute on function public.report_finance_payments(text, text[], date, date, text, text, int, int) to authenticated, service_role;

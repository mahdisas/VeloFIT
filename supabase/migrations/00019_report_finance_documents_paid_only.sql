-- =============================================================================
-- 00019 — Finance Documents report: optional strict exclusion of unpaid docs.
--
-- A payment-bearing document is created WITH its linked payments row (see
-- insertDocument in clients/client-actions.ts), so "unpaid" = a document with
-- total > 0 and NO payments linked to it — e.g. an issued-but-never-paid tax
-- invoice, or a bid/quote.
--
-- The new p_paid_only flag lets the two consumers of this RPC diverge:
--   • Finance Document report  → p_paid_only = true : rows + summary cards
--     reflect only payment-backed documents (an accurate financial snapshot).
--     Partially-paid documents have linked payments and therefore stay.
--   • Document Creation report → p_paid_only = false (default): the full paper
--     trail of every document created, INCLUDING unpaid invoices and bids.
--
-- The EXISTS probe is served by payments_document_idx (00001). The old 8-arg
-- signature is dropped first so PostgREST never sees two overloads.
-- =============================================================================

drop function if exists public.report_finance_documents(text, text[], date, date, text, text, int, int);

create or replace function public.report_finance_documents(
  p_search    text    default '',
  p_doc_types text[]  default null,   -- enum values; null = all types
  p_from      date    default null,
  p_to        date    default null,
  p_sort      text    default 'date',
  p_dir       text    default 'desc',
  p_limit     int     default 10,
  p_offset    int     default 0,
  p_paid_only boolean default false   -- true = drop positive-total docs with no payment
)
returns json
language sql
stable
security invoker
set search_path = public
as $$
  with base as (
    select d.id,
           d.client_id,
           coalesce(c.full_name, '—')  as full_name,
           d.doc_type,
           d.doc_number,
           d.issued_on,
           d.total,
           coalesce(cr.full_name, '—') as created_by
    from public.accounting_documents d
    left join public.clients  c  on c.id  = d.client_id
    left join public.profiles cr on cr.id = d.created_by
    where d.gym_id = (select public.auth_gym_id())
      and (
        not p_paid_only
        or d.total <= 0
        or exists (select 1 from public.payments p where p.document_id = d.id)
      )
      and (p_doc_types is null or d.doc_type = any (p_doc_types::public.document_type[]))
      and (p_from is null or d.issued_on >= p_from)
      and (p_to   is null or d.issued_on <= p_to)
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
               case when p_sort = 'fullName'    and lower(p_dir) =  'asc' then full_name      end asc,
               case when p_sort = 'fullName'    and lower(p_dir) <> 'asc' then full_name      end desc,
               case when p_sort = 'docNumber'   and lower(p_dir) =  'asc' then doc_number     end asc,
               case when p_sort = 'docNumber'   and lower(p_dir) <> 'asc' then doc_number     end desc,
               case when p_sort = 'docType'     and lower(p_dir) =  'asc' then doc_type::text end asc,
               case when p_sort = 'docType'     and lower(p_dir) <> 'asc' then doc_type::text end desc,
               case when p_sort = 'initiatedBy' and lower(p_dir) =  'asc' then created_by     end asc,
               case when p_sort = 'initiatedBy' and lower(p_dir) <> 'asc' then created_by     end desc,
               case when p_sort = 'sum'         and lower(p_dir) =  'asc' then total          end asc,
               case when p_sort = 'sum'         and lower(p_dir) <> 'asc' then total          end desc,
               case when p_sort = 'date'        and lower(p_dir) =  'asc' then issued_on      end asc,
               case when p_sort = 'date'        and lower(p_dir) <> 'asc' then issued_on      end desc,
               issued_on desc, id
           ) as rn
    from base
  )
  select json_build_object(
    'total', (select count(*) from base),
    'cards', json_build_object(
      'receipts',   coalesce((select sum(total) from base where doc_type in ('receipt', 'receipt_tax_invoice')), 0),
      'withoutVat', coalesce((select sum(total) from base where doc_type in ('non_formal_transaction', 'bid', 'refund')), 0),
      'withVat',    coalesce((select sum(total) from base where doc_type in ('tax_invoice', 'receipt_tax_invoice')), 0),
      'grandTotal', coalesce((select sum(total) from base), 0)
    ),
    'rows', coalesce((
      select json_agg(
        json_build_object(
          'id', id,
          'clientId', client_id,
          'fullName', full_name,
          'docType', doc_type,
          'docNumber', doc_number,
          'date', issued_on,
          'sum', total,
          'initiatedBy', created_by
        ) order by rn
      )
      from ranked
      where rn > greatest(p_offset, 0) and rn <= greatest(p_offset, 0) + greatest(p_limit, 1)
    ), '[]'::json)
  );
$$;

revoke execute on function public.report_finance_documents(text, text[], date, date, text, text, int, int, boolean) from public, anon;
grant  execute on function public.report_finance_documents(text, text[], date, date, text, text, int, int, boolean) to authenticated, service_role;

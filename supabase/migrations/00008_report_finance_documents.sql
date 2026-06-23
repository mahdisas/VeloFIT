-- =============================================================================
-- 00008 — Server-side Finance Documents report.
--
-- One round-trip returns everything the report needs for a page: the filtered +
-- sorted + paginated rows, the total row count, AND the summary-card sums — all
-- computed in Postgres. No more fetching the whole accounting_documents table
-- into Node. Filtering/sorting/pagination push down to SQL → scales to 100k+.
--
-- SECURITY INVOKER: RLS applies; the explicit gym filter keeps it tenant-scoped.
-- Static SQL (no dynamic EXECUTE): the sort is a whitelist of CASE terms, so
-- there's no injection surface. Idempotent (CREATE OR REPLACE).
-- =============================================================================

-- Helps the filtered scan + date ordering within a gym.
create index if not exists accounting_documents_gym_issued_type_idx
  on public.accounting_documents (gym_id, issued_on, doc_type);

create or replace function public.report_finance_documents(
  p_search    text   default '',
  p_doc_types text[] default null,   -- enum values; null = all types
  p_from      date   default null,
  p_to        date   default null,
  p_sort      text   default 'date',
  p_dir       text   default 'desc',
  p_limit     int    default 10,
  p_offset    int    default 0
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

revoke execute on function public.report_finance_documents(text, text[], date, date, text, text, int, int) from public, anon;
grant  execute on function public.report_finance_documents(text, text[], date, date, text, text, int, int) to authenticated, service_role;

-- =============================================================================
-- 00010 — Server-side Orders report (same pattern as 00008/00009).
--
-- One round-trip returns the filtered/sorted/paginated orders, the total count,
-- and the grand total — all in Postgres. SECURITY INVOKER + gym filter; static
-- whitelist sort. status is compared as ::text so unknown enum labels can't
-- raise (the app maps paid→completed, canceled→cancelled). Idempotent.
-- =============================================================================

create index if not exists orders_gym_ordered_idx on public.orders (gym_id, ordered_on);

create or replace function public.report_finance_orders(
  p_search text default '',
  p_status text default 'all',   -- all | completed | pending | cancelled
  p_from   date default null,
  p_to     date default null,
  p_sort   text default 'date',
  p_dir    text default 'desc',
  p_limit  int  default 10,
  p_offset int  default 0
)
returns json
language sql
stable
security invoker
set search_path = public
as $$
  with base as (
    select o.id,
           o.order_number,
           o.status::text as status,
           o.ordered_on,
           o.total,
           o.client_id,
           coalesce(c.full_name, '—') as full_name
    from public.orders o
    left join public.clients c on c.id = o.client_id
    where o.gym_id = (select public.auth_gym_id())
      and (p_from is null or o.ordered_on >= p_from)
      and (p_to   is null or o.ordered_on <= p_to)
      and (
        p_status = 'all'
        or (p_status = 'completed' and o.status::text in ('completed', 'paid'))
        or (p_status = 'pending'   and o.status::text = 'pending')
        or (p_status = 'cancelled' and o.status::text in ('cancelled', 'canceled'))
      )
      and (
        coalesce(p_search, '') = ''
        or o.order_number ilike '%' || p_search || '%'
        or c.full_name    ilike '%' || p_search || '%'
      )
  ),
  ranked as (
    select base.*,
           row_number() over (
             order by
               case when p_sort = 'orderNumber' and lower(p_dir) =  'asc' then order_number end asc,
               case when p_sort = 'orderNumber' and lower(p_dir) <> 'asc' then order_number end desc,
               case when p_sort = 'status'      and lower(p_dir) =  'asc' then status       end asc,
               case when p_sort = 'status'      and lower(p_dir) <> 'asc' then status       end desc,
               case when p_sort = 'clientName'  and lower(p_dir) =  'asc' then full_name    end asc,
               case when p_sort = 'clientName'  and lower(p_dir) <> 'asc' then full_name    end desc,
               case when p_sort = 'price'       and lower(p_dir) =  'asc' then total        end asc,
               case when p_sort = 'price'       and lower(p_dir) <> 'asc' then total        end desc,
               case when p_sort = 'date'        and lower(p_dir) =  'asc' then ordered_on   end asc,
               case when p_sort = 'date'        and lower(p_dir) <> 'asc' then ordered_on   end desc,
               ordered_on desc, id
           ) as rn
    from base
  )
  select json_build_object(
    'total', (select count(*) from base),
    'grandTotal', coalesce((select sum(total) from base), 0),
    'rows', coalesce((
      select json_agg(
        json_build_object(
          'id', id,
          'orderNumber', order_number,
          'status', status,
          'date', ordered_on,
          'clientId', client_id,
          'clientName', full_name,
          'price', total
        ) order by rn
      )
      from ranked
      where rn > greatest(p_offset, 0) and rn <= greatest(p_offset, 0) + greatest(p_limit, 1)
    ), '[]'::json)
  );
$$;

revoke execute on function public.report_finance_orders(text, text, date, date, text, text, int, int) from public, anon;
grant  execute on function public.report_finance_orders(text, text, date, date, text, text, int, int) to authenticated, service_role;

-- =============================================================================
-- 00012 — Server-side Sold Packages / Sold Products report (one shared RPC).
--
-- p_kind = 'plan' (packages) or 'product'. Returns the filtered/sorted/paginated
-- rows + total + grand total, all in Postgres. The item filter is by item NAME
-- and the "by user" filter is the order CREATOR's name — matching the existing
-- report's semantics exactly (just pushed into SQL). SECURITY INVOKER + gym
-- filter; static whitelist sort. Idempotent.
-- =============================================================================

create or replace function public.report_sold_items(
  p_kind    text,                 -- 'plan' | 'product'
  p_search  text default '',
  p_item    text default '',      -- item name; '' = all
  p_by_user text default '',      -- order creator full_name; '' = all
  p_from    date default null,
  p_to      date default null,
  p_sort    text default 'date',
  p_dir     text default 'desc',
  p_limit   int  default 10,
  p_offset  int  default 0
)
returns json
language sql
stable
security invoker
set search_path = public
as $$
  with base as (
    select oi.id,
           coalesce(case when p_kind = 'product' then pr.name else pl.name end, oi.description) as name,
           (case when coalesce(oi.line_total, 0) <> 0 then oi.line_total else oi.unit_price end) as price,
           o.ordered_on,
           o.client_id,
           coalesce(c.full_name, '—')  as full_name,
           coalesce(cr.full_name, '—') as by_user
    from public.order_items oi
    join public.orders o                    on o.id  = oi.order_id
    left join public.products pr            on pr.id = oi.product_id
    left join public.subscription_plans pl  on pl.id = oi.plan_id
    left join public.clients c              on c.id  = o.client_id
    left join public.profiles cr            on cr.id = o.created_by
    where oi.gym_id = (select public.auth_gym_id())
      and (case when p_kind = 'product' then oi.product_id is not null else oi.plan_id is not null end)
      and (p_from is null or o.ordered_on >= p_from)
      and (p_to   is null or o.ordered_on <= p_to)
      and (coalesce(p_item, '') = ''
           or coalesce(case when p_kind = 'product' then pr.name else pl.name end, oi.description) = p_item)
      and (coalesce(p_by_user, '') = '' or coalesce(cr.full_name, '—') = p_by_user)
      and (
        coalesce(p_search, '') = ''
        or coalesce(case when p_kind = 'product' then pr.name else pl.name end, oi.description) ilike '%' || p_search || '%'
        or c.full_name  ilike '%' || p_search || '%'
        or cr.full_name ilike '%' || p_search || '%'
      )
  ),
  ranked as (
    select base.*,
           row_number() over (
             order by
               case when p_sort = 'name'     and lower(p_dir) =  'asc' then name       end asc,
               case when p_sort = 'name'     and lower(p_dir) <> 'asc' then name       end desc,
               case when p_sort = 'fullName' and lower(p_dir) =  'asc' then full_name  end asc,
               case when p_sort = 'fullName' and lower(p_dir) <> 'asc' then full_name  end desc,
               case when p_sort = 'byUser'   and lower(p_dir) =  'asc' then by_user    end asc,
               case when p_sort = 'byUser'   and lower(p_dir) <> 'asc' then by_user    end desc,
               case when p_sort = 'price'    and lower(p_dir) =  'asc' then price      end asc,
               case when p_sort = 'price'    and lower(p_dir) <> 'asc' then price      end desc,
               case when p_sort = 'date'     and lower(p_dir) =  'asc' then ordered_on end asc,
               case when p_sort = 'date'     and lower(p_dir) <> 'asc' then ordered_on end desc,
               ordered_on desc, id
           ) as rn
    from base
  )
  select json_build_object(
    'total', (select count(*) from base),
    'grandTotal', coalesce((select sum(price) from base), 0),
    'rows', coalesce((
      select json_agg(
        json_build_object(
          'id', id,
          'name', name,
          'price', price,
          'date', ordered_on,
          'clientId', client_id,
          'fullName', full_name,
          'byUser', by_user
        ) order by rn
      )
      from ranked
      where rn > greatest(p_offset, 0) and rn <= greatest(p_offset, 0) + greatest(p_limit, 1)
    ), '[]'::json)
  );
$$;

revoke execute on function public.report_sold_items(text, text, text, text, date, date, text, text, int, int) from public, anon;
grant  execute on function public.report_sold_items(text, text, text, text, date, date, text, text, int, int) to authenticated, service_role;

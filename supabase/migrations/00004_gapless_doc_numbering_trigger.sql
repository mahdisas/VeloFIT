-- =============================================================================
-- 00004 — Strictly gapless document numbering via a BEFORE INSERT trigger.
--
-- Allocation now happens INSIDE the document's own INSERT transaction: the
-- trigger bumps document_counters and stamps NEW.doc_number before the row is
-- written. If the INSERT rolls back (validation, network, RLS rejection), the
-- counter bump rolls back with it — a number is consumed only when a document
-- actually exists. This removes the gap window of the two-step app-side flow
-- (generate_next_doc_number() RPC then INSERT) from 00003.
--
-- Depends on: public.document_counters (00003).  Idempotent / safe to re-run.
-- =============================================================================

-- An omitted doc_number now means "assign me" (was defaulted to '0'); the
-- trigger fills it in. Existing rows are untouched.
alter table public.accounting_documents alter column doc_number drop default;

-- Allocate the next per-(gym, doc_type) serial in the same transaction as the
-- INSERT. SECURITY DEFINER so the write to document_counters succeeds past that
-- table's RLS (which exposes SELECT only — all writes go through this trigger).
create or replace function public.assign_doc_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next bigint;
begin
  -- Only allocate when the caller didn't supply a number (NULL / '' / legacy '0').
  if new.doc_number is null or new.doc_number = '' or new.doc_number = '0' then
    -- ON CONFLICT DO UPDATE takes a row lock on the (gym_id, doc_type) counter,
    -- so concurrent inserts serialize and can never read the same value.
    insert into public.document_counters as dc (gym_id, doc_type, last_number)
    values (new.gym_id, new.doc_type, 1)
    on conflict (gym_id, doc_type)
      do update set last_number = dc.last_number + 1,
                    updated_at  = now()
    returning dc.last_number into v_next;

    new.doc_number := v_next::text;
  end if;

  return new;
end;
$$;

drop trigger if exists accounting_documents_assign_number on public.accounting_documents;
create trigger accounting_documents_assign_number
  before insert on public.accounting_documents
  for each row
  execute function public.assign_doc_number();

-- Note: generate_next_doc_number() (00003) is now unused by the app and can be
-- dropped once you've confirmed nothing else calls it:
--   drop function if exists public.generate_next_doc_number(uuid, text);

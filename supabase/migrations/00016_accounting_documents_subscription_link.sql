-- Link an accounting document to the subscription it bills, so the new Document
-- Details view can itemise "what this is for" (plan name + period/limits) even
-- for unpaid charge invoices (which have no payment row to derive it from).
--
-- Additive and non-destructive: a nullable FK column. Existing rows are
-- backfilled from the payment ledger wherever a payment already ties a document
-- to a subscription; nothing is deleted.

alter table public.accounting_documents
  add column if not exists subscription_id uuid
  references public.subscriptions (id) on delete set null;

create index if not exists accounting_documents_subscription_idx
  on public.accounting_documents (subscription_id);

-- Backfill from payments that carry both document_id and subscription_id.
update public.accounting_documents d
set subscription_id = p.subscription_id
from (
  select distinct on (document_id) document_id, subscription_id
  from public.payments
  where document_id is not null and subscription_id is not null
  order by document_id, paid_at
) p
where p.document_id = d.id
  and d.subscription_id is null;

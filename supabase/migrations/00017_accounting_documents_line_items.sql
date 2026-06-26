-- Store the line items (Item / Qty / Unit price) typed when a document is
-- created, so Document Details can show "what the document is for". A compact,
-- descriptive JSONB array kept on the document itself — never queried on its own,
-- so it needs no separate table. Subscription-billing documents keep deriving
-- their itemisation from the linked plan; this covers standalone documents.
--
-- Additive and non-destructive: existing rows default to an empty array.
alter table public.accounting_documents
  add column if not exists line_items jsonb not null default '[]'::jsonb;

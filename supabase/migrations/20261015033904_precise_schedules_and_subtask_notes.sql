-- Support sub-task notes and precise schedule times without changing existing
-- records, ownership policies, revisions, or the save RPC.
begin;
set local lock_timeout = '5s';

alter table public.mm_tracker_documents
  drop constraint if exists mm_tracker_document_format;

alter table public.mm_tracker_documents
  add constraint mm_tracker_document_format check (coalesce((
    jsonb_typeof(document) = 'object'
    and document->>'app' = 'mm-ticket-tracker'
    and jsonb_typeof(document->'data') = 'object'
    and document->>'version' in ('1','2','3','4','5','6','7','8')
    and octet_length(document::text) <= 16777216
  ), false));

commit;

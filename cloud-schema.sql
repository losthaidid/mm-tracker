create table public.mm_tracker_documents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  document jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  mutation_id uuid not null,
  updated_at timestamptz not null default now(),
  constraint mm_tracker_document_format check (coalesce((
    jsonb_typeof(document) = 'object'
    and document->>'app' = 'mm-ticket-tracker'
    and jsonb_typeof(document->'data') = 'object'
    and document->>'version' in ('1','2','3','4')
    and octet_length(document::text) <= 16777216
  ), false))
);
alter table public.mm_tracker_documents enable row level security;
revoke all on public.mm_tracker_documents from anon, authenticated;
grant select, insert, update on public.mm_tracker_documents to authenticated;
create policy mm_tracker_read_own on public.mm_tracker_documents for select to authenticated
  using ((select auth.uid()) = user_id);
create policy mm_tracker_insert_own on public.mm_tracker_documents for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy mm_tracker_update_own on public.mm_tracker_documents for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create function public.save_mm_tracker(p_document jsonb, p_expected_revision bigint, p_mutation_id uuid)
returns table(revision bigint, updated_at timestamptz, mutation_id uuid)
language plpgsql security invoker set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  saved public.mm_tracker_documents%rowtype;
begin
  if owner_id is null then raise exception 'Sign in before saving.' using errcode = '42501'; end if;
  if p_mutation_id is null or p_expected_revision < 0 or p_expected_revision is null then
    raise exception 'Invalid save request.' using errcode = '22023';
  end if;
  select d.* into saved from public.mm_tracker_documents d where d.user_id = owner_id for update;
  if not found and p_expected_revision = 0 then
    insert into public.mm_tracker_documents(user_id, document, revision, mutation_id)
      values(owner_id, p_document, 1, p_mutation_id) on conflict (user_id) do nothing;
    select d.* into saved from public.mm_tracker_documents d where d.user_id = owner_id for update;
  end if;
  if saved.mutation_id = p_mutation_id then
    if saved.document <> p_document then raise exception 'Save identifier was reused.' using errcode = '22023'; end if;
  elsif saved.user_id is null or saved.revision <> p_expected_revision then
    raise exception 'Another device saved newer records. Reload cloud records before saving.' using errcode = 'PT409';
  else
    update public.mm_tracker_documents d set document = p_document, revision = d.revision + 1,
      mutation_id = p_mutation_id, updated_at = now()
      where d.user_id = owner_id returning d.* into saved;
  end if;
  return query select saved.revision, saved.updated_at, saved.mutation_id;
end;
$$;
revoke all on function public.save_mm_tracker(jsonb,bigint,uuid) from public, anon;
grant execute on function public.save_mm_tracker(jsonb,bigint,uuid) to authenticated;

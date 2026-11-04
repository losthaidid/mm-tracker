-- Read-only measurements. No records, credentials or per-user data leave the owning account.
create function workhub_private.storage_usage() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  member public.workhub_members%rowtype;
  result jsonb;
begin
  if actor is null then raise exception 'Sign in to view storage.' using errcode='42501'; end if;
  select * into member from public.workhub_members where user_id=actor;
  if not found or member.status <> 'active' then raise exception 'Active account required.' using errcode='42501'; end if;
  select jsonb_build_object(
    'recordBytes', octet_length((d.document->'data')::text),
    'documentBytes', octet_length(d.document::text),
    'storedDocumentBytes', pg_column_size(d.document),
    'revision', d.revision,
    'measuredAt', now()
  ) into result from public.mm_tracker_documents d where d.user_id=actor;
  result := coalesce(result, jsonb_build_object('recordBytes',0,'documentBytes',0,'storedDocumentBytes',0,'revision',0,'measuredAt',now()));
  if member.role='owner' then
    result := result || jsonb_build_object('project',jsonb_build_object('databaseBytes',pg_database_size(current_database())));
  end if;
  return result;
end;
$$;
revoke all on function workhub_private.storage_usage() from public,anon;
grant execute on function workhub_private.storage_usage() to authenticated;
create function public.workhub_storage_usage() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select workhub_private.storage_usage();
$$;
revoke all on function public.workhub_storage_usage() from public,anon;
grant execute on function public.workhub_storage_usage() to authenticated;

-- Owner-managed access. Apply with the connected Supabase migration tool.
-- Bootstrap the existing owner separately inside the same transaction; no account IDs belong in source.
create schema if not exists workhub_private;
revoke all on schema workhub_private from public,anon;
grant usage on schema workhub_private to authenticated,service_role;
create table public.workhub_feature_catalog (
 id text primary key, name text not null, parent text not null default '', paths text[] not null default '{}'
);
create table public.workhub_members (
 user_id uuid primary key references auth.users(id) on delete cascade,
 email text not null, name text not null default '',
 role text not null default 'member' check(role in ('owner','member')),
 status text not null default 'active' check(status in ('active','suspended','deleting')),
 permissions jsonb not null default '{}'::jsonb check(jsonb_typeof(permissions)='object'),
 version bigint not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.workhub_access_requests (
 id uuid primary key default gen_random_uuid(), email text not null unique,
 name text not null check(char_length(name) between 1 and 120),
 reason text not null default '' check(char_length(reason)<=1000),
 status text not null default 'pending' check(status in ('pending','approved','invited','rejected')),
 permissions jsonb not null default '{}'::jsonb,
 user_id uuid references auth.users(id) on delete set null,
 reviewed_by uuid, reviewed_at timestamptz, note text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.workhub_admin_audit (
 id uuid primary key default gen_random_uuid(), actor_id uuid, target_id uuid,
 action text not null, details jsonb not null default '{}', created_at timestamptz not null default now()
);
create index workhub_requests_created on public.workhub_access_requests(created_at desc);
create index workhub_audit_created on public.workhub_admin_audit(created_at desc);
create index workhub_requests_user on public.workhub_access_requests(user_id);
alter table public.workhub_feature_catalog enable row level security;
alter table public.workhub_members enable row level security;
alter table public.workhub_access_requests enable row level security;
alter table public.workhub_admin_audit enable row level security;
revoke all on public.workhub_feature_catalog,public.workhub_members,public.workhub_access_requests,public.workhub_admin_audit from anon,authenticated;
grant select on public.workhub_feature_catalog,public.workhub_members,public.workhub_access_requests,public.workhub_admin_audit to authenticated;
grant all on public.workhub_feature_catalog,public.workhub_members,public.workhub_access_requests,public.workhub_admin_audit to service_role;
create policy workhub_catalog_read on public.workhub_feature_catalog for select to authenticated using(true);
create function workhub_private.owner_active() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.workhub_members where user_id=auth.uid() and role='owner' and status='active');
$$;
revoke all on function workhub_private.owner_active() from public,anon;
grant execute on function workhub_private.owner_active() to authenticated,service_role;
create policy workhub_member_read on public.workhub_members for select to authenticated using(user_id=(select auth.uid()) or (select workhub_private.owner_active()));
create policy workhub_request_read on public.workhub_access_requests for select to authenticated using((select workhub_private.owner_active()));
create policy workhub_audit_read on public.workhub_admin_audit for select to authenticated using((select workhub_private.owner_active()));

create function workhub_private.allowed(p_role text,p_status text,p_permissions jsonb,p_feature text,p_action text default 'view') returns boolean
language plpgsql stable security invoker set search_path='' as $$
declare f public.workhub_feature_catalog%rowtype; entry jsonb;
begin
 if p_status<>'active' then return false; end if;
 select * into f from public.workhub_feature_catalog where id=p_feature;
 if not found then return false; end if;
 if p_role='owner' then return true; end if;
 entry:=p_permissions->p_feature;
 if entry is null or coalesce(entry->>'mode','hidden') not in ('view','use') then return false; end if;
 if f.parent<>'' and not workhub_private.allowed(p_role,p_status,p_permissions,f.parent,p_action) then return false; end if;
 return p_action='view' or (entry->>'mode'='use' and entry->p_action='true'::jsonb);
end;$$;
revoke all on function workhub_private.allowed(text,text,jsonb,text,text) from public,anon;
grant execute on function workhub_private.allowed(text,text,jsonb,text,text) to authenticated,service_role;
create function workhub_private.clean_permissions(p jsonb) returns jsonb language plpgsql stable set search_path='' as $$
declare result jsonb:='{}'; f record; v jsonb; a text; entry jsonb;
begin
 if p is null or jsonb_typeof(p)<>'object' or octet_length(p::text)>30000 then raise exception 'Choose feature permissions.' using errcode='22023'; end if;
 if exists(select 1 from jsonb_object_keys(p) k where not exists(select 1 from public.workhub_feature_catalog fc where fc.id=k)) then raise exception 'Unknown feature permission.' using errcode='22023';end if;
 for f in select id from public.workhub_feature_catalog loop
  v:=p->f.id;
  if v is null then v:='{"mode":"hidden"}';end if;
  if jsonb_typeof(v)<>'object' or coalesce(v->>'mode','') not in ('hidden','disabled','view','use') then raise exception 'Choose a valid access mode.' using errcode='22023';end if;
  if f.id='workspace' and v->>'mode' in ('hidden','disabled') then v:='{"mode":"view"}'::jsonb;end if;
  entry:=jsonb_build_object('mode',v->>'mode');
  foreach a in array array['create','edit','delete','run','export'] loop
   if v?a and jsonb_typeof(v->a)<>'boolean' then raise exception 'Permission actions must be true or false.' using errcode='22023';end if;
   entry:=entry||jsonb_build_object(a,v->>'mode'='use' and coalesce((v->>a)::boolean,false));
  end loop;
  result:=result||jsonb_build_object(f.id,entry);
 end loop;
 return result;
end;$$;
revoke all on function workhub_private.clean_permissions(jsonb) from public,anon;
grant execute on function workhub_private.clean_permissions(jsonb) to authenticated,service_role;
create function public.workhub_my_access() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('userId',user_id,'name',name,'role',role,'status',status,'version',version,'permissions',permissions) from public.workhub_members where user_id=auth.uid();
$$;
revoke all on function public.workhub_my_access() from public,anon;
grant execute on function public.workhub_my_access() to authenticated;

-- Public requests never create Auth users or disclose whether an address already exists.
create function workhub_private.request_access(p_email text,p_name text,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare email_value text:=lower(btrim(p_email));
begin
 if email_value is null or length(email_value)>254 or email_value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or coalesce(length(btrim(p_name)),0) not between 1 and 120 or coalesce(length(p_reason),0)>1000 then raise exception 'Enter your name, a valid email and a short reason.' using errcode='22023';end if;
 perform pg_advisory_xact_lock(287113,1);
 if exists(select 1 from public.workhub_access_requests where email=email_value) or exists(select 1 from auth.users where lower(email)=email_value) then return '{"received":true}'::jsonb;end if;
 if (select count(*) from public.workhub_access_requests where created_at>now()-interval '1 day')>=100 or (select count(*) from public.workhub_access_requests)>=2000 then raise exception 'Requests are temporarily busy. Please try again later.' using errcode='P0001';end if;
 insert into public.workhub_access_requests(email,name,reason) values(email_value,btrim(p_name),coalesce(btrim(p_reason),''));
 return '{"received":true}'::jsonb;
end;$$;
revoke all on function workhub_private.request_access(text,text,text) from public;
grant usage on schema workhub_private to anon;
grant execute on function workhub_private.request_access(text,text,text) to anon,authenticated;
create function public.workhub_request_access(p_email text,p_name text,p_reason text default '') returns jsonb language sql security invoker set search_path='' as $$select workhub_private.request_access(p_email,p_name,p_reason);$$;
revoke all on function public.workhub_request_access(text,text,text) from public;
grant execute on function public.workhub_request_access(text,text,text) to anon,authenticated;

-- No Auth account can be inserted until its email has an owner-approved request.
create function workhub_private.enforce_approved_signup() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.workhub_access_requests where email=lower(new.email) and status in ('approved','invited') and user_id is null) then
  raise exception 'Request access to My WorkHub and wait for owner approval.' using errcode='42501';
 end if;
 return new;
end;$$;
revoke all on function workhub_private.enforce_approved_signup() from public,anon,authenticated;
create trigger workhub_approval_before_signup before insert on auth.users for each row execute function workhub_private.enforce_approved_signup();
create function workhub_private.provision_approved_member() returns trigger language plpgsql security definer set search_path='' as $$
declare r public.workhub_access_requests%rowtype;
begin
 select * into r from public.workhub_access_requests where email=lower(new.email) and status in ('approved','invited') and user_id is null for update;
 if not found then raise exception 'Owner approval required.' using errcode='42501';end if;
 insert into public.workhub_members(user_id,email,name,permissions) values(new.id,lower(new.email),r.name,r.permissions);
 update public.workhub_access_requests set user_id=new.id,status='invited',updated_at=now() where id=r.id;
 return new;
end;$$;
revoke all on function workhub_private.provision_approved_member() from public,anon,authenticated;
create trigger workhub_member_after_signup after insert on auth.users for each row execute function workhub_private.provision_approved_member();
create function workhub_private.sync_member_email() returns trigger language plpgsql security definer set search_path='' as $$
begin update public.workhub_members set email=lower(new.email),updated_at=now() where user_id=new.id;return new;end;$$;
revoke all on function workhub_private.sync_member_email() from public,anon,authenticated;
create trigger workhub_member_email after update of email on auth.users for each row execute function workhub_private.sync_member_email();

create function workhub_private.admin_command(p_action text,p_target uuid,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); m public.workhub_members%rowtype; r public.workhub_access_requests%rowtype; perms jsonb; result jsonb; expected bigint; saved_revision bigint; doc jsonb;
begin
 perform pg_advisory_xact_lock(287113,2);
 if actor is null or not workhub_private.owner_active() then raise exception 'Owner access required.' using errcode='42501';end if;
 if p_action='list' then
  return jsonb_build_object('users',coalesce((select jsonb_agg(jsonb_build_object('id',member_row.user_id,'email',member_row.email,'name',member_row.name,'role',member_row.role,'status',member_row.status,'permissions',member_row.permissions,'version',member_row.version,'createdAt',member_row.created_at,'lastSignIn',u.last_sign_in_at) order by member_row.created_at) from public.workhub_members member_row join auth.users u on u.id=member_row.user_id),'[]'::jsonb),
   'requests',coalesce((select jsonb_agg(to_jsonb(request_row) order by request_row.created_at desc) from public.workhub_access_requests request_row),'[]'::jsonb),
   'history',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from (select * from public.workhub_admin_audit order by created_at desc limit 300) a),'[]'::jsonb));
 end if;
 if p_action in ('approve','reject','invite-ready','invite-error') then
  select * into r from public.workhub_access_requests where id=p_target for update;
  if not found then raise exception 'This request no longer exists.';end if;
  if p_action in ('approve','reject') then
   if r.user_id is not null then raise exception 'This request already has an account. Manage the account instead.';end if;
   if p_action='approve' then perms:=workhub_private.clean_permissions(p_payload->'permissions');else perms:='{}';end if;
   update public.workhub_access_requests set status=case when p_action='approve' then 'approved' else 'rejected' end,permissions=perms,reviewed_by=actor,reviewed_at=now(),note=left(coalesce(p_payload->>'note',''),500),updated_at=now() where id=r.id returning * into r;
  elsif p_action='invite-error' then
   update public.workhub_access_requests set note=left(coalesce(p_payload->>'note','Invitation could not be sent.'),500),updated_at=now() where id=r.id;
  elsif r.status not in ('approved','invited') then raise exception 'Approve this request before sending an invitation.';end if;
  insert into public.workhub_admin_audit(actor_id,target_id,action,details) values(actor,r.user_id,p_action,jsonb_build_object('requestId',r.id,'email',r.email));
  return jsonb_build_object('id',r.id,'email',r.email,'status',r.status,'userId',r.user_id);
 end if;
 select * into m from public.workhub_members where user_id=p_target for update;
 if not found then raise exception 'This account no longer exists.';end if;
 if p_action='preview-delete' then
  if m.role='owner' or m.user_id=actor then raise exception 'The Owner account is protected.' using errcode='42501';end if;
  select d.document,d.revision into doc,saved_revision from public.mm_tracker_documents d where d.user_id=m.user_id;
  return jsonb_build_object('id',m.user_id,'email',m.email,'version',m.version,'revision',coalesce(saved_revision,0),'bytes',coalesce(octet_length(doc::text),0),'counts',jsonb_build_object('tickets',jsonb_array_length(coalesce(doc#>'{data,tickets}','[]')),'tasks',jsonb_array_length(coalesce(doc#>'{data,tasks}','[]')),'projects',jsonb_array_length(coalesce(doc#>'{data,projects}','[]'))));
 end if;
 if m.role='owner' or m.user_id=actor then raise exception 'The Owner account is protected.' using errcode='42501';end if;
 expected:=(p_payload->>'version')::bigint;
 if expected is null or m.version<>expected then raise exception 'Account permissions changed. Refresh and review again.' using errcode='PT409';end if;
 if p_action='permissions' then
  perms:=workhub_private.clean_permissions(p_payload->'permissions');
  update public.workhub_members set permissions=perms,version=version+1,updated_at=now() where user_id=m.user_id;
 elsif p_action in ('suspend','activate') then
  if m.status='deleting' then raise exception 'Finish the pending deletion before changing this account.';end if;
  update public.workhub_members set status=case when p_action='suspend' then 'suspended' else 'active' end,version=version+1,updated_at=now() where user_id=m.user_id;
 elsif p_action='begin-delete' then
  if lower(coalesce(p_payload->>'email',''))<>m.email then raise exception 'Type the account email to confirm deletion.';end if;
  select revision into saved_revision from public.mm_tracker_documents where user_id=m.user_id for update;
  if coalesce(saved_revision,0)<>coalesce((p_payload->>'revision')::bigint,-1) then raise exception 'The workspace changed. Review the deletion preview again.' using errcode='PT409';end if;
  update public.workhub_members set status='deleting',version=version+1,updated_at=now() where user_id=m.user_id;
 else raise exception 'Unknown user-management action.' using errcode='22023';end if;
 insert into public.workhub_admin_audit(actor_id,target_id,action,details) values(actor,m.user_id,p_action,jsonb_build_object('email',m.email,'previousVersion',m.version));
 return jsonb_build_object('id',m.user_id,'email',m.email,'status',case when p_action='suspend' then 'suspended' when p_action='activate' then 'active' when p_action='begin-delete' then 'deleting' else m.status end,'version',m.version+1);
end;$$;
revoke all on function workhub_private.admin_command(text,uuid,jsonb) from public,anon;
grant execute on function workhub_private.admin_command(text,uuid,jsonb) to authenticated;
create function public.workhub_admin_command(p_action text,p_target uuid default null,p_payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select workhub_private.admin_command(p_action,p_target,p_payload);$$;
revoke all on function public.workhub_admin_command(text,uuid,jsonb) from public,anon;
grant execute on function public.workhub_admin_command(text,uuid,jsonb) to authenticated;

-- Recursive CRUD checks prevent a forged browser request from editing read-only records.
create function workhub_private.delta_allowed(a jsonb,b jsonb,p_create boolean,p_edit boolean,p_delete boolean) returns boolean language plpgsql immutable set search_path='' as $$
declare oldrow jsonb; newrow jsonb; k text;
begin
 if a is not distinct from b then return true;end if;
 if jsonb_typeof(a)='array' and jsonb_typeof(b)='array' and not exists(select 1 from jsonb_array_elements(a||b) v where jsonb_typeof(v)<>'object' or jsonb_typeof(v->'id') is distinct from 'string') then
  if (select count(*)<>count(distinct v->>'id') from jsonb_array_elements(a) v) or (select count(*)<>count(distinct v->>'id') from jsonb_array_elements(b) v) then return false;end if;
  for oldrow in select v from jsonb_array_elements(a) v loop
   select v into newrow from jsonb_array_elements(b) v where v->>'id'=oldrow->>'id';
   if not found then if not p_delete then return false;end if;
   elsif oldrow<>newrow and not p_edit then return false;end if;
  end loop;
  if not p_create and exists(select 1 from jsonb_array_elements(b) v where not exists(select 1 from jsonb_array_elements(a) x where x->>'id'=v->>'id')) then return false;end if;
  return true;
 end if;
 if jsonb_typeof(a)='object' and jsonb_typeof(b)='object' then
  for k in select key from jsonb_each(a||b) loop if not workhub_private.delta_allowed(a->k,b->k,p_create,p_edit,p_delete) then return false;end if;end loop;
  return true;
 end if;
 return p_edit;
end;$$;
revoke all on function workhub_private.delta_allowed(jsonb,jsonb,boolean,boolean,boolean) from public,anon;

create function workhub_private.visible_document(doc jsonb,m public.workhub_members) returns jsonb language plpgsql stable set search_path='' as $$
declare output jsonb:=doc; f record; path text; parts text[]; stubs jsonb;
begin
 if doc is null or m.role='owner' then return doc;end if;
 for f in select * from public.workhub_feature_catalog loop
  if workhub_private.allowed(m.role,m.status,m.permissions,f.id,'view') then continue;end if;
  foreach path in array f.paths loop
   parts:=string_to_array('data.'||path,'.');
   output:=output#-parts;
  end loop;
  if f.id='validator' then output:=output#-'{data,workhub,validator}';end if;
 end loop;
 -- Cross-section history and record metadata must not reveal a blocked source section.
 for path in select unnest(array['workhub.workLibrary.events','workhub.batchA.records','workhub.reminders']) loop
  parts:=string_to_array('data.'||path,'.');
  if jsonb_typeof(output#>parts)='array' then
   select coalesce(jsonb_agg(v),'[]') into stubs from jsonb_array_elements(output#>parts) v
    where workhub_private.allowed(m.role,m.status,m.permissions,case v->>'kind' when 'projects' then 'specs' when 'notes' then 'knowledge' else v->>'kind' end,'view');
   output:=jsonb_set(output,parts,stubs,true);
  end if;
 end loop;
 -- Structural placeholders keep links in permitted screens valid without exposing blocked content.
 if not workhub_private.allowed(m.role,m.status,m.permissions,'specs','view') then
  select coalesce(jsonb_agg(jsonb_build_object('id',p->>'id','name','Unavailable project '||i,'code','')),'[]') into stubs from jsonb_array_elements(coalesce(doc#>'{data,projects}','[]')) with ordinality as x(p,i);
  output:=jsonb_set(output,'{data,projects}',stubs,true);
  output:=jsonb_set(output,'{data,activeProjectId}',coalesce(doc#>'{data,activeProjectId}','"project-default"'),true);
  select coalesce(jsonb_agg(jsonb_build_object('id',p->>'id','projectId',p->>'projectId','name','Unavailable company '||i,'role','','active',false)),'[]') into stubs from jsonb_array_elements(coalesce(doc#>'{data,projectCompanies}','[]')) with ordinality as x(p,i);
  output:=jsonb_set(output,'{data,projectCompanies}',stubs,true);
 end if;
 if not workhub_private.allowed(m.role,m.status,m.permissions,'tickets','view') then
  select coalesce(jsonb_agg(jsonb_build_object('id',p->>'id','ticket','Unavailable '||i,'description','Unavailable ticket','jira','','created','','priority','Low','pic','','status','Pending','object','Internal','action','','transport','','type','','mandays',null,'history','','historyDate','','historyTime','')),'[]') into stubs from jsonb_array_elements(coalesce(doc#>'{data,tickets}','[]')) with ordinality as x(p,i);
  output:=jsonb_set(output,'{data,tickets}',stubs,true);
 end if;
 if not workhub_private.allowed(m.role,m.status,m.permissions,'tasks','view') then
  select coalesce(jsonb_agg(jsonb_build_object('id',p->>'id','number','','task','Unavailable task '||i,'done',false,'doneDate','','remarks','','feedback','','taskType','Custom','linkId','','customLink','')),'[]') into stubs from jsonb_array_elements(coalesce(doc#>'{data,tasks}','[]')) with ordinality as x(p,i);
  output:=jsonb_set(output,'{data,tasks}',stubs,true);
 end if;
 -- Base arrays are required by old and current backup readers.
 foreach path in array array['tickets','trackers','tasks','specs','schedule'] loop
  if output#>array['data',path] is null then output:=jsonb_set(output,array['data',path],'[]',true);end if;
 end loop;
 return output;
end;$$;
revoke all on function workhub_private.visible_document(jsonb,public.workhub_members) from public,anon,authenticated;

create function workhub_private.load_document() returns table(document jsonb,revision bigint,mutation_id uuid,updated_at timestamptz) language plpgsql security definer set search_path='' as $$
declare m public.workhub_members%rowtype;
begin
 select * into m from public.workhub_members where user_id=auth.uid();
 if not found or m.status<>'active' then raise exception 'Your account does not have active access.' using errcode='42501';end if;
 return query select workhub_private.visible_document(d.document,m),d.revision,d.mutation_id,d.updated_at from public.mm_tracker_documents d where d.user_id=m.user_id;
end;$$;
revoke all on function workhub_private.load_document() from public,anon;
grant execute on function workhub_private.load_document() to authenticated;
create function public.load_mm_tracker() returns table(document jsonb,revision bigint,mutation_id uuid,updated_at timestamptz) language sql security invoker set search_path='' as $$select * from workhub_private.load_document();$$;
revoke all on function public.load_mm_tracker() from public,anon;
grant execute on function public.load_mm_tracker() to authenticated;

-- Direct whole-document access remains owner-only. Members use the checked, projected RPC.
drop policy mm_tracker_read_own on public.mm_tracker_documents;
drop policy mm_tracker_insert_own on public.mm_tracker_documents;
drop policy mm_tracker_update_own on public.mm_tracker_documents;
create policy mm_tracker_read_own on public.mm_tracker_documents for select to authenticated using(user_id=(select auth.uid()) and (select workhub_private.owner_active()));
create policy mm_tracker_insert_own on public.mm_tracker_documents for insert to authenticated with check(user_id=(select auth.uid()) and (select workhub_private.owner_active()));
create policy mm_tracker_update_own on public.mm_tracker_documents for update to authenticated using(user_id=(select auth.uid()) and (select workhub_private.owner_active())) with check(user_id=(select auth.uid()) and (select workhub_private.owner_active()));

create function workhub_private.save_document(p_document jsonb,p_expected_revision bigint,p_mutation_id uuid) returns table(revision bigint,updated_at timestamptz,mutation_id uuid) language plpgsql security definer set search_path='' as $$
declare m public.workhub_members%rowtype; saved public.mm_tracker_documents%rowtype; merged jsonb; f record; path text; parts text[]; old_value jsonb; new_value jsonb; old_data jsonb; history jsonb; retained jsonb; removed integer;
begin
 select * into m from public.workhub_members where user_id=auth.uid() for share;
 if not found or m.status<>'active' then raise exception 'Your account does not have active access.' using errcode='42501';end if;
 if p_mutation_id is null or p_expected_revision is null or p_expected_revision<0 then raise exception 'Invalid save request.' using errcode='22023';end if;
 if p_document->>'app' is distinct from 'mm-ticket-tracker' or jsonb_typeof(p_document->'data') is distinct from 'object' or octet_length(p_document::text)>16777216 then raise exception 'Invalid workspace document.' using errcode='22023';end if;
 select * into saved from public.mm_tracker_documents where user_id=m.user_id for update;
 if saved.user_id is null and p_expected_revision<>0 then raise exception 'Reload cloud records before saving.' using errcode='PT409';end if;
 merged:=p_document;
 if m.role<>'owner' then
  old_data:=coalesce(saved.document->'data',jsonb_build_object('tickets','[]'::jsonb,'trackers','[]'::jsonb,'tasks','[]'::jsonb,'specs','[]'::jsonb,'schedule','[]'::jsonb,'projects',jsonb_build_array(jsonb_build_object('id','project-default','name','SAP Projects','code','')),'activeProjectId','project-default','lists','{}'::jsonb,'calendarMonth',to_char(now(),'YYYY-MM'),'source','','preferences','{}'::jsonb,'workhub','{}'::jsonb));
  merged:=p_document||jsonb_build_object('data',old_data);
  if merged#>'{data,workhub}' is null then merged:=jsonb_set(merged,'{data,workhub}','{}',true);end if;
  for f in select * from public.workhub_feature_catalog loop
   foreach path in array f.paths loop
    parts:=string_to_array('data.'||path,'.'); old_value:=saved.document#>parts;new_value:=p_document#>parts;
    if not workhub_private.allowed(m.role,m.status,m.permissions,f.id,'view') then continue;end if;
    if path='workhub.workLibrary' and old_value is not null and jsonb_typeof(new_value)='object' then
     -- Timeline history is append-only, including entries filtered out of this member's view.
     new_value:=jsonb_set(new_value,'{events}',coalesce(old_value->'events','[]')||coalesce((select jsonb_agg(v) from jsonb_array_elements(coalesce(new_value->'events','[]')) v where not exists(select 1 from jsonb_array_elements(coalesce(old_value->'events','[]')) old_event where old_event->>'id'=v->>'id')),'[]'),true);
     history:=new_value->'events';
     select coalesce(jsonb_agg(v order by n),'[]') into retained from (
      select v,n,count(*) over(order by n desc) as record_count,sum(octet_length(v::text)+2) over(order by n desc) as total_bytes
      from jsonb_array_elements(history) with ordinality as entry(v,n)
     ) bounded where record_count<=12000 and total_bytes<=2097150;
     removed:=jsonb_array_length(history)-jsonb_array_length(retained);
     new_value:=jsonb_set(jsonb_set(new_value,'{events}',retained,true),'{eventsDropped}',to_jsonb(coalesce((old_value->>'eventsDropped')::bigint,0)+removed),true);
    end if;
    if path='workhub.batchA' and old_value is not null and jsonb_typeof(new_value)='object' then
     new_value:=jsonb_set(new_value,'{records}',coalesce((select jsonb_agg(v) from jsonb_array_elements(coalesce(old_value->'records','[]')) v where not workhub_private.allowed(m.role,m.status,m.permissions,case v->>'kind' when 'projects' then 'specs' when 'notes' then 'knowledge' else v->>'kind' end,'view')),'[]')||coalesce((select jsonb_agg(v) from jsonb_array_elements(coalesce(new_value->'records','[]')) v where workhub_private.allowed(m.role,m.status,m.permissions,case v->>'kind' when 'projects' then 'specs' when 'notes' then 'knowledge' else v->>'kind' end,'view')),'[]'),true);
    elsif path='workhub.reminders' and old_value is not null and jsonb_typeof(new_value)='array' then
     new_value:=coalesce((select jsonb_agg(v) from jsonb_array_elements(old_value) v where not workhub_private.allowed(m.role,m.status,m.permissions,v->>'kind','view')),'[]')||coalesce((select jsonb_agg(v) from jsonb_array_elements(new_value) v where workhub_private.allowed(m.role,m.status,m.permissions,v->>'kind','view')),'[]');
    end if;
    if old_value is null and jsonb_typeof(new_value)='array' and workhub_private.allowed(m.role,m.status,m.permissions,f.id,'create') then old_value:='[]';end if;
    if old_value is null and path='workhub.validator.runs' and workhub_private.allowed(m.role,m.status,m.permissions,f.id,'run') then old_value:='[]';end if;
    if old_value is null and not workhub_private.allowed(m.role,m.status,m.permissions,f.id,'edit') then continue;end if;
    if not workhub_private.delta_allowed(old_value,new_value,(workhub_private.allowed(m.role,m.status,m.permissions,f.id,'create') or (path='workhub.validator.runs' and workhub_private.allowed(m.role,m.status,m.permissions,f.id,'run'))),(workhub_private.allowed(m.role,m.status,m.permissions,f.id,'edit') or (path='workhub.validator.runs' and workhub_private.allowed(m.role,m.status,m.permissions,f.id,'run'))),(workhub_private.allowed(m.role,m.status,m.permissions,f.id,'delete') or (path='workhub.validator.runs' and workhub_private.allowed(m.role,m.status,m.permissions,f.id,'run')))) then raise exception 'Your permissions do not allow this change in %.',f.name using errcode='42501';end if;
    if new_value is not null then merged:=workhub_private.put_path(merged,parts,new_value);end if;
   end loop;
  end loop;
 end if;
 if saved.mutation_id=p_mutation_id then
  if saved.document<>merged then raise exception 'Save identifier was reused.' using errcode='22023';end if;
 elsif saved.user_id is null then
  insert into public.mm_tracker_documents(user_id,document,revision,mutation_id) values(m.user_id,merged,1,p_mutation_id) returning * into saved;
 elsif saved.revision<>p_expected_revision then raise exception 'Another device saved newer records. Reload cloud records before saving.' using errcode='PT409';
 else update public.mm_tracker_documents d set document=merged,revision=d.revision+1,mutation_id=p_mutation_id,updated_at=now() where d.user_id=m.user_id returning * into saved;
 end if;
 return query select saved.revision,saved.updated_at,saved.mutation_id;
end;$$;
revoke all on function workhub_private.save_document(jsonb,bigint,uuid) from public,anon;
grant execute on function workhub_private.save_document(jsonb,bigint,uuid) to authenticated;
create or replace function public.save_mm_tracker(p_document jsonb,p_expected_revision bigint,p_mutation_id uuid) returns table(revision bigint,updated_at timestamptz,mutation_id uuid) language sql security invoker set search_path='' as $$select * from workhub_private.save_document(p_document,p_expected_revision,p_mutation_id);$$;
revoke all on function public.save_mm_tracker(jsonb,bigint,uuid) from public,anon;
grant execute on function public.save_mm_tracker(jsonb,bigint,uuid) to authenticated;

create function workhub_private.my_access() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('userId',m.user_id,'name',m.name,'role',m.role,'status',m.status,'version',m.version,'permissions',m.permissions,'needsPassword',coalesce(u.encrypted_password,'')='')
 from public.workhub_members m join auth.users u on u.id=m.user_id where m.user_id=auth.uid();
$$;
revoke all on function workhub_private.my_access() from public,anon;
grant execute on function workhub_private.my_access() to authenticated;
create or replace function public.workhub_my_access() returns jsonb language sql stable security invoker set search_path='' as $$select workhub_private.my_access();$$;
create function workhub_private.before_account_delete() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.workhub_members where user_id=old.id and role='owner') then raise exception 'The Owner account is protected.' using errcode='42501';end if;
 update public.workhub_access_requests set status='rejected',permissions='{}',note='Account deleted. A new owner approval is required.',updated_at=now() where user_id=old.id or email=lower(old.email);
 insert into public.workhub_admin_audit(actor_id,target_id,action,details) values(auth.uid(),old.id,'account-deleted',jsonb_build_object('email',old.email));
 return old;
end;$$;
revoke all on function workhub_private.before_account_delete() from public,anon,authenticated;
create trigger workhub_before_account_delete before delete on auth.users for each row execute function workhub_private.before_account_delete();
create function workhub_private.document_revision() returns table(revision bigint,mutation_id uuid,updated_at timestamptz) language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.workhub_members where user_id=auth.uid() and status='active') then raise exception 'Your account does not have active access.' using errcode='42501';end if;
 return query select d.revision,d.mutation_id,d.updated_at from public.mm_tracker_documents d where d.user_id=auth.uid();
end;$$;
revoke all on function workhub_private.document_revision() from public,anon;
grant execute on function workhub_private.document_revision() to authenticated;
create function public.load_mm_tracker_revision() returns table(revision bigint,mutation_id uuid,updated_at timestamptz) language sql security invoker set search_path='' as $$select * from workhub_private.document_revision();$$;
revoke all on function public.load_mm_tracker_revision() from public,anon;
grant execute on function public.load_mm_tracker_revision() to authenticated;

create function workhub_private.put_path(doc jsonb,parts text[],value jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare i integer; prefix text[];begin
 for i in 1..array_length(parts,1)-1 loop prefix:=parts[1:i];if doc#>prefix is null then doc:=jsonb_set(doc,prefix,'{}',true);end if;end loop;
 return jsonb_set(doc,parts,value,true);end;$$;
revoke all on function workhub_private.put_path(jsonb,text[],jsonb) from public,anon,authenticated;


-- Generated from access-catalog.js; keep the registry and server paths in sync.
insert into public.workhub_feature_catalog(id,name,parent,paths) values
('home','My day','',array['workhub.myDay','workhub.widgets']::text[]),
('tickets','Tickets','',array['tickets','trackers','workhub.ticketClosures']::text[]),
('tasks','Tasks','',array['tasks']::text[]),
('schedule','Schedule','',array['schedule','projectPlans','workhub.daySchedule','workhub.publicHolidays','workhub.leaveBalances','workhub.leaveTypes','workhub.claims']::text[]),
('specs','Projects','',array['projects','activeProjectId','specs','projectCompanies','projectDecisions','projectProcessMappings','phaseGates','projectFeedback']::text[]),
('knowledge','Knowledge','',array['workhub.notes']::text[]),
('notes','Notes','',array['workhub.notebook']::text[]),
('processhub','Process Hub','',array['workhub.processes','workhub.rehearsal']::text[]),
('waiting','Waiting on','',array['workhub.waiting']::text[]),
('studio','Studio','',array[]::text[]),
('lab','Troubleshooting lab','',array['workhub.lab']::text[]),
('validator','Validation Studio','',array['workhub.validator.templates','workhub.validator.runs']::text[]),
('snippets','Snippets','',array['workhub.workLibrary']::text[]),
('studio.theme','Theme studio','studio',array[]::text[]),
('studio.reader','JSON & IDoc Reader','studio',array[]::text[]),
('studio.tcodes','SAP T-codes','studio',array['workhub.tcodes']::text[]),
('studio.focus','Focus room','studio',array[]::text[]),
('studio.journey','Project journey','studio',array[]::text[]),
('studio.scrapbook','Scrapbook','studio',array['workhub.scrapbook']::text[]),
('studio.wrap','Daily wrap-up','studio',array[]::text[]),
('studio.sessions','Work sessions','studio',array['workhub.sessions']::text[]),
('studio.screenshots','Screenshot tools','studio',array[]::text[]),
('projects.solution','Solution Studio','specs',array['workhub.solutionStudio','workhub.simulator']::text[]),
('projects.people','Project people','specs',array['workhub.projectPeople','workhub.recipients']::text[]),
('projects.standup','Project briefings','specs',array['workhub.projectStandup']::text[]),
('focus','Focus mode','',array[]::text[]),
('break','Break Terrarium','',array[]::text[]),
('presentation-break','Presentation break','',array[]::text[]),
('workspace','Personal settings & work setup','',array['lists','calendarMonth','source','preferences','workhub.preferences','workhub.headerSubtitle','workhub.reminders','workhub.batchA']::text[]);


-- Initial deployment only. Run after user-management.sql and access-catalog.sql
-- in the same transaction. Stop if the verified single-account assumption changes.
do $$
declare existing_user auth.users%rowtype; full_access jsonb;
begin
 lock table auth.users in share row exclusive mode;
 if (select count(*) from auth.users)<>1 then
  raise exception 'Owner bootstrap requires exactly one existing account. Review the account inventory first.';
 end if;
 select * into existing_user from auth.users;
 if existing_user.email_confirmed_at is null or existing_user.email is null then
  raise exception 'The existing Owner account must have a confirmed email.';
 end if;
 select jsonb_object_agg(id,jsonb_build_object('mode','use','create',true,'edit',true,'delete',true,'run',true,'export',true)) into full_access from public.workhub_feature_catalog;
 insert into public.workhub_members(user_id,email,name,role,permissions)
 values(existing_user.id,lower(existing_user.email),'Owner','owner',full_access);
 insert into public.workhub_admin_audit(actor_id,target_id,action)
 values(existing_user.id,existing_user.id,'owner-initialized');
end;$$;

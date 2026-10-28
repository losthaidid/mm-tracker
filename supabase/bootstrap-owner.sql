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

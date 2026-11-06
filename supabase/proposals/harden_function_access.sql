-- PROPOSAL ONLY. Do not run against a hosted project without owner approval.
-- The Supabase CLI is unavailable here; after approval, use
-- supabase migration new harden_function_access and copy this SQL into that file.
-- Tested after the original migration in an isolated embedded PostgreSQL database.
begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
-- Keep private OUT of the project's exposed Data API schemas.
alter function public.current_company_id() set schema private;
alter function public.has_company_role(public.company_role[]) set schema private;
alter function public.register_company(text) set schema private;
alter function public.add_company_member(text,public.company_role) set schema private;
alter function public.change_member_role(uuid,public.company_role) set schema private;
alter function public.log_record() set schema private;
alter function public.prepare_record() set schema private;
alter function public.schedule_next_maintenance() set schema private;
create or replace function private.add_company_member(member_email text, member_role public.company_role) returns void language plpgsql security definer set search_path = '' as $$
declare cid uuid := private.current_company_id(); target_id uuid; target_email text; begin
 perform 1 from public.companies where id=cid for update;
 if not private.has_company_role(array['company_admin']::public.company_role[]) then raise exception 'Company Admin required'; end if;
 select id,email into target_id,target_email from auth.users where lower(email)=lower(trim(member_email)) and email_confirmed_at is not null;
 if target_id is null then raise exception 'No available verified account. Ask the user to register and confirm their email first.'; end if;
 if exists(select 1 from public.memberships where user_id=target_id) then raise exception 'Account already belongs to a company'; end if;
 insert into public.memberships(user_id,company_id,role,email) values(target_id,cid,member_role,target_email);
end;
$$;
create or replace function private.change_member_role(member_id uuid, member_role public.company_role) returns void language plpgsql security definer set search_path = '' as $$
declare cid uuid := private.current_company_id(); previous public.company_role; begin
 perform 1 from public.companies where id=cid for update;
 if not private.has_company_role(array['company_admin']::public.company_role[]) then raise exception 'Company Admin required'; end if;
 select role into previous from public.memberships where user_id=member_id and company_id=cid for update;
 if previous is null then raise exception 'Member not found'; end if;
 if previous='company_admin' and member_role<>'company_admin' and (select count(*) from public.memberships where company_id=cid and role='company_admin')<=1 then raise exception 'The company must retain at least one admin'; end if;
 update public.memberships set role=member_role where user_id=member_id and company_id=cid;
end;
$$;

-- Existing policies and triggers follow function OIDs when SET SCHEMA moves them.
-- Expose only three invoker wrappers. All authorization remains in private code.
create function public.register_company(company_name text) returns uuid
language sql security invoker set search_path = ''
as $$ select private.register_company(company_name); $$;
create function public.add_company_member(member_email text, member_role public.company_role) returns void
language sql security invoker set search_path = ''
as $$ select private.add_company_member(member_email, member_role); $$;
create function public.change_member_role(member_id uuid, member_role public.company_role) returns void
language sql security invoker set search_path = ''
as $$ select private.change_member_role(member_id, member_role); $$;
revoke all on function private.current_company_id() from public, anon, authenticated;
revoke all on function private.has_company_role(public.company_role[]) from public, anon, authenticated;
revoke all on function private.register_company(text) from public, anon, authenticated;
revoke all on function private.add_company_member(text,public.company_role) from public, anon, authenticated;
revoke all on function private.change_member_role(uuid,public.company_role) from public, anon, authenticated;
revoke all on function private.log_record() from public, anon, authenticated;
revoke all on function private.prepare_record() from public, anon, authenticated;
revoke all on function private.schedule_next_maintenance() from public, anon, authenticated;
grant execute on function private.current_company_id() to authenticated;
grant execute on function private.has_company_role(public.company_role[]) to authenticated;
grant execute on function private.register_company(text) to authenticated;
grant execute on function private.add_company_member(text,public.company_role) to authenticated;
grant execute on function private.change_member_role(uuid,public.company_role) to authenticated;
revoke all on function public.register_company(text) from public, anon;
grant execute on function public.register_company(text) to authenticated;
revoke all on function public.add_company_member(text,public.company_role) from public, anon;
grant execute on function public.add_company_member(text,public.company_role) to authenticated;
revoke all on function public.change_member_role(uuid,public.company_role) from public, anon;
grant execute on function public.change_member_role(uuid,public.company_role) to authenticated;
commit;


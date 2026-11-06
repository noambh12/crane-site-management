-- Apply once to a fresh Supabase project. No service-role key is used by the app.
begin;
create type public.company_role as enum ('company_admin','fleet_manager','site_manager','technician','viewer');
create table public.companies (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 160), created_at timestamptz not null default now()
);
create table public.memberships (
 user_id uuid primary key references auth.users(id) on delete cascade,
 company_id uuid not null references public.companies(id),
 role public.company_role not null default 'viewer', email text not null,
 created_at timestamptz not null default now()
);
create index memberships_company_idx on public.memberships(company_id);
-- One company per user in this MVP. Never derive authorization from user-editable metadata.
create function public.current_company_id() returns uuid language sql stable security definer set search_path = '' as $$
 select company_id from public.memberships where user_id = (select auth.uid());
$$;
create function public.has_company_role(allowed public.company_role[]) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.memberships where user_id = (select auth.uid()) and role = any(allowed));
$$;
create table public.sites (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
 name text not null check(length(trim(name)) between 1 and 160), address text not null check(length(trim(address)) between 1 and 160),
 status text not null default 'active' check(status in ('planning','active','completed')),
 contact_name text not null default '' check(length(contact_name)<=2000), contact_phone text not null default '' check(length(contact_phone)<=80),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(company_id,id)
);
create table public.cranes (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
 name text not null check(length(trim(name)) between 1 and 160), serial_number text not null check(length(trim(serial_number)) between 1 and 160),
 manufacturer text not null check(length(trim(manufacturer)) between 1 and 160), model text not null check(length(trim(model)) between 1 and 160),
 capacity_t numeric(8,2) not null check(capacity_t>0 and capacity_t<=10000),
 status text not null default 'available' check(status in ('available','operating','maintenance','out_of_service')),
 site_id uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(company_id,id), unique(company_id,serial_number),
 foreign key(company_id,site_id) references public.sites(company_id,id)
);
create table public.faults (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id), crane_id uuid not null,
 title text not null check(length(trim(title)) between 1 and 160), description text not null default '' check(length(description)<=2000),
 priority text not null default 'medium' check(priority in ('low','medium','high','critical')),
 status text not null default 'open' check(status in ('open','in_progress','resolved')),
 resolution text not null default '' check(length(resolution)<=2000),
 created_by uuid not null default auth.uid() references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(status <> 'resolved' or length(trim(resolution))>0),
 foreign key(company_id,crane_id) references public.cranes(company_id,id)
);
create table public.maintenance (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id), crane_id uuid not null,
 title text not null check(length(trim(title)) between 1 and 160), kind text not null check(kind in ('service','inspection')),
 due_date date not null, interval_days integer not null default 0 check(interval_days between 0 and 3650),
 status text not null default 'scheduled' check(status in ('scheduled','in_progress','completed')),
 notes text not null default '' check(length(notes)<=2000), completed_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(company_id,crane_id) references public.cranes(company_id,id)
);
create table public.activity_log (
 id bigint generated always as identity primary key, company_id uuid not null references public.companies(id),
 actor_id uuid references auth.users(id) on delete set null, entity text not null, entity_id uuid not null, action text not null,
 details jsonb not null, created_at timestamptz not null default now()
);
create index sites_company_idx on public.sites(company_id);
create index cranes_company_site_idx on public.cranes(company_id,site_id);
create index faults_company_status_idx on public.faults(company_id,status);
create index maintenance_company_due_idx on public.maintenance(company_id,due_date);
create index activity_company_created_idx on public.activity_log(company_id,created_at desc);

create function public.prepare_record() returns trigger language plpgsql set search_path = '' as $$
begin
 if tg_op='UPDATE' then
  if new.company_id <> old.company_id or new.id <> old.id then raise exception 'Record ownership is immutable'; end if;
  new.created_at := old.created_at;
 end if;
 new.updated_at := now();
 if tg_table_name='faults' then
  if tg_op='INSERT' then new.created_by := auth.uid(); else new.created_by := old.created_by; end if;
 end if;
 if tg_table_name='maintenance' then
  if tg_op='UPDATE' then
   if old.status='completed' then raise exception 'Completed maintenance is immutable; schedule a new record'; end if;
  end if;
  if new.status='completed' then new.completed_at := now(); else new.completed_at := null; end if;
 end if;
 return new;
end;
$$;
create function public.log_record() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.activity_log(company_id,actor_id,entity,entity_id,action,details)
 values(new.company_id,auth.uid(),tg_table_name,new.id,lower(tg_op),jsonb_build_object('status',new.status));
 return new;
end;
$$;
-- Recurrence is atomic with completion and cannot run twice: completed records are immutable.
create function public.schedule_next_maintenance() returns trigger language plpgsql set search_path = '' as $$
begin
 if new.status='completed' and new.interval_days>0 then
  insert into public.maintenance(company_id,crane_id,title,kind,due_date,interval_days,notes)
  values(new.company_id,new.crane_id,new.title,new.kind,greatest(new.due_date,current_date)+new.interval_days,new.interval_days,'Automatically scheduled after completion');
 end if;
 return new;
end;
$$;
do $$ declare t text; begin
 foreach t in array array['sites','cranes','faults','maintenance'] loop
  execute format('create trigger prepare_record before insert or update on public.%I for each row execute function public.prepare_record()',t);
  execute format('create trigger log_record after insert or update on public.%I for each row execute function public.log_record()',t);
 end loop;
end $$;
create trigger recurring_maintenance after insert or update on public.maintenance for each row execute function public.schedule_next_maintenance();

create function public.register_company(company_name text) returns uuid language plpgsql security definer set search_path = '' as $$
declare new_id uuid; begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 -- Lock the user so concurrent onboarding requests cannot leave orphan companies.
 perform 1 from auth.users where id=auth.uid() and email_confirmed_at is not null for update;
 if not found then raise exception 'Confirm your email before creating a company'; end if;
 if exists(select 1 from public.memberships where user_id=auth.uid()) then raise exception 'You already belong to a company'; end if;
 insert into public.companies(name) values(trim(company_name)) returning id into new_id;
 insert into public.memberships(user_id,company_id,role,email)
 select id,new_id,'company_admin',email from auth.users where id=auth.uid();
 return new_id;
end;
$$;
-- Company admin adds an already registered, verified user by email. No password/key sharing.
create function public.add_company_member(member_email text, member_role public.company_role) returns void language plpgsql security definer set search_path = '' as $$
declare cid uuid := public.current_company_id(); target_id uuid; target_email text; begin
 perform 1 from public.companies where id=cid for update;
 if not public.has_company_role(array['company_admin']::public.company_role[]) then raise exception 'Company Admin required'; end if;
 select id,email into target_id,target_email from auth.users where lower(email)=lower(trim(member_email)) and email_confirmed_at is not null;
 if target_id is null then raise exception 'No available verified account. Ask the user to register and confirm their email first.'; end if;
 if exists(select 1 from public.memberships where user_id=target_id) then raise exception 'Account already belongs to a company'; end if;
 insert into public.memberships(user_id,company_id,role,email) values(target_id,cid,member_role,target_email);
end;
$$;
create function public.change_member_role(member_id uuid, member_role public.company_role) returns void language plpgsql security definer set search_path = '' as $$
declare cid uuid := public.current_company_id(); previous public.company_role; begin
 perform 1 from public.companies where id=cid for update;
 if not public.has_company_role(array['company_admin']::public.company_role[]) then raise exception 'Company Admin required'; end if;
 select role into previous from public.memberships where user_id=member_id and company_id=cid for update;
 if previous is null then raise exception 'Member not found'; end if;
 if previous='company_admin' and member_role<>'company_admin' and (select count(*) from public.memberships where company_id=cid and role='company_admin')<=1 then raise exception 'The company must retain at least one admin'; end if;
 update public.memberships set role=member_role where user_id=member_id and company_id=cid;
end;
$$;
alter table public.companies enable row level security;
alter table public.memberships enable row level security;
alter table public.sites enable row level security;
alter table public.cranes enable row level security;
alter table public.faults enable row level security;
alter table public.maintenance enable row level security;
alter table public.activity_log enable row level security;
create policy company_read on public.companies for select to authenticated using(id=public.current_company_id());
create policy members_read on public.memberships for select to authenticated using(company_id=public.current_company_id());
create policy activity_read on public.activity_log for select to authenticated using(company_id=public.current_company_id());
-- All roles read within their company; only authorized roles may write. No client deletes.
do $$ declare t text; allowed text; begin
 foreach t in array array['sites','cranes','faults','maintenance'] loop
  allowed := case when t='cranes' then '''company_admin'',''fleet_manager''' when t='sites' then '''company_admin'',''fleet_manager'',''site_manager''' else '''company_admin'',''fleet_manager'',''site_manager'',''technician''' end;
  execute format('create policy tenant_read on public.%I for select to authenticated using(company_id=public.current_company_id())',t);
  execute format('create policy role_insert on public.%I for insert to authenticated with check(company_id=public.current_company_id() and public.has_company_role(array[%s]::public.company_role[]))',t,allowed);
  execute format('create policy role_update on public.%I for update to authenticated using(company_id=public.current_company_id() and public.has_company_role(array[%s]::public.company_role[])) with check(company_id=public.current_company_id() and public.has_company_role(array[%s]::public.company_role[]))',t,allowed,allowed);
 end loop;
end $$;
-- Remove Supabase default privileges, including anonymous access and writable memberships.
revoke all on public.companies,public.memberships,public.cranes,public.sites,public.faults,public.maintenance,public.activity_log from anon,authenticated;
grant select on public.companies,public.memberships,public.cranes,public.sites,public.faults,public.maintenance,public.activity_log to authenticated;
grant insert,update on public.cranes,public.sites,public.faults,public.maintenance to authenticated;
revoke all on function public.current_company_id(),public.has_company_role(public.company_role[]),public.register_company(text),public.add_company_member(text,public.company_role),public.change_member_role(uuid,public.company_role),public.log_record(),public.prepare_record(),public.schedule_next_maintenance() from public,anon;
grant execute on function public.current_company_id(),public.has_company_role(public.company_role[]),public.register_company(text),public.add_company_member(text,public.company_role),public.change_member_role(uuid,public.company_role) to authenticated;
commit;

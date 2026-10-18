-- Pending credentials live only in Supabase Auth's password hash, with a ban.
create table public.account_requests (
 id uuid primary key default gen_random_uuid(),
 auth_user_id uuid unique references auth.users(id) on delete set null,
 username text not null check (username ~ '^[a-z0-9._-]{3,32}$'),
 display_name text not null check (char_length(display_name) between 1 and 60),
 email text not null check (char_length(email) between 3 and 254),
 status text not null default 'pending_email' check (status in ('pending_email','pending','approving','rejecting','approved','rejected')),
 verification_hash text,
 verification_expires_at timestamptz,
 verified_at timestamptz,
 created_at timestamptz not null default now(),
 reviewed_at timestamptz,
 reviewed_by uuid references auth.users(id) on delete set null,
 admin_email_status text not null default 'pending' check(admin_email_status in ('pending','sent')),
 email_status text not null default 'pending' check(email_status in ('pending','sent')),
 email_sent_at timestamptz
);
create unique index account_requests_active_username on public.account_requests(username) where status in ('pending_email','pending','approving','rejecting');
create unique index account_requests_active_email on public.account_requests(lower(email)) where status in ('pending_email','pending','approving','rejecting');
alter table public.account_requests enable row level security;
revoke all on public.account_requests from public, anon, authenticated;
grant all on public.account_requests to service_role;
create table public.account_request_limits (bucket text primary key, attempts integer not null, expires_at timestamptz not null);
alter table public.account_request_limits enable row level security;
revoke all on public.account_request_limits from public, anon, authenticated;
grant all on public.account_request_limits to service_role;
create or replace function public.account_request_rate_limit(p_bucket text, p_limit integer, p_seconds integer)
returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 insert into public.account_request_limits(bucket,attempts,expires_at) values(p_bucket,1,now()+make_interval(secs=>p_seconds))
 on conflict(bucket) do update set attempts=case when account_request_limits.expires_at<now() then 1 else account_request_limits.attempts+1 end,
 expires_at=case when account_request_limits.expires_at<now() then now()+make_interval(secs=>p_seconds) else account_request_limits.expires_at end returning attempts into n;
 delete from public.account_request_limits where expires_at<now()-interval '1 day';
 return n<=p_limit;
end; $$;
revoke all on function public.account_request_rate_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.account_request_rate_limit(text,integer,integer) to service_role;
create or replace function public.account_request_create_profile(p_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare req public.account_requests; next_legacy integer;
begin
 select * into req from public.account_requests where id=p_id for update;
 if req.status<>'approving' or req.verified_at is null or req.auth_user_id is null then raise exception 'Solicitud no disponible'; end if;
 -- Serialize legacy IDs and recheck uniqueness at approval time.
 perform pg_advisory_xact_lock(63104772);
 if exists(select 1 from public.profiles where id=req.auth_user_id and username=req.username) then return req.auth_user_id; end if;
 select coalesce(max(legacy_id),9)+1 into next_legacy from public.profiles;
 insert into public.profiles(id,legacy_id,username,display_name,role,is_hidden)
 values(req.auth_user_id,next_legacy,req.username,req.display_name,'member',false);
 return req.auth_user_id;
end; $$;
revoke all on function public.account_request_create_profile(uuid) from public,anon,authenticated;
grant execute on function public.account_request_create_profile(uuid) to service_role;

-- Preserve the existing profile provisioning function. Only gate its insert
-- trigger using service-controlled app metadata; never user-editable metadata.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row when ((new.raw_app_meta_data ->> 'account_request_pending') is distinct from 'true')
execute function public.handle_new_big_boy();

-- Notify administrators only after the applicant proves ownership of their mail.
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check(type in('private_message','group_message','like','reply','media_created','event_created','pack_granted','news_update','group_poll','trade_offer','trade_resolved','account_request'));
alter table public.notifications drop constraint if exists notifications_target_type_check;
alter table public.notifications add constraint notifications_target_type_check check(target_type in('private','moment','post','event','pack','news','group','trade','account_request'));
create or replace function public.notify_account_request()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='pending' and old.status='pending_email' then
 insert into public.notifications(user_id,type,target_type,excerpt)
 select id,'account_request','account_request',left('@'||new.username||' solicita acceso al club.',180)
 from public.profiles where role in('admin','superadmin');
 end if;
 return new;
end; $$;
create trigger account_request_verified after update of status on public.account_requests for each row execute function public.notify_account_request();

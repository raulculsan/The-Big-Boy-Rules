begin;
alter table club_security.configuration add column if not exists verified_contact_required boolean not null default false;
create table if not exists public.account_identity_tokens(
 token_hash text primary key check(length(token_hash)=64),
 user_id uuid not null references auth.users(id) on delete cascade,
 email text not null, kind text not null check(kind in('reset','email')),
 expires_at timestamptz not null, used_at timestamptz, created_at timestamptz not null default now()
);
alter table public.account_identity_tokens enable row level security;
revoke all on public.account_identity_tokens from public,anon,authenticated;
grant all on public.account_identity_tokens to service_role;
create index if not exists account_identity_expiry on public.account_identity_tokens(expires_at);
-- Never provision an app profile merely because OAuth created an Auth user.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row when (
 (new.raw_app_meta_data->>'account_request_pending') is distinct from 'true'
 and new.email ~ '^[a-zA-Z0-9._-]+@bigboyrules\.local$'
 and lower(new.email) !~ '^request-.*@pending\.bigboyrules\.local$'
) execute function public.handle_new_big_boy();
create or replace function public.account_has_verified_contact(p_user uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u where u.id=p_user and u.email_confirmed_at is not null
  and u.email not like '%.local' and u.email ~ '^[^@]+@[^@]+\.[^@]+$')
 or exists(select 1 from auth.identities i where i.user_id=p_user and i.provider in('google','apple')
  and coalesce(i.identity_data->>'email_verified','false')='true');
$$;
revoke all on function public.account_has_verified_contact(uuid) from public,anon,authenticated;
create or replace function public.account_security_satisfied()
returns boolean language plpgsql stable security definer set search_path='' as $$
declare cfg club_security.configuration%rowtype; caller uuid:=auth.uid();
begin
 select * into strict cfg from club_security.configuration where singleton;
 if caller is null then return not cfg.enforcement_enabled; end if;
 if not exists(select 1 from public.profiles where id=caller) then return false; end if;
 if exists(select 1 from auth.users where id=caller and (raw_app_meta_data->>'account_request_pending'='true' or banned_until>now())) then return false; end if;
 if cfg.verified_contact_required and not public.account_has_verified_contact(caller) then return false; end if;
 if not cfg.verified_contact_required and cfg.enforcement_enabled and cfg.identity_link_required and not exists(select 1 from auth.identities where user_id=caller and provider=any(cfg.enabled_providers)) then return false; end if;
 if cfg.enforcement_enabled and cfg.mfa_required and (
  coalesce(auth.jwt()->>'aal','')<>'aal2' or not exists(select 1 from auth.mfa_factors where user_id=caller and factor_type='totp' and status='verified')
 ) then return false; end if;
 return true;
end; $$;
create or replace function public.account_security_status()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare cfg club_security.configuration%rowtype; caller uuid:=auth.uid(); linked text[]; has_totp boolean; has_email boolean;
begin
 if caller is null then raise exception 'Inicia sesión.' using errcode='28000'; end if;
 select * into strict cfg from club_security.configuration where singleton;
 select coalesce(array_agg(distinct provider),'{}'::text[]) into linked from auth.identities where user_id=caller and provider in('google','apple');
 select exists(select 1 from auth.mfa_factors where user_id=caller and factor_type='totp' and status='verified') into has_totp;
 select exists(select 1 from auth.users where id=caller and email_confirmed_at is not null and email not like '%.local') into has_email;
 return jsonb_build_object('enforcement_enabled',cfg.enforcement_enabled,'identity_link_required',true,'verified_contact_required',cfg.verified_contact_required,'mfa_required',cfg.mfa_required,'enabled_providers',cfg.enabled_providers,'linked_providers',linked,'identity_linked',public.account_has_verified_contact(caller),'email_verified',has_email,'mfa_enrolled',has_totp,'current_aal',coalesce(auth.jwt()->>'aal','aal1'),'access_allowed',public.account_security_satisfied());
end; $$;
create or replace function public.account_recovery_user(p_email text)
returns uuid language sql stable security definer set search_path='' as $$
 select u.id from auth.users u join public.profiles p on p.id=u.id
 where coalesce(u.raw_app_meta_data->>'account_request_pending','false')<>'true'
 and (u.banned_until is null or u.banned_until<now())
 and ((lower(u.email)=lower(p_email) and u.email_confirmed_at is not null and u.email not like '%.local')
 or exists(select 1 from auth.identities i where i.user_id=u.id and i.provider in('google','apple')
 and coalesce(i.identity_data->>'email_verified','false')='true' and lower(i.identity_data->>'email')=lower(p_email))) limit 1;
$$;
revoke all on function public.account_recovery_user(text) from public,anon,authenticated;
grant execute on function public.account_recovery_user(text) to service_role;
-- Existing policies and pre-request hook call the updated gate. Install for RPCs too.
alter role authenticator set pgrst.db_pre_request='public.account_security_pre_request';
notify pgrst,'reload config';
notify pgrst,'reload schema';
commit;

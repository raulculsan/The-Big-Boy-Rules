-- Stage first. OAuth credentials and callbacks must work before enforcement is enabled.
begin;

create schema if not exists club_security;
revoke all on schema club_security from public, anon, authenticated;

create table if not exists club_security.configuration (
  singleton boolean primary key default true check (singleton),
  enforcement_enabled boolean not null default false,
  identity_link_required boolean not null default true,
  mfa_required boolean not null default true,
  enabled_providers text[] not null default '{}',
  updated_at timestamptz not null default now(),
  check (enabled_providers <@ array['google', 'apple']::text[]),
  check (not enforcement_enabled or not identity_link_required or cardinality(enabled_providers) > 0)
);
alter table club_security.configuration enable row level security;
revoke all on club_security.configuration from public, anon, authenticated;
insert into club_security.configuration(singleton) values (true) on conflict do nothing;

-- One bootstrap RPC: no profile reads or application-data access are necessary to
-- link a provider or enroll/challenge TOTP. Never accept another user's ID here.
create or replace function public.account_security_status()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  cfg club_security.configuration%rowtype;
  caller uuid := auth.uid();
  linked text[];
  has_totp boolean;
  aal text := coalesce(auth.jwt()->>'aal', 'aal1');
begin
  if caller is null then raise exception 'Inicia sesión.' using errcode = '28000'; end if;
  select * into strict cfg from club_security.configuration where singleton;
  select coalesce(array_agg(distinct provider order by provider), '{}'::text[])
    into linked from auth.identities
    where user_id = caller and provider in ('google', 'apple');
  select exists(select 1 from auth.mfa_factors
    where user_id = caller and factor_type = 'totp' and status = 'verified') into has_totp;
  return jsonb_build_object(
    'enforcement_enabled', cfg.enforcement_enabled,
    'identity_link_required', cfg.identity_link_required,
    'mfa_required', cfg.mfa_required,
    'enabled_providers', cfg.enabled_providers,
    'linked_providers', linked,
    'identity_linked', linked && cfg.enabled_providers,
    'mfa_enrolled', has_totp,
    'current_aal', aal,
    'access_allowed', not cfg.enforcement_enabled or (
      (not cfg.identity_link_required or linked && cfg.enabled_providers)
      and (not cfg.mfa_required or (has_totp and aal = 'aal2'))
    )
  );
end;
$$;
revoke all on function public.account_security_status() from public, anon;
grant execute on function public.account_security_status() to authenticated;

create or replace function public.account_security_satisfied()
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  cfg club_security.configuration%rowtype;
  caller uuid := auth.uid();
begin
  select * into strict cfg from club_security.configuration where singleton;
  if not cfg.enforcement_enabled then return true; end if;
  if caller is null then return false; end if;
  if cfg.identity_link_required and not exists (
    select 1 from auth.identities where user_id = caller and provider = any(cfg.enabled_providers)
  ) then return false; end if;
  if cfg.mfa_required and (
    coalesce(auth.jwt()->>'aal', '') <> 'aal2' or not exists (
      select 1 from auth.mfa_factors where user_id = caller and factor_type = 'totp' and status = 'verified'
    )
  ) then return false; end if;
  return true;
end;
$$;
revoke all on function public.account_security_satisfied() from public;
grant execute on function public.account_security_satisfied() to anon, authenticated;

-- Edge functions call this with the incoming user's JWT BEFORE service-role reads
-- or writes. Do not call with a service-role client: that would lose the user's AAL.
create or replace function public.assert_account_security()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Inicia sesión.' using errcode = '28000'; end if;
  if not public.account_security_satisfied() then
    raise exception 'Completa la vinculación y la verificación de seguridad de tu cuenta.'
      using errcode = '42501', detail = 'account_security_required';
  end if;
end;
$$;
revoke all on function public.assert_account_security() from public, anon;
grant execute on function public.assert_account_security() to authenticated;

-- RLS protects ordinary Data API reads/writes and Realtime table access. Existing
-- permissive policies still determine which rows a fully verified user can use.
do $$
declare t record;
begin
  for t in select n.nspname, c.relname from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relrowsecurity
  loop
    execute format('drop policy if exists account_security_gate on %I.%I', t.nspname, t.relname);
    execute format('create policy account_security_gate on %I.%I as restrictive for all to anon, authenticated using ((select public.account_security_satisfied())) with check ((select public.account_security_satisfied()))', t.nspname, t.relname);
  end loop;
end;
$$;
drop policy if exists account_security_gate on storage.objects;
create policy account_security_gate on storage.objects as restrictive for all to anon, authenticated
  using ((select public.account_security_satisfied()))
  with check ((select public.account_security_satisfied()));

-- SECURITY DEFINER RPCs bypass table RLS, so the Data API must also install this
-- pre-request hook BEFORE enabling enforcement (see activation runbook). This
-- function is intentionally SECURITY INVOKER: the end-user JWT is authoritative.
create or replace function public.account_security_pre_request()
returns void language plpgsql stable security invoker set search_path = '' as $$
begin
  if auth.role() = 'service_role' then return; end if;
  -- PostgREST sets this server-side; it is not read from a request header.
  if current_setting('request.path', true) = '/rpc/account_security_status' then return; end if;
  if not public.account_security_satisfied() then
    raise exception 'Completa la vinculación y la verificación de seguridad de tu cuenta.'
      using errcode = '42501', detail = 'account_security_required';
  end if;
end;
$$;
revoke all on function public.account_security_pre_request() from public;
grant execute on function public.account_security_pre_request() to anon, authenticated, service_role;

comment on function public.account_security_status() is 'Security setup bootstrap, current caller only; deliberately available at AAL1.';
comment on table club_security.configuration is 'Owner-controlled staged OAuth/TOTP rollout. Never grant app users direct writes or store OAuth secrets here.';
commit;

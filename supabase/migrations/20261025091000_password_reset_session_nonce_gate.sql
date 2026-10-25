-- An administrator or verified-email password reset rotates this server-owned
-- nonce. Old access tokens then fail the common Data API / Storage gate. The
-- service-only RPC removes refresh tokens by deleting their parent sessions.
begin;

create or replace function public.account_security_satisfied()
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  cfg club_security.configuration%rowtype;
  caller uuid := auth.uid();
  enrolled_totp boolean;
begin
  select * into strict cfg from club_security.configuration where singleton;
  if caller is null then return not cfg.enforcement_enabled; end if;
  if not exists(select 1 from public.profiles where id = caller) then return false; end if;
  if exists(select 1 from auth.users where id = caller and (
    raw_app_meta_data->>'account_request_pending' = 'true'
    or raw_app_meta_data->>'must_change_password' = 'true'
    or banned_until > now()
    or raw_app_meta_data->>'password_change_nonce'
      is distinct from auth.jwt()->'app_metadata'->>'password_change_nonce'
  )) then return false; end if;
  if (cfg.verified_contact_required or (cfg.enforcement_enabled and cfg.identity_link_required))
    and not public.account_has_verified_contact(caller) then return false; end if;

  select exists(select 1 from auth.mfa_factors where user_id = caller
    and factor_type = 'totp' and status = 'verified') into enrolled_totp;
  if enrolled_totp and coalesce(auth.jwt()->>'aal', '') <> 'aal2' then return false; end if;
  if cfg.enforcement_enabled and cfg.mfa_required and not enrolled_totp then return false; end if;
  return true;
end;
$$;

create or replace function public.revoke_user_sessions_after_password_change(p_user uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare revoked integer;
begin
  if auth.role() <> 'service_role' or p_user is null then
    raise exception 'Service role required.' using errcode = '42501';
  end if;
  delete from auth.sessions where user_id = p_user;
  get diagnostics revoked = row_count;
  return revoked;
end;
$$;
revoke all on function public.revoke_user_sessions_after_password_change(uuid) from public, anon, authenticated;
grant execute on function public.revoke_user_sessions_after_password_change(uuid) to service_role;

notify pgrst, 'reload schema';
commit;

-- Deploy before the account-requests Edge update. A legacy Auth email may
-- need confirmation only to permit a password session. That session must still
-- verify ownership of a real contact before it may read any club data.
begin;
create or replace function public.account_has_verified_contact(p_user uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u where u.id=p_user and u.email_confirmed_at is not null
  and coalesce(u.raw_app_meta_data->>'contact_verification_pending','false')<>'true'
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
 if (cfg.verified_contact_required or (cfg.enforcement_enabled and cfg.identity_link_required))
  and not public.account_has_verified_contact(caller) then return false; end if;
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
 select exists(select 1 from auth.users where id=caller and email_confirmed_at is not null and email not like '%.local' and coalesce(raw_app_meta_data->>'contact_verification_pending','false')<>'true') into has_email;
 return jsonb_build_object('enforcement_enabled',cfg.enforcement_enabled,'identity_link_required',true,'verified_contact_required',cfg.verified_contact_required,'mfa_required',cfg.mfa_required,'enabled_providers',cfg.enabled_providers,'linked_providers',linked,'identity_linked',public.account_has_verified_contact(caller),'email_verified',has_email,'mfa_enrolled',has_totp,'current_aal',coalesce(auth.jwt()->>'aal','aal1'),'access_allowed',public.account_security_satisfied());
end; $$;
create or replace function public.account_recovery_user(p_email text)
returns uuid language sql stable security definer set search_path='' as $$
 select u.id from auth.users u join public.profiles p on p.id=u.id
 where coalesce(u.raw_app_meta_data->>'account_request_pending','false')<>'true'
 and (u.banned_until is null or u.banned_until<now())
 and ((lower(u.email)=lower(p_email) and u.email_confirmed_at is not null and u.email not like '%.local'
 and coalesce(u.raw_app_meta_data->>'contact_verification_pending','false')<>'true')
 or exists(select 1 from auth.identities i where i.user_id=u.id and i.provider in('google','apple')
 and coalesce(i.identity_data->>'email_verified','false')='true' and lower(i.identity_data->>'email')=lower(p_email))) limit 1;
$$;
revoke all on function public.account_recovery_user(text) from public,anon,authenticated;
grant execute on function public.account_recovery_user(text) to service_role;

-- Contact is mandatory; one verified method is sufficient.
update club_security.configuration
 set verified_contact_required=true, updated_at=now() where singleton;
notify pgrst,'reload schema';
commit;

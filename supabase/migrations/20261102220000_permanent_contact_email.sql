-- A contact email recovers the account, so it must be a permanent personal
-- mailbox. Temporary services (yopmail, mailinator...) rotate domains faster
-- than any blocklist, and some show every inbox publicly: anyone could request
-- a reset link there. Only well-known personal providers are accepted.
create or replace function public.contact_email_allowed(p_email text)
returns boolean language sql immutable set search_path = '' as $$
 select lower(coalesce(p_email, '')) ~ ('^[a-z0-9._%+-]+@('
  || 'gmail\.com|googlemail\.com|icloud\.com|me\.com|mac\.com|msn\.com|aol\.com|aol\.es'
  || '|(hotmail|live)\.(com|es|fr|it|de|co\.uk)|outlook\.(com|es|fr|it|de)'
  || '|(yahoo)\.(com|es|fr|it|de|co\.uk|com\.mx|com\.ar)|ymail\.com|rocketmail\.com'
  || '|proton\.me|protonmail\.(com|ch)|pm\.me|gmx\.(com|es|de|net|fr)'
  || '|zoho(mail)?\.(com|eu)|tuta\.(com|io)|tutanota\.(com|de)|fastmail\.com|yandex\.(com|ru)|mail\.com'
  || '|telefonica\.net|movistar\.es|orange\.es|vodafone\.es'
  || ')$')
$$;
grant execute on function public.contact_email_allowed(text) to service_role;

create or replace function public.account_has_verified_contact(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from auth.users u where u.id = p_user and u.email_confirmed_at is not null
  and coalesce(u.raw_app_meta_data->>'contact_verification_pending', 'false') <> 'true'
  and public.contact_email_allowed(u.email))
 or exists(select 1 from auth.identities i where i.user_id = p_user and i.provider in ('google', 'apple')
  and coalesce(i.identity_data->>'email_verified', 'false') = 'true'
  and public.contact_email_allowed(i.identity_data->>'email'));
$$;

create or replace function public.account_recovery_user(p_email text)
returns uuid language sql stable security definer set search_path = '' as $$
 select u.id from auth.users u join public.profiles p on p.id = u.id
 where public.contact_email_allowed(p_email)
 and coalesce(u.raw_app_meta_data->>'account_request_pending', 'false') <> 'true'
 and (u.banned_until is null or u.banned_until < now())
 and ((lower(u.email) = lower(p_email) and u.email_confirmed_at is not null
  and coalesce(u.raw_app_meta_data->>'contact_verification_pending', 'false') <> 'true')
 or exists(select 1 from auth.identities i where i.user_id = u.id and i.provider in ('google', 'apple')
  and coalesce(i.identity_data->>'email_verified', 'false') = 'true' and lower(i.identity_data->>'email') = lower(p_email))) limit 1;
$$;

create or replace function public.account_security_status()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare cfg club_security.configuration%rowtype; caller uuid := auth.uid(); linked text[]; has_totp boolean; has_email boolean;
begin
 if caller is null then raise exception 'Inicia sesión.' using errcode = '28000'; end if;
 select * into strict cfg from club_security.configuration where singleton;
 select coalesce(array_agg(distinct provider), '{}'::text[]) into linked from auth.identities where user_id = caller and provider in ('google', 'apple');
 select exists(select 1 from auth.mfa_factors where user_id = caller and factor_type = 'totp' and status = 'verified') into has_totp;
 select exists(select 1 from auth.users where id = caller and email_confirmed_at is not null and public.contact_email_allowed(email)
  and coalesce(raw_app_meta_data->>'contact_verification_pending', 'false') <> 'true') into has_email;
 return jsonb_build_object('enforcement_enabled', cfg.enforcement_enabled, 'identity_link_required', true, 'verified_contact_required', cfg.verified_contact_required, 'mfa_required', cfg.mfa_required, 'enabled_providers', cfg.enabled_providers, 'linked_providers', linked, 'identity_linked', public.account_has_verified_contact(caller), 'email_verified', has_email, 'mfa_enrolled', has_totp, 'current_aal', coalesce(auth.jwt()->>'aal', 'aal1'), 'access_allowed', public.account_security_satisfied());
end; $$;

-- Links already mailed to a temporary inbox stop working.
update public.account_identity_tokens set used_at = now()
 where used_at is null and not public.contact_email_allowed(email);

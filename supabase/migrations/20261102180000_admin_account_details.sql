-- Read-only account facts for the administrator's user page. Secrets, tokens,
-- IP addresses and raw user agents never leave this function.
create or replace function public.get_admin_user_account_details(target_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  account record;
  latest record;
  seen_at timestamptz;
begin
  perform public.lock_admin_user_management_target(target_user_id);
  perform public.assert_account_security();
  select u.email, u.email_confirmed_at, u.phone, u.phone_confirmed_at, u.created_at, u.last_sign_in_at, u.banned_until,
         u.raw_app_meta_data->>'must_change_password' = 'true' as must_change_password,
         u.raw_app_meta_data->>'account_request_pending' = 'true' as request_pending
    into account from auth.users u where u.id = target_user_id;
  if not found then
    raise exception 'Esta cuenta no tiene acceso configurado.' using errcode = '22023';
  end if;
  select coalesce(s.refreshed_at at time zone 'utc', s.updated_at, s.created_at) as active_at, s.user_agent
    into latest from auth.sessions s where s.user_id = target_user_id
    order by 1 desc nulls last limit 1;
  seen_at := greatest(account.last_sign_in_at, latest.active_at,
    (select max(v.recorded_at) from public.member_app_visit_days v where v.user_id = target_user_id));
  return jsonb_build_object(
    'user_id', target_user_id,
    -- Accounts created by username carry a placeholder address nobody can read.
    'email', case when lower(account.email) like '%@bigboyrules.local' then null else account.email end,
    'email_verified', account.email_confirmed_at is not null and lower(account.email) not like '%@bigboyrules.local',
    'phone', nullif(account.phone, ''),
    'phone_verified', account.phone_confirmed_at is not null,
    'identities', coalesce((select jsonb_agg(jsonb_build_object('provider', i.provider, 'email', i.identity_data->>'email') order by i.provider)
      from auth.identities i where i.user_id = target_user_id and i.provider in ('google', 'apple')), '[]'::jsonb),
    'totp_enabled', exists(select 1 from auth.mfa_factors f where f.user_id = target_user_id and f.factor_type = 'totp' and f.status = 'verified'),
    'must_change_password', coalesce(account.must_change_password, false),
    'request_pending', coalesce(account.request_pending, false),
    'banned_until', case when account.banned_until > now() then account.banned_until end,
    'created_at', account.created_at,
    'last_sign_in_at', account.last_sign_in_at,
    'last_seen_at', seen_at,
    'active_sessions', (select count(*) from auth.sessions s where s.user_id = target_user_id and (s.not_after is null or s.not_after > now())),
    'last_device', case
      when latest.user_agent ilike '%iphone%' then 'iPhone'
      when latest.user_agent ilike '%ipad%' then 'iPad'
      when latest.user_agent ilike '%android%' then 'Android'
      when latest.user_agent ilike '%macintosh%' then 'Mac'
      when latest.user_agent ilike '%windows%' then 'Windows'
      when latest.user_agent is not null then 'Otro dispositivo'
    end
  );
end;
$$;
revoke all on function public.get_admin_user_account_details(uuid) from public, anon;
grant execute on function public.get_admin_user_account_details(uuid) to authenticated;

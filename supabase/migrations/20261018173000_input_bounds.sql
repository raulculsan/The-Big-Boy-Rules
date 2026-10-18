-- Server-side input bounds. Existing rows verified read-only before preparation.
-- Public schema: 50/50 tables RLS enabled at audit time (2026-10-18).
begin;

create or replace function public.profile_tags_within_bounds(tags text[])
returns boolean language sql immutable parallel safe
set search_path = pg_catalog
as $$
  select tags is null or (
    cardinality(tags) <= 6 and not exists (
      select 1 from unnest(tags) as t(value)
      where value is null or char_length(value) > 120
    )
  );
$$;
revoke all on function public.profile_tags_within_bounds(text[]) from public;
grant execute on function public.profile_tags_within_bounds(text[]) to authenticated, service_role;

alter table public.profiles
  add constraint profiles_username_bounds check (username ~ '^[a-z0-9._-]{3,32}$'),
  add constraint profiles_display_name_bounds check (char_length(trim(display_name)) between 1 and 40),
  add constraint profiles_nickname_bounds check (nickname is null or char_length(trim(nickname)) between 1 and 50),
  add constraint profiles_bio_bounds check (char_length(bio) <= 350),
  add constraint profiles_tags_bounds check (public.profile_tags_within_bounds(tags)),
  add constraint profiles_country_flag_bounds check (char_length(country_flag) <= 8),
  add constraint profiles_avatar_url_bounds check (char_length(avatar_url) <= 2048);

alter table public.site_settings
  add constraint site_settings_key_bounds check (char_length(key) between 1 and 80),
  add constraint site_settings_value_bounds check (char_length(value) <= 4096);

-- The request insert happens before generate_series or any wallet change, so
-- this bounds the legacy reward RPC without changing its deployed implementation.
-- Existing audit records were checked: no rows exceed either cap.
alter table public.admin_reward_grants
  add constraint admin_reward_grants_amount_bounds check (
    (reward = 'packs' and amount between 1 and 10000) or
    (reward = 'coins' and amount between 1 and 1000000)
  );

notify pgrst, 'reload schema';
commit;

begin;

-- Published release metadata is readable before sign-in; it contains no account data.
create table public.app_release_policy (
  platform text primary key check (platform in ('android', 'ios')),
  minimum_build integer not null check (minimum_build between 1 and 2100000000),
  latest_build integer not null check (latest_build between minimum_build and 2100000000),
  latest_version text not null check (char_length(latest_version) between 1 and 32),
  download_url text not null check (
    char_length(download_url) between 10 and 2048
    and download_url ~ '^https://[A-Za-z0-9][A-Za-z0-9.-]*[A-Za-z0-9](/[^[:space:]]*)?$'
  ),
  message text not null default '' check (char_length(message) <= 240),
  updated_at timestamptz not null default now()
);
alter table public.app_release_policy enable row level security;
revoke all on public.app_release_policy from public, anon, authenticated;
grant select on public.app_release_policy to anon, authenticated;
grant insert, update on public.app_release_policy to authenticated;
grant all on public.app_release_policy to service_role;

create policy "published release policy" on public.app_release_policy
  for select to anon, authenticated using (true);
create policy "superadmin creates release policy" on public.app_release_policy
  for insert to authenticated
  with check ((select public.current_user_is_superadmin()) and (select public.account_security_satisfied()));
create policy "superadmin updates release policy" on public.app_release_policy
  for update to authenticated
  using ((select public.current_user_is_superadmin()) and (select public.account_security_satisfied()))
  with check ((select public.current_user_is_superadmin()) and (select public.account_security_satisfied()));

-- Bootstrap build 2 can run immediately; this does not target APKs without a gate.
insert into public.app_release_policy
  (platform, minimum_build, latest_build, latest_version, download_url, message)
values
  ('android', 2, 2, '1.1.0',
   'https://github.com/raulculsan/The-Big-Boy-Rules/releases/latest/download/BigBoy-Android.apk',
   'Actualiza Big Boy para continuar.')
on conflict (platform) do nothing;

commit;

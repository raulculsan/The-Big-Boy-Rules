-- Device tokens are confidential delivery addresses, only the owning member and
-- the trusted dispatcher may read them. Transfer on login prevents stale accounts.
create table if not exists public.native_push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique check (token ~ '^[0-9a-f]{64,256}$'),
  environment text not null check (environment in ('sandbox','production')),
  bundle_id text not null default 'com.raulculsan.thebigboyrules' check (bundle_id = 'com.raulculsan.thebigboyrules'),
  updated_at timestamptz not null default now()
);
alter table public.native_push_devices enable row level security;
revoke all on public.native_push_devices from anon, authenticated;
grant select, delete on public.native_push_devices to authenticated;
grant all on public.native_push_devices to service_role;
create policy native_push_own_read on public.native_push_devices for select to authenticated using (user_id = auth.uid());
create policy native_push_own_delete on public.native_push_devices for delete to authenticated using (user_id = auth.uid());
create index if not exists native_push_devices_user_idx on public.native_push_devices(user_id);
create or replace function public.register_native_push_device(p_token text, p_environment text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or not exists(select 1 from public.profiles where id = auth.uid() and is_hidden = false) then
    raise exception 'Sesión no válida.';
  end if;
  if p_token !~ '^[0-9a-f]{64,256}$' or p_environment not in ('sandbox','production') then raise exception 'Registro no válido.'; end if;
  insert into public.native_push_devices(user_id,token,environment) values(auth.uid(),p_token,p_environment)
    on conflict(token) do update set user_id=excluded.user_id,environment=excluded.environment,updated_at=now();
end $$;
revoke all on function public.register_native_push_device(text,text) from public,anon;
grant execute on function public.register_native_push_device(text,text) to authenticated;
-- Permit dispatcher to release claims after a complete transport failure.
grant delete on public.push_dispatch_claims to service_role;

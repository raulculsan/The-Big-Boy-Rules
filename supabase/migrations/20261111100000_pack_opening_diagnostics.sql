-- Pack opening diagnostics: one small summary per opening (frame timings per
-- phase and the device's basic capabilities) to find which phones stutter.
-- Members can only add their own; nobody reads them through the API.
begin;
create table if not exists public.pack_opening_diagnostics (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  payload jsonb not null check (pg_column_size(payload) <= 4096)
);
create index if not exists pack_opening_diagnostics_user_created on public.pack_opening_diagnostics(user_id, created_at desc);
alter table public.pack_opening_diagnostics enable row level security;
revoke all on public.pack_opening_diagnostics from public, anon, authenticated;
grant all on public.pack_opening_diagnostics to service_role;

create or replace function public.record_pack_opening_diagnostic(payload jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid());
begin
  if actor is null then raise exception 'Sesión requerida.' using errcode = '42501'; end if;
  if payload is null or jsonb_typeof(payload) <> 'object' or pg_column_size(payload) > 4096 then return; end if;
  if (select count(*) from public.pack_opening_diagnostics where user_id = actor and created_at > now() - interval '1 day') >= 12 then return; end if;
  insert into public.pack_opening_diagnostics(user_id, payload) values (actor, payload);
  -- Keep only the latest 40 per member.
  delete from public.pack_opening_diagnostics d where d.user_id = actor and d.id not in (
    select id from public.pack_opening_diagnostics where user_id = actor order by created_at desc limit 40);
end $$;
revoke all on function public.record_pack_opening_diagnostic(jsonb) from public, anon;
grant execute on function public.record_pack_opening_diagnostic(jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;

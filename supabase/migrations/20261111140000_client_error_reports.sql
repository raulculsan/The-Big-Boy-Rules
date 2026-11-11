-- Client error reports: when the app hits an unexpected error on a member's
-- phone, it sends one short, scrubbed line (error type, message, file and line,
-- screen, app version and device). Identical errors are grouped and counted
-- instead of stored again. Members can only add their own; nobody reads them
-- through the API. Kept 30 days, at most 30 new reports per member per day.
begin;
create table if not exists public.client_error_reports (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  signature text not null check (char_length(signature) between 1 and 200),
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  occurrences integer not null default 1,
  payload jsonb not null check (pg_column_size(payload) <= 4096),
  unique (user_id, signature)
);
create index if not exists client_error_reports_last_seen on public.client_error_reports(last_seen desc);
alter table public.client_error_reports enable row level security;
revoke all on public.client_error_reports from public, anon, authenticated;
grant all on public.client_error_reports to service_role;

create or replace function public.record_client_error(payload jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  sig text;
begin
  if actor is null then raise exception 'Sesión requerida.' using errcode = '42501'; end if;
  if payload is null or jsonb_typeof(payload) <> 'object' or pg_column_size(payload) > 4096 then return; end if;
  sig := left(coalesce(nullif(payload->>'signature', ''), md5(payload::text)), 200);
  -- A repeat only bumps the counter and refreshes the latest details.
  update public.client_error_reports
     set occurrences = least(occurrences + 1, 1000000), last_seen = now(), payload = record_client_error.payload
   where user_id = actor and signature = sig;
  if found then return; end if;
  if (select count(*) from public.client_error_reports where user_id = actor and first_seen > now() - interval '1 day') >= 30 then return; end if;
  insert into public.client_error_reports(user_id, signature, payload) values (actor, sig, payload)
  on conflict (user_id, signature) do update set occurrences = public.client_error_reports.occurrences + 1, last_seen = now();
  delete from public.client_error_reports where last_seen < now() - interval '30 days';
end $$;
revoke all on function public.record_client_error(jsonb) from public, anon;
grant execute on function public.record_client_error(jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;

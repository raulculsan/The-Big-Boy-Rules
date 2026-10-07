-- Sobres diarios · ejecutar una vez en Supabase SQL Editor (se puede repetir).
-- Requiere el esquema base con public.profiles; no depende del módulo de logros.
-- No modifica logros, cuentas ni archivos. No importa actividad histórica.
begin;

create table if not exists public.card_packs (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  earned_day date not null,
  collection_key text not null default 'los-nuestros-01',
  created_at timestamptz not null default clock_timestamp(),
  opened_at timestamptz,
  source text not null default 'daily'
);
alter table public.card_packs add column if not exists source text not null default 'daily';
alter table public.card_packs drop constraint if exists card_packs_user_id_earned_day_key;
create unique index if not exists card_packs_daily_user_day_key
  on public.card_packs(user_id, earned_day) where source = 'daily';
alter table public.card_packs enable row level security;
revoke all on public.card_packs from public, anon, authenticated;
revoke all on sequence public.card_packs_id_seq from public, anon, authenticated;
grant select on public.card_packs to authenticated;
drop policy if exists card_packs_read_own on public.card_packs;
create policy card_packs_read_own on public.card_packs for select to authenticated
  using (user_id = (select auth.uid()));

-- Both the identity and calendar day are server-derived. A unique constraint
-- prevents duplicate grants across devices, retries and simultaneous requests.
create or replace function public.claim_daily_card_pack()
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  actor uuid := auth.uid();
  today date := (statement_timestamp() at time zone 'Europe/Madrid')::date;
  inserted_rows integer;
  available_count bigint;
  total_count bigint;
begin
  if actor is null then raise exception 'Inicia sesión para recibir tu sobre.' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles where id = actor and not coalesce(is_hidden, false)) then
    raise exception 'Tu cuenta no tiene acceso a esta colección.' using errcode = '42501';
  end if;
  insert into public.card_packs(user_id, earned_day) values (actor, today)
    on conflict (user_id, earned_day) where source = 'daily' do nothing;
  get diagnostics inserted_rows = row_count;
  select count(*) filter (where opened_at is null), count(*)
    into available_count, total_count from public.card_packs where user_id = actor;
  return jsonb_build_object(
    'available', available_count, 'total', total_count, 'credited', inserted_rows = 1,
    'day', today, 'next_reset_at', ((today + 1)::timestamp at time zone 'Europe/Madrid')
  );
end;
$$;
revoke all on function public.claim_daily_card_pack() from public, anon, authenticated;
grant execute on function public.claim_daily_card_pack() to authenticated;

notify pgrst, 'reload schema';
commit;

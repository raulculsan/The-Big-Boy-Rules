-- Run after supabase-banner-shop.sql. Repeatable admin rewards migration.
begin;

-- Daily packs remain unique per day; admin packs can be granted in any quantity.
alter table public.card_packs add column if not exists source text not null default 'daily';
alter table public.card_packs drop constraint if exists card_packs_user_id_earned_day_key;
create unique index if not exists card_packs_daily_user_day_key
  on public.card_packs(user_id,earned_day) where source = 'daily';

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
  if not exists (select 1 from public.profiles where id = actor and not coalesce(is_hidden,false)) then
    raise exception 'Tu cuenta no tiene acceso a esta colección.' using errcode = '42501';
  end if;
  insert into public.card_packs(user_id,earned_day,source) values(actor,today,'daily')
    on conflict (user_id,earned_day) where source = 'daily' do nothing;
  get diagnostics inserted_rows = row_count;
  select count(*) filter (where opened_at is null),count(*) into available_count,total_count
    from public.card_packs where user_id = actor;
  return jsonb_build_object('available',available_count,'total',total_count,'credited',inserted_rows = 1,
    'day',today,'next_reset_at',((today + 1)::timestamp at time zone 'Europe/Madrid'));
end;
$$;
revoke all on function public.claim_daily_card_pack() from public,anon,authenticated;
grant execute on function public.claim_daily_card_pack() to authenticated;

alter table public.member_coin_ledger drop constraint if exists member_coin_ledger_reason_check;
alter table public.member_coin_ledger add constraint member_coin_ledger_reason_check
  check (reason in ('duplicate_discard','banner_purchase','admin_grant'));

create table if not exists public.admin_reward_grants (
  request_id uuid primary key,
  actor_id uuid not null references public.profiles(id),
  user_id uuid not null references public.profiles(id),
  reward text not null check (reward in ('packs','coins')),
  amount integer not null check (amount > 0),
  result jsonb,
  created_at timestamptz not null default clock_timestamp()
);
alter table public.admin_reward_grants enable row level security;
revoke all on public.admin_reward_grants from public,anon,authenticated;

-- The request UUID makes retries safe, including an ambiguous network response.
create or replace function public.admin_grant_reward(target_user_id uuid,reward_kind text,amount integer,request_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  actor uuid := auth.uid();
  previous public.admin_reward_grants%rowtype;
  new_balance bigint;
  available_count bigint;
  response jsonb;
begin
  if actor is null or not public.current_user_is_club_admin() then
    raise exception 'Solo los administradores pueden conceder sobres o monedas.' using errcode = '42501';
  end if;
  if amount is null or amount <= 0 or reward_kind is null or reward_kind not in ('packs','coins') or request_id is null then
    raise exception 'Elige sobres o monedas y una cantidad entera mayor que cero.' using errcode = '22023';
  end if;
  perform 1 from public.profiles where id = target_user_id and not coalesce(is_hidden,false) for share;
  if not found then raise exception 'El miembro seleccionado no está disponible.' using errcode = '22023'; end if;
  insert into public.admin_reward_grants(request_id,actor_id,user_id,reward,amount)
    values(request_id,actor,target_user_id,reward_kind,amount) on conflict do nothing;
  select * into previous from public.admin_reward_grants g where g.request_id = admin_grant_reward.request_id for update;
  if previous.actor_id <> actor or previous.user_id <> target_user_id or previous.reward <> reward_kind or previous.amount <> amount then
    raise exception 'Esta solicitud pertenece a otra asignación.' using errcode = '22023';
  end if;
  if previous.result is not null then return previous.result; end if;
  -- Match the wallet-first lock order used by all collection economy operations.
  insert into public.member_coin_wallets(user_id) values(target_user_id) on conflict do nothing;
  select balance into new_balance from public.member_coin_wallets where user_id = target_user_id for update;
  if reward_kind = 'coins' then
    update public.member_coin_wallets set balance = balance + amount where user_id = target_user_id returning balance into new_balance;
    insert into public.member_coin_ledger(user_id,delta,balance_after,reason,item_id)
      values(target_user_id,amount,new_balance,'admin_grant',request_id::text);
  else
    insert into public.card_packs(user_id,earned_day,collection_key,source)
      select target_user_id,(statement_timestamp() at time zone 'Europe/Madrid')::date,'los-nuestros-01','admin'
      from generate_series(1,amount);
  end if;
  select count(*) into available_count from public.card_packs where user_id = target_user_id and opened_at is null;
  response := jsonb_build_object('user_id',target_user_id,'reward',reward_kind,'granted',amount,
    'balance',new_balance,'available_packs',available_count,'request_id',request_id);
  update public.admin_reward_grants g set result = response where g.request_id = admin_grant_reward.request_id;
  return response;
end;
$$;
revoke all on function public.admin_grant_reward(uuid,text,integer,uuid) from public,anon,authenticated;
grant execute on function public.admin_grant_reward(uuid,text,integer,uuid) to authenticated;
notify pgrst,'reload schema';
commit;

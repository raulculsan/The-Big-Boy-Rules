-- One shared daily selection and idempotent progression rewards. Madrid calendar.
begin;

create or replace function public.daily_banner_shop_ids()
returns text[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(id order by rank_key,id),'{}'::text[]) from (
    select id,md5(((statement_timestamp() at time zone 'Europe/Madrid')::date)::text||':'||id) rank_key
    from public.profile_banner_catalog where active order by rank_key,id limit 5
  ) selection;
$$;
revoke all on function public.daily_banner_shop_ids() from public,anon,authenticated;

create or replace function public.get_banner_shop_state()
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  actor uuid := public.lock_banner_shop_actor();
  shop_day date := (statement_timestamp() at time zone 'Europe/Madrid')::date;
  daily_ids text[] := public.daily_banner_shop_ids();
  voucher_rows jsonb := '[]'::jsonb;
begin
  perform public.assert_account_security();
  -- Vouchers are optional in existing installations.
  if to_regclass('public.reward_voucher_catalog') is not null and to_regclass('public.member_owned_reward_vouchers') is not null then
    execute $vouchers$select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'name',v.name,'description',v.description,'price',v.price,
      'reward_type',v.reward_type,'reward_amount',v.reward_amount,'reward_banner_id',v.reward_banner_id,
      'owned_quantity',coalesce(o.quantity,0)) order by v.id),'[]'::jsonb)
      from public.reward_voucher_catalog v left join public.member_owned_reward_vouchers o on o.voucher_id=v.id and o.user_id=$1
      where v.active or o.quantity is not null$vouchers$ into voucher_rows using actor;
  end if;
  return jsonb_build_object(
    'shop_day',shop_day,'shop_next_reset_at',((shop_day+1)::timestamp at time zone 'Europe/Madrid'),
    'daily_banner_ids',to_jsonb(daily_ids),
    'cards_per_pack',6,
    'rarity_probabilities',coalesce((select jsonb_object_agg(edition,round(100.0*weight/total_weight,2)) from (
      select w.*,sum(weight) over () as total_weight from public.card_pack_rarity_weights() w
      where exists (select 1 from public.achievement_card_catalog c where c.active and c.edition=w.edition)
    ) odds),'{}'::jsonb),
    'balance', (select balance from public.member_coin_wallets where user_id = actor),
    'cards', coalesce((select jsonb_agg(jsonb_build_object('card_id',i.card_id,'quantity',i.quantity,'edition',c.edition,'kind',c.kind) order by i.card_id)
      from public.member_card_inventory i join public.achievement_card_catalog c on c.id = i.card_id where i.user_id = actor),'[]'::jsonb),
    'card_catalog', coalesce((select jsonb_agg(jsonb_build_object('card_id',id,'edition',edition,'kind',kind) order by id)
      from public.achievement_card_catalog where active),'[]'::jsonb),
    'available_packs', coalesce((select jsonb_agg(jsonb_build_object('id',id,'earned_day',earned_day,'collection_key',collection_key) order by earned_day,id)
      from public.card_packs where user_id = actor and opened_at is null),'[]'::jsonb),
    'banners', coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'name',b.name,'description',b.description,'art_key',b.art_key,'price',b.price,
      'in_daily_shop',b.id=any(daily_ids),'owned',o.banner_id is not null,'equipped',e.banner_id is not null) order by b.id)
      from public.profile_banner_catalog b left join public.member_owned_banners o on o.banner_id=b.id and o.user_id=actor
      left join public.member_equipped_banners e on e.banner_id=b.id and e.user_id=actor where b.active or o.banner_id is not null),'[]'::jsonb),
    'equipped_banner_id',(select banner_id from public.member_equipped_banners where user_id=actor),
    'vouchers',voucher_rows,
    'discard_rewards',jsonb_build_object('common',1,'retro',2,'special',2,'epic',3,'legendary',5,'full_art',8,'vice_city',10)
  );
end;
$$;


create or replace function public.buy_profile_banner(target_banner_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := public.lock_banner_shop_actor();
  banner public.profile_banner_catalog%rowtype;
  new_balance bigint;
begin
  perform public.assert_account_security();
  select balance into new_balance from public.member_coin_wallets where user_id=actor;
  if exists(select 1 from public.member_owned_banners where user_id=actor and banner_id=target_banner_id) then
    return jsonb_build_object('banner_id',target_banner_id,'owned',true,'purchased',false,'balance',new_balance);
  end if;
  select * into banner from public.profile_banner_catalog where id=target_banner_id and active for share;
  if not found or not (target_banner_id=any(public.daily_banner_shop_ids())) then
    raise exception 'Este banner no está en la selección de hoy. Actualiza la tienda.';
  end if;
  if new_balance<banner.price then raise exception 'No tienes suficientes monedas.'; end if;
  update public.member_coin_wallets set balance=balance-banner.price where user_id=actor returning balance into new_balance;
  insert into public.member_owned_banners(user_id,banner_id) values(actor,banner.id);
  insert into public.member_coin_ledger(user_id,delta,balance_after,reason,item_id) values(actor,-banner.price,new_balance,'banner_purchase',banner.id);
  return jsonb_build_object('banner_id',banner.id,'owned',true,'purchased',true,'balance',new_balance);
end;
$$;

-- Receipts survive deleting/reassigning a trophy: the same achievement never
-- pays twice. No client can insert receipts or packs directly.
create table if not exists public.member_reward_pack_grants (
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_key text not null check(char_length(event_key) between 3 and 100),
  packs integer not null check(packs between 0 and 6),
  created_at timestamptz not null default now(),
  primary key(user_id,event_key)
);
alter table public.member_reward_pack_grants enable row level security;
revoke all on public.member_reward_pack_grants from public,anon,authenticated;
-- Existing trophies are marked consumed without granting historical rewards.
insert into public.member_reward_pack_grants(user_id,event_key,packs)
  select user_id,'achievement:'||achievement_id,0 from public.achievement_awards on conflict do nothing;

create or replace function public.grant_achievement_reward_packs()
returns trigger language plpgsql security definer set search_path = '' as $$
declare pack_count integer;
begin
  select case tier when 'bronze' then 1 when 'silver' then 2 when 'gold' then 4 when 'platinum' then 6 end
    into pack_count from public.achievements where id=new.achievement_id;
  if pack_count is null then return new; end if;
  insert into public.member_reward_pack_grants(user_id,event_key,packs)
    values(new.user_id,'achievement:'||new.achievement_id,pack_count) on conflict do nothing;
  if found then
    insert into public.card_packs(user_id,earned_day,source)
      select new.user_id,(statement_timestamp() at time zone 'Europe/Madrid')::date,'achievement'
      from generate_series(1,pack_count);
  end if;
  return new;
end;
$$;
revoke all on function public.grant_achievement_reward_packs() from public,anon,authenticated;
drop trigger if exists grant_achievement_reward_packs on public.achievement_awards;
create trigger grant_achievement_reward_packs after insert on public.achievement_awards
  for each row execute function public.grant_achievement_reward_packs();

-- Only daily grants advance the daily-pack goal. Trophy rewards must not
-- recursively complete daily-pack goals and mint further trophy rewards.
create or replace function public.track_daily_pack_achievement()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.source in ('daily','daily_streak') then
    perform public.record_achievement_activity(new.user_id,'daily_packs_earned','pack:'||new.id::text);
  end if;
  return new;
end;
$$;
revoke all on function public.track_daily_pack_achievement() from public,anon,authenticated;

create or replace function public.claim_daily_card_pack()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := public.lock_banner_shop_actor();
  today date := (statement_timestamp() at time zone 'Europe/Madrid')::date;
  new_daily integer := 0;
  bonus_count integer := 0;
  streak integer;
  daily_count integer;
  available_count bigint;
  total_count bigint;
begin
  perform public.assert_account_security();
  insert into public.card_packs(user_id,earned_day,source) values(actor,today,'daily')
    on conflict(user_id,earned_day) where source='daily' do nothing;
  get diagnostics new_daily=row_count;
  -- Uses historical, server-issued daily packs; opening a pack never affects it.
  select count(*)::integer into streak from (
    select earned_day,row_number() over(order by earned_day desc) n
    from public.card_packs where user_id=actor and source='daily' and earned_day<=today
  ) days where today-earned_day=n-1;
  daily_count:=case when streak>=30 then 5 when streak>=14 then 4 when streak>=7 then 3 when streak>=3 then 2 else 1 end;
  insert into public.member_reward_pack_grants(user_id,event_key,packs)
    values(actor,'daily:'||today,daily_count-1) on conflict do nothing;
  if found then
    bonus_count:=daily_count-1;
    insert into public.card_packs(user_id,earned_day,source)
      select actor,today,'daily_streak' from generate_series(1,bonus_count);
  end if;
  select count(*) filter(where opened_at is null),count(*) into available_count,total_count
    from public.card_packs where user_id=actor;
  return jsonb_build_object('available',available_count,'total',total_count,'credited',new_daily+bonus_count>0,
    'credited_packs',new_daily+bonus_count,'streak_days',streak,'daily_reward_packs',daily_count,
    'day',today,'next_reset_at',((today+1)::timestamp at time zone 'Europe/Madrid'));
end;
$$;
revoke all on function public.claim_daily_card_pack(),public.get_banner_shop_state(),public.buy_profile_banner(text) from public,anon,authenticated;
grant execute on function public.claim_daily_card_pack(),public.get_banner_shop_state(),public.buy_profile_banner(text) to authenticated;
notify pgrst,'reload schema';
commit;

-- Streak protector: bought with coins, at most two held. On the next daily
-- claim, missed days are covered automatically when there are enough
-- protectors for the whole gap; otherwise the streak breaks and they are kept.

create table if not exists public.member_streak_shields (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  shields smallint not null default 0 check (shields between 0 and 2),
  updated_at timestamptz not null default now()
);
create table if not exists public.member_streak_covered_days (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.member_streak_shields enable row level security;
alter table public.member_streak_covered_days enable row level security;
drop policy if exists "Own streak shields" on public.member_streak_shields;
create policy "Own streak shields" on public.member_streak_shields for select to authenticated using (user_id = auth.uid());
drop policy if exists "Own covered days" on public.member_streak_covered_days;
create policy "Own covered days" on public.member_streak_covered_days for select to authenticated using (user_id = auth.uid());
revoke all on public.member_streak_shields, public.member_streak_covered_days from anon;
revoke insert, update, delete on public.member_streak_shields, public.member_streak_covered_days from authenticated;

alter table public.member_coin_ledger drop constraint if exists member_coin_ledger_reason_check;
alter table public.member_coin_ledger add constraint member_coin_ledger_reason_check check (reason = any (array[
  'duplicate_discard','banner_purchase','admin_grant','admin_adjust','chota_purchase','mission_reward',
  'streak_shield','market_purchase','market_sale']));

-- One definition of the streak: consecutive days with a daily pack or a covered day.
create or replace function public.daily_pack_streak(actor uuid, upto date)
returns integer language sql stable security definer set search_path to '' as $$
  select count(*)::integer from (
    select day, row_number() over(order by day desc) n from (
      select earned_day as day from public.card_packs where user_id=actor and source='daily' and earned_day<=upto
      union
      select day from public.member_streak_covered_days where user_id=actor and day<=upto
    ) days
  ) ranked where upto-day=n-1;
$$;
revoke all on function public.daily_pack_streak(uuid,date) from public, anon, authenticated;

create or replace function public.record_daily_streak_progress(actor uuid, upto date)
returns void language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare streak integer:=public.daily_pack_streak(actor,upto); step integer;
begin
  for step in 1..coalesce(streak,0) loop
    perform public.record_achievement_activity(actor,'daily_streak_best','streak:'||step);
  end loop;
end $$;
revoke all on function public.record_daily_streak_progress(uuid,date) from public,anon,authenticated;

create or replace function public.buy_streak_shield(expected_price integer)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare actor uuid:=public.lock_banner_shop_actor(); price constant integer:=80; held integer; new_balance bigint;
begin
  perform public.assert_account_security();
  if expected_price is distinct from price then raise exception 'El precio cambió. Actualiza antes de comprar.'; end if;
  select coalesce((select shields from public.member_streak_shields where user_id=actor),0) into held;
  if held>=2 then raise exception 'Ya tienes el máximo de 2 protectores.'; end if;
  select balance into new_balance from public.member_coin_wallets where user_id=actor;
  if coalesce(new_balance,0)<price then raise exception 'No tienes suficientes monedas.'; end if;
  update public.member_coin_wallets set balance=balance-price where user_id=actor returning balance into new_balance;
  insert into public.member_coin_ledger(user_id,delta,balance_after,reason,item_id,copies)
    values(actor,-price,new_balance,'streak_shield','streak-shield',1);
  insert into public.member_streak_shields(user_id,shields) values(actor,1)
    on conflict(user_id) do update set shields=public.member_streak_shields.shields+1, updated_at=now();
  return jsonb_build_object('shields',held+1,'balance',new_balance,'price',price);
end $$;
revoke all on function public.buy_streak_shield(integer) from public, anon;
grant execute on function public.buy_streak_shield(integer) to authenticated;

create or replace function public.claim_daily_card_pack()
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare
  actor uuid:=public.lock_banner_shop_actor();
  today date:=(statement_timestamp() at time zone 'Europe/Madrid')::date;
  removed_today boolean; new_daily integer:=0; bonus_count integer:=0; streak integer; daily_count integer;
  welcome_count integer:=0; receipt_count integer; welcome_awarded boolean;
  available_count bigint; total_count bigint; activity_rewards jsonb; daily_coins integer; credited_coins integer:=0;
  last_day date; gap integer; held integer:=0; shields_used integer:=0;
begin
  perform public.assert_account_security();

  -- The existing per-account wallet lock serializes concurrent callers. The
  -- primary key is a second safeguard. Receipt and twenty packs commit together.
  insert into club_rewards.first_login_pack_rewards(user_id,awarded_packs)
    values(actor,20) on conflict(user_id) do nothing;
  get diagnostics receipt_count=row_count;
  if receipt_count=1 then
    welcome_count:=20;
    insert into public.card_packs(user_id,earned_day,source)
      select actor,today,'welcome' from generate_series(1,welcome_count);
  end if;
  select awarded_packs=20 into welcome_awarded
    from club_rewards.first_login_pack_rewards where user_id=actor;

  select exists(select 1 from public.admin_removed_daily_pack_claims
    where user_id=actor and earned_day=today) into removed_today;
  select coalesce((select shields from public.member_streak_shields where user_id=actor),0) into held;
  -- Protectors cover the missed days before today's pack is recorded, so the
  -- streak trophies triggered by that insert already see an unbroken streak.
  if not removed_today and held>0 and not exists(select 1 from public.card_packs
      where user_id=actor and source='daily' and earned_day=today) then
    select max(day) into last_day from (
      select earned_day as day from public.card_packs where user_id=actor and source='daily' and earned_day<today
      union all
      select day from public.member_streak_covered_days where user_id=actor and day<today) known;
    gap:=today-last_day-1;
    if last_day is not null and gap between 1 and held then
      insert into public.member_streak_covered_days(user_id,day)
        select actor,(last_day+offset_days)::date from generate_series(1,gap) offset_days on conflict do nothing;
      update public.member_streak_shields set shields=shields-gap, updated_at=now() where user_id=actor;
      shields_used:=gap; held:=held-gap;
    end if;
  end if;
  if not removed_today then
    insert into public.card_packs(user_id,earned_day,source) values(actor,today,'daily')
      on conflict(user_id,earned_day) where source='daily' do nothing;
    get diagnostics new_daily=row_count;
  end if;
  streak:=public.daily_pack_streak(actor,today);
  daily_count:=case when streak>=30 then 6 when streak>=14 then 5 when streak>=7 then 4 when streak>=3 then 3 else 2 end;
  daily_coins:=case when streak>=30 then 30 when streak>=14 then 25 when streak>=7 then 20 when streak>=3 then 15 else 10 end;
  if not removed_today then
    insert into public.member_reward_pack_grants(user_id,event_key,packs)
      values(actor,'daily:'||today,daily_count-1) on conflict do nothing;
    if found then
      bonus_count:=daily_count-1;
      insert into public.card_packs(user_id,earned_day,source)
        select actor,today,'daily_streak' from generate_series(1,bonus_count);
    elsif exists(select 1 from public.member_reward_pack_grants where user_id=actor and event_key='daily:'||today and packs<daily_count-1) then
      -- Members who already claimed today under the old tiers get the extra pack once.
      update public.member_reward_pack_grants set packs=daily_count-1 where user_id=actor and event_key='daily:'||today;
      bonus_count:=1;
      insert into public.card_packs(user_id,earned_day,source) values(actor,today,'daily_streak');
    end if;
    credited_coins:=club_rewards.award_coins(actor,'login:'||today,'login',daily_coins);
  end if;
  select count(*) filter(where opened_at is null),count(*) into available_count,total_count
    from public.card_packs where user_id=actor;
  select jsonb_object_agg(activity,exists(select 1 from public.member_reward_pack_grants g
    where g.user_id=actor and g.event_key='activity:'||activity||':'||today))
    into activity_rewards from unnest(array['message','poll','event']) activity;
  return jsonb_build_object('available',available_count,'total',total_count,'credited',new_daily+bonus_count+welcome_count>0,
    'credited_packs',new_daily+bonus_count+welcome_count,'streak_days',streak,'daily_reward_packs',daily_count,
    'daily_reward_coins',daily_coins,'credited_coins',credited_coins,
    'balance',(select balance from public.member_coin_wallets where user_id=actor),
    'streak_shields',held,'streak_shields_used',shields_used,'streak_shield_price',80,'streak_shield_limit',2,
    'welcome_credited_packs',welcome_count,'welcome_received',coalesce(welcome_awarded,false),
    'activity_rewards',activity_rewards,'activity_reward_limit',3,
    'day',today,'next_reset_at',((today+1)::timestamp at time zone 'Europe/Madrid'));
end; $function$;

notify pgrst,'reload schema';

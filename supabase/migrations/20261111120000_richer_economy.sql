-- A more generous economy: every coin reward pays double, duplicates are worth
-- half again, each streak tier gives one more daily pack, every daily activity
-- gives two packs, the luck guarantees come sooner and themed packs cost less.
begin;

-- Every coin reward passes through award_coins. Callers keep their base
-- amounts; the multiplier is applied here, once.
create or replace function club_rewards.coin_multiplier()
returns integer language sql immutable set search_path = '' as $$ select 2 $$;

create or replace function club_rewards.award_coins(actor uuid, reward_key text, reward_category text, amount integer, details jsonb default '{}'::jsonb)
returns integer language plpgsql security definer set search_path = '' as $function$
declare balance_after bigint; credited integer;
begin
  perform public.assert_account_security();
  if actor is null or actor is distinct from auth.uid() then raise exception 'Cuenta no válida.' using errcode='42501'; end if;
  perform public.lock_banner_shop_actor();
  if amount not between 1 and 60 then raise exception 'Premio no válido.' using errcode='22023'; end if;
  credited := amount * club_rewards.coin_multiplier();
  insert into club_rewards.coin_receipts(user_id,reward_id,category,coins,metadata)
    values(actor,reward_key,reward_category,credited,details) on conflict do nothing;
  if not found then return 0; end if;
  update public.member_coin_wallets set balance=balance+credited where user_id=actor returning balance into balance_after;
  insert into public.member_coin_ledger(user_id,delta,balance_after,reason,item_id,copies)
    values(actor,credited,balance_after,'mission_reward',reward_key,1);
  return credited;
end $function$;

-- Missions show what they will really pay. Receipts of shared photos already
-- hold the credited amount and are shown as they are.
create or replace function public.get_club_coin_missions()
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
declare actor uuid:=auth.uid(); missions jsonb;
begin
  perform public.assert_account_security();
  if actor is null or not exists(select 1 from public.profiles where id=actor and not is_hidden) then raise exception 'Inicia sesión en el club.' using errcode='42501'; end if;
  select coalesce(jsonb_agg(m||jsonb_build_object('description',replace(m->>'description','20 monedas por plan','40 monedas por plan'),'coins',
      case when m->>'category'='memory' and m->>'id'<>'memory-info' then (m->>'coins')::integer else (m->>'coins')::integer*club_rewards.coin_multiplier() end,
      'claimed',r.reward_id is not null,'earned_coins',r.coins)),'[]'::jsonb) into missions
    from club_rewards.coin_mission_rows(actor) m left join club_rewards.coin_receipts r on r.user_id=actor and r.reward_id=m->>'id';
  return jsonb_build_object('balance',coalesce((select balance from public.member_coin_wallets where user_id=actor),0),
    'earned_total',coalesce((select sum(coins) from club_rewards.coin_receipts where user_id=actor),0),'missions',missions);
end $function$;

-- Duplicates: half again for every rarity.
create or replace function public.card_discard_reward(p_edition text)
returns integer language sql immutable set search_path = '' as $function$
 select case p_edition when 'common' then 3 when 'retro' then 6 when 'special' then 6 when 'epic' then 9
  when 'legendary' then 15 when 'full_art' then 24 when 'vice_city' then 30 when 'halloween' then 30 end
$function$;

-- Luck: a top card at the latest every 10 packs, a boosted pack every 20 openings.
create or replace function public.pack_luck_rules()
returns jsonb language sql immutable set search_path = '' as $function$
  select jsonb_build_object('pity_after', 10, 'boost_every', 20,
    'top_editions', jsonb_build_array('legendary','full_art','vice_city','halloween'),
    'boost_editions', jsonb_build_array('epic','legendary','full_art','vice_city','halloween'))
$function$;

create or replace function public.themed_pack_price()
returns integer language sql immutable set search_path = '' as $$ select 90 $$;

-- Each daily activity (message, poll, plan) now gives two packs.
create or replace function club_rewards.grant_activity_pack(p_user uuid, p_activity text)
returns void language plpgsql security definer set search_path = '' as $function$
declare today date:=(statement_timestamp() at time zone 'Europe/Madrid')::date;
begin
  if auth.uid() is null or auth.uid() is distinct from p_user
     or p_activity not in ('message','poll','event') then return; end if;
  perform public.assert_account_security();
  if not exists(select 1 from public.profiles where id=p_user and not coalesce(is_hidden,false)) then return; end if;
  insert into public.member_reward_pack_grants(user_id,event_key,packs)
    values(p_user,'activity:'||p_activity||':'||today,2) on conflict do nothing;
  if found then
    insert into public.card_packs(user_id,earned_day,source)
      select p_user,today,'activity_'||p_activity from generate_series(1,2);
  end if;
end; $function$;

-- Daily packs: one more at every streak tier (3, 4, 5, 6, 7). The coins shown
-- are what award_coins will credit.
create or replace function public.claim_daily_card_pack()
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare
  actor uuid:=public.lock_banner_shop_actor();
  today date:=(statement_timestamp() at time zone 'Europe/Madrid')::date;
  removed_today boolean; new_daily integer:=0; bonus_count integer:=0; streak integer; daily_count integer;
  welcome_count integer:=0; receipt_count integer; welcome_awarded boolean;
  available_count bigint; total_count bigint; activity_rewards jsonb; daily_coins integer; credited_coins integer:=0;
  last_day date; gap integer; held integer:=0; shields_used integer:=0;
begin
  perform public.assert_account_security();
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
  daily_count:=case when streak>=30 then 7 when streak>=14 then 6 when streak>=7 then 5 when streak>=3 then 4 else 3 end;
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
    'daily_reward_coins',daily_coins*club_rewards.coin_multiplier(),'credited_coins',credited_coins,
    'balance',(select balance from public.member_coin_wallets where user_id=actor),
    'streak_shields',held,'streak_shields_used',shields_used,'streak_shield_price',80,'streak_shield_limit',2,
    'welcome_credited_packs',welcome_count,'welcome_received',coalesce(welcome_awarded,false),
    'activity_rewards',activity_rewards,'activity_reward_limit',3,'activity_reward_packs',2,
    'day',today,'next_reset_at',((today+1)::timestamp at time zone 'Europe/Madrid'));
end; $function$;


-- Packs from the arcade and the club goals: twice as many.
create or replace function public.claim_chota_weekly_reward()
returns jsonb language plpgsql security definer set search_path = '' as $function$ declare status jsonb; actor uuid:=auth.uid(); wk text; begin
 status:=public.get_chota_weekly_challenge(); wk:=status->>'week_start';
 if not (status->>'club_complete')::boolean or (status->>'my_best')::integer<(status->>'target')::integer then raise exception 'Completa tu reto y reúne a tres miembros esta semana.' using errcode='22023'; end if;
 insert into public.member_reward_pack_grants(user_id,event_key,packs) values(actor,'arcade-week:'||wk,4) on conflict do nothing;
 if not found then return jsonb_build_object('awarded',false,'packs',0); end if;
 insert into public.card_packs(user_id,earned_day,source) select actor,(now() at time zone 'Europe/Madrid')::date,'arcade_weekly' from generate_series(1,4);
 return jsonb_build_object('awarded',true,'packs',4); end $function$;

create or replace function public.get_chota_weekly_challenge()
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
declare actor uuid:=auth.uid(); wk date:=date_trunc('week',now() at time zone 'Europe/Madrid')::date; selected_game text; target_score integer; qualifying integer; mine integer; board jsonb; begin
 perform public.assert_account_security();
 if actor is null or not exists(select 1 from public.profiles where id=actor and not is_hidden) then raise exception 'Inicia sesión en el club.' using errcode='42501'; end if;
 selected_game:=(array['football','skateboard','robot-vacuum'])[1+(((wk-date '2026-10-19')/7)%3+3)%3];
 target_score:=case selected_game when 'football' then 15 when 'skateboard' then 10 else 15 end;
 select count(*) into qualifying from club_arcade.weekly_scores s join public.profiles p on p.id=s.user_id where s.week_start=wk and s.game=selected_game and s.score>=target_score and not p.is_hidden;
 select s.score into mine from club_arcade.weekly_scores s where s.week_start=wk and s.game=selected_game and s.user_id=actor;
 select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into board from (select s.user_id,p.display_name as name,s.score from club_arcade.weekly_scores s join public.profiles p on p.id=s.user_id where s.week_start=wk and s.game=selected_game and not p.is_hidden order by s.score desc,s.achieved_at limit 20) r;
 return jsonb_build_object('week_start',wk,'ends_at',(wk+7)::timestamp at time zone 'Europe/Madrid','game',selected_game,'target',target_score,'participants',qualifying,'club_goal',3,'club_reward_packs',4,'my_best',coalesce(mine,0),'reward_claimed',exists(select 1 from public.member_reward_pack_grants where user_id=actor and event_key='arcade-week:'||wk),'club_complete',qualifying>=3,'leaderboard',board);
end $function$;

create or replace function public.claim_club_social_season()
returns jsonb language plpgsql security definer set search_path = '' as $function$ declare actor uuid; status jsonb; begin
 perform public.assert_account_security();
 actor:=public.lock_banner_shop_actor(); status:=club_social.month_status(actor);
 if not (status->>'complete')::boolean or not (status->>'contributed')::boolean then raise exception 'Completa el objetivo del club y participa en uno de sus planes, recuerdos o intercambios.' using errcode='22023'; end if;
 insert into public.member_reward_pack_grants(user_id,event_key,packs) values(actor,'social-month:'||(status->>'month'),5) on conflict do nothing;
 if not found then return jsonb_build_object('awarded',false,'packs',0); end if;
 insert into public.card_packs(user_id,earned_day,source) select actor,(now() at time zone 'Europe/Madrid')::date,'club_social_season' from generate_series(1,5);
 return jsonb_build_object('awarded',true,'packs',5); end $function$;

revoke all on function club_rewards.coin_multiplier() from public, anon, authenticated;
notify pgrst, 'reload schema';
commit;

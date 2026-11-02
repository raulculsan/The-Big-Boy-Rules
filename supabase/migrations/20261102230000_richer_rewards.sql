-- Richer rewards: more coins for duplicates and missions, daily coins for
-- logging in, one more daily pack at every streak tier and more trophy packs.

-- 1. Duplicate values double and live in one place.
create or replace function public.card_discard_reward(p_edition text)
returns integer language sql immutable set search_path = '' as $$
 select case p_edition when 'common' then 2 when 'retro' then 4 when 'special' then 4 when 'epic' then 6
  when 'legendary' then 10 when 'full_art' then 16 when 'vice_city' then 20 when 'halloween' then 20 end
$$;

create or replace function public.discard_duplicate_card(target_card_id text, copies integer default 1)
returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
declare
  actor uuid := public.lock_banner_shop_actor();
  held integer;
  reward integer;
  earned bigint;
  new_balance bigint;
begin
  if copies is null or copies < 1 then raise exception 'La cantidad de copias no es válida.'; end if;
  select quantity into held from public.member_card_inventory where user_id=actor and card_id=target_card_id for update;
  if held is null or copies >= held then raise exception 'Solo puedes descartar cartas repetidas; conserva una copia.'; end if;
  select public.card_discard_reward(edition) into reward from public.achievement_card_catalog where id=target_card_id;
  if reward is null then raise exception 'La rareza de la carta no tiene un valor de descarte.'; end if;
  earned := copies::bigint * reward;
  update public.member_card_inventory set quantity=quantity-copies where user_id=actor and card_id=target_card_id;
  update public.member_coin_wallets set balance=balance+earned where user_id=actor returning balance into new_balance;
  insert into public.member_coin_ledger(user_id,delta,balance_after,reason,item_id,copies)
    values (actor,earned,new_balance,'duplicate_discard',target_card_id,copies);
  return jsonb_build_object('card_id',target_card_id,'quantity',held-copies,'coins_earned',earned,'balance',new_balance);
end;
$function$;

create or replace function public.discard_all_duplicate_cards()
returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
declare
  actor uuid := public.lock_banner_shop_actor();
  duplicate record;
  discarded integer;
  earned bigint;
  total_earned bigint := 0;
  total_copies bigint := 0;
  affected integer := 0;
  new_balance bigint;
  discarded_cards jsonb := '[]'::jsonb;
begin
  select balance into new_balance from public.member_coin_wallets where user_id=actor;
  for duplicate in
    select i.card_id,i.quantity,public.card_discard_reward(c.edition) as reward
    from public.member_card_inventory i
    join public.achievement_card_catalog c on c.id=i.card_id
    where i.user_id=actor and i.quantity>1
    order by i.card_id for update of i
  loop
    if duplicate.reward is null then raise exception 'La rareza de la carta no tiene un valor de descarte.'; end if;
    discarded := duplicate.quantity-1;
    earned := discarded::bigint*duplicate.reward;
    update public.member_card_inventory set quantity=1 where user_id=actor and card_id=duplicate.card_id;
    new_balance := new_balance+earned;
    insert into public.member_coin_ledger(user_id,delta,balance_after,reason,item_id,copies)
      values (actor,earned,new_balance,'duplicate_discard',duplicate.card_id,discarded);
    total_earned := total_earned+earned;
    total_copies := total_copies+discarded;
    affected := affected+1;
    discarded_cards := discarded_cards || jsonb_build_array(jsonb_build_object(
      'card_id',duplicate.card_id,'quantity',1,'copies_discarded',discarded,'coins_earned',earned));
  end loop;
  if affected>0 then
    update public.member_coin_wallets set balance=new_balance where user_id=actor;
  end if;
  return jsonb_build_object('copies_discarded',total_copies,'cards_affected',affected,
    'coins_earned',total_earned,'balance',new_balance,'cards',discarded_cards);
end;
$function$;

create or replace function public.discard_selected_duplicates(p_items jsonb)
returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
declare
  actor uuid := public.lock_banner_shop_actor();
  picked record;
  held integer;
  reward integer;
  earned bigint;
  total_earned bigint := 0;
  total_copies bigint := 0;
  new_balance bigint;
  discarded_cards jsonb := '[]'::jsonb;
begin
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 500 then
    raise exception 'Elige al menos una carta.' using errcode='22023';
  end if;
  select balance into new_balance from public.member_coin_wallets where user_id=actor;
  for picked in
    select card_id,sum(copies)::integer as copies from jsonb_to_recordset(p_items) as x(card_id text,copies integer)
    group by card_id order by card_id
  loop
    if picked.card_id is null or picked.copies is null or picked.copies<1 then raise exception 'La cantidad de copias no es válida.' using errcode='22023'; end if;
    select quantity into held from public.member_card_inventory where user_id=actor and card_id=picked.card_id for update;
    if held is null or picked.copies>=held then raise exception 'Solo puedes descartar cartas repetidas; conserva una copia.' using errcode='22023'; end if;
    select public.card_discard_reward(edition) into reward from public.achievement_card_catalog where id=picked.card_id;
    if reward is null then raise exception 'La rareza de la carta no tiene un valor de descarte.'; end if;
    earned:=picked.copies::bigint*reward;
    update public.member_card_inventory set quantity=quantity-picked.copies where user_id=actor and card_id=picked.card_id;
    new_balance:=new_balance+earned;
    insert into public.member_coin_ledger(user_id,delta,balance_after,reason,item_id,copies)
      values(actor,earned,new_balance,'duplicate_discard',picked.card_id,picked.copies);
    total_earned:=total_earned+earned;total_copies:=total_copies+picked.copies;
    discarded_cards:=discarded_cards||jsonb_build_array(jsonb_build_object('card_id',picked.card_id,'quantity',held-picked.copies,'copies_discarded',picked.copies,'coins_earned',earned));
  end loop;
  update public.member_coin_wallets set balance=new_balance where user_id=actor;
  return jsonb_build_object('copies_discarded',total_copies,'coins_earned',total_earned,'balance',new_balance,'cards',discarded_cards);
end $function$;

create or replace function public.get_banner_shop_state()
returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
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
    'banners', coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'name',b.name,'description',b.description,'art_key',b.art_key,'presentation',b.presentation,'price',b.price,
      'in_daily_shop',b.id=any(daily_ids),'owned',o.banner_id is not null,'equipped',e.banner_id is not null) order by b.id)
      from public.profile_banner_catalog b left join public.member_owned_banners o on o.banner_id=b.id and o.user_id=actor
      left join public.member_equipped_banners e on e.banner_id=b.id and e.user_id=actor where b.active or o.banner_id is not null),'[]'::jsonb),
    'equipped_banner_id',(select banner_id from public.member_equipped_banners where user_id=actor),
    'vouchers',voucher_rows,
    'discard_rewards',(select jsonb_object_agg(e,public.card_discard_reward(e))
      from unnest(array['common','retro','special','epic','legendary','full_art','vice_city','halloween']) e)
  );
end;
$function$;

-- 2. Mission receipts may carry up to 60 coins; logging in pays its own receipt.
alter table club_rewards.coin_receipts drop constraint coin_receipts_coins_check;
alter table club_rewards.coin_receipts add constraint coin_receipts_coins_check check (coins between 0 and 60);
alter table club_rewards.coin_receipts drop constraint coin_receipts_category_check;
alter table club_rewards.coin_receipts add constraint coin_receipts_category_check
  check (category = any (array['level','daily','weekly','club','memory','album','login']));

create or replace function club_rewards.award_coins(actor uuid, reward_key text, reward_category text, amount integer, details jsonb default '{}'::jsonb)
returns integer language plpgsql security definer set search_path to '' as $function$
declare balance_after bigint;
begin
  perform public.assert_account_security();
  if actor is null or actor is distinct from auth.uid() then raise exception 'Cuenta no válida.' using errcode='42501'; end if;
  perform public.lock_banner_shop_actor();
  if amount not between 1 and 60 then raise exception 'Premio no válido.' using errcode='22023'; end if;
  insert into club_rewards.coin_receipts(user_id,reward_id,category,coins,metadata)
    values(actor,reward_key,reward_category,amount,details) on conflict do nothing;
  if not found then return 0; end if;
  update public.member_coin_wallets set balance=balance+amount where user_id=actor returning balance into balance_after;
  insert into public.member_coin_ledger(user_id,delta,balance_after,reason,item_id,copies)
    values(actor,amount,balance_after,'mission_reward',reward_key,1);
  return amount;
end $function$;

-- 3. Daily claim: one more pack at every streak tier, plus coins that grow with the streak.
create or replace function public.claim_daily_card_pack()
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare
  actor uuid:=public.lock_banner_shop_actor();
  today date:=(statement_timestamp() at time zone 'Europe/Madrid')::date;
  removed_today boolean; new_daily integer:=0; bonus_count integer:=0; streak integer; daily_count integer;
  welcome_count integer:=0; receipt_count integer; welcome_awarded boolean;
  available_count bigint; total_count bigint; activity_rewards jsonb; daily_coins integer; credited_coins integer:=0;
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
  if not removed_today then
    insert into public.card_packs(user_id,earned_day,source) values(actor,today,'daily')
      on conflict(user_id,earned_day) where source='daily' do nothing;
    get diagnostics new_daily=row_count;
  end if;
  select count(*)::integer into streak from (
    select earned_day,row_number() over(order by earned_day desc) n
    from public.card_packs where user_id=actor and source='daily' and earned_day<=today
  ) days where today-earned_day=n-1;
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
    'welcome_credited_packs',welcome_count,'welcome_received',coalesce(welcome_awarded,false),
    'activity_rewards',activity_rewards,'activity_reward_limit',3,
    'day',today,'next_reset_at',((today+1)::timestamp at time zone 'Europe/Madrid'));
end; $function$;

-- 4. Trophies give more packs: bronze 2, silver 3, gold 5, platinum 8.
alter table public.member_reward_pack_grants drop constraint member_reward_pack_grants_packs_check;
alter table public.member_reward_pack_grants add constraint member_reward_pack_grants_packs_check check (packs between 0 and 10);
create or replace function public.grant_achievement_reward_packs()
returns trigger language plpgsql security definer set search_path to '' as $function$
declare pack_count integer;
begin
  select case tier when 'bronze' then 2 when 'silver' then 3 when 'gold' then 5 when 'platinum' then 8 end
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
$function$;

-- 5. Missions pay double.
create or replace function club_rewards.coin_mission_rows(actor uuid)
returns setof jsonb language plpgsql stable security definer set search_path to '' as $function$
declare today date:=(statement_timestamp() at time zone 'Europe/Madrid')::date;
  week_start date:=date_trunc('week',statement_timestamp() at time zone 'Europe/Madrid')::date;
  week_time timestamptz; next_week timestamptz; game_name text; game_title text;
  highest integer; n integer; done boolean; game_done boolean; plan_done boolean; memory_done boolean;
  month_status jsonb; month_progress integer; row_data record; seen_memories boolean:=false;
begin
  week_time:=week_start::timestamp at time zone 'Europe/Madrid';
  next_week:=(week_start+7)::timestamp at time zone 'Europe/Madrid';
  foreach game_name in array array['football','robot-vacuum'] loop
    game_title:=case game_name when 'football' then 'Un rato con la pelota' else 'La sede, limpia' end;
    done:=exists(select 1 from club_arcade.sessions s where s.user_id=actor and s.game=game_name
      and s.finished_at>=today::timestamp at time zone 'Europe/Madrid'
      and s.finished_at<(today+1)::timestamp at time zone 'Europe/Madrid'
      and s.reward_status in ('awarded','already_claimed'));
    return next jsonb_build_object('id','daily:'||today||':'||game_name,'category','daily','title',game_title,
      'description',case game_name when 'football' then 'Completa una partida de pelota con El Chota.' else 'Completa una partida de Roomba.' end,
      'coins',10,'current',done::integer,'target',1,'completed',done,'action',game_name,
      'ends_at',(today+1)::timestamp at time zone 'Europe/Madrid');
  end loop;
  foreach game_name in array array['football','skateboard','robot-vacuum'] loop
    game_title:=case game_name when 'football' then 'Pelota' when 'skateboard' then 'Skate' else 'Roomba' end;
    select coalesce(max(highest_completed),0) into highest from club_arcade.level_progress where user_id=actor and game=game_name;
    for n in 1..5 loop
      return next jsonb_build_object('id','level:'||game_name||':'||n,'category','level','title',game_title||' · Nivel '||n,
        'description','Supera este nivel por primera vez.','coins',(array[10,15,20,25,30])[n],
        'current',least(highest,n),'target',n,'completed',highest>=n,'action',game_name);
    end loop;
  end loop;
  game_done:=exists(select 1 from club_arcade.sessions where user_id=actor and finished_at>=week_time and finished_at<next_week and reward_status in ('awarded','already_claimed'));
  plan_done:=exists(select 1 from public.club_event_arrivals where user_id=actor and arrived_at>=week_time and arrived_at<next_week);
  memory_done:=exists(select 1 from club_rewards.coin_receipts where user_id=actor and category='memory' and coins>0 and created_at>=week_time and created_at<next_week);
  return next jsonb_build_object('id','weekly:'||week_start,'category','weekly','title','Una semana completa',
    'description','Completa una partida, registra tu llegada a un plan y comparte una foto de ese plan.',
    'coins',50,'current',game_done::integer+plan_done::integer+memory_done::integer,'target',3,
    'completed',game_done and plan_done and memory_done,'action','calendar','ends_at',next_week,
    'objectives',jsonb_build_array(jsonb_build_object('title','Completar una partida','completed',game_done),
      jsonb_build_object('title','Asistir a un plan','completed',plan_done),jsonb_build_object('title','Compartir una foto','completed',memory_done)));
  month_status:=club_social.month_status(actor);
  month_progress:=least(2,(month_status->>'plans')::integer)+least(5,(month_status->>'memories')::integer)+least(3,(month_status->>'trades')::integer);
  return next jsonb_build_object('id','club:'||(month_status->>'month'),'category','club','title','El club suma',
    'description','Entre todos: 2 planes con dos asistentes, 5 recuerdos y 3 parejas de intercambio. Participa para cobrar.',
    'coins',60,'current',month_progress,'target',10,'completed',(month_status->>'complete')::boolean and (month_status->>'contributed')::boolean,
    'contributed',(month_status->>'contributed')::boolean,'action','calendar','ends_at',month_status->'ends_at');
  for row_data in select r.reward_id,r.coins,r.metadata from club_rewards.coin_receipts r
    where r.user_id=actor and r.category='memory' and r.coins>0
      and r.created_at>statement_timestamp()-interval '30 days' order by r.created_at desc limit 15 loop
    seen_memories:=true;
    return next jsonb_build_object('id',row_data.reward_id,'category','memory','title',coalesce(row_data.metadata->>'title','Recuerdo del plan'),
      'description','Foto compartida con el club.','coins',row_data.coins,'current',1,'target',1,'completed',true,'action','calendar');
  end loop;
  if not seen_memories then
    return next jsonb_build_object('id','memory-info','category','memory','title','Un recuerdo del plan',
      'description','Asiste a un plan y comparte una foto real: 20 monedas por plan, hasta 3 planes al día.',
      'coins',20,'current',0,'target',1,'completed',false,'action','calendar');
  end if;
  -- The album uses 5 slots per leaf and reserved capacity within each kind.
  -- ID ordering is shared with album.js; a rarity always starts a fresh leaf.
  for row_data in
    with capacities(edition,member_slots,location_slots,object_slots) as (values
      ('common',12,4,4),('retro',8,6,6),('special',6,7,7),('epic',6,7,7),('legendary',6,7,7),
      ('full_art',10,5,5),('vice_city',10,5,5),('halloween',10,5,5)),
    cards as (select c.id,c.collection_key,c.edition,c.kind,coalesce(i.quantity,0)>0 owned
      from public.achievement_card_catalog c join public.published_card_designs d on d.id=c.id and d.published
      left join public.member_card_inventory i on i.user_id=actor and i.card_id=c.id
      where c.active),
    kind_counts as (select collection_key,edition,count(*) filter(where kind='member') members,
      count(*) filter(where kind='location') locations from cards group by collection_key,edition),
    slots as (select c.*,row_number() over(partition by c.collection_key,c.edition,c.kind order by c.id collate "C")
      +case c.kind when 'location' then greatest(k.members,p.member_slots)
       when 'object' then greatest(k.members,p.member_slots)+greatest(k.locations,p.location_slots) else 0 end slot
      from cards c join kind_counts k using(collection_key,edition) join capacities p using(edition)),
    totals as (select collection_key,edition,((slot-1)/5)::integer+1 page,count(*) target,count(*) filter(where owned) current from slots group by collection_key,edition,((slot-1)/5)::integer+1)
    select * from totals order by collection_key,edition,page loop
    return next jsonb_build_object('id','album-page:'||row_data.collection_key||':'||row_data.edition||':'||row_data.page,
      'category','album','title',club_rewards.coin_rarity_title(row_data.edition)||' · Página '||row_data.page,
      'description','Consigue todas las cartas publicadas de esta página.','coins',20,'current',row_data.current,'target',row_data.target,
      'completed',row_data.current=row_data.target,'action','album','collection_key',row_data.collection_key,'rarity',row_data.edition,'page',row_data.page);
  end loop;
  for row_data in select c.collection_key,c.edition,count(*) target,count(*) filter(where i.quantity>0) current
    from public.achievement_card_catalog c join public.published_card_designs d on d.id=c.id and d.published
    left join public.member_card_inventory i on i.user_id=actor and i.card_id=c.id where c.active group by c.collection_key,c.edition loop
    return next jsonb_build_object('id','album-category:'||row_data.collection_key||':'||row_data.edition,
      'category','album','title',club_rewards.coin_rarity_title(row_data.edition)||' al completo',
      'description','Completa todas las cartas publicadas de esta rareza.','coins',60,'current',row_data.current,'target',row_data.target,
      'completed',row_data.current=row_data.target,'action','album','collection_key',row_data.collection_key,'rarity',row_data.edition);
  end loop;
end $function$;

create or replace function public.submit_chota_level_score(game_session_id uuid, submitted_score integer, completed_round boolean default false, level_won boolean default false)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare actor uuid; result jsonb; session_row club_arcade.sessions%rowtype; coins integer:=0; today date:=(statement_timestamp() at time zone 'Europe/Madrid')::date;
begin
  perform public.assert_account_security(); actor:=public.lock_banner_shop_actor();
  select * into session_row from club_arcade.sessions where id=game_session_id and user_id=actor for update;
  -- Match the existing daily pack minimum; a forged instant win cannot advance
  -- a level and then bypass validation through the manual milestone claim.
  if session_row.finished_at is null and extract(epoch from clock_timestamp()-session_row.started_at)<12 then level_won:=false; end if;
  result:=club_rewards.submit_chota_level_score_base(game_session_id,submitted_score,completed_round,level_won);
  select * into session_row from club_arcade.sessions where id=game_session_id and user_id=actor;
  if session_row.level_cleared then
    coins:=coins+club_rewards.award_coins(actor,'level:'||session_row.game||':'||session_row.level,'level',(array[10,15,20,25,30])[session_row.level]);
  end if;
  if session_row.game in('football','robot-vacuum') and session_row.reward_status in('awarded','already_claimed')
    and session_row.finished_at>=today::timestamp at time zone 'Europe/Madrid' and session_row.finished_at<(today+1)::timestamp at time zone 'Europe/Madrid' then
    coins:=coins+club_rewards.award_coins(actor,'daily:'||today||':'||session_row.game,'daily',10);
  end if;
  return result||jsonb_build_object('awarded_coins',coins,'coin_balance',(select balance from public.member_coin_wallets where user_id=actor));
end $function$;

create or replace function club_rewards.reward_plan_photo()
returns trigger language plpgsql security definer set search_path to '' as $function$
declare today date:=(statement_timestamp() at time zone 'Europe/Madrid')::date; actor uuid:=auth.uid(); title text; photo_exists boolean;
begin
  if new.created_by is distinct from actor or actor is null or new.occurrence>today or new.occurrence<today-30 then return new; end if;
  -- Captions alone or fabricated storage paths are not a rewarded photo.
  photo_exists:=(new.media_type='image' and new.media_path is not null and exists(select 1 from storage.objects o where o.bucket_id='club-memories' and o.name=new.media_path and o.name like actor::text||'/'||new.event_id||'/%'))
    or (new.moment_id is not null and exists(select 1 from public.moments m where m.id=new.moment_id and m.user_id=actor and m.media_type='image'));
  if not coalesce(photo_exists,false) or not exists(select 1 from public.club_event_arrivals a where a.event_id=new.event_id and a.occurrence=new.occurrence and a.user_id=actor) then return new; end if;
  perform public.assert_account_security(); perform public.lock_banner_shop_actor();
  if (select count(*) from club_rewards.coin_receipts where user_id=actor and category='memory' and coins>0 and created_at>=today::timestamp at time zone 'Europe/Madrid' and created_at<(today+1)::timestamp at time zone 'Europe/Madrid')>=3 then return new; end if;
  select e.title into title from public.group_events e where e.id=new.event_id;
  perform club_rewards.award_coins(actor,'memory:'||new.event_id||':'||new.occurrence,'memory',20,jsonb_build_object('title',title));
  return new;
end $function$;

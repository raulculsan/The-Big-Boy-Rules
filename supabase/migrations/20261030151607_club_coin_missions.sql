begin;

-- Durable economy receipts are never writable through the Data API.
create schema if not exists club_rewards;
revoke all on schema club_rewards from public,anon,authenticated;
create table club_rewards.coin_receipts (
  user_id uuid not null references auth.users(id) on delete cascade,
  reward_id text not null check(length(reward_id) between 1 and 240),
  category text not null check(category in ('level','daily','weekly','club','memory','album')),
  coins smallint not null check(coins between 0 and 30),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default statement_timestamp(),
  primary key(user_id,reward_id)
);
alter table club_rewards.coin_receipts enable row level security;
revoke all on club_rewards.coin_receipts from public,anon,authenticated;
create index coin_receipts_user_time_idx on club_rewards.coin_receipts(user_id,created_at desc);
-- Existing levels and old memories are consumed, not retroactive grants.
insert into club_rewards.coin_receipts(user_id,reward_id,category,coins)
  select p.user_id,'level:'||p.game||':'||n,'level',0
  from club_arcade.level_progress p cross join lateral generate_series(1,p.highest_completed) n;
insert into club_rewards.coin_receipts(user_id,reward_id,category,coins)
  select distinct created_by,'memory:'||event_id||':'||occurrence,'memory',0
  from public.club_event_memories on conflict do nothing;

alter table public.member_coin_ledger drop constraint member_coin_ledger_reason_check;
alter table public.member_coin_ledger add constraint member_coin_ledger_reason_check check(reason in
  ('duplicate_discard','banner_purchase','admin_grant','admin_adjust','chota_purchase','mission_reward'));

-- Every caller takes the same wallet lock before changing the economy. A receipt,
-- balance and ledger entry commit (or roll back) together, even on concurrent retries.
create function club_rewards.award_coins(actor uuid,reward_key text,reward_category text,amount integer,details jsonb default '{}'::jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare balance_after bigint;
begin
  perform public.assert_account_security();
  if actor is null or actor is distinct from auth.uid() then raise exception 'Cuenta no válida.' using errcode='42501'; end if;
  perform public.lock_banner_shop_actor();
  if amount not between 1 and 30 then raise exception 'Premio no válido.' using errcode='22023'; end if;
  insert into club_rewards.coin_receipts(user_id,reward_id,category,coins,metadata)
    values(actor,reward_key,reward_category,amount,details) on conflict do nothing;
  if not found then return 0; end if;
  update public.member_coin_wallets set balance=balance+amount where user_id=actor returning balance into balance_after;
  insert into public.member_coin_ledger(user_id,delta,balance_after,reason,item_id,copies)
    values(actor,amount,balance_after,'mission_reward',reward_key,1);
  return amount;
end $$;
revoke all on function club_rewards.award_coins(uuid,text,text,integer,jsonb) from public,anon,authenticated;

-- State and claim use one shared server definition. No caller supplies card IDs,
-- scores, user IDs, reward quantities, reset dates or completion booleans here.
create function club_rewards.coin_mission_rows(actor uuid)
returns setof jsonb language plpgsql stable security definer set search_path='' as $$
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
      'coins',5,'current',done::integer,'target',1,'completed',done,'action',game_name,
      'ends_at',(today+1)::timestamp at time zone 'Europe/Madrid');
  end loop;
  foreach game_name in array array['football','skateboard','robot-vacuum'] loop
    game_title:=case game_name when 'football' then 'Pelota' when 'skateboard' then 'Skate' else 'Roomba' end;
    select coalesce(max(highest_completed),0) into highest from club_arcade.level_progress where user_id=actor and game=game_name;
    for n in 1..5 loop
      return next jsonb_build_object('id','level:'||game_name||':'||n,'category','level','title',game_title||' · Nivel '||n,
        'description','Supera este nivel por primera vez.','coins',(array[5,8,10,12,15])[n],
        'current',least(highest,n),'target',n,'completed',highest>=n,'action',game_name);
    end loop;
  end loop;
  game_done:=exists(select 1 from club_arcade.sessions where user_id=actor and finished_at>=week_time and finished_at<next_week and reward_status in ('awarded','already_claimed'));
  plan_done:=exists(select 1 from public.club_event_arrivals where user_id=actor and arrived_at>=week_time and arrived_at<next_week);
  memory_done:=exists(select 1 from club_rewards.coin_receipts where user_id=actor and category='memory' and coins>0 and created_at>=week_time and created_at<next_week);
  return next jsonb_build_object('id','weekly:'||week_start,'category','weekly','title','Una semana completa',
    'description','Completa una partida, registra tu llegada a un plan y comparte una foto de ese plan.',
    'coins',25,'current',game_done::integer+plan_done::integer+memory_done::integer,'target',3,
    'completed',game_done and plan_done and memory_done,'action','calendar','ends_at',next_week,
    'objectives',jsonb_build_array(jsonb_build_object('title','Completar una partida','completed',game_done),
      jsonb_build_object('title','Asistir a un plan','completed',plan_done),jsonb_build_object('title','Compartir una foto','completed',memory_done)));
  month_status:=club_social.month_status(actor);
  month_progress:=least(2,(month_status->>'plans')::integer)+least(5,(month_status->>'memories')::integer)+least(3,(month_status->>'trades')::integer);
  return next jsonb_build_object('id','club:'||(month_status->>'month'),'category','club','title','El club suma',
    'description','Entre todos: 2 planes con dos asistentes, 5 recuerdos y 3 parejas de intercambio. Participa para cobrar.',
    'coins',30,'current',month_progress,'target',10,'completed',(month_status->>'complete')::boolean and (month_status->>'contributed')::boolean,
    'contributed',(month_status->>'contributed')::boolean,'action','calendar','ends_at',month_status->'ends_at');
  for row_data in select r.reward_id,r.coins,r.metadata from club_rewards.coin_receipts r
    where r.user_id=actor and r.category='memory' and r.coins>0
      and r.created_at>statement_timestamp()-interval '30 days' order by r.created_at desc limit 15 loop
    seen_memories:=true;
    return next jsonb_build_object('id',row_data.reward_id,'category','memory','title',coalesce(row_data.metadata->>'title','Recuerdo del plan'),
      'description','Foto compartida con el club.','coins',10,'current',1,'target',1,'completed',true,'action','calendar');
  end loop;
  if not seen_memories then
    return next jsonb_build_object('id','memory-info','category','memory','title','Un recuerdo del plan',
      'description','Asiste a un plan y comparte una foto real: 10 monedas por plan, hasta 3 planes al día.',
      'coins',10,'current',0,'target',1,'completed',false,'action','calendar');
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
      'category','album','title',initcap(replace(row_data.edition,'_',' '))||' · Página '||row_data.page,
      'description','Consigue todas las cartas publicadas de esta página.','coins',10,'current',row_data.current,'target',row_data.target,
      'completed',row_data.current=row_data.target,'action','album','collection_key',row_data.collection_key,'rarity',row_data.edition,'page',row_data.page);
  end loop;
  for row_data in select c.collection_key,c.edition,count(*) target,count(*) filter(where i.quantity>0) current
    from public.achievement_card_catalog c join public.published_card_designs d on d.id=c.id and d.published
    left join public.member_card_inventory i on i.user_id=actor and i.card_id=c.id where c.active group by c.collection_key,c.edition loop
    return next jsonb_build_object('id','album-category:'||row_data.collection_key||':'||row_data.edition,
      'category','album','title',initcap(replace(row_data.edition,'_',' '))||' al completo',
      'description','Completa todas las cartas publicadas de esta rareza.','coins',30,'current',row_data.current,'target',row_data.target,
      'completed',row_data.current=row_data.target,'action','album','collection_key',row_data.collection_key,'rarity',row_data.edition);
  end loop;
end $$;
revoke all on function club_rewards.coin_mission_rows(uuid) from public,anon,authenticated;

create function public.get_club_coin_missions() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid(); missions jsonb;
begin
  perform public.assert_account_security();
  if actor is null or not exists(select 1 from public.profiles where id=actor and not is_hidden) then raise exception 'Inicia sesión en el club.' using errcode='42501'; end if;
  select coalesce(jsonb_agg(m||jsonb_build_object('claimed',r.reward_id is not null)),'[]'::jsonb) into missions
    from club_rewards.coin_mission_rows(actor) m left join club_rewards.coin_receipts r on r.user_id=actor and r.reward_id=m->>'id';
  return jsonb_build_object('balance',coalesce((select balance from public.member_coin_wallets where user_id=actor),0),
    'earned_total',coalesce((select sum(coins) from club_rewards.coin_receipts where user_id=actor),0),'missions',missions);
end $$;
create function public.claim_club_coin_reward(reward_id text) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; mission jsonb; awarded integer:=0;
begin
  perform public.assert_account_security(); actor:=public.lock_banner_shop_actor();
  if reward_id is null or length(reward_id)>240 then raise exception 'Premio no válido.' using errcode='22023'; end if;
  if not exists(select 1 from club_rewards.coin_receipts r where r.user_id=actor and r.reward_id=claim_club_coin_reward.reward_id) then
    select m into mission from club_rewards.coin_mission_rows(actor) m where m->>'id'=reward_id;
    if mission is null or not coalesce((mission->>'completed')::boolean,false) then raise exception 'Completa primero esta misión.' using errcode='22023'; end if;
    awarded:=club_rewards.award_coins(actor,reward_id,mission->>'category',(mission->>'coins')::integer);
  end if;
  return jsonb_build_object('awarded',awarded>0,'coins',awarded,'balance',(select balance from public.member_coin_wallets where user_id=actor));
end $$;
revoke all on function public.get_club_coin_missions(),public.claim_club_coin_reward(text) from public,anon,authenticated;
grant execute on function public.get_club_coin_missions(),public.claim_club_coin_reward(text) to authenticated;

-- Preserve the validated score/pack implementation behind a private wrapper.
alter function public.submit_chota_level_score(uuid,integer,boolean,boolean) set schema club_rewards;
alter function club_rewards.submit_chota_level_score(uuid,integer,boolean,boolean) rename to submit_chota_level_score_base;
revoke all on function club_rewards.submit_chota_level_score_base(uuid,integer,boolean,boolean) from public,anon,authenticated;
create function public.submit_chota_level_score(game_session_id uuid,submitted_score integer,completed_round boolean default false,level_won boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
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
    coins:=coins+club_rewards.award_coins(actor,'level:'||session_row.game||':'||session_row.level,'level',(array[5,8,10,12,15])[session_row.level]);
  end if;
  if session_row.game in('football','robot-vacuum') and session_row.reward_status in('awarded','already_claimed')
    and session_row.finished_at>=today::timestamp at time zone 'Europe/Madrid' and session_row.finished_at<(today+1)::timestamp at time zone 'Europe/Madrid' then
    coins:=coins+club_rewards.award_coins(actor,'daily:'||today||':'||session_row.game,'daily',5);
  end if;
  return result||jsonb_build_object('awarded_coins',coins,'coin_balance',(select balance from public.member_coin_wallets where user_id=actor));
end $$;
revoke all on function public.submit_chota_level_score(uuid,integer,boolean,boolean) from public,anon,authenticated;
grant execute on function public.submit_chota_level_score(uuid,integer,boolean,boolean) to authenticated;

create function club_rewards.reward_plan_photo() returns trigger language plpgsql security definer set search_path='' as $$
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
  perform club_rewards.award_coins(actor,'memory:'||new.event_id||':'||new.occurrence,'memory',10,jsonb_build_object('title',title));
  return new;
end $$;
revoke all on function club_rewards.reward_plan_photo() from public,anon,authenticated;
create trigger reward_plan_photo after insert on public.club_event_memories for each row execute function club_rewards.reward_plan_photo();
commit;

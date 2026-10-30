begin;
-- Spanish mission labels and actual paid amounts, including pre-feature zero receipts.

create or replace function club_rewards.coin_rarity_title(edition text) returns text language sql immutable set search_path='' as $$
  select case edition when 'common' then 'Común' when 'special' then 'Especial' when 'epic' then 'Épica'
    when 'legendary' then 'Legendaria' when 'full_art' then 'Full Art' when 'vice_city' then 'Vice City'
    when 'halloween' then 'Halloween' when 'retro' then 'Retro' else initcap(replace(edition,'_',' ')) end;
$$;

create or replace function club_rewards.coin_mission_rows(actor uuid)
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
      'category','album','title',club_rewards.coin_rarity_title(row_data.edition)||' · Página '||row_data.page,
      'description','Consigue todas las cartas publicadas de esta página.','coins',10,'current',row_data.current,'target',row_data.target,
      'completed',row_data.current=row_data.target,'action','album','collection_key',row_data.collection_key,'rarity',row_data.edition,'page',row_data.page);
  end loop;
  for row_data in select c.collection_key,c.edition,count(*) target,count(*) filter(where i.quantity>0) current
    from public.achievement_card_catalog c join public.published_card_designs d on d.id=c.id and d.published
    left join public.member_card_inventory i on i.user_id=actor and i.card_id=c.id where c.active group by c.collection_key,c.edition loop
    return next jsonb_build_object('id','album-category:'||row_data.collection_key||':'||row_data.edition,
      'category','album','title',club_rewards.coin_rarity_title(row_data.edition)||' al completo',
      'description','Completa todas las cartas publicadas de esta rareza.','coins',30,'current',row_data.current,'target',row_data.target,
      'completed',row_data.current=row_data.target,'action','album','collection_key',row_data.collection_key,'rarity',row_data.edition);
  end loop;
end $$;

create or replace function public.get_club_coin_missions() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid(); missions jsonb;
begin
  perform public.assert_account_security();
  if actor is null or not exists(select 1 from public.profiles where id=actor and not is_hidden) then raise exception 'Inicia sesión en el club.' using errcode='42501'; end if;
  select coalesce(jsonb_agg(m||jsonb_build_object('claimed',r.reward_id is not null,'earned_coins',r.coins)),'[]'::jsonb) into missions
    from club_rewards.coin_mission_rows(actor) m left join club_rewards.coin_receipts r on r.user_id=actor and r.reward_id=m->>'id';
  return jsonb_build_object('balance',coalesce((select balance from public.member_coin_wallets where user_id=actor),0),
    'earned_total',coalesce((select sum(coins) from club_rewards.coin_receipts where user_id=actor),0),'missions',missions);
end $$;

revoke all on function club_rewards.coin_rarity_title(text),club_rewards.coin_mission_rows(uuid) from public,anon,authenticated;

revoke all on function public.get_club_coin_missions() from public,anon,authenticated;

grant execute on function public.get_club_coin_missions() to authenticated;
commit;

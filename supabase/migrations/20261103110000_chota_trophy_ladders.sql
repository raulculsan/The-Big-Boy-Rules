-- Chota trophy ladders: the Chota's room, his three arcade games and the
-- weekly challenge each get a bronze → platinum ladder, counted on the server.

alter table public.achievement_rules drop constraint achievement_rules_metric_check;
alter table public.achievement_rules add constraint achievement_rules_metric_check check (metric = any (array[
  'group_messages','group_active_days','profile_completed','daily_packs_earned','cards_explored',
  'special_cards_explored','legendary_cards_explored','locations_explored','cards_acquired',
  'daily_streak_best','packs_opened','duplicates_discarded',
  'chota_items_owned','chota_levels_cleared','chota_games_played','chota_weekly_wins']));

-- Objects bought for the Chota's room, each counted once.
create or replace function public.track_chota_item_progress()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  perform public.record_achievement_activity(new.user_id,'chota_items_owned','item:'||new.item_id);
  return new;
end $$;
revoke all on function public.track_chota_item_progress() from public,anon,authenticated;
drop trigger if exists track_chota_item_progress on public.member_owned_chota_items;
create trigger track_chota_item_progress after insert on public.member_owned_chota_items
  for each row execute function public.track_chota_item_progress();

-- Levels: every level up to the highest completed one counts once per game.
create or replace function public.track_chota_level_progress()
returns trigger language plpgsql security definer set search_path to '' as $$
declare level integer;
begin
  for level in 1..least(coalesce(new.highest_completed,0),5) loop
    perform public.record_achievement_activity(new.user_id,'chota_levels_cleared','level:'||new.game||':'||level);
  end loop;
  return new;
end $$;
revoke all on function public.track_chota_level_progress() from public,anon,authenticated;
drop trigger if exists track_chota_level_progress on club_arcade.level_progress;
create trigger track_chota_level_progress after insert or update of highest_completed on club_arcade.level_progress
  for each row execute function public.track_chota_level_progress();

-- Finished games. Sessions are pruned after a day, so the event key keeps the count.
create or replace function public.track_chota_game_progress()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if old.finished_at is null and new.finished_at is not null then
    perform public.record_achievement_activity(new.user_id,'chota_games_played','game:'||new.id::text);
  end if;
  return new;
end $$;
revoke all on function public.track_chota_game_progress() from public,anon,authenticated;
drop trigger if exists track_chota_game_progress on club_arcade.sessions;
create trigger track_chota_game_progress after update of finished_at on club_arcade.sessions
  for each row execute function public.track_chota_game_progress();

-- Weekly challenges completed: one pack grant receipt per won week.
create or replace function public.track_chota_weekly_progress()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if new.event_key like 'arcade-week:%' then
    perform public.record_achievement_activity(new.user_id,'chota_weekly_wins',new.event_key);
  end if;
  return new;
end $$;
revoke all on function public.track_chota_weekly_progress() from public,anon,authenticated;
drop trigger if exists track_chota_weekly_progress on public.member_reward_pack_grants;
create trigger track_chota_weekly_progress after insert on public.member_reward_pack_grants
  for each row execute function public.track_chota_weekly_progress();

-- History for the Chota metrics; everything else keeps the earlier backfill.
create or replace function public.backfill_chota_achievement(target_achievement bigint)
returns void language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare rule record; item record; level integer;
begin
  select r.* into rule from public.achievement_rules r join public.achievements a on a.id=r.achievement_id
    where r.achievement_id=target_achievement and a.retired_at is null;
  if not found then return; end if;
  if rule.metric='chota_items_owned' then
    for item in select user_id,item_id from public.member_owned_chota_items order by user_id,purchased_at loop
      perform public.record_achievement_activity(item.user_id,rule.metric,'item:'||item.item_id,target_achievement);
    end loop;
  elsif rule.metric='chota_levels_cleared' then
    for item in select user_id,game,highest_completed from club_arcade.level_progress order by user_id,game loop
      for level in 1..least(coalesce(item.highest_completed,0),5) loop
        perform public.record_achievement_activity(item.user_id,rule.metric,'level:'||item.game||':'||level,target_achievement);
      end loop;
    end loop;
  elsif rule.metric='chota_games_played' then
    for item in select id,user_id from club_arcade.sessions where finished_at is not null order by user_id,finished_at loop
      perform public.record_achievement_activity(item.user_id,rule.metric,'game:'||item.id::text,target_achievement);
    end loop;
  elsif rule.metric='chota_weekly_wins' then
    for item in select user_id,event_key from public.member_reward_pack_grants where event_key like 'arcade-week:%' order by user_id,event_key loop
      perform public.record_achievement_activity(item.user_id,rule.metric,item.event_key,target_achievement);
    end loop;
  else
    perform public.backfill_progression_achievement(target_achievement);
  end if;
end $$;
revoke all on function public.backfill_chota_achievement(bigint) from public,anon,authenticated;

create or replace function public.create_automatic_achievement(new_name text, new_description text, new_tier text, new_metric text, new_target integer)
returns bigint language plpgsql security definer set search_path to 'public','pg_temp' as $function$
declare created_id bigint; member_id uuid;
begin
if not public.current_user_is_club_admin() then raise exception 'No tienes permiso para crear logros.'; end if;
if new_name is null or char_length(trim(new_name)) not between 2 and 70 then raise exception 'El nombre del logro no es válido.'; end if;
if char_length(coalesce(new_description, '')) > 240 then raise exception 'La descripción es demasiado larga.'; end if;
if new_tier is null or new_tier not in ('bronze', 'silver', 'gold', 'platinum') then raise exception 'El rango no es válido.'; end if;
if new_metric is null or new_metric not in ('group_messages', 'group_active_days', 'profile_completed', 'daily_packs_earned', 'cards_explored', 'special_cards_explored', 'legendary_cards_explored', 'locations_explored', 'daily_streak_best', 'packs_opened', 'duplicates_discarded', 'chota_items_owned', 'chota_levels_cleared', 'chota_games_played', 'chota_weekly_wins') then raise exception 'El objetivo no es válido.'; end if;
if new_target is null or new_target not between 1 and 100000 or (new_metric = 'profile_completed' and new_target <> 1) then raise exception 'La meta no es válida.'; end if;
if new_metric = 'chota_levels_cleared' and new_target > 15 then raise exception 'Solo hay 15 niveles del Chota.'; end if;
if new_metric in ('cards_explored', 'special_cards_explored', 'legendary_cards_explored', 'locations_explored') and new_target > (select count(*) from public.achievement_card_catalog where active and (new_metric = 'cards_explored' or (new_metric = 'special_cards_explored' and edition = 'special') or (new_metric = 'legendary_cards_explored' and edition = 'legendary') or (new_metric = 'locations_explored' and kind = 'location'))) then raise exception 'La meta supera las cartas disponibles en esta categoría.'; end if;
insert into public.achievements (name, description, tier, created_by) values (trim(new_name), trim(coalesce(new_description, '')), new_tier, auth.uid()) returning id into created_id;
insert into public.achievement_rules (achievement_id, metric, target_count) values (created_id, new_metric, new_target);
if new_metric = 'profile_completed' then
for member_id in select id from public.profiles where not is_hidden and nullif(trim(avatar_url), '') is not null and nullif(trim(bio), '') is not null and nullif(trim(display_name), '') is not null order by id loop
perform public.record_achievement_activity(member_id, new_metric, 'profile:complete', created_id);
end loop;
elsif new_metric in ('daily_streak_best', 'packs_opened', 'duplicates_discarded', 'chota_items_owned', 'chota_levels_cleared', 'chota_games_played', 'chota_weekly_wins') then
perform public.backfill_chota_achievement(created_id);
end if;
return created_id;
end;
$function$;

do $$
declare owner_id uuid; target_id bigint; spec record;
begin
  select id into owner_id from public.profiles where role in ('admin','superadmin') and not is_hidden order by id limit 1;
  if owner_id is null then raise exception 'No hay administrador para firmar los trofeos.'; end if;
  for spec in select * from (values
    ('chota-casa',1,'bronze','chota_items_owned',1,'Primer regalo al Chota','Compra tu primer objeto en la tienda del Chota.'),
    ('chota-casa',2,'silver','chota_items_owned',3,'El Chota se acomoda','3 objetos distintos para la habitación del Chota.'),
    ('chota-casa',3,'gold','chota_items_owned',6,'Casa de revista','6 objetos distintos en la habitación del Chota.'),
    ('chota-casa',4,'platinum','chota_items_owned',11,'El Chota lo tiene todo','11 objetos de la tienda del Chota: la habitación completa.'),
    ('chota-niveles',1,'bronze','chota_levels_cleared',1,'Primer nivel','Supera tu primer nivel en un juego del Chota.'),
    ('chota-niveles',2,'silver','chota_levels_cleared',5,'Calentando motores','5 niveles superados en los juegos del Chota.'),
    ('chota-niveles',3,'gold','chota_levels_cleared',10,'Jugón del Chota','10 niveles superados en los juegos del Chota.'),
    ('chota-niveles',4,'platinum','chota_levels_cleared',15,'Maestro del Chota','Los 15 niveles: fútbol, skate y robot aspirador al completo.'),
    ('chota-partidas',1,'bronze','chota_games_played',10,'Echando el rato','Juega 10 partidas con el Chota.'),
    ('chota-partidas',2,'silver','chota_games_played',50,'Viciado','50 partidas con el Chota.'),
    ('chota-partidas',3,'gold','chota_games_played',150,'No sueltes el mando','150 partidas con el Chota.'),
    ('chota-partidas',4,'platinum','chota_games_played',500,'Leyenda del arcade','500 partidas con el Chota.'),
    ('chota-reto',1,'bronze','chota_weekly_wins',1,'Reto cumplido','Completa un reto semanal del Chota y cobra el premio.'),
    ('chota-reto',2,'silver','chota_weekly_wins',4,'Un mes de retos','4 retos semanales del Chota completados.'),
    ('chota-reto',3,'gold','chota_weekly_wins',12,'Rey del reto','12 retos semanales del Chota completados.'),
    ('chota-reto',4,'platinum','chota_weekly_wins',26,'Medio año retando','26 retos semanales del Chota completados.')
  ) v(track,step,tier,metric,target,title,description)
  loop
    if exists(select 1 from public.achievement_rules where seed_key='ladder:v1:'||spec.track||':'||spec.step) then continue; end if;
    insert into public.achievements(name,description,tier,created_by,track_key,track_step)
      values(spec.title,spec.description,spec.tier,owner_id,spec.track,spec.step) returning id into target_id;
    insert into public.achievement_rules(achievement_id,metric,target_count,seed_key)
      values(target_id,spec.metric,spec.target,'ladder:v1:'||spec.track||':'||spec.step);
    perform public.backfill_chota_achievement(target_id);
  end loop;
end $$;

notify pgrst,'reload schema';

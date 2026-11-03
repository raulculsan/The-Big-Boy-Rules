-- Fourth Chota game: «Dardos en el corcho», unlocked by buying the dartboard.
-- Five levels like the others: 12/18/24/30/36 points in 30 seconds, ending
-- when the goal is reached. It is not part of the weekly challenge rotation.

alter table club_arcade.sessions drop constraint sessions_game_check;
alter table club_arcade.sessions add constraint sessions_game_check check (game = any (array['football','skateboard','robot-vacuum','darts']));
alter table club_arcade.best_scores drop constraint best_scores_game_check;
alter table club_arcade.best_scores add constraint best_scores_game_check check (game = any (array['football','skateboard','robot-vacuum','darts']));
alter table club_arcade.weekly_scores drop constraint weekly_scores_game_check;
alter table club_arcade.weekly_scores add constraint weekly_scores_game_check check (game = any (array['football','skateboard','robot-vacuum','darts']));
alter table club_arcade.level_progress drop constraint level_progress_game_check;
alter table club_arcade.level_progress add constraint level_progress_game_check check (game = any (array['football','skateboard','robot-vacuum','darts']));

-- The game functions list the three games inline. Rewrite each definition with
-- the fourth one added; any text that is not found aborts the migration.
do $$
declare
  edits jsonb := jsonb_build_array(
    jsonb_build_array('public.start_chota_game(text)', $a$in('football','skateboard','robot-vacuum')$a$, $b$in('football','skateboard','robot-vacuum','darts')$b$),
    jsonb_build_array('public.start_chota_level(text,integer)', $a$not in ('football','skateboard','robot-vacuum')$a$, $b$not in ('football','skateboard','robot-vacuum','darts')$b$),
    jsonb_build_array('public.get_chota_game_leaderboard(text)', $a$in('football','skateboard','robot-vacuum')$a$, $b$in('football','skateboard','robot-vacuum','darts')$b$),
    jsonb_build_array('public.get_chota_level_progress()', $a$jsonb_build_object('football',0,'skateboard',0,'robot-vacuum',0)$a$, $b$jsonb_build_object('football',0,'skateboard',0,'robot-vacuum',0,'darts',0)$b$),
    -- A throw needs at least half a second and scores at most 3.
    jsonb_build_array('public.submit_chota_game_score(uuid,integer,boolean)', $a$when 'skateboard' then least(30,floor(elapsed)::integer)$a$, $b$when 'skateboard' then least(30,floor(elapsed)::integer)
    when 'darts' then least(120,floor(elapsed*6)::integer+3)$b$),
    jsonb_build_array('club_rewards.submit_chota_level_score_base(uuid,integer,boolean,boolean)', $a$when 'skateboard' then (array[8,10,12,14,16])[game_row.level] else 30 end$a$, $b$when 'skateboard' then (array[8,10,12,14,16])[game_row.level]
      when 'darts' then (array[12,18,24,30,36])[game_row.level] else 30 end$b$),
    jsonb_build_array('club_rewards.coin_mission_rows(uuid)', $a$foreach game_name in array array['football','skateboard','robot-vacuum'] loop
    game_title:=case game_name when 'football' then 'Pelota' when 'skateboard' then 'Skate' else 'Roomba' end;$a$, $b$foreach game_name in array array['football','skateboard','robot-vacuum','darts'] loop
    game_title:=case game_name when 'football' then 'Pelota' when 'skateboard' then 'Skate' when 'darts' then 'Dardos' else 'Roomba' end;$b$)
  );
  edit jsonb; definition text; updated text;
begin
  for edit in select * from jsonb_array_elements(edits) loop
    definition := pg_get_functiondef((edit->>0)::regprocedure);
    updated := replace(definition, edit->>1, edit->>2);
    if updated = definition then raise exception 'No se encontró el texto a cambiar en %', edit->>0; end if;
    execute updated;
  end loop;
end $$;

insert into public.chota_item_catalog(id,name,description,art_key,price,active,sort_order)
values('chota-darts','Diana de dardos','Una diana clavada en el corcho. Desbloquea «Dardos en el corcho».','darts',30,true,
  coalesce((select max(sort_order)+1 from public.chota_item_catalog),20))
on conflict(id) do nothing;

-- The level ladder now covers four games × 5 levels.
update public.achievement_rules r set target_count=20
  from public.achievements a where a.id=r.achievement_id and r.seed_key='ladder:v1:chota-niveles:4' and r.target_count=15;
update public.achievements a set description='Los 20 niveles: fútbol, skate, robot aspirador y dardos al completo.'
  from public.achievement_rules r where r.achievement_id=a.id and r.seed_key='ladder:v1:chota-niveles:4';
update public.achievement_progress p set current_value=least(p.current_value,20)
  from public.achievement_rules r where r.achievement_id=p.achievement_id and r.seed_key='ladder:v1:chota-niveles:4';

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
if new_metric = 'chota_levels_cleared' and new_target > 20 then raise exception 'Solo hay 20 niveles del Chota.'; end if;
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

notify pgrst,'reload schema';

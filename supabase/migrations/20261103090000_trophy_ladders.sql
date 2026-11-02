-- Trophy ladders: every trophy family climbs bronze → silver → gold → platinum
-- with targets that grow at a steady pace. A member only sees the next step of
-- each ladder, and progress comes from their real history, not from the day a
-- trophy was created.

-- 1. Ladder identity on each trophy.
alter table public.achievements add column if not exists track_key text;
alter table public.achievements add column if not exists track_step smallint;
alter table public.achievements drop constraint if exists achievements_track_check;
alter table public.achievements add constraint achievements_track_check check (
  (track_key is null) = (track_step is null)
  and (track_key is null or track_key ~ '^[a-z0-9-]{2,40}$')
  and (track_step is null or track_step between 1 and 9));
create unique index if not exists achievements_track_step_key
  on public.achievements(track_key,track_step) where track_key is not null and retired_at is null;

-- 2. New measurable activities.
alter table public.achievement_rules drop constraint achievement_rules_metric_check;
alter table public.achievement_rules add constraint achievement_rules_metric_check check (metric = any (array[
  'group_messages','group_active_days','profile_completed','daily_packs_earned','cards_explored',
  'special_cards_explored','legendary_cards_explored','locations_explored','cards_acquired',
  'daily_streak_best','packs_opened','duplicates_discarded']));

-- Best daily streak: reaching a streak of N records the steps 1..N once, so the
-- counter is the longest streak ever reached and never drops after a break.
create or replace function public.record_daily_streak_progress(actor uuid, upto date)
returns void language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare streak integer; step integer;
begin
  select count(*)::integer into streak from (
    select earned_day,row_number() over(order by earned_day desc) n
    from public.card_packs where user_id=actor and source='daily' and earned_day<=upto
  ) days where upto-earned_day=n-1;
  for step in 1..coalesce(streak,0) loop
    perform public.record_achievement_activity(actor,'daily_streak_best','streak:'||step);
  end loop;
end $$;
revoke all on function public.record_daily_streak_progress(uuid,date) from public,anon,authenticated;

create or replace function public.track_progression_card_packs()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if tg_op='INSERT' then
    if new.source='daily' then perform public.record_daily_streak_progress(new.user_id,new.earned_day); end if;
  elsif old.opened_at is null and new.opened_at is not null then
    perform public.record_achievement_activity(new.user_id,'packs_opened','pack:'||new.id::text);
  end if;
  return new;
end $$;
revoke all on function public.track_progression_card_packs() from public,anon,authenticated;
drop trigger if exists track_progression_card_packs_insert on public.card_packs;
create trigger track_progression_card_packs_insert after insert on public.card_packs
  for each row execute function public.track_progression_card_packs();
drop trigger if exists track_progression_card_packs_open on public.card_packs;
create trigger track_progression_card_packs_open after update of opened_at on public.card_packs
  for each row execute function public.track_progression_card_packs();

-- Each discarded copy counts once.
create or replace function public.track_progression_discards()
returns trigger language plpgsql security definer set search_path to '' as $$
declare copy integer;
begin
  if new.reason='duplicate_discard' then
    for copy in 1..greatest(coalesce(new.copies,1),1) loop
      perform public.record_achievement_activity(new.user_id,'duplicates_discarded','discard:'||new.id||':'||copy);
    end loop;
  end if;
  return new;
end $$;
revoke all on function public.track_progression_discards() from public,anon,authenticated;
drop trigger if exists track_progression_discards on public.member_coin_ledger;
create trigger track_progression_discards after insert on public.member_coin_ledger
  for each row execute function public.track_progression_discards();

-- 3. Rebuild one trophy's progress from history. Idempotent: every event key
-- is deduplicated per trophy, so running it again never double counts.
create or replace function public.backfill_progression_achievement(target_achievement bigint)
returns void language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare rule record; item record; step integer;
begin
  select r.* into rule from public.achievement_rules r join public.achievements a on a.id=r.achievement_id
    where r.achievement_id=target_achievement and a.retired_at is null;
  if not found then return; end if;
  if rule.metric='cards_acquired' then
    perform public.backfill_card_acquisition_achievement(target_achievement);
  elsif rule.metric='group_active_days' then
    perform public.backfill_app_visit_achievement(target_achievement);
  elsif rule.metric='group_messages' then
    -- Same flood cap as the live trigger: at most 40 messages a day count.
    for item in select id,user_id from (
      select m.id,m.user_id,row_number() over(partition by m.user_id,(m.created_at at time zone 'Europe/Madrid')::date order by m.created_at) n
      from public.messages m) x where n<=40 order by user_id,id
    loop
      perform public.record_achievement_activity(item.user_id,'group_messages','message:'||item.id::text,target_achievement);
    end loop;
  elsif rule.metric='packs_opened' then
    for item in select id,user_id from public.card_packs where opened_at is not null order by user_id,id loop
      perform public.record_achievement_activity(item.user_id,'packs_opened','pack:'||item.id::text,target_achievement);
    end loop;
  elsif rule.metric='duplicates_discarded' then
    for item in select l.id,l.user_id,c.n from public.member_coin_ledger l
      cross join lateral generate_series(1,greatest(coalesce(l.copies,1),1)) c(n)
      where l.reason='duplicate_discard' order by l.user_id,l.id,c.n
    loop
      perform public.record_achievement_activity(item.user_id,'duplicates_discarded','discard:'||item.id||':'||item.n,target_achievement);
    end loop;
  elsif rule.metric='daily_streak_best' then
    for item in select user_id,max(length)::integer best from (
      select user_id,count(*) length from (
        select user_id,earned_day,earned_day-(row_number() over(partition by user_id order by earned_day))::integer island
        from public.card_packs where source='daily') d group by user_id,island) s
      group by user_id order by user_id
    loop
      for step in 1..item.best loop
        perform public.record_achievement_activity(item.user_id,'daily_streak_best','streak:'||step,target_achievement);
      end loop;
    end loop;
  end if;
end $$;
revoke all on function public.backfill_progression_achievement(bigint) from public,anon,authenticated;

-- Admins can also create trophies on the new activities; they start from history.
create or replace function public.create_automatic_achievement(new_name text, new_description text, new_tier text, new_metric text, new_target integer)
returns bigint language plpgsql security definer set search_path to 'public','pg_temp' as $function$
declare created_id bigint; member_id uuid;
begin
if not public.current_user_is_club_admin() then raise exception 'No tienes permiso para crear logros.'; end if;
if new_name is null or char_length(trim(new_name)) not between 2 and 70 then raise exception 'El nombre del logro no es válido.'; end if;
if char_length(coalesce(new_description, '')) > 240 then raise exception 'La descripción es demasiado larga.'; end if;
if new_tier is null or new_tier not in ('bronze', 'silver', 'gold', 'platinum') then raise exception 'El rango no es válido.'; end if;
if new_metric is null or new_metric not in ('group_messages', 'group_active_days', 'profile_completed', 'daily_packs_earned', 'cards_explored', 'special_cards_explored', 'legendary_cards_explored', 'locations_explored', 'daily_streak_best', 'packs_opened', 'duplicates_discarded') then raise exception 'El objetivo no es válido.'; end if;
if new_target is null or new_target not between 1 and 100000 or (new_metric = 'profile_completed' and new_target <> 1) then raise exception 'La meta no es válida.'; end if;
if new_metric in ('cards_explored', 'special_cards_explored', 'legendary_cards_explored', 'locations_explored') and new_target > (select count(*) from public.achievement_card_catalog where active and (new_metric = 'cards_explored' or (new_metric = 'special_cards_explored' and edition = 'special') or (new_metric = 'legendary_cards_explored' and edition = 'legendary') or (new_metric = 'locations_explored' and kind = 'location'))) then raise exception 'La meta supera las cartas disponibles en esta categoría.'; end if;
insert into public.achievements (name, description, tier, created_by) values (trim(new_name), trim(coalesce(new_description, '')), new_tier, auth.uid()) returning id into created_id;
insert into public.achievement_rules (achievement_id, metric, target_count) values (created_id, new_metric, new_target);
if new_metric = 'profile_completed' then
for member_id in select id from public.profiles where not is_hidden and nullif(trim(avatar_url), '') is not null and nullif(trim(bio), '') is not null and nullif(trim(display_name), '') is not null order by id loop
perform public.record_achievement_activity(member_id, new_metric, 'profile:complete', created_id);
end loop;
elsif new_metric in ('daily_streak_best', 'packs_opened', 'duplicates_discarded') then
perform public.backfill_progression_achievement(created_id);
end if;
return created_id;
end;
$function$;

-- 4. The ladders.
do $$
declare
  owner_id uuid; target_id bigint; spec record;
begin
  select id into owner_id from public.profiles where role in ('admin','superadmin') and not is_hidden order by id limit 1;
  if owner_id is null then raise exception 'No hay administrador para firmar los trofeos.'; end if;

  -- Unreachable goals: the catalog has about 100 cards.
  update public.achievements a set retired_at=coalesce(a.retired_at,clock_timestamp())
    from public.achievement_rules r where r.achievement_id=a.id
    and r.seed_key in ('acquired:v1:global:250','acquired:v1:global:500')
    and not exists(select 1 from public.achievement_awards w where w.achievement_id=a.id);

  -- Existing trophies join their ladder. Matched by rule so a different install is untouched.
  for spec in select * from (values
    ('asistencia',1,'group_active_days',10,null::text,null::text,null::text,null::text),
    ('asistencia',2,'group_active_days',30,null,null,null,null),
    ('asistencia',3,'group_active_days',100,null,null,null,null),
    ('asistencia',4,'group_active_days',365,null,null,null,null),
    ('mensajes',1,'group_messages',5,null,null,'Rompehielos',null),
    ('mensajes',3,'group_messages',80,null,null,null,null),
    ('mensajes',4,'group_messages',365,null,null,null,null),
    ('los-nuestros',1,'cards_acquired',1,'los-nuestros-01',null,null,null),
    ('los-nuestros',2,'cards_acquired',5,'los-nuestros-01',null,null,null),
    ('los-nuestros',3,'cards_acquired',10,'los-nuestros-01',null,null,null),
    ('los-nuestros',4,'cards_acquired',25,'los-nuestros-01',null,null,null),
    ('los-nuestros',5,'cards_acquired',50,'los-nuestros-01',null,null,null),
    ('coleccionista',1,'cards_acquired',50,null,'acquired:v1:global:50',null,'bronze'),
    ('coleccionista',4,'cards_acquired',100,null,'acquired:v1:global:100',null,'platinum')
  ) v(track,step,metric,target,collection,seed,rename,retier)
  loop
    update public.achievements a set track_key=spec.track,track_step=spec.step,
      name=coalesce(spec.rename,a.name),tier=coalesce(spec.retier,a.tier)
    where a.id=(select r.achievement_id from public.achievement_rules r join public.achievements x on x.id=r.achievement_id
      where x.retired_at is null and x.track_key is null and r.metric=spec.metric and r.target_count=spec.target
        and r.collection_key is not distinct from spec.collection and r.card_edition is null and r.card_kind is null
        and (spec.seed is null or r.seed_key=spec.seed)
      order by r.achievement_id limit 1);
  end loop;

  -- New steps. seed_key keeps the migration repeatable.
  for spec in select * from (values
    ('mensajes',2,'silver','group_messages',25,null::text,'Charlatán','25 mensajes en el grupo. Ya no hay quien te calle.'),
    ('coleccionista',2,'silver','cards_acquired',70,null,'Coleccionista · 70','Consigue 70 cartas distintas entre todas las colecciones.'),
    ('coleccionista',3,'gold','cards_acquired',85,null,'Coleccionista · 85','Consigue 85 cartas distintas entre todas las colecciones. Las últimas son las más raras.'),
    ('leyendas',1,'bronze','cards_acquired',1,'legendary','Primera leyenda','Tu primera carta legendaria.'),
    ('leyendas',2,'silver','cards_acquired',3,'legendary','Mito del barrio','3 legendarias distintas.'),
    ('leyendas',3,'gold','cards_acquired',6,'legendary','Panteón','6 legendarias distintas.'),
    ('leyendas',4,'platinum','cards_acquired',10,'legendary','Todas las leyendas','Las 10 legendarias de la colección.'),
    ('full-art',1,'bronze','cards_acquired',1,'full_art','Obra de arte','Tu primera Full Art.'),
    ('full-art',2,'silver','cards_acquired',3,'full_art','Galería','3 Full Art distintas.'),
    ('full-art',3,'gold','cards_acquired',6,'full_art','Museo propio','6 Full Art distintas.'),
    ('full-art',4,'platinum','cards_acquired',10,'full_art','Colección de autor','Las 10 Full Art de la colección.'),
    ('vice-city',1,'bronze','cards_acquired',1,'vice_city','Bienvenido a Vice City','Tu primera carta Vice City.'),
    ('vice-city',2,'silver','cards_acquired',4,'vice_city','Neón en las venas','4 cartas Vice City distintas.'),
    ('vice-city',3,'gold','cards_acquired',8,'vice_city','Capo de Vice City','8 cartas Vice City distintas.'),
    ('vice-city',4,'platinum','cards_acquired',13,'vice_city','Dueño de Vice City','Las 13 cartas Vice City.'),
    ('racha',1,'bronze','daily_streak_best',3,null,'Calentando','Recoge tus sobres diarios 3 días seguidos.'),
    ('racha',2,'silver','daily_streak_best',7,null,'Una semana fiel','7 días seguidos recogiendo sobres.'),
    ('racha',3,'gold','daily_streak_best',30,null,'Un mes sin fallar','30 días seguidos recogiendo sobres.'),
    ('racha',4,'platinum','daily_streak_best',100,null,'Cien días de vicio','100 días seguidos recogiendo sobres.'),
    ('abresobres',1,'bronze','packs_opened',25,null,'Rasgando papel','Abre 25 sobres.'),
    ('abresobres',2,'silver','packs_opened',100,null,'Abrelatas','Abre 100 sobres.'),
    ('abresobres',3,'gold','packs_opened',300,null,'Adicto al sobre','Abre 300 sobres.'),
    ('abresobres',4,'platinum','packs_opened',1000,null,'Máquina de abrir sobres','Abre 1.000 sobres.'),
    ('reciclador',1,'bronze','duplicates_discarded',25,null,'Limpieza de armario','Descarta 25 cartas repetidas.'),
    ('reciclador',2,'silver','duplicates_discarded',100,null,'Chatarrero','Descarta 100 cartas repetidas.'),
    ('reciclador',3,'gold','duplicates_discarded',300,null,'Reciclador profesional','Descarta 300 cartas repetidas.'),
    ('reciclador',4,'platinum','duplicates_discarded',1000,null,'Planta de reciclaje','Descarta 1.000 cartas repetidas.')
  ) v(track,step,tier,metric,target,edition,title,description)
  loop
    if exists(select 1 from public.achievement_rules where seed_key='ladder:v1:'||spec.track||':'||spec.step) then continue; end if;
    if exists(select 1 from public.achievements where track_key=spec.track and track_step=spec.step and retired_at is null) then continue; end if;
    insert into public.achievements(name,description,tier,created_by,track_key,track_step)
      values(spec.title,spec.description,spec.tier,owner_id,spec.track,spec.step) returning id into target_id;
    insert into public.achievement_rules(achievement_id,metric,target_count,card_edition,seed_key)
      values(target_id,spec.metric,spec.target,spec.edition,'ladder:v1:'||spec.track||':'||spec.step);
  end loop;

  -- Every ladder step reflects the member's real history.
  for target_id in select id from public.achievements where track_key is not null and retired_at is null order by track_key,track_step loop
    perform public.backfill_progression_achievement(target_id);
  end loop;
end $$;

notify pgrst,'reload schema';

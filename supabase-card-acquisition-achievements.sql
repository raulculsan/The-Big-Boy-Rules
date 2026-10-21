-- Después de logros/progreso, catálogo y tienda. Atómico y repetible.
-- Conseguir cartas es distinto de explorarlas: solo el servidor acredita adquisición.
begin;

create table if not exists public.card_collection_catalog (
  key text primary key check (key ~ '^[a-z0-9][a-z0-9_-]{0,79}$'),
  name text not null check (char_length(trim(name)) between 2 and 100),
  active boolean not null default true
);
insert into public.card_collection_catalog(key,name) values ('los-nuestros-01','Los Nuestros · Colección 01') on conflict do nothing;
-- Conserva también claves de sobres existentes antes de establecer relaciones.
insert into public.card_collection_catalog(key,name)
  select distinct collection_key, collection_key from public.card_packs
  where collection_key is not null on conflict do nothing;
alter table public.achievement_card_catalog add column if not exists collection_key text not null default 'los-nuestros-01';
insert into public.card_collection_catalog(key,name)
  select distinct collection_key, collection_key from public.achievement_card_catalog on conflict do nothing;
do $$ begin
  if not exists(select 1 from pg_constraint where conrelid='public.achievement_card_catalog'::regclass and conname='achievement_card_collection_fk') then
    alter table public.achievement_card_catalog add constraint achievement_card_collection_fk foreign key(collection_key) references public.card_collection_catalog(key);
  end if;
end $$;
create index if not exists achievement_card_collection_idx on public.achievement_card_catalog(collection_key);
alter table public.card_collection_catalog enable row level security;
revoke all on public.card_collection_catalog from public,anon,authenticated;
grant select on public.card_collection_catalog to authenticated;
drop policy if exists "members read card collections" on public.card_collection_catalog;
create policy "members read card collections" on public.card_collection_catalog for select to authenticated using(true);

alter table public.achievement_rules drop constraint if exists achievement_rules_metric_check;
alter table public.achievement_rules add constraint achievement_rules_metric_check check(metric in
 ('group_messages','group_active_days','profile_completed','daily_packs_earned','cards_explored','special_cards_explored','legendary_cards_explored','locations_explored','cards_acquired'));
alter table public.achievement_rules add column if not exists collection_key text references public.card_collection_catalog(key);
alter table public.achievement_rules add column if not exists card_edition text;
alter table public.achievement_rules add column if not exists card_kind text;
alter table public.achievement_rules add column if not exists seed_key text;
create unique index if not exists achievement_rules_seed_key_idx on public.achievement_rules(seed_key) where seed_key is not null;
alter table public.achievement_rules drop constraint if exists achievement_acquisition_scope_check;
alter table public.achievement_rules add constraint achievement_acquisition_scope_check check (
 (metric='cards_acquired' or (collection_key is null and card_edition is null and card_kind is null))
 and (card_edition is null or card_edition in ('common','special','epic','legendary','retro','full_art','vice_city'))
 and (card_kind is null or card_kind in ('member','object','location')));

alter table public.achievements add column if not exists retired_at timestamptz;

-- Historial permanente: las copias no suman y descartar nunca borra lo conseguido.
-- Metadatos fotografiados en la adquisición: renombrar/ampliar el catálogo no reclasifica el historial.
create table if not exists public.member_card_acquisitions (
 user_id uuid not null references public.profiles(id) on delete cascade,
 card_id text not null,
 collection_key text not null references public.card_collection_catalog(key),
 card_edition text not null,
 card_kind text not null,
 first_acquired_at timestamptz not null default clock_timestamp(),
 primary key(user_id,card_id)
);
create index if not exists member_card_acquisitions_scope_idx on public.member_card_acquisitions(user_id,collection_key,card_edition,card_kind);
alter table public.member_card_acquisitions enable row level security;
revoke all on public.member_card_acquisitions from public,anon,authenticated;
-- No INSERT/UPDATE/DELETE de cliente ni RPC que acepte cartas supuestamente adquiridas.

create or replace function public.credit_card_acquisition(actor uuid, acquired_card text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare card record; rule record;
begin
 -- Serializa adquisiciones y creación/backfill de objetivos para evitar carreras.
 perform pg_advisory_xact_lock(73142,244);
 select * into card from public.achievement_card_catalog where id=acquired_card;
 if not found then return; end if;
 insert into public.member_card_acquisitions(user_id,card_id,collection_key,card_edition,card_kind)
 values(actor,card.id,card.collection_key,card.edition,card.kind) on conflict do nothing;
 if not found then return; end if;
 for rule in select * from public.achievement_rules r where metric='cards_acquired'
  and exists(select 1 from public.achievements a where a.id=r.achievement_id and a.retired_at is null)
  and (collection_key is null or collection_key=card.collection_key)
  and (card_edition is null or card_edition=card.edition)
  and (card_kind is null or card_kind=card.kind) order by achievement_id
 loop
  perform public.record_achievement_activity(actor,'cards_acquired','acquired:'||card.id,rule.achievement_id);
 end loop;
end $$;
revoke all on function public.credit_card_acquisition(uuid,text) from public,anon,authenticated;

create or replace function public.track_card_acquisition()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if TG_TABLE_NAME='member_pack_card_awards' then
  perform public.credit_card_acquisition(new.user_id,new.card_id);
 elsif new.quantity>0 then
  perform public.credit_card_acquisition(new.user_id,new.card_id);
 end if;
 return new;
end $$;
revoke all on function public.track_card_acquisition() from public,anon,authenticated;
-- Separate award and inventory triggers also cover future server gifts/imports.
drop trigger if exists track_pack_card_acquisition on public.member_pack_card_awards;
create trigger track_pack_card_acquisition after insert on public.member_pack_card_awards for each row execute function public.track_card_acquisition();
drop trigger if exists track_inventory_card_acquisition on public.member_card_inventory;
create trigger track_inventory_card_acquisition after insert or update of quantity on public.member_card_inventory for each row execute function public.track_card_acquisition();

-- Both current inventory and historical pack awards count, once per card.
insert into public.member_card_acquisitions(user_id,card_id,collection_key,card_edition,card_kind)
 select source.user_id,c.id,c.collection_key,c.edition,c.kind
 from (select user_id,card_id from public.member_card_inventory where quantity>0
       union select user_id,card_id from public.member_pack_card_awards) source
 join public.achievement_card_catalog c on c.id=source.card_id on conflict do nothing;

create or replace function public.backfill_card_acquisition_achievement(target_achievement bigint)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare rule record; acquired record;
begin
 perform pg_advisory_xact_lock(73142,244);
 select * into rule from public.achievement_rules where achievement_id=target_achievement and metric='cards_acquired'
  and exists(select 1 from public.achievements a where a.id=target_achievement and a.retired_at is null);
 if not found then return; end if;
 for acquired in select * from public.member_card_acquisitions a
  where (rule.collection_key is null or a.collection_key=rule.collection_key)
   and (rule.card_edition is null or a.card_edition=rule.card_edition)
   and (rule.card_kind is null or a.card_kind=rule.card_kind) order by user_id,card_id
 loop
  perform public.record_achievement_activity(acquired.user_id,'cards_acquired','acquired:'||acquired.card_id,rule.achievement_id);
 end loop;
end $$;
revoke all on function public.backfill_card_acquisition_achievement(bigint) from public,anon,authenticated;

-- RPC distinto: no sobrecarga ambigua del RPC de objetivos anteriores.
create or replace function public.create_card_acquisition_achievement(
 new_name text,new_description text,new_tier text,new_target integer,
 target_collection text default null,target_edition text default null,target_kind text default null
) returns bigint language plpgsql security definer set search_path=public,pg_temp as $$
declare created_id bigint;
begin
 if not public.current_user_is_club_admin() then raise exception 'No tienes permiso para crear logros.' using errcode='42501'; end if;
 if new_name is null or char_length(trim(new_name)) not between 2 and 70 then raise exception 'El nombre del logro no es válido.'; end if;
 if char_length(coalesce(new_description,''))>240 then raise exception 'La descripción es demasiado larga.'; end if;
 if new_tier is null or new_tier not in ('bronze','silver','gold','platinum') then raise exception 'El rango no es válido.'; end if;
 if new_target is null or new_target not between 1 and 100000 then raise exception 'La meta no es válida.'; end if;
 if target_collection is not null and not exists(select 1 from public.card_collection_catalog where key=target_collection) then raise exception 'La colección no existe.'; end if;
 if target_edition is not null and target_edition not in ('common','special','epic','legendary','retro','full_art','vice_city') then raise exception 'La rareza no es válida.'; end if;
 if target_kind is not null and target_kind not in ('member','object','location') then raise exception 'El tipo de carta no es válido.'; end if;
 perform pg_advisory_xact_lock(73142,244);
 insert into public.achievements(name,description,tier,created_by) values(trim(new_name),trim(coalesce(new_description,'')),new_tier,auth.uid()) returning id into created_id;
 insert into public.achievement_rules(achievement_id,metric,target_count,collection_key,card_edition,card_kind)
 values(created_id,'cards_acquired',new_target,target_collection,target_edition,target_kind);
 perform public.backfill_card_acquisition_achievement(created_id);
 return created_id;
end $$;
revoke all on function public.create_card_acquisition_achievement(text,text,text,integer,text,text,text) from public,anon,authenticated;
grant execute on function public.create_card_acquisition_achievement(text,text,text,integer,text,text,text) to authenticated;

create or replace function public.get_card_achievement_scopes()
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('collections',coalesce((select jsonb_agg(jsonb_build_object('key',c.key,'name',c.name,'available',(select count(*) from public.achievement_card_catalog a where a.collection_key=c.key and a.active)) order by c.key) from public.card_collection_catalog c where c.active),'[]'::jsonb),
 'catalog',coalesce((select jsonb_agg(jsonb_build_object('collectionKey',collection_key,'edition',edition,'kind',kind)) from public.achievement_card_catalog where active),'[]'::jsonb))
 where auth.uid() is not null;
$$;
revoke all on function public.get_card_achievement_scopes() from public,anon,authenticated;
grant execute on function public.get_card_achievement_scopes() to authenticated;

-- Objetivos iniciales fijados por número, nunca por % mutable del catálogo.
-- Coleccionista comienza en 50 (bronce); 100/250/500 quedan preparados para ampliaciones.
-- Las metas de la colección actual sólo se crean si son alcanzables hoy.
do $$ declare owner_id uuid; scope text; goal integer; created_id bigint; seed text; current_total integer;
begin
 select id into owner_id from public.profiles where role in ('admin','superadmin') and not is_hidden order by id limit 1;
 if owner_id is null then raise notice 'No hay administrador para firmar los objetivos iniciales.'; return; end if;
 perform pg_advisory_xact_lock(73142,244);
 update public.achievements a set retired_at=coalesce(a.retired_at,clock_timestamp())
 from public.achievement_rules r where r.achievement_id=a.id
  and r.seed_key in ('acquired:v1:global:1','acquired:v1:global:5','acquired:v1:global:10','acquired:v1:global:25');
 update public.achievements a set tier='bronze'
 from public.achievement_rules r where r.achievement_id=a.id and r.seed_key='acquired:v1:global:50';
 foreach scope in array array['global','los-nuestros-01'] loop
  select count(*) into current_total from public.achievement_card_catalog where active and (scope='global' or collection_key=scope);
  foreach goal in array (case when scope='global' then array[50,100,250,500] else array[1,5,10,25,50] end) loop
   if scope<>'global' and goal>current_total then continue; end if;
   seed:='acquired:v1:'||scope||':'||goal;
   if exists(select 1 from public.achievement_rules where seed_key=seed) then continue; end if;
   insert into public.achievements(name,description,tier,created_by)
    values(case when scope='global' then 'Coleccionista · ' else 'Los Nuestros · ' end||goal,
      'Consigue '||goal||' cartas distintas'||case when scope='global' then ' entre todas las colecciones.' else ' de Los Nuestros · Colección 01.' end,
      case when scope='global' then case goal when 50 then 'bronze' when 100 then 'silver' when 250 then 'gold' else 'platinum' end else case when goal<=5 then 'bronze' when goal<=10 then 'silver' when goal<=25 then 'gold' else 'platinum' end end,owner_id) returning id into created_id;
   insert into public.achievement_rules(achievement_id,metric,target_count,collection_key,seed_key)
    values(created_id,'cards_acquired',goal,case when scope='global' then null else scope end,seed);
  end loop;
 end loop;
 for created_id in select achievement_id from public.achievement_rules where metric='cards_acquired' order by achievement_id loop
  perform public.backfill_card_acquisition_achievement(created_id);
 end loop;
end $$;
-- Los mensajes conservan su contador, pero ya no acreditan días de entrada en la app.
create or replace function public.track_group_achievement_activity()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform public.record_achievement_activity(new.user_id,'group_messages','message:'||new.id::text);
 return new;
end $$;
revoke all on function public.track_group_achievement_activity() from public,anon,authenticated;

-- Visitas reales, conservadas aunque todavía no haya objetivos o estén terminados.
create table if not exists public.member_app_visit_days (
 user_id uuid not null references public.profiles(id) on delete cascade,
 visit_day date not null,
 recorded_at timestamptz not null default clock_timestamp(),
 primary key(user_id,visit_day)
);
alter table public.member_app_visit_days enable row level security;
revoke all on public.member_app_visit_days from public,anon,authenticated;
-- Únicamente fechas previamente acreditadas por el servidor. No se infieren del alta/login.
insert into public.member_app_visit_days(user_id,visit_day)
 select distinct e.user_id,substring(e.event_key from 5)::date
 from public.achievement_progress_events e join public.achievement_rules r using(achievement_id)
 where r.metric='group_active_days' and e.event_key ~ '^day:[0-9]{4}-[0-9]{2}-[0-9]{2}$'
 on conflict do nothing;

create or replace function public.backfill_app_visit_achievement(target_achievement bigint)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare visit record;
begin
 if not exists(select 1 from public.achievement_rules where achievement_id=target_achievement and metric='group_active_days') then return; end if;
 perform pg_advisory_xact_lock(73142,245);
 for visit in select user_id,visit_day from public.member_app_visit_days order by user_id,visit_day loop
  perform public.record_achievement_activity(visit.user_id,'group_active_days','day:'||visit.visit_day::text,target_achievement);
 end loop;
end $$;
revoke all on function public.backfill_app_visit_achievement(bigint) from public,anon,authenticated;
create or replace function public.track_new_daily_achievement()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.metric='group_active_days' then perform public.backfill_app_visit_achievement(new.achievement_id); end if;
 return new;
end $$;
revoke all on function public.track_new_daily_achievement() from public,anon,authenticated;
drop trigger if exists track_new_daily_achievement on public.achievement_rules;
create trigger track_new_daily_achievement after insert on public.achievement_rules for each row execute function public.track_new_daily_achievement();
create or replace function public.record_daily_app_visit()
returns date language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid(); today date:=(statement_timestamp() at time zone 'Europe/Madrid')::date; rule record; visit record;
begin
 if actor is null then raise exception 'Inicia sesión para registrar tu participación.' using errcode='42501'; end if;
 if not exists(select 1 from public.profiles where id=actor and not is_hidden) then return null; end if;
 -- Mismo orden de bloqueo para creación de metas y registro de visitas concurrentes.
 perform pg_advisory_xact_lock(73142,245);
 insert into public.member_app_visit_days(user_id,visit_day) values(actor,today) on conflict do nothing;
 -- Reconciliación deduplicada: también sana objetivos nuevos o una entrega anterior interrumpida.
 for rule in select achievement_id from public.achievement_rules where metric='group_active_days' order by achievement_id loop
  for visit in select visit_day from public.member_app_visit_days where user_id=actor order by visit_day loop
   perform public.record_achievement_activity(actor,'group_active_days','day:'||visit.visit_day::text,rule.achievement_id);
  end loop;
 end loop;
 return today;
end $$;
revoke all on function public.record_daily_app_visit() from public,anon,authenticated;
grant execute on function public.record_daily_app_visit() to authenticated;
do $$ declare goal bigint; begin
 for goal in select achievement_id from public.achievement_rules where metric='group_active_days' order by achievement_id loop
  perform public.backfill_app_visit_achievement(goal);
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
-- Resumen anónimo para confirmar el despliegue, sin identificadores personales.
select (select count(*) from public.card_collection_catalog) as collections,
 (select count(*) from public.achievement_rules where metric='cards_acquired') as acquisition_objectives,
 (select count(*) from public.member_card_acquisitions) as unique_acquisitions,
 (select count(*) from public.achievement_progress p join public.achievement_rules r using(achievement_id) where r.metric='cards_acquired' and p.completed_at is not null) as completed_objectives,
 (select count(*) from public.member_app_visit_days) as recorded_visit_days;

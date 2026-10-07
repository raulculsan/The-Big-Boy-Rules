-- Ejecutar DESPUÉS de supabase-achievement-progress.sql y supabase-daily-packs.sql.
-- Repetible. Conserva logros, sobres y asignaciones. No borra ni importa actividad histórica.
-- Explorar no significa poseer cartas. La apertura de demostración nunca cuenta.
begin;

alter table public.achievement_rules drop constraint if exists achievement_rules_metric_check;
alter table public.achievement_rules add constraint achievement_rules_metric_check
  check (metric in ('group_messages', 'group_active_days', 'profile_completed', 'daily_packs_earned', 'cards_explored', 'special_cards_explored', 'legendary_cards_explored', 'locations_explored'));

-- Catálogo de identificadores, sin fotos ni datos privados; solo el servidor puede modificarlo.
create table if not exists public.achievement_card_catalog (
  id text primary key,
  edition text not null check (edition in ('common','special','epic','legendary','retro')),
  kind text not null check (kind in ('member','location','object')),
  active boolean not null default true
);
alter table public.achievement_card_catalog drop constraint if exists achievement_card_catalog_edition_check;
alter table public.achievement_card_catalog add constraint achievement_card_catalog_edition_check
  check (edition in ('common','special','epic','legendary','retro'));
alter table public.achievement_card_catalog drop constraint if exists achievement_card_catalog_kind_check;
alter table public.achievement_card_catalog add constraint achievement_card_catalog_kind_check
  check (kind in ('member','location','object'));
alter table public.achievement_card_catalog enable row level security;
revoke all on public.achievement_card_catalog from public, anon, authenticated;
insert into public.achievement_card_catalog(id,edition,kind) values
  ('jose-enrique-fernandez-cruz-normal','common','member'),
  ('miguel-angel-jimenez-sanchez-normal','common','member'),
  ('lizzy-machado-yong-comun','common','member'),
  ('raul-culsan-gonzalez-normal','common','member'),
  ('mario-salvatierra-medina-comun','common','member'),
  ('almudena-de-diego-matilla-comun','common','member'),
  ('caonabo-alberto-normal','common','member'),
  ('alberto-velasco-normal','common','member'),
  ('carlos-gonzalez-motos-normal','common','member'),
  ('felipe-hp-normal','common','member'),
  ('daniel-gonzalez-motos-normal','common','member'),
  ('juan-manuel-perez-saldana-retro','retro','member'),
  ('juan-carlos-vega-quevedo-retro','retro','member'),
  ('luca-de-tena-especial','special','location'),
  ('borox-legendaria','legendary','location'),
  ('abelias-comun','common','location'),
  ('castellana-legendaria','legendary','location'),
  ('carabanchel-legendaria','legendary','location'),
  ('josefa-valcarcel-epica','epic','location'),
  ('mesena-retro','retro','location'),
  ('contrato-de-trabajo-comun','common','object'),
  ('lata-de-red-bull-comun','common','object'),
  ('cafe-del-santander-comun','common','object'),
  ('test-de-embarazo-positivo-comun','common','object'),
  ('la-biblia-epica','epic','object'),
  ('locker-luca-de-tena-legendario','legendary','object'),
  ('big-mac-legendario','legendary','object'),
  ('cubo-de-alitas-kfc-legendario','legendary','object')
on conflict (id) do nothing;

create or replace function public.create_automatic_achievement(
  new_name text, new_description text, new_tier text, new_metric text, new_target integer
) returns bigint language plpgsql security definer set search_path = public, pg_temp as $$
declare
  created_id bigint;
  member_id uuid;
begin
  if not public.current_user_is_club_admin() then raise exception 'No tienes permiso para crear logros.'; end if;
  if new_name is null or char_length(trim(new_name)) not between 2 and 70 then raise exception 'El nombre del logro no es válido.'; end if;
  if char_length(coalesce(new_description, '')) > 240 then raise exception 'La descripción es demasiado larga.'; end if;
  if new_tier is null or new_tier not in ('bronze', 'silver', 'gold', 'platinum') then raise exception 'El rango no es válido.'; end if;
  if new_metric is null or new_metric not in ('group_messages', 'group_active_days', 'profile_completed', 'daily_packs_earned', 'cards_explored', 'special_cards_explored', 'legendary_cards_explored', 'locations_explored') then raise exception 'El objetivo no es válido.'; end if;
  if new_target is null or new_target not between 1 and 100000 or (new_metric = 'profile_completed' and new_target <> 1) then raise exception 'La meta no es válida.'; end if;

  if new_metric in ('cards_explored', 'special_cards_explored', 'legendary_cards_explored', 'locations_explored')
    and new_target > (select count(*) from public.achievement_card_catalog where active
      and (new_metric = 'cards_explored'
        or (new_metric = 'special_cards_explored' and edition = 'special')
        or (new_metric = 'legendary_cards_explored' and edition = 'legendary')
        or (new_metric = 'locations_explored' and kind = 'location'))) then
    raise exception 'La meta supera las cartas disponibles en esta categoría.';
  end if;

  insert into public.achievements (name, description, tier, created_by)
    values (trim(new_name), trim(coalesce(new_description, '')), new_tier, auth.uid()) returning id into created_id;
  insert into public.achievement_rules (achievement_id, metric, target_count)
    values (created_id, new_metric, new_target);

  -- Este objetivo evalúa el estado del perfil, no su historial: si ya está completo, cuenta.
  if new_metric = 'profile_completed' then
    for member_id in select id from public.profiles where not is_hidden
      and nullif(trim(avatar_url), '') is not null and nullif(trim(bio), '') is not null
      and nullif(trim(display_name), '') is not null order by id
    loop
      perform public.record_achievement_activity(member_id, new_metric, 'profile:complete', created_id);
    end loop;
  end if;
  return created_id;
end;
$$;
revoke all on function public.create_automatic_achievement(text, text, text, text, integer) from public, anon, authenticated;
grant execute on function public.create_automatic_achievement(text, text, text, text, integer) to authenticated;


-- El cliente solo comunica la carta explorada; no decide usuario, rareza ni puntuación.
create or replace function public.record_card_exploration(target_card_id text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare
  actor uuid := auth.uid();
  card public.achievement_card_catalog%rowtype;
  rule record;
  changed boolean := false;
begin
  if actor is null then raise exception 'Inicia sesión para registrar tu progreso.' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles where id = actor and not is_hidden) then return false; end if;
  select * into card from public.achievement_card_catalog where id = target_card_id and active;
  if not found then raise exception 'La carta no está disponible.'; end if;
  for rule in
    select r.achievement_id, r.metric from public.achievement_rules r
    where (r.metric = 'cards_explored'
      or (r.metric = 'special_cards_explored' and card.edition = 'special')
      or (r.metric = 'legendary_cards_explored' and card.edition = 'legendary')
      or (r.metric = 'locations_explored' and card.kind = 'location'))
      and not exists (select 1 from public.achievement_progress p
        where p.achievement_id = r.achievement_id and p.user_id = actor and p.completed_at is not null)
      and not exists (select 1 from public.achievement_progress_events e
        where e.achievement_id = r.achievement_id and e.user_id = actor and e.event_key = 'card:' || card.id)
    order by r.achievement_id
  loop
    perform public.record_achievement_activity(actor, rule.metric, 'card:' || card.id, rule.achievement_id);
    changed := true;
  end loop;
  return changed;
end;
$$;
revoke all on function public.record_card_exploration(text) from public, anon, authenticated;
grant execute on function public.record_card_exploration(text) to authenticated;

create or replace function public.track_daily_pack_achievement()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.record_achievement_activity(new.user_id, 'daily_packs_earned', 'pack:' || new.id::text);
  return new;
end;
$$;
revoke all on function public.track_daily_pack_achievement() from public, anon, authenticated;
drop trigger if exists track_daily_pack_achievement on public.card_packs;
create trigger track_daily_pack_achievement after insert on public.card_packs
  for each row execute function public.track_daily_pack_achievement();

notify pgrst, 'reload schema';
commit;

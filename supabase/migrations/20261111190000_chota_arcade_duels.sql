-- Arcade duels ("retos"): after a saved run, a member challenges another to
-- beat that score on the same game and level. The rival has 48 hours and three
-- attempts; each attempt is captured the moment the run is saved (arcade
-- sessions are pruned after a day). The best of those attempts decides it.
-- The winner claims 20 coins (doubled by the coin multiplier) themselves.
begin;
create table if not exists public.chota_arcade_duels (
  id uuid primary key default gen_random_uuid(),
  challenger_id uuid not null references public.profiles(id) on delete cascade,
  rival_id uuid not null references public.profiles(id) on delete cascade,
  game text not null check (game in ('football','skateboard','robot-vacuum','darts')),
  level smallint not null check (level between 1 and 5),
  target_score integer not null check (target_score between 1 and 100000),
  attempts smallint not null default 0 check (attempts between 0 and 3),
  rival_best integer,
  status text not null default 'open' check (status in ('open','won','lost','tied','declined','expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '48 hours',
  resolved_at timestamptz,
  claimed_at timestamptz,
  check (challenger_id <> rival_id)
);
create index if not exists chota_arcade_duels_rival_open on public.chota_arcade_duels(rival_id, game, level) where status = 'open';
create index if not exists chota_arcade_duels_people on public.chota_arcade_duels(challenger_id, rival_id, created_at desc);
alter table public.chota_arcade_duels enable row level security;
revoke all on public.chota_arcade_duels from public, anon, authenticated;
grant all on public.chota_arcade_duels to service_role;

-- "won"/"lost" are from the rival's point of view: won = beat the score.
create or replace function public.settle_chota_duel(d public.chota_arcade_duels)
returns text language sql immutable set search_path = '' as $$
  select case when coalesce(d.rival_best, -1) > d.target_score then 'won'
              when coalesce(d.rival_best, -1) = d.target_score then 'tied' else 'lost' end
$$;

-- Each saved run on the challenged game and level counts as one attempt.
create or replace function public.track_chota_duel_attempt()
returns trigger language plpgsql security definer set search_path = '' as $$
declare duel public.chota_arcade_duels%rowtype;
begin
  if new.finished_at is null or old.finished_at is not null or new.level is null then return new; end if;
  for duel in select * from public.chota_arcade_duels
    where rival_id = new.user_id and game = new.game and level = new.level and status = 'open' and expires_at > now() and created_at <= new.started_at
    order by created_at for update
  loop
    update public.chota_arcade_duels set attempts = attempts + 1, rival_best = greatest(coalesce(rival_best, 0), coalesce(new.score, 0)) where id = duel.id
      returning * into duel;
    if duel.attempts >= 3 then
      update public.chota_arcade_duels set status = public.settle_chota_duel(duel), resolved_at = now() where id = duel.id;
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists track_chota_duel_attempt on club_arcade.sessions;
create trigger track_chota_duel_attempt after update of finished_at on club_arcade.sessions
  for each row execute function public.track_chota_duel_attempt();

create or replace function public.create_chota_duel(p_session uuid, p_rival uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); run club_arcade.sessions%rowtype; created uuid;
begin
  perform public.assert_account_security();
  if actor is null or not exists (select 1 from public.profiles where id = actor and not is_hidden) then raise exception 'Inicia sesión en el club.' using errcode = '42501'; end if;
  select * into run from club_arcade.sessions where id = p_session and user_id = actor;
  if not found or run.finished_at is null or run.level is null or coalesce(run.score, 0) < 1 or run.finished_at < now() - interval '1 day' then
    raise exception 'Reta con una partida que acabes de guardar.' using errcode = '22023';
  end if;
  if p_rival is null or p_rival = actor or not exists (select 1 from public.profiles where id = p_rival and not is_hidden) then raise exception 'Elige a otro miembro.' using errcode = '22023'; end if;
  if not exists (select 1 from public.member_owned_chota_items o join public.chota_item_catalog c on c.id = o.item_id where o.user_id = p_rival and c.art_key = run.game) then
    raise exception 'Esa persona todavía no tiene este juego.' using errcode = '22023';
  end if;
  if run.level > coalesce((select highest_completed from club_arcade.level_progress where user_id = p_rival and game = run.game), 0) + 1 then
    raise exception 'Esa persona aún no ha llegado a este nivel.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('chota-duel:' || actor::text, 0));
  if exists (select 1 from public.chota_arcade_duels where challenger_id = actor and rival_id = p_rival and game = run.game and status = 'open' and expires_at > now()) then
    raise exception 'Ya tienes un reto abierto con esa persona en este juego.' using errcode = '22023';
  end if;
  if (select count(*) from public.chota_arcade_duels where challenger_id = actor and status = 'open' and expires_at > now()) >= 5 then
    raise exception 'Espera a que se resuelva alguno de tus retos.' using errcode = '22023';
  end if;
  insert into public.chota_arcade_duels(challenger_id, rival_id, game, level, target_score)
  values (actor, p_rival, run.game, run.level, run.score) returning id into created;
  return created;
end $$;

-- Lists the member's duels (and the people they can challenge), settling
-- expired ones on the way.
create or replace function public.get_chota_duels()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); duel public.chota_arcade_duels%rowtype;
begin
  if actor is null then raise exception 'Inicia sesión en el club.' using errcode = '42501'; end if;
  for duel in select * from public.chota_arcade_duels where actor in (challenger_id, rival_id) and status = 'open' and expires_at <= now() for update loop
    update public.chota_arcade_duels set status = case when duel.attempts = 0 then 'expired' else public.settle_chota_duel(duel) end, resolved_at = now() where id = duel.id;
  end loop;
  return jsonb_build_object(
    'duels', coalesce((select jsonb_agg(jsonb_build_object(
        'id', d.id, 'incoming', d.rival_id = actor, 'other', coalesce(p.display_name, 'Miembro'), 'game', d.game, 'level', d.level,
        'target_score', d.target_score, 'attempts', d.attempts, 'rival_best', d.rival_best, 'status', d.status,
        'expires_at', d.expires_at, 'resolved_at', d.resolved_at,
        'can_claim', d.claimed_at is null and ((d.status = 'won' and d.rival_id = actor) or (d.status = 'lost' and d.challenger_id = actor)))
        order by (d.status = 'open') desc, d.created_at desc)
      from (select * from public.chota_arcade_duels where actor in (challenger_id, rival_id) and created_at > now() - interval '14 days' order by created_at desc limit 30) d
      join public.profiles p on p.id = case when d.rival_id = actor then d.challenger_id else d.rival_id end), '[]'::jsonb),
    'peers', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', display_name) order by display_name) from public.profiles where id <> actor and not is_hidden), '[]'::jsonb));
end $$;

create or replace function public.decline_chota_duel(p_duel uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid());
begin
  update public.chota_arcade_duels set status = case when attempts = 0 then 'declined' else public.settle_chota_duel(chota_arcade_duels) end, resolved_at = now()
   where id = p_duel and rival_id = actor and status = 'open';
  return public.get_chota_duels();
end $$;

create or replace function public.claim_chota_duel(p_duel uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); duel public.chota_arcade_duels%rowtype; coins integer;
begin
  select * into duel from public.chota_arcade_duels where id = p_duel for update;
  if not found or duel.claimed_at is not null or not ((duel.status = 'won' and duel.rival_id = actor) or (duel.status = 'lost' and duel.challenger_id = actor)) then
    raise exception 'Este premio no está disponible.' using errcode = '22023';
  end if;
  -- At most three duel prizes a day, so friends cannot farm coins by losing on purpose.
  if (select count(*) from public.chota_arcade_duels where claimed_at > now() - interval '1 day'
      and ((status = 'won' and rival_id = actor) or (status = 'lost' and challenger_id = actor))) >= 3 then
    raise exception 'Ya has cobrado tres retos hoy. Vuelve mañana a por este premio.' using errcode = '22023';
  end if;
  coins := club_rewards.award_coins(actor, 'duel:' || duel.id, 'club', 20, jsonb_build_object('game', duel.game, 'level', duel.level));
  update public.chota_arcade_duels set claimed_at = now() where id = duel.id;
  return public.get_chota_duels() || jsonb_build_object('awarded_coins', coins);
end $$;

revoke all on function public.settle_chota_duel(public.chota_arcade_duels), public.track_chota_duel_attempt() from public, anon, authenticated;
revoke all on function public.create_chota_duel(uuid, uuid), public.get_chota_duels(), public.decline_chota_duel(uuid), public.claim_chota_duel(uuid) from public, anon;
grant execute on function public.create_chota_duel(uuid, uuid), public.get_chota_duels(), public.decline_chota_duel(uuid), public.claim_chota_duel(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;

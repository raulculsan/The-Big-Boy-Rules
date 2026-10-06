-- Ejecutar DESPUÉS de supabase-achievements.sql. Conserva los logros y asignaciones existentes.
-- No lee ni contabiliza mensajes privados. No importa actividad histórica.
begin;

create table if not exists public.achievement_rules (
  achievement_id bigint primary key references public.achievements(id) on delete cascade,
  metric text not null check (metric in ('group_messages', 'group_active_days', 'profile_completed')),
  target_count integer not null check (target_count between 1 and 100000),
  created_at timestamptz not null default clock_timestamp(),
  check (metric <> 'profile_completed' or target_count = 1)
);
create index if not exists achievement_rules_metric_idx on public.achievement_rules(metric);

create table if not exists public.achievement_progress (
  achievement_id bigint not null references public.achievement_rules(achievement_id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  current_value integer not null default 0 check (current_value >= 0),
  completed_at timestamptz,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (achievement_id, user_id)
);
create index if not exists achievement_progress_user_idx on public.achievement_progress(user_id);

-- Solo claves de deduplicación: nunca el contenido del mensaje ni datos del perfil.
create table if not exists public.achievement_progress_events (
  achievement_id bigint not null references public.achievement_rules(achievement_id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_key text not null,
  primary key (achievement_id, user_id, event_key)
);

alter table public.achievement_rules enable row level security;
alter table public.achievement_progress enable row level security;
alter table public.achievement_progress_events enable row level security;
revoke all on public.achievement_rules, public.achievement_progress, public.achievement_progress_events from public, anon, authenticated;
grant select on public.achievement_rules, public.achievement_progress to authenticated;
drop policy if exists "members read achievement rules" on public.achievement_rules;
create policy "members read achievement rules" on public.achievement_rules
  for select to authenticated using (true);
drop policy if exists "members read own achievement progress" on public.achievement_progress;
create policy "members read own achievement progress" on public.achievement_progress
  for select to authenticated using (user_id = (select auth.uid()));

-- Solo los triggers y la creación del objetivo pueden invocar este contador.
create or replace function public.record_achievement_activity(
  actor_id uuid, metric_name text, activity_key text, only_achievement_id bigint default null
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  rule record;
  progress_value integer;
begin
  if not exists (select 1 from public.profiles where id = actor_id and not is_hidden) then return; end if;
  for rule in
    select r.achievement_id, r.target_count, a.created_by
    from public.achievement_rules r join public.achievements a on a.id = r.achievement_id
    where r.metric = metric_name
      and (only_achievement_id is null or r.achievement_id = only_achievement_id)
      and not exists (select 1 from public.achievement_progress p
        where p.achievement_id = r.achievement_id and p.user_id = actor_id and p.completed_at is not null)
    order by r.achievement_id
  loop
    insert into public.achievement_progress_events (achievement_id, user_id, event_key)
      values (rule.achievement_id, actor_id, activity_key) on conflict do nothing;
    if not found then continue; end if;

    insert into public.achievement_progress as p (achievement_id, user_id, current_value, completed_at)
      values (rule.achievement_id, actor_id, 1, case when rule.target_count = 1 then clock_timestamp() end)
      on conflict (achievement_id, user_id) do update
      set current_value = least(p.current_value + 1, rule.target_count),
          completed_at = coalesce(p.completed_at, case when p.current_value + 1 >= rule.target_count then clock_timestamp() end),
          updated_at = clock_timestamp()
      returning current_value into progress_value;

    if progress_value >= rule.target_count then
      insert into public.achievement_awards (achievement_id, user_id, awarded_by)
        values (rule.achievement_id, actor_id, rule.created_by)
        on conflict (achievement_id, user_id) do nothing;
    end if;
  end loop;
end;
$$;
revoke all on function public.record_achievement_activity(uuid, text, text, bigint) from public, anon, authenticated;

create or replace function public.track_group_achievement_activity()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- La fecha del cliente no decide el día. Editar o borrar no genera otro evento.
  -- Todos los mensajes/categorías comparten una única aportación por día y usuario.
  perform public.record_achievement_activity(new.user_id, 'group_messages',
    'day:' || to_char(statement_timestamp() at time zone 'Europe/Madrid', 'YYYY-MM-DD'));
  return new;
end;
$$;
revoke all on function public.track_group_achievement_activity() from public, anon, authenticated;
drop trigger if exists track_group_achievement_activity on public.messages;
create trigger track_group_achievement_activity after insert on public.messages
  for each row execute function public.track_group_achievement_activity();

-- Sesión nueva o restaurada: el cliente no elige usuario ni fecha.
create or replace function public.record_daily_app_visit()
returns date language plpgsql security definer set search_path = public, pg_temp as $$
declare
  actor_id uuid := auth.uid();
  visit_day date := (statement_timestamp() at time zone 'Europe/Madrid')::date;
begin
  if actor_id is null then raise exception 'Inicia sesión para registrar tu participación.'; end if;
  if not exists (select 1 from public.profiles where id = actor_id and not is_hidden) then return null; end if;
  perform public.record_achievement_activity(actor_id, 'group_active_days', 'day:' || visit_day::text);
  return visit_day;
end;
$$;
revoke all on function public.record_daily_app_visit() from public, anon, authenticated;
grant execute on function public.record_daily_app_visit() to authenticated;

create or replace function public.track_profile_achievement_activity()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not new.is_hidden and nullif(trim(new.avatar_url), '') is not null
    and nullif(trim(new.bio), '') is not null and nullif(trim(new.display_name), '') is not null then
    perform public.record_achievement_activity(new.id, 'profile_completed', 'profile:complete');
  end if;
  return new;
end;
$$;
revoke all on function public.track_profile_achievement_activity() from public, anon, authenticated;
drop trigger if exists track_profile_achievement_activity on public.profiles;
create trigger track_profile_achievement_activity after insert or update of avatar_url, bio, display_name, is_hidden on public.profiles
  for each row execute function public.track_profile_achievement_activity();

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
  if new_metric is null or new_metric not in ('group_messages', 'group_active_days', 'profile_completed') then raise exception 'El objetivo no es válido.'; end if;
  if new_target is null or new_target not between 1 and 100000 or (new_metric = 'profile_completed' and new_target <> 1) then raise exception 'La meta no es válida.'; end if;

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

-- Un logro automático no se puede otorgar/retirar manualmente ni llamando a la API.
drop policy if exists "admins create achievement awards" on public.achievement_awards;
create policy "admins create achievement awards" on public.achievement_awards
  for insert to authenticated with check (awarded_by = auth.uid() and public.current_user_is_club_admin()
    and not exists (select 1 from public.achievement_rules where achievement_id = achievement_awards.achievement_id));
drop policy if exists "admins delete achievement awards" on public.achievement_awards;
create policy "admins delete achievement awards" on public.achievement_awards
  for delete to authenticated using (public.current_user_is_club_admin()
    and not exists (select 1 from public.achievement_rules where achievement_id = achievement_awards.achievement_id));

create or replace function public.set_achievement_awards(target_achievement_id bigint, target_user_ids uuid[])
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.current_user_is_club_admin() then raise exception 'No tienes permiso para asignar logros.'; end if;
  perform 1 from public.achievements where id = target_achievement_id for update;
  if not found then raise exception 'El logro no existe.'; end if;
  if exists (select 1 from public.achievement_rules where achievement_id = target_achievement_id) then
    raise exception 'Este logro se consigue automáticamente. No admite asignaciones manuales.';
  end if;
  delete from public.achievement_awards where achievement_id = target_achievement_id
    and not (user_id = any(coalesce(target_user_ids, '{}'::uuid[])));
  insert into public.achievement_awards (achievement_id, user_id, awarded_by)
    select target_achievement_id, profile.id, auth.uid() from public.profiles profile
    where profile.id = any(coalesce(target_user_ids, '{}'::uuid[])) and not profile.is_hidden
    on conflict (achievement_id, user_id) do nothing;
end;
$$;
revoke all on function public.set_achievement_awards(bigint, uuid[]) from public, anon, authenticated;
grant execute on function public.set_achievement_awards(bigint, uuid[]) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.achievement_rules;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.achievement_progress;
exception when duplicate_object then null;
end $$;
notify pgrst, 'reload schema';
commit;

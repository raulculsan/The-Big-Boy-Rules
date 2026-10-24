-- Separate account-backed arcade levels. Legacy score RPCs remain available
-- so installed clients keep their daily reward and ranking behavior.
begin;
alter table club_arcade.sessions
  add column level smallint check (level between 1 and 5),
  add column level_cleared boolean not null default false;
create table club_arcade.level_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  game text not null check (game in ('football','skateboard','robot-vacuum')),
  highest_completed smallint not null default 0 check (highest_completed between 0 and 5),
  updated_at timestamptz not null default now(),
  primary key (user_id,game)
);
alter table club_arcade.level_progress enable row level security;
revoke all on club_arcade.level_progress from public,anon,authenticated;

create function public.get_chota_level_progress()
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); result jsonb;
begin
  perform public.assert_account_security();
  if actor is null or not exists(select 1 from public.profiles where id=actor and not is_hidden) then
    raise exception 'Inicia sesión en el club.' using errcode='42501';
  end if;
  select coalesce(jsonb_object_agg(game,highest_completed),'{}'::jsonb) into result
    from club_arcade.level_progress where user_id=actor;
  return jsonb_build_object('football',0,'skateboard',0,'robot-vacuum',0)||result;
end $$;

create function public.start_chota_level(target_game text,target_level integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); highest integer; result uuid;
begin
  perform public.assert_account_security();
  if actor is null or not exists(select 1 from public.profiles where id=actor and not is_hidden) then
    raise exception 'Inicia sesión en el club.' using errcode='42501';
  end if;
  if target_game is null or target_game not in ('football','skateboard','robot-vacuum')
    or target_level is null or target_level not between 1 and 5 then
    raise exception 'Nivel no válido.' using errcode='22023';
  end if;
  select highest_completed into highest from club_arcade.level_progress where user_id=actor and game=target_game;
  if target_level>least(5,coalesce(highest,0)+1) then
    raise exception 'Supera primero el nivel anterior.' using errcode='42501';
  end if;
  -- The existing entry point verifies object ownership and the start rate limit.
  result:=public.start_chota_game(target_game);
  update club_arcade.sessions set level=target_level where id=result and user_id=actor;
  return result;
end $$;

create function public.submit_chota_level_score(
  game_session_id uuid,submitted_score integer,completed_round boolean default false,level_won boolean default false
) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); game_row club_arcade.sessions%rowtype; result jsonb;
  goal integer; duration integer; elapsed numeric; cleared boolean; highest integer;
begin
  perform public.assert_account_security();
  if actor is null or not exists(select 1 from public.profiles where id=actor and not is_hidden) then
    raise exception 'Inicia sesión en el club.' using errcode='42501';
  end if;
  select * into game_row from club_arcade.sessions where id=game_session_id and user_id=actor for update;
  if not found or game_row.level is null then
    raise exception 'Nivel no válido.' using errcode='42501';
  end if;
  -- Never reinterpret a completed receipt on retry. Reward and score validation
  -- still run through the existing idempotent server function.
  if game_row.finished_at is null then
    goal:=case game_row.game when 'football' then (array[10,14,18,22,26])[game_row.level]
      when 'skateboard' then (array[8,10,12,14,16])[game_row.level] else 30 end;
    duration:=case game_row.game when 'robot-vacuum' then (array[30,40,50,60,75])[game_row.level] else 30 end;
    elapsed:=extract(epoch from clock_timestamp()-game_row.started_at);
    cleared:=coalesce(level_won,false) and coalesce(completed_round,false)
      and submitted_score>=goal and elapsed<=duration+15
      and (game_row.game<>'football' or elapsed>=29);
    result:=public.submit_chota_game_score(game_session_id,submitted_score,completed_round);
    if cleared then
      insert into club_arcade.level_progress(user_id,game,highest_completed)
        values(actor,game_row.game,game_row.level)
      on conflict(user_id,game) do update set
        highest_completed=greatest(club_arcade.level_progress.highest_completed,excluded.highest_completed),updated_at=now();
      update club_arcade.sessions set level_cleared=true where id=game_session_id;
    end if;
  else
    cleared:=game_row.level_cleared;
    result:=public.submit_chota_game_score(game_session_id,submitted_score,completed_round);
  end if;
  select highest_completed into highest from club_arcade.level_progress where user_id=actor and game=game_row.game;
  return result||jsonb_build_object('level_completed',coalesce(cleared,false),'highest_completed',coalesce(highest,0),'unlocked_level',least(5,coalesce(highest,0)+1));
end $$;
revoke all on function public.get_chota_level_progress(),public.start_chota_level(text,integer),public.submit_chota_level_score(uuid,integer,boolean,boolean) from public,anon,authenticated;
grant execute on function public.get_chota_level_progress(),public.start_chota_level(text,integer),public.submit_chota_level_score(uuid,integer,boolean,boolean) to authenticated;
commit;

-- Friendly scores only: these records cannot grant money, packs or trophies.
begin;
create schema if not exists club_arcade;
revoke all on schema club_arcade from public,anon,authenticated;
create table club_arcade.sessions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 game text not null check(game in ('football','skateboard','robot-vacuum')),
 started_at timestamptz not null default clock_timestamp(),
 finished_at timestamptz,
 score integer check(score between 0 and 120)
);
create index on club_arcade.sessions(user_id,started_at desc);
create table club_arcade.best_scores (
 user_id uuid not null references public.profiles(id) on delete cascade,
 game text not null check(game in ('football','skateboard','robot-vacuum')),
 score integer not null check(score between 0 and 120),
 achieved_at timestamptz not null default clock_timestamp(),
 primary key(user_id,game)
);
create index on club_arcade.best_scores(game,score desc,achieved_at);
alter table club_arcade.sessions enable row level security;
alter table club_arcade.best_scores enable row level security;
revoke all on all tables in schema club_arcade from public,anon,authenticated;
create function public.start_chota_game(target_game text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); result uuid;
begin
 perform public.assert_account_security();
 if actor is null or not exists(select 1 from public.profiles where id=actor and not is_hidden) then raise exception 'Inicia sesión en el club.' using errcode='42501'; end if;
 if target_game is null or target_game not in('football','skateboard','robot-vacuum') then raise exception 'Juego no válido.' using errcode='22023'; end if;
 if not exists(select 1 from public.member_owned_chota_items o join public.chota_item_catalog c on c.id=o.item_id where o.user_id=actor and c.art_key=target_game) then raise exception 'Primero consigue el objeto en la tienda.' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('chota-arcade:'||actor::text,0));
 if exists(select 1 from club_arcade.sessions where user_id=actor and started_at>clock_timestamp()-interval '5 seconds') then raise exception 'Espera un momento antes de otra partida.' using errcode='22023'; end if;
 delete from club_arcade.sessions where user_id=actor and started_at<clock_timestamp()-interval '1 day';
 insert into club_arcade.sessions(user_id,game) values(actor,target_game) returning id into result;
 return result;
end $$;
create function public.submit_chota_game_score(game_session_id uuid,submitted_score integer)
returns integer language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); game_row club_arcade.sessions%rowtype; elapsed numeric; maximum integer; best integer;
begin
 perform public.assert_account_security();
 if actor is null or not exists(select 1 from public.profiles where id=actor and not is_hidden) then raise exception 'Inicia sesión en el club.' using errcode='42501'; end if;
 select * into game_row from club_arcade.sessions where id=game_session_id and user_id=actor for update;
 if not found then raise exception 'Partida no válida.' using errcode='42501'; end if;
 if game_row.finished_at is not null then select score into best from club_arcade.best_scores where user_id=actor and game=game_row.game; return coalesce(best,0); end if;
 elapsed:=extract(epoch from clock_timestamp()-game_row.started_at);
 maximum:=case game_row.game when 'football' then least(120,floor(elapsed*4+2)::integer) when 'skateboard' then least(30,floor(elapsed)::integer) else 20 end;
 if submitted_score is null or submitted_score<0 or submitted_score>maximum or elapsed<1 or elapsed>120 then raise exception 'Puntuación fuera de los límites de la partida.' using errcode='22023'; end if;
 update club_arcade.sessions set score=submitted_score,finished_at=clock_timestamp() where id=game_row.id;
 insert into club_arcade.best_scores(user_id,game,score) values(actor,game_row.game,submitted_score)
 on conflict(user_id,game) do update set score=excluded.score,achieved_at=clock_timestamp() where excluded.score>club_arcade.best_scores.score;
 select score into best from club_arcade.best_scores where user_id=actor and game=game_row.game;
 return best;
end $$;
create function public.get_chota_game_leaderboard(target_game text)
returns table(name text,score integer) language plpgsql stable security definer set search_path='' as $$
begin
 perform public.assert_account_security();
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and not is_hidden) then raise exception 'Inicia sesión en el club.' using errcode='42501'; end if;
 if target_game is null or target_game not in('football','skateboard','robot-vacuum') then raise exception 'Juego no válido.' using errcode='22023'; end if;
 return query select p.display_name::text,s.score from club_arcade.best_scores s join public.profiles p on p.id=s.user_id where s.game=target_game and not p.is_hidden order by s.score desc,s.achieved_at limit 10;
end $$;
revoke all on function public.start_chota_game(text),public.submit_chota_game_score(uuid,integer),public.get_chota_game_leaderboard(text) from public,anon,authenticated;
grant execute on function public.start_chota_game(text),public.submit_chota_game_score(uuid,integer),public.get_chota_game_leaderboard(text) to authenticated;
commit;

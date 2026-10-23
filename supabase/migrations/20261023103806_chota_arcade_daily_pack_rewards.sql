-- One pack per completed game and Madrid calendar day. Scores, receipts and
-- packs commit together; clients never receive INSERT rights on reward tables.
begin;
alter table club_arcade.sessions add column reward_status text
  check (reward_status in ('awarded','already_claimed','ineligible'));
alter table club_arcade.sessions add column reward_day date;

drop function public.submit_chota_game_score(uuid,integer);
create function public.submit_chota_game_score(
  game_session_id uuid, submitted_score integer, completed_round boolean default false
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  actor uuid:=auth.uid();
  game_row club_arcade.sessions%rowtype;
  elapsed numeric;
  maximum integer;
  best integer;
  today date:=(statement_timestamp() at time zone 'Europe/Madrid')::date;
  outcome text:='ineligible';
  receipt text;
begin
  perform public.assert_account_security();
  if actor is null or not exists(select 1 from public.profiles where id=actor and not is_hidden) then
    raise exception 'Inicia sesión en el club.' using errcode='42501';
  end if;
  select * into game_row from club_arcade.sessions
    where id=game_session_id and user_id=actor for update;
  if not found then raise exception 'Partida no válida.' using errcode='42501'; end if;
  -- Return the stored outcome on retries, including after midnight. No new grant.
  if game_row.finished_at is not null then
    select score into best from club_arcade.best_scores where user_id=actor and game=game_row.game;
    return jsonb_build_object('best',coalesce(best,0),'reward_status',coalesce(game_row.reward_status,'ineligible'),'reward_day',game_row.reward_day);
  end if;
  elapsed:=extract(epoch from clock_timestamp()-game_row.started_at);
  maximum:=case game_row.game
    when 'football' then least(120,floor(elapsed*4+2)::integer)
    when 'skateboard' then least(30,floor(elapsed)::integer)
    else 30 end;
  if submitted_score is null or submitted_score<0 or submitted_score>maximum or elapsed<1 or elapsed>120 then
    raise exception 'Puntuación fuera de los límites de la partida.' using errcode='22023';
  end if;
  insert into club_arcade.best_scores(user_id,game,score) values(actor,game_row.game,submitted_score)
    on conflict(user_id,game) do update set score=excluded.score,achieved_at=clock_timestamp()
      where excluded.score>club_arcade.best_scores.score;
  if completed_round is true and elapsed>=12 then
    receipt:='arcade:'||game_row.game||':'||today;
    insert into public.member_reward_pack_grants(user_id,event_key,packs)
      values(actor,receipt,1) on conflict do nothing;
    if found then
      insert into public.card_packs(user_id,earned_day,source)
        values(actor,today,'arcade_'||game_row.game);
      outcome:='awarded';
    else outcome:='already_claimed'; end if;
  end if;
  update club_arcade.sessions set score=submitted_score,finished_at=clock_timestamp(),
    reward_status=outcome,reward_day=today where id=game_row.id;
  select score into best from club_arcade.best_scores where user_id=actor and game=game_row.game;
  return jsonb_build_object('best',coalesce(best,0),'reward_status',outcome,'reward_day',today);
end $$;
revoke all on function public.submit_chota_game_score(uuid,integer,boolean) from public,anon,authenticated;
grant execute on function public.submit_chota_game_score(uuid,integer,boolean) to authenticated;
commit;

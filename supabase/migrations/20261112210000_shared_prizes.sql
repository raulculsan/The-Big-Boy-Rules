-- Shared prizes: the Chota's dilemma and the games night pay every member who
-- won, not only the one whose request closes the day. award_coins only pays the
-- caller (actor = auth.uid()), so when a day had a winning voter other than
-- the member who opened the app next, resolving it failed with 42501. That
-- left the story stuck on 11 November: get_club_story answered 403 for
-- everyone, and the sede lost the day's sign and props.
--
-- grant_coins is the internal payout for prizes the server decides itself. It
-- is not callable from the API; award_coins keeps its caller checks and uses it.
begin;
create or replace function club_rewards.grant_coins(member uuid, reward_key text, reward_category text, amount integer, details jsonb default '{}'::jsonb)
returns integer language plpgsql security definer set search_path = '' as $function$
declare balance_after bigint; credited integer;
begin
  if member is null or not exists (select 1 from public.profiles where id = member and not is_hidden) then return 0; end if;
  if amount not between 1 and 60 then raise exception 'Premio no válido.' using errcode='22023'; end if;
  insert into public.member_coin_wallets(user_id) values (member) on conflict do nothing;
  perform 1 from public.member_coin_wallets where user_id = member for update;
  credited := amount * club_rewards.coin_multiplier();
  insert into club_rewards.coin_receipts(user_id,reward_id,category,coins,metadata)
    values(member,reward_key,reward_category,credited,details) on conflict do nothing;
  if not found then return 0; end if;
  update public.member_coin_wallets set balance=balance+credited where user_id=member returning balance into balance_after;
  insert into public.member_coin_ledger(user_id,delta,balance_after,reason,item_id,copies)
    values(member,credited,balance_after,'mission_reward',reward_key,1);
  return credited;
end $function$;
revoke all on function club_rewards.grant_coins(uuid, text, text, integer, jsonb) from public, anon, authenticated;

create or replace function club_rewards.award_coins(actor uuid, reward_key text, reward_category text, amount integer, details jsonb default '{}'::jsonb)
returns integer language plpgsql security definer set search_path = '' as $function$
begin
  perform public.assert_account_security();
  if actor is null or actor is distinct from auth.uid() then raise exception 'Cuenta no válida.' using errcode='42501'; end if;
  perform public.lock_banner_shop_actor();
  return club_rewards.grant_coins(actor, reward_key, reward_category, amount, details);
end $function$;

-- Same body as before; only the payout changes to grant_coins.
create or replace function club_story.resolve(target uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare d club_story.days; picked smallint; total integer; opts jsonb; chosen jsonb; ranked smallint[]; r record;
begin
  select * into d from club_story.days where id=target for update;
  if d.resolved_at is not null then return; end if;
  select options into opts from club_story.chapters where key=d.chapter_key;
  select array_agg(i::smallint order by votes desc,md5(i::text||d.id::text)),sum(votes) into ranked,total
    from (select i,(select count(*) from club_story.votes v where v.day_id=d.id and v.option=i) votes
      from generate_series(0,jsonb_array_length(opts)-1) i) c;
  picked:=case when d.twist_by is not null then ranked[2] else ranked[1] end;
  chosen:=opts->picked;
  update club_story.days set winner=picked,votes_total=total,resolved_at=statement_timestamp(),next_key=chosen->>'next' where id=d.id;
  update club_story.seasons set
    money=club_story.clamp(money+(chosen->>'money')::int),
    fame=club_story.clamp(fame+(chosen->>'fame')::int),
    energy=club_story.clamp(energy+(chosen->>'energy')::int),
    trouble=club_story.clamp(trouble+(chosen->>'trouble')::int)
    where id=d.season_id;
  for r in select user_id,option from club_story.votes where day_id=d.id loop
    insert into club_story.members(season_id,user_id,streak,best)
      values(d.season_id,r.user_id,(r.option=picked)::int,(r.option=picked)::int)
      on conflict(season_id,user_id) do update set
        streak=case when r.option=picked then club_story.members.streak+1 else 0 end,
        best=greatest(club_story.members.best,case when r.option=picked then club_story.members.streak+1 else 0 end);
    if r.option=picked then perform club_rewards.grant_coins(r.user_id,'story-win:'||d.id,'club',2); end if;
  end loop;
end $$;

-- The games night pays everyone on the scoreboard the same way.
do $$
declare definition text := pg_get_functiondef('public.finish_club_night(bigint,date)'::regprocedure);
begin
  if position('club_rewards.award_coins(p.id' in definition) = 0 then raise exception 'finish_club_night changed; review this migration.'; end if;
  execute replace(definition, 'club_rewards.award_coins(p.id', 'club_rewards.grant_coins(p.id');
end $$;
commit;

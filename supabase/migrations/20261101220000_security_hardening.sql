begin;

-- Least privilege. RLS already blocked these paths; the grants themselves now go too.
-- SELECT stays for anon so signed-out reads keep returning no rows instead of errors.
do $$ declare t text; begin
  for t in select quote_ident(tablename) from pg_tables where schemaname='public' loop
    execute format('revoke truncate,trigger,references on public.%s from anon,authenticated',t);
    execute format('revoke insert,update,delete on public.%s from anon',t);
  end loop;
end $$;

-- Trigger functions run without an EXECUTE grant. RPCs stay available to signed-in members.
revoke all on function public.sync_help_request_from_message(),public.handle_new_big_boy(),public.notify_media_like(),public.notify_media_created(),public.notify_media_reply(),public.notify_private_message(),public.keep_closed_help_request_locked(),public.reject_closed_help_message(),public.notify_account_request() from public,anon,authenticated;
revoke all on function public.create_help_request(text,text),public.create_achievement_with_awards(text,text,text,text,uuid[]),public.set_club_member_role(uuid,text) from public,anon;
grant execute on function public.create_achievement_with_awards(text,text,text,text,uuid[]),public.set_club_member_role(uuid,text) to authenticated;
revoke all on function public.create_help_request(text,text) from authenticated;

-- Every supported client creates and answers tickets through the checked functions.
drop policy if exists "members create own help requests" on public.help_requests;
drop policy if exists "participants create help messages" on public.help_messages;

update storage.buckets set file_size_limit=52428800 where id='group-media';

-- Mistaken entries can be removed; a small daily cap stops accidental floods.
create function public.delete_tab_expense(p_expense uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=club_plus.guard();
begin
  delete from club_plus.expenses e using club_plus.tabs t
    where e.id=p_expense and t.id=e.tab_id and t.settled_at is null
      and (actor in (e.created_by,e.payer,t.created_by) or public.current_user_is_club_admin());
  if not found then raise exception 'No puedes borrar este gasto.' using errcode='42501'; end if;
  return club_plus.state(actor);
end $$;

create function public.delete_club_match(p_match uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=club_plus.guard();
begin
  delete from club_plus.matches where id=p_match and (actor in (created_by,winner,loser) or public.current_user_is_club_admin());
  if not found then raise exception 'No puedes borrar esta partida.' using errcode='42501'; end if;
  return club_plus.games(actor);
end $$;

create function club_plus.limit_daily() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if (select count(*) from club_plus.date_polls where created_by=new.created_by and created_at>statement_timestamp()-interval '1 day')
    +(select count(*) from club_plus.tabs where created_by=new.created_by and created_at>statement_timestamp()-interval '1 day')>=5 then
    raise exception 'Has creado muchas cosas hoy. Inténtalo mañana.' using errcode='22023';
  end if;
  return new;
end $$;
create trigger limit_daily before insert on club_plus.date_polls for each row execute function club_plus.limit_daily();
create trigger limit_daily before insert on club_plus.tabs for each row execute function club_plus.limit_daily();

-- Matches now carry their id so the client can offer deletion.
create or replace function club_plus.games(actor uuid) returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'trials',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'accused',t.accused,'accuser',t.accuser,'charge',t.charge,'defence',t.defence,
        'closed',t.closes_at<=statement_timestamp(),'closes_at',t.closes_at,
        'vote',(select guilty from club_plus.trial_votes v where v.trial_id=t.id and v.user_id=actor),
        'guilty',(select count(*) from club_plus.trial_votes v where v.trial_id=t.id and v.guilty),
        'innocent',(select count(*) from club_plus.trial_votes v where v.trial_id=t.id and not v.guilty)) order by t.created_at desc)
      from club_plus.trials t where t.created_at>statement_timestamp()-interval '9 days'),'[]'::jsonb),
    'challenge',jsonb_build_object('prompt',club_plus.challenge_now(),
      'entries',coalesce((select jsonb_agg(jsonb_build_object('user',e.user_id,'body',e.body,
          'votes',(select count(*) from club_plus.challenge_votes v where v.week=e.week and v.author=e.user_id),
          'mine',exists(select 1 from club_plus.challenge_votes v where v.week=e.week and v.author=e.user_id and v.user_id=actor)) order by e.user_id)
        from club_plus.challenge_entries e where e.week=club_plus.week()),'[]'::jsonb)),
    'lies',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'author',l.author,'claims',to_jsonb(l.claims),
        'guess',g.guess,'own',l.author=actor,
        'lie',case when l.author=actor or g.guess is not null then l.lie end,
        'fooled',(select count(*) from club_plus.lie_guesses x where x.lie_id=l.id and x.guess<>l.lie),
        'guesses',(select count(*) from club_plus.lie_guesses x where x.lie_id=l.id)) order by l.created_at desc)
      from club_plus.lies l left join club_plus.lie_guesses g on g.lie_id=l.id and g.user_id=actor
      where l.created_at>statement_timestamp()-interval '21 days'),'[]'::jsonb),
    'league',coalesce((select jsonb_agg(jsonb_build_object('id',who,'won',won,'lost',lost,'points',won*3) order by won desc,lost)
      from (select who,count(*) filter (where won_it) as won,count(*) filter (where not won_it) as lost from
        (select winner as who,true as won_it from club_plus.matches union all select loser,false from club_plus.matches) r group by who) t),'[]'::jsonb),
    'matches',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'game',m.game,'winner',m.winner,'loser',m.loser,'at',m.played_at,'own',actor in (m.created_by,m.winner,m.loser)) order by m.played_at desc)
      from (select * from club_plus.matches order by played_at desc limit 8) m),'[]'::jsonb))
$$;
revoke all on function club_plus.games(uuid),club_plus.limit_daily() from public,anon,authenticated;

revoke all on function public.delete_tab_expense(uuid),public.delete_club_match(uuid) from public,anon;
grant execute on function public.delete_tab_expense(uuid),public.delete_club_match(uuid) to authenticated;

commit;

begin;
alter table public.club_event_memories add column caption text not null default '' check(length(caption)<=160), add column featured boolean not null default false;
create policy edit_own_memory on public.club_event_memories for update to authenticated using(created_by=(select auth.uid()) or public.current_user_can_manage()) with check(created_by=(select auth.uid()) or public.current_user_can_manage());
create function public.club_memory_edit_guard() returns trigger language plpgsql security invoker set search_path='' as $$ begin
 if (new.id,new.event_id,new.occurrence,new.moment_id,new.created_by,new.created_at) is distinct from (old.id,old.event_id,old.occurrence,old.moment_id,old.created_by,old.created_at) then raise exception 'Solo puedes cambiar el texto o destacar la foto.'; end if;
 return new; end $$;
revoke all on function public.club_memory_edit_guard() from public,anon,authenticated;
create trigger club_memory_edit_guard before update on public.club_event_memories for each row execute function public.club_memory_edit_guard();
create table public.club_event_recaps (
 event_id bigint not null references public.group_events(id) on delete cascade,
 occurrence date not null, highlight text not null default '' check(length(highlight)<=500),
 created_by uuid not null references public.profiles(id), updated_at timestamptz not null default now(), primary key(event_id,occurrence)
);
create index club_event_recaps_author_idx on public.club_event_recaps(created_by);
alter table public.club_event_recaps enable row level security;
revoke all on public.club_event_recaps from public,anon,authenticated;
grant select,insert,update,delete on public.club_event_recaps to authenticated;
create policy recap_member_gate on public.club_event_recaps as restrictive for all to authenticated using((select public.account_security_satisfied()) and exists(select 1 from public.profiles where id=(select auth.uid()))) with check((select public.account_security_satisfied()) and exists(select 1 from public.profiles where id=(select auth.uid())));
create policy recap_read on public.club_event_recaps for select to authenticated using(true);
create policy recap_insert on public.club_event_recaps for insert to authenticated with check(created_by=(select auth.uid()) and exists(select 1 from public.group_events e where e.id=event_id and (e.created_by=(select auth.uid()) or public.current_user_can_manage())));
create policy recap_update on public.club_event_recaps for update to authenticated using(exists(select 1 from public.group_events e where e.id=event_id and (e.created_by=(select auth.uid()) or public.current_user_can_manage()))) with check(exists(select 1 from public.group_events e where e.id=event_id and (e.created_by=(select auth.uid()) or public.current_user_can_manage())));
create policy recap_delete on public.club_event_recaps for delete to authenticated using(exists(select 1 from public.group_events e where e.id=event_id and (e.created_by=(select auth.uid()) or public.current_user_can_manage())));
create function public.club_recap_guard() returns trigger language plpgsql security invoker set search_path='' as $$ declare e public.group_events%rowtype; begin
 if tg_op='UPDATE' and (new.event_id,new.occurrence,new.created_by) is distinct from (old.event_id,old.occurrence,old.created_by) then raise exception 'La identidad del recuerdo no puede cambiar.'; end if;
 select * into strict e from public.group_events where id=new.event_id;
 if (not e.annual and new.occurrence<>(e.starts_at at time zone 'Europe/Madrid')::date) or (e.annual and to_char(new.occurrence,'MM-DD')<>to_char(e.starts_at at time zone 'Europe/Madrid','MM-DD')) then raise exception 'La fecha no corresponde al plan.'; end if;
 if new.occurrence>(now() at time zone 'Europe/Madrid')::date then raise exception 'El resumen estará disponible desde el día del plan.'; end if;
 new.updated_at=now(); return new; end $$;
revoke all on function public.club_recap_guard() from public,anon,authenticated;
create trigger club_recap_guard before insert or update on public.club_event_recaps for each row execute function public.club_recap_guard();

-- Keep weekly records separately: short-lived arcade sessions are purged daily.
create table club_arcade.weekly_scores (
 week_start date not null,user_id uuid not null references public.profiles(id) on delete cascade,
 game text not null check(game in ('football','skateboard','robot-vacuum')),score integer not null check(score between 0 and 120),
 achieved_at timestamptz not null default now(), primary key(week_start,user_id,game)
);
create index weekly_scores_ranking_idx on club_arcade.weekly_scores(week_start,game,score desc,achieved_at);
alter table club_arcade.weekly_scores enable row level security;
revoke all on club_arcade.weekly_scores from public,anon,authenticated;
create function club_arcade.record_weekly_score() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if old.finished_at is null and new.finished_at is not null and new.reward_status in ('awarded','already_claimed') then
 insert into club_arcade.weekly_scores(week_start,user_id,game,score,achieved_at)
 values(date_trunc('week',new.finished_at at time zone 'Europe/Madrid')::date,new.user_id,new.game,new.score,new.finished_at)
 on conflict(week_start,user_id,game) do update set score=excluded.score,achieved_at=excluded.achieved_at where excluded.score>club_arcade.weekly_scores.score;
 end if; return new; end $$;
revoke all on function club_arcade.record_weekly_score() from public,anon,authenticated;
create trigger record_weekly_score after update on club_arcade.sessions for each row execute function club_arcade.record_weekly_score();
-- Public API wrappers are deliberately guarded; private score/reward tables have no client grants.
create function public.get_chota_weekly_challenge() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid(); wk date:=date_trunc('week',now() at time zone 'Europe/Madrid')::date; selected_game text; target_score integer; qualifying integer; mine integer; board jsonb; begin
 perform public.assert_account_security();
 if actor is null or not exists(select 1 from public.profiles where id=actor and not is_hidden) then raise exception 'Inicia sesión en el club.' using errcode='42501'; end if;
 selected_game:=(array['football','skateboard','robot-vacuum'])[1+(((wk-date '2026-10-19')/7)%3+3)%3];
 target_score:=case selected_game when 'football' then 15 when 'skateboard' then 10 else 15 end;
 select count(*) into qualifying from club_arcade.weekly_scores s join public.profiles p on p.id=s.user_id where s.week_start=wk and s.game=selected_game and s.score>=target_score and not p.is_hidden;
 select s.score into mine from club_arcade.weekly_scores s where s.week_start=wk and s.game=selected_game and s.user_id=actor;
 select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into board from (select s.user_id,p.display_name as name,s.score from club_arcade.weekly_scores s join public.profiles p on p.id=s.user_id where s.week_start=wk and s.game=selected_game and not p.is_hidden order by s.score desc,s.achieved_at limit 20) r;
 return jsonb_build_object('week_start',wk,'ends_at',(wk+7)::timestamp at time zone 'Europe/Madrid','game',selected_game,'target',target_score,'participants',qualifying,'club_goal',3,'club_reward_packs',2,'my_best',coalesce(mine,0),'reward_claimed',exists(select 1 from public.member_reward_pack_grants where user_id=actor and event_key='arcade-week:'||wk),'club_complete',qualifying>=3,'leaderboard',board);
end $$;
create function public.claim_chota_weekly_reward() returns jsonb language plpgsql security definer set search_path='' as $$ declare status jsonb; actor uuid:=auth.uid(); wk text; begin
 status:=public.get_chota_weekly_challenge(); wk:=status->>'week_start';
 if not (status->>'club_complete')::boolean or (status->>'my_best')::integer<(status->>'target')::integer then raise exception 'Completa tu reto y reúne a tres miembros esta semana.' using errcode='22023'; end if;
 insert into public.member_reward_pack_grants(user_id,event_key,packs) values(actor,'arcade-week:'||wk,2) on conflict do nothing;
 if not found then return jsonb_build_object('awarded',false,'packs',0); end if;
 insert into public.card_packs(user_id,earned_day,source) select actor,(now() at time zone 'Europe/Madrid')::date,'arcade_weekly' from generate_series(1,2);
 return jsonb_build_object('awarded',true,'packs',2); end $$;
revoke all on function public.get_chota_weekly_challenge(),public.claim_chota_weekly_reward() from public,anon,authenticated;
grant execute on function public.get_chota_weekly_challenge(),public.claim_chota_weekly_reward() to authenticated;

create table public.collection_seasons (
 id text primary key check(id~'^[a-z0-9][a-z0-9-]{1,63}$'),title text not null check(length(trim(title)) between 1 and 80),description text not null default '' check(length(description)<=400),
 collection_key text not null check(length(collection_key) between 1 and 80), starts_at timestamptz not null,ends_at timestamptz not null,
 target_cards integer not null check(target_cards between 1 and 10000),reward_packs integer not null check(reward_packs between 1 and 30),enabled boolean not null default true,check(ends_at>starts_at)
);
alter table public.collection_seasons enable row level security;
revoke all on public.collection_seasons from public,anon,authenticated;
grant select,insert,update,delete on public.collection_seasons to authenticated;
create policy season_gate on public.collection_seasons as restrictive for all to authenticated using((select public.account_security_satisfied()) and exists(select 1 from public.profiles where id=(select auth.uid()))) with check((select public.account_security_satisfied()) and exists(select 1 from public.profiles where id=(select auth.uid())));
create policy season_read on public.collection_seasons for select to authenticated using(enabled or public.current_user_can_manage());
create policy season_manage on public.collection_seasons for all to authenticated using(public.current_user_can_manage()) with check(public.current_user_can_manage());
insert into public.collection_seasons(id,title,description,collection_key,starts_at,ends_at,target_cards,reward_packs) values('los-nuestros-otono-2026','Los nuestros · Otoño','Reúne 30 cartas distintas de Los nuestros y consigue 3 sobres.','los-nuestros-01','2026-10-23 00:00:00+02','2026-12-22 00:00:00+01',30,3);
create function public.get_collection_seasons() returns jsonb language plpgsql stable security definer set search_path='' as $$ declare actor uuid:=auth.uid(); result jsonb; begin
 perform public.assert_account_security();
 if actor is null or not exists(select 1 from public.profiles where id=actor and not is_hidden) then raise exception 'Inicia sesión en el club.' using errcode='42501'; end if;
 select coalesce(jsonb_agg(to_jsonb(r) order by r.starts_at desc),'[]'::jsonb) into result from (
 select s.id,s.title,s.description,s.collection_key,s.starts_at,s.ends_at,s.target_cards,s.reward_packs,
 (select count(*) from public.member_card_inventory i join public.achievement_card_catalog c on c.id=i.card_id where i.user_id=actor and i.quantity>0 and c.collection_key=s.collection_key and c.active) as owned_cards,
 (select count(*) from public.achievement_card_catalog c where c.collection_key=s.collection_key and c.active) as total_cards,
 exists(select 1 from public.member_reward_pack_grants g where g.user_id=actor and g.event_key='season:'||s.id) as reward_claimed,
 (now()>=s.starts_at and now()<s.ends_at) as active from public.collection_seasons s where s.enabled
 ) r; return result; end $$;
create function public.claim_collection_season_reward(season_id text) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); season public.collection_seasons%rowtype; owned integer; begin
 perform public.assert_account_security();
 if actor is null or not exists(select 1 from public.profiles where id=actor and not is_hidden) then raise exception 'Inicia sesión en el club.' using errcode='42501'; end if;
 select * into season from public.collection_seasons s where s.id=season_id and s.enabled and now()>=s.starts_at and now()<s.ends_at for share;
 if not found then raise exception 'Esta temporada no está activa.' using errcode='22023'; end if;
 select count(*) into owned from public.member_card_inventory i join public.achievement_card_catalog c on c.id=i.card_id where i.user_id=actor and i.quantity>0 and c.collection_key=season.collection_key and c.active;
 if owned<season.target_cards then raise exception 'Todavía faltan cartas para completar el reto.' using errcode='22023'; end if;
 insert into public.member_reward_pack_grants(user_id,event_key,packs) values(actor,'season:'||season.id,season.reward_packs) on conflict do nothing;
 if not found then return jsonb_build_object('awarded',false,'packs',0); end if;
 insert into public.card_packs(user_id,earned_day,source) select actor,(now() at time zone 'Europe/Madrid')::date,'collection_season' from generate_series(1,season.reward_packs);
 return jsonb_build_object('awarded',true,'packs',season.reward_packs); end $$;
revoke all on function public.get_collection_seasons(),public.claim_collection_season_reward(text) from public,anon,authenticated;
grant execute on function public.get_collection_seasons(),public.claim_collection_season_reward(text) to authenticated;
commit;

begin;
-- Plan memories reuse the existing event/occurrence links. New media stays private.
alter table public.club_event_memories alter column moment_id drop not null;
alter table public.club_event_memories add column media_path text, add column media_type text check(media_type in ('image','video'));
alter table public.club_event_memories add constraint club_memory_content check(moment_id is not null or media_path is not null or length(trim(caption))>0), add constraint club_memory_media_pair check((media_path is null)=(media_type is null));
drop policy own_memory on public.club_event_memories;
create policy own_memory on public.club_event_memories for insert to authenticated with check(created_by=(select auth.uid()) and (
 (moment_id is not null and media_path is null and exists(select 1 from public.moments m where m.id=moment_id and m.user_id=(select auth.uid()) and m.media_type in('image','video')))
 or (moment_id is null and (media_path is null or media_path like (select auth.uid())::text||'/'||event_id::text||'/%'))));
create or replace function public.club_memory_edit_guard() returns trigger language plpgsql security invoker set search_path='' as $$ begin
 if (new.id,new.event_id,new.occurrence,new.moment_id,new.created_by,new.created_at,new.media_path,new.media_type) is distinct from (old.id,old.event_id,old.occurrence,old.moment_id,old.created_by,old.created_at,old.media_path,old.media_type) then raise exception 'Solo puedes cambiar el texto o destacar el recuerdo.'; end if;
 return new; end $$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('club-memories','club-memories',false,20971520,array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime']) on conflict(id) do nothing;
create policy club_memory_upload on storage.objects for insert to authenticated with check(bucket_id='club-memories' and (storage.foldername(name))[1]=(select auth.uid())::text and (select public.account_security_satisfied()) and exists(select 1 from public.profiles where id=(select auth.uid()) and not is_hidden));
create policy club_memory_media_read on storage.objects for select to authenticated using(bucket_id='club-memories' and (select public.account_security_satisfied()) and exists(select 1 from public.profiles where id=(select auth.uid())) and ((storage.foldername(name))[1]=(select auth.uid())::text or exists(select 1 from public.club_event_memories m where m.media_path=name)));
create policy club_memory_media_remove on storage.objects for delete to authenticated using(bucket_id='club-memories' and (storage.foldername(name))[1]=(select auth.uid())::text and (select public.account_security_satisfied()));

-- Three chosen cards, validated against live ownership on every read/save.
create table public.member_card_showcase(user_id uuid not null references public.profiles(id) on delete cascade,slot smallint not null check(slot between 1 and 3),card_id text not null references public.achievement_card_catalog(id),primary key(user_id,slot),unique(user_id,card_id));
alter table public.member_card_showcase enable row level security;
revoke all on public.member_card_showcase from public,anon,authenticated;
grant select on public.member_card_showcase to authenticated;
create policy showcase_read on public.member_card_showcase for select to authenticated using((select public.account_security_satisfied()) and exists(select 1 from public.profiles where id=(select auth.uid())) and exists(select 1 from public.member_card_inventory i where i.user_id=member_card_showcase.user_id and i.card_id=member_card_showcase.card_id and quantity>0));
-- Inventory is private; guarded functions only return display card IDs, never another user's full inventory.
create function public.get_profile_card_showcase(target_user_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$ begin
 perform public.assert_account_security();
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid()) then raise exception 'Inicia sesión.' using errcode='42501'; end if;
 return (select coalesce(jsonb_agg(s.card_id order by s.slot),'[]'::jsonb) from public.member_card_showcase s join public.member_card_inventory i on i.user_id=s.user_id and i.card_id=s.card_id and i.quantity>0 join public.achievement_card_catalog c on c.id=s.card_id and c.active join public.profiles p on p.id=s.user_id and not p.is_hidden where s.user_id=target_user_id);
end $$;
create function public.set_profile_card_showcase(card_ids text[]) returns void language plpgsql security definer set search_path='' as $$ declare actor uuid; begin
 perform public.assert_account_security();
 actor:=public.lock_banner_shop_actor();
 if card_ids is null or cardinality(card_ids)>3 or cardinality(card_ids)<>(select count(distinct c) from unnest(card_ids) c) then raise exception 'Elige hasta tres cartas distintas.' using errcode='22023'; end if;
 if exists(select 1 from unnest(card_ids) c where not exists(select 1 from public.member_card_inventory i join public.achievement_card_catalog d on d.id=i.card_id and d.active where i.user_id=actor and i.card_id=c and i.quantity>0)) then raise exception 'Solo puedes exponer cartas de tu colección.' using errcode='22023'; end if;
 delete from public.member_card_showcase where user_id=actor;
 insert into public.member_card_showcase(user_id,slot,card_id) select actor,n::smallint,c from unnest(card_ids) with ordinality as x(c,n);
end $$;
revoke all on function public.get_profile_card_showcase(uuid),public.set_profile_card_showcase(text[]) from public,anon,authenticated;
grant execute on function public.get_profile_card_showcase(uuid),public.set_profile_card_showcase(text[]) to authenticated;

-- A social monthly objective, independent from arcade scores and collection seasons.
create schema if not exists club_social;
revoke all on schema club_social from public,anon,authenticated;
create function club_social.month_status(actor uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare month_start date:=date_trunc('month',now() at time zone 'Europe/Madrid')::date; month_end date:=(month_start+interval '1 month')::date; plans integer; memories integer; trades integer; contributed boolean; begin
 select count(*) into plans from (select a.event_id,a.occurrence from public.club_event_arrivals a join public.profiles p on p.id=a.user_id and not p.is_hidden where a.occurrence>=month_start and a.occurrence<month_end group by a.event_id,a.occurrence having count(distinct a.user_id)>=2) q;
 select count(*) into memories from (select distinct m.event_id,m.occurrence,m.created_by from public.club_event_memories m join public.profiles p on p.id=m.created_by and not p.is_hidden where m.created_at>=month_start::timestamp at time zone 'Europe/Madrid' and m.created_at<month_end::timestamp at time zone 'Europe/Madrid' and m.occurrence>=month_start and m.occurrence<month_end) q;
 select count(*) into trades from (select distinct least(t.sender_id,t.recipient_id),greatest(t.sender_id,t.recipient_id) from public.card_trade_offers t join public.profiles s on s.id=t.sender_id and not s.is_hidden join public.profiles r on r.id=t.recipient_id and not r.is_hidden where t.status='accepted' and t.resolved_at>=month_start::timestamp at time zone 'Europe/Madrid' and t.resolved_at<month_end::timestamp at time zone 'Europe/Madrid') q;
 contributed:=exists(select 1 from public.club_event_arrivals where user_id=actor and occurrence>=month_start and occurrence<month_end) or exists(select 1 from public.club_event_memories where created_by=actor and occurrence>=month_start and occurrence<month_end and created_at>=month_start::timestamp at time zone 'Europe/Madrid') or exists(select 1 from public.card_trade_offers where actor in(sender_id,recipient_id) and status='accepted' and resolved_at>=month_start::timestamp at time zone 'Europe/Madrid');
 return jsonb_build_object('month',month_start,'ends_at',month_end::timestamp at time zone 'Europe/Madrid','theme',case extract(month from month_start) when 10 then 'Halloween en el club' when 12 then 'Navidad en el club' when 2 then 'Febrero en compañía' else 'Este mes en el club' end,'plans',plans,'memories',memories,'trades',trades,'plan_target',2,'memory_target',5,'trade_target',3,'complete',plans>=2 and memories>=5 and trades>=3,'contributed',contributed,'reward_packs',3,'claimed',exists(select 1 from public.member_reward_pack_grants where user_id=actor and event_key='social-month:'||month_start));
end $$;
revoke all on function club_social.month_status(uuid) from public,anon,authenticated;
create function public.get_club_social_season() returns jsonb language plpgsql stable security definer set search_path='' as $$ begin
 perform public.assert_account_security();
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and not is_hidden) then raise exception 'Inicia sesión en el club.' using errcode='42501'; end if;
 return club_social.month_status(auth.uid()); end $$;
create function public.claim_club_social_season() returns jsonb language plpgsql security definer set search_path='' as $$ declare actor uuid; status jsonb; begin
 perform public.assert_account_security();
 actor:=public.lock_banner_shop_actor(); status:=club_social.month_status(actor);
 if not (status->>'complete')::boolean or not (status->>'contributed')::boolean then raise exception 'Completa el objetivo del club y participa en uno de sus planes, recuerdos o intercambios.' using errcode='22023'; end if;
 insert into public.member_reward_pack_grants(user_id,event_key,packs) values(actor,'social-month:'||(status->>'month'),3) on conflict do nothing;
 if not found then return jsonb_build_object('awarded',false,'packs',0); end if;
 insert into public.card_packs(user_id,earned_day,source) select actor,(now() at time zone 'Europe/Madrid')::date,'club_social_season' from generate_series(1,3);
 return jsonb_build_object('awarded',true,'packs',3); end $$;
revoke all on function public.get_club_social_season(),public.claim_club_social_season() from public,anon,authenticated;
grant execute on function public.get_club_social_season(),public.claim_club_social_season() to authenticated;
create index club_memory_social_month_idx on public.club_event_memories(created_at,occurrence,created_by);
create index club_trade_social_month_idx on public.card_trade_offers(resolved_at) where status='accepted';
commit;

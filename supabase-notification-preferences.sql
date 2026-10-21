-- Preferencias del centro y push. Ejecutar después de setup, daily-packs, admin-user-management,
-- group-interactions y collection-social; amplía sus tipos de avisos sin modificar sus operaciones.
begin;
create table if not exists public.member_notification_preferences (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 chats boolean not null default true, agenda boolean not null default true,
 collection boolean not null default true, news boolean not null default false,
 activity boolean not null default true, news_seen_at timestamptz,
 updated_at timestamptz not null default now()
);
alter table public.member_notification_preferences enable row level security;
revoke all on public.member_notification_preferences from public,anon,authenticated;
grant select on public.member_notification_preferences to service_role;
create or replace function public.get_notification_preferences()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid(); result jsonb;
begin
 if actor is null or not exists(select 1 from public.profiles where id=actor and not is_hidden) then raise exception 'Inicia sesión.' using errcode='42501'; end if;
 insert into public.member_notification_preferences(user_id) values(actor) on conflict do nothing;
 select to_jsonb(p)-'user_id' into result from public.member_notification_preferences p where user_id=actor;
 return result;
end; $$;
create or replace function public.set_notification_preference(category text,enabled boolean)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid();
begin
 perform public.get_notification_preferences();
 if category is null or category not in('chats','agenda','collection','news','activity') or enabled is null then raise exception 'Categoría no válida.'; end if;
 update public.member_notification_preferences set chats=case when category='chats' then enabled else chats end,
 agenda=case when category='agenda' then enabled else agenda end,collection=case when category='collection' then enabled else collection end,
 news=case when category='news' then enabled else news end,activity=case when category='activity' then enabled else activity end,updated_at=now() where user_id=actor;
 return public.get_notification_preferences();
end; $$;
create or replace function public.filter_notification_preference()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare prefs public.member_notification_preferences%rowtype; allowed boolean;
begin
 select * into prefs from public.member_notification_preferences where user_id=new.user_id;
 if not found then return new; end if;
 allowed:=case when new.type in('private_message','group_message','group_poll') then prefs.chats when new.type='event_created' then prefs.agenda when new.type in('pack_granted','trade_offer','trade_resolved') then prefs.collection when new.type='news_update' then prefs.news else prefs.activity end;
 if allowed then return new; end if; return null;
end; $$;
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check(type in('private_message','group_message','like','reply','media_created','event_created','pack_granted','news_update','group_poll','trade_offer','trade_resolved'));
alter table public.notifications drop constraint if exists notifications_target_type_check;
alter table public.notifications add constraint notifications_target_type_check check(target_type in('private','moment','post','event','pack','news','group','trade'));
drop trigger if exists apply_notification_preference on public.notifications;
create trigger apply_notification_preference before insert on public.notifications for each row execute function public.filter_notification_preference();
create or replace function public.notify_new_group_event()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 insert into public.notifications(user_id,actor_id,type,target_type,target_id,excerpt)
 select id,new.created_by,'event_created','event',new.id,left(new.title,180) from public.profiles where id<>new.created_by and not is_hidden;
 return new;
end; $$;
drop trigger if exists notify_new_group_event on public.group_events;
create trigger notify_new_group_event after insert on public.group_events for each row execute function public.notify_new_group_event();
create or replace function public.notify_granted_card_packs()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 -- One notice per member and granting statement, including bulk admin grants.
 insert into public.notifications(user_id,actor_id,type,target_type,target_id,excerpt)
 select p.user_id,auth.uid(),'pack_granted','pack',min(p.id),case when count(*)=1 then 'Tienes un nuevo sobre para abrir.' else 'Tienes '||count(*)::text||' nuevos sobres para abrir.' end
 from granted_packs p join public.profiles u on u.id=p.user_id and not u.is_hidden group by p.user_id;
 return null;
end; $$;
drop trigger if exists notify_granted_card_packs on public.card_packs;
create trigger notify_granted_card_packs after insert on public.card_packs referencing new table as granted_packs for each statement execute function public.notify_granted_card_packs();
create or replace function public.register_news_update(latest_at timestamptz,new_count integer)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid(); previous_at timestamptz;
begin
 perform public.get_notification_preferences();
 if latest_at is null or latest_at>now()+interval '5 minutes' or latest_at<now()-interval '60 days' or new_count is null or new_count<1 or new_count>100 then return; end if;
 select news_seen_at into previous_at from public.member_notification_preferences where user_id=actor for update;
 if previous_at is not null and latest_at>previous_at then
  -- News only notifies this requesting user inside the app; never a push or third-party alert.
  insert into public.notifications(user_id,type,target_type,excerpt) values(actor,'news_update','news','Hay noticias nuevas en el club.');
 end if;
 update public.member_notification_preferences set news_seen_at=greatest(coalesce(previous_at,latest_at),latest_at) where user_id=actor;
end; $$;
revoke all on function public.get_notification_preferences(),public.set_notification_preference(text,boolean),public.filter_notification_preference(),public.notify_new_group_event(),public.notify_granted_card_packs(),public.register_news_update(timestamptz,integer) from public,anon,authenticated;
grant execute on function public.get_notification_preferences(),public.set_notification_preference(text,boolean),public.register_news_update(timestamptz,integer) to authenticated;
commit;

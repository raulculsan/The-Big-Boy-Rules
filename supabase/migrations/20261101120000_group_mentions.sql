begin;

-- Mentions are read from the stored body, so a client cannot notify anyone it did not write.
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check(type = any(array['private_message','group_message','group_mention','like','reply','media_created','event_created','pack_granted','news_update','group_poll','trade_offer','trade_resolved','account_request']::text[]));

create or replace function public.filter_notification_preference() returns trigger language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare prefs public.member_notification_preferences%rowtype; allowed boolean;
begin
 select * into prefs from public.member_notification_preferences where user_id=new.user_id;
 if not found then return new; end if;
 allowed:=case when new.type in('private_message','group_message','group_mention','group_poll') then prefs.chats when new.type='event_created' then prefs.agenda when new.type in('pack_granted','trade_offer','trade_resolved') then prefs.collection when new.type='news_update' then prefs.news else prefs.activity end;
 if allowed then return new; end if; return null;
end; $$;

create function public.notify_group_mentions() returns trigger language plpgsql security definer set search_path to 'public','pg_temp' as $$
begin
  if new.body is null or position('@' in new.body)=0 then return new; end if;
  insert into public.notifications(user_id,actor_id,type,target_type,target_id,excerpt)
  select p.id,new.user_id,'group_mention','group',new.channel_id,left(btrim(new.body),180)
  from public.profiles p
  where not coalesce(p.is_hidden,false) and p.id<>new.user_id
    and lower(p.username) in (
      select lower(rtrim(m[1],'.-')) from regexp_matches(new.body,'(?:^|[^[:alnum:]_@.])@([[:alnum:]_.-]+)','g') m limit 20
    );
  return new;
end $$;
revoke all on function public.notify_group_mentions() from public,anon,authenticated;

create trigger notify_group_mentions after insert on public.messages
  for each row execute function public.notify_group_mentions();

commit;

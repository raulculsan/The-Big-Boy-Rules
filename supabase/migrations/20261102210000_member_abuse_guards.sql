-- Guards against a malicious member, found in the 2026-11-02 attack simulation.

-- 1. Images and attachments come from the club's own storage. External URLs
--    let a member log every viewer's IP; only shared news links stay external.
create or replace function public.club_storage_url(p_url text, p_bucket text)
returns boolean language sql immutable set search_path = '' as $$
 select starts_with(p_url, 'https://nfvggpgeypkkqceivkaq.supabase.co/storage/v1/object/public/' || p_bucket || '/')
$$;
alter table public.profiles add constraint profiles_avatar_own_storage
 check (avatar_url is null or avatar_url = '' or public.club_storage_url(avatar_url, 'avatars'));
alter table public.messages add constraint messages_attachment_own_storage
 check (attachment_url is null
  or (attachment_type = 'text/news-link' and attachment_url ~ '^https://')
  or public.club_storage_url(attachment_url, 'group-media'));
alter table public.private_messages add constraint private_messages_attachment_own_storage
 check (attachment_url is null
  or (attachment_type = 'text/news-link' and attachment_url ~ '^https://')
  or starts_with(attachment_url, 'storage://private-chat/')
  or public.club_storage_url(attachment_url, 'group-media'));

-- 2. Only the text of a message can change, and the change is visible.
alter table public.messages add column if not exists edited_at timestamptz;
alter table public.private_messages add column if not exists edited_at timestamptz;
create or replace function public.guard_chat_message_write()
returns trigger language plpgsql set search_path = '' as $$
declare
 author uuid;
 sent_minute integer;
 sent_hour integer;
begin
 if coalesce(auth.role(), '') = 'service_role' then return new; end if;
 if tg_op = 'INSERT' then
  -- The server clock dates every message; a member cannot backdate one.
  new.created_at := statement_timestamp();
  new.edited_at := null;
  -- The two tables name the author differently; read it without naming a missing field.
  author := (to_jsonb(new) ->> case when tg_table_name = 'messages' then 'user_id' else 'sender_id' end)::uuid;
  -- A per-member lock makes the count exact under concurrent inserts.
  perform pg_advisory_xact_lock(hashtextextended('chat-rate:' || author::text, 0));
  select count(*) filter (where created_at > statement_timestamp() - interval '1 minute'), count(*)
   into sent_minute, sent_hour
   from (select created_at from public.messages where user_id = author and created_at > statement_timestamp() - interval '1 hour'
         union all
         select created_at from public.private_messages where sender_id = author and created_at > statement_timestamp() - interval '1 hour') recent;
  if sent_minute >= 20 or sent_hour >= 300 then
   raise exception 'Vas demasiado rápido. Espera un momento antes de enviar más mensajes.' using errcode = 'P0001';
  end if;
  return new;
 end if;
 if new.id is distinct from old.id or new.created_at is distinct from old.created_at
  or new.attachment_url is distinct from old.attachment_url or new.attachment_name is distinct from old.attachment_name
  or new.attachment_type is distinct from old.attachment_type or new.attachment_size is distinct from old.attachment_size
  or new.reply_to_id is distinct from old.reply_to_id
  or (tg_table_name = 'messages' and (to_jsonb(new) ->> 'user_id' is distinct from to_jsonb(old) ->> 'user_id'
   or to_jsonb(new) ->> 'legacy_id' is distinct from to_jsonb(old) ->> 'legacy_id'
   or to_jsonb(new) ->> 'channel_id' is distinct from to_jsonb(old) ->> 'channel_id'))
  or (tg_table_name = 'private_messages' and (to_jsonb(new) ->> 'sender_id' is distinct from to_jsonb(old) ->> 'sender_id'
   or to_jsonb(new) ->> 'recipient_id' is distinct from to_jsonb(old) ->> 'recipient_id')) then
  raise exception 'Solo se puede editar el texto del mensaje.' using errcode = '42501';
 end if;
 new.edited_at := case when new.body is distinct from old.body then statement_timestamp() else old.edited_at end;
 return new;
end;
$$;
drop trigger if exists guard_chat_message_write on public.messages;
create trigger guard_chat_message_write before insert or update on public.messages
 for each row execute function public.guard_chat_message_write();
drop trigger if exists guard_chat_message_write on public.private_messages;
create trigger guard_chat_message_write before insert or update on public.private_messages
 for each row execute function public.guard_chat_message_write();
create index if not exists messages_user_created on public.messages(user_id, created_at desc);
create index if not exists private_messages_sender_created on public.private_messages(sender_id, created_at desc);

-- 3. Achievements: at most 40 group messages a day count, and a message
--    deleted before its achievement is complete takes its progress with it.
create or replace function public.track_group_achievement_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if (select count(*) from public.messages m where m.user_id = new.user_id
     and m.created_at > statement_timestamp() - interval '1 day') <= 40 then
  perform public.record_achievement_activity(new.user_id, 'group_messages', 'message:' || new.id::text);
 end if;
 return new;
end;
$$;
create or replace function public.reverse_group_achievement_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
 rule record;
begin
 for rule in
  delete from public.achievement_progress_events e
   using public.achievement_rules r
   where e.event_key = 'message:' || old.id::text and e.user_id = old.user_id
    and r.achievement_id = e.achievement_id and r.metric = 'group_messages'
    and not exists (select 1 from public.achievement_progress p where p.achievement_id = e.achievement_id
                     and p.user_id = e.user_id and p.completed_at is not null)
   returning e.achievement_id
 loop
  update public.achievement_progress set current_value = greatest(current_value - 1, 0), updated_at = clock_timestamp()
   where achievement_id = rule.achievement_id and user_id = old.user_id and completed_at is null;
 end loop;
 return old;
end;
$$;
revoke all on function public.reverse_group_achievement_activity() from public, anon, authenticated;
drop trigger if exists reverse_group_achievement_activity on public.messages;
create trigger reverse_group_achievement_activity after delete on public.messages
 for each row execute function public.reverse_group_achievement_activity();

-- 4. Avatars stay viewable by URL, but nobody can list every member's folder.
drop policy if exists "public avatar viewing" on storage.objects;
drop policy if exists "members list own avatar" on storage.objects;
create policy "members list own avatar" on storage.objects for select to authenticated
 using (bucket_id = 'avatars' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.current_user_can_manage()));

-- 5. push-dispatch counts each member's recent alerts before sending.
create index if not exists push_dispatch_claims_actor_created on public.push_dispatch_claims(actor_id, created_at desc);

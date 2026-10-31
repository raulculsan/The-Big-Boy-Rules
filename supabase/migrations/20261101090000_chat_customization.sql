begin;

-- Shared chat look, per-chat nicknames, reactions and one pinned message.
-- A chat key is group:<channel id> or private:<lower uuid>:<higher uuid>.
-- Everyone in a chat reads through RLS; every write goes through a checked function.
create table public.chat_customizations (
  chat_key text primary key,
  theme_id text check(theme_id ~ '^[a-z0-9-]{1,40}$'),
  bubble_color text check(bubble_color ~ '^#[0-9a-f]{6}$'),
  emojis text[] check(cardinality(emojis) between 1 and 6),
  pinned_id bigint,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default statement_timestamp()
);
create table public.chat_nicknames (
  chat_key text not null,
  target_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null check(length(nickname) between 1 and 30),
  primary key(chat_key,target_id)
);
create table public.chat_reactions (
  chat_key text not null,
  message_id bigint not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check(length(emoji) between 1 and 8),
  primary key(chat_key,message_id,user_id)
);
create index chat_reactions_user_idx on public.chat_reactions(user_id);

create function public.chat_key_visible(target text) returns boolean language plpgsql stable security definer set search_path='' as $$
declare parts text[];
begin
  if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid()) then return false; end if;
  if target ~ '^group:[0-9]{1,18}$' then
    return exists(select 1 from public.chat_channels where id=substr(target,7)::bigint);
  end if;
  if target !~ '^private:[0-9a-f-]{36}:[0-9a-f-]{36}$' then return false; end if;
  parts:=string_to_array(substr(target,9),':');
  return parts[1]<parts[2] and auth.uid()::text in (parts[1],parts[2])
    and (select count(*) from public.profiles where id::text in (parts[1],parts[2]))=2;
end $$;

create function public.chat_message_in(target text,message bigint) returns boolean language plpgsql stable security definer set search_path='' as $$
declare parts text[];
begin
  if target like 'group:%' then
    return exists(select 1 from public.messages where id=message and channel_id=substr(target,7)::bigint);
  end if;
  parts:=string_to_array(substr(target,9),':');
  return exists(select 1 from public.private_messages where id=message
    and sender_id::text in (parts[1],parts[2]) and recipient_id::text in (parts[1],parts[2]));
end $$;

create function public.chat_assert_access(target text) returns void language plpgsql stable security definer set search_path='' as $$
begin
  perform public.assert_account_security();
  if not public.chat_key_visible(target) then raise exception 'No tienes acceso a este chat.' using errcode='42501'; end if;
end $$;

create function public.chat_emoji_ok(value text) returns boolean language sql immutable set search_path='' as
$$ select value is not null and length(value) between 1 and 8 and value !~ '[[:alnum:][:space:]<>&"'']' $$;

alter table public.chat_customizations enable row level security;
alter table public.chat_nicknames enable row level security;
alter table public.chat_reactions enable row level security;
revoke all on public.chat_customizations,public.chat_nicknames,public.chat_reactions from public,anon,authenticated;
grant select on public.chat_customizations,public.chat_nicknames,public.chat_reactions to authenticated;
create policy chat_customizations_read on public.chat_customizations for select to authenticated using(public.chat_key_visible(chat_key));
create policy chat_nicknames_read on public.chat_nicknames for select to authenticated using(public.chat_key_visible(chat_key));
create policy chat_reactions_read on public.chat_reactions for select to authenticated using(public.chat_key_visible(chat_key));

create function public.save_chat_look(p_key text,p_theme text,p_bubble text,p_emojis text[]) returns void language plpgsql security definer set search_path='' as $$
begin
  perform public.chat_assert_access(p_key);
  if p_emojis is not null and exists(select 1 from unnest(p_emojis) e where not public.chat_emoji_ok(e)) then
    raise exception 'Usa solo emojis.' using errcode='22023';
  end if;
  insert into public.chat_customizations(chat_key,theme_id,bubble_color,emojis,updated_by)
    values(p_key,p_theme,p_bubble,p_emojis,auth.uid())
    on conflict(chat_key) do update set theme_id=excluded.theme_id,bubble_color=excluded.bubble_color,
      emojis=excluded.emojis,updated_by=excluded.updated_by,updated_at=statement_timestamp();
end $$;

create function public.set_chat_nickname(p_key text,p_target uuid,p_nickname text) returns void language plpgsql security definer set search_path='' as $$
declare cleaned text:=btrim(coalesce(p_nickname,''));
begin
  perform public.chat_assert_access(p_key);
  if p_target is null or not exists(select 1 from public.profiles where id=p_target)
    or (p_key like 'private:%' and position(p_target::text in p_key)=0) then
    raise exception 'Esa persona no está en este chat.' using errcode='22023';
  end if;
  if cleaned='' then delete from public.chat_nicknames where chat_key=p_key and target_id=p_target; return; end if;
  if length(cleaned)>30 then raise exception 'El apodo admite 30 caracteres.' using errcode='22023'; end if;
  insert into public.chat_nicknames(chat_key,target_id,nickname) values(p_key,p_target,cleaned)
    on conflict(chat_key,target_id) do update set nickname=excluded.nickname;
end $$;

create function public.toggle_chat_reaction(p_key text,p_message bigint,p_emoji text) returns void language plpgsql security definer set search_path='' as $$
begin
  perform public.chat_assert_access(p_key);
  if not public.chat_emoji_ok(p_emoji) then raise exception 'Usa un emoji.' using errcode='22023'; end if;
  if not public.chat_message_in(p_key,p_message) then raise exception 'Ese mensaje ya no existe.' using errcode='22023'; end if;
  delete from public.chat_reactions where chat_key=p_key and message_id=p_message and user_id=auth.uid() and emoji=p_emoji;
  if not found then
    insert into public.chat_reactions(chat_key,message_id,user_id,emoji) values(p_key,p_message,auth.uid(),p_emoji)
      on conflict(chat_key,message_id,user_id) do update set emoji=excluded.emoji;
  end if;
end $$;

create function public.set_chat_pin(p_key text,p_message bigint) returns void language plpgsql security definer set search_path='' as $$
begin
  perform public.chat_assert_access(p_key);
  if p_message is not null and not public.chat_message_in(p_key,p_message) then
    raise exception 'Ese mensaje ya no existe.' using errcode='22023';
  end if;
  insert into public.chat_customizations(chat_key,pinned_id,updated_by) values(p_key,p_message,auth.uid())
    on conflict(chat_key) do update set pinned_id=excluded.pinned_id,updated_by=excluded.updated_by,updated_at=statement_timestamp();
end $$;

revoke all on function public.chat_message_in(text,bigint),public.chat_assert_access(text) from public,anon,authenticated;
revoke all on function public.chat_key_visible(text) from public,anon;
grant execute on function public.chat_key_visible(text) to authenticated;
revoke all on function public.save_chat_look(text,text,text,text[]),public.set_chat_nickname(text,uuid,text),public.toggle_chat_reaction(text,bigint,text),public.set_chat_pin(text,bigint) from public,anon;
grant execute on function public.save_chat_look(text,text,text,text[]),public.set_chat_nickname(text,uuid,text),public.toggle_chat_reaction(text,bigint,text),public.set_chat_pin(text,bigint) to authenticated;

do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    alter publication supabase_realtime add table public.chat_customizations,public.chat_nicknames,public.chat_reactions;
  end if;
end $$;

commit;

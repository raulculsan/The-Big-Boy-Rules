-- Replies retain a reference, not a copied body that could survive deletion.
alter table public.messages add column if not exists reply_to_id bigint references public.messages(id) on delete set null;
alter table public.private_messages add column if not exists reply_to_id bigint references public.private_messages(id) on delete set null;
create index if not exists messages_reply_to_idx on public.messages(reply_to_id) where reply_to_id is not null;
create index if not exists private_messages_reply_to_idx on public.private_messages(reply_to_id) where reply_to_id is not null;

create or replace function public.validate_chat_reply_reference()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.reply_to_id is null then return new; end if;
  if new.reply_to_id = new.id then raise exception 'A message cannot reply to itself' using errcode = '23514'; end if;
  if tg_table_name = 'messages' then
    if not exists (select 1 from public.messages source where source.id = new.reply_to_id and source.channel_id is not distinct from new.channel_id) then
      raise exception 'Reply must belong to the same channel' using errcode = '23514';
    end if;
  else
    if not exists (select 1 from public.private_messages source where source.id = new.reply_to_id and
      ((source.sender_id = new.sender_id and source.recipient_id = new.recipient_id) or
       (source.sender_id = new.recipient_id and source.recipient_id = new.sender_id))) then
      raise exception 'Reply must belong to the same private conversation' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.validate_chat_reply_reference() from public, anon, authenticated;
drop trigger if exists validate_message_reply on public.messages;
create trigger validate_message_reply before insert or update of reply_to_id, channel_id on public.messages for each row execute function public.validate_chat_reply_reference();
drop trigger if exists validate_private_message_reply on public.private_messages;
create trigger validate_private_message_reply before insert or update of reply_to_id, sender_id, recipient_id on public.private_messages for each row execute function public.validate_chat_reply_reference();

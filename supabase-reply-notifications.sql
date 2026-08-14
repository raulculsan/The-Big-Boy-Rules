-- Añade las respuestas a historias y publicaciones a la campana de notificaciones.
-- Ejecuta este archivo una vez en Supabase > SQL Editor.

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in ('private_message', 'like', 'reply', 'media_created'));

create or replace function public.notify_media_reply()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  recipient uuid;
begin
  if new.moment_id is not null then
    select user_id into recipient from public.moments where id = new.moment_id;
  else
    select user_id into recipient from public.profile_posts where id = new.profile_post_id;
  end if;

  if recipient is not null and recipient <> new.user_id then
    insert into public.notifications (user_id, actor_id, type, target_type, target_id, excerpt)
    values (
      recipient,
      new.user_id,
      'reply',
      case when new.moment_id is not null then 'moment' else 'post' end,
      coalesce(new.moment_id, new.profile_post_id),
      left(trim(new.body), 180)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists notify_media_reply on public.media_replies;
create trigger notify_media_reply
  after insert on public.media_replies
  for each row execute procedure public.notify_media_reply();

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in ('private_message', 'like', 'media_created'));

create or replace function public.notify_media_created()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.notifications (user_id, actor_id, type, target_type, target_id, excerpt)
  select
    profiles.id,
    new.user_id,
    'media_created',
    case when tg_table_name = 'moments' then 'moment' else 'post' end,
    new.id,
    left(coalesce(new.caption, ''), 180)
  from public.profiles
  where profiles.id <> new.user_id and not profiles.is_hidden;
  return new;
end;
$$;

drop trigger if exists notify_moment_created on public.moments;
create trigger notify_moment_created
  after insert on public.moments
  for each row execute procedure public.notify_media_created();

drop trigger if exists notify_post_created on public.profile_posts;
create trigger notify_post_created
  after insert on public.profile_posts
  for each row execute procedure public.notify_media_created();

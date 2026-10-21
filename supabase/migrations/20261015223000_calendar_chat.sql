-- Calendar → Bigboys. System messages never impersonate a member.
-- Idempotent across devices, cron runs, edits and simultaneous requests.
begin;
create table if not exists public.calendar_chat_announcements (
  id bigint generated always as identity primary key,
  event_id bigint not null references public.group_events(id) on delete cascade,
  occurrence date not null,
  channel_id bigint not null references public.chat_channels(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default now(),
  unique(event_id, occurrence)
);
create index if not exists calendar_chat_announcements_channel_time_idx
  on public.calendar_chat_announcements(channel_id, created_at desc);
alter table public.calendar_chat_announcements enable row level security;
revoke all on public.calendar_chat_announcements from anon, authenticated;
grant select on public.calendar_chat_announcements to authenticated;
drop policy if exists "active members read calendar announcements" on public.calendar_chat_announcements;
create policy "active members read calendar announcements" on public.calendar_chat_announcements
  for select to authenticated using (exists (
    select 1 from public.profiles where id = auth.uid()
  ));

-- No client-supplied date, content, channel, author or target event is accepted.
create or replace function public.publish_today_calendar_birthdays()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_today date := (now() at time zone 'Europe/Madrid')::date;
  v_channel bigint;
  v_count integer;
begin
  select id into v_channel from public.chat_channels
    order by (name = 'bigboys') desc, is_default desc, position, id limit 1;
  if v_channel is null then return 0; end if;
  insert into public.calendar_chat_announcements(event_id, occurrence, channel_id, body, created_at)
  select e.id, v_today, v_channel, '🎂 Hoy: ' || trim(e.title) || '. ¡Feliz cumpleaños!',
    v_today::timestamp at time zone 'Europe/Madrid'
  from public.group_events e
  where e.event_type = 'birthday'
    and to_char(e.starts_at at time zone 'Europe/Madrid', 'MM-DD') = to_char(v_today, 'MM-DD')
  on conflict (event_id, occurrence) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.publish_today_calendar_birthdays() from public, anon, authenticated;
grant execute on function public.publish_today_calendar_birthdays() to service_role;

-- Safe recovery on first authenticated app access, even if cron was delayed.
create or replace function public.sync_calendar_chat()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles where id = auth.uid()
  ) then raise exception 'Debes iniciar sesión con una cuenta activa.'; end if;
  perform public.publish_today_calendar_birthdays();
end;
$$;
revoke all on function public.sync_calendar_chat() from public, anon;
grant execute on function public.sync_calendar_chat() to authenticated;

-- A birthday added on its own day is announced immediately.
create or replace function public.publish_created_calendar_birthday()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.event_type = 'birthday' then perform public.publish_today_calendar_birthdays(); end if;
  return new;
end;
$$;
revoke all on function public.publish_created_calendar_birthday() from public, anon, authenticated;
drop trigger if exists calendar_birthday_chat_sync on public.group_events;
create trigger calendar_birthday_chat_sync after insert or update of event_type, starts_at on public.group_events
  for each row execute function public.publish_created_calendar_birthday();

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'calendar_chat_announcements') then
    alter publication supabase_realtime add table public.calendar_chat_announcements;
  end if;
end $$;

-- Evaluate Madrid's date server-side, including DST/year changes. No external
-- service/key is required; the 00:00 run publishes at the start of the day.
create extension if not exists pg_cron with schema pg_catalog;
do $$ declare v_job bigint; begin
  for v_job in select jobid from cron.job where jobname = 'bigboys-calendar-birthdays' loop
    perform cron.unschedule(v_job);
  end loop;
  perform cron.schedule('bigboys-calendar-birthdays', '*/5 * * * *', 'select public.publish_today_calendar_birthdays();');
end $$;
select public.publish_today_calendar_birthdays();
commit;

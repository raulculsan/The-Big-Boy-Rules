-- Ejecutar una vez en Supabase > SQL Editor para activar cumpleaños recurrentes.
alter table public.group_events add column if not exists event_type text not null default 'event';
alter table public.group_events add column if not exists annual boolean not null default false;
alter table public.group_events drop constraint if exists group_events_event_type_check;
alter table public.group_events add constraint group_events_event_type_check
  check (event_type in ('event', 'birthday'));

drop policy if exists "kike creates group events" on public.group_events;
create policy "kike creates group events" on public.group_events
  for insert to authenticated
  with check (
    auth.uid() = created_by
    and (public.current_user_can_manage() or event_type = 'birthday')
  );

drop policy if exists "kike updates group events" on public.group_events;
create policy "kike updates group events" on public.group_events
  for update to authenticated
  using (
    public.current_user_can_manage()
    or (event_type = 'birthday' and auth.uid() = created_by)
  )
  with check (
    public.current_user_can_manage()
    or (event_type = 'birthday' and auth.uid() = created_by)
  );

drop policy if exists "kike deletes group events" on public.group_events;
create policy "kike deletes group events" on public.group_events
  for delete to authenticated
  using (
    public.current_user_can_manage()
    or (event_type = 'birthday' and auth.uid() = created_by)
  );

-- Estado terminal para peticiones de ayuda ya instaladas.
-- Ejecuta este archivo una vez en Supabase > SQL Editor.

alter table public.help_requests
  drop constraint if exists help_requests_status_check;

alter table public.help_requests
  add constraint help_requests_status_check
  check (status in ('new', 'in_progress', 'answered', 'closed'));

drop policy if exists "participants create help messages" on public.help_messages;
create policy "participants create help messages" on public.help_messages
  for insert to authenticated with check (
    sender_id = auth.uid() and exists (
      select 1 from public.help_requests
      where id = request_id and status <> 'closed'
        and (user_id = auth.uid() or public.current_user_is_help_admin())
    )
  );

create or replace function public.keep_closed_help_request_locked()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.status = 'closed' then
    raise exception 'La petición está cerrada y no puede modificarse.';
  end if;
  return new;
end;
$$;

drop trigger if exists keep_closed_help_request_locked on public.help_requests;
create trigger keep_closed_help_request_locked
  before update on public.help_requests
  for each row execute procedure public.keep_closed_help_request_locked();

create or replace function public.reject_closed_help_message()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from public.help_requests where id = new.request_id and status = 'closed') then
    raise exception 'La petición está cerrada y ya no admite respuestas.';
  end if;
  return new;
end;
$$;

drop trigger if exists reject_closed_help_message on public.help_messages;
create trigger reject_closed_help_message
  before insert on public.help_messages
  for each row execute procedure public.reject_closed_help_message();

create or replace function public.sync_help_request_from_message()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  sender_is_admin boolean;
begin
  select role in ('admin', 'superadmin') into sender_is_admin
  from public.profiles where id = new.sender_id;

  update public.help_requests
  set status = case when sender_is_admin then 'answered' else 'new' end,
      handled_by = case when sender_is_admin then new.sender_id else null end,
      updated_at = now()
  where id = new.request_id and status <> 'closed';
  return new;
end;
$$;

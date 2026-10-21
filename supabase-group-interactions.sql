-- Big Boy: asistencia y encuestas. Ejecutar después de supabase-setup.sql.
begin;
create table if not exists public.event_attendance (
 event_id bigint not null references public.group_events(id) on delete cascade,
 occurrence date not null,
 user_id uuid not null references public.profiles(id) on delete cascade,
 response text not null check(response in ('going','maybe','declined')),
 updated_at timestamptz not null default now(),
 primary key(event_id, occurrence, user_id)
);
create table if not exists public.group_polls (
 id uuid primary key default gen_random_uuid(),
 channel_id bigint not null references public.chat_channels(id) on delete cascade,
 created_by uuid not null references public.profiles(id),
 question text not null check(char_length(trim(question)) between 1 and 180),
 created_at timestamptz not null default now(),
 closed_at timestamptz
);
create table if not exists public.group_poll_options (
 id uuid primary key default gen_random_uuid(),
 poll_id uuid not null references public.group_polls(id) on delete cascade,
 label text not null check(char_length(trim(label)) between 1 and 80),
 position smallint not null check(position between 0 and 5),
 unique(poll_id,position), unique(poll_id,id)
);
create table if not exists public.group_poll_votes (
 poll_id uuid not null references public.group_polls(id) on delete cascade,
 option_id uuid not null,
 user_id uuid not null references public.profiles(id) on delete cascade,
 updated_at timestamptz not null default now(),
 primary key(poll_id,user_id),
 foreign key(poll_id,option_id) references public.group_poll_options(poll_id,id) on delete cascade
);
create index if not exists group_polls_channel_created_idx on public.group_polls(channel_id,created_at desc);
alter table public.event_attendance enable row level security;
alter table public.group_polls enable row level security;
alter table public.group_poll_options enable row level security;
alter table public.group_poll_votes enable row level security;
-- Mutations are RPC-only; clients cannot alter totals, identities or closed state.
revoke all on public.event_attendance,public.group_polls,public.group_poll_options,public.group_poll_votes from anon,authenticated;
grant select on public.event_attendance,public.group_polls,public.group_poll_options,public.group_poll_votes to authenticated;
drop policy if exists club_reads_attendance on public.event_attendance;
create policy club_reads_attendance on public.event_attendance for select to authenticated using(exists(select 1 from public.profiles where id=auth.uid()));
drop policy if exists club_reads_polls on public.group_polls;
create policy club_reads_polls on public.group_polls for select to authenticated using(exists(select 1 from public.profiles where id=auth.uid()));
drop policy if exists club_reads_poll_options on public.group_poll_options;
create policy club_reads_poll_options on public.group_poll_options for select to authenticated using(exists(select 1 from public.profiles where id=auth.uid()));
drop policy if exists club_reads_poll_votes on public.group_poll_votes;
create policy club_reads_poll_votes on public.group_poll_votes for select to authenticated using(exists(select 1 from public.profiles where id=auth.uid()));
create or replace function public.respond_to_event(p_event_id bigint,p_occurrence date,p_response text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare e public.group_events; deadline timestamptz;
begin
 if auth.uid() is null or not exists(select 1 from profiles where id=auth.uid()) then raise exception 'Acceso no autorizado'; end if;
 select * into e from group_events where id=p_event_id for share;
 if not found or e.event_type='birthday' or p_response not in ('going','maybe','declined') then raise exception 'Plan o respuesta no válido'; end if;
 if (not e.annual and p_occurrence<>(e.starts_at at time zone 'Europe/Madrid')::date) or (e.annual and to_char(p_occurrence,'MM-DD')<>to_char(e.starts_at at time zone 'Europe/Madrid','MM-DD')) then raise exception 'Fecha del plan no válida'; end if;
 deadline := (p_occurrence + (e.starts_at at time zone 'Europe/Madrid')::time) at time zone 'Europe/Madrid';
 if deadline<=now() then raise exception 'El plan ya ha comenzado'; end if;
 insert into event_attendance(event_id,occurrence,user_id,response) values(p_event_id,p_occurrence,auth.uid(),p_response)
 on conflict(event_id,occurrence,user_id) do update set response=excluded.response,updated_at=now();
end $$;
create or replace function public.create_group_poll(p_channel_id bigint,p_question text,p_options text[],p_request_id uuid default gen_random_uuid())
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid; label text; n int:=0;
begin
 if auth.uid() is null or not exists(select 1 from profiles where id=auth.uid()) then raise exception 'Acceso no autorizado'; end if;
 if not exists(select 1 from chat_channels where id=p_channel_id) then raise exception 'Grupo no disponible'; end if;
 if char_length(trim(p_question)) not between 1 and 180 or coalesce(cardinality(p_options),0) not between 2 and 6 then raise exception 'Añade una pregunta y entre 2 y 6 opciones'; end if;
 if (select count(distinct lower(trim(x))) from unnest(p_options) x)<>cardinality(p_options) then raise exception 'Las opciones deben ser diferentes'; end if;
 if p_request_id is null then raise exception 'Identificador no válido'; end if;
 select id into result from group_polls where id=p_request_id and channel_id=p_channel_id and created_by=auth.uid();
 if found then return result; end if;
 insert into group_polls(id,channel_id,created_by,question) values(p_request_id,p_channel_id,auth.uid(),trim(p_question)) on conflict(id) do nothing returning id into result;
 if result is null then
  select id into result from group_polls where id=p_request_id and channel_id=p_channel_id and created_by=auth.uid();
  if result is null then raise exception 'Identificador no disponible'; end if;
  return result;
 end if;
 foreach label in array p_options loop
  if label is null or char_length(trim(label)) not between 1 and 80 then raise exception 'Opción no válida'; end if;
  insert into group_poll_options(poll_id,label,position) values(result,trim(label),n); n:=n+1;
 end loop;
 return result;
end $$;
create or replace function public.vote_group_poll(p_poll_id uuid,p_channel_id bigint,p_option_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare p public.group_polls;
begin
 if auth.uid() is null or not exists(select 1 from profiles where id=auth.uid()) then raise exception 'Acceso no autorizado'; end if;
 select * into p from group_polls where id=p_poll_id for update;
 if not found or p.channel_id is distinct from p_channel_id then raise exception 'La encuesta no pertenece a este grupo'; end if;
 if p.closed_at is not null then raise exception 'La encuesta está cerrada'; end if;
 if not exists(select 1 from group_poll_options where poll_id=p_poll_id and id=p_option_id) then raise exception 'Opción no válida'; end if;
 insert into group_poll_votes(poll_id,option_id,user_id) values(p_poll_id,p_option_id,auth.uid()) on conflict(poll_id,user_id) do update set option_id=excluded.option_id,updated_at=now();
end $$;
create or replace function public.close_group_poll(p_poll_id uuid,p_channel_id bigint)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or not exists(select 1 from profiles where id=auth.uid()) then raise exception 'Acceso no autorizado'; end if;
 update group_polls set closed_at=coalesce(closed_at,now()) where id=p_poll_id and channel_id=p_channel_id and (created_by=auth.uid() or public.current_user_can_manage());
 if not found then raise exception 'No puedes cerrar esta encuesta'; end if;
end $$;
revoke all on function public.respond_to_event(bigint,date,text),public.create_group_poll(bigint,text,text[],uuid),public.vote_group_poll(uuid,bigint,uuid),public.close_group_poll(uuid,bigint) from public,anon;
grant execute on function public.respond_to_event(bigint,date,text),public.create_group_poll(bigint,text,text[],uuid),public.vote_group_poll(uuid,bigint,uuid),public.close_group_poll(uuid,bigint) to authenticated;
do $$ begin
 alter publication supabase_realtime add table public.group_polls;
exception when duplicate_object then null; end $$;
do $$ begin
 alter publication supabase_realtime add table public.group_poll_votes;
exception when duplicate_object then null; end $$;
commit;

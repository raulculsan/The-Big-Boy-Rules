begin;
alter table public.chat_channels add column if not exists description text not null default '' check (char_length(description) <= 500);
alter table public.chat_channels add column if not exists read_only boolean not null default false;
create table if not exists public.chat_channel_automations (
 id bigint generated always as identity primary key,
 channel_id bigint not null references public.chat_channels(id) on delete cascade,
 kind text not null check(kind in ('once','recurring','visit')),
 enabled boolean not null default false,
 body text not null default '' check(char_length(body) <= 1200),
 scheduled_at timestamptz,
 cadence text not null default 'daily' check(cadence in ('daily','weekly')),
 weekday smallint not null default 1 check(weekday between 0 and 6),
 local_time time not null default '09:00',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(channel_id,kind),
 check(not enabled or char_length(trim(body)) > 0),
 check(kind <> 'once' or not enabled or scheduled_at is not null)
);
create table if not exists public.chat_channel_automation_messages (
 id bigint generated always as identity primary key,
 automation_id bigint references public.chat_channel_automations(id) on delete set null,
 channel_id bigint not null references public.chat_channels(id) on delete cascade,
 occurrence_key text not null,
 body text not null check(char_length(body) between 1 and 1400),
 created_at timestamptz not null default now(),
 unique(automation_id,occurrence_key)
);
create index if not exists channel_automation_messages_time on public.chat_channel_automation_messages(channel_id,created_at desc);
alter table public.chat_channel_automations enable row level security;
alter table public.chat_channel_automation_messages enable row level security;
revoke all on public.chat_channel_automations, public.chat_channel_automation_messages from anon,authenticated;
grant select on public.chat_channel_automations, public.chat_channel_automation_messages to authenticated;
drop policy if exists "admins read section automation" on public.chat_channel_automations;
create policy "admins read section automation" on public.chat_channel_automations for select to authenticated using(public.current_user_can_manage());
drop policy if exists "members read section automation messages" on public.chat_channel_automation_messages;
create policy "members read section automation messages" on public.chat_channel_automation_messages for select to authenticated using(exists(select 1 from public.profiles where id=auth.uid()));
-- Restrictive policies also apply alongside any earlier permissive policy.
drop policy if exists "section write permissions" on public.messages;
create policy "section write permissions" on public.messages as restrictive for insert to authenticated with check (
 exists(select 1 from public.chat_channels c where c.id=messages.channel_id and (not c.read_only or public.current_user_can_manage()))
);
drop policy if exists "section edit permissions" on public.messages;
create policy "section edit permissions" on public.messages as restrictive for update to authenticated using(
 exists(select 1 from public.chat_channels c where c.id=messages.channel_id and (not c.read_only or public.current_user_can_manage()))
) with check(exists(select 1 from public.chat_channels c where c.id=messages.channel_id and (not c.read_only or public.current_user_can_manage())));
-- Poll creation is a security-definer RPC, so enforce at the table trigger too.
create or replace function public.enforce_channel_poll_write() returns trigger language plpgsql set search_path='' as $$
begin
 if exists(select 1 from public.chat_channels where id=new.channel_id and read_only) and not public.current_user_can_manage() then raise exception 'Esta sección es solo de lectura.'; end if;
 return new;
end $$;
drop trigger if exists enforce_channel_poll_write on public.group_polls;
create trigger enforce_channel_poll_write before insert or update on public.group_polls for each row execute function public.enforce_channel_poll_write();
-- Votes also arrive through a security-definer RPC, which bypasses RLS.
create or replace function public.enforce_channel_poll_vote() returns trigger language plpgsql set search_path='' as $$
begin
 if exists(select 1 from public.group_polls p join public.chat_channels c on c.id=p.channel_id where p.id=new.poll_id and c.read_only) and not public.current_user_can_manage() then raise exception 'Esta sección es solo de lectura.'; end if;
 return new;
end $$;
drop trigger if exists enforce_channel_poll_vote on public.group_poll_votes;
create trigger enforce_channel_poll_vote before insert or update on public.group_poll_votes for each row execute function public.enforce_channel_poll_vote();
create or replace function public.save_chat_channel_configuration(p_id bigint,p_name text,p_description text,p_read_only boolean,p_rules jsonb)
returns bigint language plpgsql security definer set search_path='' as $$
declare v_id bigint; r jsonb;
begin
 if auth.uid() is null or not public.current_user_can_manage() then raise exception 'Solo administración puede configurar secciones.'; end if;
 if p_name is null or p_name !~ '^[a-z0-9-]{1,32}$' or p_description is null or char_length(p_description)>500 then raise exception 'Revisa el nombre y la descripción.'; end if;
 if p_rules is null or jsonb_typeof(p_rules)<>'array' or jsonb_array_length(p_rules)<>3 or (select count(distinct value->>'kind') from jsonb_array_elements(p_rules))<>3 then raise exception 'Configuración de automatizaciones incompleta.'; end if;
 if p_id is null then
  insert into public.chat_channels(name,description,read_only,created_by,position) values(p_name,p_description,coalesce(p_read_only,false),auth.uid(),coalesce((select max(position)+1 from public.chat_channels),0)) returning id into v_id;
 else
  update public.chat_channels set name=p_name,description=p_description,read_only=coalesce(p_read_only,false) where id=p_id returning id into v_id;
  if v_id is null then raise exception 'La sección ya no existe.'; end if;
 end if;
 for r in select value from jsonb_array_elements(p_rules) loop
  if r->>'kind' not in ('once','recurring','visit') then raise exception 'Automatización desconocida.'; end if;
  if (r->>'enabled')::boolean and r->>'kind'='once' and (r->>'scheduled_at')::timestamptz<=now() then raise exception 'Elige una fecha futura para el mensaje programado.'; end if;
  insert into public.chat_channel_automations(channel_id,kind,enabled,body,scheduled_at,cadence,weekday,local_time)
  values(v_id,r->>'kind',coalesce((r->>'enabled')::boolean,false),trim(coalesce(r->>'body','')),(r->>'scheduled_at')::timestamptz,coalesce(r->>'cadence','daily'),coalesce((r->>'weekday')::smallint,1),coalesce((r->>'local_time')::time,'09:00'::time))
  on conflict(channel_id,kind) do update set enabled=excluded.enabled,body=excluded.body,scheduled_at=excluded.scheduled_at,cadence=excluded.cadence,weekday=excluded.weekday,local_time=excluded.local_time,updated_at=now();
 end loop;
 return v_id;
end $$;
revoke all on function public.save_chat_channel_configuration(bigint,text,text,boolean,jsonb) from public,anon;
grant execute on function public.save_chat_channel_configuration(bigint,text,text,boolean,jsonb) to authenticated;

create or replace function public.publish_due_channel_messages() returns integer language plpgsql security definer set search_path='' as $$
declare v_count integer; v_local timestamp:=now() at time zone 'Europe/Madrid';
begin
 insert into public.chat_channel_automation_messages(automation_id,channel_id,occurrence_key,body)
 select a.id,a.channel_id,case when kind='once' then 'once:'||scheduled_at::text else 'recurring:'||v_local::date::text end,a.body
 from public.chat_channel_automations a where a.enabled and (
  (a.kind='once' and a.scheduled_at<=now()) or
  (a.kind='recurring' and v_local::time>=a.local_time and (v_local::date+a.local_time)>= (a.created_at at time zone 'Europe/Madrid')
   and (a.cadence='daily' or extract(dow from v_local)::integer=a.weekday))
 ) on conflict(automation_id,occurrence_key) do nothing;
 get diagnostics v_count=row_count;
 update public.chat_channel_automations set enabled=false where kind='once' and enabled and scheduled_at<=now();
 return v_count;
end $$;
revoke all on function public.publish_due_channel_messages() from public,anon,authenticated;
grant execute on function public.publish_due_channel_messages() to service_role;

-- User identity, Madrid date and occurrence key are trusted server values.
-- A visit can be registered on launch/resume; simultaneous devices cannot duplicate it.
create or replace function public.register_chat_channel_visit() returns void language plpgsql security definer set search_path='' as $$
declare v_name text; v_today date:=(now() at time zone 'Europe/Madrid')::date;
begin
 select display_name into v_name from public.profiles where id=auth.uid();
 if auth.uid() is null or v_name is null then raise exception 'Inicia sesión para entrar al club.'; end if;
 insert into public.chat_channel_automation_messages(automation_id,channel_id,occurrence_key,body)
 select id,channel_id,'visit:'||v_today::text||':'||auth.uid()::text,left(replace(body,'{nombre}',v_name),1400)
 from public.chat_channel_automations where enabled and kind='visit'
 on conflict(automation_id,occurrence_key) do nothing;
end $$;
revoke all on function public.register_chat_channel_visit() from public,anon;
grant execute on function public.register_chat_channel_visit() to authenticated;
create extension if not exists pg_cron with schema pg_catalog;
do $$ declare v_job bigint; begin
 for v_job in select jobid from cron.job where jobname='bigboys-section-automations' loop perform cron.unschedule(v_job); end loop;
 perform cron.schedule('bigboys-section-automations','* * * * *','select public.publish_due_channel_messages();');
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='chat_channel_automation_messages') then
  alter publication supabase_realtime add table public.chat_channel_automation_messages;
 end if;
end $$;
commit;

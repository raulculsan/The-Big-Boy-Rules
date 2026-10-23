begin;
create table public.club_event_arrivals (
 event_id bigint not null references public.group_events(id) on delete cascade,
 occurrence date not null, user_id uuid not null references public.profiles(id) on delete cascade,
 arrived_at timestamptz not null default now(), primary key(event_id,occurrence,user_id)
);
create table public.club_event_questions (
 id uuid primary key default gen_random_uuid(), event_id bigint not null references public.group_events(id) on delete cascade,
 occurrence date not null, kind text not null check(kind in ('decision','prediction')),
 question text not null check(length(trim(question)) between 3 and 160),
 options text[] not null check(cardinality(options) between 2 and 6 and length(array_to_string(options,'')) <= 480),
 created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(),
 closed_at timestamptz, result_index smallint check(result_index between 0 and 5),
 check(result_index is null or result_index < cardinality(options))
);
create table public.club_event_votes (
 question_id uuid not null references public.club_event_questions(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 option_index smallint not null check(option_index between 0 and 5), updated_at timestamptz not null default now(),
 primary key(question_id,user_id)
);
create table public.club_event_places (
 event_id bigint primary key references public.group_events(id) on delete cascade,
 latitude double precision not null check(latitude between -90 and 90),
 longitude double precision not null check(longitude between -180 and 180),
 label text not null check(length(trim(label)) between 1 and 120), updated_by uuid not null references public.profiles(id)
);
create table public.club_event_memories (
 id uuid primary key default gen_random_uuid(), event_id bigint not null references public.group_events(id) on delete cascade,
 occurrence date not null, moment_id bigint not null references public.moments(id) on delete cascade,
 created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), unique(event_id,occurrence,moment_id)
);
create index club_event_questions_event_idx on public.club_event_questions(event_id,occurrence,created_at);
create index club_event_votes_user_idx on public.club_event_votes(user_id);
create index club_event_memories_event_idx on public.club_event_memories(event_id,occurrence);
create index club_event_memories_moment_idx on public.club_event_memories(moment_id);
-- No anonymous, unapproved or unverified identities can read club activity.
do $$ declare t text; begin
 foreach t in array array['club_event_arrivals','club_event_questions','club_event_votes','club_event_places','club_event_memories'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant select,insert,update,delete on public.%I to authenticated',t);
 execute format('create policy club_member_access on public.%I as restrictive for all to authenticated using ((select public.account_security_satisfied()) and exists(select 1 from public.profiles where id=(select auth.uid()))) with check ((select public.account_security_satisfied()) and exists(select 1 from public.profiles where id=(select auth.uid())))',t);
 execute format('create policy club_read on public.%I for select to authenticated using(true)',t);
 end loop;
end $$;
create policy own_arrival on public.club_event_arrivals for insert to authenticated with check(user_id=(select auth.uid()) and occurrence=(now() at time zone 'Europe/Madrid')::date);
create policy remove_own_arrival on public.club_event_arrivals for delete to authenticated using(user_id=(select auth.uid()));
create policy own_question on public.club_event_questions for insert to authenticated with check(created_by=(select auth.uid()) and closed_at is null and result_index is null);
create policy manage_question on public.club_event_questions for update to authenticated using(created_by=(select auth.uid()) or public.current_user_can_manage()) with check(created_by=(select auth.uid()) or public.current_user_can_manage());
create policy own_vote_insert on public.club_event_votes for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.club_event_questions q where q.id=question_id and q.closed_at is null and option_index<cardinality(q.options)));
create policy own_vote_update on public.club_event_votes for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and exists(select 1 from public.club_event_questions q where q.id=question_id and q.closed_at is null and option_index<cardinality(q.options)));
create policy event_place_insert on public.club_event_places for insert to authenticated with check(updated_by=(select auth.uid()) and exists(select 1 from public.group_events e where e.id=event_id and (e.created_by=(select auth.uid()) or public.current_user_can_manage())));
create policy event_place_update on public.club_event_places for update to authenticated using(exists(select 1 from public.group_events e where e.id=event_id and (e.created_by=(select auth.uid()) or public.current_user_can_manage()))) with check(updated_by=(select auth.uid()) and exists(select 1 from public.group_events e where e.id=event_id and (e.created_by=(select auth.uid()) or public.current_user_can_manage())));
create policy own_memory on public.club_event_memories for insert to authenticated with check(created_by=(select auth.uid()) and exists(select 1 from public.moments m where m.id=moment_id and m.user_id=(select auth.uid()) and m.media_type='image'));
create policy remove_own_memory on public.club_event_memories for delete to authenticated using(created_by=(select auth.uid()) or public.current_user_can_manage());
-- Immutable identity, event, choices and timestamps prevent editing a poll after votes.
create function public.club_live_guard_question() returns trigger language plpgsql security invoker set search_path='' as $$ begin
 if new.id<>old.id or new.event_id<>old.event_id or new.occurrence<>old.occurrence or new.kind<>old.kind or new.question<>old.question or new.options<>old.options or new.created_by<>old.created_by or new.created_at<>old.created_at then raise exception 'La pregunta no puede editarse después de publicarse.'; end if;
 if old.closed_at is not null then raise exception 'La votación ya está cerrada.'; end if;
 if new.closed_at is not null then new.closed_at=now(); end if;
 if new.result_index is not null and new.closed_at is null then raise exception 'Cierra la predicción para revelar el resultado.'; end if;
 return new; end $$;
revoke all on function public.club_live_guard_question() from public;
create trigger club_live_question_guard before update on public.club_event_questions for each row execute function public.club_live_guard_question();
-- Serialize votes with closure; a vote cannot sneak in after the reveal.
create function public.club_live_guard_vote() returns trigger language plpgsql security invoker set search_path='' as $$
declare q public.club_event_questions%rowtype; event_start timestamptz; begin
 select * into strict q from public.club_event_questions where id=new.question_id for share;
 if q.closed_at is not null or new.option_index>=cardinality(q.options) then raise exception 'La votación está cerrada o la opción no existe.'; end if;
 if tg_op='UPDATE' and (new.question_id<>old.question_id or new.user_id<>old.user_id) then raise exception 'No puedes cambiar la identidad del voto.'; end if;
 select ((q.occurrence::text || ' ' || to_char(starts_at at time zone 'Europe/Madrid','HH24:MI:SS'))::timestamp at time zone 'Europe/Madrid') into event_start from public.group_events where id=q.event_id;
 if q.kind='prediction' and now()>=event_start then raise exception 'El plan ya ha empezado. Las predicciones están cerradas.'; end if;
 new.updated_at=now(); return new;
end $$;
revoke all on function public.club_live_guard_vote() from public;
create trigger club_live_vote_guard before insert or update on public.club_event_votes for each row execute function public.club_live_guard_vote();
create function public.club_live_guard_question_insert() returns trigger language plpgsql security invoker set search_path='' as $$
declare e public.group_events%rowtype; event_start timestamptz; begin
 select * into strict e from public.group_events where id=new.event_id;
 if not e.annual and new.occurrence<>(e.starts_at at time zone 'Europe/Madrid')::date then raise exception 'La fecha no corresponde a este plan.'; end if;
 if e.annual and to_char(new.occurrence,'MM-DD')<>to_char(e.starts_at at time zone 'Europe/Madrid','MM-DD') then raise exception 'La fecha no corresponde al aniversario.'; end if;
 event_start=((new.occurrence::text || ' ' || to_char(e.starts_at at time zone 'Europe/Madrid','HH24:MI:SS'))::timestamp at time zone 'Europe/Madrid');
 if new.kind='prediction' and now()>=event_start then raise exception 'Las predicciones se publican antes del plan.'; end if;
 if exists(select 1 from unnest(new.options) o where length(trim(o))<1 or length(o)>80) or (select count(distinct o) from unnest(new.options) o)<>cardinality(new.options) then raise exception 'Las opciones deben ser distintas y tener entre 1 y 80 caracteres.'; end if;
 if (select count(*) from public.club_event_questions where event_id=new.event_id and occurrence=new.occurrence)>=40 then raise exception 'Este plan ya tiene 40 preguntas.'; end if;
 new.created_at=now(); return new;
end $$;
revoke all on function public.club_live_guard_question_insert() from public;
create trigger club_live_question_insert_guard before insert on public.club_event_questions for each row execute function public.club_live_guard_question_insert();
create function public.club_live_guard_arrival() returns trigger language plpgsql security invoker set search_path='' as $$
declare e public.group_events%rowtype; begin
 select * into strict e from public.group_events where id=new.event_id;
 if not e.annual and new.occurrence<>(e.starts_at at time zone 'Europe/Madrid')::date then raise exception 'Solo puedes registrar tu llegada el día del plan.'; end if;
 if e.annual and to_char(new.occurrence,'MM-DD')<>to_char(e.starts_at at time zone 'Europe/Madrid','MM-DD') then raise exception 'Solo puedes registrar tu llegada el día del aniversario.'; end if;
 new.arrived_at=now(); return new;
end $$;
revoke all on function public.club_live_guard_arrival() from public;
create trigger club_live_arrival_guard before insert on public.club_event_arrivals for each row execute function public.club_live_guard_arrival();
create function public.club_live_guard_memory() returns trigger language plpgsql security invoker set search_path='' as $$
declare e public.group_events%rowtype; begin
 select * into strict e from public.group_events where id=new.event_id;
 if not e.annual and new.occurrence<>(e.starts_at at time zone 'Europe/Madrid')::date then raise exception 'La fecha no corresponde a este plan.'; end if;
 if e.annual and to_char(new.occurrence,'MM-DD')<>to_char(e.starts_at at time zone 'Europe/Madrid','MM-DD') then raise exception 'La fecha no corresponde al aniversario.'; end if;
 if new.occurrence>(now() at time zone 'Europe/Madrid')::date then raise exception 'Los recuerdos se guardan desde el día del plan.'; end if;
 if (select count(*) from public.club_event_memories where event_id=new.event_id and occurrence=new.occurrence)>=80 then raise exception 'Este plan ya tiene 80 fotos.'; end if;
 new.created_at=now(); return new;
end $$;
revoke all on function public.club_live_guard_memory() from public;
create trigger club_live_memory_guard before insert on public.club_event_memories for each row execute function public.club_live_guard_memory();
commit;

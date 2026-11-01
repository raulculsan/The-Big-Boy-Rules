begin;

-- La Sala: live party games for the people at a plan. Only attendees of that occurrence can
-- enter, only on its day. Answers stay hidden until a round is revealed, and only the server scores.
create schema club_night;
revoke all on schema club_night from public,anon,authenticated;

create table club_night.prompts (
  id smallint generated always as identity primary key,
  game text not null check(game in ('never','likely','draw')),
  body text not null unique check(length(body) between 3 and 140)
);
create table club_night.rounds (
  id uuid primary key default gen_random_uuid(),
  event_id bigint not null references public.group_events(id) on delete cascade,
  occurrence date not null,
  game text not null check(game in ('never','likely','trivia','draw')),
  prompt text not null,
  author uuid references auth.users(id) on delete set null,
  drawer uuid references auth.users(id) on delete set null,
  strokes jsonb not null default '[]'::jsonb,
  opened_by uuid references auth.users(id) on delete set null,
  revealed_at timestamptz,
  created_at timestamptz not null default statement_timestamp()
);
create unique index club_night_one_open_round on club_night.rounds(event_id,occurrence) where revealed_at is null;
create index club_night_rounds_idx on club_night.rounds(event_id,occurrence,created_at);
create table club_night.answers (
  round_id uuid not null references club_night.rounds(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  value text not null check(length(value) between 0 and 40),
  points smallint not null default 0,
  primary key(round_id,user_id)
);
create index club_night_answers_user_idx on club_night.answers(user_id);
create table club_night.reactions (
  id bigint generated always as identity primary key,
  event_id bigint not null references public.group_events(id) on delete cascade,
  occurrence date not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default statement_timestamp()
);
create index club_night_reactions_idx on club_night.reactions(event_id,occurrence,created_at desc);
create table club_night.recaps (
  event_id bigint not null references public.group_events(id) on delete cascade,
  occurrence date not null,
  title text not null,
  winner uuid references auth.users(id) on delete set null,
  scores jsonb not null,
  highlight text,
  created_at timestamptz not null default statement_timestamp(),
  primary key(event_id,occurrence)
);
alter table club_night.prompts enable row level security;
alter table club_night.rounds enable row level security;
alter table club_night.answers enable row level security;
alter table club_night.reactions enable row level security;
alter table club_night.recaps enable row level security;

insert into club_night.prompts(game,body) values
('never','Yo nunca me he quedado dormido en el metro hasta el final de la línea'),
('never','Yo nunca he fingido una llamada para escapar de alguien'),
('never','Yo nunca he mandado un mensaje a la persona equivocada'),
('never','Yo nunca me he comido algo caído del suelo'),
('never','Yo nunca he dicho que estaba de camino sin haber salido de casa'),
('never','Yo nunca he cancelado un plan para quedarme en el sofá'),
('never','Yo nunca he buscado mi nombre en internet'),
('never','Yo nunca he mentido sobre haber visto una película'),
('never','Yo nunca me he ido sin pagar mi parte'),
('never','Yo nunca he llorado con un anuncio'),
('never','Yo nunca he cantado en la ducha a pleno pulmón'),
('never','Yo nunca me he perdido en mi propio barrio'),
('never','Yo nunca he reenviado un audio que no debía'),
('never','Yo nunca he pedido perdón sin saber por qué'),
('never','Yo nunca he usado el móvil de otro para llamarme'),
('never','Yo nunca he hecho como que no veía a alguien por la calle'),
('never','Yo nunca me he arrepentido de un corte de pelo'),
('never','Yo nunca he comprado algo solo porque estaba rebajado'),
('never','Yo nunca he bailado solo en casa'),
('never','Yo nunca he aplaudido al aterrizar un avión'),
('likely','¿Quién es más probable que llegue tarde a su propia boda?'),
('likely','¿Quién sobreviviría menos en una isla desierta?'),
('likely','¿Quién se haría famoso por accidente?'),
('likely','¿Quién gastaría todo su sueldo en una tarde?'),
('likely','¿Quién acabaría discutiendo con un camarero?'),
('likely','¿Quién se quedaría dormido en este plan?'),
('likely','¿Quién contaría antes un secreto?'),
('likely','¿Quién sería el peor compañero de piso?'),
('likely','¿Quién se perdería de camino a casa?'),
('likely','¿Quién ganaría un concurso de karaoke sin saberse la letra?'),
('likely','¿Quién olvidaría antes un cumpleaños?'),
('likely','¿Quién montaría un negocio absurdo?'),
('likely','¿Quién se apuntaría a cualquier plan sin preguntar?'),
('likely','¿Quién tiene más mensajes sin contestar?'),
('likely','¿Quién lloraría en una película de dibujos?'),
('likely','¿Quién acabaría en las noticias de su pueblo?'),
('likely','¿Quién pediría lo mismo de siempre en cualquier sitio?'),
('likely','¿Quién se enfadaría antes jugando a un juego de mesa?'),
('likely','¿Quién dejaría el gimnasio la primera semana?'),
('likely','¿Quién haría trampas sin ningún remordimiento?'),
('draw','Paella'),('draw','Tigre'),('draw','Metro'),('draw','Bicicleta'),('draw','Pirata'),
('draw','Volcán'),('draw','Sirena'),('draw','Fantasma'),('draw','Astronauta'),('draw','Pizza'),
('draw','Dragón'),('draw','Semáforo'),('draw','Guitarra'),('draw','Tiburón'),('draw','Castillo'),
('draw','Robot'),('draw','Helicóptero'),('draw','Plátano'),('draw','Paraguas'),('draw','Canguro'),
('draw','Portero'),('draw','Pingüino'),('draw','Cohete'),('draw','Tortilla'),('draw','Moto');

create function club_night.people(target bigint,day date) returns uuid[] language sql stable security definer set search_path='' as $$
  select coalesce(array_agg(distinct x.user_id),'{}') from (
    select user_id from public.event_attendance where event_id=target and occurrence=day and response='going'
    union select user_id from public.club_event_arrivals where event_id=target and occurrence=day) x
  join public.profiles p on p.id=x.user_id where not coalesce(p.is_hidden,false)
$$;

-- Open from the plan's day until six the next morning.
create function club_night.enter(target bigint,day date) returns uuid language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=club_plus.guard(); local_now timestamp:=statement_timestamp() at time zone 'Europe/Madrid';
begin
  if day is null or not (day=local_now::date or (day=local_now::date-1 and extract(hour from local_now)<6)) then
    raise exception 'La Sala solo se abre el día del plan.' using errcode='22023';
  end if;
  if not actor=any(club_night.people(target,day)) then
    raise exception 'La Sala es para quienes vienen a este plan.' using errcode='42501';
  end if;
  return actor;
end $$;

create function club_night.clean(value text) returns text language sql immutable set search_path='' as
$$ select translate(lower(btrim(coalesce(value,''))),'áéíóúü','aeiouu') $$;

-- Scores a round exactly once.
create function club_night.reveal(target uuid) returns void language plpgsql security definer set search_path='' as $$
declare r club_night.rounds; top text;
begin
  select * into r from club_night.rounds where id=target for update;
  if r.revealed_at is not null then return; end if;
  update club_night.rounds set revealed_at=statement_timestamp() where id=target;
  if r.game='never' then
    update club_night.answers set points=1 where round_id=target and value='yes';
  elsif r.game='likely' then
    select value into top from club_night.answers where round_id=target group by value order by count(*) desc,value limit 1;
    update club_night.answers set points=2 where round_id=target and value=top;
  elsif r.game='trivia' then
    update club_night.answers set points=3 where round_id=target and value=r.author::text;
  elsif r.game='draw' then
    update club_night.answers set points=3 where round_id=target and club_night.clean(value)=club_night.clean(r.prompt);
    insert into club_night.answers(round_id,user_id,value,points)
      select target,r.drawer,'',least(count(*)::int,5) from club_night.answers where round_id=target and points=3
      having r.drawer is not null and count(*)>0
      on conflict(round_id,user_id) do nothing;
  end if;
end $$;

create function club_night.state(actor uuid,target bigint,day date) returns jsonb language sql stable security definer set search_path='' as $$
  with r as (select * from club_night.rounds where event_id=target and occurrence=day order by created_at desc limit 1),
  room as (select club_night.people(target,day) ids)
  select jsonb_build_object(
    'people',(select to_jsonb(ids) from room),
    'round',(select jsonb_build_object('id',r.id,'game',r.game,
      'prompt',case when r.game='draw' and r.revealed_at is null and r.drawer<>actor then null else r.prompt end,
      'drawer',r.drawer,'strokes',r.strokes,'revealed',r.revealed_at is not null,
      'author',case when r.revealed_at is not null then r.author end,
      'answered',(select count(*) from club_night.answers a where a.round_id=r.id),
      'mine',(select value from club_night.answers a where a.round_id=r.id and a.user_id=actor),
      'results',case when r.revealed_at is not null then coalesce((select jsonb_agg(jsonb_build_object('user',a.user_id,'value',a.value,'points',a.points) order by a.points desc)
        from club_night.answers a where a.round_id=r.id),'[]'::jsonb) else '[]'::jsonb end) from r),
    'scores',coalesce((select jsonb_agg(jsonb_build_object('user',s.user_id,'points',s.total) order by s.total desc) from (
      select a.user_id,sum(a.points)::int total from club_night.answers a join club_night.rounds x on x.id=a.round_id
      where x.event_id=target and x.occurrence=day and x.revealed_at is not null group by a.user_id having sum(a.points)>0) s),'[]'::jsonb),
    'reactions',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'emoji',x.emoji)) from club_night.reactions x
      where x.event_id=target and x.occurrence=day and x.created_at>statement_timestamp()-interval '6 seconds'),'[]'::jsonb),
    'recap',(select jsonb_build_object('winner',c.winner,'scores',c.scores,'highlight',c.highlight) from club_night.recaps c where c.event_id=target and c.occurrence=day))
$$;

create function public.get_club_night(p_event bigint,p_occurrence date) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=club_night.enter(p_event,p_occurrence);
begin
  return club_night.state(actor,p_event,p_occurrence);
end $$;

create function public.start_night_round(p_event bigint,p_occurrence date,p_game text) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=club_night.enter(p_event,p_occurrence); room uuid[]:=club_night.people(p_event,p_occurrence); text_body text; who uuid; first_round boolean;
begin
  perform pg_advisory_xact_lock(hashtext('club_night'),p_event::int);
  if cardinality(room)<2 then raise exception 'Hacen falta al menos dos personas en el plan.' using errcode='22023'; end if;
  if exists(select 1 from club_night.recaps where event_id=p_event and occurrence=p_occurrence) then raise exception 'La Sala de este plan ya ha terminado.' using errcode='22023'; end if;
  if exists(select 1 from club_night.rounds where event_id=p_event and occurrence=p_occurrence and revealed_at is null) then raise exception 'Termina antes la ronda abierta.' using errcode='22023'; end if;
  first_round:=not exists(select 1 from club_night.rounds where event_id=p_event and occurrence=p_occurrence);
  if p_game in ('never','likely','draw') then
    select p.body into text_body from club_night.prompts p where p.game=p_game
      and not exists(select 1 from club_night.rounds r where r.event_id=p_event and r.occurrence=p_occurrence and r.prompt=p.body)
      order by random() limit 1;
  elsif p_game='trivia' then
    select left(btrim(m.body),140),m.user_id into text_body,who from public.messages m
      where m.user_id=any(room) and length(btrim(coalesce(m.body,'')))between 15 and 140 and m.created_at<statement_timestamp()-interval '1 day'
      and not exists(select 1 from club_night.rounds r where r.event_id=p_event and r.occurrence=p_occurrence and r.prompt=left(btrim(m.body),140))
      order by random() limit 1;
  else raise exception 'Ese juego no existe.' using errcode='22023';
  end if;
  if text_body is null then raise exception 'No quedan preguntas de este juego.' using errcode='22023'; end if;
  insert into club_night.rounds(event_id,occurrence,game,prompt,author,drawer,opened_by)
    values(p_event,p_occurrence,p_game,text_body,who,case when p_game='draw' then actor end,actor);
  if first_round then
    insert into public.notifications(user_id,actor_id,type,target_type,target_id,excerpt)
      select u,actor,'event_created','event',p_event,left('La Sala está abierta: '||(select title from public.group_events where id=p_event),180)
      from unnest(room) u where u<>actor;
  end if;
  return club_night.state(actor,p_event,p_occurrence);
end $$;

create function public.answer_night_round(p_round uuid,p_value text) returns jsonb language plpgsql security definer set search_path='' as $$
declare r club_night.rounds; actor uuid; room uuid[]; cleaned text:=btrim(coalesce(p_value,'')); needed integer;
begin
  select * into r from club_night.rounds where id=p_round for update;
  if not found then raise exception 'Esa ronda no existe.' using errcode='22023'; end if;
  actor:=club_night.enter(r.event_id,r.occurrence);room:=club_night.people(r.event_id,r.occurrence);
  if r.revealed_at is not null then raise exception 'Esta ronda ya ha terminado.' using errcode='22023'; end if;
  if r.game='draw' and r.drawer=actor then raise exception 'Estás dibujando tú.' using errcode='22023'; end if;
  if r.game='never' and cleaned not in ('yes','no') then raise exception 'Respuesta no válida.' using errcode='22023'; end if;
  if r.game in ('likely','trivia') and not cleaned=any(room::text[]) then raise exception 'Esa persona no está en la Sala.' using errcode='22023'; end if;
  if r.game='draw' and length(cleaned) not between 1 and 40 then raise exception 'Escribe qué es el dibujo.' using errcode='22023'; end if;
  insert into club_night.answers(round_id,user_id,value) values(p_round,actor,cleaned)
    on conflict(round_id,user_id) do update set value=excluded.value;
  needed:=cardinality(room)-case when r.game='draw' then 1 else 0 end;
  if (select count(*) from club_night.answers where round_id=p_round)>=needed then perform club_night.reveal(p_round); end if;
  return club_night.state(actor,r.event_id,r.occurrence);
end $$;

create function public.reveal_night_round(p_round uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r club_night.rounds; actor uuid;
begin
  select * into r from club_night.rounds where id=p_round;
  if not found then raise exception 'Esa ronda no existe.' using errcode='22023'; end if;
  actor:=club_night.enter(r.event_id,r.occurrence);
  perform club_night.reveal(p_round);
  return club_night.state(actor,r.event_id,r.occurrence);
end $$;

create function public.save_night_strokes(p_round uuid,p_strokes jsonb) returns void language plpgsql security definer set search_path='' as $$
declare r club_night.rounds;
begin
  select * into r from club_night.rounds where id=p_round;
  if not found or r.drawer is distinct from club_night.enter(r.event_id,r.occurrence) or r.revealed_at is not null then
    raise exception 'No puedes dibujar en esta ronda.' using errcode='42501';
  end if;
  if jsonb_typeof(p_strokes)<>'array' or length(p_strokes::text)>150000 then raise exception 'El dibujo es demasiado grande.' using errcode='22023'; end if;
  update club_night.rounds set strokes=p_strokes where id=p_round;
end $$;

create function public.send_night_reaction(p_event bigint,p_occurrence date,p_emoji text) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=club_night.enter(p_event,p_occurrence);
begin
  if p_emoji not in ('😂','🔥','😮','👏','💀','❤️') then raise exception 'Reacción no válida.' using errcode='22023'; end if;
  if (select count(*) from club_night.reactions where user_id=actor and created_at>statement_timestamp()-interval '5 seconds')>=6 then return; end if;
  insert into club_night.reactions(event_id,occurrence,user_id,emoji) values(p_event,p_occurrence,actor,p_emoji);
  delete from club_night.reactions where event_id=p_event and occurrence=p_occurrence and created_at<statement_timestamp()-interval '1 minute';
end $$;

-- Ends the night: pays once, adds the top two to the league and keeps a recap for Recuerdos.
create function public.finish_club_night(p_event bigint,p_occurrence date) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=club_night.enter(p_event,p_occurrence); open_round uuid; board jsonb; top uuid; second uuid; line text; heading text; p record;
begin
  perform pg_advisory_xact_lock(hashtext('club_night'),p_event::int);
  if exists(select 1 from club_night.recaps where event_id=p_event and occurrence=p_occurrence) then return club_night.state(actor,p_event,p_occurrence); end if;
  select id into open_round from club_night.rounds where event_id=p_event and occurrence=p_occurrence and revealed_at is null;
  if open_round is not null then perform club_night.reveal(open_round); end if;
  select jsonb_agg(jsonb_build_object('user',s.user_id,'points',s.total) order by s.total desc),
    (array_agg(s.user_id order by s.total desc,s.user_id))[1],(array_agg(s.user_id order by s.total desc,s.user_id))[2] into board,top,second
    from (select a.user_id,sum(a.points)::int total from club_night.answers a join club_night.rounds r on r.id=a.round_id
      where r.event_id=p_event and r.occurrence=p_occurrence group by a.user_id having sum(a.points)>0) s;
  if top is null then raise exception 'Jugad al menos una ronda antes de terminar.' using errcode='22023'; end if;
  select r.prompt into line from club_night.rounds r join club_night.answers a on a.round_id=r.id
    where r.event_id=p_event and r.occurrence=p_occurrence and r.game in ('likely','never') and a.points>0
    group by r.id order by count(*) desc,r.created_at limit 1;
  select title into heading from public.group_events where id=p_event;
  insert into club_night.recaps(event_id,occurrence,title,winner,scores,highlight) values(p_event,p_occurrence,heading,top,board,line);
  for p in select (e->>'user')::uuid id from jsonb_array_elements(board) e loop
    perform club_rewards.award_coins(p.id,'night:'||p_event||':'||p_occurrence,'club',case when p.id=top then 10 else 3 end);
  end loop;
  if second is not null then
    insert into club_plus.matches(game,winner,loser,created_by) values('La Sala',top,second,actor);
  end if;
  return club_night.state(actor,p_event,p_occurrence);
end $$;

-- Recuerdos shows the latest nights next to the Chota's endings.
create or replace function public.get_club_story() returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=club_plus.guard(); current_day uuid:=club_story.advance();
begin
  return club_story.state(actor,current_day)||jsonb_build_object('nights',coalesce((select jsonb_agg(jsonb_build_object('title',x.title,'winner',x.winner,'highlight',x.highlight,'at',x.occurrence) order by x.occurrence desc) from (
    select * from club_night.recaps order by occurrence desc limit 10) x),'[]'::jsonb));
end $$;

revoke all on all functions in schema club_night from public,anon,authenticated;
revoke all on function public.get_club_night(bigint,date),public.start_night_round(bigint,date,text),public.answer_night_round(uuid,text),public.reveal_night_round(uuid),public.save_night_strokes(uuid,jsonb),public.send_night_reaction(bigint,date,text),public.finish_club_night(bigint,date) from public,anon;
grant execute on function public.get_club_night(bigint,date),public.start_night_round(bigint,date,text),public.answer_night_round(uuid,text),public.reveal_night_round(uuid),public.save_night_strokes(uuid,jsonb),public.send_night_reaction(bigint,date,text),public.finish_club_night(bigint,date) to authenticated;

commit;

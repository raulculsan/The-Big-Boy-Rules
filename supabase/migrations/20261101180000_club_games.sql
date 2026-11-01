begin;

-- Group games: club court, weekly challenge, two truths and a lie, and a league table.
create table club_plus.trials (
  id uuid primary key default gen_random_uuid(),
  accused uuid not null references auth.users(id) on delete cascade,
  accuser uuid not null references auth.users(id) on delete cascade,
  charge text not null check(length(charge) between 5 and 140),
  defence text check(length(defence) between 1 and 200),
  created_at timestamptz not null default statement_timestamp(),
  closes_at timestamptz not null default statement_timestamp()+interval '2 days',
  check(accused<>accuser)
);
create table club_plus.trial_votes (
  trial_id uuid not null references club_plus.trials(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  guilty boolean not null,
  primary key(trial_id,user_id)
);
create table club_plus.challenges (
  id smallint generated always as identity primary key,
  prompt text not null unique
);
create table club_plus.challenge_entries (
  week date not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check(length(body) between 2 and 200),
  primary key(week,user_id)
);
create table club_plus.challenge_votes (
  week date not null,
  author uuid not null references auth.users(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key(week,author,user_id)
);
create table club_plus.lies (
  id uuid primary key default gen_random_uuid(),
  author uuid not null references auth.users(id) on delete cascade,
  claims text[] not null check(cardinality(claims)=3),
  lie smallint not null check(lie between 0 and 2),
  created_at timestamptz not null default statement_timestamp()
);
create table club_plus.lie_guesses (
  lie_id uuid not null references club_plus.lies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  guess smallint not null,
  primary key(lie_id,user_id)
);
create table club_plus.matches (
  id uuid primary key default gen_random_uuid(),
  game text not null check(length(game) between 2 and 40),
  winner uuid not null references auth.users(id) on delete cascade,
  loser uuid not null references auth.users(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  played_at timestamptz not null default statement_timestamp(),
  check(winner<>loser)
);
alter table club_plus.trials enable row level security;
alter table club_plus.trial_votes enable row level security;
alter table club_plus.challenges enable row level security;
alter table club_plus.challenge_entries enable row level security;
alter table club_plus.challenge_votes enable row level security;
alter table club_plus.lies enable row level security;
alter table club_plus.lie_guesses enable row level security;
alter table club_plus.matches enable row level security;

insert into club_plus.challenges(prompt) values
  ('Haz un cumplido sincero a un desconocido'),
  ('Cocina algo que nunca hayas cocinado'),
  ('Llama a alguien con quien hace tiempo que no hablas'),
  ('Sal a andar 10 kilómetros'),
  ('Pasa un día entero sin redes sociales'),
  ('Aprende a decir una frase en un idioma nuevo'),
  ('Organiza un plan del club esta semana'),
  ('Prueba una comida que siempre has evitado'),
  ('Haz 100 flexiones repartidas en un día'),
  ('Regala algo pequeño a alguien sin motivo'),
  ('Escribe un mensaje de agradecimiento a alguien del club'),
  ('Madruga antes de las 7 un día que no tengas que hacerlo');

create function club_plus.challenge_now() returns text language sql stable security definer set search_path='' as
$$ select prompt from club_plus.challenges order by id offset ((club_plus.week()-date '2026-01-05')/7)%(select count(*) from club_plus.challenges) limit 1 $$;

create function club_plus.games(actor uuid) returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'trials',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'accused',t.accused,'accuser',t.accuser,'charge',t.charge,'defence',t.defence,
        'closed',t.closes_at<=statement_timestamp(),'closes_at',t.closes_at,
        'vote',(select guilty from club_plus.trial_votes v where v.trial_id=t.id and v.user_id=actor),
        'guilty',(select count(*) from club_plus.trial_votes v where v.trial_id=t.id and v.guilty),
        'innocent',(select count(*) from club_plus.trial_votes v where v.trial_id=t.id and not v.guilty)) order by t.created_at desc)
      from club_plus.trials t where t.created_at>statement_timestamp()-interval '9 days'),'[]'::jsonb),
    'challenge',jsonb_build_object('prompt',club_plus.challenge_now(),
      'entries',coalesce((select jsonb_agg(jsonb_build_object('user',e.user_id,'body',e.body,
          'votes',(select count(*) from club_plus.challenge_votes v where v.week=e.week and v.author=e.user_id),
          'mine',exists(select 1 from club_plus.challenge_votes v where v.week=e.week and v.author=e.user_id and v.user_id=actor)) order by e.user_id)
        from club_plus.challenge_entries e where e.week=club_plus.week()),'[]'::jsonb)),
    'lies',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'author',l.author,'claims',to_jsonb(l.claims),
        'guess',g.guess,'own',l.author=actor,
        'lie',case when l.author=actor or g.guess is not null then l.lie end,
        'fooled',(select count(*) from club_plus.lie_guesses x where x.lie_id=l.id and x.guess<>l.lie),
        'guesses',(select count(*) from club_plus.lie_guesses x where x.lie_id=l.id)) order by l.created_at desc)
      from club_plus.lies l left join club_plus.lie_guesses g on g.lie_id=l.id and g.user_id=actor
      where l.created_at>statement_timestamp()-interval '21 days'),'[]'::jsonb),
    'league',coalesce((select jsonb_agg(jsonb_build_object('id',who,'won',won,'lost',lost,'points',won*3) order by won desc,lost)
      from (select who,count(*) filter (where won_it) as won,count(*) filter (where not won_it) as lost from
        (select winner as who,true as won_it from club_plus.matches union all select loser,false from club_plus.matches) r group by who) t),'[]'::jsonb),
    'matches',coalesce((select jsonb_agg(jsonb_build_object('game',m.game,'winner',m.winner,'loser',m.loser,'at',m.played_at) order by m.played_at desc)
      from (select * from club_plus.matches order by played_at desc limit 8) m),'[]'::jsonb))
$$;
revoke all on function club_plus.challenge_now(),club_plus.games(uuid) from public,anon,authenticated;

create or replace function public.get_club_plus() returns jsonb language plpgsql stable security definer set search_path='' as
$$ declare actor uuid:=club_plus.guard(); begin return club_plus.state(actor)||club_plus.games(actor); end $$;

-- One open trial per accused and two a week per accuser, so nobody gets piled on.
create function public.open_club_trial(p_accused uuid,p_charge text) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=club_plus.guard(); cleaned text:=btrim(coalesce(p_charge,''));
begin
  if p_accused is null or p_accused=actor or not exists(select 1 from public.profiles where id=p_accused and not coalesce(is_hidden,false)) then raise exception 'Elige a otro miembro del club.' using errcode='22023'; end if;
  if length(cleaned) not between 5 and 140 then raise exception 'Escribe la acusación en 5 a 140 caracteres.' using errcode='22023'; end if;
  if exists(select 1 from club_plus.trials where accused=p_accused and closes_at>statement_timestamp()) then raise exception 'Esa persona ya tiene un juicio abierto.' using errcode='22023'; end if;
  if (select count(*) from club_plus.trials where accuser=actor and created_at>statement_timestamp()-interval '7 days')>=2 then raise exception 'Ya has abierto 2 juicios esta semana.' using errcode='22023'; end if;
  insert into club_plus.trials(accused,accuser,charge) values(p_accused,actor,cleaned);
  return club_plus.games(actor);
end $$;

create function public.defend_club_trial(p_trial uuid,p_defence text) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=club_plus.guard();
begin
  update club_plus.trials set defence=nullif(btrim(coalesce(p_defence,'')),'') where id=p_trial and accused=actor and closes_at>statement_timestamp();
  if not found then raise exception 'Solo la persona acusada puede defenderse.' using errcode='42501'; end if;
  return club_plus.games(actor);
end $$;

create function public.vote_club_trial(p_trial uuid,p_guilty boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=club_plus.guard();
begin
  if not exists(select 1 from club_plus.trials where id=p_trial and closes_at>statement_timestamp() and actor not in (accused,accuser)) then raise exception 'No puedes votar en este juicio.' using errcode='22023'; end if;
  insert into club_plus.trial_votes values(p_trial,actor,p_guilty) on conflict(trial_id,user_id) do update set guilty=excluded.guilty;
  return club_plus.games(actor);
end $$;

create function public.enter_club_challenge(p_body text) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=club_plus.guard(); cleaned text:=btrim(coalesce(p_body,''));
begin
  if length(cleaned) not between 2 and 200 then raise exception 'Cuenta cómo lo hiciste en 200 caracteres.' using errcode='22023'; end if;
  insert into club_plus.challenge_entries values(club_plus.week(),actor,cleaned) on conflict(week,user_id) do update set body=excluded.body;
  return club_plus.games(actor);
end $$;

create function public.toggle_challenge_vote(p_author uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=club_plus.guard(); this_week date:=club_plus.week();
begin
  if p_author=actor or not exists(select 1 from club_plus.challenge_entries where week=this_week and user_id=p_author) then raise exception 'No puedes validar esto.' using errcode='22023'; end if;
  delete from club_plus.challenge_votes where week=this_week and author=p_author and user_id=actor;
  if not found then insert into club_plus.challenge_votes values(this_week,p_author,actor); end if;
  return club_plus.games(actor);
end $$;

create function public.create_club_lie(p_claims text[],p_lie integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=club_plus.guard();
begin
  if cardinality(p_claims) is distinct from 3 or exists(select 1 from unnest(p_claims) c where length(btrim(c)) not between 3 and 120) then raise exception 'Escribe tres frases de 3 a 120 caracteres.' using errcode='22023'; end if;
  if p_lie not between 0 and 2 then raise exception 'Marca cuál es la mentira.' using errcode='22023'; end if;
  if exists(select 1 from club_plus.lies where author=actor and created_at>statement_timestamp()-interval '1 day') then raise exception 'Solo una al día.' using errcode='22023'; end if;
  insert into club_plus.lies(author,claims,lie) values(actor,p_claims,p_lie);
  return club_plus.games(actor);
end $$;

create function public.guess_club_lie(p_id uuid,p_guess integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=club_plus.guard();
begin
  if p_guess not between 0 and 2 or not exists(select 1 from club_plus.lies where id=p_id and author<>actor) then raise exception 'No puedes responder a esto.' using errcode='22023'; end if;
  insert into club_plus.lie_guesses values(p_id,actor,p_guess) on conflict do nothing;
  return club_plus.games(actor);
end $$;

create function public.record_club_match(p_game text,p_winner uuid,p_loser uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=club_plus.guard(); cleaned text:=btrim(coalesce(p_game,''));
begin
  if actor not in (p_winner,p_loser) and not public.current_user_is_club_admin() then raise exception 'Solo quien jugó puede apuntarlo.' using errcode='42501'; end if;
  if p_winner=p_loser or exists(select 1 from unnest(array[p_winner,p_loser]) p where not exists(select 1 from public.profiles x where x.id=p and not coalesce(x.is_hidden,false))) then raise exception 'Elige dos miembros distintos.' using errcode='22023'; end if;
  if length(cleaned) not between 2 and 40 then raise exception 'Escribe a qué jugasteis.' using errcode='22023'; end if;
  insert into club_plus.matches(game,winner,loser,created_by) values(cleaned,p_winner,p_loser,actor);
  return club_plus.games(actor);
end $$;

do $$ declare f text; begin
  foreach f in array array['open_club_trial(uuid,text)','defend_club_trial(uuid,text)','vote_club_trial(uuid,boolean)','enter_club_challenge(text)','toggle_challenge_vote(uuid)','create_club_lie(text[],integer)','guess_club_lie(uuid,integer)','record_club_match(text,uuid,uuid)'] loop
    execute format('revoke all on function public.%s from public,anon',f);
    execute format('grant execute on function public.%s to authenticated',f);
  end loop;
end $$;

commit;

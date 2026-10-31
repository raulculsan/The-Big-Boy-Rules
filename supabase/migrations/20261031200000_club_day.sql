begin;

-- Daily club play. Tables stay closed to the Data API: votes are anonymous and
-- every coin goes through club_rewards.award_coins with a one-time receipt.
create schema if not exists club_day;
revoke all on schema club_day from public,anon,authenticated;

create table club_day.questions (
  id smallint generated always as identity primary key,
  prompt text not null unique check(length(prompt) between 8 and 140)
);
create table club_day.answers (
  day date not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  pick uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default statement_timestamp(),
  primary key(day,user_id)
);
create index answers_user_day_idx on club_day.answers(user_id,day desc);
create table club_day.predictions (
  id uuid primary key default gen_random_uuid(),
  question text not null check(length(question) between 3 and 140),
  options text[] not null check(cardinality(options) between 2 and 4),
  closes_at timestamptz not null,
  correct smallint,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default statement_timestamp(),
  resolved_at timestamptz
);
create table club_day.picks (
  prediction_id uuid not null references club_day.predictions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  pick smallint not null,
  primary key(prediction_id,user_id)
);
create table club_day.award_categories (
  id text primary key,
  title text not null,
  position smallint not null
);
create table club_day.award_votes (
  month date not null,
  category text not null references club_day.award_categories(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  nominee uuid not null references auth.users(id) on delete cascade,
  primary key(month,category,user_id)
);
alter table club_day.questions enable row level security;
alter table club_day.answers enable row level security;
alter table club_day.predictions enable row level security;
alter table club_day.picks enable row level security;
alter table club_day.award_categories enable row level security;
alter table club_day.award_votes enable row level security;

insert into club_day.award_categories(id,title,position) values
  ('mvp','MVP del mes',1),
  ('risas','El que más nos ha hecho reír',2),
  ('fantasma','El fantasma del mes',3),
  ('planes','El alma de los planes',4);

insert into club_day.questions(prompt) values
  ('¿Quién llegaría tarde a su propia boda?'),
  ('¿Quién sobreviviría más tiempo en una isla desierta?'),
  ('¿Quién se haría famoso primero?'),
  ('¿Quién perdería el móvil en una noche de fiesta?'),
  ('¿Quién acabaría discutiendo con el árbitro?'),
  ('¿Quién dice «salgo ya» y sigue en la ducha?'),
  ('¿Quién se haría millonario y lo perdería todo en un mes?'),
  ('¿Quién llora con una película de dibujos?'),
  ('¿Quién se apuntaría al gimnasio y no volvería?'),
  ('¿Quién contaría un secreto sin querer?'),
  ('¿Quién montaría un negocio absurdo que funciona?'),
  ('¿Quién se pierde aunque lleve el GPS puesto?'),
  ('¿Quién sería el primero en caer en una película de terror?'),
  ('¿Quién se queda dormido en cualquier sitio?'),
  ('¿Quién pediría lo más caro de la carta si paga otro?'),
  ('¿Quién tiene más probabilidades de salir en las noticias?'),
  ('¿Quién te defendería en una pelea sin preguntar?'),
  ('¿Quién haría trampas en el Monopoly?'),
  ('¿Quién tarda más en contestar un mensaje?'),
  ('¿Quién acabaría viviendo en otro país?'),
  ('¿Quién ganaría un concurso de talentos?'),
  ('¿Quién se olvida siempre de la cartera?'),
  ('¿Quién daría el peor discurso de boda?'),
  ('¿Quién se comería algo caducado sin mirar?'),
  ('¿Quién sería mejor presidente del Gobierno?'),
  ('¿Quién se pasaría un videojuego antes de dormir?'),
  ('¿Quién haría el ridículo bailando sin que le importe?'),
  ('¿Quién tiene la peor suerte del grupo?'),
  ('¿Quién montaría el mejor plan improvisado?'),
  ('¿Quién será el último en jubilarse?');

create function club_day.today() returns date language sql stable set search_path='' as
$$ select (statement_timestamp() at time zone 'Europe/Madrid')::date $$;

create function club_day.member_ok(person uuid) returns boolean language sql stable security definer set search_path='' as
$$ select exists(select 1 from public.profiles where id=person and not coalesce(is_hidden,false)) $$;

create function club_day.question_for(target date) returns text language sql stable security definer set search_path='' as
$$ select prompt from club_day.questions
   order by id offset (target-date '2026-01-01')%(select count(*) from club_day.questions) limit 1 $$;

-- A streak survives until the end of the next day, so it never reads as lost at breakfast.
create function club_day.streak(person uuid) returns integer language sql stable security definer set search_path='' as $$
  with days as (
    select day, day+(row_number() over(order by day desc))::integer as island
    from club_day.answers where user_id=person
  ), latest as (select island, max(day) as last_day from days group by island order by last_day desc limit 1)
  select coalesce((select count(*)::integer from days join latest using(island)
    where latest.last_day>=club_day.today()-1),0)
$$;

create function club_day.best_streak(person uuid) returns integer language sql stable security definer set search_path='' as $$
  with days as (
    select day, day+(row_number() over(order by day desc))::integer as island
    from club_day.answers where user_id=person
  ) select coalesce(max(total),0)::integer from (select count(*) as total from days group by island) runs
$$;

create function club_day.state(actor uuid) returns jsonb language sql stable security definer set search_path='' as $$
  with span as (
    select club_day.today() as today,
      date_trunc('month',club_day.today())::date as month,
      (date_trunc('month',club_day.today())-interval '1 month')::date as last_month
  ), people as (
    select id from public.profiles where not coalesce(is_hidden,false)
  )
  select jsonb_build_object(
    'today',s.today,
    'streak',club_day.streak(actor),
    'best_streak',club_day.best_streak(actor),
    'question',jsonb_build_object(
      'prompt',club_day.question_for(s.today),
      'pick',(select pick from club_day.answers where day=s.today and user_id=actor),
      'total',(select count(*) from club_day.answers where day=s.today),
      'results',case when exists(select 1 from club_day.answers where day=s.today and user_id=actor) then
        coalesce((select jsonb_agg(jsonb_build_object('id',pick,'votes',votes) order by votes desc)
          from (select pick,count(*) as votes from club_day.answers where day=s.today group by pick) r),'[]'::jsonb)
        else null end),
    'predictions',coalesce((select jsonb_agg(row_data order by sort_key) from (
      select jsonb_build_object(
        'id',p.id,'question',p.question,'options',to_jsonb(p.options),'closes_at',p.closes_at,
        'closed',p.resolved_at is not null or p.closes_at<=statement_timestamp(),
        'correct',p.correct,'resolved',p.resolved_at is not null,
        'pick',own.pick,
        'claimed',exists(select 1 from club_rewards.coin_receipts r where r.user_id=actor and r.reward_id='prediction:'||p.id),
        'counts',case when own.pick is not null or p.closes_at<=statement_timestamp() or p.resolved_at is not null then
          (select coalesce(jsonb_agg(coalesce((select count(*) from club_day.picks c where c.prediction_id=p.id and c.pick=o),0) order by o),'[]'::jsonb)
            from generate_series(0,cardinality(p.options)-1) o)
          else null end
      ) as row_data, (p.resolved_at is not null, p.closes_at) as sort_key
      from club_day.predictions p
      left join club_day.picks own on own.prediction_id=p.id and own.user_id=actor
      where p.resolved_at is null or p.resolved_at>statement_timestamp()-interval '14 days'
    ) listed),'[]'::jsonb),
    'awards',jsonb_build_object(
      'month',s.month,
      'categories',(select jsonb_agg(jsonb_build_object('id',c.id,'title',c.title,
        'vote',(select nominee from club_day.award_votes v where v.month=s.month and v.category=c.id and v.user_id=actor),
        'winners',coalesce((select jsonb_agg(top.nominee) from (
          select nominee, rank() over(order by count(*) desc) as place
          from club_day.award_votes v where v.month=s.last_month and v.category=c.id group by nominee
        ) top where top.place=1),'[]'::jsonb)) order by c.position)
        from club_day.award_categories c)),
    'ranking',(select jsonb_agg(jsonb_build_object('id',r.id,'hits',r.hits,'streak',r.streak) order by r.hits desc,r.streak desc) from (
      select m.id,
        (select count(*) from club_day.picks k join club_day.predictions p on p.id=k.prediction_id
          where k.user_id=m.id and p.correct=k.pick)::integer as hits,
        club_day.streak(m.id) as streak
      from people m) r)
  ) from span s
$$;

revoke all on all functions in schema club_day from public,anon,authenticated;

create function public.get_club_day() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  perform public.assert_account_security();
  if not club_day.member_ok(auth.uid()) then raise exception 'Inicia sesión con un perfil visible.' using errcode='42501'; end if;
  return club_day.state(auth.uid());
end $$;

create function public.answer_club_question(p_pick uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); today date:=club_day.today(); run integer; earned integer:=0;
begin
  perform public.assert_account_security();
  perform public.lock_banner_shop_actor();
  if p_pick is null or p_pick=actor or not club_day.member_ok(p_pick) then
    raise exception 'Elige a otro miembro del club.' using errcode='22023';
  end if;
  insert into club_day.answers(day,user_id,pick) values(today,actor,p_pick) on conflict do nothing;
  if found then
    earned:=club_rewards.award_coins(actor,'question:'||today,'daily',3);
    run:=club_day.streak(actor);
    if run%7=0 then earned:=earned+club_rewards.award_coins(actor,'streak:'||today,'daily',10); end if;
  end if;
  return club_day.state(actor)||jsonb_build_object('earned',earned);
end $$;

create function public.pick_club_prediction(p_id uuid,p_pick integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); target club_day.predictions;
begin
  perform public.assert_account_security();
  perform public.lock_banner_shop_actor();
  select * into target from club_day.predictions where id=p_id for share;
  if not found then raise exception 'Esta porra ya no existe.' using errcode='P0002'; end if;
  if target.resolved_at is not null or target.closes_at<=statement_timestamp() then
    raise exception 'Esta porra ya está cerrada.' using errcode='22023';
  end if;
  if p_pick is null or p_pick not between 0 and cardinality(target.options)-1 then
    raise exception 'Opción no válida.' using errcode='22023';
  end if;
  insert into club_day.picks(prediction_id,user_id,pick) values(p_id,actor,p_pick)
    on conflict(prediction_id,user_id) do update set pick=excluded.pick;
  return club_day.state(actor);
end $$;

create function public.claim_club_prediction(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); earned integer;
begin
  perform public.assert_account_security();
  perform public.lock_banner_shop_actor();
  if not exists(select 1 from club_day.predictions p join club_day.picks k on k.prediction_id=p.id
    where p.id=p_id and k.user_id=actor and p.resolved_at is not null and p.correct=k.pick) then
    raise exception 'Esta porra no tiene premio para ti.' using errcode='22023';
  end if;
  earned:=club_rewards.award_coins(actor,'prediction:'||p_id,'club',15);
  return club_day.state(actor)||jsonb_build_object('earned',earned);
end $$;

create function public.create_club_prediction(p_question text,p_options text[],p_closes_at timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); cleaned text[];
begin
  perform public.assert_account_security();
  if not public.current_user_is_club_admin() then raise exception 'Solo la administración crea porras.' using errcode='42501'; end if;
  select array_agg(btrim(o)) into cleaned from unnest(p_options) o where length(btrim(o)) between 1 and 60;
  if cardinality(cleaned) is distinct from cardinality(p_options) or cardinality(cleaned) not between 2 and 4 then
    raise exception 'Pon entre 2 y 4 opciones.' using errcode='22023';
  end if;
  if p_closes_at<=statement_timestamp() then raise exception 'El cierre tiene que ser futuro.' using errcode='22023'; end if;
  insert into club_day.predictions(question,options,closes_at,created_by) values(btrim(p_question),cleaned,p_closes_at,actor);
  return club_day.state(actor);
end $$;

create function public.resolve_club_prediction(p_id uuid,p_correct integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); target club_day.predictions;
begin
  perform public.assert_account_security();
  if not public.current_user_is_club_admin() then raise exception 'Solo la administración cierra porras.' using errcode='42501'; end if;
  select * into target from club_day.predictions where id=p_id for update;
  if not found then raise exception 'Esta porra ya no existe.' using errcode='P0002'; end if;
  if target.resolved_at is not null then raise exception 'Esta porra ya tiene resultado.' using errcode='22023'; end if;
  if p_correct is null or p_correct not between 0 and cardinality(target.options)-1 then
    raise exception 'Opción no válida.' using errcode='22023';
  end if;
  update club_day.predictions set correct=p_correct,resolved_at=statement_timestamp() where id=p_id;
  return club_day.state(actor);
end $$;

create function public.vote_club_award(p_category text,p_nominee uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); month_start date:=date_trunc('month',club_day.today())::date; earned integer:=0;
begin
  perform public.assert_account_security();
  perform public.lock_banner_shop_actor();
  if not exists(select 1 from club_day.award_categories where id=p_category) then
    raise exception 'Premio no válido.' using errcode='22023';
  end if;
  if p_nominee is null or p_nominee=actor or not club_day.member_ok(p_nominee) then
    raise exception 'Elige a otro miembro del club.' using errcode='22023';
  end if;
  insert into club_day.award_votes(month,category,user_id,nominee) values(month_start,p_category,actor,p_nominee)
    on conflict(month,category,user_id) do update set nominee=excluded.nominee;
  if (select count(*) from club_day.award_votes where month=month_start and user_id=actor)
     =(select count(*) from club_day.award_categories) then
    earned:=club_rewards.award_coins(actor,'awards:'||to_char(month_start,'YYYY-MM'),'club',10);
  end if;
  return club_day.state(actor)||jsonb_build_object('earned',earned);
end $$;

revoke all on function public.get_club_day() from public,anon;
revoke all on function public.answer_club_question(uuid) from public,anon;
revoke all on function public.pick_club_prediction(uuid,integer) from public,anon;
revoke all on function public.claim_club_prediction(uuid) from public,anon;
revoke all on function public.create_club_prediction(text,text[],timestamptz) from public,anon;
revoke all on function public.resolve_club_prediction(uuid,integer) from public,anon;
revoke all on function public.vote_club_award(text,uuid) from public,anon;
grant execute on function public.get_club_day() to authenticated;
grant execute on function public.answer_club_question(uuid) to authenticated;
grant execute on function public.pick_club_prediction(uuid,integer) to authenticated;
grant execute on function public.claim_club_prediction(uuid) to authenticated;
grant execute on function public.create_club_prediction(text,text[],timestamptz) to authenticated;
grant execute on function public.resolve_club_prediction(uuid,integer) to authenticated;
grant execute on function public.vote_club_award(text,uuid) to authenticated;

commit;

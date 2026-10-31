begin;

-- Quién es quién. Rounds roll on their own: two days to answer, two days to guess.
-- Authors stay on the server until the round ends, and only the server scores guesses.
create table club_day.whois_prompts (
  id smallint generated always as identity primary key,
  prompt text not null unique check(length(prompt) between 8 and 140)
);
create table club_day.whois_rounds (
  id uuid primary key default gen_random_uuid(),
  prompt_id smallint not null references club_day.whois_prompts(id),
  answers_until timestamptz not null,
  guesses_until timestamptz not null,
  created_at timestamptz not null default statement_timestamp()
);
create index whois_rounds_time_idx on club_day.whois_rounds(guesses_until desc);
create table club_day.whois_answers (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references club_day.whois_rounds(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check(length(body) between 1 and 140),
  unique(round_id,user_id)
);
create table club_day.whois_guesses (
  round_id uuid not null references club_day.whois_rounds(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  score smallint not null,
  total smallint not null,
  primary key(round_id,user_id)
);
alter table club_day.whois_prompts enable row level security;
alter table club_day.whois_rounds enable row level security;
alter table club_day.whois_answers enable row level security;
alter table club_day.whois_guesses enable row level security;

insert into club_day.whois_prompts(prompt) values
  ('Lo más absurdo que has hecho por vergüenza'),
  ('Tu mayor mentira piadosa'),
  ('La comida más rara que te gusta'),
  ('Qué harías si mañana te tocan 10 millones'),
  ('Tu superpoder inútil'),
  ('La peor excusa que has puesto para no ir a un plan'),
  ('Tu canción secreta que nadie sabe que te gusta'),
  ('Lo primero que salvarías de un incendio, sin contar personas'),
  ('Tu mayor miedo ridículo'),
  ('El peor trabajo que aceptarías por dinero'),
  ('Lo que nunca le contarías a tu madre'),
  ('El título de la película de tu vida'),
  ('Tu frase más repetida'),
  ('Tu manía más rara'),
  ('La mayor tontería por la que has discutido'),
  ('Qué dirían tus amigos que es tu peor defecto'),
  ('Tu plan perfecto para un domingo'),
  ('La pregunta que le harías a tu yo de dentro de 20 años'),
  ('Tu talento más inútil'),
  ('Qué famoso te invitaría a cenar y por qué'),
  ('Lo que comerías el resto de tu vida'),
  ('El mayor ridículo que has hecho en público'),
  ('A qué dedicarías tu vida si no necesitaras trabajar'),
  ('Tu nombre artístico si fueras cantante');

-- The only writer of round state. Called by every request, so no scheduled job is needed.
create function club_day.whois_round() returns club_day.whois_rounds language plpgsql security definer set search_path='' as $$
declare current_round club_day.whois_rounds; answered integer; people integer; next_prompt smallint;
begin
  perform pg_advisory_xact_lock(hashtext('club_day.whois'));
  select * into current_round from club_day.whois_rounds where guesses_until>statement_timestamp() order by created_at desc limit 1;
  if not found then
    select p.id into next_prompt from club_day.whois_prompts p
      order by (select count(*) from club_day.whois_rounds r where r.prompt_id=p.id),md5(p.id::text||statement_timestamp()::text) limit 1;
    insert into club_day.whois_rounds(prompt_id,answers_until,guesses_until)
      values(next_prompt,statement_timestamp()+interval '2 days',statement_timestamp()+interval '4 days')
      returning * into current_round;
    return current_round;
  end if;
  if current_round.answers_until>statement_timestamp() or not exists(select 1 from club_day.whois_guesses g where g.round_id=current_round.id) then
    select count(*) into answered from club_day.whois_answers where round_id=current_round.id;
    select count(*) into people from public.profiles where not coalesce(is_hidden,false);
    if current_round.answers_until>statement_timestamp() and answered>=people then
      update club_day.whois_rounds set answers_until=statement_timestamp(),guesses_until=statement_timestamp()+interval '2 days'
        where id=current_round.id returning * into current_round;
    elsif current_round.answers_until<=statement_timestamp() and answered<3 then
      update club_day.whois_rounds set answers_until=statement_timestamp()+interval '2 days',guesses_until=statement_timestamp()+interval '4 days'
        where id=current_round.id returning * into current_round;
    end if;
  end if;
  return current_round;
end $$;

create function club_day.whois_state(actor uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare current_round club_day.whois_rounds; guessing boolean; previous uuid;
begin
  current_round:=club_day.whois_round();
  guessing:=current_round.answers_until<=statement_timestamp();
  select id into previous from club_day.whois_rounds where guesses_until<=statement_timestamp()
    and (select count(*) from club_day.whois_answers a where a.round_id=whois_rounds.id)>=3
    order by guesses_until desc limit 1;
  return jsonb_build_object(
    'round',jsonb_build_object(
      'id',current_round.id,
      'prompt',(select prompt from club_day.whois_prompts where id=current_round.prompt_id),
      'phase',case when guessing then 'guess' else 'answer' end,
      'until',case when guessing then current_round.guesses_until else current_round.answers_until end,
      'answered',(select count(*) from club_day.whois_answers where round_id=current_round.id),
      'own',(select body from club_day.whois_answers where round_id=current_round.id and user_id=actor),
      'guessed',(select jsonb_build_object('score',score,'total',total) from club_day.whois_guesses where round_id=current_round.id and user_id=actor),
      'answers',case when guessing then coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'body',a.body) order by md5(a.id::text||actor::text))
        from club_day.whois_answers a where a.round_id=current_round.id and a.user_id<>actor),'[]'::jsonb) else '[]'::jsonb end,
      'authors',case when guessing then coalesce((select jsonb_agg(a.user_id order by a.user_id)
        from club_day.whois_answers a where a.round_id=current_round.id and a.user_id<>actor),'[]'::jsonb) else '[]'::jsonb end),
    'last',case when previous is null then null else jsonb_build_object(
      'prompt',(select p.prompt from club_day.whois_rounds r join club_day.whois_prompts p on p.id=r.prompt_id where r.id=previous),
      'answers',(select jsonb_agg(jsonb_build_object('body',a.body,'author',a.user_id) order by md5(a.id::text)) from club_day.whois_answers a where a.round_id=previous),
      'scores',coalesce((select jsonb_agg(jsonb_build_object('id',g.user_id,'score',g.score,'total',g.total) order by g.score desc) from club_day.whois_guesses g where g.round_id=previous),'[]'::jsonb))
    end);
end $$;

revoke all on function club_day.whois_round() from public,anon,authenticated;
revoke all on function club_day.whois_state(uuid) from public,anon,authenticated;

create function public.get_club_whois() returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform public.assert_account_security();
  if not club_day.member_ok(auth.uid()) then raise exception 'Inicia sesión con un perfil visible.' using errcode='42501'; end if;
  return club_day.whois_state(auth.uid());
end $$;

create function public.answer_club_whois(p_body text) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); cleaned text:=btrim(coalesce(p_body,'')); target club_day.whois_rounds; earned integer;
begin
  perform public.assert_account_security();
  perform public.lock_banner_shop_actor();
  target:=club_day.whois_round();
  if target.answers_until<=statement_timestamp() then raise exception 'Ya no se puede responder a esta ronda.' using errcode='22023'; end if;
  if length(cleaned) not between 1 and 140 then raise exception 'Escribe una respuesta de hasta 140 caracteres.' using errcode='22023'; end if;
  insert into club_day.whois_answers(round_id,user_id,body) values(target.id,actor,cleaned)
    on conflict(round_id,user_id) do update set body=excluded.body;
  earned:=club_rewards.award_coins(actor,'whois-answer:'||target.id,'club',3);
  return club_day.whois_state(actor)||jsonb_build_object('earned',earned);
end $$;

-- p_guesses maps answer id to author. One submission per round; every other answer must be covered.
create function public.guess_club_whois(p_guesses jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); target club_day.whois_rounds; total integer; hits integer; earned integer:=0;
begin
  perform public.assert_account_security();
  perform public.lock_banner_shop_actor();
  target:=club_day.whois_round();
  if target.answers_until>statement_timestamp() then raise exception 'La ronda aún está recogiendo respuestas.' using errcode='22023'; end if;
  if exists(select 1 from club_day.whois_guesses where round_id=target.id and user_id=actor) then
    raise exception 'Ya has jugado esta ronda.' using errcode='22023';
  end if;
  if p_guesses is null or jsonb_typeof(p_guesses)<>'object' then raise exception 'Respuesta no válida.' using errcode='22023'; end if;
  select count(*),count(*) filter (where p_guesses->>a.id::text=a.user_id::text),
    count(*) filter (where p_guesses ? a.id::text) into total,hits,earned
    from club_day.whois_answers a where a.round_id=target.id and a.user_id<>actor;
  if total=0 or earned<>total then raise exception 'Asigna un autor a cada respuesta.' using errcode='22023'; end if;
  earned:=0;
  insert into club_day.whois_guesses(round_id,user_id,score,total) values(target.id,actor,hits,total);
  if hits>0 then earned:=club_rewards.award_coins(actor,'whois-guess:'||target.id,'club',least(hits*2,10)); end if;
  return club_day.whois_state(actor)||jsonb_build_object('earned',earned);
end $$;

revoke all on function public.get_club_whois() from public,anon;
revoke all on function public.answer_club_whois(text) from public,anon;
revoke all on function public.guess_club_whois(jsonb) from public,anon;
grant execute on function public.get_club_whois() to authenticated;
grant execute on function public.answer_club_whois(text) to authenticated;
grant execute on function public.guess_club_whois(jsonb) to authenticated;

commit;

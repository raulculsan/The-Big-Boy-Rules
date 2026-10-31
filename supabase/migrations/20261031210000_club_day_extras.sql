begin;

-- Card duels, the card of the week, time capsules and the personal year summary.
-- Scores and ownership are read here, never taken from the client. Cards are not at stake.
create table club_day.duels (
  id uuid primary key default gen_random_uuid(),
  challenger uuid not null references auth.users(id) on delete cascade,
  rival uuid not null references auth.users(id) on delete cascade,
  challenger_card text not null,
  rival_card text,
  winner uuid references auth.users(id) on delete cascade,
  claimed boolean not null default false,
  created_at timestamptz not null default statement_timestamp(),
  expires_at timestamptz not null default statement_timestamp()+interval '3 days',
  resolved_at timestamptz,
  check(challenger<>rival)
);
create index duels_rival_idx on club_day.duels(rival,created_at desc);
create index duels_challenger_idx on club_day.duels(challenger,created_at desc);
create table club_day.capsules (
  id uuid primary key default gen_random_uuid(),
  author uuid not null references auth.users(id) on delete cascade,
  body text not null check(length(body) between 1 and 500),
  opens_on date not null,
  created_at timestamptz not null default statement_timestamp()
);
create index capsules_opens_idx on club_day.capsules(opens_on desc);
alter table club_day.duels enable row level security;
alter table club_day.capsules enable row level security;

create function club_day.card_score(person uuid,card text) returns integer language sql stable security definer set search_path='' as $$
  select d.score from public.member_card_inventory i
  join public.published_card_designs d on d.id=i.card_id
  where i.user_id=person and i.card_id=card and i.quantity>0 and d.published
$$;

create function club_day.card_json(card text) returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id',id,'name',display_name,'score',score,'thumb',thumbnail_url)
  from public.published_card_designs where id=card
$$;

create function club_day.week_card() returns text language sql stable security definer set search_path='' as $$
  select id from public.published_card_designs where published and thumbnail_url is not null
  order by md5(id||date_trunc('week',club_day.today())::date::text) limit 1
$$;

create function club_day.extras(actor uuid) returns jsonb language sql stable security definer set search_path='' as $$
  with span as (
    select club_day.today() as today, date_trunc('year',club_day.today())::date as year_start,
      date_trunc('week',club_day.today())::date as week_start
  ), week as (select club_day.week_card() as card)
  select jsonb_build_object(
    'cards',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'name',d.display_name,'score',d.score,'thumb',d.thumbnail_url) order by d.score desc,d.id)
      from public.member_card_inventory i join public.published_card_designs d on d.id=i.card_id
      where i.user_id=actor and i.quantity>0 and d.published and d.score is not null),'[]'::jsonb),
    'duels',coalesce((select jsonb_agg(jsonb_build_object(
        'id',x.id,'incoming',x.rival=actor and x.resolved_at is null,
        'waiting',x.challenger=actor and x.resolved_at is null,
        'opponent',case when x.challenger=actor then x.rival else x.challenger end,
        'expires_at',x.expires_at,'resolved',x.resolved_at is not null,'winner',x.winner,'claimed',x.claimed,
        'mine',case when x.resolved_at is null and x.rival=actor then null
          else club_day.card_json(case when x.challenger=actor then x.challenger_card else x.rival_card end) end,
        'theirs',case when x.resolved_at is null then null
          else club_day.card_json(case when x.challenger=actor then x.rival_card else x.challenger_card end) end
      ) order by x.resolved_at is not null,x.created_at desc)
      from club_day.duels x where actor in(x.challenger,x.rival)
        and ((x.resolved_at is null and x.expires_at>statement_timestamp())
          or x.resolved_at>statement_timestamp()-interval '7 days')),'[]'::jsonb),
    'week_card',(select club_day.card_json(w.card)||jsonb_build_object(
      'owned',exists(select 1 from public.member_card_inventory i where i.user_id=actor and i.card_id=w.card and i.quantity>0),
      'owners',(select count(*) from public.member_card_inventory i where i.card_id=w.card and i.quantity>0),
      'claimed',exists(select 1 from club_rewards.coin_receipts r where r.user_id=actor and r.reward_id='weekcard:'||s.week_start))),
    'capsules',jsonb_build_object(
      'opened',coalesce((select jsonb_agg(jsonb_build_object('author',c.author,'body',c.body,'opens_on',c.opens_on,'created_at',c.created_at) order by c.opens_on desc)
        from (select * from club_day.capsules where opens_on<=s.today order by opens_on desc limit 10) c),'[]'::jsonb),
      'sealed',(select count(*) from club_day.capsules where opens_on>s.today),
      'mine',coalesce((select jsonb_agg(opens_on order by opens_on) from club_day.capsules where author=actor and opens_on>s.today),'[]'::jsonb)),
    'year',jsonb_build_object(
      'year',extract(year from s.today)::integer,
      'answers',(select count(*) from club_day.answers where user_id=actor and day>=s.year_start),
      'best_streak',club_day.best_streak(actor),
      'hits',(select count(*) from club_day.picks k join club_day.predictions p on p.id=k.prediction_id
        where k.user_id=actor and p.correct=k.pick and p.resolved_at>=s.year_start),
      'duels_won',(select count(*) from club_day.duels where winner=actor and resolved_at>=s.year_start),
      'awards_won',(select count(*) from (
        select month,category,nominee,rank() over(partition by month,category order by count(*) desc) as place
        from club_day.award_votes where month>=s.year_start and month<date_trunc('month',s.today)::date group by month,category,nominee
      ) t where t.place=1 and t.nominee=actor),
      'coins',(select coalesce(sum(delta),0) from public.member_coin_ledger where user_id=actor and delta>0 and created_at>=s.year_start),
      'cards',(select count(*) from public.member_card_acquisitions where user_id=actor and first_acquired_at>=s.year_start),
      'packs',(select count(*) from public.card_packs where user_id=actor and opened_at>=s.year_start))
  ) from span s, week w
$$;

revoke all on all functions in schema club_day from public,anon,authenticated;

create function public.get_club_extras() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  perform public.assert_account_security();
  if not club_day.member_ok(auth.uid()) then raise exception 'Inicia sesión con un perfil visible.' using errcode='42501'; end if;
  return club_day.extras(auth.uid());
end $$;

create function public.create_club_duel(p_rival uuid,p_card text) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
  perform public.assert_account_security();
  perform public.lock_banner_shop_actor();
  if p_rival is null or p_rival=actor or not club_day.member_ok(p_rival) then
    raise exception 'Elige a otro miembro del club.' using errcode='22023';
  end if;
  if club_day.card_score(actor,p_card) is null then raise exception 'Esa carta no puede jugar un duelo.' using errcode='22023'; end if;
  if exists(select 1 from club_day.duels where resolved_at is null and expires_at>statement_timestamp()
    and ((challenger=actor and rival=p_rival) or (challenger=p_rival and rival=actor))) then
    raise exception 'Ya tenéis un duelo abierto.' using errcode='22023';
  end if;
  if (select count(*) from club_day.duels where challenger=actor and created_at>statement_timestamp()-interval '1 day')>=3 then
    raise exception 'Hoy ya has lanzado 3 duelos.' using errcode='22023';
  end if;
  insert into club_day.duels(challenger,rival,challenger_card) values(actor,p_rival,p_card);
  return club_day.extras(actor);
end $$;

create function public.answer_club_duel(p_id uuid,p_card text) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); target club_day.duels; own_score integer; other_score integer;
begin
  perform public.assert_account_security();
  perform public.lock_banner_shop_actor();
  select * into target from club_day.duels where id=p_id for update;
  if not found or target.rival<>actor or target.resolved_at is not null or target.expires_at<=statement_timestamp() then
    raise exception 'Este duelo ya no está disponible.' using errcode='22023';
  end if;
  own_score:=club_day.card_score(actor,p_card);
  if own_score is null then raise exception 'Esa carta no puede jugar un duelo.' using errcode='22023'; end if;
  select score into other_score from public.published_card_designs where id=target.challenger_card;
  update club_day.duels set rival_card=p_card,resolved_at=statement_timestamp(),
    winner=case when own_score>other_score then actor when own_score<other_score then target.challenger end
    where id=p_id;
  return club_day.extras(actor);
end $$;

-- One paid win a day, so two friends cannot farm coins by trading duels.
create function public.claim_club_duel(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); earned integer;
begin
  perform public.assert_account_security();
  perform public.lock_banner_shop_actor();
  update club_day.duels set claimed=true where id=p_id and winner=actor and not claimed;
  if not found then raise exception 'Este duelo no tiene premio para ti.' using errcode='22023'; end if;
  earned:=club_rewards.award_coins(actor,'duel:'||club_day.today(),'club',10);
  return club_day.extras(actor)||jsonb_build_object('earned',earned);
end $$;

create function public.claim_club_week_card() returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); card text:=club_day.week_card(); earned integer;
begin
  perform public.assert_account_security();
  perform public.lock_banner_shop_actor();
  if not exists(select 1 from public.member_card_inventory where user_id=actor and card_id=card and quantity>0) then
    raise exception 'Todavía no tienes esta carta.' using errcode='22023';
  end if;
  earned:=club_rewards.award_coins(actor,'weekcard:'||date_trunc('week',club_day.today())::date,'club',10);
  return club_day.extras(actor)||jsonb_build_object('earned',earned);
end $$;

create function public.create_club_capsule(p_body text,p_opens_on date) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); today date:=club_day.today(); cleaned text:=btrim(coalesce(p_body,''));
begin
  perform public.assert_account_security();
  perform public.lock_banner_shop_actor();
  if length(cleaned) not between 1 and 500 then raise exception 'Escribe un mensaje de hasta 500 caracteres.' using errcode='22023'; end if;
  if p_opens_on is null or p_opens_on<today+7 or p_opens_on>today+1825 then
    raise exception 'Elige una fecha entre 7 días y 5 años.' using errcode='22023';
  end if;
  if (select count(*) from club_day.capsules where author=actor and opens_on>today)>=3 then
    raise exception 'Ya tienes 3 cápsulas selladas.' using errcode='22023';
  end if;
  insert into club_day.capsules(author,body,opens_on) values(actor,cleaned,p_opens_on);
  return club_day.extras(actor);
end $$;

revoke all on function public.get_club_extras() from public,anon;
revoke all on function public.create_club_duel(uuid,text) from public,anon;
revoke all on function public.answer_club_duel(uuid,text) from public,anon;
revoke all on function public.claim_club_duel(uuid) from public,anon;
revoke all on function public.claim_club_week_card() from public,anon;
revoke all on function public.create_club_capsule(text,date) from public,anon;
grant execute on function public.get_club_extras() to authenticated;
grant execute on function public.create_club_duel(uuid,text) to authenticated;
grant execute on function public.answer_club_duel(uuid,text) to authenticated;
grant execute on function public.claim_club_duel(uuid) to authenticated;
grant execute on function public.claim_club_week_card() to authenticated;
grant execute on function public.create_club_capsule(text,date) to authenticated;

commit;

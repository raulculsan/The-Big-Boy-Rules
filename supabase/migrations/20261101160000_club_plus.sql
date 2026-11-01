begin;

-- Everyday club tools. Tables are closed; every read and write goes through checked functions.
create schema if not exists club_plus;
revoke all on schema club_plus from public,anon,authenticated;

create table club_plus.statuses (
  user_id uuid primary key references auth.users(id) on delete cascade,
  body text not null check(length(body) between 1 and 60),
  expires_at timestamptz not null
);
create table club_plus.date_polls (
  id uuid primary key default gen_random_uuid(),
  title text not null check(length(title) between 3 and 80),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default statement_timestamp(),
  chosen date
);
create table club_plus.date_votes (
  poll_id uuid not null references club_plus.date_polls(id) on delete cascade,
  day date not null,
  user_id uuid references auth.users(id) on delete cascade,
  unique nulls not distinct (poll_id,day,user_id)
);
create table club_plus.tabs (
  id uuid primary key default gen_random_uuid(),
  title text not null check(length(title) between 3 and 80),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default statement_timestamp(),
  settled_at timestamptz
);
create table club_plus.expenses (
  id uuid primary key default gen_random_uuid(),
  tab_id uuid not null references club_plus.tabs(id) on delete cascade,
  payer uuid not null references auth.users(id) on delete cascade,
  concept text not null check(length(concept) between 1 and 60),
  cents integer not null check(cents between 1 and 10000000),
  shared_with uuid[] not null check(cardinality(shared_with) between 1 and 50),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default statement_timestamp()
);
create table club_plus.songs (
  id uuid primary key default gen_random_uuid(),
  week date not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check(length(title) between 2 and 100),
  url text check(url ~ '^https://(open\.spotify\.com|music\.youtube\.com|www\.youtube\.com|youtu\.be|music\.apple\.com)/'),
  unique(week,user_id)
);
create table club_plus.song_votes (
  week date not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  song_id uuid not null references club_plus.songs(id) on delete cascade,
  primary key(week,user_id)
);
alter table club_plus.statuses enable row level security;
alter table club_plus.date_polls enable row level security;
alter table club_plus.date_votes enable row level security;
alter table club_plus.tabs enable row level security;
alter table club_plus.expenses enable row level security;
alter table club_plus.songs enable row level security;
alter table club_plus.song_votes enable row level security;

create function club_plus.today() returns date language sql stable set search_path='' as
$$ select (statement_timestamp() at time zone 'Europe/Madrid')::date $$;
create function club_plus.week() returns date language sql stable set search_path='' as
$$ select date_trunc('week',club_plus.today())::date $$;

create function club_plus.guard() returns uuid language plpgsql stable security definer set search_path='' as $$
begin
  perform public.assert_account_security();
  if not exists(select 1 from public.profiles where id=auth.uid() and not coalesce(is_hidden,false)) then
    raise exception 'Inicia sesión con un perfil visible.' using errcode='42501';
  end if;
  return auth.uid();
end $$;

-- Who owes what on a tab. Each expense is split evenly; the payer absorbs rounding cents.
create function club_plus.balances(tab uuid) returns jsonb language sql stable security definer set search_path='' as $$
  with shares as (
    select e.payer as who, e.cents::bigint as delta from club_plus.expenses e where e.tab_id=tab
    union all
    select person, -(e.cents/cardinality(e.shared_with))::bigint from club_plus.expenses e, unnest(e.shared_with) person where e.tab_id=tab
    union all
    select e.payer, -(e.cents%cardinality(e.shared_with))::bigint from club_plus.expenses e where e.tab_id=tab
  )
  select coalesce(jsonb_agg(jsonb_build_object('id',who,'cents',total) order by total desc),'[]'::jsonb)
  from (select who,sum(delta) as total from shares group by who having sum(delta)<>0) t
$$;

-- The same memory all day for everyone: an older club message or a past plan.
create function club_plus.memory() returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'message',(select jsonb_build_object('author',m.user_id,'body',left(m.body,280),'at',m.created_at) from public.messages m
      where length(btrim(coalesce(m.body,'')))>=15 and m.created_at<statement_timestamp()-interval '7 days'
      order by md5(m.id::text||club_plus.today()::text) limit 1),
    'plan',(select jsonb_build_object('title',e.title,'at',e.starts_at) from public.group_events e
      where e.event_type<>'birthday' and e.starts_at<statement_timestamp()
      order by md5(e.id::text||club_plus.today()::text) limit 1))
$$;

create function club_plus.state(actor uuid) returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'memory',club_plus.memory(),
    'statuses',coalesce((select jsonb_object_agg(user_id,body) from club_plus.statuses where expires_at>statement_timestamp()),'{}'::jsonb),
    'polls',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'title',p.title,'chosen',p.chosen,'own',p.created_by=actor,
        'days',(select jsonb_agg(jsonb_build_object('day',d.day,
            'votes',(select count(*) from club_plus.date_votes v where v.poll_id=p.id and v.day=d.day and v.user_id is not null),
            'mine',exists(select 1 from club_plus.date_votes v where v.poll_id=p.id and v.day=d.day and v.user_id=actor)) order by d.day)
          from club_plus.date_votes d where d.poll_id=p.id and d.user_id is null)) order by p.created_at desc)
      from club_plus.date_polls p where p.created_at>statement_timestamp()-interval '45 days'),'[]'::jsonb),
    'tabs',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'title',t.title,'settled',t.settled_at is not null,'own',t.created_by=actor,
        'balances',club_plus.balances(t.id),
        'expenses',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'concept',e.concept,'cents',e.cents,'payer',e.payer,'people',cardinality(e.shared_with)) order by e.created_at desc) from club_plus.expenses e where e.tab_id=t.id),'[]'::jsonb))
        order by t.settled_at is not null,t.created_at desc)
      from club_plus.tabs t where t.settled_at is null or t.settled_at>statement_timestamp()-interval '30 days'),'[]'::jsonb),
    'songs',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'url',s.url,'user',s.user_id,
        'votes',(select count(*) from club_plus.song_votes v where v.song_id=s.id),
        'mine',exists(select 1 from club_plus.song_votes v where v.song_id=s.id and v.user_id=actor)) order by s.title)
      from club_plus.songs s where s.week=club_plus.week()),'[]'::jsonb),
    'last_winner',(select jsonb_build_object('title',s.title,'user',s.user_id) from club_plus.songs s
      where s.week=club_plus.week()-7 order by (select count(*) from club_plus.song_votes v where v.song_id=s.id) desc,s.title limit 1),
    'own_song',exists(select 1 from club_plus.songs where week=club_plus.week() and user_id=actor))
$$;
revoke all on all functions in schema club_plus from public,anon,authenticated;

create function public.get_club_plus() returns jsonb language plpgsql stable security definer set search_path='' as
$$ begin return club_plus.state(club_plus.guard()); end $$;

create function public.set_club_status(p_body text) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=club_plus.guard(); cleaned text:=btrim(coalesce(p_body,''));
begin
  if cleaned='' then delete from club_plus.statuses where user_id=actor;
  elsif length(cleaned)>60 then raise exception 'El estado admite 60 caracteres.' using errcode='22023';
  else insert into club_plus.statuses values(actor,cleaned,statement_timestamp()+interval '24 hours')
    on conflict(user_id) do update set body=excluded.body,expires_at=excluded.expires_at; end if;
  return club_plus.state(actor);
end $$;

create function public.create_date_poll(p_title text,p_days date[]) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=club_plus.guard(); poll uuid; days date[];
begin
  select array_agg(distinct d) into days from unnest(p_days) d where d>=club_plus.today();
  if coalesce(cardinality(days),0) not between 2 and 8 then raise exception 'Propón entre 2 y 8 fechas futuras.' using errcode='22023'; end if;
  insert into club_plus.date_polls(title,created_by) values(btrim(p_title),actor) returning id into poll;
  insert into club_plus.date_votes(poll_id,day) select poll,d from unnest(days) d;
  return club_plus.state(actor);
end $$;

create function public.toggle_date_vote(p_poll uuid,p_day date) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=club_plus.guard();
begin
  if not exists(select 1 from club_plus.date_votes where poll_id=p_poll and day=p_day and user_id is null) then raise exception 'Esa fecha no está en la votación.' using errcode='22023'; end if;
  if exists(select 1 from club_plus.date_polls where id=p_poll and chosen is not null) then raise exception 'La fecha ya está elegida.' using errcode='22023'; end if;
  delete from club_plus.date_votes where poll_id=p_poll and day=p_day and user_id=actor;
  if not found then insert into club_plus.date_votes values(p_poll,p_day,actor); end if;
  return club_plus.state(actor);
end $$;

create function public.choose_poll_date(p_poll uuid,p_day date) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=club_plus.guard();
begin
  if not exists(select 1 from club_plus.date_polls where id=p_poll and (created_by=actor or public.current_user_is_club_admin())) then raise exception 'Solo quien la creó elige la fecha.' using errcode='42501'; end if;
  if not exists(select 1 from club_plus.date_votes where poll_id=p_poll and day=p_day and user_id is null) then raise exception 'Esa fecha no está en la votación.' using errcode='22023'; end if;
  update club_plus.date_polls set chosen=p_day where id=p_poll;
  return club_plus.state(actor);
end $$;

create function public.create_club_tab(p_title text) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=club_plus.guard();
begin
  insert into club_plus.tabs(title,created_by) values(btrim(p_title),actor);
  return club_plus.state(actor);
end $$;

create function public.add_tab_expense(p_tab uuid,p_payer uuid,p_concept text,p_cents integer,p_people uuid[]) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=club_plus.guard(); people uuid[];
begin
  if not exists(select 1 from club_plus.tabs where id=p_tab and settled_at is null) then raise exception 'Este bote ya está cerrado.' using errcode='22023'; end if;
  select array_agg(distinct p) into people from unnest(p_people) p;
  if coalesce(cardinality(people),0)<1 or exists(select 1 from unnest(people||p_payer) p where not exists(select 1 from public.profiles x where x.id=p and not coalesce(x.is_hidden,false))) then
    raise exception 'Elige miembros del club.' using errcode='22023';
  end if;
  insert into club_plus.expenses(tab_id,payer,concept,cents,shared_with,created_by) values(p_tab,p_payer,btrim(p_concept),p_cents,people,actor);
  return club_plus.state(actor);
end $$;

create function public.settle_club_tab(p_tab uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=club_plus.guard();
begin
  update club_plus.tabs set settled_at=statement_timestamp() where id=p_tab and settled_at is null and (created_by=actor or public.current_user_is_club_admin());
  if not found then raise exception 'Solo quien lo creó puede cerrarlo.' using errcode='42501'; end if;
  return club_plus.state(actor);
end $$;

create function public.add_club_song(p_title text,p_url text) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=club_plus.guard();
begin
  insert into club_plus.songs(week,user_id,title,url) values(club_plus.week(),actor,btrim(p_title),nullif(btrim(coalesce(p_url,'')),''))
    on conflict(week,user_id) do update set title=excluded.title,url=excluded.url;
  return club_plus.state(actor);
end $$;

create function public.vote_club_song(p_song uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=club_plus.guard();
begin
  if not exists(select 1 from club_plus.songs where id=p_song and week=club_plus.week() and user_id<>actor) then raise exception 'Vota otra canción de esta semana.' using errcode='22023'; end if;
  insert into club_plus.song_votes values(club_plus.week(),actor,p_song) on conflict(week,user_id) do update set song_id=excluded.song_id;
  return club_plus.state(actor);
end $$;

do $$ declare f text; begin
  foreach f in array array['get_club_plus()','set_club_status(text)','create_date_poll(text,date[])','toggle_date_vote(uuid,date)','choose_poll_date(uuid,date)','create_club_tab(text)','add_tab_expense(uuid,uuid,text,integer,uuid[])','settle_club_tab(uuid)','add_club_song(text,text)','vote_club_song(uuid)'] loop
    execute format('revoke all on function public.%s from public,anon',f);
    execute format('grant execute on function public.%s to authenticated',f);
  end loop;
end $$;

commit;

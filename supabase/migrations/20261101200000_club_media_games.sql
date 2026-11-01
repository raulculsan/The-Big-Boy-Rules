begin;

-- Photo of the day and audio karaoke. Files live in the member's own group-media folder;
-- these tables only accept links to that folder, so nobody can post someone else's file.
create table club_plus.day_photos (
  day date not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null check(length(url) between 20 and 600),
  late boolean not null,
  primary key(day,user_id)
);
create table club_plus.karaoke_songs (
  id smallint generated always as identity primary key,
  prompt text not null unique
);
create table club_plus.karaoke_entries (
  week date not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null check(length(url) between 20 and 600),
  primary key(week,user_id)
);
create table club_plus.karaoke_votes (
  week date not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  author uuid not null references auth.users(id) on delete cascade,
  primary key(week,user_id)
);
alter table club_plus.day_photos enable row level security;
alter table club_plus.karaoke_songs enable row level security;
alter table club_plus.karaoke_entries enable row level security;
alter table club_plus.karaoke_votes enable row level security;

insert into club_plus.karaoke_songs(prompt) values
  ('Un estribillo de Estopa'),('El himno de tu equipo'),('Una canción de Disney'),('Un clásico de reguetón'),
  ('Una balada de los 80'),('Lo primero que oigas en la radio'),('Una canción en inglés sin saberte la letra'),
  ('Cumpleaños feliz, muy serio'),('Una de Rosalía'),('El anuncio más pegadizo que recuerdes');

-- A different moment each day between 10:00 and 21:00 Madrid, the same for everyone.
create function club_plus.photo_time(target date) returns timestamptz language sql immutable set search_path='' as $$
  select ((target::timestamp+interval '10 hours'+((('x'||substr(md5(target::text),1,6))::bit(24)::integer%660)*interval '1 minute')) at time zone 'Europe/Madrid')
$$;

create function club_plus.valid_file(url text,actor uuid) returns boolean language sql immutable set search_path='' as
$$ select url like '%/storage/v1/object/public/group-media/'||actor::text||'/%' and url like 'https://%' and url !~ '[<>"'' ]' $$;

create function club_plus.media(actor uuid) returns jsonb language sql stable security definer set search_path='' as $$
  with d as (select club_plus.today() as day,club_plus.photo_time(club_plus.today()) as opens)
  select jsonb_build_object(
    'photo',jsonb_build_object('opens_at',case when d.opens<=statement_timestamp() then d.opens end,
      'on_time',statement_timestamp() between d.opens and d.opens+interval '10 minutes',
      'own',exists(select 1 from club_plus.day_photos p where p.day=d.day and p.user_id=actor),
      'count',(select count(*) from club_plus.day_photos p where p.day=d.day),
      'photos',case when exists(select 1 from club_plus.day_photos p where p.day=d.day and p.user_id=actor) then
        coalesce((select jsonb_agg(jsonb_build_object('user',p.user_id,'url',p.url,'late',p.late) order by p.late,p.user_id) from club_plus.day_photos p where p.day=d.day),'[]'::jsonb) else '[]'::jsonb end),
    'karaoke',jsonb_build_object(
      'prompt',(select prompt from club_plus.karaoke_songs order by id offset ((club_plus.week()-date '2026-01-05')/7)%(select count(*) from club_plus.karaoke_songs) limit 1),
      'vote',(select author from club_plus.karaoke_votes v where v.week=club_plus.week() and v.user_id=actor),
      'entries',coalesce((select jsonb_agg(jsonb_build_object('user',e.user_id,'url',e.url,
          'votes',(select count(*) from club_plus.karaoke_votes v where v.week=e.week and v.author=e.user_id)) order by e.user_id)
        from club_plus.karaoke_entries e where e.week=club_plus.week()),'[]'::jsonb))
  ) from d
$$;
revoke all on function club_plus.photo_time(date),club_plus.valid_file(text,uuid),club_plus.media(uuid) from public,anon,authenticated;

create or replace function public.get_club_plus() returns jsonb language plpgsql stable security definer set search_path='' as
$$ declare actor uuid:=club_plus.guard(); begin return club_plus.state(actor)||club_plus.games(actor)||club_plus.media(actor); end $$;

create function public.post_day_photo(p_url text) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=club_plus.guard(); today date:=club_plus.today(); opens timestamptz:=club_plus.photo_time(club_plus.today());
begin
  if statement_timestamp()<opens then raise exception 'Todavía no es la hora de la foto.' using errcode='22023'; end if;
  if not club_plus.valid_file(p_url,actor) then raise exception 'Archivo no válido.' using errcode='22023'; end if;
  insert into club_plus.day_photos values(today,actor,p_url,statement_timestamp()>opens+interval '10 minutes') on conflict do nothing;
  return club_plus.media(actor);
end $$;

create function public.post_karaoke(p_url text) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=club_plus.guard();
begin
  if not club_plus.valid_file(p_url,actor) then raise exception 'Archivo no válido.' using errcode='22023'; end if;
  insert into club_plus.karaoke_entries values(club_plus.week(),actor,p_url) on conflict(week,user_id) do update set url=excluded.url;
  return club_plus.media(actor);
end $$;

create function public.vote_karaoke(p_author uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=club_plus.guard();
begin
  if p_author=actor or not exists(select 1 from club_plus.karaoke_entries where week=club_plus.week() and user_id=p_author) then raise exception 'Vota a otra persona.' using errcode='22023'; end if;
  insert into club_plus.karaoke_votes values(club_plus.week(),actor,p_author) on conflict(week,user_id) do update set author=excluded.author;
  return club_plus.media(actor);
end $$;

do $$ declare f text; begin
  foreach f in array array['post_day_photo(text)','post_karaoke(text)','vote_karaoke(uuid)'] loop
    execute format('revoke all on function public.%s from public,anon',f);
    execute format('grant execute on function public.%s to authenticated',f);
  end loop;
end $$;

commit;

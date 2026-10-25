begin;

-- Shared, permanent decoration milestones. Clients cannot manufacture unlocks.
create table public.club_room_unlocks (
  milestone text primary key check (milestone in ('first_plan','memory_wall','places_souvenir','club_trophy')),
  unlocked_at timestamptz not null default now()
);
alter table public.club_room_unlocks enable row level security;
revoke all on public.club_room_unlocks from public, anon, authenticated;
grant select on public.club_room_unlocks to authenticated;
create policy club_room_unlocks_read on public.club_room_unlocks for select to authenticated
using ((select public.account_security_satisfied()) and exists (
  select 1 from public.profiles where id=(select auth.uid()) and not is_hidden
));

-- No supplied user IDs, counters, coordinates or milestone names. Evidence comes
-- from the club's existing records; only finished, valid occurrences are included.
create function public.get_club_room_passport() returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  visited jsonb;
  plan_count integer;
  memory_count integer;
  place_count integer;
  visit_count integer;
begin
  perform public.assert_account_security();
  if auth.uid() is null or not exists (
    select 1 from public.profiles where id=auth.uid() and not is_hidden
  ) then raise exception 'Inicia sesión en el club.' using errcode='42501'; end if;

  with evidence as (
    select a.event_id,a.occurrence,a.user_id from public.club_event_arrivals a
      join public.profiles p on p.id=a.user_id and not p.is_hidden
    union
    select m.event_id,m.occurrence,m.created_by from public.club_event_memories m
      join public.profiles p on p.id=m.created_by and not p.is_hidden
  ), occurrences as (
    select e.id as event_id,e.title,e.location,e.description,x.occurrence,
      array_agg(distinct x.user_id) as contributors,
      case when e.annual then
        (x.occurrence + (e.starts_at at time zone 'Europe/Madrid')::time) at time zone 'Europe/Madrid'
      else e.starts_at end as started_at,
      coalesce(e.ends_at-e.starts_at,case when e.event_type='birthday' then interval '1 day' else interval '4 hours' end) as duration
    from evidence x join public.group_events e on e.id=x.event_id
    where (not e.annual and x.occurrence=(e.starts_at at time zone 'Europe/Madrid')::date)
       or (e.annual and to_char(x.occurrence,'MM-DD')=to_char(e.starts_at at time zone 'Europe/Madrid','MM-DD'))
    group by e.id,x.occurrence
  ), completed as (
    select o.*,coalesce((select array_agg(a.user_id order by a.arrived_at)
      from public.club_event_arrivals a join public.profiles p on p.id=a.user_id and not p.is_hidden
      where a.event_id=o.event_id and a.occurrence=o.occurrence),'{}'::uuid[]) as attendees
    from occurrences o where started_at+duration<=now()
  ), visits as (
    select c.*,p.label,p.latitude,p.longitude,
      lower(regexp_replace(trim(p.label),'\s+',' ','g'))||':'||round(p.latitude::numeric,3)||','||round(p.longitude::numeric,3) as place_key,
      (select count(*) from public.club_event_memories m join public.profiles u on u.id=m.created_by and not u.is_hidden
        where m.event_id=c.event_id and m.occurrence=c.occurrence) as memories,
      (select jsonb_build_object('media_path',m.media_path,'media_type',coalesce(m.media_type,mom.media_type),
          'legacy_url',mom.media_url,'caption',coalesce(nullif(m.caption,''),mom.caption,''))
       from public.club_event_memories m join public.profiles u on u.id=m.created_by and not u.is_hidden
       left join public.moments mom on mom.id=m.moment_id
       where m.event_id=c.event_id and m.occurrence=c.occurrence
         and coalesce(m.media_type,mom.media_type)='image'
       order by m.featured desc,m.created_at desc limit 1) as photo
    from completed c left join public.club_event_places p on p.event_id=c.event_id
  )
  select
    (select count(*) from completed where cardinality(attendees)>=2),
    coalesce((select sum(memories) from visits),0),
    (select count(distinct place_key) from visits where place_key is not null),
    (select count(*) from visits where place_key is not null),
    coalesce((select jsonb_agg(to_jsonb(v) - 'duration' order by v.started_at desc)
      from (select * from visits where place_key is not null order by started_at desc limit 150) v),'[]'::jsonb)
  into plan_count,memory_count,place_count,visit_count,visited;

  insert into public.club_room_unlocks(milestone)
    select milestone from (values
      ('first_plan',plan_count>=1),
      ('memory_wall',memory_count>=5),
      ('places_souvenir',place_count>=3),
      ('club_trophy',plan_count>=10)
    ) as achievements(milestone,earned) where earned
    on conflict (milestone) do nothing;

  return jsonb_build_object('plans',plan_count,'memories',memory_count,'places',place_count,'visit_count',visit_count,
    'visits',visited,'unlocks',coalesce((select jsonb_agg(to_jsonb(u) order by unlocked_at,milestone) from public.club_room_unlocks u),'[]'::jsonb));
end $$;
revoke all on function public.get_club_room_passport() from public, anon, authenticated;
grant execute on function public.get_club_room_passport() to authenticated;

comment on function public.get_club_room_passport() is 'Private club passport and server-derived permanent room milestones. Requires an approved account satisfying account security.';
commit;

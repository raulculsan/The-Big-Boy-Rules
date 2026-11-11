-- Choice packs were every streak bonus pack (1-5 a day), so some members picked
-- a card almost every time. Now they are a weekly treat: on days 7, 14, 21... of
-- the streak, the first streak pack of the day is a choice pack; the rest open
-- normally. Unopened surplus choice packs become normal packs (each member keeps
-- their oldest one, and any pack whose choice is already pending stays as is).
begin;
create or replace function public.card_pack_streak_choice()
returns trigger language plpgsql set search_path = '' as $$
declare streak integer;
begin
  if new.source = 'daily_streak' and new.variant = 'standard' then
    streak := coalesce(public.daily_pack_streak(new.user_id, new.earned_day), 0);
    if streak > 0 and streak % 7 = 0 and not exists (
      select 1 from public.card_packs p where p.user_id = new.user_id and p.earned_day = new.earned_day and p.variant = 'choice') then
      new.variant := 'choice';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.card_pack_streak_choice() from public, anon, authenticated;

update public.card_packs p set variant = 'standard'
where p.variant = 'choice' and p.opened_at is null
  and not exists (select 1 from public.member_pack_choices c where c.pack_id = p.id)
  and p.id <> (select min(q.id) from public.card_packs q where q.user_id = p.user_id and q.variant = 'choice' and q.opened_at is null);
commit;

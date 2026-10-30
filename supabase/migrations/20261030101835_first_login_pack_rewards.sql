begin;

-- This receipt belongs to the account, not to a device or a replaceable profile.
-- It is intentionally unavailable to the Data API and client roles.
create schema if not exists club_rewards;
revoke all on schema club_rewards from public,anon,authenticated;
-- Existing sign-ins are consumed without awarding a retroactive welcome.
-- Daily history also protects accounts imported with an empty Auth timestamp.
-- Zero is permanent: reinstalling, resetting a profile or removing packs cannot
-- turn an old account back into a first login.
-- Snapshot only when introducing the receipt table. Reapplying this migration
-- must not reclassify a new account that signed in but has not claimed yet.
do $$ begin
  if to_regclass('club_rewards.first_login_pack_rewards') is null then
    create table club_rewards.first_login_pack_rewards (
      user_id uuid primary key references auth.users(id) on delete cascade,
      awarded_packs smallint not null check (awarded_packs in (0,20)),
      recorded_at timestamptz not null default statement_timestamp()
    );
    insert into club_rewards.first_login_pack_rewards(user_id,awarded_packs)
      select u.id,0 from auth.users u
      where u.last_sign_in_at is not null
         or exists(select 1 from public.card_packs p
           where p.user_id=u.id and p.source in ('daily','daily_streak'))
      on conflict(user_id) do nothing;
  end if;
end $$;
alter table club_rewards.first_login_pack_rewards enable row level security;
revoke all on club_rewards.first_login_pack_rewards from public,anon,authenticated;

create or replace function public.claim_daily_card_pack()
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  actor uuid:=public.lock_banner_shop_actor();
  today date:=(statement_timestamp() at time zone 'Europe/Madrid')::date;
  removed_today boolean; new_daily integer:=0; bonus_count integer:=0; streak integer; daily_count integer;
  welcome_count integer:=0; receipt_count integer; welcome_awarded boolean;
  available_count bigint; total_count bigint; activity_rewards jsonb;
begin
  perform public.assert_account_security();

  -- The existing per-account wallet lock serializes concurrent callers. The
  -- primary key is a second safeguard. Receipt and twenty packs commit together.
  insert into club_rewards.first_login_pack_rewards(user_id,awarded_packs)
    values(actor,20) on conflict(user_id) do nothing;
  get diagnostics receipt_count=row_count;
  if receipt_count=1 then
    welcome_count:=20;
    insert into public.card_packs(user_id,earned_day,source)
      select actor,today,'welcome' from generate_series(1,welcome_count);
  end if;
  select awarded_packs=20 into welcome_awarded
    from club_rewards.first_login_pack_rewards where user_id=actor;

  select exists(select 1 from public.admin_removed_daily_pack_claims
    where user_id=actor and earned_day=today) into removed_today;
  if not removed_today then
    insert into public.card_packs(user_id,earned_day,source) values(actor,today,'daily')
      on conflict(user_id,earned_day) where source='daily' do nothing;
    get diagnostics new_daily=row_count;
  end if;
  select count(*)::integer into streak from (
    select earned_day,row_number() over(order by earned_day desc) n
    from public.card_packs where user_id=actor and source='daily' and earned_day<=today
  ) days where today-earned_day=n-1;
  daily_count:=case when streak>=30 then 5 when streak>=14 then 4 when streak>=7 then 3 when streak>=3 then 2 else 1 end;
  if not removed_today then
    insert into public.member_reward_pack_grants(user_id,event_key,packs)
      values(actor,'daily:'||today,daily_count-1) on conflict do nothing;
    if found then
      bonus_count:=daily_count-1;
      insert into public.card_packs(user_id,earned_day,source)
        select actor,today,'daily_streak' from generate_series(1,bonus_count);
    end if;
  end if;
  select count(*) filter(where opened_at is null),count(*) into available_count,total_count
    from public.card_packs where user_id=actor;
  select jsonb_object_agg(activity,exists(select 1 from public.member_reward_pack_grants g
    where g.user_id=actor and g.event_key='activity:'||activity||':'||today))
    into activity_rewards from unnest(array['message','poll','event']) activity;
  return jsonb_build_object('available',available_count,'total',total_count,'credited',new_daily+bonus_count+welcome_count>0,
    'credited_packs',new_daily+bonus_count+welcome_count,'streak_days',streak,'daily_reward_packs',daily_count,
    'welcome_credited_packs',welcome_count,'welcome_received',coalesce(welcome_awarded,false),
    'activity_rewards',activity_rewards,'activity_reward_limit',3,
    'day',today,'next_reset_at',((today+1)::timestamp at time zone 'Europe/Madrid'));
end; $$;
revoke all on function public.claim_daily_card_pack() from public,anon,authenticated;
grant execute on function public.claim_daily_card_pack() to authenticated;
notify pgrst,'reload schema';
commit;

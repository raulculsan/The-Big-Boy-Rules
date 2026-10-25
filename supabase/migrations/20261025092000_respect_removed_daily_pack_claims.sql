-- An admin's removal of today's free pack must survive a repeated claim.
begin;
create or replace function public.claim_daily_card_pack()
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  actor uuid:=public.lock_banner_shop_actor();
  today date:=(statement_timestamp() at time zone 'Europe/Madrid')::date;
  removed_today boolean; new_daily integer:=0; bonus_count integer:=0; streak integer; daily_count integer;
  available_count bigint; total_count bigint; activity_rewards jsonb;
begin
  perform public.assert_account_security();
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
  return jsonb_build_object('available',available_count,'total',total_count,'credited',new_daily+bonus_count>0,
    'credited_packs',new_daily+bonus_count,'streak_days',streak,'daily_reward_packs',daily_count,
    'activity_rewards',activity_rewards,'activity_reward_limit',3,
    'day',today,'next_reset_at',((today+1)::timestamp at time zone 'Europe/Madrid'));
end; $$;
notify pgrst,'reload schema';
commit;

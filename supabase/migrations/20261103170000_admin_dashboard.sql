-- Superadmin console: one call for the club's pulse, a club-wide gift and
-- market moderation. Every function checks the superadmin role and account
-- security on the server; the console only shows and asks.

create or replace function public.admin_club_dashboard()
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare today date:=(statement_timestamp() at time zone 'Europe/Madrid')::date; since timestamptz:=now()-interval '7 days';
begin
  if auth.uid() is null or not public.current_user_is_superadmin() then raise exception 'Solo la cuenta de administración puede ver el panel.' using errcode='42501'; end if;
  perform public.assert_account_security();
  return jsonb_build_object(
    'members',(select count(*) from public.profiles where not is_hidden),
    'active_today',(select count(distinct v.user_id) from public.member_app_visit_days v join public.profiles p on p.id=v.user_id and not p.is_hidden where v.visit_day=today),
    'active_week',(select count(distinct v.user_id) from public.member_app_visit_days v join public.profiles p on p.id=v.user_id and not p.is_hidden where v.visit_day>today-7),
    'visits',(select jsonb_agg(jsonb_build_object('day',d::date,'count',(select count(distinct v.user_id) from public.member_app_visit_days v
        join public.profiles p on p.id=v.user_id and not p.is_hidden where v.visit_day=d::date)) order by d) from generate_series(today-13,today,interval '1 day') d),
    'packs_opened_week',(select count(*) from public.card_packs where opened_at>=since),
    'packs_waiting',(select count(*) from public.card_packs where opened_at is null),
    'coins_circulating',(select coalesce(sum(balance),0) from public.member_coin_wallets),
    'coins_earned_week',(select coalesce(sum(delta),0) from public.member_coin_ledger where delta>0 and created_at>=since)
      +(select coalesce(sum(coins),0) from club_rewards.coin_receipts where created_at>=since),
    'coins_spent_week',(select coalesce(-sum(delta),0) from public.member_coin_ledger where delta<0 and created_at>=since),
    'market_open',(select count(*) from public.card_market_listings where status='open'),
    'market_sales_week',(select count(*) from public.card_market_listings where status='sold' and closed_at>=since),
    'market_volume_week',(select coalesce(sum(price),0) from public.card_market_listings where status='sold' and closed_at>=since),
    'trades_week',(select count(*) from public.card_trade_offers where status='accepted' and resolved_at>=since),
    'fusions_week',(select count(*) from public.member_card_fusions where created_at>=since),
    'trophies_week',(select count(*) from public.achievement_awards where awarded_at>=since),
    'pending_requests',(select count(*) from public.account_requests where status='pending'),
    'open_tickets',(select count(*) from public.help_requests where status<>'closed'),
    'top_collectors',coalesce((select jsonb_agg(x) from (select p.id,p.display_name as name,p.avatar_url,count(*) as value
        from public.member_card_acquisitions a join public.profiles p on p.id=a.user_id and not p.is_hidden
        group by p.id order by value desc, p.display_name limit 5) x),'[]'::jsonb),
    'top_coins',coalesce((select jsonb_agg(x) from (select p.id,p.display_name as name,p.avatar_url,w.balance as value
        from public.member_coin_wallets w join public.profiles p on p.id=w.user_id and not p.is_hidden
        order by w.balance desc, p.display_name limit 5) x),'[]'::jsonb),
    'top_streaks',coalesce((select jsonb_agg(x) from (select * from (select p.id,p.display_name as name,p.avatar_url,public.daily_pack_streak(p.id,today) as value
        from public.profiles p where not p.is_hidden) s where value>0 order by value desc, name limit 5) x),'[]'::jsonb),
    'recent',coalesce((select jsonb_agg(e.item order by e.at desc) from (
        (select jsonb_build_object('kind','trophy','at',w.awarded_at,'who',p.display_name,'what',a.name,'tier',a.tier) item, w.awarded_at at
          from public.achievement_awards w join public.achievements a on a.id=w.achievement_id join public.profiles p on p.id=w.user_id and not p.is_hidden
          order by w.awarded_at desc limit 8)
        union all
        (select jsonb_build_object('kind','sale','at',l.closed_at,'who',b.display_name,'what',public.card_display_name(l.card_id),'price',l.price), l.closed_at
          from public.card_market_listings l join public.profiles b on b.id=l.buyer_id where l.status='sold' order by l.closed_at desc limit 5)
        union all
        (select jsonb_build_object('kind','fusion','at',f.created_at,'who',p.display_name,'what',public.card_display_name(f.card_id)), f.created_at
          from public.member_card_fusions f join public.profiles p on p.id=f.user_id and not p.is_hidden order by f.created_at desc limit 5)
        union all
        (select jsonb_build_object('kind','pull','at',x.created_at,'who',p.display_name,'what',public.card_display_name(x.card_id),'edition',c.edition), x.created_at
          from public.member_pack_card_awards x join public.achievement_card_catalog c on c.id=x.card_id
          join public.profiles p on p.id=x.user_id and not p.is_hidden
          where c.edition in ('legendary','full_art','vice_city','halloween') order by x.created_at desc limit 8)
      ) e),'[]'::jsonb),
    'generated_at',now());
end $$;
revoke all on function public.admin_club_dashboard() from public, anon;
grant execute on function public.admin_club_dashboard() to authenticated;

-- Club-wide gift ------------------------------------------------------------
create table if not exists public.admin_club_gifts (
  id uuid primary key,
  actor_id uuid not null references public.profiles(id),
  packs integer not null check (packs between 0 and 10),
  coins integer not null check (coins between 0 and 500),
  note text check (char_length(note) <= 120),
  recipients integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.admin_club_gifts enable row level security;
revoke all on public.admin_club_gifts from anon, authenticated;

create or replace function public.admin_gift_club(gift_id uuid, gift_packs integer, gift_coins integer, gift_note text default null)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare actor uuid:=auth.uid(); today date:=(statement_timestamp() at time zone 'Europe/Madrid')::date;
  note text:=nullif(trim(coalesce(gift_note,'')),''); member uuid; balance_now bigint; total integer:=0; existing public.admin_club_gifts%rowtype;
begin
  if actor is null or not public.current_user_is_superadmin() then raise exception 'Solo la cuenta de administración puede regalar al club.' using errcode='42501'; end if;
  perform public.assert_account_security();
  if gift_id is null or gift_packs is null or gift_coins is null or gift_packs not between 0 and 10 or gift_coins not between 0 and 500 or gift_packs+gift_coins=0 then
    raise exception 'Elige entre 1 y 10 sobres o entre 1 y 500 monedas.' using errcode='22023';
  end if;
  if char_length(coalesce(note,''))>120 then raise exception 'La nota puede tener hasta 120 caracteres.' using errcode='22023'; end if;
  -- One gift per id: retrying the same request never pays twice.
  insert into public.admin_club_gifts(id,actor_id,packs,coins,note) values(gift_id,actor,gift_packs,gift_coins,note) on conflict(id) do nothing;
  if not found then
    select * into existing from public.admin_club_gifts where id=gift_id;
    return jsonb_build_object('gift_id',existing.id,'recipients',existing.recipients,'packs',existing.packs,'coins',existing.coins,'repeated',true);
  end if;
  if gift_packs>0 then
    insert into public.card_packs(user_id,earned_day,source)
      select p.id,today,'admin' from public.profiles p cross join generate_series(1,gift_packs) where not p.is_hidden;
  end if;
  for member in select id from public.profiles where not is_hidden order by id loop
    total:=total+1;
    if gift_coins>0 then
      insert into public.member_coin_wallets(user_id,balance) values(member,gift_coins)
        on conflict(user_id) do update set balance=public.member_coin_wallets.balance+gift_coins returning balance into balance_now;
      insert into public.member_coin_ledger(user_id,delta,balance_after,reason,item_id,copies)
        values(member,gift_coins,balance_now,'admin_grant','club-gift:'||gift_id,1);
      insert into public.notifications(user_id,actor_id,type,target_type,excerpt)
        values(member,actor,'pack_granted','pack',left('Regalo del club: +'||gift_coins||' monedas.'||coalesce(' '||note,''),180));
    elsif note is not null then
      insert into public.notifications(user_id,actor_id,type,target_type,excerpt)
        values(member,actor,'pack_granted','pack',left('Regalo del club: '||note,180));
    end if;
  end loop;
  update public.admin_club_gifts set recipients=total where id=gift_id;
  return jsonb_build_object('gift_id',gift_id,'recipients',total,'packs',gift_packs,'coins',gift_coins,'repeated',false);
end $$;
revoke all on function public.admin_gift_club(uuid,integer,integer,text) from public, anon;
grant execute on function public.admin_gift_club(uuid,integer,integer,text) to authenticated;

create or replace function public.admin_recent_club_gifts()
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
begin
  if auth.uid() is null or not public.current_user_is_superadmin() then raise exception 'Solo la cuenta de administración.' using errcode='42501'; end if;
  perform public.assert_account_security();
  return coalesce((select jsonb_agg(jsonb_build_object('id',id,'packs',packs,'coins',coins,'note',note,'recipients',recipients,'created_at',created_at) order by created_at desc)
    from (select * from public.admin_club_gifts order by created_at desc limit 10) g),'[]'::jsonb);
end $$;
revoke all on function public.admin_recent_club_gifts() from public, anon;
grant execute on function public.admin_recent_club_gifts() to authenticated;

-- Market moderation ---------------------------------------------------------
create or replace function public.admin_market_listings()
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
begin
  if auth.uid() is null or not public.current_user_is_superadmin() then raise exception 'Solo la cuenta de administración.' using errcode='42501'; end if;
  perform public.assert_account_security();
  return coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'card_id',l.card_id,'card_name',public.card_display_name(l.card_id),
      'price',l.price,'seller_name',p.display_name,'created_at',l.created_at) order by l.created_at desc)
    from public.card_market_listings l join public.profiles p on p.id=l.seller_id where l.status='open'),'[]'::jsonb);
end $$;
revoke all on function public.admin_market_listings() from public, anon;
grant execute on function public.admin_market_listings() to authenticated;

-- Withdrawing returns the reserved copy to the seller and tells them why.
create or replace function public.admin_withdraw_market_listing(target_listing_id bigint)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare actor uuid:=auth.uid(); listing public.card_market_listings%rowtype;
begin
  if actor is null or not public.current_user_is_superadmin() then raise exception 'Solo la cuenta de administración.' using errcode='42501'; end if;
  perform public.assert_account_security();
  select * into listing from public.card_market_listings where id=target_listing_id for update;
  if not found or listing.status<>'open' then raise exception 'Esta carta ya no está a la venta.'; end if;
  update public.card_market_listings set status='cancelled',closed_at=now() where id=listing.id;
  insert into public.member_card_inventory(user_id,card_id,quantity) values(listing.seller_id,listing.card_id,1)
    on conflict(user_id,card_id) do update set quantity=public.member_card_inventory.quantity+1;
  insert into public.notifications(user_id,actor_id,type,target_type,excerpt)
    values(listing.seller_id,actor,'card_sold','trade',left('La administración ha retirado tu «'||public.card_display_name(listing.card_id)||'» del mercado. La carta vuelve a tu álbum.',180));
  return jsonb_build_object('listing_id',listing.id);
end $$;
revoke all on function public.admin_withdraw_market_listing(bigint) from public, anon;
grant execute on function public.admin_withdraw_market_listing(bigint) to authenticated;

notify pgrst,'reload schema';

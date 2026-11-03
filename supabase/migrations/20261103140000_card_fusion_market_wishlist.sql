-- Three new uses for duplicates, all server-owned:
--   * Fusion: several duplicates of one rarity become one card of the next rarity,
--     preferring a card the member does not own yet.
--   * Market: a member lists a duplicate for coins; the copy is held until it
--     sells or the listing is withdrawn. The last copy can never be listed.
--   * Wishlist: marking a missing card as wanted shows who has it duplicated
--     and tells them once.

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type = any (array[
  'private_message','group_message','group_mention','like','reply','media_created','event_created','pack_granted',
  'news_update','group_poll','trade_offer','trade_resolved','account_request','help_update','card_wanted','card_sold']));

create or replace function public.card_display_name(target_card_id text)
returns text language sql stable security definer set search_path to '' as $$
  select coalesce((select display_name from public.published_card_designs where id=target_card_id limit 1), target_card_id);
$$;
revoke all on function public.card_display_name(text) from public, anon, authenticated;

-- Fusion ------------------------------------------------------------------
create table if not exists public.member_card_fusions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  consumed jsonb not null,
  card_id text not null,
  created_at timestamptz not null default now()
);
alter table public.member_card_fusions enable row level security;
drop policy if exists "Own fusions" on public.member_card_fusions;
create policy "Own fusions" on public.member_card_fusions for select to authenticated using (user_id = auth.uid());
revoke all on public.member_card_fusions from anon;
revoke insert, update, delete on public.member_card_fusions from authenticated;

-- Fusion tier of an edition: common, special (special and retro), epic, legendary.
create or replace function public.card_fusion_tier(edition text)
returns text language sql immutable set search_path to '' as $$
  select case edition when 'common' then 'common' when 'special' then 'special' when 'retro' then 'special'
    when 'epic' then 'epic' when 'legendary' then 'legendary' end;
$$;

create or replace function public.fuse_duplicate_cards(p_items jsonb)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare
  actor uuid:=public.lock_banner_shop_actor();
  picked record; edition_name text; tier text; next_tier text; held integer; total integer:=0;
  required integer; targets text[]; card public.achievement_card_catalog%rowtype; new_quantity integer;
  consumed jsonb:='[]'::jsonb;
begin
  perform public.assert_account_security();
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 20 then
    raise exception 'Elige las repetidas que quieres fusionar.' using errcode='22023';
  end if;
  for picked in select card_id,sum(copies)::integer copies from jsonb_to_recordset(p_items) x(card_id text,copies integer)
    group by card_id order by card_id
  loop
    if picked.card_id is null or picked.copies is null or picked.copies<1 then raise exception 'La cantidad de copias no es válida.' using errcode='22023'; end if;
    select c.edition into edition_name from public.achievement_card_catalog c where c.id=picked.card_id and c.active;
    if not found then raise exception 'Una de las cartas ya no está disponible.'; end if;
    next_tier:=public.card_fusion_tier(edition_name);
    if next_tier is null then raise exception 'Las Full Art, Vice City y Halloween no se pueden fusionar.'; end if;
    if tier is null then tier:=next_tier; elsif tier<>next_tier then raise exception 'Todas las cartas deben ser de la misma rareza.'; end if;
    select quantity into held from public.member_card_inventory where user_id=actor and card_id=picked.card_id for update;
    if held is null or picked.copies>=held then raise exception 'Solo puedes usar repetidas; conservas una copia de cada carta.' using errcode='22023'; end if;
    update public.member_card_inventory set quantity=quantity-picked.copies where user_id=actor and card_id=picked.card_id;
    total:=total+picked.copies;
    consumed:=consumed||jsonb_build_array(jsonb_build_object('card_id',picked.card_id,'copies',picked.copies));
  end loop;
  required:=case tier when 'common' then 5 when 'special' then 4 when 'epic' then 4 else 3 end;
  if total<>required then raise exception 'Esta fusión necesita exactamente % copias.', required using errcode='22023'; end if;
  targets:=case tier when 'common' then array['special','retro'] when 'special' then array['epic']
    when 'epic' then array['legendary'] else array['full_art'] end;
  -- A missing card first, so fusion moves the album forward.
  select c.* into card from public.achievement_card_catalog c where c.active and c.edition=any(targets)
    and not exists(select 1 from public.member_card_inventory i where i.user_id=actor and i.card_id=c.id and i.quantity>0)
    order by random() limit 1;
  if not found then
    select c.* into card from public.achievement_card_catalog c where c.active and c.edition=any(targets) order by random() limit 1;
  end if;
  if not found then raise exception 'Todavía no hay cartas de la siguiente rareza.'; end if;
  insert into public.member_card_inventory(user_id,card_id,quantity) values(actor,card.id,1)
    on conflict(user_id,card_id) do update set quantity=public.member_card_inventory.quantity+1 returning quantity into new_quantity;
  insert into public.member_card_fusions(user_id,consumed,card_id) values(actor,consumed,card.id);
  return jsonb_build_object('card_id',card.id,'edition',card.edition,'kind',card.kind,'quantity',new_quantity,
    'is_new',new_quantity=1,'copies_used',total);
end $$;
revoke all on function public.fuse_duplicate_cards(jsonb) from public, anon;
grant execute on function public.fuse_duplicate_cards(jsonb) to authenticated;

-- Market ------------------------------------------------------------------
create table if not exists public.card_market_listings (
  id bigint generated always as identity primary key,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  card_id text not null,
  price integer not null check (price between 1 and 1000),
  status text not null default 'open' check (status in ('open','sold','cancelled')),
  buyer_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create index if not exists card_market_listings_open on public.card_market_listings(created_at desc) where status='open';
create index if not exists card_market_listings_seller on public.card_market_listings(seller_id, created_at desc);
alter table public.card_market_listings enable row level security;
revoke all on public.card_market_listings from anon, authenticated;

create or replace function public.list_card_for_sale(target_card_id text, asking_price integer)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare actor uuid:=public.lock_banner_shop_actor(); edition_name text; minimum integer; held integer; listing_id bigint;
begin
  perform public.assert_account_security();
  select edition into edition_name from public.achievement_card_catalog where id=target_card_id and active;
  if not found then raise exception 'Carta no disponible.'; end if;
  minimum:=public.card_discard_reward(edition_name);
  if asking_price is null or asking_price<minimum or asking_price>1000 then
    raise exception 'El precio debe estar entre % y 1.000 monedas.', minimum using errcode='22023';
  end if;
  if (select count(*) from public.card_market_listings where seller_id=actor and status='open')>=8 then
    raise exception 'Puedes tener hasta 8 cartas a la venta a la vez.';
  end if;
  select quantity into held from public.member_card_inventory where user_id=actor and card_id=target_card_id for update;
  if held is null or held<2 then raise exception 'Solo puedes vender repetidas; conservas una copia.'; end if;
  update public.member_card_inventory set quantity=quantity-1 where user_id=actor and card_id=target_card_id;
  insert into public.card_market_listings(seller_id,card_id,price) values(actor,target_card_id,asking_price) returning id into listing_id;
  return jsonb_build_object('listing_id',listing_id,'quantity',held-1);
end $$;
revoke all on function public.list_card_for_sale(text,integer) from public, anon;
grant execute on function public.list_card_for_sale(text,integer) to authenticated;

create or replace function public.cancel_card_listing(target_listing_id bigint)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare actor uuid:=public.lock_banner_shop_actor(); listing public.card_market_listings%rowtype;
begin
  perform public.assert_account_security();
  select * into listing from public.card_market_listings where id=target_listing_id and seller_id=actor for update;
  if not found or listing.status<>'open' then raise exception 'Esta carta ya no está a la venta.'; end if;
  update public.card_market_listings set status='cancelled',closed_at=now() where id=listing.id;
  insert into public.member_card_inventory(user_id,card_id,quantity) values(actor,listing.card_id,1)
    on conflict(user_id,card_id) do update set quantity=public.member_card_inventory.quantity+1;
  return jsonb_build_object('listing_id',listing.id,'card_id',listing.card_id);
end $$;
revoke all on function public.cancel_card_listing(bigint) from public, anon;
grant execute on function public.cancel_card_listing(bigint) to authenticated;

create or replace function public.buy_card_listing(target_listing_id bigint, expected_price integer)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare actor uuid:=public.lock_banner_shop_actor(); listing public.card_market_listings%rowtype;
  buyer_balance bigint; seller_balance bigint; new_quantity integer;
begin
  perform public.assert_account_security();
  select * into listing from public.card_market_listings where id=target_listing_id for update;
  if not found or listing.status<>'open' then raise exception 'Esta carta ya se ha vendido o la han retirado.'; end if;
  if listing.seller_id=actor then raise exception 'No puedes comprar tu propia carta. Retírala si ya no quieres venderla.'; end if;
  if expected_price is distinct from listing.price then raise exception 'El precio cambió. Actualiza el mercado.'; end if;
  select balance into buyer_balance from public.member_coin_wallets where user_id=actor;
  if coalesce(buyer_balance,0)<listing.price then raise exception 'No tienes suficientes monedas.'; end if;
  update public.member_coin_wallets set balance=balance-listing.price where user_id=actor returning balance into buyer_balance;
  insert into public.member_coin_ledger(user_id,delta,balance_after,reason,item_id,copies)
    values(actor,-listing.price,buyer_balance,'market_purchase',listing.card_id,1);
  insert into public.member_coin_wallets(user_id,balance) values(listing.seller_id,listing.price)
    on conflict(user_id) do update set balance=public.member_coin_wallets.balance+listing.price returning balance into seller_balance;
  insert into public.member_coin_ledger(user_id,delta,balance_after,reason,item_id,copies)
    values(listing.seller_id,listing.price,seller_balance,'market_sale',listing.card_id,1);
  insert into public.member_card_inventory(user_id,card_id,quantity) values(actor,listing.card_id,1)
    on conflict(user_id,card_id) do update set quantity=public.member_card_inventory.quantity+1 returning quantity into new_quantity;
  update public.card_market_listings set status='sold',buyer_id=actor,closed_at=now() where id=listing.id;
  insert into public.notifications(user_id,actor_id,type,target_type,excerpt)
    values(listing.seller_id,actor,'card_sold','trade',
      left('Ha comprado tu «'||public.card_display_name(listing.card_id)||'» por '||listing.price||' monedas.',180));
  return jsonb_build_object('listing_id',listing.id,'card_id',listing.card_id,'quantity',new_quantity,'balance',buyer_balance);
end $$;
revoke all on function public.buy_card_listing(bigint,integer) from public, anon;
grant execute on function public.buy_card_listing(bigint,integer) to authenticated;

create or replace function public.get_card_market()
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare actor uuid:=auth.uid();
begin
  perform public.assert_account_security();
  if actor is null or not exists(select 1 from public.profiles where id=actor and not is_hidden) then
    raise exception 'Inicia sesión en el club.' using errcode='42501';
  end if;
  return jsonb_build_object(
    'balance',(select balance from public.member_coin_wallets where user_id=actor),
    'listings',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'card_id',l.card_id,'price',l.price,'seller_id',l.seller_id,
        'seller_name',p.display_name,'created_at',l.created_at,'mine',l.seller_id=actor) order by l.created_at desc)
      from public.card_market_listings l join public.profiles p on p.id=l.seller_id
      where l.status='open' and not p.is_hidden),'[]'::jsonb),
    'history',coalesce((select jsonb_agg(recent.item order by recent.closed_at desc) from (
        select jsonb_build_object('id',l.id,'card_id',l.card_id,'price',l.price,'status',l.status,
          'role',case when l.seller_id=actor then 'seller' else 'buyer' end,'closed_at',l.closed_at) item, l.closed_at
        from public.card_market_listings l where l.status<>'open' and (l.seller_id=actor or l.buyer_id=actor)
        order by l.closed_at desc limit 12) recent),'[]'::jsonb));
end $$;
revoke all on function public.get_card_market() from public, anon;
grant execute on function public.get_card_market() to authenticated;

-- Wishlist ----------------------------------------------------------------
create or replace function public.get_wanted_card_holders()
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare actor uuid:=auth.uid();
begin
  perform public.assert_account_security();
  if actor is null or not exists(select 1 from public.profiles where id=actor and not is_hidden) then
    raise exception 'Inicia sesión en el club.' using errcode='42501';
  end if;
  return coalesce((select jsonb_object_agg(m.card_id, coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name) order by p.display_name)
      from public.member_card_inventory i join public.profiles p on p.id=i.user_id
      where i.card_id=m.card_id and i.quantity>1 and i.user_id<>actor and not p.is_hidden),'[]'::jsonb))
    from public.member_card_marks m where m.user_id=actor and m.kind='wanted'),'{}'::jsonb);
end $$;
revoke all on function public.get_wanted_card_holders() from public, anon;
grant execute on function public.get_wanted_card_holders() to authenticated;

create or replace function public.set_collection_card_mark(target_card_id text, mark_kind text, enabled boolean)
returns void language plpgsql security definer set search_path to 'public','pg_temp' as $function$
declare actor uuid:=public.lock_banner_shop_actor(); holder uuid;
begin
 if mark_kind not in('favorite','wanted') or enabled is null then raise exception 'Marcador no válido.'; end if;
 if not exists(select 1 from public.achievement_card_catalog where id=target_card_id and active) then raise exception 'Carta no disponible.'; end if;
 if enabled and mark_kind='favorite' and not exists(select 1 from public.member_card_inventory where user_id=actor and card_id=target_card_id and quantity>0) then raise exception 'Consigue esta carta antes de marcarla como favorita.'; end if;
 if enabled and mark_kind='wanted' and exists(select 1 from public.member_card_inventory where user_id=actor and card_id=target_card_id and quantity>0) then raise exception 'Ya tienes esta carta en tu álbum.'; end if;
 if enabled then
  insert into public.member_card_marks(user_id,card_id,kind) values(actor,target_card_id,mark_kind) on conflict do nothing;
  -- A new wish tells members who have it duplicated, at most 10 alerts a day per member.
  if found and mark_kind='wanted' and (select count(*) from public.notifications where actor_id=actor and type='card_wanted'
      and created_at>now()-interval '1 day')<10 then
   for holder in select i.user_id from public.member_card_inventory i join public.profiles p on p.id=i.user_id
     where i.card_id=target_card_id and i.quantity>1 and i.user_id<>actor and not p.is_hidden loop
    insert into public.notifications(user_id,actor_id,type,target_type,excerpt)
      values(holder,actor,'card_wanted','trade',left('Busca «'||public.card_display_name(target_card_id)||'» y tú la tienes repetida. Puedes proponerle un intercambio.',180));
   end loop;
  end if;
 else delete from public.member_card_marks where user_id=actor and card_id=target_card_id and kind=mark_kind; end if;
end; $function$;

-- The new alerts follow the member's "Sobres y colección" preference.
create or replace function public.filter_notification_preference()
returns trigger language plpgsql security definer set search_path to 'public','pg_temp' as $function$
declare prefs public.member_notification_preferences%rowtype; allowed boolean;
begin
 select * into prefs from public.member_notification_preferences where user_id=new.user_id;
 if not found then return new; end if;
 allowed:=case when new.type in('private_message','group_message','group_mention','group_poll') then prefs.chats when new.type='event_created' then prefs.agenda when new.type in('pack_granted','trade_offer','trade_resolved','card_wanted','card_sold') then prefs.collection when new.type='news_update' then prefs.news else prefs.activity end;
 if allowed then return new; end if; return null;
end; $function$;

notify pgrst,'reload schema';

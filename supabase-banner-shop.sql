-- Ejecutar DESPUÉS de supabase-daily-packs.sql y supabase-collection-achievements.sql.
-- Repetible. Solo añade economía de prueba; no importa aperturas de demostración.
-- Los diseños de Krita se conectan por art_key sin cambiar compras o saldos.
-- RPC (todos requieren un perfil autenticado y visible):
-- get_banner_shop_state(): {balance,cards:[{card_id,quantity,edition,kind}],
--   card_catalog:[{card_id,edition,kind}],available_packs:[{id,earned_day,collection_key}],
--   banners:[{id,name,description,art_key,price,owned,equipped}],equipped_banner_id,
--   discard_rewards:{common:1,retro:2,special:2,epic:3,legendary:5}}
-- open_owned_card_pack(target_pack_id bigint DEFAULT NULL):
--   {pack_id,cards:[{card_id,edition,kind,quantity}],balance}; seis cartas; NULL abre el más antiguo.
-- discard_duplicate_card(target_card_id text,copies integer DEFAULT 1):
--   {card_id,quantity,coins_earned,balance}; conserva siempre una copia.
-- discard_all_duplicate_cards():
--   {copies_discarded,cards_affected,coins_earned,balance,cards:[{card_id,quantity,copies_discarded,coins_earned}]};
--   conserva una copia de cada carta; sin repetidas devuelve ceros y cards:[].
-- buy_profile_banner(target_banner_id text): {banner_id,owned:true,purchased,balance}
-- equip_profile_banner(target_banner_id text DEFAULT NULL): {equipped_banner_id}; NULL quita el banner.
-- get_member_profile_banner(target_user_id uuid): {id,name,description,art_key} o null.
-- Errores RPC no modifican nada. Comprar de nuevo es idempotente; abrir un sobre
-- ya abierto devuelve error y nunca concede más cartas. El cliente debe recargar
-- estado tras una respuesta de red ambigua antes de reintentar descartes.
begin;

create table if not exists public.profile_banner_catalog (
  id text primary key,
  name text not null,
  description text not null default '',
  art_key text not null,
  price integer not null check (price >= 0),
  active boolean not null default true
);
create table if not exists public.member_card_inventory (
  user_id uuid not null references public.profiles(id) on delete cascade,
  card_id text not null references public.achievement_card_catalog(id),
  quantity integer not null check (quantity >= 1),
  primary key (user_id, card_id)
);
create table if not exists public.member_coin_wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance bigint not null default 0 check (balance >= 0)
);
create table if not exists public.member_owned_banners (
  user_id uuid not null references public.profiles(id) on delete cascade,
  banner_id text not null references public.profile_banner_catalog(id),
  acquired_at timestamptz not null default clock_timestamp(),
  primary key (user_id, banner_id)
);
create table if not exists public.member_equipped_banners (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  banner_id text not null,
  foreign key (user_id, banner_id) references public.member_owned_banners(user_id, banner_id)
);
create table if not exists public.member_coin_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  delta bigint not null,
  balance_after bigint not null check (balance_after >= 0),
  reason text not null check (reason in ('duplicate_discard','banner_purchase')),
  item_id text not null,
  copies integer not null default 1 check (copies > 0),
  created_at timestamptz not null default clock_timestamp()
);
create table if not exists public.member_pack_card_awards (
  pack_id bigint primary key references public.card_packs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  card_id text not null references public.achievement_card_catalog(id),
  created_at timestamptz not null default clock_timestamp()
);

-- Preserve previous one-card pack records as draw 1; future packs record six draws.
alter table public.member_pack_card_awards add column if not exists draw_index integer not null default 1;
alter table public.member_pack_card_awards drop constraint if exists member_pack_card_awards_pkey;
alter table public.member_pack_card_awards add primary key (pack_id, draw_index);
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid='public.member_pack_card_awards'::regclass and conname='member_pack_card_awards_draw_index_check') then
    alter table public.member_pack_card_awards add constraint member_pack_card_awards_draw_index_check check (draw_index between 1 and 6);
  end if;
end $$;

-- Shared odds for every individual draw, independent of how many cards a rarity has.
create or replace function public.card_pack_rarity_weights()
returns table (edition text, weight integer) language sql immutable set search_path = public, pg_temp as $$
  values ('common',70),('retro',12),('special',10),('epic',6),('legendary',2);
$$;
revoke all on function public.card_pack_rarity_weights() from public, anon, authenticated;

-- No direct table grants: RLS is an additional boundary; all reads use RPC.
alter table public.profile_banner_catalog enable row level security;
alter table public.member_card_inventory enable row level security;
alter table public.member_coin_wallets enable row level security;
alter table public.member_owned_banners enable row level security;
alter table public.member_equipped_banners enable row level security;
alter table public.member_coin_ledger enable row level security;
alter table public.member_pack_card_awards enable row level security;
revoke all on public.profile_banner_catalog, public.member_card_inventory,
  public.member_coin_wallets, public.member_owned_banners, public.member_equipped_banners,
  public.member_coin_ledger, public.member_pack_card_awards from public, anon, authenticated;
revoke all on sequence public.member_coin_ledger_id_seq from public, anon, authenticated;

insert into public.profile_banner_catalog(id,name,description,art_key,price)
  values ('banner-de-prueba','Banner de prueba','Banner para la cabecera del perfil durante las pruebas.','banner-de-prueba',1)
  on conflict (id) do nothing;

insert into public.profile_banner_catalog(id,name,description,art_key,price,active)
  values ('miguel-moto-anime-v1','Miguel · Ruta urbana','Miguel Ángel Jiménez Sánchez recorre la ciudad en moto. Banner anime animado.','miguel-moto-anime-v1',1,true)
  on conflict (id) do update set name=excluded.name,description=excluded.description,
    art_key=excluded.art_key,price=excluded.price,active=excluded.active;

insert into public.profile_banner_catalog(id,name,description,art_key,price,active)
  values ('miguel-basket-bano-v1','Miguel · Triple al váter','Miguel Ángel lanza emojis a canasta en el baño. Banner anime animado.','miguel-basket-bano-v1',1,true)
  on conflict (id) do update set name=excluded.name,description=excluded.description,
    art_key=excluded.art_key,price=excluded.price,active=excluded.active;

-- Internal guard + per-member lock. Every economy operation takes this lock
-- before pack, card or catalog locks; concurrent spend/discard/open is serialized.
create or replace function public.lock_banner_shop_actor()
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare actor uuid := auth.uid();
begin
  if actor is null or not exists (
    select 1 from public.profiles where id = actor and not coalesce(is_hidden,false)
  ) then raise exception 'Inicia sesión con un perfil visible para acceder a la tienda.' using errcode = '42501'; end if;
  insert into public.member_coin_wallets(user_id) values (actor) on conflict (user_id) do nothing;
  perform 1 from public.member_coin_wallets where user_id = actor for update;
  return actor;
end;
$$;
revoke all on function public.lock_banner_shop_actor() from public, anon, authenticated;

create or replace function public.get_banner_shop_state()
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare actor uuid := public.lock_banner_shop_actor();
begin
  return jsonb_build_object(
    'cards_per_pack',6,
    'rarity_probabilities',coalesce((select jsonb_object_agg(edition,round(100.0*weight/total_weight,2)) from (
      select w.*,sum(weight) over () as total_weight from public.card_pack_rarity_weights() w
      where exists (select 1 from public.achievement_card_catalog c where c.active and c.edition=w.edition)
    ) odds),'{}'::jsonb),
    'balance', (select balance from public.member_coin_wallets where user_id = actor),
    'cards', coalesce((select jsonb_agg(jsonb_build_object('card_id',i.card_id,'quantity',i.quantity,'edition',c.edition,'kind',c.kind) order by i.card_id)
      from public.member_card_inventory i join public.achievement_card_catalog c on c.id = i.card_id where i.user_id = actor),'[]'::jsonb),
    'card_catalog', coalesce((select jsonb_agg(jsonb_build_object('card_id',id,'edition',edition,'kind',kind) order by id)
      from public.achievement_card_catalog where active),'[]'::jsonb),
    'available_packs', coalesce((select jsonb_agg(jsonb_build_object('id',id,'earned_day',earned_day,'collection_key',collection_key) order by earned_day,id)
      from public.card_packs where user_id = actor and opened_at is null),'[]'::jsonb),
    'banners', coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'name',b.name,'description',b.description,'art_key',b.art_key,'price',b.price,
      'owned',o.banner_id is not null,'equipped',e.banner_id is not null) order by b.id)
      from public.profile_banner_catalog b left join public.member_owned_banners o on o.banner_id=b.id and o.user_id=actor
      left join public.member_equipped_banners e on e.banner_id=b.id and e.user_id=actor where b.active or o.banner_id is not null),'[]'::jsonb),
    'equipped_banner_id',(select banner_id from public.member_equipped_banners where user_id=actor),
    'discard_rewards',jsonb_build_object('common',1,'retro',2,'special',2,'epic',3,'legendary',5)
  );
end;
$$;

create or replace function public.open_owned_card_pack(target_pack_id bigint default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  actor uuid := public.lock_banner_shop_actor();
  saved_pack public.card_packs%rowtype;
  selected_edition text;
  card public.achievement_card_catalog%rowtype;
  new_quantity integer;
  draw_number integer;
  drawn_cards jsonb := '[]'::jsonb;
  drawn_ids text[] := '{}'::text[];
begin
  select * into saved_pack from public.card_packs where user_id=actor and opened_at is null
    and (target_pack_id is null or id=target_pack_id) and collection_key='los-nuestros-01'
    order by earned_day,id limit 1 for update;
  if not found then raise exception 'No tienes ese sobre disponible para abrir.'; end if;
  if (select count(*) from public.achievement_card_catalog where active) < 6 then
    raise exception 'La colección necesita al menos seis cartas distintas para abrir un sobre.';
  end if;
  -- Choose rarity, then a uniform active card not yet drawn in this pack.
  -- Exhausted rarities are excluded and remaining probabilities renormalized.
  -- All inventory writes and pack consumption commit together or roll back together.
  for draw_number in 1..6 loop
    select v.edition into selected_edition from public.card_pack_rarity_weights() v
      where exists (select 1 from public.achievement_card_catalog c where c.active and c.edition=v.edition and not (c.id=any(drawn_ids)))
      order by -ln(greatest(random(),0.000000000001))/v.weight limit 1;
    select * into card from public.achievement_card_catalog where active and edition=selected_edition and not (id=any(drawn_ids)) order by random() limit 1 for share;
    if not found then raise exception 'No hay cartas disponibles en la colección.'; end if;
    drawn_ids := array_append(drawn_ids,card.id);
    insert into public.member_pack_card_awards(pack_id,draw_index,user_id,card_id) values (saved_pack.id,draw_number,actor,card.id);
    insert into public.member_card_inventory(user_id,card_id,quantity) values (actor,card.id,1)
      on conflict (user_id,card_id) do update set quantity=public.member_card_inventory.quantity+1 returning quantity into new_quantity;
    drawn_cards := drawn_cards || jsonb_build_array(jsonb_build_object('card_id',card.id,'edition',card.edition,'kind',card.kind,'quantity',new_quantity));
  end loop;
  update public.card_packs set opened_at=clock_timestamp() where id=saved_pack.id;
  -- Keep the first-card field for clients still running the previous bundle.
  return jsonb_build_object('pack_id',saved_pack.id,'cards',drawn_cards,'card',drawn_cards->0,
    'balance',(select balance from public.member_coin_wallets where user_id=actor));
end;
$$;

create or replace function public.discard_duplicate_card(target_card_id text,copies integer default 1)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  actor uuid := public.lock_banner_shop_actor();
  held integer;
  reward integer;
  earned bigint;
  new_balance bigint;
begin
  if copies is null or copies < 1 then raise exception 'La cantidad de copias no es válida.'; end if;
  select quantity into held from public.member_card_inventory where user_id=actor and card_id=target_card_id for update;
  if held is null or copies >= held then raise exception 'Solo puedes descartar cartas repetidas; conserva una copia.'; end if;
  select case edition when 'common' then 1 when 'retro' then 2 when 'special' then 2 when 'epic' then 3 when 'legendary' then 5 end
    into reward from public.achievement_card_catalog where id=target_card_id;
  earned := copies::bigint * reward;
  update public.member_card_inventory set quantity=quantity-copies where user_id=actor and card_id=target_card_id;
  update public.member_coin_wallets set balance=balance+earned where user_id=actor returning balance into new_balance;
  insert into public.member_coin_ledger(user_id,delta,balance_after,reason,item_id,copies)
    values (actor,earned,new_balance,'duplicate_discard',target_card_id,copies);
  return jsonb_build_object('card_id',target_card_id,'quantity',held-copies,'coins_earned',earned,'balance',new_balance);
end;
$$;

-- The wallet lock serializes this batch with single discards, pack openings and
-- purchases. Repeating the call without new cards is a no-op, never a second payout.
create or replace function public.discard_all_duplicate_cards()
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  actor uuid := public.lock_banner_shop_actor();
  duplicate record;
  discarded integer;
  earned bigint;
  total_earned bigint := 0;
  total_copies bigint := 0;
  affected integer := 0;
  new_balance bigint;
  discarded_cards jsonb := '[]'::jsonb;
begin
  select balance into new_balance from public.member_coin_wallets where user_id=actor;
  for duplicate in
    select i.card_id,i.quantity,
      case c.edition when 'common' then 1 when 'retro' then 2 when 'special' then 2 when 'epic' then 3 when 'legendary' then 5 end as reward
    from public.member_card_inventory i
    join public.achievement_card_catalog c on c.id=i.card_id
    where i.user_id=actor and i.quantity>1
    order by i.card_id for update of i
  loop
    if duplicate.reward is null then raise exception 'La rareza de la carta no tiene un valor de descarte.'; end if;
    discarded := duplicate.quantity-1;
    earned := discarded::bigint*duplicate.reward;
    update public.member_card_inventory set quantity=1 where user_id=actor and card_id=duplicate.card_id;
    new_balance := new_balance+earned;
    insert into public.member_coin_ledger(user_id,delta,balance_after,reason,item_id,copies)
      values (actor,earned,new_balance,'duplicate_discard',duplicate.card_id,discarded);
    total_earned := total_earned+earned;
    total_copies := total_copies+discarded;
    affected := affected+1;
    discarded_cards := discarded_cards || jsonb_build_array(jsonb_build_object(
      'card_id',duplicate.card_id,'quantity',1,'copies_discarded',discarded,'coins_earned',earned));
  end loop;
  if affected>0 then
    update public.member_coin_wallets set balance=new_balance where user_id=actor;
  end if;
  return jsonb_build_object('copies_discarded',total_copies,'cards_affected',affected,
    'coins_earned',total_earned,'balance',new_balance,'cards',discarded_cards);
end;
$$;

create or replace function public.buy_profile_banner(target_banner_id text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  actor uuid := public.lock_banner_shop_actor();
  banner public.profile_banner_catalog%rowtype;
  new_balance bigint;
begin
  select balance into new_balance from public.member_coin_wallets where user_id=actor;
  if exists (select 1 from public.member_owned_banners where user_id=actor and banner_id=target_banner_id) then
    return jsonb_build_object('banner_id',target_banner_id,'owned',true,'purchased',false,'balance',new_balance);
  end if;
  select * into banner from public.profile_banner_catalog where id=target_banner_id and active for share;
  if not found then raise exception 'El banner no está disponible.'; end if;
  if new_balance < banner.price then raise exception 'No tienes suficientes monedas.'; end if;
  update public.member_coin_wallets set balance=balance-banner.price where user_id=actor returning balance into new_balance;
  insert into public.member_owned_banners(user_id,banner_id) values (actor,banner.id);
  insert into public.member_coin_ledger(user_id,delta,balance_after,reason,item_id)
    values (actor,-banner.price,new_balance,'banner_purchase',banner.id);
  return jsonb_build_object('banner_id',banner.id,'owned',true,'purchased',true,'balance',new_balance);
end;
$$;

create or replace function public.equip_profile_banner(target_banner_id text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare actor uuid := public.lock_banner_shop_actor();
begin
  if target_banner_id is null then
    delete from public.member_equipped_banners where user_id=actor;
  else
    if not exists (select 1 from public.member_owned_banners where user_id=actor and banner_id=target_banner_id) then
      raise exception 'Primero debes comprar este banner.';
    end if;
    insert into public.member_equipped_banners(user_id,banner_id) values (actor,target_banner_id)
      on conflict (user_id) do update set banner_id=excluded.banner_id;
  end if;
  return jsonb_build_object('equipped_banner_id',target_banner_id);
end;
$$;

create or replace function public.get_member_profile_banner(target_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare result jsonb;
begin
  if auth.uid() is null or not exists (select 1 from public.profiles where id=auth.uid() and not coalesce(is_hidden,false)) then
    raise exception 'Inicia sesión con un perfil visible.' using errcode='42501';
  end if;
  select jsonb_build_object('id',b.id,'name',b.name,'description',b.description,'art_key',b.art_key) into result
    from public.member_equipped_banners e join public.profile_banner_catalog b on b.id=e.banner_id
    join public.profiles p on p.id=e.user_id where e.user_id=target_user_id and not coalesce(p.is_hidden,false);
  return result;
end;
$$;

revoke all on function public.get_banner_shop_state(), public.open_owned_card_pack(bigint),
  public.discard_duplicate_card(text,integer), public.discard_all_duplicate_cards(), public.buy_profile_banner(text),
  public.equip_profile_banner(text), public.get_member_profile_banner(uuid) from public, anon, authenticated;
grant execute on function public.get_banner_shop_state(), public.open_owned_card_pack(bigint),
  public.discard_duplicate_card(text,integer), public.discard_all_duplicate_cards(), public.buy_profile_banner(text),
  public.equip_profile_banner(text), public.get_member_profile_banner(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;

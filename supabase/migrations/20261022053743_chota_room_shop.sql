-- Owned room props use the same per-member wallet lock as banner purchases.
begin;
create table if not exists public.chota_item_catalog (
  id text primary key check (char_length(id) between 1 and 60),
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '' check (char_length(description)<=240),
  art_key text not null check (char_length(art_key) between 1 and 60),
  price integer not null check (price between 0 and 1000000),
  active boolean not null default true,
  sort_order integer not null default 0
);
create table if not exists public.member_owned_chota_items (
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id text not null references public.chota_item_catalog(id),
  paid_price integer not null check (paid_price>=0),
  balance_after bigint not null check (balance_after>=0),
  purchased_at timestamptz not null default now(),
  primary key (user_id,item_id)
);
alter table public.chota_item_catalog enable row level security;
alter table public.member_owned_chota_items enable row level security;
revoke all on public.chota_item_catalog,public.member_owned_chota_items from public,anon,authenticated;
-- Purchases retain their paid price. Re-running seeds never resets admin prices.
insert into public.chota_item_catalog(id,name,description,art_key,price,sort_order) values
  ('chota-football','Pelota de fútbol','Una pelota junto al sofá, lista para el siguiente partido.','football',10,1),
  ('chota-skateboard','Skate','Su tabla encuentra sitio en el suelo de la sede.','skateboard',20,2),
  ('chota-robot-vacuum','Robot aspirador','Recorre la habitación y mantiene el suelo limpio.','robot-vacuum',35,3)
on conflict(id) do nothing;
alter table public.member_coin_ledger drop constraint if exists member_coin_ledger_reason_check;
alter table public.member_coin_ledger add constraint member_coin_ledger_reason_check
  check (reason in ('duplicate_discard','banner_purchase','admin_grant','admin_adjust','chota_purchase'));

create or replace function public.get_chota_shop_state()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := public.lock_banner_shop_actor();
begin
  perform public.assert_account_security();
  return jsonb_build_object(
    'balance',(select balance from public.member_coin_wallets where user_id=actor),
    'items',coalesce((select jsonb_agg(jsonb_build_object(
      'id',c.id,'name',c.name,'description',c.description,'art_key',c.art_key,'price',c.price,
      'active',c.active,'owned',o.item_id is not null) order by c.sort_order,c.id)
      from public.chota_item_catalog c left join public.member_owned_chota_items o
        on o.item_id=c.id and o.user_id=actor
      where c.active or o.item_id is not null),'[]'::jsonb)
  );
end;
$$;
create or replace function public.buy_chota_item(target_item_id text,expected_price integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := public.lock_banner_shop_actor();
  item public.chota_item_catalog%rowtype;
  new_balance bigint;
begin
  perform public.assert_account_security();
  if target_item_id is null or char_length(target_item_id) not between 1 and 60 then
    raise exception 'Objeto no válido.' using errcode='22023';
  end if;
  -- The wallet lock serializes every spend and makes repeated taps idempotent.
  if exists(select 1 from public.member_owned_chota_items where user_id=actor and item_id=target_item_id) then
    return public.get_chota_shop_state() || jsonb_build_object('item_id',target_item_id,'purchased',false);
  end if;
  select * into item from public.chota_item_catalog where id=target_item_id and active for share;
  if not found then raise exception 'Este objeto ya no está en la tienda.'; end if;
  select balance into new_balance from public.member_coin_wallets where user_id=actor;
  if expected_price is null or expected_price<>item.price then raise exception 'El precio cambió. Actualiza la tienda antes de comprar.'; end if;
  if new_balance<item.price then raise exception 'No tienes suficientes monedas.'; end if;
  update public.member_coin_wallets set balance=balance-item.price where user_id=actor returning balance into new_balance;
  insert into public.member_owned_chota_items(user_id,item_id,paid_price,balance_after)
    values(actor,item.id,item.price,new_balance);
  insert into public.member_coin_ledger(user_id,delta,balance_after,reason,item_id,copies)
    values(actor,-item.price,new_balance,'chota_purchase',item.id,1);
  return public.get_chota_shop_state() || jsonb_build_object('item_id',item.id,'purchased',true);
end;
$$;
revoke all on function public.get_chota_shop_state(),public.buy_chota_item(text,integer) from public,anon,authenticated;
grant execute on function public.get_chota_shop_state(),public.buy_chota_item(text,integer) to authenticated;

-- The administration screen edits Chota prices alongside banners and vouchers.
create or replace function public.admin_get_club_economy()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  banner_rows jsonb := '[]'::jsonb;
  voucher_rows jsonb := '[]'::jsonb;
  chota_rows jsonb := '[]'::jsonb;
begin
  if auth.uid() is null or not public.current_user_is_superadmin() then raise exception 'Solo la cuenta de administración puede gestionar la economía.' using errcode='42501'; end if;
  perform public.assert_account_security();
  if to_regclass('public.profile_banner_catalog') is not null then
    execute $catalog$select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'price',price,'active',active) order by name),'[]'::jsonb) from public.profile_banner_catalog$catalog$ into banner_rows;
  end if;
  if to_regclass('public.reward_voucher_catalog') is not null then
    execute $catalog$select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'price',price,'active',active,'minimum_price',case when reward_type='coins' then reward_amount else 0 end) order by name),'[]'::jsonb) from public.reward_voucher_catalog$catalog$ into voucher_rows;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'price',price,'active',active) order by sort_order,id),'[]'::jsonb) into chota_rows from public.chota_item_catalog;
  return jsonb_build_object(
    'chota_items',chota_rows,
    'revision',(select revision from public.club_economy_configuration where singleton),
    'probabilities',(select jsonb_object_agg(edition,round(100.0*weight/total,2)) from
      (select w.*,sum(weight) over() total from public.card_pack_rarity_weights() w) odds),
    'banners',banner_rows,
    'vouchers',voucher_rows,
    'vouchers_available',to_regclass('public.reward_voucher_catalog') is not null
  );
end;
$$;

create or replace function public.admin_save_club_economy(p_revision bigint,p_probabilities jsonb,p_prices jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  saved public.club_economy_configuration%rowtype;
  affected bigint;
  prior jsonb; item jsonb; rarity text; amount numeric; total numeric := 0;
  weights jsonb := '{}'::jsonb; seen text[] := '{}';
  allowed text[];
  expected_price_count integer;
begin
  if auth.uid() is null or not public.current_user_is_superadmin() then raise exception 'Solo la cuenta de administración puede gestionar la economía.' using errcode='42501'; end if;
  perform public.assert_account_security();
  select * into strict saved from public.club_economy_configuration where singleton for update;
  select array_agg(key order by key) into allowed from jsonb_object_keys(saved.rarity_weights) as keys(key);
  if p_revision is null or p_revision<>saved.revision then raise exception 'La configuración cambió. Actualiza antes de guardar.'; end if;
  if jsonb_typeof(p_probabilities) is distinct from 'object' or jsonb_typeof(p_prices) is distinct from 'array' then raise exception 'Configuración no válida.'; end if;
  if (select count(*) from jsonb_object_keys(p_probabilities))<>array_length(allowed,1) then raise exception 'Indica el porcentaje de todas las rarezas.'; end if;
  foreach rarity in array allowed loop
    if jsonb_typeof(p_probabilities->rarity) is distinct from 'number' then raise exception 'Porcentaje no válido: %',rarity; end if;
    amount := (p_probabilities->>rarity)::numeric;
    if amount<0 or amount>100 or amount<>round(amount,2) then raise exception 'Los porcentajes deben estar entre 0 y 100, con dos decimales como máximo.'; end if;
    total:=total+amount;
    weights:=weights||jsonb_build_object(rarity,(amount*100)::integer);
  end loop;
  if total<>100 then raise exception 'Los porcentajes deben sumar exactamente 100%%.'; end if;
  -- Guarantee that configured draws can still fill the six distinct category slots.
  if exists(select 1 from (values('member',3),('object',2),('location',1)) q(kind,needed)
    where (select count(*) from public.achievement_card_catalog c where c.active and c.kind=q.kind and coalesce((weights->>c.edition)::integer,0)>0)<q.needed)
    then raise exception 'Estas probabilidades no permiten completar 3 miembros, 2 objetos y 1 ubicación distintos.'; end if;
  prior:=public.admin_get_club_economy();
  expected_price_count := jsonb_array_length(prior->'banners') + jsonb_array_length(prior->'vouchers');
  if exists(select 1 from jsonb_array_elements(p_prices) x where x->>'kind'='chota') then
    expected_price_count := expected_price_count + jsonb_array_length(prior->'chota_items');
  end if;
  if jsonb_array_length(p_prices)<>expected_price_count then
    raise exception 'El catálogo cambió. Actualiza antes de guardar.';
  end if;
  for item in select value from jsonb_array_elements(p_prices) loop
    if jsonb_typeof(item->'price') is distinct from 'number' or jsonb_typeof(item->'id') is distinct from 'string' or item->>'kind' not in ('banner','voucher','chota') or item->>'kind' is null then raise exception 'Artículo no válido.'; end if;
    amount:=(item->>'price')::numeric;
    if amount<0 or amount>1000000 or amount<>trunc(amount) then raise exception 'El precio debe ser un número entero entre 0 y 1.000.000 monedas.'; end if;
    if (item->>'kind')||':'||(item->>'id')=any(seen) then raise exception 'Artículo duplicado.'; end if;
    seen:=array_append(seen,(item->>'kind')||':'||(item->>'id'));
    -- Validate against the catalog actually returned, including when an optional
    -- catalog is not installed. No dynamic identifier comes from the client.
    if item->>'kind'='banner' then
      if not exists(select 1 from jsonb_array_elements(prior->'banners') as p(value) where p.value->>'id'=item->>'id') then
        raise exception 'Artículo desconocido. Actualiza el catálogo.';
      end if;
      execute 'update public.profile_banner_catalog set price=$1 where id=$2' using amount::integer,item->>'id';
    elsif item->>'kind'='chota' then
      if not exists(select 1 from jsonb_array_elements(prior->'chota_items') as p(value) where p.value->>'id'=item->>'id') then
        raise exception 'Objeto desconocido. Actualiza el catálogo.';
      end if;
      update public.chota_item_catalog set price=amount::integer where id=item->>'id';
    else
      if not exists(select 1 from jsonb_array_elements(prior->'vouchers') as p(value) where p.value->>'id'=item->>'id') then
        raise exception 'Artículo desconocido. Actualiza el catálogo.';
      end if;
      if exists(select 1 from jsonb_array_elements(prior->'vouchers') as p(value) where p.value->>'id'=item->>'id' and (p.value->>'minimum_price')::numeric>amount) then
        raise exception 'Un vale de monedas no puede costar menos que las monedas que entrega.';
      end if;
      execute 'update public.reward_voucher_catalog set price=$1 where id=$2' using amount::integer,item->>'id';
    end if;
    -- Both static and dynamic updates report their affected-row count.
    get diagnostics affected = row_count;
    if affected<>1 then raise exception 'El catálogo cambió. Actualiza antes de guardar.'; end if;
  end loop;
  update public.club_economy_configuration set rarity_weights=weights,revision=revision+1,updated_at=now(),updated_by=auth.uid() where singleton;
  insert into public.club_economy_audit(actor,previous_state,next_state) values(auth.uid(),prior,public.admin_get_club_economy());
  return public.admin_get_club_economy();
end;
$$;
revoke all on function public.admin_get_club_economy() from public,anon;
revoke all on function public.admin_save_club_economy(bigint,jsonb,jsonb) from public,anon;
grant execute on function public.admin_get_club_economy() to authenticated;
grant execute on function public.admin_save_club_economy(bigint,jsonb,jsonb) to authenticated;
-- Refresh open admin forms without changing any current prices or odds.
update public.club_economy_configuration set revision=revision+1,updated_at=now() where singleton;
commit;

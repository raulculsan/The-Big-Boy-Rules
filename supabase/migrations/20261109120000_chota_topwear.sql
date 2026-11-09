-- T-shirts: a third clothing slot worn with the coat and the trousers. Same wallet
-- purchase, ownership and ledger; each slot is equipped independently.
begin;
create or replace function public.valid_chota_clothing_manifest(value jsonb, expected_slot text, expected_rig text)
returns boolean language plpgsql immutable set search_path = '' as $$
declare sheet text; asset_path text;
begin
 if value is null or expected_slot is null or expected_rig is null or jsonb_typeof(value)<>'object' or expected_slot not in ('outerwear','topwear','bottomwear','footwear','headwear','accessories') or expected_rig !~ '^[a-z0-9-]{1,60}$' then return false; end if;
 if value->>'type'='builtin' then
  return coalesce(
   (expected_slot='outerwear' and expected_rig='chota-overlay-v1' and value->>'key' ~ '^tnf-(negro|crema|rojo|azul|oliva|morado)-v1$')
   or (expected_slot='bottomwear' and expected_rig='chota-bottomwear-overlay-v1' and value->>'key' ~ '^carhartt-(marron|azul-oscuro)-v1$')
   or (expected_slot='topwear' and expected_rig='chota-topwear-overlay-v1' and value->>'key' ~ '^(carhartt-(crudo|oliva)|supreme-(negra|roja)|stussy-(blanca|azul))-v1$'),false);
 end if;
 if coalesce(value->>'type','')<>'atlas' or coalesce(value->'cell','null'::jsonb) not in ('128'::jsonb,'256'::jsonb) or coalesce(jsonb_typeof(value->'atlases'),'')<>'object' then return false; end if;
 if exists(select 1 from jsonb_object_keys(value->'atlases') k where k not in ('base','directional','contextual','room','talk')) then return false; end if;
 foreach sheet in array array['base','directional','contextual','room','talk'] loop
  asset_path:=value->'atlases'->>sheet;
  if asset_path is null or asset_path !~ '^chota/wardrobe/[A-Za-z0-9/_-]{1,180}\.webp$' then return false; end if;
 end loop;
 return true;
end;
$$;

-- Which rig each slot supports in the current apps.
create or replace function public.chota_clothing_supported(slot text, rig text)
returns boolean language sql immutable set search_path = '' as $$
 select coalesce((slot='outerwear' and rig='chota-overlay-v1') or (slot='bottomwear' and rig='chota-bottomwear-overlay-v1') or (slot='topwear' and rig='chota-topwear-overlay-v1'),false)
$$;

insert into public.chota_item_catalog(id,name,description,art_key,price,active,sort_order,item_kind,slot,wardrobe_key,rig_version,garment) values
 ('chota-shirt-carhartt-crudo-v1','Camiseta Carhartt crudo','Algodón crudo con bolsillo de pecho y parche C.','shirt-carhartt-crudo',80,true,301,'clothing','topwear','carhartt-crudo','chota-topwear-overlay-v1','{"type":"builtin","key":"carhartt-crudo-v1"}'::jsonb),
 ('chota-shirt-carhartt-oliva-v1','Camiseta Carhartt oliva','Verde oliva con bolsillo de pecho y parche C.','shirt-carhartt-oliva',80,true,302,'clothing','topwear','carhartt-oliva','chota-topwear-overlay-v1','{"type":"builtin","key":"carhartt-oliva-v1"}'::jsonb),
 ('chota-shirt-supreme-negra-v1','Camiseta Supreme negra','Negra con el box logo rojo.','shirt-supreme-negra',120,true,303,'clothing','topwear','supreme-negra','chota-topwear-overlay-v1','{"type":"builtin","key":"supreme-negra-v1"}'::jsonb),
 ('chota-shirt-supreme-roja-v1','Camiseta Supreme roja','Roja con el box logo en rojo oscuro.','shirt-supreme-roja',120,true,304,'clothing','topwear','supreme-roja','chota-topwear-overlay-v1','{"type":"builtin","key":"supreme-roja-v1"}'::jsonb),
 ('chota-shirt-stussy-blanca-v1','Camiseta Stüssy blanca','Blanca con el logo Stüssy en negro.','shirt-stussy-blanca',80,true,305,'clothing','topwear','stussy-blanca','chota-topwear-overlay-v1','{"type":"builtin","key":"stussy-blanca-v1"}'::jsonb),
 ('chota-shirt-stussy-azul-v1','Camiseta Stüssy azul','Azul con el logo Stüssy en claro.','shirt-stussy-azul',80,true,306,'clothing','topwear','stussy-azul','chota-topwear-overlay-v1','{"type":"builtin","key":"stussy-azul-v1"}'::jsonb)
on conflict(id) do update set name=excluded.name,description=excluded.description,art_key=excluded.art_key,
 price=excluded.price,active=true,sort_order=excluded.sort_order,item_kind=excluded.item_kind,slot=excluded.slot,wardrobe_key=excluded.wardrobe_key,rig_version=excluded.rig_version,garment=excluded.garment;

create or replace function public.get_chota_shop_state()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := public.lock_banner_shop_actor();
begin
 perform public.assert_account_security();
 return jsonb_build_object(
  'balance',(select balance from public.member_coin_wallets where user_id=actor),
  'room_style',(select s.item_id from public.member_chota_room_style s join public.chota_item_catalog c on c.id=s.item_id where s.user_id=actor and public.chota_item_is_room_style(c.art_key,c.presentation)),
  'outerwear',(select e.item_id from public.member_chota_clothing e join public.chota_item_catalog c on c.id=e.item_id where e.user_id=actor and e.slot='outerwear' and c.item_kind='clothing'),
  'topwear',(select e.item_id from public.member_chota_clothing e join public.chota_item_catalog c on c.id=e.item_id where e.user_id=actor and e.slot='topwear' and c.item_kind='clothing'),
  'bottomwear',(select e.item_id from public.member_chota_clothing e join public.chota_item_catalog c on c.id=e.item_id where e.user_id=actor and e.slot='bottomwear' and c.item_kind='clothing'),
  'items',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'description',c.description,'art_key',c.art_key,'presentation',c.presentation,'price',c.price,'active',c.active,'owned',o.item_id is not null,'item_kind',c.item_kind,'slot',c.slot,'wardrobe_key',c.wardrobe_key,'rig_version',c.rig_version,'garment',c.garment) order by c.sort_order,c.id)
   from public.chota_item_catalog c left join public.member_owned_chota_items o on o.item_id=c.id and o.user_id=actor where c.active or o.item_id is not null),'[]'::jsonb));
end;
$$;

create or replace function public.buy_chota_item(target_item_id text,expected_price integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := public.lock_banner_shop_actor(); item public.chota_item_catalog%rowtype; new_balance bigint;
begin
 perform public.assert_account_security();
 if target_item_id is null or char_length(target_item_id) not between 1 and 60 then raise exception 'Objeto no válido.' using errcode='22023'; end if;
 if exists(select 1 from public.member_owned_chota_items where user_id=actor and item_id=target_item_id) then
  return public.get_chota_shop_state() || jsonb_build_object('item_id',target_item_id,'purchased',false);
 end if;
 select * into item from public.chota_item_catalog where id=target_item_id and active for share;
 if not found then raise exception 'Este objeto ya no está en la tienda.'; end if;
 select balance into new_balance from public.member_coin_wallets where user_id=actor;
 if expected_price is null or expected_price<>item.price then raise exception 'El precio cambió. Actualiza la tienda antes de comprar.'; end if;
 if item.item_kind='clothing' and not public.chota_clothing_supported(item.slot,item.rig_version) then raise exception 'Esta prenda necesita una versión compatible de la app.' using errcode='22023'; end if;
 if new_balance<item.price then raise exception 'No tienes suficientes monedas.'; end if;
 update public.member_coin_wallets set balance=balance-item.price where user_id=actor returning balance into new_balance;
 insert into public.member_owned_chota_items(user_id,item_id,paid_price,balance_after) values(actor,item.id,item.price,new_balance);
 insert into public.member_coin_ledger(user_id,delta,balance_after,reason,item_id,copies) values(actor,-item.price,new_balance,'chota_purchase',item.id,1);
 if public.chota_item_is_room_style(item.art_key,item.presentation) then
  insert into public.member_chota_room_style(user_id,item_id) values(actor,item.id)
   on conflict(user_id) do update set item_id=excluded.item_id,updated_at=now();
 elsif item.item_kind='clothing' then
  insert into public.member_chota_clothing(user_id,slot,item_id) values(actor,item.slot,item.id)
   on conflict(user_id,slot) do update set item_id=excluded.item_id,updated_at=now();
 end if;
 return public.get_chota_shop_state() || jsonb_build_object('item_id',item.id,'purchased',true);
end;
$$;

-- Equip or clear one slot; the other slots stay as they are.
create or replace function public.equip_chota_clothing(target_slot text, target_item_id text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := public.lock_banner_shop_actor();
begin
 perform public.assert_account_security();
 if target_slot is null or target_slot not in ('outerwear','topwear','bottomwear') then raise exception 'Tipo de prenda no válido.' using errcode='22023'; end if;
 if target_item_id is null then
  delete from public.member_chota_clothing where user_id=actor and slot=target_slot;
 else
  if char_length(target_item_id) not between 1 and 60 or not exists(
   select 1 from public.member_owned_chota_items o join public.chota_item_catalog c on c.id=o.item_id
   where o.user_id=actor and o.item_id=target_item_id and c.item_kind='clothing' and c.slot=target_slot and public.chota_clothing_supported(c.slot,c.rig_version)
  ) then raise exception 'Primero debes comprar esta prenda.' using errcode='42501'; end if;
  insert into public.member_chota_clothing(user_id,slot,item_id) values(actor,target_slot,target_item_id)
   on conflict(user_id,slot) do update set item_id=excluded.item_id,updated_at=now();
 end if;
 return public.get_chota_shop_state();
end;
$$;
revoke all on function public.get_chota_shop_state(),public.buy_chota_item(text,integer),public.equip_chota_clothing(text,text) from public,anon,authenticated;
grant execute on function public.get_chota_shop_state(),public.buy_chota_item(text,integer),public.equip_chota_clothing(text,text) to authenticated;
revoke all on function public.chota_clothing_supported(text,text) from public,anon,authenticated;
grant execute on function public.chota_clothing_supported(text,text) to service_role;
notify pgrst,'reload schema';
commit;

-- LOCAL PREPARATION ONLY. Claude must deploy together with the modular body clients.
-- Originals are free wardrobe items, not baked into the mascot. Existing purchases
-- remain equipped; a historical empty slot defaults to the original, while an
-- explicit removal is remembered independently and never silently re-equips it.
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
   or (expected_slot='footwear' and expected_rig='chota-footwear-overlay-v1' and value->>'key'='original-jordan-chicago-v1')
   or (expected_slot='bottomwear' and expected_rig='chota-bottomwear-overlay-v1' and value->>'key'='original-jeans-v1')
   or (expected_slot='topwear' and expected_rig='chota-topwear-overlay-v1' and value->>'key'='original-stussy-v1')
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


create or replace function public.chota_clothing_supported(slot text, rig text)
returns boolean language sql immutable set search_path='' as $$
 select coalesce((slot='outerwear' and rig='chota-overlay-v1') or
  (slot='bottomwear' and rig='chota-bottomwear-overlay-v1') or
  (slot='topwear' and rig='chota-topwear-overlay-v1') or
  (slot='footwear' and rig='chota-footwear-overlay-v1'),false)
$$;
create or replace function public.chota_original_item(target_slot text)
returns text language sql immutable set search_path='' as $$
 select case target_slot when 'topwear' then 'chota-original-stussy-v1'
  when 'bottomwear' then 'chota-original-jeans-v1'
  when 'footwear' then 'chota-original-jordan-chicago-v1' else null end
$$;
create table public.member_chota_wardrobe_preferences (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 removed_original_slots text[] not null default '{}'::text[]
  check (removed_original_slots <@ array['topwear','bottomwear','footwear']::text[] and cardinality(removed_original_slots)<=3),
 updated_at timestamptz not null default now()
);
alter table public.member_chota_wardrobe_preferences enable row level security;
create policy chota_wardrobe_preferences_read_own on public.member_chota_wardrobe_preferences
 for select to authenticated using ((select auth.uid())=user_id);
revoke all on public.member_chota_wardrobe_preferences from public,anon,authenticated;
grant select on public.member_chota_wardrobe_preferences to authenticated;
grant all on public.member_chota_wardrobe_preferences to service_role;
insert into public.chota_item_catalog(id,name,description,art_key,price,active,sort_order,item_kind,slot,wardrobe_key,rig_version,garment) values
 ('chota-original-stussy-v1','Camiseta Stüssy original','La camiseta blanca de siempre. Disponible gratis en el armario.','original-stussy',0,true,290,'clothing','topwear','original-stussy','chota-topwear-overlay-v1','{"type":"builtin","key":"original-stussy-v1"}'::jsonb),
 ('chota-original-jeans-v1','Vaqueros originales','Los vaqueros azules de siempre. Disponibles gratis en el armario.','original-jeans',0,true,190,'clothing','bottomwear','original-jeans','chota-bottomwear-overlay-v1','{"type":"builtin","key":"original-jeans-v1"}'::jsonb),
 ('chota-original-jordan-chicago-v1','Jordan Chicago originales','Sus zapatillas rojas, blancas y negras. Disponibles gratis en el armario.','original-jordan-chicago',0,true,390,'clothing','footwear','original-jordan-chicago','chota-footwear-overlay-v1','{"type":"builtin","key":"original-jordan-chicago-v1"}'::jsonb)
 on conflict(id) do update set name=excluded.name,description=excluded.description,price=0,active=true,item_kind=excluded.item_kind,slot=excluded.slot,wardrobe_key=excluded.wardrobe_key,rig_version=excluded.rig_version,garment=excluded.garment;

create or replace function public.get_chota_shop_state()
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.lock_banner_shop_actor(); removed text[]; result jsonb; target_slot text; selected_id text;
begin
 perform public.assert_account_security();
 select removed_original_slots into removed from public.member_chota_wardrobe_preferences where user_id=actor;
 removed:=coalesce(removed,'{}'::text[]);
 result:=jsonb_build_object('wardrobe_version',1,'removed_original_slots',to_jsonb(removed),
  'balance',(select balance from public.member_coin_wallets where user_id=actor),
  'room_style',(select s.item_id from public.member_chota_room_style s join public.chota_item_catalog c on c.id=s.item_id where s.user_id=actor and public.chota_item_is_room_style(c.art_key,c.presentation)),
  'items',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'description',c.description,'art_key',c.art_key,'presentation',c.presentation,'price',c.price,'active',c.active,
   'owned',o.item_id is not null or c.id=public.chota_original_item(c.slot),
   'item_kind',c.item_kind,'slot',c.slot,'wardrobe_key',c.wardrobe_key,'rig_version',c.rig_version,'garment',c.garment) order by c.sort_order,c.id)
   from public.chota_item_catalog c left join public.member_owned_chota_items o on o.item_id=c.id and o.user_id=actor where c.active or o.item_id is not null),'[]'::jsonb));
 foreach target_slot in array array['outerwear','bottomwear','topwear','footwear'] loop
  select e.item_id into selected_id from public.member_chota_clothing e join public.chota_item_catalog c on c.id=e.item_id where e.user_id=actor and e.slot=target_slot and c.item_kind='clothing';
  if selected_id is null and not target_slot=any(removed) then selected_id:=public.chota_original_item(target_slot); end if;
  result:=result||jsonb_build_object(target_slot,selected_id);
 end loop;
 return result;
end;
$$;
create or replace function public.equip_chota_clothing(target_slot text,target_item_id text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.lock_banner_shop_actor();
begin
 perform public.assert_account_security();
 if target_slot is null or target_slot not in ('outerwear','bottomwear','topwear','footwear') then raise exception 'Tipo de prenda no válido.' using errcode='22023'; end if;
 if target_item_id is null then
  delete from public.member_chota_clothing where user_id=actor and slot=target_slot;
  if target_slot<>'outerwear' then
   insert into public.member_chota_wardrobe_preferences(user_id,removed_original_slots) values(actor,array[target_slot])
    on conflict(user_id) do update set removed_original_slots=case when target_slot=any(public.member_chota_wardrobe_preferences.removed_original_slots) then public.member_chota_wardrobe_preferences.removed_original_slots else array_append(public.member_chota_wardrobe_preferences.removed_original_slots,target_slot) end,updated_at=now();
  end if;
 else
  if char_length(target_item_id) not between 1 and 60 or not exists (
   select 1 from public.chota_item_catalog c where c.id=target_item_id and c.item_kind='clothing' and c.slot=target_slot and public.chota_clothing_supported(c.slot,c.rig_version)
    and (c.id=public.chota_original_item(target_slot) or exists(select 1 from public.member_owned_chota_items o where o.user_id=actor and o.item_id=c.id))
  ) then raise exception 'Primero debes conseguir esta prenda.' using errcode='42501'; end if;
  if target_item_id=public.chota_original_item(target_slot) then
   insert into public.member_owned_chota_items(user_id,item_id,paid_price,balance_after) select actor,target_item_id,0,balance from public.member_coin_wallets where user_id=actor on conflict(user_id,item_id) do nothing;
  end if;
  insert into public.member_chota_clothing(user_id,slot,item_id) values(actor,target_slot,target_item_id)
   on conflict(user_id,slot) do update set item_id=excluded.item_id,updated_at=now();
  update public.member_chota_wardrobe_preferences set removed_original_slots=array_remove(removed_original_slots,target_slot),updated_at=now() where user_id=actor;
 end if;
 return public.get_chota_shop_state();
end;
$$;
revoke all on function public.get_chota_shop_state(),public.equip_chota_clothing(text,text),public.chota_original_item(text) from public,anon,authenticated;
grant execute on function public.get_chota_shop_state(),public.equip_chota_clothing(text,text) to authenticated;
grant execute on function public.chota_original_item(text) to service_role;
notify pgrst,'reload schema';
commit;

-- A room style is owned like any other Chota item, with one equipped style per account.
begin;
insert into public.chota_item_catalog(id,name,description,art_key,price,active,sort_order) values
 ('chota-room-midnight','Azul noche','Paredes azul zafiro, suelo ahumado y una alfombra violeta.','room-midnight',60,true,20),
 ('chota-room-forest','Bosque','Paredes verde bosque, madera oliva y una alfombra esmeralda.','room-forest',60,true,21),
 ('chota-room-terracotta','Terracota','Paredes de arcilla, madera miel y una alfombra cobriza.','room-terracotta',60,true,22)
on conflict(id) do nothing;
create table if not exists public.member_chota_room_style (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 item_id text not null,
 updated_at timestamptz not null default now(),
 foreign key(user_id,item_id) references public.member_owned_chota_items(user_id,item_id) on delete cascade
);
alter table public.member_chota_room_style enable row level security;
revoke all on public.member_chota_room_style from public,anon,authenticated;

create or replace function public.get_chota_shop_state()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := public.lock_banner_shop_actor();
begin
 perform public.assert_account_security();
 return jsonb_build_object(
  'balance',(select balance from public.member_coin_wallets where user_id=actor),
  'room_style',(select s.item_id from public.member_chota_room_style s join public.chota_item_catalog c on c.id=s.item_id where s.user_id=actor and c.art_key in ('room-midnight','room-forest','room-terracotta')),
  'items',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'description',c.description,'art_key',c.art_key,'price',c.price,'active',c.active,'owned',o.item_id is not null) order by c.sort_order,c.id)
   from public.chota_item_catalog c left join public.member_owned_chota_items o on o.item_id=c.id and o.user_id=actor where c.active or o.item_id is not null),'[]'::jsonb));
end;
$$;
create or replace function public.equip_chota_room_style(target_item_id text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := public.lock_banner_shop_actor();
begin
 perform public.assert_account_security();
 if target_item_id is null then
  delete from public.member_chota_room_style where user_id=actor;
 else
  if char_length(target_item_id) not between 1 and 60 or not exists(
   select 1 from public.member_owned_chota_items o join public.chota_item_catalog c on c.id=o.item_id
   where o.user_id=actor and o.item_id=target_item_id and c.art_key in ('room-midnight','room-forest','room-terracotta')) then
   raise exception 'Primero debes comprar este estilo de habitación.' using errcode='42501';
  end if;
  insert into public.member_chota_room_style(user_id,item_id) values(actor,target_item_id)
   on conflict(user_id) do update set item_id=excluded.item_id,updated_at=now();
 end if;
 return public.get_chota_shop_state();
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
 if new_balance<item.price then raise exception 'No tienes suficientes monedas.'; end if;
 update public.member_coin_wallets set balance=balance-item.price where user_id=actor returning balance into new_balance;
 insert into public.member_owned_chota_items(user_id,item_id,paid_price,balance_after) values(actor,item.id,item.price,new_balance);
 insert into public.member_coin_ledger(user_id,delta,balance_after,reason,item_id,copies) values(actor,-item.price,new_balance,'chota_purchase',item.id,1);
 if item.art_key in ('room-midnight','room-forest','room-terracotta') then
  insert into public.member_chota_room_style(user_id,item_id) values(actor,item.id)
   on conflict(user_id) do update set item_id=excluded.item_id,updated_at=now();
 end if;
 return public.get_chota_shop_state() || jsonb_build_object('item_id',item.id,'purchased',true);
end;
$$;
revoke all on function public.get_chota_shop_state(),public.buy_chota_item(text,integer),public.equip_chota_room_style(text) from public,anon,authenticated;
grant execute on function public.get_chota_shop_state(),public.buy_chota_item(text,integer),public.equip_chota_room_style(text) to authenticated;
commit;

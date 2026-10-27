-- New visuals are published as files + declarative metadata, independently of app releases.
begin;
create or replace function public.valid_shop_media_path(value text, folder text, video boolean default false)
returns boolean language sql immutable set search_path='' as $$
 select coalesce(char_length(value) between 1 and 240 and value like folder||'/%'
  and value !~ '(^|/)\.\.?(/|$)' and value !~ '//'
  and value ~ case when video then '^[a-zA-Z0-9/_-]+\.(mp4|webm)$' else '^[a-zA-Z0-9/_-]+\.(png|jpg|jpeg|webp|gif|avif|svg)$' end,false);
$$;
create or replace function public.valid_shop_presentation(p jsonb, kind text)
returns boolean language plpgsql immutable set search_path='' as $$
declare k text; t jsonb; folder text;
begin
 if p is null then return true;end if;
 if jsonb_typeof(p)<>'object' then return false;end if;
 if kind='chota' and p->>'type'='room_style' then
  foreach k in array array['wall','floor','rug'] loop
   if coalesce(p->'colors'->>k,'') !~ '^#[0-9a-fA-F]{6}$' then return false;end if;
  end loop;
  return true;
 end if;
 if (kind='banner' and p->>'type' not in ('image','video')) or (kind='chota' and p->>'type'<>'decoration') or p->>'type' is null then return false;end if;
 folder:=case when kind='banner' then 'banners' else 'chota' end;
 if not public.valid_shop_media_path(p->>'path',folder,p->>'type'='video') then return false;end if;
 if (p->>'type'='video' or p->>'animated'='true') and not public.valid_shop_media_path(p->>'poster_path',folder) then return false;end if;
 if p ? 'poster_path' and not public.valid_shop_media_path(p->>'poster_path',folder) then return false;end if;
 foreach k in array array['width','height'] loop
  if jsonb_typeof(p->k) is distinct from 'number' or not ((p->>k)::numeric between 1 and 8192) then return false;end if;
 end loop;
 if kind='chota' then
  t:=p->'placement';
  foreach k in array array['x','y','width'] loop
   if jsonb_typeof(t->k) is distinct from 'number' or not ((t->>k)::numeric between case when k='width' then 1 else 0 end and 100) then return false;end if;
  end loop;
  if t ? 'rotation' and (jsonb_typeof(t->'rotation') is distinct from 'number' or not ((t->>'rotation')::numeric between -180 and 180)) then return false;end if;
  if t ? 'z' and (jsonb_typeof(t->'z') is distinct from 'number' or not ((t->>'z')::numeric between 0 and 10)) then return false;end if;
  if p ? 'motion' and p->>'motion' not in ('none','sway','float','spin') then return false;end if;
 end if;
 return true;
exception when others then return false;
end;
$$;
create or replace function public.chota_item_is_room_style(art text,p jsonb)
returns boolean language sql immutable set search_path='' as $$
 select coalesce(art in ('room-midnight','room-forest','room-terracotta') or p->>'type'='room_style',false);
$$;
alter table public.profile_banner_catalog add column if not exists presentation jsonb;
alter table public.chota_item_catalog add column if not exists presentation jsonb;
alter table public.profile_banner_catalog add constraint profile_banner_presentation_valid check(public.valid_shop_presentation(presentation,'banner'));
alter table public.chota_item_catalog add constraint chota_presentation_valid check(public.valid_shop_presentation(presentation,'chota'));
-- No catalog write grants change. Only trusted administrators publish these public visuals.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('shop-media','shop-media',true,26214400,array['image/png','image/jpeg','image/webp','image/gif','image/avif','image/svg+xml','video/mp4','video/webm']) on conflict(id) do nothing;
create policy shop_media_admin_insert on storage.objects for insert to authenticated with check(bucket_id='shop-media' and public.current_user_is_superadmin());
create policy shop_media_admin_update on storage.objects for update to authenticated using(bucket_id='shop-media' and public.current_user_is_superadmin()) with check(bucket_id='shop-media' and public.current_user_is_superadmin());
create policy shop_media_admin_delete on storage.objects for delete to authenticated using(bucket_id='shop-media' and public.current_user_is_superadmin());
create policy shop_media_admin_select on storage.objects for select to authenticated using(bucket_id='shop-media' and public.current_user_is_superadmin());
create or replace function public.get_banner_shop_state()
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  actor uuid := public.lock_banner_shop_actor();
  shop_day date := (statement_timestamp() at time zone 'Europe/Madrid')::date;
  daily_ids text[] := public.daily_banner_shop_ids();
  voucher_rows jsonb := '[]'::jsonb;
begin
  perform public.assert_account_security();
  -- Vouchers are optional in existing installations.
  if to_regclass('public.reward_voucher_catalog') is not null and to_regclass('public.member_owned_reward_vouchers') is not null then
    execute $vouchers$select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'name',v.name,'description',v.description,'price',v.price,
      'reward_type',v.reward_type,'reward_amount',v.reward_amount,'reward_banner_id',v.reward_banner_id,
      'owned_quantity',coalesce(o.quantity,0)) order by v.id),'[]'::jsonb)
      from public.reward_voucher_catalog v left join public.member_owned_reward_vouchers o on o.voucher_id=v.id and o.user_id=$1
      where v.active or o.quantity is not null$vouchers$ into voucher_rows using actor;
  end if;
  return jsonb_build_object(
    'shop_day',shop_day,'shop_next_reset_at',((shop_day+1)::timestamp at time zone 'Europe/Madrid'),
    'daily_banner_ids',to_jsonb(daily_ids),
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
    'banners', coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'name',b.name,'description',b.description,'art_key',b.art_key,'presentation',b.presentation,'price',b.price,
      'in_daily_shop',b.id=any(daily_ids),'owned',o.banner_id is not null,'equipped',e.banner_id is not null) order by b.id)
      from public.profile_banner_catalog b left join public.member_owned_banners o on o.banner_id=b.id and o.user_id=actor
      left join public.member_equipped_banners e on e.banner_id=b.id and e.user_id=actor where b.active or o.banner_id is not null),'[]'::jsonb),
    'equipped_banner_id',(select banner_id from public.member_equipped_banners where user_id=actor),
    'vouchers',voucher_rows,
    'discard_rewards',jsonb_build_object('common',1,'retro',2,'special',2,'epic',3,'legendary',5,'full_art',8,'vice_city',10,'halloween',10)
  );
end;
$$;
create or replace function public.get_member_profile_banner(target_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare result jsonb;
begin
  if auth.uid() is null or not exists (select 1 from public.profiles where id=auth.uid() and not coalesce(is_hidden,false)) then
    raise exception 'Inicia sesión con un perfil visible.' using errcode='42501';
  end if;
  select jsonb_build_object('id',b.id,'name',b.name,'description',b.description,'art_key',b.art_key,'presentation',b.presentation) into result
    from public.member_equipped_banners e join public.profile_banner_catalog b on b.id=e.banner_id
    join public.profiles p on p.id=e.user_id where e.user_id=target_user_id and not coalesce(p.is_hidden,false);
  return result;
end;
$$;
create or replace function public.get_member_profile_banners(target_user_ids uuid[])
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare result jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles where id=auth.uid() and not coalesce(is_hidden,false)
  ) then
    raise exception 'Inicia sesión con un perfil visible.' using errcode='42501';
  end if;
  if coalesce(cardinality(target_user_ids),0) > 200 then
    raise exception 'Demasiados perfiles en una petición.' using errcode='22023';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id',p.id,
    'banner',case when b.id is null then null else jsonb_build_object(
      'id',b.id,'name',b.name,'description',b.description,'art_key',b.art_key,'presentation',b.presentation
    ) end
  )), '[]'::jsonb) into result
  from public.profiles p
  left join public.member_equipped_banners e on e.user_id=p.id
  left join public.profile_banner_catalog b on b.id=e.banner_id
  where p.id=any(target_user_ids) and not coalesce(p.is_hidden,false);
  return result;
end;
$$;
create or replace function public.get_admin_user_management_state(target_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.lock_admin_user_management_target(target_user_id);
  return jsonb_build_object(
    'user_id',target_user_id,
    'balance',coalesce((select balance from public.member_coin_wallets where user_id=target_user_id),0),
    'available_packs',(select count(*) from public.card_packs where user_id=target_user_id and opened_at is null),
    'banners',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'name',b.name,
      'description',b.description,'art_key',b.art_key,'presentation',b.presentation,'price',b.price,'active',b.active,
      'owned',o.banner_id is not null,'equipped',e.banner_id is not null) order by b.name,b.id)
      from public.profile_banner_catalog b
      left join public.member_owned_banners o on o.banner_id=b.id and o.user_id=target_user_id
      left join public.member_equipped_banners e on e.banner_id=b.id and e.user_id=target_user_id
      where b.active or o.banner_id is not null),'[]'::jsonb),
    'equipped_banner_id',(select banner_id from public.member_equipped_banners where user_id=target_user_id)
  );
end;
$$;
create or replace function public.get_chota_shop_state()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := public.lock_banner_shop_actor();
begin
 perform public.assert_account_security();
 return jsonb_build_object(
  'balance',(select balance from public.member_coin_wallets where user_id=actor),
  'room_style',(select s.item_id from public.member_chota_room_style s join public.chota_item_catalog c on c.id=s.item_id where s.user_id=actor and public.chota_item_is_room_style(c.art_key,c.presentation)),
  'items',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'description',c.description,'art_key',c.art_key,'presentation',c.presentation,'price',c.price,'active',c.active,'owned',o.item_id is not null) order by c.sort_order,c.id)
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
   where o.user_id=actor and o.item_id=target_item_id and public.chota_item_is_room_style(c.art_key,c.presentation)) then
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
 if public.chota_item_is_room_style(item.art_key,item.presentation) then
  insert into public.member_chota_room_style(user_id,item_id) values(actor,item.id)
   on conflict(user_id) do update set item_id=excluded.item_id,updated_at=now();
 end if;
 return public.get_chota_shop_state() || jsonb_build_object('item_id',item.id,'purchased',true);
end;
$$;
revoke all on function public.valid_shop_media_path(text,text,boolean),public.valid_shop_presentation(jsonb,text),public.chota_item_is_room_style(text,jsonb) from public,anon;
grant execute on function public.valid_shop_media_path(text,text,boolean),public.valid_shop_presentation(jsonb,text),public.chota_item_is_room_style(text,jsonb) to authenticated,service_role;
revoke all on function public.get_banner_shop_state(),public.get_member_profile_banner(uuid),public.get_member_profile_banners(uuid[]),public.get_admin_user_management_state(uuid),public.get_chota_shop_state(),public.equip_chota_room_style(text),public.buy_chota_item(text,integer) from public,anon,authenticated;
grant execute on function public.get_banner_shop_state(),public.get_member_profile_banner(uuid),public.get_member_profile_banners(uuid[]),public.get_admin_user_management_state(uuid),public.get_chota_shop_state(),public.equip_chota_room_style(text),public.buy_chota_item(text,integer) to authenticated;
notify pgrst,'reload schema';
commit;

-- Ejecutar después de supabase-banner-shop.sql. Repetible; no abre sobres ni modifica inventarios.
-- Vice City: rareza independiente, 0,5 % de peso base por extracción, 10 monedas por repetida.
-- Se conserva Rubén con el mismo ID para mantener todas las copias existentes.
begin;
alter table public.achievement_card_catalog drop constraint if exists achievement_card_catalog_edition_check;
alter table public.achievement_card_catalog add constraint achievement_card_catalog_edition_check
  check (edition in ('common','special','epic','legendary','retro','full_art','vice_city'));
insert into public.achievement_card_catalog(id,edition,kind,active)
  values ('ruben-king-vice-city','vice_city','member',true)
on conflict (id) do update set edition=excluded.edition,kind=excluded.kind,active=excluded.active;

create or replace function public.card_pack_rarity_weights()
returns table (edition text, weight integer) language sql immutable set search_path = public, pg_temp as $$
  values ('common',137),('retro',24),('special',20),('epic',12),('legendary',4),('full_art',2),('vice_city',1);
$$;

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
    'vouchers',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'name',v.name,'description',v.description,'price',v.price,
      'reward_type',v.reward_type,'reward_amount',v.reward_amount,'reward_banner_id',v.reward_banner_id,
      'owned_quantity',coalesce(o.quantity,0)) order by v.id)
      from public.reward_voucher_catalog v left join public.member_owned_reward_vouchers o on o.voucher_id=v.id and o.user_id=actor
      where v.active or o.quantity is not null),'[]'::jsonb),
    'discard_rewards',jsonb_build_object('common',1,'retro',2,'special',2,'epic',3,'legendary',5,'full_art',8,'vice_city',10)
  );
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
  select case edition when 'common' then 1 when 'retro' then 2 when 'special' then 2 when 'epic' then 3 when 'legendary' then 5 when 'full_art' then 8 when 'vice_city' then 10 end
    into reward from public.achievement_card_catalog where id=target_card_id;
  earned := copies::bigint * reward;
  update public.member_card_inventory set quantity=quantity-copies where user_id=actor and card_id=target_card_id;
  update public.member_coin_wallets set balance=balance+earned where user_id=actor returning balance into new_balance;
  insert into public.member_coin_ledger(user_id,delta,balance_after,reason,item_id,copies)
    values (actor,earned,new_balance,'duplicate_discard',target_card_id,copies);
  return jsonb_build_object('card_id',target_card_id,'quantity',held-copies,'coins_earned',earned,'balance',new_balance);
end;
$$;

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
      case c.edition when 'common' then 1 when 'retro' then 2 when 'special' then 2 when 'epic' then 3 when 'legendary' then 5 when 'full_art' then 8 when 'vice_city' then 10 end as reward
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
revoke all on function public.card_pack_rarity_weights() from public, anon, authenticated;
revoke all on function public.get_banner_shop_state(), public.discard_duplicate_card(text,integer),
 public.discard_all_duplicate_cards() from public, anon, authenticated;
grant execute on function public.get_banner_shop_state(), public.discard_duplicate_card(text,integer),
 public.discard_all_duplicate_cards() to authenticated;

create or replace function public.open_owned_card_pack(target_pack_id bigint default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  actor uuid := public.lock_banner_shop_actor();
  saved_pack public.card_packs%rowtype;
  selected_edition text;
  card public.achievement_card_catalog%rowtype;
  new_quantity integer;
  draw_number integer;
  selected_kind text;
  kind_quota record;
  draw_kinds text[] := array['member','member','member','object','object','location'];
  drawn_cards jsonb := '[]'::jsonb;
  drawn_ids text[] := '{}'::text[];
begin
  select * into saved_pack from public.card_packs where user_id=actor and opened_at is null
    and (target_pack_id is null or id=target_pack_id) and collection_key='los-nuestros-01'
    order by earned_day,id limit 1 for update;
  if not found then raise exception 'No tienes ese sobre disponible para abrir.'; end if;
  -- Check every category before awarding anything. Only drawable rarities count.
  for kind_quota in select * from (values
    ('member',3,'miembros'),('object',2,'objetos'),('location',1,'ubicación')
  ) as quotas(kind,required,label) loop
    if (select count(*) from public.achievement_card_catalog c
      where c.active and c.kind=kind_quota.kind and exists (
        select 1 from public.card_pack_rarity_weights() w where w.edition=c.edition and w.weight>0
      )) < kind_quota.required then
      raise exception 'La colección necesita al menos % cartas distintas de % para abrir un sobre.',
        kind_quota.required,kind_quota.label;
    end if;
  end loop;
  -- Exactly 3 members, 2 objects and 1 location, all with distinct IDs.
  -- Choose weighted rarity within the required category, then a uniform card.
  -- Unavailable/exhausted rarities in that category are excluded and weights renormalized.
  -- Inventory writes and pack consumption commit together or roll back together.
  for draw_number in 1..6 loop
    selected_kind := draw_kinds[draw_number];
    select v.edition into selected_edition from public.card_pack_rarity_weights() v
      where v.weight>0 and exists (select 1 from public.achievement_card_catalog c
        where c.active and c.kind=selected_kind and c.edition=v.edition and not (c.id=any(drawn_ids)))
      order by -ln(greatest(random(),0.000000000001))/v.weight limit 1;
    select * into card from public.achievement_card_catalog
      where active and kind=selected_kind and edition=selected_edition and not (id=any(drawn_ids))
      order by random() limit 1 for share;
    if not found then raise exception 'No hay cartas disponibles de esta categoría en la colección.'; end if;
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

notify pgrst, 'reload schema';
commit;

-- Verificación de solo lectura: no abre sobres, descarta cartas ni concede premios.
select id,edition,kind,active from public.achievement_card_catalog
where id='ruben-king-vice-city';

select edition,weight,round(100.0*weight/sum(weight) over (),2) as base_percent,
  sum(weight) over () as total_weight
from public.card_pack_rarity_weights();
select sum(base_percent) as total_base_percent from (
  select 100.0*weight/sum(weight) over () as base_percent from public.card_pack_rarity_weights()
) probabilities;

select p.oid::regprocedure as rpc,p.prosecdef as security_definer,
  case when p.proname='get_banner_shop_state' then
    pg_get_functiondef(p.oid) like '%''vice_city'', 10%' or pg_get_functiondef(p.oid) like '%''vice_city'',10%'
  else pg_get_functiondef(p.oid) like '%WHEN ''vice_city''%10%' or pg_get_functiondef(p.oid) like '%when ''vice_city'' then 10%'
  end as vice_city_reward_10
from pg_proc p where p.oid in ('public.get_banner_shop_state()'::regprocedure,
  'public.discard_duplicate_card(text,integer)'::regprocedure,'public.discard_all_duplicate_cards()'::regprocedure);

select p.oid::regprocedure as rpc,p.prosecdef as security_definer,
  pg_get_functiondef(p.oid) like '%array[''member'',''member'',''member'',''object'',''object'',''location'']%' as quotas_3_2_1,
  pg_get_functiondef(p.oid) like '%c.kind=selected_kind%' as rarity_filtered_by_kind,
  pg_get_functiondef(p.oid) like '%not (c.id=any(drawn_ids))%' as distinct_card_ids
from pg_proc p where p.oid='public.open_owned_card_pack(bigint)'::regprocedure;

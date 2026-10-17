-- Ejecutar después de la economía de banners. Repetible; no concede cartas ni modifica inventarios.
-- Full Art: 1% de peso base por extracción. Rarezas agotadas en el mismo sobre se excluyen
-- para mantener seis cartas distintas; los pesos restantes se renormalizan.
begin;
alter table public.achievement_card_catalog drop constraint if exists achievement_card_catalog_edition_check;
alter table public.achievement_card_catalog add constraint achievement_card_catalog_edition_check
  check (edition in ('common','special','epic','legendary','retro','full_art','vice_city'));
insert into public.achievement_card_catalog(id,edition,kind,active)
  values ('jose-enrique-fernandez-cruz-full-art','full_art','member',true)
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
notify pgrst, 'reload schema';
commit;
-- Resultado verificable: Full Art activa, 1 % base; siete rarezas, peso total 200.
select c.id,c.edition,c.kind,c.active,round(100.0*w.weight/(select sum(weight) from public.card_pack_rarity_weights()),2) as base_percent,
 (select sum(weight) from public.card_pack_rarity_weights()) as total_weight
from public.achievement_card_catalog c join public.card_pack_rarity_weights() w on c.edition=w.edition
where c.id='jose-enrique-fernandez-cruz-full-art';

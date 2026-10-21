-- Ejecutar después de supabase-banner-shop.sql; repetible.
-- Cambia únicamente la RPC de apertura. CREATE OR REPLACE conserva sus permisos.
-- Nuevos sobres: 3 miembros, 2 objetos y 1 ubicación, sin repetir IDs.
-- No cambia sobres ya abiertos, inventarios, saldos ni pesos de rareza.
begin;

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

commit;

-- Verificación de solo lectura: no abre ni consume sobres de ningún usuario.
select p.oid::regprocedure as rpc,
  p.prosecdef as security_definer,
  pg_get_functiondef(p.oid) like '%array[''member'',''member'',''member'',''object'',''object'',''location'']%' as quotas_3_2_1,
  pg_get_functiondef(p.oid) like '%c.kind=selected_kind%' as rarity_filtered_by_kind
from pg_proc p
where p.oid='public.open_owned_card_pack(bigint)'::regprocedure;

select q.kind,q.required,count(c.id) as available_cards,
  count(c.id)>=q.required as sufficient_catalog
from (values ('member',3),('object',2),('location',1)) as q(kind,required)
left join public.achievement_card_catalog c on c.kind=q.kind and c.active
  and exists (select 1 from public.card_pack_rarity_weights() w where w.edition=c.edition and w.weight>0)
group by q.kind,q.required
order by q.required desc;

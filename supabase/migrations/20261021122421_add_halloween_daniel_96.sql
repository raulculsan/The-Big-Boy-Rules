-- Halloween is a distinct collectible rarity. 1% is applied to every eligible
-- member slot; an already drawn card is excluded to keep six distinct cards.
begin;
alter table public.achievement_card_catalog drop constraint achievement_card_catalog_edition_check;
alter table public.achievement_card_catalog add constraint achievement_card_catalog_edition_check
 check(edition in ('common','special','epic','legendary','retro','full_art','vice_city','halloween'));
insert into public.achievement_card_catalog(id,edition,kind,active,collection_key)
 values('daniel-gonzalez-motos-halloween','halloween','member',true,'los-nuestros-01')
 on conflict(id) do update set edition=excluded.edition,kind=excluded.kind,active=excluded.active,collection_key=excluded.collection_key;
-- Preserve the administrator's other percentages (including Vice City).
update public.club_economy_configuration set
 rarity_weights=jsonb_set(rarity_weights,'{common}',to_jsonb((rarity_weights->>'common')::integer-100))||'{"halloween":100}'::jsonb,
 revision=revision+1,updated_at=now()
 where singleton and not(rarity_weights?'halloween');
-- Update existing functions rather than replacing their security policy or privileges.
do $migration$
declare fn regprocedure; original text; updated text;
begin
 foreach fn in array array['public.admin_save_club_economy(bigint,jsonb,jsonb)'::regprocedure,
 'public.get_banner_shop_state()'::regprocedure,'public.discard_duplicate_card(text,integer)'::regprocedure,
 'public.discard_all_duplicate_cards()'::regprocedure] loop
 original:=pg_get_functiondef(fn);
 updated:=replace(original,'''full_art'',''vice_city'']','''full_art'',''vice_city'',''halloween'']');
 updated:=replace(updated,'when ''vice_city'' then 10','when ''vice_city'' then 10 when ''halloween'' then 10');
 updated:=replace(updated,'''vice_city'',10)','''vice_city'',10,''halloween'',10)');
 if updated=original then raise exception 'Expected Halloween update not found in %',fn; end if;
 execute updated;
 end loop;
end;
$migration$;
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
    -- Halloween has its configured probability per eligible member slot;
    -- other rarities retain their relative weights within that category.
    selected_edition := null;
    if selected_kind='member' and exists(select 1 from public.achievement_card_catalog c
      where c.active and c.kind=selected_kind and c.edition='halloween' and not(c.id=any(drawn_ids)))
      and random() < coalesce((select sum(weight) filter(where edition='halloween')::numeric/nullif(sum(weight),0)
        from public.card_pack_rarity_weights()),0) then
      selected_edition := 'halloween';
    else
      select v.edition into selected_edition from public.card_pack_rarity_weights() v
        where v.weight>0 and (selected_kind<>'member' or v.edition<>'halloween')
          and exists (select 1 from public.achievement_card_catalog c
            where c.active and c.kind=selected_kind and c.edition=v.edition and not(c.id=any(drawn_ids)))
        order by -ln(greatest(random(),0.000000000001))/v.weight limit 1;
    end if;
    -- If a category has exhausted all alternatives, keep the pack completable.
    if selected_edition is null then
      select v.edition into selected_edition from public.card_pack_rarity_weights() v
        where v.weight>0 and exists(select 1 from public.achievement_card_catalog c
          where c.active and c.kind=selected_kind and c.edition=v.edition and not(c.id=any(drawn_ids)))
        order by -ln(greatest(random(),0.000000000001))/v.weight limit 1;
    end if;
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

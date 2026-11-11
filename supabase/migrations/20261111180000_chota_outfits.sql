-- Saved Chota outfits: up to four named snapshots of what the Chota wears
-- (coat, top, trousers, shoes, and which original garments were taken off).
-- Wearing one re-checks ownership of every garment, like equipping by hand.
begin;
create table if not exists public.member_chota_outfits (
  user_id uuid not null references public.profiles(id) on delete cascade,
  position smallint not null check (position between 1 and 4),
  name text not null check (char_length(name) between 1 and 24),
  items jsonb not null default '{}'::jsonb check (jsonb_typeof(items) = 'object'),
  removed_original_slots text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, position)
);
alter table public.member_chota_outfits enable row level security;
revoke all on public.member_chota_outfits from public, anon, authenticated;
grant all on public.member_chota_outfits to service_role;

create or replace function public.get_chota_outfits()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := (select auth.uid());
begin
  if actor is null then raise exception 'Inicia sesión.' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('position', position, 'name', name, 'items', items, 'removed_original_slots', removed_original_slots) order by position)
    from public.member_chota_outfits where user_id = actor), '[]'::jsonb);
end $$;

create or replace function public.save_chota_outfit(p_position integer, p_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := public.lock_banner_shop_actor(); clean text := btrim(coalesce(p_name, ''));
begin
  perform public.assert_account_security();
  if p_position is null or p_position not between 1 and 4 then raise exception 'Elige uno de los cuatro huecos.' using errcode = '22023'; end if;
  if char_length(clean) not between 1 and 24 then raise exception 'Ponle un nombre de hasta 24 letras.' using errcode = '22023'; end if;
  insert into public.member_chota_outfits(user_id, position, name, items, removed_original_slots)
  values (actor, p_position, clean,
    coalesce((select jsonb_object_agg(slot, item_id) from public.member_chota_clothing where user_id = actor and slot in ('outerwear','topwear','bottomwear','footwear')), '{}'::jsonb),
    coalesce((select removed_original_slots from public.member_chota_wardrobe_preferences where user_id = actor), '{}'))
  on conflict (user_id, position) do update set name = excluded.name, items = excluded.items, removed_original_slots = excluded.removed_original_slots, updated_at = now();
  return public.get_chota_outfits();
end $$;

create or replace function public.delete_chota_outfit(p_position integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := public.lock_banner_shop_actor();
begin
  delete from public.member_chota_outfits where user_id = actor and position = p_position;
  return public.get_chota_outfits();
end $$;

create or replace function public.wear_chota_outfit(p_position integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := public.lock_banner_shop_actor(); outfit public.member_chota_outfits%rowtype; slot_name text; wanted text;
begin
  perform public.assert_account_security();
  select * into outfit from public.member_chota_outfits where user_id = actor and position = p_position;
  if not found then raise exception 'Ese conjunto ya no existe.' using errcode = '22023'; end if;
  foreach slot_name in array array['outerwear','topwear','bottomwear','footwear'] loop
    wanted := outfit.items ->> slot_name;
    if wanted is not null and not exists (
      select 1 from public.chota_item_catalog c where c.id = wanted and c.item_kind = 'clothing' and c.slot = slot_name and public.chota_clothing_supported(c.slot, c.rig_version)
        and (c.id = public.chota_original_item(slot_name) or exists (select 1 from public.member_owned_chota_items o where o.user_id = actor and o.item_id = c.id))
    ) then raise exception 'Este conjunto lleva una prenda que ya no tienes.' using errcode = '42501'; end if;
  end loop;
  delete from public.member_chota_clothing where user_id = actor and slot in ('outerwear','topwear','bottomwear','footwear');
  foreach slot_name in array array['outerwear','topwear','bottomwear','footwear'] loop
    wanted := outfit.items ->> slot_name;
    continue when wanted is null;
    if wanted = public.chota_original_item(slot_name) then
      insert into public.member_owned_chota_items(user_id, item_id, paid_price, balance_after)
      select actor, wanted, 0, balance from public.member_coin_wallets where user_id = actor on conflict (user_id, item_id) do nothing;
    end if;
    insert into public.member_chota_clothing(user_id, slot, item_id) values (actor, slot_name, wanted);
  end loop;
  insert into public.member_chota_wardrobe_preferences(user_id, removed_original_slots) values (actor, outfit.removed_original_slots)
  on conflict (user_id) do update set removed_original_slots = excluded.removed_original_slots, updated_at = now();
  return public.get_chota_shop_state();
end $$;

revoke all on function public.get_chota_outfits(), public.save_chota_outfit(integer, text), public.delete_chota_outfit(integer), public.wear_chota_outfit(integer) from public, anon;
grant execute on function public.get_chota_outfits(), public.save_chota_outfit(integer, text), public.delete_chota_outfit(integer), public.wear_chota_outfit(integer) to authenticated;
notify pgrst, 'reload schema';
commit;

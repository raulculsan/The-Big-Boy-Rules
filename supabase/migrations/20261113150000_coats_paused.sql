-- Coats paused while they are redrawn pose by pose (user decision, 2026-11-13).
-- Coats leave the shop and no Chota shows one, but nothing is lost: purchases
-- (member_owned_chota_items), worn coats (member_chota_clothing) and saved
-- outfits stay as they are. To bring them back:
--   update public.chota_item_catalog set active = true where slot = 'outerwear';
-- and every member sees again the coat they had on.
begin;
update public.chota_item_catalog set active = false where slot = 'outerwear' and item_kind = 'clothing';

do $$
declare definition text;
begin
  -- The state hides inactive coats: not listed, not worn.
  definition := pg_get_functiondef('public.get_chota_shop_state()'::regprocedure);
  if position('where c.active or o.item_id is not null)' in definition) = 0 or position('and c.item_kind=''clothing'';' in definition) = 0 then raise exception 'get_chota_shop_state changed; review this migration.'; end if;
  definition := replace(definition, 'where c.active or o.item_id is not null)', 'where (c.active or o.item_id is not null) and (c.active or c.slot is distinct from ''outerwear''))');
  definition := replace(definition, 'and c.item_kind=''clothing'';', 'and c.item_kind=''clothing'' and (c.active or c.slot<>''outerwear'');');
  execute definition;

  -- Equipping a paused coat says so instead of failing silently.
  definition := pg_get_functiondef('public.equip_chota_outerwear(text)'::regprocedure);
  if position('perform public.assert_account_security();' in definition) = 0 then raise exception 'equip_chota_outerwear changed; review this migration.'; end if;
  execute replace(definition, 'perform public.assert_account_security();', 'perform public.assert_account_security();
 if target_item_id is not null and exists(select 1 from public.chota_item_catalog where id=target_item_id and slot=''outerwear'' and not active) then raise exception ''Los abrigos están en el taller. Vuelven pronto.'' using errcode=''22023''; end if;');

  definition := pg_get_functiondef('public.equip_chota_clothing(text,text)'::regprocedure);
  if position('perform public.assert_account_security();' in definition) = 0 then raise exception 'equip_chota_clothing changed; review this migration.'; end if;
  execute replace(definition, 'perform public.assert_account_security();', 'perform public.assert_account_security();
 if target_slot=''outerwear'' and target_item_id is not null and exists(select 1 from public.chota_item_catalog where id=target_item_id and slot=''outerwear'' and not active) then raise exception ''Los abrigos están en el taller. Vuelven pronto.'' using errcode=''22023''; end if;');
end $$;
notify pgrst, 'reload schema';
commit;

-- Coats paused (2026-11-13), second step at the user's request: whoever still
-- had one on takes it off, and wearing a saved outfit skips a paused coat.
-- Purchases stay; re-enabling coats does not put them back on.
begin;
delete from public.member_chota_clothing c using public.chota_item_catalog i
 where c.item_id = i.id and c.slot = 'outerwear' and not i.active;

do $$
declare definition text := pg_get_functiondef('public.wear_chota_outfit(integer)'::regprocedure);
begin
  if position('continue when wanted is null;' in definition) = 0 then raise exception 'wear_chota_outfit changed; review this migration.'; end if;
  execute replace(definition, 'continue when wanted is null;', 'continue when wanted is null;
    continue when slot_name = ''outerwear'' and exists(select 1 from public.chota_item_catalog where id = wanted and not active);');
end $$;
notify pgrst, 'reload schema';
commit;

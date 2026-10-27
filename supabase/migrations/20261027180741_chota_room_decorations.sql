-- Permanent decorations share the existing, server-authoritative Chota shop.
-- Ownership, wallet locking, ledger writes and admin prices use its current RPCs.
-- Seasonal artwork remains independent in the client and is never purchased.
begin;
insert into public.chota_item_catalog (id,name,description,art_key,price,active,sort_order) values
  ('chota-warm-lights','Guirnalda cálida','Pequeñas luces de ámbar colgadas de las vigas de la sede.','warm-lights',25,true,10),
  ('chota-club-neon','Neón BB','El emblema del club, encendido sobre la pared de la habitación.','club-neon',45,true,11),
  ('chota-club-cushion','Cojín del club','Un cojín de lona bordada, apoyado en el sofá.','club-cushion',18,true,12),
  ('chota-vintage-radio','Radio vintage','Una radio de madera que encuentra su hueco en el mueble de la sede.','vintage-radio',30,true,13)
on conflict (id) do nothing;
commit;

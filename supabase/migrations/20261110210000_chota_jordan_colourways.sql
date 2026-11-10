-- Four Jordan colourways for the Chota (Codex, artwork/chota/wardrobe-shoes-v1):
-- the same high-top as his Chicago pair, recoloured over all 67 poses. Served
-- as five-sheet atlases from shop-media/chota/wardrobe/shoes-v1/, bought and
-- equipped with the existing clothing purchase in the footwear slot.
begin;
insert into public.chota_item_catalog(id,name,description,art_key,price,active,sort_order,item_kind,slot,wardrobe_key,rig_version,garment)
select v.id, v.name, v.description, v.art_key, 100, true, v.sort_order, 'clothing', 'footwear', v.art_key, 'chota-footwear-overlay-v1',
  jsonb_build_object('type','atlas','cell',256,'atlases',jsonb_build_object(
    'base',      'chota/wardrobe/shoes-v1/'||v.colour||'-base-v1.webp',
    'directional','chota/wardrobe/shoes-v1/'||v.colour||'-directional-v1.webp',
    'contextual','chota/wardrobe/shoes-v1/'||v.colour||'-contextual-v1.webp',
    'room',      'chota/wardrobe/shoes-v1/'||v.colour||'-room-v1.webp',
    'talk',      'chota/wardrobe/shoes-v1/'||v.colour||'-talk-v1.webp'))
from (values
  ('chota-jordan-royal-v1','Jordan Royal','Bota alta azul royal con la puntera blanca y los cordones negros.','jordan-royal','royal',391),
  ('chota-jordan-graphite-v1','Jordan Graphite','Bota alta gris grafito con la puntera blanca y los cordones negros.','jordan-graphite','graphite',392),
  ('chota-jordan-pine-v1','Jordan Pine','Bota alta verde pino con la puntera blanca y los cordones negros.','jordan-pine','pine',393),
  ('chota-jordan-mocha-v1','Jordan Mocha','Bota alta marrón moca con la puntera crema y los cordones negros.','jordan-mocha','mocha',394)
) as v(id,name,description,art_key,colour,sort_order)
on conflict(id) do update set name=excluded.name,description=excluded.description,art_key=excluded.art_key,price=excluded.price,active=true,
  sort_order=excluded.sort_order,item_kind=excluded.item_kind,slot=excluded.slot,wardrobe_key=excluded.wardrobe_key,rig_version=excluded.rig_version,garment=excluded.garment;
commit;

-- Versioned public media published before activation. Reuses daily rotation and purchase/equip RPCs.
insert into public.profile_banner_catalog (id,name,description,art_key,price,active)
values
  ('duelo-mirada-v1','Duelo · Cara a cara','Jose Enrique y Miguel se miran en silencio, con el viento moviendo el bosque.','duelo-mirada-v1',200,true),
  ('duelo-golpe-v1','Duelo · Choque','Jose Enrique y Miguel se lanzan y sus puños estallan al chocar.','duelo-golpe-v1',200,true),
  ('duelo-cruce-v1','Duelo · Cruce','Jose Enrique y Miguel caminan el uno hacia el otro hasta cruzar miradas.','duelo-cruce-v1',200,true)
on conflict (id) do update set name=excluded.name,description=excluded.description,
  art_key=excluded.art_key,active=true;
-- Preserve any price already configured by administration when reapplied.

-- Versioned public media uploaded before activation. Reuses daily rotation and purchase/equip RPCs.
insert into public.profile_banner_catalog (id,name,description,art_key,price,active)
values ('jose-enrique-ojos-v1','José Enrique · Mirada de neón','Primer plano de José Enrique bajo la lluvia, con los ojos iluminándose entre luces de neón.','jose-enrique-ojos-v1',100,true)
on conflict (id) do update set name=excluded.name,description=excluded.description,
  art_key=excluded.art_key,active=true;
-- Preserve any price already configured by administration when reapplied.

-- Uses the existing authenticated purchase/equip RPCs and daily rotation.
-- Media was published first under group-media/banners, with versioned public URLs.
insert into public.profile_banner_catalog (id,name,description,art_key,price,active)
values ('fufi-supervuelo-v1','Fufi · Supervuelo','Fufi vuela entre las nubes con su traje de superheroína y su capa al viento.','fufi-supervuelo-v1',100,true)
on conflict (id) do update set name=excluded.name,description=excluded.description,
  art_key=excluded.art_key,active=true;
-- Preserve a price changed by administration when the migration is reapplied.

-- Extra 3:1 banners make a five-item daily rotation possible. Keep any
-- price or availability changes made by administration on later deploys.
begin;
insert into public.profile_banner_catalog(id,name,description,art_key,price,active)
values
 ('madrid-medianoche-v1','Madrid · Medianoche','Luces de la ciudad y reflejos después de la lluvia.','madrid-medianoche-v1',1,true),
 ('costa-atlantica-v1','Costa · Amanecer','Acantilados, olas y el primer sol del Atlántico.','costa-atlantica-v1',1,true)
on conflict(id) do nothing;
commit;

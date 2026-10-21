-- Common Madrid Metro location cards.
insert into public.achievement_card_catalog(id, edition, kind, active)
values ('abrantes-metro-comun', 'common', 'location', true),
       ('plaza-eliptica-metro-comun', 'common', 'location', true)
on conflict (id) do update
set edition = excluded.edition, kind = excluded.kind, active = excluded.active;

select id, edition, kind, active from public.achievement_card_catalog
where id in ('abrantes-metro-comun', 'plaza-eliptica-metro-comun');

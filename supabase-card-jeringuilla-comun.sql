-- Jeringuilla common object card.
insert into public.achievement_card_catalog(id, edition, kind, active)
values ('jeringuilla-comun', 'common', 'object', true)
on conflict (id) do update
set edition = excluded.edition, kind = excluded.kind, active = excluded.active;

select id, edition, kind, active, collection_key from public.achievement_card_catalog
where id = 'jeringuilla-comun';

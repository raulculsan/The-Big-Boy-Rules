-- Five Special cards with the unified silver and teal design.
insert into public.achievement_card_catalog(id, edition, kind, active, collection_key)
values ('el-retiro-especial', 'special', 'location', true, 'los-nuestros-01'),
       ('bajos-de-arguelles-especial', 'special', 'location', true, 'los-nuestros-01'),
       ('ikea-la-gavia-especial', 'special', 'location', true, 'los-nuestros-01'),
       ('pistola-de-balines-especial', 'special', 'object', true, 'los-nuestros-01'),
       ('mochila-carhartt-especial', 'special', 'object', true, 'los-nuestros-01')
on conflict (id) do update
set edition = excluded.edition, kind = excluded.kind, active = excluded.active, collection_key = excluded.collection_key;

select id, edition, kind, active, collection_key from public.achievement_card_catalog
where id in ('el-retiro-especial', 'bajos-de-arguelles-especial', 'ikea-la-gavia-especial', 'pistola-de-balines-especial', 'mochila-carhartt-especial') order by id;

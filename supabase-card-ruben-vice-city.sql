-- Ejecutar después de supabase-vice-city.sql: rareza independiente Vice City.
insert into public.achievement_card_catalog(id, edition, kind, active)
values ('ruben-king-vice-city', 'vice_city', 'member', true)
on conflict (id) do update
set edition = excluded.edition, kind = excluded.kind, active = excluded.active;

select id, edition, kind, active from public.achievement_card_catalog
where id = 'ruben-king-vice-city';

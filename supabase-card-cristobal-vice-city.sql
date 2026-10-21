-- Ejecutar después de supabase-vice-city.sql.
-- Personaje es la etiqueta visual; usa member en el sorteo 3/2/1.
-- Arte cliente: icons/cards/cristobal-fabrik-vice-city-91-v2.png (91 PTS).
-- Reverso: icons/cards/reverso-vice-city-unificado-v1.png.
insert into public.achievement_card_catalog(id, edition, kind, active)
values ('cristobal-fabrik-vice-city', 'vice_city', 'member', true)
on conflict (id) do update
set edition = excluded.edition, kind = excluded.kind, active = excluded.active;

select id, edition, kind, active from public.achievement_card_catalog
where id = 'cristobal-fabrik-vice-city';

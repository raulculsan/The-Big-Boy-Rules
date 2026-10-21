-- Ejecutar después de supabase-vice-city.sql.
-- Personaje es la etiqueta visual; usa member en el sorteo 3/2/1.
-- Arte cliente: icons/cards/francisco-trigo-vice-city-90-v2.png (90 PTS).
-- Reverso: icons/cards/reverso-vice-city-unificado-v1.png.
insert into public.achievement_card_catalog(id, edition, kind, active)
values ('francisco-trigo-vice-city', 'vice_city', 'member', true)
on conflict (id) do update
set edition = excluded.edition, kind = excluded.kind, active = excluded.active;

select id, edition, kind, active from public.achievement_card_catalog
where id = 'francisco-trigo-vice-city';

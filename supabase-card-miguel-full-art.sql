-- Ejecutar después de supabase-full-art.sql.
-- Nueva edición independiente: conserva la carta normal de Miguel Ángel.
-- Arte cliente: icons/cards/miguel-angel-jimenez-sanchez-full-art-92-v1.png (92 PTS).
-- Reverso: icons/cards/reverso-full-art-unificado-v1.png.
insert into public.achievement_card_catalog(id, edition, kind, active)
values ('miguel-angel-jimenez-sanchez-full-art', 'full_art', 'member', true)
on conflict (id) do update
set edition = excluded.edition, kind = excluded.kind, active = excluded.active;

select id, edition, kind, active from public.achievement_card_catalog
where id = 'miguel-angel-jimenez-sanchez-full-art';

-- FUFI: Personaje Vice City, 89 PTS. Approved art v3, 948 x 1659.
-- Uses member for the existing 3/2/1 pack distribution.
insert into public.achievement_card_catalog(id, edition, kind, active)
values ('fufi-vice-city', 'vice_city', 'member', true)
on conflict (id) do update
set edition = excluded.edition, kind = excluded.kind, active = excluded.active;

select id, edition, kind, active from public.achievement_card_catalog
where id = 'fufi-vice-city';

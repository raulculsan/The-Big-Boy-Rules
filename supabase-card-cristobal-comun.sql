-- Cristobal Fabrik common character card.
-- Display label is Personaje; database kind stays member for the 3/2/1 pack split.
-- Art: icons/cards/cristobal-fabrik-comun-75-v1.png (75 PTS).
insert into public.achievement_card_catalog(id, edition, kind, active)
values ('cristobal-fabrik-comun', 'common', 'member', true)
on conflict (id) do update
set edition = excluded.edition, kind = excluded.kind, active = excluded.active;

select id, edition, kind, active from public.achievement_card_catalog
where id = 'cristobal-fabrik-comun';

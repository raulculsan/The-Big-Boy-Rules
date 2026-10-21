-- AZUL common character card, 77 PTS.
-- Visual kind is Personaje; member preserves the 3/2/1 pack distribution.
insert into public.achievement_card_catalog(id, edition, kind, active)
values ('azul-comun', 'common', 'member', true)
on conflict (id) do update
set edition = excluded.edition, kind = excluded.kind, active = excluded.active;

select id, edition, kind, active from public.achievement_card_catalog
where id = 'azul-comun';

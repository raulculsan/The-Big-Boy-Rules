-- Juan Carlos Vega Quevedo common character card, 78 PTS.
-- Visual kind is Personaje; member preserves the 3/2/1 pack distribution.
insert into public.achievement_card_catalog(id, edition, kind, active)
values ('juan-carlos-vega-quevedo-comun', 'common', 'member', true)
on conflict (id) do update
set edition = excluded.edition, kind = excluded.kind, active = excluded.active;

select id, edition, kind, active from public.achievement_card_catalog
where id = 'juan-carlos-vega-quevedo-comun';

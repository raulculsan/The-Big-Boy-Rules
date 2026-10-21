insert into public.achievement_card_catalog(id, edition, kind, active)
values ('peru-comun', 'common', 'location', true)
on conflict (id) do update
set edition = excluded.edition, kind = excluded.kind, active = excluded.active;

select id, edition, kind, active from public.achievement_card_catalog
where id = 'peru-comun';

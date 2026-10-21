insert into public.achievement_card_catalog(id, edition, kind, active)
values ('daniel-gonzalez-motos-full-art', 'full_art', 'member', true)
on conflict (id) do update
set edition = excluded.edition, kind = excluded.kind, active = excluded.active;

select id, edition, kind, active from public.achievement_card_catalog
where id = 'daniel-gonzalez-motos-full-art';

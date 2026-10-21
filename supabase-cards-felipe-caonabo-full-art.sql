insert into public.achievement_card_catalog(id, edition, kind, active)
values ('felipe-hp-full-art', 'full_art', 'member', true),
       ('caonabo-alberto-full-art', 'full_art', 'member', true)
on conflict (id) do update
set edition = excluded.edition, kind = excluded.kind, active = excluded.active;

select id, edition, kind, active from public.achievement_card_catalog
where id in ('felipe-hp-full-art','caonabo-alberto-full-art') order by id;

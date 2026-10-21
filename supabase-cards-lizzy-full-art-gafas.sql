insert into public.achievement_card_catalog(id, edition, kind, active)
values ('lizzy-machado-yong-full-art', 'full_art', 'member', true),
       ('gafas-vision-nocturna-epicas', 'epic', 'object', true)
on conflict (id) do update set edition = excluded.edition, kind = excluded.kind, active = excluded.active;

select id, edition, kind, active from public.achievement_card_catalog
where id in ('lizzy-machado-yong-full-art','gafas-vision-nocturna-epicas') order by id;

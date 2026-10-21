-- STÜSSY MADRID epic location card (corrected natural-color artwork v2).
insert into public.achievement_card_catalog(id, edition, kind, active)
values ('stussy-madrid-epica', 'epic', 'location', true)
on conflict (id) do update
set edition = excluded.edition, kind = excluded.kind, active = excluded.active;

select id, edition, kind, active from public.achievement_card_catalog
where id = 'stussy-madrid-epica';

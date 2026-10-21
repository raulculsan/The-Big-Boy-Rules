-- Historic stadium locations for Los Nuestros collection.
insert into public.achievement_card_catalog(id, edition, kind, active)
values
  ('estadio-vicente-calderon-retro', 'retro', 'location', true),
  ('estadio-santiago-bernabeu-retro', 'retro', 'location', true)
on conflict (id) do update
set edition = excluded.edition, kind = excluded.kind, active = excluded.active;

select id, edition, kind, active from public.achievement_card_catalog
where id in ('estadio-vicente-calderon-retro', 'estadio-santiago-bernabeu-retro')
order by id;

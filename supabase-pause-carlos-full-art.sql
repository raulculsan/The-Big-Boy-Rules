update public.achievement_card_catalog
set active = false
where id = 'carlos-gonzalez-motos-full-art';

select id, edition, kind, active from public.achievement_card_catalog
where id = 'carlos-gonzalez-motos-full-art';

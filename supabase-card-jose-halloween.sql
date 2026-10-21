-- Add Jose Enrique to the existing Halloween pool; keep the rarity odds unchanged.
insert into public.achievement_card_catalog (id, edition, kind, active, collection_key)
values ('jose-enrique-fernandez-cruz-halloween', 'halloween', 'member', true, 'los-nuestros-01')
on conflict (id) do update set edition=excluded.edition, kind=excluded.kind,
 active=excluded.active, collection_key=excluded.collection_key;

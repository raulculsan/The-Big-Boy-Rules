begin;
insert into public.achievement_card_catalog (id, edition, kind, active, collection_key)
values ('jose-enrique-fernandez-cruz-vice-city', 'vice_city', 'member', false, 'los-nuestros-01')
on conflict (id) do update set edition=excluded.edition, kind=excluded.kind, collection_key=excluded.collection_key;
insert into public.published_card_designs
(id,collection_key,collection_name,display_name,display_kind,rarity,score,front_url,back_url,thumbnail_url,width,height,published,updated_at)
values ('jose-enrique-fernandez-cruz-vice-city','los-nuestros-01','Los nuestros · Colección 01','JOSE ENRIQUE FERNANDEZ CRUZ','Miembro','vice_city',98,
'https://nfvggpgeypkkqceivkaq.supabase.co/storage/v1/object/public/card-artwork/jose-enrique-fernandez-cruz-vice-city-98-v2.png',
'https://raulculsan.github.io/The-Big-Boy-Rules/icons/cards/reverso-vice-city-unificado-v1.jpg',
'https://nfvggpgeypkkqceivkaq.supabase.co/storage/v1/object/public/card-artwork/jose-enrique-fernandez-cruz-vice-city-98-mini-v2.jpg',948,1660,true,now())
on conflict(id) do update set display_name=excluded.display_name, display_kind=excluded.display_kind, rarity=excluded.rarity, score=excluded.score, front_url=excluded.front_url, back_url=excluded.back_url, thumbnail_url=excluded.thumbnail_url,width=excluded.width,height=excluded.height,published=excluded.published,updated_at=excluded.updated_at;
update public.achievement_card_catalog set active=true where id='jose-enrique-fernandez-cruz-vice-city';
commit;

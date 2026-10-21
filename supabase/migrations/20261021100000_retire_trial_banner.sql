-- Retire the temporary placeholder from the daily shop and profiles while
-- preserving purchase history and ownership records.
begin;

update public.profile_banner_catalog
set active = false
where id = 'banner-de-prueba';

delete from public.member_equipped_banners
where banner_id = 'banner-de-prueba';

commit;

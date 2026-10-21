-- Replace N banner lookups on the members screen with one bounded request.
-- Run after supabase-banner-shop.sql. Hidden members stay hidden, matching
-- get_member_profile_banner; callers must themselves have a visible profile.
begin;
create or replace function public.get_member_profile_banners(target_user_ids uuid[])
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare result jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles where id=auth.uid() and not coalesce(is_hidden,false)
  ) then
    raise exception 'Inicia sesión con un perfil visible.' using errcode='42501';
  end if;
  if coalesce(cardinality(target_user_ids),0) > 200 then
    raise exception 'Demasiados perfiles en una petición.' using errcode='22023';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id',p.id,
    'banner',case when b.id is null then null else jsonb_build_object(
      'id',b.id,'name',b.name,'description',b.description,'art_key',b.art_key
    ) end
  )), '[]'::jsonb) into result
  from public.profiles p
  left join public.member_equipped_banners e on e.user_id=p.id
  left join public.profile_banner_catalog b on b.id=e.banner_id
  where p.id=any(target_user_ids) and not coalesce(p.is_hidden,false);
  return result;
end;
$$;
revoke all on function public.get_member_profile_banners(uuid[]) from public, anon, authenticated;
grant execute on function public.get_member_profile_banners(uuid[]) to authenticated;
notify pgrst, 'reload schema';
commit;

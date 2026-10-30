begin;

update storage.buckets
set allowed_mime_types = array['image/png','image/jpeg','image/webp','image/gif','image/avif','video/mp4','video/webm']
where id = 'shop-media';

create or replace function public.get_member_profile_banner(target_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  perform public.assert_account_security();
  if auth.uid() is null or not exists (select 1 from public.profiles where id=auth.uid() and not coalesce(is_hidden,false)) then
    raise exception 'Inicia sesión con un perfil visible.' using errcode='42501';
  end if;
  select jsonb_build_object('id',b.id,'name',b.name,'description',b.description,'art_key',b.art_key,'presentation',b.presentation) into result
    from public.member_equipped_banners e join public.profile_banner_catalog b on b.id=e.banner_id
    join public.profiles p on p.id=e.user_id where e.user_id=target_user_id and not coalesce(p.is_hidden,false);
  return result;
end;
$$;
revoke all on function public.get_member_profile_banner(uuid) from public, anon;
grant execute on function public.get_member_profile_banner(uuid) to authenticated;

create or replace function public.get_member_profile_banners(target_user_ids uuid[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  perform public.assert_account_security();
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
      'id',b.id,'name',b.name,'description',b.description,'art_key',b.art_key,'presentation',b.presentation
    ) end
  )), '[]'::jsonb) into result
  from public.profiles p
  left join public.member_equipped_banners e on e.user_id=p.id
  left join public.profile_banner_catalog b on b.id=e.banner_id
  where p.id=any(target_user_ids) and not coalesce(p.is_hidden,false);
  return result;
end;
$$;
revoke all on function public.get_member_profile_banners(uuid[]) from public, anon;
grant execute on function public.get_member_profile_banners(uuid[]) to authenticated;

-- Gemini raw SQL is preserved in docs/security/gemini-audit-original.sql.
-- SQL <> yields NULL when either side is NULL. Immutable profile identities need
-- a total comparison, including transitions into or out of a nullable legacy ID.
create or replace function public.protect_profile_identity()
returns trigger language plpgsql set search_path='' as $$
begin
  if coalesce(auth.role(),'') <> 'service_role'
    and not coalesce(public.current_user_is_superadmin(),false) and (
      new.id is distinct from old.id
      or new.legacy_id is distinct from old.legacy_id
      or new.username is distinct from old.username
      or (new.role is distinct from old.role and coalesce(current_setting('app.authorized_role_change',true),'') <> 'true')
      or new.is_hidden is distinct from old.is_hidden
    ) then
    raise exception 'No puedes modificar la identidad o el rol de tu cuenta';
  end if;
  return new;
end;
$$;
-- Match the bucket's raster/video MIME allowlist in both catalogue validation
-- and the client. Old SVG media cannot be introduced through a metadata update.
create or replace function public.valid_shop_media_path(value text,folder text,video boolean default false)
returns boolean language sql immutable set search_path='' as $$
  select coalesce(char_length(value) between 1 and 240 and value like folder||'/%'
    and value !~ '(^|/)\.\.?(/|$)' and value !~ '//'
    and value ~ case when video then '^[a-zA-Z0-9/_-]+\.(mp4|webm)$' else '^[a-zA-Z0-9/_-]+\.(png|jpg|jpeg|webp|gif|avif)$' end,false);
$$;
commit;

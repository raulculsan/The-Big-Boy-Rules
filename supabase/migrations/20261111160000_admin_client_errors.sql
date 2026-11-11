-- Admin view of the error reports sent by members' phones: the most recent
-- distinct errors with who hit them, how often and when. Club admins only.
begin;
create or replace function public.admin_client_errors(p_limit integer default 60)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.current_user_is_club_admin() then
    raise exception 'Solo la administración puede ver los errores.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(row_to_json(r)::jsonb order by r.last_seen desc)
    from (
      select e.id, coalesce(p.display_name, p.username, 'Miembro') as member, e.occurrences, e.first_seen, e.last_seen,
             e.payload->>'kind' as kind, e.payload->>'name' as name, e.payload->>'message' as message,
             e.payload->'frames' as frames, e.payload->>'area' as area, e.payload->>'platform' as platform,
             e.payload->>'build' as build, e.payload->'native' as native
      from public.client_error_reports e
      left join public.profiles p on p.id = e.user_id
      order by e.last_seen desc
      limit least(greatest(coalesce(p_limit, 60), 1), 200)
    ) r), '[]'::jsonb);
end $$;
revoke all on function public.admin_client_errors(integer) from public, anon;
grant execute on function public.admin_client_errors(integer) to authenticated;
notify pgrst, 'reload schema';
commit;

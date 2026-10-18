begin;

-- Presentation is readable by members; only the hidden superadmin may mutate
-- this reserved key. Restrictive policies AND with the existing permissive
-- management policies, so other keys retain their current permissions.
-- UPDATE checks both the old and new key, including attempts to rename a row.
drop policy if exists "superadmin inserts club presentation" on public.site_settings;
create policy "superadmin inserts club presentation" on public.site_settings
  as restrictive for insert to authenticated
  with check (key <> 'club_presentation_v1' or public.current_user_is_superadmin());

drop policy if exists "superadmin updates club presentation" on public.site_settings;
create policy "superadmin updates club presentation" on public.site_settings
  as restrictive for update to authenticated
  using (key <> 'club_presentation_v1' or public.current_user_is_superadmin())
  with check (key <> 'club_presentation_v1' or public.current_user_is_superadmin());

drop policy if exists "superadmin deletes club presentation" on public.site_settings;
create policy "superadmin deletes club presentation" on public.site_settings
  as restrictive for delete to authenticated
  using (key <> 'club_presentation_v1' or public.current_user_is_superadmin());

commit;

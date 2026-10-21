-- Public object URLs still work, but directory listing is limited to owners.
drop policy if exists "public group media viewing" on storage.objects;
drop policy if exists "members view own group media objects" on storage.objects;
create policy "members view own group media objects" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'group-media'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.current_user_is_superadmin())
  );

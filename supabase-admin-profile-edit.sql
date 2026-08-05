-- Ejecutar una vez en Supabase > SQL Editor.
-- Permite que el administrador del club edite perfiles y sus avatares.
drop policy if exists "members update own profile" on public.profiles;
create policy "members update own profile" on public.profiles
  for update to authenticated
  using (auth.uid() = id or public.current_user_can_manage())
  with check (auth.uid() = id or public.current_user_can_manage());

drop policy if exists "members upload own avatar" on storage.objects;
create policy "members upload own avatar" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.current_user_can_manage())
  );

drop policy if exists "members update own avatar" on storage.objects;
create policy "members update own avatar" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.current_user_can_manage())
  )
  with check (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.current_user_can_manage())
  );

drop policy if exists "members delete own avatar" on storage.objects;
create policy "members delete own avatar" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.current_user_can_manage())
  );

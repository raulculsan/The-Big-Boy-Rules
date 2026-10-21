-- Security audit: private chat uploads and replay-safe push dispatch.
-- Apply before deploying the updated client and Edge Functions.
create table if not exists public.push_dispatch_claims (
  actor_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  entity_id text not null,
  created_at timestamptz not null default now(),
  primary key (actor_id, kind, entity_id)
);
alter table public.push_dispatch_claims enable row level security;
revoke all on public.push_dispatch_claims from anon, authenticated;
grant select, insert on public.push_dispatch_claims to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
select 'private-chat', 'private-chat', false, 52428800, allowed_mime_types
from storage.buckets where id = 'group-media'
on conflict (id) do update set public = false, file_size_limit = 52428800,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "participants read private chat files" on storage.objects;
create policy "participants read private chat files" on storage.objects for select to authenticated
using (bucket_id = 'private-chat' and exists (
  select 1 from public.private_messages m
  where m.attachment_url = 'storage://private-chat/' || storage.objects.name
    and (m.sender_id = auth.uid() or m.recipient_id = auth.uid() or public.current_user_is_superadmin())
));
drop policy if exists "members upload private chat files" on storage.objects;
create policy "members upload private chat files" on storage.objects for insert to authenticated
with check (bucket_id = 'private-chat' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "members delete private chat files" on storage.objects;
create policy "members delete private chat files" on storage.objects for delete to authenticated
using (bucket_id = 'private-chat' and ((storage.foldername(name))[1] = auth.uid()::text or public.current_user_is_superadmin()));

-- Reject another sender's object reference: a forged message must never grant read access.
alter table public.private_messages drop constraint if exists private_attachment_owner_check;
alter table public.private_messages add constraint private_attachment_owner_check check (
  attachment_url is null or attachment_url not like 'storage://%'
  or starts_with(attachment_url, 'storage://private-chat/' || sender_id::text || '/')
) not valid;

-- Existing group-media/<sender>/private-chat files are still public until physically moved.
-- Copy each referenced object to private-chat keeping its full path via Storage API,
-- update that private_messages.attachment_url to storage://private-chat/<same path>,
-- verify participant signing, then remove the original group-media object.
-- SQL-only edits to storage.objects do not move bytes and must NOT be used.

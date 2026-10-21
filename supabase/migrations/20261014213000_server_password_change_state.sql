-- Deploy before the updated admin-users function/client.
-- Password-change state belongs to app metadata (GoTrue restricts it to admins).
-- This does not rotate passwords or revoke existing sessions.
begin;

create or replace function public.complete_required_password_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- An administrator's reset supplies a fresh nonce alongside the new hash.
  -- Only the later password change, retaining that nonce, completes the process.
  if new.encrypted_password is distinct from old.encrypted_password
    and coalesce(new.encrypted_password, '') <> ''
    and new.raw_app_meta_data ->> 'must_change_password' = 'true'
    and (new.raw_app_meta_data ->> 'password_change_nonce')
      is not distinct from (old.raw_app_meta_data ->> 'password_change_nonce') then
    new.raw_app_meta_data := coalesce(new.raw_app_meta_data, '{}'::jsonb)
      || '{"must_change_password": false}'::jsonb;
    -- Clear the retired editable marker so a later idempotent migration cannot
    -- re-import an already completed requirement.
    new.raw_user_meta_data := coalesce(new.raw_user_meta_data, '{}'::jsonb)
      || '{"must_change_password": false}'::jsonb;
  end if;
  return new;
end;
$$;
revoke all on function public.complete_required_password_change() from public, anon, authenticated;

drop trigger if exists complete_required_password_change on auth.users;
create trigger complete_required_password_change
  before update of encrypted_password, raw_app_meta_data on auth.users
  for each row execute function public.complete_required_password_change();

-- Preserve only already pending requirements. Do not guess which users still
-- use an old password, and do not invalidate anyone's personal password.
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('must_change_password', true,
    'password_change_nonce', gen_random_uuid()::text)
where raw_user_meta_data ->> 'must_change_password' = 'true'
  and raw_app_meta_data ->> 'must_change_password' is distinct from 'true';

commit;

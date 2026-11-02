-- Public Auth sign-up stays open for the Google account request flow, so a
-- stranger can create an Auth user with any email, including @bigboyrules.local.
-- Only administration creates those accounts, and it always sets a password
-- change nonce in app_metadata, which sign-up cannot write. Require it before
-- provisioning a club profile.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row when (
 (new.raw_app_meta_data->>'account_request_pending') is distinct from 'true'
 and new.raw_app_meta_data ? 'password_change_nonce'
 and new.email ~ '^[a-zA-Z0-9._-]+@bigboyrules\.local$'
 and lower(new.email) !~ '^request-.*@pending\.bigboyrules\.local$'
) execute function public.handle_new_big_boy();

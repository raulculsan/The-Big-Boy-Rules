-- Supabase Auth may insert a user before persisting app_metadata. A reserved
-- temporary address lets the profile trigger reject pending applicants at INSERT.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row when (
  (new.raw_app_meta_data ->> 'account_request_pending') is distinct from 'true'
  and lower(new.email) !~ '^request-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}@pending\.bigboyrules\.local$'
)
execute function public.handle_new_big_boy();

-- Remove the one test profile created prematurely by the earlier Auth trigger.
-- Keep its banned Auth record and application so the administrator can review it.
delete from public.profiles p using public.account_requests r
where p.id = r.auth_user_id
  and r.username = 'prueba1234'
  and p.username = r.username
  and r.status = 'pending_email'
  and r.verified_at is null
  and p.role = 'member';

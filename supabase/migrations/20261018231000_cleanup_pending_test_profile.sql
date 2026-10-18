-- Auth's legacy trigger derived a username from the applicant's real email.
-- Remove only the accidental test profile while retaining its banned Auth user
-- and account request for review.
delete from public.profiles p using public.account_requests r, auth.users u
where p.id = r.auth_user_id
  and u.id = r.auth_user_id
  and r.username = 'prueba1234'
  and r.status = 'pending_email'
  and r.verified_at is null
  and u.raw_app_meta_data ->> 'account_request_pending' = 'true'
  and p.role = 'member';

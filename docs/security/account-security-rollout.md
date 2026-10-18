# Google / Apple linking and TOTP MFA

The migration stages the feature with `enforcement_enabled = false` and no configured
OAuth providers. It does **not** silently make unavailable providers mandatory.
The only authoritative identity/factor data is `auth.identities` and verified TOTP
rows in `auth.mfa_factors`; `user_metadata` and client flags never grant access.

## Deploy and configure before activating

1. Apply `20261018210000_account_security.sql` first. Then deploy `admin-users`,
   `push-dispatch`, and `tigreton-agenda` **including** the local
   `_shared/account-security.ts` import. Deploy the frontend afterwards. The new
   Edge code fails closed if the RPC is absent, so reversing the order interrupts
   those functions even while enforcement is off.
2. Configure Google OAuth in Supabase with credentials owned by this application.
   The provider callback is `https://<project>.supabase.co/auth/v1/callback`.
   Configure allowed application redirect URLs for the actual web deployment and
   the app's registered deep link. Validate the complete iPhone browser-return flow.
3. Enable **Manual Linking** in Supabase Auth; keep public signup disabled. Use
   `auth.linkIdentity()` while logged into the existing club account. Do not use an
   independent OAuth sign-in to create another account. Google/Apple may have an
   email different from the internal `username@bigboyrules.local` account.
4. Apple additionally needs its Sign in with Apple Service ID, team/key details,
   domain association and a valid client secret. Schedule rotation before expiry.
   If Apple credentials cannot be provisioned yet, enable Google alone; users
   need either supported provider, never both.
5. Confirm TOTP enrollment and verification are enabled in Auth. Verify enrollment
   in an authenticator and a subsequent AAL1 login → challenge → AAL2 session. The
   QR/secret is transient setup data and must not enter logs, analytics or Storage.
6. Ship onboarding before enforcing. Provisional users can change **their own**
   password first only when Auth's trusted `app_metadata.must_change_password` is
   true; this narrow Edge bootstrap does not grant other application access.

After configuring a provider and its callbacks, expose it to the app while
`enforcement_enabled` is still false so a control account can test linking:

```sql
update club_security.configuration
set enabled_providers = array['google']::text[], updated_at = now()
where singleton;
```

If the end-to-end test fails, remove that provider from `enabled_providers`.
Do not enable enforcement until the provider has passed the web and iPhone flows.

## Install the Data API gate before enabling enforcement

RLS alone does not protect SECURITY DEFINER functions, which run with their owner's
privileges. Therefore every PostgREST request must first execute the gate.
Inspect existing role/database configuration before replacing a pre-request hook:

```sql
select r.rolname, d.datname, s.setconfig
from pg_db_role_setting s
left join pg_roles r on r.oid = s.setrole
left join pg_database d on d.oid = s.setdatabase
where exists (select 1 from unnest(s.setconfig) v where v like 'pgrst.db_pre_request=%');
```

If another hook exists, retain its behavior by composing it with the new gate in
an audited wrapper; do not overwrite it. If none exists:

```sql
alter role authenticator set pgrst.db_pre_request = 'public.account_security_pre_request';
notify pgrst, 'reload config';
```

Confirm PostgREST has reloaded the hook before activation. The hook deliberately
permits `/rpc/account_security_status` at AAL1 and preserves service-role operations.
Auth endpoints for linking, TOTP setup, challenge and logout remain available.
The status RPC returns only the caller's security state, including
`enforcement_enabled`, `identity_link_required`, `mfa_required`, `enabled_providers`,
`linked_providers`, `identity_linked`, `mfa_enrolled`, `current_aal`, `access_allowed`.
It accepts no target user ID and exposes no MFA secret or profile data.

After checking provider callbacks, authenticator recovery, all three active Edge functions,
old-client handling and a completed control account, activate explicitly:

```sql
update club_security.configuration
set enforcement_enabled = true, updated_at = now()
where singleton;
```

With enforcement enabled, only a linked configured Google/Apple identity and a
currently verified TOTP factor **plus an AAL2 JWT** permit application access.
Enrolling but not verifying a factor, fabricating metadata, removing a linked
identity/factor, or reusing an AAL1 token cannot satisfy the gate. A linked provider
does not itself count as the application's second factor.

## Coverage and boundaries

- Restrictive policies cover existing RLS tables in `public` and `storage.objects`,
  adding the requirement to existing authorization rules. They grant no new rows.
  The Data API hook also covers RPCs with SECURITY DEFINER privileges.
- Edge functions check `assert_account_security()` with the **incoming user JWT**
  after `auth.getUser()` and before privileged profile reads/writes. Checking with
  a service-role client would lose the caller's identity/AAL and is forbidden.
- The older `tigreton-voice` function is not included in this release. Keep it
  disabled; before reactivating voice, deploy its user-JWT security check too.
- SQL owner, service-role maintenance, and scheduled server jobs retain their
  existing authority. Never expose the service key or add a browser-accessible
  proxy without the user-JWT check. Direct database connections are operator-only.
- Public bucket download URLs remain public by design; no RLS policy can make an
  already public card/banner private. Existing signed private URLs continue until
  expiry. Private chat files must stay in private buckets with short signed URLs.
- New tables must get the same restrictive policy (including for Realtime); new
  user-facing Edge functions must call the helper. Do not rely solely on the UI.
  Realtime Broadcast/Presence authorization is separate from table-change RLS and
  must be reviewed if private Broadcast/Presence channels are introduced.

Coverage audit after future migrations:

```sql
select n.nspname, c.relname, c.relrowsecurity,
  exists(select 1 from pg_policy p where p.polrelid=c.oid and p.polname='account_security_gate') as has_gate
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('r','p');
```

## Recovery without a permanent user bypass

An ordinary club administrator cannot turn off security, delete another person's
MFA, or mark a provider as linked through app profile fields. If a person loses
their authenticator, a project owner must verify the person out of band, revoke
their Auth sessions, remove the lost factor with the Auth Admin MFA API, and let
them sign in and enroll a replacement. Removing a factor does not grant app access;
the new TOTP must be verified. Reverify provider ownership if it is also lost.
There is deliberately no public RPC that disables MFA and no hidden per-user
exception. Arrange this operator recovery route before making MFA mandatory.

For an operational incident, the project owner can roll back enforcement in SQL:

```sql
update club_security.configuration
set enforcement_enabled = false, updated_at = now()
where singleton;
```

The Data API hook can remain installed while off. Preserve any earlier hook if
removing ours. Do not delete Auth identities, factors or user accounts to roll back.

References: [Supabase identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking),
[TOTP MFA](https://supabase.com/docs/guides/auth/auth-mfa/totp),
[MFA enforcement](https://supabase.com/docs/guides/auth/auth-mfa),
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

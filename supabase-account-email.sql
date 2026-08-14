-- Correo privado de recuperación y códigos de verificación.
-- Ejecuta este archivo en Supabase > SQL Editor antes de desplegar account-email.

create extension if not exists pgcrypto;

create table if not exists public.account_emails (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  verified_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_emails_format_check check (
    char_length(email) between 6 and 254
    and email = lower(email)
    and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    and email !~ '@bigboyrules\.local$'
  )
);

create unique index if not exists account_emails_email_unique
  on public.account_emails (lower(email));

create table if not exists public.account_email_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  code_hash text not null,
  attempts smallint not null default 0 check (attempts between 0 and 5),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists account_email_codes_user_created_idx
  on public.account_email_codes (user_id, created_at desc);
create index if not exists account_email_codes_expiry_idx
  on public.account_email_codes (expires_at);

alter table public.account_emails enable row level security;
alter table public.account_email_codes enable row level security;

-- Los emails y códigos solo se consultan mediante la Edge Function autenticada.
-- Ni miembros, ni administradores del club, ni la API pública tienen acceso directo.
revoke all on table public.account_emails from anon, authenticated;
revoke all on table public.account_email_codes from anon, authenticated;
grant all on table public.account_emails to service_role;
grant all on table public.account_email_codes to service_role;

comment on table public.account_emails is 'Correos privados y verificados para recuperación de cuenta.';
comment on table public.account_email_codes is 'Desafíos HMAC temporales para verificar correos; nunca almacena el código en claro.';

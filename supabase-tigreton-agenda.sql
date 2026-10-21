-- Tigretón: one contextual comment per event, local day and event revision.
-- No client policies: Edge Function accesses the cache only after authenticating
-- the caller and reading the actual event through that caller's group_events RLS.
create table if not exists public.tigreton_agenda_cache (
  cache_key text primary key check (length(cache_key) = 64),
  event_id bigint not null references public.group_events(id) on delete cascade,
  comment text check (comment is null or char_length(comment) <= 160),
  created_at timestamptz not null default now()
);
alter table public.tigreton_agenda_cache enable row level security;
revoke all on public.tigreton_agenda_cache from anon, authenticated;
grant all on public.tigreton_agenda_cache to service_role;
create index if not exists tigreton_agenda_cache_created_at_idx on public.tigreton_agenda_cache(created_at);

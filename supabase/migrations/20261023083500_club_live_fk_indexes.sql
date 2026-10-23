-- Cover the remaining foreign keys so parent row changes do not scan club activity.
create index if not exists club_event_arrivals_user_idx on public.club_event_arrivals(user_id);
create index if not exists club_event_questions_author_idx on public.club_event_questions(created_by);
create index if not exists club_event_places_editor_idx on public.club_event_places(updated_by);
create index if not exists club_event_memories_author_idx on public.club_event_memories(created_by);

-- The packs page is a carousel: Los nuestros first, then one slide per theme.
-- Each slide opens its own pack, so the state reports the unopened packs per
-- theme ("standard" for every non-themed pack) and the next pack of the
-- standard slide ignores themed packs.
begin;

create or replace function public.get_pack_luck()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  rules jsonb := public.pack_luck_rules();
  since integer := 0; opened integer := 0; every integer := (rules->>'boost_every')::integer; after integer := (rules->>'pity_after')::integer;
  next_pack public.card_packs%rowtype; target public.member_card_target%rowtype; target_card public.achievement_card_catalog%rowtype; pending public.member_pack_choices%rowtype;
begin
  if actor is null then raise exception 'Sesión requerida.' using errcode = '42501'; end if;
  select l.packs_since_top, l.packs_opened into since, opened from public.member_pack_luck l where l.user_id = actor;
  since := coalesce(since, 0); opened := coalesce(opened, 0);
  select * into next_pack from public.card_packs p where p.user_id = actor and p.opened_at is null and p.collection_key = 'los-nuestros-01' and p.variant <> 'themed' order by p.earned_day, p.id limit 1;
  select * into target from public.member_card_target where user_id = actor;
  if target.card_id is not null then select * into target_card from public.achievement_card_catalog where id = target.card_id; end if;
  select * into pending from public.member_pack_choices where user_id = actor and chosen is null order by created_at limit 1;
  return jsonb_build_object(
    'pity_after', after, 'since_top', since, 'pity_in', greatest(0, after - since), 'guaranteed_next', since >= after,
    'boost_every', every, 'opened', opened, 'boost_in', every - opened % every,
    'boosted_waiting', (select count(*) from public.card_packs p where p.user_id = actor and p.opened_at is null and p.variant = 'boosted'),
    'next_boosted', coalesce(next_pack.variant = 'boosted', false),
    'next_variant', next_pack.variant, 'next_theme', next_pack.theme,
    'themed_price', public.themed_pack_price(),
    'waiting', coalesce((select jsonb_object_agg(slot, jsonb_build_object('count', total, 'next_id', first_id)) from (
      select coalesce(p.theme, 'standard') slot, count(*) total, (array_agg(p.id order by p.earned_day, p.id))[1] first_id
      from public.card_packs p where p.user_id = actor and p.opened_at is null and p.collection_key = 'los-nuestros-01'
      group by coalesce(p.theme, 'standard')) w), '{}'::jsonb),
    'fragments', coalesce(target.fragments, 0),
    'target', case when target_card.id is null then null else jsonb_build_object('card_id', target_card.id, 'edition', target_card.edition, 'cost', public.card_target_cost(target_card.edition)) end,
    'pending_choice', case when pending.pack_id is null then null else jsonb_build_object('pack_id', pending.pack_id, 'options',
      (select jsonb_agg(jsonb_build_object('card_id', c.id, 'edition', c.edition, 'kind', c.kind) order by o.n) from unnest(pending.options) with ordinality o(id, n) join public.achievement_card_catalog c on c.id = o.id)) end);
end;
$$;

revoke all on function public.get_pack_luck() from public, anon;
grant execute on function public.get_pack_luck() to authenticated;
notify pgrst, 'reload schema';
commit;

-- Pack luck (2026-11-10): bad-luck protection and an opening streak.
-- * After 12 opened packs without a legendary-or-better card, the next pack
--   guarantees one in a random slot.
-- * Every 25 opened packs grant a boosted pack: one epic-or-better slot is
--   guaranteed and legendary-or-better weights are doubled in the others.
-- Counters start at zero when this is applied; earlier packs do not count.
-- Draw rules otherwise stay as they were: 3 members, 2 objects, 1 location,
-- six distinct cards, Halloween only in member slots.
begin;

alter table public.card_packs add column if not exists variant text not null default 'standard';
alter table public.card_packs drop constraint if exists card_packs_variant_check;
alter table public.card_packs add constraint card_packs_variant_check check (variant in ('standard','boosted'));

create table if not exists public.member_pack_luck (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  packs_since_top integer not null default 0 check (packs_since_top >= 0),
  packs_opened integer not null default 0 check (packs_opened >= 0),
  updated_at timestamptz not null default now()
);
alter table public.member_pack_luck enable row level security;
drop policy if exists member_pack_luck_read_own on public.member_pack_luck;
create policy member_pack_luck_read_own on public.member_pack_luck
  for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.member_pack_luck from public, anon, authenticated;
grant select on public.member_pack_luck to authenticated;
grant all on public.member_pack_luck to service_role;

create or replace function public.pack_luck_rules()
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object('pity_after', 12, 'boost_every', 25,
    'top_editions', jsonb_build_array('legendary','full_art','vice_city','halloween'),
    'boost_editions', jsonb_build_array('epic','legendary','full_art','vice_city','halloween'))
$$;

create or replace function public.get_pack_luck()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  rules jsonb := public.pack_luck_rules();
  since integer := 0; opened integer := 0; every integer := (rules->>'boost_every')::integer; after integer := (rules->>'pity_after')::integer;
begin
  if actor is null then raise exception 'Sesión requerida.' using errcode = '42501'; end if;
  select l.packs_since_top, l.packs_opened into since, opened from public.member_pack_luck l where l.user_id = actor;
  since := coalesce(since, 0); opened := coalesce(opened, 0);
  return jsonb_build_object(
    'pity_after', after, 'since_top', since, 'pity_in', greatest(0, after - since), 'guaranteed_next', since >= after,
    'boost_every', every, 'opened', opened, 'boost_in', every - opened % every,
    'boosted_waiting', (select count(*) from public.card_packs p where p.user_id = actor and p.opened_at is null and p.variant = 'boosted'),
    'next_boosted', coalesce((select p.variant = 'boosted' from public.card_packs p where p.user_id = actor and p.opened_at is null
      and p.collection_key = 'los-nuestros-01' order by p.earned_day, p.id limit 1), false));
end;
$$;

create or replace function public.open_owned_card_pack(target_pack_id bigint default null)
returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
declare
  actor uuid := public.lock_banner_shop_actor();
  saved_pack public.card_packs%rowtype;
  selected_edition text;
  card public.achievement_card_catalog%rowtype;
  new_quantity integer;
  draw_number integer;
  selected_kind text;
  kind_quota record;
  draw_kinds text[] := array['member','member','member','object','object','location'];
  drawn_cards jsonb := '[]'::jsonb;
  drawn_ids text[] := '{}'::text[];
  rules jsonb := public.pack_luck_rules();
  top_editions text[] := array(select jsonb_array_elements_text(rules->'top_editions'));
  boost_editions text[] := array(select jsonb_array_elements_text(rules->'boost_editions'));
  luck public.member_pack_luck%rowtype;
  boosted boolean;
  guarantee_slot integer := null;
  boost_slot integer := null;
  forced text[];
  got_top boolean := false;
  granted_boosted boolean := false;
begin
  select * into saved_pack from public.card_packs where user_id=actor and opened_at is null
    and (target_pack_id is null or id=target_pack_id) and collection_key='los-nuestros-01'
    order by earned_day,id limit 1 for update;
  if not found then raise exception 'No tienes ese sobre disponible para abrir.'; end if;
  -- Check every category before awarding anything. Only drawable rarities count.
  for kind_quota in select * from (values
    ('member',3,'miembros'),('object',2,'objetos'),('location',1,'ubicación')
  ) as quotas(kind,required,label) loop
    if (select count(*) from public.achievement_card_catalog c
      where c.active and c.kind=kind_quota.kind and exists (
        select 1 from public.card_pack_rarity_weights() w where w.edition=c.edition and w.weight>0
      )) < kind_quota.required then
      raise exception 'La colección necesita al menos % cartas distintas de % para abrir un sobre.',
        kind_quota.required,kind_quota.label;
    end if;
  end loop;
  boosted := saved_pack.variant = 'boosted';
  insert into public.member_pack_luck(user_id) values (actor) on conflict (user_id) do nothing;
  select * into luck from public.member_pack_luck where user_id = actor for update;
  -- Bad-luck protection: one random slot whose category can still give a top rarity.
  if luck.packs_since_top >= (rules->>'pity_after')::integer then
    select s.n into guarantee_slot from generate_series(1,6) s(n)
      where exists (select 1 from public.achievement_card_catalog c join public.card_pack_rarity_weights() w on w.edition=c.edition and w.weight>0
        where c.active and c.kind=draw_kinds[s.n] and c.edition=any(top_editions))
      order by random() limit 1;
  end if;
  -- Boosted pack: another slot is epic or better.
  if boosted then
    select s.n into boost_slot from generate_series(1,6) s(n)
      where s.n is distinct from guarantee_slot and exists (select 1 from public.achievement_card_catalog c join public.card_pack_rarity_weights() w on w.edition=c.edition and w.weight>0
        where c.active and c.kind=draw_kinds[s.n] and c.edition=any(boost_editions))
      order by random() limit 1;
  end if;
  -- Exactly 3 members, 2 objects and 1 location, all with distinct IDs.
  -- Choose weighted rarity within the required category, then a uniform card.
  -- Unavailable/exhausted rarities in that category are excluded and weights renormalized.
  -- Inventory writes and pack consumption commit together or roll back together.
  for draw_number in 1..6 loop
    selected_kind := draw_kinds[draw_number];
    selected_edition := null;
    forced := case when draw_number = guarantee_slot then top_editions when draw_number = boost_slot then boost_editions else null end;
    if forced is not null then
      -- A guaranteed slot keeps the relative weights among the rarities it allows.
      select v.edition into selected_edition from public.card_pack_rarity_weights() v
        where v.weight>0 and v.edition=any(forced)
          and exists (select 1 from public.achievement_card_catalog c
            where c.active and c.kind=selected_kind and c.edition=v.edition and not(c.id=any(drawn_ids)))
        order by -ln(greatest(random(),0.000000000001))/v.weight limit 1;
    end if;
    -- Halloween has its configured probability per eligible member slot;
    -- other rarities retain their relative weights within that category.
    -- A boosted pack doubles the weight of every top rarity.
    if selected_edition is null then
      if selected_kind='member' and exists(select 1 from public.achievement_card_catalog c
        where c.active and c.kind=selected_kind and c.edition='halloween' and not(c.id=any(drawn_ids)))
        and random() < least(1, (case when boosted then 2 else 1 end) * coalesce((select sum(weight) filter(where edition='halloween')::numeric/nullif(sum(weight),0)
          from public.card_pack_rarity_weights()),0)) then
        selected_edition := 'halloween';
      else
        select v.edition into selected_edition from public.card_pack_rarity_weights() v
          where v.weight>0 and (selected_kind<>'member' or v.edition<>'halloween')
            and exists (select 1 from public.achievement_card_catalog c
              where c.active and c.kind=selected_kind and c.edition=v.edition and not(c.id=any(drawn_ids)))
          order by -ln(greatest(random(),0.000000000001))/(v.weight * case when boosted and v.edition=any(top_editions) then 2 else 1 end) limit 1;
      end if;
    end if;
    -- If a category has exhausted all alternatives, keep the pack completable.
    if selected_edition is null then
      select v.edition into selected_edition from public.card_pack_rarity_weights() v
        where v.weight>0 and exists(select 1 from public.achievement_card_catalog c
          where c.active and c.kind=selected_kind and c.edition=v.edition and not(c.id=any(drawn_ids)))
        order by -ln(greatest(random(),0.000000000001))/v.weight limit 1;
    end if;
    select * into card from public.achievement_card_catalog
      where active and kind=selected_kind and edition=selected_edition and not (id=any(drawn_ids))
      order by random() limit 1 for share;
    if not found then raise exception 'No hay cartas disponibles de esta categoría en la colección.'; end if;
    drawn_ids := array_append(drawn_ids,card.id);
    if card.edition = any(top_editions) then got_top := true; end if;
    insert into public.member_pack_card_awards(pack_id,draw_index,user_id,card_id) values (saved_pack.id,draw_number,actor,card.id);
    insert into public.member_card_inventory(user_id,card_id,quantity) values (actor,card.id,1)
      on conflict (user_id,card_id) do update set quantity=public.member_card_inventory.quantity+1 returning quantity into new_quantity;
    drawn_cards := drawn_cards || jsonb_build_array(jsonb_build_object('card_id',card.id,'edition',card.edition,'kind',card.kind,'quantity',new_quantity,
      'guaranteed', draw_number = guarantee_slot or draw_number = boost_slot));
  end loop;
  update public.card_packs set opened_at=clock_timestamp() where id=saved_pack.id;
  update public.member_pack_luck set packs_since_top = case when got_top then 0 else packs_since_top + 1 end,
    packs_opened = packs_opened + 1, updated_at = now() where user_id = actor returning * into luck;
  -- The opening streak pays a boosted pack at every milestone.
  if luck.packs_opened % (rules->>'boost_every')::integer = 0 then
    insert into public.card_packs(user_id,earned_day,source,variant)
      values (actor,(statement_timestamp() at time zone 'Europe/Madrid')::date,'opening_streak','boosted');
    granted_boosted := true;
  end if;
  -- Keep the first-card field for clients still running the previous bundle.
  return jsonb_build_object('pack_id',saved_pack.id,'cards',drawn_cards,'card',drawn_cards->0,
    'balance',(select balance from public.member_coin_wallets where user_id=actor),
    'luck',jsonb_build_object('boosted',boosted,'guaranteed',guarantee_slot is not null,'granted_boosted',granted_boosted,
      'since_top',luck.packs_since_top,'pity_after',(rules->>'pity_after')::integer,
      'pity_in',greatest(0,(rules->>'pity_after')::integer-luck.packs_since_top),
      'opened',luck.packs_opened,'boost_every',(rules->>'boost_every')::integer,
      'boost_in',(rules->>'boost_every')::integer-luck.packs_opened%(rules->>'boost_every')::integer));
end;
$function$;

revoke all on function public.get_pack_luck(), public.pack_luck_rules() from public, anon, authenticated;
grant execute on function public.get_pack_luck() to authenticated;
grant execute on function public.pack_luck_rules() to service_role;
notify pgrst, 'reload schema';
commit;

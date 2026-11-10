-- Pack features (2026-11-10), on top of 20261110120000_pack_luck:
-- * Finishes: every card drawn can come holo (3 %), metal (0.8 %) or special ink
--   (0.2 %). Stored per copy without new album slots; plain copies go first.
-- * Target card: one missing card at a time; every opened pack gives a fragment
--   and enough fragments (by rarity) grant the card.
-- * Choice packs: one slot shows three cards and the member keeps one. Daily
--   streak packs become choice packs.
-- * Themed packs: bought for 120 coins; one slot always comes from the theme.
-- * Shared openings: a member can share an opened pack; members can view it.
begin;

-- ── Packs: variant and theme ──────────────────────────────────────────────
alter table public.card_packs drop constraint if exists card_packs_variant_check;
alter table public.card_packs add constraint card_packs_variant_check check (variant in ('standard','boosted','choice','themed'));
alter table public.card_packs add column if not exists theme text;
alter table public.card_packs drop constraint if exists card_packs_theme_check;
alter table public.card_packs add constraint card_packs_theme_check check (
  (variant = 'themed') = (theme is not null) and (theme is null or theme in ('retro','vice_city','halloween','full_art','objects','locations')));

create or replace function public.card_pack_streak_choice()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.source = 'daily_streak' and new.variant = 'standard' then new.variant := 'choice'; end if;
  return new;
end $$;
drop trigger if exists card_pack_streak_choice on public.card_packs;
create trigger card_pack_streak_choice before insert on public.card_packs for each row execute function public.card_pack_streak_choice();

-- ── Awards remember whether the card was new and its finish ───────────────
alter table public.member_pack_card_awards add column if not exists is_new boolean;
alter table public.member_pack_card_awards add column if not exists finish text;
alter table public.member_pack_card_awards drop constraint if exists member_pack_card_awards_finish_check;
alter table public.member_pack_card_awards add constraint member_pack_card_awards_finish_check check (finish is null or finish in ('holo','metal','ink'));

-- ── Finishes per copy ──────────────────────────────────────────────────────
create table if not exists public.member_card_finishes (
  user_id uuid not null,
  card_id text not null,
  finish text not null check (finish in ('holo','metal','ink')),
  quantity integer not null check (quantity >= 1),
  primary key (user_id, card_id, finish),
  foreign key (user_id, card_id) references public.member_card_inventory(user_id, card_id) on delete cascade
);
alter table public.member_card_finishes enable row level security;
drop policy if exists member_card_finishes_read_own on public.member_card_finishes;
create policy member_card_finishes_read_own on public.member_card_finishes for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.member_card_finishes from public, anon, authenticated;
grant select on public.member_card_finishes to authenticated;
grant all on public.member_card_finishes to service_role;

-- When copies leave (fusion, discard, trade, sale) plain copies go first; a
-- finish is only lost once no plain copy remains. Rarest finish is kept longest.
create or replace function public.trim_card_finishes()
returns trigger language plpgsql security definer set search_path = '' as $$
declare excess integer; row record;
begin
  excess := coalesce((select sum(quantity) from public.member_card_finishes where user_id = new.user_id and card_id = new.card_id), 0) - new.quantity;
  if excess <= 0 then return new; end if;
  for row in select finish, quantity from public.member_card_finishes where user_id = new.user_id and card_id = new.card_id
    order by case finish when 'holo' then 1 when 'metal' then 2 else 3 end loop
    exit when excess <= 0;
    if row.quantity <= excess then
      delete from public.member_card_finishes where user_id = new.user_id and card_id = new.card_id and finish = row.finish;
      excess := excess - row.quantity;
    else
      update public.member_card_finishes set quantity = quantity - excess where user_id = new.user_id and card_id = new.card_id and finish = row.finish;
      excess := 0;
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists trim_card_finishes on public.member_card_inventory;
create trigger trim_card_finishes after update of quantity on public.member_card_inventory for each row when (new.quantity < old.quantity) execute function public.trim_card_finishes();

create or replace function public.roll_card_finish()
returns text language sql volatile set search_path = '' as $$
  select case when r < .002 then 'ink' when r < .010 then 'metal' when r < .040 then 'holo' else null end from (select random() r) x
$$;

-- ── Target card and fragments ──────────────────────────────────────────────
create table if not exists public.member_card_target (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  card_id text references public.achievement_card_catalog(id),
  fragments integer not null default 0 check (fragments >= 0),
  updated_at timestamptz not null default now()
);
alter table public.member_card_target enable row level security;
drop policy if exists member_card_target_read_own on public.member_card_target;
create policy member_card_target_read_own on public.member_card_target for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.member_card_target from public, anon, authenticated;
grant select on public.member_card_target to authenticated;
grant all on public.member_card_target to service_role;

create or replace function public.card_target_cost(card_edition text)
returns integer language sql immutable set search_path = '' as $$
  select case card_edition when 'common' then 10 when 'special' then 15 when 'retro' then 15 when 'epic' then 20 when 'legendary' then 30 else 40 end
$$;

-- Getting the target by any route clears it; the fragments stay.
create or replace function public.clear_acquired_card_target()
returns trigger language plpgsql security definer set search_path = '' as $$
begin update public.member_card_target set card_id = null, updated_at = now() where user_id = new.user_id and card_id = new.card_id; return new; end $$;
drop trigger if exists clear_acquired_card_target on public.member_card_inventory;
create trigger clear_acquired_card_target after insert on public.member_card_inventory for each row execute function public.clear_acquired_card_target();

create or replace function public.set_card_target(target_card_id text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := public.lock_banner_shop_actor();
begin
  perform public.assert_account_security();
  if target_card_id is not null then
    if not exists (select 1 from public.achievement_card_catalog where id = target_card_id and active) then raise exception 'Esta carta no está disponible.' using errcode = '22023'; end if;
    if exists (select 1 from public.member_card_inventory where user_id = actor and card_id = target_card_id) then raise exception 'Ya tienes esta carta en tu álbum.' using errcode = '22023'; end if;
  end if;
  insert into public.member_card_target(user_id, card_id) values (actor, target_card_id)
    on conflict (user_id) do update set card_id = excluded.card_id, updated_at = now();
  return public.get_pack_luck();
end $$;

-- ── Themed packs ───────────────────────────────────────────────────────────
alter table public.member_coin_ledger drop constraint if exists member_coin_ledger_reason_check;
alter table public.member_coin_ledger add constraint member_coin_ledger_reason_check check (reason = any (array['duplicate_discard','banner_purchase','admin_grant','admin_adjust','chota_purchase','mission_reward','streak_shield','market_purchase','market_sale','themed_pack']));

create or replace function public.themed_pack_price() returns integer language sql immutable set search_path = '' as $$ select 120 $$;

create or replace function public.buy_themed_pack(pack_theme text, expected_price integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := public.lock_banner_shop_actor(); price integer := public.themed_pack_price(); new_balance bigint;
begin
  perform public.assert_account_security();
  if pack_theme is null or pack_theme not in ('retro','vice_city','halloween','full_art','objects','locations') then raise exception 'Ese sobre temático no existe.' using errcode = '22023'; end if;
  if expected_price is distinct from price then raise exception 'El precio ha cambiado. Vuelve a intentarlo.' using errcode = '22023'; end if;
  select balance into new_balance from public.member_coin_wallets where user_id = actor;
  if coalesce(new_balance, 0) < price then raise exception 'No tienes monedas suficientes.' using errcode = '22023'; end if;
  update public.member_coin_wallets set balance = balance - price where user_id = actor returning balance into new_balance;
  insert into public.member_coin_ledger(user_id, delta, balance_after, reason, item_id, copies) values (actor, -price, new_balance, 'themed_pack', 'themed:' || pack_theme, 1);
  insert into public.card_packs(user_id, earned_day, source, variant, theme) values (actor, (statement_timestamp() at time zone 'Europe/Madrid')::date, 'themed_purchase', 'themed', pack_theme);
  return jsonb_build_object('balance', new_balance, 'theme', pack_theme) || public.get_pack_luck();
end $$;

-- ── Choice slots waiting for the member ────────────────────────────────────
create table if not exists public.member_pack_choices (
  pack_id bigint primary key references public.card_packs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  draw_index integer not null check (draw_index between 1 and 6),
  options text[] not null check (cardinality(options) between 2 and 3),
  chosen text,
  created_at timestamptz not null default now()
);
alter table public.member_pack_choices enable row level security;
drop policy if exists member_pack_choices_read_own on public.member_pack_choices;
create policy member_pack_choices_read_own on public.member_pack_choices for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.member_pack_choices from public, anon, authenticated;
grant select on public.member_pack_choices to authenticated;
grant all on public.member_pack_choices to service_role;

-- Awards one card to the actor and settles finish, novelty and the target.
create or replace function public.award_pack_card(actor uuid, pack bigint, slot integer, target_card text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare card public.achievement_card_catalog%rowtype; new_quantity integer; card_finish text := public.roll_card_finish();
begin
  select * into card from public.achievement_card_catalog where id = target_card;
  insert into public.member_card_inventory(user_id, card_id, quantity) values (actor, card.id, 1)
    on conflict (user_id, card_id) do update set quantity = public.member_card_inventory.quantity + 1 returning quantity into new_quantity;
  if card_finish is not null then
    insert into public.member_card_finishes(user_id, card_id, finish, quantity) values (actor, card.id, card_finish, 1)
      on conflict (user_id, card_id, finish) do update set quantity = public.member_card_finishes.quantity + 1;
  end if;
  insert into public.member_pack_card_awards(pack_id, draw_index, user_id, card_id, is_new, finish) values (pack, slot, actor, card.id, new_quantity = 1, card_finish);
  return jsonb_build_object('card_id', card.id, 'edition', card.edition, 'kind', card.kind, 'quantity', new_quantity, 'finish', card_finish, 'draw_index', slot);
end $$;

-- One fragment per opened pack; enough fragments grant the target.
create or replace function public.advance_card_target(actor uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare target public.member_card_target%rowtype; card public.achievement_card_catalog%rowtype; cost integer;
begin
  insert into public.member_card_target(user_id) values (actor) on conflict (user_id) do nothing;
  update public.member_card_target set fragments = fragments + 1, updated_at = now() where user_id = actor returning * into target;
  if target.card_id is null then return null; end if;
  select * into card from public.achievement_card_catalog where id = target.card_id;
  cost := public.card_target_cost(card.edition);
  if target.fragments < cost or not card.active then return null; end if;
  if exists (select 1 from public.member_card_inventory where user_id = actor and card_id = card.id) then
    update public.member_card_target set card_id = null where user_id = actor; return null;
  end if;
  update public.member_card_target set fragments = fragments - cost where user_id = actor;
  insert into public.member_card_inventory(user_id, card_id, quantity) values (actor, card.id, 1);
  return jsonb_build_object('card_id', card.id, 'edition', card.edition, 'kind', card.kind, 'quantity', 1, 'cost', cost);
end $$;

-- ── Pack luck state now also reports the next pack, target and choice ──────
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
  select * into next_pack from public.card_packs p where p.user_id = actor and p.opened_at is null and p.collection_key = 'los-nuestros-01' order by p.earned_day, p.id limit 1;
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
    'fragments', coalesce(target.fragments, 0),
    'target', case when target_card.id is null then null else jsonb_build_object('card_id', target_card.id, 'edition', target_card.edition, 'cost', public.card_target_cost(target_card.edition)) end,
    'pending_choice', case when pending.pack_id is null then null else jsonb_build_object('pack_id', pending.pack_id, 'options',
      (select jsonb_agg(jsonb_build_object('card_id', c.id, 'edition', c.edition, 'kind', c.kind) order by o.n) from unnest(pending.options) with ordinality o(id, n) join public.achievement_card_catalog c on c.id = o.id)) end);
end;
$$;

-- ── Opening a pack ─────────────────────────────────────────────────────────
create or replace function public.open_owned_card_pack(target_pack_id bigint default null)
returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
declare
  actor uuid := public.lock_banner_shop_actor();
  saved_pack public.card_packs%rowtype;
  selected_edition text;
  card public.achievement_card_catalog%rowtype;
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
  boosted boolean; themed boolean; choosing boolean;
  theme_editions text[]; theme_kind text;
  guarantee_slot integer := null; boost_slot integer := null; theme_slot integer := null; choice_slot integer := null;
  forced text[];
  got_top boolean := false;
  granted_boosted boolean := false;
  options text[]; choice_options text[]; option_count integer; awarded jsonb; completed jsonb;
begin
  select * into saved_pack from public.card_packs where user_id=actor and opened_at is null
    and (target_pack_id is null or id=target_pack_id) and collection_key='los-nuestros-01'
    order by earned_day,id limit 1 for update;
  if not found then raise exception 'No tienes ese sobre disponible para abrir.'; end if;
  if exists (select 1 from public.member_pack_choices where user_id = actor and chosen is null) then
    raise exception 'Elige antes la carta de tu sobre anterior.' using errcode = '22023';
  end if;
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
  boosted := saved_pack.variant = 'boosted'; themed := saved_pack.variant = 'themed'; choosing := saved_pack.variant = 'choice';
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
  -- Themed pack: one slot always comes from the theme.
  if themed then
    theme_editions := case saved_pack.theme when 'objects' then boost_editions when 'locations' then boost_editions else array[saved_pack.theme] end;
    theme_kind := case saved_pack.theme when 'objects' then 'object' when 'locations' then 'location' else null end;
    select s.n into theme_slot from generate_series(1,6) s(n)
      where s.n is distinct from guarantee_slot and (theme_kind is null or draw_kinds[s.n] = theme_kind) and exists (select 1 from public.achievement_card_catalog c
        where c.active and c.kind=draw_kinds[s.n] and c.edition=any(theme_editions))
      order by random() limit 1;
  end if;
  -- Choice pack: one slot offers three cards.
  if choosing then select n into choice_slot from generate_series(1,6) n order by random() limit 1; end if;
  for draw_number in 1..6 loop
    selected_kind := draw_kinds[draw_number];
    forced := case when draw_number = guarantee_slot then top_editions when draw_number = boost_slot then boost_editions when draw_number = theme_slot then theme_editions else null end;
    options := '{}'; option_count := case when draw_number = choice_slot then 3 else 1 end;
    for pick in 1..option_count loop
      selected_edition := null;
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
      if not found then
        exit when pick > 2; -- a third choice option is optional when the category runs dry
        raise exception 'No hay cartas disponibles de esta categoría en la colección.';
      end if;
      drawn_ids := array_append(drawn_ids, card.id); options := array_append(options, card.id);
    end loop;
    if draw_number = choice_slot then
      choice_options := options;
      insert into public.member_pack_choices(pack_id, user_id, draw_index, options) values (saved_pack.id, actor, draw_number, options);
    else
      if card.edition = any(top_editions) then got_top := true; end if;
      awarded := public.award_pack_card(actor, saved_pack.id, draw_number, card.id)
        || jsonb_build_object('guaranteed', draw_number = guarantee_slot or draw_number = boost_slot, 'themed', draw_number = theme_slot);
      drawn_cards := drawn_cards || jsonb_build_array(awarded);
    end if;
  end loop;
  update public.card_packs set opened_at=clock_timestamp() where id=saved_pack.id;
  -- A pending choice decides the drought when it is chosen.
  if choice_slot is null then
    update public.member_pack_luck set packs_since_top = case when got_top then 0 else packs_since_top + 1 end,
      packs_opened = packs_opened + 1, updated_at = now() where user_id = actor returning * into luck;
  else
    update public.member_pack_luck set packs_since_top = case when got_top then 0 else packs_since_top end,
      packs_opened = packs_opened + 1, updated_at = now() where user_id = actor returning * into luck;
  end if;
  -- The opening streak pays a boosted pack at every milestone.
  if luck.packs_opened % (rules->>'boost_every')::integer = 0 then
    insert into public.card_packs(user_id,earned_day,source,variant)
      values (actor,(statement_timestamp() at time zone 'Europe/Madrid')::date,'opening_streak','boosted');
    granted_boosted := true;
  end if;
  completed := public.advance_card_target(actor);
  -- Keep the first-card field for clients still running the previous bundle.
  return jsonb_build_object('pack_id',saved_pack.id,'variant',saved_pack.variant,'theme',saved_pack.theme,'cards',drawn_cards,'card',drawn_cards->0,
    'balance',(select balance from public.member_coin_wallets where user_id=actor),
    'target_completed', completed,
    'choice', case when choice_slot is null then null else jsonb_build_object('pack_id', saved_pack.id, 'draw_index', choice_slot, 'options',
      (select jsonb_agg(jsonb_build_object('card_id', c.id, 'edition', c.edition, 'kind', c.kind) order by o.n) from unnest(choice_options) with ordinality o(id, n) join public.achievement_card_catalog c on c.id = o.id)) end,
    'luck',jsonb_build_object('boosted',boosted,'guaranteed',guarantee_slot is not null,'granted_boosted',granted_boosted,
      'since_top',luck.packs_since_top,'pity_after',(rules->>'pity_after')::integer,
      'pity_in',greatest(0,(rules->>'pity_after')::integer-luck.packs_since_top),
      'opened',luck.packs_opened,'boost_every',(rules->>'boost_every')::integer,
      'boost_in',(rules->>'boost_every')::integer-luck.packs_opened%(rules->>'boost_every')::integer));
end;
$function$;

create or replace function public.choose_pack_card(target_pack_id bigint, chosen_card_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := public.lock_banner_shop_actor(); pending public.member_pack_choices%rowtype; awarded jsonb; top boolean;
begin
  select * into pending from public.member_pack_choices where pack_id = target_pack_id and user_id = actor for update;
  if not found then raise exception 'Ese sobre no tiene ninguna elección pendiente.' using errcode = '22023'; end if;
  if pending.chosen is not null then raise exception 'Ya elegiste la carta de este sobre.' using errcode = '22023'; end if;
  if not (chosen_card_id = any(pending.options)) then raise exception 'Esa carta no estaba entre las opciones.' using errcode = '22023'; end if;
  update public.member_pack_choices set chosen = chosen_card_id where pack_id = target_pack_id;
  awarded := public.award_pack_card(actor, target_pack_id, pending.draw_index, chosen_card_id) || jsonb_build_object('chosen', true);
  top := (awarded->>'edition') = any(array(select jsonb_array_elements_text(public.pack_luck_rules()->'top_editions')))
    or exists (select 1 from public.member_pack_card_awards a join public.achievement_card_catalog c on c.id = a.card_id
      where a.pack_id = target_pack_id and c.edition = any(array(select jsonb_array_elements_text(public.pack_luck_rules()->'top_editions'))));
  update public.member_pack_luck set packs_since_top = case when top then 0 else packs_since_top + 1 end, updated_at = now() where user_id = actor;
  return jsonb_build_object('card', awarded) || jsonb_build_object('luck', public.get_pack_luck());
end $$;

-- ── Sharing an opening ─────────────────────────────────────────────────────
create table if not exists public.shared_pack_openings (
  pack_id bigint primary key references public.card_packs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  shared_at timestamptz not null default now()
);
alter table public.shared_pack_openings enable row level security;
revoke all on public.shared_pack_openings from public, anon, authenticated;
grant all on public.shared_pack_openings to service_role;

create or replace function public.share_pack_opening(target_pack_id bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := public.lock_banner_shop_actor();
begin
  if not exists (select 1 from public.card_packs where id = target_pack_id and user_id = actor and opened_at is not null) then
    raise exception 'Solo puedes compartir un sobre tuyo ya abierto.' using errcode = '22023';
  end if;
  if exists (select 1 from public.member_pack_choices where pack_id = target_pack_id and chosen is null) then
    raise exception 'Elige antes tu carta del sobre.' using errcode = '22023';
  end if;
  insert into public.shared_pack_openings(pack_id, user_id) values (target_pack_id, actor) on conflict (pack_id) do nothing;
  return jsonb_build_object('pack_id', target_pack_id, 'token', '[[sobre:' || target_pack_id || ']]');
end $$;

create or replace function public.get_shared_pack(target_pack_id bigint)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare viewer uuid := (select auth.uid()); shared public.shared_pack_openings%rowtype;
begin
  if viewer is null or not exists (select 1 from public.profiles where id = viewer and not coalesce(is_hidden, false)) then
    raise exception 'Sesión requerida.' using errcode = '42501';
  end if;
  select * into shared from public.shared_pack_openings where pack_id = target_pack_id;
  if not found then return null; end if;
  return jsonb_build_object('pack_id', shared.pack_id, 'user_id', shared.user_id, 'shared_at', shared.shared_at,
    'variant', (select variant from public.card_packs where id = shared.pack_id), 'theme', (select theme from public.card_packs where id = shared.pack_id),
    'cards', coalesce((select jsonb_agg(jsonb_build_object('card_id', a.card_id, 'edition', c.edition, 'kind', c.kind, 'is_new', coalesce(a.is_new, false), 'finish', a.finish) order by a.draw_index)
      from public.member_pack_card_awards a join public.achievement_card_catalog c on c.id = a.card_id where a.pack_id = shared.pack_id), '[]'::jsonb));
end $$;

-- ── Finishes for the album ─────────────────────────────────────────────────
create or replace function public.get_card_finishes()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(card_id, finishes), '{}'::jsonb) from (
    select card_id, jsonb_object_agg(finish, quantity) finishes from public.member_card_finishes where user_id = (select auth.uid()) group by card_id) x
$$;

revoke all on function public.set_card_target(text), public.buy_themed_pack(text, integer), public.choose_pack_card(bigint, text),
  public.share_pack_opening(bigint), public.get_shared_pack(bigint), public.get_card_finishes(), public.get_pack_luck(),
  public.award_pack_card(uuid, bigint, integer, text), public.advance_card_target(uuid), public.roll_card_finish(),
  public.card_target_cost(text), public.themed_pack_price(), public.trim_card_finishes(), public.clear_acquired_card_target(), public.card_pack_streak_choice()
  from public, anon, authenticated;
grant execute on function public.set_card_target(text), public.buy_themed_pack(text, integer), public.choose_pack_card(bigint, text),
  public.share_pack_opening(bigint), public.get_shared_pack(bigint), public.get_card_finishes(), public.get_pack_luck() to authenticated;
notify pgrst, 'reload schema';
commit;

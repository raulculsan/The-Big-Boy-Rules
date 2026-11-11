-- Lot trades: each side may put up to three different duplicates in one
-- trade. Same protocol as before (invite → join → propose → confirm); one
-- copy of each chosen card changes hands, all at once or not at all.
-- Older apps keep working: a single card is a lot of one, and the first card
-- of each lot is still written to offered_card_id / requested_card_id.
begin;
alter table public.card_trade_offers add column if not exists offered_card_ids text[];
alter table public.card_trade_offers add column if not exists requested_card_ids text[];
update public.card_trade_offers set offered_card_ids = array[offered_card_id] where offered_card_ids is null and offered_card_id is not null;
update public.card_trade_offers set requested_card_ids = array[requested_card_id] where requested_card_ids is null and requested_card_id is not null;
alter table public.card_trade_offers drop constraint if exists card_trade_lot_sizes;
alter table public.card_trade_offers add constraint card_trade_lot_sizes check (
  (offered_card_ids is null or cardinality(offered_card_ids) between 1 and 3)
  and (requested_card_ids is null or cardinality(requested_card_ids) between 1 and 3));

-- A lot is 1–3 different active cards that the member holds more than once.
create or replace function public.trade_lot_error(member uuid, cards text[], excluded text[] default '{}')
returns text language sql stable security definer set search_path = '' as $$
  select case
    when cards is null or cardinality(cards) not between 1 and 3 then 'Elige entre una y tres repetidas.'
    when (select count(distinct c) from unnest(cards) c) <> cardinality(cards) then 'No repitas la misma carta en el lote.'
    when cards && coalesce(excluded, '{}') then 'Elige repetidas diferentes de las cartas que recibirás.'
    when (select count(*) from public.member_card_inventory i join public.achievement_card_catalog k on k.id = i.card_id and k.active
          where i.user_id = member and i.card_id = any(cards) and i.quantity > 1) <> cardinality(cards) then 'Solo puedes ofrecer cartas repetidas.'
    else null end
$$;
revoke all on function public.trade_lot_error(uuid, text[], text[]) from public, anon, authenticated;

drop function if exists public.invite_card_trade(uuid, uuid, text);
create or replace function public.invite_card_trade(offer_id uuid, target_user_id uuid, give_card_id text default null, give_card_ids text[] default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare actor uuid := public.lock_banner_shop_actor(); existing public.card_trade_offers%rowtype; lot text[]; problem text;
begin
  lot := coalesce(give_card_ids, case when give_card_id is null then null else array[give_card_id] end);
  select * into existing from public.card_trade_offers where id = offer_id;
  if found then
    if existing.sender_id = actor and existing.recipient_id = target_user_id and existing.offered_card_ids = lot then return existing.id; end if;
    raise exception 'Esta solicitud ya existe.';
  end if;
  if target_user_id = actor or not exists(select 1 from public.profiles where id = target_user_id and not is_hidden) then raise exception 'Elige un miembro disponible.'; end if;
  problem := public.trade_lot_error(actor, lot);
  if problem is not null then raise exception '%', problem; end if;
  if (select count(*) from public.card_trade_offers where sender_id = actor and status in ('invited','selecting','review') and expires_at > now()) >= 20 then raise exception 'Resuelve alguna solicitud pendiente antes de crear otra.'; end if;
  if exists(select 1 from public.card_trade_offers where sender_id = actor and recipient_id = target_user_id and status in ('invited','selecting','review') and expires_at > now()) then raise exception 'Ya tienes un intercambio abierto con esta persona.'; end if;
  insert into public.card_trade_offers(id, sender_id, recipient_id, offered_card_id, offered_card_ids, status)
  values (offer_id, actor, target_user_id, lot[1], lot, 'invited');
  return offer_id;
end; $$;

drop function if exists public.advance_card_trade(uuid, text, text);
create or replace function public.advance_card_trade(offer_id uuid, decision text, own_card_id text default null, own_card_ids text[] default null)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare actor uuid := auth.uid(); offer public.card_trade_offers%rowtype; next_status text; lot text[]; problem text; given text[]; taken text[];
begin
  if actor is null or not exists(select 1 from public.profiles where id = actor and not is_hidden) then raise exception 'Inicia sesión.' using errcode = '42501'; end if;
  if decision not in ('join','propose','confirm','decline','cancel') then raise exception 'Acción no válida.'; end if;
  select * into offer from public.card_trade_offers where id = offer_id;
  if not found or actor not in (offer.sender_id, offer.recipient_id) then raise exception 'Intercambio no disponible.' using errcode = '42501'; end if;
  -- Wallets first, in the same order as the rest of the economy. No row lock is held before these.
  insert into public.member_coin_wallets(user_id) select member_id from unnest(array[offer.sender_id, offer.recipient_id]) member_id order by member_id on conflict do nothing;
  perform 1 from public.member_coin_wallets where user_id in (offer.sender_id, offer.recipient_id) order by user_id for update;
  select * into offer from public.card_trade_offers where id = offer_id for update;
  if offer.status not in ('invited','selecting','review') then return offer.status; end if;
  if offer.expires_at <= now() then update public.card_trade_offers set status = 'expired', resolved_at = now() where id = offer.id; return 'expired'; end if;
  given := coalesce(offer.offered_card_ids, array[offer.offered_card_id]);
  if decision = 'cancel' and actor = offer.sender_id then next_status := 'cancelled';
  elsif decision = 'decline' and actor = offer.recipient_id then next_status := 'declined';
  elsif decision = 'join' and actor = offer.recipient_id and offer.status = 'invited' then
    update public.card_trade_offers set status = 'selecting', recipient_joined_at = now() where id = offer.id; return 'selecting';
  elsif decision = 'propose' and actor = offer.recipient_id and offer.status = 'selecting' then
    lot := coalesce(own_card_ids, case when own_card_id is null then null else array[own_card_id] end);
    problem := public.trade_lot_error(actor, lot, given);
    if problem is not null then raise exception '%', problem; end if;
    update public.card_trade_offers set status = 'review', requested_card_id = lot[1], requested_card_ids = lot, proposed_at = now() where id = offer.id; return 'review';
  elsif decision = 'confirm' and actor = offer.sender_id and offer.status = 'review' then
    -- The recipient confirmed their lot in propose; this is the sender's final consent.
    taken := coalesce(offer.requested_card_ids, array[offer.requested_card_id]);
    perform 1 from public.member_card_inventory where user_id in (offer.sender_id, offer.recipient_id) and card_id = any(given || taken) order by user_id, card_id for update;
    if exists(select 1 from public.profiles where id in (offer.sender_id, offer.recipient_id) and is_hidden)
       or public.trade_lot_error(offer.sender_id, given) is not null
       or public.trade_lot_error(offer.recipient_id, taken, given) is not null then
      next_status := 'unavailable';
    else
      update public.member_card_inventory set quantity = quantity - 1
       where (user_id = offer.sender_id and card_id = any(given)) or (user_id = offer.recipient_id and card_id = any(taken));
      insert into public.member_card_inventory(user_id, card_id, quantity)
      select offer.recipient_id, c, 1 from unnest(given) c
      union all select offer.sender_id, c, 1 from unnest(taken) c
      on conflict (user_id, card_id) do update set quantity = public.member_card_inventory.quantity + 1;
      next_status := 'accepted';
    end if;
  else raise exception 'Esta acción ya no está disponible. Actualiza el intercambio.'; end if;
  update public.card_trade_offers set status = next_status, resolved_at = now() where id = offer.id; return next_status;
end; $$;

create or replace function public.get_card_trade_updates()
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare actor uuid := auth.uid();
begin
  if actor is null or not exists(select 1 from public.profiles where id = actor and not is_hidden) then raise exception 'Inicia sesión.' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(row_data order by created_at desc) from (
    select t.id, t.sender_id, t.recipient_id, t.offered_card_id, t.requested_card_id,
      coalesce(t.offered_card_ids, case when t.offered_card_id is null then null else array[t.offered_card_id] end) offered_card_ids,
      coalesce(t.requested_card_ids, case when t.requested_card_id is null then null else array[t.requested_card_id] end) requested_card_ids,
      case when t.status in ('invited','selecting','review') and t.expires_at <= now() then 'expired' else t.status end status,
      t.created_at, t.expires_at, t.resolved_at, t.recipient_joined_at, t.proposed_at, s.display_name sender_name, r.display_name recipient_name
    from public.card_trade_offers t join public.profiles s on s.id = t.sender_id join public.profiles r on r.id = t.recipient_id
    where actor in (t.sender_id, t.recipient_id) order by t.created_at desc limit 100) row_data), '[]'::jsonb);
end; $$;

revoke all on function public.invite_card_trade(uuid, uuid, text, text[]), public.advance_card_trade(uuid, text, text, text[]) from public, anon, authenticated;
grant execute on function public.invite_card_trade(uuid, uuid, text, text[]), public.advance_card_trade(uuid, text, text, text[]) to authenticated;
notify pgrst, 'reload schema';
commit;

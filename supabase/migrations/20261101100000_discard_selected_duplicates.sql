begin;

-- Discards exactly what the member picked, as one transaction. Reward values match
-- discard_duplicate_card and the last copy of every card always stays.
create function public.discard_selected_duplicates(p_items jsonb) returns jsonb language plpgsql security definer set search_path='public','pg_temp' as $$
declare
  actor uuid := public.lock_banner_shop_actor();
  picked record;
  held integer;
  reward integer;
  earned bigint;
  total_earned bigint := 0;
  total_copies bigint := 0;
  new_balance bigint;
  discarded_cards jsonb := '[]'::jsonb;
begin
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 500 then
    raise exception 'Elige al menos una carta.' using errcode='22023';
  end if;
  select balance into new_balance from public.member_coin_wallets where user_id=actor;
  for picked in
    select card_id,sum(copies)::integer as copies from jsonb_to_recordset(p_items) as x(card_id text,copies integer)
    group by card_id order by card_id
  loop
    if picked.card_id is null or picked.copies is null or picked.copies<1 then raise exception 'La cantidad de copias no es válida.' using errcode='22023'; end if;
    select quantity into held from public.member_card_inventory where user_id=actor and card_id=picked.card_id for update;
    if held is null or picked.copies>=held then raise exception 'Solo puedes descartar cartas repetidas; conserva una copia.' using errcode='22023'; end if;
    select case edition when 'common' then 1 when 'retro' then 2 when 'special' then 2 when 'epic' then 3 when 'legendary' then 5 when 'full_art' then 8 when 'vice_city' then 10 when 'halloween' then 10 end
      into reward from public.achievement_card_catalog where id=picked.card_id;
    if reward is null then raise exception 'La rareza de la carta no tiene un valor de descarte.'; end if;
    earned:=picked.copies::bigint*reward;
    update public.member_card_inventory set quantity=quantity-picked.copies where user_id=actor and card_id=picked.card_id;
    new_balance:=new_balance+earned;
    insert into public.member_coin_ledger(user_id,delta,balance_after,reason,item_id,copies)
      values(actor,earned,new_balance,'duplicate_discard',picked.card_id,picked.copies);
    total_earned:=total_earned+earned;total_copies:=total_copies+picked.copies;
    discarded_cards:=discarded_cards||jsonb_build_array(jsonb_build_object('card_id',picked.card_id,'quantity',held-picked.copies,'copies_discarded',picked.copies,'coins_earned',earned));
  end loop;
  update public.member_coin_wallets set balance=new_balance where user_id=actor;
  return jsonb_build_object('copies_discarded',total_copies,'coins_earned',total_earned,'balance',new_balance,'cards',discarded_cards);
end $$;

revoke all on function public.discard_selected_duplicates(jsonb) from public,anon;
grant execute on function public.discard_selected_duplicates(jsonb) to authenticated;

commit;

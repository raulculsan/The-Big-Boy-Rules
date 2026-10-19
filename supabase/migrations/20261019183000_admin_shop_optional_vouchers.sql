-- Handle optional shop catalogs without preventing price and rarity management.
begin;
create or replace function public.admin_get_club_economy()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  banner_rows jsonb := '[]'::jsonb;
  voucher_rows jsonb := '[]'::jsonb;
begin
  if auth.uid() is null or not public.current_user_is_superadmin() then raise exception 'Solo la cuenta de administración puede gestionar la economía.' using errcode='42501'; end if;
  perform public.assert_account_security();
  if to_regclass('public.profile_banner_catalog') is not null then
    execute $catalog$select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'price',price,'active',active) order by name),'[]'::jsonb) from public.profile_banner_catalog$catalog$ into banner_rows;
  end if;
  if to_regclass('public.reward_voucher_catalog') is not null then
    execute $catalog$select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'price',price,'active',active,'minimum_price',case when reward_type='coins' then reward_amount else 0 end) order by name),'[]'::jsonb) from public.reward_voucher_catalog$catalog$ into voucher_rows;
  end if;
  return jsonb_build_object(
    'revision',(select revision from public.club_economy_configuration where singleton),
    'probabilities',(select jsonb_object_agg(edition,round(100.0*weight/total,2)) from
      (select w.*,sum(weight) over() total from public.card_pack_rarity_weights() w) odds),
    'banners',banner_rows,
    'vouchers',voucher_rows,
    'vouchers_available',to_regclass('public.reward_voucher_catalog') is not null
  );
end;
$$;

create or replace function public.admin_save_club_economy(p_revision bigint,p_probabilities jsonb,p_prices jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  saved public.club_economy_configuration%rowtype;
  affected bigint;
  prior jsonb; item jsonb; rarity text; amount numeric; total numeric := 0;
  weights jsonb := '{}'::jsonb; seen text[] := '{}';
  allowed text[] := array['common','retro','special','epic','legendary','full_art','vice_city'];
begin
  if auth.uid() is null or not public.current_user_is_superadmin() then raise exception 'Solo la cuenta de administración puede gestionar la economía.' using errcode='42501'; end if;
  perform public.assert_account_security();
  select * into strict saved from public.club_economy_configuration where singleton for update;
  if p_revision is null or p_revision<>saved.revision then raise exception 'La configuración cambió. Actualiza antes de guardar.'; end if;
  if jsonb_typeof(p_probabilities) is distinct from 'object' or jsonb_typeof(p_prices) is distinct from 'array' then raise exception 'Configuración no válida.'; end if;
  if (select count(*) from jsonb_object_keys(p_probabilities))<>array_length(allowed,1) then raise exception 'Indica el porcentaje de todas las rarezas.'; end if;
  foreach rarity in array allowed loop
    if jsonb_typeof(p_probabilities->rarity) is distinct from 'number' then raise exception 'Porcentaje no válido: %',rarity; end if;
    amount := (p_probabilities->>rarity)::numeric;
    if amount<0 or amount>100 or amount<>round(amount,2) then raise exception 'Los porcentajes deben estar entre 0 y 100, con dos decimales como máximo.'; end if;
    total:=total+amount;
    weights:=weights||jsonb_build_object(rarity,(amount*100)::integer);
  end loop;
  if total<>100 then raise exception 'Los porcentajes deben sumar exactamente 100%%.'; end if;
  -- Guarantee that configured draws can still fill the six distinct category slots.
  if exists(select 1 from (values('member',3),('object',2),('location',1)) q(kind,needed)
    where (select count(*) from public.achievement_card_catalog c where c.active and c.kind=q.kind and coalesce((weights->>c.edition)::integer,0)>0)<q.needed)
    then raise exception 'Estas probabilidades no permiten completar 3 miembros, 2 objetos y 1 ubicación distintos.'; end if;
  prior:=public.admin_get_club_economy();
  if jsonb_array_length(p_prices)<>jsonb_array_length(prior->'banners')+jsonb_array_length(prior->'vouchers')
    then raise exception 'El catálogo cambió. Actualiza antes de guardar.'; end if;
  for item in select value from jsonb_array_elements(p_prices) loop
    if jsonb_typeof(item->'price') is distinct from 'number' or jsonb_typeof(item->'id') is distinct from 'string' or item->>'kind' not in ('banner','voucher') or item->>'kind' is null then raise exception 'Artículo no válido.'; end if;
    amount:=(item->>'price')::numeric;
    if amount<0 or amount>1000000 or amount<>trunc(amount) then raise exception 'El precio debe ser un número entero entre 0 y 1.000.000 monedas.'; end if;
    if (item->>'kind')||':'||(item->>'id')=any(seen) then raise exception 'Artículo duplicado.'; end if;
    seen:=array_append(seen,(item->>'kind')||':'||(item->>'id'));
    -- Validate against the catalog actually returned, including when an optional
    -- catalog is not installed. No dynamic identifier comes from the client.
    if item->>'kind'='banner' then
      if not exists(select 1 from jsonb_array_elements(prior->'banners') as p(value) where p.value->>'id'=item->>'id') then
        raise exception 'Artículo desconocido. Actualiza el catálogo.';
      end if;
      execute 'update public.profile_banner_catalog set price=$1 where id=$2' using amount::integer,item->>'id';
    else
      if not exists(select 1 from jsonb_array_elements(prior->'vouchers') as p(value) where p.value->>'id'=item->>'id') then
        raise exception 'Artículo desconocido. Actualiza el catálogo.';
      end if;
      if exists(select 1 from jsonb_array_elements(prior->'vouchers') as p(value) where p.value->>'id'=item->>'id' and (p.value->>'minimum_price')::numeric>amount) then
        raise exception 'Un vale de monedas no puede costar menos que las monedas que entrega.';
      end if;
      execute 'update public.reward_voucher_catalog set price=$1 where id=$2' using amount::integer,item->>'id';
    end if;
    -- EXECUTE does not set FOUND; inspect its affected-row count instead.
    get diagnostics affected = row_count;
    if affected<>1 then raise exception 'El catálogo cambió. Actualiza antes de guardar.'; end if;
  end loop;
  update public.club_economy_configuration set rarity_weights=weights,revision=revision+1,updated_at=now(),updated_by=auth.uid() where singleton;
  insert into public.club_economy_audit(actor,previous_state,next_state) values(auth.uid(),prior,public.admin_get_club_economy());
  return public.admin_get_club_economy();
end;
$$;
revoke all on function public.admin_get_club_economy() from public,anon;
revoke all on function public.admin_save_club_economy(bigint,jsonb,jsonb) from public,anon;
grant execute on function public.admin_get_club_economy() to authenticated;
grant execute on function public.admin_save_club_economy(bigint,jsonb,jsonb) to authenticated;
commit;

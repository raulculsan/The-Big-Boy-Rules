-- Shop economy: server-authoritative prices and weighted rarity draws.
begin;
create table if not exists public.club_economy_configuration (
  singleton boolean primary key default true check(singleton),
  rarity_weights jsonb not null,
  revision bigint not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
alter table public.club_economy_configuration enable row level security;
revoke all on public.club_economy_configuration from public, anon, authenticated;
-- Preserve the currently deployed probabilities when installing this migration.
insert into public.club_economy_configuration(singleton,rarity_weights)
select true,jsonb_object_agg(edition,weight) from public.card_pack_rarity_weights()
on conflict(singleton) do nothing;
create table if not exists public.club_economy_audit (
  id bigint generated always as identity primary key,
  actor uuid not null references auth.users(id),
  changed_at timestamptz not null default now(),
  previous_state jsonb not null,
  next_state jsonb not null
);
alter table public.club_economy_audit enable row level security;
revoke all on public.club_economy_audit from public, anon, authenticated;

create or replace function public.card_pack_rarity_weights()
returns table(edition text,weight integer) language sql stable security definer set search_path = '' as $$
  select e.key,e.value::integer from public.club_economy_configuration c,
    lateral jsonb_each_text(c.rarity_weights) e where c.singleton;
$$;
revoke all on function public.card_pack_rarity_weights() from public,anon,authenticated;

create or replace function public.admin_get_club_economy()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.current_user_is_superadmin() then raise exception 'Solo la cuenta de administración puede gestionar la economía.' using errcode='42501'; end if;
  perform public.assert_account_security();
  return jsonb_build_object(
    'revision',(select revision from public.club_economy_configuration where singleton),
    'probabilities',(select jsonb_object_agg(edition,round(100.0*weight/total,2)) from
      (select w.*,sum(weight) over() total from public.card_pack_rarity_weights() w) odds),
    'banners',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'price',price,'active',active) order by name) from public.profile_banner_catalog),'[]'::jsonb),
    'vouchers',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'price',price,'active',active,'minimum_price',case when reward_type='coins' then reward_amount else 0 end) order by name) from public.reward_voucher_catalog),'[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_save_club_economy(p_revision bigint,p_probabilities jsonb,p_prices jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  saved public.club_economy_configuration%rowtype;
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
  if jsonb_array_length(p_prices)<>(select count(*) from public.profile_banner_catalog)+(select count(*) from public.reward_voucher_catalog)
    then raise exception 'El catálogo cambió. Actualiza antes de guardar.'; end if;
  prior:=public.admin_get_club_economy();
  for item in select value from jsonb_array_elements(p_prices) loop
    if jsonb_typeof(item->'price') is distinct from 'number' or jsonb_typeof(item->'id') is distinct from 'string' or item->>'kind' not in ('banner','voucher') or item->>'kind' is null then raise exception 'Artículo no válido.'; end if;
    amount:=(item->>'price')::numeric;
    if amount<0 or amount>1000000 or amount<>trunc(amount) then raise exception 'El precio debe ser un número entero entre 0 y 1.000.000 monedas.'; end if;
    if (item->>'kind')||':'||(item->>'id')=any(seen) then raise exception 'Artículo duplicado.'; end if;
    seen:=array_append(seen,(item->>'kind')||':'||(item->>'id'));
    if item->>'kind'='banner' then
      update public.profile_banner_catalog set price=amount::integer where id=item->>'id';
    else
      if exists(select 1 from public.reward_voucher_catalog where id=item->>'id' and reward_type='coins' and reward_amount>amount)
        then raise exception 'Un vale de monedas no puede costar menos que las monedas que entrega.'; end if;
      update public.reward_voucher_catalog set price=amount::integer where id=item->>'id';
    end if;
    if not found then raise exception 'Artículo desconocido. Actualiza el catálogo.'; end if;
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

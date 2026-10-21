-- Repeatable migration. Run after supabase-admin-grants.sql.
-- Administrator operations use the same wallet-first economy lock as opening,
-- buying and discarding; account/profile permissions remain unchanged.
begin;

alter table public.member_coin_ledger drop constraint if exists member_coin_ledger_reason_check;
alter table public.member_coin_ledger add constraint member_coin_ledger_reason_check
  check (reason in ('duplicate_discard','banner_purchase','admin_grant','admin_adjust'));

create table if not exists public.admin_user_management_requests (
  request_id uuid primary key,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  resource text not null check (resource in ('packs','coins','banner')),
  operation text not null check (operation in ('add','remove','gift')),
  amount integer,
  banner_id text references public.profile_banner_catalog(id),
  result jsonb,
  created_at timestamptz not null default clock_timestamp(),
  check ((resource in ('packs','coins') and operation in ('add','remove') and amount is not null and amount > 0 and banner_id is null)
    or (resource = 'banner' and operation = 'gift' and amount is null and banner_id is not null))
);
-- Audit records must not prevent the existing account deletion flow. Also
-- upgrade databases where the first version of this migration already ran.
alter table public.admin_user_management_requests
  drop constraint if exists admin_user_management_requests_actor_id_fkey,
  drop constraint if exists admin_user_management_requests_user_id_fkey;
alter table public.admin_user_management_requests
  add constraint admin_user_management_requests_actor_id_fkey
    foreign key (actor_id) references public.profiles(id) on delete cascade,
  add constraint admin_user_management_requests_user_id_fkey
    foreign key (user_id) references public.profiles(id) on delete cascade;
-- Retain a daily claim after an administrator removes that day's unopened pack.
-- Otherwise claim_daily_card_pack would silently recreate it on the next login.
create table if not exists public.admin_removed_daily_pack_claims (
  user_id uuid not null references public.profiles(id) on delete cascade,
  earned_day date not null,
  primary key (user_id,earned_day)
);
alter table public.admin_user_management_requests enable row level security;
alter table public.admin_removed_daily_pack_claims enable row level security;
revoke all on public.admin_user_management_requests,public.admin_removed_daily_pack_claims from public,anon,authenticated;

create or replace function public.lock_admin_user_management_target(target_user_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare actor uuid := auth.uid(); actor_role text; actor_hidden boolean;
begin
  if actor is null or target_user_id is null then
    raise exception 'Inicia sesión como administrador.' using errcode = '42501';
  end if;
  -- Ordered account locks hold the actor's permission and target visibility until
  -- commit, including concurrent role edits. These precede economy row locks.
  perform 1 from public.profiles where id in (actor,target_user_id) order by id for share;
  select role,coalesce(is_hidden,false) into actor_role,actor_hidden from public.profiles where id=actor;
  if actor_role is null or actor_role not in ('admin','superadmin')
    or (actor_role='admin' and actor_hidden) or not public.current_user_is_club_admin() then
    raise exception 'Solo los administradores pueden editar los recursos de un usuario.' using errcode='42501';
  end if;
  if not exists (select 1 from public.profiles where id=target_user_id and not coalesce(is_hidden,false)) then
    raise exception 'El miembro seleccionado no está disponible.' using errcode='22023';
  end if;
  return actor;
end;
$$;
revoke all on function public.lock_admin_user_management_target(uuid) from public,anon,authenticated;

create or replace function public.get_admin_user_management_state(target_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.lock_admin_user_management_target(target_user_id);
  return jsonb_build_object(
    'user_id',target_user_id,
    'balance',coalesce((select balance from public.member_coin_wallets where user_id=target_user_id),0),
    'available_packs',(select count(*) from public.card_packs where user_id=target_user_id and opened_at is null),
    'banners',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'name',b.name,
      'description',b.description,'art_key',b.art_key,'price',b.price,'active',b.active,
      'owned',o.banner_id is not null,'equipped',e.banner_id is not null) order by b.name,b.id)
      from public.profile_banner_catalog b
      left join public.member_owned_banners o on o.banner_id=b.id and o.user_id=target_user_id
      left join public.member_equipped_banners e on e.banner_id=b.id and e.user_id=target_user_id
      where b.active or o.banner_id is not null),'[]'::jsonb),
    'equipped_banner_id',(select banner_id from public.member_equipped_banners where user_id=target_user_id)
  );
end;
$$;

create or replace function public.admin_adjust_user_resources(
  target_user_id uuid,resource_kind text,operation text,amount integer,request_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  actor uuid := public.lock_admin_user_management_target(target_user_id);
  previous public.admin_user_management_requests%rowtype;
  new_balance bigint; available_count bigint; signed_amount bigint;
  removed_count bigint; response jsonb;
begin
  if resource_kind is null or resource_kind not in ('packs','coins') or operation is null
    or operation not in ('add','remove') or amount is null or amount <= 0 or request_id is null then
    raise exception 'Elige sobres o monedas y una cantidad entera mayor que cero.' using errcode='22023';
  end if;
  -- Pack creation materializes rows, so bound work per transaction. No ownership
  -- cap: multiple requests can grant more. Coins use the full positive int range.
  if resource_kind='packs' and amount > 10000 then
    raise exception 'Puedes modificar hasta 10.000 sobres en una operación.' using errcode='22023';
  end if;
  insert into public.admin_user_management_requests(request_id,actor_id,user_id,resource,operation,amount)
    values(request_id,actor,target_user_id,resource_kind,operation,amount) on conflict do nothing;
  select * into previous from public.admin_user_management_requests r
    where r.request_id=admin_adjust_user_resources.request_id for update;
  if previous.actor_id is distinct from actor or previous.user_id is distinct from target_user_id
    or previous.resource is distinct from resource_kind or previous.operation is distinct from operation
    or previous.amount is distinct from amount or previous.banner_id is not null then
    raise exception 'Esta solicitud pertenece a otra edición.' using errcode='22023';
  end if;
  if previous.result is not null then return previous.result; end if;
  insert into public.member_coin_wallets(user_id) values(target_user_id) on conflict do nothing;
  select balance into new_balance from public.member_coin_wallets where user_id=target_user_id for update;
  signed_amount := case when operation='add' then amount::bigint else -amount::bigint end;
  if resource_kind='coins' then
    if signed_amount < 0 and new_balance < amount::bigint then
      raise exception 'El usuario no tiene suficientes monedas para quitar esa cantidad.' using errcode='22023';
    end if;
    if signed_amount > 0 and new_balance > 9223372036854775807::bigint - signed_amount then
      raise exception 'El saldo ha alcanzado su límite.' using errcode='22003';
    end if;
    update public.member_coin_wallets set balance=balance+signed_amount
      where user_id=target_user_id returning balance into new_balance;
    insert into public.member_coin_ledger(user_id,delta,balance_after,reason,item_id)
      values(target_user_id,signed_amount,new_balance,'admin_adjust',request_id::text);
  elsif operation='add' then
    insert into public.card_packs(user_id,earned_day,collection_key,source)
      select target_user_id,(statement_timestamp() at time zone 'Europe/Madrid')::date,'los-nuestros-01','admin'
      from generate_series(1,amount);
  else
    select count(*) into available_count from public.card_packs where user_id=target_user_id and opened_at is null;
    if available_count < amount::bigint then
      raise exception 'El usuario no tiene suficientes sobres sin abrir para quitar esa cantidad.' using errcode='22023';
    end if;
    with selected as (
      select id from public.card_packs where user_id=target_user_id and opened_at is null
      order by (source='admin') desc,earned_day desc,id desc limit amount for update
    ), removed as (
      delete from public.card_packs p using selected s where p.id=s.id and p.opened_at is null
      returning p.user_id,p.earned_day,p.source
    ), retained_claims as (
      insert into public.admin_removed_daily_pack_claims(user_id,earned_day)
        select user_id,earned_day from removed where source='daily' on conflict do nothing returning user_id
    ) select count(*) into removed_count from removed;
    if removed_count <> amount::bigint then
      raise exception 'Los sobres han cambiado. Vuelve a intentarlo.' using errcode='40001';
    end if;
  end if;
  select count(*) into available_count from public.card_packs where user_id=target_user_id and opened_at is null;
  response := jsonb_build_object('user_id',target_user_id,'resource',resource_kind,'operation',operation,
    'amount',amount,'delta',signed_amount,'balance',new_balance,'available_packs',available_count,'request_id',request_id);
  update public.admin_user_management_requests r set result=response where r.request_id=admin_adjust_user_resources.request_id;
  return response;
end;
$$;

create or replace function public.admin_gift_user_banner(target_user_id uuid,target_banner_id text,request_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  actor uuid := public.lock_admin_user_management_target(target_user_id);
  previous public.admin_user_management_requests%rowtype;
  new_balance bigint; available_count bigint; inserted_rows integer; response jsonb;
begin
  if target_banner_id is null or request_id is null then
    raise exception 'Elige un banner disponible.' using errcode='22023';
  end if;
  insert into public.admin_user_management_requests(request_id,actor_id,user_id,resource,operation,banner_id)
    select request_id,actor,target_user_id,'banner','gift',b.id from public.profile_banner_catalog b
    where b.id=target_banner_id on conflict do nothing;
  select * into previous from public.admin_user_management_requests r where r.request_id=admin_gift_user_banner.request_id for update;
  if not found then raise exception 'El banner no está disponible.' using errcode='22023'; end if;
  if previous.actor_id is distinct from actor or previous.user_id is distinct from target_user_id
    or previous.resource<>'banner' or previous.operation<>'gift' or previous.banner_id is distinct from target_banner_id then
    raise exception 'Esta solicitud pertenece a otro regalo.' using errcode='22023';
  end if;
  if previous.result is not null then return previous.result; end if;
  insert into public.member_coin_wallets(user_id) values(target_user_id) on conflict do nothing;
  select balance into new_balance from public.member_coin_wallets where user_id=target_user_id for update;
  perform 1 from public.profile_banner_catalog where id=target_banner_id and active for share;
  if not found then raise exception 'El banner no está disponible.' using errcode='22023'; end if;
  insert into public.member_owned_banners(user_id,banner_id) values(target_user_id,target_banner_id) on conflict do nothing;
  get diagnostics inserted_rows=row_count;
  select count(*) into available_count from public.card_packs where user_id=target_user_id and opened_at is null;
  response := jsonb_build_object('user_id',target_user_id,'banner_id',target_banner_id,'owned',true,
    'granted',inserted_rows=1,'balance',new_balance,'available_packs',available_count,'request_id',request_id);
  update public.admin_user_management_requests r set result=response where r.request_id=admin_gift_user_banner.request_id;
  return response;
end;
$$;

create or replace function public.claim_daily_card_pack()
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  actor uuid := public.lock_banner_shop_actor();
  today date := (statement_timestamp() at time zone 'Europe/Madrid')::date;
  inserted_rows integer; available_count bigint; total_count bigint;
begin
  insert into public.card_packs(user_id,earned_day,source)
    select actor,today,'daily' where not exists (
      select 1 from public.admin_removed_daily_pack_claims where user_id=actor and earned_day=today
    ) on conflict (user_id,earned_day) where source='daily' do nothing;
  get diagnostics inserted_rows=row_count;
  select count(*) filter (where opened_at is null),count(*) into available_count,total_count
    from public.card_packs where user_id=actor;
  return jsonb_build_object('available',available_count,'total',total_count,'credited',inserted_rows=1,
    'day',today,'next_reset_at',((today+1)::timestamp at time zone 'Europe/Madrid'));
end;
$$;

revoke all on function public.get_admin_user_management_state(uuid),
  public.admin_adjust_user_resources(uuid,text,text,integer,uuid),public.admin_gift_user_banner(uuid,text,uuid),
  public.claim_daily_card_pack() from public,anon,authenticated;
grant execute on function public.get_admin_user_management_state(uuid),
  public.admin_adjust_user_resources(uuid,text,text,integer,uuid),public.admin_gift_user_banner(uuid,text,uuid),
  public.claim_daily_card_pack() to authenticated;
notify pgrst,'reload schema';
commit;

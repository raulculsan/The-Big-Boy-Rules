-- Colección social: ejecutar tras supabase-banner-shop.sql.
-- Operaciones 1:1, sin monedas. Las ofertas no reservan cartas: se revalidan al aceptar.
begin;
create table if not exists public.member_card_marks (
 user_id uuid not null references public.profiles(id) on delete cascade,
 card_id text not null references public.achievement_card_catalog(id),
 kind text not null check(kind in ('favorite','wanted')),
 created_at timestamptz not null default now(), primary key(user_id,card_id,kind)
);
create table if not exists public.card_trade_offers (
 id uuid primary key,
 sender_id uuid not null references public.profiles(id) on delete cascade,
 recipient_id uuid not null references public.profiles(id) on delete cascade,
 offered_card_id text not null references public.achievement_card_catalog(id),
 requested_card_id text not null references public.achievement_card_catalog(id),
 status text not null default 'pending' check(status in ('pending','accepted','declined','cancelled','expired','unavailable')),
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '7 days', resolved_at timestamptz,
 check(sender_id<>recipient_id), check(offered_card_id<>requested_card_id)
);
create index if not exists card_trade_recipient on public.card_trade_offers(recipient_id,created_at desc);
create index if not exists card_trade_sender on public.card_trade_offers(sender_id,created_at desc);
alter table public.member_card_marks enable row level security;
alter table public.card_trade_offers enable row level security;
revoke all on public.member_card_marks,public.card_trade_offers from public,anon,authenticated;

create or replace function public.get_collection_social_state()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=public.lock_banner_shop_actor();
begin
 update public.card_trade_offers set status='expired',resolved_at=now() where status='pending' and expires_at<=now() and actor in(sender_id,recipient_id);
 return jsonb_build_object(
 'marks',coalesce((select jsonb_agg(jsonb_build_object('card_id',card_id,'kind',kind)) from public.member_card_marks where user_id=actor),'[]'::jsonb),
 'peers',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name,'username',p.username,'cards',coalesce((select jsonb_agg(jsonb_build_object('card_id',i.card_id,'quantity',i.quantity)) from public.member_card_inventory i join public.achievement_card_catalog c on c.id=i.card_id and c.active where i.user_id=p.id and i.quantity>1),'[]'::jsonb))) from public.profiles p where p.id<>actor and not p.is_hidden),'[]'::jsonb),
 'trades',coalesce((select jsonb_agg(row_data order by created_at desc) from (select t.*,s.display_name sender_name,r.display_name recipient_name from public.card_trade_offers t join public.profiles s on s.id=t.sender_id join public.profiles r on r.id=t.recipient_id where actor in(t.sender_id,t.recipient_id) order by t.created_at desc limit 100) row_data),'[]'::jsonb));
end; $$;
create or replace function public.set_collection_card_mark(target_card_id text,mark_kind text,enabled boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=public.lock_banner_shop_actor();
begin
 if mark_kind not in('favorite','wanted') or enabled is null then raise exception 'Marcador no válido.'; end if;
 if not exists(select 1 from public.achievement_card_catalog where id=target_card_id and active) then raise exception 'Carta no disponible.'; end if;
 if enabled and mark_kind='favorite' and not exists(select 1 from public.member_card_inventory where user_id=actor and card_id=target_card_id and quantity>0) then raise exception 'Consigue esta carta antes de marcarla como favorita.'; end if;
 if enabled and mark_kind='wanted' and exists(select 1 from public.member_card_inventory where user_id=actor and card_id=target_card_id and quantity>0) then raise exception 'Ya tienes esta carta en tu álbum.'; end if;
 if enabled then insert into public.member_card_marks(user_id,card_id,kind) values(actor,target_card_id,mark_kind) on conflict do nothing;
 else delete from public.member_card_marks where user_id=actor and card_id=target_card_id and kind=mark_kind; end if;
end; $$;
create or replace function public.clear_acquired_card_wish()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin delete from public.member_card_marks where user_id=new.user_id and card_id=new.card_id and kind='wanted'; return new; end; $$;
drop trigger if exists clear_acquired_card_wish on public.member_card_inventory;
create trigger clear_acquired_card_wish after insert or update of quantity on public.member_card_inventory for each row execute function public.clear_acquired_card_wish();

create or replace function public.create_card_trade(offer_id uuid,target_user_id uuid,give_card_id text,receive_card_id text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=public.lock_banner_shop_actor(); existing public.card_trade_offers%rowtype;
begin
 select * into existing from public.card_trade_offers where id=offer_id;
 if found then
  if existing.sender_id=actor and existing.recipient_id=target_user_id and existing.offered_card_id=give_card_id and existing.requested_card_id=receive_card_id then return existing.id; end if;
  raise exception 'Esta solicitud ya existe.';
 end if;
 if target_user_id=actor or not exists(select 1 from public.profiles where id=target_user_id and not is_hidden) then raise exception 'Elige otro miembro disponible.'; end if;
 if give_card_id=receive_card_id then raise exception 'Selecciona dos cartas diferentes.'; end if;
 if not exists(select 1 from public.member_card_inventory i join public.achievement_card_catalog c on c.id=i.card_id and c.active where i.user_id=actor and i.card_id=give_card_id and i.quantity>1)
 or not exists(select 1 from public.member_card_inventory i join public.achievement_card_catalog c on c.id=i.card_id and c.active where i.user_id=target_user_id and i.card_id=receive_card_id and i.quantity>1) then raise exception 'Ambos debéis tener una copia repetida para intercambiar.'; end if;
 if (select count(*) from public.card_trade_offers where sender_id=actor and status='pending' and expires_at>now())>=20 then raise exception 'Ya tienes 20 propuestas pendientes. Resuelve alguna primero.'; end if;
 if exists(select 1 from public.card_trade_offers where sender_id=actor and recipient_id=target_user_id and offered_card_id=give_card_id and requested_card_id=receive_card_id and status='pending' and expires_at>now()) then raise exception 'Ya has propuesto este intercambio.'; end if;
 insert into public.card_trade_offers(id,sender_id,recipient_id,offered_card_id,requested_card_id) values(offer_id,actor,target_user_id,give_card_id,receive_card_id);
 return offer_id;
end; $$;

create or replace function public.resolve_card_trade(offer_id uuid,decision text)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid(); offer public.card_trade_offers%rowtype;
begin
 if actor is null or not exists(select 1 from public.profiles where id=actor and not is_hidden) then raise exception 'Inicia sesión.' using errcode='42501'; end if;
 if decision not in('accept','decline','cancel') then raise exception 'Acción no válida.'; end if;
 -- Snapshot for deterministic wallet lock order, matching the economy's wallet-before-inventory order.
 select * into offer from public.card_trade_offers where id=offer_id;
 if not found or actor not in(offer.sender_id,offer.recipient_id) then raise exception 'Intercambio no disponible.' using errcode='42501'; end if;
 if (decision='cancel' and actor<>offer.sender_id) or (decision in('accept','decline') and actor<>offer.recipient_id) then raise exception 'No puedes realizar esta acción.' using errcode='42501'; end if;
 insert into public.member_coin_wallets(user_id) select member_id from unnest(array[offer.sender_id,offer.recipient_id]) member_id order by member_id on conflict do nothing;
 perform 1 from public.member_coin_wallets where user_id in(offer.sender_id,offer.recipient_id) order by user_id for update;
 select * into offer from public.card_trade_offers where id=offer_id for update;
 if offer.status<>'pending' then return offer.status; end if;
 if offer.expires_at<=now() then update public.card_trade_offers set status='expired',resolved_at=now() where id=offer.id; return 'expired'; end if;
 if decision<>'accept' then
  update public.card_trade_offers set status=case decision when 'cancel' then 'cancelled' else 'declined' end,resolved_at=now() where id=offer.id;
  return case decision when 'cancel' then 'cancelled' else 'declined' end;
 end if;
 perform 1 from public.member_card_inventory where (user_id=offer.sender_id and card_id=offer.offered_card_id) or (user_id=offer.recipient_id and card_id=offer.requested_card_id) order by user_id,card_id for update;
 if exists(select 1 from public.profiles where id in(offer.sender_id,offer.recipient_id) and is_hidden)
 or not exists(select 1 from public.member_card_inventory where user_id=offer.sender_id and card_id=offer.offered_card_id and quantity>1)
 or not exists(select 1 from public.member_card_inventory where user_id=offer.recipient_id and card_id=offer.requested_card_id and quantity>1)
 or (select count(*) from public.achievement_card_catalog where id in(offer.offered_card_id,offer.requested_card_id) and active)<>2 then
  update public.card_trade_offers set status='unavailable',resolved_at=now() where id=offer.id; return 'unavailable';
 end if;
 update public.member_card_inventory set quantity=quantity-1 where (user_id=offer.sender_id and card_id=offer.offered_card_id) or (user_id=offer.recipient_id and card_id=offer.requested_card_id);
 insert into public.member_card_inventory(user_id,card_id,quantity) values(offer.recipient_id,offer.offered_card_id,1),(offer.sender_id,offer.requested_card_id,1)
 on conflict(user_id,card_id) do update set quantity=public.member_card_inventory.quantity+1;
 update public.card_trade_offers set status='accepted',resolved_at=now() where id=offer.id;
 return 'accepted';
end; $$;
revoke all on function public.get_collection_social_state(),public.set_collection_card_mark(text,text,boolean),public.create_card_trade(uuid,uuid,text,text),public.resolve_card_trade(uuid,text),public.clear_acquired_card_wish() from public,anon,authenticated;
grant execute on function public.get_collection_social_state(),public.set_collection_card_mark(text,text,boolean),public.create_card_trade(uuid,uuid,text,text),public.resolve_card_trade(uuid,text) to authenticated;
commit;

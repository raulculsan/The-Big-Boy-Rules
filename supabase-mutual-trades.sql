-- Bilateral trades v2. Run after supabase-trade-requests.sql and social notifications.
begin;
-- Legacy offers specified another person's card. Retire them before enabling v2.
drop trigger if exists notify_card_trade_changed on public.card_trade_offers;
update public.card_trade_offers set status='cancelled',resolved_at=now() where status='pending';
alter table public.card_trade_offers alter column requested_card_id drop not null;
alter table public.card_trade_offers drop constraint if exists card_trade_offers_status_check;
alter table public.card_trade_offers add constraint card_trade_offers_status_check check(status in('invited','selecting','review','pending','accepted','declined','cancelled','expired','unavailable'));
alter table public.card_trade_offers drop constraint if exists card_trade_mutual_stage;
alter table public.card_trade_offers add constraint card_trade_mutual_stage check((status not in('invited','selecting') or requested_card_id is null) and (status<>'review' or requested_card_id is not null));
alter table public.card_trade_offers add column if not exists recipient_joined_at timestamptz;
alter table public.card_trade_offers add column if not exists proposed_at timestamptz;
-- Disable the old protocol: old clients cannot transfer cards by accepting an invitation.
create or replace function public.create_card_trade(offer_id uuid,target_user_id uuid,give_card_id text,receive_card_id text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$ begin raise exception 'Actualiza la aplicación para usar los nuevos intercambios.'; end; $$;
create or replace function public.resolve_card_trade(offer_id uuid,decision text)
returns text language plpgsql security definer set search_path=public,pg_temp as $$ begin raise exception 'Actualiza la aplicación para usar los nuevos intercambios.'; end; $$;
create or replace function public.get_card_trade_updates()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid();
begin
 if actor is null or not exists(select 1 from public.profiles where id=actor and not is_hidden) then raise exception 'Inicia sesión.' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(row_data order by created_at desc) from (
 select t.id,t.sender_id,t.recipient_id,t.offered_card_id,t.requested_card_id,
 case when t.status in('invited','selecting','review') and t.expires_at<=now() then 'expired' else t.status end status,
 t.created_at,t.expires_at,t.resolved_at,t.recipient_joined_at,t.proposed_at,s.display_name sender_name,r.display_name recipient_name
 from public.card_trade_offers t join public.profiles s on s.id=t.sender_id join public.profiles r on r.id=t.recipient_id
 where actor in(t.sender_id,t.recipient_id) order by t.created_at desc limit 100) row_data),'[]'::jsonb);
end; $$;
create or replace function public.get_collection_social_state()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid(); trades jsonb;
begin
 trades:=public.get_card_trade_updates();
 return jsonb_build_object('marks',coalesce((select jsonb_agg(jsonb_build_object('card_id',card_id,'kind',kind)) from public.member_card_marks where user_id=actor),'[]'::jsonb),
 'peers',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',display_name,'username',username,'avatar_url',avatar_url) order by display_name) from public.profiles where id<>actor and not is_hidden),'[]'::jsonb),'trades',trades);
end; $$;
create or replace function public.invite_card_trade(offer_id uuid,target_user_id uuid,give_card_id text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=public.lock_banner_shop_actor(); existing public.card_trade_offers%rowtype;
begin
 select * into existing from public.card_trade_offers where id=offer_id;
 if found then
 if existing.sender_id=actor and existing.recipient_id=target_user_id and existing.offered_card_id=give_card_id then return existing.id; end if;
 raise exception 'Esta solicitud ya existe.'; end if;
 if target_user_id=actor or not exists(select 1 from public.profiles where id=target_user_id and not is_hidden) then raise exception 'Elige un miembro disponible.'; end if;
 if not exists(select 1 from public.member_card_inventory i join public.achievement_card_catalog c on c.id=i.card_id and c.active where i.user_id=actor and i.card_id=give_card_id and i.quantity>1) then raise exception 'Solo puedes ofrecer una carta repetida.'; end if;
 if (select count(*) from public.card_trade_offers where sender_id=actor and status in('invited','selecting','review') and expires_at>now())>=20 then raise exception 'Resuelve alguna solicitud pendiente antes de crear otra.'; end if;
 if exists(select 1 from public.card_trade_offers where sender_id=actor and recipient_id=target_user_id and status in('invited','selecting','review') and expires_at>now()) then raise exception 'Ya tienes un intercambio abierto con esta persona.'; end if;
 insert into public.card_trade_offers(id,sender_id,recipient_id,offered_card_id,status) values(offer_id,actor,target_user_id,give_card_id,'invited');
 return offer_id;
end; $$;
create or replace function public.advance_card_trade(offer_id uuid,decision text,own_card_id text default null)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid(); offer public.card_trade_offers%rowtype; next_status text;
begin
 if actor is null or not exists(select 1 from public.profiles where id=actor and not is_hidden) then raise exception 'Inicia sesión.' using errcode='42501'; end if;
 if decision not in('join','propose','confirm','decline','cancel') then raise exception 'Acción no válida.'; end if;
 select * into offer from public.card_trade_offers where id=offer_id;
 if not found or actor not in(offer.sender_id,offer.recipient_id) then raise exception 'Intercambio no disponible.' using errcode='42501'; end if;
 -- Wallets first, in the same order as the rest of the economy. No row lock is held before these.
 insert into public.member_coin_wallets(user_id) select member_id from unnest(array[offer.sender_id,offer.recipient_id]) member_id order by member_id on conflict do nothing;
 perform 1 from public.member_coin_wallets where user_id in(offer.sender_id,offer.recipient_id) order by user_id for update;
 select * into offer from public.card_trade_offers where id=offer_id for update;
 if offer.status not in('invited','selecting','review') then return offer.status; end if;
 if offer.expires_at<=now() then update public.card_trade_offers set status='expired',resolved_at=now() where id=offer.id; return 'expired'; end if;
 if decision='cancel' and actor=offer.sender_id then next_status:='cancelled';
 elsif decision='decline' and actor=offer.recipient_id then next_status:='declined';
 elsif decision='join' and actor=offer.recipient_id and offer.status='invited' then
 update public.card_trade_offers set status='selecting',recipient_joined_at=now() where id=offer.id; return 'selecting';
 elsif decision='propose' and actor=offer.recipient_id and offer.status='selecting' then
 if own_card_id=offer.offered_card_id or not exists(select 1 from public.member_card_inventory i join public.achievement_card_catalog c on c.id=i.card_id and c.active where i.user_id=actor and i.card_id=own_card_id and i.quantity>1) then raise exception 'Elige una repetida diferente de la carta que recibirás.'; end if;
 update public.card_trade_offers set status='review',requested_card_id=own_card_id,proposed_at=now() where id=offer.id; return 'review';
 elsif decision='confirm' and actor=offer.sender_id and offer.status='review' then
 -- The recipient explicitly confirmed their selected card in propose; this is the sender's final consent.
 perform 1 from public.member_card_inventory where user_id in(offer.sender_id,offer.recipient_id) and card_id in(offer.offered_card_id,offer.requested_card_id) order by user_id,card_id for update;
 if exists(select 1 from public.profiles where id in(offer.sender_id,offer.recipient_id) and is_hidden)
 or not exists(select 1 from public.member_card_inventory where user_id=offer.sender_id and card_id=offer.offered_card_id and quantity>1)
 or not exists(select 1 from public.member_card_inventory where user_id=offer.recipient_id and card_id=offer.requested_card_id and quantity>1)
 or (select count(*) from public.achievement_card_catalog where id in(offer.offered_card_id,offer.requested_card_id) and active)<>2 then next_status:='unavailable';
 else
 update public.member_card_inventory set quantity=quantity-1 where (user_id=offer.sender_id and card_id=offer.offered_card_id) or (user_id=offer.recipient_id and card_id=offer.requested_card_id);
 insert into public.member_card_inventory(user_id,card_id,quantity) values(offer.recipient_id,offer.offered_card_id,1),(offer.sender_id,offer.requested_card_id,1) on conflict(user_id,card_id) do update set quantity=public.member_card_inventory.quantity+1;
 next_status:='accepted'; end if;
 else raise exception 'Esta acción ya no está disponible. Actualiza el intercambio.'; end if;
 update public.card_trade_offers set status=next_status,resolved_at=now() where id=offer.id; return next_status;
end; $$;
create or replace function public.notify_card_trade_changed()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare target uuid; detail text;
begin
 if tg_op='UPDATE' and old.status is not distinct from new.status then return new; end if;
 if new.status='invited' then target:=new.recipient_id; detail:='Quiere intercambiar contigo. Puedes aceptar participar o rechazar.';
 elsif new.status='selecting' then target:=new.sender_id; detail:='Ha aceptado participar y está eligiendo su carta.';
 elsif new.status='review' then target:=new.sender_id; detail:='Ha elegido y confirmado su carta. Revisa el intercambio y decide.';
 else target:=case when auth.uid()=new.sender_id then new.recipient_id else new.sender_id end;
 detail:=case new.status when 'accepted' then 'Intercambio completado. Las cartas ya están en vuestros álbumes.' when 'declined' then 'Ha rechazado el intercambio.' when 'cancelled' then 'Ha cancelado el intercambio.' when 'expired' then 'El intercambio ha caducado.' else 'El intercambio ya no está disponible.' end; end if;
 insert into public.notifications(user_id,actor_id,type,target_type,excerpt) values(target,auth.uid(),case when new.status in('invited','review') then 'trade_offer' else 'trade_resolved' end,'trade',detail);
 return new;
end; $$;
create trigger notify_card_trade_changed after insert or update of status on public.card_trade_offers
for each row execute function public.notify_card_trade_changed();
revoke all on function public.invite_card_trade(uuid,uuid,text),public.advance_card_trade(uuid,text,text) from public,anon,authenticated;
grant execute on function public.invite_card_trade(uuid,uuid,text),public.advance_card_trade(uuid,text,text) to authenticated;
commit;

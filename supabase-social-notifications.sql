-- Avisos dentro de la app para encuestas e intercambios.
-- Ejecutar después de supabase-group-interactions.sql,
-- supabase-collection-social.sql y supabase-notification-preferences.sql.
begin;
create or replace function public.notify_group_poll_created()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 insert into public.notifications(user_id,actor_id,type,target_type,target_id,excerpt)
 select id,new.created_by,'group_poll','group',new.channel_id,left(new.question,180)
 from public.profiles where not is_hidden and id<>new.created_by;
 return new;
end; $$;
drop trigger if exists notify_group_poll_created on public.group_polls;
create trigger notify_group_poll_created after insert on public.group_polls
for each row execute function public.notify_group_poll_created();

create or replace function public.notify_card_trade_changed()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare recipient uuid; kind text; detail text;
begin
 if tg_op='INSERT' then
  recipient:=new.recipient_id;
  kind:='trade_offer';
  detail:='Te han propuesto un intercambio de cartas.';
 else
  if old.status is not distinct from new.status or new.status='pending' then return new; end if;
  recipient:=case when auth.uid()=new.sender_id then new.recipient_id else new.sender_id end;
  kind:='trade_resolved';
  detail:=case new.status
   when 'accepted' then 'Se ha completado un intercambio de cartas.'
   when 'declined' then 'Han rechazado tu propuesta de intercambio.'
   when 'cancelled' then 'Han cancelado una propuesta de intercambio.'
   when 'expired' then 'Una propuesta de intercambio ha caducado.'
   else 'Una propuesta de intercambio ya no está disponible.' end;
 end if;
 insert into public.notifications(user_id,actor_id,type,target_type,excerpt)
 values(recipient,auth.uid(),kind,'trade',detail);
 return new;
end; $$;
drop trigger if exists notify_card_trade_changed on public.card_trade_offers;
create trigger notify_card_trade_changed after insert or update of status on public.card_trade_offers
for each row execute function public.notify_card_trade_changed();
revoke all on function public.notify_group_poll_created(),public.notify_card_trade_changed() from public,anon,authenticated;
commit;

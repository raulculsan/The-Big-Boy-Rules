-- Lightweight authenticated recovery of requests; no peer inventories in background.
begin;
create or replace function public.get_card_trade_updates()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid();
begin
 if actor is null or not exists(select 1 from public.profiles where id=actor and not is_hidden) then
  raise exception 'Inicia sesión.' using errcode='42501';
 end if;
 return coalesce((select jsonb_agg(row_data order by created_at desc) from (
  select t.id,t.sender_id,t.recipient_id,t.offered_card_id,t.requested_card_id,
   case when t.status='pending' and t.expires_at<=now() then 'expired' else t.status end status,
   t.created_at,t.expires_at,t.resolved_at,s.display_name sender_name,r.display_name recipient_name
  from public.card_trade_offers t join public.profiles s on s.id=t.sender_id join public.profiles r on r.id=t.recipient_id
  where actor in(t.sender_id,t.recipient_id) order by t.created_at desc limit 100
 ) row_data),'[]'::jsonb);
end; $$;
revoke all on function public.get_card_trade_updates() from public,anon,authenticated;
grant execute on function public.get_card_trade_updates() to authenticated;
commit;

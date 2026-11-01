begin;

-- Tickets build on help_requests/help_messages, so existing conversations carry over.
-- New writes go through checked functions; both sides are notified and read state is tracked.
alter table public.help_requests
  add column subject text check(subject is null or length(subject) between 3 and 80),
  add column priority text not null default 'normal' check(priority in ('normal','high')),
  add column member_read_at timestamptz,
  add column staff_read_at timestamptz,
  add column closed_at timestamptz,
  add column closed_by uuid references auth.users(id) on delete set null;

-- The trigger is replaced below first: the old one rejects any write to a closed ticket.
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check(type = any(array['private_message','group_message','group_mention','like','reply','media_created','event_created','pack_granted','news_update','group_poll','trade_offer','trade_resolved','account_request','help_update']::text[]));
alter table public.notifications drop constraint notifications_target_type_check;
alter table public.notifications add constraint notifications_target_type_check check(target_type = any(array['private','moment','post','event','pack','news','group','trade','account_request','help']::text[]));

-- A closed ticket stays frozen except for read markers and an explicit reopen.
create or replace function public.keep_closed_help_request_locked() returns trigger language plpgsql security definer set search_path to 'public','pg_temp' as $$
begin
  if old.status='closed' and (new.status<>'closed' or new.handled_by is distinct from old.handled_by)
     and coalesce(current_setting('club.ticket_reopen',true),'')<>'on' then
    raise exception 'La petición está cerrada y no puede modificarse.';
  end if;
  return new;
end $$;

update public.help_requests set closed_at=updated_at where status='closed';

create function public.ticket_notify(ticket public.help_requests,actor uuid,excerpt text) returns void language plpgsql security definer set search_path to 'public','pg_temp' as $$
begin
  if actor=ticket.user_id then
    insert into public.notifications(user_id,actor_id,type,target_type,target_id,excerpt)
    select id,actor,'help_update','help',ticket.id,left(excerpt,180) from public.profiles
    where role in ('admin','superadmin') and id<>actor;
  else
    insert into public.notifications(user_id,actor_id,type,target_type,target_id,excerpt)
    values(ticket.user_id,actor,'help_update','help',ticket.id,left(excerpt,180));
  end if;
end $$;

create function public.ticket_for(p_id bigint) returns public.help_requests language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare found_ticket public.help_requests;
begin
  perform public.assert_account_security();
  select * into found_ticket from public.help_requests where id=p_id for update;
  if not found or not (found_ticket.user_id=auth.uid() or public.current_user_is_help_admin()) then
    raise exception 'Ese ticket no existe.' using errcode='P0002';
  end if;
  return found_ticket;
end $$;
revoke all on function public.ticket_notify(public.help_requests,uuid,text),public.ticket_for(bigint) from public,anon,authenticated;

create function public.create_ticket(p_type text,p_subject text,p_priority text,p_body text) returns bigint language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare actor uuid:=auth.uid(); ticket public.help_requests; subject_text text:=btrim(coalesce(p_subject,'')); body_text text:=btrim(coalesce(p_body,''));
begin
  perform public.assert_account_security();
  if actor is null then raise exception 'Inicia sesión.' using errcode='28000'; end if;
  if p_type not in ('help','suggestion','complaint') or p_priority not in ('normal','high') then raise exception 'Datos no válidos.' using errcode='22023'; end if;
  if length(subject_text) not between 3 and 80 then raise exception 'Pon un asunto de 3 a 80 caracteres.' using errcode='22023'; end if;
  if length(body_text) not between 1 and 2000 then raise exception 'Escribe un mensaje de hasta 2000 caracteres.' using errcode='22023'; end if;
  if (select count(*) from public.help_requests where user_id=actor and status<>'closed')>=5 then
    raise exception 'Tienes 5 tickets abiertos. Cierra alguno antes de crear otro.' using errcode='22023';
  end if;
  insert into public.help_requests(user_id,request_type,subject,priority,member_read_at) values(actor,p_type,subject_text,p_priority,now()) returning * into ticket;
  insert into public.help_messages(request_id,sender_id,body) values(ticket.id,actor,body_text);
  perform public.ticket_notify(ticket,actor,subject_text);
  return ticket.id;
end $$;

create function public.reply_ticket(p_id bigint,p_body text) returns void language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare actor uuid:=auth.uid(); ticket public.help_requests; body_text text:=btrim(coalesce(p_body,''));
begin
  ticket:=public.ticket_for(p_id);
  if ticket.status='closed' then raise exception 'Este ticket está cerrado. Reábrelo para responder.' using errcode='22023'; end if;
  if length(body_text) not between 1 and 2000 then raise exception 'Escribe un mensaje de hasta 2000 caracteres.' using errcode='22023'; end if;
  insert into public.help_messages(request_id,sender_id,body) values(p_id,actor,body_text);
  update public.help_requests set
    member_read_at=case when user_id=actor then now() else member_read_at end,
    staff_read_at=case when user_id<>actor then now() else staff_read_at end
    where id=p_id;
  perform public.ticket_notify(ticket,actor,body_text);
end $$;

create function public.set_ticket_status(p_id bigint,p_status text) returns void language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare actor uuid:=auth.uid(); ticket public.help_requests; staff boolean:=public.current_user_is_help_admin(); label text;
begin
  ticket:=public.ticket_for(p_id);
  if p_status not in ('new','in_progress','answered','closed') then raise exception 'Estado no válido.' using errcode='22023'; end if;
  if ticket.status=p_status then return; end if;
  -- Members may only close their ticket or reopen it; staff run the rest of the workflow.
  if not staff and not (p_status='closed' or ticket.status='closed') then
    raise exception 'Solo administración puede cambiar ese estado.' using errcode='42501';
  end if;
  if ticket.status='closed' then
    perform set_config('club.ticket_reopen','on',true);
    p_status:=case when staff then p_status else 'new' end;
    if p_status='closed' then return; end if;
  end if;
  update public.help_requests set status=p_status,
    handled_by=case when p_status='new' then null when staff then actor else handled_by end,
    closed_at=case when p_status='closed' then now() end,
    closed_by=case when p_status='closed' then actor end,
    updated_at=now() where id=p_id;
  perform set_config('club.ticket_reopen','',true);
  label:=case when p_status='closed' then 'Ticket cerrado' when ticket.status='closed' then 'Ticket reabierto' when p_status='in_progress' then 'Lo estamos revisando' when p_status='answered' then 'Ticket respondido' else 'Ticket actualizado' end;
  perform public.ticket_notify(ticket,actor,coalesce(ticket.subject,'Tu ticket')||': '||label);
end $$;

create function public.mark_ticket_read(p_id bigint) returns void language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare actor uuid:=auth.uid(); ticket public.help_requests;
begin
  ticket:=public.ticket_for(p_id);
  update public.help_requests set
    member_read_at=case when user_id=actor then now() else member_read_at end,
    staff_read_at=case when user_id<>actor then now() else staff_read_at end
    where id=p_id;
  update public.notifications set read_at=now() where user_id=actor and type='help_update' and target_id=p_id and read_at is null;
end $$;

revoke all on function public.create_ticket(text,text,text,text),public.reply_ticket(bigint,text),public.set_ticket_status(bigint,text),public.mark_ticket_read(bigint) from public,anon;
grant execute on function public.create_ticket(text,text,text,text),public.reply_ticket(bigint,text),public.set_ticket_status(bigint,text),public.mark_ticket_read(bigint) to authenticated;

commit;

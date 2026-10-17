-- Explicit authorization guards supplement the existing identity trigger.
-- The trigger remains unchanged: this migration grants no new role privileges.
begin;

create or replace function public.set_club_member_role(target_user_id uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller_role text;
  target_hidden boolean;
  target_role text;
begin
  select role into caller_role from public.profiles where id = auth.uid();
  if caller_role is null or caller_role not in ('admin', 'superadmin') then raise exception 'No tienes permiso para cambiar rangos.'; end if;
  if new_role is null or new_role not in ('member', 'admin') then raise exception 'Rango no válido.'; end if;
  if target_user_id = auth.uid() then raise exception 'No puedes cambiar tu propio rango.'; end if;
  select is_hidden, role into target_hidden, target_role from public.profiles where id = target_user_id for update;
  if target_hidden is null then raise exception 'El usuario no existe.'; end if;
  if target_hidden or target_role = 'superadmin' then raise exception 'No se puede modificar una cuenta protegida.'; end if;
  if caller_role = 'admin' and target_role = 'admin' then raise exception 'Solo el superadministrador puede cambiar el rango de otro administrador.'; end if;
  perform set_config('app.authorized_role_change', 'true', true);
  update public.profiles set role = new_role, updated_at = now() where id = target_user_id;
end;
$$;
revoke all on function public.set_club_member_role(uuid, text) from public;
grant execute on function public.set_club_member_role(uuid, text) to authenticated;

create or replace function public.protect_profile_identity()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role'
  and not public.current_user_is_superadmin() and (
    new.id <> old.id
    or new.legacy_id <> old.legacy_id
    or new.username <> old.username
    or (new.role <> old.role and coalesce(current_setting('app.authorized_role_change', true), '') <> 'true')
    or new.is_hidden <> old.is_hidden
  ) then
    raise exception 'No puedes modificar la identidad o el rol de tu cuenta';
  end if;
  return new;
end;
$$;

commit;

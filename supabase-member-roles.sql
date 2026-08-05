-- Ejecutar una vez en Supabase > SQL Editor.
-- Permite a administradores cambiar de forma controlada el rango de otro miembro.
create or replace function public.set_club_member_role(target_user_id uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller_role text;
  target_hidden boolean;
begin
  select role into caller_role from public.profiles where id = auth.uid();
  if caller_role not in ('admin', 'superadmin') then
    raise exception 'No tienes permiso para cambiar rangos.';
  end if;
  if new_role not in ('member', 'admin') then
    raise exception 'Rango no válido.';
  end if;
  if target_user_id = auth.uid() then
    raise exception 'No puedes cambiar tu propio rango.';
  end if;
  select is_hidden into target_hidden from public.profiles where id = target_user_id;
  if target_hidden is null then
    raise exception 'El usuario no existe.';
  end if;
  if target_hidden then
    raise exception 'No se puede modificar una cuenta oculta.';
  end if;
  update public.profiles
  set role = new_role, updated_at = now()
  where id = target_user_id;
end;
$$;

revoke all on function public.set_club_member_role(uuid, text) from public;
grant execute on function public.set_club_member_role(uuid, text) to authenticated;

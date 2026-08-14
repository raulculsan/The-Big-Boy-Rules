-- Amplía el límite real del bucket para publicaciones, historias y adjuntos.
-- Ejecutar una vez en Supabase SQL Editor si el proyecto ya estaba creado.
update storage.buckets
set file_size_limit = 104857600,
    allowed_mime_types = array[
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'video/mp4', 'video/webm', 'video/quicktime',
      'audio/aac', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a',
      'audio/ogg', 'audio/webm', 'audio/wav',
      'application/pdf', 'text/plain', 'application/zip',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
where id = 'group-media';

-- Describe correctamente las notas de voz en la campana de notificaciones.
create or replace function public.notify_private_message()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.notifications (user_id, actor_id, type, target_type, target_id, excerpt)
  values (
    new.recipient_id,
    new.sender_id,
    'private_message',
    'private',
    new.id,
    case
      when char_length(trim(new.body)) > 0 then left(trim(new.body), 180)
      when new.attachment_type like 'audio/%' then 'Te ha enviado una nota de voz'
      when new.attachment_url is not null then 'Te ha enviado un archivo'
      else ''
    end
  );
  return new;
end;
$$;

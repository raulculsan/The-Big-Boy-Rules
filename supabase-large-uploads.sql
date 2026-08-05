-- Amplía el límite real del bucket para publicaciones, historias y adjuntos.
-- Ejecutar una vez en Supabase SQL Editor si el proyecto ya estaba creado.
update storage.buckets
set file_size_limit = 104857600
where id = 'group-media';

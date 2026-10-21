# Publicar cartas sin actualizar las apps

La versión que incorpora `card-catalog-sync.js` necesita instalarse una vez en iOS y Android. Después las cartas de las rarezas soportadas se añaden desde Supabase, sin recompilar ni pasar otra revisión de las tiendas. La web usa el mismo flujo.

## Flujo de publicación

1. Exportar frente y miniatura a PNG/JPEG/WebP. Usar nombres versionados e inmutables: `nombre-rareza-97-v1.png`. El reverso puede reutilizarse por rareza.
2. Subir los archivos al bucket público **card-artwork**. Solo el superadministrador con seguridad de cuenta satisfecha o el servicio de publicación puede escribir. Nunca colocar claves privadas en la app.
3. Registrar primero la carta en `achievement_card_catalog` con `active=false`, el `kind` del sorteo (`member`, `object` o `location`), `edition` y `collection_key`.
4. Añadir una fila en **published_card_designs**: `id` igual al catálogo de sorteos, `collection_key`, `collection_name`, `display_name`, `display_kind` (`Miembro`, `Personaje`, `Objeto` o `Ubicación`), `rarity`, `score` o NULL, `front_url`, `back_url`, `thumbnail_url`, `width`, `height`, `published=true`. Las URL son las de Storage → Get public URL. La fila queda legible públicamente; no introducir datos personales privados.
5. Abrir la colección para revisar ambas caras. Activar `achievement_card_catalog.active=true` cuando los archivos y metadatos estén publicados. No cambia automáticamente el porcentaje de una rareza.

Ejemplo de alta de diseño (sustituir valores):

```sql
insert into public.published_card_designs
(id,collection_key,collection_name,display_name,display_kind,rarity,score,front_url,back_url,thumbnail_url,width,height,published)
values
('nueva-carta','los-nuestros-01','Los nuestros · Colección 01','NOMBRE','Miembro','halloween',97,
'https://nfvggpgeypkkqceivkaq.supabase.co/storage/v1/object/public/card-artwork/nueva-carta-v1.png',
'https://nfvggpgeypkkqceivkaq.supabase.co/storage/v1/object/public/card-artwork/reverso-halloween-v1.png',
'https://nfvggpgeypkkqceivkaq.supabase.co/storage/v1/object/public/card-artwork/nueva-carta-mini-v1.jpg',948,1660,true);
```

## Actualizaciones, conexión y retirada

- La app consulta los diseños después de arrancar, al volver a primer plano y al cargar sobres. Conserva los últimos metadatos válidos y un catálogo incluido como respaldo. Las vistas abiertas se actualizan sin reiniciar la app.
- Las imágenes remotas que se visualizan se conservan en una caché de disco acotada de 32 MiB. Sin red se muestran las copias disponibles o una imagen de conexión pendiente. No se descargan todos los originales al arrancar.
- Cambiar una ilustración requiere otra URL versionada (`v2`), para evitar imágenes antiguas retenidas en CDN/dispositivo. Actualizar `updated_at=now()` junto al cambio de la fila.
- Para retirar una carta de sobres, poner `achievement_card_catalog.active=false`. Mantener su diseño publicado permite que quienes la poseen sigan viéndola.
- La publicación inicial contiene 78 diseños. Los originales antiguos siguen en el CDN de GitHub; Daniel y José Halloween y su reverso/miniaturas ya se sirven desde Supabase Storage. No hay dependencia de una actualización de GitHub para una carta nueva en Storage.
- Añadir mecánicas o efectos de una rareza nueva sigue requiriendo código y actualización. Las rarezas actuales son `common`, `retro`, `special`, `epic`, `legendary`, `full_art`, `vice_city`, `halloween`.

La migración `20261021162304_dynamic_card_design_catalog.sql` conserva la instantánea inicial para recuperación. La app descarga la tabla publicada, no esa instantánea.

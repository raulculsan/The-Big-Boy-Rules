# Publicar novedades de tienda sin actualizar las apps

Desde la versión que incorpora `shop-catalog-media.js`, las novedades visuales se distribuyen con el catálogo de Supabase. iOS, Android y web comparten el mismo renderer. Abrir la tienda vuelve a consultar el catálogo; la habitación restaura primero su caché y revalida al entrar. Los banners siguen la rotación de cinco diseños diarios y los comprados se conservan en el selector del perfil.

## Archivos públicos

Subir las exportaciones al bucket público **shop-media**. Solo administración (superadmin) y el servicio de publicación pueden escribir. Usar rutas nuevas con versión (`banners/nombre-v2/...`, `chota/nombre-v2.webp`) cuando cambie el archivo para aprovechar la caché sin mostrar una exportación antigua. No subir fotografías privadas a este bucket.

Los archivos de banners van bajo `banners/` y los de habitación bajo `chota/`. Se aceptan PNG, JPEG, WebP, GIF, AVIF y SVG como imágenes; los banners también admiten MP4 o WebM. Para vídeo se exige una imagen de portada. Formato de banner: **3:1**, por ejemplo 1440 × 480. Las decoraciones deben exportarse con transparencia y perspectiva adecuada a la habitación de 1024 × 1024.

## Catálogo

Crear el registro habitual en `profile_banner_catalog` o `chota_item_catalog` (id, nombre, descripción, art_key único, precio y active). Añadir el campo JSONB `presentation` con uno de estos formatos. Los nuevos art_key no necesitan añadirse al código. Las filas antiguas sin presentation conservan sus animaciones personalizadas locales.

Banner animado:

```json
{"type":"video","path":"banners/nuevo-v1/animation.mp4","poster_path":"banners/nuevo-v1/poster.webp","width":1440,"height":480}
```

Banner estático (o WebP/GIF animado con `animated:true` y `poster_path`):

```json
{"type":"image","path":"banners/nuevo-v1/art.webp","width":1440,"height":480}
```

Decoración con movimiento sutil:

```json
{"type":"decoration","path":"chota/lampara-v1.webp","width":400,"height":600,"placement":{"x":20,"y":45,"width":12,"rotation":-5,"z":2},"motion":"sway"}
```

Las coordenadas x/y y el ancho son porcentajes de la habitación. El ancho permite 1–100, x/y 0–100, rotación −180–180 y z 0–10 dentro de la capa de objetos. Los únicos movimientos permitidos son `none`, `sway`, `float` y `spin`; se pausan fuera de pantalla y respetan movimiento reducido. La posición se comprueba en la vista pequeña y en la ampliada antes de activar la venta.

Estilo de color:

```json
{"type":"room_style","colors":{"wall":"#554477","floor":"#886655","rug":"#665588"}}
```

Los tres colores deben tener seis dígitos hexadecimales. El estilo utiliza las máscaras de paredes, suelo y alfombra de la habitación; objetos, mascota y decoraciones de temporada se mantienen encima. Una compra aplica el estilo y permite alternarlo posteriormente sin otro cobro.

## Publicación y límites

1. Subir archivos con rutas versionadas.
2. Crear/actualizar el registro con `presentation`, precio y `active=false` mientras se revisa.
3. Comprobar sus exportaciones y metadatos; activar la fila para publicarla.
4. Abrir de nuevo la tienda. Un banner nuevo aparecerá cuando esté entre los cinco seleccionados del día; sus propietarios lo verán siempre en su selector.

El contrato distribuye contenido visual y los movimientos declarados. Nuevas mecánicas de juego, acciones interactivas o renderers diferentes requieren una versión de la aplicación. Nunca se descarga código JavaScript ni CSS proporcionado por el catálogo.

# PS Portal · objeto remoto publicado

Ilustración SVG original, PNG transparente de 720 × 300 y metadatos para el renderer remoto existente. Sin cambios en JS/CSS de producción, versiones, builds, permisos ni economía existente. Publicado el 31 de octubre de 2026 en el catálogo remoto: 35 monedas, activo para web, iOS y Android compatibles. Imagen pública verificada byte a byte (SHA256 `6f5508eb25edf764dee17efc1c1afea9abc8d1eeada800c35dfbad25dcfc0381`). No requiere una versión nueva de las aplicaciones.

`catalog.json`: `chota-ps-portal`, art_key `ps-portal`, precio inicial 35 monedas, decoración estática (`motion: none`). Pantalla oscura sin juego ni comportamiento. Mandos blancos, cruceta izquierda, botones derechos y sticks inferiores simétricos. Sombra de contacto incluida en el PNG.

Colocación: `x:25.8, y:59, width:10, rotation:0, z:2` (porcentajes de la habitación). Sobre el suelo de madera delante del sofá y antes de la alfombra, a la izquierda del área base del Chota (x:36%). El contenedor ocupa x:264.2–366.6, y:604.2–646.8 sobre la habitación de 1024 px. No pisa la radio (x:64.5%, y:46%), marcos, neón, cojín, balón, monopatín ni recorrido de la aspiradora. Ambas vistas usan los mismos valores.

## Reproducir y revisar

Desde la raíz del repositorio, con `sharp` disponible en el entorno:

```sh
node artwork/chota/ps-portal/build.mjs
node --test artwork/chota/ps-portal/validate.test.mjs
python3 -m http.server 8874 --bind 127.0.0.1
```

El exportador admite una ruta absoluta al módulo sharp ya instalado como argumento. No instala dependencias ni usa la red. En el entorno Codex utilizado:

```sh
node artwork/chota/ps-portal/build.mjs /Users/raulculsan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.mjs
```

Abrir `http://127.0.0.1:8874/artwork/chota/ps-portal/preview.html`. Pulsar Comprar y Restaurar compra desde caché. El fixture carga `ShopCatalogMedia`, `ChotaShop` y el CSS real; solo simula el RPC. Incluye la radio como referencia. Una CSP bloquea imágenes remotas y el fixture sustituye sus URLs por el PNG local. No se conecta a Supabase. El almacenamiento local usa un usuario y namespace exclusivos del fixture. No añadir este fixture al bundle.

`preview-purchased.png` y `preview-zoom.png` documentan revisión visual en navegador (340/760 px). Los tests locales comprueban el validador SQL existente, INSERT idempotente sin sobrescribir precio, compra en ambos contenedores reales, restauración offline, conservación de nodos estacionales, dos RPC esperados (carga/compra), cero RPC adicionales y cero RAF.

## Procedimiento reproducible de publicación

1. Subir exclusivamente `ps-portal-v1.png` a bucket público `shop-media`, objeto `chota/ps-portal-v1.png`, MIME `image/png`, sin sobrescritura (`upsert:false`). No subir el SVG: el cliente y el bucket exigen formato raster para estas imágenes.
2. Verificar el PNG en la URL pública del bucket antes del alta.
3. Ejecutar `publish.sql` como administrador autorizado. Solo contiene `INSERT ... ON CONFLICT (id) DO NOTHING`; activa el objeto al insertarlo. Si ya existe, preserva su precio y todos sus metadatos. No modifica wallets ni permisos.
4. Reabrir la tienda de los clientes compatibles para cargar el catálogo. No requiere APK, cambio de versión ni assets empaquetados.

El mecanismo documentado en `docs/shop/REMOTE_CATALOG.md` es Storage + registro `chota_item_catalog.presentation`. No se ha encontrado un script específico de upload de shop-media. El ejemplo existente de upload en `scripts/migrate-private-chat-files.mjs` usa Supabase JS `storage.from(bucket).upload(path, bytes, {contentType, upsert:false})`, pero migra chats privados y **no debe ejecutarse para esta publicación**. Para este objeto se puede emplear el mismo método del cliente Supabase administrativo ya autenticado o Storage del dashboard. La publicación final utilizó la CLI oficial autenticada (`storage cp --project-ref ... --experimental`) y el conector SQL de Supabase. Se comprobó la imagen pública y la presentación guardada. No se mostraron credenciales.

El coordinador también ha verificado la CLI oficial Supabase v2.121 instalada y el comando `storage cp` con destino `ss:///shop-media/chota/ps-portal-v1.png`, `--project-ref REF --experimental --content-type image/png`. La subida y revisión remotas quedan a cargo del coordinador; este paquete no inicia ninguna operación externa.

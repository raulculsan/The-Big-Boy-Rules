# PS Portal v2 · apoyo en el asiento naranja

Revisión publicada el 31 de octubre de 2026 en Supabase. Archivo público verificado byte a byte y presentación remota validada; precio 35, activación y orden conservados. La v1 publicada queda intacta como histórico: `ps-portal-v1.svg`, `ps-portal-v1.png`, `catalog-v1.json`, `publish.sql`, `README-v1.md` y sus capturas anteriores. No se ha modificado código de producción, builds, versiones ni permisos; solo la descripción y presentación remota de este objeto.

La v2 está tumbada sobre la parte izquierda del asiento naranja. Su pantalla 16:9 y ambos mandos se proyectan en un mismo plano oblicuo visto desde arriba; el borde inferior aporta grosor. Los blancos recogen luz cálida y la pantalla apagada refleja el ambiente sin emitir luz azul. La sombra de contacto está dibujada dentro del PNG y comparte el plano del asiento. Cruceta izquierda, botones derechos y sticks simétricos permanecen reconocibles.

## Colocación y evidencia

`catalog.json` conserva `id: chota-ps-portal`, `art_key: ps-portal`, precio de referencia inicial 35 monedas y `motion: none`. La ruta nueva es `chota/ps-portal-v2.png`, PNG transparente de 1020 × 495 px.

Placement común a normal/ampliado: `{x:82.5, y:60.3, width:7.2, rotation:0, z:2}`. Sobre la ilustración de 1024 px, el contenedor ocupa x 844.8–918.5, y 617.5–653.3; el dibujo útil, más pequeño, apoya a la izquierda del cojín y queda separado de la mesita/linterna y la punta del monopatín. Se comprobó con todos los objetos comprables y Chota presentes. No invade el recorrido de la aspiradora ni sustituye capas estacionales.

Capturas tomadas en Safari con `ShopCatalogMedia`, `ChotaShop` y su CSS real:

- `preview-v2-room.png`: habitación completa en ambas escalas, con Chota y todos los objetos.
- `preview-v2-normal.png`: vista real a 340 × 340 px.
- `preview-v2-zoom.png`: vista real a 760 × 760 px.
- `preview-v2-contact.png`: detalle del asiento a 2×, con monopatín, mesita y linterna.
- `composition-draft-v2.png`: primera composición de revisión sobre la ilustración original, sin props superpuestos.

El fixture `preview.html` usa datos y RPC simulados, usuario/namespace exclusivos y una CSP que bloquea conexión externa. Abrir «Tienda simulada», seleccionar **Objetos** y comprar PS Portal. Cerrar la tienda para revisar ambas habitaciones; «Ver detalle del asiento» abre el tercer contenedor del mismo renderer ampliado a 2×. «Restaurar compra desde caché» comprueba la persistencia. La pose de Chota procede de su sprite real en las coordenadas habituales. El movimiento reducido mantiene quietos los objetos para comparar el apoyo.

## Reproducir

Desde la raíz, con un módulo `sharp` ya instalado:

```sh
node artwork/chota/ps-portal/build.mjs
node --test artwork/chota/ps-portal/validate.test.mjs
python3 -m http.server 8874 --bind 127.0.0.1
```

Abrir `http://127.0.0.1:8874/artwork/chota/ps-portal/preview.html`.

El exportador admite una ruta absoluta a sharp como primer argumento, no instala dependencias ni usa la red. Ruta usada en este entorno:

```sh
node artwork/chota/ps-portal/build.mjs /Users/raulculsan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.mjs
```

Genera exclusivamente `ps-portal-v2.png` y `update-placement-v2.sql`; preserva la exportación y el INSERT históricos de v1.

Validación local: 3/3 pruebas. La presentación supera el validador SQL existente; el UPDATE preserva precio administrado (42), activación, orden, identidad, compras y saldo, y no reescribe ediciones posteriores al aplicar otra vez. El renderer compra en Objetos, muestra la misma colocación en ambas vistas, restaura offline sin más RPC/RAF y conserva nodos estacionales. Una compra ya cacheada en v1 se actualiza a v2 al revalidar sin otra compra. Exportación comprobada: alpha presente, no opaca.

SHA256 del PNG v2: `6325f7d5246ae3c158ba16ed9e88503950ca0eca1e2fc97d7701ebcb9bfb0051`.

## Procedimiento reproducible de publicación

1. Subir `ps-portal-v2.png` al objeto nuevo `shop-media/chota/ps-portal-v2.png`, MIME `image/png`, sin sobrescribir v1. El mecanismo existente es Storage más metadatos, documentado en `docs/shop/REMOTE_CATALOG.md`; el coordinador verificó Supabase CLI `storage cp` con `--project-ref REF --experimental --content-type image/png` y destino `ss:///shop-media/chota/ps-portal-v2.png`.
2. Verificar el archivo público antes del cambio de catálogo.
3. Ejecutar **solo** `update-placement-v2.sql`: cambia description/presentation si el ID coincide y la ruta actual sigue siendo `chota/ps-portal-v1.png`. No altera precio, active, art_key, ownership ni wallets. Si la ruta ya cambió, no actualiza ninguna fila.
4. Reabrir la tienda para revalidar el catálogo. Los propietarios conservan su compra; no requiere APK ni actualización del bundle.

No ejecutar `publish.sql` para esta revisión: es el INSERT histórico de v1. La publicación final utilizó la CLI oficial autenticada para el PNG y el conector SQL de Supabase para el UPDATE protegido. No se mostraron credenciales.

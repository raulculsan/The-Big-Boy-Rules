# Sobres de colección

`pack-template.html` es la fuente vectorial de los sobres. Usa el Chota de `icons/mascot/tigreton.png` y dos temas:

- `?variant=01`: Colección 01 · Los Nuestros, negro y oro → `icons/cards/sobre-coleccion-01-v3.png` (1024 × 1536).
- `?variant=02`: Colección 02 · Próximamente, plata y azul con el Chota en silueta → `icons/cards/sobre-coleccion-02-proximamente-v1.png` (reducido a 512 × 768).

La geometría es la que usa la animación de apertura (`pack-opening.js`, `.pack-tear-*` en `banner-shop.css`): el sobre ocupa x 128–894 y el precinto superior termina justo encima de la línea de rasgado (y 178). Si se cambia el `viewBox`, hay que ajustar `LEFT`, `RIGHT` y `TEAR_Y`.

Render:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --allow-file-access-from-files --hide-scrollbars --default-background-color=00000000 --force-device-scale-factor=1 --window-size=1024,1536 --screenshot=sobre.png "file://$PWD/artwork/packs/pack-template.html?variant=01"
```

Cuando salga la Colección 02 de verdad, crear su tema definitivo (título, ilustración, colores) en lugar de la variante «Próximamente» y quitar el bloque `.col-next` de `index.html`.

## Sobres temáticos

`themed-template.html?theme=<clave>` genera los seis sobres temáticos con la misma geometría (así la animación de rasgado los abre igual): `retro`, `vice_city`, `halloween`, `full_art`, `objects` y `locations`. Cada uno tiene paleta, escena de fondo, textos y dos cartas reales de su tema en abanico detrás del medallón. Se exportan a 768 × 1152 como `icons/cards/sobre-tema-<clave-con-guiones>-v1.png`:

```bash
for t in retro vice_city halloween full_art objects locations; do "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --allow-file-access-from-files --hide-scrollbars --default-background-color=00000000 --force-device-scale-factor=1 --window-size=1024,1536 --screenshot="$TMPDIR/$t.png" "file://$PWD/artwork/packs/themed-template.html?theme=$t"; sips -Z 1152 "$TMPDIR/$t.png" --out "icons/cards/sobre-tema-${t//_/-}-v1.png"; done
```

Las rutas van escritas literalmente en `pack-extras.js` (`THEME_ART`) para que la compilación web las empaquete. Si se cambia un diseño, subir la versión (`-v2`) y actualizar esas rutas.

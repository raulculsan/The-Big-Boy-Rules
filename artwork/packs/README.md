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

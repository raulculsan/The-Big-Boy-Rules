# Ropa del Chota: normas para prendas nuevas

Aprobado por el usuario el 2026-11-09, tras la v5 «a medida» (`artwork/chota/wardrobe-tailored-v5/`). Cualquier prenda nueva (camiseta, pantalón, zapatillas, abrigo, gorra, accesorio) o retoque de una existente debe cumplir esto antes de publicarse. Las instrucciones nuevas del usuario tienen prioridad.

## 1. Cómo se dibuja una prenda

- **Sobre las poses originales, nunca pegada encima.** La prenda se obtiene recoloreando o redibujando la tela en la topología de cada pose del sprite original: mangas, cintura, entrepierna, bajos y suelas quedan donde las dibujó el artista. No se aceptan piezas rasterizadas y deformadas por separado, porque acaban con zapatillas sueltas, tela estirada y bordes dentados. Esas fueron las versiones v4, `full/` y el piloto SVG, todas rechazadas.
- **67 poses completas en las 5 hojas**, con celdas de 256 px: `base` 6×4, `directional` 5×4, `contextual` 4×4, `room` 4×1 y `talk` 3×1. Ninguna celda vacía ni medio dibujada.
- **Una sola dueña por píxel.** Cada píxel opaco del sprite original pertenece a la anatomía o a una única prenda. La comprobación `sourceMismatch` de `assets.mjs` tiene que dar 0.
- **Las patas son anatomía.** La piel cálida que haya dentro de los círculos de mano (`hands` en `artwork/chota/wardrobe-rig-v1/poses.json`, radio + 6 px) nunca forma parte de una prenda, aunque toque la camiseta o el pantalón. Si no se respeta, la pata sale del color de la prenda; pasó en 10 poses de la v5.
- **Logos y estampados van pegados a su tela.** Se anclan a la parte de la prenda que los lleva en cada pose (el parche Carhartt, a la cadera visible del pantalón bajo la camiseta; el logo Supreme, al pecho), nunca a una posición fija del torso. Si la pierna o el brazo se mueven, el logo se mueve con ellos y no puede acabar en la entrepierna, en la otra pierna ni fuera de la tela.
- **Logos al girarse.** La sede y el dilema dibujan al Chota en espejo (`scaleX(-1)`) cuando va hacia la izquierda. Toda prenda con un logo o texto impreso necesita su variante `-flip` (generada en `assets.mjs` con `flipMark`), con el logo en el mismo lado y legible tras el espejo. Se añade su clave a `FLIPPED` en `chota-wardrobe.js`. Sin esto, el logo salta a la otra pierna o se lee al revés.
- **Orden de capas:** zonas sin ropa → anatomía → pantalón → zapatillas → camiseta → abrigo → primer plano (cabeza y manos). La cabeza y las patas siempre quedan por encima de la ropa.
- **Los abrigos tienen que seguir al brazo.** Con los brazos en alto (base 2–4, 14 y 15) la manga sube con el brazo; no puede quedarse colgando. Desde la v4 de los plumíferos TNF (2026-11-12, `artwork/chota/coat-fit-v4/build.mjs`) el abrigo tapa toda la camiseta y cada brazo hasta el puño en las 67 poses, y la manga cubre el antebrazo levantado: con abrigo, el compositor usa `foreground-coat-*` (solo cabeza y patas) en lugar de `foreground-*`. Un abrigo nuevo debe cumplir lo mismo.

## 2. Quitar prendas (huecos libres)

- **Quitar una prenda nunca deja huecos.** Las capas `bare-*` deben cubrir con piel todo lo que tapaba la prenda: sin aros oscuros alrededor de las patas, sin trozos del pecho vacíos y sin contornos del cuerpo antiguo. El relleno de `fillBareHoles` (`partition.mjs`) debe seguir activo.
- **Revisar las combinaciones:** todo puesto, sin cada prenda por separado, sin nada y abrigo encima del conjunto.

## 3. Cómo se muestra en la app

- **Un único compositor.** Sede, visor, dilema, minijuegos, probador, compra, armario y avatares pequeños leen el mismo atlas compuesto (`chota-appearance.js` + `chota-compositor-worker.js`). No se añaden capas de prenda sueltas en una pantalla concreta.
- **Tamaño del Chota en píxeles enteros.** Si un sprite con hojas al 600 % ocupa una fracción de píxel, el navegador mezcla bordes de la pose de al lado y el dibujo baila un píxel. Cualquier escenario nuevo redondea el tamaño del Chota (ver `fitActor` en `chota-decisions.js`).
- **Pose atómica.** El cuerpo y la ropa cambian siempre juntos de hoja y de celda. Interrumpir el habla, un gesto o la caminata no puede dejar la ropa de otra pose.
- **Versionar el arte.** Los atlas `tailored-v5` mantienen su nombre. Si se redibujan, hay que subir `ART_REVISION` en `chota-appearance.js` y la caché (`CACHE_NAME` y los `?v=`), para que ningún móvil mezcle capas viejas y nuevas.

## 3b. Movimiento de la tela

- La camiseta lleva inercia (`chota-cloth.js`); con abrigo puesto no hay inercia, porque la copia inclinada del plumífero se separaba del cuerpo pose a pose (decisión del usuario, 2026-11-12): se redibujan sobre el sprite y se inclinan desde el cuello con un muelle amortiguado, de modo que el bajo se queda atrás al arrancar, se pasa al frenar y bota al saltar. Cabeza, brazos y patas se redibujan encima.
- En reposo la tela es idéntica al sprite y las capas se ocultan. Con movimiento reducido no actúa.
- Una prenda nueva de torso o de abrigo funciona sin más si sigue estas normas. Los pantalones y las zapatillas no llevan inercia.
- El efecto es de uno a tres píxeles. No subir la ganancia: en pixel art más movimiento se ve falso.

## 4. Inventario y base de datos

- Hay que conservar los IDs, precios, propiedad y huecos de las prendas existentes. Las originales (camiseta Stüssy blanca, vaqueros y Jordan Chicago) son gratis y se pueden quitar.
- Las prendas nuevas se dan de alta con su `slot`, `rig_version` y `garment` válidos en `valid_chota_clothing_manifest`. Un cambio de base de datos en producción necesita el visto bueno explícito del usuario.

## 5. Revisión antes de publicar

Que las pruebas automáticas de cobertura o de alfa pasen no basta; el usuario rechazó la v4 aunque las pasaba. Antes de publicar hay que:

1. Regenerar con `node artwork/chota/wardrobe-tailored-v5/source-topology/assets.mjs` y comprobar `sourceMismatch: 0`.
2. Mirar las 67 poses ampliadas con muestreo nearest-neighbour para cada prenda nueva: puesta, sin ella y con abrigo. Fijarse en cuello, mangas, puños, cintura, entrepierna, bajos sobre las zapatillas, **las patas** y que **cada logo siga a su tela** pose a pose (andando, saltando, sentado, dormido y de espaldas).
3. Comprobar que ninguna pose deja píxeles de piel cálida dentro de las manos con etiqueta de prenda (debe dar 0).
4. Probar en `artwork/chota/modular-body-v1/integration.html` a 390×844: sede, dilema (andar, hablar, tocar para saltar y cambiar de ropa con el diálogo abierto), probador, armario y un minijuego, sin errores de consola.
5. Ejecutar las pruebas `scripts/chota-*.test.mjs`. La revisión de encaje `scripts/chota-garment-fit.test.mjs` debe pasar entera: un solo dueño por píxel, misma silueta para todas las camisetas y para todos los pantalones, ningún hueco al quitar prendas, nada de pelo pintado como tela y logos visibles en todas las poses. Si se añade una prenda con logo, se añade su comprobación ahí.
6. Publicar en web, Android e iPhone. Si cambia el código de la app, el Android se marca obligatorio. Comprobarlo en un móvil real no puede darse por hecho si no se ha hecho.

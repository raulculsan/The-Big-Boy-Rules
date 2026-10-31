# Apertura de sobres · v3

Sustituye a la v2. Módulo propio en `pack-opening.js`, estilos en `banner-shop.css` e integración en `startReveal` (`banner-shop.js`).

1. Entrada (420 ms): el sobre aparece y queda flotando, con un reflejo que sigue al dedo o al cursor.
2. Rasgado: el usuario desliza en cualquier dirección y el borde se abre siguiendo el dedo. Se completa al pasar del 55 % del recorrido o con un gesto rápido; si no, la tira vuelve a su sitio. Tocar el sobre, o pulsar Intro, lo rasga solo.
3. Salida (1320 ms): la tira sale despedida, el mazo sube recto desde dentro, el sobre cae, las cartas se abren en abanico y se recogen en la primera carta lista para girar.

La luz toma el color de la mejor carta del sobre (`data-edition` en `.pack-tear`).

Las cartas ya están guardadas en el servidor cuando empieza la animación: cerrar o saltar no cambia el premio. Con movimiento reducido no se reproduce nada. Solo se animan `transform`, `opacity` y `clip-path`.

`preview.html` permite probarla con cada rareza; hay que servir el repositorio desde su raíz.

# Respiración dormido

La postura tumbada usa el fotograma 22 de `chota-poses.webp`. Dos capas CSS reutilizan ese mismo fotograma: una recorta la camiseta y sube el pecho al inspirar; la otra mantiene la mejilla, las patas apoyadas y el borde del pantalón en su lugar.

El ciclo dura 4,4 segundos y eleva el hombro unos cinco píxeles del dibujo original. No se escala el personaje completo. `refresh()` conserva el ciclo en curso; los cambios de visibilidad, pausa, movimiento reducido, despertar y destrucción cancelan sus animaciones.

Validación: `node artwork/chota/sleep-breath-v1/validate-sleep-breath.mjs`.
Vista de comparación: servir la raíz del proyecto y abrir `artwork/chota/sleep-breath-v1/preview.html`.

La cabeza y la cola usan recortes independientes del mismo fotograma. Una máscara SVG elimina su silueta del cuerpo fijo para evitar duplicados al girar. Se alternan pequeños movimientos con pausas aleatorias de 7 a 15,5 segundos; la respiración continúa sin reiniciarse. Todos comparten la cancelación al despertar, ocultar la pantalla o activar movimiento reducido. `life-preview.html` muestra las posiciones extremas para revisar las uniones.

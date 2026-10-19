# Apertura de sobres · v2

Secuencia integrada en `banner-shop.js` (`startReveal`) y `banner-shop.css`.

- 0–300 ms: entrada y tensión muy breve del envoltorio.
- 250–590 ms: corte luminoso y sello que sale con giro.
- 460–940 ms: apertura lateral, partículas y abanico de los seis dorsos.
- 940–1240 ms: las cartas se recogen en la primera carta lista para girar.

El recurso `seal-flare.kra` se trabajó en Krita de escritorio: base vectorial y capa de reflejos pintados. Su composición transparente está exportada en `icons/cards/pack-seal-flare-v2.png` (768 × 256). El SVG conserva la base editable.

`preview.html` presenta cuatro momentos de la coreografía con las reglas CSS reales. La vista respeta el escenario y las dimensiones de las cartas. La apertura omite todos los efectos con movimiento reducido; los recursos se eliminan al terminar o cerrar.

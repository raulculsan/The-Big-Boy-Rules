# Fondos personales de chats · v241

Diseño editable en Figma de escritorio, página **Chats · Fondos y contraste**:
[Galería y nueve paletas](https://www.figma.com/design/1gKFohvPW6sczaUjicOp2D?node-id=29-1318).
Fuente vectorial editable: `figma-fondos-v241.svg`. Tipografía: Inter.

## Catálogo

| Sección | Fondos |
| --- | --- |
| Esenciales | Big Boy, Carbono, Papel |
| Naturaleza | Océano, Bosque, Arena |
| Especiales | Aurora, Vice City, Órbita |

`chat-theme-catalog.json` define el fondo SVG, superficies entrante/saliente,
texto, metadatos y acento de cada opción. Los SVG de `icons/chat-backgrounds/`
cubren todo el área de mensajes sin bandas laterales y se distribuyen en la
compilación web, iOS y caché sin conexión.

## Comportamiento

- Icono de paleta en la cabecera de conversaciones privadas y de grupos.
- Elegir un fondo modifica la muestra del selector; **Aplicar fondo** confirma.
- **Restablecer** elige Big Boy y requiere Aplicar; cerrar cancela el borrador.
- Preferencia local por usuario y conversación (`bb-chat-themes-v1`), incluida
  restauración al reabrir la app. No se sincroniza con otros dispositivos.
- El fondo afecta solo al área de mensajes. Cabecera y compositor conservan
  el diseño oscuro de la aplicación.
- Los colores se comprueban contra ambas superficies de bocadillo con mínimo
  4,5:1 para texto, metadatos y autor; se ajustan si un futuro tema no cumple.
- Las fotos conservan superficies transparentes, también en su pie y texto.
- Big Boy conserva el aspecto anterior de la conversación.

## Validación

11 pruebas específicas de fondos pasan, incluida la regla móvil que permite mostrar los nueve fondos y el catálogo sin conexión. Las 16 pruebas de gestos se validaron en v240; los gestos no se modificaron en v241.
`ios:sync` completado. Revisión visual a 390 × 844 del selector, del tema claro
Papel y del oscuro Océano, con la imagen sin fondo. Pruebas y vista de diseño:
`scripts/chat-themes.test.mjs` y `chat-themes-preview.html`.

## Diseños temáticos v241

Big Boy: cartas y monograma dorado. Carbono: trama tejida y ruedas técnicas.
Papel: sobres, lápices y hojas rayadas. Océano: tortuga, peces y arrecife.
Bosque: montañas, pinos y luciérnagas. Arena: dunas, sol y cactus.
Aurora: luces del norte y montañas nevadas. Vice City: hoteles Art Déco,
palmeras, neones y paseo costero. Órbita: planetas, cohete y astronauta.

Se corrigió la especificidad de la regla móvil de `.messages` que tapaba
el fondo elegido. El fondo Big Boy también se aplica, preservando sus bocadillos.

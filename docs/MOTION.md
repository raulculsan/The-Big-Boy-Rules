# Movimiento de la interfaz

La interfaz comparte `ui-motion.js` y `ui-motion.css` en web, iOS y Android.
La dirección se apoya en [Motion de Apple](https://developer.apple.com/design/human-interface-guidelines/motion)
y [Designing Fluid Interfaces](https://developer.apple.com/videos/play/wwdc2018/803/): respuesta inmediata,
continuidad con el gesto, salidas simétricas y asentamiento sin rebote ornamental.

| Uso | Tiempo de referencia | Comportamiento |
| --- | ---: | --- |
| Presión | 90 ms | Compresión pequeña; el gesto activa la función inmediatamente |
| Estado / color | 160 ms | Feedback corto |
| Menú / control | 260 ms | Asentamiento amortiguado |
| Diálogo | 300 ms entrada, 160 ms salida | Desde su posición, sin saltos de escala |
| Navegación | 180 ms | Una sola transición de opacidad; no transforma la superficie de scroll |

`ClubMotion.run` mantiene un propietario por elemento/canal. Una nueva animación toma el estado
que se está mostrando antes de cancelar la anterior. `closeDialog` comparte una sola promesa de
cierre y completa el estado también si se cambia la preferencia de movimiento o se oculta la app.
El observador de diálogos solo mira cambios del atributo `open`; no procesa inserciones de mensajes.

La vuelta con gesto sigue al dedo con una escritura por frame. Al soltar, usa distancia y velocidad
reciente, admite un flick y cancela al tirar deliberadamente hacia atrás. El movimiento del chat
conserva su geometría y sus pruebas existentes. El menú del mensaje y su ampliación mueven transform
y opacidad; la ampliación no interpola `left` ni `top`.

Los rellenos de encuesta usan `scaleX` en lugar de recalcular anchura. La navegación cancela la antigua
entrada de cada hijo por separado. La barra de pestañas usa una curva amortiguada común sin overshoot.
Las animaciones narrativas de cartas, banners, mascota y juegos conservan su dirección propia.

Se respeta la preferencia del dispositivo y la opción de la cuenta. Los diálogos y cambios de pantalla
pueden usar un fundido de 80 ms; los cierres se completan inmediatamente con movimiento reducido.
No se animan desenfoques ni se añaden bucles permanentes al sistema de interfaz.

Validación: `scripts/ui-motion.test.mjs` cubre interrupción/reapertura, cierre repetido, cambio de
preferencia, cancelación y flick de vuelta. Se mantienen las pruebas existentes de navegación y chat.

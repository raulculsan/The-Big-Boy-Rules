# Reflejos por rareza · v153

## Ajuste v154: sin reflejos en reposo

El reflejo está oculto al abrir, tocar sin arrastrar, cancelar y cerrar. Aparece progresivamente tras 3 px de desplazamiento y alcanza su intensidad completa a los 27 px, también al inclinar verticalmente. Al soltar se desvanece en 160 ms desde su última posición, sin saltar al centro. Una carga tardía de Lottie no revela la carta en reposo. Se conservan los JSON por rareza y las copias de Creator: la visibilidad depende de la interacción de la app, no de reproducir una animación automáticamente. 37 pruebas superadas y archivos sincronizados con iOS estable.

5 de septiembre de 2026. Integración en la app estable y copia editable en Lottie Creator.

- Común: conserva el reflejo original (`card-touch.json`).
- Especial: cuatro bandas nacaradas azul hielo, violeta y perla (`card-touch-special.json`).
- Legendaria: doble reflejo cruzado de oro/champán con acento petróleo y tres facetas pequeñas (`card-touch-legendary.json`). Sin explosiones ni partículas en bucle.

La elección se hace mediante `card.edition`, no por puntuación ni por ser miembro o ubicación. Las ediciones desconocidas usan el reflejo común. Se mantiene la misma variante al girar al reverso.

Composiciones vectoriales transparentes 400 × 700, 60 fps y fotogramas 0–60. El dedo controla el fotograma; las bandas de las variantes nuevas tienen interpolación lineal. Al soltar vuelven al fotograma 30. Sin reproducción automática ni bucle. Solo se carga el reproductor al abrir una carta; se destruye al cerrar/cambiar, se pausa liberándolo en segundo plano y respeta reducir movimiento.

## Fuentes y Creator

Generación reproducible: `node scripts/build-collection-motion.mjs --foil-only`. No modifica arte, saldos, asignaciones ni animación de apertura.

Importación autorizada explícitamente por el usuario: solo formas, colores y movimiento, sin fotografías ni datos de miembros.

- Escena especial: `CYH6yMSHtS`, «Bigboys · Especial · Nácar»; capa final `sq2fllErDF`. Se sustituyó la primera importación temporal para corregir el recorrido lineal; su copia fuente sigue disponible localmente.
- Escena legendaria: `2nMG63ZjY0`, «Bigboys · Legendaria · Oro facetado»; capa `Kwdzr5ndCb`.
- Ambas importaciones confirmadas por MCP. Creator se desconectó al intentar ajustar la previsualización final de la legendaria; su fondo oscuro y fotograma de previsualización no quedaron confirmados. Esto no afecta al archivo transparente de la app.
- Las bandas cruzan deliberadamente los bordes del lienzo, que las recorta: el aviso de clipping de Creator en este caso es intencionado.

## Comprobación

35 pruebas de catálogo, interacción y sobres superadas. Incluyen selección por rareza, caché, destrucción de reproductores, reducir movimiento, keyframes y copia nativa/offline.

Revisión visual en navegador integrado a 390 × 844: especial y legendaria claramente diferentes, texto legible; comprobado giro mediante arrastre en especial. El ejecutor visual automático de Chrome no pudo arrancar en esta sesión, por lo que se usó el navegador integrado como alternativa. Pendiente tacto/física real en iPhone tras ▶ en Xcode.

Versión de caché 153. Arte original, cartas comunes y apertura de sobres conservados.

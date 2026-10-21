# Movimiento de la colección

## Versión 201 — revisión directa en Figma desktop

Estudio editable en [Figma](https://www.figma.com/design/1gKFohvPW6sczaUjicOp2D). La revisión de geometría y los tiempos de ejecución se documentan en `figma-desktop-revision-v201.json`. `figma-motion-v1.json` conserva la exportación original de la versión 200 y no refleja estas modificaciones manuales posteriores.

En Figma desktop se desactivó **Clip content** en las tres escenas para ver el recorrido completo. La cara delantera mantiene Y = 282 durante el giro; la carta del sobre empieza en Y = 326 en los fotogramas de 0 y 360 ms. Las páginas salen de X = 180 a 168 y entran de X = 192 a 180, con escala al 100 % durante todo el movimiento.

- Sobre: 960 ms, recorte SVG del contorno real del paquete y precinto; carta de espaldas que emerge con desplazamiento corto. Solo comienza tras confirmar la apertura del servidor.
- Carta: giro centrado de 560 ms, salida de 240 ms y llegada de 320 ms. Conserva las ilustraciones y el gesto de descubrir o avanzar deslizando.
- Álbum: transición de 360 ms con desplazamiento de 12 px y sombra suave. La altura se mantiene durante el paso; el contenido y la copia temporal quedan dentro del viewport de la hoja. Al cerrar una carta se conserva la página del álbum.
- Los tiempos de la app son los tramos de interacción adaptados de la revisión desktop; el bucle de presentación de Figma sirve para observar los estados.
- Reducir movimiento conserva controles y resultados sin desplazamientos, giro ni destellos.

## Historial — versión 200

El estudio original usaba una apertura de 1200 ms, giro de 640 ms y un pliegue de álbum de 560 ms con compresión horizontal. Se sustituyó en la versión 201 por movimiento centrado y contenido para corregir recortes y deformaciones.

## Historial — versión 150

- Cartas: arrastre directo con inclinación limitada a 14°/20°, reflejo Lottie vinculado a la posición horizontal, giro al soltar un gesto horizontal amplio. El botón de reverso y las flechas del teclado siguen funcionando.
- Sobre: apertura Lottie de 2,42 segundos usando el sobre y reverso originales. Botón «Probar apertura», etiquetado siempre como vista previa: no modifica saldo, no concede cartas ni hace peticiones a Supabase.
- Un reproductor cargado bajo demanda y compartido con trofeos. Los efectos de cartas se buscan al abrir, no por cada miniatura. Cancelación al cerrar, navegar, cambiar preferencias o perder visibilidad. Reducir movimiento conserva gestos funcionales, sin inclinación ni reproducción.
- Generador: `scripts/build-collection-motion.mjs`. Archivos ligeros de ejecución en `icons/cards/card-touch.json` y `icons/cards/pack-opening.json`.
- `pack-opening-creator.json` es una copia portable con imágenes integradas, excluida del bundle nativo. El usuario autorizó expresamente compartir únicamente sobre y reverso común con Lottie Creator; el conector rechaza la URL HTTP local. La escena de reflejo sí se importó. La primera prueba de apertura con referencias locales se ocultó; no es la versión portable definitiva.
- Verificación: pruebas de gestos, cancelación, carga tardía, errores, repetición, accesibilidad, saldo sin cambios y paridad del bundle; comprobación visual en navegador a 390 × 844. No equivale a prueba en iPhone físico.

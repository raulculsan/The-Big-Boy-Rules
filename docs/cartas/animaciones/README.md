# Movimiento de la colección

## Versión 200 — sobres, revelación y álbum

Estudio editable en [Figma](https://www.figma.com/design/1gKFohvPW6sczaUjicOp2D). Los fotogramas y curvas exportados están en `figma-motion-v1.json`.

- Sobre: sello que se desprende, envoltorio que cae y carta que emerge de espaldas; 1200 ms. Se reproduce después de confirmar la apertura del servidor.
- Carta: giro de 640 ms, salida al deslizar de 280 ms y entrada de la siguiente de 420 ms. Mantener las ilustraciones del catálogo y los gestos existentes.
- Álbum: pliegue direccional de 560 ms y adaptación de altura de 420 ms. Al cerrar una carta se conserva la página del álbum.
- Figma representa el giro mediante compresión horizontal en 2D; la app aplica la misma secuencia como giro 3D. El bucle de 2 segundos de los estudios incluye una pausa para observar el resultado; las interacciones reales reproducen el tramo activo una vez.
- Con movimiento reducido, conservar el resultado y los controles sin los desplazamientos, giros ni destellos.

## Historial — versión 150

- Cartas: arrastre directo con inclinación limitada a 14°/20°, reflejo Lottie vinculado a la posición horizontal, giro al soltar un gesto horizontal amplio. El botón de reverso y las flechas del teclado siguen funcionando.
- Sobre: apertura Lottie de 2,42 segundos usando el sobre y reverso originales. Botón «Probar apertura», etiquetado siempre como vista previa: no modifica saldo, no concede cartas ni hace peticiones a Supabase.
- Un reproductor cargado bajo demanda y compartido con trofeos. Los efectos de cartas se buscan al abrir, no por cada miniatura. Cancelación al cerrar, navegar, cambiar preferencias o perder visibilidad. Reducir movimiento conserva gestos funcionales, sin inclinación ni reproducción.
- Generador: `scripts/build-collection-motion.mjs`. Archivos ligeros de ejecución en `icons/cards/card-touch.json` y `icons/cards/pack-opening.json`.
- `pack-opening-creator.json` es una copia portable con imágenes integradas, excluida del bundle nativo. El usuario autorizó expresamente compartir únicamente sobre y reverso común con Lottie Creator; el conector rechaza la URL HTTP local. La escena de reflejo sí se importó. La primera prueba de apertura con referencias locales se ocultó; no es la versión portable definitiva.
- Verificación: pruebas de gestos, cancelación, carga tardía, errores, repetición, accesibilidad, saldo sin cambios y paridad del bundle; comprobación visual en navegador a 390 × 844. No equivale a prueba en iPhone físico.

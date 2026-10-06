# Movimiento de la colección — versión 150

- Cartas: arrastre directo con inclinación limitada a 14°/20°, reflejo Lottie vinculado a la posición horizontal, giro al soltar un gesto horizontal amplio. El botón de reverso y las flechas del teclado siguen funcionando.
- Sobre: apertura Lottie de 2,42 segundos usando el sobre y reverso originales. Botón «Probar apertura», etiquetado siempre como vista previa: no modifica saldo, no concede cartas ni hace peticiones a Supabase.
- Un reproductor cargado bajo demanda y compartido con trofeos. Los efectos de cartas se buscan al abrir, no por cada miniatura. Cancelación al cerrar, navegar, cambiar preferencias o perder visibilidad. Reducir movimiento conserva gestos funcionales, sin inclinación ni reproducción.
- Generador: `scripts/build-collection-motion.mjs`. Archivos ligeros de ejecución en `icons/cards/card-touch.json` y `icons/cards/pack-opening.json`.
- `pack-opening-creator.json` es una copia portable con imágenes integradas, excluida del bundle nativo. El usuario autorizó expresamente compartir únicamente sobre y reverso común con Lottie Creator; el conector rechaza la URL HTTP local. La escena de reflejo sí se importó. La primera prueba de apertura con referencias locales se ocultó; no es la versión portable definitiva.
- Verificación: pruebas de gestos, cancelación, carga tardía, errores, repetición, accesibilidad, saldo sin cambios y paridad del bundle; comprobación visual en navegador a 390 × 844. No equivale a prueba en iPhone físico.

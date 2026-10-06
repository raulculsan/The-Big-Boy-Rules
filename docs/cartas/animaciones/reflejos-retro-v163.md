# Reflejo Retro — versión 163

Lottie vectorial de cobre satinado, latón antiguo, carmesí y pátina ámbar. Tres grabados cortos en los bordes se iluminan en posiciones diferentes del gesto; el retrato queda visible.

- Recurso: `icons/cards/card-touch-retro.json`, 400 × 700, 61 fotogramas, sin imágenes ni filtros.
- Selección: edición `Retro` en `CollectionMotion.attachCard`, independiente de puntos y categoría.
- Movimiento: fotograma vinculado al arrastre horizontal, intensidad gradual desde el reposo y desvanecimiento al soltar. Utiliza el mismo gesto de inclinación y giro de las otras cartas.
- Accesibilidad: reducir movimiento omite la animación y mantiene giro, botón y teclado. Cerrar o cambiar de carta destruye el reproductor.
- Generación reproducible: `node scripts/build-collection-motion.mjs --foil-only`.
- Copia editable en Lottie Creator: `card-touch-retro-creator.json`, idéntica al recurso de ejecución y sin fotografías personales.
- Carta incorporada: Juan Manuel Perez Saldaña, Retro, 90 PTS, con anverso y reverso 948 × 1659. Recursos incluidos en la caché v163.

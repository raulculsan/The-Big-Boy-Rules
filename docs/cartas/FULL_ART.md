# Configuración aprobada para las cartas Full Art

Reglas permanentes del proyecto, aprobadas por el usuario el 9 de octubre de 2026. Aplicarlas a las próximas Full Art salvo que el usuario pida un cambio.

## Referencia visual

Referencia principal: [José Enrique Fernández Cruz, Full Art, 93 PTS](miembros/jose-enrique-fernandez-cruz-full-art-93-v3.png).

- Estilo de dibujo anime ilustrado: líneas definidas, sombras dibujadas y fondos pintados. Conservar los rasgos reconocibles, ropa y elementos identificativos de la foto de referencia.
- Composición Full Art: una escena continua ocupa toda la carta, también detrás del nombre y del pie. Integrar al sujeto y los efectos en esa escena.
- Formato vertical 4:7, referencia de producción 948 × 1659 px, carta frontal completa y esquinas visibles. Mantener tamaño y composición consistentes con la colección.
- Marco fino holográfico plateado con reflejos cian, azul, violeta y rosa. Tipografía alta, condensada y plateada, siguiendo la referencia.
- Para miembros: puntuación indicada por el usuario arriba a la izquierda con PTS; arriba a la derecha MIEMBRO / FULL ART. Nombre abajo directamente sobre el arte, repartido en líneas equilibradas. Pie con monograma BB · LOS NUESTROS.
- Ubicaciones y objetos usan su categoría arriba a la derecha y no llevan puntuación.
- Libertad creativa para entorno, pose, iluminación y efectos, conservando la identidad del sujeto. La escena de montaña y aurora pertenece a José Enrique; no es obligatoria en futuras cartas.

## Rareza y economía

- Etiqueta visible: `Full Art`; clave del servidor: `full_art`.
- Probabilidad base por extracción: **1 %**. Distribución actual: común 68,5 %, retro 12 %, especial 10 %, épica 6 %, legendaria 2 %, Full Art 1 %, Vice City 0,5 %; suma 100 %.
- Cada sobre nuevo contiene seis cartas distintas: **3 miembros, 2 objetos y 1 ubicación**. Para cada carta se sortea la rareza entre las disponibles de su categoría, renormalizando los pesos cuando una rareza no tiene cartas disponibles o ya salió su última carta de esa categoría. El 1 % es un peso base, no una garantía por sobre. Si falta catálogo para cumplir alguna categoría, la apertura falla sin consumir el sobre. Los sobres ya abiertos conservan sus premios.
- Descartar cada copia repetida Full Art da **8 monedas**, conservando una copia.
- Álbum: sección propia Full Art con 20 huecos iniciales (10 miembros, 5 ubicaciones, 5 objetos), ampliable si el catálogo los supera.
- Dar de alta cada nueva carta con ID propio en el catálogo del cliente y en `achievement_card_catalog`; no reemplazar otras ediciones de la misma persona salvo petición expresa.

## Reverso y animación

- Reutilizar el [reverso Full Art unificado](reverso-full-art-unificado-v1.png), distribuido en `icons/cards/reverso-full-art-unificado-v1.png`.
- Aplicar `CollectionMotion.attachFullArtFoil` a todas las Full Art en el visor y al revelar el anverso de los sobres.
- Efecto aprobado: iridiscencia cian/violeta/rosa/dorado, barrido de luz y 16 destellos; la iluminación sigue el movimiento y el visor conserva la inclinación con profundidad.
- Animar el reflejo superpuesto; evitar desplazamientos laterales automáticos de la carta. Mantener tap para girar y deslizamiento intactos; las capas de efectos no capturan pulsaciones.
- Pausar de espaldas y en segundo plano, limpiar al cerrar/cambiar carta y respetar reducir movimiento.
- Implementación actual: `collection-motion.js`, `packs.css`, `banner-shop.js`. Economía: `supabase-banner-shop.sql`; migración inicial: `supabase-full-art.sql`.

## Publicación

Guardar originales y prompts en `docs/cartas`, copiar los recursos finales a `icons/cards`, registrar metadatos y rareza, actualizar el caché y sincronizar con Xcode. El usuario realiza Run en su iPhone.

## Fondos propios

Cada carta nueva debe tener un entorno y una composición de fondo distintos de las cartas anteriores. Mantener el marco y la jerarquía tipográfica unificados, y variar el lugar, la arquitectura, la perspectiva, la iluminación y los elementos narrativos. Esta preferencia también se aplica al resto de rarezas.

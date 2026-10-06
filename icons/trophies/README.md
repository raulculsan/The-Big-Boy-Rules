# Big Boys · Colección de trofeos

Arte vectorial original: cuatro esculturas y cuatro animaciones Lottie de 512 × 512, 60 fps, 181 fotogramas. Sin imágenes rasterizadas, fuentes ni recursos remotos.

| Rango | Diseño y movimiento | Escena en Lottie Creator |
| --- | --- | --- |
| Bronce · Forjado | Copa cálida, caída corta con asentamiento y destellos | `bmzJXahdZu` |
| Plata · Órbita | Copa estilizada, giro de entrada y órbita elíptica | `h0u21qFvHb` |
| Oro · Coronación | Copa coronada, ascenso y expansión de rayos | `klG1QQeBN2` |
| Platino · Prisma | Cristal facetado, despliegue con giro y halo orbital | `p8hoxuVJZk` |

`scripts/build-trophies.mjs` conserva la geometría y las curvas de movimiento. Genera los SVG estáticos y los JSON de producción. Con `--recipe` también entrega las capas SVG y los mismos fotogramas utilizados para crear las escenas editables en Lottie Creator; los JSON locales se generan de esa receta, no son una exportación del editor.

Las tarjetas solo muestran SVG. `trophy-motion.js` carga el reproductor SVG ligero de lottie-web al abrir un logro y mantiene una sola instancia. Al cerrar la destruye; al pasar a segundo plano la pausa. Con reducción de movimiento no carga ni reproduce automáticamente, pero permite iniciarla expresamente. Si falla la carga, conserva el SVG y permite reintentar. Una actualización de descripción o porcentaje conserva el nodo de la animación para no reiniciarla.

Para modificar la colección: editar la receta, ejecutar `npm run trophies:build`, actualizar las escenas si procede, ejecutar las pruebas, incrementar la versión de recursos y preparar el paquete iOS. El reproductor lleva su licencia MIT en `vendor/lottie-LICENSE.md`.

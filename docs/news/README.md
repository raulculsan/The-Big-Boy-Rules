# Noticias · Rediseño editorial v243

Portada con noticia principal y dos titulares visuales, seguidos de la última hora. Tipografía Inter, superficies oscuras y detalles dorados; móvil en una columna sin títulos cortados.

Las fotografías proceden exclusivamente de los RSS de los medios configurados: media:content, media:thumbnail, enclosure de imagen y HTML del resumen. No se inventan fotografías de actualidad ni se rastrean artículos. Cuando no hay foto o falla, aparece una ilustración de la categoría (deportes, España o mundo). Los enlaces e imágenes deben ser HTTPS y no incluir credenciales.

El resumen es texto escapado y limitado a 300 caracteres. Conserva fecha, medio, enlace externo y la acción de compartir existente. La selección de categoría, caché de sesión, recuperación sin red y protección contra respuestas obsoletas se conservan; cambia la clave de caché para recoger las fotografías nuevas.

`news-design-preview.html` usa la función real de renderizado con contenido identificado como maqueta. No está incluido en la aplicación publicada.

El servicio `supabase/functions/news-feed/index.ts` se desplegó en el proyecto nfvggpgeypkkqceivkaq desde el panel de Supabase el 10 de octubre de 2026. El cliente actualizado sigue admitiendo respuestas antiguas sin imágenes.

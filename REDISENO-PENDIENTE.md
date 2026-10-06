# Rediseño de The Big Boy Rules

Estado actual: propuesta Club Edition aprobada en Figma e implementada localmente el 6 de septiembre de 2026, versión web 155, sincronizada con el proyecto estable de iOS. Pendiente ejecutar desde Xcode para actualizar el iPhone.

## Actualización Club Edition · v155

- Aplicada la dirección visual aprobada: fondos oscuros, dorado discreto, tipografía y espaciados más limpios en inicio, chats, calendario y perfil.
- Bandeja con búsqueda local por nombre/usuario y filtros Todos, No leídos y Nuevo chat. La consulta y el filtro se mantienen al refrescar los datos. Sin búsqueda en el contenido de los mensajes.
- Conversaciones privadas con cabecera compacta, burbujas neutras/doradas y hora discreta. Se conservan edición, eliminación, cámara, audio, fotos y documentos.
- Contador y acceso a próximos logros junto al título de la vitrina. Se conservan trofeos, efectos Lottie y sus interacciones.
- No se han modificado los motores de navegación, gesto de vuelta, teclado nativo ni animaciones de cartas/trofeos.
- Pruebas automatizadas: 156 superadas. Comprobación visual local a 390 px con datos ficticios: bandeja, conversación y perfil. Gesto de vuelta completo muestreado en 85 fotogramas: bandeja estable en 390 × 844 antes y después, sin cambio de dimensiones al finalizar.
- Build web y sincronización de Capacitor terminados. Once archivos clave coinciden entre fuentes, www e ios/App/App/public. Configuración estable sin servidor de desarrollo.
- No se ha instalado en el teléfono ni publicado. La prueba de fluidez y teclado en iPhone real sigue siendo necesaria.
- El conector Figma devolvió límite de llamadas al solicitar contexto; la implementación utiliza la propuesta visual ya creada y aprobada, sin nuevas llamadas de diseño ni cambios en el archivo Figma.

## Historial de la primera implementación · v131

## Entrega y comprobaciones

- Navegación de cuatro destinos, inicio de club, bandeja simplificada, calendario y perfiles centrados en logros implementados.
- Retirados los flujos, controles, consultas y suscripciones de publicaciones e historias. Se conservan los avatares y los archivos de conversaciones.
- Noticias cerradas y sin carga inicial; los próximos planes se calculan desde los mismos eventos del calendario.
- Detalle de logros con rango, descripción y porcentaje calculado sobre miembros activos, visibles y registrados, sin duplicar asignaciones.
- Cuarenta y una pruebas automatizadas superadas, sintaxis JavaScript y revisión de diferencias sin errores.
- Corrección adicional de desplazamientos tardíos (v131): en móvil cada pantalla tiene su propia zona de scroll; el documento exterior permanece fijo y la barra inferior no inicia arrastres. Cabecera estable bajo la zona segura y compactación de la barra siguiendo solo el scroll de la pantalla activa. Pruebas locales de Inicio y Calendario durante 1,6 segundos tras cambiar desde Chats, con desplazamientos tardíos de la superficie anterior y actualización de eventos simulados: sin movimiento del documento ni de la pantalla de destino. Otra ráfaga de 80 toques sin pérdidas ni saltos. Comprobados scroll voluntario de 420 px, barra compacta y zona segura simulada de 58 px. Pendiente confirmar la inercia táctil real en iPhone con ▶ en Xcode; los eventos sintéticos no equivalen a la física nativa de iOS.
- Navegación rápida: selección al soltar el dedo, captura estable del puntero, clics tardíos descartados y pulsación larga del perfil conservada. Los cambios no esperan a las animaciones. Reinicio instantáneo del desplazamiento, sin anclajes heredados ni callbacks de pestañas antiguas; URL y carga secundaria agrupadas tras la ráfaga. Perfil reutilizado mientras sus datos no cambien. Verificadas cuatro ráfagas de 80 pulsaciones (390 px con/sin clic posterior, 320 px y escritorio 1280 px), sin selecciones perdidas ni saltos, usando datos locales ficticios. La prueba previa reproducía desplazamientos heredados de hasta 940 px y 20 reconstrucciones de perfil; después: cero desplazamientos y una sola reconstrucción inicial. Pendiente repetir la prueba táctil en iPhone real.
- Integración del teclado: contenedor UIKit anclado a UIKeyboardLayoutGuide, plugin oficial de teclado sin redimensionado duplicado, estilo oscuro y barra auxiliar del navegador oculta solo dentro del chat. Compositor con controles de 44 puntos, foco conservado al enviar y protección del siguiente borrador. La web/PWA conserva VisualViewport como alternativa. Comprobados diseño a 320/390 píxeles y espacio de teclado simulado; comprobación de tipos Swift con el SDK de iOS superada. Compilación completa de Xcode bloqueada por permisos de caché SwiftPM de esta sesión; pendiente compilar y probar apertura/cierre del teclado real en iPhone.
- Selector inferior persistente: la cápsula y la rayita dorada se deslizan juntas en 180 ms, sin bloquear la navegación y respetando movimiento reducido. Comprobada su alineación en móvil, escritorio y barra compacta. Muestra original de movimiento creada en Lottie Creator (Main Scene, 390 × 120, 60 fps); la interacción real usa una transición CSS ligera, sin añadir un reproductor Lottie al arranque de la app. La duración local se ha acortado en la versión 130 para responder mejor a cambios rápidos.
- Chats sin cabecera global duplicada. La bandeja conserva sus dimensiones antes, durante y después de entrar o volver. Movimiento de apertura/vuelta diseñado en Lottie Creator (Chats · apertura y vuelta, 390 × 760, 60 fps), trasladado a las superficies reales mediante Web Animations: 250 ms como máximo, seguimiento del dedo y retorno al cancelar, sin capturas ni carga de un reproductor. Comprobados gesto parcial/completo, cancelación, grupo, escritorio y zona segura/teclado simulados; pendiente comprobar rendimiento y teclado nativos en iPhone.
- Revisión visual e interacciones en navegador local con datos ficticios, en móvil y escritorio. No sustituye la prueba con cuentas reales ni con el iPhone.
- Archivos de la versión estable copiados a `ios/App/App/public`; pendiente ejecutar ▶ en Xcode para actualizar y comprobar el iPhone. No se ha publicado ni instalado automáticamente.
- Los originales de publicaciones e historias siguen en Supabase. No se ha ejecutado ningún borrado remoto ni migración destructiva.
- Queda pendiente, si se decide más adelante, limpiar datos remotos con copia de seguridad y revisar el diseño en Figma.

## Especificación acordada

## Dirección del producto

- Alejar la aplicación del aspecto de una red social genérica.
- Eliminar las secciones y flujos de publicaciones e historias/momentos.
- Retirar del producto únicamente las fotografías y vídeos asociados a publicaciones e historias, junto con sus acciones sociales relacionadas.
- Mantener la identidad de club privado, los chats, el calendario, Spotify, los eventos, los perfiles y los logros.
- Conservar las fotos de perfil de los usuarios y la foto del grupo.

## Navegación inferior

La barra tendrá únicamente cuatro destinos:

1. **Principal**: conservar el icono actual de inicio.
2. **Chats**: acceso directo a la bandeja de conversaciones.
3. **Calendario**: calendario y eventos.
4. **Perfil**: conservar el icono/avatar actual del usuario.

Eliminar de la navegación cualquier acceso dedicado a publicaciones, historias o un buscador independiente.

## Pantalla principal

- Barra de búsqueda de usuarios en la parte superior.
- La búsqueda solo mostrará miembros/usuarios.
- Noticias cerradas por defecto; el usuario decide cuándo desplegarlas.
- Zona visual en paralelo para:
  - lista o integración de Spotify;
  - próximos eventos.
- Los eventos estarán vinculados con el calendario: cualquier cambio deberá reflejarse en ambos lugares.
- Diseño profesional de club privado, ordenado y fácilmente reconocible, sin apariencia de feed social.

## Chats

- Bandeja mucho más minimalista.
- Mostrar directamente las conversaciones con avatar, nombre, último mensaje, hora y estado no leído.
- Eliminar encabezados decorativos grandes como «The Big Boy Rules» y «Mensajes».
- Mantener juntos el chat del grupo y los chats privados.
- Conservar las categorías internas del grupo, pero sin recargar la bandeja.
- Priorizar apertura rápida, transiciones fluidas y aspecto de aplicación nativa.

## Calendario y eventos

- Calendario minimalista y visualmente más claro.
- Días con eventos reconocibles de un vistazo.
- Resumen próximo y acceso al detalle sin paneles genéricos.
- Sincronización inmediata con el apartado de eventos de la pantalla principal.

## Perfil y logros

- Mantener el perfil como cuarto destino de la barra inferior.
- Mantener el sistema de logros y sus rangos.
- Al pulsar un logro, abrir una vista de detalle grande y cuidada con:
  - icono/trofeo y rango;
  - nombre del logro;
  - descripción completa;
  - porcentaje de miembros que poseen el logro;
  - recuento opcional, por ejemplo «3 de 12 miembros»;
  - animación breve y profesional de apertura/cierre.
- El porcentaje se calculará sobre miembros activos y se actualizará cuando un administrador asigne o retire el logro.

## Limpieza técnica prevista

- Retirar componentes, eventos, estilos y consultas exclusivos de publicaciones e historias.
- Retirar cámara/editor/filtros, likes, comentarios y notificaciones que solo dependan de esos contenidos.
- Conservar expresamente las fotos de perfil de los usuarios y la foto del grupo.
- No borrar contenido almacenado en Supabase de forma irreversible sin resolver primero el alcance exacto y preparar una copia de seguridad.
- Simplificar la carga inicial y evitar solicitar datos de módulos eliminados.
- Implementar primero la estructura funcional; usar Figma después en pocas operaciones agrupadas para no malgastar su límite.

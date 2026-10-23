# Club Live: planes, predicciones y recuerdos

Implementación compartida para web/PWA/Capacitor iOS/Android. Sin dependencias nuevas.

## Integración

Cargar `club-live.css` y `club-live.js` antes de inicializar la app. No necesita un contenedor fijo; usa un dialog modal accesible, con título, cierre y restitución del foco.

```js
ClubLive.init({
  db,
  getUser: () => currentAuthUser,
  getEvents: () => groupEvents,
  getMember: authId => members.find(m => m.authId === authId),
  canManage: () => canManageSite(),
  onAddPhoto: event => openMomentComposer() // opcional: usar el flujo real existente
});
```

- `ClubLive.open(event, occurrence?)`: objeto de agenda normalizado con id, title, startsAt, location, createdBy, annual; occurrence es YYYY-MM-DD de Madrid para aniversarios.
- `ClubLive.openMap()` abre los lugares ya fijados y sus fotos.
- `ClubLive.reset()` cerrar y borrar configuración al salir de sesión.
- `ClubLive.refresh()` actualiza el plan abierto.
- Botón `data-club-live-event="ID"` abre el plan por id usando getEvents. `data-occurrence` opcional.
- Botón `data-club-memory-map` abre el atlas.

## Comportamiento

La llegada se registra únicamente en el día del plan y con el reloj del servidor. Una segunda pulsación permite deshacerla. El resto de miembros ve el nombre y hora. Se muestran los confirmados desde event_attendance.

Cualquier miembro aprobado puede crear decisiones rápidas o predicciones. Las opciones no se editan una vez publicadas. Cada cuenta dispone de un voto por pregunta y puede cambiarlo mientras esté abierta. Predicciones cerradas automáticamente al inicio del plan. Autor o administrador cierra las decisiones y revela el resultado de las predicciones. Sin reparto de premios por resultados declarados por usuarios.

El resumen calcula llegadas, fotos y decisiones resueltas de los datos. El selector vincula fotos propias publicadas en moments; no crea copias públicas ni cambia permisos. La eliminación del momento elimina su vínculo. Los momentos que caducan o se borran dejan de mostrarse: para un álbum permanente hay que conservar los originales mediante la política de medios del producto.

El organizador o administración fija nombre y coordenadas del lugar. La ubicación del dispositivo solo se solicita mediante un botón explícito y no se guarda hasta confirmar. El atlas sitúa puntos según sus coordenadas relativas, con títulos y fotos; cada lugar abre el plan, desde el cual se accede al mapa real OpenStreetMap. No descarga mapas de terceros hasta abrir ese enlace.

## Seguridad y rendimiento

Cinco tablas con RLS y gate de seguridad existente. Se exige perfil aprobado, usuario autenticado y seguridad de cuenta satisfecha. Todas las funciones son security invoker, con search_path vacío y ejecución PUBLIC revocada. Triggers impiden alterar identidad y opciones, falsificar fechas de llegada y votar después del cierre. El voto bloquea en lectura compartida la pregunta, serializando con su cierre.

Solo se consultan los detalles cuando el usuario abre un plan/mapa. Peticiones con plazo de 15 segundos, lecturas paralelas, límites 40 preguntas/80 fotos, refresco visible cada 20 segundos, sin reconstruir formularios mientras se escribe. Cerrar invalida respuestas pendientes y detiene temporizadores. Fotos lazy y URLs limitadas a https/mismo origen; texto escapado al renderizar. Inputs mantienen selección de texto y 16px en móvil para evitar zoom al editar. Animación respeta reduced motion.

Verificación local ejecutada: `node --check club-live.js` (sintaxis). No se ejecutaron tests. La migración debe revisarse y aplicarse remotamente antes de habilitar entradas.

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
- `ClubLive.openMap()` abre el pasaporte privado: sitios con visitas terminadas, fotos, llegadas registradas y propuesta para volver. `ClubLive.openMap("room")` muestra los detalles conseguidos de la sede.
- `ClubLive.reset()` cerrar y borrar configuración al salir de sesión.
- `ClubLive.refresh()` actualiza el plan abierto.
- Botón `data-club-live-event="ID"` abre el plan por id usando getEvents. `data-occurrence` opcional.
- Botón `data-club-memory-map` abre el pasaporte. `data-club-room-progress` abre el progreso de la sede. `mountRoomDetails(room)` integra los objetos conseguidos en la habitación normal y ampliada.

## Comportamiento

La llegada se registra únicamente en el día del plan y con el reloj del servidor. Una segunda pulsación permite deshacerla. El resto de miembros ve el nombre y hora. Se muestran los confirmados desde event_attendance.

Cualquier miembro aprobado puede crear decisiones rápidas o predicciones. Las opciones no se editan una vez publicadas. Cada cuenta dispone de un voto por pregunta y puede cambiarlo mientras esté abierta. Predicciones cerradas automáticamente al inicio del plan. Autor o administrador cierra las decisiones y revela el resultado de las predicciones. Sin reparto de premios por resultados declarados por usuarios.

El resumen calcula llegadas, fotos y decisiones resueltas de los datos. El selector vincula fotos propias publicadas en moments; no crea copias públicas ni cambia permisos. La eliminación del momento elimina su vínculo. Los momentos que caducan o se borran dejan de mostrarse: para un álbum permanente hay que conservar los originales mediante la política de medios del producto.

El organizador o administración fija nombre y coordenadas del lugar. La ubicación del dispositivo solo se solicita mediante un botón explícito y no se guarda hasta confirmar. El pasaporte sitúa puntos según sus coordenadas relativas; su esquema no representa calles. Agrupa visitas al mismo nombre y punto redondeado a tres decimales. Cada sitio tiene fechas, fotos y nombres de quienes registraron su llegada. Los autores de recuerdos no se presentan como asistentes si no registraron llegada. La opción Proponer volver prepara un evento para administración o un borrador en el chat para los demás, sin enviar mensajes automáticamente. Desde el sitio se accede al mapa real OpenStreetMap. No descarga mapas de terceros hasta abrir ese enlace.

## Seguridad y rendimiento

Las tablas de actividad y `club_room_unlocks` tienen RLS y el gate de seguridad existente. Se exige perfil aprobado, usuario autenticado y seguridad de cuenta satisfecha. Los triggers originales son security invoker, con search_path vacío y ejecución PUBLIC revocada. La nueva función `get_club_room_passport()` usa SECURITY DEFINER únicamente para insertar hitos fijos en `club_room_unlocks`, con comprobación explícita de autenticación, perfil aprobado no oculto y `assert_account_security()`. No recibe contadores ni hitos del cliente; PUBLIC y anon no tienen EXECUTE. La tabla no admite escrituras desde el cliente. Triggers impiden alterar identidad y opciones, falsificar fechas de llegada y votar después del cierre. El voto bloquea en lectura compartida la pregunta, serializando con su cierre.

Los detalles de planes se consultan al abrirlos. La sede y el pasaporte comparten una petición de resumen, caché en memoria por usuario de 60 segundos y límite de 150 visitas recientes; salir borra la caché y los objetos del DOM. El resumen del servidor usa únicamente ocurrencias válidas y terminadas, con llegadas o recuerdos. Los planes sin fin explícito se consideran terminados cuatro horas después del inicio (un día en cumpleaños). Peticiones con plazo de 15 segundos, lecturas paralelas, límites 40 preguntas/80 fotos, refresco visible cada 20 segundos, sin reconstruir formularios mientras se escribe. Cerrar invalida respuestas pendientes y detiene temporizadores. Fotos lazy y URLs limitadas a https/mismo origen; texto escapado al renderizar. Inputs mantienen selección de texto y 16px en móvil para evitar zoom al editar. Animación respeta reduced motion.

## Detalles permanentes de la sede

- Un plan terminado con dos llegadas: banderín junto al tablón.
- Cinco recuerdos de planes terminados: notas en la pared.
- Tres sitios visitados y guardados: recuerdo en la caja de la estantería.
- Diez planes terminados con dos llegadas: trofeo en la estantería.

El servidor guarda los hitos una vez conseguidos; borrar después un plan o recuerdo no los retira. Los cumpleaños cuentan como encuentros cuando cumplen los mismos requisitos de fin y llegadas. No hay recompensas de monedas ni sobres en estos hitos.

Verificación: `node --test scripts/club-passport.test.mjs` prueba la migración real con PGlite (permisos, fechas, evidencias y permanencia) y el flujo DOM (fotos firmadas, agrupación, propuesta y estado vacío). Migración nueva: `20261025141628_club_room_progress_and_passport.sql`.

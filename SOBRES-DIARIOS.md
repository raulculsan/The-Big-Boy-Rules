# Sobres diarios — primera fase

Implementación local: versión 152. La recarga real necesita activar el archivo SQL en Supabase. No se ha ejecutado en producción desde Codex; el usuario confirmó haberlo activado y ver su primer sobre.

## Activación

1. En Supabase, abrir SQL Editor y una consulta nueva.
2. Copiar todo `supabase-daily-packs.sql` y pulsar Run. Requiere el esquema base de perfiles, no el instalador de logros. Puede repetirse sin borrar sobres.
3. Abrir la app con la sesión iniciada. En Inicio, pulsar «Tus sobres».

Para el iPhone instalado desde Xcode, volver a ejecutar con ▶ después de sincronizar el proyecto estable.

## Regla inicial

- Un sobre por cada día que se accede con sesión autenticada; incluye una sesión que ya estaba guardada.
- El día se calcula en el servidor, en Europe/Madrid. Se renueva a medianoche, incluidos los cambios de horario de verano.
- Abrir o actualizar varias veces, cambiar la fecha del teléfono o usar dos dispositivos no duplica el sobre.
- Se guardan en la cuenta, no en la caché local. No caducan ni exigen una racha consecutiva.
- No se conceden sobres por días ausentes ni por actividad anterior a la activación.
- Se comprueba al recuperar la sesión, volver al primer plano, recuperar conexión y permanecer en primer plano al cambiar de día. Si estás sin conexión, se registra cuando vuelve la conexión, según el día del servidor; no se inventan visitas retroactivas.

## Pantallas

Actualización 162: añadida CARABANCHEL, Ubicación Legendaria, con anverso diurno cinematográfico y reverso legendario unificado. El catálogo contiene dieciséis cartas. Sin puntuación ni PTS, no requiere SQL y no altera sobres ni propiedad.

Actualización 160: composición unificada para las quince cartas del catálogo. Los anversos usan la misma cuadrícula y jerarquía tipográfica; Borox y Castellana adoptan el panel inferior común. Los reversos comparten diseño y distinguen Común, Especial y Legendaria únicamente mediante color y material.

Actualización 159: añadida CASTELLANA, Ubicación Legendaria, con ambas caras; el catálogo contiene quince cartas. Sin puntuación ni PTS, no requiere SQL y no altera sobres ni propiedad.

Actualización 158: añadida ABELIAS, Ubicación Común, con anverso y reverso; el catálogo contiene catorce cartas. No lleva puntuación ni PTS, no requiere SQL y no altera sobres ni propiedad.

Actualización 152: BOROX, Ubicación Legendaria sin puntuación, con anverso y reverso v3 de acabado contenido. Todas las cartas de miembros pasan a Común, incluida la rotulación de los ocho anversos que decían Normal. El catálogo tiene trece cartas; no necesita SQL ni cambia saldos o propiedad.

Actualización 151: añadida LUCA DE TENA como primera carta de ubicación, edición Especial y sin puntuación ni «PTS». Incluye un reverso especial propio. El catálogo contiene doce cartas: once de miembros y una ubicación. No requiere cambios SQL, no consume sobres y no concede propiedad.

Actualización 150: cartas interactivas al arrastrar con reflejo Lottie, giro mediante deslizamiento y vista previa de apertura Lottie en «Probar apertura». No consume sobres ni concede cartas; el reparto real sigue pendiente de definir. Se conservan las once cartas aprobadas.

Actualización 149: añadida DANIEL GONZALEZ MOTOS (Normal, 80 puntos), con anverso y reverso. El catálogo contiene once cartas. No requiere cambios SQL.

Actualización 148: añadida FELIPE HP (Normal, 80 puntos), con ambas caras originales. El catálogo contiene diez cartas. No requiere cambios SQL.

Actualizaciones 145–147: añadidas CAONABO ALBERTO (Normal, 82 puntos), ALBERTO VELASCO (Normal, 79 puntos) y CARLOS GONZALEZ MOTOS (Normal, 82 puntos, v3 aprobada), con ambas caras originales. El catálogo contiene nueve cartas. No necesita cambios SQL ni concede propiedad de cartas.

Acceso desde Inicio y página independiente `#sobres`, conservando los cuatro destinos de la barra inferior y el botón de volver. Se reutiliza el diseño guardado en `docs/cartas/sobre-los-nuestros-v1.png` sin alterarlo.

Saldo de sobres cerrados, confirmación del acceso de hoy, próximo reinicio y reintento de sincronización. Si no está activado el servidor, se indica expresamente y no se muestra un saldo inventado.

El catálogo incluye seis cartas definitivas, con puntuaciones indicadas por el usuario: JOSE ENRIQUE FERNANDEZ CRUZ, Normal, 86 puntos; MIGUEL ANGEL JIMENEZ SANCHEZ, Normal, 83 puntos; LIZZY MACHADO YONG, Común, 81 puntos; RAUL CULSAN GONZALEZ, Normal, 83 puntos (versión v2 aprobada, camisa blanca y ángulo bajo); MARIO SALVATIERRA MEDINA, Común, 81 puntos; y ALMUDENA DE DIEGO MATILLA, Común, 84 puntos. Se accede desde Inicio → Tus sobres → Las caras del club. Al pulsar cada carta se abre una vista ampliada con sus dos caras originales y un botón para girarla. Respeta movimiento reducido, permite cerrar con Escape y restaura el foco sin solicitar desplazamiento. Las imágenes tienen proporción aproximada 4:7 y se muestran completas, sin recorte.

`card-collection.js` contiene los metadatos del catálogo, separados del inventario personal. Los originales están guardados por tipo en `docs/cartas/miembros/` y `docs/cartas/ubicaciones/`; sus copias idénticas en `icons/cards/` se incluyen en web, caché PWA e iOS estable. El reverso se carga en la vista al abrir el detalle; la miniatura usa carga diferida.

No hay todavía apertura, sorteo de cartas ni intercambios. Ver una carta del catálogo no significa haberla conseguido. El sobre permanece guardado hasta que se implemente esa fase. No se han definido probabilidades, cantidad de cartas por sobre ni asignaciones a cuentas. La barra refleja la recarga por acceso diario, no una cuenta atrás que conceda sobres mientras la app está cerrada. Añadir esta carta al catálogo no requiere otra consulta SQL.

## Seguridad

Tabla `card_packs`: saldo derivado de los sobres con `opened_at is null`, clave única usuario/día. Lectura protegida para el propietario; cliente sin permisos de insertar, modificar, borrar ni usar la secuencia. La función `claim_daily_card_pack()` toma identidad y fecha del servidor, rechaza perfiles ocultos o inexistentes y funciona sin parámetros manipulables. La futura apertura deberá consumir un sobre mediante una operación de servidor atómica; no dar permisos de escritura directos al cliente.

## Comprobación manual

Tras activar SQL: iniciar sesión y comprobar 1 sobre; reabrir y actualizar repetidamente (debe seguir en 1); abrir la misma cuenta en otro dispositivo (mismo saldo); otra cuenta no debe ver ese saldo. El siguiente día de acceso suma uno más. Cerrar sesión borra la vista local pero no los sobres guardados. Antes de activar SQL, la página debe mostrar que la recarga está pendiente de activación.

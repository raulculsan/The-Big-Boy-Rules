# Logros automáticos

## Cartas y sobres · actualización v156

En Administración → Logros → Crear logro → Objetivo automático → Actividad aparecen cinco categorías nuevas:

- **Sobres diarios conseguidos:** cada sobre nuevo acreditado después de crear el objetivo. Actualizar el saldo no suma; los sobres anteriores no se importan.
- **Cartas distintas exploradas:** abrir una carta en grande; una vez por carta y objetivo.
- **Cartas especiales exploradas:** solo edición Especial.
- **Cartas legendarias exploradas:** solo edición Legendaria.
- **Ubicaciones exploradas:** cartas de lugares de cualquier edición; no utiliza ubicación del dispositivo.

Ejemplos: «Una semana de sobres» (7 sobres, bronce), «Conoce al club» (5 cartas distintas, plata), «Primera leyenda» (1 legendaria, oro).

Estas categorías distinguen explorar de poseer: el catálogo todavía no es un inventario y «Probar apertura» no consume sobres ni concede cartas. No hay objetivos de sobres abiertos ni cartas obtenidas hasta que exista una apertura real.

**Activado en Supabase el 8 de septiembre de 2026:** actualización ejecutada desde Chrome en el proyecto `nfvggpgeypkkqceivkaq`, con resultado satisfactorio. Verificados antes y después 9 logros, 7 asignaciones y 5 sobres; catálogo de 13 cartas, función de exploración y trigger de sobres activos, RLS habilitado y ejecución anónima bloqueada. No se crearon trofeos de prueba en producción.

Para otras instalaciones: ejecutar el archivo completo `supabase-collection-achievements.sql` en SQL Editor, después de las actualizaciones de logros automáticos y sobres diarios. Se puede repetir, conserva los datos y no concede progreso histórico. Si se vuelve a ejecutar el instalador base de logros automáticos, aplicar después nuevamente esta extensión.

Las metas de exploración están limitadas por el catálogo (actualmente 13 cartas, 1 especial, 1 legendaria y 2 ubicaciones). Al añadir nuevas cartas, actualizar también `achievement_card_catalog` mediante una migración; el cliente no puede alterar sus rarezas ni inventar identificadores. Girar, cerrar o reabrir la misma carta no duplica el contador. El progreso se conserva en el servidor por usuario y objetivo; una carta puede aportar a varios objetivos compatibles.

El cliente comunica únicamente el identificador explorado; el servidor determina la cuenta y la categoría. Esto registra una interacción con el catálogo, no constituye prueba de adquisición. Sin conexión, reabrir la carta vuelve a intentar registrar la exploración, sin inventar progreso local.

Los logros manuales y sus asignaciones se conservan. Los rangos siguen siendo bronce, plata, oro y platino, con las animaciones Lottie existentes. Cada logro automático tiene una actividad y una meta fija. El progreso pertenece a cada usuario; la personalización visual de la barra queda pendiente.

## Activación en Supabase

1. Si los logros manuales ya funcionan, no vuelvas a ejecutar el instalador antiguo.
2. En el proyecto de Supabase, abre **SQL Editor → New query**.
3. Copia el contenido completo de `supabase-achievement-progress.sql` y pulsa **Run**. Se ejecuta en una transacción y se puede repetir sin reiniciar contadores ni borrar logros. Si ya instalaste la primera versión, vuelve a ejecutar el archivo actualizado para activar el límite diario y la participación por acceso a la app.
4. Abre de nuevo la app o pulsa **Comprobar de nuevo** en Administración → Logros → Crear logro. Se habilitará «Objetivo automático».
5. Para una instalación nueva, aplica primero `supabase-setup.sql` (o el módulo manual `supabase-achievements.sql` sobre una instalación compatible), y después esta actualización. No ejecutes el instalador manual después de esta actualización: restauraría las políticas antiguas de asignación.

Esta actualización no necesita claves nuevas, funciones Edge ni servicios de pago. El código local no aplica cambios automáticamente al proyecto remoto.

## Actividades disponibles

| Actividad | Qué cuenta | Meta |
| --- | --- | --- |
| Mensajes en el grupo | Solo el primer mensaje del día entre todas las categorías, incluidos adjuntos. Nunca mensajes privados. Un máximo de un punto al día. | Entre 1 y 100.000 días |
| Días de participación | Entrar en la app con la cuenta, incluso con una sesión guardada. No exige escribir ni cerrar sesión. Un máximo de un punto al día. | Entre 1 y 100.000 días |
| Completar el perfil | Tener nombre, foto y biografía. Los perfiles ya completos se reconocen al crear el objetivo. | 1 |

Los mensajes y días empiezan a contar al crear cada logro. No hay importación del historial. Todos los miembros visibles pueden conseguirlo, también quienes se incorporen después. Editar o borrar un mensaje no añade progreso ni retira lo ya conseguido. Una vez completado, el logro permanece aunque se quite después la biografía o la foto.

Los días se calculan en el servidor con la zona Europe/Madrid y no tienen que ser consecutivos. Abrir varias veces o usar varios dispositivos no multiplica el progreso. También se registra el nuevo día si la app sigue en primer plano al cruzar medianoche; no cuenta actividad de una app en segundo plano. Si no hay conexión, se reintenta al recuperarla, sin atribuir días pasados desde el reloj del móvil.

La actualización conserva los contadores y trofeos anteriores como punto de partida: no recalcula ni retira progreso ya acumulado con las reglas antiguas. El límite diario y los accesos se aplican a la actividad nueva tras actualizar Supabase y la app.

## Administración y perfiles

- **Asignación manual:** conserva la selección de miembros y la gestión de asignaciones.
- **Objetivo automático:** permite elegir actividad y meta, muestra la vista previa y se concede en el servidor al completarlo. No permite asignaciones o retiradas manuales. Para otro objetivo, crea un logro nuevo; la regla no se edita después de crearla.
- **Perfil propio:** muestra los objetivos pendientes y el progreso. Al completarlos aparecen en la sala de trofeos.
- **Perfiles ajenos:** solo muestran los trofeos conseguidos, no el progreso pendiente.
- El detalle distingue entre «Tu progreso» y el porcentaje de miembros que ya tienen ese logro.
- La app actualiza los datos por Realtime y vuelve a consultarlos al reconectar o regresar del segundo plano. Sin conexión no presenta un contador desconocido como si fuera cero.

## Privacidad y verificación

Los contadores no se escriben desde el cliente. Triggers de PostgreSQL y un procedimiento de visita autenticada registran los eventos, deduplican y otorgan el trofeo en la misma transacción. La visita obtiene el usuario de `auth.uid()` y la fecha del servidor: no admite parámetros para elegir otro usuario, fecha o puntuación. RLS permite leer el progreso solo a su propietario, incluso si otro usuario es administrador. El registro interno de eventos no expone datos al cliente ni guarda el contenido de los mensajes. Los procedimientos internos no permiten ejecución por `anon`, `authenticated` ni `PUBLIC`; solo el procedimiento de visita está disponible para usuarios autenticados.

Las pruebas se ejecutan con `pnpm test`: incluyen PostgreSQL real en memoria (PGlite), permisos/RLS, duplicados, validación, migración repetida, concesión automática, compatibilidad manual, formularios y respuestas tardías de una sesión anterior. No usan cuentas ni datos de producción. Una prueba en el iPhone sigue siendo necesaria para validar el acabado visual.

Referencias de seguridad: [funciones de Supabase](https://supabase.com/docs/guides/database/functions) y [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security).

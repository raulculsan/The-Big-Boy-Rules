# Progresión de colecciones y días de entrada

Desplegar `supabase-card-acquisition-achievements.sql` después de los módulos existentes de logros, catálogo y tienda. Una transacción repetible, sin eliminar logros, inventario, sobres ni asignaciones. El SELECT final muestra sólo cifras agregadas.

## Cartas realmente conseguidas

- Métrica única `cards_acquired`, distinta de `cards_explored` (que sigue disponible).
- `member_card_acquisitions` guarda una adquisición por usuario/carta para siempre. INSERT de premios de sobre e INSERT/UPDATE de inventario del servidor generan el crédito. Duplicados y descartes no vuelven a contar.
- Backfill une inventario positivo y premios históricos de sobres. Los objetivos nuevos reconocen las adquisiciones previas. Las tarjetas inactivas que ya se consiguieron conservan su progreso.
- Reutiliza deduplicación y premios del sistema de logros: no hay escritura de cliente al historial ni RPC que acepte supuestas adquisiciones. Metadatos se conservan como estaban al conseguir la carta.
- Baremo global Coleccionista: 50 bronce, 100 plata, 250 oro y 500 platino. Los objetivos mayores quedan preparados para futuras colecciones. Los Nuestros conserva 1, 5, 10, 25 y 50, creados sólo si alcanzables en el catálogo actual. La meta numérica no cambia al ampliar el catálogo.
- Administración: actividad «Cartas distintas conseguidas», colección opcional (vacía = todas), rareza opcional y tipo opcional. Crea por `create_card_acquisition_achievement`, sin sobrecargar el RPC anterior. Permite planificar una meta superior al catálogo actual con indicación de las cartas disponibles.
- La actualización de logros se solicita después de confirmar `open_owned_card_pack`, además de los cambios realtime existentes. No depende de abrir las cartas en grande.

## Añadir otra colección

1. Registrar clave permanente y nombre en `card_collection_catalog` (por ejemplo `viajeros-02`).
2. Añadir sus cartas a `achievement_card_catalog` con `collection_key` explícita e IDs permanentes y únicos; las cartas antiguas tienen `los-nuestros-01` por defecto.
3. Seleccionar esa colección al crear sus metas. Las globales siguen sumando sin reiniciar nada. Rarezas/tipos se filtran como metadatos, no creando una métrica por combinación.
4. Al implantar sobres de la colección nueva, adaptar también el selector de cartas de los sobres al `card_packs.collection_key`; el selector actual es de Los Nuestros y este cambio no introduce nuevas colecciones ni modifica las probabilidades.

No reasignar una carta adquirida a otra colección ni cambiar sus IDs: su identidad histórica está fijada. Para una carta nueva se usa un ID nuevo.

## Días en la app

El backend desplegado no tenía `record_daily_app_visit`: los días se acreditaban desde mensajes. La migración instala el RPC y retira la aportación de días del trigger de mensajes, conservando su contador de mensajes.

`member_app_visit_days` registra cada día real una vez (fecha del servidor en Madrid), también con sesión restaurada. Guarda días aunque no existan metas o ya estén completas. Los eventos históricos `day:YYYY-MM-DD` realmente acreditados se recuperan; no se inventan visitas antiguas a partir de fechas de alta o de inicio de sesión. Metas nuevas de días reciben ese historial por trigger.

El cliente registra tras restaurar sesión/cargar logros, al volver visible, foco/online y cada minuto mientras está visible para cubrir medianoche. Si falla, no cachea el día como completado y conserva un aviso de conexión; vuelve a intentarlo. El servidor reconcilia todos los días con deduplicación. No requiere contraseña ni escribir mensajes.

Comprobación realizada: sintaxis JavaScript con `node --check`. No se ejecutaron pruebas automatizadas ni se instaló en el iPhone.

## Despliegue v244

Aplicado el 10 de octubre de 2026 en Supabase. Resultado de la migración: 1 colección, 10 objetivos de adquisición, 41 adquisiciones únicas acreditadas, 8 metas completadas y 1 día histórico registrado. Build web y sincronización iOS completados; instalación mediante Run a cargo del usuario.

## Corrección del baremo Coleccionista

En instalaciones con el baremo inicial, ejecutar `supabase-collector-milestones.sql`. Retira de la presentación únicamente las metas globales de 1/5/10/25 mediante `achievements.retired_at`; sus premios, progreso e historial permanecen en la base de datos. El objetivo global de 50 conserva su ID y pasa a bronce. Las metas 100/250/500 reciben el historial adquirido previo. Consultas de la app, estadísticas y cola de celebraciones sólo usan definiciones vigentes y sus premios. Reejecutar la migración original ya no vuelve a crear el baremo antiguo.

Baremo global v245 desplegado en Supabase el 10 de octubre de 2026: 50 bronce, 100 plata, 250 oro, 500 platino. Metas anteriores retiradas sin borrar historial. Build y sincronización iOS completados.

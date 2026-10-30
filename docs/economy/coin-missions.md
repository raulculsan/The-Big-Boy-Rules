# Monedas por participar

Las seis vías comparten la cartera de la tienda. El cliente nunca decide el importe ni envía una cuenta destinataria.

| Actividad | Monedas | Límite |
| --- | ---: | --- |
| Superar un nivel nuevo | 5, 8, 10, 12 o 15 | Una vez por juego/nivel, niveles 1–5 |
| Rutina de pelota o Roomba | 5 por juego | Una vez por juego y día de Madrid; hasta 10/día |
| Tres objetivos semanales | 25 | Una vez por semana de Madrid |
| Objetivo colectivo mensual | 30 | Una vez al mes por participante |
| Foto de un plan al que asististe | 10 | Una vez por persona/plan/fecha; hasta 3 planes/día |
| Completar página / rareza del álbum | 10 / 30 | Una vez por colección/rareza/página, o colección/rareza |

La misión semanal pide tres tipos de actividad: completar una partida validada, registrar una llegada a un plan y publicar una foto premiada. El reto colectivo reutiliza el progreso social mensual (dos planes con dos asistentes, cinco recuerdos y tres parejas de intercambio) y exige haber contribuido.

Las fotos necesitan un objeto existente en el almacenamiento privado `club-memories`, o una foto propia enlazada desde Recuerdos. No cuentan textos solos, rutas inventadas, planes futuros ni recuerdos de hace más de treinta días. Borrar y volver a subir no vuelve a pagar. Los recuerdos previos al despliegue quedan consumidos sin pago retroactivo. Los niveles ya superados también quedan consumidos; completar páginas ya existentes sí permite cobrar una vez.

El álbum usa cinco huecos por página, orden de ID ASCII dentro de cada tipo, capacidades reservadas originales y una página nueva para cada rareza. Solo cuentan cartas activas y publicadas, actualmente poseídas. Una página sin cartas publicadas no ofrece premio. Añadir cartas más adelante no resetea los recibos de páginas o rarezas pagadas.

## RPC

- `get_club_coin_missions()` devuelve `{balance, earned_total, missions}`. No modifica la cartera.
- Cada misión incluye `id, category, title, description, coins, current, target, completed, claimed, earned_coins, action`; las periódicas incluyen `ends_at`. `earned_coins` indica lo realmente pagado (cero para los niveles anteriores a la funcionalidad; nulo si no hay recibo). Las de álbum añaden `collection_key, rarity, page?`. La semanal añade `objectives`.
- Categorías: `daily`, `level`, `weekly`, `club`, `memory`, `album`. Acciones: `football`, `robot-vacuum`, `skateboard`, `calendar`, `album`.
- `claim_club_coin_reward(reward_id)` revalida el estado y devuelve `{awarded,coins,balance}`. Repetir un recibo válido devuelve cero.
- `submit_chota_level_score` conserva su contrato y suma `awarded_coins` (nivel y rutina) y `coin_balance`. Los premios se conceden en la misma transacción que la partida. Los intentos de menos de doce segundos no avanzan nivel ni cobran.
- Las fotos premian mediante trigger; la interfaz refresca la cartera tras guardar, sin anunciar una cantidad no confirmada.

Los recibos permanentes viven en `club_rewards.coin_receipts`, con RLS y sin acceso a roles cliente. La clave primaria cuenta/premio y el bloqueo común de cartera impiden dobles pagos concurrentes. Saldo, recibo y asiento `mission_reward` son atómicos. Los RPC públicos verifican sesión, perfil visible y seguridad de cuenta; no hay un RPC de acuñación arbitraria.

Validación: `node --test scripts/coin-missions.test.mjs`. Usa PostgreSQL real mediante PGlite y las implementaciones existentes de partidas, no una imitación de la lógica de premios. Comprueba las seis vías, repetición, aislamiento entre cuentas, privacidad, evidencias de fotos, límites y rollback de una operación parcialmente fallida.

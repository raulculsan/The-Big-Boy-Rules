# El Chota · vida v2

Ocho microacciones nuevas sobre la pose de pie, además de las seis que ya existían. La demo permite verlas ampliadas y a 108 px; en la app los descansos son mucho más largos.

- `ear-flick-left`: pequeño reflejo de la oreja izquierda; la derecha permanece quieta.
- `ear-flick-right`: pequeño reflejo de la oreja derecha; la izquierda permanece quieta.
- `ear-scan`: orienta una oreja, luego la otra; la cabeza acompaña después.
- `tail-sway`: dos balanceos suaves, con amplitud y pausas diferentes.
- `deep-breath`: inspira con el torso, cierra los ojos, suelta el aire y vuelve al apoyo.
- `shake-off`: sacudida breve de cabeza con retraso distinto en cada oreja y recuperación de la cola.
- `soft-blink`: cierra los ojos lentamente y termina con un segundo parpadeo corto.
- `paw-relax`: afloja la mano y el antebrazo izquierdos, mira ligeramente hacia abajo y vuelve al reposo.

Las anteriores son `listen`, `balance`, `check-tail`, `check-shoes`, `sneeze` y `drowsy`. Los sprites existentes de rascarse, recolocar camiseta y estirarse siguen disponibles. No se han dibujado nuevos dedos, pelo, bostezos ni expresiones de boca.

## Editar en Krita

`chota-life-v2.kra` se creó y guardó en Krita a partir de una copia de `lateral-v1/chota-idle-layers.ora`. Conserva el arte original y añade la capa real `paw-relaxed`, separada del `core` en Krita. Orejas y cola siguen siendo capas independientes. Es un rig de capas editable; la temporización de las acciones vive en `app.js`, no en una timeline de fotogramas rasterizados.

`chota-life-v2.ora` es la exportación intermedia de esas mismas capas. `source-core.png` y `source-paw.png` son sus PNG originales extraídos, sin redibujado ni reescalado. Los dos SVG de runtime sólo sitúan esos PNG embebidos en sus coordenadas originales del lienzo 256 × 256. El pivote de la nueva mano es la muñeca, a 40,6 % / 65 %.

## Revisar

Desde la raíz del repo:

```sh
node artwork/chota/life-v2/build-preview.mjs
python3 -m http.server 8767 --bind 127.0.0.1
```

Abrir `http://127.0.0.1:8767/artwork/chota/life-v2/preview.html`. La demo usa los tracks y el rig extraídos del código de producción y simula una hora diurna para revisar. Su controlador está pausado para que el selector de fase pueda mantener un gesto inmóvil. No cambia la hora real de la app. Se detiene con movimiento reducido. La demo recorre los nuevos gestos en unos 36 segundos; los botones permiten revisar cada uno. «Mitad y pausar» y el selector «Fase del gesto» permiten inspeccionar las articulaciones sin depender del tiempo.

## Comportamiento y límites

Las acciones se escogen al azar entre los tres gestos elegibles que más han descansado, con cooldown por gesto y familia, sin repetir el último. Los pies y la proyección sobre el suelo no se animan. Las visitas a muebles requieren al menos 105 segundos de descanso, además de una probabilidad baja y cooldown por destino de 4,5–7 minutos. Se conserva la navegación y perspectiva existentes.

El controlador conserva su cancelación al salir de pantalla, ocultar la app, abrir otra vista o activar movimiento reducido. Las nuevas acciones no añaden timers ni RAF propios. De 00:00 a 06:00 se conserva el sueño existente. No hay sonido nuevo ni cambios de voz.

Código común y copias locales de `www`, iOS y Android actualizados selectivamente. Se sustituyeron únicamente cinco funciones equivalentes al baseline por AST, dos reglas CSS y la nueva regla de mano; se copiaron los dos SVG nuevos. Los cambios ajenos permanecen. Cache local `v581`, sin cambiar la versión de producto 1.1.9. Se actualizaron sólo las claves de `app.js`/`clubhouse.css`, la inclusión de esos dos assets en el SW y dos entradas en cada manifiesto de recursos iOS. No se hizo un build completo, APK, push ni publicación.

## Validación

`node --test scripts/chota-life.test.mjs scripts/chota-room-depth.test.mjs scripts/native-code-hardening.test.mjs scripts/service-worker-media-cache.test.mjs`: 27 pruebas correctas. Incluyen cancelación, sueño, cooldowns, variedad durante 20 minutos simulados, mano real, escala al ampliar y colisiones/apoyos del sofá.

Revisión visual real de la demo: neutral, mano al 50 %, respiración al 50 % con ojos cerrados, oreja al 24 % y sacudida al 38 %. Sin huecos ni cortes visibles; pies anclados. La ventana de revisión queda abierta.

`sync-receipt.json` registra SHA256 antes/después de los 22 archivos del empaquetado selectivo, la comparación de las 15 funciones y la ubicación de backups temporales. `node scripts/sync-chota-life-v2.mjs` vuelve a comprobar equivalencia y debe mostrar `files: []` después de la sincronización. Usa `--apply` sólo cuando se quiera ejecutar esa copia local.

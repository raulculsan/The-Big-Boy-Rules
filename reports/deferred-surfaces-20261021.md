# Carga de secciones y ajuste visual — 21 de octubre de 2026

## Cambios

- `feature-loader.js` carga código de gestión de logros/cuentas, temas de chats y Spotify cuando hace falta. Conserva las opciones de inicialización sin ejecutar esos módulos en el arranque. Las peticiones se comparten, el orden de scripts es explícito, los fallos se pueden reintentar y una navegación posterior cancela la activación visual de una anterior.
- Los estilos de álbum, administración y Spotify se cargan por superficie. Los estilos compartidos de chats, sobres y trofeos permanecen en el shell porque también contienen elementos usados por otras pantallas. El álbum offline espera a su hoja antes de abrir.
- Spotify solo se prepara cuando Inicio está activo, el usuario está autenticado y el reproductor está en el viewport o a 80 px de entrar. Se conserva el estado existente al regresar; los callbacks pendientes comprueban usuario y navegación.
- Cabecera y títulos más compactos; separación entre bloques reducida. La barra móvil ocupa una franja reservada por la aplicación en lugar de cubrir las tarjetas. Se mantienen las zonas seguras y las superficies que gestionan los gestos.
- Paneles y controles con superficies planas, sin sombras de reposo. Se conservan el arte y los efectos de rareza de las cartas.

## Magnitudes estáticas

- Se posponen 62.510 bytes de JavaScript y 51.819 bytes de CSS de módulos existentes (sin compresión).
- El cargador común añade 5.712 bytes de JavaScript. No son tiempos de ejecución ni una medición de velocidad.
- El HTML inicial incluye ahora 27 scripts diferidos y 17 hojas de estilo. El resto de módulos compartidos sigue cargándose de forma tradicional; esta es una separación incremental, no una conversión de framework.
- Los recursos opcionales siguen incluidos en la caché de instalación del service worker y en `www`/los dos paquetes nativos para conservar la disponibilidad offline.

## Comprobación

- Taste lint sobre el cargador y las dos capas visuales modificadas: 0 FAIL; mantiene avisos sobre reglas heredadas y declaraciones de sombras/filtros, incluidas las que los desactivan.
- Sintaxis comprobada en los JavaScript modificados y el service worker. `git diff --check` sin errores.
- `npm run build` completado; preflight de cartas sin errores, con los ocho avisos de proporción ya existentes.
- Recursos copiados a los contenedores iOS y Android con Capacitor.
- No se ejecutó una suite de tests ni una build nativa de Xcode/Gradle.
- La inspección con Chrome headless no pudo arrancar por la restricción del sandbox (`Chrome exited early, code null`). No se afirma una revisión visual final ni una mejora cronometrada en dispositivos reales.

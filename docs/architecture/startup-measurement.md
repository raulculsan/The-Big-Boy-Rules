# Medir el primer inicio después de actualizar (iPhone)

El tiempo de `performance.now()` empieza con la navegación web, no con el proceso
nativo. Por eso las marcas `[BigBoy startup]` no incluyen la creación de los
procesos WebKit que ocurre antes de `document-start`.

El esquema compartido **App Performance** instala una compilación **Debug sin
depurador LLDB**, compatible con el equipo personal actual. Sirve para aislar el
coste del depurador; no equivale a una compilación Release de App Store. El
esquema **App** conserva Debug con LLDB para desarrollar.

La configuración Release actual declara Push Notifications y exige un equipo
Apple compatible. No se deben quitar esos entitlements para esta medición.

1. Seleccionar el iPhone físico y **App Performance** en Xcode, y pulsar Run.
2. Medir desde tocar el icono hasta que Inicio responda. Guardar las marcas
   `[BigBoy native startup]`: launch, host-ready, webview-configuration,
   bridge-ready, document-start, dom-ready-frame y shell-ready.
3. Filtrar Console.app por `BigBoy native startup` (categoría `Startup`); las
   marcas usan unified logging y siguen visibles sin LLDB.
4. Cerrar y abrir desde el icono para comparar el inicio posterior.
5. Repetir con una actualización real. No desinstalar: borraría la sesión y las
   cachés, cambiando el escenario que se está investigando.

`installation-changed=true` detecta que cambió el contenedor del binario (incluye
actualizaciones reinstaladas desde Xcode), aunque CFBundleVersion siga igual.
No se imprime ninguna ruta ni dato de la cuenta.

- Gran hueco entre bridge-ready y document-start: arranque de WebKit/iOS.
- Gran hueco entre document-start y dom-ready-frame: recursos locales y scripts.
- Gran hueco entre dom-ready-frame y shell-ready: restauración/autenticación/UI.
- `dom-ready-frame` es una muestra de doble rAF tras DOMContentLoaded, no una
  medición de first contentful paint. La revisión física sigue siendo necesaria.

No vaciar WKWebsiteDataStore para medir: elimina cachés útiles y puede alterar la
sesión. Las advertencias sandbox de WebKit no demuestran por sí solas un error
de permisos del código de la app.

## Medición del 25 de octubre de 2026

En el mismo iPhone y esquema App Performance (Debug sin LLDB), después de
reinstalar la actualización, `native shell-ready` pasó de **4506 ms a 2070 ms**
(54 % menos). `home-ready`, medido desde navegación JS, pasó de 4636 a 2013 ms.
Son relojes distintos: no se deben sumar ni comparar directamente entre sí.

La ruta de restauración se redujo de tres lecturas Auth + dos RPC de seguridad +
perfil a una lectura Auth + un RPC de seguridad + perfil. El registro Auth sigue
verificándose en servidor; su respuesta reciente aporta también los factores
TOTP. El AAL proviene del RPC autenticado. No se reutiliza una autorización local.

Después del cambio: sesión 1 ms, Auth 1128 ms, seguridad 204 ms y perfil 174 ms.
La prueba demuestra la mejora en esa ejecución, no garantiza tiempos idénticos
en otras redes o durante creación lenta de procesos WebKit por iOS.

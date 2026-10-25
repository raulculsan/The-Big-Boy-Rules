# Auditoría web, iOS y Android · 25 de octubre de 2026

Antigravity (Gemini 4 Argon High) revisó el código de las tres entregas y produjo un informe de partida. Contrasté sus hallazgos con el repositorio, las compilaciones y el proyecto Supabase antes de aplicar cambios. La auditoría estática no equivale a una prueba de uso en dispositivos reales.

## Hallazgos corregidos

| Área | Problema | Corrección y comprobación |
| --- | --- | --- |
| Seguridad | Una cuenta con TOTP activado podía acceder a los datos con una sesión AAL1 mientras la obligación global de MFA siguiera desactivada. | `account_security_satisfied()` exige AAL2 a las cuentas que ya tienen TOTP verificado. Se probó la función con reclamaciones AAL1 y AAL2. |
| Seguridad | El cambio o restablecimiento de contraseña dejaba sesiones antiguas activas y una contraseña provisional no se bloqueaba en la política de datos. | El servidor rota un nonce en los metadatos de Auth, revoca las sesiones anteriores y bloquea el acceso a datos hasta completar el cambio provisional. El RPC de revocación solo admite `service_role`. |
| Android | Copias numeradas de archivos `res/xml` impedían compilar con `aapt2`; otras copias inflaban los recursos empaquetados. El directorio de compilación dentro de Documents también llegó a duplicar archivos DEX. | La limpieza de Capacitor cubre ambas plataformas cuando el hook no indica plataforma. Gradle limpia las copias de `res` antes de fusionar recursos y guarda sus productos generados fuera de Documents, en `~/.gradle/bigboy-generated/`. La compilación web vuelve a limpiar después de optimizar imágenes. |
| Web y nativas | El polling de la sede seguía programándose en segundo plano; la tienda montaba banners animados estando cerrada; el SW se registraba también en contenedores nativos. | Polling detenido al ocultar la app, render de tienda diferido hasta abrirla y SW limitado a web/PWA. Se eliminó una capa de desenfoque costosa durante la apertura de sobres. |
| Cartas | Al reabrir una carta con la imagen completa en memoria se mostraba primero su miniatura. | Se reutiliza inmediatamente el `objectURL` disponible y se evita una lectura innecesaria de IndexedDB. |
| Android | El teclado nativo se registraba solo si se cumplía una condición de iOS; Spotify perdía el estado de conexión cuando no había canción en ese instante. | Registro por plataforma nativa y tratamiento del estado sin canción mediante los dispositivos disponibles. Se admite también la imagen de episodios y una posición de reproducción segura. |
| Recompensas | Reclamar el sobre diario podía restaurar uno que administración ya había retirado ese día. | El RPC consulta `admin_removed_daily_pack_claims` antes de abonar el sobre y su bonificación de racha. |

## Validación

- `npm run build`: correcto; 79 cartas, cero errores y ocho avisos de proporción ya existentes.
- 21 pruebas enfocadas de seguridad, contraseñas, teclado y caché web: correctas en el árbol de desarrollo.
- `npx cap sync android` y `npx cap sync ios`: correctos.
- `:app:mergeDebugResources` y compilación limpia `:app:assembleDebug` con Java 21: correctos incluso tras reaparecer `config 2.xml`; Gradle lo elimina en la tarea previa. La APK debug bajó de 123 MB con copias numeradas a 64 MB sin ellas.
- Supabase: RLS activada en las 67 tablas públicas examinadas. El RPC de revocación no es ejecutable por `authenticated`, y sí por `service_role`; el bloqueo de sobres diarios retirados está activo.
- La compilación iOS por línea de comandos no llegó a compilar código: Xcode beta no pudo iniciar su sandbox interno de Swift Package Manager ni el servicio de CoreSimulator en este entorno. La sincronización de Xcode sí terminó.

## Hallazgos pendientes de validación en dispositivo

- Medir tiempos de arranque, tasa de fotogramas y memoria en iPhone y Android reales; la auditoría estática no permite cuantificar la mejora de fluidez.
- Revisar en sesión real las animaciones de banners y minijuegos antes de sustituir animaciones de `left`/`top` por transformaciones; el cambio geométrico puede alterar su aspecto.
- Verificar los gestos de vuelta interrumpidos por el sistema y los enlaces de planes desde widgets.
- La función de voz `tigreton-voice` figura en el código, pero no está desplegada en el proyecto Supabase revisado. Su error potencial no afecta al servicio actual.

El informe inicial de Antigravity también señaló un bucket `group-media` sin límites y un `news-feed` sin verificación JWT. La configuración activa **sí** tiene tipos MIME y límite de 100 MB en ese bucket, y la función desplegada **sí** exige JWT. No se cambiaron esos controles.

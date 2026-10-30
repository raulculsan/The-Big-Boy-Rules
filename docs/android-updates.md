# Actualizaciones obligatorias de Android

La versión 1.1.0 (compilación 2) incorpora el primer control de versión. Los APK anteriores no pueden recibir esta pantalla: deben instalar esta versión una vez, conservando el mismo paquete y certificado de firma.

El panel de administración incluye **Actualizaciones**. La política publicada en `app_release_policy` indica la compilación disponible, la mínima permitida, el mensaje y un enlace HTTPS de descarga. La versión 2 está permitida desde el primer arranque.

Para una publicación posterior:

1. Incrementar `versionCode` y `versionName` en `android/app/build.gradle`.
2. Compilar con el mismo certificado y probar la actualización sobre una instalación anterior.
3. Publicar el APK como `BigBoy-Android.apk` en una nueva release estable de GitHub. El enlace `releases/latest/download/BigBoy-Android.apk` apuntará a esa release.
4. Actualizar la compilación y versión disponibles desde administración. Subir la compilación mínima solo después de comprobar la descarga publicada.

Si hay un problema con la publicación, se puede bajar de nuevo la compilación mínima. El cliente comprueba la política al abrir y al volver a primer plano, con límite de frecuencia. Conserva la última política válida para mantener el bloqueo si ya sabe que su versión es antigua y se queda sin red. Una conexión fallida sin política conocida no adivina una versión mínima.

La pantalla es un control de compatibilidad del cliente, no sustituye la autorización del servidor. Android pide al usuario confirmar la instalación del APK; la app solo abre su navegador. No solicita permiso para instalar paquetes por sí misma.

La tabla publica únicamente metadatos de versiones y descarga; RLS limita los cambios al superadministrador con su seguridad de cuenta satisfecha. No se guardan claves en el enlace.

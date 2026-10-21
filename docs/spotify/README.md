# Playlist completa en iOS

Big Boy usa Spotify App Remote iOS oficial **5.0.1**, fijado en el proyecto Xcode mediante Swift Package Manager. El sonido lo reproduce la app de Spotify instalada; Big Boy muestra la carátula, título, artista, posición y controles reales. No usa muestras de 30 segundos para esta función.

## Configuración

1. Crear/abrir una aplicación en https://developer.spotify.com/dashboard y elegir el SDK **iOS**.
2. Registrar exactamente el redirect URI `bigboyrules://spotify-callback` y el bundle ID `com.raulculsan.thebigboyrules`.
3. Copiar únicamente su **Client ID** en `config.js`, campo `spotifyClientId`. No añadir el Client Secret al cliente.
4. Autorizar las cuentas de prueba que indique el Dashboard para esa aplicación. Consultar sus límites actuales; no asumir que los límites publicados para Web API son los de App Remote.
5. Ejecutar `npm run ios:sync`, abrir Xcode y hacer Run. Spotify debe estar instalado en el iPhone y tener una sesión iniciada. El usuario pulsa **Vincular Spotify**, autoriza en la sesión segura del sistema y vuelve a Big Boy. La app abre Spotify para activar sus controles.

Con el Client ID vacío, la UI indica que Spotify estará disponible pronto y desactiva la vinculación. No se inventan una sesión ni canciones.

## Cuenta y reproducción

La guía oficial distingue **Spotify Free con reproducción aleatoria** y **Premium con reproducción a demanda**. Los controles anterior/siguiente y el avance de posición se habilitan según `playbackRestrictions` del SDK, no según supuestos sobre la cuenta. El usuario puede iniciar la playlist completa desde Big Boy; las restricciones de su cuenta siguen aplicándose.

La versión web mantiene el embed oficial con un enlace a la playlist completa en Spotify y avisa de que ese embed puede limitarse a muestras. Esta implementación no añade Web Playback SDK ni promete reproducción web completa.

## Sesión y ciclo de vida

Desde v243 se usa **Authorization Code con PKCE (S256)**, no autorización de un access token aislado. Se solicitan `app-remote-control` y `user-read-playback-state`. El `state` de OAuth se verifica y el código se intercambia en el dispositivo sin Client Secret. Access token, refresh token y fecha de expiración se guardan juntos en Keychain (`AfterFirstUnlockThisDeviceOnly`), separados por Client ID y usuario de Big Boy. Ningún token cruza el puente JavaScript ni aparece en logs.

Al reabrir, se restauran las credenciales y se renueva el access token si quedan menos de 90 segundos. Las peticiones concurrentes comparten una sola renovación; si Spotify devuelve otro refresh token, sustituye al anterior en Keychain. Cerrar sesión en Big Boy descarga el controlador pero conserva su Keychain para esa misma cuenta. **Desvincular** elimina las credenciales de esa cuenta. Los callbacks de autorización, renovación y cola de una cuenta anterior se descartan al cambiar usuario o desvincular.

**Migración:** los registros anteriores solo contenían un access token y no pueden generar refresh tokens. Es necesario pulsar Vincular y autorizar una vez con los nuevos permisos. Después no se solicita otra vinculación por cerrar la app ni por expirar el access token. Una revocación explícita en Spotify (`invalid_grant`) sí exige volver a autorizar. Un fallo de red conserva la sesión guardada y se reintenta al volver al primer plano o en las consultas del reproductor.

La conexión App Remote se cierra al salir de primer plano y se recupera automáticamente con reintentos acotados. **Cuenta vinculada** y **Spotify conectado** son estados distintos: si Spotify está cerrado/suspendido puede ser necesario el botón **Abrir Spotify y conectar**, que usa la sesión guardada sin pedir vinculación de nuevo. La app no abre Spotify ni inicia música automáticamente al arrancar. Desvincular no fuerza detener la música.

## Siguientes canciones

El apartado **A continuación** consulta `GET https://api.spotify.com/v1/me/player/queue`, con hasta 20 resultados en el orden real que proporciona Spotify, incluidas carátulas, artista y duración. No se calcula la cola a partir del orden de la playlist. Se vuelve a consultar al recuperar el primer plano, cambiar de canción y cada 15–20 segundos mientras el reproductor está activo. Un 401 fuerza una renovación y solo un reintento; un 429 respeta `Retry-After`. Los estados vacía, sin permiso/acceso y temporalmente no disponible se muestran expresamente. **Revisar permisos** permite autorizar el scope adicional si Spotify responde con un rechazo de acceso. Las restricciones del modo desarrollo/cuenta de Spotify también pueden impedir la consulta; una reautorización no elimina esas restricciones.

La vinculación/cola requieren Spotify en el dispositivo y una cuenta autorizada para la app del Dashboard. No se ha realizado un flujo OAuth con la cuenta real ni reproducción física desde esta sesión; los diagnósticos locales comprueban sintaxis JavaScript y tipos Swift contra el SDK real instalado.

Referencias oficiales:

- https://developer.spotify.com/documentation/ios/getting-started
- https://developer.spotify.com/documentation/ios/concepts/application-lifecycle
- https://spotify.github.io/ios-sdk/html/Protocols/SPTAppRemotePlaybackRestrictions.html
- https://github.com/spotify/ios-sdk/releases/tag/v5.0.1
- https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow
- https://developer.spotify.com/documentation/web-api/tutorials/refreshing-tokens
- https://developer.spotify.com/documentation/web-api/reference/get-queue
- https://developer.spotify.com/blog/2025-02-12-increasing-the-security-requirements-for-integrating-with-spotify (continúa admitiendo redirect de esquema personalizado en móvil)

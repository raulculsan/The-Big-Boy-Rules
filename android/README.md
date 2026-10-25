# Big Boy para Android

Esta aplicación usa los mismos HTML, CSS, JavaScript, catálogo y Supabase que iPhone y web, integrados mediante Capacitor 8. Android 7.0 (API 24) o posterior; orientación vertical en teléfonos.

## Abrir y actualizar

Abre esta carpeta `android` en Android Studio. Usa **JDK 21** para Gradle (Settings → Build, Execution, Deployment → Build Tools → Gradle). La instalación local del Mac ya usa JDK 21 a través de `.gradle/config.properties`. En un checkout nuevo configura `JAVA_HOME` con tu JDK 21 y `ANDROID_HOME` o `android/local.properties` con el SDK de Android Studio. En macOS se usa `sips` para las imágenes; Linux/Windows requieren ImageMagick (`magick`). El repositorio incluye los JPEG publicados y la compilación los valida con los mismos controles de píxeles y medidas que las fuentes PNG; no requiere originales privados.

Desde la raíz del proyecto:

```sh
npm install
npm run android:sync   # genera todos los recursos actuales y sincroniza los plugins
npm run android:open   # sincroniza y abre Android Studio
npm run android:build  # sincroniza y genera APK debug
```

El APK de desarrollo aparece en el enlace **Locate** de Android Studio al terminar la build. Gradle guarda sus archivos generados en `~/.gradle/bigboy-generated/` para evitar las copias numeradas que crea la sincronización de Documents. Desde Terminal puedes localizarlo con `find ~/.gradle/bigboy-generated -name app-debug.apk`. Para distribuir en Google Play, crea una clave de firma de publicación fuera del repositorio y genera un Android App Bundle firmado desde Android Studio.

## Integraciones

- Login, MFA y vinculación con Google usan Supabase y PKCE, con retorno `bigboyrules://auth/callback`. El navegador del sistema conserva el inicio de sesión de Google; la contraseña nunca pasa por código nativo.
- Verificación de solicitudes abre `bigboyrules://account-request/verify` y conserva el enlace al arrancar en frío.
- Fotos, vídeos y GIF usan el selector del sistema y conceden acceso únicamente al archivo elegido. Se copian temporalmente en segundo plano, con límite de 50 MB, y se borran al terminar. Archivos y cámara usan las capacidades del WebView; el micrófono solicita permiso al grabar audio.
- En Spotify Dashboard → app Big Boy → Settings → Redirect URIs debe figurar exactamente `bigboyrules://spotify-callback`, sin barra final. Es el retorno que ya usa iOS; si sigue registrado no hay que añadir otro. No se ha comprobado el panel remoto en esta migración. Si Spotify rechaza la vinculación, confirma primero este registro y que la cuenta esté permitida en el modo de desarrollo. [Referencia oficial sobre coincidencia exacta del retorno](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri).
- Spotify usa el Client ID público ya configurado y el mismo retorno `bigboyrules://spotify-callback`. La vinculación utiliza PKCE; los tokens renovables se cifran con Android Keystore y se separan por usuario. Reproducción y cola usan la API oficial de Spotify, con la música en su app. Los controles requieren Spotify Premium y una sesión de reproducción activa; la app ofrece abrir Spotify y volver.
- Las notificaciones internas funcionan. Push Android requiere un proyecto Firebase y configuración FCM del servidor antes de activarse; no hay credenciales Firebase inventadas ni avisos falsamente activados. APNs de iPhone permanece aplazado como estaba previsto.
- Compartir, calendario, chats, encuestas, álbum, sobres, administración, banners y El Chota usan la implementación compartida.

## Seguridad y recursos

Solo HTTPS; sin copias Android de los datos privados de la aplicación. Ninguna clave secreta del servidor se empaqueta. Los recursos se integran desde `www`; los frentes de cartas se descargan bajo demanda y se almacenan con la misma caché limitada que en iPhone. Los archivos locales `local.properties`, `.gradle`, `.idea`, APK y claves de firma quedan excluidos de Git.

Las comprobaciones de compilación no sustituyen una prueba de OAuth, Spotify, galería, grabación y teclado con una cuenta real en un móvil Android.

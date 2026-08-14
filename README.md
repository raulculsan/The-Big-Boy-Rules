# The Big Boy Rules

Comunidad privada preparada para GitHub Pages con perfiles editables y galería
personal, historias de grupo de 24 horas, bandeja unificada de chats con notas
de voz y adjuntos, presencia en tiempo
real, mensajes privados, calendario administrado por Kike y noticias actuales.

## Activar las funciones compartidas

La interfaz puede abrirse sin backend para revisar el diseño y editar un perfil
de forma local. El chat no muestra mensajes ficticios y permanece desactivado
hasta completar esta configuración:

1. Crea un proyecto gratuito en Supabase.
2. Abre `SQL Editor` y ejecuta todo el contenido de `supabase-setup.sql`.
3. En `Authentication > Users`, crea estas cuentas con la contraseña que
   prefieras. Los correos son internos y no necesitan recibir mensajes:

   - `kike@bigboyrules.local`
   - `lizzy@bigboyrules.local`
   - `raul@bigboyrules.local`
   - `mario@bigboyrules.local`
   - `miguelangel@bigboyrules.local`
   - `almudena@bigboyrules.local`
   - `carlos@bigboyrules.local`
   - `albertovelasco@bigboyrules.local`
   - `caonaboalbero@bigboyrules.local`

4. En `Project Settings > API`, copia la URL del proyecto y la clave pública
   (`publishable` o `anon`) en `config.js`.
5. En `Authentication > URL Configuration`, añade la URL pública de GitHub
   Pages a `Site URL`.

Nunca copies la clave `service_role` en la web.

## Funcionamiento

- Cada sesión se autentica en Supabase y solo puede modificar su propio perfil.
- Las fotos se guardan en el bucket público `avatars` con un límite de 3 MB.
- El usuario puede quitar su avatar y volver a la inicial de su nombre.
- Los adjuntos se guardan en `group-media`; los chats admiten archivos de hasta
  50 MB y las historias y publicaciones originales de hasta 100 MB. Ejecuta
  `supabase-large-uploads.sql` para habilitar también notas de voz, audio y vídeo
  en proyectos ya creados.
- Ejecuta también `supabase-media-interactions.sql` para activar visualizaciones y respuestas.
- Los mensajes y sus adjuntos llegan en tiempo real.
- Los momentos empiezan vacíos y caducan 24 horas después de publicarse.
- Cada perfil muestra una galería pública propia tipo Instagram.
- El grupo aparece como una conversación más junto a los mensajes privados; al
  abrir un chat se oculta la navegación inferior y se conservan las categorías
  internas del grupo. Los mensajes privados solo son visibles para el remitente
  y el destinatario.
- Todos pueden consultar el calendario, pero las políticas de Supabase reservan
  la creación, edición y eliminación de eventos a la administración.
- La cuenta de control total queda fuera de miembros, búsqueda, presencia y
  actividad. Su contraseña existe únicamente en Supabase Auth y nunca debe
  escribirse en el repositorio.
- Cada miembro puede asociar un correo privado de recuperación sin sustituir su
  acceso por `@usuario`. Ejecuta `supabase-account-email.sql`, despliega la Edge
  Function `account-email` y configura estos secretos en `Edge Functions > Secrets`:
  `ACCOUNT_EMAIL_SMTP_USER` (el Gmail del club), `ACCOUNT_EMAIL_SMTP_PASSWORD`
  (una contraseña de aplicación de Google),
  `ACCOUNT_EMAIL_OTP_SECRET` (valor aleatorio de al menos 32 caracteres) y
  `APP_ORIGIN=https://raulculsan.github.io`. La cuenta de Google debe tener
  verificación en dos pasos y la contraseña de aplicación nunca debe incluirse
  en el repositorio. Los códigos duran 10 minutos, admiten cinco intentos y solo
  se guardan como HMAC; los correos no son accesibles desde la API pública. El
  aviso se activa automáticamente cuando los dos secretos SMTP están configurados.
  Por defecto se usa Gmail (`smtp.gmail.com`, puerto 465) y el remitente se
  muestra como `The Big Boy Rules`; host, puerto y remitente pueden personalizarse
  con `ACCOUNT_EMAIL_SMTP_HOST`, `ACCOUNT_EMAIL_SMTP_PORT` y `ACCOUNT_EMAIL_FROM`.
- La función Edge `admin-users` permite crear, eliminar y restablecer contraseñas provisionales de usuarios
  sin exponer la clave `service_role` en el navegador.
- La búsqueda superior encuentra miembros, mensajes, publicaciones, eventos y
  titulares ya cargados.
- Noticias abre por Deportes (principalmente fútbol) y ordena siempre los
  titulares desde el más reciente al más antiguo.
- Los perfiles ajenos incluyen acceso directo a la conversación privada.
- La administración puede vincular o cambiar desde Inicio la playlist pública
  de Spotify del grupo; el resto de miembros ve el reproductor integrado.
- El contador usa presencia por WebSocket; no deduce usuarios a partir de
  mensajes ni muestra miembros desconectados como conectados.
- Noticias obtiene titulares actuales mediante los feeds de Google News y abre
  siempre la fuente original.

Sin las claves de Supabase, las credenciales provisionales de la demo local
siguen siendo usuario en minúsculas y contraseña `bigboy2026`.

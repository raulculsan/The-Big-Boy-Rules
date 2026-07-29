# The Big Boy Rules

Comunidad privada preparada para GitHub Pages con perfiles editables y galería
personal, historias de grupo de 24 horas, chat con adjuntos, presencia en tiempo
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
- Los adjuntos, historias y publicaciones se guardan en `group-media` (15 MB).
- Los mensajes y sus adjuntos llegan en tiempo real.
- Los momentos empiezan vacíos y caducan 24 horas después de publicarse.
- Cada perfil muestra una galería pública propia tipo Instagram.
- Los mensajes privados solo son visibles para el remitente y el destinatario.
- Todos pueden consultar el calendario, pero las políticas de Supabase reservan
  la creación, edición y eliminación de eventos a la cuenta `kike`.
- La búsqueda superior encuentra miembros, mensajes, publicaciones, eventos y
  titulares ya cargados.
- El contador usa presencia por WebSocket; no deduce usuarios a partir de
  mensajes ni muestra miembros desconectados como conectados.
- Noticias obtiene titulares actuales mediante los feeds de Google News y abre
  siempre la fuente original.

Sin las claves de Supabase, las credenciales provisionales de la demo local
siguen siendo usuario en minúsculas y contraseña `bigboy2026`.

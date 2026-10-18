# Solicitudes de cuenta

## Recorrido

En acceso, «Solicitar una cuenta» pide nombre, correo personal, @ y contraseña.
Auth guarda únicamente el hash de la contraseña en una credencial pendiente,
prohibida para iniciar sesión mediante `ban_duration` y sin perfil del club.
El administrador nunca recibe la contraseña. Mientras espera aprobación, Auth
usa una dirección interna temporal; el correo personal solo está en la solicitud
protegida. Al aceptar se vincula ese correo a Auth. El login sigue siendo por @.

El correo contiene un enlace HTTPS de Supabase con token en el fragmento (no se
envía al servidor ni a logs de URLs). La página de enlace abre la app mediante
`bigboyrules://account-request/verify`; el botón permite reintentar si iOS no
la abre automáticamente. La persona pulsa Confirmar dentro de la app. El
servidor comprueba el hash y la caducidad (48 h), consume el
token y avisa en el panel de notificaciones a los administradores. Solicitudes
sin verificar no aparecen para aprobación. Cerrar el formulario borra sus campos.

En Administración > Solicitudes de cuenta se acepta o rechaza. Aceptar crea el
perfil con rol member y activa el acceso; rechazar elimina la credencial pendiente.
Ambas decisiones envían un correo. Un fallo de envío conserva la decisión y muestra
«Reintentar correo». Gmail ofrece entrega al menos una vez: una interrupción justo
tras el envío puede provocar un duplicado al reintentar.

## Despliegue

1. Aplicar `supabase/migrations/20261018220000_account_requests.sql` y `20261018230000_pending_account_profiles.sql`. La segunda añade una barrera por correo temporal al trigger de perfiles y elimina el perfil prematuro de la solicitud de prueba; conserva la credencial bloqueada y la solicitud.
2. Desplegar `account-requests` con `--no-verify-jwt`: las acciones de solicitud,
   verificación y acceso son públicas; las decisiones validan JWT, MFA/política
   vigente y rol de administrador dentro de la función. Las tablas y RPC de
   solicitudes no admiten acceso anon/authenticated; solo service_role.
3. Desplegar la actualización de `admin-users` (el cambio de @ conserva el correo
   real de las cuentas aprobadas; las antiguas mantienen su alias local).
4. Configurar los secretos de correo en Supabase. No escribirlos en Git, chat,
   argumentos de comandos ni salidas de herramientas.
5. Publicar JS/CSS/HTML y sincronizar iOS.

## Correo con Gmail dedicado (sin dominio propio)

- `ACCOUNT_REQUESTS_GMAIL_USER`: `thebigboyrulesapp@gmail.com` (cuenta del club).
- `ACCOUNT_REQUESTS_GMAIL_APP_PASSWORD`: contraseña de aplicación de Google
  creada por su propietario tras activar la verificación en dos pasos. Nunca
  usar la contraseña normal de la cuenta.
- `ACCOUNT_REQUESTS_ADMIN_EMAIL`: `thebigboyrulesapp@gmail.com`, recibe un aviso de nueva solicitud solo tras verificar el correo personal del solicitante.

La Edge Function envía por TLS a `smtp.gmail.com:465` con Nodemailer; no solicita
permisos OAuth sobre los buzones de los miembros. El Gmail de cada solicitante
solo es una dirección de contacto. Es necesario comprobar el transporte desde
Supabase después de configurar los secretos; no se ha validado entrega real.

Alternativa por HTTPS, si el entorno o Google rechazan SMTP:
- `BREVO_API_KEY`
- `BREVO_SENDER_EMAIL` (remitente verificado en Brevo; puede ser el Gmail del club)

Con ambas opciones presentes se usa Gmail. Sin ninguna opción configurada, la
función rechaza nuevas solicitudes y decisiones antes de crear credenciales.
La configuración SMTP de Supabase Auth es independiente de este envío personalizado. Vincular el Gmail a la identidad admin no configura el envío SMTP y no cambia estos requisitos. Si el aviso al Gmail admin falla, la notificación in-app ya está disponible y el panel permite reintentarlo.

## Protección y operación

Las nuevas cuentas no tienen permisos de club hasta aprobación. La contraseña
respeta la política del acceso existente, el admin solo puede elegir aceptar o
rechazar y no puede asignar rol mediante el endpoint. Hay límites atómicos de
intentos por IP, correo y volumen global, tamaño de JSON limitado y respuestas
sin revelar si un usuario/correo ya existe. Se comprueba de nuevo la unicidad al
aprobar. Los campos son texto, nunca HTML. Verificación, solicitudes y decisiones
se envían por POST y sus respuestas llevan Cache-Control: no-store.

Los registros sin verificar caducados se eliminan de forma acotada cuando llega
una nueva solicitud; se borra primero la credencial bloqueada. Las solicitudes
revisadas se conservan como historial administrativo (máximo 100 en la vista).
Definir una política de retención antes de abrir el registro al público.

No activar registro abierto de Supabase Auth. Mantener desactivado el signup
público, ya que el único alta autorizada pasa por la función service_role.
No desbloquear manualmente usuarios `account_request_pending=true`.

## Validación pendiente antes de apertura

Con correo configurado, solicitar una cuenta controlada y verificar: email,
rechazo/login denegado, aceptación/perfil correcto, acceso por @, aviso admin,
roles, conservación del correo al renombrar, y ruta de reintento del correo.
No se han enviado correos reales ni creado cuentas de prueba en este trabajo.

Referencias de compatibilidad: Supabase publica un ejemplo oficial con Nodemailer
(https://github.com/supabase/supabase/blob/master/examples/edge-functions/supabase/functions/send-email-smtp/index.ts).
Sus límites excluyen los puertos 25 y 587, no el 465 utilizado aquí
(https://supabase.com/docs/guides/functions/limits). La entrega real requiere
validación tras cargar el app password.

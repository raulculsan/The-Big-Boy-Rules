# Sobres de bienvenida

El primer acceso de una cuenta nueva concede 20 sobres de bienvenida, además del sobre diario y las recompensas existentes. La concesión se realiza dentro de `claim_daily_card_pack()`; todos los clientes que usen ese RPC reciben el mismo saldo.

Un recibo privado por usuario de Auth conserva la concesión. Reinstalar, cambiar de teléfono, volver a iniciar sesión, abrir o borrar los sobres y recrear el perfil no vuelve a premiarla. La concesión y los 20 sobres pertenecen a la misma transacción y los accesos simultáneos están serializados.

Al activar la funcionalidad se marcan como consumidas, sin dar sobres, las cuentas que ya habían iniciado sesión o tenían actividad previa. Las cuentas creadas pero nunca usadas siguen siendo elegibles. Las cuentas sin acceso aprobado, ocultas o pendientes de cumplir la seguridad de acceso no reciben el premio.

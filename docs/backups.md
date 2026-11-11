# Copias de seguridad

El plan gratuito de Supabase no guarda copias, así que las hace GitHub Actions
(`.github/workflows/backup.yml`):

- **Base de datos:** cada noche a las 03:17 UTC (perfiles, chats, cartas, monedas…).
- **Archivos** (fotos, audios, adjuntos, arte de cartas): cada domingo, o a mano
  marcando «Copiar también los archivos» al lanzar el flujo.
- Todo se cifra con AES-256 antes de subirse, porque el repositorio es público.
- Cada copia se conserva 30 días como artefacto del flujo.

## Secretos del repositorio

| Secreto | Qué es |
| --- | --- |
| `SUPABASE_DB_URL` | Cadena de conexión «Session pooler» de Supabase (Connect → Session pooler), con la contraseña de la base de datos. |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave `service_role` (Project Settings → API Keys). Solo para copiar archivos. |
| `BACKUP_PASSPHRASE` | Contraseña de cifrado. Guardada también en el Llavero del Mac como `bigboy-backup-passphrase`. **Sin ella las copias no se pueden abrir:** guárdala también en tu gestor de contraseñas. |

## Recuperar una copia

```sh
scripts/backup-fetch.sh                  # la más reciente
scripts/backup-fetch.sh copia-2026-11-12 # una concreta
```

Deja en `backup-restore/<copia>/`:

- `bigboy-db-AAAA-MM-DD.dump`: se inspecciona con `pg_restore --list` y se
  restaura (entera o tablas sueltas) con `pg_restore --data-only --table=… -d "$SUPABASE_DB_URL"`.
  Restaurar sobre producción es irreversible: probar antes en un proyecto nuevo.
- `bigboy-files-AAAA-MM-DD.tar.gz`: carpeta por bucket con los archivos originales.

`backup-restore/` está en `.gitignore`; no subir nunca una copia descifrada.

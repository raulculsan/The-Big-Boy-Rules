#!/bin/sh
# Downloads the latest (or a given) backup from GitHub Actions and decrypts it.
#   scripts/backup-fetch.sh                -> latest copy into ./backup-restore/
#   scripts/backup-fetch.sh copia-2026-11-12
# The passphrase is read from the macOS Keychain item "bigboy-backup-passphrase"
# (or from BACKUP_PASSPHRASE if set). See docs/backups.md.
set -eu
repo=raulculsan/The-Big-Boy-Rules
dest=${DEST:-backup-restore}
name=${1:-$(gh api "repos/$repo/actions/artifacts?per_page=50" --jq '[.artifacts[] | select(.name | startswith("copia-")) | select(.expired | not)] | sort_by(.created_at) | last | .name')}
[ -n "$name" ] && [ "$name" != null ] || { echo "No hay copias disponibles." >&2; exit 1; }
pass=${BACKUP_PASSPHRASE:-$(security find-generic-password -a bigboy -s bigboy-backup-passphrase -w)}
mkdir -p "$dest/$name"
gh run download --repo "$repo" --name "$name" --dir "$dest/$name"
for file in "$dest/$name"/*.enc; do
  BACKUP_PASSPHRASE=$pass openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -md sha256 -in "$file" -out "${file%.enc}" -pass env:BACKUP_PASSPHRASE
  rm "$file"
done
echo "Copia descifrada en $dest/$name"
ls -lh "$dest/$name"

#!/usr/bin/env bash
# Compila la web, sincroniza Capacitor y genera el APK de Android en ./dist.
# Uso: docker compose run --rm android [--release]
set -euo pipefail
cd /workspace

if [ ! -f /root/.android/debug.keystore ]; then
  echo "Falta ~/.android/debug.keystore del Mac. Sin ella el APK tendría otra firma" >&2
  echo "y las instalaciones existentes no podrían actualizarse." >&2
  exit 1
fi

npm ci --no-audit --no-fund
if [ "${1:-}" = "--release" ]; then npm run android:release; variant=release; else npm run android:build; variant=debug; fi

apk=$(find "$GRADLE_USER_HOME/bigboy-generated" -path "*/app/outputs/apk/$variant/app-$variant.apk" -newer package.json | head -n1)
[ -n "$apk" ] || { echo "No se encontró el APK generado." >&2; exit 1; }
version=$(sed -n 's/^ *versionName "\(.*\)"/\1/p' android/app/build.gradle)
code=$(sed -n 's/^ *versionCode \([0-9]*\)/\1/p' android/app/build.gradle)
mkdir -p dist
cp "$apk" "dist/BigBoy-Android-$version-$code-$variant.apk"
echo "APK listo: dist/BigBoy-Android-$version-$code-$variant.apk"

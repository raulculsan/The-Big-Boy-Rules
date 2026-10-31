# Entorno Docker (web + Android)

Una sola imagen (`docker/Dockerfile`) con Node 22, JDK 21, Android SDK 36,
ImageMagick y Python/Pillow. Se usa igual en local y en la automatización de
publicaciones, para que el build sea idéntico en cualquier máquina.

iOS no entra en Docker (Xcode solo funciona en macOS): se sigue compilando con
`npm run ios:open`.

## Requisitos

- Docker Desktop (`brew install --cask docker`), abierto al menos una vez.
- `~/.android/debug.keystore` del Mac: es la firma de los APK ya instalados.
  El contenedor la monta en solo lectura; sin ella las instalaciones existentes
  no podrían actualizarse.

## Uso

```sh
docker compose build                        # primera vez (o al cambiar el Dockerfile)
docker compose up web                       # http://localhost:5173
docker compose run --rm android             # APK de prueba en ./dist
docker compose run --rm android --release   # APK de release en ./dist
```

`node_modules` y la caché de Gradle viven en volúmenes de Docker, separados de
los de macOS. Para empezar de cero: `docker compose down -v`.

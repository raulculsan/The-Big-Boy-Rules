# Duelo · Jose Enrique y Miguel

Tres banners independientes en bucle (1440 × 480, 24 fps, sin audio), inspirados en escenas de rivales de anime.

| Banner | Duración | Contenido |
|---|---|---|
| `duelo-mirada-v1` | 8 s | Cara a cara con viento |
| `duelo-golpe-v1` | 5,8 s | Un único golpe: se lanzan y la explosión sale al tocarse los puños |
| `duelo-cruce-v1` | 10,4 s | Caminan hacia el cruce y primeros planos de los ojos |

- Imágenes: ChatGPT, a partir de las cartas comunes. Vídeo: Veo 3.1 Lite en Google Flow (`src/veo-*-original.mp4`).
- Con imágenes 3:1, Veo estira el vídeo en vertical. `destretch.swift` lo corrige antes de codificar con el `ffmpeg` de Krita.
- En el golpe se quita el segundo en que los puños quedan quietos antes de la explosión (2,46–3,34 s del original) y el brazo que amaga y se recoge (1,70–2,17 s).
- `render.swift` fue la versión anterior, sin vídeo generado; se conserva por si hay que rehacer efectos.

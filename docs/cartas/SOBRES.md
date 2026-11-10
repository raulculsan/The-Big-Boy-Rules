# Sobres: reglas vigentes

Aprobado por el usuario el 2026-11-10. Todo el sorteo vive en `open_owned_card_pack` (servidor); el cliente solo muestra el resultado.

## Contenido base
- 6 cartas distintas: 3 miembros, 2 objetos, 1 ubicación. Halloween solo en huecos de miembro.
- Pesos por rareza en `club_economy_configuration.rarity_weights`.

## Suerte (`20261110120000_pack_luck.sql`)
- **Protección contra la mala suerte:** tras 12 sobres seguidos sin legendaria, Full Art, Vice City ni Halloween, el siguiente garantiza una en un hueco al azar.
- **Racha de aperturas:** cada 25 sobres abiertos se gana un sobre **mejorado** (una épica o mejor asegurada y el doble de peso para legendaria o mejor en el resto).

## Funciones de sobre (`20261110150000_pack_features.sql`)
- **Sobres de elección:** los sobres de racha diaria (`source = daily_streak`) muestran 3 cartas en un hueco y el miembro se queda una. La elección puede quedar pendiente; hasta elegirla no se puede abrir otro sobre.
- **Sobres temáticos:** 120 monedas. Temas: Retro, Vice City, Halloween, Full Art, Objetos y Ubicaciones. Un hueco siempre es del tema (en Objetos y Ubicaciones, épica o mejor).
- **Carta objetivo:** una carta que falte, elegida en «La busco». Cada sobre abierto da 1 fragmento. Coste: común 10, especial/retro 15, épica 20, legendaria 30, Full Art/Vice City/Halloween 40. Conseguir la carta por otra vía libera el objetivo y conserva los fragmentos.
- **Acabados:** holográfica 3 %, metalizada 0,8 %, tinta especial 0,2 % por carta. Se guardan por copia en `member_card_finishes`; al perder copias se van primero las normales y la tinta especial es la última en irse. Los intercambios no transfieren el acabado.
- **Compartir:** un sobre propio ya abierto se comparte una vez; el chat muestra la tira de seis cartas (`[[sobre:ID]]`) y cualquiera puede verlo.

## Dibujo
Los sobres mejorado, de elección y temáticos usan el sobre actual con una etiqueta hasta que haya arte propio.

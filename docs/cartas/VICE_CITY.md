# Configuración aprobada para Vice City

Vice City es una rareza independiente; etiqueta visible `Vice City`, clave canónica del servidor y cliente `vice_city`. Sección propia del álbum con 20 huecos iniciales (10 miembros, 5 ubicaciones, 5 objetos), ampliable al catálogo.

## Probabilidad y economía

Peso base **0,5 % por extracción individual**, inferior al 1 % Full Art. Distribución completa: común 68,5 %, retro 12 %, especial 10 %, épica 6 %, legendaria 2 %, Full Art 1 %, Vice City 0,5 %; total 100 %. Pesos enteros 137/24/20/12/4/2/1, total 200.

Cada sobre sigue otorgando 6 cartas distintas: 3 miembros, 2 objetos y 1 ubicación. El sorteo renormaliza los pesos entre las rarezas disponibles de la categoría, excluyendo las agotadas en el mismo sobre. El 0,5 % es el peso base por extracción, no una garantía ni la probabilidad total de un sobre. Si falta catálogo de una categoría, falla sin consumir el sobre. Los premios ya abiertos y las copias existentes se conservan.

Descartar cada copia repetida Vice City da **10 monedas**, conservando una copia. La misma recompensa se usa para el descarte individual y el conjunto. Las RPC siguen siendo la autoridad para inventarios y saldos.

## Arte, reverso y foil

Cada nueva carta debe tener un entorno propio. Mantener la composición y tipografía de la colección, pero no repetir el escenario ni los elementos de fondo de otra carta: variar arquitectura, localización, hora y perspectiva. Cristóbal usa una azotea con piscina y skyline nocturno; Rubén conserva su calle costera al atardecer; Francisco Trigo usa un laboratorio informático interior con servidores y pantallas.

Referencia: `miembros/ruben-king-vice-city-96-v1.png`, miembro 96 PTS, ID `ruben-king-vice-city`, 948 × 1659 px. Arte Vice City ilustrado, palmeras y ciudad al atardecer; bordes rosa/turquesa/naranja y nombre legible.

Todas las cartas Vice City usan el reverso propio unificado `icons/cards/reverso-vice-city-unificado-v1.png`, con monograma BB y estética Vice City. Reutilizarlo para futuras cartas de esta rareza.

Mantener el foil aprobado en `CollectionMotion.attachViceCityFoil` / `attachFullArtFoil(...,'Vice City')`, en visor y revelación: iridiscencia rosa/turquesa/naranja, barrido cromático, trazos diagonales y 18 destellos periféricos. Sin desplazamiento automático de la carta ni capa blanca opaca sobre cara o nombre. Las capas no interceptan gestos. Pausar de espaldas y en segundo plano, limpiar al cerrar/cambiar y respetar reducir movimiento.

## Publicación

Migración repetible: `supabase-vice-city.sql`, con catálogo, constraint de rarezas, pesos, estado, descartes y RPC de apertura conservando seguridad y cuotas. `supabase-card-ruben-vice-city.sql` actualiza la carta con el mismo ID, sin sustituir copias. Los SQL canónicos también deben conservar `vice_city` en posteriores ejecuciones. Copiar recursos a `icons/cards`, precachear, aumentar versiones y sincronizar iOS; el usuario realiza Run.

Estado v235: migración aplicada y verificada en Supabase; Rubén activo como `vice_city`, peso 1/200 (0,50 % base), recompensa 10 y reglas 3/2/1 con IDs únicos conservadas. Bundle web y recursos iOS sincronizados, incluido reverso propio.

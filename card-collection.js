/* Published designs, not a user's inventory. Pack awards stay server-owned. */
(() => {
  const catalog = Object.freeze([
    Object.freeze({
      id: 'daniel-gonzalez-motos-halloween', collection: 'los-nuestros-01',
      kind: 'Miembro', name: 'DANIEL GONZALEZ MOTOS', edition: 'Halloween', rarity: 'halloween', score: 96,
      front: 'icons/cards/daniel-gonzalez-motos-halloween-96-v2.png',
      back: 'icons/cards/reverso-halloween-v1.png',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'juan-manuel-perez-saldana-comun', collection: 'los-nuestros-01',
      kind: 'Personaje', name: 'JUAN MANUEL PEREZ SALDAÑA', edition: 'Común', rarity: 'common', score: 81,
      front: 'icons/cards/juan-manuel-perez-saldana-comun-81-v1.jpg',
      back: 'icons/cards/reverso-comun-unificado-v1.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'fufi-vice-city', collection: 'los-nuestros-01',
      kind: 'Personaje', name: 'FUFI', edition: 'Vice City', rarity: 'vice_city', score: 89,
      front: 'icons/cards/fufi-vice-city-89-v3.jpg',
      back: 'icons/cards/reverso-vice-city-unificado-v1.jpg',
      width: 948, height: 1659
    }),
    Object.freeze({
      id: 'azul-comun', collection: 'los-nuestros-01',
      kind: 'Personaje', name: 'AZUL', edition: 'Común', rarity: 'common', score: 77,
      front: 'icons/cards/azul-comun-77-v1.jpg',
      back: 'icons/cards/reverso-comun-unificado-v1.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'fufi-comun', collection: 'los-nuestros-01',
      kind: 'Personaje', name: 'FUFI', edition: 'Común', rarity: 'common', score: 77,
      front: 'icons/cards/fufi-comun-77-v1.jpg',
      back: 'icons/cards/reverso-comun-unificado-v1.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'miguel-angel-jimenez-sanchez-full-art', collection: 'los-nuestros-01',
      kind: 'Miembro', name: 'MIGUEL ANGEL JIMENEZ SANCHEZ', edition: 'Full Art', rarity: 'full_art', score: 92,
      front: 'icons/cards/miguel-angel-jimenez-sanchez-full-art-92-v1.jpg',
      back: 'icons/cards/reverso-full-art-unificado-v1.jpg',
      width: 948, height: 1659
    }),
    Object.freeze({
      id: 'francisco-trigo-vice-city', collection: 'los-nuestros-01',
      kind: 'Personaje', name: 'FRANCISCO TRIGO', edition: 'Vice City', rarity: 'vice_city', score: 90,
      front: 'icons/cards/francisco-trigo-vice-city-90-v2.jpg',
      back: 'icons/cards/reverso-vice-city-unificado-v1.jpg',
      width: 948, height: 1659
    }),
    Object.freeze({
      id: 'cristobal-fabrik-vice-city', collection: 'los-nuestros-01',
      kind: 'Personaje', name: 'CRISTOBAL FABRIK', edition: 'Vice City', rarity: 'vice_city', score: 91,
      front: 'icons/cards/cristobal-fabrik-vice-city-91-v2.jpg',
      back: 'icons/cards/reverso-vice-city-unificado-v1.jpg',
      width: 948, height: 1659
    }),
    Object.freeze({
      id: 'juan-carlos-vega-quevedo-comun', collection: 'los-nuestros-01',
      kind: 'Personaje', name: 'JUAN CARLOS VEGA QUEVEDO', edition: 'Común', rarity: 'common', score: 78,
      front: 'icons/cards/juan-carlos-vega-quevedo-comun-78-v1.jpg',
      back: 'icons/cards/reverso-comun-unificado-v1.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'cristobal-fabrik-comun', collection: 'los-nuestros-01',
      kind: 'Personaje', name: 'CRISTOBAL FABRIK', edition: 'Común', rarity: 'common', score: 75,
      front: 'icons/cards/cristobal-fabrik-comun-75-v1.jpg',
      back: 'icons/cards/reverso-comun-unificado-v1.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'raul-culsan-gonzalez-full-art', collection: 'los-nuestros-01',
      name: 'RAUL CULSAN GONZALEZ', edition: 'Full Art', score: 92,
      front: 'icons/cards/raul-culsan-gonzalez-full-art-92-playa-v5.jpg',
      back: 'icons/cards/reverso-full-art-unificado-v1.jpg',
      width: 985, height: 1597
    }),
    Object.freeze({
      id: 'ruben-king-vice-city', collection: 'los-nuestros-01',
      name: 'RUBEN KING', edition: 'Vice City', rarity: 'vice_city', score: 96,
      front: 'icons/cards/ruben-king-vice-city-96-v2.jpg',
      back: 'icons/cards/reverso-vice-city-unificado-v1.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'peru-comun', collection: 'los-nuestros-01', folder: 'ubicaciones',
      kind: 'Ubicación', name: 'PERÚ', edition: 'Común',
      front: 'icons/cards/peru-comun-v1.jpg',
      back: 'icons/cards/reverso-comun-unificado-v1.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'hospital-12-de-octubre-comun', collection: 'los-nuestros-01', folder: 'ubicaciones',
      kind: 'Ubicación', name: 'HOSPITAL 12 DE OCTUBRE', edition: 'Común',
      front: 'icons/cards/hospital-12-de-octubre-comun-v1.jpg',
      back: 'icons/cards/reverso-comun-unificado-v1.jpg',
      width: 986, height: 1596
    }),
    Object.freeze({
      id: 'caonabo-alberto-full-art', collection: 'los-nuestros-01',
      name: 'CAONABO ALBERTO', edition: 'Full Art', score: 88,
      front: 'icons/cards/caonabo-alberto-full-art-88-v1.jpg',
      back: 'icons/cards/reverso-full-art-unificado-v1.jpg',
      width: 985, height: 1597
    }),
    Object.freeze({
      id: 'felipe-hp-full-art', collection: 'los-nuestros-01',
      name: 'FELIPE HP', edition: 'Full Art', score: 87,
      front: 'icons/cards/felipe-hp-full-art-87-v4.jpg',
      back: 'icons/cards/reverso-full-art-unificado-v1.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'carlos-gonzalez-motos-full-art', collection: 'los-nuestros-01',
      name: 'CARLOS GONZALEZ MOTOS', edition: 'Full Art', score: 89,
      front: 'icons/cards/carlos-gonzalez-motos-full-art-89-v3.jpg',
      back: 'icons/cards/reverso-full-art-unificado-v1.jpg',
      width: 985, height: 1596
    }),
    Object.freeze({
      id: 'almudena-de-diego-matilla-full-art', collection: 'los-nuestros-01',
      name: 'ALMUDENA DE DIEGO MATILLA', edition: 'Full Art', score: 91,
      front: 'icons/cards/almudena-de-diego-matilla-full-art-91-v4.jpg',
      back: 'icons/cards/reverso-full-art-unificado-v1.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'mario-salvatierra-medina-full-art', collection: 'los-nuestros-01',
      name: 'MARIO SALVATIERRA MEDINA', edition: 'Full Art', score: 88,
      front: 'icons/cards/mario-salvatierra-medina-full-art-88-v2.jpg',
      back: 'icons/cards/reverso-full-art-unificado-v1.jpg',
      width: 985, height: 1597
    }),
    Object.freeze({
      id: 'daniel-gonzalez-motos-full-art', collection: 'los-nuestros-01',
      name: 'DANIEL GONZALEZ MOTOS', edition: 'Full Art', score: 87,
      front: 'icons/cards/daniel-gonzalez-motos-full-art-87-v1.jpg',
      back: 'icons/cards/reverso-full-art-unificado-v1.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'alberto-velasco-full-art', collection: 'los-nuestros-01',
      name: 'ALBERTO VELASCO', edition: 'Full Art', score: 84,
      front: 'icons/cards/alberto-velasco-full-art-84-v2.jpg',
      back: 'icons/cards/reverso-full-art-unificado-v1.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'jose-enrique-fernandez-cruz-full-art', collection: 'los-nuestros-01',
      name: 'JOSÉ ENRIQUE FERNÁNDEZ CRUZ', edition: 'Full Art', score: 93,
      front: 'icons/cards/jose-enrique-fernandez-cruz-full-art-93-v3.jpg',
      back: 'icons/cards/reverso-full-art-unificado-v1.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'jose-enrique-fernandez-cruz-normal', collection: 'los-nuestros-01',
      name: 'JOSE ENRIQUE FERNANDEZ CRUZ', edition: 'Común', score: 86,
      front: 'icons/cards/jose-enrique-fernandez-cruz-comun-86-v4.jpg',
      back: 'icons/cards/reverso-comun-unificado-v1.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'miguel-angel-jimenez-sanchez-normal', collection: 'los-nuestros-01',
      name: 'MIGUEL ANGEL JIMENEZ SANCHEZ', edition: 'Común', score: 83,
      front: 'icons/cards/miguel-angel-jimenez-sanchez-comun-83-v4.jpg',
      back: 'icons/cards/reverso-comun-unificado-v1.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'lizzy-machado-yong-full-art', collection: 'los-nuestros-01',
      name: 'LIZZY MACHADO YONG', edition: 'Full Art', score: 85,
      front: 'icons/cards/lizzy-machado-yong-full-art-85-v1.jpg',
      back: 'icons/cards/reverso-full-art-unificado-v1.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'lizzy-machado-yong-comun', collection: 'los-nuestros-01',
      name: 'LIZZY MACHADO YONG', edition: 'Común', score: 81,
      front: 'icons/cards/lizzy-machado-yong-comun-81-v1.jpg',
      back: 'icons/cards/reverso-comun-unificado-v1.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'raul-culsan-gonzalez-normal', collection: 'los-nuestros-01',
      name: 'RAUL CULSAN GONZALEZ', edition: 'Común', score: 83,
      front: 'icons/cards/raul-culsan-gonzalez-comun-83-v4.jpg',
      back: 'icons/cards/reverso-comun-unificado-v1.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'mario-salvatierra-medina-comun', collection: 'los-nuestros-01',
      name: 'MARIO SALVATIERRA MEDINA', edition: 'Común', score: 81,
      front: 'icons/cards/mario-salvatierra-medina-comun-81-v1.jpg',
      back: 'icons/cards/reverso-comun-unificado-v1.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'almudena-de-diego-matilla-comun', collection: 'los-nuestros-01',
      name: 'ALMUDENA DE DIEGO MATILLA', edition: 'Común', score: 84,
      front: 'icons/cards/almudena-de-diego-matilla-comun-84-v1.jpg',
      back: 'icons/cards/reverso-comun-unificado-v1.jpg',
      width: 949, height: 1658
    }),
    Object.freeze({
      id: 'caonabo-alberto-normal', collection: 'los-nuestros-01',
      name: 'CAONABO ALBERTO', edition: 'Común', score: 82,
      front: 'icons/cards/caonabo-alberto-comun-82-v4.jpg',
      back: 'icons/cards/reverso-comun-unificado-v1.jpg',
      width: 949, height: 1658
    }),
    Object.freeze({
      id: 'alberto-velasco-normal', collection: 'los-nuestros-01',
      name: 'ALBERTO VELASCO', edition: 'Común', score: 79,
      front: 'icons/cards/alberto-velasco-comun-79-v4.jpg',
      back: 'icons/cards/reverso-comun-unificado-v1.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'carlos-gonzalez-motos-normal', collection: 'los-nuestros-01',
      name: 'CARLOS GONZALEZ MOTOS', edition: 'Común', score: 82,
      front: 'icons/cards/carlos-gonzalez-motos-comun-82-v4.jpg',
      back: 'icons/cards/reverso-comun-unificado-v1.jpg',
      width: 949, height: 1658
    }),
    Object.freeze({
      id: 'felipe-hp-normal', collection: 'los-nuestros-01',
      name: 'FELIPE HP', edition: 'Común', score: 80,
      front: 'icons/cards/felipe-hp-comun-80-v4.jpg',
      back: 'icons/cards/reverso-comun-unificado-v1.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'daniel-gonzalez-motos-normal', collection: 'los-nuestros-01',
      name: 'DANIEL GONZALEZ MOTOS', edition: 'Común', score: 80,
      front: 'icons/cards/daniel-gonzalez-motos-comun-80-v4.jpg',
      back: 'icons/cards/reverso-comun-unificado-v1.jpg',
      width: 949, height: 1658
    }),
    Object.freeze({
      id: 'juan-manuel-perez-saldana-retro', collection: 'los-nuestros-01',
      name: 'JUAN MANUEL PEREZ SALDAÑA', edition: 'Retro', score: 90,
      front: 'icons/cards/juan-manuel-perez-saldana-retro-90-v1.jpg',
      back: 'icons/cards/reverso-retro-unificado-v1.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'juan-carlos-vega-quevedo-retro', collection: 'los-nuestros-01',
      name: 'JUAN CARLOS VEGA QUEVEDO', edition: 'Retro', score: 87,
      front: 'icons/cards/juan-carlos-vega-quevedo-retro-87-v1.jpg',
      back: 'icons/cards/reverso-retro-unificado-v1.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'carlos-sanchez-rodriguez-retro', collection: 'los-nuestros-01',
      name: 'CARLOS SÁNCHEZ RODRÍGUEZ', edition: 'Retro', score: 88,
      front: 'icons/cards/carlos-sanchez-rodriguez-retro-88-v2.jpg',
      back: 'icons/cards/reverso-retro-unificado-v1.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'luca-de-tena-especial', collection: 'los-nuestros-01', folder: 'ubicaciones',
      kind: 'Ubicación', name: 'LUCA DE TENA', edition: 'Especial',
      front: 'icons/cards/luca-de-tena-especial-v2.jpg',
      back: 'icons/cards/reverso-especial-unificado-v2.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'el-retiro-especial', collection: 'los-nuestros-01', folder: 'ubicaciones',
      kind: 'Ubicación', name: 'EL RETIRO', edition: 'Especial',
      front: 'icons/cards/el-retiro-especial-v1.jpg',
      back: 'icons/cards/reverso-especial-unificado-v2.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'bajos-de-arguelles-especial', collection: 'los-nuestros-01', folder: 'ubicaciones',
      kind: 'Ubicación', name: 'BAJOS DE ARGÜELLES', edition: 'Especial',
      front: 'icons/cards/bajos-de-arguelles-especial-v1.jpg',
      back: 'icons/cards/reverso-especial-unificado-v2.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'ikea-la-gavia-especial', collection: 'los-nuestros-01', folder: 'ubicaciones',
      kind: 'Ubicación', name: 'IKEA LA GAVIA', edition: 'Especial',
      front: 'icons/cards/ikea-la-gavia-especial-v1.jpg',
      back: 'icons/cards/reverso-especial-unificado-v2.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'pistola-de-balines-especial', collection: 'los-nuestros-01', folder: 'objetos',
      kind: 'Objeto', name: 'PISTOLA DE BALINES', edition: 'Especial',
      front: 'icons/cards/pistola-de-balines-especial-v1.jpg',
      back: 'icons/cards/reverso-especial-unificado-v2.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'mochila-carhartt-especial', collection: 'los-nuestros-01', folder: 'objetos',
      kind: 'Objeto', name: 'MOCHILA CARHARTT', edition: 'Especial',
      front: 'icons/cards/mochila-carhartt-especial-v1.jpg',
      back: 'icons/cards/reverso-especial-unificado-v2.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'borox-legendaria', collection: 'los-nuestros-01', folder: 'ubicaciones',
      kind: 'Ubicación', name: 'BOROX', edition: 'Legendaria',
      front: 'icons/cards/borox-legendaria-v5.jpg',
      back: 'icons/cards/reverso-legendario-unificado-v1.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'abelias-comun', collection: 'los-nuestros-01', folder: 'ubicaciones',
      kind: 'Ubicación', name: 'ABELIAS', edition: 'Común',
      front: 'icons/cards/abelias-comun-v1.jpg',
      back: 'icons/cards/reverso-comun-unificado-v1.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'abrantes-metro-comun', collection: 'los-nuestros-01', folder: 'ubicaciones',
      kind: 'Ubicación', name: 'ABRANTES', edition: 'Común',
      front: 'icons/cards/abrantes-metro-comun-v1.jpg',
      back: 'icons/cards/reverso-comun-unificado-v1.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'plaza-eliptica-metro-comun', collection: 'los-nuestros-01', folder: 'ubicaciones',
      kind: 'Ubicación', name: 'PLAZA ELÍPTICA', edition: 'Común',
      front: 'icons/cards/plaza-eliptica-metro-comun-v1.jpg',
      back: 'icons/cards/reverso-comun-unificado-v1.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'fabrik-comun', collection: 'los-nuestros-01', folder: 'ubicaciones',
      kind: 'Ubicación', name: 'FABRIK', edition: 'Común',
      front: 'icons/cards/fabrik-comun-v1.jpg',
      back: 'icons/cards/reverso-comun-unificado-v1.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'castellana-legendaria', collection: 'los-nuestros-01', folder: 'ubicaciones',
      kind: 'Ubicación', name: 'CASTELLANA', edition: 'Legendaria',
      front: 'icons/cards/castellana-legendaria-v2.jpg',
      back: 'icons/cards/reverso-legendario-unificado-v1.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'carabanchel-legendaria', collection: 'los-nuestros-01', folder: 'ubicaciones',
      kind: 'Ubicación', name: 'CARABANCHEL', edition: 'Legendaria',
      front: 'icons/cards/carabanchel-legendaria-v1.jpg',
      back: 'icons/cards/reverso-legendario-unificado-v1.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'galicia-legendaria', collection: 'los-nuestros-01', folder: 'ubicaciones',
      kind: 'Ubicación', name: 'GALICIA', edition: 'Legendaria',
      front: 'icons/cards/galicia-legendaria-v1.jpg',
      back: 'icons/cards/reverso-legendario-unificado-v1.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'josefa-valcarcel-epica', collection: 'los-nuestros-01', folder: 'ubicaciones',
      kind: 'Ubicación', name: 'JOSEFA VALCARCEL', edition: 'Épica',
      front: 'icons/cards/josefa-valcarcel-epica-v1.jpg',
      back: 'icons/cards/reverso-especial-unificado-v1.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'stussy-madrid-epica', collection: 'los-nuestros-01', folder: 'ubicaciones',
      kind: 'Ubicación', name: 'STÜSSY MADRID', edition: 'Épica',
      front: 'icons/cards/stussy-madrid-epica-v2.jpg',
      back: 'icons/cards/reverso-especial-unificado-v1.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'cuba-epica', collection: 'los-nuestros-01', folder: 'ubicaciones',
      kind: 'Ubicación', name: 'CUBA', edition: 'Épica',
      front: 'icons/cards/cuba-epica-v1.jpg',
      back: 'icons/cards/reverso-especial-unificado-v1.jpg',
      width: 985, height: 1596
    }),
    Object.freeze({
      id: 'mesena-retro', collection: 'los-nuestros-01', folder: 'ubicaciones',
      kind: 'Ubicación', name: 'MESENA', edition: 'Retro',
      front: 'icons/cards/mesena-retro-v1.jpg',
      back: 'icons/cards/reverso-retro-unificado-v1.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'estadio-vicente-calderon-retro', collection: 'los-nuestros-01', folder: 'ubicaciones',
      kind: 'Ubicación', name: 'VICENTE CALDERÓN', edition: 'Retro',
      front: 'icons/cards/estadio-vicente-calderon-retro-v1.jpg',
      back: 'icons/cards/reverso-retro-unificado-v1.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'estadio-santiago-bernabeu-retro', collection: 'los-nuestros-01', folder: 'ubicaciones',
      kind: 'Ubicación', name: 'SANTIAGO BERNABÉU', edition: 'Retro',
      front: 'icons/cards/estadio-santiago-bernabeu-retro-v1.jpg',
      back: 'icons/cards/reverso-retro-unificado-v1.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'jeringuilla-comun', collection: 'los-nuestros-01', folder: 'objetos',
      kind: 'Objeto', name: 'JERINGUILLA', edition: 'Común',
      front: 'icons/cards/jeringuilla-comun-v1.jpg',
      back: 'icons/cards/reverso-comun-unificado-v1.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'justificante-medico-comun', collection: 'los-nuestros-01', folder: 'objetos',
      kind: 'Objeto', name: 'JUSTIFICANTE MÉDICO', edition: 'Común',
      front: 'icons/cards/justificante-medico-comun-v1.jpg',
      back: 'icons/cards/reverso-comun-unificado-v1.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'titulacion-comun', collection: 'los-nuestros-01', folder: 'objetos',
      kind: 'Objeto', name: 'TITULACIÓN', edition: 'Común',
      front: 'icons/cards/titulacion-comun-v2.jpg',
      back: 'icons/cards/reverso-comun-unificado-v1.jpg',
      width: 985, height: 1597
    }),
    Object.freeze({
      id: 'contrato-de-trabajo-comun', collection: 'los-nuestros-01', folder: 'objetos',
      kind: 'Objeto', name: 'CONTRATO DE TRABAJO', edition: 'Común',
      front: 'icons/cards/contrato-de-trabajo-comun-v1.jpg',
      back: 'icons/cards/reverso-comun-unificado-v1.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'lata-de-red-bull-comun', collection: 'los-nuestros-01', folder: 'objetos',
      kind: 'Objeto', name: 'LATA DE RED BULL', edition: 'Común',
      front: 'icons/cards/lata-de-red-bull-comun-v1.jpg',
      back: 'icons/cards/reverso-comun-unificado-v1.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'cafe-del-santander-comun', collection: 'los-nuestros-01', folder: 'objetos',
      kind: 'Objeto', name: 'CAFÉ DEL SANTANDER', edition: 'Común',
      front: 'icons/cards/cafe-del-santander-comun-v1.jpg',
      back: 'icons/cards/reverso-comun-unificado-v1.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'test-de-embarazo-positivo-comun', collection: 'los-nuestros-01', folder: 'objetos',
      kind: 'Objeto', name: 'TEST DE EMBARAZO POSITIVO', edition: 'Común',
      front: 'icons/cards/test-de-embarazo-positivo-comun-v1.jpg',
      back: 'icons/cards/reverso-comun-unificado-v1.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'vater-comun', collection: 'los-nuestros-01', folder: 'objetos',
      kind: 'Objeto', name: 'VÁTER', edition: 'Común',
      front: 'icons/cards/vater-comun-v1.jpg',
      back: 'icons/cards/reverso-comun-unificado-v1.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'satisfyer-comun', collection: 'los-nuestros-01', folder: 'objetos',
      kind: 'Objeto', name: 'SATISFYER', edition: 'Común',
      front: 'icons/cards/satisfyer-comun-v1.jpg',
      back: 'icons/cards/reverso-comun-unificado-v1.jpg',
      width: 986, height: 1596
    }),
    Object.freeze({
      id: 'la-biblia-epica', collection: 'los-nuestros-01', folder: 'objetos',
      kind: 'Objeto', name: 'LA BIBLIA', edition: 'Épica',
      front: 'icons/cards/la-biblia-epica-v1.jpg',
      back: 'icons/cards/reverso-especial-unificado-v1.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'gafas-vision-nocturna-epicas', collection: 'los-nuestros-01', folder: 'objetos',
      kind: 'Objeto', name: 'GAFAS DE VISIÓN NOCTURNA', edition: 'Épica',
      front: 'icons/cards/gafas-vision-nocturna-epicas-v1.jpg',
      back: 'icons/cards/reverso-especial-unificado-v1.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'sombrero-militar-epico', collection: 'los-nuestros-01', folder: 'objetos',
      kind: 'Objeto', name: 'SOMBRERO MILITAR', edition: 'Épica',
      front: 'icons/cards/sombrero-militar-epico-v1.jpg',
      back: 'icons/cards/reverso-especial-unificado-v1.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'bote-de-nutella-epico', collection: 'los-nuestros-01', folder: 'objetos',
      kind: 'Objeto', name: 'BOTE DE NUTELLA', edition: 'Épica',
      front: 'icons/cards/bote-de-nutella-epico-v1.jpg',
      back: 'icons/cards/reverso-especial-unificado-v1.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'ceviche-epico', collection: 'los-nuestros-01', folder: 'objetos',
      kind: 'Objeto', name: 'CEVICHE', edition: 'Épica',
      front: 'icons/cards/ceviche-epico-v1.jpg',
      back: 'icons/cards/reverso-especial-unificado-v1.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'cruz-anticristo-legendaria', collection: 'los-nuestros-01', folder: 'objetos',
      kind: 'Objeto', name: 'CRUZ ANTICRISTO', edition: 'Legendaria',
      front: 'icons/cards/cruz-anticristo-legendaria-v1.jpg',
      back: 'icons/cards/reverso-legendario-unificado-v1.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'locker-luca-de-tena-legendario', collection: 'los-nuestros-01', folder: 'objetos',
      kind: 'Objeto', name: 'LOCKER DE LUCA DE TENA', edition: 'Legendaria',
      front: 'icons/cards/locker-luca-de-tena-legendario-v1.jpg',
      back: 'icons/cards/reverso-legendario-unificado-v1.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'big-mac-legendario', collection: 'los-nuestros-01', folder: 'objetos',
      kind: 'Objeto', name: 'BIG MAC', edition: 'Legendaria',
      front: 'icons/cards/big-mac-legendario-v1.jpg',
      back: 'icons/cards/reverso-legendario-unificado-v1.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'cubo-de-alitas-kfc-legendario', collection: 'los-nuestros-01', folder: 'objetos',
      kind: 'Objeto', name: 'CUBO DE ALITAS DEL KFC', edition: 'Legendaria',
      front: 'icons/cards/cubo-de-alitas-kfc-legendario-v1.jpg',
      back: 'icons/cards/reverso-legendario-unificado-v1.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'trofeo-champions-legendario', collection: 'los-nuestros-01', folder: 'objetos',
      kind: 'Objeto', name: 'TROFEO CHAMPIONS', edition: 'Legendaria',
      front: 'icons/cards/trofeo-champions-legendario-v1.jpg',
      back: 'icons/cards/reverso-legendario-unificado-v1.jpg',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'ticket-de-viaje-a-roma-legendario', collection: 'los-nuestros-01', folder: 'objetos',
      kind: 'Objeto', name: 'TICKET DE VIAJE A ROMA', edition: 'Legendaria',
      front: 'icons/cards/ticket-de-viaje-a-roma-legendario-v1.jpg',
      back: 'icons/cards/reverso-legendario-unificado-v1.jpg',
      width: 948, height: 1660
    })
  ].map(card => Object.freeze({...card,
    front: globalThis.CardMedia?.source(card.front) || card.front
  })));
  const dialog = document.getElementById('collectionCardDialog');
  const grid = document.getElementById('collectionCardGrid');
  if (!dialog || !grid) return;
  const front = document.getElementById('collectionCardFront');
  const back = document.getElementById('collectionCardBack');
  const flip = document.getElementById('collectionCardFlip');
  const stage = document.getElementById('collectionCardStage');
  const status = document.getElementById('collectionCardStatus');
  const error = document.getElementById('collectionCardError');
  let trigger, active, reversed = false, detachMotion, catalogScroll;

  // Pack/achievement kind stays "member" server-side for both people and
  // characters. This display map only distinguishes group members from
  // fictional/guest characters in the collection UI.
  const characterCardIds = new Set([
    'ruben-king-vice-city', 'felipe-hp-full-art', 'felipe-hp-normal',
    'daniel-gonzalez-motos-full-art', 'daniel-gonzalez-motos-normal',
    'jose-enrique-fernandez-cruz-normal', 'juan-manuel-perez-saldana-retro',
    'juan-carlos-vega-quevedo-retro', 'carlos-sanchez-rodriguez-retro'
  ]);
  const kindOf = card => card?.kind || (characterCardIds.has(card?.id) ? 'Personaje' : 'Miembro');
  const editionLabel = card => card?.kind === 'Objeto'
    ? ({Legendaria: 'Legendario', 'Épica': 'Épico'}[card.edition] || card.edition || 'Especial')
    : card?.edition || 'Especial';
  const frontLabel = card => card?.score == null
    ? `${kindOf(card)} · ${editionLabel(card)}`
    : `${kindOf(card)} · ${card?.edition || 'Común'} · ${card.score} puntos`;
  const accessibleDescription = card => card?.score == null
    ? `${card.name}, ${kindOf(card).toLowerCase()} ${editionLabel(card).toLowerCase()}`
    : `${card.name}, ${kindOf(card).toLowerCase()}, edición ${card.edition}, ${card.score} puntos`;
  const backDescription = card => card?.score == null
    ? `Reverso de ${kindOf(card).toLowerCase()} ${editionLabel(card).toLowerCase()}, de Los nuestros, con el monograma BB`
    : card.edition === 'Full Art'
      ? 'Reverso holográfico de plata, cian y violeta de Los nuestros, edición Full Art, con el monograma BB'
      : card.edition === 'Vice City'
      ? 'Reverso unificado de Los nuestros, edición Vice City, con el monograma BB'
      : card.edition === 'Retro'
      ? 'Reverso de cobre y carmesí envejecidos de Los nuestros, edición Retro, con el monograma BB'
      : 'Reverso negro y bronce de Los nuestros, con el monograma BB';

  function setFace(value) {
    reversed = value;
    stage.classList.toggle('is-reversed', value);
    front.setAttribute('aria-hidden', String(value));
    back.setAttribute('aria-hidden', String(!value));
    flip.setAttribute('aria-pressed', String(value));
    flip.textContent = value ? 'Ver delantera' : 'Ver reverso';
    status.textContent = value
      ? (active?.score == null ? `Reverso · ${kindOf(active)} ${editionLabel(active).toLowerCase()}` : 'Reverso · Los nuestros')
      : frontLabel(active);
  }
  function open(card, button) {
    detachMotion?.();
    active = card; trigger = button;
    const catalogPage = document.getElementById('catalogo');
    catalogScroll = catalogPage?.classList.contains('active') ? {
      page: catalogPage, pageTop: catalogPage.scrollTop,
      app: document.querySelector('.app'), appTop: document.querySelector('.app')?.scrollTop || 0,
      windowTop: window.scrollY
    } : null;
    document.getElementById('collectionCardTitle').textContent = card.name;
    error.hidden = true;
    front.alt = accessibleDescription(card);
    back.alt = backDescription(card);
    front.src = card.front; back.src = card.back;
    setFace(false);
    if (!dialog.open) dialog.showModal();
    document.body.classList.add('collection-card-open');
    document.getElementById('collectionCardClose').focus({preventScroll:true});
    document.dispatchEvent(new CustomEvent('bb:card-explored', {detail:{cardId:card.id}}));
    detachMotion=globalThis.CollectionMotion?.attachCard(document.getElementById('collectionCardTilt'),document.getElementById('collectionCardFoil'),()=>setFace(!reversed),card.edition);
  }
  function close() {if (dialog.open) dialog.close();globalThis.CollectionMotion?.close();}
  dialog.addEventListener('close', () => {
    detachMotion?.();detachMotion=null;
    document.body.classList.remove('collection-card-open');
    if (trigger?.isConnected) trigger.focus({preventScroll:true});
    if (catalogScroll?.page.classList.contains('active')) {
      catalogScroll.page.scrollTo({top:catalogScroll.pageTop, behavior:'instant'});
      catalogScroll.app?.scrollTo({top:catalogScroll.appTop, behavior:'instant'});
      window.scrollTo({top:catalogScroll.windowTop, behavior:'instant'});
    }
    catalogScroll = null;
    trigger = null;
  });
  document.getElementById('collectionCardClose').addEventListener('click', close);
  dialog.addEventListener('click', event => {if (event.target === dialog) close();});
  flip.addEventListener('click', () => setFace(!reversed));
  for (const img of [front, back]) img.addEventListener('error', () => {error.hidden = false;});
  document.getElementById('collectionCardRetry').addEventListener('click', () => {
    if (!active) return;
    error.hidden = true;
    for (const [img, url] of [[front, active.front], [back, active.back]]) {
      img.removeAttribute('src'); img.src = url;
    }
  });
  window.addEventListener('hashchange', close);
  const rarityOrder = ['Halloween', 'Vice City', 'Full Art', 'Legendaria', 'Épica', 'Especial', 'Retro', 'Común'];
  const rarityRank = card => {
    const index = rarityOrder.indexOf(card.edition);
    return index < 0 ? rarityOrder.length : index;
  };
  const catalogOrder = [...catalog].sort((a, b) =>
    rarityRank(a) - rarityRank(b)
    || Number(b.score != null) - Number(a.score != null)
    || (a.score != null && b.score != null ? b.score - a.score : 0)
    || a.name.localeCompare(b.name, 'es')
    || a.id.localeCompare(b.id)
  );
  // One delegated fallback also covers album and duplicate thumbnails created later.
  document.addEventListener('error', event => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement) || !image.dataset.cardOriginal) return;
    const original = image.dataset.cardOriginal;
    delete image.dataset.cardOriginal;
    if (image.getAttribute('src') !== original) image.src = original;
  }, true);
  // Thumbnail lookup falls back safely for a not-yet-generated future design.
  const thumbnail = card => globalThis.CardThumbnails?.[globalThis.CardMedia?.canonical(card?.front) || card?.front] || card?.front || '';
  let catalogRendered = false;
  function renderCatalog() {
  if (catalogRendered) return;
  catalogRendered = true;
  const fragment = document.createDocumentFragment();
  for (const card of catalogOrder) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'collection-card-tile';
    button.setAttribute('aria-label', `Ver carta de ${accessibleDescription(card)}`);
    button.setAttribute('aria-haspopup', 'dialog');
    const img = document.createElement('img');
    img.dataset.cardOriginal = card.front;
    img.src = thumbnail(card); img.alt = ''; img.width = card.width; img.height = card.height;
    img.loading = 'lazy'; img.decoding = 'async';
    const meta = document.createElement('span'); meta.className = 'collection-card-meta';
    meta.textContent = card.score == null ? `${kindOf(card)} · ${editionLabel(card)}` : `${kindOf(card)} · ${card.edition} · ${card.score} PTS`;
    const name = document.createElement('strong'); name.textContent = card.name;
    const hint = document.createElement('span'); hint.className = 'collection-card-hint'; hint.textContent = 'Ver las dos caras';
    button.append(img, meta, name, hint);
    button.addEventListener('click', () => open(card, button));
    fragment.append(button);
  }
  grid.append(fragment);
  }
  // A hidden catalog must not create/decode dozens of images at launch.
  const catalogPage = document.getElementById('catalogo');
  const catalogObserver = new MutationObserver(() => {
    if (!catalogPage.classList.contains('active')) return;
    renderCatalog();
    catalogObserver.disconnect();
  });
  if (catalogPage?.classList.contains('active')) renderCatalog();
  else if (catalogPage) catalogObserver.observe(catalogPage, {attributes:true, attributeFilter:['class']});
  globalThis.CardCollection = Object.freeze({catalog, thumbnail, close, open(cardId, button) {
    const card = catalog.find(item => item.id === cardId);
    if (card) open(card, button);
  }});
})();

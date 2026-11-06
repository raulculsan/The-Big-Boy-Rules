/* The Chota's daily decisions as pixel scenes: one place, a few props and his
   own lines for every chapter. Pure data and SVG; drawing lives in chota-decisions.js. */
(() => {
  'use strict';
  const K = '#1a1410';
  const r = (x, y, w, h, fill, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${extra}/>`;
  // A filled block with a one pixel ink outline, the room's prop style.
  const b = (x, y, w, h, fill) => r(x - 1, y - 1, w + 2, h + 2, K) + r(x, y, w, h, fill);
  const p = (points, fill, stroke = K) => `<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`;
  const c = (cx, cy, rad, fill, stroke = K) => `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`;
  const l = (x1, y1, x2, y2, stroke, width = 1) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${width}"/>`;
  const rows = (x, y, w, gap, count, fill, h = 1) => Array.from({length: count}, (_, i) => r(x, y + i * gap, w, h, fill)).join('');
  const cols = (x, y, h, gap, count, fill, w = 1) => Array.from({length: count}, (_, i) => r(x + i * gap, y, w, h, fill)).join('');

  const places = {
    calle: () => r(0, 0, 192, 96, '#1c2140') + r(0, 34, 192, 62, '#262b55')
      + [[4, 6], [30, 14], [61, 4], [97, 10], [131, 5], [170, 12]].map(([x, y]) => r(x, y, 1, 1, '#f3ead8')).join('')
      + b(4, 38, 30, 54, '#343a63') + b(38, 26, 26, 66, '#2c3159') + b(122, 32, 30, 60, '#343a63') + b(156, 20, 34, 72, '#2c3159')
      + [[8, 44], [20, 44], [8, 58], [20, 58], [8, 72], [42, 34], [52, 48], [42, 62], [126, 40], [138, 54], [126, 68], [160, 28], [174, 28], [160, 44], [174, 60], [160, 74]]
        .map(([x, y]) => r(x, y, 6, 7, '#f2c14e')).join('')
      + r(0, 92, 192, 28, '#3a3b48') + r(0, 92, 192, 2, '#5d5f6e') + rows(0, 100, 192, 8, 3, '#34353f')
      + b(80, 40, 2, 52, '#4a4d5c') + b(76, 36, 10, 5, '#4a4d5c') + r(77, 41, 8, 3, '#ffd77a', ' opacity=".9"'),
    playa: () => r(0, 0, 192, 24, '#ffb36b') + r(0, 24, 192, 18, '#ff8a5c') + r(0, 42, 192, 18, '#e0607a')
      + c(150, 58, 15, '#ffd36e', 'none') + r(0, 60, 192, 22, '#3a6fb0') + rows(10, 64, 30, 6, 3, '#78a8dc', 1)
      + rows(110, 67, 40, 6, 2, '#78a8dc') + r(0, 82, 192, 38, '#e8c27c') + rows(0, 96, 192, 9, 3, '#d9ae66')
      + b(182, 30, 4, 56, '#8a5a32') + p('184,30 162,36 170,30 160,24 178,26 176,16 186,26 190,18 190,30', '#4f8a3c'),
    sede: () => r(0, 0, 192, 90, '#22304f') + cols(0, 0, 90, 16, 12, '#1c2843')
      + b(14, 14, 34, 30, '#3b5a87') + r(30, 14, 2, 30, K) + r(14, 28, 34, 2, K) + r(15, 15, 15, 13, '#f1a65d')
      + r(0, 88, 192, 32, '#7a4a2a') + rows(0, 96, 192, 8, 3, '#6a3f22') + r(0, 88, 192, 2, '#4f2f1a'),
    oficina: () => r(0, 0, 192, 90, '#d8d2c2') + r(0, 70, 192, 20, '#c9c2b0') + b(16, 12, 56, 40, '#9fc4dc')
      + rows(17, 14, 54, 4, 10, '#e9e4d6', 2) + r(0, 90, 192, 30, '#8e939d') + rows(0, 98, 192, 8, 3, '#80858f')
      + b(80, 58, 8, 32, '#9a7754') + c(84, 52, 8, '#4f8a3c'),
    escenario: () => r(0, 0, 192, 88, '#1a0f1f') + p('64,0 128,0 156,88 36,88', '#fff3b0', 'none').replace('/>', ' opacity=".14"/>')
      + r(0, 0, 26, 88, '#8e1f2f') + cols(4, 0, 88, 7, 3, '#6d1622', 2) + r(166, 0, 26, 88, '#8e1f2f') + cols(170, 0, 88, 7, 3, '#6d1622', 2)
      + r(0, 0, 192, 8, '#6d1622') + r(0, 88, 192, 32, '#6b4226') + r(0, 88, 192, 3, '#c99a2e') + rows(0, 98, 192, 8, 3, '#5b371f'),
    lago: () => r(0, 0, 192, 60, '#9fd3f0') + r(0, 40, 192, 20, '#bfe3f5')
      + [[0, 38], [22, 34], [46, 40], [70, 32], [100, 38], [128, 34], [156, 40], [178, 36]].map(([x, y]) => b(x, y, 22, 22, '#3f7a3a') + r(x + 4, y + 3, 10, 6, '#5f9b45')).join('')
      + r(0, 60, 192, 34, '#3f86c4') + rows(20, 66, 26, 8, 3, '#7fb4e2') + rows(120, 70, 30, 8, 3, '#7fb4e2') + r(0, 92, 192, 28, '#5f9b45') + rows(0, 100, 192, 8, 3, '#4f8a3c'),
    metro: () => r(0, 0, 192, 92, '#e9e6dc') + rows(0, 8, 192, 8, 11, '#d3cfc2') + cols(0, 0, 92, 12, 16, '#d3cfc2')
      + r(0, 48, 192, 6, '#c8402f') + b(60, 18, 72, 16, '#2c4f8f') + r(66, 24, 60, 4, '#f3ead8')
      + r(0, 92, 192, 28, '#7b7f88') + r(0, 92, 192, 3, '#f2c14e') + rows(0, 102, 192, 8, 2, '#6c7079'),
    cocina: () => r(0, 0, 192, 72, '#cfe3df') + rows(0, 8, 192, 8, 9, '#b8d0cb') + cols(0, 0, 72, 12, 16, '#b8d0cb')
      + b(0, 72, 192, 4, '#d9cbb6') + r(0, 76, 192, 16, '#6b4a35') + cols(30, 78, 12, 48, 4, '#4d3424')
      + r(0, 92, 192, 28, '#e7e2d6') + Array.from({length: 24}, (_, i) => r((i % 12) * 16 + (Math.floor(i / 12) % 2) * 8, 92 + Math.floor(i / 12) * 14, 8, 14, '#2b2f38')).join(''),
    fiesta: () => r(0, 0, 192, 90, '#3a2a52') + cols(0, 0, 90, 16, 12, '#33254a')
      + `<polyline points="0,10 32,20 64,12 96,22 128,12 160,20 192,10" fill="none" stroke="${K}" stroke-width="1"/>`
      + [[8, 13, '#f2c14e'], [24, 18, '#e5654a'], [44, 17, '#6f93d1'], [60, 13, '#8cc06a'], [80, 18, '#f08fb0'], [100, 20, '#f2c14e'], [118, 15, '#e5654a'], [140, 15, '#6f93d1'], [156, 19, '#8cc06a'], [176, 14, '#f08fb0']]
        .map(([x, y, f]) => b(x, y, 3, 4, f)).join('')
      + r(0, 90, 192, 30, '#5b3a2a') + rows(0, 98, 192, 8, 3, '#4d3022'),
  };

  const props = {
    boat: () => l(146, 0, 146, 34, K, 2) + l(146, 34, 120, 44, K) + l(146, 34, 168, 44, K)
      + p('112,46 178,46 168,64 122,64', '#f3ead8') + r(116, 52, 58, 3, '#3a5f9e') + b(130, 36, 26, 10, '#f3ead8') + r(134, 39, 5, 4, '#6f93d1') + r(146, 39, 5, 4, '#6f93d1'),
    glasses: () => b(112, 54, 10, 16, '#f6d77a') + r(116, 70, 2, 16, '#e9e4d6') + b(110, 86, 14, 2, '#e9e4d6')
      + b(136, 50, 10, 16, '#f6d77a') + r(140, 66, 2, 20, '#e9e4d6') + b(134, 86, 14, 2, '#e9e4d6')
      + b(160, 42, 14, 46, '#2f6b3a') + b(163, 30, 8, 12, '#2f6b3a') + b(162, 26, 10, 4, '#c99a2e') + b(161, 56, 12, 12, '#f3ead8')
      + [[124, 46], [128, 40], [146, 38], [150, 44]].map(([x, y]) => r(x, y, 2, 2, '#fff7d6')).join(''),
    wallet: () => b(100, 72, 84, 4, '#8a5a32') + b(100, 80, 84, 4, '#8a5a32') + b(104, 84, 4, 12, '#4a4d5c') + b(176, 84, 4, 12, '#4a4d5c')
      + b(124, 60, 30, 12, '#7a4a2a') + r(126, 56, 22, 5, '#7fbf6a') + r(128, 53, 18, 4, '#9ad081') + b(156, 62, 12, 9, '#f3ead8') + r(158, 64, 8, 4, '#c79a5b') + r(159, 64, 6, 1, K),
    hut: () => p('100,40 146,22 192,40', '#d9a441') + rows(104, 30, 84, 4, 2, '#b8862f') + b(104, 40, 4, 30, '#8a5a32') + b(184, 40, 4, 30, '#8a5a32')
      + b(102, 70, 88, 26, '#8a5a32') + rows(102, 76, 88, 6, 3, '#6f4626') + b(150, 46, 26, 24, '#dfe6ea') + r(151, 47, 24, 22, '#bfcbd2')
      + b(154, 50, 7, 7, '#f08fb0') + b(164, 50, 7, 7, '#6f93d1') + b(154, 60, 7, 7, '#8cc06a') + b(164, 60, 7, 7, '#f2c14e'),
    towtruck: () => b(98, 64, 46, 24, '#f2c14e') + b(98, 52, 20, 14, '#f2c14e') + r(101, 55, 13, 7, '#9fd3f0') + r(98, 72, 46, 3, '#c8402f')
      + l(140, 64, 160, 40, K, 2) + l(160, 40, 168, 52, K) + p('146,74 188,58 190,70 150,86', '#3a5f9e') + p('156,72 176,64 178,68 160,76', '#9fd3f0')
      + c(108, 90, 6, '#2b2f38') + c(134, 90, 6, '#2b2f38') + c(160, 86, 5, '#2b2f38') + c(182, 78, 5, '#2b2f38'),
    pot: () => [[118, 40], [132, 30], [146, 38], [140, 22]].map(([x, y]) => r(x, y, 8, 6, '#cfd4d9', ' opacity=".9"')).join('')
      + b(116, 50, 46, 4, '#7a818a') + b(118, 54, 42, 26, '#5d6670') + r(120, 58, 38, 3, '#7a818a') + b(108, 60, 8, 4, '#2b2f38') + b(162, 60, 8, 4, '#2b2f38')
      + b(110, 80, 58, 6, '#2b2f38') + p('122,80 126,72 130,80', '#f2a33a', 'none') + p('136,80 140,70 144,80', '#e5654a', 'none') + p('150,80 154,73 158,80', '#f2a33a', 'none'),
    guitar: () => b(112, 64, 30, 24, '#c8402f') + b(116, 56, 22, 10, '#c8402f') + c(127, 72, 4, K) + b(124, 24, 6, 34, '#7a4a2a') + b(121, 18, 12, 8, '#4a2d1a')
      + rows(125, 30, 4, 6, 4, '#e9e4d6') + b(152, 60, 32, 36, '#2b2f38') + r(156, 64, 24, 24, '#3d424c') + c(168, 76, 9, '#1a1d23') + c(168, 76, 4, '#5d6670'),
    coin: () => `<polyline points="100,90 120,78 136,82 156,60 172,64 188,36" fill="none" stroke="#4f8a3c" stroke-width="3"/>`
      + c(140, 56, 20, '#f2c14e') + c(140, 56, 15, '#e0ad36') + r(134, 46, 12, 4, '#f6d77a') + r(132, 50, 4, 12, '#f6d77a') + r(134, 62, 12, 4, '#f6d77a')
      + [[110, 30], [176, 24], [164, 86]].map(([x, y]) => r(x, y, 2, 2, '#fff7d6')).join(''),
    cake: () => b(112, 70, 48, 22, '#f3d0e0') + r(112, 76, 48, 3, '#e58fb3') + b(120, 56, 32, 14, '#f7e6ef') + r(120, 61, 32, 2, '#e58fb3')
      + [126, 135, 144].map(x => b(x, 46, 2, 10, '#6f93d1') + r(x, 42, 2, 3, '#f2a33a')).join('')
      + b(168, 76, 20, 20, '#3a5f9e') + r(176, 76, 4, 20, '#f2c14e') + r(168, 84, 20, 4, '#f2c14e') + p('172,76 178,70 180,76', '#f2c14e') + p('180,76 186,70 184,77', '#f2c14e'),
    cat: () => b(148, 66, 22, 28, '#2b2f38') + b(146, 50, 24, 18, '#2b2f38') + p('147,50 151,42 155,50', '#2b2f38') + p('161,50 165,42 169,50', '#2b2f38')
      + r(152, 56, 3, 3, '#8cc06a') + r(162, 56, 3, 3, '#8cc06a') + `<polyline points="170,90 182,86 184,74" fill="none" stroke="#2b2f38" stroke-width="3"/>`
      + c(118, 58, 12, '#bfe3f5', '#c99a2e').replace('stroke-width="1"', 'stroke-width="3"') + l(126, 67, 138, 82, '#7a4a2a', 4),
    bed: () => b(100, 50, 6, 46, '#7a4a2a') + b(104, 66, 82, 18, '#f3ead8') + rows(104, 70, 82, 5, 3, '#cfd9e8') + b(108, 58, 22, 9, '#ffffff')
      + b(104, 84, 82, 4, '#6f93d1') + b(182, 76, 4, 20, '#7a4a2a')
      + [[150, 30, 10], [162, 22, 8], [172, 14, 6]].map(([x, y, s]) => r(x, y, s, 2, '#f3ead8') + r(x, y + s - 2, s, 2, '#f3ead8') + p(`${x + s},${y + 2} ${x},${y + s - 2} ${x + 2},${y + s - 2} ${x + s},${y + 2}`, '#f3ead8', '#f3ead8')).join(''),
    dumbbell: () => b(108, 78, 76, 5, '#9aa3ad') + b(110, 66, 10, 30, '#2b2f38') + b(122, 70, 6, 22, '#3d424c') + b(172, 66, 10, 30, '#2b2f38') + b(164, 70, 6, 22, '#3d424c')
      + b(130, 40, 32, 22, '#3a5f9e') + r(130, 46, 32, 2, '#f3ead8') + r(145, 40, 2, 22, '#f3ead8'),
    letter: () => b(108, 44, 72, 46, '#efe6d0') + p('108,44 144,70 180,44', '#e2d7bc') + c(144, 66, 6, '#b8332a') + r(142, 64, 4, 4, '#e5654a')
      + b(164, 48, 12, 14, '#6f93d1') + r(166, 50, 8, 10, '#9fbbe6') + rows(114, 78, 30, 4, 2, '#b9ad94'),
    ticket: () => b(104, 50, 76, 38, '#f6e7b4') + r(104, 50, 76, 8, '#c8402f') + [112, 124, 136, 148, 160].map(x => b(x, 66, 8, 12, '#f3ead8') + r(x + 2, 69, 4, 6, '#2b2f38')).join('')
      + cols(106, 82, 4, 4, 18, '#e0cf93', 2) + b(150, 88, 34, 8, '#c8402f'),
    moto: () => c(112, 84, 11, '#2b2f38') + c(112, 84, 4, '#9aa3ad') + c(170, 84, 11, '#2b2f38') + c(170, 84, 4, '#9aa3ad')
      + p('110,74 134,62 164,62 176,74 160,80 122,80', '#c8402f') + b(130, 56, 24, 6, '#2b2f38') + l(164, 62, 174, 46, K, 3) + b(170, 42, 12, 4, '#2b2f38')
      + `<polyline points="138,70 142,66 146,71 150,66 154,70" fill="none" stroke="#f3ead8" stroke-width="2"/>`,
    piano: () => b(104, 36, 78, 52, '#2b2f38') + r(108, 40, 70, 18, '#3d424c') + b(104, 58, 78, 4, '#1f2229') + b(108, 62, 70, 10, '#f3ead8')
      + cols(114, 62, 6, 8, 8, '#1a1d23', 4) + b(108, 88, 6, 8, '#2b2f38') + b(172, 88, 6, 8, '#2b2f38') + b(130, 28, 22, 8, '#8a5a32'),
    fine: () => b(110, 30, 50, 64, '#f3ead8') + r(110, 30, 50, 10, '#c8402f') + rows(116, 48, 38, 6, 5, '#b9ad94', 2) + b(124, 76, 22, 12, '#e5654a') + r(127, 79, 16, 6, '#f3ead8')
      + b(176, 40, 4, 56, '#5d6670') + b(170, 30, 18, 12, '#9aa3ad') + c(176, 36, 3, '#2b2f38') + r(184, 33, 2, 2, '#e5654a'),
    money: () => p('110,90 106,70 116,56 130,54 136,48 124,46 132,40 148,46 140,54 152,58 160,72 154,90', '#d9b36a') + r(126, 60, 14, 2, '#8a5a32')
      + c(132, 72, 7, '#f2c14e') + c(150, 82, 5, '#f2c14e') + b(170, 40, 10, 14, '#f08fb0') + l(174, 54, 172, 82, '#f08fb0', 2) + l(176, 54, 178, 82, '#f08fb0', 2)
      + `<polyline points="172,40 168,28 174,22" fill="none" stroke="#f08fb0" stroke-width="3"/>` + b(174, 21, 6, 3, '#2b2f38'),
    dog: () => b(146, 26, 40, 70, '#7a4a2a') + r(150, 30, 32, 28, '#8a5a32') + r(150, 62, 32, 30, '#8a5a32') + b(176, 60, 4, 4, '#f2c14e')
      + b(112, 66, 30, 28, '#c79a5b') + b(108, 44, 30, 24, '#c79a5b') + b(104, 44, 6, 14, '#7a4a2a') + b(134, 44, 6, 14, '#7a4a2a')
      + b(111, 52, 10, 6, '#1a1d23') + b(125, 52, 10, 6, '#1a1d23') + r(121, 54, 4, 2, K) + r(113, 53, 3, 2, '#f3ead8') + r(127, 53, 3, 2, '#f3ead8')
      + b(119, 62, 8, 4, '#2b2f38') + p('118,70 122,74 126,70', '#d9b36a', 'none'),
    mic: () => b(134, 26, 18, 26, '#9aa3ad') + rows(136, 30, 14, 4, 5, '#6c7480') + b(140, 52, 6, 6, '#5d6670') + b(142, 58, 2, 30, '#5d6670') + b(128, 88, 30, 4, '#3d424c')
      + `<path d="M108 66 Q108 44 122 44" fill="none" stroke="${K}" stroke-width="4"/>` + b(102, 64, 12, 16, '#2b2f38')
      + `<path d="M164 66 Q164 44 178 44 Q190 44 190 60" fill="none" stroke="#2b2f38" stroke-width="3"/>` + b(160, 60, 10, 14, '#c8402f') + b(184, 60, 8, 14, '#c8402f'),
    trophy: () => b(108, 70, 30, 6, '#7a4a2a') + b(112, 76, 22, 20, '#8a5a32') + b(114, 36, 18, 22, '#f2c14e') + b(106, 40, 6, 10, '#f2c14e') + b(134, 40, 6, 10, '#f2c14e')
      + b(120, 58, 6, 6, '#c99a2e') + b(116, 64, 14, 6, '#c99a2e') + r(118, 40, 4, 12, '#fff3b0')
      + b(170, 56, 4, 40, '#5d6670') + b(156, 40, 32, 18, '#3a5f9e') + r(158, 46, 20, 2, '#1f3866') + b(184, 32, 3, 14, '#5d6670') + b(186, 32, 6, 5, '#c8402f'),
    watch: () => b(132, 24, 20, 72, '#c99a2e') + rows(132, 30, 20, 8, 9, '#a87e22') + c(142, 58, 18, '#f2c14e') + c(142, 58, 13, '#f3ead8')
      + l(142, 58, 142, 48, K, 2) + l(142, 58, 150, 62, K, 2) + r(141, 57, 2, 2, '#c8402f') + b(160, 54, 4, 6, '#f2c14e')
      + [[112, 36], [170, 30], [176, 78], [108, 80]].map(([x, y]) => r(x, y, 2, 6, '#fff3b0') + r(x - 2, y + 2, 6, 2, '#fff3b0')).join(''),
    bigman: () => b(116, 44, 60, 52, '#2b2f38') + b(130, 18, 32, 28, '#c79a5b') + r(130, 16, 32, 6, '#2b2f38') + b(134, 28, 10, 5, K) + b(148, 28, 10, 5, K)
      + r(144, 30, 4, 1, K) + b(120, 56, 52, 10, '#3d424c') + b(158, 54, 10, 6, '#f2c14e') + r(140, 40, 12, 2, '#8a5a32'),
    rowboat: () => p('104,66 182,66 172,80 114,80', '#8a5a32') + r(108, 66, 70, 3, '#a8703f') + l(120, 60, 100, 86, '#c99a2e', 3) + l(166, 60, 188, 86, '#c99a2e', 3)
      + r(0, 80, 192, 2, '#7fb4e2') + b(60, 70, 8, 6, '#f2c14e') + b(66, 66, 5, 5, '#f2c14e') + r(71, 68, 3, 2, '#f2a33a'),
    storage: () => b(106, 30, 80, 66, '#9aa3ad') + rows(108, 34, 76, 6, 10, '#7f8893', 2) + b(140, 84, 12, 10, '#c99a2e') + r(143, 80, 6, 5, 'none', ` stroke="${K}" stroke-width="2"`)
      + b(108, 16, 34, 8, '#8a5a32') + p('112,24 108,40 116,40', '#8a5a32') + b(96, 22, 14, 14, '#6b4226'),
    camera: () => b(116, 40, 44, 26, '#2b2f38') + c(166, 52, 10, '#3d424c') + c(166, 52, 5, '#6f93d1') + b(122, 34, 16, 6, '#3d424c') + c(124, 47, 3, '#e5654a', 'none')
      + l(138, 66, 120, 96, '#5d6670', 3) + l(138, 66, 138, 96, '#5d6670', 3) + l(138, 66, 156, 96, '#5d6670', 3)
      + [[176, 20], [104, 28], [184, 80]].map(([x, y]) => p(`${x},${y - 6} ${x + 2},${y - 2} ${x + 6},${y} ${x + 2},${y + 2} ${x},${y + 6} ${x - 2},${y + 2} ${x - 6},${y} ${x - 2},${y - 2}`, '#f2c14e')).join(''),
    taxi: () => b(110, 62, 78, 22, '#f3ead8') + p('122,62 132,46 168,46 178,62', '#f3ead8') + r(134, 49, 15, 11, '#9fd3f0') + r(152, 49, 14, 11, '#9fd3f0')
      + p('112,80 140,64 146,64 118,82', '#c8402f', 'none') + b(144, 40, 12, 5, '#4f8a3c') + c(126, 86, 7, '#2b2f38') + c(170, 86, 7, '#2b2f38')
      + b(88, 74, 18, 20, '#3a5f9e') + r(94, 70, 6, 4, 'none', ` stroke="${K}" stroke-width="2"`) + r(88, 82, 18, 2, '#1f3866'),
    receipt: () => b(100, 64, 86, 6, '#8a5a32') + b(104, 70, 4, 26, '#6b4226') + b(178, 70, 4, 26, '#6b4226') + c(118, 60, 8, '#f3ead8') + c(140, 60, 8, '#f3ead8')
      + b(158, 56, 14, 106, '#f3ead8').replace(/height="10[68]"/g, 'height="40"') + rows(160, 60, 10, 4, 9, '#b9ad94', 1) + p('158,96 161,92 164,96 167,92 170,96', '#f3ead8', 'none'),
    broom: () => r(0, 0, 192, 12, '#3b2a20') + `<polyline points="40,14 50,20 60,14 70,20" fill="none" stroke="#f3ead8" stroke-width="2"/>` + `<polyline points="120,14 130,20 140,14 150,20" fill="none" stroke="#f3ead8" stroke-width="2"/>`
      + [[80, 18], [96, 24], [110, 16], [160, 22]].map(([x, y]) => r(x, y, 2, 2, '#c9b79a')).join('')
      + l(150, 20, 126, 80, '#a8703f', 4) + p('112,78 140,78 146,96 106,96', '#e0b54a') + cols(112, 82, 14, 5, 7, '#b8862f'),
  };

  const scenes = {
    barco: {title: 'La botadura', place: 'calle', props: ['boat'], intro: 'El vecino quiere sacar un barco por la ventana de un quinto. Y me mira a mí, como si yo fuera la grúa.', react: ['¡Al agua! Bueno, a la calle primero.', 'Llamo al ayuntamiento. Que pongan ellos la grúa.']},
    boda: {title: 'Testigo de boda', place: 'fiesta', props: ['glasses'], intro: 'Me han hecho testigo esta mañana. Llevo dos copas y ni una frase.', react: ['Improviso. Lo que salga del corazón… y de la copa.', 'Algo de internet. Que alguien escriba por mí.', 'Brindo y me siento. Corto y elegante.']},
    cartera: {title: 'La cartera de la Castellana', place: 'calle', props: ['wallet'], intro: 'Ochocientos euros y la foto de un perro con gafas. El perro me está mirando.', react: ['La devuelvo. El perro merece justicia.', 'Me la quedo… aunque el perro ya conoce mi cara.']},
    chiringuito: {title: 'Inspección en el chiringuito', place: 'playa', props: ['hut'], intro: 'Inspección en el chiringuito. La nevera solo tiene camisas. Ni una cerveza.', react: ['Esto es una tienda, señor. De camisas frías.', '¡Por la playa! Corre, corre.']},
    'coche-grua': {title: 'Se lo lleva la grúa', place: 'calle', props: ['towtruck'], intro: 'La grúa se lleva mi coche. Con mi almuerzo dentro. Esto ya es personal.', react: ['Pago, pero el bocadillo vuelve conmigo.', 'Negocio. Le ofrezco medio bocadillo.']},
    cocina: {title: 'Cena para el club', place: 'cocina', props: ['pot'], intro: 'He prometido cena para todos. Mi último arroz acabó en urgencias.', react: ['Cocino de verdad. Que alguien tenga el 112 a mano.', 'Pido comida y finjo. Nadie tiene por qué saberlo.', 'Me pongo malo. Malísimo. De repente.']},
    concierto: {title: 'Telonero por error', place: 'escenario', props: ['guitar'], intro: 'Un festival cree que soy un grupo de rock. Actúo mañana.', react: ['Me subo al escenario. ¡Esto es rock!', 'Lo aclaro. Soy un tigre, no una banda.']},
    criptomoneda: {title: 'La moneda del Chota', place: 'oficina', props: ['coin'], intro: 'Un amigo quiere lanzar ChotaCoin. Dice que no se puede perder. Lo repite mucho.', react: ['¡ChotaCoin a la luna!', 'Paso. Mi dinero se queda en el colchón.']},
    cumple: {title: 'Cumpleaños sorpresa', place: 'fiesta', props: ['cake'], intro: 'Organizo una fiesta sorpresa y el homenajeado me pregunta qué hago esta noche.', react: ['Tengo un funeral. Muy triste. Muy creíble.', 'Se lo cuento todo. La sorpresa es que no hay sorpresa.', '¿Cómo? No te oigo. Hay mucho viento.']},
    detective: {title: 'Trabajo de detective', place: 'calle', props: ['cat'], intro: 'Una señora me paga por seguir a su gato. Dice que se ve con alguien.', react: ['Acepto. Gafas oscuras y a seguir al gato.', 'No. Los gatos tienen derecho a su vida privada.']},
    'fama-sofa': {title: 'Rey del sofá', place: 'escenario', props: ['bed'], intro: 'Una marca de colchones me quiere de imagen. Me obligan a dormir ocho horas.', react: ['Firmo. Por fin me pagan por lo que mejor hago.', 'Pido el doble. Un talento así no se regala.']},
    gimnasio: {title: 'Un año de gimnasio', place: 'sede', props: ['dumbbell'], intro: 'Gimnasio a mitad de precio. Al último fui dos veces en un año.', react: ['Me apunto. Esta vez sí. Seguro. Creo.', 'Corro por Madrid Río. Gratis y con vistas.', 'Me compro un chándal. Ya es medio camino.']},
    hacienda: {title: 'Carta de Hacienda', place: 'sede', props: ['letter'], intro: 'Me ha llegado una carta de Hacienda. Ya la he cambiado de habitación dos veces.', react: ['La abro. Que sea lo que tenga que ser.', 'Llamo a un gestor. Los valientes delegan.', 'La escondo mejor. Detrás del sofá no la encuentra nadie.']},
    loteria: {title: 'Décimo compartido', place: 'sede', props: ['ticket'], intro: 'Hoy es el sorteo y no sé dónde he guardado el décimo del club.', react: ['¡A registrar la sede! Cojín por cojín.', 'No tocó. Seguro que no tocó. Casi seguro.']},
    moto: {title: 'La moto prestada', place: 'calle', props: ['moto'], intro: 'Me dejaron una moto con una condición: ni un arañazo. Diez minutos después…', react: ['Confieso. Con la cabeza alta y la cartera abierta.', 'Un poco de rotulador y como nueva.', 'Ya estaba así. Lo juro por mi cola.']},
    mudanza: {title: 'Ayudar en una mudanza', place: 'calle', props: ['piano'], intro: 'Me piden ayuda en una mudanza. Cuarto sin ascensor. Con piano.', react: ['Voy. Para eso están los colegas.', 'Uy, la espalda… justo hoy.']},
    multa: {title: 'La multa misteriosa', place: 'calle', props: ['fine'], intro: 'Multa de una ciudad en la que nunca he estado. Y sale mi cara en la foto.', react: ['La pago y no pregunto.', 'Recurro. Ese tigre no soy yo.', 'La ignoro. Las multas también se cansan.']},
    'negocio-vice': {title: 'Un negocio en Vice City', place: 'playa', props: ['money'], intro: 'Un tipo con camisa de flamencos me ofrece un chiringuito. Pide dos mil euros y no tiene apellidos.', react: ['Invierto. ¡Me veo de jefe en la playa!', 'Primero el contrato. Con apellidos, por favor.', 'Lo rechazo con estilo. Gafas puestas y media vuelta.']},
    'perro-gafas': {title: 'El perro de las gafas', place: 'sede', props: ['dog'], intro: 'El perro de las gafas está en la puerta. Y no viene a jugar.', react: ['Perdón, perro. Te lo debía.', 'Te adopto. Ahora somos familia.', 'Cierro la puerta despacito…']},
    podcast: {title: 'Un podcast propio', place: 'sede', props: ['mic'], intro: 'Tengo micrófono y ninguna idea. Todo el mundo tiene podcast menos yo.', react: ['Hablo de mí. Tema infinito.', 'Entrevisto al portero. Ese hombre ha visto cosas.', 'Lo dejo antes de empezar. Ahorro tiempo.']},
    premio: {title: 'Premio al vecino del año', place: 'calle', props: ['trophy'], intro: 'Me han nominado a vecino del año. Mi rival es un buzón.', react: ['Hago campaña. ¡Vota Chota!', 'Me retiro. El buzón se lo merece.']},
    reloj: {title: 'Reloj sin factura', place: 'metro', props: ['watch'], intro: 'Un señor del metro me vende un reloj de oro por cincuenta euros. Marca una hora distinta cada vez.', react: ['Lo compro. Llegaré tarde, pero con estilo.', 'Regateo. Por veinte me llevo dos.', 'Aviso a seguridad. Esto huele raro.']},
    'reloj-dueno': {title: 'El dueño del reloj', place: 'sede', props: ['bigman'], intro: 'Un hombre muy grande pregunta por un reloj de oro. Dice que es de su familia.', react: ['Se lo devuelvo. Muy amablemente. Muy rápido.', '¿Reloj? ¿Qué reloj? Yo no uso reloj.']},
    retiro: {title: 'Remo en El Retiro', place: 'lago', props: ['rowboat'], intro: 'Carrera de barcas en El Retiro. Mi rival tiene ochenta años y nunca ha perdido.', react: ['¡Remo a muerte!', 'Un poquito de trampa no hace daño.', 'Le dejo ganar. Respeto a los mayores.']},
    siesta: {title: 'Vacaciones forzosas', place: 'sede', props: ['bed'], intro: 'El médico dice que tengo los niveles de alguien que ha visto cosas. Toca descansar.', react: ['Hago caso. Sofá, manta y siesta.', '¿Descansar? Esta noche salimos.']},
    subasta: {title: 'Subasta en Argüelles', place: 'calle', props: ['storage'], intro: 'Subastan un trastero en Argüelles y he levantado la mano sin querer.', react: ['Pujo en serio. ¡Ese trastero es mío!', 'Me rasco la oreja, disimulando…', '¡Me voy corriendo!']},
    talento: {title: 'Casting en televisión', place: 'escenario', props: ['camera'], intro: 'Buscan talentos raros en la tele. Yo me duermo en cinco segundos donde sea.', react: ['Me presento. Cinco, cuatro, tres… zzz.', 'Mando a otro. Mi talento es delegar.']},
    taxi: {title: 'Una maleta en el taxi', place: 'calle', props: ['taxi'], intro: 'Alguien se ha dejado una maleta en el taxi. Pesa y hace un ruido suave.', react: ['La abro. La curiosidad mató al gato, no al tigre.', 'A objetos perdidos, como un ciudadano ejemplar.', 'Me la quedo sin abrir. Hay misterios que no se tocan.']},
    'ultima-cena': {title: 'La cena del balance', place: 'fiesta', props: ['receipt'], intro: 'Fin de mes y cena de balance. La cuenta es más larga que la carta.', react: ['Pago todo. Hoy invito yo. Creo.', 'A partes iguales. Matemáticas justas.', 'Voy al baño… y ya si eso vuelvo.']},
    vecino: {title: 'El vecino de arriba', place: 'sede', props: ['broom'], intro: 'El vecino de arriba hace ruido cada noche a las tres. Construye algo. Algo grande.', react: ['Subo a hablar. Con educación y en pijama.', 'Le dejo una nota. Pasivo-agresiva, como manda la tradición.', 'Escoba al techo. Toc, toc.']},
  };
  const byTitle = new Map(Object.entries(scenes).map(([key, scene]) => [scene.title, key]));
  function keyFor(entry) {
    if (entry?.key && scenes[entry.key]) return entry.key;
    return byTitle.get(entry?.title) || '';
  }
  // Unknown chapters still get a scene: the sede with the official letter.
  function svg(key) {
    const scene = scenes[key] || {place: 'sede', props: ['letter']};
    return `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="120" viewBox="0 0 192 120" shape-rendering="crispEdges">${places[scene.place]()}${scene.props.map(name => props[name]()).join('')}</svg>`;
  }
  globalThis.ChotaScenes = Object.freeze({scenes, keyFor, svg});
})();

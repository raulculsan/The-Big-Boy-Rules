/* Authoring asset only; this file does not alter the published card catalog. */
import {readFile, writeFile, copyFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root = new URL('../../../', import.meta.url);
const sharp = (await import(process.env.SHARP_MODULE || 'sharp')).default;
const base = 'lizzy-machado-yong-halloween-93-v1';
const scene = await readFile(new URL('artwork/cards/halloween/lizzy-machado-yong-halloween-93-scene-v1.png', root));
let card = await readFile(new URL('icons/cards/gema-gonzalez-marugan-halloween-91-v2.svg', root), 'utf8');
card = card
  .replace('Gema Gonzalez Marugan, personaje Halloween, 91 puntos.', 'Lizzy Machado Yong, miembro Halloween, 93 puntos.')
  .replace(/href="data:image\/png;base64,[^"]+"/, `href="data:image/png;base64,${scene.toString('base64')}"`)
  .replace('>91</text>', '>93</text>')
  .replace('>PERSONAJE</text>', '>MIEMBRO</text>')
  .replaceAll('gema-halloween-name-fractures', 'lizzy-halloween-name-fractures')
  .replaceAll('gema-name-webs', 'lizzy-name-webs')
  .replace('aria-label="Gema Gonzalez Marugan"', 'aria-label="Lizzy Machado Yong"')
  .replace('>GEMA GONZALEZ</text>', '>LIZZY MACHADO</text>')
  .replace('>MARUGAN</text>', '>YONG</text>')
  .replace('font-size="72" letter-spacing="3" fill="url(#h-ivory)" textLength="470"', 'font-size="74" letter-spacing="3" fill="url(#h-ivory)" textLength="300"')
  .replace('transform="translate(315 1452)"', 'transform="translate(380 1452)"')
  .replace('transform="translate(632 1510) scale(-1 -1)"', 'transform="translate(565 1510) scale(-1 -1)"');

if (!card.includes('>93</text>') || !card.includes('>LIZZY MACHADO</text>') || !card.includes('>YONG</text>')) {
  throw new Error('No se pudo completar la carta Halloween de Lizzy.');
}
await writeFile(new URL(`icons/cards/${base}.svg`, root), card);
await sharp(Buffer.from(card), {density:72}).png().toFile(fileURLToPath(new URL(`icons/cards/${base}.png`, root)));
await copyFile(new URL(`icons/cards/${base}.png`, root), new URL(`docs/cartas/miembros/${base}.png`, root));
console.log(`icons/cards/${base}.png`);

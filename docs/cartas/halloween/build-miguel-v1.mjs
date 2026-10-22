/* Authoring asset only; this file does not alter the published card catalog. */
import {readFile, writeFile, copyFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root = new URL('../../../', import.meta.url);
const sharp = (await import(process.env.SHARP_MODULE || 'sharp')).default;
const base = 'miguel-angel-jimenez-sanchez-halloween-95-v1';
const scene = await readFile(new URL('artwork/cards/halloween/miguel-angel-jimenez-sanchez-halloween-95-scene-v1.png', root));
let card = await readFile(new URL('icons/cards/lizzy-machado-yong-halloween-93-v1.svg', root), 'utf8');
card = card
  .replace('Lizzy Machado Yong, miembro Halloween, 93 puntos.', 'Miguel Angel Jimenez Sanchez, miembro Halloween, 95 puntos.')
  .replace(/href="data:image\/png;base64,[^"]+"/, `href="data:image/png;base64,${scene.toString('base64')}"`)
  .replace('>93</text>', '>95</text>')
  .replaceAll('lizzy-halloween-name-fractures', 'miguel-halloween-name-fractures')
  .replaceAll('lizzy-name-webs', 'miguel-name-webs')
  .replace('aria-label="Lizzy Machado Yong"', 'aria-label="Miguel Angel Jimenez Sanchez"')
  .replace('>LIZZY MACHADO</text>', '>MIGUEL ANGEL</text>')
  .replace('>YONG</text>', '>JIMENEZ SANCHEZ</text>')
  .replace('font-size="74" letter-spacing="3" fill="url(#h-ivory)" textLength="300"', 'font-size="74" letter-spacing="2" fill="url(#h-ivory)" textLength="704"');

if (!card.includes('>95</text>') || !card.includes('>MIGUEL ANGEL</text>') || !card.includes('>JIMENEZ SANCHEZ</text>')) {
  throw new Error('No se pudo completar la carta Halloween de Miguel Angel.');
}
await writeFile(new URL(`icons/cards/${base}.svg`, root), card);
await sharp(Buffer.from(card), {density:72}).png().toFile(fileURLToPath(new URL(`icons/cards/${base}.png`, root)));
await copyFile(new URL(`icons/cards/${base}.png`, root), new URL(`docs/cartas/miembros/${base}.png`, root));
console.log(`icons/cards/${base}.png`);

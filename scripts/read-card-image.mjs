/* Decode published JPEG delivery art through the same PNG pixel validation as sources. */
import {readFile, mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, extname} from 'node:path';
import {spawn} from 'node:child_process';

const run = (command, args) => new Promise((accept, reject) => {
  const child = spawn(command, args, {stdio:['ignore','ignore','pipe']});
  let errors = '';
  child.stderr.on('data', chunk => { errors += chunk; });
  child.once('error', reject);
  child.once('exit', code => code === 0 ? accept() : reject(new Error(`No se pudo decodificar la imagen: ${errors || code}`)));
});

export async function readCardImage(path) {
  const bytes = await readFile(path);
  const extension = extname(path).toLowerCase();
  if (extension === '.png') return {data:bytes, bytes:bytes.length};
  if (!['.jpg','.jpeg'].includes(extension) || bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new Error('Archivo JPEG inválido');
  }
  // Do not skip margins, dimensions or image-content checks for delivery assets.
  // Decode to lossless RGB pixels; JPEG's lack of alpha must not hide white padding.
  const directory = await mkdtemp(join(tmpdir(), 'bigboy-card-preflight-'));
  const output = join(directory, 'decoded.png');
  try {
    if (process.platform === 'darwin') await run('/usr/bin/sips', ['--setProperty','format','png',path,'--out',output]);
    else await run('magick', [path, `PNG24:${output}`]);
    return {data:await readFile(output), bytes:bytes.length};
  } finally { await rm(directory, {recursive:true, force:true}); }
}

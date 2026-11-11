#!/usr/bin/env node
// Downloads every file in every Supabase Storage bucket into <out>/<bucket>/<path>.
// Used by .github/workflows/backup.yml. Needs SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY in the environment; never prints either.
import fs from 'node:fs/promises';
import path from 'node:path';

const base = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const out = path.resolve(process.argv[2] || 'files');
if (!base || !key) { console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.'); process.exit(1); }
const headers = {Authorization: `Bearer ${key}`, apikey: key};

async function call(url, init = {}, tries = 4) {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, {...init, headers: {...headers, ...init.headers}});
      if (response.ok) return response;
      if (response.status < 500 && response.status !== 429) throw new Error(`HTTP ${response.status}`);
      if (attempt >= tries) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      if (attempt >= tries || /HTTP 4\d\d/.test(error.message) && !/429/.test(error.message)) throw error;
    }
    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
  }
}

async function list(bucket, prefix = '') {
  const files = [];
  for (let offset = 0; ; offset += 1000) {
    const response = await call(`${base}/storage/v1/object/list/${encodeURIComponent(bucket)}`, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({prefix, limit: 1000, offset, sortBy: {column: 'name', order: 'asc'}}),
    });
    const page = await response.json();
    for (const entry of page) {
      const full = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) files.push(...await list(bucket, full)); // folder
      else files.push(full);
    }
    if (page.length < 1000) return files;
  }
}

const safe = (root, relative) => {
  const target = path.resolve(root, relative);
  if (!target.startsWith(root + path.sep)) throw new Error('Ruta no válida');
  return target;
};

const buckets = await (await call(`${base}/storage/v1/bucket`)).json();
let total = 0, bytes = 0, failed = 0;
for (const {id: bucket} of buckets) {
  const files = await list(bucket);
  const root = path.join(out, bucket);
  let next = 0;
  await Promise.all(Array.from({length: 6}, async () => {
    while (next < files.length) {
      const name = files[next++];
      try {
        const encoded = name.split('/').map(encodeURIComponent).join('/');
        const body = Buffer.from(await (await call(`${base}/storage/v1/object/authenticated/${encodeURIComponent(bucket)}/${encoded}`)).arrayBuffer());
        const target = safe(root, name);
        await fs.mkdir(path.dirname(target), {recursive: true});
        await fs.writeFile(target, body);
        total++; bytes += body.length;
      } catch (error) { failed++; console.warn(`No se pudo copiar un archivo de ${bucket}: ${error.message}`); }
    }
  }));
  console.log(`${bucket}: ${files.length} archivos`);
}
console.log(`Total: ${total} archivos, ${(bytes / 1048576).toFixed(1)} MB, ${failed} fallos.`);
if (failed && failed > total * 0.05) process.exit(1);

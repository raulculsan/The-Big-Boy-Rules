// Local-only export. Optional argument: absolute path to an installed sharp module.
import {readFile, writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const sharp = (await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : 'sharp')).default;
const here = new URL('./', import.meta.url);
const item = JSON.parse(await readFile(new URL('catalog.json', here), 'utf8'));
await sharp(await readFile(new URL('ps-portal-v2.svg', here))).png().toFile(new URL('ps-portal-v2.png', here).pathname);
const sql = value => `'${String(value).replaceAll("'", "''")}'`;
await writeFile(new URL('update-placement-v2.sql', here), `-- Upload and verify shop-media/chota/ps-portal-v2.png before applying.\n-- Only migrate the known v1 visual; never overwrite a newer administration edit.\nUPDATE public.chota_item_catalog\nSET description = ${sql(item.description)},\n    presentation = ${sql(JSON.stringify(item.presentation))}::jsonb\nWHERE id = ${sql(item.id)}\n  AND presentation->>'path' = 'chota/ps-portal-v1.png';\n`);
console.log('Exported v2 transparent PNG and guarded visual-only UPDATE; v1 preserved, nothing uploaded.');

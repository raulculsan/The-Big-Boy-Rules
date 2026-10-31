// Local-only export. Optional argument: absolute path to an installed sharp module.
import {readFile, writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const sharp = (await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : 'sharp')).default;
const here = new URL('./', import.meta.url);
const item = JSON.parse(await readFile(new URL('catalog.json', here), 'utf8'));
await sharp(await readFile(new URL('ps-portal-v1.svg', here))).png().toFile(new URL('ps-portal-v1.png', here).pathname);
const sql = value => `'${String(value).replaceAll("'", "''")}'`;
await writeFile(new URL('publish.sql', here), `-- Upload ps-portal-v1.png to shop-media/chota/ps-portal-v1.png first.\n-- Reviewed publication only; reruns preserve all existing prices and metadata.\nINSERT INTO public.chota_item_catalog\n  (id, name, description, art_key, price, active, sort_order, presentation)\nVALUES\n  (${sql(item.id)}, ${sql(item.name)}, ${sql(item.description)}, ${sql(item.art_key)}, ${item.price}, ${item.active}, ${item.sort_order},\n   ${sql(JSON.stringify(item.presentation))}::jsonb)\nON CONFLICT (id) DO NOTHING;\n`);
console.log('Exported transparent PNG and insert-only publish.sql; nothing uploaded.');

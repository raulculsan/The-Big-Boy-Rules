// This prepares a verified file inventory; publishing belongs to Claude.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..'),dir='artwork/chota/modular-body-v1/',read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const contract=read('icons/mascot/chota-v2/neutral/manifest-v1.json');if(!contract.approved)throw Error('Neutral artwork has not been approved.');
const source=['app.js','app-theme.css','club.css','clubhouse.css','club-store.css','store-rooms.css','store-rooms.js','chota-wardrobe.js','chota-wardrobe.css','chota-appearance.js','chota-compositor-worker.js','chota-decisions.js','chota-decisions.css','chota-games.js','chota-shop.js','index.html','service-worker.js','scripts/build-web.mjs'];
const assets=[...Object.values(contract.neutral),...Object.values(contract.defaults),...contract.originals.map(item=>item.path),'icons/mascot/chota-v2/neutral/manifest-v1.json','icons/mascot/chota-v2/neutral/idle-core-mask-v1.png',...['shirt','pants','shoes'].map(kind=>'icons/shop/garments-v3/original-'+kind+'.webp')];
const previous=read('artwork/chota/wardrobe-fidelity-v3/manifest.json').runtime;
const repairs=read('artwork/chota/wardrobe-fidelity-v4/manifest.json').runtime;
const dependencies=[...previous.filter(item=>item.kind==='coat'),...repairs].map(item=>item.path);
const migration='supabase/migrations/20261109180000_chota_modular_originals.sql',files=[...new Set([...source,...assets,...dependencies,migration])];
const payload={version:1,prepared:new Date().toISOString(),published:false,platforms:['web/PWA','iOS','Android'],source,assets,dependencies,migration,releaseOrder:['Publish source and complete assets to web, package native clients from reconciled source.','Verify deployed resources and mobile Worker support.','Apply the reviewed migration; wardrobe_version=1 enables modular outfits.'],files:files.map(file=>{const buffer=fs.readFileSync(path.join(root,file));return{file,bytes:buffer.length,sha256:crypto.createHash('sha256').update(buffer).digest('hex')};})};
fs.writeFileSync(path.join(root,dir,'release-manifest.json'),JSON.stringify(payload,null,2)+'\n');
console.log(JSON.stringify({source:source.length,assets:assets.length,dependencies:dependencies.length,files:payload.files.length,bytes:payload.files.reduce((sum,item)=>sum+item.bytes,0),published:false}));

// Package the unmodified PNGs exported by Krita into their original 256px canvas.
// No resampling, painting, alpha processing or image synthesis occurs here.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const dir=new URL('./',import.meta.url),root=new URL('../../../',import.meta.url);
const ora=new URL('chota-life-v2.ora',dir);
const xml=execFileSync('unzip',['-p',ora.pathname,'stack.xml'],{encoding:'utf8'});
for(const [name,layerName]of [['core','core'],['paw','paw-relaxed']]){
 const node=xml.match(new RegExp('<layer[^>]+name="'+layerName+'"[^>]+>'))?.[0];
 if(!node)throw new Error('Missing Krita layer: '+layerName);
 const attr=key=>node.match(new RegExp('(?:^| )'+key+'="([^"]+)"'))?.[1];
 const png=execFileSync('unzip',['-p',ora.pathname,attr('src')]);
 const w=png.readUInt32BE(16),h=png.readUInt32BE(20);
 fs.writeFileSync(new URL('source-'+name+'.png',dir),png);
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><image x="${attr('x')}" y="${attr('y')}" width="${w}" height="${h}" href="data:image/png;base64,${png.toString('base64')}"/></svg>`;
 fs.writeFileSync(new URL('icons/mascot/chota-v2/chota-idle-'+name+'-v2.svg',root),svg);
}

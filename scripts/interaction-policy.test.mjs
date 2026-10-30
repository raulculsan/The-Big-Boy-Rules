import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const states=/:focus(?:-visible|-within)?|:active|:hover|:checked|\.(?:selected|is-selected|active|is-active|actions-open|is-enabled|holding|is-on|is-marked|is-chosen|is-picked)\b|aria-(?:selected|current|pressed|expanded|checked)|::selection|\.club-guide-highlight/;
const warmVars=/var\(--(?:[\w-]*gold[\w-]*|accent(?:-2)?|editor-accent|cl-accent|unlock-accent|achievement-(?:metal|glow))\b/;
function warmColor(token){
 let rgb;
 if(token[0]==='#'){
  let hex=token.slice(1);if(hex.length<5)hex=[...hex].map(x=>x+x).join('');
  rgb=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255);
 }else rgb=(token.match(/[\d.]+/g)||[]).slice(0,3).map(x=>Number(x)/255);
 const max=Math.max(...rgb),min=Math.min(...rgb),delta=max-min;
 if(!delta||delta/max<.1)return false;
 let hue=max===rgb[0]?(rgb[1]-rgb[2])/delta:max===rgb[1]?(rgb[2]-rgb[0])/delta+2:(rgb[0]-rgb[1])/delta+4;
 hue=(hue*60+360)%360;return hue>=15&&hue<=75;
}
test('all shipped interaction rules use neutral feedback instead of yellow/gold selections',()=>{
 const errors=[];let checked=0;
 for(const name of readdirSync(root).filter(name=>name.endsWith('.css'))){
  const css=readFileSync(new URL(name,root),'utf8');
  for(const [,selector,body] of css.matchAll(/([^{}]+)\{([^{}]+)\}/g)){
   if(!states.test(selector))continue;checked++;
   const visual=body.replace(/--[\w-]+\s*:[^;]+;?/g,'');
   if(warmVars.test(visual))errors.push(`${name}: ${selector.trim()} uses gold state token`);
   const colors=visual.match(/#[\da-f]{8}\b|#[\da-f]{6}\b|#[\da-f]{4}\b|#[\da-f]{3}\b|rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+(?:\s*,\s*[\d.]+)?\s*\)/gi)||[];
   for(const color of colors.filter(warmColor))errors.push(`${name}: ${selector.trim()} uses ${color}`);
  }
 }
 assert.ok(checked>250,'audit must cover the complete app, not one menu');
 assert.deepEqual(errors,[]);
});

test('lazy-loaded styles share the current offline asset cache keys',()=>{
 const lazy=readFileSync(new URL('feature-loader.js',root),'utf8');
 const shell=readFileSync(new URL('service-worker.js',root),'utf8');
 const styles=[...lazy.matchAll(/['"]([^'"\s]+\.css\?v=[^'"\s]+)['"]/g)].map(match=>match[1]);
 assert.ok(styles.length>=3);
 for(const url of styles)assert.ok(shell.includes(url),`stale lazy style cache key: ${url}`);
});

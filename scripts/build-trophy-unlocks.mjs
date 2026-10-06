// Real, self-contained Lottie vectors. Existing detail animations remain untouched.
import {readFile, writeFile} from 'node:fs/promises';
const root = new URL('../icons/trophies/', import.meta.url);
const ranks = ['bronze', 'silver', 'gold', 'platinum'];
const colors = [[.91,.62,.38],[.77,.88,1],[1,.79,.3],[.61,.94,1]];
const prop = value => ({a:0,k:value});
const keys = entries => ({a:1,k:entries.map(([t,...s],i) => ({t,s,...(i < entries.length-1 ? {o:{x:.18,y:0},i:{x:.25,y:1}} : {})}))});
for (const [rank,tier] of ranks.entries()) {
  const scene = JSON.parse(await readFile(new URL(`${tier}.json`,root),'utf8'));
  const duration = [108,132,162,192][rank];
  scene.nm = `Big Boys · ${tier} · Desbloqueado`;
  scene.op = duration;
  scene.markers = [{tm:0,cm:'unlock',dr:duration}];
  for (const layer of scene.layers) layer.op = duration;
  const trophy = scene.layers.find(layer => layer.nm === 'trophy');
  const impact = [22,30,40,50][rank];
  trophy.ks.o = keys([[0,0],[10,100]]);
  trophy.ks.s = keys([[0,68-rank*9,68-rank*9],[impact,104+rank*3,104+rank*3],[impact+22,100,100]]);
  trophy.ks.p = keys([[0,256,290+rank*10],[impact,256,249-rank*2],[impact+22,256,256]]);
  trophy.ks.r = keys([[0,-5-rank*5],[impact,2+rank],[impact+22,0]]);
  let id = 20;
  const layer = (name,shapes,ks) => ({ddd:0,ind:id++,ty:4,nm:name,sr:1,ip:0,op:duration,st:0,bm:0,
    ks:{o:prop(100),r:prop(0),p:prop([256,246]),a:prop([0,0]),s:prop([100,100]),...ks},shapes});
  // Expanding metal rings sit behind the trophy, with no white-screen flash.
  for (let ring=0;ring<=rank;ring++) {
    const t=impact-8+ring*7;
    scene.layers.push(layer(`Resonance ${ring+1}`,[{ty:'el',p:prop([0,0]),s:prop([340,340])},
      {ty:'st',c:prop(colors[rank]),o:prop(100),w:prop(ring ? 1.4 : 3),lc:2,lj:2}],
    {s:keys([[t,30,30],[t+42,132,132]]),o:keys([[0,0],[t,0],[t+5,65],[t+42,0]])}));
  }
  const count=[6,12,24,40][rank];
  for(let n=0;n<count;n++) {
    const angle=n/count*Math.PI*2-.5;
    const t=impact-4+(n%5)*2;
    const radius=158+(n%4)*18;
    const diamond=rank===3 && n%3===0;
    const shape=diamond ? {ty:'sr',sy:1,pt:prop(4),p:prop([0,0]),r:prop(0),ir:prop(1.6),is:prop(0),or:prop(7),os:prop(0)}
      : {ty:'el',p:prop([0,0]),s:prop([2+(n%3),rank>=2 ? 7+(n%3)*3 : 2+(n%3)])};
    scene.layers.unshift(layer(`Metal spark ${n+1}`,[shape,{ty:'fl',c:prop(n%3===0 ? [1,.96,.86] : colors[rank]),o:prop(100),r:1}],{
      p:keys([[t,256+Math.cos(angle)*78,246+Math.sin(angle)*78],
        [t+36+rank*6,256+Math.cos(angle)*radius,246+Math.sin(angle)*radius+rank*10]]),
      r:keys([[t,n*37],[t+56,n*37+90+rank*45]]),
      o:keys([[0,0],[t,0],[t+5,95],[t+28,80],[t+52,0]])}));
  }
  await writeFile(new URL(`${tier}-unlock.json`,root),JSON.stringify(scene));
}
console.log('4 celebraciones Lottie: 1,8 / 2,2 / 2,7 / 3,2 segundos.');
